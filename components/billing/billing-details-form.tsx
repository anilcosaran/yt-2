'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2, ReceiptText } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { submitBillingDetails } from '@/lib/billing/billing-details-submit'
import {
  BILLING_CUSTOMER_PROFILE_QUERY_KEY,
  customerBillingProfileQueryOptions,
  invoiceListQueryOptions,
  type CustomerBillingProfile,
  type InvoiceTaxInfo,
} from '@/lib/billing/invoices-api'
import {
  BILLING_DETAILS_MAX_LENGTH,
  billingCountryOptions,
  billingDetailsSummary,
  billingDetailsValuesFromProfile,
  isBillingDataForbidden,
  type BillingDetailsErrorKind,
  type BillingDetailsErrors,
  type BillingDetailsField,
  type BillingDetailsValues,
} from '@/lib/billing/invoices-view'
import { cn } from '@/lib/utils'

/**
 * Y1-04: the name / address / VAT number printed on FUTURE invoices. One form, used in Settings > Billing and in a
 * dialog at the two checkouts (credit top-up, plan change) so the customer can add it before paying: the invoice is
 * issued at payment time from what is saved then, and an issued invoice never changes.
 */

export type BillingDetailsFormStatus = 'idle' | 'saving' | 'saved' | BillingDetailsErrorKind

const selectClassName = cn(
  'border-border h-10 w-full min-w-0 rounded-xl border bg-panel/50 px-3 py-1 text-base shadow-none outline-none md:text-sm',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  'aria-invalid:ring-destructive/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
)

/** The fields and their messages without any state: what the form shows for the given values / problems. */
export function BillingDetailsFormView({
  values,
  errors,
  status,
  idPrefix,
  locale,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: BillingDetailsValues
  errors: BillingDetailsErrors
  status: BillingDetailsFormStatus
  idPrefix: string
  locale: string
  onChange: (field: BillingDetailsField, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel?: () => void
}) {
  const t = useTranslations('Billing')
  const countries = React.useMemo(() => billingCountryOptions(locale), [locale])
  const saving = status === 'saving'
  const id = (field: BillingDetailsField) => `${idPrefix}-${field}`
  const problem = (field: BillingDetailsField) => {
    const code = errors[field]
    return code ? t(`invoices.details.problems.${code}`) : null
  }

  function renderInput(field: BillingDetailsField, label: string, options: { type?: string; autoComplete?: string; hint?: string } = {}) {
    const message = problem(field)
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id(field)}>{label}</Label>
        <Input
          id={id(field)}
          name={field}
          type={options.type ?? 'text'}
          autoComplete={options.autoComplete}
          maxLength={BILLING_DETAILS_MAX_LENGTH[field]}
          value={values[field]}
          disabled={saving}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id(field)}-problem` : undefined}
          onChange={(event) => onChange(field, event.target.value)}
        />
        {message ? <p id={`${id(field)}-problem`} className="text-xs text-destructive">{message}</p> : null}
        {!message && options.hint ? <p className="text-xs text-muted-foreground">{options.hint}</p> : null}
      </div>
    )
  }

  const countryProblem = problem('country_code')
  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="billing-details-form" noValidate>
      {status === 'saved' ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('invoices.details.saved')}</AlertDescription>
        </Alert>
      ) : null}
      {status === 'forbidden' || status === 'conflict' || status === 'invalid' || status === 'failed' ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(`invoices.details.errors.${status}`)}</AlertDescription>
        </Alert>
      ) : null}
      {renderInput('legal_name', t('invoices.details.legalName'), { autoComplete: 'organization' })}
      {renderInput('address_line1', t('invoices.details.addressLine1'), { autoComplete: 'address-line1' })}
      {renderInput('address_line2', t('invoices.details.addressLine2'), { autoComplete: 'address-line2' })}
      <div className="grid gap-4 sm:grid-cols-2">
        {renderInput('city', t('invoices.details.city'), { autoComplete: 'address-level2' })}
        {renderInput('postal_code', t('invoices.details.postalCode'), { autoComplete: 'postal-code' })}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('country_code')}>{t('invoices.details.country')}</Label>
        <select
          id={id('country_code')}
          name="country_code"
          className={selectClassName}
          value={values.country_code}
          disabled={saving}
          autoComplete="country"
          aria-invalid={countryProblem ? true : undefined}
          aria-describedby={countryProblem ? `${id('country_code')}-problem` : undefined}
          onChange={(event) => onChange('country_code', event.target.value)}
        >
          <option value="">{t('invoices.details.countryPlaceholder')}</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>{country.label}</option>
          ))}
        </select>
        {countryProblem ? <p id={`${id('country_code')}-problem`} className="text-xs text-destructive">{countryProblem}</p> : null}
      </div>
      {renderInput('billing_email', t('invoices.details.billingEmail'), { type: 'email', autoComplete: 'email' })}
      {renderInput('vat_number', t('invoices.details.vatNumber'), { hint: t('invoices.details.vatNumberHint') })}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onCancel} disabled={saving}>
            {t('invoices.details.cancel')}
          </Button>
        ) : null}
        <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? t('invoices.details.saving') : t('invoices.details.save')}
        </Button>
      </div>
    </form>
  )
}

/**
 * The form with its state: values start from the saved details (or empty), a save goes through `submitBillingDetails`
 * (local check, then the gateway) and the saved details replace the cached profile. A 409 refreshes the profile; the
 * caller remounts the form on a new version (`key`) so it shows what is saved now.
 */
export function BillingDetailsForm({
  profile,
  idPrefix,
  onSaved,
  onCancel,
}: {
  profile: CustomerBillingProfile | null
  idPrefix: string
  onSaved?: (profile: CustomerBillingProfile) => void
  onCancel?: () => void
}) {
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [values, setValues] = React.useState<BillingDetailsValues>(() => billingDetailsValuesFromProfile(profile))
  const [errors, setErrors] = React.useState<BillingDetailsErrors>({})
  const [status, setStatus] = React.useState<BillingDetailsFormStatus>('idle')
  const savingRef = React.useRef(false)

  function handleChange(field: BillingDetailsField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
    setStatus((current) => (current === 'saving' ? current : 'idle'))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    savingRef.current = true
    setStatus('saving')
    try {
      const result = await submitBillingDetails(values, profile?.version ?? null)
      if (result.ok) {
        queryClient.setQueryData(BILLING_CUSTOMER_PROFILE_QUERY_KEY, result.profile)
        setErrors({})
        setStatus('saved')
        onSaved?.(result.profile)
        return
      }
      if (result.reason === 'validation') {
        setErrors(result.errors)
        setStatus('idle')
        return
      }
      setStatus(result.reason)
      if (result.reason === 'conflict') {
        await queryClient.invalidateQueries({ queryKey: BILLING_CUSTOMER_PROFILE_QUERY_KEY })
      }
    } finally {
      savingRef.current = false
    }
  }

  return (
    <BillingDetailsFormView
      values={values}
      errors={errors}
      status={status}
      idPrefix={idPrefix}
      locale={locale}
      onChange={handleChange}
      onSubmit={(event) => void handleSubmit(event)}
      onCancel={onCancel}
    />
  )
}

/** Whether invoicing is on for this workspace and what VAT a top-up carries (the list answers both in one call). */
export function useInvoicingStatus(): { loaded: boolean; enabled: boolean; tax: InvoiceTaxInfo | null } {
  const query = useQuery(invoiceListQueryOptions({ page: 1, limit: 1 }))
  return {
    loaded: query.data !== undefined,
    enabled: query.data?.invoicing_enabled === true,
    tax: query.data?.tax ?? null,
  }
}

/** The saved billing details inside the checkout dialog; remounts the form when a newer version arrives. */
export function BillingDetailsDialogBody({ onDone }: { onDone: () => void }) {
  const query = useQuery(customerBillingProfileQueryOptions())
  const t = useTranslations('Billing')
  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t('invoices.loading')}>
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }
  if (query.isError) {
    return isBillingDataForbidden(query.error)
      ? <p className="text-sm text-muted-foreground" data-testid="billing-details-forbidden">{t('invoices.details.forbiddenRead')}</p>
      : <p className="text-sm text-muted-foreground" role="alert">{t('invoices.details.loadFailed')}</p>
  }
  const profile = query.data ?? null
  return (
    <BillingDetailsForm
      key={profile?.version ?? 'none'}
      profile={profile}
      idPrefix="checkout-billing-details"
      onSaved={onDone}
      onCancel={onDone}
    />
  )
}

/**
 * Checkout note (credit top-up page, plan change confirmation): while invoicing is on it says whose name the invoice
 * will carry and opens the billing-details dialog, so the address can be entered before the payment. Renders nothing
 * while invoicing is off or not yet known.
 */
export function BillingDetailsCheckoutNote({
  className,
  appearance = 'app',
}: {
  className?: string
  /** `plan`: the plan page's own white dialogs (fixed palette); `app`: the studio design tokens. */
  appearance?: 'app' | 'plan'
}) {
  const t = useTranslations('Billing')
  const status = useInvoicingStatus()
  const profileQuery = useQuery({ ...customerBillingProfileQueryOptions(), enabled: status.enabled })
  const [open, setOpen] = React.useState(false)
  if (!status.enabled) return null
  const profile = profileQuery.data ?? null
  const plan = appearance === 'plan'
  const actionLabel = profile ? t('invoices.checkout.edit') : t('invoices.checkout.add')
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm',
        plan ? 'border-[#e7e0d6] bg-[#fbfaf7] text-[#111111]' : 'border-border bg-muted/30',
        className,
      )}
      data-testid="billing-details-checkout-note"
    >
      <ReceiptText className={cn('mt-0.5 h-4 w-4 shrink-0', plan ? 'text-[#756f66]' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', plan ? 'text-[#111111]' : 'text-foreground')}>{t('invoices.checkout.title')}</p>
        <p className={cn('mt-0.5 text-xs', plan ? 'text-[#756f66]' : 'text-muted-foreground')}>
          {profile
            ? t('invoices.checkout.saved', { summary: billingDetailsSummary(profile) })
            : t('invoices.checkout.missing')}
        </p>
      </div>
      {plan ? (
        <button
          type="button"
          className="h-7 shrink-0 rounded-full border border-[#dedad2] bg-white px-3 text-xs font-semibold text-[#111111] transition-colors hover:border-[#111111]"
          onClick={() => setOpen(true)}
        >
          {actionLabel}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => setOpen(true)}>
          {actionLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('invoices.details.title')}</DialogTitle>
            <DialogDescription>{t('invoices.details.description')}</DialogDescription>
          </DialogHeader>
          {open ? <BillingDetailsDialogBody onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import * as React from 'react'
import { Elements, PaymentElement, loadStripe, useElements, useStripe, type StripeElementsOptions } from '@/lib/billing/mock-stripe'
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { confirmSetupIntent, createSetupIntent } from '@/lib/billing/api'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

const stripePromise = loadStripe('pk_mock_yt2')

type PaymentSetupIntent = Awaited<ReturnType<typeof createSetupIntent>>

export function AddPaymentMethodDialog({
  open,
  email,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  email: string
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const localizeError = useLocalizedError()
  const [setupIntent, setSetupIntent] = React.useState<PaymentSetupIntent | null>(null)
  const [setupError, setSetupError] = React.useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = React.useState(false)
  const [intentRequestKey, setIntentRequestKey] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setSetupIntent(null)
      setSetupError(null)
      setLoadingIntent(false)
      return
    }

    if (!stripePromise) return

    let cancelled = false
    setLoadingIntent(true)
    setSetupIntent(null)
    setSetupError(null)

    createSetupIntent({ email })
      .then((intent) => {
        if (!cancelled) setSetupIntent(intent)
      })
      .catch((error) => {
        if (!cancelled) setSetupError(localizeError(error))
      })
      .finally(() => {
        if (!cancelled) setLoadingIntent(false)
      })

    return () => {
      cancelled = true
    }
  }, [email, intentRequestKey, open])

  const elementsOptions = React.useMemo<StripeElementsOptions | null>(() => {
    if (!setupIntent) return null

    return {
      clientSecret: setupIntent.client_secret,
      appearance: {
        theme: 'stripe',
        variables: {
          borderRadius: '8px',
          colorPrimary: '#111111',
          colorText: '#111111',
          colorBackground: '#ffffff',
          colorDanger: '#DC2626',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        },
      },
    }
  }, [setupIntent])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border bg-muted/25 px-6 py-5 pr-12">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </span>
            <span className="min-w-0">
              <DialogTitle><UiText id="secure_card_setup_688b4b5b" /></DialogTitle>
              <DialogDescription className="mt-2">
                <UiText id="save_a_card_for_plan_renewals_package_changes_an_e9051836" /></DialogDescription>
            </span>
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          {!stripePromise ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <UiText id="card_payments_are_not_configured_83227374" /></div>
          ) : setupError ? (
            <div className="grid gap-3">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {setupError}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 w-fit" onClick={() => setIntentRequestKey((value) => value + 1)}>
                <UiText id="retry_9f5cd8a2" /></Button>
            </div>
          ) : loadingIntent || !elementsOptions || !setupIntent ? (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              <UiText id="preparing_secure_card_setup_7777050a" /></div>
          ) : (
            <Elements stripe={stripePromise} options={elementsOptions} key={setupIntent.client_secret}>
              <AddPaymentMethodForm
                email={email}
                setupIntent={setupIntent}
                onSaved={onSaved}
                onCancel={() => onOpenChange(false)}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddPaymentMethodForm({
  email,
  setupIntent,
  onSaved,
  onCancel,
}: {
  email: string
  setupIntent: PaymentSetupIntent
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const tAuto = useTranslations('Auto')
  const localizeError = useLocalizedError()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)
    try {
      const returnUrl = new URL(window.location.href)
      returnUrl.searchParams.set('section', 'billing')

      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
          payment_method_data: {
            billing_details: { email },
          },
        },
        redirect: 'if_required',
      })

      if (result.error) throw new Error(result.error.message ?? 'Card confirmation failed.')
      await confirmSetupIntent({ setup_intent_id: result.setupIntent?.id ?? setupIntent.setup_intent_id })
      await onSaved()
    } catch (submitError) {
      setError(localizeError(submitError, 'paymentRequired'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <PaymentElement
          options={{
            business: { name: 'Youtorch' },
            defaultValues: { billingDetails: { email } },
            fields: { billingDetails: { email: 'never' } },
            layout: 'tabs',
            paymentMethodOrder: ['card'],
            wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
          }}
        />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p><UiText id="your_card_details_are_encrypted_by_our_payment_p_a81abd82" /></p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="border-t border-border pt-4">
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
          <UiText id="cancel_77dfd213" /></Button>
        <Button type="submit" disabled={!stripe || !elements || submitting}>
          {submitting ? tAuto('saving_369c534d') : tAuto('save_card_053e0769')}
        </Button>
      </DialogFooter>
    </form>
  )
}

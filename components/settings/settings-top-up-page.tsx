'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Zap,
} from 'lucide-react'

import type { AccountProfileTenant } from '@/components/account/browser-account-client'
import { BillingDetailsCheckoutNote, useInvoicingStatus } from '@/components/billing/billing-details-form'
import { SettingsFrame } from '@/components/settings/settings-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  BILLING_BALANCE_UPDATED_EVENT,
  BILLING_AUTO_TOPUP_QUERY_KEY,
  BILLING_PAYMENT_METHODS_QUERY_KEY,
  BILLING_PAYMENT_METHOD_STATUS_QUERY_KEY,
  BILLING_QUERY_KEY,
  BILLING_QUOTA_USAGE_QUERY_KEY,
  BILLING_TOP_UP_PACKAGES_QUERY_KEY,
  STORAGE_DEBT_STATUS_QUERY_KEY,
  billingOverviewQueryKey,
  createTopUp,
  getAutoTopup,
  getBillingOverview,
  getCurrentBillingCycleRange,
  getTopUpPackages,
  getTopUpStatus,
  updateAutoTopup,
  type BillingQuotaUsage,
  type TopUpPackage,
} from '@/lib/billing/api'
import { ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY } from '@/lib/action-center/api'
import { isAuthClientError } from '@/lib/auth/errors'
import {
  clearManualTopUpAttempt,
  getManualTopUpScope,
  getOrCreateManualTopUpAttempt,
  manualTopUpAttemptStore,
  saveManualTopUpRequestId,
  type ManualTopUpAttempt,
} from '@/lib/billing/manual-top-up-attempt'
import { topUpVatQuote } from '@/lib/billing/invoices-view'
import { isAmbiguousMutationError } from '@/lib/idempotency/client-mutation-control'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { useFormatter, useTranslations } from 'next-intl'

interface SettingsTopUpPageProps {
  tenant: AccountProfileTenant | null
}

const preferredTopUpAmounts = new Set([1000, 2000, 5000, 10000])
const autoTopupThresholds = [250, 500, 1000, 2000, 5000]
const AddPaymentMethodDialog = dynamic(
  () => import('@/components/billing/add-payment-method-dialog').then((mod) => mod.AddPaymentMethodDialog),
  { ssr: false, loading: () => null },
)

export function SettingsTopUpPage({ tenant }: SettingsTopUpPageProps) {
  const tAuto = useTranslations('Auto')
  const tSettings = useTranslations('Settings')
  const tBilling = useTranslations('Billing')
  const localizeError = useLocalizedError()
  const formatter = useFormatter()
  const formatCredits = React.useCallback(
    (value: number) => formatter.number(value, { maximumFractionDigits: 4 }),
    [formatter],
  )
  const formatMoney = React.useCallback(
    (amount: number, currency = 'GBP') => formatter.number(amount, { style: 'currency', currency }),
    [formatter],
  )
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const email = tenant?.email?.trim() || 'billing@youtorch.app'
  const topUpScope = React.useMemo(
    () => tenant?.email ? getManualTopUpScope(tenant.email) : null,
    [tenant?.email],
  )
  const returnTo = React.useMemo(
    () => resolveSafeTopUpReturnPath(searchParams.get('return_to')),
    [searchParams],
  )
  const [selectedPackageId, setSelectedPackageId] = React.useState<string | null>(null)
  const [cardDialogOpen, setCardDialogOpen] = React.useState(false)
  const [pendingTopUp, setPendingTopUp] = React.useState(false)
  const [topUpMessage, setTopUpMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [autoEnabled, setAutoEnabled] = React.useState(false)
  const [autoThreshold, setAutoThreshold] = React.useState(500)
  const [autoAmount, setAutoAmount] = React.useState(2000)
  const [savedAutoEnabled, setSavedAutoEnabled] = React.useState(false)
  const [savedAutoThreshold, setSavedAutoThreshold] = React.useState(500)
  const [savedAutoAmount, setSavedAutoAmount] = React.useState(2000)
  const [autoTriggerStatus, setAutoTriggerStatus] = React.useState<'disabled' | 'not_configured' | 'ready' | 'armed'>('disabled')
  const [creditsUntilTrigger, setCreditsUntilTrigger] = React.useState<number | null>(null)
  const [savingAutoTopup, setSavingAutoTopup] = React.useState(false)
  const pendingTopUpRef = React.useRef(false)
  const recoveredTopUpOperationRef = React.useRef<string | null>(null)
  const autoTopupEditedRef = React.useRef(false)
  const billingCycle = React.useMemo(() => getCurrentBillingCycleRange(), [])
  const overviewInput = React.useMemo(() => ({
    cycleStart: billingCycle.cycleStart,
    cycleEnd: billingCycle.cycleEnd,
    invoiceLimit: 1,
  }), [billingCycle.cycleEnd, billingCycle.cycleStart])
  const packagesQuery = useQuery({
    queryKey: BILLING_TOP_UP_PACKAGES_QUERY_KEY,
    queryFn: ({ signal }) => getTopUpPackages({ signal }),
    staleTime: 10 * 60_000,
  })
  const overviewQuery = useQuery({
    queryKey: billingOverviewQueryKey(overviewInput),
    queryFn: ({ signal }) => getBillingOverview(overviewInput, { signal }),
    staleTime: 2 * 60_000,
  })
  const autoTopupQuery = useQuery({
    queryKey: BILLING_AUTO_TOPUP_QUERY_KEY,
    queryFn: ({ signal }) => getAutoTopup({ signal }),
    staleTime: 2 * 60_000,
  })
  React.useEffect(() => {
    const overview = overviewQuery.data
    if (!overview) return

    queryClient.setQueryData(BILLING_QUOTA_USAGE_QUERY_KEY, overview.quota_usage)
    queryClient.setQueryData(BILLING_PAYMENT_METHODS_QUERY_KEY, overview.payment_methods)
    queryClient.setQueryData(BILLING_PAYMENT_METHOD_STATUS_QUERY_KEY, overview.payment_method_status)
    queryClient.setQueryData(STORAGE_DEBT_STATUS_QUERY_KEY, overview.debt_status)
  }, [overviewQuery.data, queryClient])
  const packages = React.useMemo(
    () => [...(packagesQuery.data ?? [])].sort((left, right) => left.amount_credits - right.amount_credits),
    [packagesQuery.data],
  )
  const paymentMethods = overviewQuery.data?.payment_methods ?? []
  const methodStatus = overviewQuery.data?.payment_method_status ?? null
  const debtStatus = overviewQuery.data?.debt_status ?? null
  const quotaUsage = overviewQuery.data?.quota_usage ?? null
  const availableCredits = getAvailableCredits(quotaUsage)
  const topUpBalance = getTopUpBalance(quotaUsage)
  const planCredits = getPlanIncludedCredits(quotaUsage)
  const loading = [
    packagesQuery,
    overviewQuery,
    autoTopupQuery,
  ].some(isInitialTopUpQueryLoading)
  const queryError = getFirstTopUpQueryError([
    packagesQuery,
    overviewQuery,
    autoTopupQuery,
  ])
  const visibleError = error ?? (queryError ? localizeError(queryError) : null)

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: BILLING_AUTO_TOPUP_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: STORAGE_DEBT_STATUS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY }),
    ])
  }, [queryClient])

  const completeTopUpSuccess = React.useCallback(async (amountCredits: number) => {
    setTopUpMessage(`${formatCredits(amountCredits)} credits added.`)
    window.dispatchEvent(new CustomEvent(BILLING_BALANCE_UPDATED_EVENT))
    await refresh()
    if (returnTo) router.push(returnTo)
  }, [formatCredits, refresh, returnTo, router])

  React.useEffect(() => {
    setSelectedPackageId((current) => current ?? getVisiblePackages(packages)[0]?.package_id ?? null)
  }, [packages])

  React.useEffect(() => {
    const settings = autoTopupQuery.data
    if (!settings || autoTopupEditedRef.current) return

    const thresholdCredits = settings.threshold_credits ?? autoThreshold
    const amountCredits = settings.amount_credits ?? autoAmount

    setAutoEnabled(settings.enabled)
    setSavedAutoEnabled(settings.enabled)
    setAutoThreshold(thresholdCredits)
    setSavedAutoThreshold(thresholdCredits)
    setAutoAmount(amountCredits)
    setSavedAutoAmount(amountCredits)
    setAutoTriggerStatus(settings.trigger_status)
    setCreditsUntilTrigger(settings.credits_until_trigger)
  }, [autoAmount, autoThreshold, autoTopupQuery.data])

  const visiblePackages = getVisiblePackages(packages)
  const autoTopupAmountOptions = getAutoTopupAmountOptions(packages, autoAmount)
  const selectedPackage = visiblePackages.find((pkg) => pkg.package_id === selectedPackageId) ?? visiblePackages[0] ?? null
  const defaultPaymentMethod = paymentMethods.find((method) => method.is_default) ?? paymentMethods[0] ?? null
  const hasPaymentMethod = Boolean(
    defaultPaymentMethod
      || methodStatus?.payment_method_added
      || (methodStatus?.payment_method_count ?? 0) > 0
      || methodStatus?.has_payment_method
      || methodStatus?.has_default_payment_method,
  )
  const debtCredits = debtStatus?.total_debt_credits ?? 0
  const outstandingDebtCount = debtStatus?.debts.filter((debt) => debt.remaining_credits > 0).length ?? 0
  const projectedBalance = selectedPackage ? availableCredits + selectedPackage.amount_credits : availableCredits
  // Y1-04: while the supplier is VAT-registered the card is charged the NET package price plus VAT (invoicing switch).
  const invoicingStatus = useInvoicingStatus()
  const vatQuote = selectedPackage ? topUpVatQuote(selectedPackage.amount_gbp, invoicingStatus.enabled ? invoicingStatus.tax : null) : null
  const autoTopupState = getAutoTopupState({
    t: tSettings,
    formatCredits,
    enabled: autoEnabled,
    threshold: autoThreshold,
    amount: autoAmount,
    balance: topUpBalance,
    triggerStatus: autoTriggerStatus,
    creditsUntilTrigger,
    hasPaymentMethod,
  })
  const autoTopupHasChanges = autoEnabled !== savedAutoEnabled
    || (autoEnabled && (autoThreshold !== savedAutoThreshold || autoAmount !== savedAutoAmount))
  const showAutoTopupSave = autoEnabled || savedAutoEnabled || autoTopupHasChanges

  const executeTopUp = React.useCallback(async (
    selectedTopUpPackage: TopUpPackage,
    initialAttempt: ManualTopUpAttempt,
  ) => {
    if (pendingTopUpRef.current) return

    pendingTopUpRef.current = true
    setPendingTopUp(true)
    setTopUpMessage(null)
    setError(null)

    try {
      let attempt = initialAttempt
      let requestId = attempt.payload.requestId
      let amountCredits = attempt.payload.amountCredits || selectedTopUpPackage.amount_credits
      if (!requestId) {
        const request = await createTopUp({
          package_id: attempt.payload.packageId,
          idempotency_key: attempt.idempotencyKey,
        })
        requestId = request.request_id
        amountCredits = request.amount_credits
        attempt = saveManualTopUpRequestId(attempt, requestId)
        if (request.status === 'completed') {
          clearManualTopUpAttempt(attempt)
          await completeTopUpSuccess(amountCredits)
          return
        }
      }
      const status = await pollTopUpStatus(requestId)
      if (status.status === 'failed') {
        clearManualTopUpAttempt(attempt)
        throw Object.assign(new Error(status.error ?? 'Top-up payment failed.'), { code: 'TOPUP_PAYMENT_FAILED' })
      }
      if (status.status === 'not_found') {
        throw Object.assign(new Error('Top-up request was not found.'), { code: 'TOPUP_REQUEST_NOT_FOUND' })
      }
      if (status.status !== 'completed') {
        setTopUpMessage(tSettings('topUpStillProcessing'))
        await refresh()
        return
      }
      clearManualTopUpAttempt(attempt)
      await completeTopUpSuccess(amountCredits)
    } catch (topUpError) {
      if (!isAmbiguousMutationError(topUpError)) clearManualTopUpAttempt(initialAttempt)
      if (isAuthClientError(topUpError) && topUpError.code === 'PAYMENT_METHOD_REQUIRED') {
        setCardDialogOpen(true)
      }
      setError(localizeError(topUpError))
    } finally {
      pendingTopUpRef.current = false
      setPendingTopUp(false)
    }
  }, [completeTopUpSuccess, localizeError, refresh, tSettings])

  async function handleTopUp() {
    if (!selectedPackage || !topUpScope) return
    const existingAttempt = manualTopUpAttemptStore.findByScope(topUpScope)
    if (!hasPaymentMethod && !existingAttempt) {
      setCardDialogOpen(true)
      return
    }
    const attempt = existingAttempt ?? getOrCreateManualTopUpAttempt({
      scope: topUpScope,
      packageId: selectedPackage.package_id,
      amountCredits: selectedPackage.amount_credits,
      createIdempotencyKey: () => createIdempotencyKey(`topup:${selectedPackage.package_id}`),
    })
    const attemptPackage = visiblePackages.find((pkg) => pkg.package_id === attempt.payload.packageId)
    if (!attemptPackage) {
      setError('The pending top-up package is no longer available. Please contact support before starting another purchase.')
      return
    }
    setSelectedPackageId(attemptPackage.package_id)
    await executeTopUp(attemptPackage, attempt)
  }

  React.useEffect(() => {
    if (!topUpScope || visiblePackages.length === 0 || pendingTopUpRef.current) return
    const attempt = manualTopUpAttemptStore.findByScope(topUpScope)
    if (!attempt || recoveredTopUpOperationRef.current === attempt.idempotencyKey) return
    recoveredTopUpOperationRef.current = attempt.idempotencyKey
    const attemptPackage = visiblePackages.find((pkg) => pkg.package_id === attempt.payload.packageId)
    if (!attemptPackage) {
      setError('The pending top-up package is no longer available. Please contact support before starting another purchase.')
      return
    }
    setSelectedPackageId(attemptPackage.package_id)
    void executeTopUp(attemptPackage, attempt)
  }, [executeTopUp, topUpScope, visiblePackages])

  async function handleSaveAutoTopup() {
    setSavingAutoTopup(true)
    setError(null)
    try {
      const saved = await updateAutoTopup(autoEnabled
        ? {
          enabled: true,
          threshold_credits: autoThreshold,
          amount_credits: autoAmount,
        }
        : { enabled: false })
      const thresholdCredits = saved.threshold_credits ?? autoThreshold
      const amountCredits = saved.amount_credits ?? autoAmount

      setAutoEnabled(saved.enabled)
      setSavedAutoEnabled(saved.enabled)
      setAutoThreshold(thresholdCredits)
      setSavedAutoThreshold(thresholdCredits)
      setAutoAmount(amountCredits)
      setSavedAutoAmount(amountCredits)
      setAutoTriggerStatus(saved.trigger_status)
      setCreditsUntilTrigger(saved.credits_until_trigger)
      autoTopupEditedRef.current = false
      queryClient.setQueryData(BILLING_AUTO_TOPUP_QUERY_KEY, saved)
      void queryClient.invalidateQueries({ queryKey: BILLING_QUOTA_USAGE_QUERY_KEY })
      setTopUpMessage(tSettings('autoTopUpSaved'))
    } catch (saveError) {
      setError(localizeError(saveError))
    } finally {
      setSavingAutoTopup(false)
    }
  }

  return (
    <SettingsFrame activeSection="billing" tenant={tenant}>
      <div className="max-w-[920px]">
        <div className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
          <div className="p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground"><UiText id="add_credit_e89c5ab0" /></h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                <UiText id="top_up_persistent_credits_for_workflow_runs_stor_1d19eca9" /></p>
            </div>
          </div>
        </div>

        {visibleError && (
          <div className="mb-4 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {visibleError}
          </div>
        )}
        {topUpMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            {topUpMessage}
          </div>
        )}

        {!hasPaymentMethod && !loading && (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p><UiText id="add_a_card_before_buying_credits_or_enabling_aut_bf133f07" /></p>
            </div>
            <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => setCardDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <UiText id="add_card_91edf1fe" /></Button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground"><UiText id="credit_packages_7f12e55e" /></h3>
                  <p className="mt-1 text-sm text-muted-foreground"><UiText id="active_credit_packages_available_for_this_worksp_4f10d460" /></p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">{visiblePackages.length || 0} active</Badge>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)
              ) : visiblePackages.length > 0 ? (
                visiblePackages.map((pkg) => {
                  const selected = selectedPackage?.package_id === pkg.package_id
                  return (
                  <button
                    key={pkg.package_id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedPackageId(pkg.package_id)}
                    className={cn(
                      'min-h-36 rounded-lg border p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{formatCredits(pkg.amount_credits)} credits</p>
                        <p className="mt-1 text-sm text-muted-foreground">{pkg.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pkg.badge_text && <Badge className="shrink-0">{pkg.badge_text}</Badge>}
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        {pkg.original_price_gbp && pkg.original_price_gbp > pkg.amount_gbp ? (
                          <p className="text-sm text-muted-foreground line-through">{formatMoney(pkg.original_price_gbp, pkg.currency)}</p>
                        ) : null}
                        <p className="text-2xl font-semibold text-foreground">{formatMoney(pkg.amount_gbp, pkg.currency)}</p>
                      </div>
                      {pkg.discount_percent ? <p className="text-sm font-medium text-success">{pkg.discount_percent}<UiText id="off_1d3e6187" /></p> : null}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatMoney(getPricePerHundredCredits(pkg), pkg.currency)} {' '}<UiText id="per_100_credits_82f92f38" /></p>
                  </button>
                  )
                })
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground sm:col-span-2">
                  <UiText id="no_top_up_packages_are_available_5482cc50" /></div>
              )}
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground"><UiText id="payment_detail_2d2e86db" /></h3>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label={tAuto('available_credits_18001da8')} value={`${formatCredits(availableCredits)} credits`} />
                <SummaryRow label={tAuto('plan_credits_aa0e4406')} value={`${formatCredits(planCredits.remaining)} credits`} />
                <SummaryRow label={tAuto('top_up_balance_4d191b75')} value={`${formatCredits(topUpBalance)} credits`} />
                <SummaryRow label={tAuto('package_7431e3df')} value={selectedPackage ? `${formatCredits(selectedPackage.amount_credits)} credits` : tAuto('select_a_package_b1b81712')} />
                <SummaryRow label={tAuto('today_charge_50801e14')} value={selectedPackage ? formatMoney(selectedPackage.amount_gbp, selectedPackage.currency) : '-'} />
                {selectedPackage && vatQuote ? (
                  <>
                    <SummaryRow label={tBilling('invoices.topUp.vat', { rate: vatQuote.ratePercent })} value={formatMoney(vatQuote.vatGbp, selectedPackage.currency)} />
                    <SummaryRow label={tBilling('invoices.topUp.total')} value={formatMoney(vatQuote.totalGbp, selectedPackage.currency)} />
                  </>
                ) : null}
                <SummaryRow label={tAuto('after_top_up_19e14d26')} value={`${formatCredits(projectedBalance)} credits`} />
                <SummaryRow label={tAuto('payment_method_0e55fb3b')} value={defaultPaymentMethod ? `${formatCardBrand(defaultPaymentMethod.brand, tAuto('card_4d4ce73b'))} ${defaultPaymentMethod.last4 ?? ''}` : tAuto('no_card_bb8b2839')} />
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-9 w-full gap-1.5"
                onClick={() => setCardDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {hasPaymentMethod ? tAuto('add_another_card_b243e434') : tAuto('add_card_91edf1fe')}
              </Button>
              <BillingDetailsCheckoutNote className="mt-4" />
              <Button
                type="button"
                className="mt-5 h-10 w-full gap-1.5"
                disabled={!selectedPackage || pendingTopUp || loading}
                onClick={handleTopUp}
              >
                {pendingTopUp ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {hasPaymentMethod ? tAuto('buy_credits_ce006bc7') : tAuto('add_card_to_continue_9a3d7502')}
              </Button>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground"><UiText id="debt_summary_a18a4adc" /></h3>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label={tAuto('balance_due_bebeab86')} value={`${formatCredits(debtCredits)} credits`} />
                <SummaryRow label={tAuto('open_cycles_9c5d12c3')} value={String(outstandingDebtCount)} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                <UiText id="outstanding_storage_debt_is_settled_from_top_up__4a82c2ce" /></p>
            </section>
          </aside>
        </div>

        <section id="auto-topup" className="mt-5 scroll-mt-6 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground"><UiText id="auto_topup_a104539a" /></h3>
                <Badge variant={autoTopupState.badgeVariant}>{autoTopupState.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground"><UiText id="automatically_buy_persistent_top_up_credits_when_331a987e" /></p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">{autoEnabled ? tAuto('on_e0049a66') : tAuto('off_e3de5ab0')}</span>
              <Switch
                checked={autoEnabled}
                onCheckedChange={(checked) => {
                  autoTopupEditedRef.current = true
                  setAutoEnabled(checked)
                }}
                disabled={!hasPaymentMethod && !autoEnabled}
                aria-label={tAuto('enable_auto_topup_35722179')}
              />
            </div>
          </div>
          <div className={cn(
            'grid gap-4 p-4',
            autoEnabled && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end',
          )}>
            <div className="px-1 py-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground"><UiText id="trigger_state_374f416e" /></p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{autoTopupState.detail}</p>
            </div>
            {autoEnabled && (
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-1">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  <UiText id="threshold_c51f7b72" /><Select
                    value={String(autoThreshold)}
                    onValueChange={(value) => {
                      autoTopupEditedRef.current = true
                      setAutoThreshold(Number(value))
                    }}
                    disabled={!hasPaymentMethod}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {autoTopupThresholds.map((value) => <SelectItem key={value} value={String(value)}>{formatCredits(value)} credits</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  <UiText id="top_up_amount_8c91e29f" /><Select
                    value={String(autoAmount)}
                    onValueChange={(value) => {
                      autoTopupEditedRef.current = true
                      setAutoAmount(Number(value))
                    }}
                    disabled={!hasPaymentMethod}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {autoTopupAmountOptions.map((value) => <SelectItem key={value} value={String(value)}>{formatCredits(value)} credits</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
            {showAutoTopupSave && (
              <Button
                type="button"
                className="h-10"
                disabled={savingAutoTopup || !autoTopupHasChanges || (autoEnabled && !hasPaymentMethod)}
                onClick={handleSaveAutoTopup}
              >
                {savingAutoTopup ? tAuto('saving_369c534d') : tAuto('save_changes_179359b3')}
              </Button>
            )}
          </div>
        </section>

        <AddPaymentMethodDialog
          open={cardDialogOpen}
          email={email}
          onOpenChange={setCardDialogOpen}
          onSaved={async () => {
            setCardDialogOpen(false)
            await refresh()
          }}
        />
      </div>
    </SettingsFrame>
  )
}

function isInitialTopUpQueryLoading(query: { data: unknown; isLoading: boolean }) {
  return query.isLoading && query.data === undefined
}

function getFirstTopUpQueryError(queries: Array<{ error: unknown }>) {
  const failed = queries.find((query) => query.error)
  return failed?.error ?? null
}

function getVisiblePackages(packages: TopUpPackage[]) {
  const preferred = packages.filter((pkg) => preferredTopUpAmounts.has(pkg.amount_credits))
  return preferred.length > 0 ? preferred : packages
}

function getAutoTopupAmountOptions(packages: TopUpPackage[], currentAmount: number) {
  const packageAmounts = packages
    .map((pkg) => pkg.amount_credits)
    .filter((value) => Number.isFinite(value) && value >= 1000 && value <= 500000)
  return Array.from(new Set([...packageAmounts, currentAmount])).sort((left, right) => left - right)
}

const PLAN_INCLUDED_CREDITS_QUOTA_KEY = 'billing:plan_included_credits'

function getAvailableCredits(quotaUsage: BillingQuotaUsage | null) {
  if (!quotaUsage) return 0
  if (typeof quotaUsage.available_credits === 'number') return quotaUsage.available_credits
  return sumCredits(getPlanIncludedCredits(quotaUsage).remaining, getTopUpBalance(quotaUsage))
}

function getTopUpBalance(quotaUsage: BillingQuotaUsage | null) {
  return quotaUsage?.top_up_balance_credits ?? quotaUsage?.credit_balance ?? 0
}

function getPlanIncludedCredits(quotaUsage: BillingQuotaUsage | null) {
  if (quotaUsage?.plan_included_credits) {
    return {
      total: quotaUsage.plan_included_credits.total,
      used: quotaUsage.plan_included_credits.used,
      remaining: quotaUsage.plan_included_credits.remaining,
    }
  }

  return (quotaUsage?.quotas ?? []).reduce(
    (totals, quota) => {
      if (quota.quota_key !== PLAN_INCLUDED_CREDITS_QUOTA_KEY) return totals
      return {
        total: sumCredits(totals.total, quota.total_quota),
        used: sumCredits(totals.used, quota.used_quota),
        remaining: sumCredits(totals.remaining, quota.remaining_quota),
      }
    },
    { total: 0, used: 0, remaining: 0 },
  )
}

function getPricePerHundredCredits(pkg: TopUpPackage) {
  if (pkg.amount_credits <= 0) return 0
  return pkg.amount_gbp / (pkg.amount_credits / 100)
}

function getAutoTopupState(input: {
  t: (key: string, values?: Record<string, string | number>) => string
  formatCredits: (value: number) => string
  enabled: boolean
  threshold: number
  amount: number
  balance: number
  triggerStatus: 'disabled' | 'not_configured' | 'ready' | 'armed'
  creditsUntilTrigger: number | null
  hasPaymentMethod: boolean
}): { label: string; detail: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (input.enabled && !input.hasPaymentMethod) {
    return {
      label: input.t('cardNeeded'),
      detail: input.t('cardNeededDescription'),
      badgeVariant: 'destructive',
    }
  }

  if (!input.enabled || input.triggerStatus === 'disabled') {
    return {
      label: input.t('paused'),
      detail: input.t('autoTopupPausedDescription'),
      badgeVariant: 'secondary',
    }
  }

  if (input.triggerStatus === 'not_configured') {
    return {
      label: input.t('needsSetup'),
      detail: input.t('autoTopupNeedsSetupDescription'),
      badgeVariant: 'outline',
    }
  }

  if (input.triggerStatus === 'ready' || input.balance <= input.threshold) {
    return {
      label: input.t('ready'),
      detail: input.t('autoTopupReadyDescription', {
        threshold: input.formatCredits(input.threshold),
        amount: input.formatCredits(input.amount),
      }),
      badgeVariant: 'default',
    }
  }

  const remaining = input.creditsUntilTrigger ?? Math.max(0, input.balance - input.threshold)
  return {
    label: input.t('armed'),
    detail: input.t('autoTopupArmedDescription', {
      remaining: input.formatCredits(remaining),
      threshold: input.formatCredits(input.threshold),
    }),
    badgeVariant: 'outline',
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

async function pollTopUpStatus(requestId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await getTopUpStatus(requestId)
    if (status.status === 'completed' || status.status === 'failed') return status
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
  return getTopUpStatus(requestId)
}

function createIdempotencyKey(prefix: string) {
  const random = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}:${random}`
}

export function resolveSafeTopUpReturnPath(rawReturnTo: string | null) {
  const decoded = decodeReturnPath(rawReturnTo)
  if (!decoded || hasUnsafeReturnPathBytes(decoded)) return null

  try {
    const parsed = new URL(decoded, 'https://app.youtorch.local')
    const isInternalPath = decoded.startsWith('/') && !decoded.startsWith('//')
    if (!isInternalPath || parsed.origin !== 'https://app.youtorch.local') return null

    const legacyWorkflowId = parsed.pathname.match(/^\/workflows\/([^/?#]+)$/)?.[1]
    if (legacyWorkflowId) {
      const normalized = new URL('/workflows', 'https://app.youtorch.local')
      normalized.searchParams.set('continueWorkflowId', legacyWorkflowId)
      return `${normalized.pathname}${normalized.search}${parsed.hash}`
    }

    if (parsed.pathname !== '/workflows') return null
    if (!parsed.searchParams.get('continueWorkflowId')) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function decodeReturnPath(value: string | null) {
  if (!value?.trim()) return null
  let current = value.trim()

  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) return decoded
      current = decoded
    } catch {
      return null
    }
  }

  return current
}

function hasUnsafeReturnPathBytes(value: string) {
  return value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)
}

function sumCredits(...values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100
}

function formatCardBrand(brand: string | null | undefined, fallback: string) {
  if (!brand) return fallback
  return brand
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { BILLING_PAYMENT_RISK_QUERY_KEY, getPaymentRiskSummary, type PaymentRiskSummary } from '@/lib/billing/api'

/** Payment-scoped informational view, never a second balance authority or a
 * client-side decision to freeze/unfreeze a purchase. */
export function PaymentRiskPanel() {
  const t = useTranslations('PaymentRisk')
  const query = useQuery({
    queryKey: BILLING_PAYMENT_RISK_QUERY_KEY,
    queryFn: ({ signal }) => getPaymentRiskSummary({ signal }),
    staleTime: 30_000,
    retry: false,
  })
  if (query.isPending) return <p className="my-4 text-sm text-muted-foreground" role="status">{t('loading')}</p>
  if (query.isError) return (
    <section className="my-4 rounded-lg border border-border p-4" role="alert">
      <p className="text-sm">{t('unavailable')}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => void query.refetch()} disabled={query.isFetching}>{t('retry')}</Button>
    </section>
  )
  return <PaymentRiskDetails summary={query.data} />
}

const statusKeys: Record<string, 'open' | 'won' | 'lost' | 'refundPending' | 'refunded' | 'refundFailed' | 'reconciliationRequired'> = {
  open: 'open', won: 'won', lost: 'lost', refund_pending: 'refundPending', refunded: 'refunded',
  refund_failed: 'refundFailed', reconciliation_required: 'reconciliationRequired',
}

export function PaymentRiskDetails({ summary }: { summary: PaymentRiskSummary }) {
  const t = useTranslations('PaymentRisk')
  const format = useFormatter()
  if (summary.cases.length === 0 && summary.sources.length === 0) return null
  const totals = summary.sources.reduce((sum, source) => ({
    available: sum.available + source.remaining_credits,
    frozen: sum.frozen + source.frozen_credits,
    revoked: sum.revoked + source.revoked_credits,
  }), { available: 0, frozen: 0, revoked: 0 })

  return (
    <section className="my-4 rounded-lg border border-border bg-card p-4" aria-label={t('title')}>
      <h2 className="text-sm font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      <p className="mt-2 text-xs text-muted-foreground">{t('independentPurchases')}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {(['available', 'frozen', 'revoked'] as const).map((key) => (
          <div key={key}>
            <dt className="text-xs text-muted-foreground">{t(key)}</dt>
            <dd className="mt-1 text-lg font-medium">{format.number(totals[key], { maximumFractionDigits: 4 })}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-3">
        {summary.cases.map((review) => (
          <li key={review.risk_key} className="border-t border-border pt-3 text-sm">
            <p className="font-medium">{t(review.kind)} — {t(statusKeys[review.status] ?? 'reconciliationRequired')}</p>
            {review.operator_review_required && <p className="mt-1 text-muted-foreground">{t('operatorReview')}</p>}
            <p className="mt-1 break-all text-xs text-muted-foreground">{t('reference')} <code>{review.risk_key}</code></p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">{t('support')}</p>
    </section>
  )
}

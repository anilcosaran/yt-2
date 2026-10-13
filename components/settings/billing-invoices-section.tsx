'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { BillingDetailsForm } from '@/components/billing/billing-details-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  InvoicePopupBlockedError,
  downloadInvoicePdf,
  viewInvoiceDocument,
  type InvoiceDocumentDependencies,
} from '@/lib/billing/invoice-document-actions'
import {
  BILLING_INVOICE_PAGE_SIZE,
  customerBillingProfileQueryOptions,
  invoiceListQueryOptions,
  type CustomerBillingProfile,
  type InvoiceSummary,
} from '@/lib/billing/invoices-api'
import { billingCountryOptions, invoiceAmountGbp, invoiceKind, invoiceVatLine, isBillingDataForbidden } from '@/lib/billing/invoices-view'

/**
 * Y1-04 Settings > Billing: the customer's invoices and credit notes (plan purchases / renewals, credit top-ups,
 * refunds) with View / print and Download PDF (P7/4: the stored PDF that was e-mailed), and the billing details printed
 * on future invoices. Server state only.
 * Hidden entirely while the gateway reports `invoicing_enabled: false` (the default) or cannot be reached.
 */

export function BillingInvoicesSection({ documents }: { documents?: InvoiceDocumentDependencies }) {
  const [page, setPage] = React.useState(1)
  const listQuery = useQuery(invoiceListQueryOptions({ page, limit: BILLING_INVOICE_PAGE_SIZE }))
  const list = listQuery.data
  if (listQuery.isLoading && !list) return <BillingInvoicesSkeleton />
  // Off, or the answer is not available (older gateway, outage): the section is simply not offered.
  if (!list || !list.invoicing_enabled) return null
  const totalPages = Math.max(1, Math.ceil(list.total / list.limit))
  return (
    <>
      <InvoiceListPanel
        items={list.items}
        page={list.page}
        totalPages={totalPages}
        refreshing={listQuery.isFetching}
        onPageChange={setPage}
        documents={documents}
      />
      <BillingDetailsPanel />
    </>
  )
}

function BillingInvoicesSkeleton() {
  const t = useTranslations('Billing')
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card" aria-busy="true" aria-label={t('invoices.loading')}>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
    </section>
  )
}

export function InvoiceListPanel({
  items,
  page,
  totalPages,
  refreshing = false,
  onPageChange,
  documents,
}: {
  items: InvoiceSummary[]
  page: number
  totalPages: number
  refreshing?: boolean
  onPageChange: (page: number) => void
  documents?: InvoiceDocumentDependencies
}) {
  const t = useTranslations('Billing')
  return (
    <section id="invoice-documents" className="mt-5 scroll-mt-6 overflow-hidden rounded-lg border border-border bg-card" data-testid="billing-invoices-section">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t('invoices.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('invoices.description')}</p>
      </div>
      {items.length === 0 ? (
        <div className="p-4">
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">{t('invoices.empty.title')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('invoices.empty.detail')}</p>
          </div>
        </div>
      ) : (
        <ul className={refreshing ? 'divide-y divide-border opacity-70' : 'divide-y divide-border'}>
          {items.map((invoice) => (
            <InvoiceDocumentRow key={invoice.id} invoice={invoice} documents={documents} />
          ))}
        </ul>
      )}
      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('invoices.pagination.pageOf', { page, total: totalPages })}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
              <ChevronLeft className="h-4 w-4" />
              {t('invoices.pagination.previous')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
              {t('invoices.pagination.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

type DocumentAction = 'view' | 'download'

const KIND_MESSAGE_KEY = {
  plan: 'invoices.kind.plan',
  credit_top_up: 'invoices.kind.creditTopUp',
  usage_charge: 'invoices.kind.usageCharge',
  credit_note: 'invoices.kind.creditNote',
  other: 'invoices.kind.other',
} as const

function InvoiceDocumentRow({ invoice, documents }: { invoice: InvoiceSummary; documents?: InvoiceDocumentDependencies }) {
  const t = useTranslations('Billing')
  const formatter = useFormatter()
  const [pending, setPending] = React.useState<DocumentAction | null>(null)
  const [failure, setFailure] = React.useState<'popupBlocked' | 'forbidden' | 'failed' | null>(null)
  const kind = invoiceKind(invoice)
  const isCreditNote = kind === 'credit_note'
  const money = (value: number) => formatter.number(value, { style: 'currency', currency: 'GBP' })
  // The document prints the UTC calendar date; the list shows the same day whatever the viewer's time zone.
  const date = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '-' : formatter.dateTime(parsed, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  const vat = invoiceVatLine(invoice)

  async function run(action: DocumentAction) {
    if (pending) return
    setFailure(null)
    setPending(action)
    try {
      if (action === 'view') await viewInvoiceDocument(invoice, documents)
      else await downloadInvoicePdf(invoice, documents)
    } catch (error) {
      setFailure(error instanceof InvoicePopupBlockedError ? 'popupBlocked' : isBillingDataForbidden(error) ? 'forbidden' : 'failed')
    } finally {
      setPending(null)
    }
  }

  return (
    <li className="px-4 py-3 text-sm" data-testid="billing-invoice-row" data-document-number={invoice.document_number}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{invoice.document_number}</p>
            <Badge variant={isCreditNote ? 'outline' : 'secondary'}>{t(KIND_MESSAGE_KEY[kind])}</Badge>
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {invoice.description ? <p className="truncate">{invoice.description}</p> : null}
            <p>{t('invoices.row.issued', { date: date(invoice.issued_at) })}</p>
            {isCreditNote && invoice.original_document_number ? (
              <p>{t('invoices.row.corrects', { number: invoice.original_document_number })}</p>
            ) : null}
            {vat ? (
              <p>
                {vat.ratePercent === null
                  ? t('invoices.row.vatNoRate', { net: money(vat.netGbp), vat: money(vat.vatGbp) })
                  : t('invoices.row.vat', { net: money(vat.netGbp), rate: vat.ratePercent, vat: money(vat.vatGbp) })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="font-semibold text-foreground">{money(invoiceAmountGbp(invoice))}</p>
          <p className="text-xs text-muted-foreground">{isCreditNote ? t('invoices.row.refunded') : t('invoices.row.paid')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending !== null}
            aria-label={t('invoices.actions.viewLabel', { number: invoice.document_number })}
            onClick={() => void run('view')}
          >
            {pending === 'view' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            {t('invoices.actions.view')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending !== null}
            aria-label={t('invoices.actions.downloadLabel', { number: invoice.document_number })}
            onClick={() => void run('download')}
          >
            {pending === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {t('invoices.actions.download')}
          </Button>
        </div>
      </div>
      {failure ? (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(`invoices.actions.errors.${failure}`)}</AlertDescription>
        </Alert>
      ) : null}
    </li>
  )
}

/** The saved details with an Edit button that opens the same form the checkouts use. */
export function BillingDetailsPanel() {
  const t = useTranslations('Billing')
  const query = useQuery(customerBillingProfileQueryOptions())
  const [editing, setEditing] = React.useState(false)
  const profile = query.data ?? null
  // Y1R-MONEY-6: a member is not allowed to read the billing details at all (the gateway answers 403).
  const forbidden = query.isError && isBillingDataForbidden(query.error)
  return (
    <section id="billing-details" className="mt-5 scroll-mt-6 overflow-hidden rounded-lg border border-border bg-card" data-testid="billing-details-section">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('invoices.details.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('invoices.details.description')}</p>
        </div>
        {!editing && !query.isLoading && !query.isError && !forbidden ? (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setEditing(true)}>
            {profile ? t('invoices.details.edit') : t('invoices.details.add')}
          </Button>
        ) : null}
      </div>
      <div className="p-4">
        {query.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label={t('invoices.loading')}>
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : forbidden ? (
          <p className="text-sm text-muted-foreground" data-testid="billing-details-forbidden">{t('invoices.details.forbiddenRead')}</p>
        ) : query.isError ? (
          <p className="text-sm text-muted-foreground" role="alert">{t('invoices.details.loadFailed')}</p>
        ) : editing ? (
          <div className="max-w-lg">
            <BillingDetailsForm
              key={profile?.version ?? 'none'}
              profile={profile}
              idPrefix="settings-billing-details"
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : profile ? (
          <BillingDetailsSummary profile={profile} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('invoices.details.none')}</p>
        )}
      </div>
    </section>
  )
}

export function BillingDetailsSummary({ profile }: { profile: CustomerBillingProfile }) {
  const t = useTranslations('Billing')
  const locale = useLocale()
  const country = billingCountryOptions(locale).find((option) => option.code === profile.country_code)?.label ?? profile.country_code
  const lines = [profile.legal_name, profile.address_line1, profile.address_line2, `${profile.postal_code} ${profile.city}`.trim(), country]
    .filter((line): line is string => Boolean(line && line.trim()))
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="billing-details-summary">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{t('invoices.details.billedTo')}</dt>
        <dd className="mt-1 space-y-0.5 text-foreground">
          {lines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
        </dd>
      </div>
      <div className="space-y-3">
        {profile.billing_email ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{t('invoices.details.billingEmail')}</dt>
            <dd className="mt-1 text-foreground">{profile.billing_email}</dd>
          </div>
        ) : null}
        {profile.vat_number ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{t('invoices.details.vatNumberShort')}</dt>
            <dd className="mt-1 text-foreground">{profile.vat_number}</dd>
          </div>
        ) : null}
      </div>
    </dl>
  )
}

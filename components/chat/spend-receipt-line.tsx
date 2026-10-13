'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Coins } from 'lucide-react'

import { spendMeterQueryOptions } from '@/components/chat/spend-meter-chip'
import { formatCredits } from '@/lib/assistant/full-access-flow'
import {
  buildSpendReceiptModel,
  receiptRefetchIntervalMs,
  receiptStaleTimeMs,
  type SpendReceiptModel,
  type SpendReceiptNodePart,
} from '@/lib/assistant/spend-meter'
import {
  ASSISTANT_SPEND_RECEIPT_EVENT_TYPE,
  ASSISTANT_SPEND_RECEIPT_QUERY_KEY,
  getAssistantSpendReceipt,
} from '@/lib/assistant/spend-meter-api'

/**
 * Y1-02 spend breakdown line (Yol 1): at the end of an assistant turn, what the turn cost and the balance after it. The
 * code and the API keep their `receipt` names (`spendReceipt`, `/receipt`) for compatibility, but the user sees a "Spend
 * breakdown" / "Harcama dökümü": it shows where the credits went and is NOT an invoice or a receipt. Invoices are
 * issued only for money events (credit top-ups, plan purchases and renewals, usage charged to the card) and live in
 * Settings > Billing. Read from
 * `GET /api/v1/assistant-spend/runs/{id}/receipt` (final once the run is terminal and the job has no work in flight) and refreshed when the public run
 * event `assistant.spend.receipt` arrives. A turn without paid work, or a deployment without the job spend envelope,
 * shows nothing.
 */

type Translator = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean }

export function ChatSpendReceipt({
  conversationId,
  runId,
  active,
  runEvents,
}: {
  conversationId: string | null
  runId: string
  /** The turn's run is still working (its receipt is a running total and is polled). */
  active: boolean
  runEvents: ReadonlyArray<{ event_type: string; sequence: number; run_id: string }>
}) {
  const queryClient = useQueryClient()
  const meter = useQuery(spendMeterQueryOptions(conversationId))
  const enforced = meter.data?.enforcement === 'job_spend_envelope'
  const queryKey = React.useMemo(() => [...ASSISTANT_SPEND_RECEIPT_QUERY_KEY, runId] as const, [runId])
  const receipt = useQuery({
    queryKey,
    queryFn: ({ signal }) => getAssistantSpendReceipt({ runId }, { signal }),
    enabled: enforced,
    // Y1R-MONEY-8: only a final receipt is cached for good. A running one, and one whose turn ended while a sent clip is still
    // in flight (the server keeps it non-final until the envelope closes), is read again until it is final.
    staleTime: (query) => receiptStaleTimeMs(query.state.data?.final),
    refetchInterval: (query) => receiptRefetchIntervalMs({ final: query.state.data?.final, runActive: active, reads: query.state.dataUpdateCount }),
    retry: false,
  })
  const eventMark = React.useMemo(
    () => runEvents.filter((event) => event.run_id === runId && event.event_type === ASSISTANT_SPEND_RECEIPT_EVENT_TYPE).at(-1)?.sequence ?? 0,
    [runEvents, runId],
  )
  React.useEffect(() => {
    if (eventMark > 0) void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, queryClient, queryKey])
  const model = enforced ? buildSpendReceiptModel(receipt.data) : null
  if (!model) return null
  return <SpendReceiptLineView model={model} />
}

/** P7/3: a node's name in the UI language (by its base type), else the server's English name. */
function receiptNodeName(t: Translator, node: SpendReceiptNodePart): string {
  const key = node.baseType ? `spendReceipt.node.${node.baseType}` : null
  return key && t.has(key) ? t(key) : node.name
}

/** Each kind's named nodes ("Voice-over 12"), else (or for unnamed lines) the kind itself ("Production 28"). */
function receiptDetails(t: Translator, model: SpendReceiptModel, credits: (value: number) => string): string[] {
  return model.parts.flatMap((part) => {
    const kind = (amount: number) => t(`spendReceipt.kind.${part.kind}`, { credits: credits(amount) })
    if (part.nodes.length === 0) return [kind(part.credits)]
    const named = part.nodes.map((node) => t('spendReceipt.nodeLine', { name: receiptNodeName(t, node), credits: credits(node.credits) }))
    const unnamed = Math.round((part.credits - part.nodes.reduce((sum, node) => sum + node.credits, 0)) * 10_000) / 10_000
    return unnamed > 0 ? [...named, kind(unnamed)] : named
  })
}

/** P7/3: "Paid from plan quota 12 · plan credits 8 · top-up credits 3" (only the sources that paid). */
function receiptFunding(t: Translator, model: SpendReceiptModel, credits: (value: number) => string): string | null {
  if (!model.funding) return null
  const sources = [
    model.funding.quota > 0 ? t('spendReceipt.funding.quota', { credits: credits(model.funding.quota) }) : null,
    model.funding.plan > 0 ? t('spendReceipt.funding.plan', { credits: credits(model.funding.plan) }) : null,
    model.funding.topUp > 0 ? t('spendReceipt.funding.topUp', { credits: credits(model.funding.topUp) }) : null,
    model.funding.pending > 0 ? t('spendReceipt.funding.pending', { credits: credits(model.funding.pending) }) : null,
  ].filter((value): value is string => value !== null)
  return sources.length > 0 ? t('spendReceipt.funding.title', { sources: sources.join(' · ') }) : null
}

export function SpendReceiptLineView({ model }: { model: SpendReceiptModel }) {
  const t = useTranslations('Chat') as unknown as Translator
  const locale = useLocale()
  const credits = (value: number) => formatCredits(value, locale)
  const details = receiptDetails(t, model, credits)
  const named = model.parts.some((part) => part.nodes.length > 0)
  const funding = receiptFunding(t, model, credits)
  return (
    <p
      className="-mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      data-spend-receipt={model.final ? 'final' : 'running'}
      title={t('spendReceipt.labelHint')}
    >
      <Coins className="size-3.5" aria-hidden="true" />
      <span data-spend-breakdown-label="">{t('spendReceipt.label')}</span>
      <span className="font-medium text-foreground/80">
        {model.final
          ? t('spendReceipt.total', { credits: credits(model.total) })
          : t('spendReceipt.totalRunning', { credits: credits(model.total) })}
      </span>
      {(details.length > 1 || named) && <span data-spend-receipt-details="">{details.join(' · ')}</span>}
      {funding && <span data-spend-receipt-funding="">{funding}</span>}
      {model.balanceAfter !== null && <span>{t('spendReceipt.balanceAfter', { credits: credits(model.balanceAfter) })}</span>}
    </p>
  )
}

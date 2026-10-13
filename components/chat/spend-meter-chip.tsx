'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Coins } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  FULL_ACCESS_STATE_QUERY_KEY,
  getFullAccessState,
  type FullAccessLimit,
} from '@/lib/assistant/full-access-api'
import { formatCredits } from '@/lib/assistant/full-access-flow'
import { buildSpendMeterChipModel, type SpendMeterChipModel } from '@/lib/assistant/spend-meter'
import {
  ASSISTANT_SPEND_METER_QUERY_KEY,
  getAssistantSpendMeter,
} from '@/lib/assistant/spend-meter-api'
import { cn } from '@/lib/utils'

/**
 * Y1-02 spend meter (Yol 1, owner decision 1/5/6): a small chip above the conversation showing what the running job
 * spent against what it is approved for, and what is left on the balance; the popover explains the approval rule of the
 * mode in force. All numbers are server data (`GET /api/v1/assistant-spend/conversations/{id}/meter`); with the job
 * spend envelope switch off nothing is shown. Same chip frame as the composer mode chip.
 */

type Translator = (key: string, values?: Record<string, string | number>) => string
type Mode = 'ask' | 'auto' | 'auto_full'

const POLL_WHILE_RUNNING_MS = 4_000

/** One shared read of the meter for the strip and the receipt lines (same key, one request). */
export function spendMeterQueryOptions(conversationId: string | null) {
  return {
    queryKey: [...ASSISTANT_SPEND_METER_QUERY_KEY, conversationId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => getAssistantSpendMeter({ conversationId: conversationId! }, { signal }),
    enabled: Boolean(conversationId),
    staleTime: 3_000,
    retry: false,
  }
}

export function ChatSpendMeter({
  conversationId,
  runActive,
  runState,
  mode,
  className,
}: {
  conversationId: string | null
  /** A run of the conversation is working: the meter follows it. */
  runActive: boolean
  runState: string | null
  /** The conversation's committed mode (the meter uses the running job's own mode when there is one). */
  mode: Mode | null
  className?: string
}) {
  const { model, fullAccessLimit } = useChatSpendMeterModel({ conversationId, runActive, runState, mode })
  if (!model) return null
  return (
    <div className={cn('flex justify-end', className)} data-spend-meter="">
      <SpendMeterChipView model={model} fullAccessLimit={fullAccessLimit} />
    </div>
  )
}

/**
 * The meter's server data as the chip (and the Spark context meter's card) show it: polled while a run works, read again
 * when the run changes state, and the Full access limit read only for that mode. Null model = nothing to show.
 */
export function useChatSpendMeterModel({
  conversationId,
  runActive,
  runState,
  mode,
}: {
  conversationId: string | null
  runActive: boolean
  runState: string | null
  mode: Mode | null
}): { model: SpendMeterChipModel | null; fullAccessLimit: FullAccessLimit | null } {
  const queryClient = useQueryClient()
  const meter = useQuery({
    ...spendMeterQueryOptions(conversationId),
    refetchInterval: runActive ? POLL_WHILE_RUNNING_MS : false,
    refetchOnWindowFocus: true,
  })
  // A run changing state (approval answered, finished, failed) moves the numbers: read them again.
  const previousRunState = React.useRef(runState)
  React.useEffect(() => {
    if (previousRunState.current === runState) return
    previousRunState.current = runState
    if (conversationId) void queryClient.invalidateQueries({ queryKey: [...ASSISTANT_SPEND_METER_QUERY_KEY, conversationId] })
  }, [conversationId, queryClient, runState])
  const model = buildSpendMeterChipModel(meter.data, mode)
  const fullAccess = useQuery({
    queryKey: FULL_ACCESS_STATE_QUERY_KEY,
    queryFn: ({ signal }) => getFullAccessState({ signal }),
    enabled: model?.mode === 'auto_full',
    staleTime: 30_000,
    retry: false,
  })
  return { model, fullAccessLimit: fullAccess.data?.limit ?? null }
}

const TONE_CLASS: Record<SpendMeterChipModel['tone'], string> = {
  normal: 'border-border bg-panel/60 text-muted-foreground hover:text-foreground',
  attention: 'border-amber-500/50 bg-amber-500/10 text-foreground',
  blocked: 'border-destructive/50 bg-destructive/10 text-foreground',
}

export function SpendMeterChipView({
  model,
  fullAccessLimit,
}: {
  model: SpendMeterChipModel
  fullAccessLimit: FullAccessLimit | null
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const locale = useLocale()
  const credits = (value: number) => formatCredits(value, locale)
  const job = model.job
  const primary = job && job.ceiling !== null
    ? t('spendMeter.usage', { spent: credits(job.committed), ceiling: credits(job.ceiling) })
    : t('spendMeter.balanceOnly', { balance: credits(model.balance) })
  const secondary = job?.state === 'awaiting_approval'
    ? t('spendMeter.state.awaiting_approval')
    : job?.state === 'funding_required'
      ? t('spendMeter.state.funding_required')
      : job && job.ceiling !== null
        ? t('spendMeter.balanceLeft', { balance: credits(model.balance) })
        : null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('spendMeter.chipLabel', { summary: secondary ? `${primary}, ${secondary}` : primary })}
          data-spend-meter-tone={model.tone}
          className={cn(
            'flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
            TONE_CLASS[model.tone],
          )}
        >
          <Coins className="size-3.5" aria-hidden="true" />
          <span>{primary}</span>
          {secondary && <span className="hidden text-muted-foreground sm:inline">{secondary}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <SpendMeterDetails model={model} fullAccessLimit={fullAccessLimit} />
      </PopoverContent>
    </Popover>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  )
}

/** The popover body: this job, the balance and the approval rule of the mode in force. */
export function SpendMeterDetails({
  model,
  fullAccessLimit,
}: {
  model: SpendMeterChipModel
  fullAccessLimit: FullAccessLimit | null
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const locale = useLocale()
  const credits = (value: number) => t('spendMeter.creditsValue', { credits: formatCredits(value, locale) })
  const job = model.job
  const rule = approvalRule(model, fullAccessLimit, t, (value) => formatCredits(value, locale))
  return (
    <div className="flex flex-col gap-3" data-spend-meter-details="">
      <p className="text-sm font-semibold text-foreground">{t('spendMeter.details.title')}</p>
      <dl className="flex flex-col gap-1.5 text-xs">
        {job ? (
          <>
            <Row label={t('spendMeter.details.spent')} value={credits(job.committed)} />
            {job.ceiling !== null && <Row label={t('spendMeter.details.approved')} value={credits(job.ceiling)} />}
            {job.ceiling !== null && <Row label={t('spendMeter.details.remaining')} value={credits(job.remaining)} />}
            {job.pendingApprovalMax !== null && (
              <Row label={t('spendMeter.details.pending')} value={credits(job.pendingApprovalMax)} />
            )}
          </>
        ) : (
          <Row label={t('spendMeter.details.thisJob')} value={t('spendMeter.details.noJob')} />
        )}
        <Row label={t('spendMeter.details.balance')} value={credits(model.balance)} />
        {model.planCredits > 0 && <Row label={t('spendMeter.details.plan')} value={credits(model.planCredits)} />}
        {model.jobCap && (
          <Row
            label={t('spendMeter.details.cap')}
            value={`${credits(model.jobCap.credits)}${model.jobCap.source ? ` (${t(`spendMeter.details.capSource.${model.jobCap.source}`)})` : ''}`}
          />
        )}
      </dl>
      {rule && <p className="text-xs leading-5 text-muted-foreground">{rule}</p>}
      <Link href="/settings?section=approvals" className="w-fit text-xs font-medium text-primary hover:underline">
        {t('spendMeter.details.settings')}
      </Link>
    </div>
  )
}

function approvalRule(
  model: SpendMeterChipModel,
  limit: FullAccessLimit | null,
  t: Translator,
  format: (value: number) => string,
): string | null {
  if (model.mode === 'ask') return t('spendMeter.rule.ask')
  if (model.mode === 'auto') {
    return model.autoAskAt !== null ? t('spendMeter.rule.auto', { threshold: format(model.autoAskAt) }) : null
  }
  if (model.mode === 'auto_full') {
    if (limit && limit.enabled && limit.effective_credits !== null) {
      return t('spendMeter.rule.fullAccessLimit', { limit: format(limit.effective_credits) })
    }
    return limit ? t('spendMeter.rule.fullAccessNoLimit') : t('spendMeter.rule.fullAccess')
  }
  return null
}

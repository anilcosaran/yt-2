'use client'

import * as React from 'react'
import { QueryClientContext, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { SpendMeterDetails, useChatSpendMeterModel } from '@/components/chat/spend-meter-chip'
import { buildContextMeterModel, type ContextMeterModel, type ContextMeterTrimNote } from '@/lib/assistant/context-meter'
import {
  ASSISTANT_CONTEXT_USAGE_QUERY_KEY,
  getAssistantContextUsage,
} from '@/lib/assistant/context-meter-api'
import { formatCredits } from '@/lib/assistant/full-access-flow'
import type { SpendMeterChipModel } from '@/lib/assistant/spend-meter'
import type { FullAccessLimit } from '@/lib/assistant/full-access-api'

import { StudioIcon } from './studio-icon'
import './spark-context-meter.css'

/**
 * Spark context meter (`SPARK_CONTEXT_METER_ENABLED`): a small ring next to the side chat's send button showing how much
 * of the context the conversation's newest assistant call used. Hover says "x% context used"; a click (or Enter / Space)
 * opens a compact card: used / limit with the point where older context gets trimmed, the headroom before it, what was in
 * the context (skills by name, rules, Memory, history, ...), the answer budget, the chat's totals, what was trimmed, and
 * the running job's spend (the spend chip's details, which this replaces). Escape or a click outside closes it and gives
 * focus back to the ring. All numbers are server data, read again while the chat works and after every turn; nothing is
 * kept in browser storage.
 */

const POLL_WHILE_WORKING_MS = 5_000

export function SparkContextMeter(props: { conversationId: string | null; working: boolean; turnKey: string }) {
  const client = React.useContext(QueryClientContext)
  if (!client || !props.conversationId) return null
  return <ContextMeter {...props} conversationId={props.conversationId} />
}

function ContextMeter({ conversationId, working, turnKey }: { conversationId: string; working: boolean; turnKey: string }) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => [...ASSISTANT_CONTEXT_USAGE_QUERY_KEY, conversationId] as const, [conversationId])
  const usage = useQuery({
    queryKey,
    queryFn: ({ signal }) => getAssistantContextUsage({ conversationId }, { signal }),
    staleTime: 3_000,
    retry: false,
    refetchInterval: working ? POLL_WHILE_WORKING_MS : false,
    refetchOnWindowFocus: true,
  })
  // A finished turn (the working row went away, or a new message arrived) has a new record: read it again.
  const previous = React.useRef({ working, turnKey })
  React.useEffect(() => {
    const before = previous.current
    previous.current = { working, turnKey }
    if (before.working === working && before.turnKey === turnKey) return
    if (!working || before.turnKey !== turnKey) void queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey, turnKey, working])
  const spend = useChatSpendMeterModel({ conversationId, runActive: working, runState: working ? 'working' : null, mode: null })
  const model = buildContextMeterModel(usage.data)
  return (
    <SparkContextMeterView
      model={model}
      failed={usage.isError && !usage.data}
      spend={spend.model}
      fullAccessLimit={spend.fullAccessLimit}
      onOpen={() => {
        if (!usage.isFetching) void usage.refetch()
      }}
    />
  )
}

type T = (key: string, values?: Record<string, string | number>) => string

/** The ring and its card (pure: everything it shows comes from the model). */
export function SparkContextMeterView({
  model,
  failed = false,
  spend = null,
  fullAccessLimit = null,
  onOpen,
  defaultOpen = false,
}: {
  model: ContextMeterModel
  failed?: boolean
  spend?: SpendMeterChipModel | null
  fullAccessLimit?: FullAccessLimit | null
  onOpen?: () => void
  /** Static renders (tests) of the open card. */
  defaultOpen?: boolean
}) {
  const t = useTranslations('Spark.editor.contextMeter') as unknown as T
  const locale = useLocale()
  const [open, setOpen] = React.useState(defaultOpen)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const cardId = `${id}-card`
  const titleId = `${id}-title`
  const tokens = React.useMemo(() => tokenFormatter(locale), [locale])

  const close = React.useCallback((focusRing: boolean) => {
    setOpen(false)
    if (focusRing) buttonRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [close, open])

  const attention = spend?.tone === 'attention' || spend?.tone === 'blocked' ? spend.tone : null
  // The dot on the ring is said in words too (title and accessible name).
  const spendNote = attention ? ` · ${t(`spendAttention.${attention}`)}` : ''
  const hover = `${model.recorded ? t('hover', { percent: model.percent }) : t('hoverEmpty')}${spendNote}`
  const label = `${model.recorded ? t('ringLabel', { percent: model.percent }) : t('ringLabelEmpty')}${spendNote}`

  return (
    <div className="ctxm" ref={rootRef} data-context-meter="" data-context-tone={model.tone}>
      <button
        ref={buttonRef}
        type="button"
        className="ctxm-ring"
        title={hover}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => {
          if (open) {
            close(false)
            return
          }
          setOpen(true)
          onOpen?.()
        }}
      >
        <Ring ratio={model.ratio} />
        {attention ? <span className="ctxm-dot" data-spend-attention={attention} aria-hidden /> : null}
      </button>
      {open ? (
        <div
          ref={cardRef}
          id={cardId}
          className="ctxm-card"
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            close(true)
          }}
        >
          <div className="ctxm-head">
            <h3 id={titleId}>{t('title')}</h3>
            {model.recorded ? <span className="ctxm-pct">{t('percent', { percent: model.percent })}</span> : null}
            <button type="button" className="ctxm-x" title={t('close')} aria-label={t('close')} onClick={() => close(true)}>
              <StudioIcon name="x" className="sm" />
            </button>
          </div>
          {model.recorded ? <ContextDetails model={model} t={t} tokens={tokens} locale={locale} /> : (
            <p className="ctxm-note" role="status">{failed ? t('loadFailed') : t('notRecorded')}</p>
          )}
          {spend ? (
            <section className="ctxm-spend" aria-label={t('spend')}>
              <SpendMeterDetails model={spend} fullAccessLimit={fullAccessLimit} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Ring({ ratio }: { ratio: number }) {
  const radius = 7.5
  const circumference = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, ratio)) * circumference
  return (
    <svg className="ctxm-svg" viewBox="0 0 20 20" width="18" height="18" aria-hidden focusable="false">
      <circle className="ctxm-track" cx="10" cy="10" r={radius} />
      {dash > 0 ? (
        <circle
          className="ctxm-fill"
          cx="10"
          cy="10"
          r={radius}
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 10 10)"
        />
      ) : null}
    </svg>
  )
}

function ContextDetails({ model, t, tokens, locale }: { model: ContextMeterModel; t: T; tokens: (value: number) => string; locale: string }) {
  const credits = (value: number) => t('credits', { credits: formatCredits(value, locale) })
  const total = Math.max(1, model.used)
  return (
    <>
      <div
        className="ctxm-bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={model.limit}
        aria-valuenow={Math.min(model.used, model.limit)}
        aria-valuetext={t('used', { used: tokens(model.used), limit: tokens(model.limit) })}
        aria-label={t('title')}
      >
        <div className="ctxm-used" style={{ width: `${model.ratio * 100}%` }}>
          {model.rows.map((row) => (
            <span key={row.key} className="ctxm-seg" data-section={row.key} style={{ width: `${(row.tokens / total) * 100}%` }} />
          ))}
        </div>
        {model.trimRatio !== null ? (
          <span className="ctxm-trim" style={{ left: `${model.trimRatio * 100}%` }} title={t('trimPoint')} aria-hidden />
        ) : null}
      </div>
      <p className="ctxm-sum">
        <b>{t('used', { used: tokens(model.used), limit: tokens(model.limit) })}</b>
        {model.kind ? <span className="ctxm-kind" data-kind={model.kind}>{t(`kind.${model.kind}`)}</span> : null}
      </p>
      {model.untilTrim !== null ? (
        <p className="ctxm-muted">{model.untilTrim > 0 ? t('untilTrim', { tokens: tokens(model.untilTrim) }) : t('atTrim')}</p>
      ) : null}

      <h4 className="ctxm-h">{t('breakdown')}</h4>
      <ul className="ctxm-rows">
        {model.rows.map((row) => (
          <React.Fragment key={row.key}>
            <li className="ctxm-row" data-section={row.key}>
              <span className="ctxm-sw" aria-hidden />
              <span className="ctxm-name">{t(`sections.${row.key}`)}</span>
              <span className="ctxm-num">{tokens(row.tokens)}</span>
            </li>
            {row.key === 'skills'
              ? model.skills.map((skill) => (
                <li key={skill.id} className="ctxm-row sub" data-skill={skill.id}>
                  <span className="ctxm-name">
                    {skill.label}
                    {skill.auto ? <small>{t('skillAuto')}</small> : null}
                  </span>
                  <span className="ctxm-num">{tokens(skill.tokens)}</span>
                </li>
              ))
              : null}
          </React.Fragment>
        ))}
      </ul>
      <p className="ctxm-muted">{t('basis')}</p>

      <dl className="ctxm-dl">
        {model.outputBudget ? (
          <Row
            label={t('outputBudget')}
            value={model.outputBudget.kind ? `${tokens(model.outputBudget.tokens)} · ${t(`outputKind.${model.outputBudget.kind}`)}` : tokens(model.outputBudget.tokens)}
          />
        ) : null}
        {model.window !== null ? <Row label={t('window')} value={tokens(model.window)} /> : null}
        {model.inputBudget !== null ? <Row label={t('inputBudget')} value={tokens(model.inputBudget)} /> : null}
        {model.cacheRead !== null ? <Row label={t('cacheRead')} value={tokens(model.cacheRead)} /> : null}
      </dl>

      {model.trimmed.length > 0 ? (
        <div className="ctxm-trimmed" role="note">
          <b>{t('trimmed.title')}</b>
          <ul>
            {model.trimmed.map((note) => <li key={note.kind}>{trimText(note, t)}</li>)}
          </ul>
        </div>
      ) : null}

      <h4 className="ctxm-h">{t('totals.title')}</h4>
      <dl className="ctxm-dl">
        <Row
          label={t('totals.chat', { count: model.conversation.planner_calls })}
          value={`${tokens(model.conversation.input_tokens + model.conversation.output_tokens)} · ${credits(model.conversation.credits)}`}
        />
        {model.job ? (
          <Row
            label={t('totals.job', { count: model.job.planner_calls })}
            value={`${tokens(model.job.input_tokens + model.job.output_tokens)} · ${credits(model.job.credits)}`}
          />
        ) : null}
      </dl>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ctxm-dr">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function trimText(note: ContextMeterTrimNote, t: T): string {
  switch (note.kind) {
    case 'omitted_messages':
      return t('trimmed.omitted', { count: note.count })
    case 'compacted_messages':
      return t('trimmed.compacted', { count: note.count })
    case 'memory_matches':
      return t('trimmed.memory', { count: note.count })
    case 'skill_index':
      return t('trimmed.skillIndex')
    case 'guides_withdrawn':
      return t('trimmed.guides')
    case 'older_turns':
      return t('trimmed.olderTurns')
  }
}

function tokenFormatter(locale: string): (value: number) => string {
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  return (value: number) => compact.format(Math.max(0, Math.round(value)))
}

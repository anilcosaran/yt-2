'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Clock, Film, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PRODUCTION_LAUNCH_QUERY_KEY,
  buildProductionG1CardModel,
  decideProductionPlan,
  getProductionLaunchState,
  isProductionLaunchEvent,
  latestProductionReplyNote,
  type ProductionDecision,
  type ProductionG1CardModel,
} from '@/lib/assistant/production-launch-api'
import {
  PLAN_REPLAN_QUERY_KEY,
  getPlanReplanState,
  isInteractionEvent,
  planChangesNote,
  type PlanChangesNote,
} from '@/lib/assistant/interaction-api'

/**
 * P03-09 G1 production approval card. It follows the Spark job card (components/spark/lab/lab-parts.tsx `JobCard`):
 * one quiet card per job with a header (icon tile, title, state in plain words), its steps folded into one line (the
 * step it is on and how many are done; the full list opens under it) and a footer (one muted line with the plan
 * revision and credits, then the actions). The plan itself is read on the plan canvas, not repeated in the card. The one primary action is `Bu planla üret` (Q17) for exactly the presented
 * plan/quote/ceiling; the written "tamam, devam et" and the Review Inbox record the same decision. State always comes
 * from the server (reconnect-safe).
 */

type Translator = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean }

/** The run card frame shared by the chat's job cards (plan, script, final video): flat, theme tokens only. */
export const CARD_FRAME = 'w-full max-w-[620px] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground'
export const ICON_TILE = 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'
export const PILL = 'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
export const PRIMARY_BUTTON = 'h-8 gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-none hover:bg-primary/90 has-[>svg]:px-3'
export const OUTLINE_BUTTON = 'h-8 gap-1.5 rounded-full border-border bg-transparent px-3.5 text-xs font-medium text-foreground shadow-none hover:bg-muted hover:text-foreground has-[>svg]:px-3'

/** Card header: small icon tile, title and one muted line with the state in plain words. */
export function RunCardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <div className={ICON_TILE} aria-hidden="true">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  )
}

/** done = check, current = spinner, waiting (for the user) = clock, failed = cross, pending (still to come) = dot. */
export type RunStepState = 'done' | 'current' | 'waiting' | 'failed' | 'pending'

export function RunStepRow({ state, label, meta }: { state: RunStepState; label: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <li
      data-step-state={state}
      className={cn(
        'flex min-h-[30px] items-center gap-2.5 px-3.5 py-1 text-[13px] leading-5',
        state === 'done' && 'text-muted-foreground',
        (state === 'current' || state === 'waiting') && 'font-medium text-foreground',
        state === 'failed' && 'text-foreground',
        state === 'pending' && 'text-muted-foreground/70',
      )}
    >
      <RunStepIcon state={state} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{meta}</span> : null}
    </li>
  )
}

export function RunStepIcon({ state }: { state: RunStepState }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
      {state === 'done' ? <Check className="size-3.5 text-success" strokeWidth={2.5} />
        : state === 'current' ? <span className="size-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          : state === 'waiting' ? <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
            : state === 'failed' ? <X className="size-3.5 text-destructive" strokeWidth={2.5} />
              : <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
    </span>
  )
}

/**
 * The step list folded into one line: the step the job is on (or the last one) and how many are done. The full list
 * opens under it. The plan itself is read on the plan canvas, so the card stays short in the conversation.
 */
export function RunStepSummary({ steps }: { steps: ReadonlyArray<{ key: string; state: RunStepState; label: React.ReactNode; meta?: React.ReactNode }> }) {
  const t = useTranslations('Chat') as unknown as Translator
  const [open, setOpen] = React.useState(false)
  if (steps.length === 0) return null
  const done = steps.filter((step) => step.state === 'done').length
  const focus = steps.find((step) => step.state === 'waiting' || step.state === 'failed' || step.state === 'current') ?? steps.find((step) => step.state === 'pending') ?? steps.at(-1)!
  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[38px] w-full items-center gap-2.5 px-3.5 py-1.5 text-left text-[13px] leading-5 transition-colors hover:bg-muted/40"
      >
        <RunStepIcon state={focus.state} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{focus.label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t('runCards.stepsDone', { done, total: steps.length })}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <ol className="pb-1">
          {steps.map((step) => <RunStepRow key={step.key} state={step.state} label={step.label} meta={step.meta} />)}
        </ol>
      ) : null}
    </div>
  )
}

/** Short notes of the card (a reply echo, what changed, a failed decision), inside the card above the footer. */
export function RunCardNotes({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1 border-t border-border px-3.5 py-2.5">{children}</div>
}

export function RunCardNote({ tone = 'muted', children }: { tone?: 'muted' | 'attention'; children: React.ReactNode }) {
  return <p className={cn('text-xs leading-5', tone === 'attention' ? 'text-amber-700 dark:text-amber-200' : 'text-muted-foreground')}>{children}</p>
}

/** Card footer: one muted line (revision, credits), a spacer, then the actions right-aligned. */
export function RunCardFooter({ meta, children }: { meta?: React.ReactNode; children?: React.ReactNode }) {
  const hasActions = React.Children.toArray(children).length > 0
  if (!meta && !hasActions) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/40 px-3.5 py-2.5">
      {meta ? <p className="min-w-[12rem] flex-1 text-xs leading-5 tabular-nums text-muted-foreground">{meta}</p> : <span className="flex-1" />}
      {hasActions ? <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div> : null}
    </div>
  )
}

export interface ProductionJobCardEvent {
  event_type: string
  payload: Record<string, unknown>
  sequence: number
  run_id: string
}

export function useProductionLaunchState(jobId: string | null) {
  return useQuery({
    queryKey: [...PRODUCTION_LAUNCH_QUERY_KEY, jobId ?? ''],
    queryFn: ({ signal }) => getProductionLaunchState(jobId!, { signal }),
    enabled: Boolean(jobId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

/** True while the job has an open G1 presentation: its card, not the draft's run button, records the approval. */
export function useProductionG1Open(jobId: string | null): boolean {
  const state = useProductionLaunchState(jobId)
  return state.data?.presentation?.state === 'presented'
}

/** True once the job has a plan (any decision): the chat's production flow then tells what the run does. */
export function useProductionPlanShown(jobId: string | null): boolean {
  const state = useProductionLaunchState(jobId)
  return Boolean(state.data?.presentation)
}

/** P03-23 (§12B): the job's plan update state, re-read on each replan event (server data only). */
function usePlanReplanState(jobId: string, runEvents: readonly ProductionJobCardEvent[]) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => [...PLAN_REPLAN_QUERY_KEY, jobId] as const, [jobId])
  const eventMark = React.useMemo(
    () => runEvents.filter((event) => event.run_id === jobId && isInteractionEvent(event.event_type)).at(-1)?.sequence ?? 0,
    [jobId, runEvents],
  )
  const state = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPlanReplanState(jobId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  React.useEffect(() => {
    if (eventMark > 0) void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, queryClient, queryKey])
  return state.data ?? null
}

/** The card of one job: reads the job's server checkpoint and re-reads it whenever a production event arrives. */
export function ProductionJobCard({ jobId, runEvents, secondaryAction, children }: {
  jobId: string
  runEvents: readonly ProductionJobCardEvent[]
  /** P03-20 "Script'i aç" of the same job (one card per job). */
  secondaryAction?: React.ReactNode
  /** A section of the same job shown inside the card, above the footer (the shot list of a short video's plan). */
  children?: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const jobEvents = React.useMemo(
    () => runEvents.filter((event) => event.run_id === jobId && isProductionLaunchEvent(event.event_type)),
    [jobId, runEvents],
  )
  const eventMark = jobEvents.at(-1)?.sequence ?? 0
  const queryKey = React.useMemo(() => [...PRODUCTION_LAUNCH_QUERY_KEY, jobId] as const, [jobId])
  const state = useProductionLaunchState(jobId)
  const replanState = usePlanReplanState(jobId, runEvents)
  const replan = React.useMemo<ProductionReplanNote | null>(
    () => (replanState ? { updating: replanState.updating, changes: planChangesNote(replanState) } : null),
    [replanState],
  )
  React.useEffect(() => {
    if (eventMark > 0) void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, queryClient, queryKey])

  const [pending, setPending] = React.useState<ProductionDecision | null>(null)
  const [failed, setFailed] = React.useState(false)
  const model = buildProductionG1CardModel(state.data ?? null)
  const note = latestProductionReplyNote(jobEvents)

  const decide = React.useCallback(async (decision: ProductionDecision) => {
    if (!model || !model.canDecide || pending) return
    setPending(decision)
    setFailed(false)
    try {
      await decideProductionPlan(model.presentation, decision)
    } catch {
      setFailed(true)
    } finally {
      setPending(null)
      void queryClient.invalidateQueries({ queryKey })
    }
  }, [model, pending, queryClient, queryKey])

  if (!model) return null
  return (
    <ProductionG1CardView model={model} note={note} replan={replan} pending={pending} failed={failed} onDecide={(decision) => void decide(decision)} secondaryAction={secondaryAction}>
      {children}
    </ProductionG1CardView>
  )
}

/** P03-23 (§12B): "Plan güncelleniyor" while the job's plan updates; "Değişenler" of the finished update. */
export interface ProductionReplanNote {
  updating: boolean
  changes: PlanChangesNote | null
}

const REPLAN_FIELD_LABELS = new Set(['model', 'video_model', 'image_model', 'aspect_ratio', 'duration_seconds', 'profile', 'template', 'brand_kit', 'voice', 'presentation'])

function replanChangesText(changes: PlanChangesNote, t: Translator): string | null {
  if (changes.changes.length === 0) return null
  const field = (key: string) => (REPLAN_FIELD_LABELS.has(key) ? t(`interactionLevels.fields.${key}`) : key.replace(/_/g, ' '))
  const items = changes.changes.map((change) => t('interactionLevels.change', { field: field(change.fieldKey), from: change.from ?? '—', to: change.to ?? '—' }))
  if (changes.estimateDelta !== null) {
    const delta = changes.estimateDelta > 0 ? `+${formatCredits(changes.estimateDelta)}` : formatCredits(changes.estimateDelta)
    items.push(t('interactionLevels.estimateDelta', { delta }))
  }
  return t('interactionLevels.changes', { items: items.join(' · ') })
}

export function ProductionG1CardView({ model, note, replan = null, pending, failed, onDecide, secondaryAction, children }: {
  model: ProductionG1CardModel
  note: { kind: 'echo' | 'question'; text: string } | null
  replan?: ProductionReplanNote | null
  pending: ProductionDecision | null
  failed: boolean
  onDecide: (decision: ProductionDecision) => void
  secondaryAction?: React.ReactNode
  /** A section of the same job inside the card, between the step list and the footer. */
  children?: React.ReactNode
}) {
  const t = useTranslations('Chat') as unknown as Translator
  // While the plan updates the shown plan is not approvable (the server refuses it too); the status says why.
  const updating = replan?.updating === true
  const canDecide = model.canDecide && !updating
  const statusText = updating ? t('interactionLevels.planUpdating') : t(`productionG1.status.${model.status}`)
  const changesText = !updating && replan?.changes ? replanChangesText(replan.changes, t) : null
  const meta: string[] = [t('productionG1.planRevision', { revision: model.planRevision })]
  if (model.estimate) {
    meta.push(model.estimate.min === model.estimate.max
      ? t('productionG1.estimatePoint', { value: formatCredits(model.estimate.min) })
      : t('productionG1.estimateRange', { min: formatCredits(model.estimate.min), max: formatCredits(model.estimate.max) }))
  }
  if (model.ceiling !== null) meta.push(t('productionG1.ceiling', { value: formatCredits(model.ceiling) }))
  const busy = pending !== null
  return (
    <div className={CARD_FRAME} data-production-g1-status={model.status}>
      <RunCardHeader icon={<Film className="size-4" />} title={t('productionG1.title')} subtitle={statusText} />
      <RunStepSummary
        steps={model.stages.map((stage, index) => ({
          key: `${stage.stepId}:${index}`,
          state: stageState(stage, canDecide),
          label: stageLabel(t, stage.stepId, index),
          meta: stage.counters
            ? t(`productionG1.counters.${stage.counters.unit}`, { completed: stage.counters.completed, total: stage.counters.total })
            : null,
        }))}
      />
      {children}
      {(note || changesText || failed) && (
        <RunCardNotes>
          {note && <RunCardNote>{note.text}</RunCardNote>}
          {changesText && <RunCardNote>{changesText}</RunCardNote>}
          {failed && <RunCardNote tone="attention">{t('productionG1.decisionFailed')}</RunCardNote>}
        </RunCardNotes>
      )}
      <RunCardFooter meta={meta.join(' · ')}>
        {secondaryAction}
        {canDecide && (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onDecide('reject')} className={OUTLINE_BUTTON}>
              {pending === 'reject' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              {t('productionG1.reject')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => onDecide('approve')} className={PRIMARY_BUTTON}>
              {pending === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {t('productionG1.produce')}
            </Button>
          </>
        )}
      </RunCardFooter>
    </div>
  )
}

/** A running stage shows a clock instead of the spinner when it is the approval and the card waits on the user. */
function stageState(stage: ProductionG1CardModel['stages'][number], awaitingUser: boolean): RunStepState {
  switch (stage.status) {
    case 'completed':
      return 'done'
    case 'failed':
      return 'failed'
    case 'pending':
      return 'pending'
    default:
      return awaitingUser && stage.stepId === 'approval' ? 'waiting' : 'current'
  }
}

/**
 * A stage without a translated name falls back to its id in words instead of the missing-message text; an opaque
 * id (a uuid or hash) is not a name, so it shows as "Adım n".
 */
function stageLabel(t: Translator, stepId: string, index: number): string {
  const key = `productionG1.stages.${stepId}`
  if (t.has(key)) return t(key)
  if (/^[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}$/i.test(stepId) || /^[0-9a-f]{16,}$/i.test(stepId)) return t('runCards.step', { n: index + 1 })
  return stepId.replace(/[_-]+/g, ' ').trim()
}

function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

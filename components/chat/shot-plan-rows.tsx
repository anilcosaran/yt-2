'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, RefreshCw, Shuffle, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SHOT_PLAN_ROWS_QUERY_KEY, loadShotPlanRows } from '@/lib/assistant/script-review/script-review-api'
import { formatClock, formatCredits, type ShotSourceChip } from '@/lib/assistant/script-review/script-review-model'
import {
  SHOT_SOURCE_CANDIDATES_QUERY_KEY,
  changeShotSource,
  getShotSourceCandidates,
  type ShotSourceCandidates,
} from '@/lib/assistant/short-video/shot-source-api'
import { buildShotPlanRowsModel, type ShotPlanRow, type ShotPlanRowsModel } from '@/lib/assistant/short-video/shot-plan-rows-model'
import { isProductionLaunchEvent } from '@/lib/assistant/production-launch-api'

import { OUTLINE_BUTTON } from './production-g1-card'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * SV: the shot list of the plan card of a short video in Chat. One row per shot: its number, length, what the viewer sees, the
 * director's pinned source (the `Kaynak` chip of the script panel) and the server's price; the total adds only what the server
 * priced. While the plan is not approved every shot can be planned again (a typed message to the assistant, which plans exactly
 * that shot) or take another source (the owner's ranked candidates; the change is a new plan revision). A storyboard draft is
 * marked as such and offers "Tam videoyu üret". Everything shown is the owner's, re-read on production events; nothing is kept in
 * browser storage and nothing here approves or starts production (that stays the G1 card's one decision).
 */

type CandidatesState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; candidates: ShotSourceCandidates }

export interface ShotPlanRowsViewProps {
  model: ShotPlanRowsModel
  /** False once the plan is approved: the list is read-only. */
  editable: boolean
  openSourceShotId: string | null
  candidates: CandidatesState | null
  busyShotId: string | null
  onReplan(row: ShotPlanRow): void
  onOpenSource(row: ShotPlanRow): void
  onCloseSource(): void
  onPickSource(row: ShotPlanRow, alternative: ShotSourceCandidates['alternatives'][number]): void
  onProduceFull(): void
}

function chipLabel(t: Translator, chip: ShotSourceChip): string {
  const cost = chip.cost.kind === 'priced'
    ? t('scriptReview.shot.source.cost.priced', { credits: formatCredits(chip.cost.credits) })
    : t(`scriptReview.shot.source.cost.${chip.cost.kind}`)
  return [t(`scriptReview.shot.source.modality.${chip.modality}`), chip.model, cost].filter((part): part is string => Boolean(part)).join(' · ')
}

const SOURCE_CHIP = 'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
const ROW_BUTTON = 'h-7 cursor-pointer gap-1 rounded-full border-border bg-transparent px-2.5 text-xs font-medium text-foreground shadow-none hover:bg-muted hover:text-foreground has-[>svg]:px-2.5'

/**
 * A section of the job's card (the Spark job card's frame comes from the card around it): a small header line, one compact row
 * per shot and, for a storyboard draft, "Tam videoyu üret" as a secondary button (the card's footer keeps the one primary).
 */
export function ShotPlanRowsView(props: ShotPlanRowsViewProps) {
  const t = useTranslations('Chat') as unknown as Translator
  const { model, editable } = props
  return (
    <section
      className="border-t border-border px-3.5 py-2.5"
      aria-label={t('shotPlan.title')}
      data-shot-plan-rows={model.rows.length}
      data-shot-plan-mode={model.draft ? 'storyboard_draft' : 'final'}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-medium text-foreground">{t('shotPlan.title')}</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('shotPlan.summary', { count: model.rows.length, duration: formatClock(model.totalSeconds) ?? '' })}
        </span>
        {model.draft ? <span className={SOURCE_CHIP} data-shot-plan-draft>{t('shotPlan.draftBadge')}</span> : null}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground" data-shot-plan-total={model.shotCredits}>
          {t('shotPlan.total', { credits: formatCredits(model.shotCredits) })}
          {model.unpricedShots > 0 ? <span className="ml-2">{t('shotPlan.totalUnpriced', { unpriced: model.unpricedShots })}</span> : null}
        </span>
      </header>
      {model.draft ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('shotPlan.draftHint')}</p> : null}
      <ol className="mt-1.5 divide-y divide-border">
        {model.rows.map((row) => (
          <li key={row.shotId} className="py-2" data-shot-id={row.shotId}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{t('shotPlan.shotLabel', { order: row.order })}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-5 text-foreground">{row.intent}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground">{t('shotPlan.seconds', { value: formatClock(row.seconds) ?? row.seconds })}</span>
                  {row.chip
                    ? <span className={SOURCE_CHIP} data-source-modality={row.chip.modality}><Sparkles className="size-3" />{chipLabel(t, row.chip)}</span>
                    : <span className={SOURCE_CHIP}>{t('shotPlan.noSource')}</span>}
                </div>
              </div>
              {editable ? (
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <Button type="button" variant="outline" className={ROW_BUTTON} aria-label={t('shotPlan.replanLabel', { order: row.order })} onClick={() => props.onReplan(row)}>
                    <RefreshCw className="size-3.5" />{t('shotPlan.replan')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={ROW_BUTTON}
                    aria-expanded={props.openSourceShotId === row.shotId}
                    aria-label={t('shotPlan.changeSourceLabel', { order: row.order })}
                    disabled={props.busyShotId === row.shotId}
                    onClick={() => (props.openSourceShotId === row.shotId ? props.onCloseSource() : props.onOpenSource(row))}
                  >
                    {props.busyShotId === row.shotId ? <Loader2 className="size-3.5 animate-spin" /> : <Shuffle className="size-3.5" />}{t('shotPlan.changeSource')}
                  </Button>
                </div>
              ) : null}
            </div>
            {editable && props.openSourceShotId === row.shotId ? (
              <div className="ml-16 mt-2 rounded-lg border border-border bg-muted/40 p-2" role="group" aria-label={t('shotPlan.sourceChoices', { order: row.order })}>
                {props.candidates?.status === 'loading' || props.candidates === null ? <p className="text-xs text-muted-foreground">{t('shotPlan.sourceLoading')}</p> : null}
                {props.candidates?.status === 'failed' ? <p className="text-xs text-amber-700 dark:text-amber-200">{t('shotPlan.sourceUnavailable')}</p> : null}
                {props.candidates?.status === 'ready' && props.candidates.candidates.alternatives.length === 0 ? <p className="text-xs text-muted-foreground">{t('shotPlan.sourceNone')}</p> : null}
                {props.candidates?.status === 'ready' ? (
                  <ul className="flex flex-col gap-1">
                    {props.candidates.candidates.alternatives.map((alternative) => (
                      <li key={`${alternative.modality}:${alternative.model_id ?? ''}`}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-muted"
                          data-source-choice={alternative.modality}
                          onClick={() => props.onPickSource(row, alternative)}
                        >
                          <span>{t(`scriptReview.shot.source.modality.${alternative.modality}`)}{alternative.model_id ? ` · ${alternative.model_id}` : ''}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {alternative.credits === null ? t('scriptReview.shot.source.cost.not_ready') : alternative.credits === 0 ? t('scriptReview.shot.source.cost.free') : t('scriptReview.shot.source.cost.priced', { credits: formatCredits(alternative.credits) })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline" onClick={props.onCloseSource}>
                  <X className="size-3" />{t('shotPlan.closeSource')}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {model.draft && editable ? (
        <div className="mt-1 flex justify-end">
          <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={props.onProduceFull}>
            {t('shotPlan.produceFull')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * The container: reads the job's shot plan (owner reads), re-reads it on production events and runs the row actions. `onAsk`
 * puts a typed message into the composer (the user sends it); the source change is the owner's own command.
 */
export function ShotPlanRows({ projectId, jobId, runEvents, editable, onAsk }: {
  projectId: string
  jobId: string
  runEvents: ReadonlyArray<{ event_type: string; sequence: number; run_id: string }>
  editable: boolean
  onAsk?: (text: string) => void
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => [...SHOT_PLAN_ROWS_QUERY_KEY, projectId, jobId] as const, [projectId, jobId])
  const rows = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadShotPlanRows(projectId, jobId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  const eventMark = React.useMemo(
    () => runEvents.filter((event) => event.run_id === jobId && isProductionLaunchEvent(event.event_type)).at(-1)?.sequence ?? 0,
    [jobId, runEvents],
  )
  React.useEffect(() => {
    if (eventMark > 0) void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, queryClient, queryKey])

  const [openShotId, setOpenShotId] = React.useState<string | null>(null)
  const [busyShotId, setBusyShotId] = React.useState<string | null>(null)
  const candidates = useQuery({
    queryKey: [...SHOT_SOURCE_CANDIDATES_QUERY_KEY, projectId, jobId, openShotId ?? '', rows.data?.revision ?? 0],
    queryFn: ({ signal }) => getShotSourceCandidates({ projectId, jobId, shotId: openShotId! }, { signal }),
    enabled: openShotId !== null,
    staleTime: 0,
    retry: 0,
  })
  const model = React.useMemo(() => (rows.data ? buildShotPlanRowsModel({ shots: rows.data.shots, mode: rows.data.mode }) : null), [rows.data])
  if (!rows.data || !model || model.rows.length === 0) return null
  const data = rows.data
  const candidateState: CandidatesState | null = openShotId === null ? null
    : candidates.isPending ? { status: 'loading' }
      : candidates.data ? { status: 'ready', candidates: candidates.data }
        : { status: 'failed' }

  const pick = async (row: ShotPlanRow, alternative: ShotSourceCandidates['alternatives'][number]) => {
    setBusyShotId(row.shotId)
    setOpenShotId(null)
    try {
      await changeShotSource({ projectId, jobId, shotId: row.shotId, expectedRevision: data.revision, modality: alternative.modality, ...(alternative.model_id ? { modelId: alternative.model_id } : {}) })
      toast.success(t('shotPlan.sourceChanged'))
      onAsk?.(t('shotPlan.askRefresh', { order: row.order, shotId: row.shotId }))
    } catch {
      toast.error(t('shotPlan.sourceFailed'))
    } finally {
      setBusyShotId(null)
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  return (
    <ShotPlanRowsView
      model={model}
      editable={editable}
      openSourceShotId={openShotId}
      candidates={candidateState}
      busyShotId={busyShotId}
      onReplan={(row) => onAsk?.(t('shotPlan.askReplan', { order: row.order, shotId: row.shotId }))}
      onOpenSource={(row) => setOpenShotId(row.shotId)}
      onCloseSource={() => setOpenShotId(null)}
      onPickSource={(row, alternative) => void pick(row, alternative)}
      onProduceFull={() => onAsk?.(t('shotPlan.askProduceFull'))}
    />
  )
}

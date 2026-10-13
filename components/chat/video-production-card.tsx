'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PRODUCTION_LAUNCH_QUERY_KEY, isProductionLaunchEvent } from '@/lib/assistant/production-launch-api'
import {
  VIDEO_PRODUCTION_CARD_QUERY_KEY,
  jobProjectIdFromProgress,
  loadVideoProductionCard,
} from '@/lib/assistant/script-review/script-review-api'
import {
  buildVideoPreparationCardModel,
  formatClock,
  formatCredits,
  type VideoPreparationCardModel,
} from '@/lib/assistant/script-review/script-review-model'

import {
  CARD_FRAME,
  OUTLINE_BUTTON,
  ProductionJobCard,
  RunCardFooter,
  RunCardHeader,
  useProductionLaunchState,
  type ProductionJobCardEvent,
} from './production-g1-card'
import { ProductionFlow } from './production-flow'
import { sameScriptReviewTarget, useScriptReviewHost, type ScriptReviewTarget } from './script-review/script-review-host'
import { ShotPlanRows } from './shot-plan-rows'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * P03-20 `VideoProductionCard`: the one persistent card of a video job in Chat (KARAR 8). While the job waits on a
 * presented plan it is the P03-09 G1 card plus "Script'i aç"; before that (script ready, plan preparing, script-only
 * job) it is the same card frame with the job's short summary, the 8G minimal estimate and "Script'i aç". The card has
 * no approve button of its own outside the G1 presentation; opening the script is read/edit only. State is always the
 * owner's (re-read on production events and after a script save), never browser storage.
 */
export function VideoProductionCard({ jobId, runEvents, onAsk, reply }: {
  jobId: string
  runEvents: readonly ProductionJobCardEvent[]
  /** The agent's message that presented the plan, shown inside the job's flow (see `ProductionFlow`). */
  reply?: string
  /** SV: puts a typed message into the composer (the shot list's "yeniden planla", "kaynağı değiştir", "tam videoyu üret"). */
  onAsk?: (text: string) => void
}) {
  const queryClient = useQueryClient()
  const host = useScriptReviewHost()
  const launch = useProductionLaunchState(jobId)
  const projectId = jobProjectIdFromProgress(launch.data?.progress)
  const queryKey = React.useMemo(() => [...VIDEO_PRODUCTION_CARD_QUERY_KEY, projectId ?? '', jobId] as const, [projectId, jobId])
  const card = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadVideoProductionCard(projectId!, jobId, { signal }),
    enabled: Boolean(projectId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  const eventMark = React.useMemo(
    () => runEvents.filter((event) => event.run_id === jobId && isProductionLaunchEvent(event.event_type)).at(-1)?.sequence ?? 0,
    [jobId, runEvents],
  )
  // Production events re-read both owners: the launch checkpoint (a G1 presentation may appear) and the package.
  React.useEffect(() => {
    if (eventMark <= 0) return
    void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_LAUNCH_QUERY_KEY, jobId] })
    void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, jobId, queryClient, queryKey])

  const model = card.data
    ? buildVideoPreparationCardModel({ summary: card.data.summary, scriptHeader: card.data.scriptHeader, brief: card.data.brief })
    : null
  const target: ScriptReviewTarget | null = projectId ? { projectId, jobId } : null
  const presentationState = launch.data?.presentation?.state ?? null
  const openAction = model && target && host ? <OpenScriptButton target={target} /> : null
  // While the plan waits: "Yeniden planla" puts the request into the composer, where the user says what to change.
  const replanAction = presentationState === 'presented' && onAsk ? <ReplanButton onAsk={onAsk} /> : null

  // SV: the shot list (source + price per shot) of a short video's plan; read-only once the plan is approved. Where
  // the plan opens on a canvas beside the chat, the canvas shows the plan and the card stays short (no list here).
  const shotList = projectId && !host
    ? <ShotPlanRows projectId={projectId} jobId={jobId} runEvents={runEvents} editable={presentationState === null || presentationState === 'presented'} onAsk={onAsk} />
    : null
  // Where the plan opens beside the chat, the job reads as a flow: reasoning, the plan card, then its tasks.
  if (launch.data?.presentation && host && projectId) {
    return <ProductionFlow jobId={jobId} projectId={projectId} runEvents={runEvents} reply={reply} onAsk={onAsk} />
  }
  if (launch.data?.presentation) {
    return <ProductionJobCard jobId={jobId} runEvents={runEvents} secondaryAction={openAction || replanAction ? <>{openAction}{replanAction}</> : null}>{shotList}</ProductionJobCard>
  }
  if (!model) return null
  return <VideoPreparationCardView model={model} action={openAction}>{shotList}</VideoPreparationCardView>
}

export function OpenScriptButton({ target }: { target: ScriptReviewTarget }) {
  const t = useTranslations('Chat') as unknown as Translator
  const host = useScriptReviewHost()
  if (!host) return null
  const open = sameScriptReviewTarget(host.target, target)
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={open}
      className={OUTLINE_BUTTON}
      onClick={() => (open ? host.requestClose() : host.open(target))}
    >
      {open ? <X className="size-3.5" /> : <FileText className="size-3.5" />}
      {open ? t('planCanvas.hide') : t('planCanvas.open')}
    </Button>
  )
}

function ReplanButton({ onAsk }: { onAsk: (text: string) => void }) {
  const t = useTranslations('Chat') as unknown as Translator
  return (
    <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => onAsk(t('planCanvas.fixPrompt'))}>
      <RefreshCw className="size-3.5" />
      {t('planCanvas.replan')}
    </Button>
  )
}

/** The job's card before a plan is presented: same frame as the plan card, the summary as one muted footer line. */
export function VideoPreparationCardView({ model, action, children }: {
  model: VideoPreparationCardModel
  action: React.ReactNode
  /** A section of the same job inside the card, above the footer (the shot list of a short video's plan). */
  children?: React.ReactNode
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const meta: string[] = [t('scriptReview.scriptRevision', { revision: model.scriptRevision })]
  if (model.planRevision !== null) meta.push(t('scriptReview.planRevision', { revision: model.planRevision }))
  const target = formatClock(model.targetSeconds)
  if (target) meta.push(t('scriptReview.card.target', { duration: target }))
  if (model.language) meta.push(model.language)
  if (model.aspectRatio) meta.push(model.aspectRatio)
  if (model.chapters !== null) meta.push(t('scriptReview.card.chapters', { count: model.chapters }))
  if (model.shots !== null) meta.push(t('scriptReview.card.shots', { count: model.shots }))
  const estimate = estimateText(t, model)
  if (estimate) meta.push(estimate)
  if (model.estimate.ceiling !== null && model.estimate.range) meta.push(t('scriptReview.card.ceiling', { value: formatCredits(model.estimate.ceiling) }))
  return (
    <div className={CARD_FRAME} data-video-production-status={model.status}>
      <RunCardHeader
        icon={<FileText className="size-4" />}
        title={model.title || t('scriptReview.untitled')}
        subtitle={t(`scriptReview.card.status.${model.status}`)}
      />
      {children}
      <RunCardFooter meta={meta.join(' · ')}>{action}</RunCardFooter>
    </div>
  )
}

function estimateText(t: Translator, model: VideoPreparationCardModel): string | null {
  const estimate = model.estimate
  if (estimate.range && (estimate.state === 'current' || estimate.state === 'previous')) {
    return estimate.range.min === estimate.range.max
      ? t(`scriptReview.card.estimate.${estimate.state}Point`, { value: formatCredits(estimate.range.min) })
      : t(`scriptReview.card.estimate.${estimate.state}`, { min: formatCredits(estimate.range.min), max: formatCredits(estimate.range.max) })
  }
  if (estimate.state === 'computing' || estimate.state === 'unavailable' || estimate.state === 'script_only') return t(`scriptReview.card.estimate.${estimate.state}`)
  return null
}

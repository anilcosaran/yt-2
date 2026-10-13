'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, Loader2, Sparkles, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MotionUndoOutcome } from '@/lib/spark/motion-placement-undo'
import {
  motionDraftPath,
  motionPlacementStartLabel,
  type MotionPlacementView,
  type MotionResult,
} from '@/lib/spark/motion-result'
import { cn } from '@/lib/utils'

/** Placement reasons the server names (`BrandMotionOverlayPlacementReason`); anything else reads as the generic line. */
const NOT_PLACED_REASONS = new Set([
  'project_unavailable',
  'composition_tools_closed',
  'timeline_empty',
  'timeline_unresolved',
  'scene_too_short',
  'ratio_not_available',
  'refused',
  'conflict',
  'paid_dispatch_required',
])

export type MotionResultCardProps = {
  result: MotionResult
  /**
   * Spark chat: the project's frame rate (for the "0:12" label) and the Undo of the placement. The Dashboard chat passes
   * neither: it has no project, the card only opens the draft in Motion.
   */
  fps?: number
  onUndo?: (placement: Extract<MotionPlacementView, { status: 'applied' }>) => Promise<MotionUndoOutcome>
  className?: string
}

/**
 * E1-H "Motion ready" card of a `/motion` job (owner K10): in the Spark chat it says where the AI put the Motion (an overlay
 * at the playhead) with "Open in Motion" and "Undo"; in the Dashboard chat it is the draft with "Open in Motion". It uses the
 * `SparkContinueCard` shell. Everything shown comes from the server's typed card (ids, frames, reason codes): the link is
 * built from the draft id (the draft is private, so another user's link is a 404 on the Motion screen) and Undo asks
 * Composition to undo exactly the card's undo group, which refuses if the user edited on top of it.
 */
export function MotionResultCard({ result, fps = 30, onUndo, className }: MotionResultCardProps) {
  const t = useTranslations('Chat.motionResult')
  const [undo, setUndo] = React.useState<'idle' | 'working' | MotionUndoOutcome>('idle')
  const placement = result.placement
  const applied = placement?.status === 'applied' ? placement : null

  const runUndo = async () => {
    if (!applied || !onUndo || undo === 'working') return
    setUndo('working')
    try {
      setUndo(await onUndo(applied))
    } catch {
      setUndo('failed')
    }
  }

  let status: string
  if (applied && undo === 'undone') status = t('undone')
  else if (applied && undo === 'conflict') status = t('undoConflict')
  else if (applied && undo === 'failed') status = t('undoFailed')
  else if (applied?.revised) status = t('revised', { time: motionPlacementStartLabel(applied, fps) })
  else if (applied) status = t('placed', { time: motionPlacementStartLabel(applied, fps) })
  else if (placement?.status === 'proposed') status = t('proposed')
  else if (placement?.status === 'not_placed') {
    status = t('notPlaced', { reason: t(`reasons.${NOT_PLACED_REASONS.has(placement.reason) ? placement.reason : 'other'}`) })
  } else status = result.published ? t('saved') : t('draftReady')

  const title = result.published ? t('title') : t('draftTitle')
  // An applied revision whose receipt named no undo group has no Undo here (the editor's own Undo still reverts it).
  const canUndo = applied !== null && applied.undoGroupId !== '' && onUndo !== undefined && (undo === 'idle' || undo === 'working' || undo === 'failed')
  return (
    <div
      data-testid="motion-result-card"
      data-motion-placement={placement?.status ?? 'none'}
      data-motion-revised={applied?.revised ? 'true' : undefined}
      data-motion-published={result.published ? 'true' : 'false'}
      className={cn(
        'flex w-[min(620px,92vw)] items-center gap-3 rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]',
        className,
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8">
        <Sparkles className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground dark:text-white">{title}</p>
        {result.name ? <p className="truncate text-xs text-muted-foreground dark:text-white/58">{result.name}</p> : null}
        <p className="mt-1 text-sm text-muted-foreground dark:text-white/58" role="status">
          {status}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {canUndo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold"
            onClick={() => void runUndo()}
            disabled={undo === 'working'}
            data-motion-undo=""
          >
            {undo === 'working' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
            {t('undo')}
          </Button>
        ) : null}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white"
        >
          <Link href={motionDraftPath(result.draftId)} data-motion-open="">
            {t('open')}
            <ArrowUpRight className="size-4 text-muted-foreground dark:text-white/82" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  )
}

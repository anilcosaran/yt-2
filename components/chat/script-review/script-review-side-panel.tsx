'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { LabCanvas } from '@/components/spark/lab/lab-canvas'

import { useEstimateText, useJobLabRun } from '../production-flow'
import { useScriptReviewHostInternal, type ScriptReviewTarget } from './script-review-host'

type Translator = (key: string, values?: Record<string, string | number>) => string

const PANEL_DEFAULT_WIDTH = 760
/** Up to half the window: Spark's plan and screen are laid out for room… */
const PANEL_DEFAULT_SHARE = 0.5
/** …while the menu and the conversation keep at least this much beside it. */
const PANEL_CHAT_ROOM = 860
const PANEL_MIN_WIDTH = 480
const PANEL_MAX_WIDTH = 1280

/**
 * The plan canvas of the main Chat (KARAR 8A): Spark's own workspace parts next to the conversation — the Plan
 * view's plan with its approval bar and timeline, then Spark's screen while the video is made (`LabCanvas`). It
 * opens by itself when a plan is ready (`ScriptReviewHost.autoOpen`), is resizable and closable like the workflow
 * canvas panel, and below `lg` is a full-screen sheet over the chat. "Bu planla üret" here and the plan card in the
 * chat decide the same plan: either one starts the other.
 */
export function ScriptReviewSidePanel({ onAsk }: {
  /** Puts a typed message into the composer (e.g. "Düzelt": the user writes what to change in the plan). */
  onAsk?: (text: string) => void
} = {}) {
  const t = useTranslations('Chat') as unknown as Translator
  const host = useScriptReviewHostInternal()
  const [width, setWidth] = React.useState(() => (typeof window === 'undefined' ? PANEL_DEFAULT_WIDTH : clampWidth(Math.min(window.innerWidth * PANEL_DEFAULT_SHARE, window.innerWidth - PANEL_CHAT_ROOM))))
  const target = host?.target ?? null
  if (!target || !host) return null

  function handleResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const handleMove = (moveEvent: PointerEvent) => setWidth(clampWidth(startWidth - (moveEvent.clientX - startX)))
    const handleEnd = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  return (
    <aside
      data-script-review-panel=""
      data-plan-canvas=""
      style={{ '--script-panel-width': `${width}px` } as React.CSSProperties}
      // A split pane: it slides in from the right and sits beside the chat behind one thin line.
      className="fixed inset-0 z-40 overflow-hidden bg-background text-foreground duration-300 ease-out animate-in fade-in-0 slide-in-from-right-12 lg:relative lg:inset-auto lg:z-auto lg:h-auto lg:w-[var(--script-panel-width)] lg:min-w-[480px] lg:max-w-[72vw] lg:shrink-0 lg:border-l lg:border-border motion-reduce:animate-none"
    >
      <button
        type="button"
        aria-label={t('workflowDraft.resizeWorkspace')}
        title={t('workflowDraft.resizeWorkspace')}
        onPointerDown={handleResizeStart}
        className="group absolute inset-y-0 -left-1 z-30 hidden w-2 cursor-col-resize items-center justify-center outline-none lg:flex"
      >
        <span className="h-full w-px bg-transparent transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary/60" />
      </button>
      <SparkPlanCanvas key={`${target.projectId}:${target.jobId}`} target={target} onAsk={onAsk} onClose={() => host.requestClose()} />
    </aside>
  )
}

/**
 * The job's video on Spark's canvas: Spark's screen (preview and timeline) of the job's shared run, with the approval
 * bar while the plan waits. "Bu planla üret" here decides the job's plan like Spark's own; the chat follows the run.
 */
function SparkPlanCanvas({ target, onAsk, onClose }: {
  target: ScriptReviewTarget
  onAsk?: (text: string) => void
  onClose: () => void
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const router = useRouter()
  const { run, presentation, approve } = useJobLabRun({ jobId: target.jobId, projectId: target.projectId })
  const spark = `/spark/${encodeURIComponent(target.projectId)}`
  const credits = useEstimateText(presentation)

  return (
    <LabCanvas
      run={run}
      href={spark}
      onApprove={() => void approve()}
      onFix={onAsk ? () => onAsk(t('planCanvas.fixPrompt')) : undefined}
      credits={credits}
      // The run is shared with the Spark project: its editor takes it up where it is.
      onEdit={() => router.push(`${spark}?v=a`)}
      onClose={onClose}
      closeLabel={t('planCanvas.close')}
    />
  )
}

function clampWidth(width: number) {
  const viewportMax = typeof window === 'undefined' ? PANEL_MAX_WIDTH : Math.max(PANEL_MIN_WIDTH, Math.floor(window.innerWidth * 0.72))
  return Math.min(Math.max(Math.round(width), PANEL_MIN_WIDTH), Math.min(PANEL_MAX_WIDTH, viewportMax))
}

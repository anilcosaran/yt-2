'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkStageBinding } from '../stage/use-spark-stage'
import { SparkTimeline, type SparkTimelineProps } from './spark-timeline'

/** Timeline v3 dock heights (px): roomy by default (CapCut-like), taller with the lanes open; the handle drags between the bounds. */
export const TIMELINE_DOCK_DEFAULT_PX = 300
export const TIMELINE_DOCK_LANES_PX = 420
export const TIMELINE_DOCK_MIN_PX = 180
export const TIMELINE_DOCK_MAX_PX = 560

export function clampDockHeight(value: number): number {
  return Math.round(Math.min(TIMELINE_DOCK_MAX_PX, Math.max(TIMELINE_DOCK_MIN_PX, value)))
}

/**
 * The editor dock with the timeline (`SPARK_TIMELINE_EDITING_ENABLED`): binds the timeline to the stage's playback clock and
 * to whether the gateway draws transitions (the preview plan), without re-rendering on any other stage change. v3: the
 * height handle on its top edge (drag between 180 and 560 px, double-click resets) and the Lanes toggle's state, both for
 * this session only (no browser storage). While the handle is dragged the height is written directly (no React commit).
 */
export function SparkTimelineDock({
  stage,
  ...props
}: Omit<SparkTimelineProps, 'playback' | 'transitionsEnabled' | 'transitionCatalog' | 'relaxedSplit' | 'lanesOpen' | 'onLanesOpenChange'> & {
  stage: SparkStageBinding | null
}) {
  const t = useTranslations('Spark.editor.timelineV3')
  const transitionsEnabled = React.useSyncExternalStore(
    stage ? stage.controller.subscribe : noSubscribe,
    () => stage?.controller.getSnapshot().presenter.plan?.transitionsEnabled === true,
    () => false,
  )
  // The transition catalogue the gateway writes now (manifest `transition_catalog_version`): the cut picker offers its kinds.
  const transitionCatalog = React.useSyncExternalStore(
    stage ? stage.controller.subscribe : noSubscribe,
    () => stage?.controller.getSnapshot().presenter.plan?.transitionCatalog,
    () => undefined,
  )
  // Timeline v3: the gateway's relaxed `scene.split` (`COMPOSITION_RELAXED_SPLIT_ENABLED`, manifest `relaxed_split_enabled`);
  // Split plans it only while the preview plan says so (a switch of the server, read like the transition switch).
  const relaxedSplit = React.useSyncExternalStore(
    stage ? stage.controller.subscribe : noSubscribe,
    () => stage?.controller.getSnapshot().presenter.plan?.relaxedSplitEnabled === true,
    () => false,
  )
  const [lanesOpen, setLanesOpen] = React.useState(false)
  const [height, setHeight] = React.useState<number | null>(null)
  const dockRef = React.useRef<HTMLDivElement>(null)
  const shown = height ?? (lanesOpen ? TIMELINE_DOCK_LANES_PX : TIMELINE_DOCK_DEFAULT_PX)

  const onResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const dock = dockRef.current
    if (event.button !== 0 || !dock) return
    event.preventDefault()
    const handle = event.currentTarget
    const startHeight = dock.offsetHeight || shown
    const startY = event.clientY
    let next = startHeight
    handle.classList.add('on')
    const move = (moved: PointerEvent) => {
      next = clampDockHeight(startHeight - (moved.clientY - startY))
      dock.style.setProperty('--st-dock-h', `${next}px`)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      handle.classList.remove('on')
      setHeight(next)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div ref={dockRef} className={`dock tl2-dock${lanesOpen ? ' lanes' : ''}`} style={{ '--st-dock-h': `${shown}px` } as React.CSSProperties} data-dock-height={shown}>
      <div
        className="rz rz-y"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('resize')}
        title={t('resize')}
        onPointerDown={onResizeStart}
        onDoubleClick={() => {
          dockRef.current?.style.setProperty('--st-dock-h', `${lanesOpen ? TIMELINE_DOCK_LANES_PX : TIMELINE_DOCK_DEFAULT_PX}px`)
          setHeight(null)
        }}
        data-timeline-resize
      />
      <SparkTimeline
        {...props}
        playback={stage?.playback ?? null}
        transitionsEnabled={transitionsEnabled}
        {...(transitionCatalog !== undefined && { transitionCatalog })}
        relaxedSplit={relaxedSplit}
        lanesOpen={lanesOpen}
        onLanesOpenChange={setLanesOpen}
      />
    </div>
  )
}

const noSubscribe = () => () => undefined

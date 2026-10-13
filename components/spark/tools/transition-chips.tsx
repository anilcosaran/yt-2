'use client'

import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import { lengthFeedback, transitionBoundaries } from '@/lib/spark/effects/transition-browser'
import { TRANSITION_KINDS, TRANSITION_MAX_FRAMES, TRANSITION_MIN_FRAMES, sceneTransitionOf, transitionWindowsOf, type TransitionKind } from '@/lib/spark/scene-transitions'
import { isCardDrag, readCardDrag } from '@/lib/spark/stage/placement'
import type { StagePlanTransition } from '@/lib/spark/stage/stage-types'
import { stripCss, stripReservedPx, stripX, type StripAxis } from '@/lib/spark/timeline-tracks'

import { useStageState } from '../stage/use-stage-state'
import type { SparkStageBinding } from '../stage/use-spark-stage'
import './scene-transition.css'
import type { TimelineScene } from './spark-tool-types'

/** The card kind a Transitions card carries while dragged (mirrors `TRANSITION_CARD_KIND` of the drawer). */
const TRANSITION_CARD = 'transition'

export type TransitionChipsProps = {
  document: CompositionDocument
  axis: StripAxis
  timeline: readonly TimelineScene[]
  selectedSceneId: string | null
  /** The preview's stage; without it (stage switch off) transitions cannot be set and no chip is shown. */
  stage: SparkStageBinding | null
  /** A chip was pressed: select the incoming scene and open Properties on its Transition section (WP0). */
  onOpen(sceneId: string): void
  /**
   * Spark effects WP1 (`SPARK_TRANSITIONS_BROWSER_ENABLED`): a chip takes a Transitions card dropped on it, and a set
   * transition carries a duration handle. Absent = the plain E1-L chips.
   */
  browser?: {
    canWrite: boolean
    onDropKind(sceneId: string, kind: TransitionKind): void
    onLength(sceneId: string, frames: number): void
  }
}

/**
 * E1-L (D8) / Spark effects WP0-WP1: the small chips between the cards of the scene strip. One sits on every boundary (from
 * the second scene on) while the gateway draws transitions (the preview plan's `transitions_enabled`): a transition shows
 * its kind and length, a cut is a dot. Pressing a chip selects the INCOMING scene and opens its Transition section. With
 * the Transitions browser on, a card dropped on a chip puts that transition there, and the handle on the chip's right edge
 * drags its length (live feedback of what the scenes give, one command on release). Positioned on the strip's own axis.
 */
export function TransitionChips(props: TransitionChipsProps) {
  const { stage, ...rest } = props
  // Hooks cannot be conditional: the plan is read in a child that exists only with the stage.
  return stage ? <StagedChips {...rest} stage={stage} /> : null
}

function StagedChips({ stage, ...props }: Omit<TransitionChipsProps, 'stage'> & { stage: SparkStageBinding }) {
  const plan = useStageState(stage).presenter.plan
  return plan?.transitionsEnabled === true ? <Chips {...props} planned={plan.transitions ?? []} /> : null
}

type Drag = { sceneId: string; frames: number }

function Chips({
  document,
  axis,
  timeline,
  selectedSceneId,
  onOpen,
  browser,
  planned,
}: Omit<TransitionChipsProps, 'stage'> & {
  /** The preview manifest's windows: whether the gateway shortened a stored length (the chip's resting clamp state). */
  planned: readonly StagePlanTransition[]
}) {
  const t = useTranslations('Spark.editor.transition')
  const tFx = useTranslations('Spark.editor.effects.transitions')
  const locale = useLocale()
  const windows = React.useMemo(() => transitionWindowsOf(document), [document])
  const boundaries = React.useMemo(() => new Map(transitionBoundaries(document).map((boundary) => [boundary.sceneId, boundary])), [document])
  const fps = document.canvas.fps.num / document.canvas.fps.den
  const seconds = (frames: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.round((frames / fps) * 10) / 10)
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const [dropOn, setDropOn] = React.useState<string | null>(null)

  const beginLengthDrag = (event: React.PointerEvent<HTMLElement>, sceneId: string, startFrames: number) => {
    if (!browser?.canWrite || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const segs = event.currentTarget.closest('.segs')
    const width = segs ? segs.getBoundingClientRect().width : 0
    const pxPerFrame = axis.totalFrames > 0 ? Math.max(0, width - stripReservedPx(axis)) / axis.totalFrames : 0
    if (pxPerFrame <= 0) return
    const originX = event.clientX
    // The window is centred on the cut: moving its right edge by d widens it by 2d.
    const framesAt = (clientX: number) => Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, Math.round(startFrames + (2 * (clientX - originX)) / pxPerFrame)))
    setDrag({ sceneId, frames: startFrames })
    const move = (moved: PointerEvent) => setDrag({ sceneId, frames: framesAt(moved.clientX) })
    const done = (ended: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', cancel)
      setDrag(null)
      const frames = framesAt(ended.clientX)
      if (frames !== startFrames) browser.onLength(sceneId, frames)
    }
    const cancel = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', cancel)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', cancel)
  }

  return (
    <>
      {timeline.map((entry, index) => {
        if (index === 0) return null
        const sceneId = entry.scene.scene_id
        const stored = sceneTransitionOf(entry.scene)
        const window = windows.get(sceneId)
        const boundary = boundaries.get(sceneId)
        const dragging = drag?.sceneId === sceneId ? drag : null
        // While the handle moves the timing rule answers live; at rest the manifest says what the gateway made of the length.
        const manifest = planned.find((transition) => transition.toSceneId === sceneId && transition.status === 'ready')
        const feedback =
          dragging && boundary
            ? lengthFeedback(boundary, dragging.frames)
            : stored && manifest?.clamped && manifest.durationFrames !== null
              ? { requestedFrames: manifest.requestedFrames, appliedFrames: manifest.durationFrames, clamped: true, maxFrames: null }
              : null
        const length = stored
          ? seconds(feedback ? (feedback.appliedFrames ?? feedback.requestedFrames) : window?.status === 'ready' ? window.durationFrames : stored.duration_frames)
          : ''
        const name = stored ? t(`kinds.${stored.kind}`) : ''
        const classes = ['seg-chip']
        if (!stored) classes.push('cut')
        if (sceneId === selectedSceneId) classes.push('on')
        if (dropOn === sceneId) classes.push('drop-on')
        if (feedback?.clamped) classes.push('clamped')
        const left = `calc(${stripCss(axis, stripX(axis, index, 0))} - 1.5px)`
        const label = stored ? t('chip.set', { n: entry.number, name, seconds: length }) : t('chip.cut', { n: entry.number })
        const clampTitle = feedback?.clamped && feedback.appliedFrames !== null ? tFx('lengthClamped', { seconds: seconds(feedback.appliedFrames) }) : null
        const dropProps = browser?.canWrite
          ? {
              onDragOver: (event: React.DragEvent<HTMLElement>) => {
                if (!isCardDrag(event.dataTransfer)) return
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = 'copy'
                if (dropOn !== sceneId) setDropOn(sceneId)
              },
              onDragLeave: () => setDropOn((current) => (current === sceneId ? null : current)),
              onDrop: (event: React.DragEvent<HTMLElement>) => {
                const card = readCardDrag(event.dataTransfer)
                setDropOn(null)
                if (!card || card.tool !== 'transitions' || card.kind !== TRANSITION_CARD) return
                const kind = card.data['kind']
                if (typeof kind !== 'string' || !(TRANSITION_KINDS as readonly string[]).includes(kind)) return
                event.preventDefault()
                event.stopPropagation()
                browser.onDropKind(sceneId, kind as TransitionKind)
              },
            }
          : {}
        const chip = (
          <button
            type="button"
            className={classes.join(' ')}
            data-transition-into={sceneId}
            style={browser && stored ? undefined : { left }}
            aria-label={label}
            title={clampTitle ?? (stored ? t('chip.text', { name, seconds: length }) : t('kinds.cut'))}
            onClick={(event) => {
              event.stopPropagation()
              onOpen(sceneId)
            }}
            onKeyDown={(event) => event.stopPropagation()}
            {...dropProps}
          >
            {stored ? t('chip.text', { name, seconds: length }) : null}
          </button>
        )
        if (!browser || !stored) return <React.Fragment key={sceneId}>{chip}</React.Fragment>
        // WP1: the chip and its duration handle travel together, centred on the cut.
        return (
          <span key={sceneId} className="seg-chip-wrap" style={{ left }}>
            {chip}
            <span
              className={`seg-chip-grip${dragging ? ' dragging' : ''}`}
              role="slider"
              tabIndex={browser.canWrite ? 0 : -1}
              aria-disabled={!browser.canWrite}
              aria-label={tFx('lengthHandle', { n: entry.number })}
              aria-valuemin={TRANSITION_MIN_FRAMES}
              aria-valuemax={TRANSITION_MAX_FRAMES}
              aria-valuenow={dragging?.frames ?? stored.duration_frames}
              aria-valuetext={tFx('lengthValue', { seconds: length })}
              title={clampTitle ?? tFx('lengthHint')}
              data-transition-grip={sceneId}
              onPointerDown={(event) => beginLengthDrag(event, sceneId, stored.duration_frames)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (!browser.canWrite || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
                event.preventDefault()
                // One step = a tenth of a second (Shift: half a second).
                const step = Math.max(1, Math.round(fps * (event.shiftKey ? 0.5 : 0.1)))
                browser.onLength(sceneId, stored.duration_frames + (event.key === 'ArrowRight' ? step : -step))
              }}
            />
          </span>
        )
      })}
    </>
  )
}

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { CompositionDocument, CompositionOpSpec } from '@/lib/spark/composition-client'
import type { SparkApplyOptions } from '@/lib/spark/composition-session'
import { sourceIdOfStorageObject } from '@/lib/spark/media/media-source'
import type { OutlineThumbnails } from '@/lib/spark/outline/outline-thumbnails'
import { TRANSITION_KINDS, TRANSITION_MAX_FRAMES, TRANSITION_MIN_FRAMES, type SceneTransition, type TransitionKind } from '@/lib/spark/scene-transitions'
import type { MediaInsertFitResolver } from '@/lib/spark/stage/media-insert-fit'
import { acceptsToolDrop, readToolDrop, type SparkToolDrop } from '@/lib/spark/stage/placement'
import {
  canStartChapterAt,
  chapterEdgeTarget,
  planDeleteChapter,
  planMakeChapters,
  planMergeChapterWithNext,
  planMoveChapterEdge,
  planRenameChapter,
  planStartChapterAt,
  youtubeChapters,
  type ChapterPlan,
} from '@/lib/spark/timeline/timeline-chapter-edits'
import {
  ZOOM_STEP,
  fitZoom,
  formatSecondsLength,
  formatTimelineTime,
  isFitZoom,
  rulerStep,
  sliderToZoom,
  snapFrame,
  snapRange,
  snapThresholdFrames,
  visibleWindowFor,
  windowBucket,
  zoomAt,
  zoomBounds,
  zoomToSlider,
  type ZoomMode,
} from '@/lib/spark/timeline/timeline-geometry'
import {
  mainDropIndex,
  mainDropSection,
  mainTrimBounds,
  overlayTrimBounds,
  planDelete,
  planMainMediaDrop,
  planMainReorder,
  planMainTrim,
  planMusicDrop,
  planOverlayMove,
  planOverlayTrim,
  planRampChange,
  planSetFixedLength,
  planSplit,
  planTrimToPlayhead,
  rampBounds,
  resolveOverlayMove,
  splitKey,
  type TimelinePlan,
  type TrimBounds,
  type TrimEdge,
} from '@/lib/spark/timeline/timeline-edits'
import type { TimelineMediaPreviews } from '@/lib/spark/timeline/timeline-media-previews'
import {
  buildTimelineModel,
  chapterOfScene,
  displayToPlayFrame,
  nearestCut,
  playToDisplayFrame,
  type TimelineModel,
} from '@/lib/spark/timeline/timeline-model'

import { Icon } from '../tools/studio-parts'
import { ChapterMenu, useChapterNamer, type ChapterMenuItem } from './timeline-chapters'
import { NO_TIMELINE_MEDIA_PREVIEWS, mediaObjectsOf } from './timeline-clip-media'
import { TIMELINE_HEAD_PX, TIMELINE_ROWS, TimelineLanes } from './timeline-lanes'
import { TransitionPicker } from './timeline-transition-picker'
import './timeline.css'

/** The playback clock the timeline drives (the stage's `PlaybackStore`). */
export type TimelinePlayback = {
  readonly frame: number
  getSnapshot(): { playing: boolean; frame: number; totalFrames: number; fps: { num: number; den: number } }
  subscribe(listener: () => void): () => void
  subscribeFrame(listener: (frame: number) => void): () => void
  seek(frame: number): void
  step(delta: number): void
  toggle(): void
  pause(): void
}

export type SparkTimelineTransitions = {
  canWrite: boolean
  onDropKind(sceneId: string, kind: TransitionKind): void
  onLength(sceneId: string, frames: number): void
  /** The cut picker (v3): sets (null = removes) the transition into a scene as one command, then plays the cut. */
  onSet?(sceneId: string, transition: SceneTransition | null, options?: { coalesce?: boolean }): void
  /** The picker's "Apply to all cuts": one command. */
  onApplyToAll?(transition: SceneTransition): void
}

export type SparkTimelineProps = {
  document: CompositionDocument
  /** The editor's selected scene and the stage's single selected layer (the timeline highlights them). */
  selectedSceneId: string | null
  selectedLayerId: string | null
  canWrite: boolean
  writeTitle?: string
  /** One command per gesture (`actions.apply`). */
  apply(specs: readonly CompositionOpSpec[], options?: SparkApplyOptions): Promise<boolean>
  /** The stage's playback clock; null without the stage (no playhead, no seeking). */
  playback: TimelinePlayback | null
  /** The gateway draws scene transitions (preview plan `transitions_enabled`). */
  transitionsEnabled: boolean
  /**
   * The transition catalogue whose kinds the gateway writes now (preview plan `transitionCatalog`, manifest
   * `transition_catalog_version`): the cut picker offers those kinds. Absent = the `scene-transitions@1` kinds only.
   */
  transitionCatalog?: number
  /**
   * Timeline v3: the gateway's `scene.split` takes the relaxed rules (preview plan `relaxed_split_enabled`,
   * `COMPOSITION_RELAXED_SPLIT_ENABLED`): Split plans the relaxed split (`planSceneSplit` with `relaxed`). Absent = P02-12.
   */
  relaxedSplit?: boolean
  /**
   * The Transitions browser (`SPARK_TRANSITIONS_BROWSER_ENABLED`): a cut opens the transition picker, a card dropped on a
   * cut sets its kind, band edges set the length.
   */
  transitions?: SparkTimelineTransitions
  onSelectScene(sceneId: string): void
  onSelectLayer(sceneId: string, layerId: string): void
  /** A cut was clicked without the picker: Properties on the incoming scene's Transition section. */
  onOpenTransition(sceneId: string): void
  /** A card or files dropped where the timeline does not place them itself: the tool's own placement at a PLAY frame. */
  onToolDrop?(drop: SparkToolDrop, playFrame: number): void
  onNotice(text: string, tone: 'ok' | 'error'): void
  /**
   * The cover fit of a clip dropped on the main track (the canvas's cover helper through the stage, with the contextual
   * toolbar); absent or null keeps the compiler's own fit. Timeline v3: answered at once (`media-insert-fit.ts`).
   */
  coverTransform?: MediaInsertFitResolver
  /** Filmstrips and waveforms of the clips (agent B's delivery store; absent = none, thumbnails instead). */
  mediaPreviews?: TimelineMediaPreviews
  /** Delivery thumbnails of the clips' Storage objects (the picture while there is no filmstrip). */
  thumbnails?: OutlineThumbnails | null
  /** The name of a Storage object (an automatic chapter named after its media). */
  mediaName?: (storageObjectId: string) => string | null
  /** The Lanes toggle (controlled by the dock; absent = the timeline's own, closed). */
  lanesOpen?: boolean
  onLanesOpenChange?(open: boolean): void
  /** Toolbar "Record": opens the Record drawer (absent = no button). */
  record?: { onOpen(): void; disabled: boolean; title?: string } | null
  /** Toolbar "Script": opens the project's script (absent / null = the project has no script, no button). */
  onOpenScript?: (() => void) | null
  /** Test seam for the clipboard (Copy YouTube chapters). */
  writeClipboard?: (text: string) => Promise<void>
  /** Test seam for new ids. */
  uuid?: () => string
  /** Test seam: a first zoom (pixels per frame) in manual mode instead of "fit the whole video". */
  initialPxPerFrame?: number
}

/** Pointer travel before a press on a block becomes a drag. */
const DRAG_THRESHOLD_PX = 4
/** How long a transition band keeps a dragged length that the document has not confirmed yet. */
const BAND_SETTLE_MS = 4000
/** The zoom before the first layout measured the viewport. */
const DEFAULT_PX_PER_FRAME = 4
/** Half the transition picker's width plus a margin: it stays inside the window. */
const PICKER_HALF_WIDTH_PX = 166

type Visual = { el: HTMLElement; props: readonly string[]; classes: readonly string[] }

type Gesture =
  | { kind: 'scrub' }
  | { kind: 'press'; target: 'main' | 'overlay'; key: string; originX: number; originY: number; clickFrame: number; modifiers: boolean; active: boolean; els: HTMLElement[]; peers: HTMLElement[]; drag: MainDrag | OverlayDrag | null }
  | { kind: 'click'; target: 'band' | 'cut' | 'audio' | 'caption' | 'chapter' | 'tick'; key: string; sceneId: string | null; modifiers: boolean; originX: number; originY: number; anchor: HTMLElement | null }
  | { kind: 'main-trim'; sceneId: string; edge: TrimEdge; bounds: TrimBounds; el: HTMLElement; delta: number; followers: HTMLElement[] }
  | { kind: 'overlay-trim'; layerId: string; edge: TrimEdge; bounds: TrimBounds; el: HTMLElement; delta: number }
  | { kind: 'ramp'; layerId: string; phase: 'enter' | 'exit'; min: number; max: number; start: number; originX: number; el: HTMLElement; frames: number }
  | { kind: 'band'; sceneId: string; edge: TrimEdge; start: number; cutFrame: number; originX: number; el: HTMLElement; frames: number }
  | { kind: 'chapter-edge'; leftIndex: number; target: number | null }

type MainDrag = { kind: 'main'; sceneIds: string[]; insertIndex: number; sectionId: string | null }
type OverlayDrag = { kind: 'overlay'; layerId: string; displayStart: number; row: number }

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null)

/** A signed length change for the trim tooltip: `+0.8s` / `-0.8s`. */
const signedSeconds = (frames: number, fps: { num: number; den: number }) => `${frames < 0 ? '-' : '+'}${formatSecondsLength(Math.abs(frames), fps)}`

/**
 * Spark timeline (v2 P1-B, v3 owner feedback 2026-10-03): the CapCut-like dock behind `SPARK_TIMELINE_EDITING_ENABLED`.
 * A chapter row (YouTube chapters) over a compact gapless main track whose clips show their filmstrip and waveform, the
 * overlay ticks and a music strip; the Lanes toggle opens the overlay rows with In/Out ramps and the voice / music /
 * sound / caption lanes. Cuts carry a transition icon (picker on click) and an export-status band. Every gesture is ONE
 * command on release (`timeline-edits.ts`, `timeline-chapter-edits.ts`); while it runs the timeline writes styles directly
 * (refs + pointer events), so a drag, a trim, a scrub or playback never commits React. The zoom is the `--tl-ppf` CSS
 * variable in a mode: `fit` follows the length and the width, a manual zoom stays until Fit / Shift+Z.
 */
export function SparkTimeline(props: SparkTimelineProps) {
  const t = useTranslations('Spark.editor.timelineV2')
  const t3 = useTranslations('Spark.editor.timelineV3')
  const tEditor = useTranslations('Spark.editor')
  const { document, playback, canWrite } = props
  const model = React.useMemo(() => buildTimelineModel(document), [document])
  const [snapOn, setSnapOn] = React.useState(true)
  const [localSelection, setLocalSelection] = React.useState<{ keys: string[]; basis: string } | null>(null)
  const [lanesLocal, setLanesLocal] = React.useState(false)
  const lanesOpen = props.lanesOpen ?? lanesLocal
  const previews = props.mediaPreviews ?? NO_TIMELINE_MEDIA_PREVIEWS
  const thumbnails = props.thumbnails ?? null

  // ---------------------------------------------------------------- selection (local view state, never a command)
  const basis = `${props.selectedSceneId ?? ''}|${props.selectedLayerId ?? ''}`
  const externalKeys =
    props.selectedLayerId && model.overlayById.has(props.selectedLayerId)
      ? [`layer:${props.selectedLayerId}`]
      : props.selectedSceneId && model.mainById.has(props.selectedSceneId)
        ? [`scene:${props.selectedSceneId}`]
        : []
  const selectedKeys = localSelection && localSelection.basis === basis ? localSelection.keys : externalKeys
  const selectionString = selectedKeys.join('|')

  // What the event handlers read at call time (refreshed after every render, never read while rendering).
  const latest = React.useRef({ props, model, snapOn, lanesOpen, selection: { keys: selectedKeys, basis } })
  React.useLayoutEffect(() => {
    latest.current = { props, model, snapOn, lanesOpen, selection: { keys: selectedKeys, basis } }
  })

  const rootRef = React.useRef<HTMLElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const playheadRef = React.useRef<HTMLDivElement>(null)
  const timeRef = React.useRef<HTMLSpanElement>(null)
  const snapRef = React.useRef<HTMLDivElement>(null)
  const caretRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const zoomRef = React.useRef(props.initialPxPerFrame ?? DEFAULT_PX_PER_FRAME)
  const zoomModeRef = React.useRef<ZoomMode>(props.initialPxPerFrame !== undefined ? 'manual' : 'fit')
  const gestureRef = React.useRef<Gesture | null>(null)
  /** Ends the running gesture's window listeners (and, with `cancel`, the gesture itself). */
  const detachRef = React.useRef<{ detach: () => void; cancel: () => void } | null>(null)
  const visualsRef = React.useRef<Visual[]>([])
  const viewFrame = React.useRef<number | null>(null)

  const [view, setView] = React.useState<{ ppf: number; bucket: number; viewportPx: number; mode: ZoomMode }>(() => ({
    ppf: props.initialPxPerFrame ?? DEFAULT_PX_PER_FRAME,
    bucket: 0,
    viewportPx: 1200,
    mode: props.initialPxPerFrame !== undefined ? 'manual' : 'fit',
  }))
  const [pendingCut, setPendingCut] = React.useState<number | null>(null)
  const [menu, setMenu] = React.useState<{ x: number; y: number; sceneId: string } | null>(null)
  const [chapterMenu, setChapterMenu] = React.useState<{ x: number; y: number; chapterKey: string; cutSceneId: string | null } | null>(null)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [picker, setPicker] = React.useState<{ sceneId: string; x: number; y: number } | null>(null)

  // ---------------------------------------------------------------- chapter names
  const chapterName = useChapterNamer(props.mediaName)

  // ---------------------------------------------------------------- media previews (asked for the objects in view)
  // The fixed preview interface has no snapshot: every notification bumps a counter (a sprite, peaks or thumbnail arrived).
  const previewTick = React.useRef(0)
  const mediaVersion = React.useSyncExternalStore(
    React.useCallback(
      (listener: () => void) => {
        const stops = [
          previews.subscribe(() => {
            previewTick.current += 1
            listener()
          }),
          thumbnails ? thumbnails.subscribe(listener) : () => undefined,
        ]
        return () => stops.forEach((stop) => stop())
      },
      [previews, thumbnails],
    ),
    () => (thumbnails ? thumbnails.getVersion() : 0) + previewTick.current,
    () => 0,
  )

  // ---------------------------------------------------------------- view: zoom, scroll window, playhead (direct writes)
  const viewport = () => Math.max(1, (scrollRef.current?.clientWidth ?? 1200) - TIMELINE_HEAD_PX)
  const boundsNow = () => zoomBounds(fitZoom(latest.current.model.totalFrames, viewport(), latest.current.model.fps))

  const scheduleView = React.useCallback(() => {
    if (viewFrame.current !== null) return
    viewFrame.current = globalThis.requestAnimationFrame(() => {
      viewFrame.current = null
      const scroller = scrollRef.current
      if (!scroller) return
      const viewportPx = viewport()
      const next = { ppf: zoomRef.current, bucket: windowBucket(scroller.scrollLeft, viewportPx), viewportPx, mode: zoomModeRef.current }
      setView((current) =>
        current.ppf === next.ppf && current.bucket === next.bucket && current.viewportPx === next.viewportPx && current.mode === next.mode ? current : next,
      )
    })
  }, [])

  const positionPlayhead = React.useCallback((frame?: number) => {
    const { model: current, props: currentProps } = latest.current
    const clock = currentProps.playback
    const playFrame = frame ?? clock?.frame ?? 0
    const x = playToDisplayFrame(current, playFrame) * zoomRef.current
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${x}px)`
    if (timeRef.current) timeRef.current.textContent = formatTimelineTime(playFrame, current.fps, true)
    // Playback pages the view so the playhead stays in sight (a direct scroll, no commit unless the window moves).
    const scroller = scrollRef.current
    if (scroller && clock?.getSnapshot().playing && gestureRef.current === null) {
      const right = scroller.scrollLeft + viewport()
      if (x > right - 16 || x < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, x - 32)
    }
  }, [])

  /** Writes a zoom (the CSS variable), keeping the frame under `anchorPx` in place; a zoom at the fit is fit mode. */
  const writeZoom = React.useCallback(
    (next: number, anchorPx: number | null, mode: ZoomMode) => {
      const scroller = scrollRef.current
      const root = rootRef.current
      if (!scroller || !root) return
      const bounds = boundsNow()
      const anchor = anchorPx ?? Math.min(Math.max(0, playToDisplayFrame(latest.current.model, latest.current.props.playback?.frame ?? 0) * zoomRef.current - scroller.scrollLeft), viewport())
      const zoomed = zoomAt({ pxPerFrame: zoomRef.current, scrollLeft: scroller.scrollLeft, anchorPx: anchor, factor: next / zoomRef.current, bounds })
      zoomRef.current = zoomed.pxPerFrame
      zoomModeRef.current = mode === 'fit' || isFitZoom(zoomed.pxPerFrame, bounds) ? 'fit' : 'manual'
      root.style.setProperty('--tl-ppf', String(zoomed.pxPerFrame))
      scroller.scrollLeft = zoomModeRef.current === 'fit' ? 0 : zoomed.scrollLeft
      positionPlayhead()
      scheduleView()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `boundsNow` / `viewport` read refs only
    [positionPlayhead, scheduleView],
  )
  /** A manual zoom (slider, Ctrl+wheel, Ctrl+= / -): the mode becomes manual unless it lands on the fit. */
  const applyZoom = React.useCallback((next: number, anchorPx?: number) => writeZoom(next, anchorPx ?? null, 'manual'), [writeZoom])
  /** Fit / Shift+Z: the whole video in view, and the zoom follows the length and the width from now on. */
  const fit = React.useCallback(() => {
    const { model: current } = latest.current
    writeZoom(fitZoom(current.totalFrames, viewport(), current.fps), 0, 'fit')
  }, [writeZoom])
  /** A new length, clips or width: fit mode fits again; a manual zoom only stays inside the new range. */
  const follow = React.useCallback(() => {
    if (zoomModeRef.current === 'fit') {
      fit()
      return
    }
    const bounds = boundsNow()
    if (zoomRef.current < bounds.min) writeZoom(bounds.min, 0, 'fit')
    else scheduleView()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `boundsNow` reads refs only
  }, [fit, writeZoom, scheduleView])

  // First layout: the zoom mode applies (fit, or the test seam's manual zoom).
  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (zoomModeRef.current === 'fit') {
      const { model: current } = latest.current
      zoomRef.current = fitZoom(current.totalFrames, viewport(), current.fps)
    }
    root.style.setProperty('--tl-ppf', String(zoomRef.current))
    positionPlayhead()
    scheduleView()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  // The length or the clips changed: fit mode fits again (the owner's "5-minute video stretches far right").
  const firstModel = React.useRef(true)
  React.useLayoutEffect(() => {
    if (firstModel.current) {
      firstModel.current = false
      return
    }
    follow()
  }, [model.totalFrames, model.main.length, follow])

  React.useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return undefined
    const onScroll = () => scheduleView()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    // A new width: fit mode fits again.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => follow())
    observer?.observe(scroller)
    // Ctrl+wheel / pinch zooms at the cursor; with the lanes closed a plain wheel scrolls sideways (a native listener:
    // React's wheel listener is passive).
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const rect = scroller.getBoundingClientRect()
        const anchor = Math.max(0, event.clientX - rect.left - TIMELINE_HEAD_PX)
        applyZoom(zoomRef.current * Math.pow(ZOOM_STEP, -event.deltaY / 100), anchor)
        return
      }
      if (!latest.current.lanesOpen && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault()
        scroller.scrollLeft += event.deltaY
      }
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('wheel', onWheel)
      observer?.disconnect()
      if (viewFrame.current !== null) globalThis.cancelAnimationFrame(viewFrame.current)
      viewFrame.current = null
    }
  }, [applyZoom, scheduleView, follow])

  // The playhead and the time label follow the clock by direct writes: zero React commits per frame.
  React.useEffect(() => {
    if (!playback) return undefined
    const stopFrame = playback.subscribeFrame((frame) => positionPlayhead(frame))
    const stop = playback.subscribe(() => positionPlayhead())
    return () => {
      stopFrame()
      stop()
    }
  }, [playback, positionPlayhead])

  /** Drops the inline styles a gesture wrote (once the document shows its result, or when nothing was sent). */
  const clearVisuals = React.useCallback(() => {
    for (const visual of visualsRef.current) {
      for (const prop of visual.props) visual.el.style.removeProperty(prop)
      for (const name of visual.classes) visual.el.classList.remove(name)
    }
    visualsRef.current = []
  }, [])

  // A new model moves the playhead mapping; inline drag styles of the last gesture give way to the new layout.
  React.useLayoutEffect(() => {
    positionPlayhead()
    clearVisuals()
  }, [model, positionPlayhead, clearVisuals])

  // A gesture still running when the timeline goes away lets go of the window.
  React.useEffect(() => () => detachRef.current?.detach(), [])

  const playing = React.useSyncExternalStore(
    playback ? playback.subscribe : noSubscribe,
    () => playback?.getSnapshot().playing ?? false,
    () => false,
  )

  // The clips in view ask for their filmstrip, waveform and thumbnail (one request per change of the window or the
  // document; never per arrival, so a store that notifies while it is asked cannot loop).
  const visibleWindow = React.useMemo(() => visibleWindowFor(view.bucket, view.viewportPx, view.ppf), [view])
  React.useEffect(() => {
    const inView = model.main.filter((block) => block.endFrame >= visibleWindow.startFrame && block.startFrame <= visibleWindow.endFrame)
    const { pictures, waveforms } = mediaObjectsOf(inView)
    const music = model.music.flatMap((block) => (block.media ? [block.media.storageObjectId] : []))
    const objects = [...new Set([...pictures, ...waveforms, ...music])]
    if (objects.length > 0) previews.request(objects)
    if (thumbnails) for (const objectId of pictures) thumbnails.request(objectId)
  }, [model, visibleWindow, previews, thumbnails])

  // ---------------------------------------------------------------- helpers
  const keepVisual = (el: HTMLElement, props: readonly string[], classes: readonly string[] = []) => {
    visualsRef.current.push({ el, props, classes })
  }
  const laneX = (clientX: number) => clientX - (contentRef.current?.getBoundingClientRect().left ?? 0) - TIMELINE_HEAD_PX
  const frameAt = (clientX: number) => Math.max(0, laneX(clientX) / zoomRef.current)
  const contentY = (clientY: number) => clientY - (contentRef.current?.getBoundingClientRect().top ?? 0)
  const playheadDisplay = () => playToDisplayFrame(latest.current.model, latest.current.props.playback?.frame ?? 0)
  const setLanes = (open: boolean) => {
    latest.current.props.onLanesOpenChange?.(open)
    if (latest.current.props.lanesOpen === undefined) setLanesLocal(open)
  }

  /** Snapping (N toggles it, Alt suspends it): cuts, clip and chapter edges and the playhead within 8 px. */
  const snap = (frame: number, event: { altKey: boolean }, exclude?: ReadonlySet<number>) => {
    if (!latest.current.snapOn || event.altKey) return { frame: Math.round(frame), snappedTo: null as number | null }
    const threshold = snapThresholdFrames(zoomRef.current)
    const found = snapFrame(frame, latest.current.model.snapFrames, threshold, exclude)
    const head = playheadDisplay()
    if (!exclude?.has(head) && Math.abs(head - frame) <= threshold && (found.snappedTo === null || Math.abs(head - frame) < Math.abs(found.frame - frame))) {
      return { frame: head, snappedTo: head }
    }
    return { frame: found.snappedTo === null ? Math.round(frame) : found.frame, snappedTo: found.snappedTo }
  }

  const showLine = (el: HTMLElement | null, frame: number | null, row?: { top: number; height: number }) => {
    if (!el) return
    if (frame === null) {
      el.hidden = true
      return
    }
    el.hidden = false
    el.style.transform = `translateX(${frame * zoomRef.current}px)`
    if (row) {
      el.style.top = `${row.top}px`
      el.style.height = `${row.height}px`
    }
  }
  const showTip = (frame: number | null, text = '') => {
    const el = tipRef.current
    if (!el) return
    if (frame === null) {
      el.hidden = true
      return
    }
    el.hidden = false
    el.textContent = text
    el.style.transform = `translateX(${frame * zoomRef.current + 6}px)`
  }
  const rowBox = (selector: string) => {
    const row = contentRef.current?.querySelector<HTMLElement>(selector)
    return row ? { top: row.offsetTop, height: row.offsetHeight } : { top: 0, height: TIMELINE_ROWS.main }
  }
  const seekDisplay = (displayFrame: number) => {
    const clock = latest.current.props.playback
    if (!clock) return
    clock.seek(displayToPlayFrame(latest.current.model, Math.round(displayFrame)))
  }

  const notifyRefusal = (plan: TimelinePlan) => {
    if (!plan.ok && plan.reason !== 'nothing') latest.current.props.onNotice(t(`refusals.${plan.reason}`), 'error')
  }
  /** Sends a plan as ONE command; a refusal says why. Resolves whether the command applied. */
  const run = (plan: TimelinePlan, options?: SparkApplyOptions): Promise<boolean> => {
    if (!plan.ok) {
      notifyRefusal(plan)
      return Promise.resolve(false)
    }
    return latest.current.props.apply(plan.specs, options).then((applied) => {
      if (!applied) clearVisuals()
      return applied
    })
  }
  /** Sends a chapter plan as ONE command; a refusal other than "nothing" says why. */
  const runChapter = (plan: ChapterPlan): Promise<boolean> => {
    if (!plan.ok) {
      if (plan.reason !== 'nothing') latest.current.props.onNotice(t3(`chapters.refusals.${plan.reason}`), 'error')
      return Promise.resolve(false)
    }
    return latest.current.props.apply(plan.specs)
  }
  /** A callback for `onOptimistic` and `onApplied` that runs only once (whichever comes first). */
  const once = (callback: () => void) => {
    let done = false
    return () => {
      if (done) return
      done = true
      callback()
    }
  }

  // ---------------------------------------------------------------- commands of the toolbar and the keyboard
  /** Split (S / Ctrl+B / toolbar): the RIGHT piece becomes the selection, the playhead stays. */
  const split = () => {
    const { model: current, props: currentProps } = latest.current
    if (!currentProps.canWrite) return
    const frame = playheadDisplay()
    const keys = latest.current.selection.keys
    const layerKey = keys.length === 1 && keys[0]!.startsWith('layer:') ? splitKey(keys[0]!)[1] : null
    const plan = planSplit(currentProps.document, current, {
      frame,
      selectedLayerId: layerKey,
      ...(currentProps.uuid && { uuid: currentProps.uuid }),
      ...(currentProps.relaxedSplit === true && { relaxed: true }),
    })
    const sceneSplit = plan.ok ? plan.specs.find((spec) => spec.op['op'] === 'scene.split')?.op : undefined
    const clipSplit = plan.ok ? plan.specs.find((spec) => spec.op['op'] === 'clip.split')?.op : undefined
    const selectRight = once(() => {
      const now = latest.current.props
      if (sceneSplit) now.onSelectScene(sceneSplit['new_scene_id'] as string)
      else if (clipSplit) now.onSelectLayer(clipSplit['scene_id'] as string, clipSplit['new_layer_id'] as string)
    })
    if (sceneSplit) setPendingCut(frame)
    void run(plan, { onOptimistic: selectRight, onApplied: selectRight }).finally(() => {
      if (sceneSplit) setPendingCut(null)
    })
  }
  /**
   * Delete: a main clip ripples (the clips after it close up); the playhead goes to where the next piece now starts and that
   * piece is selected (split, split, click the middle, Delete).
   */
  const remove = () => {
    const { model: current, props: currentProps } = latest.current
    const keys = latest.current.selection.keys
    if (!currentProps.canWrite || keys.length === 0) return
    const removed = current.main.filter((block) => keys.includes(block.key))
    const first = removed[0]
    const lastIndex = removed.length > 0 ? removed[removed.length - 1]!.index : -1
    const next = first ? (current.main.slice(lastIndex + 1).find((block) => !keys.includes(block.key)) ?? current.main.slice(0, first.index).reverse().find((block) => !keys.includes(block.key))) : undefined
    const after = once(() => {
      if (!first) return
      const now = latest.current.props
      now.playback?.seek(first.playStartFrame)
      if (next) now.onSelectScene(next.sceneId)
    })
    void run(planDelete(currentProps.document, current, keys), first ? { onOptimistic: after, onApplied: after } : undefined).then((applied) => {
      if (applied) setLocalSelection(null)
    })
  }
  const trimToPlayhead = (edge: TrimEdge) => {
    const { model: current, props: currentProps } = latest.current
    if (!currentProps.canWrite) return
    void run(planTrimToPlayhead(currentProps.document, current, { frame: playheadDisplay(), edge }))
  }
  const jumpCut = (direction: -1 | 1) => {
    const { model: current } = latest.current
    const head = playheadDisplay()
    const edges = [0, ...current.cuts.map((cut) => cut.frame), Math.max(0, current.totalFrames - 1)]
    const target = direction < 0 ? [...edges].reverse().find((edge) => edge < head) : edges.find((edge) => edge > head)
    if (target !== undefined) seekDisplay(target)
  }
  const second = () => Math.max(1, Math.round(latest.current.model.rate))

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (isTyping(event.target)) return
    // A focused toolbar button keeps its own Space / Enter.
    if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLElement && event.target.closest('button')) return
    const clock = latest.current.props.playback
    const mod = event.ctrlKey || event.metaKey
    const key = event.key
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    if (mod && (key === '=' || key === '+')) {
      handled()
      applyZoom(zoomRef.current * ZOOM_STEP)
      return
    }
    if (mod && key === '-') {
      handled()
      applyZoom(zoomRef.current / ZOOM_STEP)
      return
    }
    if (mod && key === '0') {
      handled()
      fit()
      return
    }
    if (mod && key.toLowerCase() === 'b') {
      handled()
      split()
      return
    }
    if (mod || event.altKey) return
    switch (key) {
      case ' ':
        handled()
        clock?.toggle()
        return
      case 'Home':
        handled()
        clock?.seek(0)
        return
      case 'End':
        handled()
        if (clock) clock.seek(clock.getSnapshot().totalFrames - 1)
        return
      case ',':
      case '.':
      case 'ArrowLeft':
      case 'ArrowRight': {
        handled()
        const back = key === ',' || key === 'ArrowLeft'
        clock?.step((back ? -1 : 1) * (event.shiftKey ? second() : 1))
        return
      }
      case 'ArrowUp':
      case 'ArrowDown':
        handled()
        jumpCut(key === 'ArrowUp' ? -1 : 1)
        return
      case 'Delete':
      case 'Backspace':
        handled()
        remove()
        return
      case 'Escape':
        handled()
        if (detachRef.current) {
          // Escape cancels a running drag or trim: nothing is sent.
          detachRef.current.cancel()
          clearVisuals()
          return
        }
        setLocalSelection(null)
        setMenu(null)
        setChapterMenu(null)
        if (latest.current.props.selectedLayerId && latest.current.props.selectedSceneId) latest.current.props.onSelectScene(latest.current.props.selectedSceneId)
        return
      default:
        break
    }
    const lower = key.toLowerCase()
    if (lower === 'z' && event.shiftKey) {
      handled()
      fit()
    } else if (event.shiftKey) {
      return
    } else if (lower === 's') {
      handled()
      split()
    } else if (lower === 'q') {
      handled()
      trimToPlayhead('start')
    } else if (lower === 'w') {
      handled()
      trimToPlayhead('end')
    } else if (lower === 'n') {
      handled()
      setSnapOn((on) => !on)
    }
  }

  // ---------------------------------------------------------------- selection clicks
  const toggleKey = (key: string) => {
    const current = latest.current.selection
    const keys = current.keys.includes(key) ? current.keys.filter((candidate) => candidate !== key) : [...current.keys, key]
    setLocalSelection({ keys, basis: current.basis })
  }
  /** Selects an overlay (the playhead moves only when it is outside the overlay). */
  const selectOverlay = (layerId: string, clickFrame: number) => {
    const { model: current, props: currentProps } = latest.current
    const block = current.overlayById.get(layerId)
    if (!block) return
    const head = playheadDisplay()
    if (head < block.startFrame || head >= block.endFrame) seekDisplay(Math.min(Math.max(clickFrame, block.startFrame), block.endFrame - 1))
    currentProps.onSelectLayer(block.sceneId, block.layerId)
  }
  const clickBlock = (gesture: Extract<Gesture, { kind: 'press' }>) => {
    const { model: current, props: currentProps } = latest.current
    if (gesture.modifiers) {
      toggleKey(gesture.key)
      return
    }
    setLocalSelection(null)
    const [kind, id] = splitKey(gesture.key)
    if (kind === 'scene') {
      // The playhead moves only when it is outside the clip (seek first: the selection then finds it inside).
      const block = current.mainById.get(id)
      const head = playheadDisplay()
      if (!block || head < block.startFrame || head >= block.endFrame) seekDisplay(gesture.clickFrame)
      currentProps.onSelectScene(id)
      return
    }
    selectOverlay(id, gesture.clickFrame)
  }
  /** Opens the transition picker at a cut (or, without it, the scene's Transition properties). */
  const openCut = (sceneId: string, anchor: HTMLElement | null) => {
    const { props: currentProps } = latest.current
    if (currentProps.transitions?.onSet && currentProps.transitions.canWrite && currentProps.canWrite) {
      // Above the icon, kept inside the window (the picker is about 312 px wide).
      const rect = anchor?.getBoundingClientRect()
      const centre = rect ? rect.left + rect.width / 2 : 0
      const width = globalThis.innerWidth || 0
      const x = width > 0 ? Math.min(Math.max(centre, PICKER_HALF_WIDTH_PX), Math.max(PICKER_HALF_WIDTH_PX, width - PICKER_HALF_WIDTH_PX)) : centre
      setPicker({ sceneId, x, y: rect ? rect.top : 0 })
      return
    }
    currentProps.onOpenTransition(sceneId)
  }
  const clickOther = (gesture: Extract<Gesture, { kind: 'click' }>) => {
    const { model: current, props: currentProps } = latest.current
    switch (gesture.target) {
      case 'band':
      case 'cut':
        if (gesture.sceneId) openCut(gesture.sceneId, gesture.anchor)
        return
      case 'chapter': {
        // Jump to the chapter and select its first scene.
        const block = gesture.sceneId ? current.mainById.get(gesture.sceneId) : undefined
        if (!block) return
        setLocalSelection(null)
        seekDisplay(block.startFrame)
        currentProps.onSelectScene(block.sceneId)
        return
      }
      case 'tick': {
        // An overlay tick opens the lanes and selects the overlay.
        const [, layerId] = splitKey(gesture.key)
        setLanes(true)
        setLocalSelection(null)
        const block = current.overlayById.get(layerId)
        if (block) selectOverlay(layerId, block.startFrame)
        return
      }
      default:
        if (gesture.modifiers) toggleKey(gesture.key)
        else setLocalSelection({ keys: [gesture.key], basis: latest.current.selection.basis })
    }
  }

  // ---------------------------------------------------------------- chapter commands (one command each)
  const chapterOptions = () => ({ name: chapterName, ...(latest.current.props.uuid && { uuid: latest.current.props.uuid }) })
  const renameChapter = React.useCallback(
    (chapterKey: string, value: string) => {
      setRenaming(null)
      const { model: current, props: currentProps } = latest.current
      if (!currentProps.canWrite) return
      void runChapter(planRenameChapter(currentProps.document, current, { chapterKey, title: value }, chapterOptions()))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads `latest` at call time
    [chapterName],
  )
  const cancelRename = React.useCallback(() => setRenaming(null), [])
  const copyYoutubeChapters = () => {
    const { model: current, props: currentProps } = latest.current
    const list = youtubeChapters(current, chapterName)
    const write = currentProps.writeClipboard ?? ((text: string) => globalThis.navigator.clipboard.writeText(text))
    let writing: Promise<void>
    try {
      writing = write(list.text)
    } catch (error) {
      writing = Promise.reject(error)
    }
    void writing.then(
      () => {
        const notes = [t3('chapters.copied', { count: current.chapters.length })]
        if (list.short.length > 0) notes.push(t3('chapters.shortWarning', { names: list.short.join(', ') }))
        if (list.tooFew) notes.push(t3('chapters.tooFewWarning'))
        latest.current.props.onNotice(notes.join(' '), list.short.length > 0 || list.tooFew ? 'error' : 'ok')
      },
      () => latest.current.props.onNotice(t3('chapters.copyFailed'), 'error'),
    )
  }
  const pickChapterItem = (item: ChapterMenuItem) => {
    const target = chapterMenu
    setChapterMenu(null)
    if (!target) return
    const { model: current, props: currentProps } = latest.current
    const options = chapterOptions()
    switch (item) {
      case 'rename':
        setRenaming(target.chapterKey)
        return
      case 'makeChapters':
        void runChapter(planMakeChapters(currentProps.document, current, options))
        return
      case 'startAtCut':
        if (target.cutSceneId) void runChapter(planStartChapterAt(currentProps.document, current, { sceneId: target.cutSceneId, title: t3('chapters.newTitle') }, options))
        return
      case 'mergeNext':
        void runChapter(planMergeChapterWithNext(currentProps.document, current, { chapterKey: target.chapterKey }, options))
        return
      case 'delete':
        void runChapter(planDeleteChapter(currentProps.document, current, { chapterKey: target.chapterKey }, options))
        return
      case 'copyYoutube':
        copyYoutubeChapters()
        return
    }
  }

  // ---------------------------------------------------------------- pointer gestures
  const endGesture = () => {
    gestureRef.current = null
    detachRef.current?.detach()
    showLine(snapRef.current, null)
    showLine(caretRef.current, null)
    showTip(null)
  }

  const overlayRowCount = Math.max(1, model.overlayRowCount)
  const rowAt = (clientY: number): number => {
    const box = rowBox('.tl2-row.overlay')
    const rows = latest.current.model.overlayRowCount
    const rendered = Math.max(1, rows)
    const y = contentY(clientY)
    if (y < box.top) return rendered
    const index = Math.floor((y - box.top) / TIMELINE_ROWS.overlay)
    return Math.min(Math.max(0, rendered - 1 - index), rendered)
  }
  const rowTop = (row: number): number => {
    const box = rowBox('.tl2-row.overlay')
    const rendered = Math.max(1, latest.current.model.overlayRowCount)
    return box.top + (rendered - 1 - row) * TIMELINE_ROWS.overlay
  }
  /** The whole height of the lanes under the ruler (the caret of a chapter edge). */
  const lanesBox = () => {
    const chapters = rowBox('.tl2-row.chapters')
    const content = contentRef.current
    return { top: chapters.top, height: Math.max(chapters.height, (content?.scrollHeight ?? 0) - chapters.top) }
  }

  const moveGesture = (gesture: Gesture, event: PointerEvent) => {
    const { model: current, props: currentProps } = latest.current
    const ppf = zoomRef.current
    switch (gesture.kind) {
      case 'scrub':
        seekDisplay(frameAt(event.clientX))
        return
      case 'click':
        return
      case 'press': {
        const dx = event.clientX - gesture.originX
        const dy = event.clientY - gesture.originY
        if (!gesture.drag) return
        if (!gesture.active) {
          if (!currentProps.canWrite || (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX)) return
          gesture.active = true
          for (const el of gesture.els) {
            el.classList.add('dragging')
            keepVisual(el, ['transform'], ['dragging'])
          }
          // The other clips of the main track slide aside while a piece is dragged (CapCut-like live reorder).
          if (gesture.target === 'main') {
            gesture.peers = [...(contentRef.current?.querySelectorAll<HTMLElement>('.tl2-row.main .tl2-blk.main') ?? [])].filter((el) => !gesture.els.includes(el))
            for (const el of gesture.peers) keepVisual(el, ['transform', 'transition'])
          }
        }
        if (gesture.target === 'main') {
          const frame = frameAt(event.clientX)
          const movedIds = new Set((gesture.drag as MainDrag).sceneIds)
          const moved = current.main.filter((block) => movedIds.has(block.sceneId))
          const rest = current.main.filter((block) => !movedIds.has(block.sceneId))
          // The drop slot follows the CENTRE of the dragged piece(s): it passes a neighbour as soon as the centre crosses that
          // neighbour's midpoint (not the pointer's nearest cut, which put a short drag back where it started).
          const centre = moved.length > 0 ? (moved[0]!.startFrame + moved[moved.length - 1]!.endFrame) / 2 + dx / ppf : frame
          const slot = rest.filter((block) => (block.startFrame + block.endFrame) / 2 < centre).length
          const insertIndex = slot < rest.length ? rest[slot]!.index : current.main.length
          const reordered = [...rest.slice(0, slot), ...moved, ...rest.slice(slot)]
          let cursor = current.main[0]?.startFrame ?? 0
          const shifts = new Map<string, number>()
          for (const block of reordered) {
            shifts.set(block.sceneId, cursor - block.startFrame)
            cursor += block.lengthFrames
          }
          for (const el of gesture.peers) {
            const shift = (shifts.get(splitKey(el.dataset['key'] ?? '')[1]) ?? 0) * ppf
            el.style.transition = 'transform .12s ease-out'
            el.style.transform = shift === 0 ? '' : `translateX(${shift}px)`
          }
          const caret = insertIndex >= current.main.length ? current.totalFrames : current.main[insertIndex]!.startFrame
          const sectionId = mainDropSection(current, insertIndex, frame < caret ? 'left' : 'right')
          gesture.drag = { kind: 'main', sceneIds: (gesture.drag as MainDrag).sceneIds, insertIndex, sectionId }
          for (const el of gesture.els) el.style.transform = `translateX(${dx}px)`
          showLine(caretRef.current, caret, rowBox('.tl2-row.main'))
          return
        }
        const drag = gesture.drag as OverlayDrag
        const block = current.overlayById.get(drag.layerId)
        if (!block) return
        const length = block.endFrame - block.startFrame
        const snapped = latest.current.snapOn && !event.altKey
          ? snapRange(block.startFrame + dx / ppf, length, current.snapFrames, snapThresholdFrames(ppf), new Set([block.startFrame, block.endFrame]))
          : { start: Math.round(block.startFrame + dx / ppf), snappedTo: null }
        const target = resolveOverlayMove(current, block, snapped.start)
        const display = current.mainById.get(target.sceneId)!.startFrame + target.localStart
        const row = target.crossesScene ? block.row : rowAt(event.clientY)
        gesture.drag = { kind: 'overlay', layerId: block.layerId, displayStart: snapped.start, row }
        const shownRow = Math.min(row, Math.max(1, current.overlayRowCount))
        gesture.els[0]!.style.transform = `translate(${(display - block.startFrame) * ppf}px, ${rowTop(shownRow) - rowTop(block.row)}px)`
        showLine(snapRef.current, snapped.snappedTo)
        return
      }
      case 'main-trim':
      case 'overlay-trim': {
        const isMain = gesture.kind === 'main-trim'
        const block = isMain ? current.mainById.get(gesture.sceneId) : current.overlayById.get(gesture.layerId)
        if (!block) return
        const start = block.startFrame
        const end = isMain ? (block as TimelineModel['main'][number]).endFrame : block.endFrame
        const edgeFrame = gesture.edge === 'start' ? start : end
        const snapped = snap(frameAt(event.clientX), event, new Set([edgeFrame]))
        const delta = Math.min(gesture.bounds.maxDelta, Math.max(gesture.bounds.minDelta, snapped.frame - edgeFrame))
        gesture.delta = delta
        const newStart = gesture.edge === 'start' ? start + delta : start
        const newEnd = gesture.edge === 'end' ? end + delta : end
        gesture.el.style.left = `${newStart * ppf}px`
        gesture.el.style.width = `${Math.max(1, newEnd - newStart) * ppf}px`
        // The main track is magnetic: the clips after a trimmed one slide with it while it is dragged.
        if (gesture.kind === 'main-trim') {
          const shift = (gesture.edge === 'end' ? delta : -delta) * ppf
          for (const follower of gesture.followers) follower.style.transform = shift === 0 ? '' : `translateX(${shift}px)`
        }
        showLine(snapRef.current, snapped.snappedTo !== null && snapped.frame === edgeFrame + delta ? snapped.snappedTo : null)
        const lengthChange = newEnd - newStart - (end - start)
        showTip(gesture.edge === 'start' ? newStart : newEnd, `${formatSecondsLength(newEnd - newStart, current.fps)} (${signedSeconds(lengthChange, current.fps)})`)
        // The stage shows the frame at the moving edge (inside what the scene holds now).
        const edgeInside = gesture.edge === 'start' ? Math.min(Math.max(newStart, start), end - 1) : Math.min(Math.max(newEnd - 1, start), end - 1)
        seekDisplay(edgeInside)
        return
      }
      case 'ramp': {
        const dx = (event.clientX - gesture.originX) / ppf
        const frames = Math.round(Math.min(gesture.max, Math.max(gesture.min, gesture.start + (gesture.phase === 'enter' ? dx : -dx))))
        gesture.frames = frames
        gesture.el.style.width = `${frames * ppf}px`
        const block = current.overlayById.get(gesture.layerId)
        if (block) showTip(gesture.phase === 'enter' ? block.startFrame + frames : block.endFrame - frames, formatSecondsLength(frames, current.fps))
        return
      }
      case 'band': {
        const dx = (event.clientX - gesture.originX) / ppf
        const frames = Math.round(Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, gesture.start + 2 * (gesture.edge === 'end' ? dx : -dx))))
        gesture.frames = frames
        const start = gesture.cutFrame - Math.floor(frames / 2)
        gesture.el.style.left = `${start * ppf}px`
        gesture.el.style.width = `${frames * ppf}px`
        showTip(start + frames, formatSecondsLength(frames, current.fps))
        return
      }
      case 'chapter-edge': {
        const left = current.chapters[gesture.leftIndex]
        const right = current.chapters[gesture.leftIndex + 1]
        if (!left || !right) return
        // The edge snaps to the cuts between the first scene of the left chapter and the last of the right one.
        const first = current.mainById.get(left.sceneIds[0]!)!.index
        const last = current.mainById.get(right.sceneIds[right.sceneIds.length - 1]!)!.index
        const target = Math.min(Math.max(chapterEdgeTarget(current, frameAt(event.clientX)), first + 1), last)
        gesture.target = target
        showLine(caretRef.current, current.main[target]!.startFrame, lanesBox())
        return
      }
    }
  }

  const finishGesture = (gesture: Gesture, event: PointerEvent | null) => {
    endGesture()
    const { model: current, props: currentProps } = latest.current
    const cancelled = event === null
    switch (gesture.kind) {
      case 'scrub':
        return
      case 'click': {
        if (cancelled || !event) return
        if (Math.abs(event.clientX - gesture.originX) >= DRAG_THRESHOLD_PX || Math.abs(event.clientY - gesture.originY) >= DRAG_THRESHOLD_PX) return
        clickOther(gesture)
        return
      }
      case 'press': {
        if (!gesture.active) {
          if (!cancelled) clickBlock(gesture)
          return
        }
        if (cancelled || !gesture.drag) {
          clearVisuals()
          return
        }
        if (gesture.drag.kind === 'main') {
          const plan = planMainReorder(current, { sceneIds: gesture.drag.sceneIds, insertIndex: gesture.drag.insertIndex, sectionId: gesture.drag.sectionId })
          if (!plan.ok) clearVisuals()
          void run(plan)
          return
        }
        const block = current.overlayById.get(gesture.drag.layerId)
        const plan = planOverlayMove(currentProps.document, current, {
          layerId: gesture.drag.layerId,
          displayStart: gesture.drag.displayStart,
          ...(block && gesture.drag.row !== block.row && { row: gesture.drag.row }),
        })
        if (!plan.ok) clearVisuals()
        void run(plan)
        return
      }
      case 'main-trim':
      case 'overlay-trim': {
        if (cancelled || gesture.delta === 0) {
          clearVisuals()
          // A press and release on a clip's edge handle (no drag) at a seam is a click on the cut: the transition picker opens
          // there (the handle sits on top of the seam's icon, and a click on "the thing in the middle" must reach the effects).
          if (!cancelled && gesture.kind === 'main-trim' && latest.current.props.transitionsEnabled) {
            const seam = gesture.edge === 'start' ? gesture.sceneId : current.main[(current.mainById.get(gesture.sceneId)?.index ?? -1) + 1]?.sceneId
            const cut = seam ? current.cuts.find((candidate) => candidate.sceneId === seam) : undefined
            if (cut && cut.resolved) {
              const anchor = contentRef.current?.querySelector<HTMLElement>(`[data-gesture="cut"][data-scene="${cut.sceneId}"]`) ?? gesture.el
              openCut(cut.sceneId, anchor)
            }
          }
          return
        }
        const plan = gesture.kind === 'main-trim'
          ? planMainTrim(currentProps.document, current, { sceneId: gesture.sceneId, edge: gesture.edge, delta: gesture.delta })
          : planOverlayTrim(currentProps.document, current, { layerId: gesture.layerId, edge: gesture.edge, delta: gesture.delta })
        if (!plan.ok) clearVisuals()
        void run(plan)
        return
      }
      case 'ramp': {
        if (cancelled || gesture.frames === gesture.start) {
          clearVisuals()
          return
        }
        const plan = planRampChange(currentProps.document, current, { layerId: gesture.layerId, phase: gesture.phase, frames: gesture.frames })
        if (!plan.ok) clearVisuals()
        void run(plan)
        return
      }
      case 'band': {
        if (cancelled || gesture.frames === gesture.start) {
          clearVisuals()
          return
        }
        currentProps.transitions?.onLength(gesture.sceneId, gesture.frames)
        // The band keeps its new length until the document carries it (server first); if nothing comes, it lets go.
        const band = gesture.el
        globalThis.setTimeout(() => {
          if (!visualsRef.current.some((visual) => visual.el === band)) return
          band.style.removeProperty('left')
          band.style.removeProperty('width')
          visualsRef.current = visualsRef.current.filter((visual) => visual.el !== band)
        }, BAND_SETTLE_MS)
        return
      }
      case 'chapter-edge': {
        if (cancelled || gesture.target === null) return
        void runChapter(planMoveChapterEdge(currentProps.document, current, { leftIndex: gesture.leftIndex, sceneIndex: gesture.target }, chapterOptions()))
        return
      }
    }
  }

  /** Starts a gesture: window listeners until the pointer is released (or the gesture is cancelled). */
  const beginGesture = (gesture: Gesture) => {
    detachRef.current?.detach()
    gestureRef.current = gesture
    const move = (event: PointerEvent) => moveGesture(gesture, event)
    const up = (event: PointerEvent) => finishGesture(gesture, event)
    const cancel = () => finishGesture(gesture, null)
    const detach = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      if (detachRef.current?.detach === detach) detachRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    detachRef.current = { detach, cancel }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gestureRef.current || isTyping(event.target)) return
    rootRef.current?.focus({ preventScroll: true })
    setMenu(null)
    setChapterMenu(null)
    const target = event.target as HTMLElement
    // The empty part of a lane scrubs like the ruler.
    const gestureEl = target.closest<HTMLElement>('[data-gesture]') ?? (target.closest('.tl2-lane') ? contentRef.current?.querySelector<HTMLElement>('.tl2-row.ruler .tl2-lane') : null)
    if (!gestureEl) return
    const kind = gestureEl.dataset['gesture']
    const keyEl = gestureEl.closest<HTMLElement>('[data-key]')
    const key = keyEl?.dataset['key'] ?? ''
    const [keyKind, id] = splitKey(key)
    const { model: current, props: currentProps } = latest.current
    const modifiers = event.ctrlKey || event.metaKey || event.shiftKey
    const writable = currentProps.canWrite
    event.preventDefault()
    switch (kind) {
      case 'scrub':
        if (!currentProps.playback) return
        currentProps.playback.pause()
        seekDisplay(frameAt(event.clientX))
        beginGesture({ kind: 'scrub' })
        return
      case 'main':
      case 'overlay': {
        if (!keyEl) return
        let els = [keyEl]
        let drag: MainDrag | OverlayDrag | null = null
        if (kind === 'main') {
          // A press on a block of a multi-selection drags the selected main blocks together.
          const group = latest.current.selection.keys.includes(key) ? latest.current.selection.keys.filter((candidate) => candidate.startsWith('scene:')) : [key]
          const sceneIds = group.map((candidate) => splitKey(candidate)[1])
          els = sceneIds.flatMap((sceneId) => {
            // Scene ids are opaque ids (`[A-Za-z0-9._:-]`), safe inside a quoted attribute selector.
            const el = contentRef.current?.querySelector<HTMLElement>(`[data-key="scene:${sceneId}"]`)
            return el ? [el] : []
          })
          drag = { kind: 'main', sceneIds, insertIndex: -1, sectionId: null }
        } else {
          const block = current.overlayById.get(id)
          if (!block || !block.movable) drag = null
          else drag = { kind: 'overlay', layerId: id, displayStart: block.startFrame, row: block.row }
        }
        beginGesture({
          kind: 'press',
          target: kind,
          key,
          originX: event.clientX,
          originY: event.clientY,
          clickFrame: Math.round(frameAt(event.clientX)),
          modifiers,
          active: false,
          els,
          peers: [],
          // A block that cannot move (read only, a placeholder) still selects on release.
          drag: writable ? drag : null,
        })
        return
      }
      case 'trim-start':
      case 'trim-end': {
        if (!writable || !keyEl) return
        const edge: TrimEdge = kind === 'trim-start' ? 'start' : 'end'
        const bounds = keyKind === 'scene' ? mainTrimBounds(current, id, edge) : overlayTrimBounds(current, id, edge)
        if (!bounds) return
        currentProps.playback?.pause()
        keyEl.classList.add('trimming')
        keepVisual(keyEl, ['left', 'width'], ['trimming'])
        if (keyKind === 'scene') {
          const block = current.mainById.get(id)
          const followers = block
            ? [...(contentRef.current?.querySelectorAll<HTMLElement>('.tl2-row.main [data-at]') ?? [])].filter((el) => el !== keyEl && Number(el.dataset['at']) >= block.endFrame)
            : []
          for (const follower of followers) keepVisual(follower, ['transform'])
          beginGesture({ kind: 'main-trim', sceneId: id, edge, bounds, el: keyEl, delta: 0, followers })
        } else {
          beginGesture({ kind: 'overlay-trim', layerId: id, edge, bounds, el: keyEl, delta: 0 })
        }
        return
      }
      case 'ramp-in':
      case 'ramp-out': {
        const ramp = gestureEl.parentElement
        if (!writable || !ramp) return
        const phase = kind === 'ramp-in' ? 'enter' : 'exit'
        const bounds = rampBounds(current, id, phase)
        const block = current.overlayById.get(id)
        const startFrames = phase === 'enter' ? block?.enterFrames : block?.exitFrames
        if (!bounds || startFrames == null) return
        keepVisual(ramp, ['width'])
        beginGesture({ kind: 'ramp', layerId: id, phase, min: bounds.min, max: bounds.max, start: startFrames, originX: event.clientX, el: ramp, frames: startFrames })
        return
      }
      case 'band-start':
      case 'band-end': {
        const band = gestureEl.closest<HTMLElement>('.tl2-band')
        const sceneId = band?.dataset['scene']
        const cut = sceneId ? current.cuts.find((candidate) => candidate.sceneId === sceneId) : undefined
        if (!band || !cut?.transition || !writable || !currentProps.transitions?.canWrite) return
        keepVisual(band, ['left', 'width'])
        beginGesture({ kind: 'band', sceneId: cut.sceneId, edge: kind === 'band-start' ? 'start' : 'end', start: cut.transition.duration_frames, cutFrame: cut.frame, originX: event.clientX, el: band, frames: cut.transition.duration_frames })
        return
      }
      case 'chapter-edge': {
        const leftIndex = Number(gestureEl.dataset['left'])
        if (!writable || !Number.isInteger(leftIndex)) return
        beginGesture({ kind: 'chapter-edge', leftIndex, target: null })
        return
      }
      case 'band':
      case 'cut':
      case 'audio':
      case 'caption':
      case 'chapter':
      case 'tick':
        beginGesture({
          kind: 'click',
          target: kind,
          key: gestureEl.dataset['key'] ?? key,
          sceneId: gestureEl.dataset['scene'] ?? null,
          modifiers,
          originX: event.clientX,
          originY: event.clientY,
          anchor: gestureEl,
        })
        return
      default:
        return
    }
  }

  // A cut's button activated from the keyboard (Enter / Space give a click without a pointer press).
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.detail !== 0) return
    const cut = (event.target as HTMLElement).closest<HTMLElement>('[data-gesture="cut"]')
    if (!cut) return
    clickOther({ kind: 'click', target: 'cut', key: cut.dataset['key'] ?? '', sceneId: cut.dataset['scene'] ?? null, modifiers: false, originX: 0, originY: 0, anchor: cut })
  }

  // Double-click on a chapter renames it in place.
  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const chapter = (event.target as HTMLElement).closest<HTMLElement>('[data-gesture="chapter"]')
    if (!chapter || !latest.current.props.canWrite || isTyping(event.target)) return
    event.preventDefault()
    setRenaming(chapter.dataset['chapter'] ?? null)
  }

  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const chapterEl = target.closest<HTMLElement>('[data-gesture="chapter"]')
    if (chapterEl) {
      event.preventDefault()
      const { model: current } = latest.current
      const chapter = current.chapters.find((candidate) => candidate.key === chapterEl.dataset['chapter'])
      if (!chapter) return
      // "This cut": the cut inside the chapter nearest to the pointer.
      const frame = frameAt(event.clientX)
      let cutSceneId: string | null = null
      let distance = Number.POSITIVE_INFINITY
      for (const sceneId of chapter.sceneIds.slice(1)) {
        const block = current.mainById.get(sceneId)
        if (block && Math.abs(block.startFrame - frame) < distance) {
          distance = Math.abs(block.startFrame - frame)
          cutSceneId = sceneId
        }
      }
      setMenu(null)
      setChapterMenu({ x: event.clientX, y: event.clientY, chapterKey: chapter.key, cutSceneId })
      return
    }
    const keyEl = target.closest<HTMLElement>('[data-key^="scene:"]')
    if (!keyEl) return
    event.preventDefault()
    setChapterMenu(null)
    setMenu({ x: event.clientX, y: event.clientY, sceneId: splitKey(keyEl.dataset['key'] ?? '')[1] })
  }
  React.useEffect(() => {
    if (!menu && !chapterMenu) return undefined
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.tl2-menu')) {
        setMenu(null)
        setChapterMenu(null)
      }
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu, chapterMenu])

  // ---------------------------------------------------------------- drops from the drawers
  const laneOf = (target: EventTarget | null) => (target instanceof Element ? (target.closest<HTMLElement>('[data-lane]')?.dataset['lane'] ?? null) : null)
  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!latest.current.props.canWrite || !acceptsToolDrop(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    const current = latest.current.model
    const frame = frameAt(event.clientX)
    if (laneOf(event.target) === 'main') {
      const index = mainDropIndex(current, frame)
      showLine(caretRef.current, index >= current.main.length ? current.totalFrames : current.main[index]!.startFrame, rowBox('.tl2-row.main'))
      showLine(snapRef.current, null)
    } else {
      showLine(caretRef.current, null)
      showLine(snapRef.current, snap(frame, event).frame)
    }
  }
  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    showLine(caretRef.current, null)
    showLine(snapRef.current, null)
  }
  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    showLine(caretRef.current, null)
    showLine(snapRef.current, null)
    const { model: current, props: currentProps } = latest.current
    if (!currentProps.canWrite || !acceptsToolDrop(event.dataTransfer)) return
    const drop = readToolDrop(event.dataTransfer)
    if (!drop) return
    event.preventDefault()
    event.stopPropagation()
    const lane = laneOf(event.target)
    const rawFrame = frameAt(event.clientX)
    // A Transitions card lands on the nearest cut.
    if (drop.kind === 'card' && drop.drag.tool === 'transitions') {
      const kind = drop.drag.data['kind']
      const cut = nearestCut(current, rawFrame)
      if (cut && currentProps.transitions?.canWrite && typeof kind === 'string' && (TRANSITION_KINDS as readonly string[]).includes(kind)) {
        currentProps.transitions.onDropKind(cut.sceneId, kind as TransitionKind)
      }
      return
    }
    const media = mediaOfDrop(currentProps.document, drop)
    if (lane === 'main' && media) {
      if (media === 'not_attached') {
        currentProps.onNotice(t('notices.dropNeedsAttach'), 'error')
        return
      }
      const sourceId = media
      // Timeline v3: planned at once with the fit known now (`media-insert-fit.ts`); the exact fit, when the picture's size
      // differs, follows as one more command in the drop's undo step.
      const fit = currentProps.coverTransform?.({ document: currentProps.document, sourceId }) ?? null
      const cover = fit?.transform ?? null
      const insertIndex = mainDropIndex(current, rawFrame)
      const caret = insertIndex >= current.main.length ? current.totalFrames : current.main[insertIndex]!.startFrame
      // The new scene takes the chapter of the side the pointer is on.
      const sectionId = mainDropSection(current, insertIndex, rawFrame < caret ? 'left' : 'right')
      const plan = planMainMediaDrop(currentProps.document, current, {
        insertIndex,
        sectionId,
        sourceId,
        ...(currentProps.uuid && { uuid: currentProps.uuid }),
        ...(cover && { coverTransform: () => cover }),
      })
      void run(plan, { ...(fit && { undoGroup: fit.undoGroup }), onOptimistic: () => plan.sceneId && currentProps.onSelectScene(plan.sceneId) })
      if (fit && plan.ok && plan.sceneId && plan.layerId) fit.settle({ sceneId: plan.sceneId, layerId: plan.layerId })
      return
    }
    if (lane === 'music' && media && media !== 'not_attached') {
      const plan = planMusicDrop(currentProps.document, current, { frame: snap(rawFrame, event).frame, sourceId: media, ...(currentProps.uuid && { uuid: currentProps.uuid }) })
      if (plan.ok || plan.reason !== 'not_audio') {
        void run(plan)
        return
      }
    }
    // Overlay rows, other lanes and other cards: the tool's own placement at the (snapped) frame.
    const frame = snap(rawFrame, event).frame
    currentProps.onToolDrop?.(drop, displayToPlayFrame(current, frame))
  }

  // ---------------------------------------------------------------- render
  const ruler = React.useMemo(() => rulerStep(view.ppf, model.fps), [view.ppf, model.fps])
  const bounds = zoomBounds(fitZoom(model.totalFrames, view.viewportPx, model.fps))
  const sliderValue = Math.round(zoomToSlider(view.ppf, bounds) * 1000)
  const writeTitle = props.writeTitle
  const transitionsEditable = props.transitions !== undefined && props.transitions.canWrite && props.transitions.onSet !== undefined
  const total = formatTimelineTime(playback?.getSnapshot().totalFrames || model.playTotalFrames, model.fps)
  const menuBlock = menu ? model.mainById.get(menu.sceneId) : undefined
  const currentChapter = props.selectedSceneId ? (chapterOfScene(model, props.selectedSceneId)?.key ?? null) : null
  // A narrated scene is split by its script (at a sentence, coming): the toolbar's Split says so instead of refusing later.
  const narratedSelected = props.selectedLayerId === null && props.selectedSceneId !== null && model.mainById.get(props.selectedSceneId)?.narrationBound === true
  const pickerCut = picker ? model.cuts.find((cut) => cut.sceneId === picker.sceneId) : undefined
  const closePicker = React.useCallback(() => setPicker(null), [])
  const menuChapter = chapterMenu ? model.chapters.find((chapter) => chapter.key === chapterMenu.chapterKey) : undefined
  const chapterItems: ChapterMenuItem[] = menuChapter
    ? [
        'rename',
        ...(model.autoChapters ? (['makeChapters'] as const) : []),
        ...(!model.autoChapters ? (['startAtCut'] as const) : []),
        'mergeNext',
        'delete',
        'copyYoutube',
      ]
    : []
  const chapterDisabled = new Set<ChapterMenuItem>()
  if (menuChapter) {
    if (!canWrite) for (const item of chapterItems) if (item !== 'copyYoutube') chapterDisabled.add(item)
    if (!chapterMenu?.cutSceneId || !canStartChapterAt(model, chapterMenu.cutSceneId)) chapterDisabled.add('startAtCut')
    if (menuChapter.index >= model.chapters.length - 1) chapterDisabled.add('mergeNext')
    if (model.autoChapters && model.chapters.length < 2) chapterDisabled.add('delete')
  }

  return (
    <section
      ref={rootRef}
      className={`tl2${lanesOpen ? ' lanes-open' : ''}`}
      tabIndex={0}
      aria-label={t('label')}
      aria-keyshortcuts="Space Home End , . ArrowLeft ArrowRight ArrowUp ArrowDown Delete Escape S Control+B Q W N Control+= Control+- Control+0 Shift+Z"
      onKeyDown={onKeyDown}
      data-timeline-v2
      data-timeline-v3
      data-zoom-mode={view.mode}
    >
      <div className="tl2-bar" role="toolbar" aria-label={t('toolbar')}>
        {props.record ? (
          <button
            type="button"
            className="ib sm tl3-rec"
            disabled={props.record.disabled}
            title={props.record.title ?? t3('toolbar.record')}
            aria-label={t3('toolbar.record')}
            onClick={() => props.record?.onOpen()}
            data-timeline-record
          >
            <Icon name="record" />
          </button>
        ) : null}
        {props.onOpenScript ? (
          <button type="button" className="btn sm tl3-script" title={t3('toolbar.scriptTitle')} onClick={() => props.onOpenScript?.()} data-timeline-script>
            <Icon name="file" size="sm" />
            {t3('toolbar.script')}
          </button>
        ) : null}
        {props.record || props.onOpenScript ? <div className="vsep" /> : null}
        <button
          type="button"
          className="play"
          disabled={!playback || model.playTotalFrames === 0}
          title={playing ? tEditor('pause') : tEditor('play')}
          aria-label={playing ? tEditor('pause') : tEditor('play')}
          aria-keyshortcuts="Space"
          onClick={() => playback?.toggle()}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="tl2-time">
          {/* Written by the frame subscription only (never by React), so playback does not commit. */}
          <span ref={timeRef} /> <span className="tt">/ {total}</span>
        </div>
        <div className="vsep" />
        <button
          type="button"
          className="ib sm"
          disabled={!canWrite || model.main.length === 0 || narratedSelected}
          title={writeTitle ?? (narratedSelected ? t3('toolbar.splitNarrated') : t('split'))}
          aria-label={t('split')}
          aria-keyshortcuts="S Control+B"
          onClick={split}
          data-timeline-split
        >
          <Glyph name="split" />
        </button>
        <button type="button" className="ib sm" disabled={!canWrite || model.main.length === 0} title={writeTitle ?? t('trimStart')} aria-label={t('trimStart')} aria-keyshortcuts="Q" onClick={() => trimToPlayhead('start')} data-timeline-trim-start>
          <Glyph name="trimStart" />
        </button>
        <button type="button" className="ib sm" disabled={!canWrite || model.main.length === 0} title={writeTitle ?? t('trimEnd')} aria-label={t('trimEnd')} aria-keyshortcuts="W" onClick={() => trimToPlayhead('end')} data-timeline-trim-end>
          <Glyph name="trimEnd" />
        </button>
        <button type="button" className="ib sm" disabled={!canWrite || selectedKeys.length === 0} title={writeTitle ?? t('delete')} aria-label={t('delete')} aria-keyshortcuts="Delete" onClick={remove} data-timeline-delete>
          <Icon name="trash" />
        </button>
        <button type="button" className={`ib sm${snapOn ? ' on' : ''}`} title={t('snap')} aria-label={t('snap')} aria-pressed={snapOn} aria-keyshortcuts="N" onClick={() => setSnapOn((on) => !on)}>
          <Glyph name="magnet" />
        </button>
        <div className="grow" />
        <div className="tl2-zoom">
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={sliderValue}
            aria-label={t('zoom')}
            disabled={bounds.max <= bounds.min}
            onChange={(event) => applyZoom(sliderToZoom(Number(event.currentTarget.value) / 1000, boundsNow()))}
          />
          <button type="button" className={`ib sm${view.mode === 'fit' ? ' on' : ''}`} title={t('fit')} aria-label={t('fit')} aria-pressed={view.mode === 'fit'} aria-keyshortcuts="Shift+Z Control+0" onClick={fit} data-timeline-fit>
            <Glyph name="fit" />
          </button>
        </div>
        <div className="vsep" />
        <button
          type="button"
          className={`btn sm tl3-lanes${lanesOpen ? ' on' : ''}`}
          aria-pressed={lanesOpen}
          title={lanesOpen ? t3('toolbar.lanesHide') : t3('toolbar.lanesShow')}
          onClick={() => setLanes(!lanesOpen)}
          data-timeline-lanes
        >
          <Glyph name="lanes" />
          {t3('toolbar.lanes')}
        </button>
      </div>
      <div className="tl2-scroll" ref={scrollRef}>
        <div
          className="tl2-content"
          ref={contentRef}
          style={{ '--tl-total': model.totalFrames } as React.CSSProperties}
          onPointerDown={onPointerDown}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <TimelineLanes
            model={model}
            window={visibleWindow}
            ppf={view.ppf}
            selection={selectionString}
            overlayRows={overlayRowCount}
            ruler={ruler}
            transitionsEnabled={props.transitionsEnabled}
            transitionsEditable={transitionsEditable}
            canWrite={canWrite}
            pendingCut={pendingCut}
            lanesOpen={lanesOpen}
            previews={previews}
            thumbnails={thumbnails}
            mediaVersion={mediaVersion}
            chapterName={chapterName}
            renamingChapter={renaming}
            currentChapter={currentChapter}
            onRenameCommit={renameChapter}
            onRenameCancel={cancelRename}
            pickerSceneId={picker?.sceneId ?? null}
          />
          <div className="tl2-ph" ref={playheadRef} aria-hidden>
            <div className="tl2-ph-cap" data-gesture="scrub" />
          </div>
          <div className="tl2-snap" ref={snapRef} hidden aria-hidden />
          <div className="tl2-caret" ref={caretRef} hidden aria-hidden />
          <div className="tl2-tip" ref={tipRef} hidden aria-hidden />
        </div>
      </div>
      {menu && menuBlock ? (
        <div className="tl2-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" role="menuitem" disabled={!canWrite} onClick={() => { setMenu(null); split() }}>
            {t('split')}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canWrite}
            onClick={() => {
              setMenu(null)
              void run(planDelete(document, model, [menuBlock.key]))
            }}
          >
            {t('delete')}
          </button>
          {menuBlock.policy !== 'fixed' && menuBlock.resolved ? (
            <button
              type="button"
              role="menuitem"
              disabled={!canWrite}
              onClick={() => {
                setMenu(null)
                void run(planSetFixedLength(model, menuBlock.sceneId))
              }}
            >
              {t('setFixedLength')}
            </button>
          ) : null}
          {canStartChapterAt(model, menuBlock.sceneId) ? (
            <button
              type="button"
              role="menuitem"
              disabled={!canWrite}
              onClick={() => {
                setMenu(null)
                void runChapter(planStartChapterAt(document, model, { sceneId: menuBlock.sceneId, title: t3('chapters.newTitle') }, chapterOptions()))
              }}
              data-start-chapter
            >
              {t3('chapters.menu.startHere')}
            </button>
          ) : null}
        </div>
      ) : null}
      {chapterMenu && menuChapter ? <ChapterMenu x={chapterMenu.x} y={chapterMenu.y} items={chapterItems} disabled={chapterDisabled} onPick={pickChapterItem} /> : null}
      {picker && pickerCut && props.transitions?.onSet ? (
        <TransitionPicker
          cut={pickerCut}
          fps={model.fps}
          x={picker.x}
          y={picker.y}
          multipleCuts={model.cuts.length > 1}
          {...(props.transitionCatalog !== undefined && { catalog: props.transitionCatalog })}
          onSet={(transition, options) => props.transitions?.onSet?.(pickerCut.sceneId, transition, options)}
          onApplyToAll={(transition) => {
            props.transitions?.onApplyToAll?.(transition)
            setPicker(null)
          }}
          onClose={closePicker}
        />
      ) : null}
    </section>
  )
}

const noSubscribe = () => () => undefined

/** The project source a media card stands for: its id, `'not_attached'` (a file not in the project yet), or null (not media). */
function mediaOfDrop(document: CompositionDocument, drop: SparkToolDrop): string | 'not_attached' | null {
  if (drop.kind !== 'card' || drop.drag.tool !== 'media') return null
  const { kind, data } = drop.drag
  if (kind === 'project_source') return typeof data['sourceId'] === 'string' ? data['sourceId'] : null
  if (kind === 'storage_object') {
    return typeof data['storageObjectId'] === 'string' ? (sourceIdOfStorageObject(document, data['storageObjectId']) ?? 'not_attached') : null
  }
  return 'not_attached'
}

/** Toolbar symbols the studio sprite does not have, drawn in its line style. */
function Glyph({ name }: { name: 'split' | 'magnet' | 'fit' | 'lanes' | 'trimStart' | 'trimEnd' }) {
  return (
    <svg className="tl2-glyph" viewBox="0 0 24 24" aria-hidden>
      {name === 'split' ? (
        <>
          <circle cx="6" cy="7" r="3" />
          <circle cx="6" cy="17" r="3" />
          <path d="M8.5 8.5 20 18M8.5 15.5 20 6" />
        </>
      ) : name === 'magnet' ? (
        <path d="M6 4v7a6 6 0 0 0 12 0V4M6 8h4M14 8h4M10 4v7a2 2 0 0 0 4 0V4" />
      ) : name === 'trimStart' ? (
        <path d="M9 4v16M9 12h11M13 8l-4 4 4 4" />
      ) : name === 'trimEnd' ? (
        <path d="M15 4v16M15 12H4M11 8l4 4-4 4" />
      ) : name === 'fit' ? (
        <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4M8 12h8" />
      ) : (
        <path d="M4 6h16M4 12h10M4 18h13" />
      )}
    </svg>
  )
}

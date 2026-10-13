import type { TimelineFps } from './timeline-model'

/**
 * Spark timeline geometry (v2 P1-A, v3 fit mode): the time axis is linear, `x = frame × pxPerFrame` from the start of the
 * lanes. The zoom IS that one number: the timeline writes it as the CSS variable `--tl-ppf` and every block is placed with
 * `calc(frame × var(--tl-ppf))`, so zooming re-renders nothing but the visible window. Pure functions only.
 *
 * v3 (owner feedback 2026-10-03, "a 5-minute video stretches far right"): the zoom is a MODE. `fit` shows the whole video
 * in the viewport and is recomputed whenever the length, the clips or the width change; any manual zoom switches to
 * `manual`, Fit / Shift+Z go back. The widest zoom is the fit itself (no 2 px/s floor), the closest 12 px per frame.
 */

/** The closest zoom: frame level (12 px per frame). */
export const MAX_PX_PER_FRAME = 12
/** The zoom of an empty timeline (nothing to fit): 40 px per second. */
export const EMPTY_PX_PER_SECOND = 40
/** Share of the viewport the fitted video fills (a small margin after the last clip). */
export const FIT_FILL = 0.96
/** Ctrl+= / Ctrl+- step and the factor of one wheel notch. */
export const ZOOM_STEP = 1.25
/** Snapping reach in pixels (converted to frames at the current zoom). */
export const SNAP_PX = 8

export type ZoomMode = 'fit' | 'manual'
export type ZoomBounds = { min: number; max: number }

export function rateOf(fps: TimelineFps): number {
  return fps.num / fps.den
}

/**
 * The zoom that shows the whole timeline in `viewportPx` (with a small right margin). There is no lower floor: a two-hour
 * video fits too. A short video stops at frame level; an empty timeline (or a viewport not measured yet) gets 40 px/s.
 */
export function fitZoom(totalFrames: number, viewportPx: number, fps: TimelineFps): number {
  if (totalFrames <= 0 || viewportPx <= 0) return Math.min(MAX_PX_PER_FRAME, EMPTY_PX_PER_SECOND / rateOf(fps))
  return Math.min(MAX_PX_PER_FRAME, (viewportPx * FIT_FILL) / totalFrames)
}

/** The zoom range: from the fit (the whole video in view) to frame level. */
export function zoomBounds(fit: number): ZoomBounds {
  const max = MAX_PX_PER_FRAME
  const min = Number.isFinite(fit) && fit > 0 ? Math.min(fit, max) : max
  return { min, max }
}

export function clampZoom(pxPerFrame: number, bounds: ZoomBounds): number {
  if (!Number.isFinite(pxPerFrame) || pxPerFrame <= 0) return bounds.min
  return Math.min(bounds.max, Math.max(bounds.min, pxPerFrame))
}

/** Whether a zoom shows the whole video (it sits at the fit, the widest zoom). */
export function isFitZoom(pxPerFrame: number, bounds: ZoomBounds): boolean {
  return Math.abs(pxPerFrame - bounds.min) <= bounds.min * 1e-6
}

export function frameToPx(frame: number, pxPerFrame: number): number {
  return frame * pxPerFrame
}

export function pxToFrame(px: number, pxPerFrame: number): number {
  return pxPerFrame > 0 ? Math.round(px / pxPerFrame) : 0
}

/**
 * Zoom anchored at a point of the lanes (Ctrl+wheel at the cursor, Ctrl+= at the playhead): the frame under `anchorPx`
 * (pixels from the visible left edge of the lanes) stays under it. Returns the new zoom and scroll offset.
 */
export function zoomAt(input: { pxPerFrame: number; scrollLeft: number; anchorPx: number; factor: number; bounds: ZoomBounds }): { pxPerFrame: number; scrollLeft: number } {
  const next = clampZoom(input.pxPerFrame * input.factor, input.bounds)
  const frame = (input.scrollLeft + input.anchorPx) / input.pxPerFrame
  return { pxPerFrame: next, scrollLeft: Math.max(0, frame * next - input.anchorPx) }
}

/** The frames the lanes must render: the viewport plus `overscan` screens on either side (block virtualisation). */
export function visibleFrames(input: { scrollLeft: number; viewportPx: number; pxPerFrame: number; overscan?: number }): { startFrame: number; endFrame: number } {
  const overscan = (input.overscan ?? 1) * input.viewportPx
  const left = Math.max(0, input.scrollLeft - overscan)
  const right = input.scrollLeft + input.viewportPx + overscan
  return { startFrame: Math.floor(left / input.pxPerFrame), endFrame: Math.ceil(right / input.pxPerFrame) }
}

/**
 * The window quantised to half a viewport, so scrolling re-renders the lanes only when the rendered window has to move
 * (never on every scroll event, never during playback unless the view pages).
 */
export function windowBucket(scrollLeft: number, viewportPx: number): number {
  const step = Math.max(1, viewportPx / 2)
  return Math.floor(scrollLeft / step)
}

export function visibleWindowFor(bucket: number, viewportPx: number, pxPerFrame: number): { startFrame: number; endFrame: number } {
  const step = Math.max(1, viewportPx / 2)
  return visibleFrames({ scrollLeft: bucket * step, viewportPx: viewportPx + step, pxPerFrame })
}

/** Whether [start, end) overlaps the window. */
export function inWindow(window: { startFrame: number; endFrame: number }, start: number, end: number): boolean {
  return end >= window.startFrame && start <= window.endFrame
}

/** The zoom slider (0..1) on a log scale between the zoom bounds (0 = the fit; a range of one zoom is always 0). */
export function zoomToSlider(pxPerFrame: number, bounds: ZoomBounds): number {
  const { min, max } = bounds
  if (max <= min) return 0
  return (Math.log(clampZoom(pxPerFrame, bounds)) - Math.log(min)) / (Math.log(max) - Math.log(min))
}

export function sliderToZoom(value: number, bounds: ZoomBounds): number {
  const { min, max } = bounds
  if (max <= min) return min
  const t = Math.min(1, Math.max(0, value))
  return clampZoom(Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))), bounds)
}

const RULER_STEPS_SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]

/**
 * Ruler spacing at a zoom: labelled ticks at least `minLabelPx` apart (whole seconds), minor ticks between them; at frame
 * level the minor ticks are single frames.
 */
export function rulerStep(pxPerFrame: number, fps: TimelineFps, minLabelPx = 64): { majorFrames: number; minorFrames: number } {
  const second = Math.max(1, Math.round(rateOf(fps)))
  if (second * pxPerFrame >= minLabelPx * 2 && pxPerFrame >= 6) return { majorFrames: second, minorFrames: 1 }
  const major = (RULER_STEPS_SECONDS.find((seconds) => seconds * second * pxPerFrame >= minLabelPx) ?? RULER_STEPS_SECONDS[RULER_STEPS_SECONDS.length - 1]!) * second
  // Minor ticks on round values: fifths of 1 s / 5 s / 10 s steps, quarters of 2 s / 2 min steps.
  for (const parts of (major / second) % 5 === 0 || major === second ? [5, 2] : [4, 2]) {
    const minor = major / parts
    if (Number.isInteger(minor) && minor * pxPerFrame >= 6) return { majorFrames: major, minorFrames: minor }
  }
  return { majorFrames: major, minorFrames: major }
}

/**
 * Snapping: the nearest of `points` within `thresholdFrames` of `frame` (points the caller excludes, e.g. the dragged
 * block's own edges, are left out). Returns the snapped frame and the point it snapped to (null = no snap).
 */
export function snapFrame(frame: number, points: readonly number[], thresholdFrames: number, exclude?: ReadonlySet<number>): { frame: number; snappedTo: number | null } {
  if (points.length === 0 || thresholdFrames <= 0) return { frame, snappedTo: null }
  // Binary search for the insertion point, then look at the neighbours.
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (points[middle]! < frame) low = middle + 1
    else high = middle
  }
  let best: number | null = null
  for (let index = Math.max(0, low - 3); index < Math.min(points.length, low + 3); index += 1) {
    const point = points[index]!
    if (exclude?.has(point)) continue
    if (Math.abs(point - frame) > thresholdFrames) continue
    if (best === null || Math.abs(point - frame) < Math.abs(best - frame)) best = point
  }
  return best === null ? { frame, snappedTo: null } : { frame: best, snappedTo: best }
}

/**
 * Snaps a moving range [start, start + length) by whichever edge is closer to a snap point. Returns the new start and the
 * snap line frame.
 */
export function snapRange(start: number, length: number, points: readonly number[], thresholdFrames: number, exclude?: ReadonlySet<number>): { start: number; snappedTo: number | null } {
  const head = snapFrame(start, points, thresholdFrames, exclude)
  const tail = snapFrame(start + length, points, thresholdFrames, exclude)
  if (head.snappedTo === null && tail.snappedTo === null) return { start, snappedTo: null }
  if (tail.snappedTo === null || (head.snappedTo !== null && Math.abs(head.frame - start) <= Math.abs(tail.frame - (start + length)))) {
    return { start: head.frame, snappedTo: head.snappedTo }
  }
  return { start: tail.frame - length, snappedTo: tail.snappedTo }
}

export function snapThresholdFrames(pxPerFrame: number): number {
  return pxPerFrame > 0 ? SNAP_PX / pxPerFrame : 0
}

/** `m:ss` or `m:ss.f` labels of the ruler and the tooltips. */
export function formatTimelineTime(frames: number, fps: TimelineFps, withTenths = false): string {
  const seconds = Math.max(0, (frames * fps.den) / fps.num)
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  const base = `${minutes}:${String(rest).padStart(2, '0')}`
  return withTenths ? `${base}.${Math.floor((seconds % 1) * 10)}` : base
}

/** A length in seconds with one decimal (the trim tooltip, the block durations). */
export function formatSecondsLength(frames: number, fps: TimelineFps): string {
  const seconds = (frames * fps.den) / fps.num
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${Math.round(seconds * 10) / 10}s`
}

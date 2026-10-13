/**
 * Spark effects: after an effect is applied the editor plays it at once (CapCut's "apply, then watch it"): about one second
 * either side of a cut for a transition (WP1), the animated part of a layer for an animation (WP2). The playback clock is
 * the stage's own `PlaybackStore`; this only seeks, plays and pauses it at the end of the span. A seek backwards by the
 * user, a pause or another span ends it without touching the clock again.
 */

export type CutPreviewClock = {
  readonly frame: number
  readonly playing: boolean
  seek(frame: number): void
  play(): void
  pause(): void
  subscribe(listener: () => void): () => void
  subscribeFrame(listener: (frame: number) => void): () => void
  getSnapshot(): { totalFrames: number }
}

/** The span played around a cut: `seconds` before and after, clamped to the timeline. */
export function cutPreviewSpan(cutFrame: number, fps: { num: number; den: number }, totalFrames: number, seconds = 1): { start: number; end: number } {
  const span = Math.max(1, Math.round((seconds * fps.num) / fps.den))
  return clampSpan({ start: cutFrame - span, end: cutFrame + span }, totalFrames)
}

function clampSpan(span: { start: number; end: number }, totalFrames: number): { start: number; end: number } {
  const last = Math.max(0, totalFrames - 1)
  const clamp = (frame: number) => Math.min(last, Math.max(0, Math.round(frame)))
  return { start: clamp(span.start), end: clamp(span.end) }
}

let active: (() => void) | null = null

/** Plays [start, end] (absolute frames, clamped to the timeline) once and stops there. Returns the function that ends it. */
export function playSpan(clock: CutPreviewClock, span: { start: number; end: number }): () => void {
  active?.()
  const { start, end } = clampSpan(span, clock.getSnapshot().totalFrames)
  if (end <= start) return () => undefined
  let done = false
  let started = false
  let previous = start
  const stopFrame = clock.subscribeFrame((frame) => {
    if (done) return
    // A jump backwards is the user's seek: the span is no longer ours to stop. (A slow tick may skip frames forward.)
    if (frame < previous) {
      finish(false)
      return
    }
    previous = frame
    if (frame >= end) finish(true)
  })
  const stopPlaying = clock.subscribe(() => {
    if (!done && started && !clock.playing) finish(false)
  })
  function finish(pause: boolean): void {
    if (done) return
    done = true
    stopFrame()
    stopPlaying()
    if (active === cancel) active = null
    if (pause && clock.playing) clock.pause()
  }
  const cancel = () => finish(false)
  active = cancel
  if (clock.playing) clock.pause()
  clock.seek(start)
  previous = clock.frame
  started = true
  clock.play()
  return cancel
}

/** Plays [cut - 1 s, cut + 1 s] once (the transition just applied to that cut). */
export function playAroundCut(clock: CutPreviewClock, input: { cutFrame: number; fps: { num: number; den: number }; seconds?: number }): () => void {
  return playSpan(clock, cutPreviewSpan(input.cutFrame, input.fps, clock.getSnapshot().totalFrames, input.seconds))
}

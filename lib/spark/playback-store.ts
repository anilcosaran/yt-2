import type { StageFps } from './stage/stage-types'

/**
 * `PlaybackStore` (D2): the playback clock, separate from the document and from the selection. It owns `{playing,
 * frame}` only; the frame is an integer at the canvas fps derived from the clock (`frame = origin + round(elapsed ×
 * fps)`), never accumulated, so a slow frame never drifts the timeline. Seeks, steps and play/pause are synchronous.
 *
 * Two subscriptions keep the editor cheap (product rule "clock, document and selection are separate"): `subscribe`
 * fires on `playing` / range changes, `subscribeFrame` fires on every frame change and is meant for the stage, the
 * playhead and the time label, never for the whole editor.
 */

export type PlaybackClock = {
  /** Milliseconds, monotonic. */
  now(): number
  requestFrame(callback: () => void): number
  cancelFrame(handle: number): void
}

export type PlaybackSnapshot = {
  playing: boolean
  frame: number
  totalFrames: number
  fps: StageFps
}

/**
 * What the editor shell reads for the real playhead in every chat message (Y1-07 `editor-interfaces.md` section 6):
 * the absolute project frame. `PlaybackStore` satisfies it.
 */
export type SparkPlaybackSnapshot = { playing: boolean; frame: number }
export type SparkPlaybackReader = { getSnapshot(): SparkPlaybackSnapshot; subscribe(listener: () => void): () => void }

const BROWSER_CLOCK: PlaybackClock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  requestFrame: (callback) => globalThis.requestAnimationFrame(() => callback()),
  cancelFrame: (handle) => globalThis.cancelAnimationFrame(handle),
}

export function browserPlaybackClock(): PlaybackClock {
  return BROWSER_CLOCK
}

export class PlaybackStore {
  private snapshot: PlaybackSnapshot = { playing: false, frame: 0, totalFrames: 0, fps: { num: 30, den: 1 } }
  private readonly listeners = new Set<() => void>()
  private readonly frameListeners = new Set<(frame: number) => void>()
  private readonly clock: PlaybackClock
  private timer: number | null = null
  /** Clock time and frame at the moment the current run started. */
  private origin: { time: number; frame: number } | null = null
  /** Timeline v3: waits holding the clock (`stall`), and the run they belong to (a pause or a new run ends them). */
  private stalls = 0
  private run = 0

  constructor(options: { clock?: PlaybackClock } = {}) {
    this.clock = options.clock ?? BROWSER_CLOCK
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly subscribeFrame = (listener: (frame: number) => void) => {
    this.frameListeners.add(listener)
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.snapshot

  get frame(): number {
    return this.snapshot.frame
  }

  get playing(): boolean {
    return this.snapshot.playing
  }

  /**
   * Sets the length and rate of the timeline (a new working copy). The frame is kept when it still exists, otherwise
   * clamped; playback stops when the timeline became empty.
   */
  configure(input: { totalFrames: number; fps: StageFps }): void {
    const totalFrames = Math.max(0, Math.floor(input.totalFrames))
    const fpsChanged = input.fps.num !== this.snapshot.fps.num || input.fps.den !== this.snapshot.fps.den
    if (totalFrames === this.snapshot.totalFrames && !fpsChanged) return
    const previousFrame = this.snapshot.frame
    const frame = this.clamp(previousFrame, totalFrames)
    // An empty timeline or a new rate ends the run; a longer or shorter timeline keeps playing from the same frame.
    const keepPlaying = this.snapshot.playing && totalFrames > 0 && !fpsChanged
    if (this.snapshot.playing && !keepPlaying) this.halt()
    this.snapshot = { ...this.snapshot, totalFrames, fps: input.fps, frame, playing: keepPlaying }
    if (keepPlaying) this.origin = { time: this.clock.now(), frame }
    this.emit(frame !== previousFrame)
  }

  play(): void {
    const { playing, totalFrames } = this.snapshot
    if (playing || totalFrames === 0) return
    // Playing from the end starts over (design `setPlaying`).
    const frame = this.snapshot.frame >= totalFrames - 1 ? 0 : this.snapshot.frame
    this.snapshot = { ...this.snapshot, playing: true, frame }
    this.origin = { time: this.clock.now(), frame }
    this.schedule()
    this.emit(true)
  }

  pause(): void {
    if (!this.snapshot.playing) return
    this.halt()
    this.snapshot = { ...this.snapshot, playing: false }
    this.emit(false)
  }

  toggle(): void {
    if (this.snapshot.playing) this.pause()
    else this.play()
  }

  /** Jumps to a frame (clamped). While playing the run continues from there. */
  seek(frame: number): void {
    const next = this.clamp(Math.round(frame), this.snapshot.totalFrames)
    if (this.snapshot.playing) this.origin = { time: this.clock.now(), frame: next }
    if (next === this.snapshot.frame) return
    this.snapshot = { ...this.snapshot, frame: next }
    this.emit(true)
  }

  /** Moves by whole frames (Left/Right = 1, Shift = 1 s); never crosses the ends. */
  step(delta: number): void {
    this.seek(this.snapshot.frame + delta)
  }

  /**
   * Timeline v3 (wait instead of skip): holds the running clock while the stage cannot draw the next frame yet (a transition
   * or a scene still loading). The frame does not advance and no frame is skipped; `playing` stays true. Returns the release
   * (idempotent): the run then continues from the frame it waited at. Nothing happens while paused; a pause or a new run ends
   * every wait.
   */
  stall(): () => void {
    if (!this.snapshot.playing) return () => undefined
    const run = this.run
    this.stalls += 1
    if (this.timer !== null) this.clock.cancelFrame(this.timer)
    this.timer = null
    let released = false
    return () => {
      if (released || run !== this.run) return
      released = true
      this.stalls -= 1
      if (this.stalls > 0 || !this.snapshot.playing) return
      this.origin = { time: this.clock.now(), frame: this.snapshot.frame }
      this.schedule()
    }
  }

  /** Timeline v3: the clock is held by `stall`. */
  get stalled(): boolean {
    return this.stalls > 0
  }

  dispose(): void {
    this.halt()
    this.listeners.clear()
    this.frameListeners.clear()
  }

  private schedule(): void {
    this.timer = this.clock.requestFrame(this.tick)
  }

  private halt(): void {
    if (this.timer !== null) this.clock.cancelFrame(this.timer)
    this.timer = null
    this.origin = null
    // Every wait of this run ends with it.
    this.stalls = 0
    this.run += 1
  }

  private readonly tick = () => {
    this.timer = null
    const { origin } = this
    if (!this.snapshot.playing || !origin || this.stalls > 0) return
    const { fps, totalFrames } = this.snapshot
    const elapsed = (this.clock.now() - origin.time) / 1000
    const target = origin.frame + Math.floor((elapsed * fps.num) / fps.den)
    if (target >= totalFrames - 1) {
      this.halt()
      this.snapshot = { ...this.snapshot, playing: false, frame: Math.max(0, totalFrames - 1) }
      this.emit(true)
      return
    }
    if (target !== this.snapshot.frame) {
      this.snapshot = { ...this.snapshot, frame: target }
      this.emitFrame()
    }
    this.schedule()
  }

  private clamp(frame: number, totalFrames: number): number {
    if (totalFrames <= 0) return 0
    return Math.min(Math.max(0, frame), totalFrames - 1)
  }

  private emit(frameChanged: boolean): void {
    for (const listener of [...this.listeners]) listener()
    if (frameChanged) this.emitFrame()
  }

  private emitFrame(): void {
    for (const listener of [...this.frameListeners]) listener(this.snapshot.frame)
  }
}

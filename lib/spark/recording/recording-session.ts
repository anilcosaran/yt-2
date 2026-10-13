import { createCaptureAudioContext, isSecureMediaContext, mediaProblemFromError, startLevelMeter, stopMediaStream } from '@/lib/avatar/recording-media'
import type { AttachResult } from '@/lib/spark/source-attach-client'

import { RECORDER_BITRATE, applePreferredBrowser, extensionForMime, mimeForTake, pickRecorderType } from './recorder-formats'
import { oversizedPart } from './upload-limit'
import {
  MODE_ROLES,
  RECORDING_MAX_MS,
  RecordingSaveError,
  type RecordedPart,
  type RecordedTake,
  type RecordingDevice,
  type RecordingError,
  type RecordingMode,
  type RecordingPhase,
  type RecordingProblem,
  type RecordingRole,
  type PersistState,
  type RecordingSnapshot,
  type SaveFailure,
  type SavePartState,
  type SaveState,
  type SaveStep,
} from './recording-types'

/**
 * E1-F recorder state machine (D7). One `RecordingSession` runs one take at a time: it opens the devices for a mode
 * (`getDisplayMedia` / `getUserMedia`), records every file of the mode with its own `MediaRecorder`, counts the recorded
 * time against the 10-minute cap (pauses excluded), releases EVERY track as soon as the recording stops or is cancelled,
 * and carries the finished take through upload -> project source -> insert (`save`).
 *
 * It is plain TypeScript with a `useSyncExternalStore` surface (`subscribe` / `getSnapshot`), so it outlives the drawer
 * component: a take stays in the session while the user looks at another tool. Live capture never outlives the drawer
 * (`releaseDevices`): a recording that is still running when the drawer goes away is stopped and kept as the take.
 * Nothing is written to browser storage; the take lives in memory until it is inserted or discarded.
 */

export type RecordingSessionOptions = {
  /** Epoch milliseconds (names the files, times the take). Tests pass a manual clock. */
  now?: () => number
  /** Period of the elapsed-time ticker. */
  tickMs?: number
  /** The cap of one take. */
  maxMs?: number
  /**
   * Level meter of the microphone stream; returns its stop function. `context` is an `AudioContext` created inside the
   * click that opened the devices (iOS only lets such a context run). Default: the avatar capture's `startLevelMeter`.
   */
  startMeter?: (stream: MediaStream, onLevel: (level: number) => void, context: AudioContext | null) => () => void
  uuid?: () => string
}

/** What one `save` needs from the editor: the three steps of "put the take into the project". */
export type RecordingSaveDeps = {
  upload(
    part: RecordedPart,
    context: { takeId: string; startedAt: number; onProgress(percent: number): void; signal: AbortSignal },
  ): Promise<{ storageObjectId: string; checksumSha256: string }>
  /** `timeout`: the source did not become usable in time (still processing); the take is kept for a later check. */
  attach(input: { storageObjectId: string; checksumSha256: string; signal: AbortSignal }): Promise<AttachResult | { status: 'timeout' }>
  insert(input: {
    take: RecordedTake
    /** Project source id of every file of the take. */
    sources: Partial<Record<RecordingRole, string>>
  }): Promise<{ applied: boolean; sceneNumber: number | null }>
  /**
   * T1R-9: whether the take is already on the timeline (an earlier insert applied but its result was lost or the save was
   * left meanwhile). Asked before an insert is repeated: a take is inserted once, never twice.
   */
  find?(input: { take: RecordedTake; sources: Partial<Record<RecordingRole, string>> }): Promise<{ sceneNumber: number | null } | null>
}

/** Uploads one file of the take into "Recordings" (the first step of a save, also run on its own when the recording stops). */
export type RecordingUploader = RecordingSaveDeps['upload']

class CaptureError extends Error {
  readonly problem: RecordingProblem
  readonly device: RecordingDevice
  constructor(problem: RecordingProblem, device: RecordingDevice) {
    super(`capture failed: ${device} ${problem}`)
    this.name = 'CaptureError'
    this.problem = problem
    this.device = device
  }
}

const MIC_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
const CAMERA_CONSTRAINTS: MediaTrackConstraints = { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
const DISPLAY_CONSTRAINTS: DisplayMediaStreamOptions = { video: { frameRate: { ideal: 30 } }, audio: false }
/** `MediaRecorder` hands data over once a second, so a crash loses at most the last second. */
const TIMESLICE_MS = 1000
/** How long `stop` waits for the recorders' final data before it takes what it has. */
const FINISH_TIMEOUT_MS = 5000
const LEVEL_INTERVAL_MS = 60

const INITIAL: RecordingSnapshot = {
  phase: 'idle',
  mode: null,
  withMic: true,
  elapsedMs: 0,
  maxMs: RECORDING_MAX_MS,
  screenStream: null,
  cameraStream: null,
  hasMic: false,
  micUnavailable: false,
  take: null,
  persist: null,
  save: null,
  insertedSceneNumber: null,
  error: null,
}

type Capture = {
  role: RecordingRole
  /** What the recorder records. */
  stream: MediaStream
  requestedType: string
  recorder: MediaRecorder | null
  chunks: Blob[]
  /** Resolves when the recorder has delivered its last data and stopped (its own `stop` event). */
  stopped: Promise<void>
  width: number | null
  height: number | null
  hasAudio: boolean
}

type Opened = { display: MediaStream | null; camera: MediaStream | null; mic: MediaStream | null; micUnavailable: boolean }

function mediaDevices(): MediaDevices | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
}

export function supportsDisplayCapture(): boolean {
  return typeof mediaDevices()?.getDisplayMedia === 'function' && typeof MediaRecorder !== 'undefined'
}

export function supportsDeviceRecording(): boolean {
  return typeof mediaDevices()?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

export class RecordingSession {
  private state: RecordingSnapshot = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly levelListeners = new Set<() => void>()
  private level = 0
  private lastLevelAt = 0

  private readonly now: () => number
  private readonly tickMs: number
  private readonly maxMs: number
  private readonly startMeter: (stream: MediaStream, onLevel: (level: number) => void, context: AudioContext | null) => () => void
  private readonly uuid: () => string

  private captures: Capture[] = []
  /** Every stream this session opened; each one is stopped when capture ends. */
  private owned: MediaStream[] = []
  private stopMeterFn: (() => void) | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private requestToken = 0
  private startedAt = 0
  private activeSince = 0
  private accumulatedMs = 0
  private saveAbort: AbortController | null = null
  private guardOn = false
  /** T1R-10: how the finished take reaches Storage while the user still looks at it. */
  private uploader: RecordingUploader | null = null
  private uploadLimitMb: number | null = null
  private persistFlight: Promise<void> | null = null
  private persistAbort: AbortController | null = null
  private disposeWhenPersisted = false
  /** T1R-9: one insert per take at a time, and a take whose insert was tried is looked for before it is inserted again. */
  private insertFlights = new Map<string, Promise<{ applied: boolean; sceneNumber: number | null }>>()
  private insertAttempted = new Set<string>()

  constructor(options: RecordingSessionOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.tickMs = options.tickMs ?? 200
    this.maxMs = options.maxMs ?? RECORDING_MAX_MS
    this.uuid = options.uuid ?? (() => globalThis.crypto.randomUUID())
    this.startMeter = options.startMeter ?? ((stream, onLevel, context) => startLevelMeter(stream, onLevel, context))
    this.state = { ...INITIAL, maxMs: this.maxMs }
  }

  // ---------------------------------------------------------------- store

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): RecordingSnapshot => this.state

  /** The phase read afresh (an `await` in between may have changed it; TypeScript narrows `this.state.phase` across it). */
  private phase(): RecordingPhase {
    return this.state.phase
  }

  /** The microphone level (0..1), a store of its own so the meter re-renders without the drawer. */
  subscribeLevel = (listener: () => void): (() => void) => {
    this.levelListeners.add(listener)
    return () => {
      this.levelListeners.delete(listener)
    }
  }

  getLevel = (): number => this.level

  private update(patch: Partial<RecordingSnapshot>): void {
    const next = { ...this.state, ...patch }
    if (Object.keys(patch).every((key) => next[key as keyof RecordingSnapshot] === this.state[key as keyof RecordingSnapshot])) return
    this.state = next
    this.syncGuard()
    for (const listener of [...this.listeners]) listener()
  }

  private setLevel(level: number): void {
    const at = this.now()
    if (level !== 0 && at - this.lastLevelAt < LEVEL_INTERVAL_MS) return
    this.lastLevelAt = at
    const rounded = Math.round(Math.min(1, Math.max(0, level)) * 50) / 50
    if (rounded === this.level) return
    this.level = rounded
    for (const listener of [...this.levelListeners]) listener()
  }

  /**
   * The page asks before it is left while a recording runs, a take is being saved, or a finished take exists only in this
   * page (not in Storage yet, T1R-10).
   */
  private syncGuard(): void {
    if (typeof window === 'undefined') return
    const wanted =
      this.state.phase === 'recording' ||
      this.state.phase === 'paused' ||
      this.state.phase === 'finishing' ||
      this.state.phase === 'saving' ||
      (this.state.phase === 'review' && this.state.persist?.status !== 'saved')
    if (wanted === this.guardOn) return
    this.guardOn = wanted
    if (wanted) window.addEventListener('beforeunload', this.onBeforeUnload)
    else window.removeEventListener('beforeunload', this.onBeforeUnload)
  }

  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault()
    event.returnValue = ''
  }

  // ---------------------------------------------------------------- options

  setMicrophone(on: boolean): void {
    if (this.state.phase === 'idle' || this.state.phase === 'error') this.update({ withMic: on })
  }

  // ---------------------------------------------------------------- capture

  /**
   * Opens the devices of `mode` (the permission prompts / the screen picker open here, so call it from the click). Lands in
   * `ready` (live preview + meter) or `error`. The screen is requested FIRST: browsers only open the picker while the click
   * is still fresh.
   */
  async start(mode: RecordingMode): Promise<void> {
    if (this.state.phase !== 'idle' && this.state.phase !== 'error') return
    const token = ++this.requestToken
    this.update({
      phase: 'requesting',
      mode,
      error: null,
      elapsedMs: 0,
      micUnavailable: false,
      take: null,
      persist: null,
      save: null,
      insertedSceneNumber: null,
      screenStream: null,
      cameraStream: null,
      hasMic: false,
    })
    this.setLevel(0)
    // Created here, inside the click, because iOS only lets an AudioContext run that was made in a user gesture.
    const meterContext = createCaptureAudioContext()
    const closeMeterContext = () => void meterContext?.close().catch(() => undefined)
    const opened: Opened = { display: null, camera: null, mic: null, micUnavailable: false }
    try {
      await this.openDevices(mode, this.state.withMic, opened)
    } catch (error) {
      this.releaseOpened(opened)
      closeMeterContext()
      if (token !== this.requestToken) return
      this.update({ phase: 'error', error: this.deviceError(error), screenStream: null, cameraStream: null, hasMic: false })
      return
    }
    if (token !== this.requestToken || this.phase() !== 'requesting') {
      // Cancelled while a prompt was open: let go of whatever the user granted meanwhile.
      this.releaseOpened(opened)
      closeMeterContext()
      return
    }
    this.owned = [opened.display, opened.camera, opened.mic].filter((stream): stream is MediaStream => stream !== null)
    this.captures = this.buildCaptures(mode, opened)
    const meterStream = [opened.mic, opened.camera].find((stream) => stream !== null && stream.getAudioTracks().length > 0) ?? null
    for (const stream of this.owned) {
      for (const track of [...stream.getVideoTracks(), ...stream.getAudioTracks()]) track.addEventListener('ended', this.onTrackEnded)
    }
    if (meterStream) this.stopMeterFn = this.startMeter(meterStream, (level) => this.setLevel(level), meterContext)
    else closeMeterContext()
    this.update({
      phase: 'ready',
      screenStream: opened.display,
      cameraStream: opened.camera,
      hasMic: meterStream !== null,
      micUnavailable: opened.micUnavailable,
    })
  }

  private async openDevices(mode: RecordingMode, withMic: boolean, opened: Opened): Promise<void> {
    const devices = mediaDevices()
    if (!isSecureMediaContext()) throw new CaptureError('insecure', mode === 'voice' ? 'microphone' : mode === 'camera' ? 'camera' : 'screen')
    const needsScreen = mode === 'screen' || mode === 'screen_camera'
    const needsCamera = mode === 'camera' || mode === 'screen_camera'
    if (!devices || (needsScreen && typeof devices.getDisplayMedia !== 'function') || typeof devices.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
      throw new CaptureError('unsupported', needsScreen ? 'screen' : needsCamera ? 'camera' : 'microphone')
    }

    if (needsScreen) {
      try {
        opened.display = await devices.getDisplayMedia(DISPLAY_CONSTRAINTS)
      } catch (error) {
        throw new CaptureError(mediaProblemFromError(error), 'screen')
      }
    }
    if (mode === 'screen' && withMic) {
      // The microphone is an extra of a screen recording: a missing or blocked one only means "no sound".
      try {
        opened.mic = await devices.getUserMedia({ video: false, audio: MIC_CONSTRAINTS })
      } catch {
        opened.micUnavailable = true
      }
    }
    if (needsCamera) {
      const video = CAMERA_CONSTRAINTS
      try {
        opened.camera = await devices.getUserMedia({ video, audio: withMic ? MIC_CONSTRAINTS : false })
      } catch (error) {
        const problem = mediaProblemFromError(error)
        if (!withMic || problem !== 'not_found') throw new CaptureError(problem, 'camera')
        // No microphone: the camera still records, without sound.
        try {
          opened.camera = await devices.getUserMedia({ video, audio: false })
          opened.micUnavailable = true
        } catch (second) {
          throw new CaptureError(mediaProblemFromError(second), 'camera')
        }
      }
    }
    if (mode === 'voice') {
      try {
        opened.mic = await devices.getUserMedia({ video: false, audio: MIC_CONSTRAINTS })
      } catch (error) {
        throw new CaptureError(mediaProblemFromError(error), 'microphone')
      }
    }
  }

  private buildCaptures(mode: RecordingMode, opened: Opened): Capture[] {
    const settingsOf = (stream: MediaStream | null) => stream?.getVideoTracks()[0]?.getSettings?.() ?? null
    return MODE_ROLES[mode].map((role): Capture => {
      if (role === 'screen') {
        const display = opened.display!
        // A screen take with a microphone records the screen picture and the microphone together.
        const stream = opened.mic ? new MediaStream([...display.getVideoTracks(), ...opened.mic.getAudioTracks()]) : display
        const settings = settingsOf(display)
        return { role, stream, requestedType: '', recorder: null, chunks: [], stopped: Promise.resolve(), width: settings?.width ?? null, height: settings?.height ?? null, hasAudio: stream.getAudioTracks().length > 0 }
      }
      if (role === 'camera') {
        const camera = opened.camera!
        const settings = settingsOf(camera)
        return { role, stream: camera, requestedType: '', recorder: null, chunks: [], stopped: Promise.resolve(), width: settings?.width ?? null, height: settings?.height ?? null, hasAudio: camera.getAudioTracks().length > 0 }
      }
      return { role, stream: opened.mic!, requestedType: '', recorder: null, chunks: [], stopped: Promise.resolve(), width: null, height: null, hasAudio: true }
    })
  }

  private deviceError(error: unknown): RecordingError {
    if (error instanceof CaptureError) return { kind: 'device', problem: error.problem, device: error.device }
    return { kind: 'device', problem: 'unknown', device: 'microphone' }
  }

  private releaseOpened(opened: Opened): void {
    for (const stream of [opened.display, opened.camera, opened.mic]) stopMediaStream(stream)
  }

  /** The user (or the browser's own "stop sharing" bar) ended a track. */
  private onTrackEnded = (): void => {
    if (this.state.phase === 'recording' || this.state.phase === 'paused') void this.stop()
    else if (this.state.phase === 'ready') this.cancel()
  }

  /** "Start recording": one `MediaRecorder` per file of the mode. */
  beginRecording(): void {
    if (this.state.phase !== 'ready') return
    const isTypeSupported = (type: string) => (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(type) : false)
    const apple = applePreferredBrowser()
    try {
      for (const capture of this.captures) {
        const type = pickRecorderType(capture.role, isTypeSupported, apple)
        capture.requestedType = type
        const options: MediaRecorderOptions = {
          ...(type && { mimeType: type }),
          ...(capture.role !== 'voice' && { videoBitsPerSecond: capture.role === 'screen' ? RECORDER_BITRATE.screenVideo : RECORDER_BITRATE.cameraVideo }),
          ...(capture.hasAudio && { audioBitsPerSecond: RECORDER_BITRATE.audio }),
        }
        let recorder: MediaRecorder
        try {
          recorder = new MediaRecorder(capture.stream, options)
        } catch {
          // The browser refused the options (an encoder it does not have): let it pick its own.
          recorder = new MediaRecorder(capture.stream)
        }
        capture.recorder = recorder
        capture.chunks = []
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) capture.chunks.push(event.data)
        }
        // T1R-10: a recorder that fails while recording keeps what it captured as an interrupted take; before the recording
        // started there is nothing to keep.
        recorder.onerror = () => (this.state.phase === 'recording' || this.state.phase === 'paused' ? void this.stop(false, true) : this.failRecording())
        // The recorder's own `stop` event (also fired when its tracks end by themselves) says its data is complete.
        capture.stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve()
        })
        recorder.start(TIMESLICE_MS)
      }
    } catch {
      this.failRecording()
      return
    }
    this.startedAt = this.now()
    this.activeSince = this.startedAt
    this.accumulatedMs = 0
    this.update({ phase: 'recording', elapsedMs: 0 })
    this.startTicker()
  }

  private startTicker(): void {
    this.stopTicker()
    this.ticker = setInterval(() => this.tick(), this.tickMs)
  }

  private stopTicker(): void {
    if (this.ticker !== null) clearInterval(this.ticker)
    this.ticker = null
  }

  private elapsedNow(): number {
    return Math.min(this.maxMs, this.accumulatedMs + (this.state.phase === 'recording' ? this.now() - this.activeSince : 0))
  }

  private tick(): void {
    if (this.state.phase !== 'recording') return
    const elapsed = this.elapsedNow()
    this.update({ elapsedMs: elapsed })
    if (elapsed >= this.maxMs) void this.stop(true)
  }

  pause(): void {
    if (this.state.phase !== 'recording') return
    for (const capture of this.captures) {
      try {
        capture.recorder?.pause()
      } catch {
        /* A recorder that cannot pause keeps recording; the clock still stops. */
      }
    }
    this.accumulatedMs += this.now() - this.activeSince
    this.stopTicker()
    this.update({ phase: 'paused', elapsedMs: Math.min(this.maxMs, this.accumulatedMs) })
  }

  resume(): void {
    if (this.state.phase !== 'paused') return
    for (const capture of this.captures) {
      try {
        capture.recorder?.resume()
      } catch {
        /* See pause(). */
      }
    }
    this.activeSince = this.now()
    this.update({ phase: 'recording' })
    this.startTicker()
  }

  /** Stops the recorders, releases every track and lands in `review` with the finished take. */
  async stop(hitLimit = false, interrupted = false): Promise<void> {
    if (this.state.phase !== 'recording' && this.state.phase !== 'paused') return
    const elapsed = this.elapsedNow()
    this.stopTicker()
    this.update({ phase: 'finishing', elapsedMs: elapsed })
    const captures = this.captures
    await Promise.all(captures.map((capture) => this.finishRecorder(capture)))
    // Cancelled while the recorders were still flushing: the take is gone.
    if (this.phase() !== 'finishing') return
    this.releaseCapture()
    const parts = captures.map((capture): RecordedPart => {
      const type = mimeForTake(capture.recorder?.mimeType ?? '', capture.requestedType, capture.role)
      const blob = new Blob(capture.chunks, { type })
      return {
        role: capture.role,
        blob,
        mimeType: type,
        extension: extensionForMime(type, capture.role),
        durationMs: elapsed,
        sizeBytes: blob.size,
        width: capture.width,
        height: capture.height,
        hasAudio: capture.hasAudio,
      }
    })
    this.captures = []
    if (parts.length === 0 || parts.some((part) => part.sizeBytes === 0)) {
      this.update({ phase: 'error', error: { kind: 'recorder' }, screenStream: null, cameraStream: null, hasMic: false })
      return
    }
    const take: RecordedTake = { takeId: this.uuid(), mode: this.state.mode!, parts, durationMs: elapsed, startedAt: this.startedAt, hitLimit, ...(interrupted && { interrupted: true }) }
    this.update({ phase: 'review', take, persist: null, elapsedMs: elapsed, screenStream: null, cameraStream: null, hasMic: false })
    // T1R-10: the take goes to Storage at once; adding it to the video is a separate step that reuses the upload.
    this.startPersist()
  }

  /** Stops the recorder (when it still runs) and waits for its last data: a recorder whose tracks ended stops by itself. */
  private async finishRecorder(capture: Capture): Promise<void> {
    const recorder = capture.recorder
    if (!recorder) return
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        return
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      capture.stopped,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, FINISH_TIMEOUT_MS)
      }),
    ])
    clearTimeout(timer)
  }

  private failRecording(): void {
    if (this.state.phase !== 'recording' && this.state.phase !== 'paused' && this.state.phase !== 'ready') return
    this.stopTicker()
    this.discardRecorders()
    this.releaseCapture()
    this.captures = []
    this.update({ phase: 'error', error: { kind: 'recorder' }, screenStream: null, cameraStream: null, hasMic: false })
  }

  private discardRecorders(): void {
    for (const capture of this.captures) {
      const recorder = capture.recorder
      if (!recorder) continue
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* Already stopped. */
      }
    }
  }

  /** Stops every track and the meter: nothing of the capture stays on. */
  private releaseCapture(): void {
    this.stopMeterFn?.()
    this.stopMeterFn = null
    for (const stream of this.owned) {
      for (const track of [...stream.getVideoTracks(), ...stream.getAudioTracks()]) track.removeEventListener('ended', this.onTrackEnded)
      stopMediaStream(stream)
    }
    this.owned = []
    this.setLevel(0)
  }

  /** Back to the mode list; whatever was opened or recorded is dropped. */
  cancel(): void {
    const phase = this.state.phase
    if (phase !== 'requesting' && phase !== 'ready' && phase !== 'recording' && phase !== 'paused' && phase !== 'finishing') return
    this.requestToken += 1
    this.stopTicker()
    this.discardRecorders()
    this.releaseCapture()
    this.captures = []
    this.update({ phase: 'idle', mode: null, elapsedMs: 0, screenStream: null, cameraStream: null, hasMic: false, micUnavailable: false, error: null })
  }

  /** Drops a finished take, a failure or the "saved" screen and returns to the mode list. */
  discard(): void {
    const phase = this.state.phase
    if (phase === 'saving') this.cancelSave()
    if (this.state.phase === 'review' || this.state.phase === 'error' || this.state.phase === 'saved' || this.state.phase === 'saving') {
      // An upload still running for the dropped take stops; what already reached "Recordings" stays there.
      this.persistAbort?.abort()
      this.update({ phase: 'idle', mode: null, take: null, persist: null, save: null, insertedSceneNumber: null, error: null, elapsedMs: 0, micUnavailable: false })
    }
  }

  /** Throws the take away and opens the same mode again (the "Retake" button). */
  async retake(): Promise<void> {
    const mode = this.state.mode
    if (this.state.phase !== 'review' || !mode) return
    this.discard()
    await this.start(mode)
  }

  /**
   * The drawer went away. Live capture must not outlive it: a recording that is running is stopped and kept as the take, an
   * open (not yet recording) capture is released. An upload in progress continues; it does not need the drawer.
   */
  releaseDevices(): void {
    const phase = this.state.phase
    if (phase === 'recording' || phase === 'paused') void this.stop()
    else if (phase === 'requesting' || phase === 'ready') this.cancel()
  }

  /**
   * The editor of another project replaced this session (T1R-10). A take that is still uploading into "Recordings" finishes
   * first (its files belong to the user and must not be cut off); everything else goes at once.
   */
  disposeWhenIdle(): void {
    if (this.persistFlight && this.state.persist?.status === 'uploading') {
      this.disposeWhenPersisted = true
      return
    }
    this.dispose()
  }

  /** Everything: used when the page goes away and by tests. */
  dispose(): void {
    this.cancel()
    this.saveAbort?.abort()
    this.saveAbort = null
    this.persistAbort?.abort()
    this.persistAbort = null
    this.persistFlight = null
    this.uploader = null
    this.insertFlights.clear()
    this.insertAttempted.clear()
    this.requestToken += 1
    if (this.guardOn && typeof window !== 'undefined') window.removeEventListener('beforeunload', this.onBeforeUnload)
    this.guardOn = false
    this.listeners.clear()
    this.levelListeners.clear()
    this.state = { ...INITIAL, maxMs: this.maxMs }
  }

  // ---------------------------------------------------------------- persist (T1R-10)

  /**
   * The upload of the take's files into "Recordings", set by the drawer (it knows the channel). A take already waiting in
   * `review` starts uploading as soon as an uploader is known; `limitMb` is the plan's per-file limit: a file over it is not
   * sent (it would be refused after the whole transfer) and the take stays downloadable instead.
   */
  setUploader(upload: RecordingUploader | null, limitMb: number | null = null): void {
    this.uploader = upload
    this.uploadLimitMb = limitMb
    if (upload && this.state.phase === 'review' && this.state.persist === null) this.startPersist()
  }

  /** Uploads the files of the take that are not in Storage yet; one flight at a time. Never throws. */
  startPersist(): void {
    const take = this.state.take
    const upload = this.uploader
    if (!take || !upload || this.persistFlight || this.state.persist?.status === 'saved') return
    if (oversizedPart(take.parts, this.uploadLimitMb) !== null) {
      this.update({ persist: { status: 'failed', failure: 'too_large', parts: this.persistParts(take) } })
      return
    }
    const controller = new AbortController()
    this.persistAbort = controller
    this.update({ persist: { status: 'uploading', failure: null, parts: this.persistParts(take) } })
    const flight = this.runPersist(take, upload, controller.signal).finally(() => {
      if (this.persistFlight === flight) this.persistFlight = null
      if (this.disposeWhenPersisted) this.dispose()
    })
    this.persistFlight = flight
  }

  /** The persist state of a take's parts: what already reached Storage keeps its ids. */
  private persistParts(take: RecordedTake): SavePartState[] {
    const previous = this.state.persist?.parts ?? []
    return take.parts.map((part, index) => {
      const old = previous[index]
      return {
        role: part.role,
        stage: old?.storageObjectId ? 'processing' : 'waiting',
        progress: old?.progress ?? 0,
        storageObjectId: old?.storageObjectId ?? null,
        checksumSha256: old?.checksumSha256 ?? null,
        sourceId: null,
        failure: null,
      }
    })
  }

  private patchPersist(takeId: string, patch: Partial<PersistState> & { part?: { index: number; patch: Partial<SavePartState> } }): void {
    const current = this.state.persist
    if (!current || this.state.take?.takeId !== takeId) return
    const parts = patch.part ? current.parts.map((entry, index) => (index === patch.part!.index ? { ...entry, ...patch.part!.patch } : entry)) : current.parts
    this.update({ persist: { status: patch.status ?? current.status, failure: patch.failure !== undefined ? patch.failure : current.failure, parts } })
  }

  private async runPersist(take: RecordedTake, upload: RecordingUploader, signal: AbortSignal): Promise<void> {
    const results = await Promise.allSettled(
      take.parts.map(async (part, index) => {
        if (this.state.persist?.parts[index]?.storageObjectId) return
        this.patchPersist(take.takeId, { part: { index, patch: { stage: 'uploading', progress: 0, failure: null } } })
        const result = await upload(part, {
          takeId: take.takeId,
          startedAt: take.startedAt,
          signal,
          onProgress: (percent) => this.patchPersist(take.takeId, { part: { index, patch: { progress: Math.max(0, Math.min(100, Math.round(percent))) } } }),
        })
        this.patchPersist(take.takeId, { part: { index, patch: { storageObjectId: result.storageObjectId, checksumSha256: result.checksumSha256, progress: 100, stage: 'processing' } } })
      }),
    )
    if (signal.aborted || this.state.take?.takeId !== take.takeId) return
    const failed = results.findIndex((outcome) => outcome.status === 'rejected')
    if (failed >= 0) {
      const reason = (results[failed] as PromiseRejectedResult).reason
      const failure: SaveFailure = reason instanceof RecordingSaveError ? reason.failure : 'upload_failed'
      this.patchPersist(take.takeId, { status: 'failed', failure, part: { index: failed, patch: { stage: 'failed', failure } } })
      return
    }
    this.patchPersist(take.takeId, { status: 'saved', failure: null })
  }

  /** "Try saving again" after a failed upload of the take. */
  retryPersist(): void {
    if (this.state.phase !== 'review' || this.state.persist?.status !== 'failed') return
    // The parts keep what already reached Storage: only the rest is sent.
    this.startPersist()
  }

  // ---------------------------------------------------------------- save

  private patchSave(patch: { step?: SaveStep; failure?: SaveFailure | null; part?: { index: number; patch: Partial<SavePartState> } }): void {
    const current = this.state.save
    if (!current) return
    const parts = patch.part ? current.parts.map((part, index) => (index === patch.part!.index ? { ...part, ...patch.part!.patch } : part)) : current.parts
    const next: SaveState = {
      step: patch.step ?? current.step,
      failure: patch.failure !== undefined ? patch.failure : current.failure,
      parts,
    }
    this.update({ save: next })
  }

  /**
   * Carries the take into the project: upload every file into Storage, bind it as a project source (waiting for the media
   * probe), insert it at the playhead. Resumable: a retry skips what already succeeded. Never throws.
   */
  async save(deps: RecordingSaveDeps): Promise<void> {
    const take = this.state.take
    const retry = this.state.phase === 'saving' && (this.state.save?.step === 'failed' || this.state.save?.step === 'stalled')
    if (!take || (this.state.phase !== 'review' && !retry)) return
    const controller = new AbortController()
    this.saveAbort = controller
    const { signal } = controller
    const previous = this.state.save?.parts ?? this.state.persist?.parts ?? []
    const parts: SavePartState[] = take.parts.map((part, index) => {
      const old = previous[index]
      return {
        role: part.role,
        stage: old?.storageObjectId ? (old.sourceId ? 'ready' : 'processing') : 'waiting',
        progress: old?.progress ?? 0,
        storageObjectId: old?.storageObjectId ?? null,
        checksumSha256: old?.checksumSha256 ?? null,
        sourceId: old?.sourceId ?? null,
        failure: null,
      }
    })
    this.update({ phase: 'saving', save: { step: 'uploading', failure: null, parts } })
    const fail = (failure: SaveFailure, index?: number) => {
      this.patchSave({ step: 'failed', failure, ...(index !== undefined && { part: { index, patch: { stage: 'failed', failure } } }) })
    }

    try {
      // 0. The take's own upload (T1R-10) may still be running: wait for it instead of sending the same files twice, then
      // take over what it stored.
      if (this.persistFlight) {
        await this.persistFlight
        if (signal.aborted) throw abortError()
        for (const [index, stored] of (this.state.persist?.parts ?? []).entries()) {
          if (stored.storageObjectId && !this.state.save?.parts[index]?.storageObjectId) {
            this.patchSave({ part: { index, patch: { storageObjectId: stored.storageObjectId, checksumSha256: stored.checksumSha256, progress: 100, stage: 'processing' } } })
          }
        }
      }
      // 1. Upload the files (parallel); a file that is already in Storage is not sent again.
      const uploads = await Promise.allSettled(
        take.parts.map(async (part, index) => {
          if (this.state.save?.parts[index]?.storageObjectId) return
          this.patchSave({ part: { index, patch: { stage: 'uploading', progress: 0, failure: null } } })
          const result = await deps.upload(part, {
            takeId: take.takeId,
            startedAt: take.startedAt,
            signal,
            onProgress: (percent) => this.patchSave({ part: { index, patch: { progress: Math.max(0, Math.min(100, Math.round(percent))) } } }),
          })
          this.patchSave({ part: { index, patch: { storageObjectId: result.storageObjectId, checksumSha256: result.checksumSha256, progress: 100, stage: 'processing' } } })
        }),
      )
      if (signal.aborted) throw abortError()
      const failed = uploads.findIndex((outcome) => outcome.status === 'rejected')
      if (failed >= 0) {
        const reason = (uploads[failed] as PromiseRejectedResult).reason
        fail(reason instanceof RecordingSaveError ? reason.failure : 'upload_failed', failed)
        return
      }

      // 2. Bind every file as a project source (the server probes video and audio first).
      this.patchSave({ step: 'processing' })
      for (let index = 0; index < take.parts.length; index += 1) {
        const entry = this.state.save?.parts[index]
        if (!entry || entry.sourceId) continue
        const attached = await deps.attach({ storageObjectId: entry.storageObjectId!, checksumSha256: entry.checksumSha256!, signal })
        if (signal.aborted) throw abortError()
        if (attached.status === 'ready') {
          this.patchSave({ part: { index, patch: { sourceId: attached.sourceId, stage: 'ready' } } })
        } else if (attached.status === 'awaiting_probe' || attached.status === 'timeout') {
          this.patchSave({ step: 'stalled', part: { index, patch: { stage: 'stalled' } } })
          return
        } else {
          fail(attachFailure(attached.reason), index)
          return
        }
      }

      // 3. Put the take on the timeline: one command, one undo group.
      this.patchSave({ step: 'inserting' })
      const sources: Partial<Record<RecordingRole, string>> = {}
      for (const entry of this.state.save?.parts ?? []) if (entry.sourceId) sources[entry.role] = entry.sourceId
      const inserted = await this.insertOnce(deps, take, sources)
      // The take was dropped while the insert ran (discard): nothing of it is shown again.
      if (this.state.take?.takeId !== take.takeId) return
      if (!inserted.applied) {
        if (signal.aborted) return
        fail('insert_failed')
        return
      }
      this.saveAbort = null
      this.update({ phase: 'saved', insertedSceneNumber: inserted.sceneNumber, take: null, persist: null, save: null, screenStream: null, cameraStream: null })
    } catch (error) {
      if (signal.aborted) return
      fail(error instanceof RecordingSaveError ? error.failure : 'upload_failed')
    }
  }

  /**
   * T1R-9: the take goes onto the timeline once. One insert per take at a time (a second save shares it), and a take whose
   * insert was tried before (cancelled, or its result lost) is looked for in the document first: an insert that applied
   * without telling is not repeated.
   */
  private async insertOnce(deps: RecordingSaveDeps, take: RecordedTake, sources: Partial<Record<RecordingRole, string>>): Promise<{ applied: boolean; sceneNumber: number | null }> {
    const running = this.insertFlights.get(take.takeId)
    if (running) return running
    if (this.insertAttempted.has(take.takeId) && deps.find) {
      let found: { sceneNumber: number | null } | null | undefined
      for (let attempt = 0; attempt < 2 && found === undefined; attempt += 1) found = await deps.find({ take, sources }).catch(() => undefined)
      // Cannot tell whether it is there: do not risk a second copy.
      if (found === undefined) return { applied: false, sceneNumber: null }
      if (found) return { applied: true, sceneNumber: found.sceneNumber }
    }
    this.insertAttempted.add(take.takeId)
    const flight = deps.insert({ take, sources }).finally(() => this.insertFlights.delete(take.takeId))
    this.insertFlights.set(take.takeId, flight)
    return flight
  }

  /** Stops a save in progress; the take stays in `review` (what already reached Storage is kept for the next try). */
  cancelSave(): void {
    if (this.state.phase !== 'saving') return
    // The insert is one command already on its way: it cannot be cancelled (T1R-9), only waited for.
    if (this.state.save?.step === 'inserting') return
    this.saveAbort?.abort()
    this.saveAbort = null
    this.update({ phase: 'review' })
  }
}

function attachFailure(reason: Extract<AttachResult, { status: 'failed' }>['reason']): SaveFailure {
  switch (reason) {
    case 'not_ready':
      return 'not_ready'
    case 'probe_invalid':
      return 'probe_invalid'
    case 'too_long':
      return 'too_long'
    case 'forbidden':
    case 'not_active':
      return 'forbidden'
    default:
      return 'attach_failed'
  }
}

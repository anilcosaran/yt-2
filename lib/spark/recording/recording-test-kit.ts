import { vi } from 'vitest'

/**
 * Test kit of the recorder: fakes of `MediaStreamTrack`, `MediaStream`, `MediaRecorder`, `getDisplayMedia` and
 * `getUserMedia` for happy-dom (which has none of them). Nothing here touches a device; every fake records what the code
 * under test did to it (tracks stopped, recorders started / paused / stopped).
 */

export class FakeTrack extends EventTarget {
  readonly kind: 'video' | 'audio'
  readyState: 'live' | 'ended' = 'live'
  private readonly settings: MediaTrackSettings

  constructor(kind: 'video' | 'audio', settings: MediaTrackSettings = {}) {
    super()
    this.kind = kind
    this.settings = settings
  }

  stop(): void {
    this.readyState = 'ended'
  }

  getSettings(): MediaTrackSettings {
    return this.settings
  }

  /** The user ends the track (the browser's "Stop sharing" bar, an unplugged device). */
  end(): void {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

/**
 * happy-dom only accepts ITS `MediaStream` as `video.srcObject`, so the fake extends it where it exists (the happy-dom
 * environment) and stands alone elsewhere.
 */
const StreamBase = ((globalThis as { MediaStream?: new (...args: never[]) => object }).MediaStream ?? class {}) as new (...args: never[]) => object

export class FakeStream extends StreamBase {
  private readonly tracks: FakeTrack[]

  constructor(tracks: ReadonlyArray<FakeTrack> = []) {
    super()
    this.tracks = [...tracks]
  }

  getTracks(): FakeTrack[] {
    return [...this.tracks]
  }

  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'video')
  }

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio')
  }

  get live(): boolean {
    return this.tracks.some((track) => track.readyState === 'live')
  }
}

export class FakeRecorder {
  static instances: FakeRecorder[] = []
  static supported: string[] = ['video/webm;codecs=vp9,opus', 'video/webm', 'audio/webm;codecs=opus', 'audio/webm']
  /** Bytes the next `stop()` delivers per recorder (0 = an empty take). */
  static bytesOnStop = 4096
  /** Milliseconds between `stop()` and the recorder's last data + `stop` event (0 = at once, Infinity = never). */
  static stopDelayMs = 0

  static isTypeSupported(type: string): boolean {
    return FakeRecorder.supported.includes(type)
  }

  readonly stream: FakeStream
  readonly options: MediaRecorderOptions
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  mimeType: string
  timeslice: number | undefined
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  calls: string[] = []

  constructor(stream: FakeStream, options: MediaRecorderOptions = {}) {
    this.stream = stream
    this.options = options
    this.mimeType = options.mimeType ?? (stream.getVideoTracks().length > 0 ? 'video/webm' : 'audio/webm')
    FakeRecorder.instances.push(this)
  }

  start(timeslice?: number): void {
    this.calls.push('start')
    this.timeslice = timeslice
    this.state = 'recording'
  }

  pause(): void {
    this.calls.push('pause')
    this.state = 'paused'
  }

  resume(): void {
    this.calls.push('resume')
    this.state = 'recording'
  }

  stop(): void {
    this.calls.push('stop')
    this.state = 'inactive'
    const finish = () => {
      if (FakeRecorder.bytesOnStop > 0) this.ondataavailable?.({ data: new Blob([new Uint8Array(FakeRecorder.bytesOnStop)], { type: this.mimeType }) })
      this.onstop?.()
    }
    if (FakeRecorder.stopDelayMs === 0) finish()
    else if (Number.isFinite(FakeRecorder.stopDelayMs)) setTimeout(finish, FakeRecorder.stopDelayMs)
  }

  /** A `MediaRecorder` error event. */
  fail(): void {
    this.onerror?.()
  }
}

export type MediaMocks = {
  getDisplayMedia: ReturnType<typeof vi.fn>
  getUserMedia: ReturnType<typeof vi.fn>
  /** Every stream the fakes handed out, in order. */
  streams: FakeStream[]
  recorders: () => FakeRecorder[]
  /** Every track of every stream handed out. */
  tracks: () => FakeTrack[]
  restore: () => void
}

export type MediaMockOptions = {
  displaySize?: { width: number; height: number }
  cameraSize?: { width: number; height: number }
  /** Make getUserMedia reject for the requested kinds (a missing or blocked device). */
  rejectUserMedia?: (constraints: MediaStreamConstraints) => { name: string } | null
  rejectDisplayMedia?: { name: string } | null
}

function domError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

/** Installs the fakes on `navigator.mediaDevices`, `MediaStream` and `MediaRecorder`; call `restore()` after the test. */
export function installMediaMocks(options: MediaMockOptions = {}): MediaMocks {
  const streams: FakeStream[] = []
  FakeRecorder.instances = []
  FakeRecorder.bytesOnStop = 4096
  FakeRecorder.stopDelayMs = 0
  FakeRecorder.supported = ['video/webm;codecs=vp9,opus', 'video/webm', 'audio/webm;codecs=opus', 'audio/webm']
  const make = (tracks: FakeTrack[]) => {
    const stream = new FakeStream(tracks)
    streams.push(stream)
    return stream
  }
  const getDisplayMedia = vi.fn(async () => {
    if (options.rejectDisplayMedia) throw domError(options.rejectDisplayMedia.name)
    const size = options.displaySize ?? { width: 1920, height: 1080 }
    return make([new FakeTrack('video', size)])
  })
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const rejected = options.rejectUserMedia?.(constraints)
    if (rejected) throw domError(rejected.name)
    const size = options.cameraSize ?? { width: 1280, height: 720 }
    return make([...(constraints.video ? [new FakeTrack('video', size)] : []), ...(constraints.audio ? [new FakeTrack('audio')] : [])])
  })

  const previousDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia, getUserMedia } })
  vi.stubGlobal('MediaStream', FakeStream)
  vi.stubGlobal('MediaRecorder', FakeRecorder)

  return {
    getDisplayMedia,
    getUserMedia,
    streams,
    recorders: () => FakeRecorder.instances,
    tracks: () => streams.flatMap((stream) => stream.getTracks()),
    restore() {
      vi.unstubAllGlobals()
      if (previousDevices) Object.defineProperty(navigator, 'mediaDevices', previousDevices)
      else delete (navigator as unknown as Record<string, unknown>)['mediaDevices']
      FakeRecorder.instances = []
    },
  }
}

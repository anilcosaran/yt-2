/**
 * E1-F Record (D7): the vocabulary of the browser recorder of the Spark editor. A recording is a TAKE of one or two files:
 * Screen, Camera and Voice produce one file, Screen + camera TWO separate files (the screen and the camera, the camera is
 * placed as a small movable corner clip afterwards). Everything here is plain data; the browser APIs live in
 * `recording-session.ts`.
 */

/** Hard cap of one take (D7): the recorder stops by itself when the recorded time reaches it. */
export const RECORDING_MAX_MS = 10 * 60 * 1000
/** From this much remaining time on the countdown is shown as a warning. */
export const RECORDING_WARN_MS = 60 * 1000
/** The Storage folder every take is uploaded into (D7). */
export const RECORDINGS_FOLDER = 'Recordings'

export type RecordingMode = 'screen' | 'camera' | 'screen_camera' | 'voice'
export type RecordingRole = 'screen' | 'camera' | 'voice'

/** The files a mode produces, in the order they are inserted (the camera clip goes ABOVE the screen clip). */
export const MODE_ROLES: Readonly<Record<RecordingMode, readonly RecordingRole[]>> = {
  screen: ['screen'],
  camera: ['camera'],
  screen_camera: ['screen', 'camera'],
  voice: ['voice'],
}

/** One recorded file of a take. `blob.type` is the base media type (no codec parameters). */
export type RecordedPart = {
  role: RecordingRole
  blob: Blob
  /** Base media type, e.g. `video/webm`. */
  mimeType: string
  /** File extension without the dot (`webm`, `weba`, `mp4`, `m4a`). */
  extension: string
  durationMs: number
  sizeBytes: number
  /** Pixel size of the captured video (null for audio, or when the browser did not tell). */
  width: number | null
  height: number | null
  hasAudio: boolean
}

export type RecordedTake = {
  takeId: string
  mode: RecordingMode
  parts: RecordedPart[]
  /** Recorded time (pauses excluded). */
  durationMs: number
  /** Epoch milliseconds the take started (names the files). */
  startedAt: number
  /** The recorder stopped because the 10-minute limit was reached. */
  hitLimit: boolean
  /** T1R-10: the recorder failed while recording; this is what was captured until then. */
  interrupted?: boolean
}

export type RecordingDevice = 'screen' | 'camera' | 'microphone'
export type RecordingProblem = 'insecure' | 'unsupported' | 'denied' | 'not_found' | 'busy' | 'unknown'

export type RecordingError =
  /** A permission prompt, device or API refused (mapped from the DOM exception). */
  | { kind: 'device'; problem: RecordingProblem; device: RecordingDevice }
  /** `MediaRecorder` failed, or the take came out empty. */
  | { kind: 'recorder' }

export type SaveFailure =
  | 'too_large'
  | 'unsupported_type'
  | 'upload_failed'
  | 'not_ready'
  | 'probe_invalid'
  /** Y1R-TOOLS-4: the gateway refused the source as longer than the plan (or the recorder's 10 minutes) allows. */
  | 'too_long'
  | 'attach_failed'
  | 'forbidden'
  | 'insert_failed'

/** A save step failed with a reason the drawer can name. */
export class RecordingSaveError extends Error {
  readonly failure: SaveFailure
  constructor(failure: SaveFailure, options?: { cause?: unknown }) {
    super(`recording save failed: ${failure}`, options)
    this.name = 'RecordingSaveError'
    this.failure = failure
  }
}

export type SaveStage = 'waiting' | 'uploading' | 'processing' | 'stalled' | 'ready' | 'failed'

/** Where one file of the take is on its way into the project (upload -> Storage object -> project source). */
export type SavePartState = {
  role: RecordingRole
  stage: SaveStage
  /** 0..100 of the upload. */
  progress: number
  storageObjectId: string | null
  checksumSha256: string | null
  sourceId: string | null
  failure: SaveFailure | null
}

export type SaveStep = 'uploading' | 'processing' | 'inserting' | 'stalled' | 'failed'
export type SaveState = { step: SaveStep; parts: SavePartState[]; failure: SaveFailure | null }

/**
 * T1R-10: the take is uploaded into the Storage folder "Recordings" the moment the recording stops, before the user decides
 * to add it, so a reload, a project switch or a closed tab does not lose it (server persistence, never browser storage).
 * Adding it to the video is a separate step that reuses these uploads.
 */
export type PersistState = { status: 'uploading' | 'saved' | 'failed'; parts: SavePartState[]; failure: SaveFailure | null }

export type RecordingPhase =
  | 'idle'
  /** The permission prompts / the screen picker are open. */
  | 'requesting'
  /** Devices are open: live preview and microphone meter, waiting for "Start recording". */
  | 'ready'
  | 'recording'
  | 'paused'
  /** `MediaRecorder` is flushing its last data. */
  | 'finishing'
  | 'review'
  /** Upload, attach and insert are running. */
  | 'saving'
  | 'saved'
  | 'error'

export type RecordingSnapshot = {
  phase: RecordingPhase
  mode: RecordingMode | null
  /** The microphone option of Screen / Camera / Screen + camera (a change applies to the next capture). */
  withMic: boolean
  /** Recorded time so far (pauses excluded). */
  elapsedMs: number
  maxMs: number
  /** Live streams for the preview (null for roles the mode does not capture). */
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  /** A stream carries the microphone (the meter reads it). */
  hasMic: boolean
  /** The microphone could not be opened, so the recording has no sound (Screen / Camera only). */
  micUnavailable: boolean
  take: RecordedTake | null
  /** T1R-10: the take's own upload into "Recordings" (null until a take exists and an uploader is configured). */
  persist: PersistState | null
  save: SaveState | null
  /** Strip position (1-based) of the scene the take was added to (phase `saved`). */
  insertedSceneNumber: number | null
  error: RecordingError | null
}

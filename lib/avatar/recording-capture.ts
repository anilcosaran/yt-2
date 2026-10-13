/**
 * Pure helpers for the two-step avatar capture (identity photo + voice sample).
 * Kept framework-free so the upload payloads, resume rules and media choices can be unit tested.
 */

export const RECORDING_CAPTURE_KINDS = ['identity_image', 'voice_sample'] as const
export type RecordingCaptureKind = (typeof RECORDING_CAPTURE_KINDS)[number]

export const RECORDING_CAPTURE_STEP_STATES = ['pending', 'uploading', 'uploaded'] as const
export type RecordingCaptureStepState = (typeof RECORDING_CAPTURE_STEP_STATES)[number]

export type RecordingCaptureStepsState = Partial<
  Record<RecordingCaptureKind, RecordingCaptureStepState | null | undefined>
>

export const CAPTURE_DEFAULTS = {
  voiceMinSeconds: 8,
  voiceMaxSeconds: 10,
  imageMaxBytes: 15 * 1024 * 1024,
  voiceMaxBytes: 5 * 1024 * 1024,
  photoMaxEdge: 2048,
  photoQuality: 0.92,
} as const

/** Gateway-side bounds for `duration_ms` on voice uploads. */
export const VOICE_DURATION_MS_LIMITS = { min: 4000, max: 16000 } as const

const EXT_BY_MIME: Record<RecordingCaptureKind, Record<string, string>> = {
  identity_image: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  },
  voice_sample: {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
  },
}

const MIME_BY_EXT: Record<RecordingCaptureKind, Record<string, string>> = {
  identity_image: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  },
  voice_sample: {
    webm: 'audio/webm',
    weba: 'audio/webm',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
  },
}

/** Some recorders label audio-only containers with a video/* type. */
const MIME_ALIASES: Record<RecordingCaptureKind, Record<string, string>> = {
  identity_image: { 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg' },
  voice_sample: {
    'video/webm': 'audio/webm',
    'video/mp4': 'audio/mp4',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/mp3': 'audio/mpeg',
    'audio/wave': 'audio/wav',
    'audio/vnd.wave': 'audio/wav',
    'application/ogg': 'audio/ogg',
  },
}

const DEFAULT_MIME: Record<RecordingCaptureKind, string> = {
  identity_image: 'image/jpeg',
  voice_sample: 'audio/webm',
}

const DEFAULT_BASENAME: Record<RecordingCaptureKind, string> = {
  identity_image: 'avatar-photo',
  voice_sample: 'avatar-voice',
}

export function baseMimeType(value: string | null | undefined): string {
  return (value ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
}

export function isCaptureMimeAllowed(kind: RecordingCaptureKind, mimeType: string | null | undefined): boolean {
  return Boolean(EXT_BY_MIME[kind][baseMimeType(mimeType)])
}

export type CaptureUploadIdentity = {
  fileName: string
  mimeType: string
}

/** Gives a capture file a name/extension and base mime type the gateway accepts for its kind. */
export function captureUploadIdentity(
  file: Pick<File, 'name' | 'type'>,
  kind: RecordingCaptureKind,
): CaptureUploadIdentity {
  const declared = baseMimeType(file.type)
  const aliased = MIME_ALIASES[kind][declared] ?? declared
  const originalName = (file.name ?? '').trim()
  const extMatch = originalName.match(/\.([a-z0-9]+)$/i)
  const nameExt = (extMatch?.[1] ?? '').toLowerCase()

  let mimeType = EXT_BY_MIME[kind][aliased] ? aliased : ''
  if (!mimeType && MIME_BY_EXT[kind][nameExt]) mimeType = MIME_BY_EXT[kind][nameExt]
  if (!mimeType) mimeType = DEFAULT_MIME[kind]

  const ext = EXT_BY_MIME[kind][mimeType] ?? EXT_BY_MIME[kind][DEFAULT_MIME[kind]]
  const base = originalName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[._-]+/, '') || DEFAULT_BASENAME[kind]
  return { fileName: `${base}.${ext}`, mimeType }
}

export function alignCaptureUploadFile(file: File, kind: RecordingCaptureKind): File {
  const identity = captureUploadIdentity(file, kind)
  if (file.name === identity.fileName && file.type === identity.mimeType) {
    return file
  }
  return new File([file], identity.fileName, {
    type: identity.mimeType,
    lastModified: file.lastModified,
  })
}

export function captureFileFromBlob(blob: Blob, kind: RecordingCaptureKind, fallbackMime?: string): File {
  const type = baseMimeType(blob.type) || baseMimeType(fallbackMime) || DEFAULT_MIME[kind]
  const source = new File([blob], DEFAULT_BASENAME[kind], { type, lastModified: Date.now() })
  return alignCaptureUploadFile(source, kind)
}

export type CaptureFileProblem = 'empty' | 'too_large' | 'unsupported_type'

export function validateCaptureFile(
  file: Pick<File, 'size' | 'type'>,
  kind: RecordingCaptureKind,
  limits: { imageMaxBytes?: number | null; voiceMaxBytes?: number | null } = {},
): CaptureFileProblem | null {
  if (!file.size || file.size <= 0) return 'empty'
  const maxBytes = kind === 'identity_image'
    ? positiveOr(limits.imageMaxBytes, CAPTURE_DEFAULTS.imageMaxBytes)
    : positiveOr(limits.voiceMaxBytes, CAPTURE_DEFAULTS.voiceMaxBytes)
  if (file.size > maxBytes) return 'too_large'
  if (!isCaptureMimeAllowed(kind, file.type)) return 'unsupported_type'
  return null
}

/** Rounds a measured voice duration; values above the gateway ceiling are clamped. */
export function normalizeVoiceDurationMs(durationMs: number | null | undefined): number | undefined {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return undefined
  return Math.min(Math.round(durationMs), VOICE_DURATION_MS_LIMITS.max)
}

export type PublicRecordingUploadBody = {
  file_name: string
  size_bytes: number
  mime_type: string
  checksum_sha256: string
  idempotency_key: string
  capture_kind: RecordingCaptureKind
  duration_ms?: number
}

export function buildPublicRecordingUploadBody(input: {
  fileName: string
  sizeBytes: number
  mimeType: string
  checksumSha256: string
  idempotencyKey: string
  captureKind: RecordingCaptureKind
  durationMs?: number | null
}): PublicRecordingUploadBody {
  const body: PublicRecordingUploadBody = {
    file_name: input.fileName,
    size_bytes: input.sizeBytes,
    mime_type: baseMimeType(input.mimeType) || DEFAULT_MIME[input.captureKind],
    checksum_sha256: input.checksumSha256,
    idempotency_key: input.idempotencyKey,
    capture_kind: input.captureKind,
  }
  if (input.captureKind === 'voice_sample') {
    const durationMs = normalizeVoiceDurationMs(input.durationMs)
    if (durationMs !== undefined) body.duration_ms = durationMs
  }
  return body
}

export type PublicRecordingCompleteBody = {
  upload_session_id: string
  finalize_token?: string | null
  consent_accepted: true
  capture_kind: RecordingCaptureKind
}

export function buildPublicRecordingCompleteBody(input: {
  uploadSessionId: string
  finalizeToken?: string | null
  consentAccepted: true
  captureKind: RecordingCaptureKind
}): PublicRecordingCompleteBody {
  return {
    upload_session_id: input.uploadSessionId,
    finalize_token: input.finalizeToken,
    consent_accepted: input.consentAccepted,
    capture_kind: input.captureKind,
  }
}

/** Flattens a session snapshot's `steps` object into plain step states. */
export function captureStepsFromSnapshot(
  steps: Partial<Record<RecordingCaptureKind, { state?: string | null } | null | undefined>> | null | undefined,
): RecordingCaptureStepsState {
  const read = (kind: RecordingCaptureKind): RecordingCaptureStepState => {
    const state = steps?.[kind]?.state
    return state === 'uploaded' || state === 'uploading' ? state : 'pending'
  }
  return { identity_image: read('identity_image'), voice_sample: read('voice_sample') }
}

export function isCaptureStepUploaded(steps: RecordingCaptureStepsState | null | undefined, kind: RecordingCaptureKind) {
  return steps?.[kind] === 'uploaded'
}

export type CaptureStartStep = 'photo' | 'voice' | 'done'

/**
 * Where a (re)opened capture should start: finished sessions show success, an uploaded photo
 * resumes at the voice step, otherwise the photo step comes first.
 */
export function resolveCaptureStartStep(
  steps: RecordingCaptureStepsState | null | undefined,
  sessionState?: string | null,
): CaptureStartStep {
  if (sessionState === 'uploaded' || sessionState === 'consumed') return 'done'
  const photoDone = isCaptureStepUploaded(steps, 'identity_image')
  const voiceDone = isCaptureStepUploaded(steps, 'voice_sample')
  if (photoDone && voiceDone) return 'done'
  if (photoDone) return 'voice'
  return 'photo'
}

/** Upload order is always photo first, then voice; already-uploaded kinds are skipped. */
export function pendingCaptureUploads(
  uploaded: ReadonlySet<RecordingCaptureKind> | ReadonlyArray<RecordingCaptureKind>,
): RecordingCaptureKind[] {
  const done = new Set(uploaded)
  return RECORDING_CAPTURE_KINDS.filter((kind) => !done.has(kind))
}

/** Weighted overall progress (0-100) across sequential uploads, weighted by byte size. */
export function combinedUploadProgress(
  items: ReadonlyArray<{ bytes: number; progress: number }>,
): number {
  const total = items.reduce((sum, item) => sum + Math.max(1, item.bytes), 0)
  if (total <= 0) return 0
  const done = items.reduce(
    (sum, item) => sum + Math.max(1, item.bytes) * clamp(item.progress, 0, 100) / 100,
    0,
  )
  return Math.round(clamp((done / total) * 100, 0, 100))
}

const APPLE_AUDIO_RECORDER_MIME_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
] as const

const GENERIC_AUDIO_RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
] as const

/** Returns the first supported audio container, or '' to let the browser choose. */
export function preferredAudioRecorderMimeType(
  isTypeSupported: (type: string) => boolean,
  applePreferred: boolean,
): string {
  const candidates = applePreferred
    ? [...APPLE_AUDIO_RECORDER_MIME_TYPES, ...GENERIC_AUDIO_RECORDER_MIME_TYPES]
    : [...GENERIC_AUDIO_RECORDER_MIME_TYPES, ...APPLE_AUDIO_RECORDER_MIME_TYPES]
  return candidates.find((type) => {
    try {
      return isTypeSupported(type)
    } catch {
      return false
    }
  }) ?? ''
}

/** Scales `width x height` down (never up) so the long edge is at most `maxEdge`. */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number = CAPTURE_DEFAULTS.photoMaxEdge,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width || 1))
  const safeHeight = Math.max(1, Math.round(height || 1))
  const scale = Math.min(1, Math.max(1, maxEdge) / Math.max(safeWidth, safeHeight))
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

/** Maps time-domain samples (-1..1) to a 0..1 meter value on a -60 dB..0 dB scale. */
export function audioMeterLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0
    sum += value * value
  }
  const rms = Math.sqrt(sum / samples.length)
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  return clamp((db + 60) / 60, 0, 1)
}

/** `m:ss` clock used by the voice timer. */
export function formatCaptureClock(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function resolveVoiceLimits(input: { minSeconds?: number | null; maxSeconds?: number | null } = {}) {
  const maxSeconds = clamp(
    positiveOr(input.maxSeconds, CAPTURE_DEFAULTS.voiceMaxSeconds),
    1,
    VOICE_DURATION_MS_LIMITS.max / 1000,
  )
  const minSeconds = clamp(
    positiveOr(input.minSeconds, CAPTURE_DEFAULTS.voiceMinSeconds),
    Math.ceil(VOICE_DURATION_MS_LIMITS.min / 1000),
    maxSeconds,
  )
  return { minMs: minSeconds * 1000, maxMs: maxSeconds * 1000, minSeconds, maxSeconds }
}

function positiveOr(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

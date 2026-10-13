export const DEFAULT_VOICE_REFERENCE_MIN_SECONDS = 5
export const DEFAULT_VOICE_REFERENCE_MAX_SECONDS = 30
export const DEFAULT_VOICE_REFERENCE_MAX_BYTES = 50 * 1024 * 1024
export const MAX_BROWSER_VOICE_REFERENCE_SOURCE_BYTES = 100 * 1024 * 1024

const WAV_MIME_TYPE = 'audio/wav'
const TIME_PRECISION = 1_000

export type VoiceReferenceTrimConstraints = {
  minSeconds: number
  maxSeconds: number
  maxBytes: number
  acceptedContentTypes: string[]
  acceptsWav: boolean
}

export type VoiceReferenceTrimRange = {
  startSeconds: number
  endSeconds: number
}

export type VoiceReferenceTrimAnchor = 'start' | 'end' | 'both'

export type EncodedVoiceReferenceWav = {
  blob: Blob
  durationSeconds: number
  frameCount: number
  sampleRate: number
  byteLength: number
}

export function readVoiceReferenceTrimConstraints(
  inputSchema: Record<string, unknown> | null | undefined,
): VoiceReferenceTrimConstraints {
  const schema = inputSchema ?? {}
  const minSeconds = positiveNumber(schema.min_reference_audio_seconds)
    ?? positiveNumber(schema.min_reference_duration_seconds)
    ?? positiveNumber(schema.reference_audio_min_seconds)
    ?? DEFAULT_VOICE_REFERENCE_MIN_SECONDS
  const maxCandidate = positiveNumber(schema.max_reference_audio_seconds)
    ?? positiveNumber(schema.max_reference_duration_seconds)
    ?? positiveNumber(schema.reference_audio_max_seconds)
    ?? DEFAULT_VOICE_REFERENCE_MAX_SECONDS
  const maxSeconds = Math.max(minSeconds, maxCandidate)
  const maxBytes = positiveInteger(schema.max_reference_bytes)
    ?? DEFAULT_VOICE_REFERENCE_MAX_BYTES
  const acceptedContentTypes = Array.isArray(schema.reference_content_types)
    ? [...new Set(schema.reference_content_types
      .map(normalizeContentType)
      .filter((value): value is string => Boolean(value)))]
    : []

  return {
    minSeconds,
    maxSeconds,
    maxBytes,
    acceptedContentTypes,
    acceptsWav: acceptedContentTypes.length === 0 || acceptedContentTypes.includes(WAV_MIME_TYPE),
  }
}

export function createInitialVoiceReferenceTrimRange(
  sourceDurationSeconds: number,
  constraints: VoiceReferenceTrimConstraints,
): VoiceReferenceTrimRange {
  const duration = finiteNonNegative(sourceDurationSeconds)
  return {
    startSeconds: 0,
    endSeconds: roundTime(Math.min(duration, constraints.maxSeconds)),
  }
}

export function normalizeVoiceReferenceTrimRange(input: {
  range: VoiceReferenceTrimRange
  sourceDurationSeconds: number
  constraints: VoiceReferenceTrimConstraints
  anchor?: VoiceReferenceTrimAnchor
}): VoiceReferenceTrimRange {
  const duration = finiteNonNegative(input.sourceDurationSeconds)
  if (duration === 0) return { startSeconds: 0, endSeconds: 0 }

  const minimum = Math.min(input.constraints.minSeconds, duration)
  const maximum = Math.min(Math.max(minimum, input.constraints.maxSeconds), duration)
  let start = clamp(finiteNonNegative(input.range.startSeconds), 0, duration)
  let end = clamp(finiteNonNegative(input.range.endSeconds), 0, duration)
  if (end < start) [start, end] = [end, start]

  const anchor = input.anchor ?? 'both'
  if (anchor === 'start') {
    start = clamp(start, Math.max(0, end - maximum), Math.max(0, end - minimum))
  } else if (anchor === 'end') {
    end = clamp(end, Math.min(duration, start + minimum), Math.min(duration, start + maximum))
  } else {
    if (end - start > maximum) end = start + maximum
    if (end - start < minimum) {
      end = Math.min(duration, start + minimum)
      start = Math.max(0, end - minimum)
    }
  }

  return {
    startSeconds: roundTime(start),
    endSeconds: roundTime(end),
  }
}

export function validateVoiceReferenceTrimRange(input: {
  range: VoiceReferenceTrimRange
  sourceDurationSeconds: number
  constraints: VoiceReferenceTrimConstraints
}): string | null {
  const duration = finiteNonNegative(input.sourceDurationSeconds)
  const start = input.range.startSeconds
  const end = input.range.endSeconds
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 0.001) {
    return 'Choose a valid part of the recording.'
  }
  const selectedDuration = end - start
  if (selectedDuration + 0.001 < input.constraints.minSeconds) {
    return `Select at least ${formatVoiceReferenceTime(input.constraints.minSeconds)} of audio.`
  }
  if (selectedDuration - 0.001 > input.constraints.maxSeconds) {
    return `Select no more than ${formatVoiceReferenceTime(input.constraints.maxSeconds)} of audio.`
  }
  if (!input.constraints.acceptsWav) {
    return 'The selected voice model does not accept the WAV clip created by this editor.'
  }
  return null
}

export function buildVoiceReferenceWaveformPeaks(
  channels: readonly Float32Array[],
  binCount = 96,
): number[] {
  const normalizedBinCount = Math.max(1, Math.min(512, Math.trunc(binCount)))
  const frameCount = shortestChannelLength(channels)
  if (frameCount === 0) return Array.from({ length: normalizedBinCount }, () => 0)

  const peaks = Array.from({ length: normalizedBinCount }, (_, binIndex) => {
    const start = Math.floor((binIndex * frameCount) / normalizedBinCount)
    const end = Math.max(start + 1, Math.floor(((binIndex + 1) * frameCount) / normalizedBinCount))
    let peak = 0
    for (let frame = start; frame < Math.min(end, frameCount); frame += 1) {
      let mixed = 0
      for (const channel of channels) mixed += Math.abs(channel[frame] ?? 0)
      peak = Math.max(peak, mixed / channels.length)
    }
    return peak
  })
  const maximum = Math.max(...peaks, 0)
  if (maximum <= 0) return peaks
  return peaks.map((peak) => Math.min(1, peak / maximum))
}

export function encodeVoiceReferenceMonoPcm16Wav(input: {
  channels: readonly Float32Array[]
  sampleRate: number
  range: VoiceReferenceTrimRange
}): EncodedVoiceReferenceWav {
  const sampleRate = positiveInteger(input.sampleRate)
  if (!sampleRate) throw new Error('Audio sample rate is unavailable.')
  const sourceFrameCount = shortestChannelLength(input.channels)
  if (sourceFrameCount === 0) throw new Error('Audio samples are unavailable.')

  const startFrame = clamp(
    Math.floor(input.range.startSeconds * sampleRate),
    0,
    sourceFrameCount,
  )
  const endFrame = clamp(
    Math.ceil(input.range.endSeconds * sampleRate),
    startFrame,
    sourceFrameCount,
  )
  const frameCount = endFrame - startFrame
  if (frameCount <= 0) throw new Error('The selected audio clip is empty.')

  const byteLength = 44 + frameCount * 2
  const buffer = new ArrayBuffer(byteLength)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, byteLength - 8, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, frameCount * 2, true)

  let offset = 44
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    let mixed = 0
    for (const channel of input.channels) mixed += channel[frame] ?? 0
    mixed = clamp(mixed / input.channels.length, -1, 1)
    const pcm = mixed < 0 ? Math.round(mixed * 0x8000) : Math.round(mixed * 0x7fff)
    view.setInt16(offset, pcm, true)
    offset += 2
  }

  return {
    blob: new Blob([buffer], { type: WAV_MIME_TYPE }),
    durationSeconds: frameCount / sampleRate,
    frameCount,
    sampleRate,
    byteLength,
  }
}

export function buildVoiceReferenceClipMetadata(input: {
  sourceStorageObjectId?: string | null
  sourceFileName: string
  sourceDurationSeconds: number
  range: VoiceReferenceTrimRange
  encodedDurationSeconds: number
  sampleRate: number
}): Record<string, string | number | boolean | null> {
  return {
    asset_role: 'voice_reference',
    asset_kind: 'voice_reference',
    origin_node_type: 'voice_clone@1',
    reference_trimmed: true,
    source_storage_object_id: input.sourceStorageObjectId?.trim() || null,
    source_file_name: input.sourceFileName,
    source_duration_seconds: roundTime(input.sourceDurationSeconds),
    trim_start_seconds: roundTime(input.range.startSeconds),
    trim_end_seconds: roundTime(input.range.endSeconds),
    reference_duration_seconds: roundTime(input.encodedDurationSeconds),
    audio_sample_rate_hz: Math.trunc(input.sampleRate),
    audio_channels: 1,
  }
}

export function createVoiceReferenceClipFileName(
  sourceFileName: string,
  range: VoiceReferenceTrimRange,
): string {
  const withoutExtension = sourceFileName.replace(/\.[^.]+$/, '')
  const safeStem = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'voice-reference'
  const startMs = Math.max(0, Math.round(range.startSeconds * 1_000))
  const endMs = Math.max(startMs, Math.round(range.endSeconds * 1_000))
  return `${safeStem}-clip-${startMs}-${endMs}.wav`
}

export function formatVoiceReferenceTime(value: number): string {
  const seconds = Math.max(0, finiteNonNegative(value))
  const wholeMinutes = Math.floor(seconds / 60)
  const remaining = seconds - wholeMinutes * 60
  if (wholeMinutes > 0) return `${wholeMinutes}:${remaining.toFixed(1).padStart(4, '0')}`
  return `${remaining.toFixed(1)}s`
}

function shortestChannelLength(channels: readonly Float32Array[]): number {
  if (channels.length === 0) return 0
  return Math.min(...channels.map((channel) => channel.length))
}

function normalizeContentType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase()
  return normalized || null
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function positiveInteger(value: unknown): number | null {
  const number = positiveNumber(value)
  return number === null ? null : Math.trunc(number)
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundTime(value: number): number {
  return Math.round(value * TIME_PRECISION) / TIME_PRECISION
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

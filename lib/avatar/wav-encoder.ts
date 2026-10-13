/**
 * 16-bit PCM mono WAV encoder for voice samples. Browsers record voice as WebM/Opus or (Safari/iOS)
 * MP4/AAC, often without a usable duration; the capture flow decodes the recording and re-encodes it
 * here so every upload is a plain `audio/wav` with an exact duration.
 *
 * Pure (no DOM): takes decoded channel data, mixes it down to mono, resamples linearly and writes a
 * canonical 44-byte RIFF header.
 */

export const WAV_HEADER_BYTES = 44
export const VOICE_WAV_SAMPLE_RATES = [24_000, 48_000] as const
export type VoiceWavSampleRate = (typeof VOICE_WAV_SAMPLE_RATES)[number]

/** Keeps 48 kHz for full-band recordings and 24 kHz for narrow-band sources (less data, same content). */
export function pickVoiceWavSampleRate(sourceSampleRate: number): VoiceWavSampleRate {
  return Number.isFinite(sourceSampleRate) && sourceSampleRate > 0 && sourceSampleRate <= 24_000 ? 24_000 : 48_000
}

export function mixDownToMono(channels: ReadonlyArray<Float32Array>): Float32Array {
  const usable = channels.filter((channel) => channel && channel.length > 0)
  if (usable.length === 0) return new Float32Array(0)
  if (usable.length === 1) return usable[0]!
  const length = Math.min(...usable.map((channel) => channel.length))
  const mono = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    let sum = 0
    for (const channel of usable) sum += channel[index]!
    mono[index] = sum / usable.length
  }
  return mono
}

/** Linear-interpolation resampler (voice-grade quality, deterministic, no DOM). */
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (!(fromRate > 0) || !(toRate > 0) || fromRate === toRate || samples.length === 0) return samples
  const length = Math.max(1, Math.round((samples.length * toRate) / fromRate))
  const out = new Float32Array(length)
  const ratio = fromRate / toRate
  const last = samples.length - 1
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio
    const left = Math.min(last, Math.floor(position))
    const right = Math.min(last, left + 1)
    const fraction = position - left
    out[index] = samples[left]! + (samples[right]! - samples[left]!) * fraction
  }
  return out
}

export function wavDurationMs(sampleCount: number, sampleRate: number) {
  if (!(sampleRate > 0) || !(sampleCount > 0)) return 0
  return Math.round((sampleCount / sampleRate) * 1000)
}

/** Writes 16-bit PCM mono samples (clamped to [-1, 1]) with a canonical RIFF/WAVE header. */
export function encodeWavPcm16Mono(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate = rate * channels * 2
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = WAV_HEADER_BYTES
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(offset, value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff), true)
    offset += 2
  }
  return buffer
}

export type VoiceWavResult = {
  wav: ArrayBuffer
  sampleRate: VoiceWavSampleRate
  sampleCount: number
  durationMs: number
}

/**
 * Decoded channels -> mono -> 24/48 kHz -> optional trim to `maxDurationMs` -> 16-bit WAV.
 * 10 s at 48 kHz is ~960 KB, well under the capture upload limit.
 */
export function encodeVoiceWav(input: {
  channels: ReadonlyArray<Float32Array>
  sampleRate: number
  maxDurationMs?: number | null
  targetSampleRate?: VoiceWavSampleRate
}): VoiceWavResult {
  const targetRate = input.targetSampleRate ?? pickVoiceWavSampleRate(input.sampleRate)
  let samples = resampleLinear(mixDownToMono(input.channels), input.sampleRate, targetRate)
  if (typeof input.maxDurationMs === 'number' && input.maxDurationMs > 0) {
    const maxSamples = Math.floor((input.maxDurationMs / 1000) * targetRate)
    if (samples.length > maxSamples) samples = samples.subarray(0, maxSamples)
  }
  return {
    wav: encodeWavPcm16Mono(samples, targetRate),
    sampleRate: targetRate,
    sampleCount: samples.length,
    durationMs: wavDurationMs(samples.length, targetRate),
  }
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

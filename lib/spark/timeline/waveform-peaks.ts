/**
 * The audiowaveform JSON v2 body the media ingest lane writes for a source's `waveform` derivative (`peaks-50`):
 * `{version:2, channels:1, sample_rate, samples_per_pixel, bits:8, length, data:[min,max,...]}` with int8 values
 * (`workflow-engine/nodes/media_primitives/ingest.py` `waveform_peaks`). Pure, shared by the browser module and the
 * `/api/storage/waveform` route.
 */
export type AudiowaveformV2 = {
  version: 2
  channels: 1
  sample_rate: number
  samples_per_pixel: number
  bits: 8
  length: number
  data: number[]
}

/** 2 h of audio at 50 [min,max] pairs per second plus one second (`WAVEFORM_MAX_PEAKS` in the engine), as values. */
export const MAX_WAVEFORM_VALUES = 2 * (2 * 3_600 * 50 + 50)

/** The validated body (only its known fields), or null when it is not 8-bit mono audiowaveform v2 peaks. */
export function readAudiowaveformV2(body: unknown): AudiowaveformV2 | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  if (record['version'] !== 2 || record['bits'] !== 8) return null
  if (record['channels'] !== undefined && record['channels'] !== 1) return null
  const data = record['data']
  if (!Array.isArray(data) || data.length === 0 || data.length % 2 !== 0 || data.length > MAX_WAVEFORM_VALUES) return null
  if (record['length'] !== undefined && record['length'] !== data.length / 2) return null
  const sampleRate = record['sample_rate']
  const samplesPerPixel = record['samples_per_pixel']
  if (!isPositiveInteger(sampleRate) || !isPositiveInteger(samplesPerPixel)) return null
  for (const value of data) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < -128 || value > 127) return null
  }
  return {
    version: 2,
    channels: 1,
    sample_rate: sampleRate,
    samples_per_pixel: samplesPerPixel,
    bits: 8,
    length: data.length / 2,
    data: data as number[],
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

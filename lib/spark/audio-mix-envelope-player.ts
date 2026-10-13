/**
 * P06-63 preview side of the deterministic mix (PREM §5.1, TK-21): the preview applies the SAME breakpoints the
 * gateway compiles into `audio-mix-render@1` (clip and bus envelopes, linear amplitude, 48 kHz sample clock) through
 * WebAudio gain automation, so preview and final mix identically; there is no sidechain and nothing is recomputed in
 * the browser. `gainAt` is the exact interpolation both sides use (linear between breakpoints; a repeated sample is a
 * right-continuous step).
 */

export const AUDIO_MIX_SAMPLE_RATE = 48_000

export type AudioGainPoint = { sample: number; gain: number }

/** The subset of WebAudio's `AudioParam` the scheduler uses (a real `GainNode.gain` satisfies it). */
export type AudioParamLike = {
  cancelScheduledValues(startTime: number): unknown
  setValueAtTime(value: number, startTime: number): unknown
  linearRampToValueAtTime(value: number, endTime: number): unknown
}

/** Linear amplitude of an envelope at a timeline sample. */
export function gainAt(points: readonly AudioGainPoint[], sample: number): number {
  if (points.length === 0) return 1
  if (sample < points[0].sample) return points[0].gain
  const last = points.length - 1
  if (sample >= points[last].sample) return points[last].gain
  let index = last
  while (index > 0 && points[index].sample > sample) index -= 1
  const point = points[index]
  const next = points[index + 1]
  return point.gain + ((next.gain - point.gain) * (sample - point.sample)) / (next.sample - point.sample)
}

/**
 * Schedules one envelope on a gain param for playback that starts at timeline sample `fromSample` when the
 * AudioContext clock reads `contextTime`. Called again on every seek or plan change (it cancels what was scheduled).
 */
export function scheduleGainEnvelope(
  param: AudioParamLike,
  points: readonly AudioGainPoint[],
  playback: { contextTime: number; fromSample: number },
): void {
  const toTime = (sample: number) => playback.contextTime + (sample - playback.fromSample) / AUDIO_MIX_SAMPLE_RATE
  param.cancelScheduledValues(playback.contextTime)
  param.setValueAtTime(gainAt(points, playback.fromSample), playback.contextTime)
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    if (point.sample <= playback.fromSample) continue
    const previous = points[index - 1]
    if (previous && previous.sample === point.sample) {
      // A step: jump at this instant.
      param.setValueAtTime(point.gain, toTime(point.sample))
    } else {
      param.linearRampToValueAtTime(point.gain, toTime(point.sample))
    }
  }
}

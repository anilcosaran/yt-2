// Media controls use decimal seconds. Remove binary floating-point noise before
// comparing durations or rounding frame counts, without rounding valid API input.
export const MEDIA_TIME_EPSILON = 1e-7

export function mediaRangeExceeds(start: number, end: number, maximum: number) {
  return end - start - maximum > MEDIA_TIME_EPSILON
}

export function mediaFrameCount(duration: number, fps: number) {
  return Math.ceil(duration * fps - MEDIA_TIME_EPSILON)
}

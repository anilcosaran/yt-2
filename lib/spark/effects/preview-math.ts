/**
 * Spark effects: the timing of the editor's hover previews (transition and animation cards). What a card shows at a moment
 * is the shared recipe sampled with the runtime's own curves (`thumb-sample.ts`); this file only says WHICH moment: the
 * loop of a hovered card (rest, effect, rest) and sub-windows of it.
 */

/** The Composition easing enum (the animation panel's and the transition section's choice). */
export type PreviewEasing = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'

const clamp01 = (value: number): number => (value <= 0 ? 0 : value >= 1 ? 1 : value)

/** Progress inside a sub-window [start, end) of a 0-1 timeline: 0 before it, 1 after it. */
export function windowProgress(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0
  return clamp01((progress - start) / (end - start))
}

/**
 * The loop of a hover preview: the picture rests, plays the effect, rests at its end, then starts again. Returns the
 * effect's progress (0-1) at `elapsedMs` for an effect of `effectMs`.
 */
export function loopProgress(elapsedMs: number, effectMs: number, restMs = 450): number {
  const cycle = effectMs + 2 * restMs
  const at = ((elapsedMs % cycle) + cycle) % cycle
  return windowProgress(at, restMs, restMs + effectMs)
}

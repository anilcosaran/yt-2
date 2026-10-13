import * as React from 'react'

import type { EaseFunction, EaseResolver } from '../stage/motion-core/recipes'

/**
 * Spark effects library: the ease curves the editor samples the shared recipes with (`lib/spark/stage/motion-core/recipes`,
 * the generated copy of `packages/motion-runtime/src/recipes/`). They are the motion runtime's OWN functions: the vendored
 * runtime bundle exports `easeFunction` (the IR ease grammar on anime.js, `src/ui-entry.ts`) and `loadMotionRuntime`
 * registers it here the moment the bundle is loaded, so the live blend, the local preview and the thumbnails follow the very
 * curves the stage and the export draw with.
 *
 * Until the bundle is loaded (a drawer opened before the stage finished loading, a unit test without the runtime) the
 * `linear` and `cubic.*` curves of the Composition easing enum are computed here exactly (power 3, the runtime's
 * definition); any other curve reads as linear until the runtime registers, and `useRecipeEasesVersion` re-renders the
 * thumbnails then.
 */

const FALLBACK: Readonly<Record<string, EaseFunction>> = {
  linear: (t) => t,
  'cubic.in': (t) => t * t * t,
  'cubic.out': (t) => 1 - (1 - t) ** 3,
  'cubic.inOut': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
}
const linear: EaseFunction = (t) => t

let runtimeEase: ((ease: string) => EaseFunction) | null = null
let version = 0
const listeners = new Set<() => void>()

/** Registers the runtime's `easeFunction` (null: back to the built-in curves, for tests). */
export function registerRecipeEases(next: ((ease: string) => EaseFunction) | null): void {
  if (next === runtimeEase) return
  runtimeEase = next
  version += 1
  for (const listener of listeners) listener()
}

/** Whether the runtime's own curves are registered. */
export function recipeEasesFromRuntime(): boolean {
  return runtimeEase !== null
}

/** The resolver every editor sampling of a recipe uses. */
export const recipeEase: EaseResolver = (ease) => {
  if (runtimeEase) return runtimeEase(ease)
  return FALLBACK[ease] ?? linear
}

/** A counter that changes when the runtime's curves are registered (thumbnails drawn before that are drawn again). */
export function useRecipeEasesVersion(): number {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => 0,
  )
}

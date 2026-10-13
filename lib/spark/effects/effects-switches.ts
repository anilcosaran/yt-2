/**
 * Spark effects UI switches (WP1 / WP2), read on the server in the force-dynamic editor page and passed down as props, so
 * flipping one needs only a pod restart. Code default off (any value but exactly `true`); DEV on, production off
 * (`k8s/feature-switches.json`). Nothing here reads or writes product data.
 *
 * - `SPARK_TRANSITIONS_BROWSER_ENABLED`: the left-rail "Transitions" browser (cards with hover previews, click / drag onto a
 *   cut, "Apply to all", the duration handle on the strip's chips, play around the cut after applying). The transitions
 *   themselves stay the gateway's `COMPOSITION_TRANSITIONS_ENABLED`.
 * - `SPARK_ANIMATIONS_PANEL_ENABLED`: the left-rail "Animations" drawer and the "Animation" section of the layer
 *   Properties (In / Out / Combo / Effect). Which presets are offered is the gateway's inspector schema
 *   (`COMPOSITION_LAYER_ANIMATION_PRESETS_V2_ENABLED` adds the WP2 presets).
 */
export const SPARK_TRANSITIONS_BROWSER_SWITCH = 'SPARK_TRANSITIONS_BROWSER_ENABLED'
export const SPARK_ANIMATIONS_PANEL_SWITCH = 'SPARK_ANIMATIONS_PANEL_ENABLED'

export type SparkEffectsSwitches = { transitionsBrowser: boolean; animationsPanel: boolean }

export function sparkEffectsSwitches(env: Readonly<Record<string, string | undefined>> = process.env): SparkEffectsSwitches {
  return {
    transitionsBrowser: env[SPARK_TRANSITIONS_BROWSER_SWITCH] === 'true',
    animationsPanel: env[SPARK_ANIMATIONS_PANEL_SWITCH] === 'true',
  }
}

export const SPARK_EFFECTS_OFF: SparkEffectsSwitches = { transitionsBrowser: false, animationsPanel: false }

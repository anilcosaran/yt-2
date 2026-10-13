/**
 * The contextual toolbar switch of the Spark editor. `SPARK_CONTEXT_TOOLBAR_ENABLED=true` on the UI pod turns on, on top of
 * the stage (`SPARK_STAGE_ENABLED`): the per-kind floating toolbar of the selected layer (text, shape, image / video, Motion,
 * with duplicate, order, delete and an animation quick picker), Ctrl/Cmd+D / C / V and the "?" shortcut sheet, media that
 * covers the canvas when it is added, and the canvas format switch (16:9 / 9:16 / 1:1) with its impact list. Code default
 * off (any value but exactly `true`); DEV on, production off (`k8s/feature-switches.json`).
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart. The
 * format switch also needs the gateway's `COMPOSITION_ASPECT_SWITCH_ENABLED` (the server refuses `canvas.set_format` without
 * it; the editor then says the format cannot be changed yet).
 */
export const SPARK_CONTEXT_TOOLBAR_SWITCH = 'SPARK_CONTEXT_TOOLBAR_ENABLED'

export function sparkContextToolbarEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_CONTEXT_TOOLBAR_SWITCH] === 'true'
}

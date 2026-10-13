/**
 * The editor stage switch (Y1-08). `SPARK_STAGE_ENABLED=true` on the UI pod turns on the WYSIWYG stage in the Spark editor:
 * the compiled scene drawn by the pinned motion runtime, playback, selection and gestures, the floating toolbox, the
 * context menu, the layer Properties and the rail "add text" / "add media" actions. Off (the code default; any value but
 * exactly `true`) the editor keeps its empty frame and its disabled controls, exactly as before.
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart.
 * Prerequisite for turning it on: the gateway preview routes, the pinned font bytes route and the inspector schema route
 * (Y1-07) are deployed.
 */
export const SPARK_STAGE_SWITCH = 'SPARK_STAGE_ENABLED'

export function sparkStageEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_STAGE_SWITCH] === 'true'
}

/**
 * Spark timeline v2 switch (P1-E). `SPARK_TIMELINE_EDITING_ENABLED=true` on the UI pod replaces the editor's scene strip and
 * expanded rows with the CapCut-like timeline (section row, gapless main track, overlay rows, audio and caption lanes,
 * transition bands, trim / split / ripple delete / reorder / snapping / zoom). Off (the code default; any value but exactly
 * `true`) the editor keeps the old strip exactly as before. DEV on, production off (`k8s/feature-switches.json`).
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart.
 * Nothing here reads or writes product data; every edit stays a Composition command.
 */
export const SPARK_TIMELINE_EDITING_SWITCH = 'SPARK_TIMELINE_EDITING_ENABLED'

export function sparkTimelineEditingEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_TIMELINE_EDITING_SWITCH] === 'true'
}

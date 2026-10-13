/**
 * Spark Code tab switch (owner decision 2026-10-04, replaces Q34). `SPARK_MOTION_CODE_TAB_ENABLED=true` on the UI pod adds the
 * Code tab next to Assistant | Properties in the editor's right panel (it shows the readable source of the selected Motion
 * layer's pinned revision and, with `MOTION_UI_ENABLED`, lets the user edit it) and lets an Assistant revision of the selected
 * Motion layer apply straight to that layer with an Undo in the chat. Off (the code default; any value but exactly `true`) the
 * editor has exactly the two tabs it had. DEV off until the gateway pieces named in
 * `docs/plans/agentic-spark/KARAR-SPARK-KOD-SEKMESI-2026-10-04.md` are verified; production off.
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart.
 * Nothing here reads or writes product data.
 */
export const SPARK_MOTION_CODE_TAB_SWITCH = 'SPARK_MOTION_CODE_TAB_ENABLED'

export function sparkMotionCodeTabEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_MOTION_CODE_TAB_SWITCH] === 'true'
}

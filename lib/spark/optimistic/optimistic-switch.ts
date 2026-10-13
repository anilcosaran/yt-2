/**
 * The instant-editing switch (E1-N). `SPARK_OPTIMISTIC_EDITING_ENABLED=true` on the UI pod makes the Spark editor apply every
 * typed edit to its own copy of the project the moment the user makes it and send the command to the server in the
 * background: a new scene, text or shape is on the stage in the frame of the click, the header says "Saving… / Saved / Not
 * saved — retry", and what the server refuses is rolled back with a notice. Off (the code default; any value but exactly
 * `true`) the editor waits for the server after every edit, exactly as before.
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart.
 * Nothing here reads or writes product data, and nothing is kept in the browser's storage: the server stays the only copy
 * that persists; the editor's own copy lives in memory.
 */
export const SPARK_OPTIMISTIC_EDITING_SWITCH = 'SPARK_OPTIMISTIC_EDITING_ENABLED'

export function sparkOptimisticEditingEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_OPTIMISTIC_EDITING_SWITCH] === 'true'
}

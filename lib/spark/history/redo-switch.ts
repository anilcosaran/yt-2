/**
 * The redo switch of the Spark editor. `SPARK_REDO_ENABLED=true` on the UI pod turns on the header's Redo button and the
 * Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y keys: the newest group this editor undid is applied again through the gateway's
 * `POST /api/v1/composition/projects/{projectId}/redo` (instantly on the canvas with `SPARK_OPTIMISTIC_EDITING_ENABLED`). Code
 * default off (any value but exactly `true`); DEV on, production off (`k8s/feature-switches.json`). Off: the button says
 * "soon" and the keys do nothing, exactly as before. Undo itself is not behind this switch.
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart. It
 * needs a gateway that has the redo route (the same release); nothing is kept in the browser's storage.
 */
export const SPARK_REDO_SWITCH = 'SPARK_REDO_ENABLED'

export function sparkRedoEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_REDO_SWITCH] === 'true'
}

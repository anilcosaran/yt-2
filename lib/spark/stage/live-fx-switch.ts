/**
 * `SPARK_LIVE_FX_PREVIEW_ENABLED` (UI switch, read on the server in the force-dynamic editor page and passed down as a prop,
 * so flipping it needs only a pod restart; code default off - only exactly `true` opens it; DEV on, production off per
 * `k8s/feature-switches.json`). Open, the editor's stage previews transitions and animations itself:
 *
 * - scene transitions are blended in the browser from the two scene pictures (`transition-blend.ts`), next to footage too,
 *   with a "preview only" badge where the export cannot render them yet; no transition segment is read from the server;
 * - animated text, shapes and images are compiled by the local preview (`optimistic/local-animations.ts`), and a document
 *   that stores transitions is planned locally (with instant editing);
 * - `scene.set_transition`, `scene.clear_transition`, `animation.set` and `animation.remove` are applied to the editor's own
 *   copy in the frame of the edit (`optimistic/document-ops.ts`, with instant editing).
 *
 * Closed: the server's transition segments and pictures, exactly as before. Nothing here reads or writes product data.
 */
export const SPARK_LIVE_FX_PREVIEW_SWITCH = 'SPARK_LIVE_FX_PREVIEW_ENABLED'

export function sparkLiveFxPreviewEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_LIVE_FX_PREVIEW_SWITCH] === 'true'
}

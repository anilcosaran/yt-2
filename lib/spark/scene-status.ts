import type { CompositionScene } from './composition-client'

/**
 * P02-16 scene card status (SAHNE §2 "durum rozeti", decision S15): a 6 px dot next to the card's
 * duration, the reason in the tooltip and the screen reader label. `generating` (accent) wins over
 * the reasons that need the user's attention (warning colour).
 *
 * `generating` is read from the document: a scene that holds a TK-32 placeholder of a running
 * operation. The attention reasons come from their owners when those reach the editor (missing
 * required slot: template instance P02-03/P06-04; stale audio: narration dirty set P03-21;
 * unresolved trigger: scene compiler report P02-17) and are passed in as typed reasons.
 */

export const SCENE_STATUS_REASONS = ['generating', 'missing_slot', 'stale_audio', 'unresolved_trigger'] as const
export type SceneStatusReason = (typeof SCENE_STATUS_REASONS)[number]
export type SceneAttentionReason = Exclude<SceneStatusReason, 'generating'>

export type SceneStatus = { tone: 'generating' | 'attention'; reasons: SceneStatusReason[] }

/** The card's status, or null when the scene needs nothing (no dot). Reasons keep a fixed order. */
export function sceneStatus(scene: CompositionScene, attention: readonly SceneAttentionReason[] = []): SceneStatus | null {
  const reasons = new Set<SceneStatusReason>(attention)
  if (scene.layers.some((layer) => layer.layer_kind === 'pending_slot')) reasons.add('generating')
  if (reasons.size === 0) return null
  const ordered = SCENE_STATUS_REASONS.filter((reason) => reasons.has(reason))
  return { tone: reasons.has('generating') ? 'generating' : 'attention', reasons: ordered }
}

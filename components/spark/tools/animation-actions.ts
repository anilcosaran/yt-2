import { planSlotChange, sceneLayerBody, type SlotChoice } from '@/lib/spark/animations/layer-animations'
import type { AnimationSlot } from '@/lib/spark/animations/animation-catalog'
import type { CompositionDocument, CompositionOpSpec } from '@/lib/spark/composition-client'
import { playSpan } from '@/lib/spark/effects/cut-preview'
import { resolveTimeline } from '@/lib/spark/scene-timing'

import type { SparkStageBinding } from '../stage/use-spark-stage'

/**
 * Spark effects WP2: the writes of the Animations drawer and the Animation section of the layer Properties. One slot change
 * is ONE command (`animation.set` / `animation.remove`, validated and compiled by the gateway); afterwards the stage plays
 * the animated part of the layer once its new picture is drawn.
 */

export type SlotOutcome = 'applied' | 'unchanged' | 'no_room' | 'failed'

/** How long the editor waits for the stage to draw the edited scene before it plays the animation anyway. */
const SETTLE_WAIT_MS = 2500

export async function applyAnimationSlot(input: {
  apply(specs: readonly CompositionOpSpec[]): Promise<boolean>
  document: CompositionDocument
  sceneId: string
  layerId: string
  slot: AnimationSlot
  choice: SlotChoice | null
  /** Plays the result on the stage after it is applied (absent = no playback). */
  stage?: SparkStageBinding | null
}): Promise<SlotOutcome> {
  const scene = input.document.scenes.find((candidate) => candidate.scene_id === input.sceneId)
  const layer = sceneLayerBody(scene, input.layerId)
  if (!layer) return 'failed'
  const plan = planSlotChange({ sceneId: input.sceneId, layer, slot: input.slot, choice: input.choice })
  if (!plan.ok) return plan.reason === 'no_room' ? 'no_room' : 'failed'
  if (plan.specs.length === 0) return 'unchanged'
  const applied = await input.apply(plan.specs)
  if (!applied) return 'failed'
  const written = plan.specs.find((spec) => spec.op['op'] === 'animation.set' && (spec.op['animation'] as { phase?: string } | undefined)?.phase === slotPhaseOf(input.slot))
  if (input.stage && written) void playAnimation(input.stage, input.document, input.sceneId, written)
  return 'applied'
}

const slotPhaseOf = (slot: AnimationSlot) => (slot === 'in' ? 'enter' : slot === 'out' ? 'exit' : 'emphasis')

/** Plays the written animation on the stage (with a short lead-in and tail) once the edited scene is drawn. */
async function playAnimation(stage: SparkStageBinding, document: CompositionDocument, sceneId: string, spec: CompositionOpSpec): Promise<void> {
  const animation = spec.op['animation'] as { params: { duration_frames: number }; anchor: { kind: string; frames?: number } }
  const scene = resolveTimeline(document).scenes.find((candidate) => candidate.sceneId === sceneId)
  if (!scene || scene.lengthFrames === null) return
  const local = animation.anchor.kind === 'scene_offset' ? (animation.anchor.frames ?? 0) : 0
  const fps = document.canvas.fps.num / document.canvas.fps.den
  const start = scene.startFrame + local
  // Let the session hand the new working copy to the stage, then wait for its picture (bounded).
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  await Promise.race([stage.controller.whenSettled(), new Promise((resolve) => globalThis.setTimeout(resolve, SETTLE_WAIT_MS))])
  if (stage.controller.isDisposed) return
  // A short lead-in and tail, kept inside the scene (playback into another scene would select it and drop the layer).
  playSpan(stage.playback, {
    start: Math.max(scene.startFrame, start - Math.round(fps * 0.3)),
    end: Math.min(scene.endFrame - 1, start + animation.params.duration_frames + Math.round(fps * 0.5)),
  })
}

import {
  buildCompositionCommand,
  executeCompositionCommand,
  getCompositionWorkingCopy,
  orderedScenes,
  type CompositionCommandBody,
  type CompositionWorkingCopy,
} from '@/lib/spark/composition-client'
import { ownedCard, platformCard, type MotionCard } from '@/lib/spark/motion-catalog'
import { planMotionScene, type MotionInsertRefusal } from '@/lib/spark/motion-insert'

import type { CatalogItem } from './catalog-model'

/**
 * "Add to Spark project" from the `/motion` catalog. The Spark editor's own insert needs a live stage (a playhead and a
 * selected scene); from here there is none, so the Motion goes in the way the Spark drawer's "Add as new scene" does it, built
 * by the SAME planner (`planMotionScene`): a new scene at the end of the project holding the Motion layer, as ONE composition
 * command (one undo group), CAS-checked against the working copy read just now. Every refusal the planner knows (premium not
 * bought, the project's format, a template-bound project, a missing image or look) comes back as a named reason, never as a
 * silent clamp; the server still validates and compiles the instance before it writes.
 */

export type AddToSparkFailure =
  /** A draft is not a saved Motion: a project can only pin an immutable revision. */
  | { reason: 'not_saved' }
  | { reason: 'locked' }
  | { reason: 'read_only' }
  | { reason: 'refused'; refusal: MotionInsertRefusal }
  | { reason: 'failed' }

export type AddToSparkResult = { ok: true; projectId: string; sceneId: string } | ({ ok: false } & AddToSparkFailure)

export type AddToSparkDeps = {
  getWorkingCopy: (projectId: string) => Promise<CompositionWorkingCopy>
  execute: (projectId: string, body: CompositionCommandBody) => Promise<unknown>
  uuid: () => string
}

const DEFAULT_DEPS: AddToSparkDeps = {
  getWorkingCopy: (projectId) => getCompositionWorkingCopy(projectId),
  execute: (projectId, body) => executeCompositionCommand(projectId, body),
  uuid: () => globalThis.crypto.randomUUID(),
}

/** The Spark card of a catalog item; null for a draft (it has no immutable revision to pin). */
export function sparkCardOf(item: CatalogItem): MotionCard | null {
  // The catalogue does not send a locked card's content to a workspace that did not buy it (`content_locked`): a premium Motion
  // that arrives unlocked is one the workspace owns.
  if (item.platform) return { ...platformCard(item.platform), owned: item.premium && !item.locked }
  if (item.revision) return ownedCard(item.revision)
  return null
}

export async function addMotionToSparkProject(
  input: { projectId: string; item: CatalogItem; videoStyleRef: string | null },
  deps: Partial<AddToSparkDeps> = {},
): Promise<AddToSparkResult> {
  const api = { ...DEFAULT_DEPS, ...deps }
  const card = sparkCardOf(input.item)
  if (!card) return { ok: false, reason: 'not_saved' }
  if (input.item.locked) return { ok: false, reason: 'locked' }
  try {
    const copy = await api.getWorkingCopy(input.projectId)
    if (copy.role === 'viewer') return { ok: false, reason: 'read_only' }
    const scenes = orderedScenes(copy.document)
    const plan = planMotionScene({
      document: copy.document,
      card,
      afterSceneId: scenes.length > 0 ? scenes[scenes.length - 1]!.scene_id : null,
      fps: copy.document.canvas.fps,
      defaultVideoStyleRef: input.videoStyleRef,
      uuid: api.uuid,
    })
    if (!plan.ok) return { ok: false, reason: 'refused', refusal: plan.refusal }
    await api.execute(input.projectId, {
      ...buildCompositionCommand(copy.document, plan.specs),
      idempotency_key: `ui_${api.uuid()}`,
      undo_group_id: `ug_${api.uuid()}`,
      undo_policy: 'recorded',
    })
    return { ok: true, projectId: input.projectId, sceneId: plan.sceneId }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

import { newAudioPlacementId, sceneFrameRange } from '@/lib/spark/composition-typed-edits'
import type { Size } from '@/lib/spark/stage/cover-transform'
import { audioBedSpecs, type PlacementTarget } from '@/lib/spark/stage/placement'

import type { SparkToolContext } from './spark-tool-types'

/**
 * "Insert this project source into the project": the one path of the Media tool (My media, Upload, Stock, recordings).
 * With the stage on and a scene under the playhead the media goes into THAT scene at `target` (the playhead by default)
 * as one command, a video fitted to the scene by D11; an empty project, or the stage off, keeps the older "a new scene
 * with the clip". Resolves the strip position (1-based) of the scene that now holds it, or null when nothing was applied.
 */
export async function insertProjectSource(
  ctx: SparkToolContext,
  sourceId: string,
  kind: 'image' | 'video',
  target: PlacementTarget = { kind: 'playhead' },
  options: InsertMediaOptions = {},
): Promise<number | null> {
  const controller = ctx.stage?.controller
  // Contextual toolbar "Replace": the pick replaces the armed clip's source instead of adding a layer.
  const replaced = controller ? await controller.replaceArmed(sourceId, kind) : null
  if (replaced !== null) return replaced === 'replaced' ? controller!.currentSceneNumber() : null
  if (controller?.currentSceneNumber()) {
    const result = await controller.placeMedia(sourceId, kind, target, options)
    if (result.notice) ctx.placementNotice(result.notice)
    return result.applied ? controller.currentSceneNumber() : null
  }
  // A new scene with the clip (an empty project): with the contextual toolbar it covers the canvas too (in the insert, the
  // exact fit in the same undo step: `media-insert-fit.ts`).
  const local = options.onLocal ? { onLocal: options.onLocal } : {}
  return controller
    ? ctx.actions.insertSourceClip(sourceId, kind, { fit: (document) => controller.mediaInsertFitFor(sourceId, document, options.sizeHint ?? null), ...local })
    : ctx.actions.insertSourceClip(sourceId, kind, local)
}

/**
 * Timeline v3 (instant media add): `sizeHint` is any size with the media's aspect known before the picture is read (the
 * drawer card's thumbnail); `onLocal` runs when the clip is in the drawn copy (optimistic writes), before the server answers.
 */
export type InsertMediaOptions = { sizeHint?: Size | null; onLocal?: () => void }

/**
 * An audio file as the music of the scene under the playhead (`audio.insert`, cut at the scene end; the stage reports a
 * cut). Without the stage the selected scene's start is used. Resolves true when the music was added.
 */
export async function insertProjectAudio(
  ctx: SparkToolContext,
  sourceId: string,
  target: PlacementTarget = { kind: 'playhead' },
  options: { onLocal?: () => void } = {},
): Promise<boolean> {
  const controller = ctx.stage?.controller
  if (controller?.currentSceneNumber()) {
    const result = await controller.placeAudio(sourceId, target, options)
    if (result.notice) ctx.placementNotice(result.notice)
    return result.applied
  }
  const live = ctx.latest()
  const document = live.workingCopy?.document
  const sceneId = live.selectedSceneId
  const range = document && sceneId ? sceneFrameRange(document, sceneId) : null
  if (!document || !sceneId || !range) return false
  const plan = audioBedSpecs({
    document,
    sceneId,
    startFrame: 0,
    sceneFrames: range.end_frame - range.start_frame,
    sourceId,
    placementId: newAudioPlacementId(globalThis.crypto.randomUUID()),
  })
  if (!plan) return false
  return ctx.actions.apply(plan.specs)
}

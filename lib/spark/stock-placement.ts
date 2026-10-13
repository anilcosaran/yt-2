import {
  SCENE_SEQUENCE_REF,
  framesForSeconds,
  newSceneId,
  type CompositionDocument,
  type CompositionEntityRef,
  type CompositionOpSpec,
} from './composition-client'
import { layerSetTransformSpec, newLayerId, type CompositionTransform } from './composition-typed-edits'

/** Seconds an added Stock image is held (the Spark placement default; the scene follows its media). */
export const STOCK_IMAGE_HOLD_SECONDS = 3

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })
const layerRef = (layerId: string): CompositionEntityRef => ({ entity_kind: 'layer', entity_id: layerId })

/**
 * P06-16 explicit clip insert of an acquired Stock source (the acquisition only binds it to the project): one new
 * `follow_media` scene right after the selected scene (at the end when nothing is selected) holding one clip of the
 * source — video at its real length, image for the hold — the same Spark placement as the Chat/Connector imports.
 * The server computes the clip ranges from the source probe (`clip.insert_sequence`). Null when the source is not in
 * the working copy yet (the caller reloads first).
 */
export function stockClipPlacement(input: {
  document: CompositionDocument
  sourceId: string
  kind: 'image' | 'video'
  afterSceneId: string | null
  uuid: () => string
  /** The clip's transform (the contextual toolbar's cover fit), written in the same command; absent = the compiler's fit. */
  transform?: CompositionTransform | null
}): { sceneId: string; layerId: string; specs: CompositionOpSpec[] } | null {
  const { document } = input
  if (!document.source_media.some((source) => source.source_id === input.sourceId)) return null
  const sequence = document.scene_sequence.scene_ids
  const after = input.afterSceneId && sequence.includes(input.afterSceneId)
    ? input.afterSceneId
    : sequence.length > 0 ? sequence[sequence.length - 1]! : null
  const sceneId = newSceneId(input.uuid())
  const layerId = newLayerId(input.uuid())
  const specs: CompositionOpSpec[] = [
    {
      op: {
        op: 'scene.insert',
        scene_id: sceneId,
        after_scene_id: after,
        timing_policy: 'follow_media',
        section_id: null,
        origin: 'authored',
      },
      reads: [SCENE_SEQUENCE_REF],
      targets: [SCENE_SEQUENCE_REF, sceneRef(sceneId)],
    },
    {
      op: {
        op: 'clip.insert_sequence',
        scene_id: sceneId,
        after_layer_id: null,
        start_frame: 0,
        ...(input.kind === 'image' && { image_hold_frames: Math.max(1, framesForSeconds(document, STOCK_IMAGE_HOLD_SECONDS)) }),
        items: [{ layer_id: layerId, source_id: input.sourceId }],
      },
      reads: [sceneRef(sceneId)],
      targets: [sceneRef(sceneId), layerRef(layerId)],
    },
    ...(input.transform ? [layerSetTransformSpec(sceneId, layerId, input.transform)] : []),
  ]
  return { sceneId, layerId, specs }
}

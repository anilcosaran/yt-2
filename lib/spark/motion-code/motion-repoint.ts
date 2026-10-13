import type { CompositionDocument, CompositionOpSpec } from '../composition-client'
import {
  layerRemoveSpec,
  layerSetLockedSpec,
  layerSetTransformSpec,
  motionInstanceInsertSpec,
  newLayerId,
  newMotionInstanceId,
  type CompositionMotionParameterInput,
  type CompositionMotionRevisionRef,
} from '../composition-typed-edits'
import type { MotionExposure } from '../motion-exposure'
import { motionLayerViewOf, projectImageSources, type MotionLayerView } from '../motion-layers'

/**
 * Code tab / Assistant direct apply: re-pins a Motion layer to another revision as ONE command.
 *
 * GAP: the gateway has no op that moves an instance to a revision of ANOTHER Motion. `motion.instance.upgrade` stays inside
 * one Motion id (and refuses `project_private`); a fork of a Motion published from a draft is a new Motion id, and the
 * gateway's own answer to that is "replace the instance instead" (`upgrade_other_motion`). So the repoint is the replace the
 * gateway names, written with existing typed ops in one command: `motion.instance.insert` of the new revision right above the
 * old layer (same scene range, look, energy where the new revision offers it, and every exposed value that still fits) and
 * `layer.remove` of the old layer. One command is one undo group, so one Undo brings the old layer back.
 *
 * What the replace keeps and what it cannot (reported to the user, never silent):
 * - kept: scene range, paint position, the VideoStyle look, energy (when offered), text / colour / image values whose parameter
 *   id and kind the new revision still exposes and that still fit its limits; the layer's transform and lock follow in a joined
 *   command of the same undo step (they cannot be part of the insert, the new layer does not exist yet when it is built);
 * - dropped (listed as `dropped`): a value the new revision no longer exposes, of another kind, or too long for its new limit;
 * - lost (listed as `lost`): per-element tweaks stored in `motion_state.overrides` (they belong to the old structure) and layer
 *   animations. A dedicated in-place repoint op in the gateway (plan gap) would keep them.
 */

export type MotionRepointRefusal =
  | { reason: 'layer_missing' }
  /** A document v1 Motion layer has no exposed state to carry. */
  | { reason: 'not_v2' }
  | { reason: 'no_range' }
  | { reason: 'video_style_unavailable' }
  /** The gateway pins only `library`-scope revisions on an instance today (project-private code revisions cannot be pinned yet). */
  | { reason: 'target_project_private' }
  /** The new revision needs an image the project does not hold. */
  | { reason: 'needs_image' }

export type MotionRepointLost = 'overrides' | 'animations'

export type MotionRepointPlan =
  | {
      ok: true
      sceneId: string
      oldLayerId: string
      newLayerId: string
      newInstanceId: string
      /** The command: insert the new layer above the old one, remove the old one. */
      specs: CompositionOpSpec[]
      /** Joined into the same undo step once the new layer exists (transform, lock). */
      followUp: (layerId: string) => CompositionOpSpec[]
      dropped: string[]
      lost: MotionRepointLost[]
    }
  | { ok: false; refusal: MotionRepointRefusal }

type Body = Record<string, unknown>
const isObject = (value: unknown): value is Body => typeof value === 'object' && value !== null && !Array.isArray(value)

function rawLayer(document: CompositionDocument, sceneId: string, layerId: string): Body | null {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  return (scene?.layers.find((layer) => layer.layer_id === layerId) as Body | undefined) ?? null
}

export function planMotionRepoint(input: {
  document: CompositionDocument
  view: MotionLayerView
  target: CompositionMotionRevisionRef
  exposure: MotionExposure
  uuid: () => string
}): MotionRepointPlan {
  const { document, view, target, exposure } = input
  const refuse = (refusal: MotionRepointRefusal): MotionRepointPlan => ({ ok: false, refusal })
  const current = motionLayerViewOf(document, view.sceneId, view.layerId)
  const layer = rawLayer(document, view.sceneId, view.layerId)
  if (!current || !layer) return refuse({ reason: 'layer_missing' })
  if (!current.v2) return refuse({ reason: 'not_v2' })
  if (!current.range) return refuse({ reason: 'no_range' })
  if (!current.videoStyleRef) return refuse({ reason: 'video_style_unavailable' })
  if (target.scope !== 'library') return refuse({ reason: 'target_project_private' })

  const exposed = new Map(exposure.parameters.map((parameter) => [parameter.parameter_id, parameter]))
  const images = projectImageSources(document)
  const parameterValues: Record<string, CompositionMotionParameterInput> = {}
  const dropped: string[] = []
  for (const stored of current.values) {
    // The instance length is its scene range (carried as such); the gateway refuses it as an insert value.
    if (stored.kind === 'duration') continue
    const parameter = exposed.get(stored.parameterId)
    if (!parameter || parameter.kind !== stored.kind || !parameter.spark_editable) {
      dropped.push(stored.parameterId)
      continue
    }
    if (stored.kind === 'text' || stored.kind === 'color') {
      const value = stored.value
      const max = parameter.text?.max_chars
      if (typeof value !== 'string' || (stored.kind === 'text' && max !== undefined && [...value].length > max)) {
        dropped.push(stored.parameterId)
        continue
      }
      parameterValues[stored.parameterId] = value
    } else if (stored.kind === 'media') {
      const storageObjectId = typeof stored.value === 'object' ? stored.value.storage_object_id : null
      const source = images.find((image) => image.storageObjectId === storageObjectId)
      if (!source) {
        dropped.push(stored.parameterId)
        continue
      }
      parameterValues[stored.parameterId] = { source_id: source.sourceId }
    }
  }
  // A required image the new revision adds takes the project's first image, like a Motion inserted from the drawer.
  for (const parameter of exposure.parameters) {
    if (parameter.kind !== 'media' || !parameter.required || !parameter.spark_editable || parameter.parameter_id in parameterValues) continue
    const image = images[0]
    if (!image) return refuse({ reason: 'needs_image' })
    parameterValues[parameter.parameter_id] = { source_id: image.sourceId }
  }

  const energy = current.energy && exposure.energies?.includes(current.energy) ? current.energy : undefined
  const newLayer = newLayerId(input.uuid())
  const newInstance = newMotionInstanceId(input.uuid())
  const instance = isObject(layer['instance']) ? layer['instance'] : {}
  const state = isObject(instance['motion_state']) ? instance['motion_state'] : {}
  const lost: MotionRepointLost[] = []
  if (Array.isArray(state['overrides']) && state['overrides'].length > 0) lost.push('overrides')
  if (Array.isArray(layer['animations']) && layer['animations'].length > 0) lost.push('animations')
  const transform = isObject(layer['transform']) ? layer['transform'] : null
  const locked = layer['locked'] === true

  return {
    ok: true,
    sceneId: view.sceneId,
    oldLayerId: view.layerId,
    newLayerId: newLayer,
    newInstanceId: newInstance,
    specs: [
      motionInstanceInsertSpec({
        sceneId: view.sceneId,
        layerId: newLayer,
        afterLayerId: view.layerId,
        instanceId: newInstance,
        motionRef: target,
        sceneRange: { start_frame: current.range.startFrame, end_frame: current.range.endFrame },
        videoStyleRef: current.videoStyleRef,
        ...(energy && { energy }),
        parameterValues,
      }),
      layerRemoveSpec(view.sceneId, view.layerId),
    ],
    followUp: (layerId) => [
      ...(transform ? [layerSetTransformSpec(view.sceneId, layerId, transform as never)] : []),
      ...(locked ? [layerSetLockedSpec(view.sceneId, layerId, true)] : []),
    ],
    dropped,
    lost,
  }
}

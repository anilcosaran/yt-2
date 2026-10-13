import type { CompositionDocument, CompositionScene } from './composition-client'
import type { CompositionMotionEnergy, CompositionMotionRevisionRef } from './composition-typed-edits'

/**
 * Reading Motion instance layers out of the working copy (E1-D). A document v2 Motion layer
 * (`layer_kind: 'motion_instance'`, `instance.motion_state`) carries the pinned revision, the stored exposed values, the look
 * and its own `scene_range` beside the other layers of the scene (an overlay, D2). The working copy stays the only authority
 * for values; nothing here guesses a value the document does not hold.
 */

type Body = Record<string, unknown>

export type MotionParameterKind = 'text' | 'color' | 'media' | 'duration'

/** One stored exposed value (`ParameterValue` of the document contract). */
export type MotionStoredValue = {
  parameterId: string
  kind: MotionParameterKind
  /** Text / colour string, duration frames, or the Storage object ref of a media value. */
  value: string | number | { storage_object_id: string }
}

export type MotionLayerView = {
  layerId: string
  sceneId: string
  rev: number
  /** Index in `scene.layers` (paint order). */
  zIndex: number
  instanceId: string
  motionRef: CompositionMotionRevisionRef
  /** A document v2 instance (it carries `motion_state`): only these take `motion.parameter.set`. */
  v2: boolean
  energy: CompositionMotionEnergy | null
  ratio: string | null
  /** The VideoStyle preset the instance compiles with. */
  videoStyleRef: string | null
  values: MotionStoredValue[]
  range: { startFrame: number; endFrame: number } | null
}

const ENERGIES: readonly string[] = ['sakin', 'dengeli', 'canli']
const KINDS: readonly string[] = ['text', 'color', 'media', 'duration']

const isObject = (value: unknown): value is Body => typeof value === 'object' && value !== null && !Array.isArray(value)

function refOf(value: unknown): CompositionMotionRevisionRef | null {
  if (!isObject(value)) return null
  const { motion_id: motionId, motion_revision_id: revisionId, scope, manifest_sha256: sha } = value
  if (typeof motionId !== 'string' || typeof revisionId !== 'string' || typeof sha !== 'string') return null
  if (scope !== 'library' && scope !== 'project_private') return null
  return { motion_id: motionId, motion_revision_id: revisionId, scope, manifest_sha256: sha }
}

function valuesOf(value: unknown): MotionStoredValue[] {
  if (!Array.isArray(value)) return []
  const out: MotionStoredValue[] = []
  for (const entry of value) {
    if (!isObject(entry)) continue
    const { parameter_id: parameterId, kind, value: stored } = entry
    if (typeof parameterId !== 'string' || typeof kind !== 'string' || !KINDS.includes(kind)) continue
    if (typeof stored === 'string' || typeof stored === 'number') out.push({ parameterId, kind: kind as MotionParameterKind, value: stored })
    else if (isObject(stored) && typeof stored['storage_object_id'] === 'string') {
      out.push({ parameterId, kind: kind as MotionParameterKind, value: { storage_object_id: stored['storage_object_id'] } })
    }
  }
  return out
}

function rangeOf(value: unknown): MotionLayerView['range'] {
  if (!isObject(value)) return null
  const { start_frame: start, end_frame: end } = value
  return typeof start === 'number' && typeof end === 'number' && end > start ? { startFrame: start, endFrame: end } : null
}

function viewOf(scene: CompositionScene, index: number): MotionLayerView | null {
  const layer = scene.layers[index] as Body | undefined
  if (!layer || layer['layer_kind'] !== 'motion_instance') return null
  const instance = layer['instance']
  if (!isObject(instance)) return null
  const instanceId = instance['instance_id']
  const motionRef = refOf(instance['motion_ref'])
  if (typeof instanceId !== 'string' || !motionRef) return null
  const state = isObject(instance['motion_state']) ? instance['motion_state'] : null
  const energy = state?.['energy']
  const style = state && isObject(state['video_style']) ? state['video_style']['preset_ref'] : null
  return {
    layerId: String(layer['layer_id']),
    sceneId: scene.scene_id,
    rev: typeof layer['rev'] === 'number' ? layer['rev'] : 1,
    zIndex: index,
    instanceId,
    motionRef,
    v2: state !== null,
    energy: typeof energy === 'string' && ENERGIES.includes(energy) ? (energy as CompositionMotionEnergy) : null,
    ratio: typeof state?.['ratio'] === 'string' ? state['ratio'] : null,
    videoStyleRef: typeof style === 'string' ? style : null,
    values: valuesOf(instance['parameter_values']),
    range: rangeOf(layer['scene_range']),
  }
}

/** The Motion layers of one scene in paint order (bottom first). */
export function sceneMotionLayers(document: CompositionDocument | null, sceneId: string | null): MotionLayerView[] {
  if (!document || !sceneId) return []
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  if (!scene) return []
  const views: MotionLayerView[] = []
  for (let index = 0; index < scene.layers.length; index += 1) {
    const view = viewOf(scene, index)
    if (view) views.push(view)
  }
  return views
}

export function motionLayerViewOf(document: CompositionDocument | null, sceneId: string | null, layerId: string): MotionLayerView | null {
  return sceneMotionLayers(document, sceneId).find((view) => view.layerId === layerId) ?? null
}

/** The VideoStyle preset the project's own Motion instances were inserted with (the first found): a new Motion keeps the look. */
export function projectVideoStyleRef(document: CompositionDocument | null): string | null {
  if (!document) return null
  for (const scene of document.scenes) {
    for (const view of sceneMotionLayers(document, scene.scene_id)) if (view.videoStyleRef) return view.videoStyleRef
  }
  return null
}

export type ProjectImageSource = { sourceId: string; storageObjectId: string }

/**
 * The still images the project holds (a Motion media parameter takes one of these). `source_media` lists only sources the
 * server bound and analysed: an upload still being analysed is not in it, so it is not offered yet.
 */
export function projectImageSources(document: CompositionDocument | null): ProjectImageSource[] {
  if (!document) return []
  const out: ProjectImageSource[] = []
  for (const source of document.source_media as Body[]) {
    const object = source['storage_object']
    if (!isObject(object) || object['media_kind'] !== 'image' || typeof object['storage_object_id'] !== 'string') continue
    out.push({ sourceId: String(source['source_id']), storageObjectId: object['storage_object_id'] })
  }
  return out
}

import type { CompositionDocument } from '../composition-client'
import { sourceMediaKind } from '../preview-only'
import type { AnimatableKind } from './animation-catalog'
import { layerAnimationsOf, sceneLayerBody, slotsOf, type LayerSlots } from './layer-animations'

/**
 * Spark effects WP2: what the Animation panel edits for the selected layer. Text, shapes and pictures take animations; a
 * video clip's animations are not exported yet (the export refuses them, the preview leaves them out), so the panel only
 * offers to remove what a video clip carries; a Motion layer animates through its own controls.
 */
export type AnimationTarget =
  | { status: 'none' }
  | { status: 'video'; sceneId: string; layerId: string; layer: Record<string, unknown>; slots: LayerSlots }
  | { status: 'unsupported'; sceneId: string; layerId: string }
  | { status: 'ready'; sceneId: string; layerId: string; kind: AnimatableKind; layer: Record<string, unknown>; slots: LayerSlots }

export function animationTarget(document: CompositionDocument | null, sceneId: string | null, layerId: string | null): AnimationTarget {
  if (!document || !sceneId || !layerId) return { status: 'none' }
  const layer = sceneLayerBody(document.scenes.find((scene) => scene.scene_id === sceneId), layerId)
  if (!layer) return { status: 'none' }
  const kind = layer['layer_kind']
  const slots = slotsOf(layerAnimationsOf(layer))
  if (kind === 'clip') {
    const placement = layer['placement'] as { source_id?: string } | undefined
    if (sourceMediaKind(document, placement?.source_id) === 'video') return { status: 'video', sceneId, layerId, layer, slots }
    return { status: 'ready', sceneId, layerId, kind: 'clip', layer, slots }
  }
  if (kind === 'text' || kind === 'shape') return { status: 'ready', sceneId, layerId, kind, layer, slots }
  return { status: 'unsupported', sceneId, layerId }
}

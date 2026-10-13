import type { CompositionDocument, CompositionOpSpec } from '../composition-client'
import {
  animationSetSpec,
  clipInsertSpec,
  layerSetOpacitySpec,
  shapeInsertSpec,
  textInsertSpec,
  type CompositionAnimationSpec,
  type CompositionTransform,
} from '../composition-typed-edits'
import type { LayerBasis } from './geometry'

/**
 * Duplicate (Ctrl/Cmd+D) and copy / paste (Ctrl/Cmd+C, Ctrl/Cmd+V) of a canvas layer inside the open project. There is no
 * "copy" op: a copy is a NEW layer written with the insert op of its kind (`text.insert`, `shape.insert`, `clip.insert`),
 * carrying the same values, and its animations with `animation.set`, all in ONE command (one undo group). The clipboard is
 * the editor's memory for this page (never browser storage, never the system clipboard). Pure functions.
 *
 * - A duplicate lands right above the original, moved by `DUPLICATE_OFFSET_PX` so it is visible (a layer without a transform
 *   gets one from its drawn box).
 * - A paste lands on top of the target scene at the same place (moved by the offset when it is pasted into its own scene).
 *   Its time range is kept and moved inside a shorter scene; a video longer than the scene does not fit.
 * - Motion layers are not copied (an instance pins its Motion revision and parameters; its insert goes through the Motion
 *   tool): `unsupported`.
 * - A text's style travels whole (line spacing, decoration and outline included) and a layer's opacity with `layer.set_opacity`
 *   in the same command; the editor's UI lock does not travel.
 */

export const DUPLICATE_OFFSET_PX = 24

type Body = Record<string, unknown>

export type LayerCopy = {
  kind: 'text' | 'shape' | 'clip'
  /** The layer body as it was copied (a deep copy: later edits of the original do not change it). */
  body: Body
  sceneId: string
  sceneFrames: number
  /** The layer's drawn box at copy time (null when the canvas did not draw it): a layer without a transform is placed from it. */
  basis: LayerBasis | null
  /** `image` / `video` for a clip. */
  mediaKind: 'image' | 'video' | null
}

export type PasteRefusal = 'unsupported' | 'does_not_fit' | 'missing_source'

function frameRangeOf(value: unknown): { start_frame: number; end_frame: number } | null {
  if (!value || typeof value !== 'object') return null
  const { start_frame: start, end_frame: end } = value as Body
  return typeof start === 'number' && typeof end === 'number' && end > start ? { start_frame: start, end_frame: end } : null
}

function mediaKindOf(document: CompositionDocument, sourceId: unknown): 'image' | 'video' | null {
  const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const kind = (source?.['storage_object'] as Body | undefined)?.['media_kind']
  return kind === 'image' || kind === 'video' ? kind : null
}

/** What Ctrl/Cmd+C keeps of a layer (null for a layer that is not copied: Motion, a pending slot, a missing layer). */
export function copyOfLayer(input: {
  document: CompositionDocument
  sceneId: string
  layerId: string
  sceneFrames: number
  basis: LayerBasis | null
}): LayerCopy | null {
  const scene = input.document.scenes.find((candidate) => candidate.scene_id === input.sceneId)
  const layer = scene?.layers.find((candidate) => candidate.layer_id === input.layerId) as Body | undefined
  const kind = layer?.['layer_kind']
  if (!layer || (kind !== 'text' && kind !== 'shape' && kind !== 'clip')) return null
  const mediaKind = kind === 'clip' ? mediaKindOf(input.document, (layer['placement'] as Body | undefined)?.['source_id']) : null
  if (kind === 'clip' && mediaKind === null) return null
  return { kind, body: structuredClone(layer), sceneId: input.sceneId, sceneFrames: input.sceneFrames, basis: input.basis ? { ...input.basis } : null, mediaKind }
}

/** The copy's transform moved by `offset` canvas pixels (from its drawn box when it has none; none when neither exists). */
function movedTransform(copy: LayerCopy, offset: number): CompositionTransform | undefined {
  const stored = copy.body['transform'] as CompositionTransform | undefined
  const round = (value: number) => Math.round(value * 100) / 100
  if (stored) return { ...stored, x: round(stored.x + offset), y: round(stored.y + offset) }
  if (offset === 0) return undefined
  if (!copy.basis) return undefined
  return { x: round(copy.basis.x + offset), y: round(copy.basis.y + offset), scale: copy.basis.scale, rotation_deg: copy.basis.rotationDeg }
}

/** The copy's range inside a scene of `frames` (kept when it fits, moved to the end, shortened only for a still). */
function rangeIn(copy: LayerCopy, range: { start_frame: number; end_frame: number }, frames: number): { start_frame: number; end_frame: number } | null {
  const length = range.end_frame - range.start_frame
  if (range.end_frame <= frames) return range
  if (length <= frames) return { start_frame: frames - length, end_frame: frames }
  // Text, shapes and stills simply end with the scene; a video plays at 1x and cannot be shortened by a paste.
  if (copy.kind === 'clip' && copy.mediaKind === 'video') return null
  return { start_frame: 0, end_frame: frames }
}

/** Animations that travel with the copy: only when its time range and its scene's length are unchanged (anchors stay valid). */
function animationsOf(copy: LayerCopy, sameTiming: boolean): CompositionAnimationSpec[] {
  if (!sameTiming) return []
  const raw = Array.isArray(copy.body['animations']) ? (copy.body['animations'] as CompositionAnimationSpec[]) : []
  return raw.filter((animation) => animation.anchor.kind === 'scene_start' || animation.anchor.kind === 'scene_end' || animation.anchor.kind === 'scene_offset')
}

/**
 * The command that writes `copy` as the new layer `layerId` into `target` (above `afterLayerId`), moved by `offset` canvas
 * pixels. Exactly one spec list (the insert, then its animations).
 */
export function pasteSpecs(input: {
  copy: LayerCopy
  layerId: string
  target: { sceneId: string; sceneFrames: number; afterLayerId: string | null }
  offset: number
  document: CompositionDocument
}): { specs: CompositionOpSpec[] } | { refused: PasteRefusal } {
  const { copy, layerId, target } = input
  const body = copy.body
  const placement = body['placement'] as Body | undefined
  const storedRange = frameRangeOf(copy.kind === 'clip' ? placement?.['scene_range'] : body['scene_range'])
  if (!storedRange) return { refused: 'unsupported' }
  const range = rangeIn(copy, storedRange, target.sceneFrames)
  if (!range) return { refused: 'does_not_fit' }
  const sameTiming = range.start_frame === storedRange.start_frame && range.end_frame === storedRange.end_frame && target.sceneFrames === copy.sceneFrames
  const transform = movedTransform(copy, input.offset)
  let insert: CompositionOpSpec
  if (copy.kind === 'text') {
    insert = textInsertSpec({
      sceneId: target.sceneId,
      layerId,
      afterLayerId: target.afterLayerId,
      text: String(body['text'] ?? ''),
      style: structuredClone(body['style']) as Parameters<typeof textInsertSpec>[0]['style'],
      sceneRange: range,
      ...(transform && { transform }),
    })
  } else if (copy.kind === 'shape') {
    const size = body['size'] as { width_px: number; height_px: number } | undefined
    const radius = body['corner_radius_px']
    insert = shapeInsertSpec({
      sceneId: target.sceneId,
      layerId,
      afterLayerId: target.afterLayerId,
      shape: body['shape'] as Parameters<typeof shapeInsertSpec>[0]['shape'],
      fill: String(body['fill'] ?? ''),
      sceneRange: range,
      ...(transform && { transform }),
      ...(size && { size: { width_px: size.width_px, height_px: size.height_px } }),
      ...(typeof radius === 'number' && { cornerRadiusPx: radius }),
    })
  } else {
    const sourceId = placement?.['source_id']
    if (typeof sourceId !== 'string' || !input.document.source_media.some((source) => source.source_id === sourceId)) return { refused: 'missing_source' }
    const hold = placement?.['hold_last_frame_frames']
    // A held last frame belongs to the clip's own 1x length: it travels only with an unchanged range.
    const keepHold = typeof hold === 'number' && range.end_frame - range.start_frame === storedRange.end_frame - storedRange.start_frame
    insert = clipInsertSpec({
      sceneId: target.sceneId,
      layerId,
      afterLayerId: target.afterLayerId,
      placement: {
        source_id: sourceId,
        source_range: structuredClone(placement?.['source_range']) as Parameters<typeof clipInsertSpec>[0]['placement']['source_range'],
        scene_range: range,
        ...(keepHold && { hold_last_frame_frames: hold as number }),
      } as Parameters<typeof clipInsertSpec>[0]['placement'],
      ...(transform && { transform }),
      ...(body['audio'] !== undefined && { audio: structuredClone(body['audio']) as Parameters<typeof clipInsertSpec>[0]['audio'] }),
    })
  }
  const animations = animationsOf(copy, sameTiming).map((animation) => animationSetSpec(target.sceneId, layerId, structuredClone(animation)))
  // Spark styling round: the copy keeps its opacity (the insert ops carry none); the UI-only lock is not copied (a copy is a
  // new layer the user just made, free to move).
  const opacity = body['opacity']
  const opacitySpecs = typeof opacity === 'number' && opacity >= 0 && opacity < 1 && !(copy.kind === 'clip' && copy.mediaKind === 'video') ? [layerSetOpacitySpec(target.sceneId, layerId, opacity)] : []
  return { specs: [insert, ...opacitySpecs, ...animations] }
}

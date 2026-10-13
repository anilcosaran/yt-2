import type { CompositionEntityRef, CompositionOpSpec } from '../composition-client'
import {
  layerRemoveSpec,
  layerSetLockedSpec,
  layerSetOpacitySpec,
  layerSetTransformSpec,
  newLayerId,
  shapeSetCornerRadiusSpec,
  shapeSetFillSpec,
  shapeSetSizeSpec,
  textInsertSpec,
  textSetSpec,
  textSetStyleSpec,
  type CompositionFontRef,
  type CompositionShapeSize,
  type CompositionTextAlign,
  type CompositionTransform,
  type TextStyleSpecPatch,
} from '../composition-typed-edits'
import type { LayerBasis } from './geometry'
import { transformOfBasis } from './geometry'

/**
 * Typed commands the stage issues (D4 table). Builders only: CAS, idempotency, the write queue and undo belong to the
 * session. Each gesture or toolbox action is exactly ONE spec list = one command = one undo group.
 */

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })
const layerRef = (layerId: string): CompositionEntityRef => ({ entity_kind: 'layer', entity_id: layerId })

/**
 * `layer.arrange` (P02-12): the layer's z-order in its scene, right above `afterLayerId` (null = bottom). The layer order
 * belongs to the scene, so the scene is the structural parent that is read and changed; the layer body and its rev stay.
 */
export function layerArrangeSpec(sceneId: string, layerId: string, afterLayerId: string | null): CompositionOpSpec {
  if (afterLayerId === layerId) throw new Error('A layer cannot be placed above itself')
  return {
    op: { op: 'layer.arrange', scene_id: sceneId, layer_id: layerId, after_layer_id: afterLayerId },
    reads: [sceneRef(sceneId)],
    targets: [sceneRef(sceneId)],
  }
}

export type ArrangeAction = 'front' | 'forward' | 'backward' | 'back'

/**
 * `after_layer_id` that performs an order action on `layerId` inside `order` (paint order, bottom first), or `undefined`
 * when the layer is already there (nothing to send). `null` is a valid answer: the bottom.
 */
export function arrangeAfter(order: readonly string[], layerId: string, action: ArrangeAction): string | null | undefined {
  const index = order.indexOf(layerId)
  if (index < 0) return undefined
  const others = order.filter((id) => id !== layerId)
  switch (action) {
    case 'front':
      return index === order.length - 1 ? undefined : others[others.length - 1] ?? null
    case 'back':
      return index === 0 ? undefined : null
    case 'forward':
      // One step up: right above the layer that is currently above this one.
      return index === order.length - 1 ? undefined : order[index + 1]!
    case 'backward':
      // One step down: right above the layer two below (or the bottom).
      return index === 0 ? undefined : (order[index - 2] ?? null)
  }
}

/** One `layer.set_transform` with the full value of `basis` (never a partial transform). */
export function transformCommit(sceneId: string, layerId: string, basis: LayerBasis): CompositionOpSpec[] {
  return [layerSetTransformSpec(sceneId, layerId, transformOfBasis(basis))]
}

export function transformClear(sceneId: string, layerId: string): CompositionOpSpec[] {
  return [layerSetTransformSpec(sceneId, layerId, null)]
}

export function textSizeCommit(sceneId: string, layerId: string, sizePx: number): CompositionOpSpec[] {
  return [textSetStyleSpec(sceneId, layerId, { sizePx })]
}

export function layerDeleteCommit(sceneId: string, layerId: string): CompositionOpSpec[] {
  return [layerRemoveSpec(sceneId, layerId)]
}

export function arrangeCommit(sceneId: string, layerId: string, order: readonly string[], action: ArrangeAction): CompositionOpSpec[] {
  const after = arrangeAfter(order, layerId, action)
  return after === undefined ? [] : [layerArrangeSpec(sceneId, layerId, after)]
}

/** NFC text as the server stores it, or null when the commit must not be sent (empty, unchanged or too long). */
export const TEXT_MAX_CODEPOINTS = 2000

export function normalizeTextCommit(input: string, current: string): { text: string } | { reject: 'empty' | 'unchanged' | 'too_long' } {
  const text = input.normalize('NFC')
  if (text.trim().length === 0) return { reject: 'empty' }
  if ([...text].length > TEXT_MAX_CODEPOINTS) return { reject: 'too_long' }
  if (text === current.normalize('NFC')) return { reject: 'unchanged' }
  return { text }
}

export function textCommit(sceneId: string, layerId: string, text: string): CompositionOpSpec[] {
  return [textSetSpec(sceneId, layerId, text)]
}

export function styleCommit(sceneId: string, layerId: string, patch: TextStyleSpecPatch): CompositionOpSpec[] {
  return [textSetStyleSpec(sceneId, layerId, patch)]
}

/** Spark styling round: a layer's opacity (0-1; 1 is sent as `null`: the field is removed, never stored as 1). */
export function opacityCommit(sceneId: string, layerId: string, opacity: number): CompositionOpSpec[] {
  return [layerSetOpacitySpec(sceneId, layerId, opacity >= 1 ? null : opacity)]
}

/** Spark styling round: the editor's UI lock of a layer. */
export function lockCommit(sceneId: string, layerId: string, locked: boolean): CompositionOpSpec[] {
  return [layerSetLockedSpec(sceneId, layerId, locked)]
}

export function fillCommit(sceneId: string, layerId: string, fill: string): CompositionOpSpec[] {
  return [shapeSetFillSpec(sceneId, layerId, fill)]
}

/** Full transform of a numeric Properties field change (position, scale, rotation) on top of the current basis. */
export function transformFieldCommit(
  sceneId: string,
  layerId: string,
  basis: LayerBasis,
  patch: { x?: number; y?: number; scale?: number; rotationDeg?: number },
): CompositionOpSpec[] {
  return transformCommit(sceneId, layerId, patchedBasis(basis, patch))
}

/** The basis a numeric Properties field change produces (what the next write must build on until the redraw). */
export function patchedBasis(basis: LayerBasis, patch: { x?: number; y?: number; scale?: number; rotationDeg?: number }): LayerBasis {
  return {
    ...basis,
    ...(patch.x !== undefined && { x: patch.x }),
    ...(patch.y !== undefined && { y: patch.y }),
    ...(patch.scale !== undefined && { scale: patch.scale }),
    ...(patch.rotationDeg !== undefined && { rotationDeg: patch.rotationDeg }),
  }
}

/**
 * E1-B (D4): the command of a shape resize (a handle drag or a Width/Height field). The top-left is part of it whenever it
 * can move: a handle drag always sends the full transform (a layer without one is centred by the compiler, so a new size
 * must pin the corner the user did not drag), a field only when the layer has no transform yet. A pill's radius follows.
 */
export function shapeResizeCommit(
  sceneId: string,
  layerId: string,
  input: { basis: LayerBasis; size: CompositionShapeSize; pinPosition: boolean; cornerRadiusPx?: number },
): CompositionOpSpec[] {
  return [
    ...(input.pinPosition ? transformCommit(sceneId, layerId, input.basis) : []),
    shapeSetSizeSpec(sceneId, layerId, input.size),
    ...(input.cornerRadiusPx !== undefined ? [shapeSetCornerRadiusSpec(sceneId, layerId, input.cornerRadiusPx)] : []),
  ]
}

export function cornerRadiusCommit(sceneId: string, layerId: string, cornerRadiusPx: number | null): CompositionOpSpec[] {
  return [shapeSetCornerRadiusSpec(sceneId, layerId, cornerRadiusPx)]
}

export function isValidTransform(value: CompositionTransform): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && value.scale > 0 && Number.isFinite(value.scale) && Number.isFinite(value.rotation_deg)
}

// ---------------------------------------------------------------- adding layers (rail "Text" and "Media")

type FrameRange = { start_frame: number; end_frame: number }

/**
 * `clip.insert_sequence` into an EXISTING scene (the rail's media "Add to this scene"): the server computes the clip's
 * ranges from the source probe (a video at its real length, an image for the hold). The new layer goes on top.
 */
export function clipInsertSequenceSpec(input: {
  sceneId: string
  afterLayerId: string | null
  startFrame: number
  imageHoldFrames?: number
  items: Array<{ layerId: string; sourceId: string; sourceRange?: { in_tick: number; out_tick: number } }>
}): CompositionOpSpec {
  return {
    op: {
      op: 'clip.insert_sequence',
      scene_id: input.sceneId,
      after_layer_id: input.afterLayerId,
      start_frame: input.startFrame,
      ...(input.imageHoldFrames !== undefined && { image_hold_frames: input.imageHoldFrames }),
      items: input.items.map((item) => ({
        layer_id: item.layerId,
        source_id: item.sourceId,
        ...(item.sourceRange && { source_range: item.sourceRange }),
      })),
    },
    reads: [sceneRef(input.sceneId)],
    targets: [sceneRef(input.sceneId), ...input.items.map((item) => layerRef(item.layerId))],
  }
}

/**
 * Where a newly added media clip plays inside the scene: from the playhead's scene-local frame (clamped into the scene),
 * so "add a video" lands where the user is. An image holds for `holdFrames` but never past the scene end (a fixed scene
 * keeps its length; a scene that follows media simply grows).
 */
export function mediaStartFrame(input: { localFrame: number; sceneFrames: number }): number {
  return Math.min(Math.max(0, Math.floor(input.localFrame)), Math.max(0, input.sceneFrames - 1))
}

export function mediaImageHoldFrames(input: { startFrame: number; sceneFrames: number; holdFrames: number; followsMedia: boolean }): number {
  if (input.followsMedia) return Math.max(1, input.holdFrames)
  return Math.max(1, Math.min(input.holdFrames, input.sceneFrames - input.startFrame))
}

export type NewTextDefaults = {
  font: CompositionFontRef
  sizePx: number
  color: string
  align?: CompositionTextAlign
}

/**
 * Defaults of a new text layer: the heading face of the platform font catalogue (the face nearest weight 700 of the
 * first family), a size of 8% of the canvas height and white, since the project Kit defaults (P02-02) are not read here.
 */
export function newTextDefaults(
  families: ReadonlyArray<{ family: string; faces: ReadonlyArray<{ font: CompositionFontRef; weight: number; style: 'normal' | 'italic' }> }>,
  canvasHeight: number,
): NewTextDefaults | null {
  const faces = families[0]?.faces.filter((face) => face.style === 'normal') ?? families[0]?.faces ?? []
  if (faces.length === 0) return null
  const face = [...faces].sort((a, b) => Math.abs(a.weight - 700) - Math.abs(b.weight - 700))[0]!
  return { font: face.font, sizePx: Math.round(canvasHeight * 0.08), color: '#ffffff', align: 'center' }
}

export function textInsertAction(input: {
  sceneId: string
  afterLayerId: string | null
  uuid: () => string
  text: string
  defaults: NewTextDefaults
  sceneRange: FrameRange
}): { layerId: string; specs: CompositionOpSpec[] } {
  const layerId = newLayerId(input.uuid())
  return {
    layerId,
    specs: [
      textInsertSpec({
        sceneId: input.sceneId,
        layerId,
        afterLayerId: input.afterLayerId,
        text: input.text.normalize('NFC'),
        style: {
          font: input.defaults.font,
          size_px: input.defaults.sizePx,
          color: input.defaults.color,
          ...(input.defaults.align && { align: input.defaults.align }),
        },
        sceneRange: input.sceneRange,
      }),
    ],
  }
}

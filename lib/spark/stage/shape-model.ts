import type { CompositionOpSpec } from '../composition-client'
import type { StageLayerView } from './document-layers'
import { newLayerId, shapeInsertSpec, type CompositionShape, type CompositionShapeSize } from '../composition-typed-edits'
import { cornerPoint, cornerRatio, oppositeCorner, visualBox, type Corner, type LayerBasis, type Point } from './geometry'
import { centredTransformAt, type StagePlacement } from './placement'

/**
 * E1-B (D4) the shapes of the editor: the five kinds the drawer offers, how a new one is placed, and the pure geometry
 * of resizing one. A shape stores a `size` box and an optional `corner_radius_px` (document v1, `shape.set_size` /
 * `shape.set_corner_radius`); "square", "circle" and "pill" are not stored kinds, they are the way a rect or an ellipse
 * is sized (a pill is a rect with radius `height / 2`). Pure functions: no DOM, no session, no clock.
 */

export const SHAPE_KINDS = ['square', 'rectangle', 'circle', 'ellipse', 'pill'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]

/** Canvas pixels. The smallest box a gesture or a field produces (grabbable) and the contract's largest. */
export const MIN_SHAPE_PX = 8
export const MAX_SHAPE_PX = 16384

export type ShapePreset = {
  shape: Extract<CompositionShape, 'rect' | 'ellipse'>
  size: CompositionShapeSize
  /** Corner radius in canvas pixels; null = none. */
  cornerRadiusPx: number | null
}

const SQUARE_PX = 240
const WIDE = { width_px: 360, height_px: 200 }

/** D4 defaults: 240x240 for the square and the circle, 360x200 for the rectangle, the ellipse and the pill (radius 100). */
export function shapePreset(kind: ShapeKind): ShapePreset {
  switch (kind) {
    case 'square':
      return { shape: 'rect', size: { width_px: SQUARE_PX, height_px: SQUARE_PX }, cornerRadiusPx: null }
    case 'rectangle':
      return { shape: 'rect', size: { ...WIDE }, cornerRadiusPx: null }
    case 'circle':
      return { shape: 'ellipse', size: { width_px: SQUARE_PX, height_px: SQUARE_PX }, cornerRadiusPx: null }
    case 'ellipse':
      return { shape: 'ellipse', size: { ...WIDE }, cornerRadiusPx: null }
    case 'pill':
      return { shape: 'rect', size: { ...WIDE }, cornerRadiusPx: WIDE.height_px / 2 }
  }
}

export function isShapeKind(value: unknown): value is ShapeKind {
  return typeof value === 'string' && (SHAPE_KINDS as readonly string[]).includes(value)
}

/**
 * The colour of a new shape when nothing better is known: the light theme's `--primary` token (`#1D4ED8`, globals.css),
 * the value `--st-accent` resolves to. The drawer prefers the project's Brand Kit.
 */
export const FALLBACK_SHAPE_FILL = '#1d4ed8'

/** A layer the stage resizes by its box: a rect or an ellipse (a `line` has none). */
export const isBoxedShape = (view: Pick<StageLayerView, 'kind' | 'shape'>): boolean => view.kind === 'shape' && (view.shape === 'rect' || view.shape === 'ellipse')

/** Normalised colour of a new shape: `#rrggbb` (the contract also takes alpha; the drawer never makes one). */
const HEX6 = /^#[0-9a-f]{6}$/i
export function isShapeFill(value: unknown): value is string {
  return typeof value === 'string' && HEX6.test(value)
}

export type ShapeInsertAction = { layerId: string; specs: CompositionOpSpec[]; size: CompositionShapeSize }

/**
 * The command of "add this shape" at a resolved placement: one `shape.insert` on top of the scene, from the placement's
 * start frame to the end of the scene (never past it). Without a drop point the box is centred on the canvas (no
 * transform); with one (a canvas drop) its centre goes to the point, moved inside the canvas when it fits (D14).
 */
export function shapeInsertAction(input: { placement: StagePlacement; kind: ShapeKind; fill: string; uuid: () => string }): ShapeInsertAction {
  const { placement, kind } = input
  const preset = shapePreset(kind)
  const layerId = newLayerId(input.uuid())
  const transform = placement.dropPoint
    ? centredTransformAt(placement.dropPoint, { width: preset.size.width_px, height: preset.size.height_px }, placement.canvas)
    : undefined
  return {
    layerId,
    size: preset.size,
    specs: [
      shapeInsertSpec({
        sceneId: placement.sceneId,
        layerId,
        afterLayerId: placement.afterLayerId,
        shape: preset.shape,
        fill: input.fill,
        sceneRange: { start_frame: placement.startFrame, end_frame: Math.max(placement.startFrame + 1, placement.sceneFrames) },
        size: preset.size,
        ...(preset.cornerRadiusPx !== null && { cornerRadiusPx: preset.cornerRadiusPx }),
        ...(transform && { transform }),
      }),
    ],
  }
}

// ---------------------------------------------------------------- what a stored shape is

/** A box counts as square when its sides differ by less than half a pixel. */
const EQUAL_SIDES_PX = 0.5

export const sidesEqual = (width: number, height: number): boolean => Math.abs(width - height) < EQUAL_SIDES_PX

/** A rect whose radius reaches half of its shorter side is a pill (the compiler draws no more than that). */
export function isPillRadius(radiusPx: number | null | undefined, width: number, height: number): boolean {
  return typeof radiusPx === 'number' && radiusPx > 0 && radiusPx >= Math.min(width, height) / 2 - EQUAL_SIDES_PX
}

/** The pill radius of a box (half of the shorter side), whole pixels. */
export const pillRadius = (width: number, height: number): number => Math.round(Math.min(width, height) / 2)

/**
 * Which drawer kind a stored shape corresponds to (labels and the aspect rule): a rect with equal sides is a square, a
 * rect whose radius reaches half its shorter side a pill, any other rect a rectangle; an ellipse with equal sides is a
 * circle, any other an ellipse. A `line` (or an unknown shape) is none of them.
 */
export function shapeKindOf(shape: string | undefined, size: { widthPx: number; heightPx: number }, cornerRadiusPx?: number): ShapeKind | null {
  if (shape === 'ellipse') return sidesEqual(size.widthPx, size.heightPx) ? 'circle' : 'ellipse'
  if (shape !== 'rect') return null
  if (isPillRadius(cornerRadiusPx, size.widthPx, size.heightPx)) return 'pill'
  return sidesEqual(size.widthPx, size.heightPx) ? 'square' : 'rectangle'
}

/**
 * D4: the handles of a square and a circle resize them uniformly without a modifier (their sides stay equal); the other
 * shapes resize freely. Shift flips whichever it is (Shift on a rectangle keeps its proportions, Shift on a square frees
 * it), so every shape can reach every proportion from the handles.
 */
export function isAspectLocked(width: number, height: number, shiftKey: boolean): boolean {
  return sidesEqual(width, height) !== shiftKey
}

// ---------------------------------------------------------------- resizing

/** The eight handles of a selection: the four corners (as in `geometry.ts`) and the four edge middles. */
export type ShapeHandle = Corner | 'n' | 'e' | 's' | 'w'

export const isEdgeHandle = (handle: string): handle is 'n' | 'e' | 's' | 'w' => handle === 'n' || handle === 'e' || handle === 's' || handle === 'w'

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const clampPx = (value: number): number => Math.min(MAX_SHAPE_PX, Math.max(MIN_SHAPE_PX, value))

export type ShapeResize = {
  /** The layer's basis after the drag: new top-left, new unscaled box, the SAME scale and rotation. */
  basis: LayerBasis
  size: CompositionShapeSize
}

/**
 * Resizes a shape by dragging `handle` to `pointer` (canvas pixels). The box is the UNSCALED size; the visual box is
 * `size * scale`, and `transform.scale` never changes by a resize (a resize edits the size, the scale stays what the user
 * set). The anchor is the opposite corner / edge (`fromCentre`: the centre). A corner follows the pointer on both axes;
 * with `lock` it follows the diagonal and keeps the proportions; an edge moves one axis (the lock does not apply). The
 * size is clamped to 8..16384 px and rounded to whole pixels, then the top-left is derived from it so the anchor never
 * drifts.
 */
export function resizeShapeBasis(input: { basis: LayerBasis; handle: ShapeHandle; pointer: Point; lock: boolean; fromCentre: boolean }): ShapeResize {
  const { basis, handle, pointer, lock, fromCentre } = input
  const scale = basis.scale > 0 ? basis.scale : 1
  const box = visualBox(basis)
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const minVisual = MIN_SHAPE_PX * scale
  const maxVisual = MAX_SHAPE_PX * scale
  const clampVisual = (value: number) => Math.min(maxVisual, Math.max(minVisual, value))
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')

  let width = box.width
  let height = box.height
  if (isEdgeHandle(handle) || !lock) {
    // Each axis the handle touches follows the pointer, measured from the fixed side (or from the centre, doubled).
    if (east || west) {
      const distance = east ? pointer.x - (fromCentre ? centre.x : box.x) : (fromCentre ? centre.x : box.x + box.width) - pointer.x
      width = clampVisual(fromCentre ? distance * 2 : distance)
    }
    if (north || south) {
      const distance = south ? pointer.y - (fromCentre ? centre.y : box.y) : (fromCentre ? centre.y : box.y + box.height) - pointer.y
      height = clampVisual(fromCentre ? distance * 2 : distance)
    }
  } else {
    const corner = handle as Corner
    const anchor = fromCentre ? centre : cornerPoint(box, oppositeCorner(corner))
    const ratio = cornerRatio(anchor, cornerPoint(box, corner), pointer, 0)
    const bounded = Math.min(maxVisual / Math.max(box.width, box.height), Math.max(minVisual / Math.min(box.width, box.height), ratio))
    width = box.width * bounded
    height = box.height * bounded
  }

  const size = { width_px: clampPx(round(width / scale)), height_px: clampPx(round(height / scale)) }
  const visualWidth = size.width_px * scale
  const visualHeight = size.height_px * scale
  const x = fromCentre ? centre.x - visualWidth / 2 : west ? box.x + box.width - visualWidth : box.x
  const y = fromCentre ? centre.y - visualHeight / 2 : north ? box.y + box.height - visualHeight : box.y
  return { basis: { ...basis, x: round(x, 2), y: round(y, 2), width: size.width_px, height: size.height_px }, size }
}

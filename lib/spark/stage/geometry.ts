import type { CompositionTransform } from '../composition-typed-edits'
import type { StageRect } from './stage-types'

/**
 * Pure layer geometry of the stage (D4): the same rules `scene_compiler@1` applies, in canvas pixels. A layer's natural
 * box is centred when it has no `transform`; a `transform` places the box's TOP-LEFT corner at `x/y`, scales it about
 * that corner and rotates its content about the box centre. Document v1 stores no width/height, so every resize of a
 * non-text layer is a uniform scale, and every gesture produces the FULL transform value (`layer.set_transform` replaces
 * the whole field).
 */

export type Point = { x: number; y: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/** A layer's box as the compiler placed it: top-left, unscaled size, scale about the top-left corner, rotation. */
export type LayerBasis = {
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotationDeg: number
  crop?: CompositionTransform['crop']
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** The scaled, unrotated box a basis occupies on the canvas. */
export function visualBox(basis: LayerBasis): StageRect {
  return { x: basis.x, y: basis.y, width: basis.width * basis.scale, height: basis.height * basis.scale }
}

export function transformOfBasis(basis: LayerBasis): CompositionTransform {
  return {
    x: round(basis.x, 2),
    y: round(basis.y, 2),
    scale: round(basis.scale, 4),
    rotation_deg: basis.rotationDeg,
    ...(basis.crop && { crop: basis.crop }),
  }
}

/** Translates a layer: one `layer.set_transform` value (positions rounded to 0.01 px). */
export function moveBasis(basis: LayerBasis, dx: number, dy: number): LayerBasis {
  return { ...basis, x: basis.x + dx, y: basis.y + dy }
}

/** Corner opposite to `corner` (the one that stays fixed while a corner is dragged). */
export function oppositeCorner(corner: Corner): Corner {
  return ({ nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' } as const)[corner]
}

export function cornerPoint(box: StageRect, corner: Corner): Point {
  return {
    x: corner === 'nw' || corner === 'sw' ? box.x : box.x + box.width,
    y: corner === 'nw' || corner === 'ne' ? box.y : box.y + box.height,
  }
}

/**
 * Uniform scale ratio of a corner drag: the pointer's projection on the diagonal from the fixed anchor through the
 * corner's start position (so dragging outward along the diagonal grows, inward shrinks, and sideways jitter does not).
 */
export function cornerRatio(anchor: Point, cornerStart: Point, pointer: Point, minRatio = 0.05): number {
  const vx = cornerStart.x - anchor.x
  const vy = cornerStart.y - anchor.y
  const length = vx * vx + vy * vy
  if (length === 0) return 1
  const ratio = ((pointer.x - anchor.x) * vx + (pointer.y - anchor.y) * vy) / length
  return Math.max(minRatio, ratio)
}

/**
 * Scales a layer by `ratio` so that the anchor point stays where it is (the opposite corner, or the centre with Alt).
 * The scale is about the top-left corner, so the top-left moves to keep the anchor fixed.
 */
export function scaleBasisAround(basis: LayerBasis, ratio: number, anchor: Point): LayerBasis {
  const box = visualBox(basis)
  const x = anchor.x - (anchor.x - box.x) * ratio
  const y = anchor.y - (anchor.y - box.y) * ratio
  return { ...basis, x, y, scale: basis.scale * ratio }
}

/** New font size of a text layer from a corner drag ratio (the wrap changes with the size; the frame width is fixed). */
export function textSizeForRatio(sizePx: number, ratio: number): number {
  return Math.min(1000, Math.max(4, round(sizePx * ratio, 1)))
}

/** Centres the scaled box on the canvas along the given axes. */
export function centreBasis(basis: LayerBasis, canvas: { width: number; height: number }, axes: 'h' | 'v' | 'hv' = 'hv'): LayerBasis {
  const box = visualBox(basis)
  return {
    ...basis,
    x: axes.includes('h') ? (canvas.width - box.width) / 2 : basis.x,
    y: axes.includes('v') ? (canvas.height - box.height) / 2 : basis.y,
  }
}

/** Contain-fit of a media of `naturalWidth × naturalHeight` inside the canvas (the image/video natural box rule). */
export function containFit(canvas: { width: number; height: number }, naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  if (!(naturalWidth > 0 && naturalHeight > 0)) return { width: canvas.width, height: canvas.height }
  const fit = Math.min(canvas.width / naturalWidth, canvas.height / naturalHeight)
  return { width: round(naturalWidth * fit, 4), height: round(naturalHeight * fit, 4) }
}

/**
 * Basis of a layer the runtime does not draw (video): the contain-fit natural box, centred without a transform, else
 * the transform's top-left and scale (the image rule; Round 2's composite must draw the same box).
 */
export function nativeBasis(
  canvas: { width: number; height: number },
  natural: { width: number; height: number },
  transform: CompositionTransform | null,
): LayerBasis {
  const fit = containFit(canvas, natural.width, natural.height)
  if (transform) {
    return { x: transform.x, y: transform.y, width: fit.width, height: fit.height, scale: transform.scale, rotationDeg: transform.rotation_deg, ...(transform.crop && { crop: transform.crop }) }
  }
  return { x: round((canvas.width - fit.width) / 2, 4), y: round((canvas.height - fit.height) / 2, 4), width: fit.width, height: fit.height, scale: 1, rotationDeg: 0 }
}

/** Basis of a runtime-drawn layer: the IR's natural box plus the transform's rotation/crop from the document. */
export function basisFromNatural(
  natural: { x: number; y: number; width: number; height: number; scale: number },
  transform: CompositionTransform | null,
): LayerBasis {
  return {
    x: natural.x,
    y: natural.y,
    width: natural.width,
    height: natural.height,
    scale: natural.scale,
    rotationDeg: transform?.rotation_deg ?? 0,
    ...(transform?.crop && { crop: transform.crop }),
  }
}

export function pointInRect(point: Point, rect: StageRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

/** Client pixels of the pointer -> canvas pixels, given the frame's client rect and the canvas width it shows. */
export function clientToCanvas(frame: { left: number; top: number; width: number }, canvasWidth: number, client: Point): Point {
  const scale = frame.width / canvasWidth
  return { x: (client.x - frame.left) / scale, y: (client.y - frame.top) / scale }
}

/** Canvas rectangle -> CSS pixels inside the frame (the selection overlay, guides and the toolbox anchor). */
export function canvasRectToFrame(rect: StageRect, scale: number): StageRect {
  return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale }
}

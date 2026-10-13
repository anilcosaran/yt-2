import type { SparkAspectRatio } from '../api'
import { orderedScenes, type CompositionDocument, type CompositionEntityRef, type CompositionOpSpec } from '../composition-client'
import { layerSetTransformSpec, type CompositionTransform } from '../composition-typed-edits'
import { containBox, coverTransform, mediaFitOf, type Size } from './cover-transform'
import type { StageRect } from './stage-types'

/**
 * The canvas format switch of the editor (16:9 / 9:16 / 1:1): ONE command, `canvas.set_format` followed by a pure re-layout of
 * every layer, so one undo reverts the canvas and every layer edit. The canvas sizes are the F35 1080p sizes the gateway
 * writes (`ASPECT_CANVAS_SIZES`), the safe areas the preview's (`aspectSafeArea`: 9:16 the social union profile, the others
 * a 5 % title-safe margin). 4:5 is not a canvas format of document v1 and is not offered.
 *
 * Rules (coordinator, 2026-10-03):
 * - a clip WITHOUT a transform is fitted by the compiler on every canvas (contain, centred): nothing to write;
 * - a clip that COVERED the old canvas covers the new one (`coverTransform`: scale + offset, never a crop);
 * - every other layer with a transform (text, shape, a moved or scaled clip, a Motion overlay) keeps its relative centre,
 *   its scale follows the canvas's short side, and its box is pulled inside the new safe area when it fits there (inside the
 *   canvas otherwise, centred on an axis where it is larger than the canvas);
 * - a layer without a transform (a centred text, a canvas-sized shape) follows the compiler's centring: nothing to write;
 * - Motion layers were compiled for one format (`motion_state.ratio`) and are never scaled: they are counted so the impact
 *   list can say they will not be drawn on the new canvas.
 * Pure functions: no DOM, no session.
 */

export const CANVAS_FORMATS: readonly SparkAspectRatio[] = ['16:9', '9:16', '1:1']

/** The F35 canvas of each format (`api-gateway` `ASPECT_CANVAS_SIZES`). */
export const FORMAT_CANVAS: Readonly<Record<SparkAspectRatio, Size>> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

/** Inset shares of the safe area per format (`ASPECT_SAFE_AREA_PROFILES`: `social_union` for 9:16, `title_safe` otherwise). */
const SAFE_INSETS: Readonly<Record<SparkAspectRatio, { top: number; bottom: number; left: number; right: number }>> = {
  '16:9': { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  '9:16': { top: 0.09, bottom: 0.2, left: 0.05, right: 0.13 },
  '1:1': { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
}

/** The compiler's text frame: a share of the canvas width (`TEXT_FRAME_WIDTH_SHARE`). */
const TEXT_FRAME_WIDTH_SHARE = 0.9
/** Line height of the estimate of a re-wrapped text (the compiler lays the real one out). */
const LINE_HEIGHT = 1.2

/** The safe rectangle of a format in canvas px, rounded like the gateway's `aspectSafeArea` (4 decimals). */
export function safeAreaOf(format: SparkAspectRatio): StageRect {
  const canvas = FORMAT_CANVAS[format]
  const insets = SAFE_INSETS[format]
  const q = (value: number) => Math.round(value * 1e4) / 1e4
  return {
    x: q(insets.left * canvas.width),
    y: q(insets.top * canvas.height),
    width: q((1 - insets.left - insets.right) * canvas.width),
    height: q((1 - insets.top - insets.bottom) * canvas.height),
  }
}

export function isCanvasFormat(value: unknown): value is SparkAspectRatio {
  return typeof value === 'string' && (CANVAS_FORMATS as readonly string[]).includes(value)
}

const canvasRef = (): CompositionEntityRef => ({ entity_kind: 'canvas', entity_id: 'canvas' })

/** `canvas.set_format` (P06-62): states the format it expects, so a canvas changed meanwhile is refused, never overwritten. */
export function canvasSetFormatSpec(expected: SparkAspectRatio, next: SparkAspectRatio): CompositionOpSpec {
  return { op: { op: 'canvas.set_format', expected_aspect_ratio: expected, aspect_ratio: next }, reads: [], targets: [canvasRef()] }
}

export type AspectImpact = {
  from: SparkAspectRatio
  to: SparkAspectRatio
  /** Scenes that hold at least one layer the switch moves or re-covers. */
  scenes: number
  /** Clips that covered the old canvas and cover the new one. */
  recovered: number
  /** Clips the compiler fits by itself (no transform). */
  refitted: number
  /** Texts, shapes, moved clips and Motion overlays placed again by their relative centre. */
  moved: number
  /** Moved clips whose media size could not be read: placed by their top-left only (check them). */
  review: number
  /** Motion layers made for the old format: they are not drawn on the new canvas until they are replaced. */
  motion: number
}

export type AspectPlan = { specs: CompositionOpSpec[]; impact: AspectImpact }

type Body = Record<string, unknown>

function transformOf(value: unknown): CompositionTransform | null {
  if (!value || typeof value !== 'object') return null
  const { x, y, scale, rotation_deg: rotation } = value as Body
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number' || typeof rotation !== 'number') return null
  return value as CompositionTransform
}

/** The format a Motion instance was compiled for (`instance.motion_state.ratio`); null for a Motion without that state. */
function motionRatioOf(body: Body): string | null {
  const ratio = ((body['instance'] as Body | undefined)?.['motion_state'] as Body | undefined)?.['ratio']
  return typeof ratio === 'string' ? ratio : null
}

const round2 = (value: number) => Math.round(value * 100) / 100
const round4 = (value: number) => Math.round(value * 10000) / 10000

/**
 * Places a box of `size` (unscaled) at `scale` so its centre sits at `centre`, then pulls it inside `safe` when it fits there,
 * inside the canvas when it fits there, or centres it on an axis where it is larger than the canvas.
 */
function placeBox(centre: { x: number; y: number }, size: Size, scale: number, canvas: Size, safe: StageRect): { x: number; y: number } {
  const width = size.width * scale
  const height = size.height * scale
  const axis = (middle: number, extent: number, safeStart: number, safeExtent: number, limit: number) => {
    const start = middle - extent / 2
    if (extent <= safeExtent) return Math.min(Math.max(start, safeStart), safeStart + safeExtent - extent)
    if (extent <= limit) return Math.min(Math.max(start, 0), limit - extent)
    return (limit - extent) / 2
  }
  return { x: axis(centre.x, width, safe.x, safe.width, canvas.width), y: axis(centre.y, height, safe.y, safe.height, canvas.height) }
}

/** The natural (unscaled) box of a text layer on a canvas: the frame width, and its height estimated from the old layout. */
function textBox(body: Body, canvas: Size, previous: { canvas: Size; height: number | null }): Size {
  const style = body['style'] as { size_px?: unknown } | undefined
  const sizePx = typeof style?.size_px === 'number' ? style.size_px : 48
  const line = sizePx * LINE_HEIGHT
  const oldFrame = Math.round(TEXT_FRAME_WIDTH_SHARE * previous.canvas.width)
  const newFrame = Math.round(TEXT_FRAME_WIDTH_SHARE * canvas.width)
  const oldLines = previous.height !== null ? Math.max(1, Math.round(previous.height / line)) : Math.max(1, String(body['text'] ?? '').split('\n').length)
  const lines = Math.max(1, Math.ceil((oldLines * oldFrame) / Math.max(1, newFrame) - 0.15))
  return { width: newFrame, height: lines * line }
}

export type AspectRelayoutInput = {
  document: CompositionDocument
  to: SparkAspectRatio
  /** Pixel sizes of the project's image and video sources (by source id); a missing one is "unknown". */
  mediaSizes: ReadonlyMap<string, Size>
  /** Natural boxes the canvas already drew (by layer id, canvas px, unscaled): a text's real height on the old canvas. */
  naturalBoxes?: ReadonlyMap<string, Size>
}

/**
 * The command of a format switch and its impact list; null when the document is already in that format (or its canvas is
 * not one of the three formats).
 */
export function planAspectSwitch(input: AspectRelayoutInput): AspectPlan | null {
  const { document, to } = input
  const from = document.canvas.aspect_ratio as SparkAspectRatio
  if (!isCanvasFormat(from) || !isCanvasFormat(to) || from === to) return null
  const oldCanvas: Size = { width: document.canvas.width, height: document.canvas.height }
  const newCanvas = FORMAT_CANVAS[to]
  const safe = safeAreaOf(to)
  const shortRatio = Math.min(newCanvas.width, newCanvas.height) / Math.min(oldCanvas.width, oldCanvas.height)
  const impact: AspectImpact = { from, to, scenes: 0, recovered: 0, refitted: 0, moved: 0, review: 0, motion: 0 }
  const layerSpecs: CompositionOpSpec[] = []

  for (const scene of orderedScenes(document)) {
    let touched = false
    for (const layer of scene.layers) {
      const body = layer as unknown as Body
      const kind = body['layer_kind']
      const transform = transformOf(body['transform'])
      if (kind === 'motion_instance' && motionRatioOf(body) !== to) impact.motion += 1
      if (kind === 'clip' && !transform) {
        impact.refitted += 1
        continue
      }
      if (!transform || transform.crop) continue

      let next: CompositionTransform | null = null
      if (kind === 'clip') {
        const sourceId = (body['placement'] as Body | undefined)?.['source_id']
        const media = typeof sourceId === 'string' ? (input.mediaSizes.get(sourceId) ?? null) : null
        const oldNatural = containBox(oldCanvas, media)
        const newNatural = containBox(newCanvas, media)
        if (oldNatural && newNatural && mediaFitOf(transform, oldCanvas, oldNatural) === 'cover') {
          next = coverTransform(newCanvas, newNatural)
          impact.recovered += 1
        } else if (oldNatural && newNatural) {
          next = relativeTransform(transform, oldNatural, newNatural, oldCanvas, newCanvas, safe, shortRatio)
          impact.moved += 1
        } else {
          // The media size is unknown: the box cannot be centred, its top-left keeps its relative place.
          next = { ...transform, x: round2((transform.x / oldCanvas.width) * newCanvas.width), y: round2((transform.y / oldCanvas.height) * newCanvas.height) }
          impact.review += 1
        }
      } else if (kind === 'text') {
        const known = input.naturalBoxes?.get(layer.layer_id) ?? null
        const oldBox = { width: Math.round(TEXT_FRAME_WIDTH_SHARE * oldCanvas.width), height: known?.height ?? textBox(body, oldCanvas, { canvas: oldCanvas, height: null }).height }
        const newBox = textBox(body, newCanvas, { canvas: oldCanvas, height: oldBox.height })
        next = relativeTransform(transform, oldBox, newBox, oldCanvas, newCanvas, safe, shortRatio)
        impact.moved += 1
      } else if (kind === 'shape') {
        const size = body['size'] as { width_px?: unknown; height_px?: unknown } | undefined
        const sized = typeof size?.width_px === 'number' && typeof size?.height_px === 'number'
        // A shape without a size is the canvas-sized box of the first document v1: it follows the canvas.
        const oldBox = sized ? { width: size!.width_px as number, height: size!.height_px as number } : oldCanvas
        const newBox = sized ? oldBox : newCanvas
        next = relativeTransform(transform, oldBox, newBox, oldCanvas, newCanvas, safe, shortRatio)
        impact.moved += 1
      } else if (kind === 'motion_instance') {
        const known = input.naturalBoxes?.get(layer.layer_id) ?? null
        next = known
          ? relativeTransform(transform, known, known, oldCanvas, newCanvas, safe, shortRatio)
          : { ...transform, x: round2((transform.x / oldCanvas.width) * newCanvas.width), y: round2((transform.y / oldCanvas.height) * newCanvas.height) }
        impact.moved += 1
      }
      if (!next || sameTransform(next, transform)) continue
      layerSpecs.push(layerSetTransformSpec(scene.scene_id, layer.layer_id, next))
      touched = true
    }
    if (touched) impact.scenes += 1
  }
  return { specs: [canvasSetFormatSpec(from, to), ...layerSpecs], impact }
}

function relativeTransform(
  transform: CompositionTransform,
  oldBox: Size,
  newBox: Size,
  oldCanvas: Size,
  newCanvas: Size,
  safe: StageRect,
  shortRatio: number,
): CompositionTransform {
  const centre = {
    x: ((transform.x + (oldBox.width * transform.scale) / 2) / oldCanvas.width) * newCanvas.width,
    y: ((transform.y + (oldBox.height * transform.scale) / 2) / oldCanvas.height) * newCanvas.height,
  }
  const scale = round4(transform.scale * shortRatio)
  const at = placeBox(centre, newBox, scale, newCanvas, safe)
  return { ...transform, x: round2(at.x), y: round2(at.y), scale }
}

function sameTransform(a: CompositionTransform, b: CompositionTransform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation_deg === b.rotation_deg
}

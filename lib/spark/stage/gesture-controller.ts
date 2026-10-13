import {
  cornerPoint,
  cornerRatio,
  moveBasis,
  oppositeCorner,
  scaleBasisAround,
  textSizeForRatio,
  visualBox,
  clientToCanvas,
  type Corner,
  type LayerBasis,
  type Point,
} from './geometry'
import { isAspectLocked, isPillRadius, pillRadius, resizeShapeBasis, type ShapeHandle } from './shape-model'
import { snapMove, type SnapGuides } from './snapping'
import type { StageLayerKind, StageRect } from './stage-types'

/**
 * One pointer gesture on the canvas (D4 protocol): pointer down on a layer or a corner handle, transient previews while
 * it moves, and EXACTLY ONE outcome at the end (one typed command = one undo group). While moving it only reports
 * previews; it never touches the document, the session or React state, so a gesture costs no extra commits (perf gate
 * `editor.gesture.extra_commits == 0`). A press that never moves past the threshold is a click: no outcome.
 *
 * Modifiers: Shift locks a move to one axis, Ctrl/Cmd turns snapping off, Alt resizes from the centre.
 */

export type PointerInput = { clientX: number; clientY: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

export type GestureTarget =
  | { kind: 'move'; layerId: string; layerKind: StageLayerKind; basis: LayerBasis }
  | { kind: 'resize'; layerId: string; layerKind: StageLayerKind; basis: LayerBasis; corner: Corner; textSizePx?: number }
  /**
   * E1-B (D4): a rect or ellipse resized by its box (`shape.set_size`), not by its scale. `basis.width/height` is the stored
   * box; `cornerRadiusPx` the stored radius of a rect (a pill keeps being a pill while it is resized).
   */
  | { kind: 'shape_resize'; layerId: string; basis: LayerBasis; handle: ShapeHandle; shape: 'rect' | 'ellipse'; cornerRadiusPx: number | null }

export type GesturePreview = {
  layerId: string
  basis: LayerBasis
  /** Canvas rectangle the layer now occupies (unrotated). */
  visual: StageRect
  /** A text corner drag shows the new font size instead of a scale. */
  textSizePx?: number
  /** A shape resize previews its box: the unscaled size and the corner radius it will have (null = square corners). */
  shape?: { width: number; height: number; cornerRadius: number | null; ellipse: boolean }
  badge: string
  guides: SnapGuides
}

export type GestureOutcome =
  | { kind: 'transform'; layerId: string; basis: LayerBasis }
  | { kind: 'text_size'; layerId: string; sizePx: number }
  /** E1-B: the new box of a shape with the top-left it needs; `cornerRadiusPx` only when the resize changes the radius (a pill). */
  | { kind: 'shape_size'; layerId: string; basis: LayerBasis; size: { width_px: number; height_px: number }; cornerRadiusPx?: number }

export type GestureOptions = {
  canvas: { width: number; height: number }
  safeArea: StageRect | null
  /** The frame's client rect (left, top, width): the canvas-px mapping is re-read at every event. */
  frame: () => { left: number; top: number; width: number }
  onPreview: (preview: GesturePreview) => void
  /** `null` when the press was a click or was cancelled. */
  onEnd: (outcome: GestureOutcome | null, info: { moved: boolean }) => void
  dragThresholdPx?: number
}

const DRAG_THRESHOLD_PX = 3
const MAX_SCALE = 20

const roundTo = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export class GestureController {
  private target: GestureTarget | null = null
  private startClient: Point = { x: 0, y: 0 }
  private moved = false
  private last: { preview: GesturePreview; outcome: GestureOutcome } | null = null

  constructor(private readonly options: GestureOptions) {}

  get active(): boolean {
    return this.target !== null
  }

  get didMove(): boolean {
    return this.moved
  }

  begin(target: GestureTarget, pointer: PointerInput): void {
    this.target = target
    this.startClient = { x: pointer.clientX, y: pointer.clientY }
    this.moved = false
    this.last = null
  }

  update(pointer: PointerInput): void {
    const target = this.target
    if (!target) return
    const threshold = this.options.dragThresholdPx ?? DRAG_THRESHOLD_PX
    if (!this.moved && Math.hypot(pointer.clientX - this.startClient.x, pointer.clientY - this.startClient.y) < threshold) return
    this.moved = true
    const computed = target.kind === 'move' ? this.move(target, pointer) : target.kind === 'shape_resize' ? this.resizeShape(target, pointer) : this.resize(target, pointer)
    this.last = computed
    this.options.onPreview(computed.preview)
  }

  end(): void {
    const { target, moved, last } = this
    if (!target) return
    this.target = null
    this.last = null
    this.options.onEnd(moved && last ? last.outcome : null, { moved })
  }

  cancel(): void {
    const { target, moved } = this
    if (!target) return
    this.target = null
    this.last = null
    this.options.onEnd(null, { moved })
  }

  private scale(): number {
    return this.options.frame().width / this.options.canvas.width
  }

  private move(target: Extract<GestureTarget, { kind: 'move' }>, pointer: PointerInput): { preview: GesturePreview; outcome: GestureOutcome } {
    const scale = this.scale()
    let dx = (pointer.clientX - this.startClient.x) / scale
    let dy = (pointer.clientY - this.startClient.y) / scale
    if (pointer.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0
      else dx = 0
    }
    let guides: SnapGuides = { v: null, h: null }
    if (!pointer.ctrlKey && !pointer.metaKey) {
      const moved = visualBox(moveBasis(target.basis, dx, dy))
      const snap = snapMove(moved, this.options.canvas, this.options.safeArea, scale)
      dx += snap.dx
      dy += snap.dy
      guides = snap.guides
    }
    const basis = moveBasis(target.basis, dx, dy)
    const rounded: LayerBasis = { ...basis, x: Math.round(basis.x), y: Math.round(basis.y) }
    return {
      preview: {
        layerId: target.layerId,
        basis: rounded,
        visual: visualBox(rounded),
        badge: `X ${rounded.x}  ·  Y ${rounded.y}`,
        guides,
      },
      outcome: { kind: 'transform', layerId: target.layerId, basis: rounded },
    }
  }

  private resizeShape(target: Extract<GestureTarget, { kind: 'shape_resize' }>, pointer: PointerInput): { preview: GesturePreview; outcome: GestureOutcome } {
    const pointerCanvas = clientToCanvas(this.options.frame(), this.options.canvas.width, { x: pointer.clientX, y: pointer.clientY })
    const lock = isAspectLocked(target.basis.width, target.basis.height, pointer.shiftKey)
    const { basis, size } = resizeShapeBasis({ basis: target.basis, handle: target.handle, pointer: pointerCanvas, lock, fromCentre: pointer.altKey })
    // A pill stays a pill: its radius follows the shorter side. A rounded rect keeps its radius (the compiler never draws more than half).
    const pill = target.shape === 'rect' && isPillRadius(target.cornerRadiusPx, target.basis.width, target.basis.height)
    const cornerRadiusPx = pill ? pillRadius(size.width_px, size.height_px) : undefined
    const radius = cornerRadiusPx ?? (target.shape === 'rect' ? target.cornerRadiusPx : null)
    return {
      preview: {
        layerId: target.layerId,
        basis,
        visual: visualBox(basis),
        shape: { width: size.width_px, height: size.height_px, cornerRadius: radius, ellipse: target.shape === 'ellipse' },
        badge: `${size.width_px} × ${size.height_px} px`,
        guides: { v: null, h: null },
      },
      outcome: { kind: 'shape_size', layerId: target.layerId, basis, size, ...(cornerRadiusPx !== undefined && { cornerRadiusPx }) },
    }
  }

  private resize(target: Extract<GestureTarget, { kind: 'resize' }>, pointer: PointerInput): { preview: GesturePreview; outcome: GestureOutcome } {
    const box = visualBox(target.basis)
    const anchor = pointer.altKey ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : cornerPoint(box, oppositeCorner(target.corner))
    const cornerStart = cornerPoint(box, target.corner)
    const pointerCanvas = clientToCanvas(this.options.frame(), this.options.canvas.width, { x: pointer.clientX, y: pointer.clientY })
    const ratio = Math.min(MAX_SCALE / target.basis.scale, cornerRatio(anchor, cornerStart, pointerCanvas))
    const guides: SnapGuides = { v: null, h: null }
    if (target.layerKind === 'text' && target.textSizePx !== undefined) {
      const sizePx = textSizeForRatio(target.textSizePx, ratio)
      const effective = sizePx / target.textSizePx
      const scaled = scaleBasisAround(target.basis, effective, anchor)
      return {
        preview: { layerId: target.layerId, basis: target.basis, visual: visualBox(scaled), textSizePx: sizePx, badge: `${sizePx} px`, guides },
        outcome: { kind: 'text_size', layerId: target.layerId, sizePx },
      }
    }
    const scaled = scaleBasisAround(target.basis, ratio, anchor)
    const basis: LayerBasis = { ...scaled, x: roundTo(scaled.x, 2), y: roundTo(scaled.y, 2), scale: roundTo(scaled.scale, 4) }
    return {
      preview: { layerId: target.layerId, basis, visual: visualBox(basis), badge: `${Math.round(basis.scale * 100)}%`, guides },
      outcome: { kind: 'transform', layerId: target.layerId, basis },
    }
  }
}

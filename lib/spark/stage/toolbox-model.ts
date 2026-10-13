import type { StageLayerView } from './document-layers'
import { faceForFamily, familyOfFace, inspectorControl, inspectorTarget, type InspectorSchema } from './inspector-schema'
import { isBoxedShape } from './shape-model'
import type { StageRect } from './stage-types'

/**
 * What the contextual toolbox, the context menu and the Properties inspector may show for a layer. The server's inspector
 * schema (`composition_inspector_schema_v1`) DRIVES it: a control the schema does not list for the layer's kind is hidden,
 * so the UI cannot offer what no typed op writes (KARAR-MINIMAL section 1). Pure functions, no React.
 */

/** The schema's target name of a layer the stage can select. */
export type ToolboxTarget = 'text' | 'shape' | 'clip'

export function toolboxTarget(view: StageLayerView): ToolboxTarget | null {
  return view.kind === 'text' || view.kind === 'shape' || view.kind === 'clip' ? view.kind : null
}

/** What the layer is called to the user (`kinds.*` in the stage strings). */
export type ToolboxKind = 'text' | 'shape' | 'image' | 'video'

export function toolboxKind(view: StageLayerView): ToolboxKind | null {
  if (view.kind === 'text' || view.kind === 'shape') return view.kind
  if (view.kind === 'clip') return view.mediaKind === 'video' ? 'video' : 'image'
  return null
}

export type ControlSet = {
  /** Edit the text itself (`text.content`). */
  content: boolean
  /** Font family picker (`text.font_family`); needs the catalogue. */
  family: boolean
  /** Weight / italic picker (`text.font_weight`) among the faces of the current family. */
  weight: boolean
  size: boolean
  color: boolean
  align: boolean
  /** Shape fill colour (`shape.fill`). */
  fill: boolean
  /** Shape box Width / Height (`shape.size`, E1-B): a rect or an ellipse only. */
  boxSize: boolean
  /** Rect corner radius (`shape.corner_radius`, E1-B): a rectangle only. */
  cornerRadius: boolean
  /** Position, scale and rotation fields; centre and reset (`<kind>.position`). */
  position: boolean
  /** Video clip level and mute (`clip.gain`, `clip.mute`); only for a source that has an audio track. */
  gain: boolean
  mute: boolean
  remove: boolean
  /** Order actions (`layer.arrange`). */
  arrange: boolean
  /** Spark styling round: underline / strikethrough toggles (`text.decoration`). */
  decoration: boolean
  /** Spark styling round: line spacing (`text.line_height`). */
  lineHeight: boolean
  /** Spark styling round: the text outline's colour and width (`text.stroke`). */
  stroke: boolean
  /** Spark styling round: the layer's opacity (`<kind>.opacity`): text, shapes and images, never a video clip. */
  opacity: boolean
  /** Spark styling round: the editor's UI lock (`<kind>.lock`). */
  lock: boolean
}

const NONE: ControlSet = {
  content: false,
  family: false,
  weight: false,
  size: false,
  color: false,
  align: false,
  fill: false,
  boxSize: false,
  cornerRadius: false,
  position: false,
  gain: false,
  mute: false,
  remove: false,
  arrange: false,
  decoration: false,
  lineHeight: false,
  stroke: false,
  opacity: false,
  lock: false,
}

/**
 * The controls of one layer. With no schema yet (loading, or the read failed) only the core actions whose ops always exist
 * stay (edit text, position, order, delete); everything that needs the schema's catalogue or option lists waits for it:
 * nothing is invented. `layer.arrange` is offered for every editable layer even while the schema still lists `z_order`
 * as unavailable (a stale entry: the op exists on the server, Y1-07 corrects the listing); an explicitly non-editable
 * target (a pending slot) offers nothing.
 */
export function controlSet(schema: InspectorSchema | null, view: StageLayerView): ControlSet {
  const target = toolboxTarget(view)
  if (!target) return NONE
  if (!schema) return { ...NONE, content: target === 'text', position: true, remove: true, arrange: true }
  const listed = inspectorTarget(schema, target)
  if (!listed || !listed.editable) return NONE
  const has = (control: string) => inspectorControl(schema, target, `${target}.${control}`) !== null
  const hasAudio = target === 'clip' && view.mediaKind === 'video' && view.sourceHasAudio !== false
  const catalogue = schema.fonts.families.length > 0
  return {
    content: target === 'text' && has('content'),
    family: target === 'text' && has('font_family') && catalogue,
    weight: target === 'text' && has('font_weight') && catalogue,
    size: target === 'text' && has('size'),
    color: target === 'text' && has('color'),
    align: target === 'text' && has('align'),
    fill: target === 'shape' && has('fill'),
    boxSize: target === 'shape' && has('size') && isBoxedShape(view),
    cornerRadius: target === 'shape' && has('corner_radius') && view.shape === 'rect',
    position: has('position'),
    gain: hasAudio && has('gain'),
    mute: hasAudio && has('mute'),
    remove: has('remove'),
    arrange: true,
    decoration: target === 'text' && has('decoration'),
    lineHeight: target === 'text' && has('line_height'),
    stroke: target === 'text' && has('stroke'),
    // `clip.opacity` requires `not_video_source`: the export composites footage without opacity.
    opacity: has('opacity') && !(target === 'clip' && view.mediaKind !== 'image'),
    lock: has('lock'),
  }
}

/**
 * Spark styling round: whether the editor may lock / unlock a layer (`<kind>.lock`, `layer.set_locked`): text, shapes, clips
 * and Motion layers. A server that does not list the control yet offers no lock.
 */
export function lockAvailable(schema: InspectorSchema | null, view: StageLayerView): boolean {
  if (view.kind === 'motion_instance') return inspectorControl(schema, 'motion_instance', 'motion.lock') !== null
  const target = toolboxTarget(view)
  return target !== null && inspectorControl(schema, target, `${target}.lock`) !== null
}

/** The decoration a toolbar toggle (or its shortcut) writes: the other line keeps its state (the full value is sent). */
export function toggledDecoration(
  current: { underline: boolean; strikethrough: boolean } | undefined,
  line: 'underline' | 'strikethrough',
): { underline: boolean; strikethrough: boolean } {
  const base = current ?? { underline: false, strikethrough: false }
  return { ...base, [line]: !base[line] }
}

/** Line spacing choices of the toolbar's menu (multiples of the size); "Default" is the face's own line height. */
export const LINE_HEIGHT_CHOICES = [0.8, 1, 1.2, 1.5, 2] as const

/** Line spacing accepted from a field: the op's bounds (0.5-3), two decimals. */
export function clampLineHeight(value: number): number {
  return Math.round(Math.min(3, Math.max(0.5, value)) * 100) / 100
}

/** Outline width accepted from a field: (0, 100] px, one decimal; 0 or less means "no outline" (null). */
export function outlineWidthOrNull(value: number): number | null {
  if (!(value > 0)) return null
  return Math.round(Math.min(100, value) * 10) / 10
}

/** The outline a newly enabled outline gets: a contrasting colour and a width that reads at the text's size. */
export function defaultOutline(sizePx: number, color: string): { color: string; widthPx: number } {
  const light = luminance(colorInputValue(color)) > 0.5
  return { color: light ? '#000000' : '#ffffff', widthPx: Math.max(1, Math.round(sizePx / 24)) }
}

function luminance(hex: string): number {
  const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** The opacity slider's percent of a stored opacity (absent = 100 %). */
export function opacityPercent(opacity: number | undefined): number {
  return Math.round((opacity ?? 1) * 100)
}

/** The stored opacity of a slider percent (0-100, whole percents). */
export function opacityOfPercent(percent: number): number {
  return Math.round(Math.min(100, Math.max(0, percent))) / 100
}

/** The family and face a text layer's pinned font belongs to, from the catalogue (null when it is not in it). */
export function currentFont(schema: InspectorSchema | null, view: StageLayerView) {
  const sha = view.style?.font.sha256
  const family = sha ? familyOfFace(schema, sha) : null
  const face = family?.faces.find((candidate) => candidate.font.sha256 === sha) ?? null
  return { family, face }
}

/** Font to switch a text layer to when the user picks another family (the nearest weight and style of the new one). */
export function fontForFamilyChoice(schema: InspectorSchema | null, view: StageLayerView, familyName: string) {
  const family = schema?.fonts.families.find((candidate) => candidate.family === familyName)
  if (!family) return null
  const { face } = currentFont(schema, view)
  return faceForFamily(family, face ? { weight: face.weight, style: face.style } : null)?.font ?? null
}

type CatalogueFamily = InspectorSchema['fonts']['families'][number]
type CatalogueFace = CatalogueFamily['faces'][number]

/** The bold or italic button of the toolbox: whether it shows on, and the face a press switches to (null = none exists). */
export function styleToggle(family: CatalogueFamily | null, face: CatalogueFace | null, which: 'bold' | 'italic'): { on: boolean; target: CatalogueFace | null } {
  if (!family || !face) return { on: false, target: null }
  const nearest = (faces: CatalogueFace[], weight: number) => [...faces].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0] ?? null
  if (which === 'bold') {
    const on = face.weight >= 600
    const pool = family.faces.filter((candidate) => candidate.style === face.style && (on ? candidate.weight < 600 : candidate.weight >= 600))
    return { on, target: nearest(pool, on ? 400 : 700) }
  }
  const on = face.style === 'italic'
  const pool = family.faces.filter((candidate) => candidate.style === (on ? 'normal' : 'italic'))
  return { on, target: nearest(pool, face.weight) }
}

export type TextAlignChoice = 'start' | 'center' | 'end'

/** The toolbox's single align button cycles start, centre, end (the design has one button). */
export function nextAlign(current: TextAlignChoice | undefined): TextAlignChoice {
  if (current === 'center') return 'end'
  if (current === 'end') return 'start'
  return 'center'
}

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#[0-9a-f]{6}$/i
const HEX8 = /^#[0-9a-f]{8}$/i

/** What an `<input type="color">` shows for a stored colour (`#rrggbb`; short and alpha forms are mapped, else black). */
export function colorInputValue(color: string | undefined): string {
  if (!color) return '#000000'
  if (HEX6.test(color)) return color.toLowerCase()
  const short = HEX3.exec(color)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase()
  if (HEX8.test(color)) return color.slice(0, 7).toLowerCase()
  return '#000000'
}

/** Whether an input colour differs from the stored one (a commit that changes nothing sends nothing). */
export function colorChanged(stored: string | undefined, next: string): boolean {
  return colorInputValue(stored) !== next.toLowerCase()
}

export type ToolboxPlacement = { left: number; top: number }

/**
 * Position of the floating toolbox against the stage (the design's `positionSel`): centred above the selection frame, below
 * it when there is no room above, over its top edge when there is no room either, and always inside the stage with an 8 px
 * margin. `selection` is the selection frame in stage pixels (already padded).
 */
export function toolboxPlacement(input: {
  selection: StageRect
  toolbox: { width: number; height: number }
  stage: { width: number; height: number }
  footerHeight?: number
}): ToolboxPlacement {
  const { selection, toolbox, stage } = input
  const footer = input.footerHeight ?? 52
  let top = selection.y - toolbox.height - 12
  if (top < 8) top = selection.y + selection.height + 12
  if (top + toolbox.height > stage.height - footer) top = Math.max(8, selection.y + 8)
  const left = Math.min(Math.max(8, selection.x + selection.width / 2 - toolbox.width / 2), Math.max(8, stage.width - toolbox.width - 8))
  return { left, top }
}

/** What the contextual toolbar (`SPARK_CONTEXT_TOOLBAR_ENABLED`) calls a layer: the four toolbox kinds plus Motion. */
export type ContextKind = ToolboxKind | 'motion'

export function contextKind(view: StageLayerView): ContextKind | null {
  return view.kind === 'motion_instance' ? 'motion' : toolboxKind(view)
}

/**
 * The size a "-" / "+" press of the toolbar gives a text: a step that grows with the size (1 px below 24, 2 px below 72, 4 px
 * above), kept inside the field's bounds.
 */
export function stepFontSize(sizePx: number, direction: 1 | -1): number {
  const step = sizePx < 24 ? 1 : sizePx < 72 ? 2 : 4
  return clampFontSize(Math.round(sizePx) + direction * step)
}

/**
 * Controls the owner asked the toolbar to show that the document cannot store or the export cannot draw yet: a shape's
 * outline (`shape.stroke` is unavailable in the inspector schema), a video clip's opacity (the export composites footage
 * without it) and a crop (the compiler refuses it). The toolbar shows them disabled with this reason, so nothing is offered
 * that no op writes. Underline, strikethrough, line spacing, the text outline, opacity and lock are real controls since the
 * Spark styling round.
 */
export const NOT_YET_CONTROLS = {
  text: [],
  shape: ['stroke'],
  image: ['crop'],
  video: ['opacity', 'crop'],
  motion: [],
} as const satisfies Record<ContextKind, readonly string[]>

export type NotYetControl = (typeof NOT_YET_CONTROLS)[ContextKind][number]

/** Numeric Properties field: a finite number parsed from text, or null when the text is not one. */
export function parseFieldNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** Font size accepted from a field: a whole number from 4 to 1000 px (the gesture's own bounds). */
export function clampFontSize(value: number): number {
  return Math.min(1000, Math.max(4, Math.round(value)))
}

/** Scale accepted from the percent field: 5 % to 1000 %, stored as a ratio with four decimals. */
export function scaleFromPercent(percent: number): number {
  return Math.round(Math.min(1000, Math.max(5, percent)) * 100) / 10000
}

/** Rotation accepted from the field: normalised into (-180, 180], whole or tenth degrees. */
export function normaliseRotation(degrees: number): number {
  let value = degrees % 360
  if (value > 180) value -= 360
  if (value <= -180) value += 360
  return Math.round(value * 10) / 10
}

/** Clip level accepted from the field: the op's bounds (-60 to +24 dB), one decimal. */
export function clampGainDb(value: number): number {
  return Math.round(Math.min(24, Math.max(-60, value)) * 10) / 10
}

/** `Bold`, `Bold italic`, `400`...: the weight picker's option key (`weights.<n>` in the strings) and whether it is italic. */
export function weightOptionKey(face: { weight: number; style: 'normal' | 'italic' }): { weight: number; italic: boolean } {
  return { weight: Math.round(face.weight / 100) * 100, italic: face.style === 'italic' }
}

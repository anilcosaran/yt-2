import {
  indexCompositionRevs,
  type CompositionDocument,
  type CompositionEntityKind,
  type CompositionEntityRef,
  type CompositionRawOp,
  type CompositionScene,
  type CompositionSection,
} from '../composition-client'
import { readTransition } from '../scene-transitions'
import { resolveSceneLength } from '../scene-timing'
import { framesForTicks, ticksForFrames } from '../stage/placement'
import { presetFitsText } from '../stage/motion-core/recipes'
import { findLocalPreset, readLocalAnimation } from './local-animations'

/**
 * E1-N: the editor's LOCAL copy of the gateway's pure op application (`api-gateway/src/composition/domain/ops/*`,
 * `applyCompositionOps`). The editor applies each typed op to its in-memory document the moment the user makes the edit and
 * sends the command to the server in the background; this module is that local application. It is a small PURE PORT (the
 * UI image cannot import `api-gateway`), pinned to the gateway by `op-parity.test.ts` over a golden fixture the gateway
 * test generates from its real op handlers (`api-gateway/tests/unit/composition/optimistic-op-parity.test.ts`): same ops in,
 * same document, same `changed` / `removed` entity lists out.
 *
 * Rules of the port:
 * - It only has to be right for well-formed ops the editor builds, and conservative about the rest: anything it does not
 *   know or would refuse is `{ ok: false }` and the caller falls back to the plain server round trip. It never accepts an
 *   op the gateway would refuse for a reason the port can see (ids, ranges, kinds, scene length, document invariants).
 * - The input document is never mutated. The result shares every scene and layer the ops did not touch with the input
 *   (copy on write), so React memoisation and the stage's per-scene cache keep working across edits.
 * - Revs follow the gateway exactly (F27): a touched entity gets `previous + 1` once per command, a created one gets 1,
 *   a removed one is listed in `removed`. They only drive display here; the CAS of the real command comes from the server's
 *   own receipts, never from these revs.
 * - Ops the port does NOT cover (Motion instances, captions, narration, animations, template and brand ops, `scene.merge`,
 *   ...) are not in `LOCALLY_APPLIED_OPS`; a command with one of them is written the pessimistic way (server first).
 * - Timeline v2 phase 1 (P1-D) adds the outline's section edits (`section.insert/update/remove`, `scene.set_section`) and
 *   `clip.split`, so a drag between sections, a rename or a clip split shows in the frame of the gesture.
 * - Timeline v3 adds `scene.split` (the P02-12 rules, and the relaxed split for an op that carries `split_placement_ids`;
 *   see the section of that op), so a split of the main track shows in the frame of the gesture too.
 */

type Json = Record<string, unknown>
type Scene = CompositionScene
type Section = CompositionSection
type Layer = Scene['layers'][number]
type LayerBody = Layer & Json

export type LocalChangedEntity = CompositionEntityRef & { entity_rev: number }
export type LocalApplyResult =
  | { ok: true; document: CompositionDocument; changed: LocalChangedEntity[]; removed: CompositionEntityRef[] }
  | { ok: false; reason: string; op?: string }

/** The ops the editor applies to its own document before the server answers. */
export const LOCALLY_APPLIED_OPS: ReadonlySet<string> = new Set([
  'scene.insert',
  'scene.remove',
  'scene.reorder',
  'scene.set_timing',
  'scene.set_section',
  'section.insert',
  'section.update',
  'section.remove',
  'layer.set_transform',
  'layer.set_opacity',
  'layer.set_locked',
  'layer.remove',
  'layer.arrange',
  'layer.move',
  'layer.trim',
  'text.insert',
  'text.set',
  'text.set_style',
  'shape.insert',
  'shape.set_fill',
  'shape.set_size',
  'shape.set_corner_radius',
  'clip.insert_sequence',
  'clip.split',
  'scene.split',
  'clip.set_audio',
  'clip.replace_source',
  'audio.insert',
  'audio.remove',
])

/**
 * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`): the transition and animation edits, applied locally only while the
 * switch is open (`setLiveFxLocalOps`), so a new transition, a dragged transition length or an animation preset is on the
 * stage in the frame of the edit. Pinned by their own golden (`live-fx-op-parity.test.ts`).
 */
export const LIVE_FX_LOCAL_OPS: ReadonlySet<string> = new Set(['scene.set_transition', 'scene.clear_transition', 'animation.set', 'animation.remove'])

let liveFxOpsOpen = false

/** Opens (or closes) the live FX ops for local application (the editor page sets it from its switch). */
export function setLiveFxLocalOps(open: boolean): void {
  liveFxOpsOpen = open
}

/** True when every op of a command can be applied locally (otherwise the whole command is written server-first). */
export function canApplyLocally(ops: ReadonlyArray<{ op: string }>): boolean {
  return ops.length > 0 && ops.every((op) => LOCALLY_APPLIED_OPS.has(op.op) || (liveFxOpsOpen && LIVE_FX_LOCAL_OPS.has(op.op)))
}

class Refusal extends Error {
  constructor(
    readonly reason: string,
    readonly op?: string,
  ) {
    super(reason)
    this.name = 'LocalOpRefusal'
  }
}

const refuse = (reason: string, op?: string): never => {
  throw new Refusal(reason, op)
}

// ---------------------------------------------------------------- parameter checks (the gateway's parsers)

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const NEW_SCENE_ID = new RegExp(`^scn_${UUID}$`)
const NEW_LAYER_ID = new RegExp(`^lyr_${UUID}$`)
const NEW_AUDIO_ID = new RegExp(`^aud_${UUID}$`)
const NEW_SECTION_ID = new RegExp(`^sec_${UUID}$`)
const HEX_COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
const SHA256 = /^[a-f0-9]{64}$/
const SCENE_ORIGINS = ['authored', 'template', 'generated', 'source_split']
const TIMING_POLICIES = ['fixed', 'follow_media', 'follow_narration']
const TEXT_ALIGNS = ['start', 'center', 'end']
const SHAPES = ['rect', 'ellipse', 'line']
const BOXED_SHAPES = ['rect', 'ellipse']
const SHAPE_SIZE_PX = { min: 1, max: 16384 }
const CORNER_RADIUS_PX = { min: 0, max: 16384 }
const GAIN_DB = { min: -60, max: 24 }
/** Spark styling round (`COMPOSITION_TEXT_STYLE_LIMITS`). */
const LINE_HEIGHT = { min: 0.5, max: 3 }
const STROKE_WIDTH_MAX_PX = 100
const TEXT_STYLE_FIELDS = ['font', 'size_px', 'color', 'align', 'line_height', 'text_decoration', 'stroke']
const TEXT_MAX_LENGTH = 2000
const SECTION_TITLE_MAX_LENGTH = 200
const LIMITS = { scenes: 200, sections: 100, layers_per_scene: 60, audio_placements: 200 }
const VISUAL_KINDS = ['clip', 'text', 'shape', 'motion_instance']
/** `animation.set/remove`: the native kinds an AnimationSpec sits on, and how many one layer carries. */
const ANIMATABLE_KINDS = ['clip', 'text', 'shape']
const ANIMATIONS_PER_LAYER = 6

function onlyKeys(raw: Json, allowed: readonly string[], op: string): void {
  for (const key of Object.keys(raw)) if (key !== 'op' && !allowed.includes(key)) refuse(`unknown_param_${key}`, op)
}

function idOf(raw: Json, key: string, pattern: RegExp, op: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || !pattern.test(value)) return refuse(`invalid_${key}`, op)
  return value
}

function nullableIdOf(raw: Json, key: string, pattern: RegExp, op: string): string | null {
  if (!(key in raw)) return refuse(`missing_${key}`, op)
  return raw[key] === null ? null : idOf(raw, key, pattern, op)
}

function required(raw: Json, key: string, op: string): unknown {
  if (!(key in raw)) return refuse(`missing_${key}`, op)
  return raw[key]
}

function objectOf(value: unknown, keys: readonly string[], requiredKeys: readonly string[], what: string, op: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refuse(`invalid_${what}`, op)
  const record = value as Json
  if (Object.keys(record).some((key) => !keys.includes(key))) return refuse(`invalid_${what}`, op)
  if (requiredKeys.some((key) => !(key in record))) return refuse(`invalid_${what}`, op)
  return record
}

function intAt(value: unknown, min: number, what: string, op: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) return refuse(`invalid_${what}`, op)
  return value
}

function finiteAt(value: unknown, what: string, op: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return refuse(`invalid_${what}`, op)
  return value
}

type FrameRange = { start_frame: number; end_frame: number }
type SourceRange = { in_tick: number; out_tick: number }
type Rational = { num: number; den: number }

function frameRangeOf(value: unknown, what: string, op: string): FrameRange {
  const record = objectOf(value, ['start_frame', 'end_frame'], ['start_frame', 'end_frame'], what, op)
  const range = { start_frame: intAt(record['start_frame'], 0, what, op), end_frame: intAt(record['end_frame'], 0, what, op) }
  if (range.end_frame <= range.start_frame) refuse(`invalid_${what}`, op)
  return range
}

function sourceRangeOf(value: unknown, what: string, op: string): SourceRange {
  const record = objectOf(value, ['in_tick', 'out_tick'], ['in_tick', 'out_tick'], what, op)
  const range = { in_tick: intAt(record['in_tick'], 0, what, op), out_tick: intAt(record['out_tick'], 1, what, op) }
  if (range.out_tick <= range.in_tick) refuse(`invalid_${what}`, op)
  return range
}

function transformOf(value: unknown, what: string, op: string): Json {
  const record = objectOf(value, ['x', 'y', 'scale', 'rotation_deg', 'crop'], ['x', 'y', 'scale', 'rotation_deg'], what, op)
  const scale = finiteAt(record['scale'], what, op)
  if (scale <= 0) refuse(`invalid_${what}`, op)
  const transform: Json = {
    x: finiteAt(record['x'], what, op),
    y: finiteAt(record['y'], what, op),
    scale,
    rotation_deg: finiteAt(record['rotation_deg'], what, op),
  }
  if ('crop' in record) {
    const crop = objectOf(record['crop'], ['left', 'top', 'right', 'bottom'], ['left', 'top', 'right', 'bottom'], what, op)
    const edges = { left: 0, top: 0, right: 0, bottom: 0 }
    for (const edge of ['left', 'top', 'right', 'bottom'] as const) {
      const amount = finiteAt(crop[edge], what, op)
      if (amount < 0 || amount > 1) refuse(`invalid_${what}`, op)
      edges[edge] = amount
    }
    if (edges.left + edges.right >= 1 || edges.top + edges.bottom >= 1) refuse(`invalid_${what}`, op)
    transform['crop'] = edges
  }
  return transform
}

function shapeSizeOf(value: unknown, what: string, op: string): { width_px: number; height_px: number } {
  const record = objectOf(value, ['width_px', 'height_px'], ['width_px', 'height_px'], what, op)
  const edge = (key: 'width_px' | 'height_px'): number => {
    const amount = finiteAt(record[key], what, op)
    if (amount < SHAPE_SIZE_PX.min || amount > SHAPE_SIZE_PX.max) refuse(`invalid_${what}`, op)
    return amount
  }
  return { width_px: edge('width_px'), height_px: edge('height_px') }
}

function cornerRadiusOf(value: unknown, what: string, op: string): number {
  const radius = finiteAt(value, what, op)
  if (radius < CORNER_RADIUS_PX.min || radius > CORNER_RADIUS_PX.max) refuse(`invalid_${what}`, op)
  return radius
}

function fontRefOf(value: unknown, what: string, op: string): { font_id: string; font_revision: string; sha256: string } {
  const record = objectOf(value, ['font_id', 'font_revision', 'sha256'], ['font_id', 'font_revision', 'sha256'], what, op)
  const fontId = record['font_id']
  const revision = record['font_revision']
  const sha = record['sha256']
  if (typeof fontId !== 'string' || !OPAQUE_ID.test(fontId)) return refuse(`invalid_${what}`, op)
  if (typeof revision !== 'string' || !OPAQUE_ID.test(revision)) return refuse(`invalid_${what}`, op)
  if (typeof sha !== 'string' || !SHA256.test(sha)) return refuse(`invalid_${what}`, op)
  return { font_id: fontId, font_revision: revision, sha256: sha }
}

function hexColorOf(value: unknown, what: string, op: string): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) return refuse(`invalid_${what}`, op)
  return value
}

function fontSizeOf(value: unknown, what: string, op: string): number {
  const size = finiteAt(value, what, op)
  if (size <= 0) refuse(`invalid_${what}`, op)
  return size
}

function textAlignOf(value: unknown, what: string, op: string): string {
  if (typeof value !== 'string' || !TEXT_ALIGNS.includes(value)) return refuse(`invalid_${what}`, op)
  return value
}

function nativeTextOf(value: unknown, what: string, op: string): string {
  if (typeof value !== 'string') return refuse(`invalid_${what}`, op)
  const text = value.normalize('NFC')
  const length = [...text].length
  if (length < 1 || length > TEXT_MAX_LENGTH) refuse(`invalid_${what}`, op)
  return text
}

/** Spark styling round: line spacing as a multiple of the size (`parseLineHeight`). */
function lineHeightOf(value: unknown, what: string, op: string): number {
  const amount = finiteAt(value, what, op)
  if (amount < LINE_HEIGHT.min || amount > LINE_HEIGHT.max) refuse(`invalid_${what}`, op)
  return amount
}

/** Spark styling round: `{underline, strikethrough}`; both false is no decoration (`null`), never stored (`parseTextDecoration`). */
function textDecorationOf(value: unknown, what: string, op: string): { underline: boolean; strikethrough: boolean } | null {
  const record = objectOf(value, ['underline', 'strikethrough'], ['underline', 'strikethrough'], what, op)
  if (typeof record['underline'] !== 'boolean' || typeof record['strikethrough'] !== 'boolean') return refuse(`invalid_${what}`, op)
  const decoration = { underline: record['underline'], strikethrough: record['strikethrough'] }
  return decoration.underline || decoration.strikethrough ? decoration : null
}

/** Spark styling round: an outline `{color, width_px}`, 0 < width_px <= 100 (`parseTextStroke`). */
function textStrokeOf(value: unknown, what: string, op: string): { color: string; width_px: number } {
  const record = objectOf(value, ['color', 'width_px'], ['color', 'width_px'], what, op)
  const width = finiteAt(record['width_px'], what, op)
  if (width <= 0 || width > STROKE_WIDTH_MAX_PX) refuse(`invalid_${what}`, op)
  return { color: hexColorOf(record['color'], what, op), width_px: width }
}

/** Spark styling round: a layer opacity 0-1; 1 is `null` (the field is removed, never stored as 1) (`parseLayerOpacity`). */
function opacityOf(value: unknown, what: string, op: string): number | null {
  const amount = finiteAt(value, what, op)
  if (amount < 0 || amount > 1) refuse(`invalid_${what}`, op)
  return amount === 1 ? null : amount
}

function textStyleOf(value: unknown, op: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refuse('invalid_style', op)
  const record = value as Json
  if (Object.keys(record).some((key) => !TEXT_STYLE_FIELDS.includes(key))) return refuse('invalid_style', op)
  const decoration = 'text_decoration' in record ? textDecorationOf(record['text_decoration'], 'style', op) : null
  return {
    font: fontRefOf(record['font'], 'style', op),
    size_px: fontSizeOf(record['size_px'], 'style', op),
    color: hexColorOf(record['color'], 'style', op),
    ...('align' in record && { align: textAlignOf(record['align'], 'style', op) }),
    ...('line_height' in record && { line_height: lineHeightOf(record['line_height'], 'style', op) }),
    ...(decoration && { text_decoration: decoration }),
    ...('stroke' in record && { stroke: textStrokeOf(record['stroke'], 'style', op) }),
  }
}

/** The gateway's `requiredText`: a string, trimmed, 1–max UTF-16 units (no NFC step, unlike a text layer). */
function trimmedTextOf(value: unknown, max: number, what: string, op: string): string {
  if (typeof value !== 'string') return refuse(`invalid_${what}`, op)
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > max) refuse(`invalid_${what}`, op)
  return trimmed
}

function gainOf(value: unknown, what: string, op: string): number {
  const gain = finiteAt(value, what, op)
  if (gain < GAIN_DB.min || gain > GAIN_DB.max) refuse(`invalid_${what}`, op)
  return gain
}

// ---------------------------------------------------------------- the draft (copy on write, F27 revs)

const keyOf = (kind: CompositionEntityKind, id: string) => `${kind}:${id}`

const AUDIO_CONTAINER_ID = 'audio'
const SCENE_SEQUENCE_ID = 'scene_sequence'

class Draft {
  doc: CompositionDocument
  private readonly before: Map<string, number>
  private readonly touched = new Map<string, CompositionEntityRef>()
  private readonly created = new Map<string, { ref: CompositionEntityRef; rev: number }>()
  private readonly removed = new Map<string, CompositionEntityRef>()
  private scenesOwned = false
  private sectionsOwned = false
  private sequenceOwned = false
  private audioOwned = false
  private readonly ownedScenes = new Set<string>()
  private readonly ownedSections = new Set<string>()
  private readonly ownedLayers = new Set<string>()
  private readonly ownedPlacements = new Set<string>()

  constructor(document: CompositionDocument) {
    this.doc = { ...document }
    this.before = indexCompositionRevs(document)
  }

  // ---- copy on write

  private ownScenesArray(): Scene[] {
    if (!this.scenesOwned) {
      this.doc.scenes = [...this.doc.scenes]
      this.scenesOwned = true
    }
    return this.doc.scenes
  }

  /** The section list as a private, writable array (its sections are still shared until `section()` copies one). */
  ownSections(): Section[] {
    if (!this.sectionsOwned) {
      this.doc.sections = [...this.doc.sections]
      this.sectionsOwned = true
    }
    return this.doc.sections
  }

  /** The section as a private, writable copy. */
  section(sectionId: string, op?: string): Section {
    const sections = this.ownSections()
    const index = sections.findIndex((candidate) => candidate.section_id === sectionId)
    if (index < 0) return refuse(`missing_section_${sectionId}`, op)
    if (!this.ownedSections.has(sectionId)) {
      sections[index] = { ...sections[index]! }
      this.ownedSections.add(sectionId)
    }
    return sections[index]!
  }

  hasSection(sectionId: string): boolean {
    return this.doc.sections.some((candidate) => candidate.section_id === sectionId)
  }

  ownSequence(): { rev: number; scene_ids: string[] } {
    if (!this.sequenceOwned) {
      this.doc.scene_sequence = { ...this.doc.scene_sequence, scene_ids: [...this.doc.scene_sequence.scene_ids] }
      this.sequenceOwned = true
    }
    return this.doc.scene_sequence
  }

  private ownAudio(): CompositionDocument['audio'] {
    if (!this.audioOwned) {
      this.doc.audio = { ...this.doc.audio, placements: [...this.doc.audio.placements] }
      this.audioOwned = true
    }
    return this.doc.audio
  }

  /** The scene as a private, writable copy (its `layers` array is private too). */
  scene(sceneId: string): Scene {
    const scenes = this.ownScenesArray()
    const index = scenes.findIndex((candidate) => candidate.scene_id === sceneId)
    if (index < 0) return refuse(`missing_scene_${sceneId}`)
    if (!this.ownedScenes.has(sceneId)) {
      scenes[index] = { ...scenes[index]!, layers: [...scenes[index]!.layers] }
      this.ownedScenes.add(sceneId)
    }
    return scenes[index]!
  }

  hasScene(sceneId: string): boolean {
    return this.doc.scenes.some((candidate) => candidate.scene_id === sceneId)
  }

  /** The layer as a private, writable copy inside its (private) scene. */
  layer(sceneId: string, layerId: string, op: string): { scene: Scene; layer: LayerBody; index: number } {
    const scene = this.scene(sceneId)
    const index = scene.layers.findIndex((candidate) => candidate.layer_id === layerId)
    if (index < 0) {
      if (this.hasLayer(layerId)) return refuse('layer_not_in_scene', op)
      return refuse(`missing_layer_${layerId}`, op)
    }
    const key = `${sceneId}/${layerId}`
    if (!this.ownedLayers.has(key)) {
      scene.layers[index] = { ...scene.layers[index]! }
      this.ownedLayers.add(key)
    }
    return { scene, layer: scene.layers[index] as LayerBody, index }
  }

  hasLayer(layerId: string): boolean {
    return (
      this.doc.scenes.some((scene) => scene.layers.some((layer) => layer.layer_id === layerId)) ||
      this.doc.project_overlays.layers.some((layer) => layer.layer_id === layerId)
    )
  }

  placement(placementId: string): { placement: Json; index: number } {
    const audio = this.ownAudio()
    const index = audio.placements.findIndex((candidate) => candidate.placement_id === placementId)
    if (index < 0) return refuse(`missing_audio_${placementId}`)
    if (!this.ownedPlacements.has(placementId)) {
      audio.placements[index] = { ...audio.placements[index]! }
      this.ownedPlacements.add(placementId)
    }
    return { placement: audio.placements[index] as Json, index }
  }

  audioPlacements(): CompositionDocument['audio']['placements'] {
    return this.ownAudio().placements
  }

  // ---- entity bookkeeping (the gateway's CompositionDocumentDraft)

  touch(kind: CompositionEntityKind, id: string): void {
    const key = keyOf(kind, id)
    if (!this.created.has(key)) this.touched.set(key, { entity_kind: kind, entity_id: id })
  }

  create(kind: CompositionEntityKind, id: string, rev = 1): void {
    const key = keyOf(kind, id)
    this.removed.delete(key)
    this.touched.delete(key)
    this.created.set(key, { ref: { entity_kind: kind, entity_id: id }, rev })
  }

  remove(kind: CompositionEntityKind, id: string): void {
    const key = keyOf(kind, id)
    this.touched.delete(key)
    if (this.created.delete(key)) return
    this.removed.set(key, { entity_kind: kind, entity_id: id })
  }

  hasEntity(kind: CompositionEntityKind, id: string): boolean {
    return this.locate(kind, id) !== null
  }

  // ---- source lookups

  source(sourceId: string): { source: Json; kind: 'video' | 'image' | 'audio' } {
    const source = this.doc.source_media.find((candidate) => candidate.source_id === sourceId) as Json | undefined
    if (!source) return refuse(`missing_source_${sourceId}`)
    const kind = (source['storage_object'] as Json | undefined)?.['media_kind']
    if (kind !== 'video' && kind !== 'image' && kind !== 'audio') return refuse('source_media_kind_unplayable')
    return { source, kind }
  }

  // ---- finalize

  private locate(kind: CompositionEntityKind, id: string): { rev: number } | null {
    const doc = this.doc
    switch (kind) {
      case 'scene_sequence':
        return id === SCENE_SEQUENCE_ID ? doc.scene_sequence : null
      case 'audio':
        if (id === AUDIO_CONTAINER_ID) return doc.audio
        return doc.audio.placements.find((placement) => placement.placement_id === id) ?? null
      case 'section':
        return doc.sections.find((section) => section.section_id === id) ?? null
      case 'scene':
        return doc.scenes.find((scene) => scene.scene_id === id) ?? null
      case 'layer':
      case 'pending_slot': {
        for (const scene of doc.scenes) {
          const layer = scene.layers.find((candidate) => candidate.layer_id === id)
          if (layer) return (layer.layer_kind === 'pending_slot') === (kind === 'pending_slot') ? layer : null
        }
        const overlay = doc.project_overlays.layers.find((candidate) => candidate.layer_id === id)
        return overlay && kind === 'layer' ? overlay : null
      }
      default:
        return null
    }
  }

  /** The writable object that carries the entity's rev (a private copy, never an object shared with the input). */
  private writable(kind: CompositionEntityKind, id: string): { rev: number } | null {
    switch (kind) {
      case 'scene_sequence':
        return id === SCENE_SEQUENCE_ID ? this.ownSequence() : null
      case 'audio':
        if (id === AUDIO_CONTAINER_ID) return this.ownAudio()
        return this.doc.audio.placements.some((placement) => placement.placement_id === id) ? (this.placement(id).placement as { rev: number }) : null
      case 'section':
        return this.hasSection(id) ? this.section(id) : null
      case 'scene':
        return this.hasScene(id) ? this.scene(id) : null
      case 'layer': {
        for (const scene of this.doc.scenes) {
          if (scene.layers.some((candidate) => candidate.layer_id === id)) return this.layer(scene.scene_id, id, 'finalize').layer as { rev: number }
        }
        return null
      }
      default:
        return null
    }
  }

  finalize(): { changed: LocalChangedEntity[]; removed: CompositionEntityRef[] } {
    const changed: LocalChangedEntity[] = []
    for (const [key, ref] of this.touched) {
      const previous = this.before.get(key)
      if (previous === undefined || !this.locate(ref.entity_kind, ref.entity_id)) continue
      const target = this.writable(ref.entity_kind, ref.entity_id)
      if (!target) continue
      target.rev = previous + 1
      changed.push({ ...ref, entity_rev: target.rev })
    }
    for (const { ref, rev } of this.created.values()) {
      const target = this.locate(ref.entity_kind, ref.entity_id) ? this.writable(ref.entity_kind, ref.entity_id) : null
      if (!target) continue
      target.rev = rev
      changed.push({ ...ref, entity_rev: rev })
    }
    return { changed, removed: [...this.removed.values()] }
  }
}

// ---------------------------------------------------------------- layer helpers (typed-edit-draft.ts)

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value))

function placeLayer(scene: Scene, layer: Layer, afterLayerId: string | null, op: string): void {
  let index = 0
  if (afterLayerId !== null) {
    index = scene.layers.findIndex((candidate) => candidate.layer_id === afterLayerId) + 1
    if (index === 0) refuse(`missing_layer_${afterLayerId}`, op)
  }
  scene.layers.splice(index, 0, layer)
}

function assertNewLayerId(draft: Draft, layerId: string, op: string): void {
  if (draft.hasLayer(layerId)) refuse('layer_exists', op)
}

/** `expectLayerKind`: the layer kinds an op accepts; a pending slot and a clip without a scene range (global span) are refused. */
function expectKind(layer: LayerBody, kinds: readonly string[], op: string, allowGlobalClip = false): void {
  if (layer.layer_kind === 'pending_slot') refuse('placeholder_not_editable', op)
  if (!kinds.includes(layer.layer_kind)) refuse('layer_kind_mismatch', op)
  if (layer.layer_kind === 'clip' && !(layer['placement'] as Json | undefined)?.['scene_range'] && !allowGlobalClip) refuse('global_clip_span_unsupported', op)
}

/** `assertNotAnimatedOrAnchored`: a cut never moves animations or re-targets another layer's `after` anchor. */
function assertNotAnimatedOrAnchored(scene: Scene, layer: LayerBody, op: string): void {
  if (Array.isArray(layer['animations']) && (layer['animations'] as unknown[]).length > 0) refuse('animated_layer_cut_unsupported', op)
  const anchored = scene.layers.some((candidate) =>
    (Array.isArray(candidate['animations']) ? (candidate['animations'] as Array<{ anchor?: { kind?: unknown; layer_id?: unknown } }>) : []).some(
      (animation) => animation.anchor?.kind === 'after' && animation.anchor.layer_id === layer.layer_id,
    ),
  )
  if (anchored) refuse('anchor_target_cut_unsupported', op)
}

function sceneRangeOf(layer: LayerBody): FrameRange {
  return (layer.layer_kind === 'clip' ? (layer['placement'] as Json)['scene_range'] : layer['scene_range']) as FrameRange
}

function setSceneRange(layer: LayerBody, range: FrameRange): void {
  if (layer.layer_kind === 'clip') layer['placement'] = { ...(layer['placement'] as Json), scene_range: range }
  else layer['scene_range'] = range
}

function assertShapeGeometry(shape: string, geometry: { size?: unknown; corner_radius_px?: unknown }, op: string): void {
  const boxed = BOXED_SHAPES.includes(shape)
  if (geometry.size !== undefined && !boxed) refuse('shape_size_not_applicable', op)
  if (geometry.corner_radius_px !== undefined && geometry.corner_radius_px !== null && shape !== 'rect') refuse('shape_corner_radius_rect_only', op)
}

function assertSourceRangeWithin(source: Json, range: SourceRange, op: string): void {
  const probe = source['probe'] as { duration_ticks: number }
  if (range.out_tick > probe.duration_ticks) refuse('source_range_exceeds_source', op)
}

function assertSourceHasAudio(resolved: { source: Json; kind: string }, op: string): void {
  if (resolved.kind === 'image' || (resolved.source['probe'] as { audio_channels: number }).audio_channels < 1) refuse('source_has_no_audio', op)
}

function clockFrames(draft: Draft, source: Json, ticks: number): number {
  return framesForTicks(ticks, (source['probe'] as { timebase: Rational }).timebase, draft.doc.canvas.fps)
}

/** The scene's visual layers that end after the scene's length (none while the length is not derivable yet). */
function sceneContentOverflow(document: CompositionDocument, scene: Scene): { length: number | null; layers: string[] } {
  const length = resolveSceneLength(document, scene)
  if (length === null) return { length, layers: [] }
  const layers = scene.layers.flatMap((layer) => {
    const range = (layer.layer_kind === 'clip' ? (layer['placement'] as Json | undefined)?.['scene_range'] : layer['scene_range']) as
      | { start_frame?: unknown; end_frame?: unknown }
      | undefined
    return range && Number.isSafeInteger(range.start_frame) && Number.isSafeInteger(range.end_frame) && (range.end_frame as number) > length ? [layer.layer_id] : []
  })
  return { length, layers }
}

// ---------------------------------------------------------------- scene.split (scene-cut-ops.ts)

/**
 * `scene.split` has two rule sets on the gateway: P02-12 (a text, shape or scene audio crossing the cut and animated layers
 * after it are refused) and, while `COMPOSITION_RELAXED_SPLIT_ENABLED` is on, the timeline v3 relaxed split (crossing texts
 * and shapes copied into both halves with their entry animations left and exit animations re-timed right, animated layers
 * after the cut re-timed, crossing music/sfx split by `split_placement_ids`). The gateway accepts `split_placement_ids`
 * only while the switch is on, so an op that carries it (the editor always sends it, `{}` included, when the preview
 * manifest says `relaxed_split_enabled`) can only succeed under the relaxed rules, and the port applies those to it. An op
 * without it gets the P02-12 rules: where they accept, the relaxed rules give exactly the same document; where they refuse,
 * the command goes server-first and the gateway decides with its own switch.
 */
type SplitAnimation = Json & {
  animation_id: string
  phase: string
  params: { duration_frames: number }
  anchor: Json & { kind: string; layer_id?: string; phase?: string; frames?: number }
}
type SplitParams = {
  at: number
  newSceneId: string
  splitLayerIds: Record<string, string>
  splitPlacementIds: Record<string, string>
  relaxed: boolean
}
type SplitPartition = { stay: LayerBody[]; moved: LayerBody[]; created: string[] }

const SPLIT_OP = 'scene.split'
const splitAnimationsOf = (layer: Json): SplitAnimation[] => (Array.isArray(layer['animations']) ? (layer['animations'] as SplitAnimation[]) : [])
const isAnimatedLayer = (layer: Json): boolean => splitAnimationsOf(layer).length > 0

/** The gateway's `clipRange`: the clip placement's or the layer's own scene range (a global clip span has none). */
function splitRangeOf(layer: LayerBody): FrameRange | null {
  const range = (layer.layer_kind === 'clip' ? (layer['placement'] as Json | undefined)?.['scene_range'] : layer['scene_range']) as FrameRange | undefined
  return range ?? null
}

/** An `{old id: new id}` map of new entities (the gateway's `newIdMap`): opaque old ids, unique new ids of `pattern`. */
function newIdMapOf(raw: Json, key: string, pattern: RegExp): Record<string, string> {
  const value = raw[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refuse(`invalid_${key}`, SPLIT_OP)
  const map: Record<string, string> = {}
  const seen = new Set<string>()
  for (const [oldId, newId] of Object.entries(value as Json)) {
    if (!OPAQUE_ID.test(oldId) || typeof newId !== 'string' || !pattern.test(newId) || seen.has(newId)) return refuse(`invalid_${key}`, SPLIT_OP)
    seen.add(newId)
    map[oldId] = newId
  }
  return map
}

function splitRightId(draft: Draft, params: SplitParams, layer: LayerBody): string {
  const rightId = params.splitLayerIds[layer.layer_id]
  if (!rightId) return refuse('split_layer_id_missing', SPLIT_OP)
  if (draft.hasLayer(rightId)) return refuse('layer_exists', SPLIT_OP)
  return rightId
}

/** The two halves of a clip the cut crosses: the same source cut at the matching tick; the right half has no animations. */
function splitClipHalves(draft: Draft, layer: LayerBody, range: FrameRange, at: number, rightId: string): { left: LayerBody; right: LayerBody } {
  const placement = layer['placement'] as Json & { source_id: string; source_range: SourceRange }
  const resolved = draft.source(placement.source_id)
  const source = placement.source_range
  let left: SourceRange = { ...source }
  let right: SourceRange = { ...source }
  if (resolved.kind === 'video') {
    const timebase = (resolved.source['probe'] as { timebase: Rational }).timebase
    const tick = source.in_tick + ticksForFrames(at - range.start_frame, timebase, draft.doc.canvas.fps)
    if (tick <= source.in_tick || tick >= source.out_tick) return refuse('split_outside_source', SPLIT_OP)
    left = { in_tick: source.in_tick, out_tick: tick }
    right = { in_tick: tick, out_tick: source.out_tick }
  }
  const body: Json = clone(layer)
  delete body['animations']
  const rightLayer = {
    ...body,
    layer_id: rightId,
    rev: 1,
    placement: { source_id: placement.source_id, source_range: right, scene_range: { start_frame: 0, end_frame: range.end_frame - at } },
  } as unknown as LayerBody
  const leftLayer = { ...layer, placement: { ...placement, source_range: left, scene_range: { start_frame: range.start_frame, end_frame: at } } } as LayerBody
  draft.touch('layer', layer.layer_id)
  return { left: leftLayer, right: rightLayer }
}

function assertSplitIdsUsed(params: SplitParams, created: readonly string[]): void {
  if (Object.keys(params.splitLayerIds).some((layerId) => !created.includes(params.splitLayerIds[layerId]!))) refuse('split_layer_id_unused', SPLIT_OP)
}

/** P02-12 (`strictLayers`): only clips cross the cut, nothing animated changes scene. */
function strictSplitLayers(draft: Draft, scene: Scene, params: SplitParams): SplitPartition {
  const at = params.at
  const stay: LayerBody[] = []
  const moved: LayerBody[] = []
  const created: string[] = []
  let crossing = false
  for (const layer of scene.layers as LayerBody[]) {
    const range = splitRangeOf(layer)
    if (!range || range.end_frame <= at) {
      stay.push(layer)
      continue
    }
    if (layer.layer_kind === 'pending_slot') return refuse('placeholder_not_editable', SPLIT_OP)
    if (isAnimatedLayer(layer)) return refuse('animated_layer_split_unsupported', SPLIT_OP)
    if (range.start_frame >= at) {
      const copy = { ...layer } as LayerBody
      setSceneRange(copy, { start_frame: range.start_frame - at, end_frame: range.end_frame - at })
      moved.push(copy)
      draft.touch('layer', layer.layer_id)
      continue
    }
    if (layer.layer_kind !== 'clip') {
      crossing = true
      continue
    }
    const rightId = splitRightId(draft, params, layer)
    const halves = splitClipHalves(draft, layer, range, at, rightId)
    stay.push(halves.left)
    moved.push(halves.right)
    created.push(rightId)
  }
  if (crossing) return refuse('scene_split_crosses_layer', SPLIT_OP)
  assertSplitIdsUsed(params, created)
  const movedIds = new Set(moved.map((layer) => layer.layer_id))
  const acrossEdge = stay.some((layer) =>
    splitAnimationsOf(layer).some((animation) => animation?.anchor?.kind === 'after' && typeof animation.anchor.layer_id === 'string' && movedIds.has(animation.anchor.layer_id)),
  )
  if (acrossEdge) return refuse('anchor_crosses_scene', SPLIT_OP)
  return { stay, moved, created }
}

const startKey = (layerId: string, animationId: unknown) => `${layerId}\u0000${String(animationId)}`

/** The gateway's `animationStarts`: each animation's start frame in the scene before the cut (null = not computable here). */
function splitAnimationStarts(scene: Scene, length: number): Map<string, number | null> {
  const byLayer = new Map((scene.layers as LayerBody[]).map((layer) => [layer.layer_id, splitAnimationsOf(layer)]))
  const starts = new Map<string, number | null>()
  const visiting = new Set<string>()
  const duration = (animation: SplitAnimation): number | null => {
    const frames = animation?.params?.duration_frames
    return Number.isSafeInteger(frames) && frames >= 1 ? frames : null
  }
  const visit = (layerId: string, animation: SplitAnimation): number | null => {
    const key = startKey(layerId, animation?.animation_id)
    if (starts.has(key)) return starts.get(key)!
    if (visiting.has(key)) return null
    visiting.add(key)
    const anchor = animation?.anchor
    let start: number | null = null
    if (anchor?.kind === 'scene_start') start = 0
    else if (anchor?.kind === 'scene_end') start = duration(animation) === null ? null : length - duration(animation)!
    else if (anchor?.kind === 'scene_offset') start = Number.isSafeInteger(anchor.frames) ? anchor.frames! : null
    else if (anchor?.kind === 'after' && typeof anchor.layer_id === 'string') {
      const targets = (byLayer.get(anchor.layer_id) ?? []).filter((candidate) => candidate?.phase === anchor.phase)
      let end: number | null = targets.length > 0 ? 0 : null
      for (const target of targets) {
        const targetStart = visit(anchor.layer_id, target)
        const targetDuration = duration(target)
        if (end === null || targetStart === null || targetDuration === null) {
          end = null
          break
        }
        end = Math.max(end, targetStart + targetDuration)
      }
      start = end
    }
    visiting.delete(key)
    starts.set(key, start)
    return start
  }
  for (const [layerId, animations] of byLayer) for (const animation of animations) visit(layerId, animation)
  return starts
}

/** The gateway's `retimed`: the animation in the new scene (`-at`), or null when it starts before the cut. */
function retimedAnimation(animation: SplitAnimation, start: number | null, at: number): SplitAnimation | null {
  if (start === null || start < at) return null
  const copy = clone(animation)
  if (animation.anchor.kind === 'scene_offset') copy.anchor = start === at ? { kind: 'scene_start' } : { kind: 'scene_offset', frames: start - at }
  else if (animation.anchor.kind !== 'scene_end' && animation.anchor.kind !== 'after') return null
  return copy
}

const splitPhaseSet = (animations: readonly SplitAnimation[], phase: unknown): string =>
  animations
    .filter((animation) => animation?.phase === phase)
    .map((animation) => animation.animation_id)
    .sort()
    .join('\u0000')

/** Timeline v3 relaxed split (`relaxedLayers`). */
function relaxedSplitLayers(draft: Draft, scene: Scene, params: SplitParams, length: number): SplitPartition {
  const at = params.at
  const starts = splitAnimationStarts(scene, length)
  const original = new Map((scene.layers as LayerBody[]).map((layer) => [layer.layer_id, splitAnimationsOf(layer)]))
  const startOf = (layer: LayerBody, animation: SplitAnimation) => starts.get(startKey(layer.layer_id, animation?.animation_id)) ?? null
  const stay: LayerBody[] = []
  const moved: LayerBody[] = []
  const created: string[] = []
  const rightOf = new Map<string, string>()
  let crossing = false
  for (const layer of scene.layers as LayerBody[]) {
    const range = splitRangeOf(layer)
    if (!range || range.end_frame <= at) {
      stay.push(layer)
      continue
    }
    if (layer.layer_kind === 'pending_slot') return refuse('placeholder_not_editable', SPLIT_OP)
    if (range.start_frame >= at) {
      const copy = { ...layer } as LayerBody
      if (isAnimatedLayer(layer)) {
        copy['animations'] = splitAnimationsOf(layer).map((animation) => retimedAnimation(animation, startOf(layer, animation), at) ?? refuse('animation_not_retimable', SPLIT_OP))
      }
      setSceneRange(copy, { start_frame: range.start_frame - at, end_frame: range.end_frame - at })
      moved.push(copy)
      rightOf.set(layer.layer_id, layer.layer_id)
      draft.touch('layer', layer.layer_id)
      continue
    }
    if (layer.layer_kind === 'clip') {
      if (isAnimatedLayer(layer)) return refuse('animated_layer_split_unsupported', SPLIT_OP)
      const rightId = splitRightId(draft, params, layer)
      const halves = splitClipHalves(draft, layer, range, at, rightId)
      stay.push(halves.left)
      moved.push(halves.right)
      created.push(rightId)
      rightOf.set(layer.layer_id, rightId)
      continue
    }
    if (layer.layer_kind !== 'text' && layer.layer_kind !== 'shape') {
      crossing = true // a Motion restarts with its range: not split here
      continue
    }
    const rightId = splitRightId(draft, params, layer)
    const entry: SplitAnimation[] = []
    const exit: SplitAnimation[] = []
    for (const animation of splitAnimationsOf(layer)) {
      const start = startOf(layer, animation)
      const frames = animation?.params?.duration_frames
      if (animation?.phase === 'enter' && start !== null && Number.isSafeInteger(frames) && start + frames <= at) entry.push(animation)
      else if (animation?.phase === 'exit') exit.push(retimedAnimation(animation, start, at) ?? refuse('split_layer_animation_crosses_cut', SPLIT_OP))
      else return refuse('split_layer_animation_crosses_cut', SPLIT_OP)
    }
    const body: Json = clone(layer)
    delete body['animations']
    moved.push({ ...body, layer_id: rightId, rev: 1, scene_range: { start_frame: 0, end_frame: range.end_frame - at }, ...(exit.length > 0 && { animations: exit }) } as unknown as LayerBody)
    const left = { ...layer, scene_range: { start_frame: range.start_frame, end_frame: at } } as LayerBody
    if (entry.length > 0) left['animations'] = entry
    else if (exit.length > 0) delete left['animations']
    stay.push(left)
    created.push(rightId)
    rightOf.set(layer.layer_id, rightId)
    draft.touch('layer', layer.layer_id)
  }
  if (crossing) return refuse('scene_split_crosses_layer', SPLIT_OP)
  assertSplitIdsUsed(params, created)

  // after() anchors stay inside one new scene with the same target animations; the right scene re-targets new ids.
  const stayById = new Map(stay.map((layer) => [layer.layer_id, layer]))
  for (const layer of stay) {
    for (const animation of splitAnimationsOf(layer)) {
      if (animation?.anchor?.kind !== 'after') continue
      const target = stayById.get(animation.anchor.layer_id as string)
      if (!target || splitPhaseSet(splitAnimationsOf(target), animation.anchor.phase) !== splitPhaseSet(original.get(target.layer_id) ?? [], animation.anchor.phase)) {
        return refuse('anchor_crosses_scene', SPLIT_OP)
      }
    }
  }
  const movedById = new Map(moved.map((layer) => [layer.layer_id, layer]))
  for (const layer of moved) {
    for (const animation of splitAnimationsOf(layer)) {
      if (animation?.anchor?.kind !== 'after') continue
      const targetId = animation.anchor.layer_id as string
      const target = movedById.get(rightOf.get(targetId) ?? '')
      if (!target || splitPhaseSet(splitAnimationsOf(target), animation.anchor.phase) !== splitPhaseSet(original.get(targetId) ?? [], animation.anchor.phase)) {
        return refuse('anchor_crosses_scene', SPLIT_OP)
      }
      // The animations of moved layers and right copies are this op's own copies (never the input's objects).
      animation.anchor = { ...animation.anchor, layer_id: target.layer_id }
    }
  }
  return { stay, moved, created }
}

/** Frames to milliseconds at the canvas fps, rounded down (`audio.set_fade`'s rule). */
function splitFramesToMs(draft: Draft, frames: number): number {
  const fps = draft.doc.canvas.fps
  return Math.floor((frames * 1000 * fps.den) / fps.num)
}

/** The gateway's `splitSceneAudio`: local audio after the cut moves; crossing music/sfx is refused or (relaxed) cut in two. */
function splitSceneAudio(draft: Draft, sceneId: string, params: SplitParams): string[] {
  const at = params.at
  const created: string[] = []
  const local = draft.doc.audio.placements.filter((candidate) => candidate['scene_id'] === sceneId) as Json[]
  for (const current of local) {
    const placementId = current['placement_id'] as string
    const range = current['scene_range'] as FrameRange
    if (range.end_frame <= at) continue
    if (range.start_frame >= at) {
      const { placement } = draft.placement(placementId)
      placement['scene_id'] = params.newSceneId
      placement['scene_range'] = { start_frame: range.start_frame - at, end_frame: range.end_frame - at }
      draft.touch('audio', placementId)
      continue
    }
    if (!params.relaxed || current['role'] === 'narration') return refuse('scene_split_crosses_audio', SPLIT_OP)
    const rightId = params.splitPlacementIds[placementId]
    if (!rightId) return refuse('split_placement_id_missing', SPLIT_OP)
    if (draft.hasEntity('audio', rightId)) return refuse('audio_placement_exists', SPLIT_OP)
    const source = current['source_range'] as SourceRange
    const resolved = draft.source(current['source_id'] as string)
    const timebase = (resolved.source['probe'] as { timebase: Rational }).timebase
    const tick = source.in_tick + ticksForFrames(at - range.start_frame, timebase, draft.doc.canvas.fps)
    if (tick <= source.in_tick || tick >= source.out_tick) return refuse('scene_split_audio_outside_source', SPLIT_OP)
    const fadeIn = typeof current['fade_in_ms'] === 'number' ? current['fade_in_ms'] : 0
    const fadeOut = typeof current['fade_out_ms'] === 'number' ? current['fade_out_ms'] : 0
    if (fadeIn > splitFramesToMs(draft, at - range.start_frame) || fadeOut > splitFramesToMs(draft, range.end_frame - at)) {
      return refuse('scene_split_inside_audio_fade', SPLIT_OP)
    }
    const { placement, index } = draft.placement(placementId)
    const right: Json = {
      ...clone(placement),
      placement_id: rightId,
      rev: 1,
      scene_id: params.newSceneId,
      source_range: { in_tick: tick, out_tick: source.out_tick },
      scene_range: { start_frame: 0, end_frame: range.end_frame - at },
    }
    delete right['fade_in_ms']
    placement['source_range'] = { in_tick: source.in_tick, out_tick: tick }
    placement['scene_range'] = { start_frame: range.start_frame, end_frame: at }
    delete placement['fade_out_ms']
    draft.audioPlacements().splice(index + 1, 0, right as never)
    draft.touch('audio', placementId)
    created.push(rightId)
  }
  if (Object.keys(params.splitPlacementIds).some((placementId) => !created.includes(params.splitPlacementIds[placementId]!))) {
    return refuse('split_placement_id_unused', SPLIT_OP)
  }
  return created
}

// ---------------------------------------------------------------- the ops

type OpHandler = (draft: Draft, raw: Json) => void

const sceneRef = (id: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: id })
void sceneRef

function insertionIndex(sequence: readonly string[], afterSceneId: string | null, op: string): number {
  if (afterSceneId === null) return 0
  const index = sequence.indexOf(afterSceneId)
  if (index < 0) return refuse(`missing_scene_${afterSceneId}`, op)
  return index + 1
}

const HANDLERS: Record<string, OpHandler> = {
  'scene.insert'(draft, raw) {
    const op = 'scene.insert'
    onlyKeys(raw, ['scene_id', 'after_scene_id', 'timing_policy', 'duration_frames', 'section_id', 'origin', 'layout_ref'], op)
    const timingPolicy = raw['timing_policy']
    if (typeof timingPolicy !== 'string' || !TIMING_POLICIES.includes(timingPolicy)) return refuse('invalid_timing_policy', op)
    const duration = 'duration_frames' in raw ? intAt(raw['duration_frames'], 1, 'duration_frames', op) : undefined
    if (timingPolicy === 'fixed' && duration === undefined) return refuse('fixed_scene_needs_duration', op)
    const sceneId = idOf(raw, 'scene_id', NEW_SCENE_ID, op)
    const afterSceneId = nullableIdOf(raw, 'after_scene_id', OPAQUE_ID, op)
    const sectionId = 'section_id' in raw ? nullableIdOf(raw, 'section_id', OPAQUE_ID, op) : null
    const origin = 'origin' in raw ? raw['origin'] : 'authored'
    if (typeof origin !== 'string' || !SCENE_ORIGINS.includes(origin)) return refuse('invalid_origin', op)
    // `layout_ref` (a Brand template revision) is provenance only; the editor never sends it with a plain insert.
    if ('layout_ref' in raw) return refuse('layout_ref_not_supported', op)
    if (draft.doc.scenes.some((candidate) => candidate.scene_id === sceneId)) return refuse('scene_exists', op)
    if (sectionId !== null && !draft.doc.sections.some((section) => section.section_id === sectionId)) return refuse(`missing_section_${sectionId}`, op)
    const index = insertionIndex(draft.doc.scene_sequence.scene_ids, afterSceneId, op)
    const scene = {
      scene_id: sceneId,
      rev: 1,
      origin,
      timing_policy: timingPolicy,
      ...(duration !== undefined && { duration_frames: duration }),
      section_id: sectionId,
      layers: [],
    } as unknown as Scene
    draft.ownSequence().scene_ids.splice(index, 0, sceneId)
    ;(draft.doc.scenes = [...draft.doc.scenes, scene])
    draft.create('scene', sceneId)
    draft.touch('scene_sequence', SCENE_SEQUENCE_ID)
  },

  'scene.remove'(draft, raw) {
    const op = 'scene.remove'
    onlyKeys(raw, ['scene_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    if (!draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    if (draft.doc.audio.placements.some((placement) => placement['scene_id'] === sceneId)) return refuse('scene_has_local_audio', op)
    const sequence = draft.ownSequence()
    sequence.scene_ids = sequence.scene_ids.filter((id) => id !== sceneId)
    draft.doc.scenes = draft.doc.scenes.filter((candidate) => candidate.scene_id !== sceneId)
    draft.remove('scene', sceneId)
    draft.touch('scene_sequence', SCENE_SEQUENCE_ID)
  },

  'scene.reorder'(draft, raw) {
    const op = 'scene.reorder'
    onlyKeys(raw, ['scene_id', 'after_scene_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const afterSceneId = nullableIdOf(raw, 'after_scene_id', OPAQUE_ID, op)
    if (afterSceneId === sceneId) return refuse('scene_after_itself', op)
    const sequence = draft.ownSequence()
    if (!sequence.scene_ids.includes(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    const remaining = sequence.scene_ids.filter((id) => id !== sceneId)
    remaining.splice(insertionIndex(remaining, afterSceneId, op), 0, sceneId)
    sequence.scene_ids = remaining
    draft.touch('scene_sequence', SCENE_SEQUENCE_ID)
  },

  'scene.set_timing'(draft, raw) {
    const op = 'scene.set_timing'
    onlyKeys(raw, ['scene_id', 'timing_policy', 'duration_frames'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const policy = raw['timing_policy']
    if (typeof policy !== 'string' || !TIMING_POLICIES.includes(policy)) return refuse('invalid_timing_policy', op)
    const duration = 'duration_frames' in raw ? intAt(raw['duration_frames'], 1, 'duration_frames', op) : undefined
    if (policy === 'fixed' && duration === undefined) return refuse('fixed_scene_needs_duration', op)
    const scene = draft.scene(sceneId) as Scene & Json
    scene.timing_policy = policy as Scene['timing_policy']
    if (duration !== undefined) scene.duration_frames = duration
    else delete scene.duration_frames
    if (sceneContentOverflow(draft.doc, scene).layers.length > 0) return refuse('scene_timing_impact', op)
    draft.touch('scene', sceneId)
  },

  // ---- transitions (scene-transition-ops.ts; live FX)

  'scene.set_transition'(draft, raw) {
    const op = 'scene.set_transition'
    onlyKeys(raw, ['scene_id', 'kind', 'duration_frames', 'params'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    let transition: Json | null = null
    if (raw['kind'] === 'cut') {
      // `cut` takes no length or parameters; it clears the transition.
      if (raw['duration_frames'] !== undefined || raw['params'] !== undefined) return refuse('cut_takes_no_parameters', op)
    } else {
      const parsed = readTransition({ kind: raw['kind'], duration_frames: raw['duration_frames'], ...(raw['params'] !== undefined && { params: raw['params'] }) })
      if (!parsed) return refuse('transition_invalid', op)
      transition = parsed as unknown as Json
    }
    if (!draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    const scene = draft.scene(sceneId) as Scene & Json
    const previous = scene['transition_in']
    if (transition) {
      // A scene that already carries one may be rewritten; a new one needs a previous scene.
      if (previous === undefined && draft.doc.scene_sequence.scene_ids[0] === sceneId) return refuse('transition_first_scene', op)
      scene['transition_in'] = transition
    } else {
      delete scene['transition_in']
    }
    draft.touch('scene', sceneId)
  },

  'scene.clear_transition'(draft, raw) {
    const op = 'scene.clear_transition'
    onlyKeys(raw, ['scene_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    if (!draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    delete (draft.scene(sceneId) as Scene & Json)['transition_in']
    draft.touch('scene', sceneId)
  },

  // ---- sections (section-ops.ts, scene-ops.ts `scene.set_section`)

  'scene.set_section'(draft, raw) {
    const op = 'scene.set_section'
    onlyKeys(raw, ['scene_id', 'section_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const sectionId = nullableIdOf(raw, 'section_id', OPAQUE_ID, op)
    if (!draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    if (sectionId !== null && !draft.hasSection(sectionId)) return refuse(`missing_section_${sectionId}`, op)
    // Like the gateway, the scene is touched (rev + 1) even when it already was in that section.
    draft.scene(sceneId).section_id = sectionId
    draft.touch('scene', sceneId)
  },

  'section.insert'(draft, raw) {
    const op = 'section.insert'
    onlyKeys(raw, ['section_id', 'title', 'script_chapter_id', 'after_section_id'], op)
    const sectionId = idOf(raw, 'section_id', NEW_SECTION_ID, op)
    const title = trimmedTextOf(raw['title'], SECTION_TITLE_MAX_LENGTH, 'title', op)
    const chapter = 'script_chapter_id' in raw ? nullableIdOf(raw, 'script_chapter_id', OPAQUE_ID, op) : null
    const afterSectionId = nullableIdOf(raw, 'after_section_id', OPAQUE_ID, op)
    if (draft.hasSection(sectionId)) return refuse('section_exists', op)
    const sections = draft.ownSections()
    let index = 0
    if (afterSectionId !== null) {
      index = sections.findIndex((candidate) => candidate.section_id === afterSectionId) + 1
      if (index === 0) return refuse(`missing_section_${afterSectionId}`, op)
    }
    sections.splice(index, 0, { section_id: sectionId, rev: 1, title, ...(chapter !== null && { script_chapter_id: chapter }) })
    draft.create('section', sectionId)
  },

  'section.update'(draft, raw) {
    const op = 'section.update'
    onlyKeys(raw, ['section_id', 'title', 'script_chapter_id'], op)
    const sectionId = idOf(raw, 'section_id', OPAQUE_ID, op)
    const title = 'title' in raw ? trimmedTextOf(raw['title'], SECTION_TITLE_MAX_LENGTH, 'title', op) : undefined
    const chapter = 'script_chapter_id' in raw ? nullableIdOf(raw, 'script_chapter_id', OPAQUE_ID, op) : undefined
    if (title === undefined && chapter === undefined) return refuse('section_update_needs_a_field', op)
    const section = draft.section(sectionId, op) as Section & Json
    if (title !== undefined) section.title = title
    if (chapter === null) delete section.script_chapter_id
    else if (chapter !== undefined) section.script_chapter_id = chapter
    draft.touch('section', sectionId)
  },

  'section.remove'(draft, raw) {
    const op = 'section.remove'
    onlyKeys(raw, ['section_id'], op)
    const sectionId = idOf(raw, 'section_id', OPAQUE_ID, op)
    if (!draft.hasSection(sectionId)) return refuse(`missing_section_${sectionId}`, op)
    // The gateway never re-homes scenes on its own: they are moved (`scene.set_section`) earlier in the same command.
    if (draft.doc.scenes.some((scene) => scene.section_id === sectionId)) return refuse('section_has_scenes', op)
    draft.doc.sections = draft.ownSections().filter((candidate) => candidate.section_id !== sectionId)
    draft.remove('section', sectionId)
  },

  'layer.set_transform'(draft, raw) {
    const op = 'layer.set_transform'
    onlyKeys(raw, ['scene_id', 'layer_id', 'transform'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const value = required(raw, 'transform', op)
    const transform = value === null ? null : transformOf(value, 'transform', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, VISUAL_KINDS, op, true)
    if (transform) layer['transform'] = transform
    else delete layer['transform']
    draft.touch('layer', layerId)
  },

  'layer.set_opacity'(draft, raw) {
    const op = 'layer.set_opacity'
    onlyKeys(raw, ['scene_id', 'layer_id', 'opacity'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const value = required(raw, 'opacity', op)
    const opacity = value === null ? null : opacityOf(value, 'opacity', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    // Text, shapes and images only: the export draws no footage opacity and a Motion's layers are the pattern's.
    if (layer.layer_kind === 'motion_instance') return refuse('layer_opacity_not_supported', op)
    expectKind(layer, ['clip', 'text', 'shape'], op, true)
    if (layer.layer_kind === 'clip' && draft.source((layer['placement'] as Json)['source_id'] as string).kind !== 'image') return refuse('layer_opacity_not_supported', op)
    if (opacity === null) delete layer['opacity']
    else layer['opacity'] = opacity
    draft.touch('layer', layerId)
  },

  'layer.set_locked'(draft, raw) {
    const op = 'layer.set_locked'
    onlyKeys(raw, ['scene_id', 'layer_id', 'locked'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const locked = required(raw, 'locked', op)
    if (typeof locked !== 'boolean') return refuse('invalid_locked', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, VISUAL_KINDS, op, true)
    if (locked) layer['locked'] = true
    else delete layer['locked']
    draft.touch('layer', layerId)
  },

  'layer.remove'(draft, raw) {
    const op = 'layer.remove'
    onlyKeys(raw, ['scene_id', 'layer_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const { scene, layer, index } = draft.layer(sceneId, layerId, op)
    expectKind(layer, VISUAL_KINDS, op, true)
    scene.layers.splice(index, 1)
    draft.remove('layer', layerId)
    draft.touch('scene', sceneId)
  },

  'layer.arrange'(draft, raw) {
    const op = 'layer.arrange'
    onlyKeys(raw, ['scene_id', 'layer_id', 'after_layer_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const afterLayerId = nullableIdOf(raw, 'after_layer_id', OPAQUE_ID, op)
    if (afterLayerId === layerId) return refuse('layer_above_itself', op)
    const { scene, layer, index } = draft.layer(sceneId, layerId, op)
    expectKind(layer, VISUAL_KINDS, op, true)
    if (afterLayerId !== null && !scene.layers.some((candidate) => candidate.layer_id === afterLayerId)) {
      return refuse(draft.hasLayer(afterLayerId) ? 'layer_not_in_scene' : `missing_layer_${afterLayerId}`, op)
    }
    scene.layers.splice(index, 1)
    placeLayer(scene, layer, afterLayerId, op)
    draft.touch('scene', sceneId)
  },

  'layer.move'(draft, raw) {
    const op = 'layer.move'
    onlyKeys(raw, ['scene_id', 'layer_id', 'start_frame'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const start = intAt(required(raw, 'start_frame', op), 0, 'start_frame', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, VISUAL_KINDS, op)
    const range = sceneRangeOf(layer)
    setSceneRange(layer, { start_frame: start, end_frame: start + (range.end_frame - range.start_frame) })
    draft.touch('layer', layerId)
  },

  'layer.trim'(draft, raw) {
    const op = 'layer.trim'
    onlyKeys(raw, ['scene_id', 'layer_id', 'source_range', 'scene_range'], op)
    const hasSource = 'source_range' in raw
    if (hasSource === 'scene_range' in raw) return refuse('trim_needs_exactly_one_range', op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const sourceRange = hasSource ? sourceRangeOf(raw['source_range'], 'source_range', op) : null
    const sceneRange = hasSource ? null : frameRangeOf(raw['scene_range'], 'scene_range', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['clip', 'text', 'shape'], op)
    const isVideo = layer.layer_kind === 'clip' && draft.source((layer['placement'] as Json)['source_id'] as string).kind === 'video'
    if (isVideo !== (sourceRange !== null)) return refuse('trim_parameter_mismatch', op)
    if (layer.layer_kind === 'clip' && sourceRange) {
      const placement = layer['placement'] as { source_id: string; source_range: SourceRange; scene_range: FrameRange }
      const { source } = draft.source(placement.source_id)
      assertSourceRangeWithin(source, sourceRange, op)
      const next = {
        start_frame: placement.scene_range.start_frame + clockFrames(draft, source, sourceRange.in_tick - placement.source_range.in_tick),
        end_frame: placement.scene_range.end_frame + clockFrames(draft, source, sourceRange.out_tick - placement.source_range.out_tick),
      }
      if (next.start_frame < 0) return refuse('range_before_scene_start', op)
      if (next.end_frame <= next.start_frame) return refuse('range_shorter_than_one_frame', op)
      layer['placement'] = { ...placement, scene_range: next, source_range: sourceRange }
    } else {
      setSceneRange(layer, sceneRange as FrameRange)
    }
    draft.touch('layer', layerId)
  },

  'text.insert'(draft, raw) {
    const op = 'text.insert'
    onlyKeys(raw, ['scene_id', 'layer_id', 'after_layer_id', 'text', 'style', 'scene_range', 'transform'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', NEW_LAYER_ID, op)
    const afterLayerId = nullableIdOf(raw, 'after_layer_id', OPAQUE_ID, op)
    const text = nativeTextOf(required(raw, 'text', op), 'text', op)
    const style = textStyleOf(required(raw, 'style', op), op)
    const range = frameRangeOf(required(raw, 'scene_range', op), 'scene_range', op)
    const transform = 'transform' in raw ? transformOf(raw['transform'], 'transform', op) : null
    const scene = draft.scene(sceneId)
    assertNewLayerId(draft, layerId, op)
    const layer = { layer_id: layerId, rev: 1, layer_kind: 'text', text, style, scene_range: range, ...(transform && { transform }) } as unknown as Layer
    placeLayer(scene, layer, afterLayerId, op)
    draft.create('layer', layerId)
    draft.touch('scene', sceneId)
  },

  'text.set'(draft, raw) {
    const op = 'text.set'
    onlyKeys(raw, ['scene_id', 'layer_id', 'text'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const text = nativeTextOf(required(raw, 'text', op), 'text', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['text'], op)
    layer['text'] = text
    draft.touch('layer', layerId)
  },

  'text.set_style'(draft, raw) {
    const op = 'text.set_style'
    onlyKeys(raw, ['scene_id', 'layer_id', ...TEXT_STYLE_FIELDS], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const patch: Record<string, unknown> = {}
    if ('font' in raw) patch['font'] = fontRefOf(raw['font'], 'font', op)
    if ('size_px' in raw) patch['size_px'] = fontSizeOf(raw['size_px'], 'size_px', op)
    if ('color' in raw) patch['color'] = hexColorOf(raw['color'], 'color', op)
    if ('align' in raw) patch['align'] = raw['align'] === null ? null : textAlignOf(raw['align'], 'align', op)
    // Spark styling round: `null` clears line spacing, decoration and outline; a decoration without a line clears too.
    if ('line_height' in raw) patch['line_height'] = raw['line_height'] === null ? null : lineHeightOf(raw['line_height'], 'line_height', op)
    if ('text_decoration' in raw) patch['text_decoration'] = raw['text_decoration'] === null ? null : textDecorationOf(raw['text_decoration'], 'text_decoration', op)
    if ('stroke' in raw) patch['stroke'] = raw['stroke'] === null ? null : textStrokeOf(raw['stroke'], 'stroke', op)
    if (Object.keys(patch).length === 0) return refuse('style_needs_a_field', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['text'], op)
    const style = { ...(layer['style'] as Json) }
    for (const field of TEXT_STYLE_FIELDS) {
      if (!(field in patch)) continue
      if (patch[field] === null) delete style[field]
      else style[field] = patch[field]
    }
    layer['style'] = style
    draft.touch('layer', layerId)
  },

  'shape.insert'(draft, raw) {
    const op = 'shape.insert'
    onlyKeys(raw, ['scene_id', 'layer_id', 'after_layer_id', 'shape', 'fill', 'scene_range', 'transform', 'size', 'corner_radius_px'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', NEW_LAYER_ID, op)
    const afterLayerId = nullableIdOf(raw, 'after_layer_id', OPAQUE_ID, op)
    const shape = raw['shape']
    if (typeof shape !== 'string' || !SHAPES.includes(shape)) return refuse('invalid_shape', op)
    const fill = hexColorOf(required(raw, 'fill', op), 'fill', op)
    const range = frameRangeOf(required(raw, 'scene_range', op), 'scene_range', op)
    const transform = 'transform' in raw ? transformOf(raw['transform'], 'transform', op) : null
    const size = 'size' in raw ? shapeSizeOf(raw['size'], 'size', op) : null
    const radius = 'corner_radius_px' in raw ? cornerRadiusOf(raw['corner_radius_px'], 'corner_radius_px', op) : undefined
    assertShapeGeometry(shape, { size: size ?? undefined, corner_radius_px: radius }, op)
    const scene = draft.scene(sceneId)
    assertNewLayerId(draft, layerId, op)
    const layer = {
      layer_id: layerId,
      rev: 1,
      layer_kind: 'shape',
      shape,
      fill,
      scene_range: range,
      ...(transform && { transform }),
      ...(size && { size }),
      ...(radius !== undefined && { corner_radius_px: radius }),
    } as unknown as Layer
    placeLayer(scene, layer, afterLayerId, op)
    draft.create('layer', layerId)
    draft.touch('scene', sceneId)
  },

  'shape.set_fill'(draft, raw) {
    const op = 'shape.set_fill'
    onlyKeys(raw, ['scene_id', 'layer_id', 'fill'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const fill = hexColorOf(required(raw, 'fill', op), 'fill', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['shape'], op)
    layer['fill'] = fill
    draft.touch('layer', layerId)
  },

  'shape.set_size'(draft, raw) {
    const op = 'shape.set_size'
    onlyKeys(raw, ['scene_id', 'layer_id', 'size'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const size = shapeSizeOf(required(raw, 'size', op), 'size', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['shape'], op)
    assertShapeGeometry(layer['shape'] as string, { size }, op)
    layer['size'] = size
    draft.touch('layer', layerId)
  },

  'shape.set_corner_radius'(draft, raw) {
    const op = 'shape.set_corner_radius'
    onlyKeys(raw, ['scene_id', 'layer_id', 'corner_radius_px'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const value = required(raw, 'corner_radius_px', op)
    const radius = value === null ? null : cornerRadiusOf(value, 'corner_radius_px', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['shape'], op)
    assertShapeGeometry(layer['shape'] as string, { corner_radius_px: radius }, op)
    if (radius === null) delete layer['corner_radius_px']
    else layer['corner_radius_px'] = radius
    draft.touch('layer', layerId)
  },

  // ---- animations (animation-ops.ts; live FX)

  'animation.set'(draft, raw) {
    const op = 'animation.set'
    onlyKeys(raw, ['scene_id', 'layer_id', 'animation'], op)
    const animation = readLocalAnimation(required(raw, 'animation', op))
    if (!animation) return refuse('animation_invalid', op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ANIMATABLE_KINDS, op, true)
    const preset = findLocalPreset(animation.preset_ref.preset_id, animation.preset_ref.preset_revision)
    if (preset?.layer_kinds && !(preset.layer_kinds as readonly string[]).includes(layer.layer_kind)) return refuse('preset_layer_kind_mismatch', op)
    // scene-presets@3: `count_up` needs a text that is one number (the counted number carries its own locale).
    if (preset && layer.layer_kind === 'text' && !presetFitsText(preset, { text: String(layer['text'] ?? ''), lang: 'und' })) return refuse('preset_text_not_numeric', op)
    const animations = [...((layer['animations'] as Json[] | undefined) ?? [])]
    const index = animations.findIndex((candidate) => candidate['animation_id'] === animation.animation_id)
    if (index >= 0) animations[index] = animation as unknown as Json
    else {
      if (animations.length >= ANIMATIONS_PER_LAYER) return refuse('limit_animations_per_layer', op)
      animations.push(animation as unknown as Json)
    }
    // A text runs one text program: never scramble and count up together.
    const programs = new Set(
      animations
        .map((candidate) => candidate['preset_ref'] as { preset_id?: unknown; preset_revision?: unknown } | undefined)
        .map((ref) => (typeof ref?.preset_id === 'string' && typeof ref.preset_revision === 'number' ? findLocalPreset(ref.preset_id, ref.preset_revision)?.text_program : undefined))
        .filter(Boolean),
    )
    if (programs.size > 1) return refuse('preset_text_program_conflict', op)
    layer['animations'] = animations
    draft.touch('layer', layerId)
  },

  'animation.remove'(draft, raw) {
    const op = 'animation.remove'
    onlyKeys(raw, ['scene_id', 'layer_id', 'animation_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const animationId = idOf(raw, 'animation_id', OPAQUE_ID, op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ANIMATABLE_KINDS, op, true)
    const animations = (layer['animations'] as Json[] | undefined) ?? []
    const index = animations.findIndex((candidate) => candidate['animation_id'] === animationId)
    if (index < 0) return refuse('animation_missing', op)
    const remaining = animations.filter((_, position) => position !== index)
    if (remaining.length > 0) layer['animations'] = remaining
    else delete layer['animations']
    draft.touch('layer', layerId)
  },

  'clip.insert_sequence'(draft, raw) {
    const op = 'clip.insert_sequence'
    onlyKeys(raw, ['scene_id', 'after_layer_id', 'start_frame', 'image_hold_frames', 'items'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const afterLayerId = nullableIdOf(raw, 'after_layer_id', OPAQUE_ID, op)
    const start = intAt(required(raw, 'start_frame', op), 0, 'start_frame', op)
    const hold = 'image_hold_frames' in raw ? intAt(raw['image_hold_frames'], 1, 'image_hold_frames', op) : undefined
    const items = required(raw, 'items', op)
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) return refuse('invalid_items', op)
    const seen = new Set<string>()
    const parsed = items.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return refuse('invalid_items', op)
      const item = entry as Json
      if (Object.keys(item).some((key) => !['layer_id', 'source_id', 'source_range'].includes(key))) return refuse('invalid_items', op)
      const layerId = idOf(item, 'layer_id', NEW_LAYER_ID, op)
      if (seen.has(layerId)) return refuse('invalid_items', op)
      seen.add(layerId)
      return {
        layer_id: layerId,
        source_id: idOf(item, 'source_id', OPAQUE_ID, op),
        ...('source_range' in item && { source_range: sourceRangeOf(item['source_range'], 'source_range', op) }),
      }
    })
    const scene = draft.scene(sceneId)
    let cursor = start
    let after = afterLayerId
    for (const item of parsed) {
      const resolved = draft.source(item.source_id)
      if (resolved.kind === 'audio') return refuse('audio_source_not_visual', op)
      let range: SourceRange
      let frames: number
      if (resolved.kind === 'image') {
        if ('source_range' in item && item.source_range) return refuse('image_source_range_must_be_whole', op)
        if (hold === undefined) return refuse('image_hold_required', op)
        range = { in_tick: 0, out_tick: (resolved.source['probe'] as { duration_ticks: number }).duration_ticks }
        frames = hold
      } else {
        range = ('source_range' in item && item.source_range) || { in_tick: 0, out_tick: (resolved.source['probe'] as { duration_ticks: number }).duration_ticks }
        assertSourceRangeWithin(resolved.source, range, op)
        frames = clockFrames(draft, resolved.source, range.out_tick - range.in_tick)
        if (frames < 1) return refuse('range_shorter_than_one_frame', op)
      }
      assertNewLayerId(draft, item.layer_id, op)
      const layer = {
        layer_id: item.layer_id,
        rev: 1,
        layer_kind: 'clip',
        placement: { source_id: item.source_id, source_range: range, scene_range: { start_frame: cursor, end_frame: cursor + frames } },
      } as unknown as Layer
      placeLayer(scene, layer, after, op)
      draft.create('layer', item.layer_id)
      after = item.layer_id
      cursor += frames
    }
    draft.touch('scene', sceneId)
  },

  'clip.split'(draft, raw) {
    const op = 'clip.split'
    onlyKeys(raw, ['scene_id', 'layer_id', 'at_frame', 'new_layer_id'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const at = intAt(required(raw, 'at_frame', op), 1, 'at_frame', op)
    const newLayerId = idOf(raw, 'new_layer_id', NEW_LAYER_ID, op)
    const { scene, layer, index } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['clip'], op)
    assertNotAnimatedOrAnchored(scene, layer, op)
    assertNewLayerId(draft, newLayerId, op)
    const placement = layer['placement'] as Json & { source_id: string; source_range: SourceRange; scene_range: FrameRange }
    const range = placement.scene_range
    if (at <= range.start_frame || at >= range.end_frame) return refuse('split_outside_clip', op)
    const resolved = draft.source(placement.source_id)
    const sourceRange = placement.source_range
    let left: SourceRange = { ...sourceRange }
    let right: SourceRange = { ...sourceRange }
    if (resolved.kind === 'video') {
      const timebase = (resolved.source['probe'] as { timebase: Rational }).timebase
      const splitTick = sourceRange.in_tick + ticksForFrames(at - range.start_frame, timebase, draft.doc.canvas.fps)
      if (splitTick <= sourceRange.in_tick || splitTick >= sourceRange.out_tick) return refuse('split_outside_source', op)
      left = { in_tick: sourceRange.in_tick, out_tick: splitTick }
      right = { in_tick: splitTick, out_tick: sourceRange.out_tick }
    }
    // The gateway's `clipCopy`: the whole body (transform, audio, take ref, ...) without `animations`, and a fresh placement
    // of exactly source / source range / scene range (a held last frame stays with the left part).
    const body: Json = clone(layer)
    delete body['animations']
    const rightLayer = {
      ...body,
      layer_id: newLayerId,
      rev: 1,
      placement: { source_id: placement.source_id, source_range: right, scene_range: { start_frame: at, end_frame: range.end_frame } },
    } as unknown as Layer
    layer['placement'] = { ...placement, source_range: left, scene_range: { start_frame: range.start_frame, end_frame: at } }
    scene.layers.splice(index + 1, 0, rightLayer)
    draft.create('layer', newLayerId)
    draft.touch('layer', layerId)
    draft.touch('scene', sceneId)
  },

  'scene.split'(draft, raw) {
    const op = SPLIT_OP
    onlyKeys(raw, ['scene_id', 'at_frame', 'new_scene_id', 'split_layer_ids', 'split_placement_ids'], op)
    const relaxed = 'split_placement_ids' in raw
    const splitLayerIds = newIdMapOf(raw, 'split_layer_ids', NEW_LAYER_ID)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const at = intAt(required(raw, 'at_frame', op), 1, 'at_frame', op)
    const newSceneId = idOf(raw, 'new_scene_id', NEW_SCENE_ID, op)
    const splitPlacementIds = relaxed ? newIdMapOf(raw, 'split_placement_ids', NEW_AUDIO_ID) : {}
    if (!draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    const scene = draft.scene(sceneId) as Scene & Json
    if (scene.timing_policy === 'follow_narration' || scene['narration_binding']) return refuse('scene_split_narration_bound', op)
    const length = resolveSceneLength(draft.doc, scene)
    if (length === null) return refuse('scene_length_unknown', op)
    if (at >= length) return refuse('split_outside_scene', op)
    const params: SplitParams = { at, newSceneId, splitLayerIds, splitPlacementIds, relaxed }
    const { stay, moved, created } = relaxed ? relaxedSplitLayers(draft, scene, params, length) : strictSplitLayers(draft, scene, params)
    const createdPlacements = splitSceneAudio(draft, sceneId, params)

    scene.layers = stay
    const next = {
      scene_id: newSceneId,
      rev: 1,
      origin: 'source_split',
      timing_policy: scene.timing_policy,
      ...(scene.timing_policy === 'fixed' && { duration_frames: length - at }),
      section_id: scene.section_id,
      // Both halves keep the layout (template) the scene was laid out from.
      ...(scene['layout_ref'] !== undefined && { layout_ref: clone(scene['layout_ref']) }),
      ...(scene['template_binding'] !== undefined && { template_binding: clone(scene['template_binding']) }),
      layers: moved,
    } as unknown as Scene
    if (scene.timing_policy === 'fixed') scene.duration_frames = at
    // `placeScene`: a new id, an existing section, right after the scene in the strip (`scenes` is a set: appended).
    if (draft.hasScene(newSceneId)) return refuse('scene_exists', op)
    if (next.section_id !== null && !draft.hasSection(next.section_id)) return refuse(`missing_section_${next.section_id}`, op)
    const sequence = draft.ownSequence()
    sequence.scene_ids.splice(insertionIndex(sequence.scene_ids, sceneId, op), 0, newSceneId)
    draft.doc.scenes = [...draft.doc.scenes, next]
    if (scene.timing_policy === 'follow_media' && resolveSceneLength(draft.doc, scene) !== at) return refuse('scene_split_leaves_gap', op)
    draft.create('scene', newSceneId)
    for (const layerId of created) draft.create('layer', layerId)
    for (const placementId of createdPlacements) draft.create('audio', placementId)
    if (createdPlacements.length > 0) draft.touch('audio', AUDIO_CONTAINER_ID)
    draft.touch('scene', sceneId)
    draft.touch('scene_sequence', SCENE_SEQUENCE_ID)
  },

  'clip.set_audio'(draft, raw) {
    const op = 'clip.set_audio'
    onlyKeys(raw, ['scene_id', 'layer_id', 'gain_db', 'muted'], op)
    if (!('gain_db' in raw) && !('muted' in raw)) return refuse('audio_needs_a_field', op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const gain = 'gain_db' in raw ? gainOf(raw['gain_db'], 'gain_db', op) : undefined
    const muted = 'muted' in raw ? raw['muted'] : undefined
    if (muted !== undefined && typeof muted !== 'boolean') return refuse('invalid_muted', op)
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['clip'], op, true)
    assertSourceHasAudio(draft.source((layer['placement'] as Json)['source_id'] as string), op)
    const current = (layer['audio'] as { gain_db: number; muted: boolean } | undefined) ?? { gain_db: 0, muted: false }
    layer['audio'] = { gain_db: gain ?? current.gain_db, muted: muted ?? current.muted }
    draft.touch('layer', layerId)
  },

  'clip.replace_source'(draft, raw) {
    const op = 'clip.replace_source'
    onlyKeys(raw, ['scene_id', 'layer_id', 'source_id', 'source_range', 'generated_take_ref'], op)
    const sceneId = idOf(raw, 'scene_id', OPAQUE_ID, op)
    const layerId = idOf(raw, 'layer_id', OPAQUE_ID, op)
    const sourceId = idOf(raw, 'source_id', OPAQUE_ID, op)
    const sourceRange = sourceRangeOf(raw['source_range'], 'source_range', op)
    let takeRef: { production_run_id: string; take_id: string } | null = null
    const takeValue = raw['generated_take_ref']
    if (takeValue !== undefined && takeValue !== null) {
      const record = objectOf(takeValue, ['production_run_id', 'take_id'], [], 'generated_take_ref', op)
      takeRef = { production_run_id: idOf(record, 'production_run_id', OPAQUE_ID, op), take_id: idOf(record, 'take_id', OPAQUE_ID, op) }
    }
    const { layer } = draft.layer(sceneId, layerId, op)
    expectKind(layer, ['clip'], op)
    const placement = layer['placement'] as { source_id: string; source_range: SourceRange }
    const previous = draft.source(placement.source_id)
    const next = draft.source(sourceId)
    if (next.kind !== previous.kind || next.kind === 'audio') return refuse('replacement_media_kind_mismatch', op)
    assertSourceRangeWithin(next.source, sourceRange, op)
    if (next.kind === 'video') {
      const seconds = (range: SourceRange, source: Json) => {
        const timebase = (source['probe'] as { timebase: Rational }).timebase
        return ((range.out_tick - range.in_tick) * timebase.num) / timebase.den
      }
      const fps = draft.doc.canvas.fps
      const oneFrame = fps.den / fps.num
      if (Math.abs(seconds(placement.source_range, previous.source) - seconds(sourceRange, next.source)) > oneFrame + 1e-9) return refuse('replacement_duration_mismatch', op)
    }
    layer['placement'] = { ...placement, source_id: sourceId, source_range: { ...sourceRange } }
    if (takeRef) layer['generated_take_ref'] = { ...takeRef }
    draft.touch('layer', layerId)
  },

  'audio.insert'(draft, raw) {
    const op = 'audio.insert'
    onlyKeys(raw, ['placement_id', 'role', 'source_id', 'source_range', 'gain_db', 'scene_id', 'scene_range', 'project_range'], op)
    const sceneLocal = 'scene_id' in raw || 'scene_range' in raw
    if (sceneLocal === 'project_range' in raw) return refuse('audio_needs_scene_or_project_range', op)
    const placementId = idOf(raw, 'placement_id', NEW_AUDIO_ID, op)
    const role = raw['role']
    if (role !== 'music' && role !== 'sfx') return refuse('invalid_role', op)
    const sourceId = idOf(raw, 'source_id', OPAQUE_ID, op)
    const sourceRange = sourceRangeOf(required(raw, 'source_range', op), 'source_range', op)
    const gain = gainOf(required(raw, 'gain_db', op), 'gain_db', op)
    const sceneId = sceneLocal ? idOf(raw, 'scene_id', OPAQUE_ID, op) : null
    const where: Json = sceneLocal
      ? { scene_id: sceneId, scene_range: frameRangeOf(required(raw, 'scene_range', op), 'scene_range', op) }
      : { project_range: frameRangeOf(required(raw, 'project_range', op), 'project_range', op) }
    if (draft.hasEntity('audio', placementId)) return refuse('audio_placement_exists', op)
    if (sceneId !== null && !draft.hasScene(sceneId)) return refuse(`missing_scene_${sceneId}`, op)
    const resolved = draft.source(sourceId)
    assertSourceHasAudio(resolved, op)
    assertSourceRangeWithin(resolved.source, sourceRange, op)
    draft.audioPlacements().push({
      placement_id: placementId,
      rev: 1,
      role,
      source_id: sourceId,
      source_range: sourceRange,
      ...where,
      gain_db: gain,
    } as never)
    draft.create('audio', placementId)
    draft.touch('audio', AUDIO_CONTAINER_ID)
  },

  'audio.remove'(draft, raw) {
    const op = 'audio.remove'
    onlyKeys(raw, ['placement_id'], op)
    const placementId = idOf(raw, 'placement_id', OPAQUE_ID, op)
    const { index } = draft.placement(placementId)
    draft.audioPlacements().splice(index, 1)
    draft.remove('audio', placementId)
    draft.touch('audio', AUDIO_CONTAINER_ID)
  },
}

// ---------------------------------------------------------------- invariants (assertCompositionDocumentWritable, the part ops can reach)

function assertWritable(document: CompositionDocument): void {
  if (document.scenes.length > LIMITS.scenes) refuse('limit_scenes_per_project')
  if (document.sections.length > LIMITS.sections) refuse('limit_sections_per_project')
  for (const scene of document.scenes) {
    if (scene.layers.length > LIMITS.layers_per_scene) refuse('limit_layers_per_scene')
    if (scene.timing_policy === 'fixed' && !(Number.isInteger(scene.duration_frames) && (scene.duration_frames ?? 0) >= 1)) refuse('fixed_scene_requires_duration')
  }
  const sceneIds = new Set(document.scenes.map((scene) => scene.scene_id))
  const sequence = document.scene_sequence.scene_ids
  if (sceneIds.size !== document.scenes.length || new Set(sequence).size !== sequence.length || sequence.length !== sceneIds.size || sequence.some((id) => !sceneIds.has(id))) {
    refuse('inv_scene_sequence_matches_scenes')
  }
  const sectionIds = new Set(document.sections.map((section) => section.section_id))
  if (sectionIds.size !== document.sections.length) refuse('inv_entity_ids_unique')
  const layerIds = new Set<string>()
  for (const layer of [...document.scenes.flatMap((scene) => scene.layers), ...document.project_overlays.layers]) {
    if (layerIds.has(layer.layer_id)) refuse('inv_entity_ids_unique')
    layerIds.add(layer.layer_id)
  }
  for (const scene of document.scenes) if (scene.section_id !== null && !sectionIds.has(scene.section_id)) refuse('inv_scene_section_exists')
  for (const placement of document.audio.placements) {
    const sceneId = placement['scene_id']
    if (typeof sceneId === 'string' && !sceneIds.has(sceneId)) refuse('audio_scene_exists')
  }
  if (document.audio.placements.length > LIMITS.audio_placements) refuse('limit_audio_placements')
  const placementIds = new Set<string>()
  for (const placement of document.audio.placements) {
    if (placementIds.has(placement.placement_id)) refuse('inv_entity_ids_unique')
    placementIds.add(placement.placement_id)
  }
  const sourceIds = new Set(document.source_media.map((source) => source.source_id))
  for (const scene of document.scenes) {
    const sceneLayerIds = new Set(scene.layers.map((layer) => layer.layer_id))
    for (const layer of scene.layers) {
      if (layer.layer_kind === 'clip') {
        const sourceId = (layer['placement'] as { source_id?: unknown } | undefined)?.source_id
        if (typeof sourceId !== 'string' || !sourceIds.has(sourceId)) refuse('inv_clip_source_exists')
      }
      const animations = Array.isArray(layer['animations']) ? (layer['animations'] as Array<{ anchor?: unknown }>) : []
      for (const animation of animations) {
        const anchor = animation.anchor as { kind?: unknown; layer_id?: unknown } | undefined
        if (anchor?.kind === 'after' && (typeof anchor.layer_id !== 'string' || !sceneLayerIds.has(anchor.layer_id))) refuse('inv_anchor_refs_resolve')
      }
    }
  }
  for (const placement of document.audio.placements) {
    if (typeof placement['source_id'] !== 'string' || !sourceIds.has(placement['source_id'])) refuse('inv_clip_source_exists')
  }
}

/** The scenes a command touched (the scene itself, its layers, its scene-local audio): their content must lie inside the scene. */
function touchedScenes(document: CompositionDocument, changed: readonly LocalChangedEntity[]): string[] {
  const layerScene = new Map<string, string>()
  for (const scene of document.scenes) for (const layer of scene.layers) layerScene.set(layer.layer_id, scene.scene_id)
  const audioScene = new Map<string, string>()
  for (const placement of document.audio.placements) if (typeof placement['scene_id'] === 'string') audioScene.set(placement.placement_id, placement['scene_id'])
  const scenes: string[] = []
  for (const ref of changed) {
    if (ref.entity_kind === 'scene') scenes.push(ref.entity_id)
    else if (ref.entity_kind === 'layer' || ref.entity_kind === 'pending_slot') {
      const sceneId = layerScene.get(ref.entity_id)
      if (sceneId) scenes.push(sceneId)
    } else if (ref.entity_kind === 'audio') {
      const sceneId = audioScene.get(ref.entity_id)
      if (sceneId) scenes.push(sceneId)
    }
  }
  return scenes
}

function assertScenesWithinLength(document: CompositionDocument, sceneIds: Iterable<string>): void {
  for (const sceneId of new Set(sceneIds)) {
    const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
    if (scene && sceneContentOverflow(document, scene).layers.length > 0) refuse('inv_scene_content_within_length')
  }
}

/**
 * Applies the ops of one command to `document` (not mutated) the way the gateway does. `{ ok: false }` when an op is not
 * covered, malformed, or would be refused: the editor then writes the command server-first (no optimistic picture).
 */
export function applyOpsLocally(document: CompositionDocument, ops: ReadonlyArray<CompositionRawOp>): LocalApplyResult {
  try {
    if (ops.length === 0) return { ok: false, reason: 'no_ops' }
    const draft = new Draft(document)
    for (const raw of ops) {
      const handler = HANDLERS[raw.op]
      if (!handler) return { ok: false, reason: 'unsupported_op', op: raw.op }
      handler(draft, clone(raw) as Json)
    }
    const { changed, removed } = draft.finalize()
    assertWritable(draft.doc)
    assertScenesWithinLength(draft.doc, touchedScenes(draft.doc, changed))
    return { ok: true, document: draft.doc, changed, removed }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.reason, ...(error.op && { op: error.op }) }
    throw error
  }
}

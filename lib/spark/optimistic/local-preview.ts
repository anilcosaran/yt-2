import type { CompositionDocument, CompositionScene } from '../composition-client'
import { resolveTimeline } from '../scene-timing'
import type { PreviewFontFace } from '../stage/preview-contract'
import type { StageIssue, StageNativeLayer, StagePlan, StagePlanScene } from '../stage/stage-types'
import { canonicalJson, fnv1a32 } from '../stage/motion-core/ir/canonical'
import { layoutText, sha256Hex, type TextLayout, type TextMeasurer } from '../stage/motion-core/text'
import { presetTrackFields } from '../stage/motion-core/recipes'
import { hasAnimations, localPresetTweens, localTextProgram, resolveLocalAnimations, type AnimatedLayer, type PresetTween, type ResolvedAnimation } from './local-animations'

/**
 * E1-N: the browser's LOCAL preview of an edited document: the plan of the working copy (`planCompositionPreview`) and the
 * Motion IR of a scene (`scene_compiler@1` in `preview` mode) for the layers the editor creates itself: text, rectangle and
 * ellipse shapes and images, with the video clips the browser draws natively. It runs on the document the editor already
 * holds (the server's with the unconfirmed edits applied), so a new scene, text or shape is on the stage in the same frame
 * as the click, and the picture is the very one the server will send: same IR, same layout (the generated copy of the text
 * engine, over the same pinned font bytes), same `dependency_hash`. The server's answer then confirms a picture that is
 * already drawn instead of drawing it.
 *
 * This is a PORT, not a second design: `api-gateway/src/composition/domain/scene-compiler/scene-compiler.ts` (text, clip,
 * shape geometry, group + content nodes, handles, visibility tracks, background) and `scene-preview.ts` (layer classes,
 * hashes, statuses). `local-preview-parity.test.ts` asserts the output equals the gateway's for a matrix of documents (a
 * golden the gateway test generates from its real compiler), hash and IR, byte for byte.
 *
 * What it does NOT draw stays on the server: Motion layers, captions, scene transitions (E1-L), animations (preset tweens and
 * anchors), pending slots and project overlays make `planLocalPreview` / `compileLocalScene` answer "not drawable here" and
 * the stage waits for the server's picture for that scene (nothing is ever drawn from a guess).
 *
 * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`, `LocalPlanInputs.liveFx`): layer animations are compiled here too
 * (`local-animations.ts`, a port of the preset tweens and the anchor resolution, pinned by its own golden), and a document
 * that stores scene transitions is planned (its scenes exactly as before; the stage blends the neighbouring scene pictures
 * itself, `stage/transition-blend.ts`).
 */

type Body = Record<string, unknown>
type Layer = CompositionScene['layers'][number]

export const COMPOSITION_PREVIEW_HASH_VERSION = 'composition-preview-v1'
/** Width share of the canvas a text layer wraps within (`scene_compiler@1`). */
export const TEXT_FRAME_WIDTH_SHARE = 0.9
export const TEXT_LANGUAGE = 'und'
const SCENE_BACKGROUND = '#000000'
const RATIOS = ['16:9', '9:16', '1:1']
export const MOTION_IR_VERSION = 'motion-ir@1'

const q = (value: number): number => Math.round(value * 1e4) / 1e4
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

// ---------------------------------------------------------------- hashing (composition-canonical-json, stripRevs)

/** Entity `rev` counters are concurrency metadata; hashes depend on content only. */
export function stripRevs<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripRevs(item)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'rev') continue
      out[key] = stripRevs(child)
    }
    return out as T
  }
  return value
}

function sourceIdsOf(layers: readonly Layer[]): string[] {
  const ids = new Set<string>()
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'source_id' && typeof child === 'string') ids.add(child)
        else walk(child)
      }
    }
  }
  walk(layers)
  return [...ids].sort()
}

const canonicalSha256 = (value: unknown): string => sha256Hex(canonicalJson(value))

export type PreviewHashInputs = { sceneCompilerVersion: number; motionRuntimeVersion: string; fontSetHash: string }

/** `previewSceneDependencyHash` of the gateway: everything that can change the drawn frames of a scene and nothing else. */
export function previewSceneDependencyHash(input: {
  document: CompositionDocument
  scene: CompositionScene
  durationFrames: number | null
  versions: PreviewHashInputs
}): string {
  const sourcesById = new Map(input.document.source_media.map((source) => [source.source_id, source]))
  // E1-L: a transition is drawn by its own segment, never by the scene's picture: the gateway hashes the scene without it.
  const { transition_in: transitionIn, ...sceneBody } = input.scene as CompositionScene & { transition_in?: unknown }
  void transitionIn
  const sources = sourceIdsOf(input.scene.layers).map((sourceId) => {
    const source = sourcesById.get(sourceId)
    return source ? stripRevs(source) : { source_id: sourceId, missing: true }
  })
  return canonicalSha256({
    hash_version: COMPOSITION_PREVIEW_HASH_VERSION,
    scene_compiler_version: input.versions.sceneCompilerVersion,
    motion_runtime_version: input.versions.motionRuntimeVersion,
    font_set_hash: input.versions.fontSetHash,
    canvas: input.document.canvas,
    duration_frames: input.durationFrames,
    scene: stripRevs(withoutEditorOnlyLayerFields(sceneBody as CompositionScene)),
    sources,
  })
}

/**
 * Spark styling round, `withoutEditorOnlyLayerFields` of the gateway: a layer's UI-only `locked` flag never changes a frame, so
 * the scene hash leaves it out (locking a layer does not make the stage wait for a new picture).
 */
export function withoutEditorOnlyLayerFields(scene: CompositionScene): CompositionScene {
  if (!scene.layers.some((layer) => 'locked' in layer)) return scene
  return {
    ...scene,
    layers: scene.layers.map((layer) => {
      if (!('locked' in layer)) return layer
      const { locked, ...rest } = layer as Layer & { locked?: unknown }
      void locked
      return rest as Layer
    }),
  }
}

type HashCacheEntry = { canvas: unknown; sources: unknown; duration: number | null; versions: string; hash: string }
const hashCache = new WeakMap<object, HashCacheEntry>()

/**
 * `previewSceneDependencyHash` memoised per scene OBJECT: an edit leaves every scene it did not touch as the very same object
 * (the local op application is copy-on-write), so planning an edited document re-hashes only the scenes that changed (hashing
 * all of a 200 scene project costs ~90 ms).
 */
function sceneHash(document: CompositionDocument, scene: CompositionScene, durationFrames: number | null, versions: PreviewHashInputs): string {
  const stamp = `${versions.sceneCompilerVersion}|${versions.motionRuntimeVersion}|${versions.fontSetHash}`
  const held = hashCache.get(scene)
  if (held && held.canvas === document.canvas && held.sources === document.source_media && held.duration === durationFrames && held.versions === stamp) return held.hash
  const hash = previewSceneDependencyHash({ document, scene, durationFrames, versions })
  hashCache.set(scene, { canvas: document.canvas, sources: document.source_media, duration: durationFrames, versions: stamp, hash })
  return hash
}

// ---------------------------------------------------------------- the plan (scene-preview.ts)

type FrameRange = { start_frame: number; end_frame: number }

function isFiniteFrameRange(value: unknown): value is FrameRange {
  if (!value || typeof value !== 'object') return false
  const { start_frame: start, end_frame: end } = value as Record<string, unknown>
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && (end as number) > (start as number) && (start as number) >= 0
}

/** The canvas rules of the compiler (`checkCanvas`): true when the preview can be planned at all. */
export function canvasIsPlannable(canvas: CompositionDocument['canvas']): boolean {
  const { width, height, fps, aspect_ratio: aspectRatio } = canvas
  if (!(Number.isInteger(width) && Number.isInteger(height) && width >= 16 && height >= 16 && width <= 7680 && height <= 7680)) return false
  const divisor = gcd(width, height) || 1
  const ratio = `${width / divisor}:${height / divisor}`
  if (ratio !== aspectRatio || !RATIOS.includes(ratio)) return false
  return fps.num % fps.den === 0 && fps.num / fps.den >= 1 && fps.num / fps.den <= 240
}

type SourceBody = {
  source_id: string
  storage_object: { storage_object_id: string; checksum_sha256: string; media_kind?: string }
  probe: { timebase: { num: number; den: number } }
}

function nativeVideoLayer(layer: Layer, index: number, source: SourceBody): (StageNativeLayer & { delivery: 'storage_playback' }) | null {
  const placement = layer['placement'] as { source_id: string; source_range: { in_tick: number; out_tick: number }; scene_range?: unknown }
  if (!isFiniteFrameRange(placement.scene_range)) return null
  const transform = layer['transform'] as { x: number; y: number; scale: number; rotation_deg: number } | undefined
  const audio = layer['audio'] as { gain_db?: number; muted?: boolean } | undefined
  return {
    layer_id: layer.layer_id,
    kind: 'video',
    z_index: index,
    source_id: source.source_id,
    storage_object_id: source.storage_object.storage_object_id,
    delivery: 'storage_playback',
    scene_range: { start_frame: placement.scene_range.start_frame, end_frame: placement.scene_range.end_frame },
    source_range: { in_tick: placement.source_range.in_tick, out_tick: placement.source_range.out_tick },
    source_timebase: { num: source.probe.timebase.num, den: source.probe.timebase.den },
    transform: transform ? { x: transform.x, y: transform.y, scale: transform.scale, rotation_deg: transform.rotation_deg } : null,
    audio: audio ? { ...(audio.gain_db !== undefined && { gain_db: audio.gain_db }), ...(audio.muted !== undefined && { muted: audio.muted }) } : null,
  }
}

/** `classifyPreviewLayers`: what the compile gets, what the browser draws itself (video), and what is left out (warnings). */
export function classifyLayers(
  scene: CompositionScene,
  sources: ReadonlyMap<string, SourceBody>,
): { compile: Layer[]; natives: StageNativeLayer[]; warnings: StageIssue[] } {
  const compile: Layer[] = []
  const natives: StageNativeLayer[] = []
  const warnings: StageIssue[] = []
  const at = (layer: Layer) => ({ sceneId: scene.scene_id, layerId: layer.layer_id })
  scene.layers.forEach((layer, index) => {
    const transform = layer['transform'] as { crop?: unknown } | undefined
    if (layer.layer_kind === 'motion_instance') {
      if (transform?.crop) {
        warnings.push({ code: 'crop_not_drawn', message: 'crop is not drawn in the preview; the layer is left out', ...at(layer) })
        return
      }
      compile.push(layer)
      return
    }
    if (layer.layer_kind === 'clip') {
      const placement = layer['placement'] as { source_id?: string; project_range?: unknown } | undefined
      const source = placement?.source_id ? sources.get(placement.source_id) : undefined
      if (!source) {
        warnings.push({ code: 'clip_source_missing', message: "the clip's source is not in the project", ...at(layer) })
        return
      }
      if (placement?.project_range !== undefined) {
        warnings.push({ code: 'global_clip_span_not_drawn', message: 'clips placed on the project timeline are not drawn in the scene preview', ...at(layer) })
        return
      }
      const kind = source.storage_object.media_kind
      if (kind === 'video') {
        const native = nativeVideoLayer(layer, index, source)
        if (!native) {
          warnings.push({ code: 'layer_outside_scene', message: 'the video layer has no valid scene range', ...at(layer) })
          return
        }
        if (transform?.crop) warnings.push({ code: 'crop_not_drawn', message: 'crop is not drawn in the preview', ...at(layer) })
        natives.push(native)
        return
      }
      if (kind !== 'image') {
        warnings.push({ code: 'clip_media_kind_unsupported', message: `a ${String(kind ?? 'unknown')} source cannot be drawn`, ...at(layer) })
        return
      }
    }
    if (layer.layer_kind === 'shape' && layer['shape'] !== 'rect' && layer['shape'] !== 'ellipse') {
      warnings.push({ code: 'shape_not_drawn', message: `${String(layer['shape'])} shapes are not drawn by the preview`, ...at(layer) })
      return
    }
    if (transform?.crop) {
      warnings.push({ code: 'crop_not_drawn', message: 'crop is not drawn in the preview; the layer is left out', ...at(layer) })
      return
    }
    compile.push(layer)
  })
  return { compile, natives, warnings }
}

/** One scene of the local plan. */
export type LocalScene = {
  sceneId: string
  hash: string
  startFrame: number
  durationFrames: number | null
  status: StagePlanScene['status']
  warnings: StageIssue[]
  natives: StageNativeLayer[]
  /** The layers `scene_compiler@1` would receive (document order). */
  compile: Layer[]
  /** The local compile draws every layer in `compile`; false: the scene's picture comes from the server. */
  drawable: boolean
}

export type LocalPlanInputs = PreviewHashInputs & {
  workingCopyVersion: number
  /**
   * `SPARK_LIVE_FX_PREVIEW_ENABLED`: animated layers are drawn by the local compile (`local-animations.ts`) and a document that
   * stores scene transitions is planned (the stage blends them itself). Absent or false: both stay the server's, as before.
   */
  liveFx?: boolean
  /** The plan of the last server manifest: its safe area, and the picture of a scene the browser cannot draw itself. */
  serverPlan: StagePlan | null
}

export type LocalPreviewPlan = { plan: StagePlan; scenes: Map<string, LocalScene> }

/** Layers the local compile draws: text, rect/ellipse shapes and images, without animations (with them: live FX only). */
function layerIsDrawable(layer: Layer, duration: number, sources: ReadonlyMap<string, SourceBody>, animations = false): boolean {
  if (!animations && Array.isArray(layer['animations']) && (layer['animations'] as unknown[]).length > 0) return false
  const range = (layer.layer_kind === 'clip' ? (layer['placement'] as Body | undefined)?.['scene_range'] : layer['scene_range']) as FrameRange | undefined
  if (!range || !Number.isSafeInteger(range.start_frame) || !Number.isSafeInteger(range.end_frame) || range.start_frame < 0 || range.end_frame <= range.start_frame || range.end_frame > duration) return false
  if (layer.layer_kind === 'text' || layer.layer_kind === 'shape') return true
  if (layer.layer_kind === 'clip') {
    const sourceId = (layer['placement'] as { source_id?: string } | undefined)?.source_id
    return sourceId !== undefined && sources.get(sourceId)?.storage_object.media_kind === 'image'
  }
  return false
}

/**
 * Live FX: whether the animations of a scene's compiled layers resolve here exactly as on the server (the properties a preset
 * animates do not depend on the layer's geometry, so the plan can check overlaps before anything is laid out).
 */
const resolveCache = new WeakMap<object, { duration: number; canvas: unknown; sources: unknown; ok: boolean }>()

/**
 * `animationsResolve` memoised per scene OBJECT (an edit leaves every scene it did not touch as the very same object), with
 * the inputs the compiled layer list depends on (the length, the canvas, the sources that classify its clips).
 */
function sceneAnimationsResolve(document: CompositionDocument, scene: CompositionScene, layers: readonly Layer[], duration: number): boolean {
  const held = resolveCache.get(scene)
  if (held && held.duration === duration && held.canvas === document.canvas && held.sources === document.source_media) return held.ok
  const ok = animationsResolve(layers, duration, document.canvas)
  resolveCache.set(scene, { duration, canvas: document.canvas, sources: document.source_media, ok })
  return ok
}

function animationsResolve(layers: readonly Layer[], duration: number, canvas: { width: number; height: number }): boolean {
  const tweensOf = (layer: AnimatedLayer, resolved: ResolvedAnimation): PresetTween[] =>
    localPresetTweens({
      animation: resolved.animation,
      canvas,
      layerScale: 1,
      box: canvas,
      restRotation: 0,
      text: layer.layer_kind === 'text' ? { text: String(layer['text'] ?? ''), lang: TEXT_LANGUAGE } : null,
    })
  return resolveLocalAnimations(layers as unknown as AnimatedLayer[], duration, { tweensOf }) !== null
}

/**
 * `planCompositionPreview` for the editor's own copy of the document. null = the preview cannot be planned here (an
 * unplannable canvas, burned-in captions, which depend on transcript timings only the server reads, or a stored scene
 * transition, whose window, segment, warnings and plan-hash entry only the server plans): the stage then keeps the server's
 * picture and waits for the server.
 */
export function planLocalPreview(document: CompositionDocument, inputs: LocalPlanInputs): LocalPreviewPlan | null {
  if (!canvasIsPlannable(document.canvas) || document.caption_tracks.length > 0) return null
  const liveFx = inputs.liveFx === true
  if (!liveFx && document.scenes.some((scene) => (scene as { transition_in?: unknown }).transition_in != null)) return null
  const timeline = resolveTimeline(document)
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  const sources = new Map((document.source_media as unknown as SourceBody[]).map((source) => [source.source_id, source]))
  const serverScenes = new Map((inputs.serverPlan?.scenes ?? []).map((scene) => [scene.sceneId, scene]))
  const scenes = new Map<string, LocalScene>()
  const planScenes: StagePlanScene[] = []
  const unresolved: string[] = []
  const hashes: Array<[string, number, number | null, string]> = []
  for (const entry of timeline.scenes) {
    const scene = byId.get(entry.sceneId) as CompositionScene
    const classified = classifyLayers(scene, sources)
    const warnings = [...classified.warnings]
    if (entry.lengthFrames === null) {
      warnings.unshift({
        code: 'length_unresolved',
        message: `the scene's length follows ${scene.timing_policy === 'follow_media' ? 'its media' : 'its narration'} and there is none yet`,
        sceneId: scene.scene_id,
      })
    }
    const status: StagePlanScene['status'] = entry.lengthFrames === null ? 'unavailable' : warnings.length > 0 ? 'partial' : 'ready'
    const hash = sceneHash(document, scene, entry.lengthFrames, inputs)
    const drawable =
      entry.lengthFrames !== null &&
      classified.compile.every((layer) => layerIsDrawable(layer, entry.lengthFrames as number, sources, liveFx)) &&
      (!liveFx || !hasAnimations(classified.compile) || sceneAnimationsResolve(document, scene, classified.compile, entry.lengthFrames))
    scenes.set(entry.sceneId, { sceneId: entry.sceneId, hash, startFrame: entry.startFrame, durationFrames: entry.lengthFrames, status, warnings, natives: classified.natives, compile: classified.compile, drawable })
    hashes.push([entry.sceneId, entry.startFrame, entry.lengthFrames, hash])
    if (entry.lengthFrames === null) {
      unresolved.push(entry.sceneId)
      continue
    }
    if (drawable || !serverScenes.has(entry.sceneId)) {
      planScenes.push({
        sceneId: entry.sceneId,
        startFrame: entry.startFrame,
        durationFrames: entry.lengthFrames,
        dependencyHash: hash,
        // A scene the browser cannot draw and the server has not seen yet has no picture to show.
        status: drawable ? status : 'unavailable',
        warnings,
        nativeLayers: classified.natives,
        contentHash: hash,
      })
    } else {
      // The browser cannot draw this scene's new content: it keeps the server's picture (and its hash) until the server
      // has compiled the edit, with the timing the edited document gives it. `contentHash` tells the stage that this
      // picture does not contain the edit (WP1) unless the server already has the very same content.
      const server = serverScenes.get(entry.sceneId) as StagePlanScene
      planScenes.push({ ...server, startFrame: entry.startFrame, durationFrames: entry.lengthFrames, contentHash: hash })
    }
  }
  const { width, height, aspect_ratio: aspectRatio, fps } = document.canvas
  const canvas = { width, height, aspect_ratio: aspectRatio, fps: { num: fps.num, den: fps.den } }
  const plan: StagePlan = {
    workingCopyVersion: inputs.workingCopyVersion,
    canvas: canvas as StagePlan['canvas'],
    scenes: planScenes,
    unresolvedSceneIds: unresolved,
    totalFrames: timeline.totalFrames,
    safeArea: inputs.serverPlan?.safeArea ?? null,
    // E1-L: whether the gateway draws transitions is a switch of the server, not of the document: the editor's transition
    // controls stay live while the stage shows the editor's own plan.
    ...(inputs.serverPlan?.transitionsEnabled === true && { transitionsEnabled: true }),
    ...(inputs.serverPlan?.transitionsEnabled === true && inputs.serverPlan.transitionCatalog === 2 && { transitionCatalog: 2 as const }),
    // Timeline v3: the same for the gateway's relaxed `scene.split` (a switch of the server, never of the document).
    ...(inputs.serverPlan?.relaxedSplitEnabled === true && { relaxedSplitEnabled: true }),
    runtimeVersion: inputs.motionRuntimeVersion,
    dependencyHash: canonicalSha256({
      hash_version: COMPOSITION_PREVIEW_HASH_VERSION,
      scene_compiler_version: inputs.sceneCompilerVersion,
      motion_runtime_version: inputs.motionRuntimeVersion,
      font_set_hash: inputs.fontSetHash,
      canvas,
      scenes: hashes,
    }),
    sceneCompilerVersion: inputs.sceneCompilerVersion,
    fontSetHash: inputs.fontSetHash,
    origin: 'local',
  }
  return { plan, scenes }
}

// ---------------------------------------------------------------- the compile (scene-compiler.ts)

/** The stage's image asset of a source: the content sha256 is the IR `media_ref` and the asset key. */
export type LocalImageAsset = { key: string; width: number; height: number; storageObjectId: string }

type IrNode = {
  handle: string
  kind: string
  role: string
  basis: { role: string; slot_key: null; list_index: null }
  source: { kind: 'typed_scene'; compiler: string }
  box: { x: number; y: number; width: number; height: number }
  origin?: [number, number]
  props: Record<string, unknown>
  content?: Record<string, unknown>
  children?: IrNode[]
}

/** The handle derivation of motion-ir@1 (`createHandleAllocator`): the normalised role plus its 1-based occurrence. */
export function normalizeRole(role: string): string {
  const base = role
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base) throw new Error(`role ${JSON.stringify(role)} has no handle-safe characters`)
  return /^[a-z]/.test(base) ? base : `r_${base}`
}

function handleAllocator() {
  const counters = new Map<string, number>()
  return (role: string): string => {
    const base = normalizeRole(role)
    const order = (counters.get(base) ?? 0) + 1
    counters.set(base, order)
    return `${base}#${order}`
  }
}

const basis = (role: string) => ({ role, slot_key: null, list_index: null }) as const
const fontRefKey = (ref: { font_id: string; font_revision: string; sha256: string }): string => `${ref.font_id}\u0000${ref.font_revision}\u0000${ref.sha256}`

type Geometry = { width: number; height: number; kind: string; props: Record<string, unknown>; content: Record<string, unknown> }

type TextStyleBody = {
  font: { font_id: string; font_revision: string; sha256: string }
  size_px: number
  color: string
  align?: string
  line_height?: number
  text_decoration?: { underline?: boolean; strikethrough?: boolean }
  stroke?: { color?: string; width_px?: number }
}

/**
 * Spark styling round, `textStyleIr` of the compiler: the line spacing goes to the text engine, the decoration and the
 * outline to the IR text content (`decoration`, `stroke_width`) and the `stroke` colour prop. Nothing is added without them.
 */
export function textStyleIr(style: Pick<TextStyleBody, 'line_height' | 'text_decoration' | 'stroke'>): {
  lineHeight: number | undefined
  decoration: { underline: boolean; line_through: boolean } | undefined
  stroke: { color: string; width: number } | undefined
} {
  const lineHeight = typeof style.line_height === 'number' && Number.isFinite(style.line_height) && style.line_height > 0 ? style.line_height : undefined
  const decoration = style.text_decoration
  const lines =
    decoration && (decoration.underline === true || decoration.strikethrough === true)
      ? { underline: decoration.underline === true, line_through: decoration.strikethrough === true }
      : undefined
  const stroke = style.stroke
  const outline =
    stroke && typeof stroke.width_px === 'number' && Number.isFinite(stroke.width_px) && stroke.width_px > 0 && typeof stroke.color === 'string'
      ? { color: stroke.color, width: q(stroke.width_px) }
      : undefined
  return { lineHeight, decoration: lines, stroke: outline }
}

/** Spark styling round, `layerOpacity` of the compiler: a text, shape or image clip's stored opacity (0-1), else 1. */
export function layerOpacity(layer: Layer): number {
  if (layer.layer_kind !== 'text' && layer.layer_kind !== 'shape' && layer.layer_kind !== 'clip') return 1
  const value = (layer as Body)['opacity']
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1 ? q(value) : 1
}

function sameLines(a: TextLayout, b: TextLayout): boolean {
  return a.lines.length === b.lines.length && a.lines.every((line, index) => line.text === b.lines[index]?.text && line.x === b.lines[index]?.x)
}

export type LocalCompileInput = {
  document: CompositionDocument
  scene: Pick<LocalScene, 'sceneId' | 'durationFrames' | 'compile'>
  /** `scene_compiler_version` of the manifest (the `source.compiler` ref of every node). */
  compilerVersion: number
  fonts: { faces: readonly PreviewFontFace[]; measurer: TextMeasurer }
  /** The images the scene draws, by source id (their size comes from a probe of the pinned bytes). */
  images: ReadonlyMap<string, LocalImageAsset>
  /** Live FX (`LocalPlanInputs.liveFx`): the layers' animations are compiled here (`local-animations.ts`). */
  animations?: boolean
}

export type LocalCompileResult =
  | { ok: true; ir: Record<string, unknown>; assets: LocalImageAsset[] }
  | { ok: false; reason: string }

/**
 * `compileScene` + `buildDocument` of `scene_compiler@1` for a scene whose layers are all text, rect/ellipse shapes and
 * images (see `layerIsDrawable`). Any per-layer refusal (a font outside the catalogue, a layout that does not fit, an image
 * whose size is not known yet) answers `{ ok: false }`: the server drops such a layer with a warning, the browser does not
 * guess, it waits for the server's picture.
 */
export function compileLocalScene(input: LocalCompileInput): LocalCompileResult {
  const { document, scene, fonts } = input
  const duration = scene.durationFrames
  if (duration === null) return { ok: false, reason: 'length_unresolved' }
  const canvas = document.canvas
  const source = { kind: 'typed_scene', compiler: `scene_compiler@${input.compilerVersion}` } as const
  const faces = new Map(fonts.faces.map((face) => [fontRefKey(face), face]))
  const sources = new Map((document.source_media as unknown as SourceBody[]).map((entry) => [entry.source_id, entry]))
  const used = new Map<string, LocalImageAsset>()

  type Planned = { layer: Layer; group: IrNode; content: IrNode; showAt: number | null; hideAt: number | null; opacity: number }
  const planned: Planned[] = []

  for (const layer of scene.compile) {
    const range = (layer.layer_kind === 'clip' ? (layer['placement'] as Body)['scene_range'] : layer['scene_range']) as FrameRange | undefined
    if (!range || range.start_frame < 0 || range.end_frame <= range.start_frame || range.end_frame > duration) return { ok: false, reason: 'layer_outside_scene' }
    if (!input.animations && Array.isArray(layer['animations']) && (layer['animations'] as unknown[]).length > 0) return { ok: false, reason: 'animations_not_drawn_locally' }
    const transform = layer['transform'] as { x: number; y: number; scale: number; rotation_deg: number; crop?: unknown } | undefined
    if (transform?.crop) return { ok: false, reason: 'crop_not_compiled' }

    let geometry: Geometry
    if (layer.layer_kind === 'text') {
      const style = layer['style'] as TextStyleBody
      const text = layer['text'] as string
      const face = faces.get(fontRefKey(style.font))
      if (!face) return { ok: false, reason: 'font_not_in_catalog' }
      const align = style.align === 'center' ? 'center' : style.align === 'end' ? 'right' : 'left'
      const frameWidth = Math.round(TEXT_FRAME_WIDTH_SHARE * canvas.width)
      const extras = textStyleIr(style)
      const font = { family: face.family, weight: face.weight, style: face.style, size_px: style.size_px, ...(extras.lineHeight !== undefined && { line_height: extras.lineHeight }) }
      let probe
      let final
      try {
        probe = layoutText({ text, lang: TEXT_LANGUAGE, font, box: { width: frameWidth, height: 1e6 }, align, valign: 'top', fit: { policy: 'wrap' } }, fonts.measurer)
        if (!probe.ok) return { ok: false, reason: 'text_layout_refused' }
        const height = Math.max(1, Math.ceil(probe.layout.height))
        final = layoutText({ text, lang: TEXT_LANGUAGE, font, box: { width: frameWidth, height }, align, valign: 'top', fit: { policy: 'wrap' } }, fonts.measurer)
        if (!final.ok || !sameLines(final.layout, probe.layout)) return { ok: false, reason: 'text_layout_unstable' }
        geometry = {
          width: frameWidth,
          height,
          kind: 'text',
          props: { fill: style.color, ...(extras.stroke && { stroke: extras.stroke.color }) },
          content: {
            kind: 'text',
            text,
            font: { family: face.family, weight: face.weight, size_px: style.size_px, style: face.style, ...(extras.lineHeight !== undefined && { line_height: extras.lineHeight }) },
            align,
            lang: TEXT_LANGUAGE,
            valign: 'top',
            fit: { policy: 'wrap' },
            layout: final.layout,
            ...(extras.decoration && { decoration: extras.decoration }),
            ...(extras.stroke && { stroke_width: extras.stroke.width }),
          },
        }
      } catch {
        // A face whose bytes are not loaded (or that the engine refuses) is the server's to draw.
        return { ok: false, reason: 'font_unavailable' }
      }
    } else if (layer.layer_kind === 'clip') {
      const sourceId = (layer['placement'] as { source_id: string }).source_id
      const entry = sources.get(sourceId)
      if (!entry || entry.storage_object.media_kind !== 'image') return { ok: false, reason: 'clip_media_kind_unsupported' }
      const asset = input.images.get(sourceId)
      if (!asset) return { ok: false, reason: 'image_asset_unavailable' }
      if (asset.key !== entry.storage_object.checksum_sha256) return { ok: false, reason: 'image_asset_checksum_mismatch' }
      used.set(asset.key, asset)
      const fit = Math.min(canvas.width / asset.width, canvas.height / asset.height)
      geometry = { width: q(asset.width * fit), height: q(asset.height * fit), kind: 'image', props: {}, content: { kind: 'media', media_ref: asset.key, fit: 'contain' } }
    } else if (layer.layer_kind === 'shape') {
      const shape = layer['shape'] as string
      if (shape !== 'rect' && shape !== 'ellipse') return { ok: false, reason: 'shape_not_compiled' }
      const size = layer['size'] as { width_px?: unknown; height_px?: unknown } | undefined
      const sized = size !== undefined
      const width = sized ? size.width_px : canvas.width
      const height = sized ? size.height_px : canvas.height
      if (typeof width !== 'number' || typeof height !== 'number' || !(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return { ok: false, reason: 'shape_size_invalid' }
      const requested = layer['corner_radius_px']
      const radius = shape === 'rect' && typeof requested === 'number' && Number.isFinite(requested) && requested > 0 ? q(Math.min(requested, Math.min(width, height) / 2)) : 0
      geometry = { width: q(width), height: q(height), kind: 'shape', props: { fill: layer['fill'] as string }, content: { kind: 'shape', shape, ...(radius > 0 && { corner_radius: radius }) } }
    } else {
      return { ok: false, reason: 'layer_kind_not_drawn_locally' }
    }

    const scale = transform?.scale ?? 1
    const x = transform ? transform.x : q((canvas.width - geometry.width) / 2)
    const y = transform ? transform.y : q((canvas.height - geometry.height) / 2)
    const showAt = range.start_frame > 0 ? range.start_frame : null
    const hideAt = range.end_frame < duration ? range.end_frame : null
    // Spark styling round (`layerOpacity`): the group's rest opacity, and the value its visibility window shows.
    const opacity = layerOpacity(layer)
    const restOpacity = showAt !== null ? 0 : opacity
    const group: IrNode = {
      handle: '',
      kind: 'group',
      role: layer.layer_id,
      basis: basis(layer.layer_id),
      source,
      box: { x, y, width: geometry.width, height: geometry.height },
      origin: [0, 0],
      props: { ...(scale !== 1 && { scale }), ...(restOpacity !== 1 && { opacity: restOpacity }) },
    }
    const rotation = transform?.rotation_deg ?? 0
    const content: IrNode = {
      handle: '',
      kind: geometry.kind,
      role: `${layer.layer_id}.content`,
      basis: basis(`${layer.layer_id}.content`),
      source,
      box: { x: 0, y: 0, width: geometry.width, height: geometry.height },
      props: { ...geometry.props, ...(rotation !== 0 && { rotation }) },
      content: geometry.content,
    }
    planned.push({ layer, group, content, showAt, hideAt, opacity })
  }

  // Live FX: the animations of the planned layers, resolved like the compiler resolves them (`resolveAnimations`); anything it
  // would refuse or report leaves the scene to the server.
  const plannedById = new Map(planned.map((plan) => [plan.layer.layer_id, plan]))
  const tweensOf = (layer: { layer_id: string }, resolved: ResolvedAnimation): PresetTween[] => {
    const plan = plannedById.get(layer.layer_id) as Planned
    const content = plan.content.content as { kind?: string; text?: string; lang?: string } | undefined
    return localPresetTweens({
      animation: resolved.animation,
      canvas,
      layerScale: (plan.group.props['scale'] as number | undefined) ?? 1,
      box: { width: plan.content.box.width, height: plan.content.box.height },
      restRotation: (plan.content.props['rotation'] as number | undefined) ?? 0,
      text: content?.kind === 'text' ? { text: content.text ?? '', lang: content.lang ?? TEXT_LANGUAGE } : null,
    })
  }
  let animations = new Map<string, ResolvedAnimation[]>()
  if (input.animations && hasAnimations(scene.compile)) {
    const resolved = resolveLocalAnimations(scene.compile as unknown as AnimatedLayer[], duration, { tweensOf })
    if (!resolved) return { ok: false, reason: 'animations_not_resolved_locally' }
    animations = resolved
    // `applyTextPrograms`: a text animated by scramble or count up carries the program's spec on its text node.
    for (const plan of planned) {
      const content = plan.content.content as { kind?: string; text?: string; lang?: string } | undefined
      if (content?.kind !== 'text') continue
      const program = localTextProgram(animations.get(plan.layer.layer_id) ?? [], { text: content.text ?? '', lang: content.lang ?? TEXT_LANGUAGE })
      if (program) plan.content.content = { ...content, ...program }
    }
  }

  // TK-23 canonical order: nodes in pre-order, then tracks in pre-order.
  const allocate = handleAllocator()
  const background: IrNode = {
    handle: '',
    kind: 'shape',
    role: 'scene_background',
    basis: basis('scene_background'),
    source,
    box: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    props: { fill: SCENE_BACKGROUND },
    content: { kind: 'shape', shape: 'rect' },
  }
  background.handle = allocate(background.role)
  for (const plan of planned) {
    plan.group.handle = allocate(plan.group.role)
    plan.content.handle = allocate(plan.content.role)
    plan.group.children = [plan.content]
  }
  const tracks: Array<Record<string, unknown>> = []
  for (const plan of planned) {
    const visible = `${plan.layer.layer_id}.visible`
    const window = (frame: number, value: number) => ({
      handle: allocate(visible),
      kind: 'tween',
      role: visible,
      basis: basis(visible),
      start: { rel: 'at', frame },
      targets: [plan.group.handle],
      property: 'opacity',
      from: value,
      to: value,
      ease: 'linear',
      duration_frames: 1,
      immediate_render: false,
    })
    if (plan.showAt !== null) tracks.push(window(plan.showAt, plan.opacity))
    if (plan.hideAt !== null) tracks.push(window(plan.hideAt, 0))
    for (const resolved of animations.get(plan.layer.layer_id) ?? []) {
      const { animation } = resolved
      const role = `${plan.layer.layer_id}.${animation.animation_id}`
      for (const step of tweensOf(plan.layer, resolved)) {
        // The recipes' own emission: exactly the fields the gateway's compiler writes.
        tracks.push({
          handle: allocate(role),
          kind: 'tween',
          role,
          basis: basis(role),
          start: { rel: 'at', frame: resolved.start },
          targets: [plan.content.handle],
          ...presetTrackFields(step, animation),
        })
      }
    }
  }
  const ir = {
    ir_version: MOTION_IR_VERSION,
    fps: canvas.fps.num / canvas.fps.den,
    duration_frames: duration,
    canvas: { width: canvas.width, height: canvas.height, ratio: canvas.aspect_ratio },
    seed: fnv1a32(scene.sceneId),
    source,
    style: null,
    variables: [],
    anchors: [],
    nodes: [background, ...planned.map((plan) => plan.group)],
    labels: [],
    tracks,
  }
  return { ok: true, ir, assets: [...used.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) }
}

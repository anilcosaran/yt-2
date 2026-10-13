import type { CompositionDocument, CompositionOpSpec, CompositionScene } from './composition-client'
import {
  clipReplaceSourceSpec,
  layerRemoveSpec,
  layerSetTransformSpec,
  newLayerId,
  shapeInsertSpec,
  shapeSetFillSpec,
  type CompositionSourceRange,
  type CompositionTransform,
} from './composition-typed-edits'
import { resolveSceneLength } from './scene-timing'
import { sceneLayerViews } from './stage/document-layers'
import { containFit } from './stage/geometry'
import { framesForTicks, sourceProbeOf, ticksForFrames } from './stage/placement'
import { clipInsertSequenceSpec } from './stage/stage-edits'

/**
 * E1-J scene background (QA-382): the document has NO background field. A scene's background is its bottom-most layer
 * when that layer fills the whole canvas for the whole scene, so it is built from layers that already exist and drawn by
 * preview and export alike:
 *
 * - colour = a canvas-sized `rect` shape at the bottom (`shape.insert` after nothing, i.e. sent to back);
 * - picture or video = a clip at the bottom spanning the scene (`clip.insert_sequence` after nothing), covering the
 *   canvas through its `transform` (the compiler fits media inside the canvas, so a media of another aspect gets a
 *   scale that covers it);
 * - "Replace background" = `clip.replace_source` when the new media is of the same kind (and, for a video, of the same
 *   length), otherwise the old layer is removed and the new one inserted in the same command;
 * - "Remove background" = `layer.remove`.
 *
 * Everything here is pure: the document is the input, the specs of ONE command (one undo group) are the output. The
 * server judges every op (CAS, ranges, kinds); nothing is applied locally.
 */

export type SceneBackground =
  | { kind: 'color'; layerId: string; fill: string }
  | { kind: 'image' | 'video'; layerId: string; sourceId: string; storageObjectId: string | null }

type Body = Record<string, unknown>

const EPSILON = 0.5

/** `#rgb`, `rgb`, `#rrggbb`, `rrggbb` (any case) -> `#rrggbb` lower-case; null for anything else (no alpha here). */
export function normalizeHexColor(value: string): string | null {
  const text = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    return `#${[...text].map((char) => `${char}${char}`).join('').toLowerCase()}`
  }
  return /^[0-9a-fA-F]{6}$/.test(text) ? `#${text.toLowerCase()}` : null
}

function isCanvasBox(layer: Body, canvas: { width: number; height: number }, transform: CompositionTransform | null): boolean {
  if (transform) {
    if (Math.abs(transform.x) > EPSILON || Math.abs(transform.y) > EPSILON) return false
    if (Math.abs(transform.scale - 1) > 1e-6 || transform.rotation_deg !== 0 || transform.crop) return false
  }
  // Fields the shape package (E1-B, D4) adds: a canvas-sized box without rounded corners still is the canvas.
  const size = layer['size'] as { width_px?: unknown; height_px?: unknown } | undefined
  if (size && typeof size === 'object') {
    if (typeof size.width_px !== 'number' || typeof size.height_px !== 'number') return false
    if (Math.abs(size.width_px - canvas.width) > EPSILON || Math.abs(size.height_px - canvas.height) > EPSILON) return false
  }
  const radius = layer['corner_radius_px']
  return radius === undefined || radius === 0
}

/**
 * The background of a scene, or null. Recognised: the bottom-most layer when it spans the whole (resolved) scene and
 * fills the canvas: an unmoved canvas-sized `rect` (colour), or a picture / video clip that is not shrunk, rotated or
 * cropped. A scene whose length cannot be derived has no recognisable background.
 */
export function sceneBackgroundOf(document: CompositionDocument, scene: CompositionScene): SceneBackground | null {
  const length = resolveSceneLength(document, scene)
  const bottom = sceneLayerViews(document, scene.scene_id)[0]
  if (length === null || !bottom?.range) return null
  if (bottom.range.startFrame > 0 || bottom.range.endFrame < length) return null
  const raw = scene.layers[0] as Body
  if (bottom.kind === 'shape') {
    if (bottom.shape !== 'rect' || !bottom.fill) return null
    if (!isCanvasBox(raw, document.canvas, bottom.transform)) return null
    return { kind: 'color', layerId: bottom.layerId, fill: bottom.fill }
  }
  if (bottom.kind === 'clip' && (bottom.mediaKind === 'image' || bottom.mediaKind === 'video') && bottom.sourceId) {
    const transform = bottom.transform
    if (transform) {
      if (transform.rotation_deg !== 0 || transform.crop || transform.scale < 1 - 1e-6) return null
      if (transform.x > EPSILON || transform.y > EPSILON) return null
    }
    const source = document.source_media.find((candidate) => candidate.source_id === bottom.sourceId) as Body | undefined
    const objectId = (source?.['storage_object'] as Body | undefined)?.['storage_object_id']
    return {
      kind: bottom.mediaKind,
      layerId: bottom.layerId,
      sourceId: bottom.sourceId,
      storageObjectId: typeof objectId === 'string' ? objectId : null,
    }
  }
  return null
}

/** The scene's resolved length in frames, or null while it cannot be derived (nothing is guessed). */
export function backgroundSceneFrames(document: CompositionDocument, scene: CompositionScene): number | null {
  return resolveSceneLength(document, scene)
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  // `+ 0` turns a rounded -0 into 0 (a layer never carries a negative zero).
  return Math.round(value * factor) / factor + 0
}

/**
 * The transform that makes a media of `natural` pixels COVER the canvas. The compiler (and the stage) fit media inside
 * the canvas ("contain") and scale about the box's top-left corner, so the scale is the ratio that fills the other axis
 * and the position centres the result. Null when the media already fills the canvas (same aspect ratio) or its size is
 * unknown (it then stays centred and fitted, never guessed).
 */
export function coverTransform(canvas: { width: number; height: number }, natural: { width: number; height: number } | null): CompositionTransform | null {
  if (!natural || !(natural.width > 0 && natural.height > 0)) return null
  const fit = containFit(canvas, natural.width, natural.height)
  const ratio = Math.max(canvas.width / fit.width, canvas.height / fit.height)
  if (ratio <= 1.0005) return null
  // Rounding up keeps the covered area at least the canvas.
  const scale = Math.ceil(ratio * 1e4) / 1e4
  return {
    x: round((canvas.width - fit.width * scale) / 2, 2),
    y: round((canvas.height - fit.height * scale) / 2, 2),
    scale,
    rotation_deg: 0,
  }
}

export type BackgroundRequest =
  | { kind: 'color'; fill: string }
  | { kind: 'media'; sourceId: string; naturalSize: { width: number; height: number } | null }

export type BackgroundNotice =
  /** The video was longer than the scene and was trimmed to it (seconds shown). */
  | { kind: 'videoTrimmed'; seconds: number }
  /** The video is shorter than the scene: it covers only its own length (seconds shown). */
  | { kind: 'videoShorter'; seconds: number }

export type BackgroundRefusal =
  | 'scene_missing'
  | 'scene_length_unknown'
  | 'invalid_color'
  /** A colour cannot be set while media is the background: remove the media first (it may be the scene's footage). */
  | 'media_present'
  | 'source_missing'
  | 'source_not_visual'

export type BackgroundPlan =
  | { ok: true; specs: CompositionOpSpec[]; layerId: string | null; notice: BackgroundNotice | null }
  | { ok: false; reason: BackgroundRefusal }

/** What a video of `fullFrames` does inside a scene of `length` frames: the source range to use and what to tell. */
function fitVideo(
  document: CompositionDocument,
  sourceId: string,
  length: number,
): { range: CompositionSourceRange | null; frames: number; notice: BackgroundNotice | null } | null {
  const probe = sourceProbeOf(document, sourceId)
  if (!probe) return null
  const fps = document.canvas.fps
  const seconds = (frames: number) => round((frames * fps.den) / fps.num, 1)
  const full = framesForTicks(probe.durationTicks, probe.timebase, fps)
  if (full <= length) {
    // Shorter than the scene by more than a frame: it plays its own length; the rest shows what is below / the base.
    return { range: null, frames: full, notice: length - full > 1 ? { kind: 'videoShorter', seconds: seconds(full) } : null }
  }
  // The tick count whose frame count does not exceed the scene (the tick rate may be coarser than the frame rate).
  let outTick = Math.min(probe.durationTicks, ticksForFrames(length, probe.timebase, fps))
  while (outTick > 1 && framesForTicks(outTick, probe.timebase, fps) > length) outTick -= 1
  const frames = framesForTicks(outTick, probe.timebase, fps)
  return { range: { in_tick: 0, out_tick: outTick }, frames, notice: { kind: 'videoTrimmed', seconds: seconds(frames) } }
}

/**
 * The command that makes `request` the background of `sceneId`. `uuid` mints the new layer id (the caller owns the
 * source of ids so tests are deterministic). An empty `specs` means "nothing to change" (the colour is already set).
 */
export function planBackground(input: {
  document: CompositionDocument
  sceneId: string
  request: BackgroundRequest
  uuid: () => string
}): BackgroundPlan {
  const { document, sceneId, request } = input
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  if (!scene) return { ok: false, reason: 'scene_missing' }
  const length = resolveSceneLength(document, scene)
  if (length === null) return { ok: false, reason: 'scene_length_unknown' }
  const existing = sceneBackgroundOf(document, scene)

  if (request.kind === 'color') {
    const fill = normalizeHexColor(request.fill)
    if (!fill) return { ok: false, reason: 'invalid_color' }
    if (existing && existing.kind !== 'color') return { ok: false, reason: 'media_present' }
    if (existing) {
      if (existing.fill.toLowerCase() === fill) return { ok: true, specs: [], layerId: existing.layerId, notice: null }
      return { ok: true, specs: [shapeSetFillSpec(sceneId, existing.layerId, fill)], layerId: existing.layerId, notice: null }
    }
    const layerId = newLayerId(input.uuid())
    return {
      ok: true,
      specs: [shapeInsertSpec({ sceneId, layerId, afterLayerId: null, shape: 'rect', fill, sceneRange: { start_frame: 0, end_frame: length } })],
      layerId,
      notice: null,
    }
  }

  const probe = sourceProbeOf(document, request.sourceId)
  if (!probe) return { ok: false, reason: 'source_missing' }
  if (probe.kind !== 'image' && probe.kind !== 'video') return { ok: false, reason: 'source_not_visual' }
  const transform = coverTransform(document.canvas, request.naturalSize)

  let sourceRange: CompositionSourceRange | null = null
  let frames = length
  let notice: BackgroundNotice | null = null
  if (probe.kind === 'video') {
    const fit = fitVideo(document, request.sourceId, length)
    if (!fit) return { ok: false, reason: 'source_missing' }
    sourceRange = fit.range
    frames = fit.frames
    notice = fit.notice
  }

  // Same kind (and the same length for a video): the layer keeps its place, timing and animations.
  if (existing && existing.kind !== 'color' && existing.kind === probe.kind) {
    const view = sceneLayerViews(document, sceneId)[0]
    const oldFrames = view?.range ? view.range.endFrame - view.range.startFrame : null
    if (probe.kind === 'image' || oldFrames === frames) {
      const range: CompositionSourceRange = sourceRange ?? { in_tick: 0, out_tick: probe.durationTicks }
      return {
        ok: true,
        specs: [
          clipReplaceSourceSpec({ sceneId, layerId: existing.layerId, sourceId: request.sourceId, sourceRange: range }),
          // The new media may have another aspect ratio: the transform follows it (cleared when it already fits).
          layerSetTransformSpec(sceneId, existing.layerId, transform),
        ],
        layerId: existing.layerId,
        notice,
      }
    }
  }

  const layerId = newLayerId(input.uuid())
  const insert = clipInsertSequenceSpec({
    sceneId,
    afterLayerId: null,
    startFrame: 0,
    ...(probe.kind === 'image' && { imageHoldFrames: length }),
    items: [{ layerId, sourceId: request.sourceId, ...(sourceRange && { sourceRange }) }],
  })
  return {
    ok: true,
    specs: [
      ...(existing ? [layerRemoveSpec(sceneId, existing.layerId)] : []),
      insert,
      ...(transform ? [layerSetTransformSpec(sceneId, layerId, transform)] : []),
    ],
    layerId,
    notice,
  }
}

/** "Remove background": the layer that is the background goes (one command); nothing when there is none. */
export function removeBackgroundSpecs(document: CompositionDocument, sceneId: string): CompositionOpSpec[] {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  const existing = scene ? sceneBackgroundOf(document, scene) : null
  return existing ? [layerRemoveSpec(sceneId, existing.layerId)] : []
}

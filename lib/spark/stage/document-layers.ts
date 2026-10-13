import { orderedScenes, type CompositionDocument, type CompositionScene } from '../composition-client'
import type { CompositionFontRef, CompositionTextAlign, CompositionTransform } from '../composition-typed-edits'
import type { StageLayerKind } from './stage-types'

/**
 * The layers of a scene as the stage edits them: a typed read of the working copy's passthrough layer bodies
 * (`composition_document_v1`: text, shape, clip, Motion instance, pending slot). The working copy stays the only
 * authority for values (text, style, transform, range); the compiled IR only supplies geometry the layout produced.
 */

export type StageLayerView = {
  layerId: string
  sceneId: string
  kind: StageLayerKind
  /** Index in `scene.layers`: paint order (higher paints over lower). */
  zIndex: number
  rev: number
  /** Scene-local half-open frame range the layer is visible in; null when the body carries none. */
  range: { startFrame: number; endFrame: number } | null
  transform: CompositionTransform | null
  /** Text layers. */
  text?: string
  style?: StageTextStyle
  /** Spark styling round: the layer's stored opacity (0-1); absent = opaque. Text, shape and image layers. */
  opacity?: number
  /** Spark styling round: the editor's UI lock (the stage neither selects nor drags the layer). */
  locked?: boolean
  /** Shape layers. */
  shape?: string
  fill?: string
  /** Shape layers (E1-B, D4): the stored box in canvas pixels; absent = the canvas-sized box of the first document v1. */
  size?: { widthPx: number; heightPx: number }
  /** Shape layers (E1-B, D4): the stored corner radius of a `rect` in canvas pixels; absent = square corners. */
  cornerRadiusPx?: number
  /** Clip layers: the project source and what it is. */
  sourceId?: string
  mediaKind?: 'image' | 'video' | 'audio' | null
  /** The clip's stored audio setting (`audio` of the layer body); absent = the source's own level, not muted. */
  audio?: { gainDb: number; muted: boolean }
  /** Whether the clip's source has an audio track (probe `audio_channels`); unknown when the probe is missing. */
  sourceHasAudio?: boolean
}

/** A text layer's style as the stage edits it (camelCase of `TextLayer.style`). */
export type StageTextStyle = {
  font: CompositionFontRef
  sizePx: number
  color: string
  align?: CompositionTextAlign
  /** Spark styling round: line spacing as a multiple of the size; absent = the face's own line height. */
  lineHeight?: number
  /** Spark styling round: underline / strikethrough; absent = none. */
  decoration?: { underline: boolean; strikethrough: boolean }
  /** Spark styling round: the outline; absent = none. */
  stroke?: { color: string; widthPx: number }
}

type Body = Record<string, unknown>

function rangeOf(value: unknown): { startFrame: number; endFrame: number } | null {
  if (!value || typeof value !== 'object') return null
  const { start_frame: start, end_frame: end } = value as Record<string, unknown>
  return typeof start === 'number' && typeof end === 'number' && end > start ? { startFrame: start, endFrame: end } : null
}

function transformOf(value: unknown): CompositionTransform | null {
  if (!value || typeof value !== 'object') return null
  const { x, y, scale, rotation_deg: rotation } = value as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number' || typeof rotation !== 'number') return null
  const crop = (value as { crop?: CompositionTransform['crop'] }).crop
  return { x, y, scale, rotation_deg: rotation, ...(crop && { crop }) }
}

function shapeSizeOf(value: unknown): StageLayerView['size'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { width_px: width, height_px: height } = value as Record<string, unknown>
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 ? { widthPx: width, heightPx: height } : undefined
}

function styleOf(value: unknown): StageLayerView['style'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { font, size_px: size, color, align, line_height: lineHeight, text_decoration: decoration, stroke } = value as Record<string, unknown>
  if (!font || typeof font !== 'object' || typeof size !== 'number' || typeof color !== 'string') return undefined
  const ref = font as Record<string, unknown>
  if (typeof ref['font_id'] !== 'string' || typeof ref['font_revision'] !== 'string' || typeof ref['sha256'] !== 'string') return undefined
  const lines = decoration && typeof decoration === 'object' ? (decoration as Record<string, unknown>) : null
  const outline = stroke && typeof stroke === 'object' ? (stroke as Record<string, unknown>) : null
  return {
    font: { font_id: ref['font_id'], font_revision: ref['font_revision'], sha256: ref['sha256'] },
    sizePx: size,
    color,
    ...(align === 'start' || align === 'center' || align === 'end' ? { align } : {}),
    ...(typeof lineHeight === 'number' && Number.isFinite(lineHeight) && { lineHeight }),
    ...(lines && (lines['underline'] === true || lines['strikethrough'] === true) && {
      decoration: { underline: lines['underline'] === true, strikethrough: lines['strikethrough'] === true },
    }),
    ...(outline && typeof outline['color'] === 'string' && typeof outline['width_px'] === 'number' && {
      stroke: { color: outline['color'], widthPx: outline['width_px'] },
    }),
  }
}

function sourceOf(document: CompositionDocument, sourceId: string): Body | undefined {
  return document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
}

function mediaKindOf(document: CompositionDocument, sourceId: string): StageLayerView['mediaKind'] {
  const kind = (sourceOf(document, sourceId)?.['storage_object'] as Body | undefined)?.['media_kind']
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null
}

function sourceHasAudio(document: CompositionDocument, sourceId: string): boolean | undefined {
  const channels = (sourceOf(document, sourceId)?.['probe'] as Body | undefined)?.['audio_channels']
  return typeof channels === 'number' ? channels > 0 : undefined
}

function audioOf(value: unknown): StageLayerView['audio'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { gain_db: gain, muted } = value as Record<string, unknown>
  if (gain === undefined && muted === undefined) return undefined
  return { gainDb: typeof gain === 'number' ? gain : 0, muted: muted === true }
}

function viewOf(document: CompositionDocument, scene: CompositionScene, index: number): StageLayerView {
  const body = scene.layers[index] as Body
  const kind = body['layer_kind'] as StageLayerKind
  const opacity = body['opacity']
  const base: StageLayerView = {
    layerId: scene.layers[index]!.layer_id,
    sceneId: scene.scene_id,
    kind,
    zIndex: index,
    rev: scene.layers[index]!.rev,
    range: rangeOf(kind === 'clip' ? (body['placement'] as Body | undefined)?.['scene_range'] : body['scene_range']),
    transform: transformOf(body['transform']),
    ...(typeof opacity === 'number' && Number.isFinite(opacity) && opacity >= 0 && opacity < 1 && { opacity }),
    ...(body['locked'] === true && { locked: true }),
  }
  if (kind === 'text') {
    return { ...base, ...(typeof body['text'] === 'string' && { text: body['text'] }), ...(styleOf(body['style']) && { style: styleOf(body['style'])! }) }
  }
  if (kind === 'shape') {
    const size = shapeSizeOf(body['size'])
    const radius = body['corner_radius_px']
    return {
      ...base,
      ...(typeof body['shape'] === 'string' && { shape: body['shape'] }),
      ...(typeof body['fill'] === 'string' && { fill: body['fill'] }),
      ...(size && { size }),
      ...(typeof radius === 'number' && Number.isFinite(radius) && { cornerRadiusPx: radius }),
    }
  }
  if (kind === 'clip') {
    const sourceId = (body['placement'] as Body | undefined)?.['source_id']
    if (typeof sourceId !== 'string') return base
    const hasAudio = sourceHasAudio(document, sourceId)
    const audio = audioOf(body['audio'])
    return { ...base, sourceId, mediaKind: mediaKindOf(document, sourceId), ...(audio && { audio }), ...(hasAudio !== undefined && { sourceHasAudio: hasAudio }) }
  }
  return base
}

/** The layers of one scene in paint order (bottom first). */
export function sceneLayerViews(document: CompositionDocument | null, sceneId: string | null): StageLayerView[] {
  if (!document || !sceneId) return []
  const scene = orderedScenes(document).find((candidate) => candidate.scene_id === sceneId)
  return scene ? scene.layers.map((_, index) => viewOf(document, scene, index)) : []
}

export function layerViewOf(document: CompositionDocument | null, sceneId: string | null, layerId: string): StageLayerView | null {
  return sceneLayerViews(document, sceneId).find((view) => view.layerId === layerId) ?? null
}

/** Video clips are drawn by the stage itself (`<video>`), not by the runtime. */
export const isNativeVideoLayer = (view: StageLayerView): boolean => view.kind === 'clip' && view.mediaKind === 'video'

/** Whether a layer is visible at a scene-local frame (its half-open range; a layer without a range always is). */
export function layerVisibleAt(view: StageLayerView, localFrame: number): boolean {
  return view.range === null || (localFrame >= view.range.startFrame && localFrame < view.range.endFrame)
}

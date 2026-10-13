import { orderedScenes, type CompositionDocument } from './composition-client'
import { framesToSeconds } from './scene-timing'

/**
 * Element selection of the Spark editor (QA-068 / QA-081): which text layer the user picked. Local view state
 * only — never a command and never stored in the browser. The canvas does not draw layers yet, so a text layer
 * is picked from its block in the expanded timeline; the selection is resolved against the working copy each
 * time it is used, so a deleted or changed layer never becomes a silent wrong target.
 */

export type SparkElementSelection = { sceneId: string; layerId: string }

/** A native text layer as the editor shows it: its scene, the scene's strip number and its current text. */
export type SparkTextLayerView = SparkElementSelection & { sceneNumber: number; text: string }

/** The text layer `selection` names in `document`, or null when it is gone or is not a text layer. */
export function textLayerView(document: CompositionDocument | null, selection: SparkElementSelection | null): SparkTextLayerView | null {
  if (!document || !selection) return null
  const scenes = orderedScenes(document)
  const index = scenes.findIndex((scene) => scene.scene_id === selection.sceneId)
  const scene = scenes[index]
  const layer = scene?.layers.find((candidate) => candidate.layer_id === selection.layerId)
  if (!scene || !layer || layer.layer_kind !== 'text') return null
  const text = (layer as Record<string, unknown>).text
  if (typeof text !== 'string' || text.length === 0) return null
  return { sceneId: scene.scene_id, layerId: layer.layer_id, sceneNumber: index + 1, text }
}

/**
 * Y1-07 W8: what the canvas / timeline selected, and what "Ask AI" needs. Frames are absolute project frames (end
 * exclusive). `layerIds = []` means "the scene as a whole". The names are the interface `handoff-y1/editor-interfaces.md`
 * section 6 published to the stage package; a `StageSelection` of the stage satisfies `SparkCanvasSelection` as is.
 */
export type SparkFrameRange = { startFrame: number; endFrame: number }

export type SparkCanvasSelection = {
  sceneId: string
  layerIds: readonly string[]
  timeRange: SparkFrameRange | null
}

export type SparkAskAiTarget = {
  selection: SparkCanvasSelection | null
  /** The REAL playhead (absolute project frame) at the moment of the click. */
  playheadFrame: number
}

export type SparkAskAi = (target: SparkAskAiTarget) => void

/**
 * What the shell reads for the real playhead of every chat message. Structurally the reader the stage's playback store
 * exports; declared here so the shell does not import the stage.
 */
export type SparkPlaybackSnapshot = { playing: boolean; frame: number }
export type SparkPlaybackReader = { getSnapshot(): SparkPlaybackSnapshot; subscribe(listener: () => void): () => void }

/** At most this many layers travel in one message (the contract's `selection.layer_ids` bound). */
export const MAX_ASK_AI_LAYERS = 16

/**
 * A selection resolved against the working copy the user sees: a vanished scene drops the whole selection, a vanished
 * layer is dropped, ids are unique and bounded, an invalid range is dropped. A deleted layer therefore never becomes a
 * silent wrong target (the server resolves every id again against `base_revision`, K242).
 */
export function resolveCanvasSelection(document: CompositionDocument | null, selection: SparkCanvasSelection | null): SparkCanvasSelection | null {
  if (!document || !selection) return null
  const scene = document.scenes.find((candidate) => candidate.scene_id === selection.sceneId)
  if (!scene) return null
  const present = new Set(scene.layers.map((layer) => layer.layer_id))
  const layerIds = [...new Set(selection.layerIds)].filter((id) => present.has(id)).slice(0, MAX_ASK_AI_LAYERS)
  return { sceneId: scene.scene_id, layerIds, timeRange: normalizeFrameRange(selection.timeRange) }
}

/** A marked range the contract accepts (integer frames, start >= 0, end after start), or null. */
export function normalizeFrameRange(range: SparkFrameRange | null | undefined): SparkFrameRange | null {
  return range && Number.isSafeInteger(range.startFrame) && Number.isSafeInteger(range.endFrame)
    && range.startFrame >= 0 && range.endFrame > range.startFrame
    ? { startFrame: range.startFrame, endFrame: range.endFrame }
    : null
}

export type SparkLayerChipKind = 'text' | 'shape' | 'image' | 'video' | 'motion' | 'slot'

/** One selected layer as the composer chip shows it: its kind and (for text) a short label. */
export type SparkLayerChip = { layerId: string; kind: SparkLayerChipKind; label: string | null }

/** The layers of `selection` as chips, in selection order; ids that are not layers of the scene are skipped. */
export function layerChipsOf(document: CompositionDocument | null, selection: SparkCanvasSelection | null): SparkLayerChip[] {
  const resolved = resolveCanvasSelection(document, selection)
  if (!document || !resolved) return []
  const scene = document.scenes.find((candidate) => candidate.scene_id === resolved.sceneId)
  const chips: SparkLayerChip[] = []
  for (const id of resolved.layerIds) {
    const layer = scene?.layers.find((candidate) => candidate.layer_id === id)
    if (!layer) continue
    chips.push({ layerId: id, ...chipKindOf(document, layer as Record<string, unknown> & { layer_kind: string }) })
  }
  return chips
}

function chipKindOf(
  document: CompositionDocument,
  layer: Record<string, unknown> & { layer_kind: string },
): { kind: SparkLayerChipKind; label: string | null } {
  switch (layer.layer_kind) {
    case 'text': {
      const text = layer.text
      return { kind: 'text', label: typeof text === 'string' && text.length > 0 ? shortText(text) : null }
    }
    case 'shape':
      return { kind: 'shape', label: null }
    case 'motion_instance':
      return { kind: 'motion', label: null }
    case 'pending_slot':
      return { kind: 'slot', label: null }
    default: {
      const placement = layer.placement
      const sourceId = placement && typeof placement === 'object' ? (placement as Record<string, unknown>).source_id : undefined
      const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as
        | { storage_object?: { media_kind?: string } }
        | undefined
      return { kind: source?.storage_object?.media_kind === 'image' ? 'image' : 'video', label: null }
    }
  }
}

/** "0:04–0:07" for a marked range: m:ss of the start and of the end, on the project's frame rate. */
export function formatFrameRangeLabel(fps: { num: number; den: number }, range: SparkFrameRange): string {
  const clock = (frames: number) => {
    const seconds = Math.max(0, Math.floor(framesToSeconds(fps, frames)))
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }
  return `${clock(range.startFrame)}–${clock(range.endFrame)}`
}

/** The strip number of a scene (1-based), or null when the scene is not in the strip. */
export function sceneNumberOf(document: CompositionDocument | null, sceneId: string | null): number | null {
  if (!document || !sceneId) return null
  const index = orderedScenes(document).findIndex((scene) => scene.scene_id === sceneId)
  return index === -1 ? null : index + 1
}

/** A short one-line label of a text for chips and card titles (the full text stays in the diff). */
export function shortText(text: string, maxLength = 32): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > maxLength ? `${line.slice(0, maxLength - 1).trimEnd()}…` : line
}

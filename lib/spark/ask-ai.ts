import type { CompositionDocument } from './composition-client'
import { sceneFrameRange } from './composition-typed-edits'
import {
  normalizeFrameRange,
  resolveCanvasSelection,
  textLayerView,
  type SparkAskAiTarget,
  type SparkElementSelection,
  type SparkFrameRange,
  type SparkPlaybackReader,
} from './spark-selection'

/**
 * Y1-07 W8: the state "Ask AI" adds to the next chat message next to the scene the user picked. Local view state (never
 * stored, never a command): the layers and the marked range of the selection and the playhead of the click. The shell
 * keeps one value of this type; everything that changes it is a pure function here so it is tested without a DOM.
 */
export type SparkAskAiState = {
  layerIds: readonly string[]
  timeRange: SparkFrameRange | null
  /** The playhead of the click; used for the message when the editor has no live playback clock. */
  playheadFrame: number | null
}

export type SparkAskAiPlan = {
  /** The scene the message is about, or null when the target carries no (valid) selection. */
  sceneId: string | null
  /** A single selected text layer is also the quick lane's focus (chip + "Rewrite with AI" button). */
  focusText: SparkElementSelection | null
  state: SparkAskAiState
}

/**
 * What a click on "Ask AI" does to the editor state. The selection is resolved against the working copy the user sees:
 * a vanished scene or layer is dropped, never kept as a silent wrong target (the server resolves every id again against
 * `base_revision`, K242).
 */
export function planAskAi(document: CompositionDocument | null, target: SparkAskAiTarget): SparkAskAiPlan {
  const selection = resolveCanvasSelection(document, target.selection)
  if (!selection) return { sceneId: null, focusText: null, state: { layerIds: [], timeRange: null, playheadFrame: target.playheadFrame } }
  const onlyLayerId = selection.layerIds.length === 1 ? selection.layerIds[0]! : null
  const text = onlyLayerId ? textLayerView(document, { sceneId: selection.sceneId, layerId: onlyLayerId }) : null
  return {
    sceneId: selection.sceneId,
    focusText: text ? { sceneId: text.sceneId, layerId: text.layerId } : null,
    state: { layerIds: selection.layerIds, timeRange: selection.timeRange, playheadFrame: target.playheadFrame },
  }
}

/**
 * The layers of the next message: the focused text plus the layers Ask AI added, only while the message is about a
 * scene (layers mean nothing outside one).
 */
export function chatLayerIdsOf(chatSceneId: string | null, focusedTextLayerId: string | null, state: SparkAskAiState | null): string[] {
  if (!chatSceneId) return []
  return [...new Set([...(focusedTextLayerId ? [focusedTextLayerId] : []), ...(state?.layerIds ?? [])])]
}

/** The marked range of the next message, or null. */
export function chatTimeRangeOf(state: SparkAskAiState | null): SparkFrameRange | null {
  return normalizeFrameRange(state?.timeRange)
}

/**
 * The playhead of a message. With a live playback clock it is the clock's CURRENT frame (the user may have played on
 * since the click); without one, the frame of the last "Ask AI" click, else null (the context builder then falls back to
 * the start of the selected scene).
 */
export function chatPlayheadOf(playback: SparkPlaybackReader | undefined, state: SparkAskAiState | null, document: CompositionDocument | null, sceneId: string | null): number | null {
  if (playback) {
    const frame = playback.getSnapshot().frame
    if (Number.isSafeInteger(frame) && frame >= 0) return frame
    return sceneId && document ? (sceneFrameRange(document, sceneId)?.start_frame ?? null) : null
  }
  return state?.playheadFrame ?? null
}

/** The playhead to hand to `askAi` for a timeline block menu click: the live frame, else the start of the scene. */
export function playheadForScene(playback: SparkPlaybackReader | undefined, document: CompositionDocument | null, sceneId: string): number {
  const frame = playback?.getSnapshot().frame
  if (typeof frame === 'number' && Number.isSafeInteger(frame) && frame >= 0) return frame
  return document ? (sceneFrameRange(document, sceneId)?.start_frame ?? 0) : 0
}

/** `state` without `layerIds` (a removed chip); the other parts stay. */
export function withoutLayers(state: SparkAskAiState | null, layerIds: readonly string[]): SparkAskAiState | null {
  return state ? { ...state, layerIds: state.layerIds.filter((id) => !layerIds.includes(id)) } : state
}

/** `state` without its marked range (the range chip's remove button). */
export function withoutTimeRange(state: SparkAskAiState | null): SparkAskAiState | null {
  return state ? { ...state, timeRange: null } : state
}

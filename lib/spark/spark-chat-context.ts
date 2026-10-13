import type { ComposerSparkContext } from '@/lib/assistant/composer/message-context'

import type { CompositionDocument } from './composition-client'
import { sceneFrameRange } from './composition-typed-edits'
import { normalizeFrameRange, resolveCanvasSelection, type SparkFrameRange } from './spark-selection'

/**
 * P03-07: the workspace snapshot every Spark Chat message carries (`assistant_message_context_v1`,
 * surface `spark_chat`). `surface_context` names the project and the working copy version the user saw;
 * `edit_context` (P00-13 EditContext, motion-spark/v1) adds the playhead and the selection made on that
 * same version. It is a hint for binding, never a grant: the server resolves the selection against
 * `base_revision` and an intervening reorder/delete is a conflict, not a silent wrong-target edit.
 */
export type SparkEditContext = {
  project_id: string
  base_revision: number
  playhead_frame: number
  /** `layer_ids` (Y1-07 W8, additive): the layers selected inside `scene_id`; absent = the scene as a whole. */
  selection?: { scene_id: string; layer_ids?: string[] }
  /** The span the user marked on the timeline (project frames, end exclusive). */
  time_range?: { start_frame: number; end_frame: number }
  locale?: string
}

export type SparkMessageContext = {
  surface: 'spark_chat'
  surface_context: {
    project_id: string
    seen_working_copy_version: number
    edit_context: SparkEditContext
  }
}

export function buildSparkMessageContext(input: {
  projectId: string
  workingCopyVersion: number
  document: CompositionDocument | null
  selectedSceneId: string | null
  /** Y1-07 W8: layers selected on the canvas inside the selected scene (resolved against the document; max 16). */
  layerIds?: readonly string[]
  /** Y1-07 W8: the span the user marked (absolute project frames, end exclusive). */
  timeRange?: SparkFrameRange | null
  /**
   * Y1-07 W8: the real playhead (absolute project frame) when the editor has playback. Without it the playhead is the
   * start of the selected scene, as before.
   */
  playheadFrame?: number | null
  locale?: string | null
}): SparkMessageContext {
  const selected = input.selectedSceneId && input.document?.scenes.some((scene) => scene.scene_id === input.selectedSceneId)
    ? input.selectedSceneId
    : null
  // Layers and the range are resolved against the working copy the message says it saw: a layer that is gone is
  // dropped, never sent as a stale target. Layers only mean something inside a scene.
  const layerIds = selected
    ? (resolveCanvasSelection(input.document, { sceneId: selected, layerIds: input.layerIds ?? [], timeRange: null })?.layerIds ?? [])
    : []
  const markedRange = normalizeFrameRange(input.timeRange)
  // Without a real playhead the editor's playhead sits on the selected scene's start; an unknown position (a
  // follow_media scene before it) or no selection is the start of the timeline.
  const range = selected && input.document ? sceneFrameRange(input.document, selected) : null
  const real = input.playheadFrame
  const playhead = typeof real === 'number' && Number.isSafeInteger(real) && real >= 0 ? real : (range?.start_frame ?? 0)
  const locale = input.locale && input.locale.length >= 2 && input.locale.length <= 35 ? input.locale : undefined
  return {
    surface: 'spark_chat',
    surface_context: {
      project_id: input.projectId,
      seen_working_copy_version: input.workingCopyVersion,
      edit_context: {
        project_id: input.projectId,
        base_revision: input.workingCopyVersion,
        playhead_frame: playhead,
        ...(selected && { selection: { scene_id: selected, ...(layerIds.length > 0 && { layer_ids: [...layerIds] }) } }),
        ...(markedRange && { time_range: { start_frame: markedRange.startFrame, end_frame: markedRange.endFrame } }),
        ...(locale && { locale }),
      },
    },
  }
}

/**
 * The same snapshot as the P03-01 composer's `sparkContext` (Spark Chat submit): the composer puts the project and the
 * seen version into `surface_context` and attaches this EditContext (P03-07) — never recomputed from the text.
 */
export function sparkComposerContext(context: SparkMessageContext): ComposerSparkContext {
  return {
    projectId: context.surface_context.project_id,
    seenWorkingCopyVersion: context.surface_context.seen_working_copy_version,
    editContext: context.surface_context.edit_context,
  }
}

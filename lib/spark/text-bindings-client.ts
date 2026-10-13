import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-08 text bindings (`/api/v1/composition-text-bindings`): what editing each text of a Spark project means before
 * anything is sent — transcript words are cut/corrected (audio unchanged by a correction; no overdub), narration text is
 * a script revision whose audio becomes dirty (new audio is a separate paid request), captions highlight words only
 * with real word timing — and where every word anchor plays now. Server state only; no browser storage.
 */

const refSchema = z.object({ artifact_kind: z.string(), artifact_id: z.string(), artifact_revision: z.number().int() })

const viewSchema = z.object({
  schema: z.literal('composition_text_bindings_view_v1'),
  project_id: z.string(),
  transcripts: z.array(z.object({
    source_id: z.string(),
    status: z.enum(['ready', 'no_transcript']),
    head: refSchema.nullable(),
    base: refSchema.nullable(),
    caption_track_ids: z.array(z.string()),
    edits: z.object({ delete_words: z.literal('cut_source_range'), rewrite_word: z.literal('transcript_correction'), new_spoken_words: z.literal('unsupported_overdub') }),
    word_timing: z.enum(['recognized_word_timing', 'unavailable']),
  })),
  narrations: z.array(z.object({
    scene_id: z.string(),
    script: refSchema,
    beat_ids: z.array(z.string()),
    narration_placement_ids: z.array(z.string()),
    edits: z.object({ rewrite_text: z.literal('script_revision_marks_audio_dirty'), regenerate_audio: z.literal('explicit_paid_request') }),
    word_timing: z.literal('alignment_required'),
  })),
  captions: z.array(z.object({
    caption_track_id: z.string(),
    source: refSchema,
    source_kind: z.enum(['transcript', 'script']),
    text_edit: z.enum(['transcript_correction', 'script_edit_without_audio_regeneration']),
    word_highlight: z.object({ available: z.boolean(), reason: z.enum(['recognized_word_timing', 'alignment_required']) }),
  })),
  anchors: z.array(z.object({
    scene_id: z.string(),
    layer_id: z.string(),
    animation_id: z.string(),
    ref: refSchema,
    word_id: z.string(),
    offset_frames: z.number().int(),
    status: z.enum(['resolved', 'unresolved']),
    frame: z.number().int().nullable(),
    reason: z.string(),
  })),
})
export type TextBindingsView = z.output<typeof viewSchema>

export async function getTextBindings(projectId: string, options: { signal?: AbortSignal } = {}): Promise<TextBindingsView> {
  const response = await gatewayRequest(`/api/v1/composition-text-bindings/projects/${encodeURIComponent(projectId)}`, {
    schema: z.object({ data: viewSchema }),
    signal: options.signal,
  })
  return response.data
}

/** Anchors a preview must warn about (and a final render cannot start with). */
export function unresolvedWordAnchors(view: TextBindingsView) {
  return view.anchors.filter((anchor) => anchor.status === 'unresolved')
}

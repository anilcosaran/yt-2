import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-33 uploaded video (`/api/v1/composition-upload-edits`): the `Bu video için` card, the split suggestion review and
 * its accept, the source transcript, word corrections and text cuts. Server state only: the card's dismissed/`Ekran
 * kaydı` state, the transcript revision and every edit are read back from the gateway; nothing is kept in browser
 * storage. A 409 (stale suggestion or transcript head) means: re-read and show the fresh review.
 */

export const uploadActions = [
  'extract_transcript',
  'split_scenes',
  'find_steps',
  'find_shots',
  'split_chapters',
  'find_silences',
  'add_captions',
  'edit_video',
  'each_file_as_scene',
] as const
export type UploadAction = (typeof uploadActions)[number]

const transcriptRefSchema = z.object({
  artifact_kind: z.literal('transcript'),
  artifact_id: z.string(),
  artifact_revision: z.number().int(),
})
export type TranscriptRef = z.output<typeof transcriptRefSchema>

const cardSchema = z.object({
  schema: z.literal('composition_upload_suggestion_card_v1'),
  project_id: z.string(),
  source_id: z.string(),
  classification: z.object({
    profile: z.string(),
    video_class: z.string(),
    actions: z.array(z.object({
      action: z.enum(uploadActions),
      availability: z.enum(['ready', 'needs_transcript', 'signal_unavailable']),
      route: z.enum(['chat_request', 'split_review', 'recipe_review', 'sequence_command']),
      may_cost: z.boolean(),
    })),
    suggested_timeline_density: z.enum(['current', 'expanded']),
    reasons: z.array(z.string()),
  }).passthrough(),
  signals: z.object({ duration_seconds: z.number(), transcript_ready: z.boolean(), captions_bound: z.boolean() }).passthrough(),
  transcript: transcriptRefSchema.nullable(),
  dismissed: z.boolean(),
})
export type UploadSuggestionCard = z.output<typeof cardSchema>

const cutSchema = z.object({
  cut_id: z.string(),
  after_word_id: z.string(),
  before_word_id: z.string(),
  source_seconds: z.number(),
  scene_frame: z.number().int(),
  pause_seconds: z.number(),
  reason: z.enum(['sentence_end_pause', 'paragraph_pause']),
  preview: z.object({ before: z.string(), after: z.string() }),
  enabled: z.boolean(),
}).passthrough()

const suggestionSchema = z.object({
  schema: z.literal('composition_split_suggestion_v1'),
  kind: z.enum(['scenes', 'chapters']),
  sensitivity: z.enum(['low', 'balanced', 'high']),
  source_id: z.string(),
  scene_id: z.string(),
  layer_id: z.string(),
  transcript: transcriptRefSchema,
  cuts: z.array(cutSchema),
  parts: z.array(z.object({ start_seconds: z.number(), end_seconds: z.number(), duration_seconds: z.number(), exceeds_max: z.boolean() }).passthrough()),
  empty_reason: z.string().nullable(),
  suggestion_sha256: z.string(),
}).passthrough()
export type SplitSuggestion = z.output<typeof suggestionSchema>
export type SplitSensitivity = SplitSuggestion['sensitivity']

const receiptSchema = z.object({ command_id: z.string(), undo_group_id: z.string().nullable(), working_copy_version: z.number().int() }).passthrough()

const acceptSchema = z.object({
  receipt: receiptSchema,
  applied_cut_ids: z.array(z.string()),
  scene_ids: z.array(z.string()),
  section_ids: z.array(z.string()),
})

const transcriptWordSchema = z.object({
  word_id: z.string(),
  index: z.number().int(),
  text: z.string(),
  recognized_text: z.string().optional(),
  start_seconds: z.number(),
  end_seconds: z.number(),
  status: z.enum(['on_timeline', 'partially_on_timeline', 'not_on_timeline']),
  timeline: z.array(z.object({ scene_id: z.string(), layer_id: z.string(), start_frame: z.number().int(), end_frame: z.number().int() })),
})
export type SourceTranscriptWord = z.output<typeof transcriptWordSchema>

const transcriptSchema = z.object({
  schema: z.literal('composition_source_transcript_view_v1'),
  head: transcriptRefSchema,
  base: transcriptRefSchema,
  language: z.string().nullable(),
  word_count: z.number().int(),
  page: z.object({ from_word: z.number().int(), limit: z.number().int(), next_from_word: z.number().int().nullable() }),
  words: z.array(transcriptWordSchema),
  caption_track_ids: z.array(z.string()),
  timeline_status: z.enum(['mapped', 'scene_timing_unresolved', 'source_not_on_timeline']),
}).passthrough()
export type SourceTranscript = z.output<typeof transcriptSchema>

const correctionSchema = z.object({
  action: z.enum(['corrected', 'unchanged']),
  head: transcriptRefSchema,
  changed_word_ids: z.array(z.string()),
  rebound_caption_track_ids: z.array(z.string()),
  receipt: receiptSchema.nullable(),
})

const cutResultSchema = z.object({
  receipt: receiptSchema,
  word_ids: z.array(z.string()),
  removed_ranges: z.array(z.object({ start_seconds: z.number(), end_seconds: z.number() })),
  moved: z.array(z.object({ entity_kind: z.enum(['layer', 'audio']), entity_id: z.string(), from_frame: z.number().int(), to_frame: z.number().int() })),
})

const envelope = <S extends z.ZodTypeAny>(schema: S) => z.object({ data: schema })
const base = (projectId: string, sourceId: string) =>
  `/api/v1/composition-upload-edits/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}`

export async function getUploadSuggestionCard(
  projectId: string,
  sourceId: string,
  options: { batchSourceIds?: string[]; signal?: AbortSignal } = {},
): Promise<UploadSuggestionCard> {
  const query = options.batchSourceIds && options.batchSourceIds.length > 0 ? `?${new URLSearchParams({ batch: options.batchSourceIds.join(',') }).toString()}` : ''
  const response = await gatewayRequest(`${base(projectId, sourceId)}/card${query}`, { schema: envelope(cardSchema), signal: options.signal })
  return response.data
}

export async function setUploadSuggestionState(
  projectId: string,
  sourceId: string,
  state: { dismissed?: boolean; markedScreenRecording?: boolean },
  options: { signal?: AbortSignal } = {},
): Promise<UploadSuggestionCard> {
  const response = await gatewayRequest(`${base(projectId, sourceId)}/card`, {
    method: 'POST',
    csrf: true,
    body: {
      ...(state.dismissed !== undefined && { dismissed: state.dismissed }),
      ...(state.markedScreenRecording !== undefined && { marked_screen_recording: state.markedScreenRecording }),
    },
    schema: envelope(cardSchema),
    signal: options.signal,
  })
  return response.data
}

export async function getSplitSuggestion(
  projectId: string,
  sourceId: string,
  request: { kind: 'scenes' | 'chapters'; sensitivity: SplitSensitivity; layerId?: string },
  options: { signal?: AbortSignal } = {},
): Promise<SplitSuggestion> {
  const params = new URLSearchParams({ kind: request.kind, sensitivity: request.sensitivity })
  if (request.layerId) params.set('layer_id', request.layerId)
  const response = await gatewayRequest(`${base(projectId, sourceId)}/split-suggestion?${params.toString()}`, {
    schema: envelope(suggestionSchema),
    signal: options.signal,
  })
  return response.data
}

/** Accepts exactly the reviewed suggestion minus the cuts the user switched off (one command, one undo). */
export async function acceptSplitSuggestion(
  projectId: string,
  suggestion: Pick<SplitSuggestion, 'source_id' | 'kind' | 'sensitivity' | 'layer_id' | 'suggestion_sha256'>,
  input: { disabledCutIds: string[]; sectionTitles?: string[]; idempotencyKey: string },
  options: { signal?: AbortSignal } = {},
) {
  const response = await gatewayRequest(`${base(projectId, suggestion.source_id)}/split-suggestion/accept`, {
    method: 'POST',
    csrf: true,
    body: {
      kind: suggestion.kind,
      sensitivity: suggestion.sensitivity,
      layer_id: suggestion.layer_id,
      expected_suggestion_sha256: suggestion.suggestion_sha256,
      disabled_cut_ids: input.disabledCutIds,
      ...(input.sectionTitles && { section_titles: input.sectionTitles }),
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope(acceptSchema),
    signal: options.signal,
  })
  return response.data
}

export async function getSourceTranscript(
  projectId: string,
  sourceId: string,
  page: { fromWord?: number; limit?: number } = {},
  options: { signal?: AbortSignal } = {},
): Promise<SourceTranscript> {
  const params = new URLSearchParams()
  if (page.fromWord !== undefined) params.set('from_word', String(page.fromWord))
  if (page.limit !== undefined) params.set('limit', String(page.limit))
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const response = await gatewayRequest(`${base(projectId, sourceId)}/transcript${query}`, { schema: envelope(transcriptSchema), signal: options.signal })
  return response.data
}

/** A spelling fix changes caption text only; the spoken audio never changes from here (overdub is refused). */
export async function correctSourceTranscript(
  projectId: string,
  sourceId: string,
  input: { expectedHead: TranscriptRef; corrections: Array<{ wordId: string; text: string }>; idempotencyKey: string },
  options: { signal?: AbortSignal } = {},
) {
  const response = await gatewayRequest(`${base(projectId, sourceId)}/transcript/corrections`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_head: input.expectedHead,
      corrections: input.corrections.map((correction) => ({ word_id: correction.wordId, text: correction.text })),
      audio: 'unchanged',
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope(correctionSchema),
    signal: options.signal,
  })
  return response.data
}

/** Deleting words cuts their source range (one command, one undo); the words stay in the transcript, struck through. */
export async function cutSourceTranscriptWords(
  projectId: string,
  sourceId: string,
  input: { expectedHead: TranscriptRef; runs: Array<{ firstWordId: string; lastWordId: string }>; idempotencyKey: string },
  options: { signal?: AbortSignal } = {},
) {
  const response = await gatewayRequest(`${base(projectId, sourceId)}/transcript/cuts`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_head: input.expectedHead,
      runs: input.runs.map((run) => ({ first_word_id: run.firstWordId, last_word_id: run.lastWordId })),
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope(cutResultSchema),
    signal: options.signal,
  })
  return response.data
}

/** Consecutive selected word ids → the runs a cut request carries (ids `w_<index>`). */
export function transcriptSelectionRuns(wordIds: readonly string[]): Array<{ firstWordId: string; lastWordId: string }> {
  const indices = [...new Set(wordIds.map((id) => Number(id.replace(/^w_/, ''))))].filter((index) => Number.isInteger(index) && index >= 0).sort((a, b) => a - b)
  const runs: Array<{ firstWordId: string; lastWordId: string }> = []
  let start: number | null = null
  let previous: number | null = null
  for (const index of indices) {
    if (start === null || previous === null || index !== previous + 1) {
      if (start !== null && previous !== null) runs.push({ firstWordId: `w_${start}`, lastWordId: `w_${previous}` })
      start = index
    }
    previous = index
  }
  if (start !== null && previous !== null) runs.push({ firstWordId: `w_${start}`, lastWordId: `w_${previous}` })
  return runs
}

/** The cuts the accept applies (the review's enabled toggles). */
export function enabledSplitCuts(suggestion: SplitSuggestion, disabledCutIds: ReadonlySet<string>) {
  return suggestion.cuts.filter((cut) => !disabledCutIds.has(cut.cut_id))
}

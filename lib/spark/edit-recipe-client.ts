import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-34 EditRecipe of an uploaded video (`/api/v1/composition-edit-recipes`): the one source-timed plan the Chat
 * summary, the timeline markers and the temporary review all read. Server state only — the plan, its revisions and
 * decisions are re-read from the gateway; nothing is kept in browser storage. A 409 means the reviewed revision is no
 * longer current: re-read and show the fresh plan (an old acceptance never applies a new scope).
 */

export const editIntents = ['full_edit', 'scoped_edit', 'analysis_only'] as const
export const editOperations = ['cut_silence', 'cut_filler', 'cut_range', 'censor', 'caption', 'graphic', 'b_roll', 'transition', 'interstitial'] as const
export const editProhibitions = ['no_visual_additions', 'no_audio_change', 'selection_only', 'no_captions'] as const
export type EditRequestScope = {
  intent: (typeof editIntents)[number]
  allowed_operations?: Array<(typeof editOperations)[number]>
  prohibitions: Array<(typeof editProhibitions)[number]>
  selection?: { start_seconds: number; end_seconds: number } | { first_word_id: string; last_word_id: string }
}

/** P06-41 `insert_presentation` (a subset of the PresenterLayout catalogue). */
export const insertPresentations = ['side_card', 'split', 'pip_camera', 'cutaway', 'interstitial'] as const
export type InsertPresentation = (typeof insertPresentations)[number]

/**
 * P06-41 typed insert of a `graphic` line (`composition_insert_v1`), read tolerantly: presentation source, reading
 * time and its options, the layout's crop mode, speech, anchor state and the one open question.
 */
const insertSchema = z.object({
  schema: z.literal('composition_insert_v1'),
  content: z.object({ pattern: z.string() }).passthrough(),
  placement: z.string(),
  presentation_source: z.enum(['user', 'model', 'rule']),
  reading: z.object({
    min_seconds: z.number(),
    available_seconds: z.number(),
    status: z.enum(['fits', 'too_short']),
    options: z.array(z.string()),
  }),
  layout: z.object({
    presenter_layout: z.string(),
    speaker_crop: z.object({ mode: z.enum(['face', 'center']) }).passthrough().nullable(),
    position_adjustable: z.boolean(),
    face_clear: z.boolean().nullable(),
  }).passthrough(),
  speech: z.enum(['continues', 'muted']),
  insert_seconds: z.number().nullable(),
  anchor_status: z.enum(['resolved', 'unresolved']),
  question: z.object({ code: z.string() }).nullable(),
}).passthrough()
export type EditRecipeInsert = z.output<typeof insertSchema>

const itemSchema = z.object({
  item_id: z.string(),
  kind: z.enum(['cut', 'caption', 'audio_censor', 'graphic', 'b_roll', 'transition', 'interstitial']),
  reason: z.string(),
  source_range: z.object({ start_seconds: z.number(), end_seconds: z.number() }),
  anchor: z.object({ first_word_id: z.string(), last_word_id: z.string() }).nullable(),
  evidence: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  needs_review: z.boolean(),
  enabled: z.boolean(),
  presentation: z.string().nullable(),
  media: z.object({
    route: z.string(),
    status: z.enum(['not_applicable', 'resolved', 'source_required', 'capability_required']),
    selection: z.object({ source: z.string(), rule_ref: z.string().nullable(), reason: z.string() }),
  }).passthrough(),
  output_effect_seconds: z.number(),
  cost: z.object({ status: z.enum(['free', 'priced', 'not_ready']), credits: z.number().nullable() }),
  insert: insertSchema.optional(),
}).passthrough()
export type EditRecipeItem = z.output<typeof itemSchema>

const recipeSchema = z.object({
  schema: z.literal('composition_edit_recipe_v1'),
  recipe_id: z.string(),
  revision: z.number().int(),
  source_id: z.string(),
  scope: z.object({ intent: z.enum(editIntents) }).passthrough(),
  cleanup_profile: z.enum(['gentle', 'balanced', 'tight']),
  /**
   * P06-07: the exact EditStyle revision the plan was computed with (source, revision number, frozen typed policy);
   * `edit_style_ref: null` = the product default. Read tolerantly (older plans carry `null`).
   */
  pins: z.object({
    edit_style_ref: z.object({
      ref: z.object({ edit_style_id: z.string(), edit_style_revision_id: z.string(), revision_digest_sha256: z.string() }),
      source: z.enum(['explicit', 'actor_selection', 'channel_default']),
      revision_number: z.number().int(),
    }).passthrough().nullable().optional(),
  }).passthrough().optional(),
  items: z.array(itemSchema),
  summary: z.object({
    output_effect_seconds: z.number(),
    ai_images: z.number().int(),
    ai_video_clips: z.number().int(),
    ai_video_seconds: z.number(),
    stock_acquires: z.number().int(),
    caption_operations: z.number().int(),
    audio_operations: z.number().int(),
    total_credits: z.number().nullable(),
    not_ready_item_ids: z.array(z.string()),
    free_only: z.boolean(),
    excluded_by_scope: z.record(z.string(), z.number()),
  }).passthrough(),
  recipe_sha256: z.string(),
  status: z.enum(['proposed', 'applied', 'rejected', 'superseded', 'paid_dispatch_required']),
  status_reasons: z.array(z.string()),
  receipt: z.object({ command_id: z.string(), undo_group_id: z.string().nullable(), working_copy_version: z.number().int() }).nullable(),
  applied_item_ids: z.array(z.string()),
}).passthrough()
export type EditRecipe = z.output<typeof recipeSchema>

const envelope = z.object({ data: recipeSchema })
const base = (projectId: string, sourceId: string) =>
  `/api/v1/composition-edit-recipes/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}`

export async function getEditRecipe(projectId: string, sourceId: string, options: { signal?: AbortSignal } = {}): Promise<EditRecipe> {
  const response = await gatewayRequest(base(projectId, sourceId), { schema: envelope, signal: options.signal })
  return response.data
}

/** The editor's own request (always Ask): a broad plan waits for acceptance; an explicit narrow clean-up may apply at once. */
export async function prepareEditRecipe(
  projectId: string,
  sourceId: string,
  input: {
    scope: EditRequestScope
    cleanupProfile?: EditRecipe['cleanup_profile']
    /** P06-07: this job's explicit EditStyle revision (the exact ref Brand returned); absent = selection / channel default. */
    editStyleRef?: { edit_style_id: string; edit_style_revision_id: string; revision_digest_sha256: string }
    idempotencyKey: string
  },
  options: { signal?: AbortSignal } = {},
): Promise<EditRecipe> {
  const response = await gatewayRequest(`${base(projectId, sourceId)}/prepare`, {
    method: 'POST',
    csrf: true,
    body: {
      scope: input.scope,
      ...(input.cleanupProfile && { cleanup_profile: input.cleanupProfile }),
      ...(input.editStyleRef && { edit_style_ref: input.editStyleRef }),
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope,
    signal: options.signal,
  })
  return response.data
}

/** Switching lines or adding a constraint makes a new revision that waits for acceptance. */
export async function reviseEditRecipe(
  projectId: string,
  recipe: Pick<EditRecipe, 'source_id' | 'revision' | 'recipe_sha256'>,
  input: {
    itemToggles?: Array<{ itemId: string; enabled: boolean }>
    /** P06-41 inspector `Sunum`: a new presentation of insert lines (free; a new revision). */
    itemPresentations?: Array<{ itemId: string; presentation: InsertPresentation }>
    addProhibitions?: EditRequestScope['prohibitions']
    cleanupProfile?: EditRecipe['cleanup_profile']
    /** P06-07: re-resolve the EditStyle (selection / channel default / newest revision) for this new plan revision. */
    refreshEditStyle?: boolean
    idempotencyKey: string
  },
  options: { signal?: AbortSignal } = {},
): Promise<EditRecipe> {
  const response = await gatewayRequest(`${base(projectId, recipe.source_id)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_revision: recipe.revision,
      expected_recipe_sha256: recipe.recipe_sha256,
      ...(input.itemToggles && { item_toggles: input.itemToggles.map((toggle) => ({ item_id: toggle.itemId, enabled: toggle.enabled })) }),
      ...(input.itemPresentations && { item_presentations: input.itemPresentations.map((entry) => ({ item_id: entry.itemId, presentation: entry.presentation })) }),
      ...(input.addProhibitions && { add_prohibitions: input.addProhibitions }),
      ...(input.cleanupProfile && { cleanup_profile: input.cleanupProfile }),
      ...(input.refreshEditStyle && { refresh_edit_style: true }),
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope,
    signal: options.signal,
  })
  return response.data
}

/** `Bu planla üret` / `Reddet` on the exact revision the review shows. */
export async function decideEditRecipe(
  projectId: string,
  recipe: Pick<EditRecipe, 'source_id' | 'revision' | 'recipe_sha256'>,
  decision: 'accept' | 'reject',
  options: { signal?: AbortSignal } = {},
): Promise<EditRecipe> {
  const response = await gatewayRequest(`${base(projectId, recipe.source_id)}/${decision}`, {
    method: 'POST',
    csrf: true,
    body: { revision: recipe.revision, expected_recipe_sha256: recipe.recipe_sha256 },
    schema: envelope,
    signal: options.signal,
  })
  return response.data
}

/**
 * What the plan card's summary shows: cuts and their total effect, captions/audio operations, media counts and the
 * total — `null` total means a line is not priced yet (never shown as 0), and review lines block acceptance.
 */
export function editRecipeCardSummary(recipe: EditRecipe) {
  const enabled = recipe.items.filter((item) => item.enabled)
  return {
    cuts: enabled.filter((item) => item.kind === 'cut').length,
    outputEffectSeconds: recipe.summary.output_effect_seconds,
    captions: recipe.summary.caption_operations,
    audioEdits: recipe.summary.audio_operations,
    aiImages: recipe.summary.ai_images,
    aiVideoClips: recipe.summary.ai_video_clips,
    stockAcquires: recipe.summary.stock_acquires,
    totalCredits: recipe.summary.total_credits,
    notReady: recipe.summary.not_ready_item_ids.length,
    needsReview: recipe.items.filter((item) => item.needs_review).length,
    sourceRequired: recipe.items.filter((item) => item.media.status === 'source_required').length,
    canAccept: recipe.status === 'proposed' && recipe.scope.intent !== 'analysis_only' && !enabled.some((item) => item.needs_review),
  }
}

/**
 * P06-41 inspector `Sunum` choices of an insert line: the five presentations with the current one; `interstitial`
 * only for the user's own insert request (an information moment stays an overlay, Q27). Null for other lines.
 */
export function insertPresentationChoices(item: EditRecipeItem): { current: InsertPresentation; options: Array<{ presentation: InsertPresentation; allowed: boolean }> } | null {
  if (!item.insert || !(insertPresentations as readonly string[]).includes(item.presentation ?? '')) return null
  return {
    current: item.presentation as InsertPresentation,
    options: insertPresentations.map((presentation) => ({ presentation, allowed: presentation !== 'interstitial' || item.reason === 'insert_requested' })),
  }
}

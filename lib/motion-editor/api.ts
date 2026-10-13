'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-02 Motion authoring client (`/api/v1/brand/motion-drafts`): a Motion the user opened for a structural change is a
 * private DRAFT on the server (a fork of an exact Brand Motion revision). Every edit is one CAS write; the browser holds
 * no product data (no local/session storage or IndexedDB), the screen shows a loading state until the server answers.
 * The server keeps the whole feature behind `BRAND_MOTION_AUTHORING_ENABLED` (403 `BRAND_MOTION_AUTHORING_UNAVAILABLE`
 * while off).
 */

const DRAFTS_PATH = '/api/v1/brand/motion-drafts'
export const MOTION_DRAFT_ID_PATTERN = /^bmotd_[A-Za-z0-9_-]{1,64}$/

export const MOTION_DRAFTS_QUERY_KEY = ['brand', 'motion-drafts'] as const
export const motionDraftQueryKey = (draftId: string) => ['brand', 'motion-drafts', draftId] as const

export const motionRatioSchema = z.enum(['16:9', '9:16', '1:1'])
export const motionEnergySchema = z.enum(['sakin', 'dengeli', 'canli'])
export type MotionRatio = z.infer<typeof motionRatioSchema>
export type MotionEnergy = z.infer<typeof motionEnergySchema>

/** One `motion_exposure_v1` parameter (the draft's, a library revision's or a saved Motion's): what Spark may edit. */
export const motionExposedParameterSchema = z
  .object({
    parameter_id: z.string(),
    kind: z.string(),
    spark_editable: z.boolean(),
    required: z.boolean(),
    text: z.object({ max_chars: z.number().int(), overflow: z.string() }).optional(),
    duration: z.object({ min_frames: z.number().int(), max_frames: z.number().int() }).optional(),
    number: z.object({ min: z.number(), max: z.number() }).optional(),
    media: z.object({ media_kinds: z.array(z.string()), aspect_ratio: z.string().optional() }).optional(),
  })
  .passthrough()
const exposedParameterSchema = motionExposedParameterSchema
export type MotionExposedParameter = z.infer<typeof exposedParameterSchema>

const testDataSchema = z.object({
  video_style_ref: z.string(),
  ratio: motionRatioSchema,
  energy: motionEnergySchema,
  values: z.record(z.union([z.string(), z.number()])),
})
export type MotionDraftTestData = z.infer<typeof testDataSchema>

const receiptSchema = z.object({
  receipt_id: z.string(),
  draft_version: z.number().int(),
  ok: z.boolean(),
  issues: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })),
  parameter_schema_hash: z.string().nullable(),
  compiles: z.array(
    z.object({
      ratio: motionRatioSchema,
      energy: motionEnergySchema,
      ok: z.boolean(),
      duration_frames: z.number().int().nullable(),
      document_sha256: z.string().nullable(),
      error: z.object({ code: z.string(), reason: z.string().nullable() }).nullable(),
    }),
  ),
  compile_skipped: z.enum(['source_invalid', 'video_style_unavailable', 'fonts_unavailable']).nullable(),
  validated_at: z.string(),
  current: z.boolean(),
})
export type MotionDraftReceipt = z.infer<typeof receiptSchema>

const capabilitiesSchema = z.object({
  schema_version: z.literal('motion_authoring_capabilities_v1'),
  subject: z.literal('motion_draft'),
  role: z.literal('owner'),
  surfaces: z.object({
    preview: z.object({ default_open: z.boolean() }),
    chat: z.object({ default_open: z.boolean() }),
    parameters: z.object({ default_open: z.boolean() }),
    code_panel: z.object({ default_open: z.boolean(), opt_in: z.boolean(), source_format: z.string(), source_editable: z.boolean() }),
  }),
  code_authoring: z.object({ enabled: z.boolean(), available: z.boolean(), reason: z.string().nullable() }),
  actions: z.object({
    edit_source: z.boolean(),
    set_test_data: z.boolean(),
    validate: z.boolean(),
    archive: z.boolean(),
    /** P06-12 "Motion olarak kaydet": the server says whether it can run now and, if not, what is missing. */
    publish: z.object({
      available: z.boolean(),
      reason: z.enum(['not_available', 'archived', 'validation_missing', 'validation_stale', 'validation_failed', 'unchanged']).nullable(),
    }),
  }),
  parameters: z.array(exposedParameterSchema),
  spark_boundary: z.object({
    spark_editable_kinds: z.array(z.enum(['text', 'color', 'media', 'duration'])),
    structural_edit: z.literal('motion_draft'),
    returns_to_project: z.boolean(),
  }),
})
export type MotionDraftCapabilities = z.infer<typeof capabilitiesSchema>

export const motionDraftSchema = z.object({
  draft_id: z.string(),
  name: z.string(),
  lifecycle_state: z.enum(['active', 'archived']),
  source: z.object({
    kind: z.literal('fork'),
    origin: z.enum(['library', 'tenant']),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    manifest_sha256: z.string(),
    blueprint_ref: z.string(),
  }),
  return_to: z.object({ project_id: z.string(), layer_id: z.string(), instance_id: z.string().nullable() }).nullable(),
  chat_conversation_id: z.string().nullable(),
  /** P06-12: the last immutable revision this draft published (null until "Motion olarak kaydet" ran). */
  latest_revision: z.object({ motion_revision_id: z.string(), revision_number: z.number().int() }).nullable(),
  draft: z.object({
    version: z.number().int(),
    pattern: z.record(z.unknown()),
    test_data: testDataSchema,
    validation: receiptSchema.nullable(),
  }),
  capabilities: capabilitiesSchema,
  created_at: z.string(),
  updated_at: z.string(),
})
export type MotionDraft = z.infer<typeof motionDraftSchema>

const draftResponseSchema = z.object({ data: motionDraftSchema })
const createdResponseSchema = z.object({ data: z.object({ draft: motionDraftSchema, replayed: z.boolean() }) })

export const motionDraftListItemSchema = z.object({
  draft_id: z.string(),
  name: z.string(),
  lifecycle_state: z.enum(['active', 'archived']),
  source: z.object({ origin: z.enum(['library', 'tenant']), motion_id: z.string(), blueprint_ref: z.string() }),
  draft_version: z.number().int(),
  validated: z.boolean(),
  returns_to_project: z.boolean(),
  updated_at: z.string(),
})
export type MotionDraftListItem = z.infer<typeof motionDraftListItemSchema>

const listResponseSchema = z.object({
  data: z.array(motionDraftListItemSchema),
  meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }),
})

const previewSchema = z.object({
  data: z.object({
    draft_id: z.string(),
    draft_version: z.number().int(),
    ratio: motionRatioSchema,
    energy: motionEnergySchema,
    video_style_ref: z.string(),
    video_style_sha256: z.string(),
    duration_frames: z.number().int(),
    exit_frame: z.number().int().nullable(),
    document: z.record(z.unknown()),
    document_sha256: z.string(),
  }),
})
export type MotionDraftPreview = z.infer<typeof previewSchema>['data']

const linkSchema = z.object({ data: z.object({ conversation_id: z.string().nullable() }) })

/** P06-12: an immutable, tenant-authored Motion revision (`ref` is what a project pins). */
export const motionRevisionSchema = z.object({
  motion_id: z.string(),
  motion_revision_id: z.string(),
  revision_number: z.number().int(),
  draft_id: z.string(),
  ref: z.object({ motion_id: z.string(), motion_revision_id: z.string(), scope: z.string(), manifest_sha256: z.string() }),
  blueprint_ref: z.string(),
  title: z.object({ en: z.string(), tr: z.string() }),
  summary: z.string(),
  parameter_schema_hash: z.string(),
  /** The exposed Spark fields of the revision (`motion_exposure_v1` parameters). */
  parameters: z.array(motionExposedParameterSchema).optional(),
  aspect_ratios: z.array(z.string()),
  source_draft_version: z.number().int(),
  validation_receipt_id: z.string(),
  published_at: z.string(),
})
export type MotionRevision = z.infer<typeof motionRevisionSchema>

const publishedResponseSchema = z.object({ data: z.object({ revision: motionRevisionSchema, draft: motionDraftSchema, replayed: z.boolean() }) })
const revisionListSchema = z.object({ data: z.array(motionRevisionSchema), meta: z.object({ limit: z.number().int() }) })
const ownRevisionListSchema = z.object({ data: z.array(motionRevisionSchema), meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }) })

/**
 * The client-minted publish intent: a retry after an unknown outcome (same draft version) replays the same revision
 * instead of publishing twice.
 */
export function newMotionPublishIntentKey(random: () => string = () => crypto.randomUUID()): string {
  return `mpublish-${random().replaceAll('-', '')}`
}

/** "Motion olarak kaydet": publishes the validated draft version as an immutable revision (the draft version stays). */
export async function publishMotionDraft(
  draftId: string,
  input: { expectedVersion: number; publishIntentKey: string },
  options: { signal?: AbortSignal } = {},
): Promise<{ revision: MotionRevision; draft: MotionDraft; replayed: boolean }> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: input.expectedVersion, publish_intent_key: input.publishIntentKey },
    schema: publishedResponseSchema,
    signal: options.signal,
  })
  return result.data
}

/** The revisions published from one draft, newest first. */
export async function listMotionDraftRevisions(draftId: string, options: { signal?: AbortSignal } = {}): Promise<MotionRevision[]> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/revisions?limit=50`, { schema: revisionListSchema, signal: options.signal })
  return result.data
}

/**
 * The user's own published Motions (`GET /api/v1/brand/motion-revisions`, newest first; behind `BRAND_MOTION_AUTHORING_ENABLED`):
 * what Spark's "My Motions" and the Motion area list. Bounded pages; a project that pins one resolves it for its members.
 */
export async function listOwnMotionRevisions(options: { signal?: AbortSignal; maxPages?: number } = {}): Promise<MotionRevision[]> {
  const items: MotionRevision[] = []
  let cursor: string | null = null
  for (let page = 0; page < (options.maxPages ?? 4); page += 1) {
    const params = new URLSearchParams({ limit: '50' })
    if (cursor) params.set('cursor', cursor)
    const result: z.infer<typeof ownRevisionListSchema> = await gatewayRequest(`/api/v1/brand/motion-revisions?${params.toString()}`, { schema: ownRevisionListSchema, signal: options.signal })
    items.push(...result.data)
    cursor = result.meta.next_cursor
    if (!cursor) break
  }
  return items
}

/** The client-minted create intent: a retry after an unknown outcome replays the same draft instead of forking twice. */
export function newMotionDraftClientRequestId(random: () => string = () => crypto.randomUUID()): string {
  return `mdraft-${random().replaceAll('-', '')}`
}

export async function listMotionDrafts(input: { includeArchived?: boolean; cursor?: string | null } = {}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ limit: '50', include_archived: input.includeArchived ? 'true' : 'false' })
  if (input.cursor) params.set('cursor', input.cursor)
  return gatewayRequest(`${DRAFTS_PATH}?${params.toString()}`, { schema: listResponseSchema, signal: options.signal })
}

export type CreateMotionDraftInput = {
  source: { motion_id: string; motion_revision_id: string; manifest_sha256: string }
  /** Explicit VideoStyle preset ref; optional only together with `returnTo` (the instance's own style is used). */
  videoStyleRef?: string
  name?: string
  returnTo?: { projectId: string; layerId: string }
  clientRequestId: string
}

export async function createMotionDraft(input: CreateMotionDraftInput, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(DRAFTS_PATH, {
    method: 'POST',
    csrf: true,
    body: {
      source: input.source,
      ...(input.videoStyleRef && { video_style_ref: input.videoStyleRef }),
      ...(input.name && { name: input.name }),
      ...(input.returnTo && { return_to: { project_id: input.returnTo.projectId, layer_id: input.returnTo.layerId } }),
      client_request_id: input.clientRequestId,
    },
    schema: createdResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getMotionDraft(draftId: string, options: { signal?: AbortSignal } = {}): Promise<MotionDraft> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}`, { schema: draftResponseSchema, signal: options.signal })
  return result.data
}

export async function updateMotionDraftSource(
  draftId: string,
  input: { expectedVersion: number; pattern?: Record<string, unknown>; name?: string },
  options: { signal?: AbortSignal } = {},
): Promise<MotionDraft> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/source`, {
    method: 'PUT',
    csrf: true,
    body: { expected_version: input.expectedVersion, ...(input.pattern && { pattern: input.pattern }), ...(input.name && { name: input.name }) },
    schema: draftResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function setMotionDraftTestData(
  draftId: string,
  input: { expectedVersion: number; testData: MotionDraftTestData },
  options: { signal?: AbortSignal } = {},
): Promise<MotionDraft> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/test-data`, {
    method: 'PUT',
    csrf: true,
    body: { expected_version: input.expectedVersion, test_data: input.testData },
    schema: draftResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function validateMotionDraft(draftId: string, input: { expectedVersion: number }, options: { signal?: AbortSignal } = {}): Promise<MotionDraft> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/validations`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: input.expectedVersion },
    schema: draftResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function previewMotionDraft(
  draftId: string,
  input: { ratio?: MotionRatio; energy?: MotionEnergy } = {},
  options: { signal?: AbortSignal } = {},
): Promise<MotionDraftPreview> {
  const params = new URLSearchParams()
  if (input.ratio) params.set('ratio', input.ratio)
  if (input.energy) params.set('energy', input.energy)
  const query = params.toString()
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/preview${query ? `?${query}` : ''}`, {
    schema: previewSchema,
    signal: options.signal,
  })
  return result.data
}

export async function archiveMotionDraft(draftId: string, input: { expectedVersion: number }, options: { signal?: AbortSignal } = {}): Promise<MotionDraft> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/archive`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: input.expectedVersion },
    schema: draftResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getMotionDraftConversationLink(draftId: string, options: { signal?: AbortSignal } = {}): Promise<string | null> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/conversation-link`, { schema: linkSchema, signal: options.signal })
  return result.data.conversation_id
}

export async function setMotionDraftConversationLink(draftId: string, conversationId: string, options: { signal?: AbortSignal } = {}): Promise<string | null> {
  const result = await gatewayRequest(`${DRAFTS_PATH}/${encodeURIComponent(draftId)}/conversation-link`, {
    method: 'PUT',
    csrf: true,
    body: { conversation_id: conversationId },
    schema: linkSchema,
    signal: options.signal,
  })
  return result.data.conversation_id
}

const presetListSchema = z.object({
  data: z.array(z.object({ preset_ref: z.string(), title: z.object({ en: z.string(), tr: z.string() }) }).passthrough()),
})
export type VideoStylePresetOption = { preset_ref: string; title: { en: string; tr: string } }

/** The platform VideoStyle presets a draft's Test Data may name (the choice is explicit; there is no default look). */
export async function listVideoStylePresetOptions(options: { signal?: AbortSignal } = {}): Promise<VideoStylePresetOption[]> {
  const result = await gatewayRequest('/api/v1/brand/video-styles/presets', { schema: presetListSchema, signal: options.signal })
  return result.data.map((preset) => ({ preset_ref: preset.preset_ref, title: preset.title }))
}

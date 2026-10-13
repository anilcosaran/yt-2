import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-05 Video Template authoring client (server-side state only; drafts, Test Data and receipts live in Brand, never in
 * browser storage). New wizard / Create from Project, CAS draft edits, slotify, Test Data, validation and save.
 * The wizard and authoring screens wait for the visual decisions in docs/plans/agentic-spark/teslim/P06-05.md; this
 * module is their non-visual part. Behind `BRAND_TEMPLATE_AUTHORING_ENABLED` (403 when off).
 */

const BASE = '/api/v1/brand-video-templates'

export const VIDEO_TEMPLATE_TYPES = [
  'tanitim_motion_film',
  'slayt_egitim',
  'konsept_video',
  'program_formati',
  'ham_video_formati',
  'sosyal_kanvas_dikey',
  'yorum_tepki_derleme',
] as const
export type VideoTemplateType = (typeof VIDEO_TEMPLATE_TYPES)[number]
export type VideoTemplateAspectRatio = '16:9' | '9:16' | '1:1'

export const videoTemplateRefSchema = z.object({
  ref_type: z.literal('brand_revision'),
  brand_asset_kind: z.literal('template'),
  brand_asset_id: z.string(),
  brand_revision_id: z.string(),
  brand_revision_digest_sha256: z.string(),
})
export type VideoTemplateRevisionRef = z.infer<typeof videoTemplateRefSchema>
const refSchema = videoTemplateRefSchema

const testDataSchema = z.object({
  project_id: z.string(),
  bindings: z.record(z.unknown()),
  choices: z.record(z.unknown()),
})
export type VideoTemplateTestData = z.infer<typeof testDataSchema>

const receiptSchema = z
  .object({
    receipt_id: z.string(),
    draft_version: z.number().int(),
    ok: z.boolean(),
    current: z.boolean(),
    checks: z.object({
      manifest: z.enum(['ok', 'failed']),
      fonts: z.enum(['ok', 'failed']),
      assets: z.enum(['ok', 'failed']),
      private_media: z.enum(['ok', 'failed']),
      test_data: z.enum(['final_ready', 'not_final_ready', 'missing', 'failed']),
    }),
    issues: z.array(z.object({ rule: z.string(), path: z.string(), message: z.string() })),
    validated_at: z.string(),
  })
  .passthrough()
export type VideoTemplateValidationReceipt = z.infer<typeof receiptSchema>

const latestSchema = z.object({ revision_id: z.string(), revision_number: z.number().int() }).nullable()

export const videoTemplateSchema = z
  .object({
    template_id: z.string(),
    name: z.string(),
    template_type: z.enum(VIDEO_TEMPLATE_TYPES),
    lifecycle_state: z.enum(['active', 'archived']),
    draft: z.object({
      version: z.number().int().min(1),
      /** `brand_template_manifest_v2` without its revision identity; edited as a whole under CAS. */
      body: z.record(z.unknown()),
      source: z.union([
        z.object({ kind: z.literal('blank') }),
        z.object({
          kind: z.literal('composition'),
          project_id: z.string(),
          working_copy_version: z.number().int(),
          head_revision_id: z.string().nullable(),
          scene_ids: z.array(z.string()),
        }),
        /** P06-26 duplicate of another own template (an exact revision, or its draft). */
        z.object({
          kind: z.literal('template'),
          template_id: z.string(),
          revision_id: z.string().nullable(),
          draft_version: z.number().int(),
        }),
        /** P06-32 clone: the consumer's private fork of an exact public publication snapshot. */
        z.object({
          kind: z.literal('publication_fork'),
          publication_id: z.string(),
          publication_revision: z.number().int(),
          snapshot_digest: z.string(),
        }),
      ]),
      test_data: testDataSchema.nullable(),
      validation: receiptSchema.nullable(),
    }),
    latest_revision: latestSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()
export type VideoTemplate = z.infer<typeof videoTemplateSchema>
const templateSchema = videoTemplateSchema

export const videoTemplateNoteSchema = z.object({ reason: z.string(), entity_id: z.string() })
const noteSchema = videoTemplateNoteSchema
export type VideoTemplateSnapshotNote = z.infer<typeof noteSchema>

const templatePath = (templateId: string) => `${BASE}/${encodeURIComponent(templateId)}`

// ---------------------------------------------------------------- reads

export const videoTemplateListItemSchema = z
  .object({
    template_id: z.string(),
    name: z.string(),
    template_type: z.enum(VIDEO_TEMPLATE_TYPES),
    lifecycle_state: z.enum(['active', 'archived']),
    draft_version: z.number().int(),
    latest_revision: latestSchema,
    updated_at: z.string(),
  })
  .passthrough()
export type VideoTemplateListItem = z.infer<typeof videoTemplateListItemSchema>
const listItemSchema = videoTemplateListItemSchema

export async function listVideoTemplates(
  options: { limit?: number; cursor?: string | null; signal?: AbortSignal } = {},
): Promise<{ items: VideoTemplateListItem[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: String(options.limit ?? 20) })
  if (options.cursor) query.set('cursor', options.cursor)
  const response = await gatewayRequest(`${BASE}?${query.toString()}`, {
    schema: z.object({ data: z.array(listItemSchema), meta: z.object({ next_cursor: z.string().nullable() }).passthrough() }),
    signal: options.signal,
  })
  return { items: response.data, nextCursor: response.meta.next_cursor }
}

export async function getVideoTemplate(templateId: string, options: { signal?: AbortSignal } = {}): Promise<VideoTemplate> {
  const response = await gatewayRequest(templatePath(templateId), { schema: z.object({ data: templateSchema }), signal: options.signal })
  return response.data
}

// ---------------------------------------------------------------- writes (CSRF; CAS on the draft version)

export type CreateVideoTemplateInput = {
  name: string
  templateType: VideoTemplateType
  locale: 'en' | 'tr'
  /** Idempotency of the create intent (same request replays, another request with it is a conflict). */
  clientRequestId: string
} & (
  | { aspectRatios: VideoTemplateAspectRatio[]; fromProject?: undefined }
  /** Create from Project: the selected scenes (null = the whole strip) of the project's exact working copy. */
  | { fromProject: { projectId: string; sceneIds: string[] | null }; aspectRatios?: undefined }
)

export async function createVideoTemplate(
  input: CreateVideoTemplateInput,
): Promise<{ template: VideoTemplate; notes: VideoTemplateSnapshotNote[]; replayed: boolean }> {
  const response = await gatewayRequest(BASE, {
    method: 'POST',
    csrf: true,
    body: {
      name: input.name,
      template_type: input.templateType,
      locale: input.locale,
      client_request_id: input.clientRequestId,
      ...(input.fromProject
        ? { from_project: { project_id: input.fromProject.projectId, scene_ids: input.fromProject.sceneIds } }
        : { aspect_ratios: input.aspectRatios }),
    },
    schema: z.object({ data: z.object({ template: templateSchema, notes: z.array(noteSchema), replayed: z.boolean() }) }),
  })
  return response.data
}

async function draftWrite(path: string, method: 'PUT' | 'POST', body: Record<string, unknown>): Promise<VideoTemplate> {
  const response = await gatewayRequest(path, { method, csrf: true, body, schema: z.object({ data: templateSchema }) })
  return response.data
}

export function updateVideoTemplateDraft(templateId: string, expectedVersion: number, body: Record<string, unknown>): Promise<VideoTemplate> {
  return draftWrite(`${templatePath(templateId)}/draft`, 'PUT', { expected_version: expectedVersion, body })
}

export function slotifyVideoTemplateText(
  templateId: string,
  input: { expectedVersion: number; blueprintLocalId: string; layerLocalId: string; slotId: string; label: string; required: boolean; maxLength: number },
): Promise<VideoTemplate> {
  return draftWrite(`${templatePath(templateId)}/draft/slotify`, 'POST', {
    expected_version: input.expectedVersion,
    blueprint_local_id: input.blueprintLocalId,
    layer_local_id: input.layerLocalId,
    slot_id: input.slotId,
    label: input.label,
    required: input.required,
    max_length: input.maxLength,
  })
}

export function setVideoTemplateTestData(templateId: string, expectedVersion: number, testData: VideoTemplateTestData): Promise<VideoTemplate> {
  return draftWrite(`${templatePath(templateId)}/draft/test-data`, 'PUT', { expected_version: expectedVersion, test_data: testData })
}

export function validateVideoTemplateDraft(templateId: string, expectedVersion: number): Promise<VideoTemplate> {
  return draftWrite(`${templatePath(templateId)}/draft/validations`, 'POST', { expected_version: expectedVersion })
}

export async function saveVideoTemplateRevision(
  templateId: string,
  expectedVersion: number,
  publishIntentKey: string,
): Promise<{ revisionId: string; revisionNumber: number; ref: VideoTemplateRevisionRef; replayed: boolean }> {
  const response = await gatewayRequest(`${templatePath(templateId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion, publish_intent_key: publishIntentKey },
    schema: z.object({
      data: z.object({
        template_id: z.string(),
        revision: z.object({ revision_id: z.string(), revision_number: z.number().int(), ref: refSchema, published_at: z.string() }),
        replayed: z.boolean(),
      }),
    }),
  })
  const { revision, replayed } = response.data
  return { revisionId: revision.revision_id, revisionNumber: revision.revision_number, ref: revision.ref, replayed }
}

// ---------------------------------------------------------------- pure view helpers

/**
 * Where the draft stands on the way to Save: Test Data first, then a validation receipt of this exact version; a
 * failed receipt lists its issues; `ready` is the only state Save accepts.
 */
export type VideoTemplateSaveState =
  | { state: 'archived' }
  | { state: 'needs_test_data' }
  | { state: 'needs_validation' }
  | { state: 'blocked'; issues: VideoTemplateValidationReceipt['issues'] }
  | { state: 'ready'; receiptId: string }

export function videoTemplateSaveState(template: VideoTemplate): VideoTemplateSaveState {
  if (template.lifecycle_state === 'archived') return { state: 'archived' }
  if (!template.draft.test_data) return { state: 'needs_test_data' }
  const receipt = template.draft.validation
  if (!receipt || !receipt.current || receipt.draft_version !== template.draft.version) return { state: 'needs_validation' }
  if (!receipt.ok) return { state: 'blocked', issues: receipt.issues }
  return { state: 'ready', receiptId: receipt.receipt_id }
}

/** "What did not carry over" summary of a Create from Project snapshot: reason → entity count, stable order. */
export function snapshotNoteSummary(notes: readonly VideoTemplateSnapshotNote[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>()
  for (const note of notes) counts.set(note.reason, (counts.get(note.reason) ?? 0) + 1)
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([reason, count]) => ({ reason, count }))
}

'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-09 audio licence client (F48, Q96): the user's rights declaration for an uploaded music/sfx file and the licence
 * state of a project's music/sfx. The server keeps both behind `MEDIA_CATALOG_AUDIO_LICENSE_ENABLED` (404
 * `MEDIA_CATALOG_AUDIO_LICENSE_UNAVAILABLE` for the declaration routes, `license_check: 'off'` for the project read
 * while closed). Everything is server state and is re-read from the gateway; nothing is kept in browser storage.
 * This module carries no visual decision (where the declaration prompt and the licence panel appear is an open UI
 * question).
 */

export const AUDIO_LICENSE_USES = ['project_use', 'final_distribution', 'commercial_use', 'raw_download', 'template_redistribution'] as const
export type AudioLicenseUse = (typeof AUDIO_LICENSE_USES)[number]

/** The declaration's default uses (project use is always part of it). */
export const AUDIO_RIGHTS_DEFAULT_USES: readonly AudioLicenseUse[] = ['project_use', 'final_distribution']
export const AUDIO_RIGHTS_LIMITS = { attributionMax: 500, sourceNoteMax: 200, revokeReasonMax: 200 } as const

const storageObjectRefSchema = z.object({ ref_type: z.literal('storage_object'), storage_object_id: z.string(), checksum_sha256: z.string() })

export const audioRightsDeclarationSchema = z.object({
  schema_version: z.literal('audio_rights_declaration_v1'),
  declaration_id: z.string(),
  channel_id: z.string(),
  asset: storageObjectRefSchema,
  state: z.enum(['active', 'revoked']),
  allowed_uses: z.array(z.enum(AUDIO_LICENSE_USES)),
  content_id_safe: z.boolean().nullable(),
  attribution: z.object({ required: z.boolean(), text: z.string().nullable() }),
  /** Private note of the declaring user; `null` for everyone else. */
  source_note: z.string().nullable(),
  revoked_at: z.string().nullable(),
  revoke_reason: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type AudioRightsDeclaration = z.infer<typeof audioRightsDeclarationSchema>

const bindingStatusSchema = z.enum(['bound', 'missing', 'revoked'])
const tri = z.enum(['allowed', 'not_allowed', 'unknown'])

export const compositionAudioLicenseItemSchema = z.object({
  source_id: z.string(),
  role: z.enum(['music', 'sfx']),
  asset: storageObjectRefSchema,
  status: bindingStatusSchema,
  reason: z.string().nullable(),
  basis: z.enum(['platform_stock', 'user_rights_declared', 'ai_generated']).nullable(),
  license_revision: z.string().nullable(),
  license_ref: z.string().nullable(),
  allowed_uses: z.array(z.enum(AUDIO_LICENSE_USES)),
  content_id_safe: z.boolean().nullable(),
  attribution: z.object({ required: z.boolean(), text: z.string().nullable() }).nullable(),
  /** The final export of the project is blocked by this dependency. */
  blocks_final_export: z.boolean(),
  /** Q96: may this audio travel inside a shared template? */
  template_redistribution: tri,
  raw_download: tri,
})
export type CompositionAudioLicenseItem = z.infer<typeof compositionAudioLicenseItemSchema>

export const compositionAudioLicensesSchema = z.object({
  schema_version: z.literal('composition_audio_licenses_v1'),
  project_id: z.string(),
  working_copy_version: z.number().int(),
  license_check: z.enum(['on', 'off']),
  items: z.array(compositionAudioLicenseItemSchema),
  final_export_ready: z.boolean(),
  template_redistribution_blocked: z.number().int(),
})
export type CompositionAudioLicenses = z.infer<typeof compositionAudioLicensesSchema>

export const audioRightsQueryKey = (storageObjectId: string) => ['media-catalog', 'audio-rights', storageObjectId] as const
export const compositionAudioLicensesQueryKey = (projectId: string) => ['composition', 'audio-licenses', projectId] as const

const one = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })
const declarationEnvelope = one(z.object({ declaration: audioRightsDeclarationSchema }))
const revokeEnvelope = one(z.object({ declaration: audioRightsDeclarationSchema, revoked_now: z.boolean() }))
const listEnvelope = one(z.object({ declarations: z.array(audioRightsDeclarationSchema) }))

const base = '/api/v1/media-catalog/audio-rights'

export interface DeclareAudioRightsInput {
  channelId: string
  storageObjectId: string
  checksumSha256: string
  /** Makes a retry the same declaration (8-128 characters of `A-Za-z0-9._:-`). */
  intentKey: string
  allowedUses?: readonly AudioLicenseUse[]
  /** `null` / omitted = unknown. */
  contentIdSafe?: boolean | null
  attribution?: { required: boolean; text?: string | null }
  sourceNote?: string | null
}

/**
 * "Bu müziği kullanma hakkım var": records the user's explicit statement for exactly this file (`rights_confirmed` is
 * always sent as true: the caller only invokes this after the user confirmed). 409 means the file already has a
 * recorded licence (catalogue/generation) or an active declaration: re-read instead of retrying.
 */
export async function declareAudioRights(input: DeclareAudioRightsInput): Promise<AudioRightsDeclaration> {
  const response = await gatewayRequest(base, {
    method: 'POST',
    csrf: true,
    body: {
      channel_id: input.channelId,
      storage_object_id: input.storageObjectId,
      checksum_sha256: input.checksumSha256,
      intent_key: input.intentKey,
      rights_confirmed: true,
      ...(input.allowedUses && { allowed_uses: [...input.allowedUses] }),
      ...(input.contentIdSafe !== undefined && { content_id_safe: input.contentIdSafe }),
      ...(input.attribution && { attribution: input.attribution }),
      ...(input.sourceNote !== undefined && { source_note: input.sourceNote }),
    },
    schema: declarationEnvelope,
  })
  return response.data.declaration
}

/** The tenant's declarations of one Storage object (every checksum and state), newest first. */
export async function listAudioRights(storageObjectId: string, options: { signal?: AbortSignal } = {}): Promise<AudioRightsDeclaration[]> {
  const response = await gatewayRequest(`${base}?${new URLSearchParams({ storage_object_id: storageObjectId }).toString()}`, {
    schema: listEnvelope,
    signal: options.signal,
  })
  return response.data.declarations
}

export async function getAudioRights(declarationId: string, options: { signal?: AbortSignal } = {}): Promise<AudioRightsDeclaration> {
  const response = await gatewayRequest(`${base}/${encodeURIComponent(declarationId)}`, { schema: declarationEnvelope, signal: options.signal })
  return response.data.declaration
}

/** Withdraws a declaration (the declaring user only); a final export of a project that uses the file is refused afterwards. */
export async function revokeAudioRights(declarationId: string, input: { reason?: string | null } = {}): Promise<{ declaration: AudioRightsDeclaration; revokedNow: boolean }> {
  const response = await gatewayRequest(`${base}/${encodeURIComponent(declarationId)}/revoke`, {
    method: 'POST',
    csrf: true,
    body: { ...(input.reason !== undefined && { reason: input.reason }) },
    schema: revokeEnvelope,
  })
  return { declaration: response.data.declaration, revokedNow: response.data.revoked_now }
}

/** The licence state of a project's music/sfx (licence panel, export pre-check and the "these will be shared too" list). */
export async function getCompositionAudioLicenses(projectId: string, options: { signal?: AbortSignal } = {}): Promise<CompositionAudioLicenses> {
  const response = await gatewayRequest(`/api/v1/composition/projects/${encodeURIComponent(projectId)}/audio-licenses`, {
    schema: one(compositionAudioLicensesSchema),
    signal: options.signal,
  })
  return response.data
}

/** Sources that block the final export, in the order the server lists them (the 422 lists the same ids). */
export function blockingAudioSources(licenses: CompositionAudioLicenses): CompositionAudioLicenseItem[] {
  return licenses.items.filter((item) => item.blocks_final_export)
}

/** Sources whose licence does not clearly allow travelling inside a shared template (Q96 warning list). */
export function audioSourcesNotShareable(licenses: CompositionAudioLicenses): CompositionAudioLicenseItem[] {
  return licenses.items.filter((item) => item.template_redistribution !== 'allowed')
}

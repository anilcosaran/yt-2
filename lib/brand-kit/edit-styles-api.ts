'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-07 EditStyle client: the shareable editing policy of an uploaded video (Auto Edit's style choice). The server
 * keeps it behind `BRAND_EDIT_STYLES_ENABLED` (403 `BRAND_FEATURE_UNAVAILABLE` while off). Everything here is server
 * state — the library, drafts, revisions, sharing and bindings are re-read from the gateway; nothing is kept in
 * browser storage. A 409 means the version the screen saw is no longer current: re-read and show the fresh state.
 * This module carries no visual decision (the picker/editor placement is an open UI question).
 */

export const EDIT_STYLE_SILENCE_PROFILES = ['gentle', 'balanced', 'tight'] as const
export const EDIT_STYLE_FILLER_HANDLING = ['mark', 'cut'] as const
export const EDIT_STYLE_ADDITION_POLICIES = ['allow', 'never'] as const
export const EDIT_STYLE_CAPTION_DEFAULTS = ['add', 'skip'] as const
export const EDIT_STYLE_SCREEN_EMPHASIS = ['off', 'on_request', 'intermittent'] as const
/** Same bounds as the mix plan's music bed offset (dB). */
export const EDIT_STYLE_MUSIC_BED_OFFSET_DB = { min: -40, max: 12 } as const

export const editStyleContentSchema = z.object({
  schema_version: z.literal(1),
  rhythm: z.object({
    silence_cleanup: z.enum(EDIT_STYLE_SILENCE_PROFILES),
    filler_sounds: z.enum(EDIT_STYLE_FILLER_HANDLING),
    interstitials: z.enum(EDIT_STYLE_ADDITION_POLICIES),
    information_overlays: z.enum(EDIT_STYLE_ADDITION_POLICIES),
  }),
  captions: z.object({ default: z.enum(EDIT_STYLE_CAPTION_DEFAULTS) }),
  media: z.object({ stock_only: z.boolean(), avoid_expensive_ai_images: z.boolean(), stock_first: z.boolean() }),
  audio: z.object({ music_bed_offset_db: z.number().min(EDIT_STYLE_MUSIC_BED_OFFSET_DB.min).max(EDIT_STYLE_MUSIC_BED_OFFSET_DB.max).nullable() }),
  screen_emphasis: z.enum(EDIT_STYLE_SCREEN_EMPHASIS),
})
export type EditStyleContent = z.infer<typeof editStyleContentSchema>

export const editStyleRefSchema = z.object({
  ref_type: z.literal('edit_style_revision'),
  edit_style_id: z.string(),
  edit_style_revision_id: z.string(),
  revision_digest_sha256: z.string(),
})
export type EditStyleRef = z.infer<typeof editStyleRefSchema>

const headRevisionSchema = z.object({ revision_id: z.string(), revision_number: z.number().int(), ref: editStyleRefSchema })

export const editStyleListItemSchema = z.object({
  edit_style_id: z.string(),
  name: z.string(),
  lifecycle_state: z.enum(['active', 'archived']),
  access_role: z.enum(['owner', 'shared_reader']),
  draft_version: z.number().int().nullable(),
  head_revision: headRevisionSchema.nullable(),
  sharing: z.object({ acl_version: z.number().int(), shared_with_channel_members: z.boolean() }).nullable(),
  content: editStyleContentSchema.nullable(),
  updated_at: z.string(),
})
export type EditStyleListItem = z.infer<typeof editStyleListItemSchema>

const editStyleSchema = editStyleListItemSchema.extend({
  channel_id: z.string(),
  draft: z.object({ version: z.number().int(), content: editStyleContentSchema }).nullable(),
  created_at: z.string(),
})
export type EditStyle = z.infer<typeof editStyleSchema>

const revisionSchema = z.object({
  edit_style_id: z.string(),
  revision_id: z.string(),
  revision_number: z.number().int(),
  ref: editStyleRefSchema,
  content: editStyleContentSchema,
  created_at: z.string(),
})
export type EditStyleRevision = z.infer<typeof revisionSchema>

const sharingStateSchema = z.object({
  edit_style_id: z.string(),
  channel_id: z.string(),
  acl_version: z.number().int(),
  shared_with_channel_members: z.boolean(),
  grant: z.object({ grant_id: z.string(), permissions: z.array(z.string()), created_at: z.string() }).nullable(),
  changed: z.boolean(),
})
export type EditStyleSharingState = z.infer<typeof sharingStateSchema>

const bindingSchema = z.object({
  binding_scope: z.enum(['channel_default', 'actor_selection']),
  edit_style_id: z.string().nullable(),
  restricted: z.boolean(),
  binding_version: z.number().int(),
  updated_at: z.string().nullable(),
  member_access: z.enum(['product_default', 'channel_members', 'owner_only']).nullable(),
})

const bindingStateSchema = z.object({
  channel_id: z.string(),
  channel_default: bindingSchema,
  actor_selection: bindingSchema,
  effective: z.object({
    source: z.enum(['explicit', 'actor_selection', 'channel_default', 'product_default']),
    edit_style_id: z.string().nullable(),
    ref: editStyleRefSchema.nullable(),
    revision_number: z.number().int().nullable(),
    content: editStyleContentSchema.nullable(),
    skipped: z.array(z.object({
      binding_scope: z.enum(['channel_default', 'actor_selection']),
      edit_style_id: z.string(),
      reason: z.enum(['not_accessible', 'style_archived', 'style_unpublished', 'style_missing', 'other_channel']),
    })),
  }),
  actor_capabilities: z.object({ set_channel_default: z.boolean(), select_own: z.boolean(), share_own_styles: z.boolean() }),
})
export type EditStyleChannelBindingState = z.infer<typeof bindingStateSchema>

export const editStylesQueryKey = (channelId: string, scope: 'own' | 'visible') => ['brand', 'edit-styles', channelId, scope] as const
export const editStyleBindingQueryKey = (channelId: string) => ['brand', 'edit-style-binding', channelId] as const

const one = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })
const listSchema = z.object({
  data: z.array(editStyleListItemSchema),
  meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }),
})

const base = '/api/v1/brand/edit-styles'
const styleUrl = (editStyleId: string) => `${base}/${encodeURIComponent(editStyleId)}`

/** One page of the channel's styles: the caller's own and (scope `visible`) the ones other members shared. */
export async function listEditStyles(input: {
  channelId: string
  scope?: 'own' | 'visible'
  cursor?: string | null
  limit?: number
  includeArchived?: boolean
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ channel_id: input.channelId, scope: input.scope ?? 'visible', limit: String(input.limit ?? 50) })
  if (input.cursor) params.set('cursor', input.cursor)
  if (input.includeArchived) params.set('include_archived', 'true')
  return gatewayRequest(`${base}?${params.toString()}`, { schema: listSchema, signal: input.signal })
}

export async function getEditStyle(editStyleId: string, options: { signal?: AbortSignal } = {}): Promise<EditStyle> {
  return (await gatewayRequest(styleUrl(editStyleId), { schema: one(editStyleSchema), signal: options.signal })).data
}

/** Omitted `content` starts from the product default policy. The request id makes a retry idempotent. */
export async function createEditStyle(input: { channelId: string; clientRequestId: string; name: string; content?: EditStyleContent }): Promise<EditStyle> {
  const response = await gatewayRequest(base, {
    method: 'POST',
    csrf: true,
    body: { channel_id: input.channelId, client_request_id: input.clientRequestId, name: input.name, ...(input.content && { content: input.content }) },
    schema: one(editStyleSchema),
  })
  return response.data
}

export async function updateEditStyleDraft(editStyleId: string, input: { expectedDraftVersion: number; name?: string; content?: EditStyleContent }): Promise<EditStyle> {
  const response = await gatewayRequest(`${styleUrl(editStyleId)}/draft`, {
    method: 'PUT',
    csrf: true,
    body: { expected_draft_version: input.expectedDraftVersion, ...(input.name !== undefined && { name: input.name }), ...(input.content && { content: input.content }) },
    schema: one(editStyleSchema),
  })
  return response.data
}

/** "Kaydet": the immutable revision of the exact draft version the screen saw. */
export async function publishEditStyleRevision(editStyleId: string, input: { expectedDraftVersion: number; idempotencyKey: string }): Promise<EditStyleRevision> {
  const response = await gatewayRequest(`${styleUrl(editStyleId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: { expected_draft_version: input.expectedDraftVersion, idempotency_key: input.idempotencyKey },
    schema: one(revisionSchema),
  })
  return response.data
}

export async function archiveEditStyle(editStyleId: string, input: { expectedDraftVersion: number }): Promise<EditStyle> {
  const response = await gatewayRequest(`${styleUrl(editStyleId)}/archive`, {
    method: 'POST',
    csrf: true,
    body: { expected_draft_version: input.expectedDraftVersion },
    schema: one(editStyleSchema),
  })
  return response.data
}

/** "Kanal üyeleriyle paylaş" / "Paylaşımı durdur" (owner only; CAS on the sharing version). */
export async function setEditStyleSharing(editStyleId: string, input: { shared: boolean; expectedAclVersion: number }): Promise<EditStyleSharingState> {
  const response = await gatewayRequest(`${styleUrl(editStyleId)}/sharing`, {
    method: 'PUT',
    csrf: true,
    body: { shared_with_channel_members: input.shared, expected_acl_version: input.expectedAclVersion },
    schema: one(sharingStateSchema),
  })
  return response.data
}

export async function getEditStyleChannelBinding(channelId: string, options: { signal?: AbortSignal } = {}): Promise<EditStyleChannelBindingState> {
  const response = await gatewayRequest(`/api/v1/brand/channels/${encodeURIComponent(channelId)}/edit-style-binding`, {
    schema: one(bindingStateSchema),
    signal: options.signal,
  })
  return response.data
}

/** Sets or clears (`editStyleId: null`) the channel default (owner/admin) or the caller's own selection. */
export async function setEditStyleChannelBinding(
  channelId: string,
  input: { scope: 'channel_default' | 'actor_selection'; editStyleId: string | null; expectedBindingVersion: number },
): Promise<EditStyleChannelBindingState> {
  const response = await gatewayRequest(`/api/v1/brand/channels/${encodeURIComponent(channelId)}/edit-style-binding`, {
    method: 'PUT',
    csrf: true,
    body: { binding_scope: input.scope, edit_style_id: input.editStyleId, expected_binding_version: input.expectedBindingVersion },
    schema: one(bindingStateSchema),
  })
  return response.data
}

/**
 * What a style says in a sentence for a chip/summary (no visual decision): the clean-up profile, whether captions are
 * added and whether media is Stock-only. Localization of these keys belongs to the picker that will show them.
 */
export function editStyleSummaryKeys(content: EditStyleContent): string[] {
  return [
    `silence:${content.rhythm.silence_cleanup}`,
    `fillers:${content.rhythm.filler_sounds}`,
    `captions:${content.captions.default}`,
    ...(content.media.stock_only ? ['media:stock_only'] : []),
    ...(content.rhythm.interstitials === 'never' ? ['interstitials:never'] : []),
    ...(content.rhythm.information_overlays === 'never' ? ['overlays:never'] : []),
  ]
}

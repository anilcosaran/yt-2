'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-01 Brand Library client: the server Brand Kit API (P02-02 kits, drafts, immutable revisions,
 * channel bindings; P06-01 sharing with the channel's members) and the P06-64 platform font list.
 * Product data lives only on the server: nothing here reads or writes browser storage.
 */

export const BRAND_KITS_QUERY_KEY = ['brand', 'kits'] as const
export const brandKitsQueryKey = (channelId: string) => [...BRAND_KITS_QUERY_KEY, channelId] as const
export const brandKitQueryKey = (kitId: string) => ['brand', 'kit', kitId] as const
export const brandKitBindingQueryKey = (channelId: string) => ['brand', 'kit-binding', channelId] as const
export const PLATFORM_FONTS_QUERY_KEY = ['brand', 'platform-fonts'] as const

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

export const brandKitColorsSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  tertiary: hexColor,
  accent: hexColor,
})

export const brandFontRefSchema = z.object({
  font_id: z.string(),
  font_revision: z.string(),
  sha256: z.string(),
})

const brandFontTokenSchema = z.object({
  family: z.string(),
  weight: z.number().int(),
  font_ref: brandFontRefSchema.nullable(),
})

const brandCaptionTokensSchema = z.object({
  style_name: z.string(),
  font_color: hexColor,
  highlight_color: hexColor,
  effect_color: hexColor,
})

/** `brand_kit_content_v1` draft body. `video_style` is kept opaque here and sent back unchanged. */
export const brandKitDraftContentSchema = z.object({
  schema_version: z.literal(1),
  colors: brandKitColorsSchema,
  fonts: z.object({ title: brandFontTokenSchema, body: brandFontTokenSchema }),
  captions: brandCaptionTokensSchema,
  logos: z.object({
    primary: z.object({ storage_object_id: z.string() }).nullable(),
    horizontal: z.object({ storage_object_id: z.string() }).nullable(),
    mark: z.object({ storage_object_id: z.string() }).nullable(),
  }),
  video_style: z.record(z.unknown()),
})

const revisionLogoSchema = z.object({ storage_object_id: z.string() }).passthrough().nullable()

export const brandKitRevisionContentSchema = brandKitDraftContentSchema.extend({
  logos: z.object({ primary: revisionLogoSchema, horizontal: revisionLogoSchema, mark: revisionLogoSchema }),
})

export const brandRevisionRefSchema = z.object({
  ref_type: z.literal('brand_revision'),
  brand_asset_kind: z.string(),
  brand_asset_id: z.string(),
  brand_revision_id: z.string(),
  brand_revision_digest_sha256: z.string(),
})

const headRevisionSchema = z.object({
  revision_id: z.string(),
  revision_number: z.number().int(),
  ref: brandRevisionRefSchema,
})

export const brandKitListItemSchema = z.object({
  kit_id: z.string(),
  origin: z.enum(['user', 'builtin']),
  name: z.string(),
  lifecycle_state: z.enum(['active', 'archived']),
  draft_version: z.number().int().nullable(),
  head_revision: headRevisionSchema.nullable(),
  updated_at: z.string(),
  access_role: z.enum(['owner', 'shared_reader', 'platform']),
  sharing: z.object({ acl_version: z.number().int(), shared_with_channel_members: z.boolean() }).nullable(),
  preview: z.object({
    colors: brandKitColorsSchema,
    title_font: z.object({ family: z.string(), weight: z.number().int() }),
    caption_style_name: z.string(),
  }).nullable(),
})

export const brandKitSchema = brandKitListItemSchema.extend({
  channel_id: z.string().nullable(),
  visibility: z.enum(['private', 'platform']),
  draft: z.object({ version: z.number().int(), content: brandKitDraftContentSchema }).nullable(),
  created_at: z.string(),
})

export const brandKitRevisionSchema = z.object({
  kit_id: z.string(),
  revision_id: z.string(),
  revision_number: z.number().int(),
  ref: brandRevisionRefSchema,
  content: brandKitRevisionContentSchema,
  created_at: z.string(),
})

const brandKitBindingSchema = z.object({
  binding_scope: z.enum(['channel_default', 'actor_selection']),
  kit_id: z.string().nullable(),
  restricted: z.boolean(),
  binding_version: z.number().int(),
  updated_at: z.string().nullable(),
  member_access: z.enum(['builtin', 'channel_members', 'owner_only']).nullable(),
})

export const brandKitBindingStateSchema = z.object({
  channel_id: z.string(),
  channel_default: brandKitBindingSchema,
  actor_selection: brandKitBindingSchema,
  effective: z.object({
    source: z.enum(['actor_selection', 'channel_default', 'builtin_default']),
    kit_id: z.string(),
    kit_name: z.string(),
    builtin: z.boolean(),
    revision_number: z.number().int(),
  }).passthrough(),
  actor_capabilities: z.object({
    set_channel_default: z.boolean(),
    select_own: z.boolean(),
    /** `BRAND_KIT_SHARING_ENABLED` (server release switch, default off) and the role may author Kits. */
    share_own_kits: z.boolean().catch(false),
  }),
})

export const brandKitSharingStateSchema = z.object({
  kit_id: z.string(),
  channel_id: z.string(),
  acl_version: z.number().int(),
  shared_with_channel_members: z.boolean(),
  changed: z.boolean(),
})

export const platformFontFaceSchema = z.object({
  font: brandFontRefSchema,
  family: z.string(),
  weight: z.number().int(),
  style: z.string(),
  status: z.string(),
}).passthrough()

export type BrandKitDraftContent = z.infer<typeof brandKitDraftContentSchema>
export type BrandKitListItem = z.infer<typeof brandKitListItemSchema>
export type BrandKitDetail = z.infer<typeof brandKitSchema>
export type BrandKitRevision = z.infer<typeof brandKitRevisionSchema>
export type BrandKitBindingState = z.infer<typeof brandKitBindingStateSchema>
export type BrandKitSharingState = z.infer<typeof brandKitSharingStateSchema>
export type BrandFontRef = z.infer<typeof brandFontRefSchema>
export type PlatformFontFace = z.infer<typeof platformFontFaceSchema>

const listResponseSchema = z.object({
  data: z.array(brandKitListItemSchema),
  meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }),
})
const kitResponseSchema = z.object({ data: brandKitSchema })
const revisionResponseSchema = z.object({ data: brandKitRevisionSchema })
const bindingStateResponseSchema = z.object({ data: brandKitBindingStateSchema })
const bindingResponseSchema = z.object({ data: brandKitBindingSchema })
const sharingResponseSchema = z.object({ data: brandKitSharingStateSchema })
const fontsResponseSchema = z.object({ data: z.object({ faces: z.array(platformFontFaceSchema) }).passthrough() })

/** Server page size of the Kit list and the number of pages the Brand screen reads (bounded). */
export const BRAND_KIT_PAGE_LIMIT = 50
export const BRAND_KIT_MAX_PAGES = 4

/** Every Kit card of a channel the actor may see (own + shared), built-in first; bounded pages. */
export async function listBrandKits(channelId: string, options: { signal?: AbortSignal } = {}): Promise<BrandKitListItem[]> {
  const items: BrandKitListItem[] = []
  let cursor: string | null = null
  for (let page = 0; page < BRAND_KIT_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ channel_id: channelId, limit: String(BRAND_KIT_PAGE_LIMIT) })
    if (cursor) params.set('cursor', cursor)
    const result = await gatewayRequest(`/api/v1/brand/kits?${params.toString()}`, { schema: listResponseSchema, signal: options.signal })
    items.push(...result.data)
    cursor = result.meta.next_cursor
    if (!cursor) break
  }
  return items
}

export async function getBrandKit(kitId: string, options: { signal?: AbortSignal } = {}): Promise<BrandKitDetail> {
  const result = await gatewayRequest(`/api/v1/brand/kits/${encodeURIComponent(kitId)}`, { schema: kitResponseSchema, signal: options.signal })
  return result.data
}

export async function createBrandKit(input: {
  channelId: string
  name: string
  clientRequestId: string
  content?: BrandKitDraftContent
}): Promise<BrandKitDetail> {
  const result = await gatewayRequest('/api/v1/brand/kits', {
    method: 'POST',
    csrf: true,
    body: {
      channel_id: input.channelId,
      client_request_id: input.clientRequestId,
      name: input.name,
      ...(input.content ? { content: input.content } : {}),
    },
    schema: kitResponseSchema,
  })
  return result.data
}

export async function updateBrandKitDraft(input: {
  kitId: string
  expectedDraftVersion: number
  name?: string
  content?: BrandKitDraftContent
}): Promise<BrandKitDetail> {
  const result = await gatewayRequest(`/api/v1/brand/kits/${encodeURIComponent(input.kitId)}/draft`, {
    method: 'PUT',
    csrf: true,
    body: {
      expected_draft_version: input.expectedDraftVersion,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
    },
    schema: kitResponseSchema,
  })
  return result.data
}

/**
 * "Kaydet": an immutable usable revision of the exact draft version (KARAR-BRAND §3.4; not a public
 * share). The idempotency key is derived from (Kit, draft version) so a retry never cuts a second one.
 */
export async function publishBrandKitRevision(input: { kitId: string; expectedDraftVersion: number }): Promise<BrandKitRevision> {
  const result = await gatewayRequest(`/api/v1/brand/kits/${encodeURIComponent(input.kitId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_draft_version: input.expectedDraftVersion,
      idempotency_key: brandKitPublishKey(input.kitId, input.expectedDraftVersion),
    },
    schema: revisionResponseSchema,
  })
  return result.data
}

export function brandKitPublishKey(kitId: string, draftVersion: number): string {
  return `brand-kit-save:${kitId}:${draftVersion}`.slice(0, 128)
}

export async function getBrandKitRevision(kitId: string, revisionId: string, options: { signal?: AbortSignal } = {}): Promise<BrandKitRevision> {
  const result = await gatewayRequest(
    `/api/v1/brand/kits/${encodeURIComponent(kitId)}/revisions/${encodeURIComponent(revisionId)}`,
    { schema: revisionResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getBrandKitBinding(channelId: string, options: { signal?: AbortSignal } = {}): Promise<BrandKitBindingState> {
  const result = await gatewayRequest(`/api/v1/brand/channels/${encodeURIComponent(channelId)}/kit-binding`, {
    schema: bindingStateResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function setBrandKitBinding(input: {
  channelId: string
  scope: 'channel_default' | 'actor_selection'
  kitId: string | null
  expectedBindingVersion: number
}) {
  const result = await gatewayRequest(`/api/v1/brand/channels/${encodeURIComponent(input.channelId)}/kit-binding`, {
    method: 'PUT',
    csrf: true,
    body: {
      binding_scope: input.scope,
      kit_id: input.kitId,
      expected_binding_version: input.expectedBindingVersion,
    },
    schema: bindingResponseSchema,
  })
  return result.data
}

export async function setBrandKitSharing(input: {
  kitId: string
  sharedWithChannelMembers: boolean
  expectedAclVersion: number
}): Promise<BrandKitSharingState> {
  const result = await gatewayRequest(`/api/v1/brand/kits/${encodeURIComponent(input.kitId)}/sharing`, {
    method: 'PUT',
    csrf: true,
    body: {
      shared_with_channel_members: input.sharedWithChannelMembers,
      expected_acl_version: input.expectedAclVersion,
    },
    schema: sharingResponseSchema,
  })
  return result.data
}

/** The P06-64 platform font catalogue (active faces, picker order). */
export async function listPlatformFonts(options: { signal?: AbortSignal } = {}): Promise<PlatformFontFace[]> {
  const result = await gatewayRequest('/api/v1/brand/fonts', { schema: fontsResponseSchema, signal: options.signal })
  return result.data.faces.filter((face) => face.status === 'active')
}

/** A fresh client request id for "create Kit" (the server replays the same id). */
export function newBrandKitClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `kit-${crypto.randomUUID()}`
  return `kit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

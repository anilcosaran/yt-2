'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P02-09 personal media library client (`GET /api/v1/media-catalog/library`, `media_library_card_v1`): the channel's own
 * visible Storage media (image / video / audio, uploads and generated results alike), newest first, keyset-paged, with
 * a readiness state, the allowed actions and a preview hint. Cards never carry a URL: a visible card asks the Storage
 * batch delivery path for its own short-lived preview (P02-14).
 */

export const mediaLibraryKinds = ['image', 'video', 'audio'] as const
export type MediaLibraryKind = (typeof mediaLibraryKinds)[number]

const cardSchema = z
  .object({
    schema_version: z.literal('media_library_card_v1'),
    source: z.string(),
    asset: z
      .object({
        ref_type: z.literal('storage_object'),
        storage_object_id: z.string().min(1),
        checksum_sha256: z.string().nullable().catch(null),
        media_kind: z.enum(mediaLibraryKinds),
      })
      .passthrough(),
    title: z.string().catch(''),
    mime_type: z.string().catch(''),
    size_bytes: z.string().catch('0'),
    duration_seconds: z.number().nullable().catch(null),
    created_at: z.string().catch(''),
    provenance: z.object({ origin: z.string().catch('upload') }).passthrough(),
    readiness: z.object({ state: z.enum(['ready', 'processing', 'unavailable']).catch('unavailable'), reason: z.string().catch('') }).passthrough(),
    allowed_actions: z.array(z.string()).catch([]),
    preview: z.object({ variant: z.enum(['thumbnail', 'original', 'none']).catch('none') }).passthrough(),
  })
  .passthrough()

const pageSchema = z.object({
  data: z.array(cardSchema).catch([]),
  meta: z
    .object({
      source_status: z.string().catch('available'),
      next_cursor: z.string().nullable().catch(null),
    })
    .passthrough(),
})

export type MediaLibraryCard = z.output<typeof cardSchema>
export type MediaLibraryPageResponse = z.output<typeof pageSchema>

export async function listMediaLibrary(
  input: { channelId: string; kind?: MediaLibraryKind; query?: string; limit?: number; cursor?: string | null },
  options: { signal?: AbortSignal } = {},
): Promise<MediaLibraryPageResponse> {
  const params = new URLSearchParams({ channel_id: input.channelId, source: 'personal', limit: String(input.limit ?? 24) })
  if (input.kind) params.set('kind', input.kind)
  if (input.query?.trim()) params.set('q', input.query.trim().slice(0, 100))
  if (input.cursor) params.set('cursor', input.cursor)
  return gatewayRequest(`/api/v1/media-catalog/library?${params.toString()}`, { schema: pageSchema, signal: options.signal })
}

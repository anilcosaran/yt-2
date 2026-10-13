'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-17..20 Community member client (`/api/v1/community`, login only). Cards never carry a URL: a visible card asks for
 * its own short-lived preview. Product data is never kept in browser storage. The Community screens themselves are a
 * pending UI decision; this client and the notices are the non-visual parts.
 */
const BASE = '/api/v1/community'

const quotaEntrySchema = z.object({ limit: z.number().int().min(0), used: z.number().int().min(0), remaining: z.number().int().min(0) })
const quotaSchema = z.object({
  data: z.object({
    quota: z.object({
      day: z.string(),
      reset_at: z.string(),
      verified: z.boolean(),
      publish: quotaEntrySchema,
      like: quotaEntrySchema,
    }).passthrough(),
  }),
})
export type CommunityQuota = z.output<typeof quotaSchema>['data']['quota']

const likeSchema = z.object({ data: z.object({ like: z.object({ post_id: z.string(), liked: z.boolean(), like_count: z.number().int().min(0) }) }) })
export type CommunityLike = z.output<typeof likeSchema>['data']['like']

export async function getCommunityQuota(options: { signal?: AbortSignal } = {}): Promise<CommunityQuota> {
  const response = await gatewayRequest(`${BASE}/me/quota`, { schema: quotaSchema, signal: options.signal })
  return response.data.quota
}

/** Desired-state like (`PUT`) / unlike (`DELETE`); a refused new like throws the quota error (see `communityNotice`). */
export async function setCommunityLike(postId: string, liked: boolean): Promise<CommunityLike> {
  const response = await gatewayRequest(`${BASE}/posts/${encodeURIComponent(postId)}/like`, {
    method: liked ? 'PUT' : 'DELETE',
    csrf: true,
    schema: likeSchema,
  })
  return response.data.like
}

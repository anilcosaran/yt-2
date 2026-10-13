'use client'

import { z } from 'zod'

import { gatewayConditionalRequest, gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-06 Brand Motion library client: the single typed catalogue (`motion-library@1` revisions — P06-06
 * seeds and the P06-37 platform library). The server keeps it behind `BRAND_MOTION_TYPED_SEEDS_ENABLED`
 * (403 while off); code authoring is a separate gate and is never available before the isolated runner (P06-10).
 */

export const BRAND_MOTIONS_QUERY_KEY = ['brand', 'motions'] as const

const localized = z.object({ en: z.string(), tr: z.string() })

export const brandMotionListItemSchema = z.object({
  motion_id: z.string(),
  origin: z.literal('builtin'),
  collection: z.enum(['brand_seed', 'motion_library_v1', 'premium_film']),
  source_kind: z.literal('typed_seed'),
  library_version: z.literal('motion-library@1'),
  blueprint_ref: z.string(),
  title: localized,
  summary: z.string(),
  roles: z.array(z.string()),
  aspect_ratios: z.array(z.enum(['16:9', '9:16', '1:1'])),
  energies: z.array(z.enum(['sakin', 'dengeli', 'canli'])),
  duration_range: z.object({ min_frames: z.number().int(), max_frames: z.number().int() }),
  timing: z.object({ enter: z.string(), hold: z.string(), exit: z.string() }),
  parameters: z.array(z.object({ parameter_id: z.string(), kind: z.string(), spark_editable: z.boolean(), required: z.boolean() }).passthrough()),
  sample_values: z.record(z.union([z.string(), z.number()])),
  alternatives: z.array(z.string()),
  /** Y1R-TOOLS-1: a PREMIUM platform Motion the workspace did not buy: a shop window without parameters, samples and timing. */
  content_locked: z.boolean().optional(),
  head_revision: z.object({
    revision_id: z.string(),
    revision_number: z.number().int(),
    ref: z.object({ motion_id: z.string(), motion_revision_id: z.string(), scope: z.literal('library'), manifest_sha256: z.string() }),
  }).passthrough(),
})

export type BrandMotionListItem = z.infer<typeof brandMotionListItemSchema>

const listResponseSchema = z.object({
  data: z.array(brandMotionListItemSchema),
  meta: z.object({
    authoring: z.object({
      typed_seeds: z.boolean(),
      code_authoring: z.object({ enabled: z.boolean(), available: z.boolean(), reason: z.string() }),
    }),
  }),
})

export async function listBrandMotions(options: { signal?: AbortSignal } = {}) {
  return gatewayRequest('/api/v1/brand/motions', { schema: listResponseSchema, signal: options.signal })
}

export type BrandMotionListResponse = z.output<typeof listResponseSchema>

/** WP4: a list read that revalidates the copy the caller holds (in memory, never browser storage). */
export type BrandMotionListRead = (BrandMotionListResponse & { etag?: string | null; notModified?: false }) | { notModified: true; etag: string | null }

/**
 * WP4: the catalogue read with `If-None-Match`: the gateway answers 304 (no body) while the cards the caller holds are still
 * the ones it would send (the catalogue ships with the service; the ETag also covers the workspace's premium purchases).
 */
export async function listBrandMotionsConditional(options: { signal?: AbortSignal; ifNoneMatch?: string | null } = {}): Promise<BrandMotionListRead> {
  const result = await gatewayConditionalRequest('/api/v1/brand/motions', { schema: listResponseSchema, signal: options.signal, ifNoneMatch: options.ifNoneMatch ?? null })
  return result.notModified ? { notModified: true, etag: result.etag } : { ...result.data, etag: result.etag }
}

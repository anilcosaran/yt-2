'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-15/16 platform Stock catalogue client (`/api/v1/media-catalog`). Cards never carry a URL: a visible card asks for
 * its own short-lived grid preview. Product data is never kept in browser storage.
 */
const BASE = '/api/v1/media-catalog'

/** The Spark Media drawer's (pixel) kinds; P06-40 audio kinds (`music`, `sfx`) are catalogue kinds it does not show. */
export const stockKinds = ['image', 'video'] as const
export type StockKind = (typeof stockKinds)[number]
export const stockCatalogKinds = ['image', 'video', 'music', 'sfx'] as const
export type StockCatalogKind = (typeof stockCatalogKinds)[number]

export function isStockDrawerKind(kind: string): kind is StockKind {
  return (stockKinds as readonly string[]).includes(kind)
}

const categorySchema = z.object({
  id: z.string().min(1),
  // Unknown kinds of a newer catalogue are dropped, never a parse failure of the whole status.
  kinds: z.array(z.string()).catch([]).transform((kinds) => kinds.filter(isStockDrawerKind)),
})

const stockStatusSchema = z.object({
  data: z.object({
    source_status: z.enum(['available', 'unavailable']).catch('unavailable'),
    taxonomy_version: z.number().int().catch(1),
    categories: z.array(categorySchema).catch([]),
  }),
})
export type StockStatus = z.output<typeof stockStatusSchema>['data']
export type StockCategory = z.output<typeof categorySchema>

const stockCardSchema = z
  .object({
    item_id: z.string().regex(/^stk_[0-9a-f-]{36}$/),
    revision: z.number().int().min(1),
    kind: z.enum(stockCatalogKinds),
    title: z.string().nullable().catch(null),
    description: z.string().nullable().catch(null),
    category_id: z.string().nullable().catch(null),
    orientation: z.string().nullable().catch(null),
    width: z.number().int().positive().nullable().catch(null),
    height: z.number().int().positive().nullable().catch(null),
    duration_ms: z.number().int().positive().nullable().catch(null),
    price_credits: z.number().int().min(0),
    is_free: z.boolean(),
    license: z
      .object({
        allowed_uses: z.array(z.string()).catch([]),
        attribution_required: z.boolean().catch(false),
        attribution_text: z.string().nullable().catch(null),
      })
      .passthrough()
      .nullable()
      .catch(null),
    preview: z.object({ variant: z.enum(['original', 'thumbnail']), purpose: z.enum(['grid', 'playback']) }),
    allowed_actions: z.array(z.string()).catch([]),
  })
  .passthrough()
export type StockCatalogCard = z.output<typeof stockCardSchema>
/** A card the Media drawer shows (pixel kinds only). */
export type StockCard = StockCatalogCard & { kind: StockKind }

const stockPageSchema = z.object({
  data: z.array(stockCardSchema),
  meta: z.object({
    source_status: z.enum(['available', 'unavailable']),
    next_cursor: z.string().nullable(),
    limit: z.number().int(),
  }).passthrough(),
})
export type StockPage = { items: StockCard[]; sourceStatus: 'available' | 'unavailable'; nextCursor: string | null }

const previewSchema = z.object({
  data: z.object({ preview: z.object({ url: z.string().url(), expires_at: z.string(), variant: z.enum(['original', 'thumbnail']) }) }),
})
export type StockPreview = z.output<typeof previewSchema>['data']['preview']

export const stockAcquisitionStates = ['requested', 'reserving', 'entitling', 'copying', 'attaching', 'ready', 'failed'] as const
const acquisitionSchema = z
  .object({
    acquisition_id: z.string().regex(/^sacq_[0-9a-f-]{36}$/),
    item_id: z.string(),
    revision: z.number().int(),
    project_id: z.string().nullable(),
    state: z.enum(stockAcquisitionStates),
    reason_code: z.string().nullable(),
    price_credits: z.number().int(),
    source_id: z.string().nullable(),
  })
  .passthrough()
export type StockAcquisition = z.output<typeof acquisitionSchema>

const startSchema = z.object({ data: z.object({ acquisition: acquisitionSchema, created: z.boolean() }) })
const acquisitionEnvelopeSchema = z.object({ data: z.object({ acquisition: acquisitionSchema }) })

export async function getStockStatus(options: { signal?: AbortSignal } = {}): Promise<StockStatus> {
  const response = await gatewayRequest(`${BASE}/stock-status`, { schema: stockStatusSchema, signal: options.signal })
  return response.data
}

export async function searchStock(
  filter: { kind?: StockKind; category?: string; q?: string; cursor?: string; limit?: number },
  options: { signal?: AbortSignal } = {},
): Promise<StockPage> {
  const query = new URLSearchParams()
  // P06-40: "All" in the drawer means all pixel kinds; audio records never enter these pages.
  if (filter.kind) query.set('kind', filter.kind)
  else query.set('kinds', stockKinds.join(','))
  if (filter.category) query.set('category', filter.category)
  const q = filter.q?.trim()
  if (q) query.set('q', q.slice(0, 100))
  if (filter.cursor) query.set('cursor', filter.cursor)
  query.set('limit', String(filter.limit ?? 24))
  const response = await gatewayRequest(`${BASE}/items?${query.toString()}`, { schema: stockPageSchema, signal: options.signal })
  const items = response.data.filter((card): card is StockCard => isStockDrawerKind(card.kind))
  return { items, sourceStatus: response.meta.source_status, nextCursor: response.meta.next_cursor }
}

export async function previewStock(itemId: string, revision: number, options: { signal?: AbortSignal } = {}): Promise<StockPreview> {
  const response = await gatewayRequest(`${BASE}/items/${encodeURIComponent(itemId)}/preview`, {
    method: 'POST',
    csrf: true,
    body: { revision },
    schema: previewSchema,
    signal: options.signal,
  })
  return response.data.preview
}

export async function startStockAcquisition(input: {
  itemId: string
  revision: number
  projectId: string
  intentKey: string
}): Promise<StockAcquisition> {
  const response = await gatewayRequest(`${BASE}/acquisitions`, {
    method: 'POST',
    csrf: true,
    body: { item_id: input.itemId, revision: input.revision, project_id: input.projectId, intent_key: input.intentKey },
    schema: startSchema,
  })
  return response.data.acquisition
}

export async function getStockAcquisition(acquisitionId: string, options: { signal?: AbortSignal } = {}): Promise<StockAcquisition> {
  const response = await gatewayRequest(`${BASE}/acquisitions/${encodeURIComponent(acquisitionId)}`, {
    schema: acquisitionEnvelopeSchema,
    signal: options.signal,
  })
  return response.data.acquisition
}

export type StockTransport = {
  status: typeof getStockStatus
  search: typeof searchStock
  preview: typeof previewStock
  startAcquisition: typeof startStockAcquisition
  getAcquisition: typeof getStockAcquisition
}

export const stockGatewayTransport: StockTransport = {
  status: getStockStatus,
  search: searchStock,
  preview: previewStock,
  startAcquisition: startStockAcquisition,
  getAcquisition: getStockAcquisition,
}

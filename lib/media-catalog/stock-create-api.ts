'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-40 "Stock'ta Oluştur" client (`/api/v1/media-catalog/stock-create*`, `/stock-creations`). The server decides which
 * kinds are creatable (catalogue-enabled node + model), prices the exact request (Workflow estimate) and refuses a
 * changed price; the result is the user's own media. Nothing is kept in browser storage.
 */
const BASE = '/api/v1/media-catalog'

export const stockCreateKinds = ['image', 'video'] as const
export type StockCreateKind = (typeof stockCreateKinds)[number]
export const stockCreateRatios = ['16:9', '9:16', '1:1'] as const
export type StockCreateRatio = (typeof stockCreateRatios)[number]

const kindAvailabilitySchema = z.object({
  kind: z.string(),
  available: z.boolean(),
  reason: z.string().nullable().catch(null),
  default_model_id: z.string().nullable().catch(null),
  models: z.array(z.object({ model_id: z.string(), label: z.string() }).passthrough()).catch([]),
})
export type StockCreateKindAvailability = z.output<typeof kindAvailabilitySchema>

const availabilitySchema = z.object({ data: z.object({ kinds: z.array(kindAvailabilitySchema).catch([]) }) })
const quoteSchema = z.object({ data: z.object({ quote: z.object({ credits: z.number().min(0), model_id: z.string() }).passthrough() }) })

export const stockCreationStates = ['launching', 'running', 'attaching', 'ready', 'failed'] as const
const creationSchema = z
  .object({
    creation_id: z.string().regex(/^scr_[0-9a-f-]{36}$/),
    kind: z.string(),
    state: z.enum(stockCreationStates),
    reason_code: z.string().nullable().catch(null),
    quoted_credits: z.number(),
    source_id: z.string().nullable().catch(null),
  })
  .passthrough()
export type StockCreation = z.output<typeof creationSchema>

const startSchema = z.object({ data: z.object({ creation: creationSchema, created: z.boolean() }) })
const creationEnvelopeSchema = z.object({ data: z.object({ creation: creationSchema }) })

export type StockCreateRequest = {
  kind: StockCreateKind
  modelId: string
  prompt: string
  ratio: StockCreateRatio
  projectId: string
}

function body(input: StockCreateRequest): Record<string, unknown> {
  return {
    kind: input.kind,
    model_id: input.modelId,
    prompt: input.prompt,
    aspect_ratio: input.ratio,
    project_id: input.projectId,
    ...(input.kind === 'video' ? { duration_seconds: 5 } : {}),
  }
}

export async function getStockCreateAvailability(options: { signal?: AbortSignal } = {}): Promise<StockCreateKindAvailability[]> {
  const response = await gatewayRequest(`${BASE}/stock-create/availability`, { schema: availabilitySchema, signal: options.signal })
  return response.data.kinds
}

export async function quoteStockCreation(input: StockCreateRequest, options: { signal?: AbortSignal } = {}): Promise<number> {
  const response = await gatewayRequest(`${BASE}/stock-create/quote`, { method: 'POST', csrf: true, body: body(input), schema: quoteSchema, signal: options.signal })
  return response.data.quote.credits
}

export async function startStockCreation(input: StockCreateRequest & { intentKey: string; expectedCredits: number }): Promise<StockCreation> {
  const response = await gatewayRequest(`${BASE}/stock-creations`, {
    method: 'POST',
    csrf: true,
    body: { ...body(input), intent_key: input.intentKey, expected_credits: input.expectedCredits },
    schema: startSchema,
  })
  return response.data.creation
}

export async function getStockCreation(creationId: string, options: { signal?: AbortSignal } = {}): Promise<StockCreation> {
  const response = await gatewayRequest(`${BASE}/stock-creations/${encodeURIComponent(creationId)}`, { schema: creationEnvelopeSchema, signal: options.signal })
  return response.data.creation
}

export type StockCreateTransport = {
  availability: typeof getStockCreateAvailability
  quote: typeof quoteStockCreation
  start: typeof startStockCreation
  get: typeof getStockCreation
}

export const stockCreateGatewayTransport: StockCreateTransport = {
  availability: getStockCreateAvailability,
  quote: quoteStockCreation,
  start: startStockCreation,
  get: getStockCreation,
}

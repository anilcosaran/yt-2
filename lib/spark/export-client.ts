import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Y1-07 W10: the browser's client of the Spark export routes (`/api/v1/composition/projects/{id}/exports/...`): the
 * price (quote), the export command (the click is the G2 decision of the exact price shown), the job status and the cancel
 * command. Coded against the status shape of the gateway on `main` AND the extended shape of the render gateway (Y1-06,
 * `docs: handoff render-contract.md`): the additive fields (`render_lane`, `progress_percent`, `cancel_requested`,
 * `queue.lane/scope/expires_at`, `render_plan`, status `cancelled`) are optional here, so the same client reads both
 * and the dialog shows what the server says without guessing.
 */

export const sparkExportOutputProfile = 'spark-export-v1'

export const sparkExportStatuses = [
  'authorizing',
  'queued',
  'dispatching',
  'rendering',
  'completed',
  'failed',
  'renderer_unavailable',
  'funding_required',
  'cancelled',
] as const
export type SparkExportStatus = (typeof sparkExportStatuses)[number]

export const sparkExportTerminalStatuses: ReadonlySet<SparkExportStatus> = new Set([
  'completed',
  'failed',
  'renderer_unavailable',
  'funding_required',
  'cancelled',
])

export const sparkExportLanes = ['fast', 'slow'] as const
export type SparkExportLane = (typeof sparkExportLanes)[number]
export const sparkExportQueueScopes = ['daily_limit', 'tenant', 'fleet'] as const

const rational = z.object({ num: z.number().int().positive(), den: z.number().int().positive() })
const canvas = z.object({ width: z.number().int().positive(), height: z.number().int().positive(), fps: rational })
const rendererPin = z.object({ renderer_id: z.string(), renderer_revision: z.string(), profile_revision: z.string() }).passthrough()

/** `composition_export_quote_v1`: the price of the exact working copy the user is looking at. */
export const sparkExportQuoteSchema = z.object({
  schema_version: z.literal('composition_export_quote_v1'),
  project_id: z.string(),
  working_copy_version: z.number().int().min(0),
  document_sha256: z.string(),
  output_profile: z.string(),
  renderer_pin: rendererPin,
  canvas,
  output_frames: z.number().int().min(0),
  output_seconds: z.number().min(0),
  billable_output_seconds: z.number().min(0),
  credits_per_output_second: z.number().min(0),
  estimated_credits: z.number().min(0),
  credit_billed_seconds: z.number().min(0),
  max_output_seconds: z.number().min(0),
  pricing_version: z.string(),
  renderer: z.object({ available: z.boolean(), reason: z.string().nullable() }),
  /** Y1-06: the lane the engine classified for this export; absent/null on a gateway without the preflight. */
  render_plan: z
    .object({
      lane: z.enum(sparkExportLanes),
      queue: z.string(),
      classification_reason: z.string(),
      inputs: z.object({
        output_seconds: z.number(),
        scene_count: z.number().int(),
        inline_asset_bytes: z.number().int(),
        video_layer_count: z.number().int(),
      }),
    })
    .nullable()
    .optional(),
  quote_sha256: z.string().regex(/^[0-9a-f]{64}$/),
})
export type SparkExportQuote = z.output<typeof sparkExportQuoteSchema>

/** `composition_export_v1`: one export job. Billing ids and the workflow identity never reach the browser. */
export const sparkExportSchema = z.object({
  schema_version: z.literal('composition_export_v1'),
  export_id: z.string(),
  project_id: z.string(),
  revision_id: z.string(),
  attempt: z.number().int(),
  status: z.enum(sparkExportStatuses),
  output_profile: z.string(),
  canvas,
  output_frames: z.number().int().min(0),
  price: z.object({
    output_seconds: z.number(),
    billable_output_seconds: z.number(),
    credits_per_output_second: z.number(),
    estimated_credits: z.number(),
    credit_billed_seconds: z.number(),
    quote_sha256: z.string(),
  }),
  /**
   * The export is waiting. `retry_at`: the daily export minutes (P05-13) free up then. Y1-06: `lane`, `scope` and
   * `expires_at` (when the wait ends with a typed failure) say who/what it waits for.
   */
  queue: z
    .object({
      reason: z.string(),
      retry_at: z.string().nullable(),
      lane: z.enum(sparkExportLanes).nullable().optional(),
      scope: z.enum(sparkExportQueueScopes).nullable().optional(),
      expires_at: z.string().nullable().optional(),
    })
    .nullable(),
  render_lane: z.enum(sparkExportLanes).nullable().optional(),
  progress_percent: z.number().min(0).max(100).nullable().optional(),
  cancel_requested: z.boolean().optional(),
  error: z.object({ code: z.string(), context: z.record(z.string(), z.unknown()) }).nullable(),
  output: z
    .object({
      storage_object_id: z.string(),
      url: z.string().nullable(),
      checksum_sha256: z.string(),
      size_bytes: z.number().int().min(0),
      total_frames: z.number().int().min(0),
      output_seconds: z.number().min(0),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
})
export type SparkExport = z.output<typeof sparkExportSchema>

const quoteResponseSchema = z.object({ data: sparkExportQuoteSchema })
const exportResponseSchema = z.object({ data: sparkExportSchema })
const requestResponseSchema = z.object({ data: z.object({ export: sparkExportSchema, duplicate: z.boolean() }) })

export type SparkExportRequest = {
  idempotencyKey: string
  seenWorkingCopyVersion: number
  outputProfile: string
  acceptedQuoteSha256: string
}

export type SparkExportClient = {
  getQuote(projectId: string, options?: { outputProfile?: string; signal?: AbortSignal }): Promise<SparkExportQuote>
  request(projectId: string, input: SparkExportRequest, options?: { signal?: AbortSignal }): Promise<{ export: SparkExport; duplicate: boolean }>
  get(projectId: string, exportId: string, options?: { signal?: AbortSignal }): Promise<SparkExport>
  cancel(projectId: string, exportId: string, options?: { signal?: AbortSignal }): Promise<SparkExport>
}

function exportsPath(projectId: string, suffix = '') {
  return `/api/v1/composition/projects/${encodeURIComponent(projectId)}/exports${suffix}`
}

export const sparkExportGatewayClient: SparkExportClient = {
  async getQuote(projectId, options = {}) {
    const profile = encodeURIComponent(options.outputProfile ?? sparkExportOutputProfile)
    const response = await gatewayRequest(exportsPath(projectId, `/quote?output_profile=${profile}`), {
      schema: quoteResponseSchema,
      signal: options.signal,
    })
    return response.data
  },

  async request(projectId, input, options = {}) {
    const response = await gatewayRequest(exportsPath(projectId), {
      method: 'POST',
      csrf: true,
      body: {
        idempotency_key: input.idempotencyKey,
        seen_working_copy_version: input.seenWorkingCopyVersion,
        output_profile: input.outputProfile,
        accepted_quote_sha256: input.acceptedQuoteSha256,
      },
      schema: requestResponseSchema,
      signal: options.signal,
    })
    return response.data
  },

  async get(projectId, exportId, options = {}) {
    const response = await gatewayRequest(exportsPath(projectId, `/${encodeURIComponent(exportId)}`), {
      schema: exportResponseSchema,
      signal: options.signal,
    })
    return response.data
  },

  async cancel(projectId, exportId, options = {}) {
    const response = await gatewayRequest(exportsPath(projectId, `/${encodeURIComponent(exportId)}/cancel`), {
      method: 'POST',
      csrf: true,
      schema: exportResponseSchema,
      signal: options.signal,
    })
    return response.data
  },
}

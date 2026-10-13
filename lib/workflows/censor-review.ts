import { z } from 'zod'
import { gatewayRequest } from '@/lib/gateway/client'

const interval = z.object({ start_sec: z.number(), end_sec: z.number() })
export const censorReviewSchema = z.object({
  object_id: z.string(), revision: z.number(), completed_revision: z.number(),
  completed_output_object_id: z.string(), completed_status: z.string().nullable(),
  source_storage_object_id: z.string(), source_duration_sec: z.number(),
  subtitles_available: z.boolean().default(false),
  completed_summary: z.object({ applied_count: z.number() }).nullable().optional(),
  source_spans: z.array(interval).default([]),
  options: z.record(z.unknown()), reason_codes: z.array(z.string()),
  events: z.array(z.object({ event_id: z.string(), source_interval: interval.nullable(),
    decision: z.enum(['censor', 'ignore']), reason_code: z.string().nullable(),
    timing_provenance: z.string(), context: z.string().nullable(), output_intervals: z.array(interval).default([]) })),
  total: z.number(), limit: z.number(), offset: z.number(), has_more: z.boolean(),
})
export type CensorReview = z.infer<typeof censorReviewSchema>
export type CensorOperation =
  | { action: 'ignore' | 'restore'; event_id: string }
  | { action: 'adjust'; event_id: string; start_sec: number; end_sec: number }
  | { action: 'add'; start_sec: number; end_sec: number }
  | { action: 'disable' }

function url(channelId: string, objectId: string) {
  return `/api/v1/storage/channels/${encodeURIComponent(channelId)}/objects/${encodeURIComponent(objectId)}/censor-review`
}
export async function getCensorReview(channelId: string, objectId: string, offset = 0, signal?: AbortSignal, revision?: number) {
  return (await gatewayRequest(`${url(channelId, objectId)}?offset=${offset}${revision === undefined ? '' : `&revision=${revision}`}`, { signal, schema: z.object({ data: censorReviewSchema }) })).data
}
export async function getCensorSubtitles(channelId: string, objectId: string, format: 'srt' | 'vtt') {
  const path = url(channelId, objectId).replace(/censor-review$/, 'censor-subtitles')
  return (await gatewayRequest(`${path}?format=${format}`, { schema: z.object({ data: z.object({ revision: z.number(), file_name: z.string(), text: z.string() }) }) })).data
}

export async function saveCensorReview(channelId: string, objectId: string, revision: number, operations: CensorOperation[], idempotencyKey: string) {
  return (await gatewayRequest(url(channelId, objectId), { method: 'PATCH', csrf: true,
    body: { expected_revision: revision, operations, idempotency_key: idempotencyKey },
    schema: z.object({ data: z.object({ object_id: z.string(), revision: z.number(), completed_revision: z.number(), idempotent: z.boolean() }) }),
  })).data
}

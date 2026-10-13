import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { gatewayRequest, getGatewayCsrfToken, invalidateGatewayCsrfToken } from '@/lib/gateway/client'

/**
 * P03-24 quick AI lane (lane B) client for the Spark editor (QA-068). One request streams as SSE:
 * `accepted`, `progress`, then `suggestion` + `usage`, or `handoff` / `approval_required` / `funding_required` /
 * `error`, and finally `done`. Refusals before anything runs (invalid body, idempotency conflict, rate or
 * concurrency limit) are plain HTTP errors. The suggestion never edits the project: the editor applies its
 * command draft through the normal Composition command path after the user accepts it.
 */

export const SPARK_QUICK_AI_REQUESTS_PATH = '/api/v1/spark-quick-ai/requests'

/** The P03-24 request limits the editor enforces before sending (the gateway checks them again). */
export const SPARK_QUICK_AI_TEXT_MAX_CHARS = 2000
export const SPARK_QUICK_AI_INSTRUCTION_MAX_CHARS = 1000

export type SparkQuickAiTarget = { scene_id: string; layer_id: string }

/** `spark_quick_ai_request.v1` of a text rewrite on one text layer of the working copy the user saw. */
export type SparkQuickAiTextRewriteRequest = {
  schema: 'spark_quick_ai_request.v1'
  idempotency_key: string
  operation: 'text_rewrite'
  project_id: string
  edit_session_id: string
  model_id: string | null
  input: {
    text: string
    instruction: string | null
    target: SparkQuickAiTarget
    base_revision: number
    candidate_count: number
  }
}

const commandDraftSchema = z.object({
  base_revision: z.number().int().min(0),
  targets: z.array(z.object({ entity_kind: z.string(), entity_id: z.string() })),
  undo_policy: z.string(),
  ops: z.array(z.record(z.string(), z.unknown())),
})

const suggestionSchema = z.object({
  request_id: z.string(),
  operation: z.string(),
  summary: z.string(),
  result: z.object({ operation: z.string() }).passthrough(),
  command: commandDraftSchema.nullable(),
})

const receiptSchema = z.object({
  request_id: z.string(),
  funding_source: z.enum(['quota', 'credits']),
  charged_credits: z.number(),
  quota_credits: z.number(),
  settlement: z.enum(['settled', 'abandoned']),
}).passthrough()

const eventSchemas = {
  accepted: z.object({ request_id: z.string(), replayed: z.boolean().catch(false) }),
  progress: z.object({ request_id: z.string(), received_chars: z.number().int().min(0) }),
  suggestion: z.object({ suggestion: suggestionSchema }),
  usage: z.object({ receipt: receiptSchema }),
  handoff: z.object({ request_id: z.string(), reason: z.string(), expected_seconds: z.number() }),
  approval_required: z.object({
    request_id: z.string(),
    edit_session_id: z.string(),
    review_request_id: z.string(),
    requested_max_credits: z.number().positive(),
  }),
  funding_required: z.object({ request_id: z.string() }),
  error: z.object({ request_id: z.string(), code: z.string(), retryable: z.boolean().catch(false) }),
  done: z.object({ request_id: z.string() }),
} as const

type EventSchemas = typeof eventSchemas
export type SparkQuickAiEventType = keyof EventSchemas
export type SparkQuickAiEvent = {
  [K in SparkQuickAiEventType]: { type: K } & z.output<EventSchemas[K]>
}[SparkQuickAiEventType]
export type SparkQuickAiSuggestion = z.output<typeof suggestionSchema>

/** A request the gateway refused before streaming (HTTP 4xx/5xx); nothing ran and nothing was charged. */
export class SparkQuickAiRejectedError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`Spark quick AI request rejected: ${code}`)
    this.name = 'SparkQuickAiRejectedError'
  }

  /** Limits and a busy admission are worth another try; an invalid or conflicting request is not. */
  get retryable(): boolean {
    return this.status === 429 || this.status === 503 || this.code === 'quick_ai_request_in_progress'
  }
}

/** Parses one SSE block (`event:` + `data:` lines) into a typed event; unknown or malformed blocks are dropped. */
export function parseSparkQuickAiEvent(block: string): SparkQuickAiEvent | null {
  let name: string | null = null
  const data: string[] = []
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') name = value
    else if (field === 'data') data.push(value)
  }
  if (!name || !(name in eventSchemas) || data.length === 0) return null
  try {
    const parsed = eventSchemas[name as SparkQuickAiEventType].safeParse(JSON.parse(data.join('\n')))
    return parsed.success ? ({ type: name, ...parsed.data } as SparkQuickAiEvent) : null
  } catch {
    return null
  }
}

/** Splits a growing SSE text into complete blocks; the unfinished tail stays for the next chunk. */
export class SparkQuickAiSseReader {
  private buffer = ''

  push(chunk: string): SparkQuickAiEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n')
    const events: SparkQuickAiEvent[] = []
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const event = parseSparkQuickAiEvent(this.buffer.slice(0, boundary))
      if (event) events.push(event)
      this.buffer = this.buffer.slice(boundary + 2)
      boundary = this.buffer.indexOf('\n\n')
    }
    return events
  }
}

async function readRejection(response: Response): Promise<SparkQuickAiRejectedError> {
  let code = 'quick_ai_failed'
  let retryAfter: number | null = null
  try {
    const payload = (await response.json()) as { error?: { code?: unknown; retry_after_seconds?: unknown } }
    if (typeof payload.error?.code === 'string') code = payload.error.code
    if (typeof payload.error?.retry_after_seconds === 'number') retryAfter = payload.error.retry_after_seconds
  } catch {
    // A body that is not the gateway's error shape keeps the generic code.
  }
  const header = Number(response.headers.get('retry-after'))
  if (retryAfter === null && Number.isFinite(header) && header > 0) retryAfter = header
  return new SparkQuickAiRejectedError(code, response.status, retryAfter)
}

/**
 * Sends one quick AI request and hands every stream event to `onEvent` in order. Resolves when the stream ends;
 * aborting `signal` closes the connection, which the gateway treats as a cancel (settled at once, TK-16).
 */
export async function streamSparkQuickAi(
  request: SparkQuickAiTextRewriteRequest,
  options: { onEvent: (event: SparkQuickAiEvent) => void; signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<void> {
  const fetcher = options.fetcher ?? fetch
  const send = async () =>
    fetcher(`${getYoutorchApiBaseUrl()}${SPARK_QUICK_AI_REQUESTS_PATH}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        'x-csrf-token': await getGatewayCsrfToken(options.signal, fetcher),
      },
      body: JSON.stringify(request),
      signal: options.signal,
    })
  let response = await send()
  if (response.status === 403) {
    const rejection = await readRejection(response.clone())
    if (rejection.code === 'CSRF_INVALID') {
      invalidateGatewayCsrfToken()
      response = await send()
    }
  }
  if (!response.ok) throw await readRejection(response)
  if (!response.body) throw new SparkQuickAiRejectedError('quick_ai_failed', 502, null)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const sse = new SparkQuickAiSseReader()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    for (const event of sse.push(decoder.decode(value, { stream: true }))) options.onEvent(event)
  }
  for (const event of sse.push(`${decoder.decode()}\n\n`)) options.onEvent(event)
}

const approvalResponseSchema = z.object({ data: z.record(z.string(), z.unknown()) })

/** The single Ask-mode approval of this edit session (P03-24, Q92); the same request key is then sent again. */
export async function approveSparkQuickAiSession(input: {
  editSessionId: string
  projectId: string
  reviewRequestId: string
  approvedMaxCredits: number
}): Promise<void> {
  await gatewayRequest(`/api/v1/spark-quick-ai/sessions/${encodeURIComponent(input.editSessionId)}/approval`, {
    method: 'POST',
    csrf: true,
    body: {
      project_id: input.projectId,
      review_request_id: input.reviewRequestId,
      approved_max_credits: input.approvedMaxCredits,
    },
    schema: approvalResponseSchema,
  })
}

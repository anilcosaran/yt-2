import type { InfiniteData } from '@tanstack/react-query'
import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { gatewayRequest, getGatewayCsrfToken, invalidateGatewayCsrfToken } from '@/lib/gateway/client'
import { publicRuntimeErrorMessage } from '@/lib/public-runtime-error'
import { recentWorkflowOutputItemSchema, type RecentWorkflowOutputItem } from '@/lib/workflows/api'

/**
 * LLM-03 text tool fast lane client (owner decision S2-A). `prompt_generate`, `prompt_enhance` and `openai_text_test`
 * run as one streamed gateway call without a workflow: `accepted`, `delta` (answer text as it arrives), then `result` +
 * `usage`, or `usage` + `error`; the last event is `done`. Every refusal before the stream is plain HTTP; apart from a
 * 409 (idempotency conflict or the run is still in progress) nothing ran and nothing was charged, so the caller
 * launches the normal workflow run (`{ kind: 'fallback' }`). Closing the connection does not cancel the run: it
 * finishes on the server and appears in the run history (`listTextToolFastRuns`).
 */

export const TEXT_TOOL_FAST_LANE_RUNS_PATH = '/api/v1/text-tool-fast-lane/runs'
export const TEXT_TOOL_FAST_LANE_NODE_TYPES = ['prompt_generate', 'prompt_enhance', 'openai_text_test'] as const
export type TextToolFastLaneNodeType = (typeof TEXT_TOOL_FAST_LANE_NODE_TYPES)[number]

/** `prompt_enhance` and `prompt_enhance@1` are fast-lane tools; another type or major version is not. */
export function toTextToolFastLaneNodeType(nodeType: string | null | undefined): TextToolFastLaneNodeType | null {
  if (typeof nodeType !== 'string') return null
  const [name, version, extra] = nodeType.trim().toLowerCase().split('@')
  if (extra !== undefined || (version !== undefined && version !== '1')) return null
  return (TEXT_TOOL_FAST_LANE_NODE_TYPES as readonly string[]).includes(name ?? '')
    ? name as TextToolFastLaneNodeType
    : null
}

/** A fresh key for every launch (the gateway answers the same key with the same run). */
export function createTextToolFastLaneIdempotencyKey() {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `tool-fast:${random}`
}

export type TextToolFastRunRequest = {
  idempotencyKey: string
  channelId: string
  nodeType: TextToolFastLaneNodeType
  params: Record<string, unknown>
}

const receiptSchema = z.object({
  run_id: z.string(),
  charged_credits: z.number().catch(0),
  quota_credits: z.number().catch(0),
  settlement: z.string().catch('pending'),
}).passthrough()

export type TextToolFastRunReceipt = z.output<typeof receiptSchema>

const eventSchemas = {
  accepted: z.object({
    run_id: z.string().min(1),
    replayed: z.boolean().catch(false),
    estimated_credits: z.number().nullable().catch(null),
    reserved_credits: z.number().nullable().catch(null),
  }),
  delta: z.object({ run_id: z.string(), text: z.string() }),
  result: z.object({ run: recentWorkflowOutputItemSchema }),
  usage: z.object({ receipt: receiptSchema }),
  error: z.object({
    run_id: z.string(),
    code: z.string().catch('text_tool_failed'),
    public_error_code: z.string().catch('E3100'),
    message: z.string().catch(''),
    retryable: z.boolean().catch(false),
  }),
  done: z.object({ run_id: z.string() }),
} as const

type EventSchemas = typeof eventSchemas
export type TextToolFastLaneEventType = keyof EventSchemas
export type TextToolFastLaneEvent = {
  [K in TextToolFastLaneEventType]: { type: K } & z.output<EventSchemas[K]>
}[TextToolFastLaneEventType]

export type TextToolFastLaneOutcome =
  /** Refused before anything ran (nothing was charged): launch the normal workflow run instead. */
  | { kind: 'fallback'; status: number; code: string | null; reason: string | null; retryAfterSeconds: number | null }
  | {
      kind: 'completed'
      runId: string
      replayed: boolean
      /** The answer text (`result.text`, else the streamed text). */
      text: string
      /** The run as a run history item (same field names as the recent workflow outputs). */
      run: RecentWorkflowOutputItem
      usage: TextToolFastRunReceipt | null
    }
  /** The call ran and failed (the hold was returned); the run is stored and appears in the history as failed. */
  | {
      kind: 'failed'
      runId: string
      code: string
      publicErrorCode: string
      /** Public ERR-03 copy of `publicErrorCode` ("… Error code: E3xxx"). */
      message: string
      retryable: boolean
      usage: TextToolFastRunReceipt | null
    }
  /** The stream ended without an outcome (connection lost): the run keeps going and appears in the history. */
  | { kind: 'interrupted'; runId: string; text: string }

/** A 409 (idempotency conflict or the run is still in progress) or a stream the client could not read. */
export class TextToolFastLaneError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly reason: string | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    // The message is public ERR-03 copy so the tools workspace localizes it like any run error.
    super(publicRuntimeErrorMessage(code === 'text_tool_run_in_progress' ? 'E3102' : 'E3100'))
    this.name = 'TextToolFastLaneError'
  }
}

/** Parses one SSE block (`event:` + `data:` lines); unknown or malformed blocks are dropped. */
export function parseTextToolFastLaneEvent(block: string): TextToolFastLaneEvent | null {
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
  if (!name || !Object.prototype.hasOwnProperty.call(eventSchemas, name) || data.length === 0) return null
  try {
    const parsed = eventSchemas[name as TextToolFastLaneEventType].safeParse(JSON.parse(data.join('\n')))
    return parsed.success ? ({ ...parsed.data, type: name } as TextToolFastLaneEvent) : null
  } catch {
    return null
  }
}

/** Splits a growing SSE text into complete blocks; the unfinished tail stays for the next chunk. */
export class TextToolFastLaneSseReader {
  private buffer = ''

  push(chunk: string): TextToolFastLaneEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n')
    const events: TextToolFastLaneEvent[] = []
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const event = parseTextToolFastLaneEvent(this.buffer.slice(0, boundary))
      if (event) events.push(event)
      this.buffer = this.buffer.slice(boundary + 2)
      boundary = this.buffer.indexOf('\n\n')
    }
    return events
  }
}

type Rejection = { code: string | null; fallback: boolean | null; reason: string | null; retryAfterSeconds: number | null }

async function readRejection(response: Response): Promise<Rejection> {
  const rejection: Rejection = { code: null, fallback: null, reason: null, retryAfterSeconds: null }
  try {
    const payload = (await response.json()) as {
      error?: { code?: unknown; fallback?: unknown; reason?: unknown; retry_after_seconds?: unknown }
    }
    const error = payload?.error
    if (typeof error?.code === 'string') rejection.code = error.code
    if (typeof error?.fallback === 'boolean') rejection.fallback = error.fallback
    if (typeof error?.reason === 'string') rejection.reason = error.reason
    if (typeof error?.retry_after_seconds === 'number') rejection.retryAfterSeconds = error.retry_after_seconds
  } catch {
    // A body that is not the gateway's error shape (an empty 500, a proxy page) keeps the defaults.
  }
  const header = Number(response.headers.get('retry-after'))
  if (rejection.retryAfterSeconds === null && Number.isFinite(header) && header > 0) rejection.retryAfterSeconds = header
  return rejection
}

/**
 * Runs one text tool call on the fast lane. Resolves with the outcome (the answer, the stored failure, an interrupted
 * stream, or `fallback` when the lane refused before anything ran). A 409 throws `TextToolFastLaneError`.
 */
export async function runTextToolFastLane(
  request: TextToolFastRunRequest,
  options: {
    onAccepted?: (event: { runId: string; replayed: boolean }) => void
    onDelta?: (delta: string, text: string) => void
    signal?: AbortSignal
    fetcher?: typeof fetch
  } = {},
): Promise<TextToolFastLaneOutcome> {
  const fetcher = options.fetcher ?? fetch
  const body = JSON.stringify({
    schema: 'text_tool_fast_run_request.v1',
    idempotency_key: request.idempotencyKey,
    channel_id: request.channelId,
    node_type: request.nodeType,
    params: request.params,
  })
  const send = async () => fetcher(`${getYoutorchApiBaseUrl()}${TEXT_TOOL_FAST_LANE_RUNS_PATH}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
      'x-csrf-token': await getGatewayCsrfToken(options.signal, fetcher),
    },
    body,
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
  if (!response.ok) {
    const rejection = await readRejection(response)
    if (response.status === 409) {
      throw new TextToolFastLaneError(rejection.code ?? 'text_tool_run_conflict', 409, rejection.reason, rejection.retryAfterSeconds)
    }
    // `error.fallback: true` by contract, and any other refusal (an empty 500, 401/403, a proxy error): nothing ran on
    // the lane, and the workflow path answers with its own checks.
    return {
      kind: 'fallback',
      status: response.status,
      code: rejection.code,
      reason: rejection.reason,
      retryAfterSeconds: rejection.retryAfterSeconds,
    }
  }
  if (!response.body) throw new TextToolFastLaneError('text_tool_stream_unreadable', 502)

  let runId: string | null = null
  let replayed = false
  let text = ''
  let run: RecentWorkflowOutputItem | null = null
  let usage: TextToolFastRunReceipt | null = null
  let failure: Extract<TextToolFastLaneEvent, { type: 'error' }> | null = null
  const handle = (event: TextToolFastLaneEvent) => {
    switch (event.type) {
      case 'accepted':
        runId = event.run_id
        replayed = event.replayed
        options.onAccepted?.({ runId: event.run_id, replayed: event.replayed })
        return
      case 'delta':
        if (!event.text) return
        text += event.text
        options.onDelta?.(event.text, text)
        return
      case 'result':
        run = event.run
        runId ??= event.run.id || null
        return
      case 'usage':
        usage = event.receipt
        return
      case 'error':
        failure = event
        runId ??= event.run_id
        return
      case 'done':
        runId ??= event.run_id
        return
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const sse = new TextToolFastLaneSseReader()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      for (const event of sse.push(decoder.decode(value, { stream: true }))) handle(event)
    }
    for (const event of sse.push(`${decoder.decode()}\n\n`)) handle(event)
  } catch (error) {
    // The caller's abort stays an abort; a dropped connection after `accepted` is an interrupted run (it keeps going).
    if (options.signal?.aborted || !(runId as string | null)) throw error
  }

  const finalRun = run as RecentWorkflowOutputItem | null
  const finalFailure = failure as Extract<TextToolFastLaneEvent, { type: 'error' }> | null
  const finalRunId = runId as string | null
  if (finalRun) {
    return {
      kind: 'completed',
      runId: finalRunId ?? finalRun.id,
      replayed,
      text: readResultText(finalRun.outputPreview) ?? text,
      run: finalRun,
      usage,
    }
  }
  if (finalFailure) {
    return {
      kind: 'failed',
      runId: finalRunId ?? finalFailure.run_id,
      code: finalFailure.code,
      publicErrorCode: finalFailure.public_error_code,
      message: publicRuntimeErrorMessage(finalFailure.public_error_code),
      retryable: finalFailure.retryable,
      usage,
    }
  }
  if (finalRunId) return { kind: 'interrupted', runId: finalRunId, text }
  throw new TextToolFastLaneError('text_tool_stream_unreadable', 502)
}

function readResultText(preview: unknown): string | null {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return null
  const value = (preview as Record<string, unknown>).text
  return typeof value === 'string' ? value : null
}

const fastRunListResponseSchema = z.object({
  data: z.object({
    items: z.array(recentWorkflowOutputItemSchema).catch([]),
    hasMore: z.boolean().catch(false),
    nextBefore: z.string().nullable().optional().catch(null),
  }).strip(),
})

export type TextToolFastRunPage = {
  items: RecentWorkflowOutputItem[]
  hasMore: boolean
  nextBefore: string | null
}

/** One tool's fast-lane runs in a channel, newest first, as run history items; `before` pages back by `createdAt`. */
export async function listTextToolFastRuns(
  channelId: string,
  nodeType: TextToolFastLaneNodeType,
  options: { limit?: number; before?: string | null; signal?: AbortSignal } = {},
): Promise<TextToolFastRunPage> {
  const query = new URLSearchParams({ channel_id: channelId, node_type: nodeType })
  if (options.limit != null) query.set('limit', String(options.limit))
  if (options.before) query.set('before', options.before)
  const response = await gatewayRequest(`${TEXT_TOOL_FAST_LANE_RUNS_PATH}?${query.toString()}`, {
    schema: fastRunListResponseSchema,
    signal: options.signal,
  })
  return {
    items: response.data.items,
    hasMore: response.data.hasMore,
    nextBefore: response.data.nextBefore ?? null,
  }
}

/** Query key of one tool's fast-lane run history in a channel. */
export function textToolFastRunsQueryKey(channelId: string | null | undefined, nodeType: TextToolFastLaneNodeType | null) {
  return ['text-tool-fast-lane', 'runs', channelId ?? 'none', nodeType ?? 'none'] as const
}

/**
 * The tool's run history with its fast-lane runs: both lists merged, deduplicated by `id` (the first copy wins) and
 * sorted newest first by `createdAt` (stable, so equal times keep their order). Without fast runs the workflow list is
 * returned as it is.
 */
export function mergeTextToolFastRunItems(
  workflowItems: readonly RecentWorkflowOutputItem[],
  fastItems: readonly RecentWorkflowOutputItem[],
): RecentWorkflowOutputItem[] {
  if (fastItems.length === 0) return workflowItems as RecentWorkflowOutputItem[]
  const seen = new Set<string>()
  const merged: Array<{ item: RecentWorkflowOutputItem; index: number; time: number }> = []
  for (const item of [...workflowItems, ...fastItems]) {
    if (item.id && seen.has(item.id)) continue
    if (item.id) seen.add(item.id)
    const time = item.createdAt ? Date.parse(item.createdAt) : Number.NaN
    merged.push({ item, index: merged.length, time: Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY })
  }
  merged.sort((left, right) => (right.time - left.time) || (left.index - right.index))
  return merged.map((entry) => entry.item)
}

/**
 * Puts a finished fast run (the stream's `result`) into the cached history at once, replacing an older copy of the
 * same run, so the answer hands over from the live card to the history without a gap. The refetch that follows keeps
 * the server as the source of truth.
 */
export function upsertTextToolFastRunPage(
  current: InfiniteData<TextToolFastRunPage, string | null> | undefined,
  item: RecentWorkflowOutputItem,
): InfiniteData<TextToolFastRunPage, string | null> {
  if (!current?.pages.length) {
    return { pages: [{ items: [item], hasMore: false, nextBefore: null }], pageParams: [null] }
  }
  if (current.pages.some((page) => page.items.some((candidate) => candidate.id === item.id))) {
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((candidate) => candidate.id === item.id ? item : candidate),
      })),
    }
  }
  const [first, ...rest] = current.pages
  return { ...current, pages: [{ ...first!, items: [item, ...first!.items] }, ...rest] }
}

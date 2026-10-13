import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * E1-A shared client of "bind a Storage object to a Spark project" (`composition.artifact.attach`, P02-04): the one path
 * every media tool uses (uploads, My media, recordings, generated results). It only binds: placing the source on the
 * timeline is a separate typed edit (`clip.insert_sequence` through the stage's `placeMedia`, `audio.insert`, ...).
 *
 * `POST /api/v1/composition/projects/:projectId/sources` binds a READY Storage object (object id + checksum). An image
 * has an exact probe and enters the document at once (`attached`). A video or audio file needs the trusted Storage probe
 * (`awaiting_probe`): the binding is durable but the source is not insertable yet; the same request with the same
 * idempotency key completes it once the probe exists, so `attachStorageObject` repeats it (bounded, abortable) and
 * resolves `awaiting_probe` instead of waiting for ever. After `ready` the caller re-reads the working copy
 * (`refresh`), since the source entered `source_media` on the server.
 */

export type AttachProvenance = 'upload' | 'generation'

export type AttachFailureReason =
  | 'not_ready'
  | 'checksum_mismatch'
  | 'forbidden'
  | 'not_active'
  | 'probe_invalid'
  /** Y1R-TOOLS-4: longer than the plan lets the editor take (`COMPOSITION_SOURCE_TOO_LONG`). */
  | 'too_long'
  | 'attach_failed'
  | 'unavailable'
  | 'unknown'

export type AttachResult =
  | { status: 'ready'; sourceId: string; storageObjectId: string }
  /** Bound, but the source is not in the document yet (a video/audio file waiting for its probe). */
  | { status: 'awaiting_probe'; sourceId: string; storageObjectId: string }
  | { status: 'failed'; reason: AttachFailureReason; storageObjectId: string }

const receiptSchema = z.object({
  data: z
    .object({
      outcome: z.enum(['applied', 'rebased', 'replayed']),
      state: z.enum(['attached', 'awaiting_probe']),
      source_id: z.string().min(1),
      storage_object_id: z.string().min(1),
      working_copy_version: z.number().int(),
      probe_status: z.string().nullable().optional(),
    })
    .passthrough(),
})

const sourcesSchema = z.object({
  data: z.array(
    z
      .object({
        source_id: z.string().min(1),
        state: z.enum(['pending', 'awaiting_probe', 'attached']),
        storage_object: z.object({ storage_object_id: z.string().min(1) }).passthrough(),
        probe_status: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
})

export type AttachReceipt = z.output<typeof receiptSchema>['data']
export type ProjectSourceEntry = z.output<typeof sourcesSchema>['data'][number]

export type AttachBody = {
  idempotency_key: string
  base_revision: number
  storage_object: { storage_object_id: string; checksum_sha256: string }
  provenance: { source_kind: AttachProvenance }
}

/** The two Composition calls of the attach flow; tests pass a fake. */
export type SourceAttachTransport = {
  attach(projectId: string, body: AttachBody, options: { signal?: AbortSignal }): Promise<AttachReceipt>
  listSources(projectId: string, options: { signal?: AbortSignal }): Promise<ProjectSourceEntry[]>
}

const projectPath = (projectId: string, suffix: string) => `/api/v1/composition/projects/${encodeURIComponent(projectId)}${suffix}`

export const sourceAttachGatewayTransport: SourceAttachTransport = {
  async attach(projectId, body, options) {
    const response = await gatewayRequest(projectPath(projectId, '/sources'), {
      method: 'POST',
      csrf: true,
      body,
      schema: receiptSchema,
      signal: options.signal,
    })
    return response.data
  },
  async listSources(projectId, options) {
    const response = await gatewayRequest(projectPath(projectId, '/sources'), { schema: sourcesSchema, signal: options.signal })
    return response.data
  },
}

/** P00-07 `attach_idempotency_key`: 8-128 characters of `[A-Za-z0-9._:-]`; scope = project + object + key. */
export function newAttachIdempotencyKey(uuid: string = globalThis.crypto.randomUUID()): string {
  return `ui_attach_${uuid}`
}

export function classifyAttachError(error: unknown): AttachFailureReason {
  if (!(error instanceof AuthClientError)) return 'unknown'
  switch (error.code) {
    case 'COMPOSITION_SOURCE_NOT_READY':
      return 'not_ready'
    case 'COMPOSITION_SOURCE_CHECKSUM_MISMATCH':
      return 'checksum_mismatch'
    case 'COMPOSITION_PROJECT_FORBIDDEN':
      return 'forbidden'
    case 'COMPOSITION_PROJECT_NOT_ACTIVE':
      return 'not_active'
    case 'COMPOSITION_SOURCE_TOO_LONG':
      return 'too_long'
    case 'COMPOSITION_SOURCE_ATTACH_FAILED':
      return 'attach_failed'
    default:
      return error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT' || error.status >= 500 ? 'unavailable' : 'unknown'
  }
}

/** The source id an "already attached" refusal names (the file is already a source of the project), if the body carries it. */
function alreadyAttachedSourceId(error: unknown): string | null {
  if (!(error instanceof AuthClientError) || error.code !== 'COMPOSITION_SOURCE_ALREADY_ATTACHED') return null
  const sourceId = (error.details as { source_id?: unknown } | undefined)?.source_id
  return typeof sourceId === 'string' && sourceId ? sourceId : null
}

export type AttachOptions = {
  projectId: string
  storageObjectId: string
  checksum: string
  provenance?: AttachProvenance
  /** The working copy version the editor holds, read when each request is sent. */
  baseRevision: () => number
  /**
   * Brings the editor's copy up to the source once it is in the document. WP5a: it gets the attach receipt when one says
   * so (`session.adoptAttachedSource` takes the `source_media` entry from it instead of re-reading the document); without a
   * receipt (the source was followed through the project's source list) it is a plain `session.refresh`.
   */
  refresh: (receipt?: AttachReceipt) => Promise<void>
  signal?: AbortSignal
  transport?: SourceAttachTransport
  /** Keep asking while the source awaits its probe (default true); false resolves `awaiting_probe` after the first answer. */
  waitForProbe?: boolean
  /** Called once, when the first answer says the source is bound but still awaits its probe ("Processing..."). */
  onAwaitingProbe?: () => void
  /**
   * WP5a: called once when the probe has taken longer than `pollMs.softTimeout` (a long video): the wait goes on (slower)
   * until `pollMs.timeout`, so the UI says "still processing" instead of giving up.
   */
  onStillProcessing?: () => void
  /**
   * Poll pacing: first delay, growth, ceiling, the total time to wait for a probe and (WP5a) when the wait counts as long
   * (after it the ceiling is `slowMax`).
   */
  pollMs?: { first: number; max: number; timeout: number; softTimeout?: number; slowMax?: number }
  idempotencyKey?: string
  /** Test seams. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  now?: () => number
}

/**
 * WP5a: the first three minutes are polled briskly (a short clip's probe arrives in seconds once the ingest is dispatched),
 * then every 10 s for up to 30 min (a long video's ingest), so the editor keeps waiting with a visible state instead of
 * giving up at 180 s. After that the binding is still durable and "Check again" resumes the wait.
 */
const DEFAULT_POLL = { first: 1500, max: 5000, timeout: 30 * 60_000, softTimeout: 180_000, slowMax: 10_000 } as const

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Binds a Storage object to the project and waits (bounded) until the source is usable. Never throws for a refusal: the
 * result names it. An aborted signal rejects with the abort reason (the caller dropped the work).
 */
export async function attachStorageObject(options: AttachOptions): Promise<AttachResult> {
  const transport = options.transport ?? sourceAttachGatewayTransport
  const sleep = options.sleep ?? abortableSleep
  const now = options.now ?? (() => Date.now())
  const poll = options.pollMs ?? DEFAULT_POLL
  const key = options.idempotencyKey ?? newAttachIdempotencyKey()
  const body = (): AttachBody => ({
    idempotency_key: key,
    base_revision: options.baseRevision(),
    storage_object: { storage_object_id: options.storageObjectId, checksum_sha256: options.checksum },
    provenance: { source_kind: options.provenance ?? 'upload' },
  })
  const failed = (reason: AttachFailureReason): AttachResult => ({ status: 'failed', reason, storageObjectId: options.storageObjectId })
  const started = now()
  let delay = poll.first
  let announced = false
  const announceWaiting = () => {
    if (announced) return
    announced = true
    options.onAwaitingProbe?.()
  }
  let longWait = false
  /** The next poll delay: brisk at first, slower once the wait counts as long (and the UI was told so, once). */
  const nextDelay = () => {
    const long = poll.softTimeout !== undefined && now() - started >= poll.softTimeout
    if (long && !longWait) {
      longWait = true
      options.onStillProcessing?.()
    }
    delay = Math.min(long ? Math.max(poll.max, poll.slowMax ?? poll.max) : poll.max, Math.round(delay * 1.5))
  }

  try {
    let receipt: AttachReceipt
    try {
      receipt = await transport.attach(options.projectId, body(), { signal: options.signal })
    } catch (error) {
      if (options.signal?.aborted) throw error
      const existing = alreadyAttachedSourceId(error)
      if (!existing) return failed(classifyAttachError(error))
      // The file is already a source of this project (another attach key): follow that source.
      return await followListedSource(existing)
    }
    for (;;) {
      if (receipt.state === 'attached') {
        await options.refresh(receipt)
        return { status: 'ready', sourceId: receipt.source_id, storageObjectId: receipt.storage_object_id }
      }
      if (receipt.probe_status?.startsWith('invalid:')) return failed('probe_invalid')
      announceWaiting()
      if (options.waitForProbe === false || now() - started >= poll.timeout) {
        return { status: 'awaiting_probe', sourceId: receipt.source_id, storageObjectId: receipt.storage_object_id }
      }
      await sleep(delay, options.signal)
      nextDelay()
      // The same key completes the binding once the probe exists (idempotent while it does not).
      receipt = await transport.attach(options.projectId, body(), { signal: options.signal })
    }
  } catch (error) {
    if (options.signal?.aborted) throw error
    return failed(classifyAttachError(error))
  }

  async function followListedSource(sourceId: string): Promise<AttachResult> {
    for (;;) {
      const entry = (await transport.listSources(options.projectId, { signal: options.signal })).find((item) => item.source_id === sourceId)
      if (!entry) return failed('attach_failed')
      if (entry.state === 'attached') {
        await options.refresh()
        return { status: 'ready', sourceId, storageObjectId: options.storageObjectId }
      }
      if (entry.probe_status?.startsWith('invalid:')) return failed('probe_invalid')
      announceWaiting()
      if (options.waitForProbe === false || now() - started >= poll.timeout) return { status: 'awaiting_probe', sourceId, storageObjectId: options.storageObjectId }
      await sleep(delay, options.signal)
      nextDelay()
    }
  }
}

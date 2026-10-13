import { AuthClientError } from '@/lib/auth/errors'

import {
  sparkExportGatewayClient,
  sparkExportOutputProfile,
  sparkExportQuoteSchema,
  sparkExportTerminalStatuses,
  type SparkExport,
  type SparkExportClient,
  type SparkExportQuote,
} from './export-client'

/**
 * Y1-07 W10: the export dialog's state machine (quote -> accept -> progress -> result), framework-free like the other
 * Spark sessions. The server is the only source of truth: nothing is kept in browser storage, the export id lives in this
 * object for the life of the editor page (closing the dialog never stops the export; reopening shows it again).
 *
 * Honesty rules (owner decisions 13-15): the price on screen is the exact quote the click approves (a changed price is
 * shown again, never charged silently); `renderer_unavailable`, `funding_required` and a refusal of the video are
 * shown as what they are, with nothing charged; a launch that hit a full queue is a WAIT (lane, reason, expiry), not a
 * failure; the cancel command exists and `cancelled` is a state. The status is polled while the export is not terminal.
 */

export type SparkExportRefusalReason = {
  code: string
  /** Stable key the UI maps to its own copy; unknown keys fall back to `message`. */
  reasonKey: string
  /** The gateway's user-readable English text (fallback only). */
  message: string
  sceneId: string | null
  layerId: string | null
}

/** Why a quote or the export click was refused (the answer of the gateway, never a guess). */
export type SparkExportFailure = {
  code: string
  status: number | null
  reasons: SparkExportRefusalReason[]
  reasonCount: number
  /** 429 attempt limit: ISO time after which another attempt is allowed. */
  retryAfter: string | null
  outputSeconds: number | null
  maxOutputSeconds: number | null
  /** canvas / profile refusals: the gateway's reason key (`fps_not_supported`, ...). */
  reason: string | null
}

export type SparkExportPhase = 'idle' | 'quoting' | 'quoted' | 'quote_failed' | 'requesting' | 'tracking' | 'ended'

export type SparkExportState = {
  phase: SparkExportPhase
  quote: SparkExportQuote | null
  export: SparkExport | null
  /** A refusal of the quote or of the click; also set on `quoted` after `COMPOSITION_EXPORT_QUOTE_CHANGED`. */
  failure: SparkExportFailure | null
  cancelling: boolean
  /** The status could not be read the last times (the export itself keeps going on the server). */
  pollError: boolean
}

export type SparkExportScheduler = {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export type SparkExportSession = {
  getSnapshot(): SparkExportState
  subscribe(listener: () => void): () => void
  /**
   * Opens the dialog's flow: a fresh quote, or (when an export is already running/ended in this page) nothing new. An
   * ended export of an older working copy version than `workingCopyVersion` is not the latest video: a new quote is asked.
   */
  open(current?: { workingCopyVersion?: number | null }): Promise<void>
  /** The click that approves the quoted price (G2). */
  accept(): Promise<void>
  cancel(): Promise<void>
  /** After a terminal result: start over with a new quote. */
  restart(): Promise<void>
  dispose(): void
}

export const SPARK_EXPORT_POLL_MS = { rendering: 2_000, waiting: 4_000, error: 8_000 } as const

const INITIAL: SparkExportState = { phase: 'idle', quote: null, export: null, failure: null, cancelling: false, pollError: false }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** The gateway's error as the dialog needs it. Exported for the tests. */
export function exportFailureOf(error: unknown): SparkExportFailure {
  if (error instanceof AuthClientError) {
    const details = record(error.details)
    const reasons = Array.isArray(details.reasons)
      ? details.reasons.flatMap((item): SparkExportRefusalReason[] => {
          const reason = record(item)
          const code = text(reason.code)
          if (!code) return []
          return [{
            code,
            reasonKey: text(reason.reason_key) ?? 'compile_refused',
            message: text(reason.message) ?? '',
            sceneId: text(reason.scene_id),
            layerId: text(reason.layer_id),
          }]
        })
      : []
    return {
      code: error.code,
      status: error.status,
      reasons,
      reasonCount: num(details.reason_count) ?? reasons.length,
      retryAfter: text(details.retry_after),
      outputSeconds: num(details.output_seconds),
      maxOutputSeconds: num(details.max_output_seconds),
      reason: text(details.reason),
    }
  }
  return { code: 'NETWORK', status: null, reasons: [], reasonCount: 0, retryAfter: null, outputSeconds: null, maxOutputSeconds: null, reason: null }
}

export function createSparkExportSession(options: {
  projectId: string
  client?: SparkExportClient
  scheduler?: SparkExportScheduler
  createId?: () => string
  outputProfile?: string
}): SparkExportSession {
  const client = options.client ?? sparkExportGatewayClient
  const scheduler: SparkExportScheduler = options.scheduler ?? {
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID())
  const profile = options.outputProfile ?? sparkExportOutputProfile
  const listeners = new Set<() => void>()
  let state: SparkExportState = INITIAL
  let disposed = false
  let pollTimer: unknown = null
  let pollFailures = 0
  let quoteRun = 0
  /** The idempotency key of the click for ONE quote: a retry after a lost answer reuses it, a new price gets a new one. */
  let clickKey: { quoteSha256: string; key: string } | null = null
  const abort = new AbortController()

  const set = (next: Partial<SparkExportState>) => {
    if (disposed) return
    state = { ...state, ...next }
    for (const listener of [...listeners]) listener()
  }

  const stopPolling = () => {
    if (pollTimer !== null) scheduler.clearTimeout(pollTimer)
    pollTimer = null
  }

  const settle = (exportJob: SparkExport) => {
    if (sparkExportTerminalStatuses.has(exportJob.status)) {
      stopPolling()
      set({ export: exportJob, phase: 'ended', cancelling: false, pollError: false })
    } else {
      set({ export: exportJob, phase: 'tracking', pollError: false, cancelling: exportJob.cancel_requested === true ? true : state.cancelling })
    }
  }

  const schedulePoll = (exportJob: SparkExport) => {
    stopPolling()
    if (disposed || sparkExportTerminalStatuses.has(exportJob.status)) return
    const delay = pollFailures > 0
      ? SPARK_EXPORT_POLL_MS.error
      : exportJob.status === 'rendering' ? SPARK_EXPORT_POLL_MS.rendering : SPARK_EXPORT_POLL_MS.waiting
    pollTimer = scheduler.setTimeout(() => void poll(exportJob.export_id), delay)
  }

  const poll = async (exportId: string) => {
    pollTimer = null
    if (disposed) return
    try {
      const fresh = await client.get(options.projectId, exportId, { signal: abort.signal })
      if (disposed) return
      pollFailures = 0
      settle(fresh)
      schedulePoll(fresh)
    } catch (error) {
      if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
      pollFailures += 1
      // The export keeps going on the server; say that the status is not readable and keep asking.
      set({ pollError: pollFailures >= 2 })
      if (state.export) schedulePoll(state.export)
    }
  }

  const loadQuote = async () => {
    const run = ++quoteRun
    set({ phase: 'quoting', failure: null, quote: null })
    try {
      const quote = await client.getQuote(options.projectId, { outputProfile: profile, signal: abort.signal })
      if (disposed || run !== quoteRun) return
      set({ phase: 'quoted', quote, failure: null })
    } catch (error) {
      if (disposed || run !== quoteRun || (error instanceof DOMException && error.name === 'AbortError')) return
      set({ phase: 'quote_failed', failure: exportFailureOf(error) })
    }
  }

  const restart = async () => {
    if (state.phase !== 'ended' && state.phase !== 'quote_failed') return
    stopPolling()
    // Y1R-EDITOR-2: a new attempt needs a new key; the old one would only replay the ended export.
    clickKey = null
    state = { ...INITIAL, phase: 'idle' }
    for (const listener of [...listeners]) listener()
    await loadQuote()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    async open(current) {
      // Y1R-EDITOR-1: a finished export is shown again only while it is the current version; after an edit it is quoted anew.
      const version = current?.workingCopyVersion
      if (state.phase === 'ended' && typeof version === 'number' && state.quote && state.quote.working_copy_version !== version) {
        await restart()
        return
      }
      // A running or finished export of this page is shown again, never replaced by a new quote.
      if (state.phase === 'tracking' || state.phase === 'requesting' || state.phase === 'ended' || state.phase === 'quoting') return
      await loadQuote()
    },

    async accept() {
      const quote = state.quote
      if (state.phase !== 'quoted' || !quote || !quote.renderer.available) return
      if (!clickKey || clickKey.quoteSha256 !== quote.quote_sha256) clickKey = { quoteSha256: quote.quote_sha256, key: `ui_exp_${createId()}` }
      set({ phase: 'requesting', failure: null })
      try {
        const { export: exportJob } = await client.request(options.projectId, {
          idempotencyKey: clickKey.key,
          seenWorkingCopyVersion: quote.working_copy_version,
          outputProfile: quote.output_profile,
          acceptedQuoteSha256: quote.quote_sha256,
        }, { signal: abort.signal })
        if (disposed) return
        pollFailures = 0
        settle(exportJob)
        schedulePoll(exportJob)
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        const failure = exportFailureOf(error)
        // A lost answer (no response) may have created the export: the same key resolves it on the next click.
        if (failure.status !== null) clickKey = null
        if (failure.code === 'COMPOSITION_EXPORT_QUOTE_CHANGED') {
          // K249: the price moved after the user saw it. Nothing was charged; show the fresh price for a new decision.
          const fresh = sparkExportQuoteSchema.safeParse(record(error instanceof AuthClientError ? error.details : null).quote)
          if (fresh.success) {
            set({ phase: 'quoted', quote: fresh.data, failure })
            return
          }
          await loadQuote()
          set({ failure })
          return
        }
        set({ phase: failure.status === null ? 'quoted' : 'quote_failed', failure })
      }
    },

    async cancel() {
      const job = state.export
      if (!job || sparkExportTerminalStatuses.has(job.status) || state.cancelling) return
      set({ cancelling: true })
      try {
        const fresh = await client.cancel(options.projectId, job.export_id, { signal: abort.signal })
        if (disposed) return
        settle(fresh)
        // A launched render is asked to stop and becomes `cancelled` when the runtime confirms: keep reading it.
        schedulePoll(fresh)
        if (!sparkExportTerminalStatuses.has(fresh.status)) set({ cancelling: true })
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        set({ cancelling: false, failure: exportFailureOf(error) })
      }
    },

    restart,

    dispose() {
      disposed = true
      stopPolling()
      abort.abort()
      listeners.clear()
    },
  }
}

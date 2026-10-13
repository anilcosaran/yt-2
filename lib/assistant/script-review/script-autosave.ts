import { AuthClientError } from '@/lib/auth/errors'

import { isScriptRevisionConflict, SCRIPT_PATCH_MAX_OPS, type ScriptPatchOp, type ScriptPatchResult } from './script-review-api'

/**
 * P03-20 Script panel autosave (KARAR 8E, K226/K233): field edits are coalesced per target (latest value wins),
 * debounced, and sent one batch at a time (single-flight) as a typed patch on the exact revision the panel shows.
 * `flush()` (Close) sends what is pending right away and resolves only after the server acknowledged it; a failed
 * save keeps the draft and says so, never "saved". A batch whose outcome is unknown (network, timeout, 5xx) is
 * retried with the same idempotency key, so a lost acknowledgement replays instead of writing twice. A 409 from
 * another tab stops autosave until the user picks the newer revision. Responses of a disposed or reset controller are
 * ignored (stale callback guard). Nothing is written to browser storage.
 */

export type ScriptAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'conflict' | 'invalid'

export interface ScriptAutosaveSnapshot {
  status: ScriptAutosaveStatus
  /** The script revision the next patch is applied to (the last acknowledged one). */
  revision: number
  /** Keys whose local value is not accepted by the server yet (overlay + "unsaved" markers). */
  unsavedKeys: ReadonlySet<string>
  /** Keys the panel refuses to send as they are (e.g. an empty narration in a full script). */
  invalidKeys: ReadonlySet<string>
}

export type ScriptFlushOutcome = 'saved' | 'failed' | 'conflict' | 'invalid'

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface ScriptAutosaveOptions {
  initialRevision: number
  send(request: { expectedRevision: number; idempotencyKey: string; ops: ScriptPatchOp[] }): Promise<ScriptPatchResult>
  /** Server truth after an acknowledged batch (the panel replaces its header and the changed chapters). */
  onSaved?(result: ScriptPatchResult): void
  /** An op the panel must not send yet (checked right before sending); invalid ops stay local. */
  isInvalid?(op: ScriptPatchOp): boolean
  newIdempotencyKey(): string
  debounceMs?: number
  timers?: Timers
}

interface Batch {
  key: string
  expectedRevision: number
  ops: Map<string, ScriptPatchOp>
}

export const SCRIPT_AUTOSAVE_DEBOUNCE_MS = 800

/** One target per key: a later edit of the same field replaces the earlier value (coalescing). */
export function scriptOpKey(op: ScriptPatchOp): string {
  switch (op.op) {
    case 'set_title':
      return 'title'
    case 'set_text_field':
      return `field:${op.field}`
    case 'select_hook':
      return 'hook'
    case 'set_hook_text':
      return `hook_text:${op.hook_id}`
    case 'set_chapter_title':
      return `chapter_title:${op.chapter_id}`
    case 'set_chapter_enabled':
      return `chapter_enabled:${op.chapter_id}`
    case 'set_beat_narration':
      return `narration:${op.beat_id}`
    case 'set_on_screen_text':
      return `on_screen:${op.beat_id}:${op.text_id}`
  }
}

const EMPTY: ReadonlySet<string> = new Set()

export class ScriptAutosave {
  private revision: number
  private readonly pending = new Map<string, ScriptPatchOp>()
  private inFlight: Batch | null = null
  /** A sent batch whose outcome is unknown; it is resent with the same key before anything else. */
  private inDoubt: Batch | null = null
  private status: ScriptAutosaveStatus = 'idle'
  private timer: unknown = null
  private generation = 0
  private flushing: Promise<ScriptFlushOutcome> | null = null
  private settleWaiters: Array<() => void> = []
  private snapshot: ScriptAutosaveSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly timers: Timers

  constructor(private readonly options: ScriptAutosaveOptions) {
    this.revision = options.initialRevision
    this.timers = options.timers ?? { setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms), clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>) }
    this.snapshot = this.buildSnapshot()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ScriptAutosaveSnapshot => this.snapshot

  /** The local value of a target that the server has not accepted yet (pending, sending or in doubt). */
  localOp(key: string): ScriptPatchOp | undefined {
    return this.pending.get(key) ?? this.inFlight?.ops.get(key) ?? this.inDoubt?.ops.get(key)
  }

  edit(op: ScriptPatchOp): void {
    const key = scriptOpKey(op)
    this.pending.delete(key)
    this.pending.set(key, op)
    this.setStatus(this.status === 'conflict' ? 'conflict' : this.inFlight ? 'saving' : 'pending')
    this.schedule()
  }

  /**
   * Close: send everything now and wait for the acknowledgement. Resolves `saved` only when nothing local is left;
   * otherwise the reason the panel has to stay open (failed / conflict / invalid).
   */
  flush(): Promise<ScriptFlushOutcome> {
    this.cancelTimer()
    if (this.flushing) return this.flushing
    const run = this.drain().finally(() => { if (this.flushing === run) this.flushing = null })
    this.flushing = run
    return run
  }

  /**
   * After a conflict the panel reloaded the newest revision: the user's unsent edits are re-applied on it with a new
   * key (explicit user action, never automatic).
   */
  rebase(revision: number): void {
    this.generation += 1
    this.revision = revision
    for (const batch of [this.inDoubt, this.inFlight]) {
      if (!batch) continue
      for (const [key, op] of batch.ops) if (!this.pending.has(key)) this.pending.set(key, op)
    }
    this.inDoubt = null
    this.inFlight = null
    this.setStatus(this.pending.size > 0 ? 'pending' : 'idle')
    this.schedule()
  }

  /** Drops every local edit (the panel then shows the server revision it reloads). */
  discard(revision: number): void {
    this.generation += 1
    this.cancelTimer()
    this.revision = revision
    this.pending.clear()
    this.inDoubt = null
    this.inFlight = null
    this.setStatus('idle')
  }

  dispose(): void {
    this.generation += 1
    this.cancelTimer()
    this.listeners.clear()
  }

  private schedule(): void {
    this.cancelTimer()
    if (this.status === 'conflict' || this.pending.size === 0) return
    this.timer = this.timers.setTimeout(() => {
      this.timer = null
      if (!this.inFlight) void this.drain()
    }, this.options.debounceMs ?? SCRIPT_AUTOSAVE_DEBOUNCE_MS)
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.timers.clearTimeout(this.timer)
    this.timer = null
  }

  /** Sends batches until nothing sendable is left or one fails. */
  private async drain(): Promise<ScriptFlushOutcome> {
    const generation = this.generation
    while (generation === this.generation) {
      if (this.status === 'conflict') return 'conflict'
      if (this.inFlight) {
        // Another drain is sending; wait for it, then look again.
        await this.waitForSettle()
        continue
      }
      const batch = this.nextBatch()
      if (!batch) {
        if (this.invalidPendingKeys().size > 0) {
          this.setStatus('invalid')
          return 'invalid'
        }
        if (this.status === 'failed') return 'failed'
        if (this.status !== 'idle') this.setStatus('saved')
        return 'saved'
      }
      const outcome = await this.send(batch, generation)
      if (outcome !== 'ok') return outcome
    }
    return 'failed'
  }

  private nextBatch(): Batch | null {
    if (this.inDoubt) {
      const batch = this.inDoubt
      this.inDoubt = null
      return batch
    }
    const ops = new Map<string, ScriptPatchOp>()
    for (const [key, op] of this.pending) {
      if (ops.size >= SCRIPT_PATCH_MAX_OPS) break
      if (this.options.isInvalid?.(op)) continue
      ops.set(key, op)
    }
    if (ops.size === 0) return null
    for (const key of ops.keys()) this.pending.delete(key)
    return { key: this.options.newIdempotencyKey(), expectedRevision: this.revision, ops }
  }

  private waitForSettle(): Promise<void> {
    return new Promise((resolve) => { this.settleWaiters.push(resolve) })
  }

  private async send(batch: Batch, generation: number): Promise<'ok' | 'failed' | 'conflict'> {
    this.inFlight = batch
    this.setStatus('saving')
    try {
      const result = await this.options.send({ expectedRevision: batch.expectedRevision, idempotencyKey: batch.key, ops: [...batch.ops.values()] })
      if (generation !== this.generation) return 'failed'
      this.inFlight = null
      this.revision = result.revision.revision
      this.options.onSaved?.(result)
      this.setStatus(this.pending.size > 0 ? 'pending' : 'saved')
      return 'ok'
    } catch (error) {
      if (generation !== this.generation) return 'failed'
      this.inFlight = null
      if (isScriptRevisionConflict(error)) {
        this.restore(batch)
        this.setStatus('conflict')
        return 'conflict'
      }
      if (isDefiniteRejection(error)) this.restore(batch)
      else this.inDoubt = batch
      this.setStatus('failed')
      return 'failed'
    } finally {
      const waiters = this.settleWaiters
      this.settleWaiters = []
      for (const resolve of waiters) resolve()
    }
  }

  /** A refused batch goes back to pending unless the user already typed a newer value for the same target. */
  private restore(batch: Batch): void {
    const newer = new Map(this.pending)
    this.pending.clear()
    for (const [key, op] of batch.ops) if (!newer.has(key)) this.pending.set(key, op)
    for (const [key, op] of newer) this.pending.set(key, op)
  }

  private invalidPendingKeys(): Set<string> {
    const keys = new Set<string>()
    for (const [key, op] of this.pending) if (this.options.isInvalid?.(op)) keys.add(key)
    return keys
  }

  private setStatus(status: ScriptAutosaveStatus): void {
    this.status = status
    this.snapshot = this.buildSnapshot()
    for (const listener of this.listeners) listener()
  }

  private buildSnapshot(): ScriptAutosaveSnapshot {
    const unsaved = new Set<string>([...this.pending.keys(), ...(this.inFlight?.ops.keys() ?? []), ...(this.inDoubt?.ops.keys() ?? [])])
    const invalid = this.invalidPendingKeys()
    return { status: this.status, revision: this.revision, unsavedKeys: unsaved.size > 0 ? unsaved : EMPTY, invalidKeys: invalid.size > 0 ? invalid : EMPTY }
  }
}

/** 4xx other than timeout/rate limit: the server did not apply the batch, so it is not resent as is. */
function isDefiniteRejection(error: unknown): boolean {
  return error instanceof AuthClientError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
}

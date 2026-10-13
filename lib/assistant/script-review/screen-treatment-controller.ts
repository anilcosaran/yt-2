import { AuthClientError } from '@/lib/auth/errors'

import {
  isMotionFilmUnavailable,
  isScriptRevisionConflict,
  type PlanInventoryItem,
  type ScreenTreatmentChoice,
  type ScreenTreatmentResult,
} from './script-review-api'
import { applyScreenResult } from './script-review-model'

/**
 * P04-22 "use the real screen" in the Plan view: one click is one command on the exact shot plan revision the panel
 * shows (compare-and-set), one at a time. The controller keeps the plan's screens only as the owner last returned them
 * (never a local decision) and never writes to browser storage:
 *
 * - a click whose outcome is unknown (network, timeout, 5xx) is retried by the next click of the same choice with the
 *   same idempotency key, so a lost acknowledgement replays instead of writing twice;
 * - a refusal (4xx) is final for that key; the next click is a new attempt;
 * - a 409 (another tab or the assistant moved the plan) re-reads the newest revision and asks the user to decide again;
 * - an answer that arrives after the panel was closed is ignored (stale callback guard).
 */

export type ScreenTreatmentError = 'conflict' | 'failed' | 'unavailable'

export interface ScreenTreatmentSnapshot {
  /** The shot plan revision the next choice is applied to (the last acknowledged one). */
  revision: number
  screens: readonly PlanInventoryItem[]
  /** The screen whose choice is being stored; every choice is a CAS on the plan revision, so only one goes at a time. */
  pendingAssetId: string | null
  error: ScreenTreatmentError | null
}

export interface ScreenTreatmentControllerOptions {
  revision: number
  screens: readonly PlanInventoryItem[]
  send(request: { expectedRevision: number; idempotencyKey: string; assetId: string; treatment: ScreenTreatmentChoice }): Promise<ScreenTreatmentResult>
  /** After a 409: the newest shot plan revision and its screens (null when it cannot be read). */
  reload(): Promise<{ revision: number; screens: readonly PlanInventoryItem[] } | null>
  /** An acknowledged, new shot plan revision: the plan pinned to the old one reads stale, so the cards re-read the owner. */
  onSaved?(result: ScreenTreatmentResult): void
  newIdempotencyKey(): string
}

export class ScreenTreatmentController {
  private snapshot: ScreenTreatmentSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly keys = new Map<string, string>()
  private disposed = false

  constructor(private readonly options: ScreenTreatmentControllerOptions) {
    this.snapshot = { revision: options.revision, screens: options.screens, pendingAssetId: null, error: null }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ScreenTreatmentSnapshot => this.snapshot

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  async choose(assetId: string, choice: ScreenTreatmentChoice): Promise<void> {
    if (this.disposed || this.snapshot.pendingAssetId !== null) return
    const attempt = `${this.snapshot.revision}:${assetId}:${choice}`
    const key = this.keys.get(attempt) ?? this.options.newIdempotencyKey()
    this.keys.set(attempt, key)
    this.set({ pendingAssetId: assetId, error: null })
    try {
      const result = await this.options.send({ expectedRevision: this.snapshot.revision, idempotencyKey: key, assetId, treatment: choice })
      this.keys.delete(attempt)
      if (this.disposed) return
      this.set({ revision: result.revision.revision, screens: applyScreenResult(this.snapshot.screens, result.screen), pendingAssetId: null })
      if (result.outcome === 'created') this.options.onSaved?.(result)
    } catch (failure) {
      if (this.disposed) return
      if (isScriptRevisionConflict(failure)) {
        this.keys.delete(attempt)
        const fresh = await this.options.reload().catch(() => null)
        if (this.disposed) return
        this.set({ ...(fresh ? { revision: fresh.revision, screens: fresh.screens } : {}), pendingAssetId: null, error: 'conflict' })
      } else if (isMotionFilmUnavailable(failure)) {
        this.set({ pendingAssetId: null, error: 'unavailable' })
      } else {
        // A refusal is final for that key; an unknown outcome keeps it, so the retry replays.
        if (failure instanceof AuthClientError && failure.status >= 400 && failure.status < 500) this.keys.delete(attempt)
        this.set({ pendingAssetId: null, error: 'failed' })
      }
    }
  }

  private set(patch: Partial<ScreenTreatmentSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of [...this.listeners]) listener()
  }
}

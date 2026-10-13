import { AuthClientError } from '@/lib/auth/errors'

import {
  isPublishPackageConflict,
  isPublishPackageRefused,
  isPublishPackageUnavailable,
  type PublishPackageField,
  type PublishPackagePatch,
  type PublishPackageReviseResult,
  type PublishPackageView,
} from './publish-package-api'
import { editKey, fieldOfEdit, patchOfEdit, type PublishPackageEdit } from './publish-package-model'

/**
 * P04-21 edits of the "Yayın paketi" section: one edit is one partial revision on the exact revision and body digest the
 * panel shows (compare-and-set), one at a time. The controller keeps the package only as the owner last returned it
 * (never a local decision) and never writes to browser storage:
 *
 * - edits made while another one is being stored wait in order (one per target, the newest text wins) and are built on
 *   the newest view when their turn comes, so a later edit never overwrites an earlier one;
 * - an edit whose outcome is unknown (network, timeout, 5xx) is retried by the next attempt of the same edit on the same
 *   package state with the same idempotency key, so a lost acknowledgement replays instead of writing twice;
 * - a refusal (4xx) is final for that key and is shown next to its field; the next edit is a new attempt;
 * - a 409 (another tab, the assistant or a script change moved the package) re-reads the newest package, drops the
 *   waiting edits and asks the user to decide again;
 * - an answer that arrives after the panel was closed is ignored (stale callback guard).
 */

export type PublishPackageError = 'conflict' | 'failed' | 'refused' | 'unavailable'

export interface PublishPackageSnapshot {
  /** The package as the owner last returned it (the revision and digest the next edit is a CAS on). */
  view: PublishPackageView
  /** The field being stored (edits go one at a time). */
  pending: PublishPackageField | null
  /** The last problem and the field it belongs to (null field: the whole package). */
  error: { kind: PublishPackageError; field: PublishPackageField | null } | null
}

export interface PublishPackageControllerOptions {
  view: PublishPackageView
  send(request: { expectedRevision: number; expectedBodySha256: string; idempotencyKey: string; patch: PublishPackagePatch }): Promise<PublishPackageReviseResult>
  /** After a 409: the newest package (null when it cannot be read). */
  reload(): Promise<PublishPackageView | null>
  /** An acknowledged, new revision: the plan and its cards may show the package as changed. */
  onSaved?(result: PublishPackageReviseResult): void
  newIdempotencyKey(): string
}

interface Queued {
  edit: PublishPackageEdit
  key: string
}

/** The edits that replace each other while they wait: the same target's newest text wins. */
function targetOf(edit: PublishPackageEdit): string {
  switch (edit.kind) {
    case 'title_text':
      return `title_text:${edit.titleId}`
    case 'chapter_title':
      return `chapter_title:${edit.chapterId}`
    default:
      return edit.kind
  }
}

export class PublishPackageController {
  private snapshot: PublishPackageSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly keys = new Map<string, string>()
  private queue: Queued[] = []
  /** The drain of the queue that is running; every waiting edit's promise is this one (it settles when the queue is empty). */
  private draining: Promise<void> | null = null
  private disposed = false

  constructor(private readonly options: PublishPackageControllerOptions) {
    this.snapshot = { view: options.view, pending: null, error: null }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): PublishPackageSnapshot => this.snapshot

  dispose(): void {
    this.disposed = true
    this.queue = []
    this.listeners.clear()
  }

  /**
   * A newer read of the package (the plan moved, so fields turned stale; another tab wrote): adopted when nothing is being
   * stored, otherwise the acknowledgement of the write in flight is the newer truth.
   */
  refresh(view: PublishPackageView): void {
    if (this.disposed || this.draining) return
    const current = this.snapshot.view
    if (current.revision === view.revision && current.body_sha256 === view.body_sha256 && JSON.stringify(current.stale_fields) === JSON.stringify(view.stale_fields)) return
    if (view.revision < current.revision) return
    this.set({ view })
  }

  /** Stores one edit (or queues it behind the one being stored). */
  edit(edit: PublishPackageEdit): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const target = targetOf(edit)
    const queued = { edit, key: editKey(edit) }
    const same = this.queue.findIndex((item) => targetOf(item.edit) === target)
    if (same >= 0) this.queue[same] = queued
    else this.queue.push(queued)
    if (!this.draining) this.draining = this.drain().finally(() => { this.draining = null })
    return this.draining
  }

  private async drain(): Promise<void> {
    while (!this.disposed && this.queue.length > 0) {
      const next = this.queue.shift()!
      const outcome = await this.store(next)
      // A conflict re-read the package: whatever else waited was written for the old one.
      if (outcome === 'conflict') this.queue = []
    }
  }

  private async store(item: Queued): Promise<'saved' | 'skipped' | 'refused' | 'conflict' | 'failed'> {
    const field = fieldOfEdit(item.edit)
    const view = this.snapshot.view
    const built = patchOfEdit(view, item.edit)
    if (!built.ok) {
      // Nothing to write is not an error; text the owner cannot take is told next to its field.
      if (built.reason === 'empty_text' || built.reason === 'empty_tags') this.set({ error: { kind: 'refused', field } })
      return 'skipped'
    }
    const attempt = `${view.revision}:${view.body_sha256}:${item.key}`
    const key = this.keys.get(attempt) ?? this.options.newIdempotencyKey()
    this.keys.set(attempt, key)
    this.set({ pending: field, error: null })
    try {
      const result = await this.options.send({ expectedRevision: view.revision, expectedBodySha256: view.body_sha256, idempotencyKey: key, patch: built.patch })
      this.keys.delete(attempt)
      if (this.disposed) return 'saved'
      this.set({ view: result.view, pending: null })
      if (result.outcome === 'created') this.options.onSaved?.(result)
      return 'saved'
    } catch (failure) {
      if (this.disposed) return 'failed'
      if (isPublishPackageConflict(failure)) {
        this.keys.delete(attempt)
        const fresh = await this.options.reload().catch(() => null)
        if (this.disposed) return 'conflict'
        this.set({ ...(fresh ? { view: fresh } : {}), pending: null, error: { kind: 'conflict', field: null } })
        return 'conflict'
      }
      if (isPublishPackageUnavailable(failure)) {
        this.set({ pending: null, error: { kind: 'unavailable', field: null } })
        return 'failed'
      }
      if (isPublishPackageRefused(failure)) {
        this.keys.delete(attempt)
        this.set({ pending: null, error: { kind: 'refused', field } })
        return 'refused'
      }
      // A refusal (4xx) is final for that key; an unknown outcome keeps it, so the retry replays.
      if (failure instanceof AuthClientError && failure.status >= 400 && failure.status < 500) this.keys.delete(attempt)
      this.set({ pending: null, error: { kind: 'failed', field } })
      return 'failed'
    }
  }

  private set(patch: Partial<PublishPackageSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of [...this.listeners]) listener()
  }
}

import { createSparkMediaLibrary, type SparkMediaLibrary } from '@/lib/spark/media/media-library'
import type { SparkMediaKind } from '@/lib/spark/media/media-files'
import { createSparkMediaUploader, waitForStorageReady, type RefusedFile, type SparkMediaUploader, type UploadItem } from '@/lib/spark/media/media-upload'
import { ensureProjectSource } from '@/lib/spark/media/media-source'
import type { AttachFailureReason, AttachReceipt } from '@/lib/spark/source-attach-client'
import { pendingInsertsFor, type PendingInsertStore } from '@/lib/spark/stage/pending-inserts'
import type { PlacementTarget } from '@/lib/spark/stage/placement'

import { insertProjectAudio, insertProjectSource, type InsertMediaOptions } from '../insert-source'
import type { SparkToolContext } from '../spark-tool-types'

/**
 * The Media tool's per-editor services (`SparkToolContext.service`): the upload queue, the "My media" library and the
 * adder that turns a card into a placed clip. They are created on first use and live as long as the editor, so a running
 * upload survives closing the drawer or switching to another tool.
 */

/**
 * WP5a: brings the editor's copy up to a source the server just attached: from the attach receipt (`source_media`, no
 * document re-read) when the session can take it, else the usual conditional re-read.
 */
export function sourceRefresh(ctx: () => SparkToolContext): (receipt?: AttachReceipt) => Promise<void> {
  return (receipt) => {
    const actions = ctx().actions
    if (receipt && receipt.state === 'attached' && actions.adoptAttachedSource) return actions.adoptAttachedSource(receipt)
    return actions.refresh?.(receipt ? { minVersion: receipt.working_copy_version } : undefined) ?? Promise.resolve()
  }
}

export const mediaUploaderOf = (ctx: SparkToolContext): SparkMediaUploader =>
  ctx.service('media.uploader', () =>
    createSparkMediaUploader({
      channelId: ctx.project.channelId,
      projectId: ctx.project.id,
      baseRevision: () => ctx.current().latest().workingCopy?.workingCopyVersion ?? 0,
      refresh: sourceRefresh(() => ctx.current()),
      // A new file shows up in "My media" without reopening the tab.
      onFinished: () => void mediaLibraryOf(ctx.current()).refresh(),
    }),
  )

/** WP5a: with instant editing a picked file goes to the playhead by itself once it is ready (no extra "Add"). */
export const autoPlacesUploads = (ctx: SparkToolContext): boolean => ctx.composition.optimistic === true && ctx.stage !== null

/**
 * Uploads files and places each one at `target` as soon as it is a usable source (one command per file). With instant
 * editing the stage shows the local file (image or video) at once with an upload / processing badge, a placeholder that is
 * not part of the project, until the placed clip is drawn (or the file failed, was cancelled or removed from the list).
 */
export function uploadAndPlace(ctx: SparkToolContext, files: readonly File[], target: PlacementTarget): { accepted: UploadItem[]; refused: RefusedFile[] } {
  const uploader = mediaUploaderOf(ctx)
  const adder = mediaAdderOf(ctx)
  const placeholders = new Map<string, string>()
  const pending = ctx.composition.optimistic === true && ctx.stage ? pendingInsertsFor(ctx.stage.controller) : null
  const settle = (itemId: string) => {
    const placeholder = placeholders.get(itemId)
    if (!placeholder) return
    placeholders.delete(itemId)
    pending?.remove(placeholder)
  }
  const result = uploader.add(files, async (item) => {
    if (!item.sourceId) return
    try {
      // Timeline v3: with instant editing the placeholder goes as soon as the stage drew the editor's own copy that holds
      // the clip, not after the server's answer.
      const placed = await adder.addSource(item.id, item.sourceId, item.kind, target, { onLocal: () => afterDrawn(ctx, () => settle(item.id)) })
      // The placeholder goes once the stage has drawn the copy that holds the clip.
      if (placed) await ctx.current().stage?.controller.whenSettled()
    } finally {
      settle(item.id)
    }
  })
  if (pending) {
    for (const item of result.accepted) {
      if (item.kind === 'audio' || !item.previewUrl) continue
      placeholders.set(item.id, pending.add({ kind: item.kind, label: item.name, status: 'uploading', progress: 0, previewUrl: item.previewUrl }))
    }
    if (placeholders.size > 0) {
      const stop = uploader.subscribe(() => {
        const items = new Map(uploader.getSnapshot().items.map((item) => [item.id, item]))
        for (const [itemId, placeholder] of [...placeholders]) {
          const item = items.get(itemId)
          if (!item || item.phase === 'failed' || item.phase === 'cancelled') settle(itemId)
          else if (item.phase === 'queued' || item.phase === 'uploading') pending.update(placeholder, { status: 'uploading', progress: item.progress })
          else pending.update(placeholder, { status: 'processing', progress: null })
        }
        if (placeholders.size === 0) stop()
      })
    }
  }
  return result
}

/**
 * Timeline v3: runs `done` once the stage has drawn the copy the session just published (that copy reaches the stage in
 * React's next commit, and `whenSettled` covers its drawing from then on). Without a stage it runs on the next task.
 */
function afterDrawn(ctx: SparkToolContext, done: () => void): void {
  globalThis.setTimeout(() => {
    const controller = ctx.current().stage?.controller
    void (controller ? controller.whenSettled() : Promise.resolve()).catch(() => undefined).then(done)
  }, 0)
}

export const mediaLibraryOf = (ctx: SparkToolContext): SparkMediaLibrary =>
  ctx.service('media.library', () => createSparkMediaLibrary({ channelId: ctx.project.channelId }))

export const mediaAdderOf = (ctx: SparkToolContext): SparkMediaAdder => ctx.service('media.adder', () => new SparkMediaAdder(() => ctx.current()))

export type AdderBusy = 'binding' | 'processing' | 'placing'
export type AdderState = { busy: Readonly<Record<string, AdderBusy>> }

const FAILURE_KEY: Record<AttachFailureReason, string> = {
  not_ready: 'media.notices.notReady',
  checksum_mismatch: 'media.notices.changed',
  forbidden: 'media.notices.forbidden',
  not_active: 'media.notices.forbidden',
  probe_invalid: 'media.notices.probeInvalid',
  too_long: 'media.notices.tooLong',
  attach_failed: 'media.notices.bindFailed',
  unavailable: 'media.notices.unavailable',
  unknown: 'media.notices.bindFailed',
}

/** A Storage object a card stands for; `name` labels its placeholder on the canvas while it is added. */
export type AdderObject = { id: string; checksum: string | null; kind: SparkMediaKind | null; ready: boolean; name?: string }

/**
 * Turns a card into a placed clip: an object that is not yet a project source is bound first (a video or audio file shows
 * "Processing..." until its probe exists, then it is inserted), then placed at `target` (the playhead for the "+" button,
 * the drop for a drag) by the stage. `busy` is keyed by the card (object id or upload id) so the card shows its state.
 */
export class SparkMediaAdder {
  private state: AdderState = { busy: {} }
  private readonly listeners = new Set<() => void>()
  private readonly aborts = new Set<AbortController>()
  private disposed = false

  constructor(private readonly live: () => SparkToolContext) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): AdderState => this.state

  dispose(): void {
    this.disposed = true
    for (const controller of this.aborts) controller.abort()
    this.listeners.clear()
  }

  private mark(key: string, busy: AdderBusy | null): void {
    if (this.disposed) return
    const next = { ...this.state.busy }
    if (busy) next[key] = busy
    else delete next[key]
    this.state = { busy: next }
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * A card of "My media" (or a dragged one): bind, wait for the probe if needed, then place. Resolves true when placed.
   *
   * Timeline v3 (instant media add): with instant editing the canvas shows the card's thumbnail as a placeholder from the
   * click until the stage drew the placed clip; the insert covers the canvas with the thumbnail's aspect (the exact fit
   * follows in the same undo step), and the card's busy state ends when the clip is in the drawn copy, not on the receipt.
   */
  async addObject(object: AdderObject, target: PlacementTarget = { kind: 'playhead' }): Promise<boolean> {
    const ctx = this.live()
    if (!object.kind) {
      ctx.notify('media.notices.notReady', undefined, 'error')
      return false
    }
    if (this.state.busy[object.id]) return false
    const controller = new AbortController()
    this.aborts.add(controller)
    this.mark(object.id, 'binding')
    const library = mediaLibraryOf(ctx)
    const placeholder = this.placeholderFor(ctx, object, library.cachedThumbnailUrl(object.id))
    let releasing = false
    const release = () => {
      if (releasing || !placeholder) return
      releasing = true
      afterDrawn(this.live(), () => placeholder.store.remove(placeholder.id))
    }
    let placed = false
    try {
      // A file still being received or scanned shows "Processing..." and is added as soon as Storage says it is ready.
      let checksum = object.checksum
      if (!object.ready || !checksum) {
        this.mark(object.id, 'processing')
        placeholder?.store.update(placeholder.id, { status: 'processing' })
        const ready = await waitForStorageReady(ctx.project.channelId, object.id, controller.signal)
        if ('failed' in ready) {
          this.live().notify(ready.failed === 'rejected' ? 'media.notices.probeInvalid' : 'media.notices.notReady', undefined, 'error')
          return false
        }
        checksum = ready.checksum
        this.mark(object.id, 'binding')
      }
      const source = await ensureProjectSource({
        projectId: ctx.project.id,
        document: () => this.live().latest().workingCopy?.document ?? null,
        storageObjectId: object.id,
        checksum,
        baseRevision: () => this.live().latest().workingCopy?.workingCopyVersion ?? 0,
        refresh: sourceRefresh(this.live),
        signal: controller.signal,
        onAwaitingProbe: () => {
          this.mark(object.id, 'processing')
          placeholder?.store.update(placeholder.id, { status: 'processing' })
        },
        // WP5a: a long probe is said once; the card keeps waiting and is placed when the file is ready.
        onStillProcessing: () => this.live().notify('media.notices.stillProcessingWaiting'),
      })
      if (source.status === 'awaiting_probe') {
        this.live().notify('media.notices.stillProcessing')
        return false
      }
      if (source.status === 'failed') {
        this.live().notify(FAILURE_KEY[source.reason], undefined, 'error')
        return false
      }
      this.mark(object.id, 'placing')
      placeholder?.store.update(placeholder.id, { status: 'saving' })
      placed = await this.place(source.sourceId, object.kind, target, {
        sizeHint: library.thumbnailSize(object.id),
        onLocal: () => {
          this.mark(object.id, null)
          release()
        },
      })
      return placed
    } catch {
      if (!controller.signal.aborted) this.live().notify('media.notices.bindFailed', undefined, 'error')
      return false
    } finally {
      this.aborts.delete(controller)
      this.mark(object.id, null)
      // Placed without a local copy (the classic session): the placeholder goes once the server's picture is drawn.
      if (placed) release()
      else if (placeholder && !releasing) placeholder.store.remove(placeholder.id)
    }
  }

  /** A source that is already part of the project (a fresh upload, a card of this video): place it. */
  async addSource(
    key: string,
    sourceId: string,
    kind: SparkMediaKind,
    target: PlacementTarget = { kind: 'playhead' },
    options: { onLocal?: () => void } = {},
  ): Promise<boolean> {
    if (this.state.busy[key]) return false
    this.mark(key, 'placing')
    try {
      return await this.place(sourceId, kind, target, {
        onLocal: () => {
          this.mark(key, null)
          options.onLocal?.()
        },
      })
    } finally {
      this.mark(key, null)
    }
  }

  /**
   * Timeline v3: the canvas placeholder of a card being added (instant editing only): the card's thumbnail (a short-lived
   * signed Storage URL the drawer already minted; none: a plain box) with an "Adding" badge, until the clip is drawn.
   */
  private placeholderFor(ctx: SparkToolContext, object: AdderObject, posterUrl: string | null): { store: PendingInsertStore; id: string } | null {
    if (ctx.composition.optimistic !== true || !ctx.stage || (object.kind !== 'image' && object.kind !== 'video')) return null
    const store = pendingInsertsFor(ctx.stage.controller)
    return { store, id: store.add({ kind: object.kind, label: object.name ?? '', status: 'saving', posterUrl }) }
  }

  private async place(sourceId: string, kind: SparkMediaKind, target: PlacementTarget, options: InsertMediaOptions = {}): Promise<boolean> {
    const ctx = this.live()
    if (kind === 'audio') return insertProjectAudio(ctx, sourceId, target, options.onLocal ? { onLocal: options.onLocal } : {})
    return (await insertProjectSource(ctx, sourceId, kind, target, options)) !== null
  }
}

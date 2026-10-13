import { AuthClientError } from '@/lib/auth/errors'
import { getMyFeatureLimits } from '@/lib/feature-control/api'
import { createStorageFolder, getStorageObject } from '@/lib/storage/api'
import { attachStorageObject, type AttachFailureReason, type AttachOptions, type AttachResult } from '../source-attach-client'

import { forgetLocalMedia, localMedia, rememberLocalImageSize, rememberLocalMedia } from './local-media'
import { SPARK_MEDIA_FOLDER, classifyMediaFile, type MediaFileRefusal, type SparkMediaKind } from './media-files'

/**
 * E1-A uploads of the Media drawer (D10): files picked in the Upload tab or dropped on the drawer / canvas / timeline go
 * to the Storage folder "Spark" (multi-file, per-file progress and cancel through the shared upload queue), become READY
 * Storage objects, and are then bound to the project (`attachStorageObject`). A video or audio file is bound before its
 * probe exists and shows "Processing..." until the Storage ingest worker has written it; images are usable at once.
 * Placing the source on the timeline is NOT done here: the caller does it from `onReady` (a canvas drop) or the user
 * adds the card from the list (the Upload tab). Framework-free; React subscribes with `useSyncExternalStore`.
 */

export type UploadPhase = 'queued' | 'uploading' | 'finalizing' | 'binding' | 'processing' | 'ready' | 'failed' | 'cancelled'

export type UploadFailure =
  | 'too_large'
  | 'storage_full'
  | 'upload_disabled'
  | 'unsupported'
  | 'rejected'
  | 'not_ready'
  | 'bind_failed'
  | 'probe_invalid'
  | 'too_long'
  | 'forbidden'
  | 'network'
  | 'unknown'

export type UploadItem = {
  id: string
  name: string
  sizeBytes: number
  kind: SparkMediaKind
  phase: UploadPhase
  /** 0-100, the file transfer. */
  progress: number
  storageObjectId: string | null
  sourceId: string | null
  failure: UploadFailure | null
  /** The plan's single-file limit in MB when the gateway refused the size and named it. */
  limitMb: number | null
  /** The bounded wait for the probe ended: the binding is durable, `recheck` asks again. */
  stalled: boolean
  /**
   * WP5a: an object URL of the picked file (image or video) to show at once, before and while it uploads; null for audio
   * or where the browser has no object URLs. Revoked by the queue (the editor closed, or the file never became a source).
   */
  previewUrl: string | null
  /** WP5a: what the browser measured while preparing the upload (null until known; each field null when unknown). */
  measured: { width: number | null; height: number | null; durationSeconds: number | null } | null
  /** WP5a: when the source started waiting for its probe (ms epoch), for the visible "processing" time; null otherwise. */
  processingSince: number | null
  /** WP5a: the probe takes long (a long video); the queue keeps waiting and adds the file when it is ready. */
  stillProcessing: boolean
}

export type UploadState = { items: UploadItem[] }

/** A finished transfer, with what the browser measured while preparing it (the Storage upload probes the file locally). */
export type UploadedObject = {
  storageObjectId: string
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
}

/** WP5a test seam: the browser's object URLs of picked files. */
export type ObjectUrls = { create(file: File): string | null; revoke(url: string): void }

const browserObjectUrls: ObjectUrls = {
  create: (file) => (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null),
  revoke: (url) => {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
  },
}

export type UploadReadyHandler = (item: UploadItem) => void | Promise<void>

export type UploadDeps = {
  /** Creates (or finds) a Storage folder at the root and resolves its path. */
  ensureFolder(channelId: string, name: string, signal: AbortSignal): Promise<string>
  upload(
    channelId: string,
    file: File,
    kind: SparkMediaKind,
    onProgress: (percent: number) => void,
    options: { signal: AbortSignal; parentPath: string },
  ): Promise<UploadedObject>
  /**
   * The largest single file the plan allows, in MB (the effective `min` of the Spark and Storage upload limits), or null when
   * it cannot be read (the gateway still refuses an oversized file when the upload starts).
   */
  maxUploadMb(): Promise<number | null>
  /** Waits until the object is READY (transfer complete, scanned) and resolves its checksum. */
  waitReady(channelId: string, storageObjectId: string, signal: AbortSignal): Promise<{ checksum: string } | { failed: 'rejected' | 'not_ready' }>
  attach(options: AttachOptions): Promise<AttachResult>
}

export type MediaUploaderOptions = {
  channelId: string
  projectId: string
  /** The working copy version the editor holds (the attach `base_revision`). */
  baseRevision: () => number
  /** Brings the editor's copy up to a source that entered the document (WP5a: from the attach receipt when there is one). */
  refresh: AttachOptions['refresh']
  deps?: Partial<UploadDeps>
  createId?: () => string
  /** A file became part of the project (the Media tool refreshes "My media"). */
  onFinished?: (item: UploadItem) => void
  /** WP5a: object URLs of picked files (default: the browser's). */
  objectUrls?: ObjectUrls
  /** WP5a test seams: the attach poll pacing and the clock of the visible processing time. */
  attachPoll?: AttachOptions['pollMs']
  now?: () => number
}

export type RefusedFile = { name: string; reason: MediaFileRefusal }

const MB = 1024 * 1024

export function classifyUploadError(error: unknown): { failure: UploadFailure; limitMb: number | null } {
  if (error instanceof AuthClientError) {
    switch (error.code) {
      case 'STORAGE_UPLOAD_SIZE_EXCEEDED': {
        const max = Number((error.details as { max_bytes?: unknown } | undefined)?.max_bytes)
        return { failure: 'too_large', limitMb: Number.isFinite(max) && max > 0 ? Math.floor(max / MB) : null }
      }
      case 'STORAGE_HARD_LIMIT_EXCEEDED':
        return { failure: 'storage_full', limitMb: null }
      case 'STORAGE_UPLOAD_DISABLED':
        return { failure: 'upload_disabled', limitMb: null }
      case 'STORAGE_UNSUPPORTED_FILE_TYPE':
      case 'STORAGE_MIME_MISMATCH':
        return { failure: 'unsupported', limitMb: null }
      case 'STORAGE_MALWARE_DETECTED':
        return { failure: 'rejected', limitMb: null }
      default:
        if (error.status === 401 || error.status === 403) return { failure: 'forbidden', limitMb: null }
        if (error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT' || error.status >= 500) return { failure: 'network', limitMb: null }
        return { failure: 'unknown', limitMb: null }
    }
  }
  return { failure: error instanceof TypeError ? 'network' : 'unknown', limitMb: null }
}

function bindFailure(reason: AttachFailureReason): UploadFailure {
  switch (reason) {
    case 'not_ready':
      return 'not_ready'
    case 'probe_invalid':
      return 'probe_invalid'
    case 'too_long':
      return 'too_long'
    case 'forbidden':
    case 'not_active':
      return 'forbidden'
    case 'unavailable':
      return 'network'
    default:
      return 'bind_failed'
  }
}

const isAbort = (error: unknown, signal: AbortSignal) =>
  signal.aborted || (error instanceof DOMException && error.name === 'AbortError') || (error as { code?: unknown } | null)?.code === 'STORAGE_UPLOAD_ABORTED'

const folderPaths = new Map<string, Promise<string>>()

/** The Storage upload module is large (the media picker): loaded once, on the first upload, and shared by concurrent ones. */
let uploadModule: Promise<typeof import('@/components/storage/storage-media-input')> | null = null
const storageUploadModule = () => (uploadModule ??= import('@/components/storage/storage-media-input'))

/** WP5a: how long a finished transfer may take to be scanned and checksummed (a large video) before it counts as not ready. */
export const STORAGE_READY_TIMEOUT_MS = 10 * 60_000

/**
 * Waits (bounded, abortable) until a Storage object is READY: transfer complete, scanned, checksummed. Resolves its
 * checksum, or why it will not become ready (rejected by the scan, or not ready in time).
 */
export async function waitForStorageReady(
  channelId: string,
  storageObjectId: string,
  signal: AbortSignal,
): Promise<{ checksum: string } | { failed: 'rejected' | 'not_ready' }> {
  const started = Date.now()
  for (;;) {
    const object = await getStorageObject({ channelId, objectId: storageObjectId }, { signal })
    if (object.status === 'failed' || object.status === 'quarantined' || object.status === 'deleted' || object.readiness_reason === 'malware_scan_rejected') return { failed: 'rejected' }
    if (object.status === 'active' && object.checksum_sha256 && object.readiness_reason === 'ready') return { checksum: object.checksum_sha256.toLowerCase() }
    if (Date.now() - started > STORAGE_READY_TIMEOUT_MS) return { failed: 'not_ready' }
    // Brisk for the first two minutes (an image is ready in seconds), then every 5 s.
    const pause = Date.now() - started > 120_000 ? 5000 : 1500
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, pause)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })
  }
}

/** The default deps: the real Storage client (the folder path is remembered per channel for the page's life, never stored). */
export function defaultUploadDeps(): UploadDeps {
  return {
    async ensureFolder(channelId, name) {
      const key = `${channelId}\u001f${name}`
      let pending = folderPaths.get(key)
      if (!pending) {
        pending = createStorageFolder({ channelId, name }).then((folder) => folder.path)
        folderPaths.set(key, pending)
        pending.catch(() => folderPaths.delete(key))
      }
      return pending
    },
    async upload(channelId, file, kind, onProgress, options) {
      const { uploadStorageMedia } = await storageUploadModule()
      const uploaded = await uploadStorageMedia(channelId, file, kind, undefined, onProgress, { signal: options.signal, parentPath: options.parentPath })
      // WP5a: the Storage upload already decoded the file locally (size, length): passed on instead of measured again.
      return { storageObjectId: uploaded.storageObjectId, width: uploaded.width, height: uploaded.height, durationSeconds: uploaded.durationSeconds }
    },
    waitReady: waitForStorageReady,
    maxUploadMb: planUploadLimitMb,
    attach: attachStorageObject,
  }
}

/** Feature Control keys of the single-file upload limit; the effective limit is the smallest one the plan sets (F42/Q21). */
const UPLOAD_LIMIT_KEYS = ['spark_max_upload_size_mb', 'max_storage_upload_size_mb', 'max_upload_size_mb'] as const
let uploadLimit: Promise<number | null> | null = null
function planUploadLimitMb(): Promise<number | null> {
  uploadLimit ??= getMyFeatureLimits().then(
    (limits) => {
      const values = limits.features.filter((feature) => (UPLOAD_LIMIT_KEYS as readonly string[]).includes(feature.key) && Number.isFinite(feature.value) && feature.value > 0).map((feature) => feature.value)
      return values.length > 0 ? Math.min(...values) : null
    },
    () => {
      uploadLimit = null
      return null
    },
  )
  return uploadLimit
}

/** Forgets the remembered plan limit (tests). */
export function resetPlanUploadLimit(): void {
  uploadLimit = null
}

const INITIAL: UploadState = { items: [] }

export class SparkMediaUploader {
  private state: UploadState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly deps: UploadDeps
  private readonly files = new Map<string, File>()
  private readonly aborts = new Map<string, AbortController>()
  private readonly checksums = new Map<string, string>()
  private readonly handlers = new Map<string, UploadReadyHandler | undefined>()
  private readonly folders = new Map<string, string>()
  /** WP5a: the object URL of every picked image or video, by item; revoked by `dispose` or when the file was dropped. */
  private readonly previews = new Map<string, string>()
  private readonly objectUrls: ObjectUrls
  private readonly now: () => number
  private disposed = false
  private counter = 0

  constructor(private readonly options: MediaUploaderOptions) {
    this.deps = { ...defaultUploadDeps(), ...options.deps }
    this.objectUrls = options.objectUrls ?? browserObjectUrls
    this.now = options.now ?? (() => Date.now())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): UploadState => this.state

  /**
   * Aborts every transfer and drops the listeners (the editor left). WP5a: the local previews are released too; the stage
   * that drew from them goes away with the editor.
   */
  dispose(): void {
    this.disposed = true
    for (const controller of this.aborts.values()) controller.abort()
    this.listeners.clear()
    for (const item of this.state.items) this.releasePreview(item.id, item.storageObjectId)
  }

  /**
   * Takes files: each accepted one starts at once (the shared upload queue runs two transfers at a time); the refused
   * ones (GIF, SVG, other types, empty files) come back with the reason and never reach Storage. `onReady` runs once
   * the source of THAT file is bound and usable. `options.folder` is the Storage folder (default "Spark", D10; the
   * recorder uses "Recordings", D7).
   */
  add(files: readonly File[], onReady?: UploadReadyHandler, options: { folder?: string } = {}): { accepted: UploadItem[]; refused: RefusedFile[] } {
    const accepted: UploadItem[] = []
    const refused: RefusedFile[] = []
    for (const file of files) {
      const check = classifyMediaFile(file)
      if (!check.ok) {
        refused.push({ name: file.name, reason: check.reason })
        continue
      }
      this.counter += 1
      const id = this.options.createId?.() ?? `up_${this.counter}`
      // WP5a: the picked file itself is what the editor shows at once (the upload tab's row, the stage's placeholder).
      const previewUrl = check.kind === 'audio' ? null : this.objectUrls.create(file)
      if (previewUrl) this.previews.set(id, previewUrl)
      const item: UploadItem = {
        id,
        name: file.name,
        sizeBytes: file.size,
        kind: check.kind,
        phase: 'queued',
        progress: 0,
        storageObjectId: null,
        sourceId: null,
        failure: null,
        limitMb: null,
        stalled: false,
        previewUrl,
        measured: null,
        processingSince: null,
        stillProcessing: false,
      }
      this.files.set(item.id, file)
      this.handlers.set(item.id, onReady)
      this.folders.set(item.id, options.folder ?? SPARK_MEDIA_FOLDER)
      this.set({ items: [...this.state.items, item] })
      accepted.push(item)
      void this.run(item.id)
    }
    return { accepted, refused }
  }

  cancel(id: string): void {
    this.aborts.get(id)?.abort()
  }

  /** Starts a failed or cancelled file again from the beginning. */
  retry(id: string): void {
    const item = this.find(id)
    if (!item || (item.phase !== 'failed' && item.phase !== 'cancelled')) return
    this.patch(id, { phase: 'queued', progress: 0, failure: null, limitMb: null, stalled: false, processingSince: null, stillProcessing: false })
    void this.run(id)
  }

  /**
   * Waits again for a bound file whose probe did not arrive within the wait (WP5a: 30 min; the binding is durable, so this
   * resumes the same wait; the file is still added when it is ready, `onReady` included).
   */
  recheck(id: string): void {
    const item = this.find(id)
    if (!item || !item.storageObjectId || !this.checksums.has(id) || (item.phase !== 'processing' && item.phase !== 'failed')) return
    const controller = new AbortController()
    this.aborts.set(id, controller)
    this.patch(id, { phase: 'binding', failure: null, stalled: false })
    void this.bind(id, controller.signal)
  }

  dismiss(id: string): void {
    const item = this.find(id)
    this.aborts.get(id)?.abort()
    this.aborts.delete(id)
    this.files.delete(id)
    this.handlers.delete(id)
    this.folders.delete(id)
    this.checksums.delete(id)
    // A file that became a source may be on the stage, drawn from its local preview: that stays until the editor closes.
    if (item && item.phase !== 'ready') this.releasePreview(id, item.storageObjectId)
    this.set({ items: this.state.items.filter((candidate) => candidate.id !== id) })
  }

  /** Drops the finished rows (ready, failed, cancelled). */
  clearFinished(): void {
    for (const item of this.state.items) if (item.phase === 'ready' || item.phase === 'failed' || item.phase === 'cancelled') this.dismiss(item.id)
  }

  // ---------------------------------------------------------------- pipeline

  private find(id: string): UploadItem | undefined {
    return this.state.items.find((item) => item.id === id)
  }

  private releasePreview(id: string, storageObjectId: string | null): void {
    const url = this.previews.get(id)
    if (!url) return
    this.previews.delete(id)
    if (storageObjectId && localMedia(storageObjectId)?.url === url) forgetLocalMedia(storageObjectId)
    this.objectUrls.revoke(url)
  }

  /**
   * WP5a: once Storage named the bytes (checksum), the editor's stage may use what the browser knows of them: an image's
   * measured size (the original is not downloaded to learn it) and the local file to draw or play.
   */
  private shareLocalFacts(id: string, storageObjectId: string, checksum: string): void {
    const item = this.find(id)
    const url = this.previews.get(id)
    if (!item || !url || item.kind === 'audio') return
    const measured = item.measured
    const sized = Boolean(measured && (measured.width ?? 0) > 0 && (measured.height ?? 0) > 0)
    if (item.kind === 'image' && measured && sized) rememberLocalImageSize(checksum, measured)
    // An image the browser could not measure, or a video it could not decode (HEVC in Chrome, say), is read from the server.
    // The measured size also lets a media insert cover the canvas at once (`cover-transform.ts`) without a download.
    rememberLocalMedia(storageObjectId, {
      url,
      kind: item.kind,
      playable: sized,
      ...(measured && sized && { size: { width: measured.width!, height: measured.height! } }),
    })
  }

  private patch(id: string, patch: Partial<UploadItem>): void {
    if (this.disposed) return
    this.set({ items: this.state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) })
  }

  private set(next: UploadState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }

  private async run(id: string): Promise<void> {
    const file = this.files.get(id)
    const item = this.find(id)
    if (!file || !item) return
    const controller = new AbortController()
    this.aborts.set(id, controller)
    const { signal } = controller
    try {
      this.patch(id, { phase: 'uploading', progress: 0 })
      // The plan's single-file limit is checked BEFORE any byte is sent, with the limit named (the gateway checks it too).
      const limitMb = await this.deps.maxUploadMb().catch(() => null)
      if (limitMb !== null && file.size > limitMb * MB) {
        this.patch(id, { phase: 'failed', failure: 'too_large', limitMb: Math.floor(limitMb) })
        return
      }
      const parentPath = await this.deps.ensureFolder(this.options.channelId, this.folders.get(id) ?? SPARK_MEDIA_FOLDER, signal)
      const uploaded = await this.deps.upload(
        this.options.channelId,
        file,
        item.kind,
        (percent) => this.patch(id, { progress: Math.max(0, Math.min(100, Math.round(percent))) }),
        { signal, parentPath },
      )
      const measured = {
        width: uploaded.width ?? null,
        height: uploaded.height ?? null,
        durationSeconds: uploaded.durationSeconds ?? null,
      }
      this.patch(id, { phase: 'finalizing', progress: 100, storageObjectId: uploaded.storageObjectId, measured })
      const ready = await this.deps.waitReady(this.options.channelId, uploaded.storageObjectId, signal)
      if ('failed' in ready) {
        this.patch(id, { phase: 'failed', failure: ready.failed })
        return
      }
      this.checksums.set(id, ready.checksum)
      this.shareLocalFacts(id, uploaded.storageObjectId, ready.checksum)
      this.patch(id, { phase: 'binding' })
      await this.bind(id, signal)
    } catch (error) {
      this.fail(id, error, signal)
    }
  }

  private async bind(id: string, signal: AbortSignal): Promise<void> {
    const item = this.find(id)
    const checksum = this.checksums.get(id)
    if (!item?.storageObjectId || !checksum) return
    try {
      const result = await this.deps.attach({
        projectId: this.options.projectId,
        storageObjectId: item.storageObjectId,
        checksum,
        provenance: 'upload',
        baseRevision: this.options.baseRevision,
        refresh: this.options.refresh,
        signal,
        onAwaitingProbe: () => this.patch(id, { phase: 'processing', processingSince: this.find(id)?.processingSince ?? this.now() }),
        // WP5a: a long probe is a state of its own; the wait goes on and the file is still added when it is ready.
        onStillProcessing: () => this.patch(id, { stillProcessing: true }),
        ...(this.options.attachPoll && { pollMs: this.options.attachPoll }),
      })
      if (result.status === 'ready') {
        this.patch(id, { phase: 'ready', sourceId: result.sourceId, stalled: false, stillProcessing: false })
        const handler = this.handlers.get(id)
        this.handlers.delete(id)
        const latest = this.find(id)
        if (latest) this.options.onFinished?.(latest)
        if (handler && latest) await Promise.resolve(handler(latest)).catch(() => undefined)
      } else if (result.status === 'awaiting_probe') {
        this.patch(id, { phase: 'processing', sourceId: result.sourceId, stalled: true })
      } else {
        this.patch(id, { phase: 'failed', failure: bindFailure(result.reason) })
      }
    } catch (error) {
      this.fail(id, error, signal)
    }
  }

  private fail(id: string, error: unknown, signal: AbortSignal): void {
    if (isAbort(error, signal)) {
      this.patch(id, { phase: 'cancelled' })
      return
    }
    const { failure, limitMb } = classifyUploadError(error)
    this.patch(id, { phase: 'failed', failure, limitMb })
  }
}

export function createSparkMediaUploader(options: MediaUploaderOptions): SparkMediaUploader {
  return new SparkMediaUploader(options)
}

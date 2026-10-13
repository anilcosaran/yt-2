import { listMediaLibrary, type MediaLibraryCard } from '@/lib/media-catalog/library-api'
import { getCoalescedStorageDeliveryUrls } from '@/lib/storage/api'

import { classifyMediaFile, type MediaFileRefusal, type SparkMediaKind } from './media-files'

/**
 * E1-A "My media" (D10): the channel's own media as the Media drawer's second tab: image / video / audio (uploads and
 * generated results, every folder), newest first, searchable, with a category filter and "load more". The list is the
 * P02-09 personal media library (`media_library_card_v1`): keyset-paged, readiness and allowed actions from the server.
 * Nothing is cached in browser storage; grid thumbnails are minted per visible card and cooled down on failure (a
 * placeholder, never the large original). Framework-free; React subscribes with `useSyncExternalStore`.
 */

export type LibraryCategory = 'all' | SparkMediaKind

export type LibraryItem = {
  id: string
  name: string
  /** What the file is; null for a file the editor cannot use (GIF, SVG). */
  kind: SparkMediaKind | null
  /** Why a file cannot be used (GIF and SVG are refused by the compiler); null for a usable one. */
  unsupported: MediaFileRefusal | null
  mimeType: string | null
  checksum: string | null
  /** Transfer complete, scanned and checksummed, and the server allows inserting it: it can be bound to a project. */
  ready: boolean
  /** Still being received, scanned or probed (the card shows "Processing..."). */
  processing: boolean
  failed: boolean
  durationSeconds: number | null
  sizeBytes: string
  createdAt: string
  /** How the card previews itself: a derivative thumbnail, the original within the preview budget, or not at all. */
  preview: 'thumbnail' | 'original' | 'none'
}

export type LibraryState = {
  status: 'loading' | 'ready' | 'error'
  items: LibraryItem[]
  category: LibraryCategory
  query: string
  hasMore: boolean
  /** A new filter or search is loading (the current cards stay). */
  searching: boolean
  loadingMore: boolean
}

export type LibraryPage = { items: MediaLibraryCard[]; nextCursor: string | null }

export type ThumbnailResult = { url: string; expiresInSeconds: number } | null

export type MediaLibraryTransport = {
  list(input: { channelId: string; kind: SparkMediaKind | null; query: string; cursor: string | null; limit: number; signal: AbortSignal }): Promise<LibraryPage>
  /** A short-lived grid preview URL of one object, null when there is none. */
  thumbnail(input: { channelId: string; objectId: string; preview: 'thumbnail' | 'original'; signal: AbortSignal }): Promise<ThumbnailResult>
}

export type MediaLibraryOptions = {
  channelId: string
  transport?: MediaLibraryTransport
  pageSize?: number
  /** Injected for tests. */
  now?: () => number
}

export function libraryItemOf(card: MediaLibraryCard): LibraryItem {
  const check = classifyMediaFile({ name: card.title, type: card.mime_type })
  const refusal = check.ok ? null : check.reason === 'empty' ? 'unsupported' : check.reason
  const ready = card.readiness.state === 'ready' && Boolean(card.asset.checksum_sha256) && card.allowed_actions.includes('insert')
  return {
    id: card.asset.storage_object_id,
    name: card.title || card.asset.storage_object_id,
    // A GIF or SVG is "image" for the server but not for the compiler: it keeps its card and loses its actions.
    kind: refusal ? null : card.asset.media_kind,
    unsupported: refusal,
    mimeType: card.mime_type || null,
    checksum: card.asset.checksum_sha256?.toLowerCase() ?? null,
    ready,
    processing: card.readiness.state === 'processing',
    failed: card.readiness.state === 'unavailable',
    durationSeconds: card.duration_seconds,
    sizeBytes: card.size_bytes,
    createdAt: card.created_at,
    preview: card.preview.variant,
  }
}

/** The real clients: the P02-09 library list and the Storage batch delivery path. */
export function createStorageLibraryTransport(): MediaLibraryTransport {
  return {
    async list({ channelId, kind, query, cursor, limit, signal }) {
      const response = await listMediaLibrary({ channelId, ...(kind && { kind }), query, limit, cursor }, { signal })
      return { items: response.data, nextCursor: response.meta.next_cursor }
    },
    async thumbnail({ channelId, objectId, preview, signal }) {
      const response = await getCoalescedStorageDeliveryUrls(
        { channelId, items: [{ objectId, variant: preview, expiresInSeconds: 3600, ...(preview === 'original' && { purpose: 'grid' as const }) }] },
        { signal },
      )
      const result = response.items.find((item) => item.object_id === objectId)
      return result?.status === 'ok' ? { url: result.url, expiresInSeconds: result.expires_in_seconds } : null
    },
  }
}

const INITIAL: LibraryState = { status: 'loading', items: [], category: 'all', query: '', hasMore: false, searching: false, loadingMore: false }
/** A signed thumbnail is asked for again a little before it expires. */
const THUMB_EXPIRY_SKEW_MS = 60_000
const THUMB_RETRY_COOLDOWN_MS = 60_000

export class SparkMediaLibrary {
  private state: LibraryState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly transport: MediaLibraryTransport
  private readonly pageSize: number
  private readonly now: () => number
  private generation = 0
  private abort: AbortController | null = null
  private disposed = false
  private cursor: string | null = null
  private readonly thumbnails = new Map<string, { url: string; expiresAt: number } | { failedUntil: number } | Promise<string | null>>()
  private readonly thumbnailSizes = new Map<string, { width: number; height: number }>()

  constructor(private readonly options: MediaLibraryOptions) {
    this.transport = options.transport ?? createStorageLibraryTransport()
    this.pageSize = options.pageSize ?? 24
    this.now = options.now ?? (() => Date.now())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): LibraryState => this.state

  dispose(): void {
    this.disposed = true
    this.abort?.abort()
    this.listeners.clear()
  }

  /** The first page of the current filter. */
  async load(): Promise<void> {
    this.set({ ...this.state, status: this.state.items.length === 0 ? 'loading' : this.state.status, searching: this.state.items.length > 0 })
    await this.fetch(false)
  }

  retry(): Promise<void> {
    this.set({ ...this.state, status: 'loading' })
    return this.fetch(false)
  }

  /** Reads the first page again (after an upload finished). */
  refresh(): Promise<void> {
    return this.fetch(false)
  }

  setCategory(category: LibraryCategory): Promise<void> {
    if (category === this.state.category) return Promise.resolve()
    this.set({ ...this.state, category, searching: true })
    return this.fetch(false)
  }

  setQuery(query: string): Promise<void> {
    if (query === this.state.query) return Promise.resolve()
    this.set({ ...this.state, query, searching: true })
    return this.fetch(false)
  }

  loadMore(): Promise<void> {
    if (!this.state.hasMore || this.state.loadingMore) return Promise.resolve()
    this.set({ ...this.state, loadingMore: true })
    return this.fetch(true)
  }

  /** A grid thumbnail URL of a card, minted once and cached until shortly before it expires; null = a placeholder. */
  async thumbnailUrl(item: LibraryItem): Promise<string | null> {
    if (!item.kind || item.kind === 'audio' || item.preview === 'none') return null
    const cached = this.thumbnails.get(item.id)
    if (cached instanceof Promise) return cached
    if (cached && 'url' in cached && cached.expiresAt - THUMB_EXPIRY_SKEW_MS > this.now()) return cached.url
    if (cached && 'failedUntil' in cached && cached.failedUntil > this.now()) return null
    const controller = new AbortController()
    const pending = this.transport
      .thumbnail({ channelId: this.options.channelId, objectId: item.id, preview: item.preview, signal: controller.signal })
      .then((result) => {
        if (!result) {
          this.thumbnails.set(item.id, { failedUntil: this.now() + THUMB_RETRY_COOLDOWN_MS })
          return null
        }
        this.thumbnails.set(item.id, { url: result.url, expiresAt: this.now() + result.expiresInSeconds * 1000 })
        return result.url
      })
      .catch(() => {
        this.thumbnails.set(item.id, { failedUntil: this.now() + THUMB_RETRY_COOLDOWN_MS })
        return null
      })
    this.thumbnails.set(item.id, pending)
    return pending
  }

  /**
   * Timeline v3 (instant media add): the card's thumbnail URL when one is minted and still valid (no request); the canvas
   * shows it as the placeholder while the card is being added. Null otherwise.
   */
  cachedThumbnailUrl(objectId: string): string | null {
    const cached = this.thumbnails.get(objectId)
    return cached && !(cached instanceof Promise) && 'url' in cached && cached.expiresAt - THUMB_EXPIRY_SKEW_MS > this.now() ? cached.url : null
  }

  /**
   * Timeline v3: the pixel size of a card's thumbnail as the drawer drew it (`rememberThumbnailSize`). A thumbnail keeps its
   * media's aspect (no padding, no crop), which is all a media insert needs to cover the canvas before the picture is read.
   */
  thumbnailSize(objectId: string): { width: number; height: number } | null {
    return this.thumbnailSizes.get(objectId) ?? null
  }

  /** The drawer reports a thumbnail it drew (its `naturalWidth` / `naturalHeight`). In memory only. */
  rememberThumbnailSize(objectId: string, width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    this.thumbnailSizes.set(objectId, { width, height })
  }

  // ---------------------------------------------------------------- paging

  private async fetch(more: boolean): Promise<void> {
    const generation = more ? this.generation : ++this.generation
    if (!more) {
      this.abort?.abort()
      this.cursor = null
    }
    const controller = more ? (this.abort ?? new AbortController()) : new AbortController()
    if (!more) this.abort = controller
    const { category, query } = this.state
    try {
      const page = await this.transport.list({
        channelId: this.options.channelId,
        kind: category === 'all' ? null : category,
        query,
        cursor: more ? this.cursor : null,
        limit: this.pageSize,
        signal: controller.signal,
      })
      if (generation !== this.generation || this.disposed) return
      this.cursor = page.nextCursor
      const fresh = page.items.map(libraryItemOf)
      const merged = more ? [...this.state.items, ...fresh.filter((item) => !this.state.items.some((known) => known.id === item.id))] : fresh
      this.set({ ...this.state, status: 'ready', items: merged, hasMore: page.nextCursor !== null, searching: false, loadingMore: false })
    } catch (error) {
      if (generation !== this.generation || this.disposed || (error instanceof DOMException && error.name === 'AbortError')) return
      this.set({ ...this.state, status: this.state.items.length > 0 && more ? 'ready' : 'error', searching: false, loadingMore: false })
    }
  }

  private set(next: LibraryState): void {
    if (this.disposed) return
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

export function createSparkMediaLibrary(options: MediaLibraryOptions): SparkMediaLibrary {
  return new SparkMediaLibrary(options)
}

import { isAuthClientError } from '@/lib/auth/errors'

import {
  stockGatewayTransport,
  type StockAcquisition,
  type StockCard,
  type StockCategory,
  type StockKind,
  type StockTransport,
} from './stock-api'

export type StockKindFilter = 'all' | StockKind

export type StockNoticeKind =
  | 'added'
  | 'insufficientCredits'
  | 'storageFull'
  | 'unavailable'
  | 'changed'
  | 'stillProcessing'
  | 'failed'
  // P06-40 "Stock'ta Oluştur" notices share the drawer's toast.
  | 'created'
  | 'priceChanged'
  | 'createFailed'
  | 'createProcessing'

export type StockNotice = { id: number; kind: StockNoticeKind; values?: Record<string, number> }

export type StockPanelState = {
  /** `unavailable`: the platform catalogue is closed (the Stock tab stays hidden, F26); never sample cards. */
  status: 'loading' | 'ready' | 'error' | 'unavailable'
  categories: StockCategory[]
  kind: StockKindFilter
  category: string | null
  query: string
  items: StockCard[]
  nextCursor: string | null
  /** A newer page or filter is loading (the current cards stay visible). */
  searching: boolean
  loadingMore: boolean
  /** Per item: the add is acquiring (copy/charge/attach) or placing the clip. */
  adding: Record<string, 'acquiring' | 'placing'>
  notice: StockNotice | null
}

/** What happens with an acquired, project-bound source (the explicit clip insert; returns the new scene number). */
export type StockPlaceSource = (input: { sourceId: string; card: StockCard }) => Promise<number | null>

export type StockPanelOptions = {
  projectId: string
  transport?: StockTransport
  createId?: () => string
  /** Injected for tests; the real wait is a timer. */
  wait?: (ms: number) => Promise<void>
  /** Wall clock for preview expiry (injected in tests). */
  now?: () => number
  pageSize?: number
}

const INITIAL: StockPanelState = {
  status: 'loading',
  categories: [],
  kind: 'all',
  category: null,
  query: '',
  items: [],
  nextCursor: null,
  searching: false,
  loadingMore: false,
  adding: {},
  notice: null,
}

/** Polling of one acquisition: quick at first, then every few seconds, bounded (the server job continues anyway). */
const POLL_DELAYS_MS = [700, 1000, 1500, 2000, 3000]
const POLL_BUDGET_MS = 3 * 60_000
const PREVIEW_CACHE_MAX = 200
const PREVIEW_RETRY_COOLDOWN_MS = 60_000
/** A signed preview is re-minted a little before it expires. */
const PREVIEW_EXPIRY_SKEW_MS = 30_000

const REASON_NOTICE: Record<string, StockNoticeKind> = {
  insufficient_credits: 'insufficientCredits',
  storage_quota_exceeded: 'storageFull',
  item_unavailable: 'unavailable',
  revision_changed: 'changed',
}

/**
 * P06-16 Spark Stock panel state (framework-free; React subscribes with useSyncExternalStore). The platform catalogue
 * is read from the server only — no fixed sample array, no browser storage — with category/kind/text filters and a
 * keyset "load more". Grid previews are minted per visible card, cached until shortly before they expire, and a failed
 * mint cools down (placeholder, never the large original). "Add" starts one durable acquisition per click (intent
 * key), follows it to `ready`, then asks the editor to insert the clip (a separate Composition command).
 */
export class SparkStockPanel {
  private state: StockPanelState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly transport: StockTransport
  private readonly createId: () => string
  private readonly wait: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly pageSize: number
  private searchGeneration = 0
  private searchAbort: AbortController | null = null
  private noticeId = 0
  private disposed = false
  private readonly previews = new Map<string, { url: string; expiresAt: number } | { failedUntil: number } | Promise<string | null>>()

  constructor(private readonly options: StockPanelOptions) {
    this.transport = options.transport ?? stockGatewayTransport
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = options.now ?? (() => Date.now())
    this.pageSize = options.pageSize ?? 24
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): StockPanelState => this.state

  dispose(): void {
    this.disposed = true
    this.searchAbort?.abort()
    this.listeners.clear()
  }

  /** Status (gate + taxonomy) then the first page. */
  async load(): Promise<void> {
    this.set({ ...this.state, status: 'loading' })
    try {
      const status = await this.transport.status()
      if (status.source_status !== 'available') {
        this.set({ ...this.state, status: 'unavailable', categories: [], items: [] })
        return
      }
      // Only categories of the drawer's pixel kinds become chips (P06-40 audio categories stay out).
      this.set({ ...this.state, categories: status.categories.filter((category) => category.kinds.length > 0) })
      await this.search()
    } catch {
      this.set({ ...this.state, status: 'error' })
    }
  }

  setKind(kind: StockKindFilter): void {
    if (this.state.kind === kind) return
    const category = this.state.category && !this.categoryAllows(this.state.category, kind) ? null : this.state.category
    this.set({ ...this.state, kind, category })
    void this.search()
  }

  setCategory(category: string | null): void {
    if (this.state.category === category) return
    this.set({ ...this.state, category })
    void this.search()
  }

  /** The caller debounces typing; an older search result never overwrites a newer one. */
  setQuery(query: string): void {
    if (this.state.query === query) return
    this.set({ ...this.state, query })
    void this.search()
  }

  async retry(): Promise<void> {
    if (this.state.categories.length === 0) return this.load()
    return this.search()
  }

  async loadMore(): Promise<void> {
    const cursor = this.state.nextCursor
    if (!cursor || this.state.loadingMore || this.state.status !== 'ready') return
    const generation = this.searchGeneration
    this.set({ ...this.state, loadingMore: true })
    try {
      const page = await this.transport.search({ ...this.filter(), cursor, limit: this.pageSize })
      if (generation !== this.searchGeneration) return
      const seen = new Set(this.state.items.map((item) => item.item_id))
      this.set({
        ...this.state,
        items: [...this.state.items, ...page.items.filter((item) => !seen.has(item.item_id))],
        nextCursor: page.nextCursor,
        loadingMore: false,
      })
    } catch {
      if (generation === this.searchGeneration) this.set({ ...this.state, loadingMore: false })
    }
  }

  /**
   * The grid preview URL of a visible card (short-lived, minted by the server under current rights). Null = show the
   * placeholder: the item changed, or the preview is not deliverable (retried after a cooldown).
   */
  previewUrl(card: StockCard): Promise<string | null> {
    const key = `${card.item_id}:${card.revision}`
    const cached = this.previews.get(key)
    if (cached instanceof Promise) return cached
    if (cached && 'url' in cached && cached.expiresAt - PREVIEW_EXPIRY_SKEW_MS > this.now()) return Promise.resolve(cached.url)
    if (cached && 'failedUntil' in cached && cached.failedUntil > this.now()) return Promise.resolve(null)
    const pending = this.transport.preview(card.item_id, card.revision).then(
      (preview) => {
        const expiresAt = Date.parse(preview.expires_at)
        this.remember(key, { url: preview.url, expiresAt: Number.isFinite(expiresAt) ? expiresAt : this.now() })
        return preview.url
      },
      () => {
        this.remember(key, { failedUntil: this.now() + PREVIEW_RETRY_COOLDOWN_MS })
        return null
      },
    )
    this.previews.set(key, pending)
    return pending
  }

  /** "Add to scene": one durable acquisition (fresh intent per click), followed to `ready`, then the clip insert. */
  async add(card: StockCard, place: StockPlaceSource): Promise<void> {
    if (this.state.adding[card.item_id] || !card.allowed_actions.includes('acquire')) return
    this.setAdding(card.item_id, 'acquiring')
    try {
      let acquisition = await this.transport.startAcquisition({
        itemId: card.item_id,
        revision: card.revision,
        projectId: this.options.projectId,
        intentKey: `stock:${this.createId()}`,
      })
      const started = this.now()
      let attempt = 0
      while (acquisition.state !== 'ready' && acquisition.state !== 'failed') {
        if (this.disposed) return
        if (this.now() - started > POLL_BUDGET_MS) {
          // The server keeps going; the source is bound to the project when it is ready.
          this.notify('stillProcessing')
          return
        }
        await this.wait(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]!)
        attempt += 1
        acquisition = await this.transport.getAcquisition(acquisition.acquisition_id)
      }
      if (acquisition.state === 'failed') {
        this.notifyFailure(acquisition)
        return
      }
      if (!acquisition.source_id) {
        this.notify('failed')
        return
      }
      this.setAdding(card.item_id, 'placing')
      const sceneNumber = await place({ sourceId: acquisition.source_id, card })
      if (sceneNumber !== null) this.notify('added', { n: sceneNumber })
    } catch (error) {
      if (isAuthClientError(error) && error.code === 'MEDIA_CATALOG_STOCK_REVISION_CHANGED') {
        this.notify('changed')
        void this.search()
      } else if (isAuthClientError(error) && (error.code === 'MEDIA_CATALOG_STOCK_ITEM_NOT_FOUND' || error.code === 'MEDIA_CATALOG_STOCK_UNAVAILABLE')) {
        this.notify('unavailable')
        void this.search()
      } else {
        this.notify('failed')
      }
    } finally {
      this.setAdding(card.item_id, null)
    }
  }

  /** P06-40: another drawer action (Stock'ta Oluştur) shows its result in the same toast. */
  announce(kind: StockNoticeKind, values?: Record<string, number>): void {
    this.notify(kind, values)
  }

  private notifyFailure(acquisition: StockAcquisition): void {
    const kind = (acquisition.reason_code && REASON_NOTICE[acquisition.reason_code]) || 'failed'
    this.notify(kind)
    if (kind === 'unavailable' || kind === 'changed') void this.search()
  }

  private async search(): Promise<void> {
    const generation = ++this.searchGeneration
    this.searchAbort?.abort()
    const abort = new AbortController()
    this.searchAbort = abort
    this.set({ ...this.state, searching: true })
    try {
      const page = await this.transport.search({ ...this.filter(), limit: this.pageSize }, { signal: abort.signal })
      if (generation !== this.searchGeneration) return
      if (page.sourceStatus !== 'available') {
        this.set({ ...this.state, status: 'unavailable', items: [], nextCursor: null, searching: false })
        return
      }
      this.set({ ...this.state, status: 'ready', items: page.items, nextCursor: page.nextCursor, searching: false })
    } catch {
      if (generation !== this.searchGeneration) return
      this.set({ ...this.state, status: 'error', searching: false })
    }
  }

  private filter(): { kind?: StockKind; category?: string; q?: string } {
    return {
      ...(this.state.kind !== 'all' && { kind: this.state.kind }),
      ...(this.state.category && { category: this.state.category }),
      ...(this.state.query.trim() && { q: this.state.query.trim() }),
    }
  }

  private categoryAllows(categoryId: string, kind: StockKindFilter): boolean {
    if (kind === 'all') return true
    return this.state.categories.some((category) => category.id === categoryId && category.kinds.includes(kind))
  }

  private remember(key: string, value: { url: string; expiresAt: number } | { failedUntil: number }): void {
    this.previews.delete(key)
    this.previews.set(key, value)
    while (this.previews.size > PREVIEW_CACHE_MAX) {
      const oldest = this.previews.keys().next()
      if (oldest.done) break
      this.previews.delete(oldest.value)
    }
  }

  private setAdding(itemId: string, value: 'acquiring' | 'placing' | null): void {
    const adding = { ...this.state.adding }
    if (value) adding[itemId] = value
    else delete adding[itemId]
    this.set({ ...this.state, adding })
  }

  private notify(kind: StockNoticeKind, values?: Record<string, number>): void {
    this.noticeId += 1
    this.set({ ...this.state, notice: { id: this.noticeId, kind, ...(values && { values }) } })
  }

  private set(next: StockPanelState): void {
    if (this.disposed) return
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

export function createSparkStockPanel(options: StockPanelOptions): SparkStockPanel {
  return new SparkStockPanel(options)
}

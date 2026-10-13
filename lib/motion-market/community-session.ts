import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'
import { motionRevisionSchema, type MotionRevision } from '@/lib/motion-editor/api'

import {
  getMotionEarnings,
  listMotionLibrary,
  listMotionListings,
  listMotionSellerSales,
  listMyMotionListings,
  motionMarketNotice,
  type MotionEarnings,
  type MotionLibraryItem,
  type MotionListing,
  type MotionSellerSale,
} from './motion-market'

const publishedEnvelope = z.object({ data: z.array(motionRevisionSchema), meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }) })

/**
 * The actor's own saved Motions (the newest revision of each, `GET /api/v1/brand/motion-revisions`, behind
 * `BRAND_MOTION_AUTHORING_ENABLED`): what a seller can put on sale. Owner-scoped on the server.
 */
export async function listMyPublishedMotions(options: { signal?: AbortSignal } = {}): Promise<MotionRevision[]> {
  const response = await gatewayRequest('/api/v1/brand/motion-revisions?limit=50', { schema: publishedEnvelope, signal: options.signal })
  return response.data
}

export type MotionCommunityStatus = 'loading' | 'ready' | 'unavailable' | 'error'

export type MotionCommunityState = {
  status: MotionCommunityStatus
  /** The Community cards (active listings, newest first). */
  query: string
  listings: readonly MotionListing[]
  nextCursor: string | null
  /** A search or a first page is being read. */
  searching: boolean
  loadingMore: boolean
  browseFailed: boolean
  /** The actor's saved Motions; `unavailable` = Motion authoring is closed (nothing to sell). */
  published: readonly MotionRevision[]
  publishedStatus: 'ok' | 'unavailable' | 'error'
  /** The actor's own listings (active and delisted), keyed by Motion id for the Sell tab. */
  myListings: readonly MotionListing[]
  /** The Motions this workspace bought. */
  library: readonly MotionLibraryItem[]
  earnings: MotionEarnings | null
  sales: readonly MotionSellerSale[]
}

export type MotionCommunityApi = {
  listListings: typeof listMotionListings
  listMine: typeof listMyMotionListings
  listLibrary: typeof listMotionLibrary
  listPublished: typeof listMyPublishedMotions
  getEarnings: typeof getMotionEarnings
  listSales: typeof listMotionSellerSales
}

const DEFAULT_API: MotionCommunityApi = {
  listListings: listMotionListings,
  listMine: listMyMotionListings,
  listLibrary: listMotionLibrary,
  listPublished: listMyPublishedMotions,
  getEarnings: getMotionEarnings,
  listSales: listMotionSellerSales,
}

const INITIAL: MotionCommunityState = {
  status: 'loading',
  query: '',
  listings: [],
  nextCursor: null,
  searching: false,
  loadingMore: false,
  browseFailed: false,
  published: [],
  publishedStatus: 'ok',
  myListings: [],
  library: [],
  earnings: null,
  sales: [],
}

const PAGE_SIZE = 24

/**
 * State of the Community Motions screen: the Community cards (search, "show more"), what the actor can sell (their saved Motions with their
 * own listings), what this workspace bought, and the seller's sales and earnings. The server is the only source of truth; nothing is cached
 * in browser storage. A closed marketplace (404) is its own state, never an empty list pretending to be a catalogue; the pieces fail
 * separately (a closed Motion authoring gate leaves browsing and buying usable).
 */
export class MotionCommunitySession {
  private state: MotionCommunityState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly api: MotionCommunityApi
  private controller: AbortController | null = null
  private generation = 0

  constructor(options: { api?: Partial<MotionCommunityApi> } = {}) {
    this.api = { ...DEFAULT_API, ...options.api }
    this.load = this.load.bind(this)
    this.search = this.search.bind(this)
    this.loadMore = this.loadMore.bind(this)
    this.refreshMine = this.refreshMine.bind(this)
    this.refreshBrowse = this.refreshBrowse.bind(this)
    this.refreshLibrary = this.refreshLibrary.bind(this)
    this.dispose = this.dispose.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** The first read of everything; run again on retry. */
  async load(): Promise<void> {
    this.dispose()
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    this.set({ ...INITIAL, searching: true })
    const options = { signal: controller.signal }
    const [listings, mine, library, published, earnings, sales] = await Promise.allSettled([
      this.api.listListings({ limit: PAGE_SIZE }, options),
      this.api.listMine(options),
      this.api.listLibrary(options),
      this.api.listPublished(options),
      this.api.getEarnings(options),
      this.api.listSales({ limit: 5 }, options),
    ])
    if (generation !== this.generation || controller.signal.aborted) return
    this.controller = null
    // A closed marketplace answers 404 on every piece: one explicit state, nothing pretends to be empty.
    const closed = [listings, mine, library, earnings, sales].some((result) => result.status === 'rejected' && motionMarketNotice(result.reason)?.kind === 'unavailable')
    if (closed) {
      this.set({ ...INITIAL, status: 'unavailable' })
      return
    }
    if (listings.status === 'rejected') {
      this.set({ ...INITIAL, status: 'error' })
      return
    }
    this.set({
      status: 'ready',
      query: '',
      listings: listings.value.listings,
      nextCursor: listings.value.nextCursor,
      searching: false,
      loadingMore: false,
      browseFailed: false,
      published: published.status === 'fulfilled' ? published.value : [],
      publishedStatus: published.status === 'fulfilled' ? 'ok' : publishedUnavailable(published.reason) ? 'unavailable' : 'error',
      myListings: mine.status === 'fulfilled' ? mine.value : [],
      library: library.status === 'fulfilled' ? library.value : [],
      earnings: earnings.status === 'fulfilled' ? earnings.value : null,
      sales: sales.status === 'fulfilled' ? sales.value.sales : [],
    })
  }

  /** A new search over the Community cards (an empty query is the full list). */
  async search(query: string): Promise<void> {
    if (this.state.status !== 'ready') return
    const generation = ++this.generation
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    this.set({ ...this.state, query, searching: true, browseFailed: false })
    try {
      const page = await this.api.listListings({ limit: PAGE_SIZE, query }, { signal: controller.signal })
      if (generation !== this.generation) return
      this.set({ ...this.state, listings: page.listings, nextCursor: page.nextCursor, searching: false })
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return
      if (motionMarketNotice(error)?.kind === 'unavailable') {
        this.set({ ...INITIAL, status: 'unavailable' })
        return
      }
      this.set({ ...this.state, searching: false, browseFailed: true })
    }
  }

  async loadMore(): Promise<void> {
    const current = this.state
    if (current.status !== 'ready' || current.nextCursor === null || current.loadingMore) return
    const generation = this.generation
    this.set({ ...current, loadingMore: true, browseFailed: false })
    try {
      const page = await this.api.listListings({ limit: PAGE_SIZE, cursor: current.nextCursor, query: current.query })
      if (generation !== this.generation) return
      const known = new Set(this.state.listings.map((listing) => listing.listing_id))
      this.set({ ...this.state, listings: [...this.state.listings, ...page.listings.filter((listing) => !known.has(listing.listing_id))], nextCursor: page.nextCursor, loadingMore: false })
    } catch {
      if (generation !== this.generation) return
      this.set({ ...this.state, loadingMore: false, browseFailed: true })
    }
  }

  /** The cards again (after a purchase: the card now says "In your library"). */
  async refreshBrowse(): Promise<void> {
    if (this.state.status !== 'ready') return
    try {
      const page = await this.api.listListings({ limit: PAGE_SIZE, query: this.state.query })
      this.set({ ...this.state, listings: page.listings, nextCursor: page.nextCursor, browseFailed: false })
    } catch {
      this.set({ ...this.state, browseFailed: true })
    }
  }

  /** The seller's listings, sales and earnings again (after a listing change). */
  async refreshMine(): Promise<void> {
    if (this.state.status !== 'ready') return
    const [mine, earnings, sales] = await Promise.allSettled([this.api.listMine(), this.api.getEarnings(), this.api.listSales({ limit: 5 })])
    this.set({
      ...this.state,
      myListings: mine.status === 'fulfilled' ? mine.value : this.state.myListings,
      earnings: earnings.status === 'fulfilled' ? earnings.value : this.state.earnings,
      sales: sales.status === 'fulfilled' ? sales.value.sales : this.state.sales,
    })
    await this.refreshBrowse()
  }

  /** The workspace library again (after a purchase). */
  async refreshLibrary(): Promise<void> {
    if (this.state.status !== 'ready') return
    try {
      this.set({ ...this.state, library: await this.api.listLibrary() })
    } catch {
      // The cards stay as they are; the next load reads it again.
    }
    await this.refreshBrowse()
  }

  dispose(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
  }

  private set(next: MotionCommunityState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

function publishedUnavailable(error: unknown): boolean {
  // Motion authoring answers 403 while its gate is closed.
  return isAuthClientError(error) && (error.status === 403 || error.status === 404)
}

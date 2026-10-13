/**
 * P05-11 paged metadata residency: which pages of a long list (project sources, the media library, a 200 scene
 * list) the client holds, fetches and drops, instead of loading everything and mounting everything.
 *
 * Pure bookkeeping: the caller performs the requests the plan names and reports the answers. Bounds that hold at
 * every step: at most `maxResidentPages` pages are loaded or loading, at most `maxInFlightPages` requests run, and
 * a jump of the scroll position asks for the pages near the new position only, never for the pages in between.
 * An answer that belongs to an older epoch (the list was invalidated, the page was dropped and asked again) is
 * ignored, so a late response cannot put stale metadata back. A failed page is not asked again before a cooldown.
 */

export interface PageWindowOptions {
  /** Items per page (the list request's limit). */
  readonly pageSize: number
  /** Pages loaded or loading at once. */
  readonly maxResidentPages: number
  /** Page requests running at once. */
  readonly maxInFlightPages: number
  /** Pages prepared ahead of the scroll direction. */
  readonly prefetchPages: number
  /** A failed page waits this long before it is asked again. */
  readonly failureCooldownMs: number
  readonly now: () => number
}

export interface PageFocus {
  /** First item index on screen (inclusive). */
  readonly first: number
  /** Last item index on screen (inclusive). */
  readonly last: number
}

export interface PageFetch {
  readonly page: number
  /** Report the answer with this token; an answer with another token is stale. */
  readonly token: number
}

export interface PagePlan {
  readonly fetch: readonly PageFetch[]
  /** Loaded pages dropped to stay inside the resident bound. */
  readonly evict: readonly number[]
  /** Requests still running for pages that left the wanted set: abort them. */
  readonly cancel: readonly number[]
}

type PageEntry = { state: 'loading' | 'loaded'; token: number }

export class MetadataPageWindow {
  private readonly pages = new Map<number, PageEntry>()
  private readonly cooldownUntil = new Map<number, number>()
  private totalCount: number | null = null
  private nextToken = 1
  private maxResident = 0
  private fetched = 0
  private evicted = 0
  private stale = 0

  constructor(private readonly options: PageWindowOptions) {
    if (options.pageSize < 1 || options.maxResidentPages < 1 || options.maxInFlightPages < 1) {
      throw new RangeError('page window bounds must be positive')
    }
  }

  /** The list length once it is known (a first page can report it); null while unknown. */
  setTotal(total: number | null): void {
    this.totalCount = total === null ? null : Math.max(0, Math.floor(total))
  }

  /** Decides what to fetch, evict and cancel for the visible range and the scroll direction (-1, 0, 1). */
  focus(range: PageFocus, direction: -1 | 0 | 1): PagePlan {
    const { pageSize, maxResidentPages, maxInFlightPages, prefetchPages } = this.options
    const lastPage = this.totalCount === null ? Number.POSITIVE_INFINITY : Math.max(0, Math.ceil(this.totalCount / pageSize) - 1)
    const clamp = (page: number) => Math.min(lastPage, Math.max(0, page))
    const firstVisible = clamp(Math.floor(Math.max(0, range.first) / pageSize))
    const lastVisible = clamp(Math.floor(Math.max(0, range.last) / pageSize))
    const center = (firstVisible + lastVisible) / 2

    const visible: number[] = []
    for (let page = firstVisible; page <= lastVisible; page += 1) visible.push(page)
    const extra: number[] = []
    const ahead = direction === 0 ? 1 : prefetchPages
    for (let step = 1; step <= ahead; step += 1) {
      const forward = direction >= 0 ? lastVisible + step : firstVisible - step
      if (forward >= 0 && forward <= lastPage) extra.push(forward)
    }
    // One page behind the scroll direction, so reversing does not start from nothing.
    const behind = direction >= 0 ? firstVisible - 1 : lastVisible + 1
    if (behind >= 0 && behind <= lastPage) extra.push(behind)

    const byDistance = (a: number, b: number) => Math.abs(a - center) - Math.abs(b - center) || a - b
    // Visible pages nearest the centre first, then the pages ahead of the scroll direction, then the one behind.
    const wanted = [...visible].sort(byDistance).concat(extra).slice(0, maxResidentPages)
    const wantedSet = new Set(wanted)

    const cancel: number[] = []
    for (const [page, entry] of this.pages) {
      if (entry.state === 'loading' && !wantedSet.has(page)) {
        this.pages.delete(page)
        cancel.push(page)
      }
    }
    cancel.sort((a, b) => a - b)

    let running = 0
    for (const entry of this.pages.values()) if (entry.state === 'loading') running += 1
    const now = this.options.now()
    const fetch: PageFetch[] = []
    for (const page of wanted) {
      if (this.pages.has(page) || running + fetch.length >= maxInFlightPages) continue
      if ((this.cooldownUntil.get(page) ?? 0) > now) continue
      fetch.push({ page, token: this.nextToken })
      this.nextToken += 1
    }

    const evict: number[] = []
    const overflow = this.pages.size + fetch.length - maxResidentPages
    if (overflow > 0) {
      const droppable = [...this.pages.keys()].filter((page) => !wantedSet.has(page)).sort((a, b) => byDistance(b, a))
      for (const page of droppable.slice(0, overflow)) {
        this.pages.delete(page)
        evict.push(page)
      }
      this.evicted += evict.length
    }
    for (const request of fetch) this.pages.set(request.page, { state: 'loading', token: request.token })
    this.fetched += fetch.length
    this.maxResident = Math.max(this.maxResident, this.pages.size)
    return { fetch, evict: evict.sort((a, b) => a - b), cancel }
  }

  /** An answer arrived; false when it is stale (dropped, invalidated or re-asked meanwhile) and was ignored. */
  complete(page: number, token: number): boolean {
    const entry = this.pages.get(page)
    if (!entry || entry.state !== 'loading' || entry.token !== token) {
      this.stale += 1
      return false
    }
    this.pages.set(page, { state: 'loaded', token })
    this.cooldownUntil.delete(page)
    return true
  }

  /** A request failed: the page waits out the cooldown before it is asked again. */
  fail(page: number, token: number): void {
    const entry = this.pages.get(page)
    if (!entry || entry.state !== 'loading' || entry.token !== token) return
    this.pages.delete(page)
    this.cooldownUntil.set(page, this.options.now() + this.options.failureCooldownMs)
  }

  /** The list changed (a new revision, a reopen with a fresh list): every page and every running answer is void. */
  invalidate(): void {
    this.pages.clear()
    this.cooldownUntil.clear()
  }

  isLoaded(page: number): boolean {
    return this.pages.get(page)?.state === 'loaded'
  }

  residentPages(): number[] {
    return [...this.pages.keys()].sort((a, b) => a - b)
  }

  stats() {
    return {
      resident: this.pages.size,
      maxResident: this.maxResident,
      fetched: this.fetched,
      evicted: this.evicted,
      staleAnswers: this.stale,
    }
  }
}

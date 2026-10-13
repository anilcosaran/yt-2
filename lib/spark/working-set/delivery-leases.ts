/**
 * P05-11 delivery leases: the client side of "active delivery instead of premount" for signed URLs (posters,
 * thumbnails, images) with expiry, revoke and backpressure handled in one place (K140/K141).
 *
 * The working-set plan states the COMPLETE set of deliveries it wants now (`want`). The ledger turns that into
 * bounded mint requests and keeps every URL fresh without ever handing out an expired one:
 *
 *  - Expiry: a URL is refreshed once it is within `refreshMarginMs` of expiring (the 5 minutes P02-14 uses) while it
 *    is still served; `urlFor` never returns a URL that is within `guardMs` of expiring, so an expired URL is never
 *    handed to an element. A failed refresh keeps the old URL until the guard, then serves nothing (a placeholder).
 *  - Revoke: a terminal error (not found, forbidden, quarantined, over the preview budget ...) or a second consumer
 *    failure for the same key blocks the key: it is never requested again by this ledger until `unblock`. A first
 *    consumer failure (401/403/404 with a URL we thought valid) earns exactly ONE remint (the P02-14 playback BFF rule:
 *    a 403 gets a single remint, then stops); a URL that works again (`onUseOk`) gives the key its one remint back.
 *  - Backpressure: the errors P02-14 defined (I/O cap, delivery backpressure) cool the key down for a minute; the
 *    not-ready errors retry every 15 s and slow to 5 minutes after 8 attempts. No hot retry loop.
 *  - Reopen: a released lease with a still-usable URL is retained for a while, so closing and reopening a project
 *    does not mint again for what is still valid; a released key that is blocked stays blocked (bounded).
 *  - Bytes: `beginTransfer` admits a download against the in-flight byte budget (partial downloads are part of the
 *    total media budget); a single object larger than the whole budget is refused, never queued forever.
 *
 * Pure bookkeeping with an injected clock; nothing is stored in the browser. The caller sends the requests and
 * reports the answers.
 */

/**
 * What the delivery is for: a poster frame, a canvas still, an animated image (a small GIF, whole), a video proxy
 * stream, an original streamed by Range (explicit detail), a streamed audio placement or a small audio buffer.
 */
export type LeaseIntent = 'poster' | 'still' | 'animated' | 'proxy_stream' | 'original_range' | 'audio_stream' | 'audio_buffer'

/** Why a delivery is minted (P02-14): `grid` bounds an original to the preview budget on the server. */
export type LeasePurpose = 'grid' | 'detail' | 'playback'

export type LeaseVariant = 'original' | 'derivative'

export interface LeaseWant {
  /** Stable and content addressed by the caller (object id with its revision and the intent). */
  readonly key: string
  readonly objectId: string
  readonly intent: LeaseIntent
  readonly purpose: LeasePurpose
  readonly variant: LeaseVariant
  /** Bytes of the object the URL points at (the original's size for an original). */
  readonly sizeBytes: number
  /** Bytes the first transfer moves (a Range window, a derivative, a whole small file). */
  readonly transferBytes: number
  /** Lower is sooner. */
  readonly priority: number
}

export type LeaseRequestReason = 'first' | 'refresh' | 'retry' | 'after_use_error'

export interface LeaseRequest {
  readonly key: string
  readonly objectId: string
  readonly intent: LeaseIntent
  readonly purpose: LeasePurpose
  readonly variant: LeaseVariant
  readonly sizeBytes: number
  readonly reason: LeaseRequestReason
}

export type LeaseState = 'absent' | 'wanted' | 'minting' | 'ready' | 'cooldown' | 'blocked'

export interface LeaseLedgerOptions {
  readonly now: () => number
  /** Keys per mint request (STORAGE_DELIVERY_URL_BATCH_SIZE). */
  readonly batchSize: number
  /** Keys being minted at once. */
  readonly maxMinting: number
  /** Refresh a URL this long before it expires (storageDeliveryRefreshDelay uses 5 minutes). */
  readonly refreshMarginMs: number
  /** A URL this close to expiring is not handed out any more. */
  readonly guardMs: number
  /** Cooldown after an admission error (STORAGE_DELIVERY_RATE_LIMIT_COOLDOWN_MS). */
  readonly cooldownMs: number
  /** Retry interval of the not-ready errors, and after `notReadyRetryCap` attempts. */
  readonly notReadyRetryMs: number
  readonly notReadyRetryCap: number
  readonly slowRetryMs: number
  /** A released lease with a usable URL is kept this long for a warm reopen. */
  readonly retainReleasedMs: number
  readonly maxRetained: number
  /** Blocked keys kept (oldest dropped first); a dropped block costs at most one new request. */
  readonly maxBlocked: number
  /** Bytes of partial downloads in flight at once. */
  readonly maxInFlightBytes: number
}

/** The defaults of P02-14 (visible delivery) for the numbers the ledger shares with it. */
export const LEASE_DEFAULTS: Omit<LeaseLedgerOptions, 'now' | 'maxInFlightBytes'> = {
  batchSize: 64,
  maxMinting: 128,
  refreshMarginMs: 5 * 60_000,
  guardMs: 10_000,
  cooldownMs: 60_000,
  notReadyRetryMs: 15_000,
  notReadyRetryCap: 8,
  slowRetryMs: 5 * 60_000,
  retainReleasedMs: 10 * 60_000,
  maxRetained: 256,
  maxBlocked: 256,
}

const RECOVERABLE_CODES = new Set(['STORAGE_DELIVERY_NOT_READY', 'STORAGE_THUMBNAIL_NOT_AVAILABLE'])
const COOLDOWN_CODES = new Set(['STORAGE_IO_LIMIT_EXCEEDED', 'STORAGE_DELIVERY_BACKPRESSURE'])
const DENIED_STATUSES = new Set([401, 403, 404, 410])

type Entry = {
  want: LeaseWant
  state: Exclude<LeaseState, 'absent'>
  released: boolean
  releasedAt: number
  url: string | null
  expiresAt: number
  attempts: number
  retryAt: number
  refreshing: boolean
  forceRemint: boolean
  useErrors: number
  blockedReason: string | null
  blockedAt: number
  transferring: boolean
}

export class DeliveryLeaseLedger {
  private readonly entries = new Map<string, Entry>()
  private inFlightBytes = 0
  private readonly counters = {
    mintRequests: 0,
    mintBatches: 0,
    refreshes: 0,
    retries: 0,
    remintsAfterUseError: 0,
    reused: 0,
    withheldExpiring: 0,
    blocked: 0,
    wantsWhileBlocked: 0,
    transferRefusals: 0,
    maxInFlightBytes: 0,
  }

  constructor(private readonly options: LeaseLedgerOptions) {}

  /** Declares the complete set of deliveries the working set wants now. */
  want(wants: readonly LeaseWant[]): void {
    const now = this.options.now()
    this.sweep(now) // a lease released longer ago than the retention window is not reused
    const wanted = new Map<string, LeaseWant>()
    for (const want of wants) if (!wanted.has(want.key) || want.priority < wanted.get(want.key)!.priority) wanted.set(want.key, want)

    for (const [key, entry] of this.entries) {
      if (wanted.has(key) || entry.released) continue
      entry.released = true
      entry.releasedAt = now
      if (entry.state === 'wanted' || entry.state === 'cooldown') this.entries.delete(key)
    }
    for (const [key, want] of wanted) {
      const entry = this.entries.get(key)
      if (!entry) {
        this.entries.set(key, this.create(want))
        continue
      }
      if (entry.state === 'blocked') {
        this.counters.wantsWhileBlocked += 1
        continue
      }
      if (entry.released && entry.state === 'ready' && this.usable(entry, now)) this.counters.reused += 1
      entry.released = false
      entry.want = want
    }
    this.sweep(now)
  }

  /** The mint requests to send now: at most one batch, priority order, never for a blocked or cooling key. */
  nextRequests(): LeaseRequest[] {
    const now = this.options.now()
    let minting = 0
    for (const entry of this.entries.values()) if (entry.state === 'minting' || entry.refreshing) minting += 1
    const room = Math.min(this.options.batchSize, this.options.maxMinting - minting)
    if (room <= 0) return []

    const due: Array<{ entry: Entry; reason: LeaseRequestReason }> = []
    for (const entry of this.entries.values()) {
      if (entry.released || entry.state === 'blocked' || entry.state === 'minting' || entry.refreshing) continue
      if (entry.state === 'wanted' && entry.retryAt <= now) due.push({ entry, reason: entry.attempts > 0 ? 'retry' : 'first' })
      else if (entry.state === 'cooldown' && entry.retryAt <= now) due.push({ entry, reason: 'retry' })
      else if (entry.state === 'ready' && entry.forceRemint) due.push({ entry, reason: 'after_use_error' })
      else if (entry.state === 'ready' && entry.expiresAt - now <= this.options.refreshMarginMs && entry.retryAt <= now) {
        due.push({ entry, reason: 'refresh' })
      }
    }
    due.sort((a, b) => a.entry.want.priority - b.entry.want.priority || (a.entry.want.key < b.entry.want.key ? -1 : 1))

    const requests: LeaseRequest[] = []
    for (const { entry, reason } of due.slice(0, room)) {
      if (reason === 'refresh') {
        entry.refreshing = true
        this.counters.refreshes += 1
      } else {
        entry.state = 'minting'
        entry.url = null
        if (reason === 'retry') this.counters.retries += 1
        if (reason === 'after_use_error') {
          entry.forceRemint = false
          this.counters.remintsAfterUseError += 1
        }
      }
      const { key, objectId, intent, purpose, variant, sizeBytes } = entry.want
      requests.push({ key, objectId, intent, purpose, variant, sizeBytes, reason })
    }
    if (requests.length > 0) {
      this.counters.mintRequests += requests.length
      this.counters.mintBatches += 1
    }
    return requests
  }

  /** A URL was minted. */
  onMinted(key: string, minted: { url: string; expiresAtMs: number }): void {
    const entry = this.entries.get(key)
    if (!entry || entry.state === 'blocked') return
    entry.url = minted.url
    entry.expiresAt = minted.expiresAtMs
    entry.state = 'ready'
    entry.refreshing = false
    entry.attempts = 0
    entry.retryAt = 0
  }

  /** A mint failed with a Storage error code. */
  onMintError(key: string, code: string): void {
    const entry = this.entries.get(key)
    if (!entry || entry.state === 'blocked') return
    const now = this.options.now()
    const wasRefresh = entry.refreshing
    entry.refreshing = false
    if (COOLDOWN_CODES.has(code)) {
      this.retryLater(entry, now + this.options.cooldownMs, wasRefresh, 'cooldown')
      return
    }
    if (RECOVERABLE_CODES.has(code)) {
      entry.attempts += 1
      const wait = entry.attempts >= this.options.notReadyRetryCap ? this.options.slowRetryMs : this.options.notReadyRetryMs
      this.retryLater(entry, now + wait, wasRefresh, 'wanted')
      return
    }
    this.block(entry, code, now)
  }

  /**
   * The URL for a key, or null when there is none worth handing out: not minted yet, blocked, or within the guard
   * of expiring (the refresh did not land in time). An expired URL is never returned.
   */
  urlFor(key: string): string | null {
    const entry = this.entries.get(key)
    if (!entry || entry.state !== 'ready' || !entry.url) return null
    const now = this.options.now()
    if (entry.expiresAt - now <= this.options.guardMs) {
      this.counters.withheldExpiring += 1
      return null
    }
    return entry.url
  }

  /**
   * A consumer (image, video element, the playback route) failed with `status` using the URL. 401/403/404/410 earn
   * exactly one remint; the second failure blocks the key. Any other status is not a revoke and changes nothing.
   * `failedUrl` names the URL that failed: a second report about the URL the remint already replaced (two elements
   * sharing one URL) is ignored instead of counting as a second failure.
   */
  onUseError(key: string, status: number, failedUrl?: string): 'remint' | 'blocked' | 'ignored' {
    const entry = this.entries.get(key)
    if (!entry) return 'ignored'
    if (entry.state === 'blocked') return 'blocked'
    if (!DENIED_STATUSES.has(status)) return 'ignored'
    if (failedUrl !== undefined && entry.url !== failedUrl) return 'ignored'
    entry.useErrors += 1
    if (entry.useErrors > 1) {
      this.block(entry, `use_denied_${status}`, this.options.now())
      return 'blocked'
    }
    entry.forceRemint = true
    entry.url = null
    entry.state = 'ready'
    entry.refreshing = false
    return 'remint'
  }

  /** The URL worked: the key gets its one remint back. */
  onUseOk(key: string): void {
    const entry = this.entries.get(key)
    if (entry && entry.state === 'ready') entry.useErrors = 0
  }

  /** Lets a blocked key be tried again (the user reopened access, the object has a new revision). */
  unblock(key: string): void {
    const entry = this.entries.get(key)
    if (!entry || entry.state !== 'blocked') return
    entry.state = 'wanted'
    entry.blockedReason = null
    entry.useErrors = 0
    entry.attempts = 0
    entry.retryAt = 0
  }

  /** Admits a transfer of a wanted key against the in-flight byte budget. */
  beginTransfer(key: string): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    if (entry.transferring) return true // already admitted
    const bytes = entry.want.transferBytes
    if (bytes > this.options.maxInFlightBytes || this.inFlightBytes + bytes > this.options.maxInFlightBytes) {
      this.counters.transferRefusals += 1
      return false
    }
    entry.transferring = true
    this.inFlightBytes += bytes
    this.counters.maxInFlightBytes = Math.max(this.counters.maxInFlightBytes, this.inFlightBytes)
    return true
  }

  endTransfer(key: string): void {
    const entry = this.entries.get(key)
    if (!entry || !entry.transferring) return
    entry.transferring = false
    this.inFlightBytes -= entry.want.transferBytes
  }

  /** The project was closed: every lease is released; usable ones are retained for a warm reopen. */
  releaseAll(): void {
    this.want([])
  }

  state(key: string): LeaseState {
    return this.entries.get(key)?.state ?? 'absent'
  }

  isBlocked(key: string): boolean {
    return this.entries.get(key)?.state === 'blocked'
  }

  snapshot() {
    const byState: Record<string, number> = {}
    let retained = 0
    for (const entry of this.entries.values()) {
      byState[entry.state] = (byState[entry.state] ?? 0) + 1
      if (entry.released) retained += 1
    }
    return { entries: this.entries.size, retained, byState, inFlightBytes: this.inFlightBytes, ...this.counters }
  }

  private create(want: LeaseWant): Entry {
    return {
      want,
      state: 'wanted',
      released: false,
      releasedAt: 0,
      url: null,
      expiresAt: 0,
      attempts: 0,
      retryAt: 0,
      refreshing: false,
      forceRemint: false,
      useErrors: 0,
      blockedReason: null,
      blockedAt: 0,
      transferring: false,
    }
  }

  private usable(entry: Entry, now: number): boolean {
    return entry.url !== null && entry.expiresAt - now > this.options.guardMs
  }

  private retryLater(entry: Entry, at: number, wasRefresh: boolean, state: 'cooldown' | 'wanted'): void {
    entry.retryAt = at
    if (wasRefresh && entry.url) {
      entry.state = 'ready' // the current URL keeps serving until the guard; the refresh waits for `retryAt`
      return
    }
    entry.state = state
    entry.url = null
  }

  private block(entry: Entry, reason: string, now: number): void {
    entry.state = 'blocked'
    entry.blockedReason = reason
    entry.blockedAt = now
    entry.url = null
    entry.refreshing = false
    entry.forceRemint = false
    this.counters.blocked += 1
  }

  private sweep(now: number): void {
    const released: Array<[string, Entry]> = []
    const blocked: Array<[string, Entry]> = []
    for (const [key, entry] of this.entries) {
      if (entry.state === 'blocked') {
        blocked.push([key, entry])
      } else if (entry.released) {
        const stale = now - entry.releasedAt > this.options.retainReleasedMs || !this.usable(entry, now)
        if (stale && !entry.transferring && entry.state !== 'minting') this.entries.delete(key)
        else released.push([key, entry])
      }
    }
    released.sort((a, b) => a[1].releasedAt - b[1].releasedAt)
    for (const [key] of released.slice(0, Math.max(0, released.length - this.options.maxRetained))) this.entries.delete(key)
    blocked.sort((a, b) => a[1].blockedAt - b[1].blockedAt)
    for (const [key] of blocked.slice(0, Math.max(0, blocked.length - this.options.maxBlocked))) this.entries.delete(key)
  }
}

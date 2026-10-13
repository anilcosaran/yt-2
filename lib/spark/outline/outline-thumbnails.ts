import { getCoalescedStorageDeliveryUrls } from '@/lib/storage/api'

/**
 * Timeline v2 P1-C: the Outline panel's clip pictures. A clip shows the delivery `thumbnail` variant of its main clip's
 * Storage object (a derivative, never the original or a live video). URLs are asked for only for the clips on screen,
 * in one coalesced batch per tick, kept in memory until a little before they expire and not asked for again for a while
 * after a failure (the card keeps its placeholder). Nothing is written to browser storage.
 */

export type OutlineThumbnailResult = { url: string; expiresInSeconds: number } | null
/** Resolves the thumbnail URLs of Storage objects (missing or null: none available). */
export type OutlineThumbnailResolver = (objectIds: readonly string[]) => Promise<ReadonlyMap<string, OutlineThumbnailResult>>

/** The real resolver: the Storage batch delivery path (`variant: thumbnail`) of the project's channel. */
export function storageThumbnailResolver(channelId: string): OutlineThumbnailResolver {
  return async (objectIds) => {
    const response = await getCoalescedStorageDeliveryUrls({
      channelId,
      items: objectIds.map((objectId) => ({ objectId, variant: 'thumbnail' as const, expiresInSeconds: 3600 })),
    })
    const results = new Map<string, OutlineThumbnailResult>()
    for (const item of response.items) {
      results.set(item.object_id, item.status === 'ok' ? { url: item.url, expiresInSeconds: item.expires_in_seconds } : null)
    }
    return results
  }
}

/** A URL is asked for again this long before it expires. */
const EXPIRY_SKEW_MS = 60_000
/** After a failure (no thumbnail yet, network) the object is not asked for again for this long. */
const RETRY_COOLDOWN_MS = 60_000

type Entry = { url: string; expiresAt: number } | { failedUntil: number }

export class OutlineThumbnails {
  private readonly entries = new Map<string, Entry>()
  private readonly inFlight = new Set<string>()
  private readonly queue = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private scheduled = false
  private version = 0

  constructor(
    private readonly resolve: OutlineThumbnailResolver,
    private readonly now: () => number = () => Date.now(),
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Changes whenever a URL arrived or failed (`useSyncExternalStore` snapshot). */
  getVersion = (): number => this.version

  /** The object's thumbnail URL, or null (none yet, none available, expired). */
  url(objectId: string): string | null {
    const entry = this.entries.get(objectId)
    return entry && 'url' in entry && entry.expiresAt > this.now() ? entry.url : null
  }

  /** Asks for the object's URL unless a fresh one is held, one is on its way, or it failed a moment ago. */
  request(objectId: string): void {
    if (this.inFlight.has(objectId)) return
    const entry = this.entries.get(objectId)
    const now = this.now()
    if (entry && 'url' in entry && entry.expiresAt - EXPIRY_SKEW_MS > now) return
    if (entry && 'failedUntil' in entry && entry.failedUntil > now) return
    this.inFlight.add(objectId)
    this.queue.add(objectId)
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => void this.flush())
  }

  private async flush(): Promise<void> {
    this.scheduled = false
    const objectIds = [...this.queue]
    this.queue.clear()
    let results: ReadonlyMap<string, OutlineThumbnailResult> | null = null
    try {
      results = await this.resolve(objectIds)
    } catch {
      results = null
    }
    const now = this.now()
    for (const objectId of objectIds) {
      this.inFlight.delete(objectId)
      const result = results?.get(objectId) ?? null
      this.entries.set(objectId, result ? { url: result.url, expiresAt: now + result.expiresInSeconds * 1000 } : { failedUntil: now + RETRY_COOLDOWN_MS })
    }
    this.version += 1
    for (const listener of [...this.listeners]) listener()
  }
}

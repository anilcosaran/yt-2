/**
 * P05-11 thumbnail and poster request queue with backpressure (K140/K240: fast scrolling over 200 scenes or a
 * large grid must not pile up requests for cards that already left the window).
 *
 * The caller states the COMPLETE set of thumbnails the window wants now, nearest first, every time the window
 * moves. The queue keeps that set bounded and current:
 *
 *  - a waiting request whose card left the window is dropped, never sent;
 *  - when more are wanted than `maxDepth`, the nearest ones stay and the farthest are dropped (they are asked again
 *    if the window comes back), so the queue depth never exceeds its bound however fast the window moves;
 *  - a running request nobody wants any more is reported so the driver can abort it;
 *  - a key that was served stays served until it leaves the wanted set, and a failed key waits a cooldown before it
 *    is asked again (no hot retry loop).
 *
 * Keys are content addressed by the caller (an object id with its revision, a scene id with its dependency hash),
 * so a poster that changed is a new key. Pure bookkeeping: the driver runs the requests and reports the outcome.
 */

export interface ThumbnailQueueOptions {
  /** Requests waiting at most (delivery.thumbnail_queue.depth). */
  readonly maxDepth: number
  /** Requests running at most. */
  readonly maxInFlight: number
  /** Requests handed out together (one batch resolve or one delivery mint). */
  readonly batchSize: number
  /** A failed key waits this long before it is asked again. */
  readonly failureCooldownMs: number
  readonly now: () => number
}

export interface ThumbnailWant {
  readonly key: string
  /** Lower is nearer to the viewport and is served first. */
  readonly priority: number
}

export interface ThumbnailWantUpdate {
  readonly enqueued: readonly string[]
  /** Waiting requests removed: they left the window, or nearer ones pushed them out of a full queue. */
  readonly dropped: readonly string[]
  /** Running requests that nothing wants any more: the driver aborts them and reports `aborted`. */
  readonly staleInFlight: readonly string[]
}

export type ThumbnailOutcome = 'done' | 'failed' | 'aborted'

type Waiting = { priority: number; enqueuedAt: number }

export class ThumbnailQueue {
  private readonly waiting = new Map<string, Waiting>()
  private readonly inFlight = new Set<string>()
  private readonly served = new Set<string>()
  private readonly cooldownUntil = new Map<string, number>()
  private readonly counters = { enqueued: 0, dropped: 0, done: 0, failed: 0, aborted: 0, maxDepth: 0 }

  constructor(private readonly options: ThumbnailQueueOptions) {
    if (options.maxDepth < 1 || options.maxInFlight < 1 || options.batchSize < 1) {
      throw new RangeError('thumbnail queue bounds must be positive')
    }
  }

  /** Replaces the wanted set; returns what changed. Call it every time the window moves. */
  setWanted(wants: readonly ThumbnailWant[]): ThumbnailWantUpdate {
    const now = this.options.now()
    const wanted = new Map<string, number>()
    for (const want of wants) {
      const known = wanted.get(want.key)
      if (known === undefined || want.priority < known) wanted.set(want.key, want.priority)
    }

    const dropped: string[] = []
    for (const key of [...this.waiting.keys()]) {
      if (!wanted.has(key)) {
        this.waiting.delete(key)
        dropped.push(key)
      }
    }
    const staleInFlight = [...this.inFlight].filter((key) => !wanted.has(key)).sort()
    for (const key of [...this.served]) if (!wanted.has(key)) this.served.delete(key)
    for (const key of [...this.cooldownUntil.keys()]) if (!wanted.has(key)) this.cooldownUntil.delete(key)

    const enqueued: string[] = []
    for (const [key, priority] of wanted) {
      const existing = this.waiting.get(key)
      if (existing) {
        existing.priority = priority
        continue
      }
      if (this.inFlight.has(key) || this.served.has(key)) continue
      if ((this.cooldownUntil.get(key) ?? 0) > now) continue
      this.waiting.set(key, { priority, enqueuedAt: now })
      enqueued.push(key)
    }

    if (this.waiting.size > this.options.maxDepth) {
      // Over the bound: the farthest requests go. One that was only just wanted never entered the queue; one that was
      // already waiting is reported as dropped. Either is asked again if the window comes back to it.
      const farthestFirst = [...this.waiting.entries()].sort((a, b) => compareWaiting(b, a))
      for (const [key] of farthestFirst.slice(0, this.waiting.size - this.options.maxDepth)) {
        this.waiting.delete(key)
        const at = enqueued.indexOf(key)
        if (at >= 0) enqueued.splice(at, 1)
        else dropped.push(key)
      }
    }
    this.counters.enqueued += enqueued.length
    this.counters.dropped += dropped.length
    this.counters.maxDepth = Math.max(this.counters.maxDepth, this.waiting.size)
    return { enqueued: enqueued.sort(), dropped: dropped.sort(), staleInFlight }
  }

  /** The next requests to run: nearest first, at most one batch and at most the free in-flight slots. */
  takeBatch(): string[] {
    const free = this.options.maxInFlight - this.inFlight.size
    if (free <= 0) return []
    const ordered = [...this.waiting.entries()].sort((a, b) => compareWaiting(a, b))
    const taken = ordered.slice(0, Math.min(this.options.batchSize, free)).map(([key]) => key)
    for (const key of taken) {
      this.waiting.delete(key)
      this.inFlight.add(key)
    }
    return taken
  }

  /** A running request ended. */
  complete(key: string, outcome: ThumbnailOutcome): void {
    if (!this.inFlight.delete(key)) return
    this.counters[outcome] += 1
    if (outcome === 'done') this.served.add(key)
    if (outcome === 'failed') this.cooldownUntil.set(key, this.options.now() + this.options.failureCooldownMs)
  }

  gauge(): { depth: number; inFlight: number; oldestWaitingAgeMs: number } {
    const now = this.options.now()
    let oldest = 0
    for (const entry of this.waiting.values()) oldest = Math.max(oldest, now - entry.enqueuedAt)
    return { depth: this.waiting.size, inFlight: this.inFlight.size, oldestWaitingAgeMs: oldest }
  }

  isServed(key: string): boolean {
    return this.served.has(key)
  }

  stats() {
    return { ...this.counters }
  }
}

function compareWaiting(a: [string, Waiting], b: [string, Waiting]): number {
  return a[1].priority - b[1].priority || a[1].enqueuedAt - b[1].enqueuedAt || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
}

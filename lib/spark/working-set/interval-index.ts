/**
 * P05-11 active interval index (KARAR-MINIMAL-SPARK: "timeline viewport time + track virtualization, active
 * interval index"). Finds the items whose half-open frame range overlaps a query range without visiting every item:
 * the items are sorted by start and a segment tree over them keeps the largest end of each range, so a long item
 * placed early (a narration under the whole project) does not force a scan of everything after it. A query costs
 * O(k log n) for k results.
 *
 * Framework-free, immutable after construction, deterministic order (start, then id).
 */

export interface IndexedInterval {
  readonly id: string
  readonly start: number
  /** Exclusive. An interval with end <= start is empty and never reported. */
  readonly end: number
}

function compareIntervals(a: IndexedInterval, b: IndexedInterval): number {
  if (a.start !== b.start) return a.start - b.start
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export class IntervalIndex<T extends IndexedInterval> {
  private readonly items: T[]
  private readonly leafCount: number
  private readonly maxEnd: Float64Array
  private visited = 0

  constructor(items: readonly T[]) {
    this.items = [...items].sort(compareIntervals)
    let leafCount = 1
    while (leafCount < this.items.length) leafCount *= 2
    this.leafCount = leafCount
    this.maxEnd = new Float64Array(2 * leafCount).fill(Number.NEGATIVE_INFINITY)
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index]!
      this.maxEnd[leafCount + index] = item.end > item.start ? item.end : Number.NEGATIVE_INFINITY
    }
    for (let node = leafCount - 1; node >= 1; node -= 1) {
      this.maxEnd[node] = Math.max(this.maxEnd[2 * node]!, this.maxEnd[2 * node + 1]!)
    }
  }

  get length(): number {
    return this.items.length
  }

  /** Leaves the last query looked at: a diagnostic that shows a query stays far below the item count. */
  get visitedByLastQuery(): number {
    return this.visited
  }

  /** Items overlapping [start, end), ascending by (start, id). */
  overlapping(start: number, end: number): T[] {
    this.visited = 0
    const found: T[] = []
    if (this.items.length === 0 || end <= start) return found
    const limit = this.firstStartAtOrAfter(end)
    this.collect(1, 0, this.leafCount, start, limit, found)
    return found
  }

  /** Items whose range contains `frame`. */
  activeAt(frame: number): T[] {
    return this.overlapping(frame, frame + 1)
  }

  private firstStartAtOrAfter(value: number): number {
    let low = 0
    let high = this.items.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (this.items[mid]!.start < value) low = mid + 1
      else high = mid
    }
    return low
  }

  private collect(node: number, low: number, high: number, start: number, limit: number, out: T[]): void {
    if (low >= limit || this.maxEnd[node]! <= start) return
    if (node >= this.leafCount) {
      this.visited += 1
      const item = this.items[low]
      if (item && item.end > item.start && item.end > start) out.push(item)
      return
    }
    const mid = (low + high) >> 1
    this.collect(2 * node, low, mid, start, limit, out)
    this.collect(2 * node + 1, mid, high, start, limit, out)
  }
}

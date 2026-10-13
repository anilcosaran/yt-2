/**
 * Concurrency cap of the `/motion` catalog's live previews. Every live card owns a real `motion-runtime` host (a DOM tree,
 * loaded fonts, a compile read), so only a few may exist at once: a card that is in view asks for a slot, the first `max`
 * askers (in the order they asked) hold one and draw live, the others keep their static first frame until a slot frees up
 * (a card scrolled out of view, a closed screen). In memory only; nothing here is stored.
 */

export const DEFAULT_LIVE_PLAYER_CAP = 6

export class LiveSlotPool {
  private queue: string[] = []
  private readonly listeners = new Set<() => void>()
  private version = 0

  constructor(readonly max: number = DEFAULT_LIVE_PLAYER_CAP) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Changes whenever the set of holders changes (a snapshot for `useSyncExternalStore`). */
  readonly getVersion = () => this.version

  /** The card wants to draw live; idempotent. */
  want(id: string): void {
    if (this.queue.includes(id)) return
    this.queue = [...this.queue, id]
    this.emit()
  }

  /** The card no longer needs a slot (out of view, unmounted, suspended); idempotent. */
  release(id: string): void {
    if (!this.queue.includes(id)) return
    this.queue = this.queue.filter((candidate) => candidate !== id)
    this.emit()
  }

  holds(id: string): boolean {
    const index = this.queue.indexOf(id)
    return index >= 0 && index < this.max
  }

  /** Ids that currently hold a slot. */
  holders(): string[] {
    return this.queue.slice(0, this.max)
  }

  private emit(): void {
    this.version += 1
    for (const listener of [...this.listeners]) listener()
  }
}

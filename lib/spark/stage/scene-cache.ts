/**
 * LRU of compiled scene bundles keyed by `sceneId + dependency hash` (D11): a scene is compiled once per change of what
 * it draws, re-used when the user seeks back, and the bound keeps long projects within the memory budget. Only the IR and
 * asset URLs are cached; mounted runtimes are owned by the pool (one live + one warmed).
 */
export class SceneBundleCache<T> {
  private readonly entries = new Map<string, T>()
  private readonly inFlight = new Map<string, Promise<T>>()

  constructor(private readonly capacity = 8) {}

  static key(sceneId: string, dependencyHash: string): string {
    return `${sceneId}\u0000${dependencyHash}`
  }

  get size(): number {
    return this.entries.size
  }

  peek(key: string): T | undefined {
    return this.entries.get(key)
  }

  /**
   * The cached bundle (most recently used now), or the one being loaded, or a new load. Failed loads are not cached.
   * `keyOf` names the key a loaded value is kept under (the hash actually loaded, Y1R-EDITOR-6); default `key`.
   */
  load(key: string, loader: () => Promise<T>, keyOf?: (value: T) => string): Promise<T> {
    const held = this.entries.get(key)
    if (held !== undefined) {
      this.entries.delete(key)
      this.entries.set(key, held)
      return Promise.resolve(held)
    }
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const task = loader().then(
      (value) => {
        this.inFlight.delete(key)
        this.entries.set(keyOf?.(value) ?? key, value)
        while (this.entries.size > this.capacity) {
          const oldest = this.entries.keys().next().value as string
          this.entries.delete(oldest)
        }
        return value
      },
      (error: unknown) => {
        this.inFlight.delete(key)
        throw error
      },
    )
    this.inFlight.set(key, task)
    return task
  }

  /** Puts `value` under `key` (most recently used), replacing what was there (E1-N: the server's IR replaces a local one). */
  replace(key: string, value: T): void {
    this.entries.delete(key)
    this.inFlight.delete(key)
    this.entries.set(key, value)
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string
      this.entries.delete(oldest)
    }
  }

  clear(): void {
    this.entries.clear()
    this.inFlight.clear()
  }
}

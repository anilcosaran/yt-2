import type { SparkCompositionState } from '@/lib/spark/composition-session'

import type { SparkToolContext } from './spark-tool-types'

/**
 * The shell's side of `SparkToolContext.latest / current / service`: it remembers the newest session state and context
 * after every render and keeps the per-editor tool services (an upload queue, a library cache) alive while the editor is
 * open. A class instance (not refs read during render), so a tool may call `ctx.current()` from any callback.
 */
export class SparkToolBridge {
  private composition: SparkCompositionState | null = null
  private context: SparkToolContext | null = null
  private readonly services = new Map<string, { dispose(): void }>()
  private mounted = false

  /** Called after every render with the state and context of that render. */
  update(composition: SparkCompositionState, context: SparkToolContext): void {
    this.composition = composition
    this.context = context
  }

  readonly latest = (): SparkCompositionState => this.composition as SparkCompositionState

  readonly current = (): SparkToolContext => this.context as SparkToolContext

  readonly service = <T extends { dispose(): void }>(key: string, create: () => T): T => {
    const existing = this.services.get(key)
    if (existing) return existing as T
    const created = create()
    this.services.set(key, created)
    return created
  }

  /**
   * The editor is on screen: returns the cleanup. React StrictMode runs the cleanup and the effect again at once, so the
   * services are disposed one tick later and only when the editor did not mount again meanwhile.
   */
  mount(): () => void {
    this.mounted = true
    return () => {
      this.mounted = false
      globalThis.setTimeout(() => {
        if (this.mounted) return
        for (const service of this.services.values()) service.dispose()
        this.services.clear()
      }, 0)
    }
  }
}

import { AuthClientError } from '@/lib/auth/errors'

import { createSparkFontLoader, facesForIr, type SparkFontLoader } from './font-loader'
import {
  SparkPreviewStaleError,
  type SparkPreviewFontFace,
  SparkPreviewSceneUnavailableError,
  SparkPreviewTransitionUnavailableError,
  sparkPreviewGatewayClient,
  type SparkPreviewClient,
  type SparkPreviewManifest,
  type SparkPreviewSceneIr,
  type SparkPreviewTransition,
} from './preview-client'

/**
 * Y1-07 W1: keeps the editor's preview manifest in step with the session's working copy and hands out one scene's
 * compiled Motion IR at a time. Framework-free (`useSyncExternalStore`). It is deliberately NOT a scene cache: the
 * stage keeps the scene LRU/prefetch (keyed by the scene's `dependency_hash`); this store only
 *
 * - reads the manifest (with If-None-Match, so an unchanged working copy costs a 304 and no server work),
 * - de-duplicates in-flight scene loads,
 * - re-reads the manifest when the server says a scene moved on (409 stale) and
 * - loads the pinned fonts a scene's text uses before the stage paints it.
 *
 * The manifest of the previous version stays available while a newer one is read (`refreshing`): the canvas keeps
 * drawing, never blanks between two edits.
 */

export type SparkPreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  manifest: SparkPreviewManifest | null
  /** Working copy version the current manifest describes. */
  manifestVersion: number | null
  /** A newer manifest is being read; the old one is still valid to draw. */
  refreshing: boolean
  error: { code: string } | null
}

const INITIAL: SparkPreviewState = { status: 'idle', manifest: null, manifestVersion: null, refreshing: false, error: null }

export type SparkPreviewStoreOptions = {
  projectId: string
  client?: SparkPreviewClient
  fonts?: SparkFontLoader
}

function errorCode(error: unknown): string {
  return error instanceof AuthClientError ? error.code : 'PREVIEW_READ_FAILED'
}

export class SparkPreviewStore {
  private state: SparkPreviewState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly client: SparkPreviewClient
  private readonly fonts: SparkFontLoader
  private readonly scenes = new Map<string, Promise<SparkPreviewSceneIr>>()
  private readonly transitions = new Map<string, Promise<SparkPreviewTransition>>()
  private inflight: { minVersion: number; promise: Promise<void> } | null = null
  private controller: AbortController | null = null
  private generation = 0

  constructor(private readonly options: SparkPreviewStoreOptions) {
    this.client = options.client ?? sparkPreviewGatewayClient
    this.fonts = options.fonts ?? createSparkFontLoader()
    this.subscribe = this.subscribe.bind(this)
    this.getSnapshot = this.getSnapshot.bind(this)
    this.sync = this.sync.bind(this)
    this.loadScene = this.loadScene.bind(this)
    this.loadTransition = this.loadTransition.bind(this)
    this.ensureFonts = this.ensureFonts.bind(this)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): SparkPreviewState {
    return this.state
  }

  /**
   * Makes the manifest describe `workingCopyVersion` or newer. Idempotent: a version the manifest already covers
   * resolves at once, a read already in flight for it is awaited. Failures are state, not exceptions: the old
   * manifest stays in place and `error` says why.
   */
  sync(workingCopyVersion: number): Promise<void> {
    if (this.state.manifestVersion !== null && this.state.manifestVersion >= workingCopyVersion) return Promise.resolve()
    if (this.inflight && this.inflight.minVersion >= workingCopyVersion) return this.inflight.promise
    return this.read(workingCopyVersion)
  }

  /** Loads (deduplicated) the IR of a scene at the manifest's current hash. */
  loadScene(sceneId: string, options: { signal?: AbortSignal } = {}): Promise<SparkPreviewSceneIr> {
    const entry = this.state.manifest?.scenes.find((scene) => scene.scene_id === sceneId)
    if (!entry) return Promise.reject(new SparkPreviewSceneUnavailableError(sceneId, 'scene_not_in_manifest', []))
    if (entry.status === 'unavailable') {
      return Promise.reject(new SparkPreviewSceneUnavailableError(sceneId, 'COMPOSITION_PREVIEW_SCENE_UNAVAILABLE', entry.warnings))
    }
    const key = `${sceneId}:${entry.dependency_hash}`
    let request = this.scenes.get(key)
    if (!request) {
      request = this.client
        .getScene(this.options.projectId, sceneId, entry.dependency_hash, { signal: options.signal })
        .catch((error: unknown) => {
          // The scene moved on after the manifest was read: the next manifest names the new hash.
          if (error instanceof SparkPreviewStaleError) void this.read((this.state.manifestVersion ?? 0) + 1, true)
          throw error
        })
        .finally(() => this.scenes.delete(key))
      this.scenes.set(key, request)
    }
    return request
  }

  /**
   * E1-L: loads (deduplicated) the transition segment into `sceneId` at the manifest's current hash. Rejects with
   * `SparkPreviewTransitionUnavailableError` where the manifest says the boundary plays as a cut (nothing is requested).
   */
  loadTransition(sceneId: string, options: { signal?: AbortSignal } = {}): Promise<SparkPreviewTransition> {
    const entry = this.state.manifest?.scenes.find((scene) => scene.scene_id === sceneId)?.transition_in
    if (!entry || entry.status !== 'ready' || !entry.dependency_hash || !this.client.getTransition) {
      return Promise.reject(new SparkPreviewTransitionUnavailableError(sceneId, entry?.reason ? [{ code: `transition_${entry.reason}`, message: '' }] : []))
    }
    const key = `transition:${sceneId}:${entry.dependency_hash}`
    let request = this.transitions.get(key)
    if (!request) {
      request = this.client
        .getTransition(this.options.projectId, sceneId, entry.dependency_hash, { signal: options.signal })
        .catch((error: unknown) => {
          if (error instanceof SparkPreviewStaleError) void this.read((this.state.manifestVersion ?? 0) + 1, true)
          throw error
        })
        .finally(() => this.transitions.delete(key))
      this.transitions.set(key, request)
    }
    return request
  }

  /** Resolves when every pinned face the scene's text nodes use is in `document.fonts`. */
  async ensureFonts(ir: Pick<SparkPreviewSceneIr, 'document'>): Promise<void> {
    const manifest = this.state.manifest
    if (!manifest) return
    await this.fonts.ensure(facesForIr(manifest, ir.document))
  }

  /** E1-N: loads these catalogue faces (the browser's local preview lays text out against them before any server IR). */
  async ensureFaces(faces: readonly SparkPreviewFontFace[]): Promise<void> {
    await this.fonts.ensure(faces)
  }

  /** E1-N: the verified bytes of a loaded face, or null. */
  fontBytes(sha256: string): Uint8Array | null {
    return this.fonts.bytes?.(sha256) ?? null
  }

  /** Drops in-flight reads and every late result. The store stays usable (React strict mode remounts the same instance). */
  dispose(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
    this.inflight = null
    this.scenes.clear()
    this.transitions.clear()
    if (this.state.refreshing) this.state = { ...this.state, refreshing: false }
  }

  private read(minVersion: number, force = false): Promise<void> {
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    const generation = ++this.generation
    this.set({
      ...this.state,
      status: this.state.manifest ? this.state.status : 'loading',
      refreshing: this.state.manifest !== null,
      error: null,
    })
    const promise = this.client
      .getManifest(this.options.projectId, { signal: controller.signal, revalidate: force ? null : this.state.manifest })
      .then(
        (manifest) => {
          if (generation !== this.generation) return
          this.set({ status: 'ready', manifest, manifestVersion: manifest.working_copy_version, refreshing: false, error: null })
        },
        (error: unknown) => {
          if (generation !== this.generation || controller.signal.aborted) return
          this.set({ ...this.state, status: this.state.manifest ? 'ready' : 'error', refreshing: false, error: { code: errorCode(error) } })
        },
      )
      .finally(() => {
        if (this.inflight?.promise === promise) this.inflight = null
      })
    this.inflight = { minVersion, promise }
    return promise
  }

  private set(next: SparkPreviewState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

export function createSparkPreviewStore(options: SparkPreviewStoreOptions): SparkPreviewStore {
  return new SparkPreviewStore(options)
}

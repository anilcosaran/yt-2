import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayConditionalRequest, gatewayRequest } from '@/lib/gateway/client'
import { getStorageDownloadUrl, getStoragePlaybackUrl } from '@/lib/storage/api'

import { SparkPreviewStaleError } from '../preview-client'

import {
  bundleFromSceneIr,
  bundleFromTransition,
  facesForIr,
  planFromManifest,
  previewManifestSchema,
  previewSceneIrSchema,
  previewTransitionSchema,
  type PreviewManifest,
  type PreviewSceneIr,
  type PreviewTransition,
} from './preview-contract'
import { createStageFontLoader, type StageFontLoader } from './stage-fonts'
import { StageSceneMismatchError, type StageMediaResolver, type StagePlan, type StagePreviewSource, type StageSceneBundle } from './stage-types'

/**
 * `StagePreviewSource` straight over the gateway preview routes (Y1-07 `editor-interfaces.md` section 1):
 * `GET /api/v1/composition/projects/{id}/preview` (manifest, cheap, ETag) and `.../preview/scenes/{sceneId}?dependency_hash=`
 * (the compiled IR of one scene). It holds the manifest of the newest synced version, revalidates it with
 * `If-None-Match`, de-duplicates concurrent loads and re-syncs once when a scene answers `COMPOSITION_PREVIEW_STALE`.
 * The editor itself uses `previewSourceFromStore` over Y1-07's `SparkPreviewStore` (same interface); this standalone source stays
 * for tests and for a host without that store.
 */

export const PREVIEW_STALE_CODE = 'COMPOSITION_PREVIEW_STALE'
const REPLICA_ATTEMPTS = 3
const REPLICA_DELAY_MS = 1000

const manifestResponseSchema = z.object({ data: previewManifestSchema })
const sceneResponseSchema = z.object({ data: previewSceneIrSchema })
const transitionResponseSchema = z.object({ data: previewTransitionSchema })

const projectPath = (projectId: string, suffix: string) => `/api/v1/composition/projects/${encodeURIComponent(projectId)}${suffix}`

/** Playback (Range BFF) for video and audio; the redirecting download route for images (the BFF caps a body at 2 MiB). */
export function createStorageMediaResolver(channelId: string): StageMediaResolver {
  return {
    // D12: the stage plays the ingest proxy (h264 720p) when there is one, so a HEVC .mov or a VFR WebM still plays in Chrome.
    playbackUrl: (objectId) => getStoragePlaybackUrl({ channelId, objectId, preferProxy: true }),
    imageUrl: (objectId) => getStorageDownloadUrl({ channelId, objectId, fileName: 'preview-asset' }),
  }
}

export type GatewayPreviewSourceOptions = {
  projectId: string
  media: StageMediaResolver
  fonts?: StageFontLoader
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
  /** Tests pass a fake transport; the editor uses the browser's fetch. */
  fetcher?: typeof fetch
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = globalThis.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      globalThis.clearTimeout(timer)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export function createGatewayPreviewSource(options: GatewayPreviewSourceOptions): StagePreviewSource {
  const fonts = options.fonts ?? createStageFontLoader()
  const delay = options.delay ?? wait
  let manifest: PreviewManifest | null = null
  let etag: string | null = null
  let plan: StagePlan | null = null
  const syncing = new Map<number, Promise<StagePlan>>()
  const scenes = new Map<string, Promise<StageSceneBundle>>()

  const readManifest = async (signal?: AbortSignal): Promise<PreviewManifest> => {
    const result = await gatewayConditionalRequest(projectPath(options.projectId, '/preview'), {
      schema: manifestResponseSchema,
      fetcher: options.fetcher,
      signal,
      ifNoneMatch: manifest ? etag : null,
    })
    if (result.notModified) {
      if (manifest) return manifest
      throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
    }
    manifest = result.data.data
    etag = result.etag
    plan = planFromManifest(manifest)
    return manifest
  }

  const sync = (workingCopyVersion: number, signal?: AbortSignal): Promise<StagePlan> => {
    if (plan && plan.workingCopyVersion === workingCopyVersion) return Promise.resolve(plan)
    const held = syncing.get(workingCopyVersion)
    if (held) return held
    const task = (async () => {
      // A read replica may not have the editor's own write yet: the manifest is older than the version asked for.
      for (let attempt = 1; ; attempt += 1) {
        const read = await readManifest(signal)
        if (read.working_copy_version >= workingCopyVersion || attempt >= REPLICA_ATTEMPTS) return planFromManifest(read)
        await delay(REPLICA_DELAY_MS, signal)
      }
    })().finally(() => syncing.delete(workingCopyVersion))
    syncing.set(workingCopyVersion, task)
    return task
  }

  const fetchScene = async (sceneId: string, hash: string, signal?: AbortSignal): Promise<StageSceneBundle> => {
    const path = projectPath(options.projectId, `/preview/scenes/${encodeURIComponent(sceneId)}?dependency_hash=${encodeURIComponent(hash)}`)
    const result = await gatewayRequest(path, { schema: sceneResponseSchema, signal, fetcher: options.fetcher })
    return bundleFromSceneIr(result.data, options.media.imageUrl)
  }

  return {
    sync,
    loadScene(sceneId, signal, dependencyHash) {
      const current = plan?.scenes.find((scene) => scene.sceneId === sceneId)
      if (!current) return Promise.reject(new AuthClientError('COMPOSITION_PREVIEW_SCENE_NOT_FOUND', 'The scene is not in the preview.', 404))
      const key = `${sceneId}:${current.dependencyHash}`
      const held = scenes.get(key)
      // WP1: a picture of another version than the one asked for is reported, never handed out as that version.
      const checked = (task: Promise<StageSceneBundle>) =>
        dependencyHash === undefined
          ? task
          : task.then((bundle) => {
              if (bundle.dependencyHash !== dependencyHash) throw new StageSceneMismatchError(sceneId, dependencyHash, bundle)
              return bundle
            })
      if (held) return checked(held)
      const task = (async () => {
        try {
          return await fetchScene(sceneId, current.dependencyHash, signal)
        } catch (error) {
          if (!(error instanceof AuthClientError) || error.code !== PREVIEW_STALE_CODE) throw error
          // The manifest moved under us: read it again and load the scene at its new hash, once.
          await readManifest(signal)
          const fresh = plan?.scenes.find((scene) => scene.sceneId === sceneId)
          if (!fresh) throw error
          return fetchScene(sceneId, fresh.dependencyHash, signal)
        }
      })()
      // Only in-flight loads are de-duplicated; finished bundles live in the stage's own LRU.
      scenes.set(key, task)
      const forget = () => void scenes.delete(key)
      task.then(forget, forget)
      return checked(task)
    },
    // E1-L: the transition segment into a scene at the plan's hash (`COMPOSITION_PREVIEW_TRANSITION_UNAVAILABLE` rejects: a cut).
    loadTransition(sceneId, signal) {
      const current = plan?.transitions?.find((transition) => transition.toSceneId === sceneId)
      if (!current || current.status !== 'ready' || !current.dependencyHash) {
        return Promise.reject(new AuthClientError('COMPOSITION_PREVIEW_TRANSITION_UNAVAILABLE', 'The transition cannot be previewed.', 409))
      }
      const key = `transition:${sceneId}:${current.dependencyHash}`
      const held = scenes.get(key)
      if (held) return held
      const path = projectPath(options.projectId, `/preview/transitions/${encodeURIComponent(sceneId)}?dependency_hash=${encodeURIComponent(current.dependencyHash)}`)
      const task = gatewayRequest(path, { schema: transitionResponseSchema, signal, fetcher: options.fetcher }).then((result) => bundleFromTransition(result.data, options.media.imageUrl))
      scenes.set(key, task)
      const forget = () => void scenes.delete(key)
      task.then(forget, forget)
      return task
    },
    async ensureFonts(bundle) {
      if (!manifest) return
      await fonts.ensure(facesForIr(manifest.fonts.faces, bundle.ir), undefined)
    },
    dispose() {
      syncing.clear()
      scenes.clear()
    },
  }
}

/** The part of Y1-07's `SparkPreviewStore` the stage uses (structural, so the adapter is testable with a fake store). */
export type SparkPreviewStoreLike = {
  sync(workingCopyVersion: number): Promise<void>
  getSnapshot(): { manifest: PreviewManifest | null }
  loadScene(sceneId: string, options?: { signal?: AbortSignal }): Promise<PreviewSceneIr>
  /** E1-L: the transition segment into a scene (optional: a store without it has no transitions). */
  loadTransition?(sceneId: string, options?: { signal?: AbortSignal }): Promise<PreviewTransition>
  ensureFonts(ir: Pick<PreviewSceneIr, 'document'>): Promise<void>
  dispose(): void
}

/**
 * Adapts Y1-07's `SparkPreviewStore` (manifest kept in step with the session, font gate, stale handling) to the
 * stage's interface. `useSparkStage` creates the stage's source with it. A scene that answers `COMPOSITION_PREVIEW_STALE`
 * is loaded again, once, after the store's manifest re-read (Y1-08 section 6, Y1R-EDITOR-6).
 */
export function previewSourceFromStore(store: SparkPreviewStoreLike, media: StageMediaResolver): StagePreviewSource {
  const wire = new WeakMap<StageSceneBundle, Pick<PreviewSceneIr, 'document'>>()
  const loadTransition = store.loadTransition?.bind(store)
  return {
    async sync(workingCopyVersion) {
      await store.sync(workingCopyVersion)
      const { manifest } = store.getSnapshot()
      if (!manifest) throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
      return planFromManifest(manifest)
    },
    async loadScene(sceneId, signal, dependencyHash) {
      const version = store.getSnapshot().manifest?.working_copy_version ?? 0
      let ir: PreviewSceneIr
      try {
        ir = await store.loadScene(sceneId, { signal })
      } catch (error) {
        if (!(error instanceof SparkPreviewStaleError)) throw error
        // The store started the manifest re-read when the scene answered stale: wait for it, then load the new hash.
        await store.sync(version + 1)
        ir = await store.loadScene(sceneId, { signal })
      }
      const bundle = bundleFromSceneIr(ir, media.imageUrl)
      wire.set(bundle, ir)
      // WP1: the store loads the scene of ITS manifest. When that is not the version the caller asked for (the server moved
      // on, e.g. after a 409 stale answer), say so with the picture there is: the caller decides, nothing is swapped silently.
      if (dependencyHash !== undefined && bundle.dependencyHash !== dependencyHash) throw new StageSceneMismatchError(sceneId, dependencyHash, bundle)
      return bundle
    },
    // E1-L: only where the store has transitions; without it every boundary is a cut.
    ...(loadTransition && {
      async loadTransition(sceneId: string, signal?: AbortSignal) {
        const ir = await loadTransition(sceneId, { signal })
        const bundle = bundleFromTransition(ir, media.imageUrl)
        wire.set(bundle, ir)
        return bundle
      },
    }),
    async ensureFonts(bundle) {
      const ir = wire.get(bundle)
      if (ir) await store.ensureFonts(ir)
    },
    dispose: () => store.dispose(),
  }
}

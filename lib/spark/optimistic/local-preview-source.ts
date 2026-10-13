import type { CompositionDocument } from '../composition-client'
import { loadImageSize } from '../image-size'
import { localImageSize, measureLocalImage } from '../media/local-media'
import { canonicalJson } from '../stage/motion-core/ir/canonical'
import type { TextMeasurer } from '../stage/motion-core/text'
import type { PreviewFontFace, PreviewManifest } from '../stage/preview-contract'
import { StageSceneMismatchError, type StageLocalPreview, type StageMediaResolver, type StagePlan, type StagePreviewSource, type StageSceneBundle } from '../stage/stage-types'
import { createLazyFontSetMeasurer } from './lazy-font-measurer'
import { compileLocalScene, planLocalPreview, type LocalImageAsset, type LocalPreviewPlan, type LocalScene } from './local-preview'

/**
 * E1-N: wraps the stage's preview source (the manifest and the compiled scenes of the SERVER) so it can also draw the
 * editor's own copy of the document, before the server has seen the edit:
 *
 * - `local.plan(document)` plans the copy in the browser (`planLocalPreview`: timing, scene hashes, statuses, native
 *   video layers) from the last manifest, and
 * - `loadScene(sceneId, signal, hash)` answers a hash the browser planned itself by compiling that scene locally
 *   (`compileLocalScene`: text laid out by the generated copy of the text engine over the pinned face bytes, shapes,
 *   images). A hash the server already knows (a scene the edit did not touch) comes from the server as before.
 *
 * Because the local scene hash is computed exactly like the server's, the server's manifest later names the SAME hash for
 * the same content: the stage already holds that scene (no fetch, no remount). Each locally compiled scene is then checked
 * against the server's own IR in the background (`verify`); a mismatch (a parity bug) corrects the picture with the
 * server's IR and says so. Anything the browser cannot draw (Motion, captions, animations) keeps the server's picture in
 * the plan and is answered by the server as before. WP1: a hash only the browser knows that cannot be compiled here after
 * all (a face or an image size that did not load) is reported (`StageSceneMismatchError` without a picture), never
 * answered with the server's older picture of that scene: the stage keeps what it shows until the server has the edit.
 */

/** The part of the preview store the local source uses (structural, so tests pass a fake). */
export type LocalPreviewStore = {
  getSnapshot(): { manifest: PreviewManifest | null }
  ensureFaces(faces: readonly PreviewFontFace[]): Promise<void>
  fontBytes(sha256: string): Uint8Array | null
}

/** Natural size of an image (EXIF orientation applied, like the gateway's probe), or null when it cannot be read. */
export type ImageProbe = (input: { storageObjectId: string; checksumSha256: string; url: string }) => Promise<{ width: number; height: number } | null>

/** The longest the local compile waits for an image's size; then the stage keeps its picture until the server's arrives. */
const IMAGE_PROBE_TIMEOUT_MS = 8000

/** The browser's decode of the image the stage is about to draw anyway (one download, shared with the picture), time-limited. */
export const probeImageInBrowser: ImageProbe = ({ url }) =>
  typeof Image === 'undefined' ? Promise.resolve(null) : loadImageSize(url, { timeoutMs: IMAGE_PROBE_TIMEOUT_MS })

export type LocalPreviewSourceOptions = {
  base: StagePreviewSource
  store: LocalPreviewStore
  media: StageMediaResolver
  probeImage?: ImageProbe
  /** The text measurer of a compile (default: the lazy measurer over the pinned face bytes the store holds). Test seam. */
  measurer?: (manifest: PreviewManifest) => TextMeasurer
  /** Reports a parity mismatch (default `console.warn`): the server's picture won. */
  onMismatch?: (info: { sceneId: string; dependencyHash: string }) => void
  /**
   * `SPARK_LIVE_FX_PREVIEW_ENABLED`: animated layers are compiled here too (`local-animations.ts`) and a document that stores
   * scene transitions is planned (the stage blends them itself). Off: both stay the server's, as before.
   */
  liveFx?: boolean
}

type SourceBody = { source_id: string; storage_object: { storage_object_id: string; checksum_sha256: string; media_kind?: string } }

const LOCAL_BUNDLES = 24

export function createLocalPreviewSource(options: LocalPreviewSourceOptions): StagePreviewSource {
  const { base, store, media } = options
  const probeImage = options.probeImage ?? probeImageInBrowser
  let serverPlan: StagePlan | null = null
  let planned: LocalPreviewPlan | null = null
  let plannedDocument: CompositionDocument | null = null
  /** Scenes drawn from the local compile, by `sceneId\0hash`. */
  const compiled = new Map<string, StageSceneBundle>()
  const wrong = new Set<string>()
  const corrections = new Set<(bundle: StageSceneBundle) => void>()
  const key = (sceneId: string, hash: string) => `${sceneId}\u0000${hash}`

  const serverHashOf = (sceneId: string): string | null => serverPlan?.scenes.find((scene) => scene.sceneId === sceneId)?.dependencyHash ?? null

  async function compileScene(scene: LocalScene): Promise<StageSceneBundle | null> {
    const manifest = store.getSnapshot().manifest
    const document = plannedDocument
    if (!manifest || !document || wrong.has(key(scene.sceneId, scene.hash))) return null
    const faces = manifest.fonts.faces
    // Fonts first: the text engine measures against the pinned face bytes (the first use of a face downloads it, once).
    const wanted = new Map<string, PreviewFontFace>()
    for (const layer of scene.compile) {
      if (layer.layer_kind !== 'text') continue
      const font = (layer['style'] as { font: { font_id: string; font_revision: string; sha256: string } }).font
      const face = faces.find((candidate) => candidate.font_id === font.font_id && candidate.font_revision === font.font_revision && candidate.sha256 === font.sha256)
      if (face) wanted.set(face.sha256, face)
    }
    try {
      if (wanted.size > 0) await store.ensureFaces([...wanted.values()])
    } catch {
      return null
    }
    // Images: the size is read from the pinned bytes the stage downloads anyway; known sizes are reused.
    const sources = new Map((document.source_media as unknown as SourceBody[]).map((source) => [source.source_id, source]))
    const images = new Map<string, LocalImageAsset>()
    for (const layer of scene.compile) {
      if (layer.layer_kind !== 'clip') continue
      const sourceId = (layer['placement'] as { source_id: string }).source_id
      const source = sources.get(sourceId)
      if (!source || images.has(sourceId)) continue
      const checksum = source.storage_object.checksum_sha256
      // WP5a: a file picked in this tab was measured by the browser already; its original is not downloaded to learn it.
      // Timeline v3: one size cache for the page (`measureLocalImage`): a size the media insert fit read is reused here,
      // and a read running for it is shared, never repeated.
      let size = localImageSize(checksum) ?? undefined
      if (!size) {
        const storageObjectId = source.storage_object.storage_object_id
        const probed = await measureLocalImage(checksum, () => probeImage({ storageObjectId, checksumSha256: checksum, url: media.imageUrl(storageObjectId) }))
        if (!probed) return null
        size = probed
      }
      images.set(sourceId, { key: checksum, width: size.width, height: size.height, storageObjectId: source.storage_object.storage_object_id })
    }
    // A plan or document that moved on while fonts and images were loading: the stage asks again for the newer hash.
    if (planned?.scenes.get(scene.sceneId)?.hash !== scene.hash) return null
    const result = compileLocalScene({
      document,
      scene,
      compilerVersion: manifest.scene_compiler_version,
      fonts: {
        faces,
        measurer: options.measurer?.(manifest) ?? createLazyFontSetMeasurer({ fontSetHash: manifest.fonts.font_set_hash, faces, bytesOf: (sha) => store.fontBytes(sha) }),
      },
      images,
      animations: options.liveFx === true,
    })
    if (!result.ok) return null
    const bundle: StageSceneBundle = {
      sceneId: scene.sceneId,
      startFrame: scene.startFrame,
      durationFrames: scene.durationFrames as number,
      dependencyHash: scene.hash,
      ir: result.ir,
      assets: Object.fromEntries(result.assets.map((asset) => [asset.key, media.imageUrl(asset.storageObjectId)])),
      nativeLayers: scene.natives,
      warnings: [],
    }
    compiled.set(key(scene.sceneId, scene.hash), bundle)
    while (compiled.size > LOCAL_BUNDLES) compiled.delete(compiled.keys().next().value as string)
    return bundle
  }

  const sameDrawing = (a: StageSceneBundle, b: StageSceneBundle): boolean =>
    canonicalJson(a.ir) === canonicalJson(b.ir) && canonicalJson(Object.keys(a.assets).sort()) === canonicalJson(Object.keys(b.assets).sort())

  const local: StageLocalPreview = {
    plan(document, workingCopyVersion) {
      const manifest = store.getSnapshot().manifest
      if (!manifest || !serverPlan) return null
      const result = planLocalPreview(document, {
        sceneCompilerVersion: manifest.scene_compiler_version,
        motionRuntimeVersion: manifest.motion_runtime_version,
        fontSetHash: manifest.fonts.font_set_hash,
        workingCopyVersion,
        serverPlan,
        liveFx: options.liveFx === true,
      })
      if (!result) return null
      planned = result
      plannedDocument = document
      return result.plan
    },
    verify(plan) {
      for (const scene of plan.scenes) {
        const k = key(scene.sceneId, scene.dependencyHash)
        const drawn = compiled.get(k)
        if (!drawn) continue
        compiled.delete(k)
        // The server compiled the very content the browser drew: its IR must be the same, node for node.
        void base
          .loadScene(scene.sceneId, undefined, scene.dependencyHash)
          .then((server) => {
            // The server answered for a newer hash (the scene was edited again meanwhile; a source reports it as a mismatch,
            // which ends up in the catch below): not the content that was drawn.
            if (server.dependencyHash !== scene.dependencyHash) return
            if (sameDrawing(drawn, server)) return
            wrong.add(k)
            if (options.onMismatch) options.onMismatch({ sceneId: scene.sceneId, dependencyHash: scene.dependencyHash })
            else console.warn(`[spark] local preview of ${scene.sceneId} differs from the server's; the server's picture is used`)
            for (const listener of [...corrections]) listener(server)
          })
          .catch(() => undefined)
      }
    },
    onCorrection(listener) {
      corrections.add(listener)
      return () => corrections.delete(listener)
    },
    async prepareText(font) {
      const manifest = store.getSnapshot().manifest
      const face = manifest?.fonts.faces.find((candidate) => candidate.font_id === font.font_id && candidate.font_revision === font.font_revision && candidate.sha256 === font.sha256)
      if (!face) return false
      try {
        await store.ensureFaces([face])
        return true
      } catch {
        // The face loads when a text first needs it; a failed warm-up changes nothing (the next call tries again).
        return false
      }
    },
  }

  return {
    async sync(workingCopyVersion, signal) {
      const plan = await base.sync(workingCopyVersion, signal)
      serverPlan = plan
      return plan
    },
    async loadScene(sceneId, signal, dependencyHash) {
      const scene = planned?.scenes.get(sceneId)
      // A hash whose local picture the server's IR once contradicted is only drawn from the server's IR (which exists: the
      // server answered it).
      if (dependencyHash !== undefined && scene && scene.hash === dependencyHash && serverHashOf(sceneId) !== dependencyHash && !wrong.has(key(sceneId, dependencyHash))) {
        const held = compiled.get(key(sceneId, dependencyHash))
        if (held) return held
        const bundle = scene.drawable ? await compileScene(scene) : null
        if (bundle) return bundle
        // WP1: content only the browser has could not be compiled here (a face or an image that did not load, a newer plan
        // meanwhile). The server has no picture of it yet: never answer with its OLDER picture as if it were this one. The
        // stage keeps what it shows and draws the server's picture once the server has compiled the edit.
        throw new StageSceneMismatchError(sceneId, dependencyHash, null)
      }
      return base.loadScene(sceneId, signal, dependencyHash)
    },
    // E1-L: a transition segment is always the server's (the browser never plans or compiles one): without the base's
    // `loadTransition` the stage would play every boundary as a cut while instant editing is on.
    ...(base.loadTransition && { loadTransition: (sceneId: string, signal?: AbortSignal) => base.loadTransition!(sceneId, signal) }),
    ensureFonts: (bundle) => base.ensureFonts(bundle),
    dispose() {
      compiled.clear()
      corrections.clear()
      base.dispose()
    },
    local,
  }
}

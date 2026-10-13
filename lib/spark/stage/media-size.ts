import type { CompositionDocument } from '../composition-client'
import { loadImageSize } from '../image-size'
import { localImageSize, localMedia, measureLocalImage } from '../media/local-media'
import type { Size } from './cover-transform'
import type { StageMediaResolver } from './stage-types'

/**
 * The pixel size of a project source (an image or a video), which the document does not store (its probe has no width or
 * height): what a media insert needs to cover the canvas, and the aspect switch to re-cover a clip on the new canvas.
 * First what this tab already measured (a file picked here, a picture read before: `local-media.ts`), then the picture
 * itself, read once with a time limit. Null when it cannot be learnt in time: the caller then keeps the compiler's own fit
 * (contain, centred), never a guessed size. Nothing is written to browser storage.
 */

export type MediaSourceRef = { sourceId: string; kind: 'image' | 'video'; storageObjectId: string; checksumSha256: string }

export type MediaSizeResolver = ((source: MediaSourceRef) => Promise<Size | null>) & {
  /**
   * Timeline v3 (instant media add): the size known right now, without reading anything (a file measured in this tab, a
   * picture read before); null otherwise. Absent on a plain function (tests): nothing is known up front.
   */
  known?: (source: MediaSourceRef) => Size | null
}

type Body = Record<string, unknown>

/** The Storage facts of an image or video source of the document; null for a missing source or another media kind. */
export function mediaSourceRef(document: CompositionDocument | null, sourceId: string): MediaSourceRef | null {
  const source = document?.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const object = source?.['storage_object'] as Body | undefined
  const kind = object?.['media_kind']
  const objectId = object?.['storage_object_id']
  const checksum = object?.['checksum_sha256']
  if ((kind !== 'image' && kind !== 'video') || typeof objectId !== 'string' || typeof checksum !== 'string') return null
  return { sourceId, kind, storageObjectId: objectId, checksumSha256: checksum }
}

type VideoLike = {
  preload: string
  muted: boolean
  src: string
  videoWidth: number
  videoHeight: number
  onloadedmetadata: (() => void) | null
  onerror: (() => void) | null
  removeAttribute(name: string): void
  load(): void
}

/** The intrinsic size of a video from its metadata only (`preload="metadata"`), or null on error / timeout. */
export function loadVideoSize(
  url: string,
  options: { timeoutMs?: number; createVideo?: () => VideoLike; setTimeoutFn?: typeof setTimeout; clearTimeoutFn?: typeof clearTimeout } = {},
): Promise<Size | null> {
  const create = options.createVideo ?? (() => globalThis.document.createElement('video') as unknown as VideoLike)
  const setTimer = options.setTimeoutFn ?? setTimeout
  const clearTimer = options.clearTimeoutFn ?? clearTimeout
  return new Promise((resolve) => {
    let video: VideoLike
    try {
      video = create()
    } catch {
      resolve(null)
      return
    }
    const done = (size: Size | null) => {
      clearTimer(timer)
      video.onloadedmetadata = null
      video.onerror = null
      // Releases the connection: the element is never attached and is dropped now.
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        // A test double without `load` (or a browser that refuses it) needs nothing more.
      }
      resolve(size)
    }
    const timer = setTimer(() => done(null), options.timeoutMs ?? 4000)
    video.onloadedmetadata = () => done(video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : null)
    video.onerror = () => done(null)
    video.preload = 'metadata'
    video.muted = true
    video.src = url
  })
}

export type MediaSizeLoaders = {
  image?: (url: string, timeoutMs: number) => Promise<Size | null>
  video?: (url: string, timeoutMs: number) => Promise<Size | null>
}

/**
 * The editor's resolver: the size this tab measured, else the picture read through the stage's media URLs (the image the
 * stage draws anyway, the video's metadata only). A size learnt once is kept for the page's life: an image's in the page's
 * one image size cache (`measureLocalImage`, by content checksum and shared with the local preview compile, so an original
 * is downloaded at most once to learn it), a video's by Storage object id. A failed read is tried again next time. Nothing
 * waits on a read any more when media is added (the exact fit follows the insert), so the time limit is generous.
 */
export function createMediaSizeResolver(media: StageMediaResolver, options: { timeoutMs?: number; loaders?: MediaSizeLoaders } = {}): MediaSizeResolver {
  const videoReads = new Map<string, Promise<Size | null>>()
  const videoSizes = new Map<string, Size>()
  const timeoutMs = options.timeoutMs ?? 4000
  const image = options.loaders?.image ?? ((url: string, ms: number) => loadImageSize(url, { timeoutMs: ms }))
  const video = options.loaders?.video ?? ((url: string, ms: number) => loadVideoSize(url, { timeoutMs: ms }))
  const known = (source: MediaSourceRef): Size | null => {
    const size =
      source.kind === 'image'
        ? (localImageSize(source.checksumSha256) ?? localMedia(source.storageObjectId)?.size)
        : (localMedia(source.storageObjectId)?.size ?? videoSizes.get(source.storageObjectId))
    return size ? { width: size.width, height: size.height } : null
  }
  const resolve = (source: MediaSourceRef): Promise<Size | null> => {
    const local = known(source)
    if (local) return Promise.resolve(local)
    if (source.kind === 'image') {
      return measureLocalImage(source.checksumSha256, () => image(media.imageUrl(source.storageObjectId), timeoutMs)).then((size) =>
        size ? { width: size.width, height: size.height } : null,
      )
    }
    const running = videoReads.get(source.storageObjectId)
    if (running) return running
    const reading = video(media.playbackUrl(source.storageObjectId), timeoutMs).catch(() => null)
    videoReads.set(source.storageObjectId, reading)
    void reading.then((size) => {
      videoReads.delete(source.storageObjectId)
      if (size) videoSizes.set(source.storageObjectId, { width: size.width, height: size.height })
    })
    return reading
  }
  return Object.assign(resolve, { known })
}

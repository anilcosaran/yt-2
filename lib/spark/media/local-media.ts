import type { StageMediaResolver } from '../stage/stage-types'

/**
 * WP5a: what the browser already knows about a media file the user picked in THIS tab, so the editor does not download
 * the original again to learn it: the natural size of an image (by content checksum: the bytes decide it, as they decide
 * the gateway's probe) and an object URL of the local file (by Storage object id) the stage can draw or play while the
 * file is still uploading, being scanned or processed, and afterwards.
 *
 * In memory only, for the page's life: nothing is written to browser storage and nothing is sent anywhere. The object URLs
 * belong to the upload queue that created them; it revokes them (and forgets them here) when the editor goes away or the
 * file never became part of the project.
 */

export type LocalMediaEntry = {
  url: string
  kind: 'image' | 'video'
  /** The browser could read the file's picture (a video whose codec it cannot decode is played from the server instead). */
  playable: boolean
  /** The pixel size the browser measured (EXIF orientation applied), when it could. */
  size?: { width: number; height: number }
}

const imageSizes = new Map<string, { width: number; height: number }>()
/** Reads of an image's size that are running now, by checksum (one read per image at a time for the whole page). */
const imageReads = new Map<string, Promise<{ width: number; height: number } | null>>()
const files = new Map<string, LocalMediaEntry>()

const validSize = (width: number | null | undefined, height: number | null | undefined) =>
  typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0

/** The natural size the browser measured for these image bytes (EXIF orientation applied, like the gateway's probe). */
export function rememberLocalImageSize(checksumSha256: string, size: { width: number | null; height: number | null }): void {
  if (!validSize(size.width, size.height)) return
  imageSizes.set(checksumSha256.toLowerCase(), { width: Math.round(size.width!), height: Math.round(size.height!) })
}

export function localImageSize(checksumSha256: string): { width: number; height: number } | null {
  return imageSizes.get(checksumSha256.toLowerCase()) ?? null
}

/**
 * Timeline v3 (one size cache): the natural size of an image by its content checksum, learnt at most once for the whole
 * page. What this tab already knows (a file picked here, a picture read before) answers at once; otherwise `read` (the
 * caller's time-limited read of the picture) runs, and a second caller asking meanwhile shares that read. A size read this
 * way is remembered like a measured file's (`localImageSize`); a failed or timed-out read is tried again next time. The
 * media insert fit (`stage/media-size.ts`) and the local preview compile (`optimistic/local-preview-source.ts`) both go
 * through here, so the canvas never downloads an original twice to learn its size.
 */
export function measureLocalImage(
  checksumSha256: string,
  read: () => Promise<{ width: number; height: number } | null>,
): Promise<{ width: number; height: number } | null> {
  const key = checksumSha256.toLowerCase()
  const known = imageSizes.get(key)
  if (known) return Promise.resolve(known)
  const running = imageReads.get(key)
  if (running) return running
  let reading: Promise<{ width: number; height: number } | null>
  try {
    reading = read()
  } catch {
    reading = Promise.resolve(null)
  }
  const shared = reading
    .catch(() => null)
    .then((size) => {
      if (imageReads.get(key) === shared) imageReads.delete(key)
      if (size) rememberLocalImageSize(key, size)
      return imageSizes.get(key) ?? null
    })
  imageReads.set(key, shared)
  return shared
}

export function rememberLocalMedia(storageObjectId: string, entry: LocalMediaEntry): void {
  files.set(storageObjectId, entry)
}

/** Called before the object URL is revoked: the stage reads the file from the server again. */
export function forgetLocalMedia(storageObjectId: string): void {
  files.delete(storageObjectId)
}

export function localMedia(storageObjectId: string): LocalMediaEntry | null {
  return files.get(storageObjectId) ?? null
}

/**
 * The stage's media resolver, with the local file first: an image the user just picked is drawn from its object URL (no
 * download of the original), a video the browser can play is played from it until the editor closes. Everything else
 * resolves as before (the ingest proxy for playback, the original for a picture).
 */
export function withLocalMedia(resolver: StageMediaResolver): StageMediaResolver {
  return {
    playbackUrl: (objectId) => {
      const local = files.get(objectId)
      return local && local.kind === 'video' && local.playable ? local.url : resolver.playbackUrl(objectId)
    },
    imageUrl: (objectId) => {
      const local = files.get(objectId)
      return local && local.kind === 'image' && local.playable ? local.url : resolver.imageUrl(objectId)
    },
  }
}

export function resetLocalMediaForTests(): void {
  imageSizes.clear()
  imageReads.clear()
  files.clear()
}

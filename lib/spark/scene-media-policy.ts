/**
 * E1-J (D10): which files a scene can show. The scene compiler draws PNG, JPEG and WebP images; videos play in the
 * browser (MP4, WebM, MOV). GIF and SVG images, audio files and other containers are refused with a reason the editor
 * turns into a clear message, never silently dropped or attached and then failing later.
 */

export type SceneMediaKind = 'image' | 'video'

export type SceneMediaRefusal = 'gif' | 'svg' | 'audio' | 'image_format' | 'video_format' | 'unsupported'

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

/** The `accept` of a native file input that offers exactly the supported types. */
export const SCENE_MEDIA_ACCEPT =
  'image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov'

function normalizedMime(mimeType: string | null | undefined): string {
  return (mimeType ?? '').split(';', 1)[0]!.trim().toLowerCase()
}

function extensionOf(name: string | null | undefined): string {
  const file = (name ?? '').split(/[\\/]/).pop() ?? ''
  const dot = file.lastIndexOf('.')
  return dot >= 0 ? file.slice(dot + 1).toLowerCase() : ''
}

/**
 * Classifies a Storage object or a picked file by its MIME type (the extension decides only when the type is missing or
 * the generic `application/octet-stream`).
 */
export function classifySceneMedia(input: { mimeType?: string | null; name?: string | null }): { ok: true; kind: SceneMediaKind } | { ok: false; reason: SceneMediaRefusal } {
  let mime = normalizedMime(input.mimeType)
  const extension = extensionOf(input.name)
  if (mime === '' || mime === 'application/octet-stream') {
    if (IMAGE_EXTENSIONS.has(extension)) return { ok: true, kind: 'image' }
    if (VIDEO_EXTENSIONS.has(extension)) return { ok: true, kind: 'video' }
    if (extension === 'gif') mime = 'image/gif'
    else if (extension === 'svg') mime = 'image/svg+xml'
  }
  if (IMAGE_MIME.has(mime)) return { ok: true, kind: 'image' }
  if (VIDEO_MIME.has(mime)) return { ok: true, kind: 'video' }
  if (mime === 'image/gif') return { ok: false, reason: 'gif' }
  if (mime === 'image/svg+xml') return { ok: false, reason: 'svg' }
  if (mime.startsWith('audio/')) return { ok: false, reason: 'audio' }
  if (mime.startsWith('image/')) return { ok: false, reason: 'image_format' }
  if (mime.startsWith('video/')) return { ok: false, reason: 'video_format' }
  return { ok: false, reason: 'unsupported' }
}

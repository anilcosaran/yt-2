/**
 * E1-A D10: which files the Spark editor takes. The compiler draws PNG/JPEG/WebP images only, and the stage plays
 * MP4/WebM/MOV video and MP3/WAV/M4A/OGG audio; GIF and SVG are refused up front with a clear reason (they would be
 * stored and then refused by the compiler: `image_type_unsupported`). The size limit is the plan's Storage upload limit
 * (`max_storage_upload_size_mb`): the gateway enforces it when the upload starts and the uploader names it.
 */

export type SparkMediaKind = 'image' | 'video' | 'audio'

/** Storage folder of uploads made from the editor (D10); recordings use `SPARK_RECORDINGS_FOLDER` (D7). */
export const SPARK_MEDIA_FOLDER = 'Spark'
export const SPARK_RECORDINGS_FOLDER = 'Recordings'

export type MediaFileRefusal = 'gif' | 'svg' | 'unsupported' | 'empty'
export type MediaFileCheck = { ok: true; kind: SparkMediaKind } | { ok: false; reason: MediaFileRefusal }

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/ogg', 'audio/webm'])

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg'])

/** The `accept` attribute of the file picker: the extensions and the MIME types of everything the editor takes. */
export const SPARK_MEDIA_ACCEPT = [
  ...[...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS].map((extension) => `.${extension}`),
  ...IMAGE_MIME,
  ...VIDEO_MIME,
  ...AUDIO_MIME,
].join(',')

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).trim().toLowerCase() : ''
}

/**
 * Classifies a file (or a Storage object's name and MIME type) by its MIME type first, then its extension. A `.webm`
 * without a MIME type is video; `audio/webm` (a voice recording) is audio.
 */
export function classifyMediaFile(file: { name: string; type?: string | null; size?: number }): MediaFileCheck {
  if (file.size === 0) return { ok: false, reason: 'empty' }
  const mime = (file.type ?? '').trim().toLowerCase().split(';')[0]!.trim()
  const extension = extensionOf(file.name)
  if (mime === 'image/gif' || extension === 'gif') return { ok: false, reason: 'gif' }
  if (mime === 'image/svg+xml' || extension === 'svg') return { ok: false, reason: 'svg' }
  if (IMAGE_MIME.has(mime)) return { ok: true, kind: 'image' }
  if (VIDEO_MIME.has(mime)) return { ok: true, kind: 'video' }
  if (AUDIO_MIME.has(mime)) return { ok: true, kind: 'audio' }
  // Unknown or generic MIME type (`application/octet-stream`, empty): the extension decides.
  if (mime === '' || mime === 'application/octet-stream') {
    if (IMAGE_EXTENSIONS.has(extension)) return { ok: true, kind: 'image' }
    if (VIDEO_EXTENSIONS.has(extension)) return { ok: true, kind: 'video' }
    if (AUDIO_EXTENSIONS.has(extension)) return { ok: true, kind: 'audio' }
  }
  return { ok: false, reason: 'unsupported' }
}

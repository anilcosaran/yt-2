import { File as FileIcon, Film, Image as ImageIcon } from 'lucide-react'

import {
  completeStorageUpload,
  getStorageDownloadUrl,
  initiateStorageUpload,
  resolveStorageUploadTransport,
  uploadDirectContent,
  uploadProxyContent,
  uploadTusContent,
  type InitiateUploadResult,
  type StorageMemoryIngestionRequest,
  type StorageObjectItem,
} from '@/lib/storage/api'

/** The main Chat's attached / generated media: its shape, kind and URL rules, and the composer's upload. */

export type ChatAssetKind = 'image' | 'video' | 'audio' | 'document' | 'file'

export type ChatAssetAttachment = {
  id: string
  objectId?: string | null
  channelId?: string | null
  kind: ChatAssetKind
  name: string
  url: string | null
  previewUrl?: string | null
  mimeType?: string | null
  source: 'storage' | 'upload' | 'generated'
  sizeBytes?: string | null
  status?: string | null
  metadata?: Record<string, unknown>
}

export const CHAT_MEDIA_UPLOAD_ACCEPT = 'image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.csv,.json'

export function AttachmentKindIcon({ kind, className }: { kind: ChatAssetKind; className?: string }) {
  if (kind === 'image') return <ImageIcon className={className} />
  if (kind === 'video') return <Film className={className} />
  return <FileIcon className={className} />
}

export async function uploadChatMediaFile(
  channelId: string,
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  // S19: the shared "Belleğe de ekle" choice of the batch (default: the channel's chat-upload rules decide).
  memoryIngestion: StorageMemoryIngestionRequest = { source: 'chat_upload' },
): Promise<ChatAssetAttachment> {
  const session = await initiateStorageUpload({
    channelId,
    file,
    // P01B-04: the channel's chat-upload ingestion rules apply to composer uploads.
    memoryIngestion,
    idempotencyKey: `chat-media-upload:${createClientId()}`,
    signal,
  })
  const uploadTransport = resolveStorageUploadTransport(session)
  if (uploadTransport === 'direct') {
    await uploadDirectContent({ session, file, onProgress, signal })
    await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal,
    })
  } else if (uploadTransport === 'tus') {
    await uploadTusContent({ session, file, onProgress, signal })
    await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal,
    })
  } else {
    const result = await uploadProxyContent({ session, file, onProgress, signal })
    if (!result.completed) {
      await completeStorageUpload({
        channelId,
        uploadSessionId: session.upload_session_id,
        finalizeToken: session.finalize_token,
        signal,
      })
    }
  }
  return attachmentFromUploadSession(channelId, file, session)
}

export function isChatUploadAbort(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; name?: unknown }
  return candidate.code === 'STORAGE_UPLOAD_ABORTED' || candidate.name === 'AbortError'
}

export function attachmentFromUploadSession(channelId: string, file: File, session: InitiateUploadResult): ChatAssetAttachment {
  const kind = inferAttachmentKind({ url: file.name, mimeType: file.type, name: file.name })
  const url = getStorageDownloadUrl({
    channelId,
    objectId: session.object_id,
    fileName: file.name,
  })
  return {
    id: `storage:${session.object_id}`,
    objectId: session.object_id,
    channelId,
    kind,
    name: file.name,
    url,
    previewUrl: url,
    mimeType: file.type || null,
    source: 'upload',
    sizeBytes: String(file.size),
    status: 'uploaded',
    metadata: {
      upload_session_id: session.upload_session_id,
      storage_key: session.storage_key,
    },
  }
}

export function attachmentFromStorageItem(item: StorageObjectItem, channelId: string | null): ChatAssetAttachment {
  const url = channelId
    ? getStorageDownloadUrl({ channelId, objectId: item.id, fileName: item.name })
    : null
  return {
    id: `storage:${item.id}`,
    objectId: item.id,
    channelId: channelId ?? item.channel_id,
    kind: inferAttachmentKind({ url: item.name, mimeType: item.mime_type, name: item.name }),
    name: item.name,
    url,
    previewUrl: null,
    mimeType: item.mime_type,
    source: 'storage',
    sizeBytes: item.size_bytes,
    status: item.status,
    metadata: {
      path: item.path,
      storage_key: item.storage_key,
      provider_kind: item.provider_kind,
      delivery_variant: item.delivery_variant,
      ...(item.checksum_sha256 ? { checksum_sha256: item.checksum_sha256 } : {}),
    },
  }
}


export function formatAttachmentMeta(asset: ChatAssetAttachment) {
  return [asset.kind, formatBytesLabel(asset.sizeBytes)].filter(Boolean).join(' · ')
}

export function formatBytesLabel(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(amount) / Math.log(1024)), units.length - 1)
  const result = amount / 1024 ** index
  return `${result >= 10 || index === 0 ? result.toFixed(0) : result.toFixed(1)} ${units[index]}`
}

export function inferAttachmentKind(input: { url?: string | null; mimeType?: string | null; name?: string | null }): ChatAssetKind {
  const mimeType = input.mimeType?.toLowerCase() ?? ''
  const value = `${input.url ?? ''} ${input.name ?? ''}`.toLowerCase()
  if (isVideoMimeType(mimeType) || isVideoMediaUrl(input.url ?? '') || /\.(mp4|webm|mov|avi|mkv|m3u8)(\?|$)/i.test(value) || /\/(mp4|webm|mov|avi|mkv|m3u8)([?#/]|$)/i.test(value)) return 'video'
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(\?|$)/i.test(value) || /\/(png|jpe?g|gif|webp|svg|bmp|ico|tiff)([?#/]|$)/i.test(value)) return 'image'
  if (looksLikeYoutorchMediaUrl(input.url ?? '')) {
    return 'image'
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac)(\?|$)/i.test(value)) return 'audio'
  if (mimeType.includes('pdf') || /\.(pdf|docx?|pptx?|txt|md|csv|json)(\?|$)/i.test(value)) return 'document'
  return 'file'
}

export function isVisualAttachment(asset: ChatAssetAttachment) {
  return asset.kind === 'image' || asset.kind === 'video'
}

export function getMediaThumbnailUrl(asset: ChatAssetAttachment) {
  if (asset.kind === 'image') return asset.previewUrl ?? asset.url
  if (asset.previewUrl && isImageMediaUrl(asset.previewUrl)) return asset.previewUrl
  return null
}

export function isImageMediaUrl(value: string) {
  if (/^\s*data:/i.test(value)) return false
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(?:[?#].*)?$/i.test(value)
    || /\/(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(?:[?#/]|$)/i.test(value)
}

export function isVideoMediaUrl(value: string) {
  if (!value) return false
  return isEmbeddableVideoUrl(value)
    || isHlsVideoUrl(value)
    || /\.(mp4|webm|mov|avi|mkv)(?:[?#].*)?$/i.test(value)
    || /\/(mp4|webm|mov|avi|mkv)(?:[?#/]|$)/i.test(value)
    || /\b(video|render|stream|playback)\b/i.test(value)
}

export function isHlsVideoUrl(value: string) {
  return /\.m3u8(?:[?#].*)?$/i.test(value) || /\/playlist\.m3u8(?:[?#].*)?$/i.test(value)
}

export function isEmbeddableVideoUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    return (host === 'video.bunnycdn.com' && path.includes('/play/'))
      || (host === 'iframe.mediadelivery.net' && path.includes('/embed/'))
  } catch {
    return false
  }
}

export function isVideoMimeType(value: string) {
  return value.startsWith('video/')
    || value.includes('mpegurl')
    || value === 'application/vnd.apple.mpegurl'
    || value === 'application/x-mpegurl'
}

export function looksLikeYoutorchMediaUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isYoutorchHost = host === 'youtorch.io'
      || host.endsWith('.youtorch.io')
      || host.includes('youtorch')
    const isKnownMediaHost = host.startsWith('cdn.')
      || host.startsWith('media.')
      || host.startsWith('assets.')
      || host.includes('bunnycdn')
      || host.endsWith('.b-cdn.net')
      || host.includes('mediadelivery.net')
    const hasMediaPath = /\/(api\/storage|storage|uploads|media|generated|artifacts|files|objects|cdn)(?:\/|$)/.test(path)
    return isKnownMediaHost || (isYoutorchHost && hasMediaPath)
  } catch {
    return false
  }
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** A file handed over from elsewhere (a new chat started on the new tab) when it has an attachment's shape. */
export function readChatAssetAttachment(value: unknown): ChatAssetAttachment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const { id, kind, name, source, metadata } = record
  if (typeof id !== 'string' || !id || typeof name !== 'string') return null
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio' && kind !== 'document' && kind !== 'file') return null
  if (source !== 'storage' && source !== 'upload' && source !== 'generated') return null
  const text = (key: string) => (typeof record[key] === 'string' ? record[key] as string : null)
  return {
    id,
    objectId: text('objectId'),
    channelId: text('channelId'),
    kind,
    name,
    url: text('url'),
    previewUrl: text('previewUrl'),
    mimeType: text('mimeType'),
    source,
    sizeBytes: text('sizeBytes'),
    status: text('status'),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : undefined,
  }
}

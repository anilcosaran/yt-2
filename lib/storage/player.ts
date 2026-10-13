export const STORAGE_PLAYER_REFERRER_POLICY = 'origin' as const
// A slow player must remain usable. Reaching this deadline reveals the native
// controls or iframe; it must never be treated as proof that the media failed.
export const STORAGE_PLAYER_REVEAL_TIMEOUT_MS = 15_000
export const STORAGE_NATIVE_VIDEO_OPEN_TIMEOUT_MS = 30_000

export type StoragePlayerEvent = {
  event: string
  value: unknown
}

export type StoragePlaybackState = {
  key: string
  status: 'loading' | 'ready' | 'error'
}

export type StoragePreviewMediaKind = 'image' | 'video' | 'audio' | 'text' | 'unsupported'

export function revealStoragePlayback(
  current: StoragePlaybackState,
  playbackKey: string,
): StoragePlaybackState {
  if (current.key === playbackKey && current.status !== 'loading') return current
  return {
    key: playbackKey,
    status: 'ready',
  }
}

export function resolveStoragePlaybackStatus(
  current: StoragePlaybackState,
  playbackKey: string,
  revealNativeMedia: boolean,
): StoragePlaybackState['status'] {
  const resolved = revealNativeMedia
    ? revealStoragePlayback(current, playbackKey)
    : current
  return resolved.key === playbackKey ? resolved.status : 'loading'
}

export function getStoragePreviewInitialMediaStatus(input: {
  previewReady: boolean
  kind: StoragePreviewMediaKind
  usesStreamPlayer: boolean
}): 'loading' | 'ready' {
  if (!input.previewReady) return 'loading'
  if (input.kind === 'unsupported' || input.kind === 'audio') return 'ready'
  return 'loading'
}

export function getStoragePlayerOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

export function parseStoragePlayerEvent(value: unknown): StoragePlayerEvent | null {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const message = parsed as Record<string, unknown>
  if (message.context !== 'player.js' || typeof message.event !== 'string' || !message.event.trim()) {
    return null
  }
  return {
    event: message.event,
    value: message.value !== undefined ? message.value : message.data,
  }
}

export function registerStoragePlayerEvents(
  frame: HTMLIFrameElement,
  playerUrl: string,
  listenerPrefix: string,
  events: readonly string[] = ['ready', 'error'],
) {
  const origin = getStoragePlayerOrigin(playerUrl)
  if (!origin || !frame.contentWindow) return false

  for (const event of events) {
    frame.contentWindow.postMessage(JSON.stringify({
      context: 'player.js',
      version: '0.0.11',
      method: 'addEventListener',
      value: event,
      listener: `${listenerPrefix}:${event}`,
    }), origin)
  }
  return true
}

export function seekStoragePlayer(frame: HTMLIFrameElement, playerUrl: string, seconds: number) {
  const origin = getStoragePlayerOrigin(playerUrl)
  if (!origin || !frame.contentWindow || !Number.isFinite(seconds)) return false
  frame.contentWindow.postMessage(JSON.stringify({
    context: 'player.js',
    version: '0.0.11',
    method: 'setCurrentTime',
    value: Math.max(0, seconds),
  }), origin)
  return true
}

export function readStoragePlayerTime(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const candidate = record.seconds ?? record.currentTime ?? record.time
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

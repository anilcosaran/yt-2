import { readBrowserPrincipalScope } from "@/lib/auth/browser-principal-storage"

const STORAGE_PREFIX = 'youtorch.avatar.recording-draft.v1'

export type RecordingCaptureDraft = {
  id: string
  token: string
  recording_url: string
  qr_payload: string
  expires_at: string
}

function storageKey(channelId: string) {
  const principal = readBrowserPrincipalScope()
  return principal ? `${STORAGE_PREFIX}:${principal}:${channelId}` : null
}

export function isRecordingCaptureDraftLive(draft: RecordingCaptureDraft, now = Date.now()) {
  const expiresAt = new Date(draft.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt - now > 15_000 && Boolean(draft.token || draft.recording_url)
}

export function readRecordingCaptureDraft(channelId: string): RecordingCaptureDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const key = storageKey(channelId)
    if (!key) return null
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RecordingCaptureDraft>
    if (!parsed.id || !parsed.expires_at) return null
    const draft: RecordingCaptureDraft = {
      id: parsed.id,
      token: parsed.token?.trim() || '',
      recording_url: parsed.recording_url?.trim() || '',
      qr_payload: parsed.qr_payload?.trim() || parsed.recording_url?.trim() || '',
      expires_at: parsed.expires_at,
    }
    return isRecordingCaptureDraftLive(draft) ? draft : null
  } catch {
    return null
  }
}

export function writeRecordingCaptureDraft(channelId: string, draft: RecordingCaptureDraft) {
  if (typeof window === 'undefined') return
  if (!isRecordingCaptureDraftLive(draft)) {
    clearRecordingCaptureDraft(channelId)
    return
  }
  const key = storageKey(channelId)
  if (!key) return
  try { window.sessionStorage.setItem(key, JSON.stringify(draft)) } catch { /* Storage may be unavailable. */ }
}

export function clearRecordingCaptureDraft(channelId: string) {
  if (typeof window === 'undefined') return
  const key = storageKey(channelId)
  if (!key) return
  try { window.sessionStorage.removeItem(key) } catch { /* Storage may be unavailable. */ }
}

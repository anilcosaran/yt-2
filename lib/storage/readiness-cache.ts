import type { StorageObjectItem } from './api'

const READINESS_POLL_DEADLINE_MS = 10 * 60_000

export function isStorageReadinessPending(item: StorageObjectItem) {
  if (item.type !== 'file' || ['failed', 'quarantined', 'deleted'].includes(item.status)) return false
  const media = /^(image|video|audio)\//.test(item.mime_type ?? '')
    || /^(jpg|jpeg|png|webp|gif|avif|heic|mp4|mov|m4v|webm|mkv|mp3|wav|m4a|ogg|opus)$/i.test(item.extension ?? '')
  return media && (!item.original_ready || !item.workflow_ready)
}

// Bound retries per object so a new upload gets a full window, while a stuck
// object cannot keep the whole library polling forever.
export function storageReadinessPollInterval(
  items: StorageObjectItem[],
  firstSeen: Map<string, number>,
  now = Date.now(),
) {
  let interval: number | false = false
  for (const item of items) {
    if (!isStorageReadinessPending(item)) {
      firstSeen.delete(item.id)
      continue
    }
    const started = firstSeen.get(item.id) ?? now
    firstSeen.set(item.id, started)
    const elapsed = now - started
    if (elapsed >= READINESS_POLL_DEADLINE_MS) continue
    const next = elapsed < 30_000 ? 4_000 : elapsed < 120_000 ? 10_000 : 30_000
    interval = interval === false ? next : Math.min(interval, next)
  }
  return interval
}

export function mergeStorageListItem<T extends { pages: Array<{ data: StorageObjectItem[] }> }>(
  cached: T | undefined,
  latest: StorageObjectItem,
): T | undefined {
  if (!cached) return cached
  return {
    ...cached,
    pages: cached.pages.map((page) => ({
      ...page,
      data: page.data.map((item) => item.id === latest.id && Date.parse(item.updated_at) <= Date.parse(latest.updated_at)
        ? latest
        : item),
    })),
  }
}

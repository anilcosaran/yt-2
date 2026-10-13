import { previewMemoryIngestion, type MemorySettings } from '@/lib/memory/api'
import type { StorageMemoryIngestionRequest } from '@/lib/storage/api'

/**
 * S19 (decision 2026-09-27) "Belleğe de ekle": ONE shared checkbox at the upload entry point (Storage toolbar,
 * Chat add menu and media picker), no per-file checkbox. Checked = the channel's ingestion rules decide
 * (`default`); unchecked = `skip`. An off/approval rule is never bypassed by the checkbox. The state lives only
 * in component memory (no browser storage). The per-file outcome comes from the read-only ingestion preview.
 */

export type MemoryUploadSource = 'storage' | 'chat_upload'

/** Upload request field for the checkbox state (`undefined` keeps today's default request unchanged). */
export function memoryIngestionRequestFor(checked: boolean, source: MemoryUploadSource): StorageMemoryIngestionRequest | undefined {
  if (source === 'chat_upload') return checked ? { source } : { source, choice: 'skip' }
  return checked ? undefined : { choice: 'skip' }
}

export type MemoryUploadAvailability =
  | { available: true }
  | { available: false; reason: 'channel_memory_disabled' | 'plan' | 'retention' }

/**
 * Checkbox availability from the channel's existing Memory settings. Unknown (still loading, or not readable)
 * stays enabled: the server applies the channel rules anyway.
 */
export function memoryUploadAvailability(settings: MemorySettings | null | undefined): MemoryUploadAvailability {
  if (!settings || settings.effective_enabled) return { available: true }
  if (settings.status === 'disabled_by_plan') return { available: false, reason: 'plan' }
  if (settings.status === 'retention' || settings.status === 'purged') return { available: false, reason: 'retention' }
  return { available: false, reason: 'channel_memory_disabled' }
}

export type MemoryUploadSummary = {
  queued: number
  approval: number
  notAdded: number
  skipped: number
}

const PREVIEW_BATCH = 50

/**
 * The Memory outcome of an upload batch, for one summary line next to the upload progress. Unchecked = every
 * file skipped (no request). A failed preview returns null (the upload itself is never blocked by it).
 */
export async function previewMemoryUploadOutcome(input: {
  channelId: string
  source: MemoryUploadSource
  checked: boolean
  files: ReadonlyArray<Pick<File, 'name' | 'type' | 'size'>>
  parentPath?: string
}): Promise<MemoryUploadSummary | null> {
  if (input.files.length === 0) return null
  if (!input.checked) return { queued: 0, approval: 0, notAdded: 0, skipped: input.files.length }
  try {
    const summary: MemoryUploadSummary = { queued: 0, approval: 0, notAdded: 0, skipped: 0 }
    for (let start = 0; start < input.files.length; start += PREVIEW_BATCH) {
      const preview = await previewMemoryIngestion({
        channelId: input.channelId,
        source: input.source,
        items: input.files.slice(start, start + PREVIEW_BATCH).map((file) => ({
          fileName: file.name,
          parentPath: input.parentPath,
          mimeType: file.type,
          sizeBytes: file.size,
        })),
      })
      for (const item of preview.items) {
        if (item.policy_result === 'queued') summary.queued += 1
        else if (item.policy_result === 'approval_required') summary.approval += 1
        else summary.notAdded += 1
      }
    }
    return summary
  } catch {
    return null
  }
}

import { createStorageFolder } from '@/lib/storage/api'

import type { PickedMedia } from './attach-picked-media'

/**
 * E1-J (D10): files uploaded from the Spark editor go to the Storage folder "Spark". Storage requires the parent folder
 * to exist and `createStorageFolder` is idempotent (it answers `created: false` for an existing one), so each upload
 * asks for it first. The transfer itself is the shared `uploadStorageMedia` (resumable, checksummed, queued); it is
 * loaded on demand so the editor does not carry the whole Storage picker module until a file is actually uploaded.
 */
export const SPARK_UPLOAD_FOLDER = 'Spark'

export type SparkUploadDeps = {
  ensureFolder?: (input: { channelId: string; name: string }) => Promise<unknown>
  upload?: (
    channelId: string,
    file: File,
    onProgress: (progress: number) => void,
    options: { signal?: AbortSignal; parentPath: string },
  ) => Promise<PickedMedia & { status: 'active' | 'processing' }>
}

async function defaultUpload(
  channelId: string,
  file: File,
  onProgress: (progress: number) => void,
  options: { signal?: AbortSignal; parentPath: string },
) {
  const { uploadStorageMedia } = await import('@/components/storage/storage-media-input')
  const selection = await uploadStorageMedia(channelId, file, 'all', undefined, onProgress, options)
  return {
    storageObjectId: selection.storageObjectId,
    mimeType: selection.mimeType ?? (file.type || null),
    name: selection.name,
    width: selection.width,
    height: selection.height,
    status: selection.status,
  }
}

/** Uploads one file into the "Spark" folder of the channel; resolves what the picker would have returned for it. */
export async function uploadToSparkFolder(input: {
  channelId: string
  file: File
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  deps?: SparkUploadDeps
}): Promise<PickedMedia & { status: 'active' | 'processing' }> {
  const ensureFolder = input.deps?.ensureFolder ?? createStorageFolder
  const upload = input.deps?.upload ?? defaultUpload
  await ensureFolder({ channelId: input.channelId, name: SPARK_UPLOAD_FOLDER })
  return upload(input.channelId, input.file, input.onProgress ?? (() => undefined), {
    ...(input.signal && { signal: input.signal }),
    parentPath: SPARK_UPLOAD_FOLDER,
  })
}

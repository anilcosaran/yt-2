import { AuthClientError } from '@/lib/auth/errors'
import {
  completeStorageUpload,
  createStorageFolder,
  initiateStorageUpload,
  uploadDirectContent,
  uploadProxyContent,
  uploadTusContent,
  type InitiateUploadResult,
} from '@/lib/storage/api'
import { createStorageUploadFingerprint } from '@/lib/storage/file-checksum'

import { recordingFileName } from './recorder-formats'
import { RECORDINGS_FOLDER, RecordingSaveError, type RecordedPart } from './recording-types'

/**
 * E1-F upload of a recorded file into the Storage folder "Recordings" (D7). The Media tool's `uploadStorageMedia` has no
 * folder parameter and does not hand the checksum back (project attach needs it), so a recording goes through the same
 * Storage primitives it is built from, with the same transfer ladder (direct / tus / proxy -> complete):
 *
 *   ensure the folder -> fingerprint (SHA-256 + idempotency key, content derived) -> initiate with `parent_path` ->
 *   transfer -> complete.
 *
 * The idempotency key is derived from the content, so a retry of the same file finds the same upload session; a session
 * that ended (expired / failed / cancelled) is replaced by a suffixed key like Storage's own retry does.
 */

export type RecordingStorageApi = {
  createFolder(input: { channelId: string; name: string }): Promise<unknown>
  fingerprint(input: { channelId: string; parentPath: string; file: File; signal?: AbortSignal }): Promise<{ checksumSha256: string; idempotencyKey: string }>
  initiate(input: Parameters<typeof initiateStorageUpload>[0]): Promise<InitiateUploadResult>
  uploadDirect(input: Parameters<typeof uploadDirectContent>[0]): Promise<unknown>
  uploadTus(input: Parameters<typeof uploadTusContent>[0]): Promise<unknown>
  uploadProxy(input: Parameters<typeof uploadProxyContent>[0]): Promise<Awaited<ReturnType<typeof uploadProxyContent>>>
  complete(input: Parameters<typeof completeStorageUpload>[0]): Promise<Awaited<ReturnType<typeof completeStorageUpload>>>
}

export const defaultRecordingStorageApi: RecordingStorageApi = {
  createFolder: (input) => createStorageFolder(input),
  fingerprint: (input) => createStorageUploadFingerprint(input),
  initiate: (input) => initiateStorageUpload(input),
  uploadDirect: (input) => uploadDirectContent(input),
  uploadTus: (input) => uploadTusContent(input),
  uploadProxy: (input) => uploadProxyContent(input),
  complete: (input) => completeStorageUpload(input),
}

export type RecordingUploadResult = { storageObjectId: string; checksumSha256: string; status: 'active' | 'processing' }

const MAX_SESSION_RETRIES = 3

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  return Boolean(error && typeof error === 'object' && ((error as { code?: unknown }).code === 'STORAGE_UPLOAD_ABORTED' || (error as { name?: unknown }).name === 'AbortError'))
}

/** What went wrong with an upload, as the reason the drawer names. */
export function classifyUploadError(error: unknown): RecordingSaveError {
  if (error instanceof RecordingSaveError) return error
  if (error instanceof AuthClientError) {
    if (error.code === 'STORAGE_UPLOAD_SIZE_EXCEEDED' || error.code === 'STORAGE_HARD_LIMIT_EXCEEDED' || error.status === 413) return new RecordingSaveError('too_large', { cause: error })
    if (error.code === 'STORAGE_UNSUPPORTED_FILE_TYPE' || error.code === 'STORAGE_MIME_MISMATCH') return new RecordingSaveError('unsupported_type', { cause: error })
    if (error.code === 'STORAGE_UPLOAD_DISABLED' || error.code === 'STORAGE_SPACE_RESTRICTED') return new RecordingSaveError('forbidden', { cause: error })
  }
  return new RecordingSaveError('upload_failed', { cause: error })
}

export function recordingFile(part: RecordedPart, startedAt: number): File {
  return new File([part.blob], recordingFileName(part.role, startedAt, part.extension), { type: part.mimeType, lastModified: startedAt })
}

/** Uploads one recorded file into "Recordings". Rejects with a `RecordingSaveError` (or the abort error when `signal` aborted). */
export async function uploadRecordingFile(input: {
  channelId: string
  part: RecordedPart
  startedAt: number
  onProgress(percent: number): void
  signal?: AbortSignal
  api?: RecordingStorageApi
}): Promise<RecordingUploadResult> {
  const api = input.api ?? defaultRecordingStorageApi
  const { channelId, signal } = input
  const file = recordingFile(input.part, input.startedAt)
  // What the recording is, for the Storage library (no personal data: ids and numbers only).
  const metadata = {
    recording_role: input.part.role,
    recording_duration_ms: Math.round(input.part.durationMs),
    recording_has_audio: input.part.hasAudio,
    ...(input.part.width && input.part.height && { recording_width: input.part.width, recording_height: input.part.height }),
  }
  try {
    await api.createFolder({ channelId, name: RECORDINGS_FOLDER })
    const fingerprint = await api.fingerprint({ channelId, parentPath: RECORDINGS_FOLDER, file, signal })

    let session: InitiateUploadResult | null = null
    for (let retry = 0; session === null; retry += 1) {
      try {
        session = await api.initiate({
          channelId,
          file,
          parentPath: RECORDINGS_FOLDER,
          metadata,
          checksumSha256: fingerprint.checksumSha256,
          idempotencyKey: retry === 0 ? fingerprint.idempotencyKey : `${fingerprint.idempotencyKey}:retry:${retry}`,
          signal,
        })
      } catch (error) {
        if (!(error instanceof AuthClientError) || error.code !== 'STORAGE_UPLOAD_SESSION_UNAVAILABLE' || retry >= MAX_SESSION_RETRIES) throw error
      }
    }
    throwIfAborted(signal)

    let status: 'active' | 'processing' = 'processing'
    const complete = async () => {
      const completed = await api.complete({ channelId, uploadSessionId: session.upload_session_id, finalizeToken: session.finalize_token, signal })
      status = completed.status
    }
    if (session.upload_status === 'uploaded' || session.upload_status === 'completed') {
      await complete()
      input.onProgress(100)
    } else if (session.upload_mode === 'direct') {
      await api.uploadDirect({ session, file, onProgress: input.onProgress, signal })
      throwIfAborted(signal)
      await complete()
    } else if (session.upload_protocol === 'tus') {
      await api.uploadTus({ session, file, onProgress: input.onProgress, signal })
      throwIfAborted(signal)
      await complete()
    } else {
      const uploaded = await api.uploadProxy({ session, file, onProgress: input.onProgress, signal })
      throwIfAborted(signal)
      if (uploaded.completed && (uploaded.status === 'active' || uploaded.status === 'processing')) status = uploaded.status
      else await complete()
    }
    return { storageObjectId: session.object_id, checksumSha256: fingerprint.checksumSha256, status }
  } catch (error) {
    if (isAbort(error, signal)) throw error instanceof DOMException ? error : new DOMException('Upload aborted.', 'AbortError')
    throw classifyUploadError(error)
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Upload aborted.', 'AbortError')
}

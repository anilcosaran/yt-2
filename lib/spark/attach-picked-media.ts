import { getStorageObject, type StorageObjectItem } from '@/lib/storage/api'

import { attachStorageObject, type AttachFailureReason, type AttachProvenance } from './source-attach-client'
import type { NaturalSize } from './image-size'
import { classifySceneMedia, type SceneMediaKind, type SceneMediaRefusal } from './scene-media-policy'

/**
 * E1-J: "a Storage object the user picked (or that was uploaded or copied for this) becomes a source of the project".
 * One path for the scene background and the avatar insert: classify the file by D10, read the object once for its
 * checksum (the attach request binds object id AND checksum), bind it with the shared attach client and report the
 * picture size when Storage knows it (the layer is placed from it). Nothing is placed on the timeline here: the caller
 * builds its own typed edit from the returned source id once the working copy holds the source.
 */

export type PickedMedia = {
  storageObjectId: string
  mimeType: string | null
  name: string | null
  width: number | null
  height: number | null
}

export type PickAttachResult =
  | { status: 'ready'; sourceId: string; kind: SceneMediaKind; storageObjectId: string; naturalSize: NaturalSize | null }
  /** The file type cannot be shown in a scene (D10); nothing was attached. */
  | { status: 'refused'; reason: SceneMediaRefusal }
  /** The object (or its probe) is not ready yet: the caller tells the user to try again in a moment. */
  | { status: 'processing' }
  | { status: 'failed'; reason: AttachFailureReason | 'object_unavailable' }

export type PickAttachDeps = {
  getObject?: (input: { channelId: string; objectId: string }, options?: { signal?: AbortSignal }) => Promise<StorageObjectItem>
  attach?: typeof attachStorageObject
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Pixel size of a picked media: what the picker knew, else what Storage recorded (`metadata.width/height`). */
function naturalSizeOf(picked: PickedMedia, object: StorageObjectItem | null): NaturalSize | null {
  const width = positive(picked.width) ?? positive(object?.metadata['width'])
  const height = positive(picked.height) ?? positive(object?.metadata['height'])
  return width !== null && height !== null ? { width, height } : null
}

export async function attachPickedMedia(input: {
  channelId: string
  projectId: string
  picked: PickedMedia
  provenance?: AttachProvenance
  /** The working copy version the editor holds, read at every request. */
  baseRevision: () => number
  /** Re-reads the working copy once the source is in the document. */
  refresh: () => Promise<void>
  signal?: AbortSignal
  deps?: PickAttachDeps
}): Promise<PickAttachResult> {
  const { picked } = input
  // A file whose type the picker already knows is judged before any request; otherwise the object's own type decides.
  if (picked.mimeType) {
    const kind = classifySceneMedia({ mimeType: picked.mimeType, name: picked.name })
    if (!kind.ok) return { status: 'refused', reason: kind.reason }
  }

  const getObject = input.deps?.getObject ?? getStorageObject
  const attach = input.deps?.attach ?? attachStorageObject
  let object: StorageObjectItem
  try {
    object = await getObject({ channelId: input.channelId, objectId: picked.storageObjectId }, { signal: input.signal })
  } catch (error) {
    if (input.signal?.aborted) throw error
    return { status: 'failed', reason: 'object_unavailable' }
  }
  if (object.status === 'failed' || object.status === 'quarantined' || object.status === 'deleted') {
    return { status: 'failed', reason: 'object_unavailable' }
  }
  // The object's own type decides once it is known (a picker row may carry a generic one).
  const own = classifySceneMedia({ mimeType: object.mime_type, name: object.name })
  if (!own.ok) return { status: 'refused', reason: own.reason }
  if (!object.checksum_sha256) return { status: 'processing' }

  const result = await attach({
    projectId: input.projectId,
    storageObjectId: picked.storageObjectId,
    checksum: object.checksum_sha256,
    provenance: input.provenance ?? 'upload',
    baseRevision: input.baseRevision,
    refresh: input.refresh,
    ...(input.signal && { signal: input.signal }),
  })
  if (result.status === 'awaiting_probe') return { status: 'processing' }
  if (result.status === 'failed') return result.reason === 'not_ready' ? { status: 'processing' } : { status: 'failed', reason: result.reason }
  return { status: 'ready', sourceId: result.sourceId, kind: own.kind, storageObjectId: result.storageObjectId, naturalSize: naturalSizeOf(picked, object) }
}

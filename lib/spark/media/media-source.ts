import type { CompositionDocument } from '../composition-client'
import { attachStorageObject, type AttachFailureReason, type AttachOptions, type AttachResult } from '../source-attach-client'

import type { SparkMediaKind } from './media-files'

/**
 * E1-A: from a Storage object (a card of "My media", a fresh upload) to a SOURCE of the project that a typed edit can
 * place. An object already bound to the project (its id is in `source_media`) is used as is; otherwise it is attached
 * (`attachStorageObject`) and the working copy re-read. A video or audio file whose probe is not written yet resolves
 * `awaiting_probe` after the bounded wait: the card shows "Processing..." and the caller adds it once it is ready.
 */

type Body = Record<string, unknown>

/** The project source of a Storage object, if the working copy already holds it (a source awaiting its probe is not in it). */
export function sourceIdOfStorageObject(document: CompositionDocument | null, storageObjectId: string): string | null {
  const source = document?.source_media.find((candidate) => ((candidate as Body)['storage_object'] as Body | undefined)?.['storage_object_id'] === storageObjectId)
  return source?.source_id ?? null
}

/** What kind of media a project source is (from the document), or null. */
export function sourceKindOf(document: CompositionDocument | null, sourceId: string): SparkMediaKind | null {
  const source = document?.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const kind = (source?.['storage_object'] as Body | undefined)?.['media_kind']
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null
}

export type EnsureSourceResult =
  | { status: 'ready'; sourceId: string }
  | { status: 'awaiting_probe'; sourceId: string }
  | { status: 'failed'; reason: AttachFailureReason }

export async function ensureProjectSource(input: {
  projectId: string
  /** The working copy as it is NOW (re-read after every await). */
  document: () => CompositionDocument | null
  storageObjectId: string
  checksum: string
  baseRevision: () => number
  /** WP5a: gets the attach receipt when there is one (see `AttachOptions.refresh`). */
  refresh: AttachOptions['refresh']
  signal?: AbortSignal
  onAwaitingProbe?: () => void
  /** WP5a: the probe takes long (see `AttachOptions.onStillProcessing`). */
  onStillProcessing?: () => void
  attach?: (options: AttachOptions) => Promise<AttachResult>
  waitForProbe?: boolean
}): Promise<EnsureSourceResult> {
  const known = sourceIdOfStorageObject(input.document(), input.storageObjectId)
  if (known) return { status: 'ready', sourceId: known }
  const attach = input.attach ?? attachStorageObject
  const result = await attach({
    projectId: input.projectId,
    storageObjectId: input.storageObjectId,
    checksum: input.checksum,
    provenance: 'upload',
    baseRevision: input.baseRevision,
    refresh: input.refresh,
    ...(input.signal && { signal: input.signal }),
    ...(input.onAwaitingProbe && { onAwaitingProbe: input.onAwaitingProbe }),
    ...(input.onStillProcessing && { onStillProcessing: input.onStillProcessing }),
    ...(input.waitForProbe !== undefined && { waitForProbe: input.waitForProbe }),
  })
  if (result.status === 'failed') return { status: 'failed', reason: result.reason }
  return { status: result.status, sourceId: result.sourceId }
}

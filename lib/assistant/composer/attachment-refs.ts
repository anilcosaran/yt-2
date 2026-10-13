import { isOpaqueId, isSha256, storageObjectRefSchema, type StorageObjectRef } from './owner-refs'

/**
 * P03-01: a composer attachment travels as a Storage owner ref (`storage_object_id` + `checksum_sha256`), never as a
 * URL. The checksum comes from the Storage owner (the list item, the upload's own hash or a Storage read); it is never
 * invented. An item that is not a Storage object (e.g. a bare media URL) cannot be attached and is reported back.
 */

export type ComposerAttachmentSource = {
  objectId?: string | null
  channelId?: string | null
  kind: string
  name: string
  sizeBytes?: string | null
  metadata?: Record<string, unknown>
}

export type StorageChecksumReader = (input: { channelId: string; objectId: string }) => Promise<string | null>

export type ResolvedComposerAttachments<T extends ComposerAttachmentSource> = {
  refs: StorageObjectRef[]
  /** Items without a Storage object id, or whose Storage object has no checksum yet (not ready). */
  unresolved: T[]
}

const MEDIA_KINDS = new Set(['video', 'image', 'audio', 'document'])

export async function resolveComposerAttachmentRefs<T extends ComposerAttachmentSource>(
  attachments: readonly T[],
  options: { fallbackChannelId: string | null; readChecksum: StorageChecksumReader },
): Promise<ResolvedComposerAttachments<T>> {
  const refs: StorageObjectRef[] = []
  const unresolved: T[] = []
  for (const attachment of attachments) {
    const objectId = attachment.objectId?.trim() ?? ''
    if (!objectId || !isOpaqueId(objectId)) {
      unresolved.push(attachment)
      continue
    }
    let checksum = readKnownChecksum(attachment.metadata)
    const channelId = attachment.channelId ?? options.fallbackChannelId
    if (!checksum && channelId) {
      try {
        const value = await options.readChecksum({ channelId, objectId })
        checksum = value && isSha256(value) ? value : null
      } catch {
        checksum = null
      }
    }
    if (!checksum) {
      unresolved.push(attachment)
      continue
    }
    const byteSize = Number.parseInt(attachment.sizeBytes ?? '', 10)
    const parsed = storageObjectRefSchema.safeParse({
      ref_type: 'storage_object',
      storage_object_id: objectId,
      checksum_sha256: checksum,
      media_kind: MEDIA_KINDS.has(attachment.kind) ? attachment.kind : 'other',
      ...(Number.isSafeInteger(byteSize) && byteSize >= 0 ? { byte_size: byteSize } : {}),
    })
    if (parsed.success) refs.push(parsed.data)
    else unresolved.push(attachment)
  }
  return { refs, unresolved }
}

/** Checksum carried on the attachment by its Storage source (list item or upload fingerprint). */
export function readKnownChecksum(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.['checksum_sha256']
  return typeof value === 'string' && isSha256(value) ? value : null
}

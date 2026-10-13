import { sparkIntentForChatMessage, type ChatResultArtifactRef, type SparkEntryDescriptor } from './spark-entry'

/**
 * QA-090 Chat → Spark candidate card: which results of one chat message open in Spark and in which order. The card
 * starts with every importable result selected in the message's order (the one-click "Open in Spark" set); a click
 * unselects a result, a second click appends it at the end, so the order numbers are the order the project gets.
 * The server entry (P03-11/P03-12) re-authorizes every ref; nothing here is kept in the browser.
 */

const IMPORTABLE_KINDS = new Set<ChatResultArtifactRef['kind']>(['video', 'image', 'audio'])

/** The results Spark can import (video, image, audio), in the message's order. */
export function candidateRefs(refs: readonly ChatResultArtifactRef[]): ChatResultArtifactRef[] {
  return refs.filter((ref) => IMPORTABLE_KINDS.has(ref.kind))
}

export function initialCandidateOrder(refs: readonly ChatResultArtifactRef[]): string[] {
  return refs.map((ref) => ref.storageObjectId)
}

/** Unselects a selected result, or appends an unselected one after the others. */
export function toggleCandidate(order: readonly string[], storageObjectId: string): string[] {
  return order.includes(storageObjectId) ? order.filter((id) => id !== storageObjectId) : [...order, storageObjectId]
}

/** The selected refs in the chosen order (unknown ids are dropped). */
export function orderedCandidates(refs: readonly ChatResultArtifactRef[], order: readonly string[]): ChatResultArtifactRef[] {
  const byId = new Map(refs.map((ref) => [ref.storageObjectId, ref]))
  return order.flatMap((id) => {
    const ref = byId.get(id)
    return ref ? [ref] : []
  })
}

/**
 * K44: the whole set in the message's order is the same request as the one-click open (same entry, same project).
 * Another subset or order is a deliberate other project, so its intent names the exact ordered selection.
 */
export async function sparkIntentForChatSelection(
  messageId: string,
  refs: readonly ChatResultArtifactRef[],
  order: readonly string[],
): Promise<string> {
  const all = initialCandidateOrder(refs)
  if (order.length === all.length && order.every((id, index) => id === all[index])) return sparkIntentForChatMessage(messageId)
  const bytes = new TextEncoder().encode(`chat-result:${messageId}:${order.join(',')}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `chat-${hex.slice(0, 40)}`
}

export type CandidateFailureReason = 'gone' | 'notShared' | 'otherChannel' | 'notReady' | 'changed' | 'generic'

/** The label of an item's `failure_code` (P03-11/P03-12 entry descriptor); unknown codes get the generic label. */
export function candidateFailureReason(code: string | null): CandidateFailureReason {
  switch (code) {
    case 'artifact_not_found':
    case 'source_not_found':
      return 'gone'
    case 'source_share_not_permitted':
      return 'notShared'
    case 'source_not_in_project_channel':
      return 'otherChannel'
    case 'source_not_ready':
    case 'attach_unavailable':
      return 'notReady'
    case 'source_changed':
      return 'changed'
    default:
      return 'generic'
  }
}

/** The results the entry could not add, with their reason, in the chosen order. */
export function candidateFailures(
  descriptor: SparkEntryDescriptor,
  selected: readonly ChatResultArtifactRef[],
): Array<{ ref: ChatResultArtifactRef; reason: CandidateFailureReason }> {
  const failed = new Map(
    descriptor.items.filter((item) => item.state === 'failed').map((item) => [item.storage_object_id, item.failure_code]),
  )
  return selected.flatMap((ref) =>
    failed.has(ref.storageObjectId) ? [{ ref, reason: candidateFailureReason(failed.get(ref.storageObjectId) ?? null) }] : [],
  )
}

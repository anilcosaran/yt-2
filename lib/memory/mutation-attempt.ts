import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type MemoryMutationIntent =
  | { action: 'create'; channelId: string; documentType: string; content: string; kind: string }
  | { action: 'clear'; channelId: string }
  | { action: 'query'; channelId: string; query: string; topK?: number }

export const memoryMutationAttemptStore = new ClientMutationAttemptStore<MemoryMutationIntent>({
  storageKey: 'youtorch:memory-mutation-attempts:v1',
  isPayload: (value): value is MemoryMutationIntent => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<MemoryMutationIntent>
    if (typeof candidate.channelId !== 'string') return false
    if (candidate.action === 'clear') return true
    if (candidate.action === 'query') {
      return typeof candidate.query === 'string'
        && (candidate.topK === undefined || typeof candidate.topK === 'number')
    }
    return candidate.action === 'create'
      && typeof candidate.documentType === 'string'
      && typeof candidate.content === 'string'
      && typeof candidate.kind === 'string'
  },
})

export function getOrCreateMemoryMutationAttempt(
  payload: MemoryMutationIntent,
  createIdempotencyKey: () => string,
): ClientMutationAttempt<MemoryMutationIntent> {
  const scope = `${payload.action}:${payload.channelId}`
  const fingerprint = stableClientFingerprint(payload)
  return memoryMutationAttemptStore.find(scope, fingerprint)
    ?? memoryMutationAttemptStore.save({
      scope,
      fingerprint,
      idempotencyKey: createIdempotencyKey(),
      payload,
    })
}

export function clearMemoryMutationAttempt(attempt: ClientMutationAttempt<MemoryMutationIntent>) {
  memoryMutationAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
}

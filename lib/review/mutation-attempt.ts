import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type ReviewMutationIntent =
  | { action: 'decision'; requestId: string; decision: string; comment: string }
  | { action: 'reply'; requestId: string; body: string }

export const reviewMutationAttemptStore = new ClientMutationAttemptStore<ReviewMutationIntent>({
  storageKey: 'youtorch:review-mutation-attempts:v1',
  isPayload: (value): value is ReviewMutationIntent => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ReviewMutationIntent>
    if (typeof candidate.requestId !== 'string') return false
    if (candidate.action === 'reply') return typeof candidate.body === 'string'
    return candidate.action === 'decision'
      && typeof candidate.decision === 'string'
      && typeof candidate.comment === 'string'
  },
})

export function getOrCreateReviewMutationAttempt(
  payload: ReviewMutationIntent,
  createKey: () => string,
): ClientMutationAttempt<ReviewMutationIntent> {
  const scope = `${payload.action}:${payload.requestId}`
  const fingerprint = stableClientFingerprint(payload)
  return reviewMutationAttemptStore.find(scope, fingerprint)
    ?? reviewMutationAttemptStore.save({ scope, fingerprint, idempotencyKey: createKey(), payload })
}

export function clearReviewMutationAttempt(attempt: ClientMutationAttempt<ReviewMutationIntent>) {
  reviewMutationAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
}

import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type TranscriptLaunchIntent = {
  channelId: string
  sourceObjectId: string
  modelId: string
  replacementArtifactId?: string
}

export const transcriptLaunchAttemptStore = new ClientMutationAttemptStore<TranscriptLaunchIntent>({
  storageKey: 'youtorch:transcript-launch-attempts:v1',
  isPayload: (value): value is TranscriptLaunchIntent => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TranscriptLaunchIntent>
    return typeof candidate.channelId === 'string'
      && typeof candidate.sourceObjectId === 'string'
      && typeof candidate.modelId === 'string'
      && (candidate.replacementArtifactId === undefined || typeof candidate.replacementArtifactId === 'string')
  },
})

export function getOrCreateTranscriptLaunchAttempt(
  payload: TranscriptLaunchIntent,
  createIdempotencyKey: () => string,
): ClientMutationAttempt<TranscriptLaunchIntent> {
  const scope = transcriptLaunchScope(payload)
  const fingerprint = stableClientFingerprint(payload)
  return transcriptLaunchAttemptStore.find(scope, fingerprint)
    ?? transcriptLaunchAttemptStore.save({
      scope,
      fingerprint,
      idempotencyKey: createIdempotencyKey(),
      payload,
    })
}

export function clearTranscriptLaunchAttempt(attempt: ClientMutationAttempt<TranscriptLaunchIntent>) {
  transcriptLaunchAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
}

function transcriptLaunchScope(payload: TranscriptLaunchIntent) {
  return `${payload.channelId}:${payload.sourceObjectId}`
}

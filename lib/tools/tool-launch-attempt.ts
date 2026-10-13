import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type ToolLaunchIntent = {
  channelId: string
  toolId: string
  nodeType: string
  params: Record<string, unknown>
  selfAttestationAccepted: boolean
}

export const toolLaunchAttemptStore = new ClientMutationAttemptStore<ToolLaunchIntent>({
  storageKey: 'youtorch:tool-launch-attempts:v1',
  isPayload: (value): value is ToolLaunchIntent => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ToolLaunchIntent>
    return typeof candidate.channelId === 'string'
      && typeof candidate.toolId === 'string'
      && typeof candidate.nodeType === 'string'
      && Boolean(candidate.params && typeof candidate.params === 'object' && !Array.isArray(candidate.params))
      && typeof candidate.selfAttestationAccepted === 'boolean'
  },
})

export function getOrCreateToolLaunchAttempt(
  payload: ToolLaunchIntent,
  createIdempotencyKey: () => string,
): ClientMutationAttempt<ToolLaunchIntent> {
  const scope = `${payload.channelId}:${payload.toolId}`
  const fingerprint = stableClientFingerprint(payload)
  return toolLaunchAttemptStore.find(scope, fingerprint)
    ?? toolLaunchAttemptStore.save({
      scope,
      fingerprint,
      idempotencyKey: createIdempotencyKey(),
      payload,
    })
}

export function clearToolLaunchAttempt(attempt: ClientMutationAttempt<ToolLaunchIntent>) {
  toolLaunchAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
}

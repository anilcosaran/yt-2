import { isAuthClientError } from '@/lib/auth/errors'
import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientKeyValueStorage,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type VoicePreviewCancelOutcome = 'cancelled' | 'failed' | 'completed' | 'not_supported' | 'unknown'

export type VoicePreviewCancelResult = {
  cleared: boolean
  outcome: VoicePreviewCancelOutcome
  status?: string
}

export type VoicePreviewOperation = {
  channelId: string
  modelId: string
  profileId: string
  text: string
  language: string
  outputFormat: 'mp3'
}

export type VoicePreviewAttemptPayload = VoicePreviewOperation & { agentId?: string }
export type VoicePreviewAttempt = ClientMutationAttempt<VoicePreviewAttemptPayload>

function isVoicePreviewAttemptPayload(value: unknown): value is VoicePreviewAttemptPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<VoicePreviewAttemptPayload>
  return typeof payload.channelId === 'string' && payload.channelId.length > 0
    && typeof payload.modelId === 'string' && payload.modelId.length > 0
    && typeof payload.profileId === 'string' && payload.profileId.length > 0
    && typeof payload.text === 'string' && payload.text.length > 0
    && typeof payload.language === 'string' && payload.language.length > 0
    && payload.outputFormat === 'mp3'
    && (payload.agentId === undefined || typeof payload.agentId === 'string')
}

export function createVoicePreviewAttemptStore(storage?: ClientKeyValueStorage | null) {
  return new ClientMutationAttemptStore<VoicePreviewAttemptPayload>({
    storageKey: 'youtorch:voice:preview-attempts:v1',
    isPayload: isVoicePreviewAttemptPayload,
    ttlMs: 24 * 60 * 60 * 1000,
    ...(storage === undefined ? {} : { storage: storage ?? null }),
  })
}

export const voicePreviewAttemptStore = createVoicePreviewAttemptStore()

export function voicePreviewAttemptScope(channelId: string) {
  return `voice-preview:${stableClientFingerprint({ channelId })}`
}

export function voicePreviewOperationFingerprint(operation: VoicePreviewOperation) {
  return stableClientFingerprint(operation)
}

export function saveVoicePreviewAgentId(
  attempt: VoicePreviewAttempt,
  agentId: string,
  store = voicePreviewAttemptStore,
) {
  return store.save({
    scope: attempt.scope,
    fingerprint: attempt.fingerprint,
    idempotencyKey: attempt.idempotencyKey,
    payload: { ...attempt.payload, agentId },
  })
}

export function clearVoicePreviewAttempt(
  attempt: VoicePreviewAttempt,
  store = voicePreviewAttemptStore,
) {
  store.clear(attempt.scope, attempt.idempotencyKey)
}

export async function cancelVoicePreviewAgentAttempt(input: {
  attempt: VoicePreviewAttempt | null
  agentId: string
  cancelAgent: (agentId: string) => Promise<unknown>
  store?: ClientMutationAttemptStore<VoicePreviewAttemptPayload>
}): Promise<VoicePreviewCancelResult> {
  try {
    const result = await input.cancelAgent(input.agentId)
    const status = readVoicePreviewCancelStatus(result)
    if (status === 'completed' || status === 'success' || status === 'succeeded') {
      return { cleared: false, outcome: 'completed', status }
    }
    if (!['cancelled', 'canceled', 'failed', 'billing_failed'].includes(status)) {
      return { cleared: false, outcome: 'unknown', status: status || undefined }
    }
    if (input.attempt?.payload.agentId === input.agentId) {
      clearVoicePreviewAttempt(input.attempt, input.store ?? voicePreviewAttemptStore)
    }
    return { cleared: true, outcome: status === 'failed' || status === 'billing_failed' ? 'failed' : 'cancelled', status }
  } catch (error) {
    if (isAuthClientError(error) && (error.status === 403 || error.code === 'cancel_not_supported')) {
      return { cleared: false, outcome: 'not_supported' }
    }
    return { cleared: false, outcome: 'unknown' }
  }
}

function readVoicePreviewCancelStatus(result: unknown) {
  if (!result || typeof result !== 'object') return ''
  const status = (result as { status?: unknown }).status
  return typeof status === 'string' ? status.trim().toLowerCase() : ''
}

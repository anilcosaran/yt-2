import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientKeyValueStorage,
  type ClientMutationAttempt,
} from '@/lib/idempotency/client-mutation-control'

export type ManualTopUpAttemptPayload = {
  packageId: string
  amountCredits: number
  requestId?: string
}

export type ManualTopUpAttempt = ClientMutationAttempt<ManualTopUpAttemptPayload>

function isManualTopUpPayload(value: unknown): value is ManualTopUpAttemptPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<ManualTopUpAttemptPayload>
  return typeof payload.packageId === 'string'
    && payload.packageId.length > 0
    && typeof payload.amountCredits === 'number'
    && Number.isFinite(payload.amountCredits)
    && (payload.requestId === undefined || typeof payload.requestId === 'string')
}

export function createManualTopUpAttemptStore(storage?: ClientKeyValueStorage | null) {
  return new ClientMutationAttemptStore<ManualTopUpAttemptPayload>({
    storageKey: 'youtorch:billing:manual-top-up-attempts:v1',
    isPayload: isManualTopUpPayload,
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    ...(storage === undefined ? {} : { storage: storage ?? null }),
  })
}

export const manualTopUpAttemptStore = createManualTopUpAttemptStore()

export function getManualTopUpScope(tenantEmail: string) {
  return `manual-top-up:${stableClientFingerprint(tenantEmail.trim().toLowerCase())}`
}

export function getOrCreateManualTopUpAttempt(input: {
  store?: ClientMutationAttemptStore<ManualTopUpAttemptPayload>
  scope: string
  packageId: string
  amountCredits: number
  createIdempotencyKey: () => string
}) {
  const store = input.store ?? manualTopUpAttemptStore
  const existing = store.findByScope(input.scope)
  if (existing) return existing
  return store.save({
    scope: input.scope,
    fingerprint: stableClientFingerprint({ packageId: input.packageId }),
    idempotencyKey: input.createIdempotencyKey(),
    payload: {
      packageId: input.packageId,
      amountCredits: input.amountCredits,
    },
  })
}

export function saveManualTopUpRequestId(
  attempt: ManualTopUpAttempt,
  requestId: string,
  store = manualTopUpAttemptStore,
) {
  return store.save({
    scope: attempt.scope,
    fingerprint: attempt.fingerprint,
    idempotencyKey: attempt.idempotencyKey,
    payload: { ...attempt.payload, requestId },
  })
}

export function clearManualTopUpAttempt(
  attempt: ManualTopUpAttempt,
  store = manualTopUpAttemptStore,
) {
  store.clear(attempt.scope, attempt.idempotencyKey)
}

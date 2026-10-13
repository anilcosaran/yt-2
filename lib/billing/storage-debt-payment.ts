import { isAuthClientError } from '@/lib/auth/errors'
import { payStorageDebt } from '@/lib/billing/api'
import {
  ClientMutationAttemptStore,
  isAmbiguousMutationError,
  stableClientFingerprint,
  type ClientKeyValueStorage,
} from '@/lib/idempotency/client-mutation-control'

const STORAGE_KEY = 'youtorch:storage-debt-payment-attempts:v1'

export type StorageDebtPaymentInput = {
  debt_id?: string
  amount_credits?: number
}

type StorageDebtPaymentAttemptPayload = {
  clientMutationScope: string
  operationScope: string
  input: StorageDebtPaymentInput
}

export interface ClientMutationLockManager {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T>,
  ): Promise<T>
}

type StorageDebtPaymentDependencies = {
  storage?: ClientKeyValueStorage | null
  locks?: ClientMutationLockManager | null
  request?: typeof payStorageDebt
  randomUUID?: () => string
}

export async function payStorageDebtWithStableOperation(
  clientMutationScope: string,
  operationScope: string,
  rawInput: StorageDebtPaymentInput,
  dependencies: StorageDebtPaymentDependencies = {},
): Promise<Awaited<ReturnType<typeof payStorageDebt>>> {
  const input = normalizeInput(rawInput)
  const normalizedClientMutationScope = clientMutationScope.trim()
  const expectedOperationScope = input.debt_id ? `debt:${input.debt_id}` : 'debt:all'
  if (
    !/^tenant-scope:v1:[A-Za-z0-9_-]{43}$/.test(normalizedClientMutationScope)
    || operationScope !== expectedOperationScope
  ) {
    throw new Error('Storage debt payment operation scope is invalid')
  }

  const scope = `storage-debt-payment:${normalizedClientMutationScope}:${operationScope}`
  const fingerprint = stableClientFingerprint({
    client_mutation_scope: normalizedClientMutationScope,
    operation_scope: operationScope,
    input,
  })
  const locks = Object.prototype.hasOwnProperty.call(dependencies, 'locks')
    ? dependencies.locks
    : resolveBrowserLocks()
  if (!locks) throw new Error('Exclusive client mutation locking is unavailable')

  return locks.request(
    `youtorch:storage-debt-payment:${stableClientFingerprint(scope)}`,
    { mode: 'exclusive' },
    async () => {
      const storage = Object.prototype.hasOwnProperty.call(dependencies, 'storage')
        ? dependencies.storage ?? null
        : resolveBrowserStorage()
      const store = createStorageDebtPaymentAttemptStore(storage, scope)
      const existing = store.findByScope(scope)
      if (existing && existing.fingerprint !== fingerprint) {
        throw new Error('A different storage debt payment is awaiting reconciliation')
      }
      if (existing) {
        assertStoredAttempt(
          existing,
          normalizedClientMutationScope,
          operationScope,
          input,
          fingerprint,
        )
      }

      const attempt = existing ?? store.save({
        scope,
        fingerprint,
        idempotencyKey: `storage-debt-ui:${createRandomUUID(dependencies)}`,
        payload: {
          clientMutationScope: normalizedClientMutationScope,
          operationScope,
          input,
        },
      })
      const request = dependencies.request ?? payStorageDebt

      try {
        const result = await request({ ...input, idempotency_key: attempt.idempotencyKey })
        store.clear(scope, attempt.idempotencyKey)
        return result
      } catch (error) {
        if (!shouldRetainAttempt(error)) store.clear(scope, attempt.idempotencyKey)
        throw error
      }
    },
  )
}

export function createStorageDebtPaymentAttemptStore(
  storage: ClientKeyValueStorage | null,
  scope: string,
) {
  return new ClientMutationAttemptStore<StorageDebtPaymentAttemptPayload>({
    storageKey: `${STORAGE_KEY}:${scope}`,
    storage,
    strictStorage: true,
    ttlMs: Number.POSITIVE_INFINITY,
    isPayload: isStorageDebtPaymentAttemptPayload,
  })
}

function normalizeInput(input: StorageDebtPaymentInput): StorageDebtPaymentInput {
  const debtId = input.debt_id?.trim()
  if (input.debt_id !== undefined && !debtId) {
    throw new Error('Storage debt id is invalid')
  }
  if (
    input.amount_credits !== undefined
    && (!Number.isFinite(input.amount_credits) || input.amount_credits <= 0)
  ) {
    throw new Error('Storage debt payment amount is invalid')
  }
  return {
    ...(debtId ? { debt_id: debtId } : {}),
    ...(input.amount_credits !== undefined ? { amount_credits: input.amount_credits } : {}),
  }
}

function assertStoredAttempt(
  attempt: { fingerprint: string; idempotencyKey: string; payload: StorageDebtPaymentAttemptPayload },
  clientMutationScope: string,
  operationScope: string,
  input: StorageDebtPaymentInput,
  fingerprint: string,
) {
  const expectedFingerprint = stableClientFingerprint({
    client_mutation_scope: attempt.payload.clientMutationScope,
    operation_scope: attempt.payload.operationScope,
    input: attempt.payload.input,
  })
  if (
    attempt.payload.clientMutationScope !== clientMutationScope
    || attempt.payload.operationScope !== operationScope
    || expectedFingerprint !== fingerprint
    || attempt.fingerprint !== expectedFingerprint
    || !/^storage-debt-ui:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt.idempotencyKey)
  ) {
    throw new Error('Stored storage debt payment attempt is invalid')
  }
  const normalizedStoredInput = normalizeInput(attempt.payload.input)
  if (stableClientFingerprint(normalizedStoredInput) !== stableClientFingerprint(input)) {
    throw new Error('Stored storage debt payment attempt does not match the request')
  }
}

function shouldRetainAttempt(error: unknown) {
  return isAmbiguousMutationError(error)
    || (isAuthClientError(error) && (error.status === 409 || error.status === 429))
}

function isStorageDebtPaymentAttemptPayload(value: unknown): value is StorageDebtPaymentAttemptPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StorageDebtPaymentAttemptPayload>
  if (
    typeof candidate.clientMutationScope !== 'string'
    || !/^tenant-scope:v1:[A-Za-z0-9_-]{43}$/.test(candidate.clientMutationScope)
    || typeof candidate.operationScope !== 'string'
    || !candidate.input
    || typeof candidate.input !== 'object'
  ) return false
  try {
    normalizeInput(candidate.input)
    return true
  } catch {
    return false
  }
}

function createRandomUUID(dependencies: StorageDebtPaymentDependencies) {
  const randomUUID = dependencies.randomUUID ?? globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (!randomUUID) throw new Error('Secure client mutation key generation is unavailable')
  return randomUUID()
}

function resolveBrowserStorage(): ClientKeyValueStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function resolveBrowserLocks(): ClientMutationLockManager | null {
  if (typeof navigator === 'undefined' || !navigator.locks) return null
  return navigator.locks as unknown as ClientMutationLockManager
}

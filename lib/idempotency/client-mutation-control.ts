import { isAuthClientError } from '@/lib/auth/errors'

export interface ClientKeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export type ClientMutationAttempt<TPayload> = {
  scope: string
  fingerprint: string
  idempotencyKey: string
  payload: TPayload
  createdAt: number
}

type ClientMutationAttemptStoreOptions<TPayload> = {
  storageKey: string
  isPayload: (value: unknown) => value is TPayload
  ttlMs?: number
  storage?: ClientKeyValueStorage | null
  strictStorage?: boolean
  now?: () => number
}

const DEFAULT_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000

export class ClientMutationAttemptStore<TPayload> {
  private memory: Array<ClientMutationAttempt<TPayload>> = []
  private readonly hasExplicitStorage: boolean

  constructor(private readonly options: ClientMutationAttemptStoreOptions<TPayload>) {
    this.hasExplicitStorage = Object.prototype.hasOwnProperty.call(options, 'storage')
  }

  find(scope: string, fingerprint: string): ClientMutationAttempt<TPayload> | null {
    const attempts = this.readValidAttempts()
    return attempts.find((attempt) => attempt.scope === scope && attempt.fingerprint === fingerprint) ?? null
  }

  findByScope(scope: string): ClientMutationAttempt<TPayload> | null {
    return this.readValidAttempts().find((attempt) => attempt.scope === scope) ?? null
  }

  findLatest(scope: string): ClientMutationAttempt<TPayload> | null {
    const attempts = this.readValidAttempts()
      .filter((attempt) => attempt.scope === scope)
      .reverse()
      .sort((left, right) => right.createdAt - left.createdAt)
    return attempts[0] ?? null
  }

  save(input: Omit<ClientMutationAttempt<TPayload>, 'createdAt'>): ClientMutationAttempt<TPayload> {
    const attempt = { ...input, createdAt: this.now() }
    // A user can intentionally prepare a second payload while the outcome of an
    // earlier request is still unknown. Keep both intents; only replace the
    // exact scope + payload fingerprint pair.
    const attempts = this.readValidAttempts().filter((item) => (
      item.scope !== input.scope || item.fingerprint !== input.fingerprint
    ))
    attempts.push(attempt)
    this.writeAttempts(attempts)
    return attempt
  }

  clear(scope: string, idempotencyKey: string) {
    const attempts = this.readValidAttempts()
    const next = attempts.filter((attempt) => (
      attempt.scope !== scope || attempt.idempotencyKey !== idempotencyKey
    ))
    if (next.length !== attempts.length) this.writeAttempts(next)
  }

  clearByIdempotencyKey(idempotencyKey: string) {
    const attempts = this.readValidAttempts()
    const next = attempts.filter((attempt) => attempt.idempotencyKey !== idempotencyKey)
    if (next.length !== attempts.length) this.writeAttempts(next)
  }

  clearAll() {
    this.memory = []
    const storage = this.resolveStorage()
    if (!storage) return
    try {
      if (storage.removeItem) storage.removeItem(this.options.storageKey)
      else storage.setItem(this.options.storageKey, JSON.stringify({ version: 1, attempts: [] }))
    } catch {
      // In-memory state is already cleared.
    }
  }

  private readValidAttempts() {
    const storage = this.resolveStorage()
    let attempts = this.memory
    if (storage) {
      try {
        const raw = storage.getItem(this.options.storageKey)
        const parsed = raw ? JSON.parse(raw) : null
        if (
          raw
          && (!parsed || parsed.version !== 1 || !Array.isArray(parsed.attempts))
        ) {
          throw new Error('Client mutation attempt storage is corrupt')
        }
        if (
          this.options.strictStorage
          && Array.isArray(parsed?.attempts)
          && parsed.attempts.some((value: unknown) => !this.isAttempt(value))
        ) {
          throw new Error('Client mutation attempt storage contains an invalid attempt')
        }
        attempts = Array.isArray(parsed?.attempts)
          ? parsed.attempts.filter((value: unknown): value is ClientMutationAttempt<TPayload> => this.isAttempt(value))
          : []
      } catch (error) {
        if (this.options.strictStorage) throw storageUnavailableError(error)
        attempts = this.memory
      }
    }

    const oldestAllowed = this.now() - (this.options.ttlMs ?? DEFAULT_ATTEMPT_TTL_MS)
    const valid = attempts.filter((attempt) => attempt.createdAt >= oldestAllowed)
    if (valid.length !== attempts.length) this.writeAttempts(valid)
    return valid
  }

  private writeAttempts(attempts: Array<ClientMutationAttempt<TPayload>>) {
    const storage = this.resolveStorage()
    if (!storage) {
      this.memory = attempts
      return
    }
    try {
      const serialized = JSON.stringify({ version: 1, attempts })
      storage.setItem(this.options.storageKey, serialized)
      if (this.options.strictStorage && storage.getItem(this.options.storageKey) !== serialized) {
        throw new Error('Client mutation attempt write verification failed')
      }
      this.memory = attempts
    } catch (error) {
      if (this.options.strictStorage) throw storageUnavailableError(error)
      this.memory = attempts
      // In-memory protection remains active when session storage is unavailable.
    }
  }

  private resolveStorage() {
    if (this.hasExplicitStorage) {
      if (this.options.strictStorage && !this.options.storage) throw storageUnavailableError()
      return this.options.storage ?? null
    }
    if (typeof window === 'undefined') {
      if (this.options.strictStorage) throw storageUnavailableError()
      return null
    }
    try {
      return window.sessionStorage
    } catch (error) {
      if (this.options.strictStorage) throw storageUnavailableError(error)
      return null
    }
  }

  private isAttempt(value: unknown): value is ClientMutationAttempt<TPayload> {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ClientMutationAttempt<unknown>>
    return typeof candidate.scope === 'string'
      && typeof candidate.fingerprint === 'string'
      && typeof candidate.idempotencyKey === 'string'
      && typeof candidate.createdAt === 'number'
      && this.options.isPayload(candidate.payload)
  }

  private now() {
    return this.options.now?.() ?? Date.now()
  }
}

function storageUnavailableError(cause?: unknown) {
  return new Error('Durable client mutation storage is unavailable', { cause })
}

type LatestValueJob<TValue> = {
  value: TValue
  execute: (value: TValue) => Promise<void>
  onError?: (error: unknown, value: TValue) => void
}

type LatestValueQueueEntry<TValue> = {
  activeValue?: TValue
  lastCompletedValue?: TValue
  pending?: LatestValueJob<TValue>
  draining: boolean
}

export class LatestValueRequestQueue<TKey, TValue> {
  private readonly entries = new Map<TKey, LatestValueQueueEntry<TValue>>()

  enqueue(
    key: TKey,
    value: TValue,
    execute: (value: TValue) => Promise<void>,
    onError?: (error: unknown, value: TValue) => void,
  ) {
    const entry = this.entries.get(key) ?? { draining: false }
    if (Object.is(entry.pending?.value, value)) return
    if (!entry.pending && Object.is(entry.activeValue, value)) return
    if (!entry.draining && Object.is(entry.lastCompletedValue, value)) return

    entry.pending = { value, execute, onError }
    this.entries.set(key, entry)
    if (entry.draining) return

    entry.draining = true
    void this.drain(key, entry)
  }

  isBusy(key: TKey) {
    return this.entries.get(key)?.draining ?? false
  }

  private async drain(key: TKey, entry: LatestValueQueueEntry<TValue>) {
    while (entry.pending) {
      const job = entry.pending
      entry.pending = undefined

      if (Object.is(entry.lastCompletedValue, job.value)) continue
      entry.activeValue = job.value
      try {
        await job.execute(job.value)
        entry.lastCompletedValue = job.value
      } catch (error) {
        job.onError?.(error, job.value)
      } finally {
        entry.activeValue = undefined
      }
    }

    entry.draining = false
    this.entries.delete(key)
  }
}

export function stableClientFingerprint(value: unknown) {
  const serialized = JSON.stringify(canonicalize(value))
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `v1:${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function isAmbiguousMutationError(error: unknown) {
  if (isAuthClientError(error)) {
    if (error.status === 408) return true
    return error.status >= 500
  }
  if (error instanceof DOMException && error.name === 'AbortError') return true
  return true
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (value instanceof Date) return value.toISOString()
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    if (record[key] === undefined) continue
    normalized[key] = canonicalize(record[key])
  }
  return normalized
}

const STORAGE_KEY = 'youtorch:storage:tus-resume:v1'
const MAX_ENTRIES = 20

export type TusResumeFile = {
  name: string
  size: number
  type: string
  lastModified: number
}

export type TusResumeEntry = {
  sessionId: string
  uploadUrl: string
  expiresAt: string
  file: TusResumeFile
  updatedAt: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function getTusResumeEntry(input: {
  storage: StorageLike | null
  sessionId: string
  file: TusResumeFile
  now?: number
}): TusResumeEntry | null {
  const now = input.now ?? Date.now()
  const entries = readEntries(input.storage).filter((entry) => !isExpired(entry, now))
  persistEntries(input.storage, entries)
  return entries.find((entry) => (
    entry.sessionId === input.sessionId
    && sameFile(entry.file, input.file)
  )) ?? null
}

export function setTusResumeEntry(input: {
  storage: StorageLike | null
  entry: Omit<TusResumeEntry, 'updatedAt'>
  now?: number
}) {
  if (!input.storage) return
  const now = input.now ?? Date.now()
  const entries = readEntries(input.storage)
    .filter((entry) => entry.sessionId !== input.entry.sessionId && !isExpired(entry, now))
  entries.push({ ...input.entry, updatedAt: now })
  entries.sort((left, right) => right.updatedAt - left.updatedAt)
  persistEntries(input.storage, entries.slice(0, MAX_ENTRIES))
}

export function removeTusResumeEntry(storage: StorageLike | null, sessionId: string) {
  if (!storage) return
  const entries = readEntries(storage).filter((entry) => entry.sessionId !== sessionId)
  persistEntries(storage, entries)
}

export function toTusResumeFile(file: File): TusResumeFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  }
}

function sameFile(left: TusResumeFile, right: TusResumeFile) {
  return left.name === right.name
    && left.size === right.size
    && left.type === right.type
    && left.lastModified === right.lastModified
}

function isExpired(entry: TusResumeEntry, now: number) {
  const expiresAt = Date.parse(entry.expiresAt)
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

function readEntries(storage: StorageLike | null): TusResumeEntry[] {
  if (!storage) return []
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isTusResumeEntry)
  } catch {
    return []
  }
}

function persistEntries(storage: StorageLike | null, entries: TusResumeEntry[]) {
  if (!storage) return
  try {
    if (entries.length === 0) storage.removeItem(STORAGE_KEY)
    else storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Resume persistence is best-effort; uploads must still work without browser storage.
  }
}

function isTusResumeEntry(value: unknown): value is TusResumeEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<TusResumeEntry>
  return typeof entry.sessionId === 'string'
    && typeof entry.uploadUrl === 'string'
    && typeof entry.expiresAt === 'string'
    && typeof entry.updatedAt === 'number'
    && Boolean(entry.file)
    && typeof entry.file?.name === 'string'
    && typeof entry.file?.size === 'number'
    && typeof entry.file?.type === 'string'
    && typeof entry.file?.lastModified === 'number'
}

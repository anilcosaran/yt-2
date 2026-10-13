export const AVATAR_DEFAULT_NAME_PREFIX = 'avatar-'

export function occupiedDisplayNameSet(existingNames: Iterable<string>): Set<string> {
  return new Set(
    [...existingNames]
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function nextAvatarDisplayName(existingNames: Iterable<string>): string {
  const used = occupiedDisplayNameSet(existingNames)
  let index = 1
  while (used.has(`${AVATAR_DEFAULT_NAME_PREFIX}${index}`)) {
    index += 1
    if (index > 10_000) {
      const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)
      return `${AVATAR_DEFAULT_NAME_PREFIX}${suffix}`
    }
  }
  return `${AVATAR_DEFAULT_NAME_PREFIX}${index}`
}

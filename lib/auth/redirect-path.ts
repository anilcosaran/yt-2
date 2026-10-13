export function resolveSafeNextPath(nextPath: string | null) {
  const path = nextPath?.trim()
  if (!path) return '/'
  if (isUnsafeInternalPath(path)) return '/'

  const decodedPath = decodePathForSafety(path)
  if (!decodedPath || isUnsafeInternalPath(decodedPath)) return '/'

  try {
    const parsed = new URL(path, 'https://app.youtorch.local')
    if (parsed.origin !== 'https://app.youtorch.local') return '/'
  } catch {
    return '/'
  }

  return path
}

function decodePathForSafety(path: string) {
  let current = path

  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) return decoded
      current = decoded
    } catch {
      return null
    }
  }

  return current
}

function isUnsafeInternalPath(path: string) {
  return (
    !path.startsWith('/')
    || path.startsWith('//')
    || path.startsWith('/\\')
    || path.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(path)
  )
}

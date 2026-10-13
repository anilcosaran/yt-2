const STORAGE_PROXY_UPLOAD_PATH = /^\/api\/v1\/storage\/channels\/[^/]+\/uploads\/[^/]+\/content$/
const BUNNY_TUS_ORIGIN = 'https://video.bunnycdn.com'
const BUNNY_TUS_PATH = '/tusupload'
const BUNNY_S3_SIGNED_QUERY_KEYS = [
  'X-Amz-Algorithm',
  'X-Amz-Credential',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-SignedHeaders',
  'X-Amz-Signature',
] as const
const BUNNY_S3_INTEGRITY_SIGNED_HEADERS = new Set([
  'content-length;content-type;host;if-none-match;x-amz-checksum-sha256;x-amz-content-sha256',
  // Rolling-deploy compatibility for already-issued URLs. Only the Gateway can
  // create either signature and both variants are short-lived.
  'content-type;host;if-none-match;x-amz-checksum-sha256;x-amz-content-sha256',
])
const BUNNY_S3_UPLOAD_HEADER_NAMES = new Set([
  'content-type',
  'if-none-match',
  'x-amz-checksum-sha256',
  'x-amz-content-sha256',
])

export function resolveSafeStorageProxyUploadUrl(
  pathOrUrl: string,
  apiBaseUrl: string,
): string | null {
  try {
    const apiUrl = new URL(apiBaseUrl)
    if (apiUrl.protocol !== 'https:') return null
    if (apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) return null

    const target = new URL(pathOrUrl, `${apiUrl.origin}/`)
    if (target.origin !== apiUrl.origin) return null
    if (target.username || target.password || target.search || target.hash) return null
    if (!STORAGE_PROXY_UPLOAD_PATH.test(target.pathname)) return null
    return target.toString()
  } catch {
    return null
  }
}

export function resolveSafeBunnyTusTargetUrl(rawUrl: string): string | null {
  try {
    const target = new URL(rawUrl)
    if (target.origin !== BUNNY_TUS_ORIGIN) return null
    if (target.username || target.password || target.search || target.hash) return null
    if (target.pathname !== BUNNY_TUS_PATH) return null
    return target.toString()
  } catch {
    return null
  }
}

export function resolveSafeBunnyTusUploadLocation(
  rawLocation: string,
  validatedTargetUrl: string,
): string | null {
  const targetUrl = resolveSafeBunnyTusTargetUrl(validatedTargetUrl)
  if (!targetUrl) return null

  try {
    const target = new URL(targetUrl)
    const location = new URL(rawLocation, target)
    if (location.origin !== target.origin) return null
    if (location.username || location.password || location.hash) return null
    if (
      location.pathname !== BUNNY_TUS_PATH
      && !location.pathname.startsWith(`${BUNNY_TUS_PATH}/`)
    ) {
      return null
    }
    return location.toString()
  } catch {
    return null
  }
}

export function resolveSafeBunnyS3UploadUrl(rawUrl: string): string | null {
  try {
    const target = new URL(rawUrl)
    const host = target.hostname.toLowerCase()
    const hostMatch = host.match(/^(de|ny|sg|uk|se|la|jh|syd)-s3\.storage\.bunnycdn\.com$/)
    if (target.protocol !== 'https:' || !hostMatch) return null
    if (target.username || target.password || target.hash) return null
    if (target.port && target.port !== '443') return null
    if (!target.pathname.startsWith('/') || target.pathname === '/') return null
    if (!BUNNY_S3_SIGNED_QUERY_KEYS.every((key) => target.searchParams.getAll(key).length === 1)) return null
    if (Array.from(target.searchParams.keys()).length !== BUNNY_S3_SIGNED_QUERY_KEYS.length) return null
    if (target.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256') return null
    if (!BUNNY_S3_INTEGRITY_SIGNED_HEADERS.has(target.searchParams.get('X-Amz-SignedHeaders') ?? '')) return null
    const credentialParts = (target.searchParams.get('X-Amz-Credential') ?? '').split('/')
    if (credentialParts.length !== 5 || credentialParts[2] !== hostMatch[1] || credentialParts[3] !== 's3' || credentialParts[4] !== 'aws4_request') return null
    if (!/^[a-f0-9]{64}$/.test(target.searchParams.get('X-Amz-Signature') ?? '')) return null
    return target.toString()
  } catch {
    return null
  }
}

export function resolveSafeBunnyS3UploadHeaders(
  rawHeaders: Record<string, string>,
  expectedContentType: string,
): Record<string, string> | null {
  const headers = new Map<string, string>()
  for (const [rawName, value] of Object.entries(rawHeaders)) {
    const name = rawName.trim().toLowerCase()
    if (!BUNNY_S3_UPLOAD_HEADER_NAMES.has(name) || headers.has(name)) return null
    headers.set(name, value)
  }
  if (headers.size !== BUNNY_S3_UPLOAD_HEADER_NAMES.size) return null
  const contentType = headers.get('content-type') ?? ''
  const checksumSha256 = headers.get('x-amz-content-sha256') ?? ''
  const providerChecksumSha256 = headers.get('x-amz-checksum-sha256') ?? ''
  const normalizedExpectedContentType = expectedContentType.toLowerCase().split(';')[0]?.trim() ?? ''
  if (contentType !== normalizedExpectedContentType) return null
  if (headers.get('if-none-match') !== '*') return null
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) return null
  if (providerChecksumSha256 !== sha256HexToBase64(checksumSha256)) return null
  return {
    'Content-Type': contentType,
    'If-None-Match': '*',
    'X-Amz-Checksum-Sha256': providerChecksumSha256,
    'X-Amz-Content-Sha256': checksumSha256,
  }
}

function sha256HexToBase64(checksumSha256: string): string {
  const bytes = checksumSha256.match(/.{2}/g)
  if (!bytes || bytes.length !== 32) return ''
  return btoa(String.fromCharCode(...bytes.map((value) => Number.parseInt(value, 16))))
}

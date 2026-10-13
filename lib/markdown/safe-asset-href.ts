export function getSafeAssetHref(
  value: string,
  currentOrigin = typeof window === 'undefined' ? null : window.location.origin,
  trustedHosts = process.env.NEXT_PUBLIC_ASSISTANT_ASSET_HOSTS ?? '',
) {
  const href = value.trim()
  if (!href || /[\\\u0000-\u001F\u007F]/.test(href)) return null
  const relative = !/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('//')
  try {
    const base = currentOrigin ? new URL(currentOrigin) : new URL('https://relative.invalid')
    const candidate = new URL(href, base)
    if (candidate.username || candidate.password || candidate.hash) return null
    if (candidate.port && candidate.port !== '443') return null
    if (relative && candidate.origin === base.origin) return href
    if (currentOrigin && candidate.origin === base.origin) return href
    if (candidate.protocol !== 'https:') return null
    const hostname = candidate.hostname.replace(/\.$/, '').toLowerCase()
    if (isUnsafeAssetHostname(hostname)) return null
    if (hostname === 'storage.bunnycdn.com') return getAssistantImageProxyHref(candidate)
    if (hostname.length > '.b-cdn.net'.length && hostname.endsWith('.b-cdn.net')) {
      return getAssistantImageProxyHref(candidate)
    }
    const allowlistedHosts = new Set(
      trustedHosts
        .split(',')
        .map(parseTrustedAssetHost)
        .filter((host): host is string => Boolean(host)),
    )
    return allowlistedHosts.has(hostname) ? getAssistantImageProxyHref(candidate) : null
  } catch {
    return null
  }
}

function getAssistantImageProxyHref(url: URL) {
  return `/api/assistant/image?url=${encodeURIComponent(url.toString())}`
}

function parseTrustedAssetHost(value: string) {
  const entry = value.trim()
  if (!entry || entry.includes('*')) return null
  try {
    const candidate = new URL(`https://${entry}`)
    const hostname = candidate.hostname.replace(/\.$/, '').toLowerCase()
    if (
      candidate.username
      || candidate.password
      || candidate.port
      || candidate.pathname !== '/'
      || candidate.search
      || candidate.hash
      || isUnsafeAssetHostname(hostname)
      || hostname === 'youtorch.io'
      || hostname.endsWith('.youtorch.io')
    ) return null
    return hostname
  } catch {
    return null
  }
}

function isUnsafeAssetHostname(hostname: string) {
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === 'metadata'
    || hostname === 'metadata.google.internal'
    || hostname.endsWith('.metadata.google.internal')
    || hostname.includes(':')
  ) return true

  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [first, second, third] = octets
  return first === 0
    || first === 10
    || first === 127
    || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 2)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
}

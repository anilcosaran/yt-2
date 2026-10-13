const MAX_LOCALE_TAGS = 16

export function readBrowserLocales(): string[] {
  if (typeof navigator === "undefined") return []
  const tags = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ]
    .map((tag) => tag?.trim())
    .filter((tag): tag is string => Boolean(tag) && tag.length <= 35)
  return [...new Set(tags)].slice(0, MAX_LOCALE_TAGS)
}

export function clientLocalesQuery(): string {
  const locales = readBrowserLocales()
  if (locales.length === 0) return ""
  return `client_locales=${encodeURIComponent(locales.join(","))}`
}

export function withClientMarketQuery(path: string): string {
  const query = clientLocalesQuery()
  if (!query) return path
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`
}

export function clientMarketCacheSegment(): string {
  return clientLocalesQuery() || "global"
}

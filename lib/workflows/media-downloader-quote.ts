import { toPublicRuntimeError } from '@/lib/public-runtime-error'

export const MEDIA_DOWNLOADER_QUOTE_DEBOUNCE_MS = 150
export const MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS = 45_000
export const MEDIA_DOWNLOADER_QUOTE_LOADING_MESSAGE = 'Video information is being retrieved'
export const MEDIA_DOWNLOADER_DEFAULT_HEIGHT = 1080
export const MEDIA_DOWNLOADER_GIB_BYTES = 1024 ** 3
export const MEDIA_DOWNLOADER_MIB_BYTES = 1024 ** 2

export const MEDIA_DOWNLOADER_CUSTOMER_FORBIDDEN_FIELDS = [
  'provider_slug',
  'provider_key',
  'vendor_cost',
  'vendor_cost_usd',
  'margin',
  'margin_usd',
  'proxy_billable_bytes',
  'proxy_wasted_bytes',
  'wasted_bytes',
  'estimated_proxy_bytes',
  'overhead_factor',
  'fx_rate',
  'fx_source',
  'observed_ip',
  'session_id',
  'sessid',
  'credential',
  'username',
  'password',
  'proxy_url',
] as const

export function publicMediaDownloaderQuoteError(error: unknown, fallback: string) {
  const rawMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''
  const mapped = toPublicRuntimeError(rawMessage)
  if (!mapped || mapped.code === 'E3100' || mapped.code === 'E3151') return fallback
  return mapped.message
}

export type MediaDownloaderQuoteVariant = {
  variantId: string
  downloadVariant?: 'audio_only' | 'video_only' | 'video_with_audio'
  height: number | null
  label: string
  estimatedMediaBytes: number
  estimatedProxyBytes: number | null
  estimatedCredits: number
}

export type MediaDownloaderQuoteSnapshot = {
  snapshotId: string
  fingerprint: string
  expiresAt: string | null
  title: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  variants: MediaDownloaderQuoteVariant[]
  selectedVariantId: string
}

export type MediaDownloaderQuoteRequest = {
  url: string
  downloadVariant?: string
  startTime?: number | null
  endTime?: number | null
}

export type MediaDownloaderQuoteLaunchFields = {
  snapshot_id: string
  variant_id: string
  displayed_estimated_credits: number
}

export type MediaDownloaderPlanLimits = {
  enabled: boolean
  enabledKnown: boolean
  maxResolution: number | null
  maxConcurrent: number | null
}

export function mediaDownloaderQuoteFingerprint(request: MediaDownloaderQuoteRequest): string {
  const url = canonicalizeMediaDownloaderUrl(request.url)
  const clip = [
    Number.isFinite(request.startTime) ? Math.floor(Number(request.startTime)) : '',
    Number.isFinite(request.endTime) ? Math.floor(Number(request.endTime)) : '',
  ].join(':')
  return [
    url,
    request.downloadVariant?.trim() || '',
    clip,
  ].join('|')
}

export function canonicalizeMediaDownloaderUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/[^\S ]|[\u0000-\u001f\u007f]/u.test(trimmed) || (trimmed.match(/https?:\/\//gi)?.length ?? 0) !== 1) {
    return trimmed
  }
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) {
      return trimmed
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const keep = mediaDownloaderPublicQueryKeys(host)
    if (keep) {
      for (const key of [...parsed.searchParams.keys()]) {
        if (!keep.has(key)) parsed.searchParams.delete(key)
      }
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function parseMediaDownloaderVideoUrl(value: string): {
  url: string
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook'
  sourceId: string
} | null {
  const normalized = value.trim()
  if (
    !normalized
    || normalized.length > 4_096
    || /[^\S ]|[\u0000-\u001f\u007f]/u.test(normalized)
    || (normalized.match(/https?:\/\//gi)?.length ?? 0) !== 1
    || mediaDownloaderUrlHasExplicitPort(normalized)
  ) return null
  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) return null
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const segments = parsed.pathname.split('/').filter(Boolean)

    if (
      host === 'youtu.be'
      || host === 'youtube.com'
      || host.endsWith('.youtube.com')
      || host === 'youtube-nocookie.com'
      || host.endsWith('.youtube-nocookie.com')
    ) {
      const videoId = host === 'youtu.be'
        ? segments.length === 1 ? segments[0] : null
        : segments.length === 1 && segments[0] === 'watch'
          ? parsed.searchParams.get('v')
          : segments.length === 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')
            ? segments[1]
            : null
      if (!/^[A-Za-z0-9_-]{5,64}$/.test(videoId ?? '')) return null
      return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'youtube', sourceId: videoId! }
    }

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      if (segments.length === 3 && validTikTokUsernameSegment(segments[0]) && segments[1] === 'video'
        && /^\d{5,32}$/.test(segments[2] ?? '')) {
        return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'tiktok', sourceId: segments[2]! }
      }
      const shortHost = host === 'vm.tiktok.com' || host === 'vt.tiktok.com'
      const shortPath = segments.length === 1
        ? segments[0]
        : segments.length === 2 && segments[0] === 't' ? segments[1] : null
      if (!shortHost || !/^[A-Za-z0-9_-]{5,64}$/.test(shortPath ?? '')) return null
      return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'tiktok', sourceId: shortPath! }
    }

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      const kind = segments[0]
      const sourceId = segments.length === 3 && kind === 'share'
        && ['p', 'reel', 'reels'].includes(segments[1] ?? '')
        ? segments[2]
        : segments.length === 2 && ['p', 'reel', 'reels', 'tv'].includes(kind ?? '')
          ? segments[1]
          : null
      if (!sourceId || !/^[A-Za-z0-9_-]{5,64}$/.test(sourceId)) return null
      return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'instagram', sourceId }
    }

    if (host === 'fb.watch' || host === 'facebook.com' || host.endsWith('.facebook.com')) {
      const queryId = parsed.searchParams.get('v')
      if ((host === 'facebook.com' || host.endsWith('.facebook.com')) && segments.length === 1
        && ['watch', 'watch.php', 'video.php'].includes(segments[0] ?? '')
        && /^\d{5,32}$/.test(queryId ?? '')) {
        return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'facebook', sourceId: queryId! }
      }
      if (host === 'fb.watch' && segments.length === 1 && /^[A-Za-z0-9_-]{5,64}$/.test(segments[0] ?? '')) {
        return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'facebook', sourceId: segments[0]! }
      }
      const videosIndex = segments.lastIndexOf('videos')
      const reelIndex = Math.max(segments.lastIndexOf('reel'), segments.lastIndexOf('reels'))
      const shareId = segments.length === 3 && segments[0] === 'share'
        && ['v', 'r'].includes(segments[1] ?? '')
        ? segments[2]
        : null
      const sourceId = videosIndex >= 0
        && videosIndex === segments.length - 2 ? segments[videosIndex + 1]
        : reelIndex === 0 && segments.length === 2
          ? segments[1]
          : null
      const acceptedSourceId = /^\d{5,32}$/.test(sourceId ?? '') ? sourceId : shareId
      if (acceptedSourceId && /^[A-Za-z0-9_-]{5,64}$/.test(acceptedSourceId)) {
        return { url: canonicalizeMediaDownloaderUrl(parsed.toString()), platform: 'facebook', sourceId: acceptedSourceId }
      }
    }
    return null
  } catch {
    return null
  }
}

export function mediaDownloaderMetadataCreditEligible(availableCredits: number | null | undefined) {
  return typeof availableCredits === 'number'
    && Number.isFinite(availableCredits)
    && availableCredits >= 1
}

export type MediaDownloaderCreditEligibilityState =
  | 'not_required'
  | 'pending'
  | 'failed'
  | 'eligible'
  | 'insufficient'

export function resolveMediaDownloaderCreditEligibility(
  availableCredits: number | null | undefined,
  creditCheckFailed = false,
): MediaDownloaderCreditEligibilityState {
  if (availableCredits === undefined) return 'not_required'
  if (creditCheckFailed) return 'failed'
  if (availableCredits === null) return 'pending'
  return mediaDownloaderMetadataCreditEligible(availableCredits) ? 'eligible' : 'insufficient'
}

function mediaDownloaderUrlHasExplicitPort(value: string) {
  const schemeIndex = value.indexOf('://')
  if (schemeIndex < 0) return false
  const authorityStart = schemeIndex + 3
  const authorityEndOffset = value.slice(authorityStart).search(/[/?#]/)
  const authorityEnd = authorityEndOffset < 0 ? value.length : authorityStart + authorityEndOffset
  const authority = value.slice(authorityStart, authorityEnd)
  const host = authority.slice(authority.lastIndexOf('@') + 1)
  if (host.startsWith('[')) return /^\[[^\]]+\]:/.test(host)
  return /:[0-9]*$/.test(host)
}

function validTikTokUsernameSegment(value: string | null | undefined) {
  return Boolean(value && /^@[A-Za-z0-9_](?:[A-Za-z0-9._]{0,22}[A-Za-z0-9_])?$/.test(value))
}

function mediaDownloaderPublicQueryKeys(host: string): Set<string> | null {
  if (
    host === 'youtu.be'
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com')
  ) return new Set(['v'])
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return new Set()
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') return new Set(['v'])
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return new Set()
  return null
}

export function parseMediaDownloaderPlanLimits(
  features: Array<{ key: string; value: number }>,
): MediaDownloaderPlanLimits {
  const enabled = features.find((feature) => feature.key === 'media_downloader_enabled')
  const resolution = features.find((feature) => feature.key === 'media_downloader_max_resolution')
  const concurrent = features.find((feature) => feature.key === 'media_downloader_max_concurrent')
  return {
    enabled: enabled ? enabled.value > 0 : true,
    enabledKnown: Boolean(enabled),
    maxResolution: resolution && resolution.value > 0 ? Math.floor(resolution.value) : null,
    maxConcurrent: concurrent && concurrent.value > 0 ? Math.floor(concurrent.value) : null,
  }
}

export function parseMediaDownloaderQuoteSnapshot(
  raw: unknown,
  request: MediaDownloaderQuoteRequest,
  maxHeight: number | null = null,
): MediaDownloaderQuoteSnapshot | null {
  const sanitized = stripCustomerUnsafeQuoteFields(raw)
  const record = asRecord(sanitized)
  if (!record) return null
  // `quote_snapshot` is what estimate/launch actually return, and it must win over
  // `ephemeral_estimate_snapshot`, which is a different object carrying no snapshot id.
  const nested = asRecord(record.quote_snapshot)
    ?? asRecord(record.media_downloader_quote)
    ?? asRecord(record.quote)
    ?? asRecord(record.ephemeral_estimate_snapshot)
    ?? asRecord(record.estimate_snapshot)
    ?? record
  const snapshotId = readString(
    nested.snapshot_id
    ?? nested.snapshotId
    ?? nested.id
    ?? record.snapshot_id
    ?? record.snapshotId,
  )
  if (!snapshotId) return null

  const variants = parseQuoteVariants(nested.variants ?? nested.quality_variants ?? nested.formats)
  if (variants.length === 0) return null
  const allowed = filterVariantsByPlanMaxResolution(variants, maxHeight)
  if (allowed.length === 0) return null

  const requestedId = readString(nested.selected_variant_id ?? nested.selectedVariantId ?? nested.variant_id)
  const selected = selectDefaultVariant(allowed, maxHeight, requestedId)
  if (!selected) return null

  // Server quote_snapshot.fingerprint is a SHA-256 of tenant/url/plan/pricing.
  // The picker identity is the local request key (url|variant|clip). Binding the
  // parsed snapshot to that key is what lets estimate 200s become a usable quote
  // instead of E3151.
  const fingerprint = mediaDownloaderQuoteFingerprint(request)
  const metadata = asRecord(nested.metadata) ?? nested

  return {
    snapshotId,
    fingerprint,
    expiresAt: readString(nested.expires_at ?? nested.expiresAt ?? nested.ttl_expires_at),
    title: readString(metadata.title ?? nested.title),
    thumbnailUrl: readString(
      metadata.thumbnail_url
      ?? metadata.thumbnailUrl
      ?? nested.thumbnail_url
      ?? nested.thumbnailUrl,
    ),
    durationSeconds: readFiniteNumber(
      metadata.duration_seconds
      ?? metadata.durationSeconds
      ?? nested.duration_seconds
      ?? nested.duration,
    ),
    width: readPositiveInteger(
      metadata.width
      ?? metadata.video_width
      ?? nested.width,
    ),
    height: readPositiveInteger(
      metadata.height
      ?? metadata.video_height
      ?? nested.height,
    ),
    variants: allowed,
    selectedVariantId: selected.variantId,
  }
}

export function selectDefaultVariant(
  variants: MediaDownloaderQuoteVariant[],
  maxHeight: number | null = null,
  preferredId?: string | null,
): MediaDownloaderQuoteVariant | null {
  const allowed = filterVariantsByPlanMaxResolution(variants, maxHeight)
  if (allowed.length === 0) return null
  if (preferredId) {
    const preferred = allowed.find((variant) => variant.variantId === preferredId)
    if (preferred) return preferred
  }

  const target = maxHeight && maxHeight > 0
    ? Math.min(MEDIA_DOWNLOADER_DEFAULT_HEIGHT, maxHeight)
    : MEDIA_DOWNLOADER_DEFAULT_HEIGHT
  const exact = allowed.find((variant) => variant.height === target)
  if (exact) return exact

  const lower = allowed
    .filter((variant) => variant.height != null && variant.height < target)
    .sort((left, right) => (right.height ?? 0) - (left.height ?? 0))
  if (lower[0]) return lower[0]

  const higher = allowed
    .filter((variant) => variant.height != null && variant.height > target)
    .sort((left, right) => (left.height ?? 0) - (right.height ?? 0))
  return higher[0] ?? allowed[0] ?? null
}

export function filterVariantsByPlanMaxResolution(
  variants: MediaDownloaderQuoteVariant[],
  maxHeight: number | null,
): MediaDownloaderQuoteVariant[] {
  if (maxHeight == null || maxHeight <= 0) return variants
  const bounded = variants.filter((variant) => variant.height == null || variant.height <= maxHeight)
  return bounded.length > 0 ? bounded : variants
}

export function selectVariantFromSnapshot(
  snapshot: MediaDownloaderQuoteSnapshot,
  variantId: string,
): MediaDownloaderQuoteSnapshot | null {
  const next = snapshot.variants.find((variant) => variant.variantId === variantId)
  if (!next) return null
  return { ...snapshot, selectedVariantId: next.variantId }
}

export function snapshotForPlanMaxResolution(
  snapshot: MediaDownloaderQuoteSnapshot | null,
  maxHeight: number | null,
): MediaDownloaderQuoteSnapshot | null {
  if (!snapshot) return null
  const allowed = filterVariantsByPlanMaxResolution(snapshot.variants, maxHeight)
  if (allowed.length === 0) return null
  const selectedStillAllowed = allowed.some((variant) => variant.variantId === snapshot.selectedVariantId)
  if (selectedStillAllowed && allowed.length === snapshot.variants.length) return snapshot
  return selectVariantFromSnapshot({ ...snapshot, variants: allowed }, snapshot.selectedVariantId)
    ?? selectVariantFromSnapshot(
      { ...snapshot, variants: allowed },
      selectDefaultVariant(allowed, maxHeight)?.variantId ?? allowed[0]?.variantId ?? '',
    )
}

export function selectedQuoteVariant(
  snapshot: MediaDownloaderQuoteSnapshot | null,
): MediaDownloaderQuoteVariant | null {
  if (!snapshot) return null
  return snapshot.variants.find((variant) => variant.variantId === snapshot.selectedVariantId) ?? null
}

export function formatEstimatedMediaSize(bytes: number): string {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0
  if (safe >= MEDIA_DOWNLOADER_GIB_BYTES) {
    const value = safe / MEDIA_DOWNLOADER_GIB_BYTES
    return `${formatSizeNumber(value)} GiB`
  }
  const value = safe / MEDIA_DOWNLOADER_MIB_BYTES
  return `${formatSizeNumber(value)} MB`
}

export function formatMediaDownloaderQuoteCopy(input: {
  mediaBytes: number
  credits: number
}): string {
  const size = formatEstimatedMediaSize(input.mediaBytes)
  const credits = formatQuoteCredits(input.credits)
  return `~${size} estimated media size; ${credits} credits estimated (transfer overhead included)`
}

export function formatQuoteCredits(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const precision = safeValue > 0 && safeValue < 0.01 ? 4 : 2
  if (Number.isInteger(safeValue)) return String(safeValue)
  return safeValue.toFixed(precision).replace(/\.?0+$/, '')
}

export function formatMediaDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function isMediaDownloaderQuoteExpired(
  snapshot: MediaDownloaderQuoteSnapshot | null,
  nowMs = Date.now(),
): boolean {
  if (!snapshot) return true
  if (!snapshot.expiresAt) return false
  const expires = Date.parse(snapshot.expiresAt)
  return Number.isFinite(expires) && expires <= nowMs
}

export function mediaDownloaderQuoteLaunchFields(
  snapshot: MediaDownloaderQuoteSnapshot | null,
): MediaDownloaderQuoteLaunchFields | null {
  const variant = selectedQuoteVariant(snapshot)
  if (!snapshot || !variant) return null
  return {
    snapshot_id: snapshot.snapshotId,
    variant_id: variant.variantId,
    displayed_estimated_credits: variant.estimatedCredits,
  }
}

export function canLaunchMediaDownloaderQuote(input: {
  snapshot: MediaDownloaderQuoteSnapshot | null
  fingerprint: string
  displayedCredits: number | null
  nowMs?: number
}): boolean {
  const { snapshot, fingerprint, displayedCredits, nowMs = Date.now() } = input
  if (!snapshot || snapshot.fingerprint !== fingerprint) return false
  if (isMediaDownloaderQuoteExpired(snapshot, nowMs)) return false
  const fields = mediaDownloaderQuoteLaunchFields(snapshot)
  if (!fields) return false
  if (displayedCredits == null || displayedCredits !== fields.displayed_estimated_credits) return false
  return true
}

export function applyMediaDownloaderQuoteLaunchParams(
  params: Record<string, unknown>,
  snapshot: MediaDownloaderQuoteSnapshot | null,
): Record<string, unknown> {
  const fields = mediaDownloaderQuoteLaunchFields(snapshot)
  if (!fields) return { ...params }
  const next: Record<string, unknown> = { ...params, ...fields }
  if (typeof next.url === 'string') {
    const canonical = canonicalizeMediaDownloaderUrl(next.url)
    if (canonical) next.url = canonical
  }
  delete next.urls
  delete next.allow_playlist
  delete next.quality
  delete next.resolution
  delete next.estimated_credits
  delete next.estimated_media_bytes
  delete next.video_format_id
  delete next.audio_format_id
  return next
}

export function stripCustomerUnsafeQuoteFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripCustomerUnsafeQuoteFields(item))
  const record = asRecord(value)
  if (!record) return value
  const next: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(record)) {
    if (isCustomerForbiddenQuoteKey(key)) continue
    next[key] = stripCustomerUnsafeQuoteFields(nested)
  }
  return next
}

export function customerQuoteLeaksInternalFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(customerQuoteLeaksInternalFields)
  const record = asRecord(value)
  if (!record) return false
  return Object.entries(record).some(([key, nested]) => (
    isCustomerForbiddenQuoteKey(key) || customerQuoteLeaksInternalFields(nested)
  ))
}

export function withQuoteTimeoutSignal(signal: AbortSignal | undefined, timeoutMs = MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS) {
  const timeout = createTimeoutSignal(timeoutMs)
  if (!signal) return timeout
  return anyAbortSignal(signal, timeout)
}

function parseQuoteVariants(value: unknown): MediaDownloaderQuoteVariant[] {
  if (!Array.isArray(value)) return []
  const variants: MediaDownloaderQuoteVariant[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (!record) continue
    const variantId = readString(record.variant_id ?? record.variantId ?? record.id ?? record.format_id)
    const credits = readFiniteNumber(
      record.estimated_credits
      ?? record.estimatedCredits
      ?? record.credits,
    )
    if (!variantId || credits == null) continue
    const mediaBytes = readFiniteNumber(
      record.estimated_media_bytes
      ?? record.estimatedMediaBytes
      ?? record.media_bytes
      ?? record.filesize
      ?? record.filesize_approx,
    ) ?? 1
    const height = parseVariantHeight(record)
    const rawDownloadVariant = readString(record.download_variant ?? record.downloadVariant)
    const downloadVariant = rawDownloadVariant === 'audio_only' || rawDownloadVariant === 'video_only'
      ? rawDownloadVariant
      : 'video_with_audio'
    variants.push({
      variantId,
      downloadVariant,
      height,
      label: readString(record.label ?? record.quality ?? record.resolution)
        ?? (height ? `${height}p` : downloadVariant === 'audio_only' ? 'Best available audio' : variantId),
      estimatedMediaBytes: mediaBytes,
      estimatedProxyBytes: null,
      estimatedCredits: credits,
    })
  }
  return variants
}

function parseVariantHeight(record: Record<string, unknown>): number | null {
  // The server sends `resolution` as a number; a "1080p" string falls through to the label branch.
  const direct = readFiniteNumber(record.height ?? record.resolution_height ?? record.resolution)
  if (direct != null && direct > 0) return Math.floor(direct)
  const label = readString(record.label ?? record.quality ?? record.resolution)
  if (!label) return null
  const match = label.match(/(\d{3,4})\s*p/i)
  if (!match) return null
  const height = Number.parseInt(match[1] ?? '', 10)
  return Number.isFinite(height) ? height : null
}

function isCustomerForbiddenQuoteKey(key: string) {
  const normalized = key.trim().toLowerCase()
  return MEDIA_DOWNLOADER_CUSTOMER_FORBIDDEN_FIELDS.some((field) => (
    normalized === field || normalized.endsWith(`_${field}`) || normalized.includes(field)
  ))
}

function formatSizeNumber(value: number) {
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '')
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readPositiveInteger(value: unknown): number | null {
  const parsed = readFiniteNumber(value)
  return parsed != null && parsed > 0 ? Math.floor(parsed) : null
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

function anyAbortSignal(...signals: AbortSignal[]): AbortSignal {
  const defined = signals.filter(Boolean)
  if (defined.length === 1) return defined[0]!
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(defined)
  }
  const controller = new AbortController()
  for (const signal of defined) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

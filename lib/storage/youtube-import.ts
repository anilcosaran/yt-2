import { isAuthClientError } from '@/lib/auth/errors'
import { toPublicRuntimeError } from '@/lib/public-runtime-error'
import {
  getStorageObject,
  type StorageObjectItem,
} from '@/lib/storage/api'
import {
  createWorkflowActionIdempotencyKey,
  estimateWorkflowAgent,
  getWorkflowAgentOutput,
  getWorkflowAgentStatus,
  launchWorkflowAgent,
} from '@/lib/workflows/api'
import {
  applyMediaDownloaderQuoteLaunchParams,
  canLaunchMediaDownloaderQuote,
  mediaDownloaderQuoteFingerprint,
  parseMediaDownloaderVideoUrl,
  parseMediaDownloaderPlanLimits,
  parseMediaDownloaderQuoteSnapshot,
  selectedQuoteVariant,
  type MediaDownloaderQuoteSnapshot,
  type MediaDownloaderQuoteVariant,
} from '@/lib/workflows/media-downloader-quote'
import { isFailedRunStatus, isTerminalRunStatus } from '@/lib/workflows/run-status'

export const YOUTUBE_IMPORT_MAX_URL_LENGTH = 4_096
export const YOUTUBE_IMPORT_NODE_TYPE = 'media_downloader@1'
export const YOUTUBE_IMPORT_POLL_DEADLINE_MS = 20 * 60_000
const YOUTUBE_IMPORT_JOB_STORAGE_PREFIX = 'youtorch.storage.youtube-import.v1:'

export type YoutubeImportMediaKind = 'audio-video' | 'audio' | 'video' | 'all'
export type YoutubeImportPhase = 'starting' | 'downloading' | 'failed'
export type YoutubeImportAgentStatus = 'starting' | 'running' | 'failed'
export type YoutubeImportUrlError = 'empty' | 'too_long' | 'invalid'
export type YoutubeImportParsedUrl = {
  url: string
  videoId: string
}

export type YoutubeImportPlanLimits = {
  enabled: boolean
  enabledKnown: boolean
  maxDurationSeconds: number | null
  maxSingleFileSizeMb: number | null
  maxResolution: number | null
  maxConcurrent: number | null
}

export type YoutubeImportQuote = {
  key: string
  credits: number
  itemCredits: number
  snapshotId: string | null
  variantId: string | null
  fingerprint: string | null
  expiresAt: string | null
  estimatedMediaBytes: number | null
  title: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  variants: MediaDownloaderQuoteVariant[]
  snapshot: MediaDownloaderQuoteSnapshot | null
}

export type YoutubeImportProgress = {
  phase: YoutubeImportPhase
}

export type YoutubeImportJob = {
  agentId: string | null
  launchIdempotencyKey: string
  channelId: string
  mediaKind: YoutubeImportMediaKind
  url: YoutubeImportParsedUrl
  startedAt: number
  agentStatus: YoutubeImportAgentStatus
  objectIds: string[]
  failedMessage: string | null
  quote: YoutubeImportQuote | null
}

export type YoutubeImportAgentSnapshot =
  | { status: 'running' }
  | { status: 'completed'; items: StorageObjectItem[] }
  | { status: 'failed'; message: string }

export class YoutubeImportError extends Error {
  constructor(
    readonly code: 'invalid_url' | 'too_long' | 'timeout' | 'missing_output' | 'failed',
    message: string,
  ) {
    super(message)
    this.name = 'YoutubeImportError'
  }
}

const youtubeImportJobs = new Map<string, YoutubeImportJob>()

export function isYoutubeImportMediaKind(kind: string): kind is YoutubeImportMediaKind {
  return kind === 'audio-video' || kind === 'audio' || kind === 'video' || kind === 'all'
}

export function youtubeImportDownloadVariant(
  mediaKind: YoutubeImportMediaKind,
): 'audio_only' | 'video_with_audio' {
  return mediaKind === 'audio' ? 'audio_only' : 'video_with_audio'
}

export type YoutubeImportPickerView =
  | 'all'
  | 'audio'
  | 'video'
  | 'image'
  | 'clips'
  | 'gifs'
  | 'voice'
  | 'elements'
  | 'documents'

export function youtubeImportPickerView(input: {
  mimeType: string | null
  currentView: YoutubeImportPickerView
}): YoutubeImportPickerView {
  const mime = input.mimeType?.toLowerCase() ?? ''
  if (mime.startsWith('audio/')) {
    return input.currentView === 'audio' || input.currentView === 'all' ? input.currentView : 'audio'
  }
  if (mime.startsWith('video/')) {
    return input.currentView === 'video' || input.currentView === 'all' ? input.currentView : 'video'
  }
  return input.currentView
}

export function youtubeImportMatchesPickerView(
  item: { mime_type: string | null },
  view: YoutubeImportPickerView,
) {
  const mime = item.mime_type?.toLowerCase() ?? ''
  if (view === 'all') return mime.startsWith('audio/') || mime.startsWith('video/')
  if (view === 'video') return mime.startsWith('video/')
  if (view === 'audio') return mime.startsWith('audio/')
  return false
}

export function youtubeImportVisibleInAssetView(
  job: YoutubeImportJob,
  view: string,
) {
  if (view === 'avatar' || view === 'voice' || view === 'image' || view === 'clip' || view === 'document') {
    return false
  }
  if (view === 'video') return job.mediaKind !== 'audio'
  return true
}

export function youtubeImportJobIsInProgress(job: YoutubeImportJob | null): job is YoutubeImportJob {
  return Boolean(job && !job.failedMessage && job.agentStatus !== 'failed')
}

export function youtubeImportFailureNotice(job: YoutubeImportJob | null) {
  if (!job || (!job.failedMessage && job.agentStatus !== 'failed')) return null
  return {
    message: job.failedMessage?.trim() || '',
    videoId: job.url.videoId,
    extraCount: 0,
  }
}

export function getYoutubeImportPlanLimits(
  features: Array<{ key: string; value: number }>,
): YoutubeImportPlanLimits {
  const duration = features.find((feature) => feature.key === 'media_downloader_max_duration_seconds')
  const sizeMb = features.find((feature) => feature.key === 'media_downloader_max_single_file_size_mb')
  const mediaDownloader = parseMediaDownloaderPlanLimits(features)
  return {
    enabled: mediaDownloader.enabled,
    enabledKnown: mediaDownloader.enabledKnown,
    maxDurationSeconds: duration && duration.value > 0 ? duration.value : null,
    maxSingleFileSizeMb: sizeMb && sizeMb.value > 0 ? sizeMb.value : null,
    maxResolution: mediaDownloader.maxResolution,
    maxConcurrent: mediaDownloader.maxConcurrent,
  }
}

export function youtubeImportAgentParams(input: {
  url: string
  mediaKind: YoutubeImportMediaKind
  snapshotId?: string | null
  variantId?: string | null
  displayedEstimatedCredits?: number | null
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    url: input.url,
    mode: 'download',
    download_variant: youtubeImportDownloadVariant(input.mediaKind),
  }
  if (input.snapshotId) params.snapshot_id = input.snapshotId
  if (input.variantId) params.variant_id = input.variantId
  if (input.displayedEstimatedCredits != null) {
    params.displayed_estimated_credits = input.displayedEstimatedCredits
  }
  return params
}

export function youtubeImportQuoteKey(url: string) {
  return url
}

export function emptyYoutubeImportQuote(url: string): YoutubeImportQuote {
  return {
    key: youtubeImportQuoteKey(url),
    credits: 0,
    itemCredits: 0,
    snapshotId: null,
    variantId: null,
    fingerprint: mediaDownloaderQuoteFingerprint({ url }),
    expiresAt: null,
    estimatedMediaBytes: null,
    title: null,
    thumbnailUrl: null,
    durationSeconds: null,
    width: null,
    height: null,
    variants: [],
    snapshot: null,
  }
}

export function youtubeImportQuoteFromSnapshot(
  url: string,
  snapshot: MediaDownloaderQuoteSnapshot | null,
): YoutubeImportQuote {
  const variant = selectedQuoteVariant(snapshot)
  const itemCredits = variant?.estimatedCredits ?? 0
  return {
    key: youtubeImportQuoteKey(url),
    credits: itemCredits,
    itemCredits,
    snapshotId: snapshot?.snapshotId ?? null,
    variantId: variant?.variantId ?? null,
    fingerprint: snapshot?.fingerprint ?? mediaDownloaderQuoteFingerprint({ url }),
    expiresAt: snapshot?.expiresAt ?? null,
    estimatedMediaBytes: variant?.estimatedMediaBytes ?? null,
    title: snapshot?.title ?? null,
    thumbnailUrl: snapshot?.thumbnailUrl ?? null,
    durationSeconds: snapshot?.durationSeconds ?? null,
    width: snapshot?.width ?? null,
    height: snapshot?.height ?? null,
    variants: snapshot?.variants ?? [],
    snapshot,
  }
}

export function formatYoutubeImportCreditAmount(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const precision = safeValue > 0 && safeValue < 0.01 ? 4 : 2
  if (Number.isInteger(safeValue)) return String(safeValue)
  return safeValue.toFixed(precision).replace(/\.?0+$/, '')
}

export function youtubeImportCanConfirm(input: {
  key: string
  quote: YoutubeImportQuote | null
  quoting: boolean
  availableCredits: number | null
}) {
  if (input.quoting || !input.quote || input.quote.key !== input.key) return false
  if (!input.quote.snapshotId || !input.quote.variantId) return false
  if (!canLaunchMediaDownloaderQuote({
    snapshot: input.quote.snapshot,
    fingerprint: input.quote.fingerprint ?? '',
    displayedCredits: input.quote.itemCredits,
  })) return false
  if (input.availableCredits !== null && input.quote.credits > input.availableCredits) return false
  return true
}

export function parseYoutubeImportUrl(
  value: string,
): { ok: true; url: string; videoId: string } | { ok: false; code: YoutubeImportUrlError } {
  const normalized = value.trim()
  if (!normalized) return { ok: false, code: 'empty' }
  if (normalized.length > YOUTUBE_IMPORT_MAX_URL_LENGTH) return { ok: false, code: 'too_long' }
  const parsed = parseMediaDownloaderVideoUrl(normalized)
  if (!parsed) return { ok: false, code: 'invalid' }
  const prefix = parsed.platform === 'youtube' ? '' : `${parsed.platform === 'tiktok' ? 'tt' : parsed.platform === 'instagram' ? 'ig' : 'fb'}:`
  return { ok: true, url: parsed.url, videoId: `${prefix}${parsed.sourceId}` }
}

export function extractYoutubeImportStorageObjectIds(output: unknown): string[] {
  const root = asRecord(output)
  if (!root) return []
  const payload = asRecord(root.output) ?? root
  const result = asRecord(payload.result) ?? payload
  const collections = [
    ...(Array.isArray(result.items) ? result.items : []),
    ...(Array.isArray(payload.media_refs) ? payload.media_refs : []),
    ...(Array.isArray(result.media_refs) ? result.media_refs : []),
  ]
  const ids: string[] = []
  const seen = new Set<string>()
  const push = (id: string | null) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  }
  for (const item of collections) {
    const record = asRecord(item)
    if (!record) continue
    push(readPreferredStorageObjectId(record))
  }
  if (ids.length === 0) {
    push(readPreferredStorageObjectId(payload))
    if (result !== payload) push(readPreferredStorageObjectId(result))
  }
  return ids
}

export function extractYoutubeImportStorageObjectId(output: unknown): string | null {
  return extractYoutubeImportStorageObjectIds(output)[0] ?? null
}

export function youtubeImportErrorText(error: unknown): string {
  if (error instanceof YoutubeImportError && error.code !== 'failed') return error.message
  const raw = isAuthClientError(error)
    ? error.message
    : error instanceof Error ? error.message : ''
  const publicCode = isAuthClientError(error) ? error.publicErrorCode : undefined
  const mapped = toPublicRuntimeError(publicCode ? `Error code: ${publicCode}` : raw)
  if (mapped && ['E3151', 'E3154', 'E3155', 'E3156'].includes(mapped.code)) return mapped.message
  if (isAuthClientError(error) && error.status === 402 && raw) return raw
  if (isGenericMediaDownloaderFailure(error, raw)) {
    return 'This video could not be downloaded. Try a different link or try again later. Error code: E3151'
  }
  if (mapped && mapped.code !== 'E3100') return mapped.message
  if (leaksProxyInternals(raw)) {
    return 'This video could not be downloaded. Try a different link or try again later. Error code: E3151'
  }
  return 'This video could not be downloaded. Try a different link or try again later. Error code: E3151'
}

function isGenericMediaDownloaderFailure(error: unknown, raw: string) {
  if (isAuthClientError(error)) {
    if (error.status >= 500) return true
    if (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'INTERNAL_ERROR') return true
  }
  return /^something went wrong\.?$/i.test(raw.trim())
}

function leaksProxyInternals(value: string) {
  const normalized = value.toLowerCase()
  return [
    'dataimpulse',
    'gw.dataimpulse.com',
    'observed_ip',
    'sessid',
    'vendor_cost',
    'proxy_url',
    'threads_exhausted',
    'traffic_exhausted',
  ].some((marker) => normalized.includes(marker))
}

export function isYoutubeImportAbort(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return true
  return error instanceof DOMException && error.name === 'AbortError'
}

export function youtubeImportPollIntervalMs(elapsedMs: number) {
  if (elapsedMs < 30_000) return 2_000
  if (elapsedMs < 2 * 60_000) return 4_000
  return 5_000
}

export function youtubeImportJobPhase(job: YoutubeImportJob): YoutubeImportPhase {
  if (job.failedMessage || job.agentStatus === 'failed') return 'failed'
  if (!job.agentId || job.agentStatus === 'starting') return 'starting'
  return 'downloading'
}

export function youtubeImportJobIsSettled(
  job: YoutubeImportJob,
  items: Array<{ id: string }>,
) {
  if (job.objectIds.length === 0) return false
  const known = new Set(items.map((item) => item.id))
  return job.objectIds.every((id) => known.has(id))
}

export function saveYoutubeImportJob(job: YoutubeImportJob) {
  youtubeImportJobs.set(job.channelId, job)
  const storage = youtubeImportJobStorage()
  if (!storage) return
  try {
    storage.setItem(youtubeImportJobStorageKey(job.channelId), JSON.stringify(job))
  } catch {
    // Restore is best-effort; in-memory state still covers the current tab.
  }
}

function youtubeImportLaunchIdempotencyKey(existing: YoutubeImportJob | null): string {
  // Reuse only an in-flight launch so refresh can resume the same execute.
  // A failed schema/quote launch must not replay a cached 400 under the old key.
  if (
    existing
    && !existing.agentId
    && !existing.failedMessage
    && existing.agentStatus === 'starting'
    && existing.launchIdempotencyKey
  ) {
    return existing.launchIdempotencyKey
  }
  return createWorkflowActionIdempotencyKey('storage-youtube-import')
}

export function beginYoutubeImportJob(input: {
  channelId: string
  url: YoutubeImportParsedUrl
  mediaKind: YoutubeImportMediaKind
  quote?: YoutubeImportQuote | null
}): YoutubeImportJob {
  const existing = readYoutubeImportJob(input.channelId)
  const job: YoutubeImportJob = {
    agentId: null,
    launchIdempotencyKey: youtubeImportLaunchIdempotencyKey(existing),
    channelId: input.channelId,
    mediaKind: input.mediaKind,
    url: input.url,
    startedAt: Date.now(),
    agentStatus: 'starting',
    objectIds: [],
    failedMessage: null,
    quote: input.quote ?? existing?.quote ?? null,
  }
  saveYoutubeImportJob(job)
  return job
}

export function patchYoutubeImportJob(
  channelId: string,
  patch: Partial<Pick<YoutubeImportJob, 'agentId' | 'objectIds' | 'failedMessage' | 'agentStatus'>>,
): YoutubeImportJob | null {
  const current = readYoutubeImportJob(channelId)
  if (!current) return null
  const failedMessage = patch.failedMessage === undefined ? current.failedMessage : patch.failedMessage
  const next: YoutubeImportJob = {
    ...current,
    ...patch,
    objectIds: patch.objectIds ?? current.objectIds,
    failedMessage,
    agentStatus: failedMessage
      ? 'failed'
      : patch.agentStatus
        ?? (patch.agentId ? 'running' : current.agentStatus),
  }
  saveYoutubeImportJob(next)
  return next
}

export function readYoutubeImportJob(channelId: string): YoutubeImportJob | null {
  const memory = youtubeImportJobs.get(channelId)
  if (memory) return settleYoutubeImportJob(memory)

  const key = youtubeImportJobStorageKey(channelId)
  const parsed = readStoredYoutubeImportJob(youtubeImportJobStorage(), key, channelId)
    ?? readStoredYoutubeImportJob(youtubeImportLegacyJobStorage(), key, channelId)
  if (!parsed) return null
  const settled = settleYoutubeImportJob(parsed)
  if (settled) saveYoutubeImportJob(settled)
  return settled
}

export function clearYoutubeImportJob(channelId: string) {
  youtubeImportJobs.delete(channelId)
  const key = youtubeImportJobStorageKey(channelId)
  for (const storage of [youtubeImportJobStorage(), youtubeImportLegacyJobStorage()]) {
    if (!storage) continue
    try {
      storage.removeItem(key)
    } catch {
      // Ignore quota / private-mode failures.
    }
  }
}

export async function estimateYoutubeImport(input: {
  channelId: string
  url: string
  mediaKind: YoutubeImportMediaKind
  maxHeight?: number | null
  signal?: AbortSignal
}): Promise<YoutubeImportQuote> {
  const url = requireYoutubeImportUrl(input.url).url
  const estimate = await estimateWorkflowAgent({
    channelId: input.channelId,
    nodeType: YOUTUBE_IMPORT_NODE_TYPE,
    params: youtubeImportAgentParams({ url, mediaKind: input.mediaKind }),
    idempotencyKey: createWorkflowActionIdempotencyKey('storage-youtube-import-estimate'),
  }, { signal: input.signal })
  const snapshot = parseMediaDownloaderQuoteSnapshot(estimate, {
    url,
    downloadVariant: youtubeImportDownloadVariant(input.mediaKind),
  }, input.maxHeight ?? null)
  if (snapshot) return youtubeImportQuoteFromSnapshot(url, snapshot)
  const credits = Number.isFinite(estimate.total_credits_estimated)
    ? Math.max(0, estimate.total_credits_estimated)
    : 0
  if (credits <= 0) return emptyYoutubeImportQuote(url)
  return {
    ...emptyYoutubeImportQuote(url),
    credits,
  }
}

export async function launchYoutubeImport(input: {
  channelId: string
  url: YoutubeImportParsedUrl
  mediaKind: YoutubeImportMediaKind
  quote?: YoutubeImportQuote | null
  idempotencyKey?: string
  startedAt?: number
  signal?: AbortSignal
}): Promise<{ agentId: string }> {
  const url = requireYoutubeImportUrl(input.url.url).url
  const existing = readYoutubeImportJob(input.channelId)
  const job: YoutubeImportJob = {
    agentId: existing?.agentId ?? null,
    launchIdempotencyKey: input.idempotencyKey
      ?? existing?.launchIdempotencyKey
      ?? createWorkflowActionIdempotencyKey('storage-youtube-import'),
    channelId: input.channelId,
    mediaKind: input.mediaKind,
    url: input.url,
    startedAt: input.startedAt ?? existing?.startedAt ?? Date.now(),
    agentStatus: existing?.agentId ? 'running' : 'starting',
    objectIds: existing?.objectIds ?? [],
    failedMessage: null,
    quote: input.quote ?? existing?.quote ?? null,
  }
  saveYoutubeImportJob(job)
  const quote = input.quote ?? existing?.quote ?? null
  if (!youtubeImportCanConfirm({
    key: youtubeImportQuoteKey(url),
    quote,
    quoting: false,
    availableCredits: null,
  })) {
    throw new YoutubeImportError(
      'failed',
      'The quote expired or changed. Refresh the estimate before downloading.',
    )
  }
  const launch = await launchWorkflowAgent({
    projectId: input.channelId,
    channelId: input.channelId,
    nodeType: YOUTUBE_IMPORT_NODE_TYPE,
    params: applyMediaDownloaderQuoteLaunchParams(
      youtubeImportAgentParams({
        url,
        mediaKind: input.mediaKind,
        snapshotId: quote?.snapshotId,
        variantId: quote?.variantId,
        displayedEstimatedCredits: quote?.itemCredits ?? quote?.credits,
      }),
      quote?.snapshot ?? null,
    ),
    idempotencyKey: job.launchIdempotencyKey,
  })
  saveYoutubeImportJob({
    ...job,
    agentId: launch.agent_id,
    agentStatus: 'running',
  })
  return { agentId: launch.agent_id }
}

export async function readYoutubeImportAgentSnapshot(input: {
  agentId: string
  channelId: string
  signal?: AbortSignal
}): Promise<YoutubeImportAgentSnapshot> {
  const status = await getWorkflowAgentStatus(input.agentId, { signal: input.signal })
  const normalized = status.status.toLowerCase()

  if (isYoutubeImportSuccessStatus(normalized)) {
    return {
      status: 'completed',
      items: await readCompletedYoutubeImportItems(input),
    }
  }

  if (isYoutubeImportFailureStatus(normalized)) {
    return {
      status: 'failed',
      message: youtubeImportErrorText(status.errorMessage ?? 'Error code: E3151'),
    }
  }

  return { status: 'running' }
}

export async function importYoutubeMedia(input: {
  channelId: string
  url: string
  mediaKind: YoutubeImportMediaKind
  signal?: AbortSignal
  onLaunched?: (agentId: string) => void
  onProgress?: (progress: YoutubeImportProgress) => void
}): Promise<StorageObjectItem> {
  const parsed = requireYoutubeImportUrl(input.url)

  input.onProgress?.({ phase: 'starting' })
  let agentId: string | null = null
  try {
    const launch = await launchYoutubeImport({
      channelId: input.channelId,
      url: parsed,
      mediaKind: input.mediaKind,
      signal: input.signal,
    })
    agentId = launch.agentId
    input.onLaunched?.(launch.agentId)
    throwIfAborted(input.signal)

    const item = await pollImportedYoutubeMedia({
      agentId: launch.agentId,
      channelId: input.channelId,
      signal: input.signal,
      onProgress: input.onProgress,
    })
    clearYoutubeImportJob(input.channelId)
    return item
  } catch (error) {
    if (agentId && isYoutubeImportAbort(error, input.signal)) {
      clearYoutubeImportJob(input.channelId)
    }
    throw error
  }
}

function requireYoutubeImportUrl(url: string) {
  const parsed = parseYoutubeImportUrl(url)
  if (!parsed.ok) {
    throw new YoutubeImportError(
      parsed.code === 'too_long' ? 'too_long' : 'invalid_url',
      parsed.code === 'too_long'
        ? 'The URL is too long. Use a URL with 4,096 characters or fewer.'
        : 'Enter a public YouTube, Instagram, TikTok, or Facebook video URL.',
    )
  }
  return parsed
}

async function pollImportedYoutubeMedia(input: {
  agentId: string
  channelId: string
  signal?: AbortSignal
  onProgress?: (progress: YoutubeImportProgress) => void
}): Promise<StorageObjectItem> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < YOUTUBE_IMPORT_POLL_DEADLINE_MS) {
    throwIfAborted(input.signal)
    try {
      const snapshot = await readYoutubeImportAgentSnapshot({
        agentId: input.agentId,
        channelId: input.channelId,
        signal: input.signal,
      })
      if (snapshot.status === 'completed') {
        const item = snapshot.items[0]
        if (!item) {
          throw new YoutubeImportError(
            'missing_output',
            'The download finished, but the media is not in Storage yet. Try again shortly.',
          )
        }
        return item
      }
      if (snapshot.status === 'failed') {
        throw new YoutubeImportError('failed', snapshot.message)
      }
      input.onProgress?.({ phase: 'downloading' })
    } catch (error) {
      if (error instanceof YoutubeImportError || isYoutubeImportAbort(error, input.signal)) throw error
      if (isAuthClientError(error) && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error
      }
    }
    await abortableDelay(youtubeImportPollIntervalMs(Date.now() - startedAt), input.signal)
  }

  throw new YoutubeImportError(
    'timeout',
    'The download is taking longer than expected. Check Storage in a few minutes.',
  )
}

function readPreferredStorageObjectId(record: Record<string, unknown>): string | null {
  const mediaRef = asRecord(record.media_ref) ?? asRecord(record.mediaRef)
  const nested = mediaRef ? readStorageObjectId(mediaRef) : null
  if (nested) return nested
  const metadata = asRecord(record.metadata)
  const fromMetadata = metadata ? readStorageObjectId(metadata) : null
  if (fromMetadata) return fromMetadata
  return readStorageObjectId(record)
}

function readStorageObjectId(record: Record<string, unknown>): string | null {
  const value = record.storage_object_id ?? record.storageObjectId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function isYoutubeImportSuccessStatus(status: string) {
  return status === 'completed' || status === 'success' || status === 'succeeded' || status === 'done'
}

function isYoutubeImportFailureStatus(status: string) {
  return isFailedRunStatus(status)
    || status === 'cancelled'
    || status === 'canceled'
    || status === 'insufficient_balance'
    || isTerminalRunStatus(status) && !isYoutubeImportSuccessStatus(status)
}

async function readCompletedYoutubeImportItems(input: {
  agentId: string
  channelId: string
  signal?: AbortSignal
}): Promise<StorageObjectItem[]> {
  try {
    const output = await getWorkflowAgentOutput(input.agentId, { signal: input.signal })
    const items: StorageObjectItem[] = []
    for (const objectId of extractYoutubeImportStorageObjectIds(output)) {
      try {
        items.push(await getStorageObject({
          channelId: input.channelId,
          objectId,
        }, { signal: input.signal }))
      } catch (error) {
        if (isYoutubeImportAbort(error, input.signal)) throw error
      }
    }
    return items
  } catch (error) {
    if (isYoutubeImportAbort(error, input.signal)) throw error
    return []
  }
}

function inferYoutubeImportAgentStatus(job: Pick<YoutubeImportJob, 'agentId' | 'objectIds' | 'failedMessage' | 'agentStatus'>): YoutubeImportAgentStatus | 'completed' {
  if (job.failedMessage || job.agentStatus === 'failed') return 'failed'
  if (job.objectIds.length > 0) return 'completed'
  if (job.agentStatus === 'starting' || job.agentStatus === 'running') return job.agentStatus
  if (job.agentId) return 'running'
  return 'starting'
}

function settleYoutubeImportJob(job: YoutubeImportJob): YoutubeImportJob | null {
  const agentStatus = inferYoutubeImportAgentStatus(job)
  if (agentStatus === 'completed') {
    clearYoutubeImportJob(job.channelId)
    return null
  }
  const next: YoutubeImportJob = {
    ...job,
    agentStatus,
  }
  if (next.agentStatus !== job.agentStatus) {
    saveYoutubeImportJob(next)
    return next
  }
  youtubeImportJobs.set(job.channelId, next)
  return next
}

function parseStoredYoutubeImportJob(value: unknown): YoutubeImportJob | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.channelId !== 'string' || !record.channelId.trim()) return null
  if (typeof record.mediaKind !== 'string' || !isYoutubeImportMediaKind(record.mediaKind)) return null
  if (typeof record.startedAt !== 'number' || !Number.isFinite(record.startedAt)) return null
  const agentId = typeof record.agentId === 'string' && record.agentId.trim()
    ? record.agentId.trim()
    : null
  const launchIdempotencyKey = typeof record.launchIdempotencyKey === 'string' && record.launchIdempotencyKey.trim()
    ? record.launchIdempotencyKey.trim()
    : agentId
      ? `storage-youtube-import:legacy:${agentId}`
      : null
  if (!launchIdempotencyKey) return null
  const storedUrls = record.url && typeof record.url === 'object' && !Array.isArray(record.url)
    ? [record.url]
    : Array.isArray(record.urls)
      ? record.urls
      : []
  if (storedUrls.length === 0) return null
  const parsedUrls: YoutubeImportParsedUrl[] = []
  for (const item of storedUrls) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const entry = item as Record<string, unknown>
    if (typeof entry.url !== 'string') return null
    const parsed = parseYoutubeImportUrl(entry.url)
    if (!parsed.ok) return null
    parsedUrls.push({ url: parsed.url, videoId: parsed.videoId })
  }
  const url = parsedUrls[0]
  if (!url) return null
  const legacyBatchMessage = parsedUrls.length > 1
    ? 'This legacy multi-URL import cannot be resumed. Start each video as a separate download.'
    : null
  const objectIds: string[] = []
  if (Array.isArray(record.objectIds)) {
    for (const item of record.objectIds) {
      if (typeof item !== 'string' || !item.trim() || objectIds.includes(item)) continue
      objectIds.push(item)
    }
  }
  const storedFailedMessage = typeof record.failedMessage === 'string' && record.failedMessage.trim()
    ? record.failedMessage.trim()
    : null
  const failedMessage = storedFailedMessage ?? legacyBatchMessage
  const storedStatus = record.agentStatus === 'starting'
    || record.agentStatus === 'running'
    || record.agentStatus === 'failed'
    ? record.agentStatus
    : null
  return {
    agentId,
    launchIdempotencyKey,
    channelId: record.channelId,
    mediaKind: record.mediaKind,
    url,
    startedAt: record.startedAt,
    agentStatus: failedMessage ? 'failed' : storedStatus ?? (agentId ? 'running' : 'starting'),
    objectIds,
    failedMessage,
    quote: parseStoredYoutubeImportQuote(record.quote),
  }
}

function parseStoredYoutubeImportQuote(value: unknown): YoutubeImportQuote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.key !== 'string' || typeof record.credits !== 'number') return null
  const itemCredits = typeof record.itemCredits === 'number' && Number.isFinite(record.itemCredits)
    ? record.itemCredits
    : record.credits
  return {
    key: record.key,
    credits: record.credits,
    itemCredits,
    snapshotId: typeof record.snapshotId === 'string' ? record.snapshotId : null,
    variantId: typeof record.variantId === 'string' ? record.variantId : null,
    fingerprint: typeof record.fingerprint === 'string' ? record.fingerprint : null,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : null,
    estimatedMediaBytes: typeof record.estimatedMediaBytes === 'number' ? record.estimatedMediaBytes : null,
    title: typeof record.title === 'string' ? record.title : null,
    thumbnailUrl: typeof record.thumbnailUrl === 'string' ? record.thumbnailUrl : null,
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : null,
    width: typeof record.width === 'number' && Number.isFinite(record.width) ? record.width : null,
    height: typeof record.height === 'number' && Number.isFinite(record.height) ? record.height : null,
    variants: Array.isArray(record.variants) ? record.variants as YoutubeImportQuote['variants'] : [],
    snapshot: record.snapshot && typeof record.snapshot === 'object'
      ? record.snapshot as YoutubeImportQuote['snapshot']
      : null,
  }
}

function youtubeImportJobStorageKey(channelId: string) {
  return `${YOUTUBE_IMPORT_JOB_STORAGE_PREFIX}${channelId}`
}

function youtubeImportJobStorage() {
  return readWebStorage('localStorage')
}

function youtubeImportLegacyJobStorage() {
  return readWebStorage('sessionStorage')
}

function readWebStorage(kind: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') return null
  try {
    return window[kind]
  } catch {
    return null
  }
}

function readStoredYoutubeImportJob(
  storage: Storage | null,
  key: string,
  channelId: string,
): YoutubeImportJob | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = parseStoredYoutubeImportJob(JSON.parse(raw))
    if (!parsed || parsed.channelId !== channelId) {
      storage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    try {
      storage.removeItem(key)
    } catch {
      // Ignore quota / private-mode failures.
    }
    return null
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

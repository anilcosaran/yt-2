/**
 * Spark timeline v3 media previews: the filmstrip sprite and the waveform peaks of the storage objects behind timeline
 * clips. The media ingest lane already renders both for every uploaded video/audio source (`storage_object_derivatives`
 * filmstrip `jpg-h90`, waveform `peaks-50`); the gateway delivers them as the `filmstrip` / `waveform` variants of the
 * storage delivery URL routes, with their descriptor (tile layout, peak rate).
 *
 * In memory only (no browser storage). `request(ids)` coalesces the ids asked for in one task (microtask) into batch
 * delivery calls of at most 64 ids, one call per variant (object ids are unique per batch). A signed sprite URL is kept
 * until 60 s before it expires; the next `request` then re-mints it while the sprite already shown keeps its old URL. The
 * sprite is drawn by CSS background tiles, which need no CORS.
 *
 * Waveform peaks are fetched once per object. Whether the Storage pull zone answers a cross-origin `fetch` with
 * `Access-Control-Allow-Origin` is not established (no pull-zone CORS configuration exists; playback is already proxied
 * server-side), so the JSON is read through the same-origin `/api/storage/waveform` route, which mints the URL with the
 * session, fetches the peaks from the allow-listed CDN host and returns the validated body. The batch answer still tells
 * which objects have peaks (one call for all) and carries the peak rate.
 *
 * Unknown or in-flight ids read `'pending'`; an unavailable preview (no derivative yet, not found, other 4xx, invalid
 * answer) reads `'none'` and may be asked again by a later `request` after 60 s (a video whose ingest is still running).
 * Network, 5xx, 408 and 429 failures retry on their own with a bounded backoff, then settle as `'none'`. Listeners fire
 * once per settled batch. Getters are O(1) and return the same object for the same state, so components may read them
 * during render.
 */
import {
  getStorageDeliveryUrls,
  STORAGE_DELIVERY_URL_BATCH_SIZE,
  type DeliveryUrlsBatchResult,
  type StorageDeliveryPreviewDescriptor,
  type StorageDeliveryPreviewVariant,
} from '@/lib/storage/api'
import { readAudiowaveformV2 } from './waveform-peaks'

export type FilmstripSprite = {
  url: string
  tileCount: number
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
  intervalMs: number
}
export type WaveformPeaks = { peaksPerSecond: number; data: Int8Array } // [min,max] pairs

export interface TimelineMediaPreviews {
  filmstrip(storageObjectId: string): FilmstripSprite | 'pending' | 'none'
  waveform(storageObjectId: string): WaveformPeaks | 'pending' | 'none'
  request(storageObjectIds: readonly string[]): void
  subscribe(listener: () => void): () => void
}

/** The previews of a timeline without media (tests, a project without storage). */
export const NO_TIMELINE_MEDIA_PREVIEWS: TimelineMediaPreviews = Object.freeze({
  filmstrip: () => 'none' as const,
  waveform: () => 'none' as const,
  request: () => {},
  subscribe: () => () => {},
})

export type TimelineMediaPreviewBatchItem = DeliveryUrlsBatchResult['items'][number]
type TimelineMediaPreviewOkItem = Extract<TimelineMediaPreviewBatchItem, { status: 'ok' }>

/** A failed HTTP answer; `status` decides between `'none'` (4xx) and a retry (5xx, 408, 429). */
export class TimelinePreviewHttpError extends Error {
  constructor(readonly status: number, message = `Timeline preview request failed (${status})`) {
    super(message)
    this.name = 'TimelinePreviewHttpError'
  }
}

export type TimelineMediaPreviewsOptions = {
  channelId: string
  /** Test seam: one batch delivery call (`POST .../objects/delivery-urls`) for one preview variant. */
  fetchBatch?: (input: {
    channelId: string
    variant: StorageDeliveryPreviewVariant
    objectIds: readonly string[]
    expiresInSeconds: number
    signal: AbortSignal
  }) => Promise<readonly TimelineMediaPreviewBatchItem[]>
  /**
   * Test seam: the audiowaveform JSON v2 body of one object whose batch answer offered peaks (`url` is that signed URL).
   * The default reads it through `/api/storage/waveform`. Throws `TimelinePreviewHttpError` for an HTTP failure.
   */
  fetchPeaks?: (input: {
    channelId: string
    objectId: string
    url: string
    signal: AbortSignal
  }) => Promise<unknown>
  /** Test seams. */
  now?: () => number
  setTimer?: (callback: () => void, delayMs: number) => unknown
  clearTimer?: (handle: unknown) => void
  queueMicrotask?: (callback: () => void) => void
}

/** Signed URLs are re-minted this long before they expire. */
export const TIMELINE_PREVIEW_URL_REFRESH_MARGIN_MS = 60_000
/** An unavailable preview may be asked again after this long (its ingest may still be running). */
export const TIMELINE_PREVIEW_NONE_RETRY_MS = 60_000
/** Requested signed URL lifetime (the gateway caps it). */
export const TIMELINE_PREVIEW_URL_EXPIRES_IN_SECONDS = 3_600
const TRANSIENT_RETRY_BASE_MS = 1_000
const TRANSIENT_RETRY_MAX_MS = 30_000
/** Consecutive transient failures before an id settles as `'none'` (a later request may try again after 60 s). */
const TRANSIENT_RETRY_MAX_ATTEMPTS = 5
const MAX_CONCURRENT_PEAK_FETCHES = 4
const MAX_FILMSTRIP_TILES = 10_000
const PREVIEW_VARIANTS = ['filmstrip', 'waveform'] as const satisfies readonly StorageDeliveryPreviewVariant[]

type Entry<T> = {
  state: 'pending' | 'ready' | 'none'
  /** The shown sprite / peaks; a sprite stays while its URL is re-minted. */
  value: T | null
  /** When the signed URL behind a sprite stops being usable. */
  expiresAtMs: number
  /** Queued for the next flush or inside a running batch. */
  busy: boolean
  settledAtMs: number
  failures: number
  retryTimer: unknown
}

export function createTimelineMediaPreviews(
  options: TimelineMediaPreviewsOptions,
): TimelineMediaPreviews & { dispose(): void } {
  const channelId = options.channelId
  const fetchBatch = options.fetchBatch ?? defaultFetchBatch
  const fetchPeaks = options.fetchPeaks ?? defaultFetchPeaks
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((callback: () => void, delayMs: number) => globalThis.setTimeout(callback, delayMs))
  const clearTimer = options.clearTimer
    ?? ((handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>))
  const scheduleMicrotask = options.queueMicrotask ?? ((callback: () => void) => globalThis.queueMicrotask(callback))

  const filmstrips = new Map<string, Entry<FilmstripSprite>>()
  const waveforms = new Map<string, Entry<WaveformPeaks>>()
  const queued: Record<StorageDeliveryPreviewVariant, Set<string>> = { filmstrip: new Set(), waveform: new Set() }
  const listeners = new Set<() => void>()
  const controllers = new Set<AbortController>()
  const peakSlotWaiters: Array<() => void> = []
  let activePeakFetches = 0
  let flushScheduled = false
  let disposed = false

  const entriesOf = (variant: StorageDeliveryPreviewVariant): Map<string, Entry<unknown>> =>
    (variant === 'filmstrip' ? filmstrips : waveforms) as Map<string, Entry<unknown>>

  const entryFor = (variant: StorageDeliveryPreviewVariant, id: string): Entry<unknown> => {
    const entries = entriesOf(variant)
    let entry = entries.get(id)
    if (!entry) {
      entry = { state: 'pending', value: null, expiresAtMs: 0, busy: false, settledAtMs: 0, failures: 0, retryTimer: null }
      entries.set(id, entry)
    }
    return entry
  }

  const needsLoad = (variant: StorageDeliveryPreviewVariant, entry: Entry<unknown> | undefined, at: number): boolean => {
    if (!entry) return true
    if (entry.busy || entry.retryTimer !== null) return false
    if (entry.state === 'none') return at - entry.settledAtMs >= TIMELINE_PREVIEW_NONE_RETRY_MS
    if (entry.state === 'ready') {
      // Peaks are fetched once per object; a sprite URL is re-minted shortly before it expires.
      return variant === 'filmstrip' && at >= entry.expiresAtMs - TIMELINE_PREVIEW_URL_REFRESH_MARGIN_MS
    }
    return true
  }

  const enqueue = (variant: StorageDeliveryPreviewVariant, id: string) => {
    entryFor(variant, id).busy = true
    queued[variant].add(id)
    if (flushScheduled) return
    flushScheduled = true
    scheduleMicrotask(flush)
  }

  const notify = () => {
    if (disposed) return
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // A failing listener never stops the others.
      }
    }
  }

  function flush() {
    flushScheduled = false
    if (disposed) return
    for (const variant of PREVIEW_VARIANTS) {
      const ids = [...queued[variant]]
      queued[variant].clear()
      for (let offset = 0; offset < ids.length; offset += STORAGE_DELIVERY_URL_BATCH_SIZE) {
        void runBatch(variant, ids.slice(offset, offset + STORAGE_DELIVERY_URL_BATCH_SIZE))
      }
    }
  }

  const settleReady = (entry: Entry<unknown>, value: unknown, at: number, expiresAtMs = 0) => {
    entry.state = 'ready'
    entry.value = value
    entry.expiresAtMs = expiresAtMs
    entry.busy = false
    entry.failures = 0
    entry.settledAtMs = at
  }

  const settleNone = (entry: Entry<unknown>, at: number) => {
    entry.state = 'none'
    entry.value = null
    entry.expiresAtMs = 0
    entry.busy = false
    entry.failures = 0
    entry.settledAtMs = at
  }

  /** A transient failure: retry after a bounded backoff, or settle after a few attempts. */
  const settleTransient = (variant: StorageDeliveryPreviewVariant, id: string, entry: Entry<unknown>, at: number) => {
    entry.busy = false
    entry.failures += 1
    if (entry.failures >= TRANSIENT_RETRY_MAX_ATTEMPTS) {
      // A sprite already shown stays (its URL may still work); otherwise there is nothing to show.
      if (entry.state === 'ready') {
        entry.failures = 0
        entry.settledAtMs = at
      } else {
        settleNone(entry, at)
      }
      return
    }
    const delayMs = Math.min(TRANSIENT_RETRY_BASE_MS * 2 ** (entry.failures - 1), TRANSIENT_RETRY_MAX_MS)
    entry.retryTimer = setTimer(() => {
      entry.retryTimer = null
      if (disposed || entriesOf(variant).get(id) !== entry) return
      enqueue(variant, id)
    }, delayMs)
  }

  async function runBatch(variant: StorageDeliveryPreviewVariant, ids: string[]) {
    const controller = new AbortController()
    controllers.add(controller)
    try {
      let items: readonly TimelineMediaPreviewBatchItem[]
      try {
        items = await fetchBatch({
          channelId,
          variant,
          objectIds: ids,
          expiresInSeconds: TIMELINE_PREVIEW_URL_EXPIRES_IN_SECONDS,
          signal: controller.signal,
        })
      } catch (error) {
        if (disposed) return
        const at = now()
        const transient = isTransientFailure(error)
        for (const id of ids) {
          const entry = entryFor(variant, id)
          if (transient) settleTransient(variant, id, entry, at)
          else settleNone(entry, at)
        }
        notify()
        return
      }
      if (disposed) return
      const itemById = new Map<string, TimelineMediaPreviewBatchItem>()
      for (const item of Array.isArray(items) ? items : []) itemById.set(item.object_id, item)
      const at = now()
      const peakLoads: Array<Promise<void>> = []
      for (const id of ids) {
        const entry = entryFor(variant, id)
        const item = itemById.get(id)
        if (!item) {
          settleNone(entry, at)
        } else if (item.status === 'error') {
          if (isTransientItemError(item.error.code)) settleTransient(variant, id, entry, at)
          else settleNone(entry, at)
        } else if (variant === 'filmstrip') {
          settleFilmstrip(entry as Entry<FilmstripSprite>, item, at)
        } else {
          peakLoads.push(loadPeaks(id, entry as Entry<WaveformPeaks>, item, controller.signal))
        }
      }
      await Promise.all(peakLoads)
      if (disposed) return
      notify()
    } finally {
      controllers.delete(controller)
    }
  }

  const settleFilmstrip = (entry: Entry<FilmstripSprite>, item: TimelineMediaPreviewOkItem, at: number) => {
    const sprite = filmstripSpriteFromDelivery(item)
    const expiresAtMs = Date.parse(item.expires_at)
    if (!sprite || !Number.isFinite(expiresAtMs)) {
      settleNone(entry, at)
      return
    }
    // Same URL and layout: keep the object already handed out (stable identity for render).
    const current = entry.value
    settleReady(entry, current && sameSprite(current, sprite) ? current : sprite, at, expiresAtMs)
  }

  async function loadPeaks(id: string, entry: Entry<WaveformPeaks>, item: TimelineMediaPreviewOkItem, signal: AbortSignal) {
    await acquirePeakSlot()
    try {
      if (disposed) return
      let body: unknown
      try {
        body = await fetchPeaks({ channelId, objectId: id, url: item.url, signal })
      } catch (error) {
        if (disposed) return
        if (isTransientFailure(error)) settleTransient('waveform', id, entry, now())
        else settleNone(entry, now())
        return
      }
      if (disposed) return
      const peaks = parseWaveformPeaks(body, item.descriptor)
      if (peaks) settleReady(entry, peaks, now())
      else settleNone(entry, now())
    } finally {
      releasePeakSlot()
    }
  }

  function acquirePeakSlot(): Promise<void> {
    if (activePeakFetches < MAX_CONCURRENT_PEAK_FETCHES) {
      activePeakFetches += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      peakSlotWaiters.push(() => {
        activePeakFetches += 1
        resolve()
      })
    })
  }

  function releasePeakSlot() {
    activePeakFetches -= 1
    peakSlotWaiters.shift()?.()
  }

  return {
    filmstrip(storageObjectId) {
      return readEntry(filmstrips.get(storageObjectId))
    },
    waveform(storageObjectId) {
      return readEntry(waveforms.get(storageObjectId))
    },
    request(storageObjectIds) {
      if (disposed) return
      const at = now()
      for (const id of storageObjectIds) {
        if (typeof id !== 'string' || id.length === 0) continue
        if (needsLoad('filmstrip', filmstrips.get(id), at)) enqueue('filmstrip', id)
        if (needsLoad('waveform', waveforms.get(id), at)) enqueue('waveform', id)
      }
    },
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      for (const controller of controllers) controller.abort()
      controllers.clear()
      for (const entries of [filmstrips, waveforms] as Array<Map<string, Entry<unknown>>>) {
        for (const entry of entries.values()) {
          if (entry.retryTimer !== null) clearTimer(entry.retryTimer)
          entry.retryTimer = null
        }
        entries.clear()
      }
      queued.filmstrip.clear()
      queued.waveform.clear()
      // Wake the queued peak loads so they end (they see `disposed`) instead of hanging.
      for (const wake of peakSlotWaiters.splice(0)) wake()
    },
  }
}

function readEntry<T>(entry: Entry<T> | undefined): T | 'pending' | 'none' {
  if (!entry) return 'pending'
  if (entry.value) return entry.value
  return entry.state === 'none' ? 'none' : 'pending'
}

/** The sprite of a successful `filmstrip` delivery, or null when its descriptor is not a usable tile layout. */
export function filmstripSpriteFromDelivery(item: {
  url: string
  descriptor?: StorageDeliveryPreviewDescriptor
}): FilmstripSprite | null {
  const descriptor = item.descriptor
  if (!descriptor || !item.url) return null
  const tileCount = positiveInteger(descriptor['tile_count'])
  const columns = positiveInteger(descriptor['columns'])
  const rows = positiveInteger(descriptor['rows'])
  const tileWidth = positiveInteger(descriptor['tile_width'])
  const tileHeight = positiveInteger(descriptor['tile_height'])
  const intervalMs = positiveInteger(descriptor['interval_ms'])
  if (!tileCount || !columns || !rows || !tileWidth || !tileHeight || !intervalMs) return null
  // The engine lays tiles row by row: every row but the last is full, and no row is empty.
  if (tileCount > MAX_FILMSTRIP_TILES || columns * rows < tileCount || (rows - 1) * columns >= tileCount) return null
  return Object.freeze({ url: item.url, tileCount, columns, rows, tileWidth, tileHeight, intervalMs })
}

/**
 * The [min,max] int8 pairs of an audiowaveform JSON v2 body, or null when the body is not 8-bit mono v2 peaks. The rate
 * comes from the delivery descriptor (`peaks_per_second`), else from the body (`sample_rate / samples_per_pixel`).
 */
export function parseWaveformPeaks(body: unknown, descriptor?: StorageDeliveryPreviewDescriptor): WaveformPeaks | null {
  const waveform = readAudiowaveformV2(body)
  if (!waveform) return null
  const peaksPerSecond = positiveFinite(descriptor?.['peaks_per_second'])
    ?? positiveFinite(waveform.sample_rate / waveform.samples_per_pixel)
  if (!peaksPerSecond) return null
  return Object.freeze({ peaksPerSecond, data: Int8Array.from(waveform.data) })
}

function sameSprite(left: FilmstripSprite, right: FilmstripSprite): boolean {
  return left.url === right.url
    && left.tileCount === right.tileCount
    && left.columns === right.columns
    && left.rows === right.rows
    && left.tileWidth === right.tileWidth
    && left.tileHeight === right.tileHeight
    && left.intervalMs === right.intervalMs
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function positiveFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Network failures, 5xx, 408 and 429 are retried; any other HTTP failure means the preview is unavailable. */
function isTransientFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) return true
  const status = (error as { status?: unknown }).status
  if (typeof status !== 'number' || !Number.isInteger(status) || status <= 0) return true
  return status >= 500 || status === 408 || status === 429
}

/** Per-item gateway errors worth retrying (capacity, internal); every other item error settles as `'none'`. */
function isTransientItemError(code: string): boolean {
  return code === 'STORAGE_DELIVERY_BACKPRESSURE' || code === 'INTERNAL_ERROR' || code === 'SERVICE_UNAVAILABLE'
}

async function defaultFetchBatch(input: {
  channelId: string
  variant: StorageDeliveryPreviewVariant
  objectIds: readonly string[]
  expiresInSeconds: number
  signal: AbortSignal
}): Promise<readonly TimelineMediaPreviewBatchItem[]> {
  const result = await getStorageDeliveryUrls({
    channelId: input.channelId,
    items: input.objectIds.map((objectId) => ({
      objectId,
      variant: input.variant,
      expiresInSeconds: input.expiresInSeconds,
    })),
    signal: input.signal,
  })
  return result.items
}

/** Same-origin read through `/api/storage/waveform` (see the module comment about CORS). */
async function defaultFetchPeaks(input: { channelId: string; objectId: string; signal: AbortSignal }): Promise<unknown> {
  const params = new URLSearchParams({ channelId: input.channelId, objectId: input.objectId })
  const response = await fetch(`/api/storage/waveform?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    signal: input.signal,
  })
  if (!response.ok) throw new TimelinePreviewHttpError(response.status)
  try {
    return await response.json()
  } catch {
    // An unreadable body is not worth retrying.
    throw new TimelinePreviewHttpError(422, 'Timeline waveform answer was not JSON')
  }
}

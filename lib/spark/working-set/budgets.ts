/**
 * P05-11 working-set budgets of the Spark editor for long projects (two and ten minutes, mixed scene and layer
 * media, large images and GIFs, continuous scroll/seek/reopen).
 *
 * The three device classes are the ones P07-13 froze (contracts/agentic-spark/perf-measurement/v1/devices) and the
 * numbers are the frozen candidate limits of thresholds/spark-perf-thresholds.r1.json. They are the planner's hard
 * caps, NOT measured capacity: a test compares each with the frozen file, so a threshold revision cannot drift from
 * what the planner enforces. The assumptions below (frames a decoder holds, look-ahead) are unmeasured starting
 * values; a device run (P07-13) confirms or replaces them.
 *
 * Framework-free and browser-storage-free: state lives in memory only.
 */

export type WorkingSetDeviceClass = 'desktop-reference' | 'laptop-constrained' | 'narrow-viewport'

export const WORKING_SET_DEVICE_CLASSES: readonly WorkingSetDeviceClass[] = [
  'desktop-reference',
  'laptop-constrained',
  'narrow-viewport',
]

export const MIB = 1024 * 1024

export interface WorkingSetBudget {
  readonly deviceClass: WorkingSetDeviceClass
  /** `<video>` elements mounted at once, look-ahead included (editor.dom.live_media_elements). */
  readonly maxLiveVideoElements: number
  /** Visual decoders (video, animated image) active plus look-ahead (editor.decoder.active_decoders). */
  readonly maxActiveDecoders: number
  /** Decoded frame and image memory the working set may hold, bytes (editor.decoded_memory.mib). */
  readonly maxDecodedBytes: number
  /** Scene cards rendered at once (editor.strip.rendered_cards). */
  readonly maxRenderedCards: number
  /** Thumbnail and poster requests waiting in the client queue (delivery.thumbnail_queue.depth). */
  readonly maxThumbnailQueueDepth: number
  /** Thumbnail and poster requests running at once. */
  readonly thumbnailConcurrency: number
  /** Thumbnail and poster requests taken from the queue together. */
  readonly thumbnailBatchSize: number
  /** Bytes of partial downloads in flight (delivery.working_set.in_flight_mib). */
  readonly maxInFlightBytes: number
  /** Tallest video rung the editor preview decodes on this class (the derivative ladder is 360/720/1080). */
  readonly videoProxyMaxHeight: number
}

export const WORKING_SET_BUDGETS: Readonly<Record<WorkingSetDeviceClass, WorkingSetBudget>> = {
  'desktop-reference': {
    deviceClass: 'desktop-reference',
    maxLiveVideoElements: 6,
    maxActiveDecoders: 3,
    maxDecodedBytes: 256 * MIB,
    maxRenderedCards: 40,
    maxThumbnailQueueDepth: 64,
    thumbnailConcurrency: 6,
    thumbnailBatchSize: 24,
    maxInFlightBytes: 64 * MIB,
    videoProxyMaxHeight: 1080,
  },
  'laptop-constrained': {
    deviceClass: 'laptop-constrained',
    maxLiveVideoElements: 4,
    maxActiveDecoders: 2,
    maxDecodedBytes: 128 * MIB,
    maxRenderedCards: 40,
    maxThumbnailQueueDepth: 64,
    thumbnailConcurrency: 4,
    thumbnailBatchSize: 16,
    maxInFlightBytes: 32 * MIB,
    videoProxyMaxHeight: 720,
  },
  'narrow-viewport': {
    deviceClass: 'narrow-viewport',
    maxLiveVideoElements: 4,
    maxActiveDecoders: 2,
    maxDecodedBytes: 96 * MIB,
    maxRenderedCards: 40,
    maxThumbnailQueueDepth: 32,
    thumbnailConcurrency: 3,
    thumbnailBatchSize: 8,
    maxInFlightBytes: 32 * MIB,
    videoProxyMaxHeight: 720,
  },
}

/** Limits that do not depend on the device class, and the planner's unmeasured assumptions. */
export const WORKING_SET_LIMITS = {
  /** S27 / P02-14: the largest original a grid or card decodes, by bytes (never by extension). */
  previewOriginalMaxBytes: 2 * MIB,
  /** An original a grid or card may decode must also stay under this many decoded megapixels (frames x w x h). */
  gridMaxDecodedMegapixels: 16,
  /** A missing derivative may fall back to an original only up to this size (P02-14 image fallback). */
  originalFallbackMaxBytes: 256 * 1024,
  /** One Range window of the playback BFF (STORAGE_PLAYBACK_CHUNK_BYTES). */
  rangeChunkBytes: 2 * MIB,
  /** Delivery URLs minted per request (STORAGE_DELIVERY_URL_BATCH_SIZE). */
  deliveryBatchSize: 64,
  /** An audio placement this small is fetched whole; a longer one is streamed by Range. */
  audioBufferMaxBytes: 256 * 1024,
  bytesPerPixel: 4,
  /** Decoded frames a video decoder holds (assumption). */
  videoRingFrames: 4,
  /** The video derivative ladder heights: adaptive 360/720/1080, never above the source (KARAR-MEDYA). */
  proxyLadderHeights: [360, 720, 1080] as readonly number[],
  /** Canvas still: longest edge of the detail image derivative (KARAR-MEDYA: 1280). */
  stillLongEdge: 1280,
  /** Card poster: longest edge of the grid poster derivative (KARAR-MEDYA: 320/640). */
  cardPosterLongEdge: 320,
  /** Prepare media that starts within this many seconds of the playhead while playing (assumption). */
  lookaheadSeconds: 3,
  /** Mount timeline items this many seconds outside the visible range (assumption). */
  timelineOverscanSeconds: 5,
  /** Rows kept above and below the visible cards (same as listWindow). */
  cardOverscan: 4,
  /** Bytes a derivative JPEG/WebP takes per pixel (assumption; used only to size a transfer estimate). */
  derivativeBytesPerPixel: 0.25,
} as const

export interface ScenePosterProfile {
  readonly width: number
  readonly height: number
  /** Bytes one poster moves over the network (assumption). */
  readonly transferBytes: number
}

/**
 * What a scene card poster decodes to. `scene-card-v1` is what P02-13 produces today (the frame service output
 * resolution); with 40 cards it decodes to about 147 MB, more than the laptop and narrow classes may hold, so the
 * planner keeps only as many as fit. `scene-card-thumb-v1` is the card-sized profile P02-13 left open (Kalan,
 * open question 3); the planner's tests show both.
 */
export const SCENE_POSTER_PROFILES: Readonly<Record<'scene-card-v1' | 'scene-card-thumb-v1', ScenePosterProfile>> = {
  'scene-card-v1': { width: 1280, height: 720, transferBytes: 450_000 },
  'scene-card-thumb-v1': { width: 320, height: 180, transferBytes: 14_000 },
}

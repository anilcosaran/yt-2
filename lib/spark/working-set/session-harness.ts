/**
 * P05-11 test support: a deterministic model of an editor session that drives the working-set planner, the media
 * grid planner, the metadata page window, the thumbnail queue and the delivery ledger against a fake Storage (mint
 * latency, expiry, revoke) on a manual clock, with the interaction steps of the P07-13 plan (open, scroll the strip,
 * seek, play, scrub, reopen, idle, open the media grid, revoke).
 *
 * It COUNTS what the planners decide (mounted elements, decoders, estimated decoded bytes, requests the fake Storage
 * received, queue depth); it does not measure a device. A report says what the design does under a frozen mix, never
 * what a browser did. Not imported by application code.
 */

import {
  MIB,
  SCENE_POSTER_PROFILES,
  WORKING_SET_BUDGETS,
  WORKING_SET_LIMITS as LIMITS,
  type ScenePosterProfile,
  type WorkingSetDeviceClass,
} from './budgets'
import { DeliveryLeaseLedger, LEASE_DEFAULTS, type LeaseRequest, type LeaseWant } from './delivery-leases'
import { fitLongEdge, megapixels, originalDecodedMegapixels } from './decode-estimate'
import { planMediaGrid, type MediaGridPlan } from './grid-planner'
import { MetadataPageWindow } from './metadata-pages'
import { buildWorkingSetIndex, planWorkingSet, summarizePlan, type WsPlan, type WsViewState, type WsWant } from './planner'
import { manualClock, mulberry32, nearestRank } from './test-support'
import { ThumbnailQueue } from './thumbnail-queue'
import type { WsAsset, WsProject } from './types'

export const TICK_MS = 50
const IDLE_TICK_MS = 1_000
const GRID_PAGE_SIZE = 50

export interface SessionOptions {
  project: WsProject
  deviceClass: WorkingSetDeviceClass
  seed: number
  posterProfile?: ScenePosterProfile
  missingDerivatives?: ReadonlySet<string>
  mintLatencyMs?: number
  loadLatencyMs?: number
  pageLatencyMs?: number
  /** Lifetime of a minted URL; the real delivery URLs live an hour, a soak may shorten it to exercise expiry. */
  tokenTtlMs?: number
  visibleCards?: number
  visibleGridCells?: number
  viewSeconds?: number
}

export interface SpyEntry {
  atMs: number
  key: string
  objectId: string
  purpose: string
  variant: string
  sizeBytes: number
  reason: string
  afterRevoke: boolean
}

type Event = { at: number; seq: number; run: () => void }

/** The P07-13 metric ids this model can count; the rest of a run's metrics are timing or device facts. */
export const MODELLED_METRICS = [
  'editor.dom.live_media_elements',
  'editor.dom.strip_live_video_or_iframe',
  'editor.strip.rendered_cards',
  'editor.decoder.active_decoders',
  'editor.decoded_memory.mib',
  'delivery.grid.original_over_budget',
  'delivery.grid.decoded_megapixels_max',
  'delivery.thumbnail_queue.depth',
  'delivery.thumbnail_queue.oldest_age_ms',
  'delivery.working_set.in_flight_mib',
  'delivery.expiry.expired_url_served_count',
  'delivery.revoke.requests_after_revoke',
] as const

export type SessionReport = Record<(typeof MODELLED_METRICS)[number], number>

export class WorkingSetSession {
  readonly clock = manualClock()
  readonly spy: SpyEntry[] = []
  readonly revoked = new Map<string, number>()
  readonly budget
  private readonly index
  private readonly random
  private readonly options
  private readonly library: WsAsset[]
  private ledger: DeliveryLeaseLedger
  private queue: ThumbnailQueue
  private pages: MetadataPageWindow
  private readonly events: Event[] = []
  private seq = 0
  private readonly urlExpiry = new Map<string, number>()
  private admitted = new Set<string>()
  private loaded = new Set<string>()
  private mode: 'editor' | 'grid' = 'editor'
  private view: WsViewState
  private gridView: { first: number; last: number }
  private gridDirection: -1 | 0 | 1 = 0
  private gridTotal: number | null = null
  private plan: WsPlan | null = null
  private gridPlan: MediaGridPlan | null = null
  private currentWants: readonly WsWant[] = []
  private playheadAccumulator = 0
  private readonly counters = {
    liveVideoElements: 0,
    activeDecoders: 0,
    decodedBytes: 0,
    renderedCards: 0,
    mountedItems: 0,
    liveMediaOnCards: 0,
    cardStreamWants: 0,
    maxGridMegapixels: 0,
    expiredUrlsServed: 0,
    maxInFlightBytes: 0,
    degraded: 0,
    ticks: 0,
    pageRequests: 0,
  }
  private readonly samples = { depth: [] as number[], age: [] as number[] }

  constructor(options: SessionOptions) {
    this.options = {
      mintLatencyMs: 80,
      loadLatencyMs: 120,
      pageLatencyMs: 100,
      tokenTtlMs: 3_600_000,
      visibleCards: 12,
      visibleGridCells: 24,
      viewSeconds: 30,
      posterProfile: SCENE_POSTER_PROFILES['scene-card-v1'],
      ...options,
    }
    this.budget = WORKING_SET_BUDGETS[options.deviceClass]
    this.index = buildWorkingSetIndex(options.project)
    this.random = mulberry32(options.seed)
    this.library = [...options.project.assets.values()].sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0))
    this.ledger = this.newLedger()
    this.queue = this.newQueue()
    this.pages = this.newPages()
    this.view = this.initialView()
    this.gridView = { first: 0, last: this.options.visibleGridCells - 1 }
  }

  // -- the P07-13 interaction steps ---------------------------------------------------------------------------------

  /** open_project: playhead at the start, first cards visible; settles for two seconds. */
  open(): void {
    this.mode = 'editor'
    this.view = this.initialView()
    this.playheadAccumulator = 0
    this.ticks(Math.round(2_000 / TICK_MS))
  }

  /** open_media_grid: the media list from its first cell; the first page reports the list length. */
  openMediaGrid(): void {
    this.mode = 'grid'
    this.gridView = { first: 0, last: this.options.visibleGridCells - 1 }
    this.gridDirection = 0
    this.gridTotal = null
    this.pages = this.newPages()
    this.ticks(Math.round(2_000 / TICK_MS))
  }

  /** close_project: leases are released (usable ones retained), the queue and the players are gone. */
  close(): void {
    this.view = { ...this.view, playing: false }
    this.ledger.releaseAll()
    this.queue.setWanted([])
    this.admitted.clear()
    this.loaded.clear()
    this.queue = this.newQueue()
    this.plan = null
    this.gridPlan = null
    this.currentWants = []
  }

  /** reopen_project: open again on the same ledger, so still-valid leases are reused. */
  reopen(): void {
    this.open()
  }

  /** scroll_strip: `count` fast scroll steps over the scene list (or the media grid), one tick apart, without waiting. */
  scrollStrip(count: number): void {
    if (this.mode === 'grid') {
      const total = this.library.length
      const cells = this.options.visibleGridCells
      const step = Math.max(1, Math.floor(total / Math.max(1, count)))
      for (let at = 1; at <= count; at += 1) {
        const first = Math.min(Math.max(0, total - cells), at * step)
        this.gridDirection = 1
        this.gridView = { first, last: Math.min(total - 1, first + cells - 1) }
        this.ticks(1)
      }
      this.settle()
      return
    }
    const scenes = this.options.project.scenes.length
    const step = Math.max(1, Math.floor(scenes / Math.max(1, count)))
    for (let at = 1; at <= count; at += 1) {
      const first = Math.min(Math.max(0, scenes - this.options.visibleCards), at * step)
      this.view = { ...this.view, cardRange: { first, last: Math.min(scenes - 1, first + this.options.visibleCards - 1) } }
      this.ticks(1)
    }
    this.settle()
  }

  /** seek_random: `count` seeded seeks; the strip and the timeline follow the playhead. */
  seekRandom(count: number): void {
    const total = this.options.project.totalFrames
    for (let at = 0; at < count; at += 1) {
      this.setPlayhead(Math.floor(this.random() * total))
      this.ticks(3)
    }
    this.settle()
  }

  /** scrub_drag: `count` continuous drags over `spanSeconds`, twenty steps each. */
  scrub(count: number, spanSeconds: number): void {
    const project = this.options.project
    for (let drag = 0; drag < count; drag += 1) {
      const span = Math.round(spanSeconds * project.fps)
      const start = Math.floor(this.random() * Math.max(1, project.totalFrames - span))
      for (let step = 0; step <= 20; step += 1) {
        this.setPlayhead(start + Math.round((span * step) / 20))
        this.ticks(1)
      }
    }
    this.settle()
  }

  /** play: the playhead advances in real time for `durationMs`; the timeline follows it. */
  play(durationMs: number): void {
    this.view = { ...this.view, playing: true }
    this.playheadAccumulator = this.view.playheadFrame
    const project = this.options.project
    for (let elapsed = 0; elapsed < durationMs; elapsed += TICK_MS) {
      this.playheadAccumulator = Math.min(project.totalFrames - 1, this.playheadAccumulator + (project.fps * TICK_MS) / 1000)
      this.setPlayhead(Math.floor(this.playheadAccumulator), { keepPlaying: true })
      this.ticks(1)
    }
    this.view = { ...this.view, playing: false }
  }

  /** idle: nothing happens on screen; the clock moves (one plan a second). */
  idle(durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += IDLE_TICK_MS) this.ticks(1, IDLE_TICK_MS)
  }

  settle(): void {
    this.ticks(Math.round(1_500 / TICK_MS))
  }

  /** revoke_access: the server revokes `count` of the objects the plan is using; returns their ids. */
  revokeAccess(count: number): string[] {
    const chosen = [...new Set(this.currentWants.filter((want) => want.surface === 'canvas').map((want) => want.objectId))].sort().slice(0, count)
    for (const objectId of chosen) this.revoked.set(objectId, this.clock.now())
    return chosen
  }

  /** mint_after_revoke: the actor keeps asking; `attempts` rounds of the plan and the ledger with the view unchanged. */
  mintAfterRevoke(attempts: number): void {
    for (let round = 0; round < attempts; round += 1) this.ticks(2, 500)
  }

  // -- reading the session ---------------------------------------------------------------------------------------------

  get ledgerSnapshot() {
    return this.ledger.snapshot()
  }

  get queueStats() {
    return this.queue.stats()
  }

  get pageStats() {
    return { ...this.pages.stats(), requests: this.counters.pageRequests }
  }

  get currentPlan(): WsPlan | null {
    return this.plan
  }

  get currentGridPlan(): MediaGridPlan | null {
    return this.gridPlan
  }

  get tickCount(): number {
    return this.counters.ticks
  }

  /** The most cards, cells or items shown as a placeholder or poster because of a budget at any one time. */
  get maxDegraded(): number {
    return this.counters.degraded
  }

  get maxMountedItems(): number {
    return this.counters.mountedItems
  }

  requestsAfterRevoke(): Map<string, number> {
    const counted = new Map<string, number>()
    for (const entry of this.spy) if (entry.afterRevoke) counted.set(entry.objectId, (counted.get(entry.objectId) ?? 0) + 1)
    return counted
  }

  /** What the frozen metrics count, as this run's model saw it. Percentiles are nearest-rank over the tick samples. */
  report(): SessionReport {
    const grid = this.spy.filter((entry) => entry.purpose === 'grid')
    return {
      'editor.dom.live_media_elements': this.counters.liveVideoElements,
      'editor.dom.strip_live_video_or_iframe': this.counters.liveMediaOnCards + this.counters.cardStreamWants,
      'editor.strip.rendered_cards': this.counters.renderedCards,
      'editor.decoder.active_decoders': this.counters.activeDecoders,
      'editor.decoded_memory.mib': this.counters.decodedBytes / MIB,
      'delivery.grid.original_over_budget': grid.filter((entry) => entry.variant === 'original' && entry.sizeBytes > LIMITS.previewOriginalMaxBytes).length,
      'delivery.grid.decoded_megapixels_max': this.counters.maxGridMegapixels,
      'delivery.thumbnail_queue.depth': this.samples.depth.length ? nearestRank(this.samples.depth, 95) : 0,
      'delivery.thumbnail_queue.oldest_age_ms': this.samples.age.length ? nearestRank(this.samples.age, 95) : 0,
      'delivery.working_set.in_flight_mib': this.counters.maxInFlightBytes / MIB,
      'delivery.expiry.expired_url_served_count': this.counters.expiredUrlsServed,
      'delivery.revoke.requests_after_revoke': Math.max(0, ...this.requestsAfterRevoke().values()),
    }
  }

  // -- internals -------------------------------------------------------------------------------------------------------

  private newLedger(): DeliveryLeaseLedger {
    return new DeliveryLeaseLedger({ ...LEASE_DEFAULTS, now: this.clock.now, maxInFlightBytes: this.budget.maxInFlightBytes })
  }

  private newQueue(): ThumbnailQueue {
    return new ThumbnailQueue({
      maxDepth: this.budget.maxThumbnailQueueDepth,
      maxInFlight: this.budget.thumbnailConcurrency,
      batchSize: this.budget.thumbnailBatchSize,
      failureCooldownMs: 10_000,
      now: this.clock.now,
    })
  }

  private newPages(): MetadataPageWindow {
    return new MetadataPageWindow({
      pageSize: GRID_PAGE_SIZE,
      maxResidentPages: 8,
      maxInFlightPages: 2,
      prefetchPages: 2,
      failureCooldownMs: 5_000,
      now: this.clock.now,
    })
  }

  private initialView(): WsViewState {
    const project = this.options.project
    const span = Math.round(this.options.viewSeconds * project.fps)
    return {
      playheadFrame: 0,
      playing: false,
      timelineView: { startFrame: 0, endFrame: span },
      cardRange: { first: 0, last: Math.min(project.scenes.length - 1, this.options.visibleCards - 1) },
    }
  }

  private setPlayhead(frame: number, keep: { keepPlaying?: boolean } = {}): void {
    const project = this.options.project
    const clamped = Math.min(project.totalFrames - 1, Math.max(0, frame))
    const span = Math.round(this.options.viewSeconds * project.fps)
    const start = Math.max(0, Math.min(project.totalFrames - span, clamped - Math.floor(span / 2)))
    const scenes = project.scenes
    let sceneIndex = 0
    for (let at = 0; at < scenes.length; at += 1) {
      if (scenes[at]!.startFrame <= clamped) sceneIndex = at
      else break
    }
    const first = Math.max(0, Math.min(scenes.length - this.options.visibleCards, sceneIndex - Math.floor(this.options.visibleCards / 2)))
    this.view = {
      ...this.view,
      playing: keep.keepPlaying ? this.view.playing : false,
      playheadFrame: clamped,
      timelineView: { startFrame: start, endFrame: start + span },
      cardRange: { first, last: Math.min(scenes.length - 1, first + this.options.visibleCards - 1) },
    }
  }

  private ticks(count: number, stepMs = TICK_MS): void {
    for (let at = 0; at < count; at += 1) {
      this.tick()
      this.clock.advance(stepMs)
    }
  }

  private schedule(at: number, run: () => void): void {
    this.events.push({ at, seq: this.seq, run })
    this.seq += 1
  }

  private runDue(now: number): void {
    for (;;) {
      this.events.sort((a, b) => a.at - b.at || a.seq - b.seq)
      const next = this.events[0]
      if (!next || next.at > now) return
      this.events.shift()
      next.run()
    }
  }

  private toLeaseWant(want: WsWant): LeaseWant {
    return {
      key: want.key,
      objectId: want.objectId,
      intent: want.intent,
      purpose: want.purpose,
      variant: want.variant,
      sizeBytes: want.sizeBytes,
      transferBytes: want.transferBytes,
      priority: want.priority,
    }
  }

  private planEditor(): readonly WsWant[] {
    const plan = planWorkingSet({
      index: this.index,
      view: this.view,
      budget: this.budget,
      missingDerivatives: this.options.missingDerivatives,
      posterProfile: this.options.posterProfile,
    })
    this.plan = plan
    const summary = summarizePlan(plan)
    const c = this.counters
    c.liveVideoElements = Math.max(c.liveVideoElements, summary.liveVideoElements)
    c.activeDecoders = Math.max(c.activeDecoders, summary.activeDecoders)
    c.decodedBytes = Math.max(c.decodedBytes, summary.decodedBytes)
    c.renderedCards = Math.max(c.renderedCards, summary.renderedCards)
    c.mountedItems = Math.max(c.mountedItems, summary.mountedItems)
    c.liveMediaOnCards = Math.max(c.liveMediaOnCards, summary.liveMediaOnCards)
    c.cardStreamWants = Math.max(c.cardStreamWants, summary.cardStreamWants)
    c.degraded = Math.max(c.degraded, summary.degraded)
    return plan.wants
  }

  private planGrid(): readonly WsWant[] {
    const total = this.gridTotal
    const view = this.gridView
    const paging = this.pages.focus({ first: view.first, last: view.last }, this.gridDirection)
    for (const request of paging.fetch) {
      this.counters.pageRequests += 1
      this.schedule(this.clock.now() + this.options.pageLatencyMs, () => {
        if (!this.pages.complete(request.page, request.token)) return
        if (this.gridTotal === null) {
          this.gridTotal = this.library.length // the first page reports the list length
          this.pages.setTotal(this.library.length)
        }
      })
    }
    const plan = planMediaGrid({
      totalCount: total,
      visible: view,
      assetAt: (index) => (this.pages.isLoaded(Math.floor(index / GRID_PAGE_SIZE)) ? (this.library[index] ?? null) : null),
      budget: this.budget,
      missingDerivatives: this.options.missingDerivatives,
    })
    this.gridPlan = plan
    const c = this.counters
    c.decodedBytes = Math.max(c.decodedBytes, plan.decodedBytes)
    c.renderedCards = Math.max(c.renderedCards, plan.renderedCells)
    c.degraded = Math.max(c.degraded, plan.degraded.length)
    return plan.wants
  }

  private tick(): void {
    const now = this.clock.now()
    this.counters.ticks += 1
    this.runDue(now)

    const wants = this.mode === 'grid' ? this.planGrid() : this.planEditor()
    this.currentWants = wants

    // Poster and cell requests pass through the bounded queue; everything else goes straight to the ledger.
    const posters = wants.filter((want) => want.surface === 'card')
    const update = this.queue.setWanted(posters.map((want) => ({ key: want.key, priority: want.priority })))
    for (const key of update.staleInFlight) this.queue.complete(key, 'aborted')
    for (const key of this.queue.takeBatch()) this.admitted.add(key)
    const stillWanted = new Set(posters.map((want) => want.key))
    for (const key of [...this.admitted]) if (!stillWanted.has(key)) this.admitted.delete(key)
    const ledgerWants = wants.filter((want) => want.surface !== 'card' || this.admitted.has(want.key))
    this.ledger.want(ledgerWants.map((want) => this.toLeaseWant(want)))
    const wantedKeys = new Set(ledgerWants.map((want) => want.key))
    for (const key of [...this.loaded]) if (!wantedKeys.has(key)) this.loaded.delete(key)

    const requests = this.ledger.nextRequests()
    if (requests.length > 0) this.startMint(requests, now)
    // A key whose URL is in hand (just minted, or reused from a retained lease) starts its transfer once.
    for (const want of ledgerWants) {
      if (!this.loaded.has(want.key) && this.ledger.urlFor(want.key)) {
        this.loaded.add(want.key)
        this.startLoad(want.key)
      }
    }
    this.consume(wants, now)

    const gauge = this.queue.gauge()
    this.samples.depth.push(gauge.depth)
    this.samples.age.push(gauge.oldestWaitingAgeMs)
    this.counters.maxInFlightBytes = Math.max(this.counters.maxInFlightBytes, this.ledger.snapshot().inFlightBytes)
  }

  private decodedMegapixelsOf(request: LeaseRequest): number {
    if (request.objectId.startsWith('scene:')) {
      const profile = this.options.posterProfile
      return megapixels(profile.width, profile.height)
    }
    const asset = this.options.project.assets.get(request.objectId)
    if (!asset) return 0
    if (request.variant === 'original') return originalDecodedMegapixels(asset)
    const fitted = fitLongEdge(asset.width ?? 0, asset.height ?? 0, LIMITS.cardPosterLongEdge * 2)
    return megapixels(fitted.width, fitted.height)
  }

  private startMint(requests: readonly LeaseRequest[], now: number): void {
    for (const request of requests) {
      if (request.reason === 'after_use_error') this.loaded.delete(request.key) // the remint restarts the transfer
      const revokedAt = this.revoked.get(request.objectId)
      this.spy.push({
        atMs: now,
        key: request.key,
        objectId: request.objectId,
        purpose: request.purpose,
        variant: request.variant,
        sizeBytes: request.sizeBytes,
        reason: request.reason,
        afterRevoke: revokedAt !== undefined && revokedAt <= now,
      })
      if (request.purpose === 'grid') {
        this.counters.maxGridMegapixels = Math.max(this.counters.maxGridMegapixels, this.decodedMegapixelsOf(request))
      }
    }
    this.schedule(now + this.options.mintLatencyMs, () => {
      for (const request of requests) {
        if (this.revoked.has(request.objectId)) {
          this.ledger.onMintError(request.key, 'STORAGE_OBJECT_NOT_FOUND')
          this.queue.complete(request.key, 'failed')
          continue
        }
        const expiresAtMs = this.clock.now() + this.options.tokenTtlMs
        const url = `https://cdn.test/${request.key}?exp=${expiresAtMs}`
        this.urlExpiry.set(url, expiresAtMs)
        this.ledger.onMinted(request.key, { url, expiresAtMs })
      }
    })
  }

  private startLoad(key: string): void {
    const admitted = this.ledger.beginTransfer(key)
    this.schedule(this.clock.now() + this.options.loadLatencyMs, () => {
      if (admitted) this.ledger.endTransfer(key)
      this.queue.complete(key, admitted ? 'done' : 'failed')
    })
  }

  private consume(wants: readonly WsWant[], now: number): void {
    for (const want of wants) {
      const url = this.ledger.urlFor(want.key)
      if (!url) continue
      if ((this.urlExpiry.get(url) ?? 0) <= now) this.counters.expiredUrlsServed += 1
      if (want.intent === 'proxy_stream' || want.intent === 'audio_stream' || want.intent === 'audio_buffer') {
        // A stream goes through the playback route, which learns of a revoke at once (403).
        if (this.revoked.has(want.objectId)) this.ledger.onUseError(want.key, 403, url)
        else this.ledger.onUseOk(want.key)
      }
    }
  }
}

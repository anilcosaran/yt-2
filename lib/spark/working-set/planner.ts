/**
 * P05-11 working-set planner: from the project, the playhead, the visible range and the device class it decides
 * what the editor holds, decodes and delivers, instead of getting every file and premounting every player.
 *
 * A pure, deterministic function of its inputs (no clock, no random, no storage). It answers:
 *
 *  - `cards`     which scene cards are rendered (windowed, bounded);
 *  - `mountedItemIds` which timeline items are mounted (view range plus overscan, through the interval index);
 *  - `live`      which video and animated-image decoders run: the playhead first, then the look-ahead, inside the
 *                decoder, element and decoded-memory budgets. A card never gets a live video or iframe;
 *  - `wants`     which deliveries are needed, nearest-to-the-playhead first, each with its decoded and transfer
 *                bytes, for the delivery ledger and the thumbnail queue;
 *  - `degraded`  what is shown as a poster or placeholder instead, and why (budget, missing derivative, probe).
 *
 * Priorities when the budget cannot hold everything: what the playhead shows now, then the card posters nearest the
 * view, then the look-ahead (the first thing to give up). A missing derivative shows a placeholder, never an
 * unbounded original; an original is used only inside the byte and pixel budgets (P02-14) or for an explicit detail
 * request that fits the remaining decoded budget. Audio placements are reported for their delivery (Range streams,
 * small buffers) but their decode pipeline is the audio player's (P06-63) and is not counted here.
 *
 * Every number is an estimate by counting; nothing here claims what a browser really allocates.
 */

import { SCENE_POSTER_PROFILES, WORKING_SET_LIMITS as LIMITS, type ScenePosterProfile, type WorkingSetBudget } from './budgets'
import {
  derivativeTransferBytes,
  fitLongEdge,
  originalDecodedMegapixels,
  pickProxyRung,
  stillBytes,
  stillChoice,
  videoDecoderBytes,
} from './decode-estimate'
import type { LeaseIntent, LeasePurpose, LeaseVariant } from './delivery-leases'
import { IntervalIndex, type IndexedInterval } from './interval-index'
import type { WsAsset, WsAudioPlacement, WsItem, WsProject } from './types'

export interface IndexedItem extends IndexedInterval {
  readonly item: WsItem
  readonly asset: WsAsset | null
}

export interface IndexedAudio extends IndexedInterval {
  readonly placement: WsAudioPlacement
  readonly asset: WsAsset | null
}

export interface WorkingSetIndex {
  readonly project: WsProject
  /** Every timeline item. */
  readonly items: IntervalIndex<IndexedItem>
  /** Clip layers that reference an asset: what can show an image, a GIF or a video. */
  readonly visual: IntervalIndex<IndexedItem>
  readonly audio: IntervalIndex<IndexedAudio>
  readonly itemsById: ReadonlyMap<string, IndexedItem>
}

/** Builds the interval indexes once per project revision. */
export function buildWorkingSetIndex(project: WsProject): WorkingSetIndex {
  const indexed: IndexedItem[] = project.items.map((item) => ({
    id: item.itemId,
    start: item.startFrame,
    end: item.endFrame,
    item,
    asset: item.assetId ? (project.assets.get(item.assetId) ?? null) : null,
  }))
  const audio: IndexedAudio[] = project.audio.map((placement) => ({
    id: placement.placementId,
    start: placement.startFrame,
    end: placement.endFrame,
    placement,
    asset: project.assets.get(placement.assetId) ?? null,
  }))
  return {
    project,
    items: new IntervalIndex(indexed),
    visual: new IntervalIndex(indexed.filter((entry) => entry.item.layerKind === 'clip' && entry.item.assetId !== undefined)),
    audio: new IntervalIndex(audio),
    itemsById: new Map(indexed.map((entry) => [entry.id, entry])),
  }
}

export interface WsViewState {
  readonly playheadFrame: number
  readonly playing: boolean
  /** Visible timeline range [startFrame, endFrame). */
  readonly timelineView: { readonly startFrame: number; readonly endFrame: number }
  /** Visible scene cards (inclusive scene indexes, before overscan). */
  readonly cardRange: { readonly first: number; readonly last: number }
  readonly selectedItemId?: string
  /** An explicit detail or zoom request for one asset: its original may be used when it fits. */
  readonly detailAssetId?: string
}

export interface WorkingSetInput {
  readonly index: WorkingSetIndex
  readonly view: WsViewState
  readonly budget: WorkingSetBudget
  /** Assets whose derivatives are missing; every other asset is assumed to have them (the P02-19 system ingest). */
  readonly missingDerivatives?: ReadonlySet<string>
  /** What a scene card poster decodes to and moves; `scene-card-v1` (today's output) by default. */
  readonly posterProfile?: ScenePosterProfile
}

export type WsSurface = 'card' | 'canvas'

export type WsWantReason = 'playhead' | 'selected' | 'detail' | 'card' | 'lookahead'

export interface WsWant {
  /** Stable: surface, target and intent. */
  readonly key: string
  readonly objectId: string
  readonly intent: LeaseIntent
  readonly purpose: LeasePurpose
  readonly variant: LeaseVariant
  readonly surface: WsSurface
  /** Lower is sooner: 0 playhead, 1 selected, 2 detail, 5 look-ahead, 10 and up cards nearest first. */
  readonly priority: number
  /** Bytes of the object the URL points at. */
  readonly sizeBytes: number
  /** Bytes the first transfer moves. */
  readonly transferBytes: number
  /** Decoded bytes held while shown (0 for a stream: its decoder is counted in `live`). */
  readonly decodedBytes: number
  readonly reason: WsWantReason
}

export interface WsLiveMedia {
  readonly itemId: string
  readonly assetId: string
  readonly decoder: 'video' | 'animated_image'
  /** `play` shows the playhead now, `prewarm` prepares what starts within the look-ahead. */
  readonly mode: 'play' | 'prewarm'
  /** The video rung decoded (null for an animated image). */
  readonly rungHeight: number | null
  readonly decodedBytes: number
  /** Live media exists on the canvas only: a scene card shows a poster, never a live video or iframe. */
  readonly surface: 'canvas'
}

export type WsDegradedReason =
  | 'decoder_budget'
  | 'live_element_budget'
  | 'decoded_memory_budget'
  | 'derivative_missing'
  | 'over_preview_budget'
  | 'pixel_budget'
  | 'probe_missing'

export interface WsDegraded {
  readonly itemId: string | null
  readonly sceneId: string | null
  readonly assetId: string | null
  readonly reason: WsDegradedReason
}

export interface WsPlan {
  /** Scene ids of the rendered cards, in scene order. */
  readonly cards: readonly string[]
  readonly mountedItemIds: readonly string[]
  readonly live: readonly WsLiveMedia[]
  readonly wants: readonly WsWant[]
  readonly degraded: readonly WsDegraded[]
  /** Estimated decoded bytes held by the live media and the shown stills and posters. */
  readonly decodedBytes: number
  /** Audio placements playing at the playhead (their pipeline is the audio player's). */
  readonly activeAudio: readonly string[]
  /** Look-ahead media that did not fit and was skipped without harm. */
  readonly skippedLookahead: number
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function clampRange(first: number, last: number, count: number): { first: number; last: number } | null {
  if (count <= 0) return null
  const from = Math.max(0, Math.min(count - 1, first))
  const to = Math.max(0, Math.min(count - 1, last))
  return to < from ? null : { first: from, last: to }
}

const NO_MISSING: ReadonlySet<string> = new Set()

export function planWorkingSet(input: WorkingSetInput): WsPlan {
  const { index, view, budget } = input
  const project = index.project
  const missing = input.missingDerivatives ?? NO_MISSING
  const posterProfile = input.posterProfile ?? SCENE_POSTER_PROFILES['scene-card-v1']

  const wants: WsWant[] = []
  const live: WsLiveMedia[] = []
  const degraded: WsDegraded[] = []
  let remaining = budget.maxDecodedBytes
  let decoders = 0
  let videoElements = 0
  let skippedLookahead = 0
  const stilled = new Set<string>()

  const lastFrame = Math.max(0, project.totalFrames - 1)
  const playhead = Math.min(lastFrame, Math.max(0, Math.floor(view.playheadFrame)))

  // -- cards: the visible scene range plus overscan, capped, nearest the centre kept -----------------------------
  const window = clampRange(view.cardRange.first - LIMITS.cardOverscan, view.cardRange.last + LIMITS.cardOverscan, project.scenes.length)
  const center = (view.cardRange.first + view.cardRange.last) / 2
  let cardIndexes: number[] = []
  if (window) {
    for (let at = window.first; at <= window.last; at += 1) cardIndexes.push(at)
    if (cardIndexes.length > budget.maxRenderedCards) {
      cardIndexes = cardIndexes
        .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
        .slice(0, budget.maxRenderedCards)
        .sort((a, b) => a - b)
    }
  }
  const cards = cardIndexes.map((at) => project.scenes[at]!.sceneId)
  // An explicit detail request may take an original only from what is left after the visible cards keep their posters.
  const cardBytes = stillBytes(posterProfile.width, posterProfile.height)
  const visibleCards = clampRange(view.cardRange.first, view.cardRange.last, project.scenes.length)
  const reserveForVisibleCards = visibleCards ? Math.min(budget.maxRenderedCards, visibleCards.last - visibleCards.first + 1) * cardBytes : 0

  // -- mounted timeline items (time virtualisation through the interval index) ------------------------------------
  const overscanFrames = Math.round(LIMITS.timelineOverscanSeconds * project.fps)
  const mountedItemIds = index.items
    .overlapping(view.timelineView.startFrame - overscanFrames, view.timelineView.endFrame + overscanFrames)
    .map((entry) => entry.id)

  // -- allocation helpers ---------------------------------------------------------------------------------------------
  const addDegraded = (entry: IndexedItem, reason: WsDegradedReason) => {
    degraded.push({ itemId: entry.id, sceneId: entry.item.sceneId, assetId: entry.item.assetId ?? null, reason })
  }

  const addStill = (entry: IndexedItem, asset: WsAsset, reason: WsWantReason, priority: number): boolean => {
    if (stilled.has(asset.assetId)) return true
    const detail = view.detailAssetId === asset.assetId
    const choice = stillChoice(asset, {
      derivativeAvailable: !missing.has(asset.assetId),
      detail,
      remainingBytes: Math.max(0, remaining - reserveForVisibleCards),
    })
    // A look-ahead still that does not fit is skipped quietly: it was never needed yet.
    const record = reason !== 'lookahead'
    if (choice.variant === 'placeholder') {
      if (record) addDegraded(entry, choice.reason === 'pixel_budget' ? 'pixel_budget' : 'derivative_missing')
      return false
    }
    if (choice.decodedBytes > remaining) {
      if (record) addDegraded(entry, 'decoded_memory_budget')
      return false
    }
    // An explicit detail request that only fits as the derivative is shown so, and reported: full resolution is not available.
    if (detail && choice.reason === 'pixel_budget') addDegraded(entry, 'pixel_budget')
    remaining -= choice.decodedBytes
    stilled.add(asset.assetId)
    const fitted = fitLongEdge(asset.width ?? 0, asset.height ?? 0, LIMITS.stillLongEdge)
    const original = choice.variant === 'original'
    const transfer = original ? asset.sizeBytes : Math.min(asset.sizeBytes, derivativeTransferBytes(fitted.width, fitted.height))
    wants.push({
      key: `canvas:${asset.assetId}:still`,
      objectId: asset.assetId,
      intent: 'still',
      purpose: original && choice.reason !== 'detail' ? 'grid' : 'detail',
      variant: original ? 'original' : 'derivative',
      surface: 'canvas',
      priority: choice.reason === 'detail' ? 2 : priority,
      sizeBytes: original ? asset.sizeBytes : transfer,
      transferBytes: transfer,
      decodedBytes: choice.decodedBytes,
      reason: choice.reason === 'detail' ? 'detail' : reason,
    })
    return true
  }

  const addVideo = (entry: IndexedItem, asset: WsAsset, mode: 'play' | 'prewarm', priority: number): boolean => {
    const top = pickProxyRung(asset, budget.videoProxyMaxHeight)
    if (top === null) {
      if (mode === 'play') addDegraded(entry, 'probe_missing')
      return false
    }
    if (missing.has(asset.assetId)) {
      if (mode === 'play') addDegraded(entry, 'derivative_missing')
      return false
    }
    if (decoders >= budget.maxActiveDecoders) {
      if (mode === 'play') addDegraded(entry, 'decoder_budget')
      return false
    }
    if (videoElements >= budget.maxLiveVideoElements) {
      if (mode === 'play') addDegraded(entry, 'live_element_budget')
      return false
    }
    const rungs = [top, ...LIMITS.proxyLadderHeights.filter((height) => height < top).reverse()]
    const rung = rungs.find((height) => videoDecoderBytes(asset, height) <= remaining)
    if (rung === undefined) {
      if (mode === 'play') addDegraded(entry, 'decoded_memory_budget')
      return false
    }
    const bytes = videoDecoderBytes(asset, rung)
    remaining -= bytes
    decoders += 1
    videoElements += 1
    live.push({ itemId: entry.id, assetId: asset.assetId, decoder: 'video', mode, rungHeight: rung, decodedBytes: bytes, surface: 'canvas' })
    wants.push({
      key: `canvas:${asset.assetId}:proxy_stream`,
      objectId: asset.assetId,
      intent: 'proxy_stream',
      purpose: 'playback',
      variant: 'derivative',
      surface: 'canvas',
      priority,
      sizeBytes: asset.sizeBytes,
      transferBytes: Math.min(asset.sizeBytes, LIMITS.rangeChunkBytes),
      decodedBytes: 0,
      reason: mode === 'play' ? 'playhead' : 'lookahead',
    })
    return true
  }

  const addGif = (entry: IndexedItem, asset: WsAsset): boolean => {
    const megapixels = originalDecodedMegapixels(asset)
    const withinBudget = asset.sizeBytes > 0
      && asset.sizeBytes <= LIMITS.previewOriginalMaxBytes
      && megapixels <= LIMITS.gridMaxDecodedMegapixels
    const bytes = Math.ceil(megapixels * 1_000_000 * LIMITS.bytesPerPixel)
    if (withinBudget && !missing.has(asset.assetId) && decoders < budget.maxActiveDecoders && bytes <= remaining) {
      remaining -= bytes
      decoders += 1
      live.push({ itemId: entry.id, assetId: asset.assetId, decoder: 'animated_image', mode: 'play', rungHeight: null, decodedBytes: bytes, surface: 'canvas' })
      wants.push({
        key: `canvas:${asset.assetId}:animated`,
        objectId: asset.assetId,
        intent: 'animated',
        purpose: 'grid',
        variant: 'original',
        surface: 'canvas',
        priority: 0,
        sizeBytes: asset.sizeBytes,
        transferBytes: asset.sizeBytes,
        decodedBytes: 0,
        reason: 'playhead',
      })
      return true
    }
    // Too heavy to animate: one frame from the poster derivative, and the reason why.
    const reason: WsDegradedReason = !withinBudget
      ? (asset.sizeBytes > LIMITS.previewOriginalMaxBytes ? 'over_preview_budget' : 'pixel_budget')
      : decoders >= budget.maxActiveDecoders ? 'decoder_budget' : bytes > remaining ? 'decoded_memory_budget' : 'derivative_missing'
    addDegraded(entry, reason)
    return addStill(entry, asset, 'playhead', 0)
  }

  const byZThenId = (a: IndexedItem, b: IndexedItem) => b.item.zIndex - a.item.zIndex || compareText(a.id, b.id)

  // -- 1. what the playhead shows now (first claim on the budget) ---------------------------------------------------
  for (const entry of index.visual.activeAt(playhead).sort(byZThenId)) {
    const asset = entry.asset
    if (!asset || asset.kind === 'audio') {
      addDegraded(entry, 'probe_missing')
      continue
    }
    if (asset.kind === 'video') {
      // A video that cannot play (no decoder left, no memory) still shows its poster frame when it has one.
      const played = addVideo(entry, asset, 'play', 0)
      if (!played && asset.width && asset.height && !missing.has(asset.assetId)) addStill(entry, asset, 'playhead', 0)
    } else if (asset.kind === 'gif') {
      addGif(entry, asset)
    } else {
      addStill(entry, asset, 'playhead', 0)
    }
  }

  // The selected item keeps a still so editing has something to show; it takes a decoder only by being at the playhead.
  const selected = view.selectedItemId ? index.itemsById.get(view.selectedItemId) : undefined
  if (selected?.asset && selected.item.layerKind === 'clip' && selected.asset.kind !== 'audio') {
    addStill(selected, selected.asset, 'selected', 1)
  }

  // -- 2. card posters, nearest the view first ----------------------------------------------------------------------
  const cardsByDistance = [...cardIndexes].sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
  let cardRank = 0
  for (const at of cardsByDistance) {
    const sceneId = project.scenes[at]!.sceneId
    if (cardBytes > remaining) {
      degraded.push({ itemId: null, sceneId, assetId: null, reason: 'decoded_memory_budget' })
      continue
    }
    remaining -= cardBytes
    wants.push({
      key: `card:scene:${sceneId}:poster`,
      objectId: `scene:${sceneId}`,
      intent: 'poster',
      purpose: 'grid',
      variant: 'derivative',
      surface: 'card',
      priority: 10 + cardRank,
      sizeBytes: posterProfile.transferBytes,
      transferBytes: posterProfile.transferBytes,
      decodedBytes: cardBytes,
      reason: 'card',
    })
    cardRank += 1
  }

  // -- 3. look-ahead while playing (best effort; the first thing to give up) -----------------------------------------
  const activeAudio = index.audio.activeAt(playhead).map((entry) => entry.id)
  if (view.playing) {
    const lookaheadFrames = Math.round(LIMITS.lookaheadSeconds * project.fps)
    const ahead = index.visual
      .overlapping(playhead + 1, playhead + 1 + lookaheadFrames)
      .filter((entry) => entry.start > playhead)
      .sort((a, b) => a.start - b.start || byZThenId(a, b))
    for (const entry of ahead) {
      const asset = entry.asset
      if (!asset || asset.kind === 'audio' || asset.kind === 'gif') continue
      const before = wants.length
      const fitted = asset.kind === 'video' ? addVideo(entry, asset, 'prewarm', 5) : addStill(entry, asset, 'lookahead', 5)
      if (!fitted && wants.length === before) skippedLookahead += 1
    }
    // Audio: what plays now and what starts within the look-ahead. A short placement is fetched whole.
    const audioNow = new Set(activeAudio)
    const audioAhead = index.audio.overlapping(playhead + 1, playhead + 1 + lookaheadFrames).filter((entry) => entry.start > playhead)
    for (const entry of [...index.audio.activeAt(playhead), ...audioAhead]) {
      const asset = entry.asset
      if (!asset) continue
      const whole = asset.sizeBytes <= LIMITS.audioBufferMaxBytes
      const key = `canvas:${asset.assetId}:${whole ? 'audio_buffer' : 'audio_stream'}`
      if (wants.some((want) => want.key === key)) continue
      wants.push({
        key,
        objectId: asset.assetId,
        intent: whole ? 'audio_buffer' : 'audio_stream',
        purpose: 'playback',
        variant: 'original',
        surface: 'canvas',
        priority: audioNow.has(entry.id) ? 0 : 5,
        sizeBytes: asset.sizeBytes,
        transferBytes: Math.min(asset.sizeBytes, LIMITS.rangeChunkBytes),
        decodedBytes: 0,
        reason: audioNow.has(entry.id) ? 'playhead' : 'lookahead',
      })
    }
  }

  wants.sort((a, b) => a.priority - b.priority || compareText(a.key, b.key))
  live.sort((a, b) => (a.mode === b.mode ? 0 : a.mode === 'play' ? -1 : 1) || compareText(a.itemId, b.itemId))
  // One entry per (item or scene, asset, reason): a video that cannot play and then cannot show its poster either is
  // reported once for the same cause.
  const distinct = new Map<string, WsDegraded>()
  for (const entry of degraded) distinct.set(`${entry.itemId ?? ''}|${entry.sceneId ?? ''}|${entry.assetId ?? ''}|${entry.reason}`, entry)
  const degradedSorted = [...distinct.entries()].sort((a, b) => compareText(a[0], b[0])).map(([, entry]) => entry)
  return {
    cards,
    mountedItemIds,
    live,
    wants,
    degraded: degradedSorted,
    decodedBytes: budget.maxDecodedBytes - remaining,
    activeAudio,
    skippedLookahead,
  }
}

/** Counts a plan the way the P07-13 metrics count (live elements, decoders, cards, decoded bytes). */
export function summarizePlan(plan: WsPlan) {
  return {
    renderedCards: plan.cards.length,
    mountedItems: plan.mountedItemIds.length,
    liveVideoElements: plan.live.filter((entry) => entry.decoder === 'video').length,
    activeDecoders: plan.live.length,
    decodedBytes: plan.decodedBytes,
    wants: plan.wants.length,
    degraded: plan.degraded.length,
    /** Live media bound to a scene card: none by construction (the type allows the canvas only). */
    liveMediaOnCards: plan.live.filter((entry) => (entry.surface as string) !== 'canvas').length,
    /** Card deliveries that stream video or audio: none (a card asks for a poster or a small image, never a stream). */
    cardStreamWants: plan.wants.filter(
      (want) => want.surface === 'card' && (want.intent === 'proxy_stream' || want.intent === 'original_range' || want.intent === 'audio_stream' || want.intent === 'audio_buffer'),
    ).length,
  }
}

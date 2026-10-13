/**
 * P05-11 decode estimates: what showing an asset costs in decoded pixels and bytes, and which delivery variant a
 * grid, a card or the canvas may use. The rules are the P02-14 ones (by bytes, never by extension; a missing
 * derivative shows a placeholder, never an unbounded original) plus the pixel budget P02-14 left open: a GIF that is
 * small in bytes can still decode to hundreds of megapixels (frames x width x height), so a grid or card takes an
 * original only when it is inside the byte budget AND the decoded-pixel budget.
 *
 * Estimates are counting, not measurement: they never claim what a browser really allocates.
 */

import { WORKING_SET_LIMITS as LIMITS } from './budgets'
import type { WsAsset } from './types'

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000
}

/** Worst-case decoded pixels of the original: frames x width x height (a GIF decodes every frame). */
export function originalDecodedMegapixels(asset: WsAsset): number {
  if (asset.kind === 'audio' || !asset.width || !asset.height) return 0
  const frames = asset.kind === 'image' ? 1 : Math.max(1, asset.frameCount ?? 1)
  return megapixels(asset.width, asset.height) * frames
}

/** Fits a size to a longest edge; never scales up. */
export function fitLongEdge(width: number, height: number, longEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= longEdge) return { width, height }
  const scale = longEdge / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function stillBytes(width: number, height: number): number {
  return width * height * LIMITS.bytesPerPixel
}

/**
 * Height of the largest ladder rung the source and the class allow (360/720/1080, never above the source). A
 * source shorter than the lowest rung keeps its own height. Null when the probe gave no height.
 */
export function pickProxyRung(asset: WsAsset, maxHeight: number): number | null {
  if (!asset.height || asset.height <= 0) return null
  const ceiling = Math.min(maxHeight, asset.height)
  let rung: number | null = null
  for (const height of LIMITS.proxyLadderHeights) {
    if (height <= ceiling) rung = height
  }
  return rung ?? asset.height
}

/** Decoded bytes a video decoder holds at a rung: the frames it keeps times one frame at that rung. */
export function videoDecoderBytes(asset: WsAsset, rungHeight: number): number {
  if (!asset.width || !asset.height) return 0
  const width = Math.max(1, Math.round((asset.width * rungHeight) / asset.height))
  return LIMITS.videoRingFrames * stillBytes(width, rungHeight)
}

/** Bytes a derivative of this size moves over the network (assumption: JPEG/WebP at a fixed bytes per pixel). */
export function derivativeTransferBytes(width: number, height: number): number {
  return Math.ceil(width * height * LIMITS.derivativeBytesPerPixel)
}

export type GridVariant = 'original' | 'poster' | 'placeholder'

export type GridReason =
  | 'within_budget'
  | 'small_original'
  | 'over_preview_budget'
  | 'pixel_budget'
  | 'derivative_preferred'
  | 'video'
  | 'audio'
  | 'derivative_missing'
  | 'bounded_original_fallback'
  | 'decoded_memory_budget'

export interface GridChoice {
  readonly variant: GridVariant
  readonly reason: GridReason
  /** Decoded megapixels of what the choice shows (0 for a placeholder). */
  readonly decodedMegapixels: number
}

function posterMegapixels(asset: WsAsset): number {
  if (!asset.width || !asset.height) return 0
  const fitted = fitLongEdge(asset.width, asset.height, LIMITS.cardPosterLongEdge * 2)
  return megapixels(fitted.width, fitted.height)
}

/**
 * The variant a grid or card may take (purpose `grid`): the bounded rule of P02-14 with the pixel budget added.
 * `derivativeAvailable` is whether the poster derivative exists; without it an original is used only inside the
 * byte and pixel budgets (a bounded fallback), otherwise the card shows a placeholder.
 */
export function gridChoice(asset: WsAsset, derivativeAvailable: boolean): GridChoice {
  if (asset.kind === 'audio') return { variant: 'placeholder', reason: 'audio', decodedMegapixels: 0 }
  const mp = originalDecodedMegapixels(asset)
  const withinPixels = mp <= LIMITS.gridMaxDecodedMegapixels
  const withinPreview = asset.sizeBytes > 0 && asset.sizeBytes <= LIMITS.previewOriginalMaxBytes
  if (asset.kind === 'gif' && withinPreview && withinPixels) {
    return { variant: 'original', reason: 'within_budget', decodedMegapixels: mp }
  }
  if (asset.kind === 'image' && asset.sizeBytes > 0 && asset.sizeBytes <= LIMITS.originalFallbackMaxBytes && withinPixels) {
    return { variant: 'original', reason: 'small_original', decodedMegapixels: mp }
  }
  const why: GridReason = asset.kind === 'video'
    ? 'video'
    : !withinPreview
      ? 'over_preview_budget'
      : !withinPixels
        ? 'pixel_budget'
        : 'derivative_preferred'
  if (derivativeAvailable) return { variant: 'poster', reason: why, decodedMegapixels: posterMegapixels(asset) }
  if (asset.kind === 'image' && withinPreview && withinPixels) {
    return { variant: 'original', reason: 'bounded_original_fallback', decodedMegapixels: mp }
  }
  return { variant: 'placeholder', reason: 'derivative_missing', decodedMegapixels: 0 }
}

export type StillVariant = 'derivative' | 'original' | 'placeholder'

export type StillReason = 'derivative' | 'small_original' | 'detail' | 'derivative_missing' | 'pixel_budget'

export interface StillChoice {
  readonly variant: StillVariant
  readonly decodedBytes: number
  readonly reason: StillReason
}

/**
 * How an image layer at the playhead is shown on the canvas: the detail derivative (longest edge 1280), a small
 * original when the derivative is missing, or - only for an explicit detail request and only when it fits the
 * remaining decoded budget - the original. A GIF shown as a still is one frame.
 */
export function stillChoice(
  asset: WsAsset,
  options: { derivativeAvailable: boolean; detail: boolean; remainingBytes: number },
): StillChoice {
  if (!asset.width || !asset.height) return { variant: 'placeholder', decodedBytes: 0, reason: 'derivative_missing' }
  const fitted = fitLongEdge(asset.width, asset.height, LIMITS.stillLongEdge)
  const derivativeBytes = stillBytes(fitted.width, fitted.height)
  if (options.detail) {
    const originalBytes = stillBytes(asset.width, asset.height)
    if (asset.kind === 'image' && originalBytes <= options.remainingBytes) {
      return { variant: 'original', decodedBytes: originalBytes, reason: 'detail' }
    }
    if (options.derivativeAvailable) return { variant: 'derivative', decodedBytes: derivativeBytes, reason: 'pixel_budget' }
    return { variant: 'placeholder', decodedBytes: 0, reason: 'pixel_budget' }
  }
  if (options.derivativeAvailable) return { variant: 'derivative', decodedBytes: derivativeBytes, reason: 'derivative' }
  if (asset.kind === 'image' && asset.sizeBytes > 0 && asset.sizeBytes <= LIMITS.originalFallbackMaxBytes) {
    return { variant: 'original', decodedBytes: stillBytes(asset.width, asset.height), reason: 'small_original' }
  }
  return { variant: 'placeholder', decodedBytes: 0, reason: 'derivative_missing' }
}

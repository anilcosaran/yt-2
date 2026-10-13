/**
 * P05-11 media grid plan: which cells of a long media list (the project's sources, the media library) are rendered,
 * which of them have their metadata, and which delivery each takes. It is the paged-metadata counterpart of the
 * editor planner: the grid never asks for the metadata of the whole list and never a delivery for a cell that is not
 * rendered.
 *
 *  - Only the visible cells plus overscan are rendered (capped, nearest the centre kept). A cell whose metadata page
 *    is not resident is reported in `needsMetadata` so the page window fetches it; it shows an empty cell meanwhile.
 *  - The delivery is the bounded rule of P02-14 with the pixel budget added (`gridChoice`): a small GIF may stay
 *    animated, a larger one or an image takes the poster derivative, a missing derivative shows a placeholder, and an
 *    original is never used above the 2 MiB preview budget or the decoded-pixel budget, whatever the extension.
 *  - The decoded-memory budget is spent nearest cell first. An animated original that does not fit falls back to its
 *    poster, and a poster that does not fit shows a placeholder, so the number of animated GIFs is bounded by memory.
 *
 * Pure and deterministic. Estimates are counting, not measurement.
 */

import { WORKING_SET_LIMITS as LIMITS, type WorkingSetBudget } from './budgets'
import {
  derivativeTransferBytes,
  fitLongEdge,
  gridChoice,
  originalDecodedMegapixels,
  stillBytes,
  type GridReason,
  type GridVariant,
} from './decode-estimate'
import type { WsDegraded, WsDegradedReason, WsWant } from './planner'
import type { WsAsset } from './types'

export interface MediaGridInput {
  /** Items in the list once known (a first page can report it); null while unknown. */
  readonly totalCount: number | null
  /** Visible cells (inclusive indexes, before overscan). */
  readonly visible: { readonly first: number; readonly last: number }
  /** The asset at a list index when its metadata page is resident; null when it is not. */
  readonly assetAt: (index: number) => WsAsset | null
  readonly budget: WorkingSetBudget
  /** Assets whose poster derivative is missing. */
  readonly missingDerivatives?: ReadonlySet<string>
}

export interface GridCellPlan {
  readonly index: number
  readonly assetId: string
  readonly variant: GridVariant
  readonly reason: GridReason
  readonly decodedBytes: number
}

export interface MediaGridPlan {
  /** Cells that have an asset, in list order. */
  readonly cells: readonly GridCellPlan[]
  /** Rendered indexes whose metadata is not resident: their pages are to be fetched. */
  readonly needsMetadata: readonly number[]
  readonly wants: readonly WsWant[]
  readonly degraded: readonly WsDegraded[]
  /** Estimated decoded bytes of the shown cells. */
  readonly decodedBytes: number
  /** Cells rendered (with or without metadata). */
  readonly renderedCells: number
}

const POSTER_LONG_EDGE = LIMITS.cardPosterLongEdge * 2

function posterDecodedBytes(asset: WsAsset): number {
  if (!asset.width || !asset.height) return 0
  const fitted = fitLongEdge(asset.width, asset.height, POSTER_LONG_EDGE)
  return stillBytes(fitted.width, fitted.height)
}

function originalDecodedBytes(asset: WsAsset): number {
  return Math.ceil(originalDecodedMegapixels(asset) * 1_000_000 * LIMITS.bytesPerPixel)
}

export function planMediaGrid(input: MediaGridInput): MediaGridPlan {
  const { budget } = input
  const missing = input.missingDerivatives ?? new Set<string>()
  const highest = input.totalCount === null ? Number.POSITIVE_INFINITY : input.totalCount - 1
  const first = Math.max(0, input.visible.first - LIMITS.cardOverscan)
  const last = Math.min(highest, input.visible.last + LIMITS.cardOverscan)
  const center = (input.visible.first + input.visible.last) / 2

  let indexes: number[] = []
  for (let at = first; at <= last && indexes.length <= budget.maxRenderedCards * 4; at += 1) indexes.push(at)
  if (indexes.length > budget.maxRenderedCards) {
    indexes = indexes
      .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
      .slice(0, budget.maxRenderedCards)
  }
  indexes.sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b) // nearest first: the order the budget is spent in

  const cells: GridCellPlan[] = []
  const wants: WsWant[] = []
  const degraded: WsDegraded[] = []
  const needsMetadata: number[] = []
  let remaining = budget.maxDecodedBytes
  let rank = 0

  for (const index of indexes) {
    const asset = input.assetAt(index)
    if (!asset) {
      needsMetadata.push(index)
      continue
    }
    const derivativeAvailable = !missing.has(asset.assetId)
    const choice = gridChoice(asset, derivativeAvailable)
    let variant: GridVariant = choice.variant
    let reason: GridReason = choice.reason
    let bytes = variant === 'original' ? originalDecodedBytes(asset) : variant === 'poster' ? posterDecodedBytes(asset) : 0

    if (variant === 'original' && bytes > remaining) {
      // Too heavy to keep decoded next to the others: the poster stands in when it exists.
      variant = derivativeAvailable ? 'poster' : 'placeholder'
      reason = derivativeAvailable ? 'decoded_memory_budget' : 'derivative_missing'
      bytes = variant === 'poster' ? posterDecodedBytes(asset) : 0
    }
    if (variant === 'poster' && bytes > remaining) {
      variant = 'placeholder'
      reason = 'decoded_memory_budget'
      bytes = 0
    }
    if (variant === 'placeholder' && asset.kind !== 'audio') {
      const why: WsDegradedReason = reason === 'decoded_memory_budget' ? 'decoded_memory_budget' : 'derivative_missing'
      degraded.push({ itemId: null, sceneId: null, assetId: asset.assetId, reason: why })
    }
    remaining -= bytes
    cells.push({ index, assetId: asset.assetId, variant, reason, decodedBytes: bytes })
    if (variant === 'placeholder') continue

    const original = variant === 'original'
    const fitted = fitLongEdge(asset.width ?? 0, asset.height ?? 0, POSTER_LONG_EDGE)
    const transfer = original ? asset.sizeBytes : Math.min(asset.sizeBytes, derivativeTransferBytes(fitted.width, fitted.height))
    const intent = original ? (asset.kind === 'gif' ? 'animated' : 'still') : 'poster'
    wants.push({
      key: `grid:${asset.assetId}:${intent}`,
      objectId: asset.assetId,
      intent,
      purpose: 'grid',
      variant: original ? 'original' : 'derivative',
      surface: 'card',
      priority: 10 + rank,
      sizeBytes: original ? asset.sizeBytes : transfer,
      transferBytes: transfer,
      decodedBytes: bytes,
      reason: 'card',
    })
    rank += 1
  }

  cells.sort((a, b) => a.index - b.index)
  needsMetadata.sort((a, b) => a - b)
  wants.sort((a, b) => a.priority - b.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return {
    cells,
    needsMetadata,
    wants,
    degraded,
    decodedBytes: budget.maxDecodedBytes - remaining,
    renderedCells: indexes.length,
  }
}

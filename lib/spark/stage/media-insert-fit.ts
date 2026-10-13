import type { CompositionDocument } from '../composition-client'
import type { CompositionTransform } from '../composition-typed-edits'
import type { SparkUndoGroup } from '../undo-group'
import { coverTransformForMedia, type Size } from './cover-transform'

/**
 * Timeline v3 (instant media add, spec §5): how an image or video that is added gets its fit WITHOUT waiting for the picture.
 * Adding used to wait up to 1.5 s for the original to download just to learn its size; now the insert is applied at once and
 * the exact fit follows in the same undo step:
 *
 * - `transform` is written IN the insert command: the cover from the size known right now (a file measured in this tab, a
 *   picture read before, or — only its aspect matters — the drawer card's thumbnail); null when nothing is known yet or
 *   the media already has the canvas's aspect (the compiler's own fit, contain and centred, fills the canvas then).
 * - `undoGroup` is the undo step the insert opens (`SparkApplyOptions.undoGroup`).
 * - `settle(placed)` is called right after the insert was handed to the session. It reads the picture's real size in the
 *   background (once for the page: `local-media.ts` `measureLocalImage`, shared with the canvas) and, when the exact cover
 *   differs from `transform`, sends ONE `layer.set_transform` that joins the insert's undo step: one undo removes both. When
 *   the user wrote anything after the insert (moved the clip, another edit, an undo) the session refuses the join and
 *   nothing is overwritten; the clip then keeps the fit it was inserted with.
 */
export type MediaInsertFit = {
  transform: CompositionTransform | null
  undoGroup: SparkUndoGroup
  settle(placed: { sceneId: string; layerId: string }): void
}

/** What the timeline and the session ask for: the fit of `sourceId` for an insert planned on `document` (null: no fit). */
export type MediaInsertFitResolver = (input: { document: CompositionDocument; sourceId: string }) => MediaInsertFit | null

/**
 * The cover transform of a media of `media` pixels (only its aspect matters) on `canvas`, or null when the compiler's own fit
 * already fills the canvas (same aspect) or the size is unknown.
 */
export function insertCover(canvas: Size, media: Size | null | undefined): CompositionTransform | null {
  const transform = coverTransformForMedia(canvas, media)
  return transform && transform.scale > 1 ? transform : null
}

/** Whether two fits are the same: both the compiler's own, or the same (rounded) transform. */
export function sameMediaFit(a: CompositionTransform | null, b: CompositionTransform | null): boolean {
  if (a === null || b === null) return a === b
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation_deg === b.rotation_deg && a.crop === b.crop
}

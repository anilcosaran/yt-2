import type { CompositionTransform } from '../composition-typed-edits'
import { containFit } from './geometry'

/**
 * THE cover / contain math of an image or video layer (the one place the editor computes it: the context toolbar, a media
 * insert, the aspect switch and the timeline call these helpers). Pure functions, canvas pixels.
 *
 * The compiler draws a clip's NATURAL box as the media fitted inside the canvas (contain), centred when the layer has no
 * `transform`; a `transform` puts that box's top-left at `x/y` and scales it about that corner (`geometry.ts`). So:
 *
 * - contain ("Fit"): no transform at all (the compiler's own rule, exact for every canvas).
 * - cover ("Fill"): the contain box scaled by `max(canvasW / boxW, canvasH / boxH)` (one of the two is 1) and centred. It is a
 *   plain scale + offset: crop is refused by the compiler (`crop_not_compiled`) and is never written.
 */

export type Size = { width: number; height: number }

export type MediaFit = 'contain' | 'cover' | 'custom'

const SCALE_DIGITS = 4
const POSITION_DIGITS = 2

/** Rounds UP to the transform's 4 decimals, so a covering box never leaves a sub-pixel seam at the edge. */
function ceilScale(value: number): number {
  const factor = 10 ** SCALE_DIGITS
  return Math.ceil(value * factor - 1e-6) / factor
}

const roundPosition = (value: number) => Math.round(value * 10 ** POSITION_DIGITS) / 10 ** POSITION_DIGITS

const valid = (size: Size | null | undefined): size is Size =>
  Boolean(size) && Number.isFinite(size!.width) && Number.isFinite(size!.height) && size!.width > 0 && size!.height > 0

/** The natural (contain-fit) box of a media of `media` pixels on `canvas`; null for an unknown size. */
export function containBox(canvas: Size, media: Size | null | undefined): Size | null {
  if (!valid(media) || !valid(canvas)) return null
  return containFit(canvas, media.width, media.height)
}

/** The scale that makes a contain box `natural` cover the canvas (>= 1; 1 when the media has the canvas's aspect). */
export function coverScale(canvas: Size, natural: Size): number {
  return ceilScale(Math.max(1, canvas.width / natural.width, canvas.height / natural.height))
}

/**
 * The transform that makes the layer whose natural (contain) box is `natural` cover the whole canvas, centred. Rotation 0,
 * no crop. `natural` is what the compiler draws without a transform (`containBox`).
 */
export function coverTransform(canvas: Size, natural: Size): CompositionTransform {
  const scale = coverScale(canvas, natural)
  return {
    x: roundPosition((canvas.width - natural.width * scale) / 2),
    y: roundPosition((canvas.height - natural.height * scale) / 2),
    scale,
    rotation_deg: 0,
  }
}

/** `coverTransform` from the media's own pixel size (or any size with its aspect); null for an unknown size. */
export function coverTransformForMedia(canvas: Size, media: Size | null | undefined): CompositionTransform | null {
  const natural = containBox(canvas, media)
  return natural ? coverTransform(canvas, natural) : null
}

/** Within this many canvas pixels / this scale difference a stored transform still counts as "the cover transform". */
const POSITION_TOLERANCE_PX = 1
const SCALE_TOLERANCE = 0.002

/**
 * Which fit a stored clip transform is: none = contain, the cover transform of `natural` (within rounding) = cover,
 * anything else (moved, scaled or rotated by the user) = custom. `natural` null (unknown media size): a transform is custom.
 */
export function mediaFitOf(transform: CompositionTransform | null | undefined, canvas: Size, natural: Size | null | undefined): MediaFit {
  if (!transform) return 'contain'
  if (!valid(natural) || transform.crop || Math.abs(transform.rotation_deg) > 1e-9) return 'custom'
  const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance
  // The natural box at scale 1, centred: what the compiler draws without a transform (a "Fit" not drawn yet looks like this).
  if (close(transform.scale, 1, SCALE_TOLERANCE) && close(transform.x, (canvas.width - natural.width) / 2, POSITION_TOLERANCE_PX) && close(transform.y, (canvas.height - natural.height) / 2, POSITION_TOLERANCE_PX)) {
    return 'contain'
  }
  const cover = coverTransform(canvas, natural)
  if (close(transform.scale, cover.scale, SCALE_TOLERANCE) && close(transform.x, cover.x, POSITION_TOLERANCE_PX) && close(transform.y, cover.y, POSITION_TOLERANCE_PX)) {
    return 'cover'
  }
  return 'custom'
}

/** Whether a media of this size already fills the canvas without scaling (its cover IS its contain fit). */
export function sameAspect(canvas: Size, media: Size | null | undefined): boolean {
  const natural = containBox(canvas, media)
  return natural !== null && coverScale(canvas, natural) === 1
}

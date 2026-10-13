'use client'

import * as React from 'react'

import type { OutlineThumbnails } from '@/lib/spark/outline/outline-thumbnails'
import type { FilmstripSprite, TimelineMediaPreviews, WaveformPeaks } from '@/lib/spark/timeline/timeline-media-previews'
import type { TimelineMainBlock, TimelineMediaSpan } from '@/lib/spark/timeline/timeline-model'

/**
 * Spark timeline v3: the media slot of a main clip (CapCut's look: filmstrip in the top two thirds, waveform in the bottom
 * third). Pure render of what is already known; it never fetches by itself (the timeline asks the preview store for the
 * objects in view) and never handles an event (pointer-events: none), so a drag or playback never re-renders it.
 *
 * - Filmstrip: one sprite per source (`TimelineMediaPreviews.filmstrip`), drawn as CSS background tiles picked from the
 *   clip's own source seconds (the halves of a split clip continue the film), only the tiles in the visible window.
 * - Fallback while there is no sprite ('pending' / 'none'): the object's delivery thumbnail repeated (an image always); a
 *   graphics scene keeps a tinted slot (its first text is the clip's name chip), as does media without a thumbnail yet.
 * - Waveform: one peaks array per source drawn into ONE canvas per visible clip (at most 2048 px wide); while zooming the
 *   canvas is stretched by CSS and redrawn 100 ms after the zoom settles.
 */

/** No filmstrip, no waveform (a timeline without the delivery store: tests, a dock before the store exists). */
export { NO_TIMELINE_MEDIA_PREVIEWS } from '@/lib/spark/timeline/timeline-media-previews'

/** Height of the filmstrip band (px): two thirds of the clip's 60 px body. */
export const FILMSTRIP_HEIGHT_PX = 60
/** Widest waveform canvas (px). */
export const WAVEFORM_MAX_CANVAS_PX = 2048
/** At most this many tiles per clip (a clip wider than that repeats less often). */
const MAX_TILES_PER_CLIP = 240
/** The waveform is redrawn this long after the zoom stopped changing. */
const WAVEFORM_REDRAW_MS = 100

const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

export type ClipMediaProps = {
  block: TimelineMainBlock
  /** Pixels per frame of the rendered view (the lanes re-render when it changes, never per frame). */
  ppf: number
  /** The frames in view (display axis): tiles outside are not in the DOM. */
  window: { startFrame: number; endFrame: number }
  previews: TimelineMediaPreviews
  thumbnails: OutlineThumbnails | null
}

/** The tiles of a filmstrip over `[0, widthPx)` of a clip that plays `[start, end)` seconds of its source. */
export function filmstripTiles(input: {
  sprite: FilmstripSprite
  widthPx: number
  heightPx: number
  sourceStartSeconds: number
  sourceEndSeconds: number
  /** Visible part of the clip in its own pixels. */
  visibleFromPx: number
  visibleToPx: number
}): { slot: number; tiles: Array<{ x: number; width: number; tile: number; column: number; row: number }> } {
  const { sprite, widthPx, heightPx } = input
  if (widthPx <= 0 || sprite.tileCount <= 0 || sprite.tileHeight <= 0 || sprite.columns <= 0 || sprite.intervalMs <= 0) return { slot: 0, tiles: [] }
  const natural = (heightPx * sprite.tileWidth) / sprite.tileHeight
  // A tile at its natural width, wider when the clip would need more than the cap (each tile is then stretched a little).
  const slot = Math.max(natural, widthPx / MAX_TILES_PER_CLIP)
  const span = Math.max(0, input.sourceEndSeconds - input.sourceStartSeconds)
  const tiles: Array<{ x: number; width: number; tile: number; column: number; row: number }> = []
  const first = Math.max(0, Math.floor(input.visibleFromPx / slot))
  const last = Math.min(Math.ceil(widthPx / slot), Math.ceil(input.visibleToPx / slot))
  for (let index = first; index < last; index += 1) {
    const x = index * slot
    const seconds = input.sourceStartSeconds + (Math.min(widthPx, x + slot / 2) / widthPx) * span
    const tile = Math.min(sprite.tileCount - 1, Math.max(0, Math.floor((seconds * 1000) / sprite.intervalMs)))
    tiles.push({ x, width: Math.min(slot, widthPx - x), tile, column: tile % sprite.columns, row: Math.floor(tile / sprite.columns) })
  }
  return { slot, tiles }
}

function Filmstrip({ sprite, span, offsetPx, widthPx, visible }: { sprite: FilmstripSprite; span: TimelineMediaSpan; offsetPx: number; widthPx: number; visible: { from: number; to: number } }) {
  const height = FILMSTRIP_HEIGHT_PX
  const { slot, tiles } = filmstripTiles({
    sprite,
    widthPx,
    heightPx: height,
    sourceStartSeconds: span.sourceStartSeconds ?? 0,
    sourceEndSeconds: span.sourceEndSeconds ?? span.sourceStartSeconds ?? 0,
    visibleFromPx: visible.from - offsetPx,
    visibleToPx: visible.to - offsetPx,
  })
  const image = cssUrl(sprite.url)
  return (
    <span className="tl3-film" style={{ left: offsetPx, width: widthPx }} data-filmstrip>
      {tiles.map((tile) => (
        <span
          key={tile.x}
          className="tl3-tile"
          style={{
            left: tile.x,
            width: tile.width,
            backgroundImage: image,
            backgroundSize: `${sprite.columns * slot}px ${sprite.rows * height}px`,
            backgroundPosition: `${-tile.column * slot}px ${-tile.row * height}px`,
          }}
        />
      ))}
    </span>
  )
}

/** Draws peaks of `[start, end)` seconds into a canvas (min / max bars), stretched to the clip by CSS. */
function drawPeaks(canvas: HTMLCanvasElement, peaks: WaveformPeaks, startSeconds: number, endSeconds: number): void {
  const context = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null
  if (!context) return
  const { width, height } = canvas
  context.clearRect(0, 0, width, height)
  const pairs = Math.floor(peaks.data.length / 2)
  if (pairs === 0 || width === 0 || endSeconds <= startSeconds) return
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(canvas).color : ''
  context.fillStyle = style || 'rgba(255,255,255,.7)'
  const middle = height / 2
  const perPixel = ((endSeconds - startSeconds) * peaks.peaksPerSecond) / width
  for (let x = 0; x < width; x += 1) {
    const from = Math.floor(startSeconds * peaks.peaksPerSecond + x * perPixel)
    const to = Math.max(from + 1, Math.floor(startSeconds * peaks.peaksPerSecond + (x + 1) * perPixel))
    let low = 0
    let high = 0
    for (let index = Math.max(0, from); index < Math.min(pairs, to); index += 1) {
      low = Math.min(low, peaks.data[index * 2]!)
      high = Math.max(high, peaks.data[index * 2 + 1]!)
    }
    const top = middle - (high / 128) * middle
    const bottom = middle - (low / 128) * middle
    context.fillRect(x, top, 1, Math.max(1, bottom - top))
  }
}

/** One waveform canvas (a main clip's bottom third, a music block of the music strip). */
export function Waveform({ peaks, startSeconds, endSeconds, offsetPx, widthPx }: { peaks: WaveformPeaks; startSeconds: number | null; endSeconds: number | null; offsetPx: number; widthPx: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const pixels = Math.max(1, Math.min(WAVEFORM_MAX_CANVAS_PX, Math.round(widthPx)))
  const start = startSeconds ?? 0
  const end = endSeconds ?? start
  // Drawn once at its size, then again 100 ms after the width settles (CSS stretches it meanwhile).
  React.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const draw = () => {
      if (canvas.width !== pixels) canvas.width = pixels
      drawPeaks(canvas, peaks, start, end)
    }
    if (canvas.width === 0 || canvas.dataset['drawn'] !== '1') {
      canvas.dataset['drawn'] = '1'
      draw()
      return undefined
    }
    const timer = globalThis.setTimeout(draw, WAVEFORM_REDRAW_MS)
    return () => globalThis.clearTimeout(timer)
  }, [peaks, pixels, start, end])
  return <canvas ref={ref} className="tl3-wave" height={32} style={{ left: offsetPx, width: widthPx }} data-waveform aria-hidden />
}

/** The media slot of a main block (see the module header). */
export function ClipMedia({ block, ppf, window, previews, thumbnails }: ClipMediaProps) {
  const picture = block.picture
  const blockLeft = block.startFrame * ppf
  const blockWidth = block.lengthFrames * ppf
  const visible = { from: Math.max(0, window.startFrame * ppf - blockLeft), to: Math.min(blockWidth, window.endFrame * ppf - blockLeft) }
  const clip = block.mainClip
  // The filmstrip covers the main clip's own span of the scene; a picture of another clip covers the whole block.
  const filmOffset = clip && clip.media === picture ? clip.startFrame * ppf : 0
  const filmWidth = clip && clip.media === picture ? (Math.min(clip.endFrame, block.lengthFrames) - clip.startFrame) * ppf : blockWidth
  const sprite = picture && picture.mediaKind === 'video' ? previews.filmstrip(picture.storageObjectId) : 'none'
  const thumbnail = picture && thumbnails ? thumbnails.url(picture.storageObjectId) : null
  const wave = block.waveform ? previews.waveform(block.waveform.storageObjectId) : 'none'
  let film: React.ReactNode = null
  if (picture && typeof sprite === 'object') {
    film = <Filmstrip sprite={sprite} span={picture} offsetPx={filmOffset} widthPx={Math.max(0, filmWidth)} visible={visible} />
  } else if (thumbnail) {
    film = <span className="tl3-film thumb" style={{ left: filmOffset, width: Math.max(0, filmWidth), backgroundImage: cssUrl(thumbnail) }} data-thumbnail />
  }
  // Graphics only: a tinted slot (its first text is already the clip's name chip).
  const waveSource = block.waveform
  return (
    <span className={`tl3-media${picture ? ` k-${picture.mediaKind}` : ' k-graphics'}${sprite === 'pending' ? ' pending' : ''}`} aria-hidden>
      {film}
      {waveSource && typeof wave === 'object' ? (
        <Waveform
          peaks={wave}
          startSeconds={waveSource.sourceStartSeconds}
          endSeconds={waveSource.sourceEndSeconds}
          offsetPx={waveSource.startFrame * ppf}
          widthPx={Math.max(0, (Math.min(waveSource.endFrame, block.lengthFrames) - waveSource.startFrame) * ppf)}
        />
      ) : null}
    </span>
  )
}

/** The Storage objects the media slots of these blocks show (to ask the preview store and the thumbnails for). */
export function mediaObjectsOf(blocks: readonly TimelineMainBlock[]): { pictures: string[]; waveforms: string[] } {
  const pictures = new Set<string>()
  const waveforms = new Set<string>()
  for (const block of blocks) {
    if (block.picture) pictures.add(block.picture.storageObjectId)
    if (block.waveform) waveforms.add(block.waveform.storageObjectId)
  }
  return { pictures: [...pictures], waveforms: [...waveforms] }
}

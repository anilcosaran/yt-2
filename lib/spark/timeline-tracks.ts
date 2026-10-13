import { orderedScenes, type CompositionDocument, type CompositionScene } from './composition-client'
import { PREVIEW_ONLY_BLOCK_KINDS, isPreviewOnlyClip } from './preview-only'
import { resolveSceneLength } from './scene-timing'

/**
 * P02-16 expanded timeline (decision S14, SAHNE §2–§3). The expanded height shows the scene strip
 * and, under it, one row per derived track kind. Tracks are not stored: they are views of the
 * document's placements (SAHNE §3 "Track modeli"): `visual` (scene layers), `overlay` (project
 * overlays), `caption` (caption tracks), `narration` / `music` / `sfx` (audio placements).
 *
 * Every row shares the strip's time axis. The strip is a flex row of cards (studio.css `.segs`
 * gap 3px; `.seg-b` border-box with `padding: 0 8px` and a 1px border, `flex: <seconds> 1 0`), so
 * a card is `18px + weight / total * free` wide. `stripX` maps a time to that geometry exactly,
 * which keeps blocks and the playhead of every row under the right strip card.
 * Framework-free so the editor and the tests share it.
 */

export const TIMELINE_TRACK_KINDS = ['visual', 'overlay', 'caption', 'narration', 'music', 'sfx'] as const
export type TimelineTrackKind = (typeof TIMELINE_TRACK_KINDS)[number]

/** What a block is (its label). */
export const TIMELINE_BLOCK_KINDS = [
  'clip',
  'text',
  'shape',
  'motion_instance',
  'pending_slot',
  'logo',
  'watermark',
  'lower_third',
  'overlay',
  'caption',
  'narration',
  'music',
  'sfx',
] as const
export type TimelineBlockKind = (typeof TIMELINE_BLOCK_KINDS)[number]

/** Gap between strip cards (studio.css `.segs`). */
export const STRIP_GAP_PX = 3
/** Horizontal padding + border of a strip card (studio.css `.seg-b`: `padding: 0 8px`, 1px border). */
export const STRIP_CARD_EXTRA_PX = 18

/** One strip card on the axis: its absolute start and length in frames, and its flex weight. */
export type StripAxisScene = { sceneId: string; startFrame: number; lengthFrames: number }
export type StripAxis = { scenes: StripAxisScene[]; totalFrames: number; fps: number }

/** A position on the axis: `calc((100% - reservedPx) * fraction + offsetPx)`. */
export type StripX = { fraction: number; offsetPx: number }

export type TimelineTrackBlock = {
  id: string
  kind: TimelineBlockKind
  /** Absolute frames on the strip axis, clamped to the scene (scene-local) or the axis (global). */
  startFrame: number
  endFrame: number
  /** The scene a scene-local block belongs to; null for a project-wide span. */
  sceneId: string | null
  /** D1: the export cannot draw this yet (video, audio, captions, project overlays); the block shows "Preview only". */
  previewOnly?: true
}

export type TimelineTrackRow = { kind: TimelineTrackKind; blocks: TimelineTrackBlock[] }

type FrameRange = { start_frame: number; end_frame: number }

/**
 * The strip axis of a document. A scene's length is its RESOLVED length (Y1-07 W4, `resolveSceneLength`: fixed duration,
 * end of its media, end of its narration); only a scene whose length cannot be derived at all uses the stand-in of the
 * strip card (`unknownSceneSeconds`), so the rows never disagree with the strip.
 */
export function stripAxis(document: CompositionDocument, unknownSceneSeconds: number): StripAxis {
  const fps = document.canvas.fps.num / document.canvas.fps.den
  const unknownFrames = Math.max(1, Math.round(unknownSceneSeconds * fps))
  let startFrame = 0
  const scenes = orderedScenes(document).map((scene) => {
    const lengthFrames = resolveSceneLength(document, scene) ?? unknownFrames
    const entry = { sceneId: scene.scene_id, startFrame, lengthFrames }
    startFrame += lengthFrames
    return entry
  })
  return { scenes, totalFrames: startFrame, fps }
}

/** Pixels the flex layout reserves before sharing the width by weight: card padding + gaps. */
export function stripReservedPx(axis: StripAxis): number {
  const count = axis.scenes.length
  return count === 0 ? 0 : count * STRIP_CARD_EXTRA_PX + (count - 1) * STRIP_GAP_PX
}

/** x of `fraction` (0..1) through the outer box of strip card `index`. */
export function stripX(axis: StripAxis, index: number, fraction: number): StripX {
  const scene = axis.scenes[index]
  if (!scene || axis.totalFrames <= 0) return { fraction: 0, offsetPx: 0 }
  const f = Math.min(1, Math.max(0, fraction))
  return {
    fraction: (scene.startFrame + f * scene.lengthFrames) / axis.totalFrames,
    offsetPx: index * (STRIP_CARD_EXTRA_PX + STRIP_GAP_PX) + f * STRIP_CARD_EXTRA_PX,
  }
}

/**
 * x of an absolute frame. `edge: 'end'` maps a frame on a card boundary to the end of the earlier
 * card (a block ending there does not reach across the gap).
 */
export function stripXForFrame(axis: StripAxis, frame: number, edge: 'start' | 'end' = 'start'): StripX {
  const { scenes } = axis
  if (scenes.length === 0) return { fraction: 0, offsetPx: 0 }
  const clamped = Math.min(axis.totalFrames, Math.max(0, frame))
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index]!
    const end = scene.startFrame + scene.lengthFrames
    const inside = edge === 'end' ? clamped > scene.startFrame && clamped <= end : clamped >= scene.startFrame && clamped < end
    if (inside) return stripX(axis, index, (clamped - scene.startFrame) / scene.lengthFrames)
  }
  return edge === 'end' || clamped >= axis.totalFrames ? stripX(axis, scenes.length - 1, 1) : stripX(axis, 0, 0)
}

/** CSS length of an axis position inside a box as wide as the strip track. */
export function stripCss(axis: StripAxis, x: StripX): string {
  return `calc((100% - ${stripReservedPx(axis)}px) * ${round(x.fraction)} + ${round(x.offsetPx)}px)`
}

/** CSS `left` and `width` of a block. */
export function blockCss(axis: StripAxis, block: TimelineTrackBlock): { left: string; width: string } {
  const start = stripXForFrame(axis, block.startFrame, 'start')
  const end = stripXForFrame(axis, block.endFrame, 'end')
  return {
    left: stripCss(axis, start),
    width: stripCss(axis, { fraction: end.fraction - start.fraction, offsetPx: end.offsetPx - start.offsetPx }),
  }
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6
}

function frameRange(value: unknown): FrameRange | null {
  if (!value || typeof value !== 'object') return null
  const { start_frame: start, end_frame: end } = value as Record<string, unknown>
  return typeof start === 'number' && typeof end === 'number' && end > start ? { start_frame: start, end_frame: end } : null
}

const VISUAL_LAYER_KINDS: ReadonlySet<string> = new Set(['clip', 'text', 'shape', 'motion_instance', 'pending_slot'])
const OVERLAY_KINDS: ReadonlySet<string> = new Set(['logo', 'watermark', 'lower_third'])

/** One scene-local range as an absolute block clamped to its scene. */
function sceneBlock(axisScene: StripAxisScene, id: string, kind: TimelineBlockKind, range: FrameRange): TimelineTrackBlock | null {
  const start = Math.max(0, range.start_frame)
  const end = Math.min(axisScene.lengthFrames, range.end_frame)
  if (end <= start) return null
  return { id, kind, startFrame: axisScene.startFrame + start, endFrame: axisScene.startFrame + end, sceneId: axisScene.sceneId }
}

/** One project range as a block clamped to the axis. */
function projectBlock(axis: StripAxis, id: string, kind: TimelineBlockKind, range: FrameRange): TimelineTrackBlock | null {
  const start = Math.max(0, range.start_frame)
  const end = Math.min(axis.totalFrames, range.end_frame)
  if (end <= start) return null
  return { id, kind, startFrame: start, endFrame: end, sceneId: null }
}

function push(row: TimelineTrackBlock[], block: TimelineTrackBlock | null) {
  if (block) row.push(block)
}

/** D1: flags a block the export cannot draw yet. */
function marked(block: TimelineTrackBlock | null, previewOnly: boolean): TimelineTrackBlock | null {
  return block && previewOnly ? { ...block, previewOnly: true } : block
}

/** The six rows of the expanded timeline, in SAHNE §3 order; a row without content is empty. */
export function timelineTracks(document: CompositionDocument, axis: StripAxis): TimelineTrackRow[] {
  const rows = Object.fromEntries(TIMELINE_TRACK_KINDS.map((kind) => [kind, [] as TimelineTrackBlock[]])) as Record<
    TimelineTrackKind,
    TimelineTrackBlock[]
  >
  const axisScenes = new Map(axis.scenes.map((scene) => [scene.sceneId, scene]))
  const scenes: CompositionScene[] = orderedScenes(document)

  for (const scene of scenes) {
    const axisScene = axisScenes.get(scene.scene_id)
    if (!axisScene) continue
    for (const layer of scene.layers) {
      if (!VISUAL_LAYER_KINDS.has(layer.layer_kind)) continue
      const kind = layer.layer_kind as TimelineBlockKind
      if (layer.layer_kind === 'clip') {
        const placement = (layer as Record<string, unknown>).placement as Record<string, unknown> | undefined
        const previewOnly = isPreviewOnlyClip(document, typeof placement?.source_id === 'string' ? placement.source_id : undefined)
        const global = frameRange(placement?.project_range)
        if (global) push(rows.visual, marked(projectBlock(axis, layer.layer_id, kind, global), previewOnly))
        else {
          const local = frameRange(placement?.scene_range)
          if (local) push(rows.visual, marked(sceneBlock(axisScene, layer.layer_id, kind, local), previewOnly))
        }
        continue
      }
      const local = frameRange((layer as Record<string, unknown>).scene_range)
      if (local) push(rows.visual, sceneBlock(axisScene, layer.layer_id, kind, local))
    }
  }

  for (const layer of document.project_overlays.layers) {
    const body = layer as Record<string, unknown>
    const overlayKind = typeof body.overlay_kind === 'string' && OVERLAY_KINDS.has(body.overlay_kind) ? body.overlay_kind : 'overlay'
    const range = frameRange(body.project_range) ?? { start_frame: 0, end_frame: axis.totalFrames }
    push(rows.overlay, projectBlock(axis, layer.layer_id, overlayKind as TimelineBlockKind, range))
  }

  // Cues come from the transcript/narration word timings (P03-22/P06-33); until they are in the
  // document a caption track is shown as present over the whole video (it is always burned in).
  for (const track of document.caption_tracks) {
    push(rows.caption, projectBlock(axis, track.caption_track_id, 'caption', { start_frame: 0, end_frame: axis.totalFrames }))
  }

  for (const placement of document.audio.placements) {
    const body = placement as Record<string, unknown>
    const role = body.role
    if (role !== 'narration' && role !== 'music' && role !== 'sfx') continue
    const global = frameRange(body.project_range)
    if (global) {
      push(rows[role], projectBlock(axis, placement.placement_id, role, global))
      continue
    }
    const axisScene = typeof body.scene_id === 'string' ? axisScenes.get(body.scene_id) : undefined
    const local = frameRange(body.scene_range)
    if (axisScene && local) push(rows[role], sceneBlock(axisScene, placement.placement_id, role, local))
  }

  return TIMELINE_TRACK_KINDS.map((kind) => ({
    kind,
    blocks: rows[kind]
      .map((block) => (PREVIEW_ONLY_BLOCK_KINDS.has(block.kind) ? ({ ...block, previewOnly: true } as TimelineTrackBlock) : block))
      .sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame),
  }))
}

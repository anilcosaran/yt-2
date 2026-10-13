import type { CompositionDocument, CompositionEntityRef, CompositionOpSpec } from '../composition-client'
import { audioInsertSpec, type CompositionTransform } from '../composition-typed-edits'
import { clipInsertSequenceSpec, mediaImageHoldFrames, mediaStartFrame } from './stage-edits'
import { sceneAtFrame } from './scene-plan'
import type { StageFps, StagePlan } from './stage-types'

/**
 * E1-A shared placement of "add something to the scene" (D11, D14). Every add-action of the editor tools (text, media,
 * shapes, Motion, ...) resolves WHERE the new layer goes through `resolvePlacement` and sends ONE spec list (one command,
 * one undo group) through `SparkStageController.placeLayer`:
 *
 * - `playhead`: the "+" button: the scene under the playhead, starting at the playhead frame.
 * - `canvas`: a drop on the canvas: the same scene and start as the playhead, plus the drop point in canvas pixels so the
 *   tool can position the new layer there (`centredTransformAt`).
 * - `timeline`: a drop on the timeline: the scene and whole second under the pointer (an absolute project frame).
 *
 * Pure functions: the plan, the document and the frame are inputs; nothing here touches the DOM, the session or a clock.
 */

export type CanvasPoint = { x: number; y: number }

export type PlacementTarget =
  | { kind: 'playhead' }
  | { kind: 'canvas'; point: CanvasPoint | null }
  /** `exact`: timeline v2 already snapped the frame; the drop lands on it instead of the whole second under it. */
  | { kind: 'timeline'; frame: number; exact?: boolean }

export type StagePlacement = {
  /** Which gesture asked: the "+" button (`playhead`), a canvas drop or a timeline drop. */
  target: PlacementTarget['kind']
  sceneId: string
  /** Resolved length of the scene (frames). */
  sceneFrames: number
  /** Scene-local frame the new layer starts at, always inside the scene. */
  startFrame: number
  /** The layer the new one is stacked on top of (the scene's top layer); null while the scene has no layer. */
  afterLayerId: string | null
  /** Canvas pixels of a canvas drop (null for the other targets and for a drop outside the frame). */
  dropPoint: CanvasPoint | null
  canvas: { width: number; height: number }
  fps: StageFps
  timingPolicy: 'fixed' | 'follow_media' | 'follow_narration'
  /** The scene already holds an image or video clip layer. */
  hasClip: boolean
}

/** Whole frames per second (the ruler's tick spacing). */
function wholeSecondFrames(fps: StageFps): number {
  return Math.max(1, Math.round(fps.num / fps.den))
}

/**
 * Resolves a placement target. `playbackFrame` is the playhead (absolute project frame). Null while the plan holds no
 * scene or the document lacks the scene (nothing is drawn yet, nothing is placed).
 */
export function resolvePlacement(input: {
  plan: Pick<StagePlan, 'scenes' | 'totalFrames' | 'canvas'>
  document: CompositionDocument
  playbackFrame: number
  target?: PlacementTarget
}): StagePlacement | null {
  const target = input.target ?? { kind: 'playhead' }
  const { plan, document } = input
  const frame = target.kind === 'timeline' ? target.frame : input.playbackFrame
  const at = sceneAtFrame(plan, frame)
  if (!at) return null
  const scene = document.scenes.find((candidate) => candidate.scene_id === at.scene.sceneId)
  if (!scene) return null
  const sceneFrames = at.scene.durationFrames
  let start = at.localFrame
  if (target.kind === 'timeline' && !target.exact) {
    // A timeline drop lands on a whole second of the ruler (clamped into the scene it fell in).
    const second = wholeSecondFrames(plan.canvas.fps)
    start = Math.max(0, Math.floor(Math.max(0, target.frame) / second) * second - at.scene.startFrame)
  }
  const dropPoint = target.kind === 'canvas' ? target.point : null
  return {
    target: target.kind,
    sceneId: scene.scene_id,
    sceneFrames,
    startFrame: mediaStartFrame({ localFrame: start, sceneFrames }),
    afterLayerId: scene.layers.at(-1)?.layer_id ?? null,
    dropPoint,
    canvas: { width: plan.canvas.width, height: plan.canvas.height },
    fps: plan.canvas.fps,
    timingPolicy: scene.timing_policy,
    hasClip: scene.layers.some((layer) => layer.layer_kind === 'clip'),
  }
}

/**
 * A `transform` that puts the CENTRE of a `size` box (canvas pixels, before `scale`) on `point`, kept inside the canvas
 * when the box fits (a layer dropped at the edge is moved in, never half off the picture). The transform's x/y is the
 * top-left of the scaled box (the compiler's geometry rule).
 */
export function centredTransformAt(
  point: CanvasPoint,
  size: { width: number; height: number },
  canvas: { width: number; height: number },
  scale = 1,
): CompositionTransform {
  const width = size.width * scale
  const height = size.height * scale
  const place = (centre: number, extent: number, limit: number) => {
    const start = centre - extent / 2
    return extent >= limit ? start : Math.min(Math.max(0, start), limit - extent)
  }
  return {
    x: Math.round(place(point.x, width, canvas.width) * 100) / 100,
    y: Math.round(place(point.y, height, canvas.height) * 100) / 100,
    scale,
    rotation_deg: 0,
  }
}

// ---------------------------------------------------------------- D11: a video longer than the scene

type Rational = { num: number; den: number }
type Body = Record<string, unknown>

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })

function isRational(value: unknown): value is Rational {
  const rational = value as Rational | null
  return Boolean(rational) && typeof rational!.num === 'number' && typeof rational!.den === 'number' && rational!.num > 0 && rational!.den > 0
}

/** round-half-up(numerator / denominator) for non-negative integers (the gateway's `roundHalfUp`; exact below 2^53). */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

/** Frames of the canvas clock that `ticks` of the source timebase cover (the gateway's `CompositionMediaClock`). */
export function framesForTicks(ticks: number, timebase: Rational, fps: Rational): number {
  return roundDiv(Math.round(ticks) * timebase.num * fps.num, timebase.den * fps.den)
}

/** Source ticks nearest to `frames` canvas frames. */
export function ticksForFrames(frames: number, timebase: Rational, fps: Rational): number {
  return roundDiv(Math.round(frames) * timebase.den * fps.den, timebase.num * fps.num)
}

export type SourceProbe = { durationTicks: number; timebase: Rational; hasAudio: boolean; kind: 'image' | 'video' | 'audio' | null }

/** The probe the document holds for a source (null while the source is missing: a source awaiting its probe is not in it). */
export function sourceProbeOf(document: CompositionDocument, sourceId: string): SourceProbe | null {
  const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const probe = source?.['probe'] as Body | undefined
  if (!source || !probe || typeof probe['duration_ticks'] !== 'number' || !isRational(probe['timebase'])) return null
  const kind = (source['storage_object'] as Body | undefined)?.['media_kind']
  return {
    durationTicks: probe['duration_ticks'] as number,
    timebase: probe['timebase'] as Rational,
    hasAudio: typeof probe['audio_channels'] === 'number' && (probe['audio_channels'] as number) > 0,
    kind: kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null,
  }
}

/** Frames a source plays for at 1x on the document's canvas clock (null without a probe). */
export function sourceFrames(document: CompositionDocument, sourceId: string): number | null {
  const probe = sourceProbeOf(document, sourceId)
  return probe ? framesForTicks(probe.durationTicks, probe.timebase, document.canvas.fps) : null
}

export type VideoFit =
  /** The whole video ends inside the scene (or the scene follows its media): insert it as is. */
  | { mode: 'fits'; frames: number }
  /** A `fixed` scene without another clip: the scene follows its media from now on (`scene.set_timing`). */
  | { mode: 'follow_media'; frames: number }
  /** The scene keeps its length: the clip is trimmed to what remains (`source_range`); `fullFrames` is what it would be. */
  | { mode: 'trim'; frames: number; fullFrames: number; sourceRange: { in_tick: number; out_tick: number } }

/**
 * D11. A video that would end after a scene whose length is fixed or follows narration: with no other clip in the
 * scene (and a `fixed` scene) the scene switches to `follow_media`; otherwise the clip is trimmed to the remaining scene
 * length. A layer is never written outside its scene (the server refuses it: `inv_scene_content_within_length`).
 */
export function planVideoFit(input: { document: CompositionDocument; placement: StagePlacement; sourceId: string }): VideoFit | null {
  const { document, placement } = input
  const probe = sourceProbeOf(document, input.sourceId)
  if (!probe) return null
  const full = framesForTicks(probe.durationTicks, probe.timebase, document.canvas.fps)
  if (placement.timingPolicy === 'follow_media' || placement.startFrame + full <= placement.sceneFrames) return { mode: 'fits', frames: full }
  if (placement.timingPolicy === 'fixed' && !placement.hasClip) return { mode: 'follow_media', frames: full }
  const remaining = Math.max(1, placement.sceneFrames - placement.startFrame)
  // The tick count whose frame count does not exceed the room (the tick rate may be coarser than the frame rate).
  let outTick = Math.min(probe.durationTicks, ticksForFrames(remaining, probe.timebase, document.canvas.fps))
  while (outTick > 1 && framesForTicks(outTick, probe.timebase, document.canvas.fps) > remaining) outTick -= 1
  return { mode: 'trim', frames: framesForTicks(outTick, probe.timebase, document.canvas.fps), fullFrames: full, sourceRange: { in_tick: 0, out_tick: outTick } }
}

/** `scene.set_timing` (`follow_media` carries no duration). Builder lives here until the shared builders list takes it. */
export function sceneFollowMediaSpec(sceneId: string): CompositionOpSpec {
  return {
    op: { op: 'scene.set_timing', scene_id: sceneId, timing_policy: 'follow_media' },
    reads: [sceneRef(sceneId)],
    targets: [sceneRef(sceneId)],
  }
}

export type MediaPlacement = {
  specs: CompositionOpSpec[]
  layerId: string
  /** What D11 decided for a video (null for an image, or a video whose probe is not in the document). */
  fit: VideoFit | null
}

/**
 * The command of "add this project source (image or video) to the scene" at a resolved placement: `clip.insert_sequence`
 * at the placement's start frame on top of the scene, an image held for `imageHoldSeconds` (never past a fixed scene's
 * end), a video fitted by D11. Exactly one spec list for one gesture. For an image the server needs the hold; for a video
 * without a probe in the document the server decides (and refuses a source that is not ready).
 */
export function mediaPlacementSpecs(input: {
  document: CompositionDocument
  placement: StagePlacement
  sourceId: string
  kind: 'image' | 'video'
  layerId: string
  imageHoldSeconds?: number
}): MediaPlacement {
  const { document, placement, sourceId, kind, layerId } = input
  const insert = (extra: { imageHoldFrames?: number; sourceRange?: { in_tick: number; out_tick: number } }) =>
    clipInsertSequenceSpec({
      sceneId: placement.sceneId,
      afterLayerId: placement.afterLayerId,
      startFrame: placement.startFrame,
      ...(extra.imageHoldFrames !== undefined && { imageHoldFrames: extra.imageHoldFrames }),
      items: [{ layerId, sourceId, ...(extra.sourceRange && { sourceRange: extra.sourceRange }) }],
    })
  if (kind === 'image') {
    const hold = Math.round(((input.imageHoldSeconds ?? 3) * placement.fps.num) / placement.fps.den)
    const imageHoldFrames = mediaImageHoldFrames({
      startFrame: placement.startFrame,
      sceneFrames: placement.sceneFrames,
      holdFrames: hold,
      followsMedia: placement.timingPolicy === 'follow_media',
    })
    return { specs: [insert({ imageHoldFrames })], layerId, fit: null }
  }
  const fit = planVideoFit({ document, placement, sourceId })
  if (fit?.mode === 'trim') return { specs: [insert({ sourceRange: fit.sourceRange })], layerId, fit }
  // The scene switches AFTER the clip is in it: `scene.set_timing` judges the content against the new length.
  if (fit?.mode === 'follow_media') return { specs: [insert({}), sceneFollowMediaSpec(placement.sceneId)], layerId, fit }
  return { specs: [insert({})], layerId, fit }
}

// ---------------------------------------------------------------- audio: a music bed on the scene

/** Gain of a music bed added from the Media drawer: well under a narration at 0 dB (the mix plan ducks it further). */
export const MUSIC_BED_GAIN_DB = -12

export type AudioBedPlan = {
  specs: CompositionOpSpec[]
  /** Frames the bed plays for (the whole file, or what remains of the scene). */
  frames: number
  /** The file is longer than the room in the scene: it was cut at the scene end. */
  trimmed: boolean
}

/**
 * `audio.insert` of an audio file as the scene's music bed, from `startFrame` to the end of the file or of the scene,
 * whichever comes first (a bed never plays past its scene). Null without a probe in the document, or for a source that
 * has no audio.
 */
export function audioBedSpecs(input: {
  document: CompositionDocument
  sceneId: string
  startFrame: number
  sceneFrames: number
  sourceId: string
  placementId: string
  gainDb?: number
}): AudioBedPlan | null {
  const probe = sourceProbeOf(input.document, input.sourceId)
  if (!probe || probe.kind !== 'audio' || !probe.hasAudio) return null
  const fps = input.document.canvas.fps
  const full = framesForTicks(probe.durationTicks, probe.timebase, fps)
  const room = Math.max(1, input.sceneFrames - input.startFrame)
  let outTick = probe.durationTicks
  let frames = full
  if (full > room) {
    outTick = Math.min(probe.durationTicks, ticksForFrames(room, probe.timebase, fps))
    while (outTick > 1 && framesForTicks(outTick, probe.timebase, fps) > room) outTick -= 1
    frames = framesForTicks(outTick, probe.timebase, fps)
  }
  if (frames < 1) return null
  return {
    frames,
    trimmed: full > room,
    specs: [
      audioInsertSpec({
        placementId: input.placementId,
        role: 'music',
        sourceId: input.sourceId,
        sourceRange: { in_tick: 0, out_tick: outTick },
        gainDb: input.gainDb ?? MUSIC_BED_GAIN_DB,
        span: { sceneId: input.sceneId, sceneRange: { start_frame: input.startFrame, end_frame: input.startFrame + frames } },
      }),
    ],
  }
}

// ---------------------------------------------------------------- drag payload (D14)

/** MIME type of a tool card being dragged onto the canvas or the timeline. */
export const SPARK_CARD_MIME = 'application/x-youtorch-spark-card'

/**
 * What a card carries while it is dragged: the tool that owns it (`SparkToolEntry.id`), the card kind of that tool and a
 * small JSON-safe payload (ids and numbers, never a file or a URL that is not already public to the page).
 */
export type SparkCardDrag = { tool: string; kind: string; data: Record<string, unknown> }

type DataTransferWrite = Pick<DataTransfer, 'setData'> & { effectAllowed?: DataTransfer['effectAllowed'] }
type DataTransferRead = Pick<DataTransfer, 'getData'>
type DataTransferTypes = { types?: ArrayLike<string> | readonly string[] | null }

export function writeCardDrag(dataTransfer: DataTransferWrite, drag: SparkCardDrag): void {
  dataTransfer.setData(SPARK_CARD_MIME, JSON.stringify(drag))
  // A plain-text fallback so that dropping outside the editor is harmless.
  dataTransfer.setData('text/plain', drag.kind)
  dataTransfer.effectAllowed = 'copy'
}

export function readCardDrag(dataTransfer: DataTransferRead | null | undefined): SparkCardDrag | null {
  if (!dataTransfer) return null
  let raw = ''
  try {
    raw = dataTransfer.getData(SPARK_CARD_MIME)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<SparkCardDrag> | null
    if (!value || typeof value.tool !== 'string' || typeof value.kind !== 'string') return null
    const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? (value.data as Record<string, unknown>) : {}
    return { tool: value.tool, kind: value.kind, data }
  } catch {
    return null
  }
}

function typesOf(dataTransfer: DataTransferTypes | null | undefined): string[] {
  return dataTransfer?.types ? Array.from(dataTransfer.types) : []
}

/** A card of a tool is being dragged (during `dragover` only the types are readable). */
export function isCardDrag(dataTransfer: DataTransferTypes | null | undefined): boolean {
  return typesOf(dataTransfer).includes(SPARK_CARD_MIME)
}

/** Files from the desktop are being dragged. */
export function isFileDrag(dataTransfer: DataTransferTypes | null | undefined): boolean {
  return typesOf(dataTransfer).includes('Files')
}

/** What the editor accepts on the canvas and the timeline. */
export function acceptsToolDrop(dataTransfer: DataTransferTypes | null | undefined): boolean {
  return isCardDrag(dataTransfer) || isFileDrag(dataTransfer)
}

export type SparkToolDrop = { kind: 'card'; drag: SparkCardDrag } | { kind: 'files'; files: File[] }

/** The drop of a native `drop` event: a tool card, or the files of the desktop; null for anything else. */
export function readToolDrop(dataTransfer: (DataTransferRead & DataTransferTypes & { files?: ArrayLike<File> | null }) | null | undefined): SparkToolDrop | null {
  if (!dataTransfer) return null
  const drag = readCardDrag(dataTransfer)
  if (drag) return { kind: 'card', drag }
  const files = dataTransfer.files ? Array.from(dataTransfer.files) : []
  return files.length > 0 ? { kind: 'files', files } : null
}

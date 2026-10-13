import type { CompositionDocument, CompositionOpSpec } from '../composition-client'
import { layerSetTransformSpec, narrationSetSpec, sceneNarrationPlacementId, type CompositionTransform } from '../composition-typed-edits'
import { containFit } from '../stage/geometry'
import { framesForTicks, planVideoFit, sceneFollowMediaSpec, sourceProbeOf, type StagePlacement, type VideoFit } from '../stage/placement'
import type { PlacementNotice } from '../stage/stage-controller'
import { clipInsertSequenceSpec } from '../stage/stage-edits'
import { suppliedAudioProvenance } from './narration-provenance'

/**
 * E1-F placement of a finished take (pure: the document, the resolved placement and the new ids are inputs). Screen and
 * Camera go through the shared media placement (`placeMedia`, D11); the two multi-file cases live here:
 *
 * - Screen + camera (D7): TWO clips of the same scene starting together at the playhead. The camera clip goes ABOVE the
 *   screen clip with a corner transform (bottom-right, a quarter of its natural size), so it can be moved and scaled
 *   like any layer. One command: one undo group.
 * - Voice only: the scene's narration (`narration.set`, `supplied_audio`). It REPLACES the narration the scene has (the
 *   design's "Replace the AI voice with your own"); the user can undo it.
 */

/** The camera clip's size relative to its natural (contain-fit) box. */
export const CAMERA_CORNER_SCALE = 0.25
/** Gap between the camera clip and the canvas edges, as a share of the canvas width. */
export const CAMERA_CORNER_MARGIN_RATIO = 0.03

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * The transform that puts the camera clip in the bottom-right corner. `x`/`y` is the top-left corner of the scaled box
 * (the compiler's geometry rule), the natural box is the camera picture fitted inside the canvas (`containFit`); without
 * the camera's pixel size the natural box is the canvas, which gives the same quarter-size corner clip.
 */
export function cameraCornerTransform(
  canvas: { width: number; height: number },
  camera: { width: number | null; height: number | null } | null,
  scale: number = CAMERA_CORNER_SCALE,
): CompositionTransform {
  const natural = containFit(canvas, camera?.width ?? 0, camera?.height ?? 0)
  const margin = Math.round(canvas.width * CAMERA_CORNER_MARGIN_RATIO)
  return {
    x: round2(canvas.width - margin - natural.width * scale),
    y: round2(canvas.height - margin - natural.height * scale),
    scale,
    rotation_deg: 0,
  }
}

export type PairPlacementInput = {
  document: CompositionDocument
  placement: StagePlacement
  screenSourceId: string
  cameraSourceId: string
  screenLayerId: string
  cameraLayerId: string
  /** Pixel size of the camera picture (from the recorder), null when unknown. */
  cameraSize: { width: number | null; height: number | null } | null
}

export type TakePlacement = { specs: CompositionOpSpec[]; notice: PlacementNotice | null }

function noticeOfFits(fits: ReadonlyArray<VideoFit | null>, fps: { num: number; den: number }): PlacementNotice | null {
  if (fits.some((fit) => fit?.mode === 'follow_media')) return { kind: 'sceneFollowsMedia' }
  const trimmed = fits.find((fit) => fit?.mode === 'trim')
  if (trimmed?.mode === 'trim') return { kind: 'videoTrimmed', seconds: Math.round(((trimmed.frames * fps.den) / fps.num) * 10) / 10 }
  return null
}

/**
 * The command of "screen + camera": the screen clip, the camera clip right above it, the camera's corner transform and,
 * when D11 asks for it, the scene following its media. Both clips start at the placement's start frame; D11 is decided for
 * the pair (a scene that has to follow its media follows the longer of the two; otherwise each clip is trimmed to what is
 * left of the scene).
 */
export function pairPlacementSpecs(input: PairPlacementInput): TakePlacement {
  const { document, placement } = input
  const screenFit = planVideoFit({ document, placement, sourceId: input.screenSourceId })
  const cameraFit = planVideoFit({ document, placement, sourceId: input.cameraSourceId })
  const followsMedia = screenFit?.mode === 'follow_media' || cameraFit?.mode === 'follow_media'
  const rangeOf = (fit: VideoFit | null) => (!followsMedia && fit?.mode === 'trim' ? { sourceRange: fit.sourceRange } : {})
  const specs: CompositionOpSpec[] = [
    clipInsertSequenceSpec({
      sceneId: placement.sceneId,
      afterLayerId: placement.afterLayerId,
      startFrame: placement.startFrame,
      items: [{ layerId: input.screenLayerId, sourceId: input.screenSourceId, ...rangeOf(screenFit) }],
    }),
    clipInsertSequenceSpec({
      sceneId: placement.sceneId,
      afterLayerId: input.screenLayerId,
      startFrame: placement.startFrame,
      items: [{ layerId: input.cameraLayerId, sourceId: input.cameraSourceId, ...rangeOf(cameraFit) }],
    }),
    layerSetTransformSpec(placement.sceneId, input.cameraLayerId, cameraCornerTransform(placement.canvas, input.cameraSize)),
  ]
  // The scene switches AFTER its clips are in it: `scene.set_timing` judges the content against the new length.
  if (followsMedia) specs.push(sceneFollowMediaSpec(placement.sceneId))
  return { specs, notice: noticeOfFits([screenFit, cameraFit], placement.fps) }
}

export type VoicePlacementInput = {
  document: CompositionDocument
  placement: StagePlacement
  sourceId: string
  placementId: string
}

export type VoicePlacement = {
  specs: CompositionOpSpec[]
  /** The recording ends after its scene does (the audio plays on into the next scenes); seconds of the recording. */
  runsPastScene: { seconds: number } | null
  /** The scene had narration and the recording replaces it. */
  replacedNarration: boolean
}

/**
 * The command of "voice only": `narration.set` with the recording as the scene's narration, starting at the playhead,
 * playing for its whole length (audio may cross a scene edge). Null while the source is not an audio source with a probe
 * in the document (the server would refuse it as missing).
 */
export function voicePlacementSpecs(input: VoicePlacementInput): VoicePlacement | null {
  const { document, placement } = input
  const probe = sourceProbeOf(document, input.sourceId)
  if (!probe || probe.kind !== 'audio') return null
  const frames = Math.max(1, framesForTicks(probe.durationTicks, probe.timebase, document.canvas.fps))
  const replaces = sceneNarrationPlacementId(document, placement.sceneId)
  const end = placement.startFrame + frames
  const specs = [
    narrationSetSpec({
      sceneId: placement.sceneId,
      replacesPlacementId: replaces,
      placement: {
        placement_id: input.placementId,
        source_id: input.sourceId,
        source_range: { in_tick: 0, out_tick: probe.durationTicks },
        scene_range: { start_frame: placement.startFrame, end_frame: end },
        gain_db: 0,
        narration_provenance: suppliedAudioProvenance(input.sourceId),
      },
    }),
  ]
  // A scene that follows its narration grows with it; a fixed one does not, so say that the recording plays on.
  const overshoot = placement.timingPolicy === 'follow_narration' ? 0 : end - placement.sceneFrames
  return {
    specs,
    runsPastScene: overshoot > 0 ? { seconds: Math.round(((overshoot * placement.fps.den) / placement.fps.num) * 10) / 10 } : null,
    replacedNarration: replaces !== null,
  }
}

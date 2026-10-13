import type {
  CompositionDocument,
  CompositionEntityRef,
  CompositionOpSpec,
  CompositionScene,
} from './composition-client'
import { resolveTimeline } from './scene-timing'

/**
 * Spark builders of the P02-06 typed edit ops. Each returns one `CompositionOpSpec` whose `reads`
 * and `targets` mirror the gateway handler (reads include the structural parent: the scene for
 * layer insert/remove/split, the `audio` container for placement insert/remove), so
 * `session.apply([...])` sends one `composition_command_v1` with the right CAS and one undo group.
 * Semantics stay in the gateway: nothing is applied locally, parameters are passed as given and
 * the server refuses an invalid value with a reason (never clamped here).
 */

// ---------------------------------------------------------------- document v1 value shapes

/** Half-open [start_frame, end_frame) at the canvas fps. */
export type CompositionFrameRange = { start_frame: number; end_frame: number }
/** Half-open [in_tick, out_tick) on the source media timebase. */
export type CompositionSourceRange = { in_tick: number; out_tick: number }
export type CompositionCrop = { left: number; top: number; right: number; bottom: number }
export type CompositionTransform = { x: number; y: number; scale: number; rotation_deg: number; crop?: CompositionCrop }
/** Pinned font revision (FontRef); the font catalog is P02-11. */
export type CompositionFontRef = { font_id: string; font_revision: string; sha256: string }
export type CompositionTextAlign = 'start' | 'center' | 'end'
/** Spark styling round: underline / strikethrough lines (at least one true when stored). */
export type CompositionTextDecoration = { underline: boolean; strikethrough: boolean }
/** Spark styling round: an outline behind the glyphs; `width_px` is the visible width outside the glyph edge. */
export type CompositionTextStroke = { color: string; width_px: number }
export type CompositionTextStyle = {
  font: CompositionFontRef
  size_px: number
  color: string
  align?: CompositionTextAlign
  line_height?: number
  text_decoration?: CompositionTextDecoration
  stroke?: CompositionTextStroke
}
export type CompositionShape = 'rect' | 'ellipse' | 'line'
/** E1-B (D4): the box of a shape layer in canvas pixels. */
export type CompositionShapeSize = { width_px: number; height_px: number }
export type CompositionClipAudio = { gain_db: number; muted: boolean }
export type CompositionPreparationArtifactRef = {
  artifact_kind: 'video_brief' | 'script' | 'shot_plan' | 'production_plan' | 'transcript'
  artifact_id: string
  artifact_revision: number
}
export type CompositionBrandRevisionRef = {
  ref_type: 'brand_revision'
  brand_asset_kind: 'kit' | 'element' | 'template' | 'motion'
  brand_asset_id: string
  brand_revision_id: string
  brand_revision_digest_sha256: string
}
/** P00-13 `edit_op_v1`, carried as is inside `motion.edit` (validated by the gateway). */
export type CompositionMotionEditOp = { op: string } & Record<string, unknown>

// ---------------------------------------------------------------- refs and ids

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })
const layerRef = (layerId: string): CompositionEntityRef => ({ entity_kind: 'layer', entity_id: layerId })
const audioPlacementRef = (placementId: string): CompositionEntityRef => ({ entity_kind: 'audio', entity_id: placementId })
const captionTrackRef = (trackId: string): CompositionEntityRef => ({ entity_kind: 'caption_track', entity_id: trackId })

/** Parent of audio placement insert/remove (containers are addressed by their kind name). */
export const AUDIO_CONTAINER_REF: CompositionEntityRef = { entity_kind: 'audio', entity_id: 'audio' }

export function newLayerId(uuid: string) {
  return `lyr_${uuid}`
}

export function newAudioPlacementId(uuid: string) {
  return `aud_${uuid}`
}

export function newCaptionTrackId(uuid: string) {
  return `cap_${uuid}`
}

// ---------------------------------------------------------------- clips

export function clipInsertSpec(input: {
  sceneId: string
  layerId: string
  afterLayerId: string | null
  placement: { source_id: string; source_range: CompositionSourceRange; scene_range: CompositionFrameRange }
  transform?: CompositionTransform
  audio?: CompositionClipAudio
}): CompositionOpSpec {
  return {
    op: {
      op: 'clip.insert',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      after_layer_id: input.afterLayerId,
      placement: input.placement,
      ...(input.transform && { transform: input.transform }),
      ...(input.audio && { audio: input.audio }),
    },
    reads: [sceneRef(input.sceneId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId)],
  }
}

/** Splits a clip at a scene frame; the right part becomes `newLayerId`. */
export function clipSplitSpec(input: { sceneId: string; layerId: string; atFrame: number; newLayerId: string }): CompositionOpSpec {
  return {
    op: { op: 'clip.split', scene_id: input.sceneId, layer_id: input.layerId, at_frame: input.atFrame, new_layer_id: input.newLayerId },
    reads: [sceneRef(input.sceneId), layerRef(input.layerId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId), layerRef(input.newLayerId)],
  }
}

/** Removes source ranges (e.g. silences) and closes the gaps: one command, one undo group. */
export function clipRemoveRangesSpec(input: {
  sceneId: string
  layerId: string
  ranges: CompositionSourceRange[]
  segmentLayerIds: string[]
}): CompositionOpSpec {
  return {
    op: {
      op: 'clip.remove_ranges',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      ranges: input.ranges,
      segment_layer_ids: input.segmentLayerIds,
    },
    reads: [sceneRef(input.sceneId), layerRef(input.layerId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId), ...input.segmentLayerIds.map(layerRef)],
  }
}

/** Gain and/or mute of a video clip's own audio. */
export function clipSetAudioSpec(
  sceneId: string,
  layerId: string,
  patch: { gainDb?: number; muted?: boolean },
): CompositionOpSpec {
  if (patch.gainDb === undefined && patch.muted === undefined) throw new Error('clip.set_audio needs gainDb or muted')
  return {
    op: {
      op: 'clip.set_audio',
      scene_id: sceneId,
      layer_id: layerId,
      ...(patch.gainDb !== undefined && { gain_db: patch.gainDb }),
      ...(patch.muted !== undefined && { muted: patch.muted }),
    },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/**
 * P04-13 `clip.replace_source` (E1-J "Replace background"): the clip keeps its place, timing, transform, audio setting and
 * animations and plays another attached source of the SAME visual kind (an image for an image, a video for a video whose
 * range has the clip's length; the server refuses a mismatch with a reason). An image takes its whole source range
 * (`{ in_tick: 0, out_tick: probe.duration_ticks }`). The old source stays attached; the inverse restores the layer.
 */
export function clipReplaceSourceSpec(input: {
  sceneId: string
  layerId: string
  sourceId: string
  sourceRange: CompositionSourceRange
  generatedTakeRef?: { production_run_id: string; take_id: string }
}): CompositionOpSpec {
  return {
    op: {
      op: 'clip.replace_source',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      source_id: input.sourceId,
      source_range: input.sourceRange,
      ...(input.generatedTakeRef && { generated_take_ref: input.generatedTakeRef }),
    },
    reads: [layerRef(input.layerId)],
    targets: [layerRef(input.layerId)],
  }
}

// ---------------------------------------------------------------- native text and shapes

export function textInsertSpec(input: {
  sceneId: string
  layerId: string
  afterLayerId: string | null
  text: string
  style: CompositionTextStyle
  sceneRange: CompositionFrameRange
  transform?: CompositionTransform
}): CompositionOpSpec {
  return {
    op: {
      op: 'text.insert',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      after_layer_id: input.afterLayerId,
      text: input.text,
      style: input.style,
      scene_range: input.sceneRange,
      ...(input.transform && { transform: input.transform }),
    },
    reads: [sceneRef(input.sceneId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId)],
  }
}

export function textSetSpec(sceneId: string, layerId: string, text: string): CompositionOpSpec {
  return {
    op: { op: 'text.set', scene_id: sceneId, layer_id: layerId, text },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** The `text.set_style` patch of the editor (camelCase); `null` clears a field. */
export type TextStyleSpecPatch = {
  font?: CompositionFontRef
  sizePx?: number
  color?: string
  align?: CompositionTextAlign | null
  /** Spark styling round: line spacing as a multiple of the size (0.5-3). */
  lineHeight?: number | null
  /** Spark styling round: the full decoration is sent; both lines off (or `null`) clears it. */
  decoration?: CompositionTextDecoration | null
  /** Spark styling round: the full outline is sent; `null` clears it. */
  stroke?: CompositionTextStroke | null
}

const TEXT_STYLE_PATCH_FIELDS = ['font', 'sizePx', 'color', 'align', 'lineHeight', 'decoration', 'stroke'] as const

/** Font revision, size, colour, alignment, line spacing, decoration and outline; only the given fields change (`null` clears). */
export function textSetStyleSpec(sceneId: string, layerId: string, patch: TextStyleSpecPatch): CompositionOpSpec {
  if (TEXT_STYLE_PATCH_FIELDS.every((field) => patch[field] === undefined)) {
    throw new Error(`text.set_style needs one of ${TEXT_STYLE_PATCH_FIELDS.join(', ')}`)
  }
  return {
    op: {
      op: 'text.set_style',
      scene_id: sceneId,
      layer_id: layerId,
      ...(patch.font !== undefined && { font: patch.font }),
      ...(patch.sizePx !== undefined && { size_px: patch.sizePx }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.align !== undefined && { align: patch.align }),
      ...(patch.lineHeight !== undefined && { line_height: patch.lineHeight }),
      ...(patch.decoration !== undefined && { text_decoration: patch.decoration }),
      ...(patch.stroke !== undefined && { stroke: patch.stroke }),
    },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

export function shapeInsertSpec(input: {
  sceneId: string
  layerId: string
  afterLayerId: string | null
  shape: CompositionShape
  fill: string
  sceneRange: CompositionFrameRange
  transform?: CompositionTransform
  /** E1-B (D4): the box in canvas pixels (absent: the canvas-sized box of the first document v1). */
  size?: CompositionShapeSize
  /** E1-B (D4): corner radius of a `rect` in canvas pixels (a pill is `height / 2`). */
  cornerRadiusPx?: number
}): CompositionOpSpec {
  return {
    op: {
      op: 'shape.insert',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      after_layer_id: input.afterLayerId,
      shape: input.shape,
      fill: input.fill,
      scene_range: input.sceneRange,
      ...(input.transform && { transform: input.transform }),
      ...(input.size && { size: input.size }),
      ...(input.cornerRadiusPx !== undefined && { corner_radius_px: input.cornerRadiusPx }),
    },
    reads: [sceneRef(input.sceneId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId)],
  }
}

export function shapeSetFillSpec(sceneId: string, layerId: string, fill: string): CompositionOpSpec {
  return {
    op: { op: 'shape.set_fill', scene_id: sceneId, layer_id: layerId, fill },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** `shape.set_size` (E1-B, D4): the full box of a rect or ellipse in canvas pixels; its top-left stays at `transform.x/y`. */
export function shapeSetSizeSpec(sceneId: string, layerId: string, size: CompositionShapeSize): CompositionOpSpec {
  return {
    op: { op: 'shape.set_size', scene_id: sceneId, layer_id: layerId, size },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** `shape.set_corner_radius` (E1-B, D4): the radius of a rect in canvas pixels; `null` clears it (square corners). */
export function shapeSetCornerRadiusSpec(sceneId: string, layerId: string, cornerRadiusPx: number | null): CompositionOpSpec {
  return {
    op: { op: 'shape.set_corner_radius', scene_id: sceneId, layer_id: layerId, corner_radius_px: cornerRadiusPx },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

// ---------------------------------------------------------------- generic layer edits

/** Moves a layer in scene time; its length stays. */
export function layerMoveSpec(sceneId: string, layerId: string, startFrame: number): CompositionOpSpec {
  return {
    op: { op: 'layer.move', scene_id: sceneId, layer_id: layerId, start_frame: startFrame },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** A video clip is trimmed by its source range; an image clip, text or shape by its scene range. */
export function layerTrimSpec(
  sceneId: string,
  layerId: string,
  range: { sourceRange: CompositionSourceRange } | { sceneRange: CompositionFrameRange },
): CompositionOpSpec {
  return {
    op: {
      op: 'layer.trim',
      scene_id: sceneId,
      layer_id: layerId,
      ...('sourceRange' in range ? { source_range: range.sourceRange } : { scene_range: range.sceneRange }),
    },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** Position, scale, rotation and crop; the full value is sent (`null` clears the transform). */
export function layerSetTransformSpec(sceneId: string, layerId: string, transform: CompositionTransform | null): CompositionOpSpec {
  return {
    op: { op: 'layer.set_transform', scene_id: sceneId, layer_id: layerId, transform },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/**
 * `layer.set_opacity` (Spark styling round): a text, shape or image clip layer's opacity 0-1; `null` (or 1) makes it opaque
 * again. The server refuses a video clip or a Motion instance (`layer_opacity_not_supported`).
 */
export function layerSetOpacitySpec(sceneId: string, layerId: string, opacity: number | null): CompositionOpSpec {
  return {
    op: { op: 'layer.set_opacity', scene_id: sceneId, layer_id: layerId, opacity },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

/** `layer.set_locked` (Spark styling round): the editor's UI lock (the stage neither selects nor drags the layer). */
export function layerSetLockedSpec(sceneId: string, layerId: string, locked: boolean): CompositionOpSpec {
  return {
    op: { op: 'layer.set_locked', scene_id: sceneId, layer_id: layerId, locked },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

export function layerRemoveSpec(sceneId: string, layerId: string): CompositionOpSpec {
  return {
    op: { op: 'layer.remove', scene_id: sceneId, layer_id: layerId },
    reads: [sceneRef(sceneId), layerRef(layerId)],
    targets: [sceneRef(sceneId), layerRef(layerId)],
  }
}

// ---------------------------------------------------------------- audio placements

/** Music or sound effect, scene-local (`sceneId` + `sceneRange`) or global (`projectRange`). */
export function audioInsertSpec(input: {
  placementId: string
  role: 'music' | 'sfx'
  sourceId: string
  sourceRange: CompositionSourceRange
  gainDb: number
  span: { sceneId: string; sceneRange: CompositionFrameRange } | { projectRange: CompositionFrameRange }
}): CompositionOpSpec {
  const sceneId = 'sceneId' in input.span ? input.span.sceneId : null
  return {
    op: {
      op: 'audio.insert',
      placement_id: input.placementId,
      role: input.role,
      source_id: input.sourceId,
      source_range: input.sourceRange,
      gain_db: input.gainDb,
      ...('sceneId' in input.span
        ? { scene_id: input.span.sceneId, scene_range: input.span.sceneRange }
        : { project_range: input.span.projectRange }),
    },
    reads: [AUDIO_CONTAINER_REF, ...(sceneId ? [sceneRef(sceneId)] : [])],
    targets: [AUDIO_CONTAINER_REF, audioPlacementRef(input.placementId)],
  }
}

/**
 * Sets, replaces (`replacesPlacementId`, the narration the user saw) or clears (`placement: null`)
 * the narration audio of one scene.
 */
export function narrationSetSpec(input: {
  sceneId: string
  replacesPlacementId: string | null
  placement: {
    placement_id: string
    source_id: string
    source_range: CompositionSourceRange
    scene_range: CompositionFrameRange
    gain_db: number
    /** P06-27: how the audio was obtained (E1-F: a recording the user made is `supplied_audio`). */
    narration_provenance?: { source_mode: 'supplied_audio' | 'generated_speech'; spec_sha256: string }
  } | null
}): CompositionOpSpec {
  if (input.placement === null && input.replacesPlacementId === null) {
    throw new Error('narration.set needs a placement or replacesPlacementId')
  }
  const replaced = input.replacesPlacementId ? [audioPlacementRef(input.replacesPlacementId)] : []
  return {
    op: {
      op: 'narration.set',
      scene_id: input.sceneId,
      replaces_placement_id: input.replacesPlacementId,
      placement: input.placement,
    },
    reads: [AUDIO_CONTAINER_REF, sceneRef(input.sceneId), ...replaced],
    targets: [
      AUDIO_CONTAINER_REF,
      ...replaced,
      ...(input.placement ? [audioPlacementRef(input.placement.placement_id)] : []),
    ],
  }
}

export function audioSetGainSpec(placementId: string, gainDb: number): CompositionOpSpec {
  return {
    op: { op: 'audio.set_gain', placement_id: placementId, gain_db: gainDb },
    reads: [audioPlacementRef(placementId)],
    targets: [audioPlacementRef(placementId)],
  }
}

export function audioMoveSpec(placementId: string, startFrame: number): CompositionOpSpec {
  return {
    op: { op: 'audio.move', placement_id: placementId, start_frame: startFrame },
    reads: [audioPlacementRef(placementId)],
    targets: [audioPlacementRef(placementId)],
  }
}

export function audioTrimSpec(placementId: string, sourceRange: CompositionSourceRange): CompositionOpSpec {
  return {
    op: { op: 'audio.trim', placement_id: placementId, source_range: sourceRange },
    reads: [audioPlacementRef(placementId)],
    targets: [audioPlacementRef(placementId)],
  }
}

export function audioRemoveSpec(placementId: string): CompositionOpSpec {
  return {
    op: { op: 'audio.remove', placement_id: placementId },
    reads: [AUDIO_CONTAINER_REF, audioPlacementRef(placementId)],
    targets: [AUDIO_CONTAINER_REF, audioPlacementRef(placementId)],
  }
}

// ---------------------------------------------------------------- caption tracks

/** Burned-in captions from a transcript or script revision; the style is a Kit/Element revision. */
export function captionTrackAddSpec(input: {
  captionTrackId: string
  source: CompositionPreparationArtifactRef
  styleRef?: CompositionBrandRevisionRef
}): CompositionOpSpec {
  return {
    op: {
      op: 'caption_track.add',
      caption_track_id: input.captionTrackId,
      source: input.source,
      ...(input.styleRef && { style_ref: input.styleRef }),
    },
    reads: [],
    targets: [captionTrackRef(input.captionTrackId)],
  }
}

export function captionTrackSetSourceSpec(captionTrackId: string, source: CompositionPreparationArtifactRef): CompositionOpSpec {
  return {
    op: { op: 'caption_track.set_source', caption_track_id: captionTrackId, source },
    reads: [captionTrackRef(captionTrackId)],
    targets: [captionTrackRef(captionTrackId)],
  }
}

export function captionTrackSetStyleSpec(captionTrackId: string, styleRef: CompositionBrandRevisionRef | null): CompositionOpSpec {
  return {
    op: { op: 'caption_track.set_style', caption_track_id: captionTrackId, style_ref: styleRef },
    reads: [captionTrackRef(captionTrackId)],
    targets: [captionTrackRef(captionTrackId)],
  }
}

export function captionTrackRemoveSpec(captionTrackId: string): CompositionOpSpec {
  return {
    op: { op: 'caption_track.remove', caption_track_id: captionTrackId },
    reads: [captionTrackRef(captionTrackId)],
    targets: [captionTrackRef(captionTrackId)],
  }
}

// ---------------------------------------------------------------- Motion

/** A P00-13 edit_op on a Motion instance layer (document v1 refuses it with 422 until P06-46). */
export function motionEditSpec(layerId: string, editOp: CompositionMotionEditOp): CompositionOpSpec {
  return {
    op: { op: 'motion.edit', layer_id: layerId, edit_op: editOp },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

// ---------------------------------------------------------------- Motion instances (P06-11)

/** Exact Motion revision a project pins (`MotionRevisionRef` of composition-project v1). */
export type CompositionMotionRevisionRef = {
  motion_id: string
  motion_revision_id: string
  scope: 'library' | 'project_private'
  manifest_sha256: string
}
export type CompositionMotionEnergy = 'sakin' | 'dengeli' | 'canli'
/** What `motion.parameter.set` / `parameter_values` take: text or colour string, duration frames, `{source_id}` for media, null unsets. */
export type CompositionMotionParameterInput = string | number | { source_id: string } | null

export function newMotionInstanceId(uuid: string) {
  return `mi_${uuid}`
}

/**
 * `motion.instance.insert`: one exact Motion revision as a document v2 instance layer of a scene, over `sceneRange`
 * (scene-local frames, beside the scene's other layers: an OVERLAY, D2). The gateway checks ratio, energy, the look and
 * every value and compiles the instance before it writes anything.
 */
export function motionInstanceInsertSpec(input: {
  sceneId: string
  layerId: string
  afterLayerId: string | null
  instanceId: string
  motionRef: CompositionMotionRevisionRef
  sceneRange: CompositionFrameRange
  videoStyleRef: string
  energy?: CompositionMotionEnergy
  parameterValues?: Record<string, CompositionMotionParameterInput>
}): CompositionOpSpec {
  return {
    op: {
      op: 'motion.instance.insert',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      after_layer_id: input.afterLayerId,
      instance_id: input.instanceId,
      motion_ref: input.motionRef,
      scene_range: input.sceneRange,
      video_style_ref: input.videoStyleRef,
      ...(input.energy && { energy: input.energy }),
      parameter_values: input.parameterValues ?? {},
    },
    reads: [sceneRef(input.sceneId)],
    targets: [sceneRef(input.sceneId), layerRef(input.layerId)],
  }
}

/**
 * `motion.parameter.set`: one exposed text / colour / media / duration value of an instance, by the stable instance and
 * parameter ids (`value: null` unsets an optional one). A duration value moves the layer's scene range on the server.
 */
export function motionParameterSetSpec(input: {
  layerId: string
  instanceId: string
  parameterId: string
  value: CompositionMotionParameterInput
}): CompositionOpSpec {
  return {
    op: {
      op: 'motion.parameter.set',
      layer_id: input.layerId,
      instance_id: input.instanceId,
      parameter_id: input.parameterId,
      value: input.value,
    },
    reads: [layerRef(input.layerId)],
    targets: [layerRef(input.layerId)],
  }
}

// ---------------------------------------------------------------- scene transitions (E1-L)

/**
 * `scene.set_transition`: the transition INTO `sceneId` (kind + length in frames + typed parameters, validated by the
 * gateway). The same op with kind `cut` clears it; `scene.clear_transition` is the explicit form.
 */
export function sceneSetTransitionSpec(
  sceneId: string,
  transition: { kind: string; duration_frames: number; params?: { direction?: string; color?: string; easing?: string } },
): CompositionOpSpec {
  return {
    op: {
      op: 'scene.set_transition',
      scene_id: sceneId,
      kind: transition.kind,
      duration_frames: transition.duration_frames,
      ...(transition.params && Object.keys(transition.params).length > 0 && { params: transition.params }),
    },
    reads: [sceneRef(sceneId)],
    targets: [sceneRef(sceneId)],
  }
}

export function sceneClearTransitionSpec(sceneId: string): CompositionOpSpec {
  return { op: { op: 'scene.clear_transition', scene_id: sceneId }, reads: [sceneRef(sceneId)], targets: [sceneRef(sceneId)] }
}

// ---------------------------------------------------------------- layer animations (P02-17; Spark effects WP2)

/** Document v1 `AnimationSpec`: a preset of the gateway's allowlist with typed params and an anchor. */
export type CompositionAnimationSpec = {
  animation_id: string
  phase: 'enter' | 'exit' | 'emphasis'
  preset_ref: { preset_id: string; preset_revision: number }
  params: { duration_frames: number; easing: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'; direction?: 'none' | 'up' | 'down' | 'left' | 'right'; stagger_frames?: number }
  anchor:
    | { kind: 'scene_start' }
    | { kind: 'scene_end' }
    | { kind: 'scene_offset'; frames: number }
    | { kind: 'after'; layer_id: string; phase: 'enter' | 'exit' | 'emphasis' }
    | { kind: 'word'; transcript_or_narration: CompositionPreparationArtifactRef; word_id: string; offset_frames: number }
}

/** `animation.set`: adds the animation to the layer, or replaces the layer's animation with the same id. */
export function animationSetSpec(sceneId: string, layerId: string, animation: CompositionAnimationSpec): CompositionOpSpec {
  return {
    op: { op: 'animation.set', scene_id: sceneId, layer_id: layerId, animation },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

export function animationRemoveSpec(sceneId: string, layerId: string, animationId: string): CompositionOpSpec {
  return {
    op: { op: 'animation.remove', scene_id: sceneId, layer_id: layerId, animation_id: animationId },
    reads: [layerRef(layerId)],
    targets: [layerRef(layerId)],
  }
}

// ---------------------------------------------------------------- document reading helpers

export type CompositionAudioRole = 'narration' | 'music' | 'sfx'

/** The fields of an audio placement the editor reads (bodies stay passthrough in the schema). */
export type CompositionAudioPlacementView = {
  placementId: string
  role: CompositionAudioRole | null
  /** Scene of a scene-local placement; null for a global (project_range) one. */
  sceneId: string | null
  projectRange: CompositionFrameRange | null
}

function frameRangeOf(value: unknown): CompositionFrameRange | null {
  if (!value || typeof value !== 'object') return null
  const { start_frame: start, end_frame: end } = value as Record<string, unknown>
  return typeof start === 'number' && typeof end === 'number' ? { start_frame: start, end_frame: end } : null
}

export function audioPlacementsOf(document: CompositionDocument): CompositionAudioPlacementView[] {
  return document.audio.placements.map((placement) => {
    const role = placement['role']
    const sceneId = placement['scene_id']
    return {
      placementId: placement.placement_id,
      role: role === 'narration' || role === 'music' || role === 'sfx' ? role : null,
      sceneId: typeof sceneId === 'string' ? sceneId : null,
      projectRange: frameRangeOf(placement['project_range']),
    }
  })
}

/**
 * Absolute frame range of a scene in the strip at its RESOLVED length (Y1-07 W4: fixed duration, end of the scene's
 * media or narration). null when the scene is not in the strip or its own length cannot be derived; a scene before it
 * with an underivable length counts as empty (the same timeline as the server's preview manifest).
 */
export function sceneFrameRange(document: CompositionDocument, sceneId: string): CompositionFrameRange | null {
  const scene = resolveTimeline(document).scenes.find((entry) => entry.sceneId === sceneId)
  if (!scene || scene.lengthFrames === null) return null
  return { start_frame: scene.startFrame, end_frame: scene.endFrame }
}

/**
 * Music heard in a scene. `scenePlacementIds` are the scene's own music placements (the scene
 * panel can remove them); `projectWide` is true when a global music placement plays under the
 * scene. A global placement counts when the scene's position is unknown (it may play there).
 */
export function sceneMusic(document: CompositionDocument, scene: CompositionScene) {
  const placements = audioPlacementsOf(document).filter((placement) => placement.role === 'music')
  const range = sceneFrameRange(document, scene.scene_id)
  const scenePlacementIds = placements
    .filter((placement) => placement.sceneId === scene.scene_id)
    .map((placement) => placement.placementId)
  const projectWide = placements.some((placement) => {
    if (placement.sceneId !== null || !placement.projectRange) return false
    if (!range) return true
    return placement.projectRange.start_frame < range.end_frame && placement.projectRange.end_frame > range.start_frame
  })
  return { scenePlacementIds, projectWide }
}

/** Placement id of the scene's narration audio (at most one through narration.set), if any. */
export function sceneNarrationPlacementId(document: CompositionDocument, sceneId: string): string | null {
  return (
    audioPlacementsOf(document).find((placement) => placement.role === 'narration' && placement.sceneId === sceneId)
      ?.placementId ?? null
  )
}

export function captionTrackIds(document: CompositionDocument): string[] {
  return document.caption_tracks.map((track) => track.caption_track_id)
}

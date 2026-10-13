import { ANIMATION_SLOTS } from '../animations/animation-catalog'
import { choiceOf, layerAnimationsOf, planSlotChange, slotsOf, type StoredAnimation } from '../animations/layer-animations'
import {
  SCENE_SEQUENCE_REF,
  newSceneId,
  sceneRemoveSpec,
  sceneReorderSpec,
  sceneSetSectionSpec,
  type CompositionDocument,
  type CompositionEntityRef,
  type CompositionOpSpec,
  type CompositionScene,
} from '../composition-client'
import {
  animationSetSpec,
  audioInsertSpec,
  audioRemoveSpec,
  captionTrackRemoveSpec,
  clipSplitSpec,
  layerMoveSpec,
  layerRemoveSpec,
  layerTrimSpec,
  newAudioPlacementId,
  newLayerId,
  type CompositionTransform,
} from '../composition-typed-edits'
import { applyOpsLocally } from '../optimistic/document-ops'
import { MUSIC_BED_GAIN_DB, framesForTicks, sourceProbeOf, ticksForFrames } from '../stage/placement'
import { clipInsertSequenceSpec, layerArrangeSpec } from '../stage/stage-edits'
import {
  displayToPlayFrame,
  mainIndexAtFrame,
  sceneOverlays,
  type TimelineMainBlock,
  type TimelineModel,
  type TimelineOverlayBlock,
  type TimelineSourceRange,
} from './timeline-model'

/**
 * Spark timeline v2 edits (P1-A): every gesture of the timeline turns into ONE exact list of typed op specs = one command =
 * one undo group (`actions.apply(specs)`), built here from the document and the timeline model. Nothing is applied here;
 * the session applies locally what the optimistic port covers (`optimistic/document-ops.ts`) and sends the rest server
 * first. Where the gateway would refuse an edit for a reason the document shows (a narration-bound split, a layer crossing
 * the cut, a trim past the source), the plan says so (`{ ok: false, reason }`) and the UI shows the reason instead of
 * sending a command that is bound to fail. Bounds functions give the drag limits so a handle simply stops there.
 */

export type TimelineRefusal =
  | 'nothing'
  | 'unresolved'
  | 'narration_bound'
  | 'pending'
  | 'split_at_edge'
  | 'crosses_layer'
  | 'crosses_audio'
  | 'animated_after_cut'
  | 'anchor_crosses'
  | 'leaves_gap'
  | 'outside_source'
  | 'clip_animated'
  | 'no_room'
  | 'out_of_bounds'
  | 'not_attached'
  | 'audio_on_main'
  | 'not_audio'
  | 'narration_delete'

export type TimelinePlan = { ok: true; specs: CompositionOpSpec[] } | { ok: false; reason: TimelineRefusal }

/** Longest scene a trim may make (frames are capped at this many seconds). */
export const MAX_SCENE_SECONDS = 600
/** Seconds an image dropped on the main track holds (its scene follows the media). */
export const MAIN_TRACK_IMAGE_SECONDS = 3

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })
const layerRef = (layerId: string): CompositionEntityRef => ({ entity_kind: 'layer', entity_id: layerId })
const defaultUuid = () => globalThis.crypto.randomUUID()

type Body = Record<string, unknown>

const ok = (specs: CompositionOpSpec[]): TimelinePlan => ({ ok: true, specs })
const refuse = (reason: TimelineRefusal): TimelinePlan => ({ ok: false, reason })

// ---------------------------------------------------------------- builders the shared lists do not have yet

/** `scene.set_timing` (a fixed length carries its duration; following policies do not). */
export function sceneSetTimingSpec(sceneId: string, policy: CompositionScene['timing_policy'], durationFrames?: number): CompositionOpSpec {
  return {
    op: { op: 'scene.set_timing', scene_id: sceneId, timing_policy: policy, ...(policy === 'fixed' && durationFrames !== undefined && { duration_frames: durationFrames }) },
    reads: [sceneRef(sceneId)],
    targets: [sceneRef(sceneId)],
  }
}

/** `scene.split` (P02-12): the scene is cut at a scene frame; every clip the cut crosses gets the id of its right half. */
export function sceneSplitSpec(input: { sceneId: string; atFrame: number; newSceneId: string; splitLayerIds: Record<string, string> }): CompositionOpSpec {
  return {
    op: { op: 'scene.split', scene_id: input.sceneId, at_frame: input.atFrame, new_scene_id: input.newSceneId, split_layer_ids: input.splitLayerIds },
    reads: [SCENE_SEQUENCE_REF, sceneRef(input.sceneId)],
    targets: [SCENE_SEQUENCE_REF, sceneRef(input.sceneId), sceneRef(input.newSceneId), ...Object.values(input.splitLayerIds).map(layerRef)],
  }
}

/** `layer.move_to_scene`: the layer keeps its length and lands at `startFrame` of the target scene above `afterLayerId`. */
export function layerMoveToSceneSpec(input: { sceneId: string; layerId: string; targetSceneId: string; afterLayerId: string | null; startFrame: number }): CompositionOpSpec {
  return {
    op: {
      op: 'layer.move_to_scene',
      scene_id: input.sceneId,
      layer_id: input.layerId,
      target_scene_id: input.targetSceneId,
      after_layer_id: input.afterLayerId,
      start_frame: input.startFrame,
    },
    reads: [sceneRef(input.sceneId), sceneRef(input.targetSceneId), layerRef(input.layerId)],
    targets: [sceneRef(input.sceneId), sceneRef(input.targetSceneId), layerRef(input.layerId)],
  }
}

/**
 * `scene.insert` of a scene that follows its media (a clip dropped on the main track), in a section. The shared
 * `sceneInsertSpec` only writes fixed scenes.
 */
export function mediaSceneInsertSpec(input: { sceneId: string; afterSceneId: string | null; sectionId: string | null }): CompositionOpSpec {
  return {
    op: {
      op: 'scene.insert',
      scene_id: input.sceneId,
      after_scene_id: input.afterSceneId,
      timing_policy: 'follow_media',
      section_id: input.sectionId,
      origin: 'authored',
    },
    reads: [SCENE_SEQUENCE_REF, ...(input.sectionId ? [{ entity_kind: 'section' as const, entity_id: input.sectionId }] : [])],
    targets: [SCENE_SEQUENCE_REF, sceneRef(input.sceneId)],
  }
}

// ---------------------------------------------------------------- document reads

function sceneOf(document: CompositionDocument, sceneId: string): CompositionScene | undefined {
  return document.scenes.find((scene) => scene.scene_id === sceneId)
}

function layerBodyOf(document: CompositionDocument, sceneId: string, layerId: string): Body | null {
  return (sceneOf(document, sceneId)?.layers.find((layer) => layer.layer_id === layerId) as Body | undefined) ?? null
}

function localRangeOf(layer: Body): { start: number; end: number } | null {
  const range = (layer['layer_kind'] === 'clip' ? (layer['placement'] as Body | undefined)?.['scene_range'] : layer['scene_range']) as Body | undefined
  const start = range?.['start_frame']
  const end = range?.['end_frame']
  return typeof start === 'number' && typeof end === 'number' && end > start ? { start, end } : null
}

function isVideoClip(document: CompositionDocument, layer: Body): boolean {
  if (layer['layer_kind'] !== 'clip') return false
  const sourceId = (layer['placement'] as Body | undefined)?.['source_id']
  return typeof sourceId === 'string' && sourceProbeOf(document, sourceId)?.kind === 'video'
}

/** Ticks that move a clip edge by exactly `frames` canvas frames (the gateway re-times the scene range by `framesForTicks`). */
function ticksForFrameDelta(frames: number, timebase: { num: number; den: number }, fps: { num: number; den: number }): number {
  let ticks = ticksForFrames(frames, timebase, fps)
  for (let step = 0; step < 8 && framesForTicks(ticks, timebase, fps) !== frames; step += 1) {
    ticks += framesForTicks(ticks, timebase, fps) < frames ? 1 : -1
  }
  return ticks
}

/**
 * The `layer.trim` that gives a layer the scene range [start, end): a video clip by its source range (in/out moved by the
 * same time), anything else by its scene range. Null when a video edge would leave its source.
 */
function trimToRange(document: CompositionDocument, sceneId: string, layer: Body, start: number, end: number): CompositionOpSpec | null {
  const range = localRangeOf(layer)
  if (!range) return null
  const layerId = layer['layer_id'] as string
  if (!isVideoClip(document, layer)) return layerTrimSpec(sceneId, layerId, { sceneRange: { start_frame: start, end_frame: end } })
  const placement = layer['placement'] as Body
  const probe = sourceProbeOf(document, placement['source_id'] as string)
  const source = placement['source_range'] as TimelineSourceRange | undefined
  if (!probe || !source) return null
  const fps = document.canvas.fps
  const inTick = source.in_tick + ticksForFrameDelta(start - range.start, probe.timebase, fps)
  const outTick = source.out_tick + ticksForFrameDelta(end - range.end, probe.timebase, fps)
  if (inTick < 0 || outTick > probe.durationTicks || outTick <= inTick) return null
  return layerTrimSpec(sceneId, layerId, { sourceRange: { in_tick: inTick, out_tick: outTick } })
}

/**
 * The animation writes that keep a layer's In / Out / Combo / Effect inside a new time window (the slots are re-placed the
 * way the Animations panel places them). Null when the window is too short for them.
 */
function replaceAnimations(sceneId: string, layer: Body, range: { start: number; end: number }): CompositionOpSpec[] | null {
  const slots = slotsOf(layerAnimationsOf(layer))
  const slot = ANIMATION_SLOTS.find((candidate) => slots[candidate] !== null)
  if (!slot) return []
  const moved = { ...layer, ...(layer['layer_kind'] === 'clip'
    ? { placement: { ...(layer['placement'] as Body), scene_range: { start_frame: range.start, end_frame: range.end } } }
    : { scene_range: { start_frame: range.start, end_frame: range.end } }) }
  const plan = planSlotChange({ sceneId, layer: moved, slot, choice: choiceOf(slots[slot]!) })
  return plan.ok ? plan.specs : null
}

/** Scene-anchored animations shifted by `delta` frames (a layer moved inside or into a scene keeps its animations on it). */
function shiftAnimations(sceneId: string, layer: Body, delta: number): CompositionOpSpec[] {
  if (delta === 0) return []
  const specs: CompositionOpSpec[] = []
  for (const animation of layerAnimationsOf(layer)) {
    const anchor = animation.anchor
    const at = anchor.kind === 'scene_start' ? 0 : anchor.kind === 'scene_offset' ? anchor.frames : null
    if (at === null) continue
    const next = Math.max(0, at + delta)
    const shifted: StoredAnimation = { ...animation, anchor: next === 0 ? { kind: 'scene_start' } : { kind: 'scene_offset', frames: next } }
    specs.push(animationSetSpec(sceneId, layer['layer_id'] as string, shifted))
  }
  return specs
}

/** Shortest a layer may become: one frame, or the length of its In and Out animations. */
function minLengthOf(block: { enterFrames: number | null; exitFrames: number | null }): number {
  return Math.max(1, (block.enterFrames ?? 0) + (block.exitFrames ?? 0))
}

// ---------------------------------------------------------------- main track: trim

export type TrimEdge = 'start' | 'end'
/** Drag limits of a handle, as a frame delta of the edge (negative = left). */
export type TrimBounds = { minDelta: number; maxDelta: number }

/** The earliest end a scene may get without dropping or overflowing a layer that cannot be shortened. */
function minSceneEnd(model: TimelineModel, block: TimelineMainBlock): number {
  let min = 1
  if (block.mainClip) min = Math.max(min, block.mainClip.startFrame + 1)
  for (const overlay of sceneOverlays(model, block.sceneId)) {
    if (!overlay.trimmable) min = Math.max(min, overlay.localEnd)
    else min = Math.max(min, overlay.localStart + minLengthOf(overlay))
  }
  return Math.min(min, block.lengthFrames)
}

function maxSceneFrames(model: TimelineModel): number {
  return Math.round(MAX_SCENE_SECONDS * model.rate)
}

/** Limits of a main block's trim handle; null = the handle is disabled (narration length, unresolved, pending, ...). */
export function mainTrimBounds(model: TimelineModel, sceneId: string, edge: TrimEdge): TrimBounds | null {
  const block = model.mainById.get(sceneId)
  if (!block || !block.resolved || block.narrationBound || block.pending || block.policy === 'follow_narration') return null
  const length = block.lengthFrames
  const clip = block.mainClip
  const minEnd = minSceneEnd(model, block)
  if (edge === 'end') {
    let maxEnd = length
    const reachesEnd = clip !== null && clip.endFrame === length
    if (block.policy === 'fixed') {
      maxEnd = reachesEnd && clip!.mediaKind === 'video' ? length + (clip!.headroomEndFrames ?? 0) : maxSceneFrames(model)
    } else if (reachesEnd) {
      maxEnd = clip!.mediaKind === 'video' ? length + (clip!.headroomEndFrames ?? 0) : clip!.mediaKind === 'image' ? maxSceneFrames(model) : length
    }
    return { minDelta: minEnd - length, maxDelta: Math.max(0, maxEnd - length) }
  }
  // The head is trimmed through the main clip, which must start the scene.
  if (!clip || clip.startFrame !== 0) return null
  const maxCut = length - minEnd
  const maxExtend = clip.mediaKind === 'video' ? (clip.headroomStartFrames ?? 0) : clip.mediaKind === 'image' ? maxSceneFrames(model) - length : 0
  return { minDelta: -Math.max(0, maxExtend), maxDelta: Math.max(0, maxCut) }
}

/**
 * Trim of a main block (the scene) by `delta` frames at one edge. The end edge: a scene that follows its media trims the
 * main clip; a fixed scene sets its length (and stretches an image main clip that reached the old end). The start edge
 * trims the main clip's head and moves it back to frame 0. In both cases every layer crossing the new end is shortened in
 * the same command (the gateway never lets content overflow its scene).
 */
export function planMainTrim(document: CompositionDocument, model: TimelineModel, input: { sceneId: string; edge: TrimEdge; delta: number }): TimelinePlan {
  const block = model.mainById.get(input.sceneId)
  const bounds = mainTrimBounds(model, input.sceneId, input.edge)
  if (!block || !bounds) return refuse(block?.narrationBound ? 'narration_bound' : block && !block.resolved ? 'unresolved' : 'out_of_bounds')
  const delta = Math.round(input.delta)
  if (delta === 0) return refuse('nothing')
  if (delta < bounds.minDelta || delta > bounds.maxDelta) return refuse('out_of_bounds')
  const scene = sceneOf(document, block.sceneId)
  if (!scene) return refuse('nothing')
  const length = block.lengthFrames
  const newLength = input.edge === 'end' ? length + delta : length - delta
  const clip = block.mainClip
  const clipBody = clip ? layerBodyOf(document, block.sceneId, clip.layerId) : null
  const crossing: CompositionOpSpec[] = []
  // Layers crossing the new end (shrinking): shortened to it, their animations re-placed.
  if (newLength < length) {
    for (const layer of scene.layers as Body[]) {
      if (clipBody && layer === clipBody && input.edge === 'start') continue
      const range = localRangeOf(layer)
      if (!range || range.end <= newLength) continue
      if (range.start >= newLength) return refuse('no_room')
      const spec = trimToRange(document, block.sceneId, layer, range.start, newLength)
      if (!spec) return refuse('outside_source')
      crossing.push(spec)
      const animations = replaceAnimations(block.sceneId, layer, { start: range.start, end: newLength })
      if (animations === null) return refuse('no_room')
      crossing.push(...animations)
    }
  }
  const fixed = block.policy === 'fixed'
  const timing = fixed ? [sceneSetTimingSpec(block.sceneId, 'fixed', newLength)] : []

  if (input.edge === 'end') {
    if (newLength < length) return ok([...crossing, ...timing])
    // Lengthening: a main clip that reached the old end follows the new end.
    const stretch: CompositionOpSpec[] = []
    if (clip && clipBody && clip.endFrame === length) {
      const spec = trimToRange(document, block.sceneId, clipBody, clip.startFrame, newLength)
      if (!spec) return refuse('outside_source')
      stretch.push(spec)
      const animations = replaceAnimations(block.sceneId, clipBody, { start: clip.startFrame, end: newLength })
      if (animations === null) return refuse('no_room')
      stretch.push(...animations)
    } else if (!fixed) {
      return refuse('out_of_bounds')
    }
    return ok([...timing, ...stretch])
  }

  // Start edge: the main clip loses (delta > 0) or regains (delta < 0) its head and starts the scene again.
  if (!clip || !clipBody) return refuse('out_of_bounds')
  const clipEnd = clip.endFrame - delta
  const head: CompositionOpSpec[] = []
  if (isVideoClip(document, clipBody)) {
    // The gateway re-times the scene range by the source change; the clip then moves back to frame 0.
    const trim = trimToRange(document, block.sceneId, clipBody, clip.startFrame + delta, clip.endFrame)
    if (!trim) return refuse('outside_source')
    if (delta > 0) head.push(trim, layerMoveSpec(block.sceneId, clip.layerId, 0))
    else head.push(layerMoveSpec(block.sceneId, clip.layerId, -delta), trim)
  } else {
    head.push(layerTrimSpec(block.sceneId, clip.layerId, { sceneRange: { start_frame: 0, end_frame: clipEnd } }))
  }
  const animations = replaceAnimations(block.sceneId, clipBody, { start: 0, end: clipEnd })
  if (animations === null) return refuse('no_room')
  head.push(...animations)
  return delta > 0 ? ok([...crossing, ...head, ...timing]) : ok([...timing, ...head])
}

/** Q / W: trims the main block under the playhead so it starts (`start`) or ends (`end`) at the playhead. */
export function planTrimToPlayhead(document: CompositionDocument, model: TimelineModel, input: { frame: number; edge: TrimEdge }): TimelinePlan {
  const index = mainIndexAtFrame(model, input.frame)
  const block = index >= 0 ? model.main[index] : undefined
  if (!block) return refuse('nothing')
  const local = input.frame - block.startFrame
  if (local <= 0 || local >= block.lengthFrames) return refuse('split_at_edge')
  const delta = input.edge === 'start' ? local : local - block.lengthFrames
  return planMainTrim(document, model, { sceneId: block.sceneId, edge: input.edge, delta })
}

/** "Set fixed length" of a narration-length scene: the scene keeps its current length as a fixed duration. */
export function planSetFixedLength(model: TimelineModel, sceneId: string): TimelinePlan {
  const block = model.mainById.get(sceneId)
  if (!block || !block.resolved) return refuse('unresolved')
  if (block.policy === 'fixed') return refuse('nothing')
  return ok([sceneSetTimingSpec(sceneId, 'fixed', block.lengthFrames)])
}

// ---------------------------------------------------------------- main track: reorder, delete

/**
 * Moves main blocks (in their strip order) so they sit before position `insertIndex` of the current strip, as one
 * command: `scene.reorder` per moved scene (each after the previous one) and `scene.set_section` where the drop changes
 * the section. Empty when nothing changes.
 */
export function planMainReorder(model: TimelineModel, input: { sceneIds: readonly string[]; insertIndex: number; sectionId?: string | null }): TimelinePlan {
  const order = model.main.map((block) => block.sceneId)
  const movedSet = new Set(input.sceneIds.filter((id) => model.mainById.has(id)))
  if (movedSet.size === 0) return refuse('nothing')
  const moved = order.filter((id) => movedSet.has(id))
  const insertIndex = Math.min(Math.max(0, input.insertIndex), order.length)
  let after: string | null = null
  for (let index = insertIndex - 1; index >= 0; index -= 1) {
    if (!movedSet.has(order[index]!)) {
      after = order[index]!
      break
    }
  }
  const rest = order.filter((id) => !movedSet.has(id))
  const at = after === null ? 0 : rest.indexOf(after) + 1
  const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)]
  const specs: CompositionOpSpec[] = []
  if (next.some((id, index) => id !== order[index])) {
    // Each scene goes right after the one before it in the new order (the first after `after`).
    let previous = after
    for (const sceneId of moved) {
      specs.push(sceneReorderSpec(sceneId, previous))
      previous = sceneId
    }
  }
  if (input.sectionId !== undefined) {
    for (const sceneId of moved) {
      if (model.mainById.get(sceneId)!.sectionId !== input.sectionId) specs.push(sceneSetSectionSpec(sceneId, input.sectionId))
    }
  }
  return specs.length > 0 ? ok(specs) : refuse('nothing')
}

/**
 * Delete of a timeline selection as one command: a main block ripples (`scene.remove`, the scenes after it move up; its
 * scene-local audio, narration included, is removed first because the gateway refuses a scene that still has some), an
 * overlay leaves a gap (`layer.remove`), a music / sound-effect block and a caption track are removed. A layer whose scene
 * goes too and a placeholder are left out; a narration alone is not deleted here (it is changed in the scene's voice
 * section, a scene following it would lose its length).
 */
export function planDelete(document: CompositionDocument, model: TimelineModel, keys: readonly string[]): TimelinePlan {
  const scenes = new Set<string>()
  const layers: TimelineOverlayBlock[] = []
  const audio = new Set<string>()
  const captions: string[] = []
  let narration = false
  for (const key of keys) {
    const [kind, id] = splitKey(key)
    if (kind === 'scene' && model.mainById.has(id)) scenes.add(id)
    else if (kind === 'layer') {
      const block = model.overlayById.get(id)
      if (block && block.kind !== 'pending_slot') layers.push(block)
    } else if (kind === 'audio') {
      const placement = [...model.music, ...model.sfx, ...model.voice].find((block) => block.placementId === id)
      if (placement?.role === 'narration') narration = true
      else if (placement) audio.add(id)
    } else if (kind === 'caption' && document.caption_tracks.some((track) => track.caption_track_id === id)) {
      captions.push(id)
    }
  }
  for (const placement of document.audio.placements as Body[]) {
    if (typeof placement['scene_id'] === 'string' && scenes.has(placement['scene_id'])) audio.add(placement.placement_id as string)
  }
  const specs: CompositionOpSpec[] = [
    ...layers.filter((block) => !scenes.has(block.sceneId)).map((block) => layerRemoveSpec(block.sceneId, block.layerId)),
    ...[...audio].map((id) => audioRemoveSpec(id)),
    ...captions.map((id) => captionTrackRemoveSpec(id)),
    ...model.main.filter((block) => scenes.has(block.sceneId)).map((block) => sceneRemoveSpec(block.sceneId)),
  ]
  if (specs.length === 0) return refuse(narration ? 'narration_delete' : 'nothing')
  return ok(specs)
}

/** `scene:<id>` / `layer:<id>` / `audio:<id>` / `caption:<id>` keys of the timeline's selection. */
export function splitKey(key: string): [string, string] {
  const at = key.indexOf(':')
  return at < 0 ? [key, ''] : [key.slice(0, at), key.slice(at + 1)]
}

// ---------------------------------------------------------------- overlays: move, trim, ramps

export type OverlayTarget = { sceneId: string; localStart: number; crossesScene: boolean }

/**
 * Where an overlay dragged to a display start lands: inside its own scene (clamped at the cuts), or as a whole in the
 * scene its centre is over when it fits there (`layer.move_to_scene`; never for a layer with `after()` anchors).
 */
export function resolveOverlayMove(model: TimelineModel, block: TimelineOverlayBlock, displayStart: number): OverlayTarget {
  const length = block.localEnd - block.localStart
  const centre = displayStart + length / 2
  const index = mainIndexAtFrame(model, Math.min(Math.max(0, centre), Math.max(0, model.totalFrames - 1)))
  const over = index >= 0 ? model.main[index] : undefined
  if (over && over.sceneId !== block.sceneId && over.resolved && length <= over.lengthFrames && !block.anchored && block.kind !== 'pending_slot') {
    const local = Math.min(Math.max(0, Math.round(displayStart - over.startFrame)), over.lengthFrames - length)
    return { sceneId: over.sceneId, localStart: local, crossesScene: true }
  }
  const local = Math.min(Math.max(0, Math.round(displayStart - block.sceneStartFrame)), Math.max(0, block.sceneLengthFrames - length))
  return { sceneId: block.sceneId, localStart: local, crossesScene: false }
}

/** The `after_layer_id` that gives `layerId` overlay rank `row` among the scene's overlays (undefined = already there). */
function afterForRow(document: CompositionDocument, model: TimelineModel, block: TimelineOverlayBlock, row: number): string | null | undefined {
  const overlays = sceneOverlays(model, block.sceneId)
  const others = overlays.filter((candidate) => candidate.layerId !== block.layerId)
  const target = Math.min(Math.max(0, row), others.length)
  if (target === block.row) return undefined
  if (target > 0) return others[target - 1]!.layerId
  // Rank 0: right below the lowest other overlay (above whatever paints under it, e.g. the main clip).
  const scene = sceneOf(document, block.sceneId)
  if (!scene || others.length === 0) return undefined
  const order = scene.layers.map((layer) => layer.layer_id).filter((id) => id !== block.layerId)
  const lowest = order.indexOf(others[0]!.layerId)
  return lowest > 0 ? order[lowest - 1]! : null
}

/**
 * Moves an overlay (one drag): to a new start in its scene (`layer.move`), to another row (`layer.arrange`), or as a whole
 * into another scene (`layer.move_to_scene`, on top of it). Scene-anchored animations move with the layer.
 */
export function planOverlayMove(document: CompositionDocument, model: TimelineModel, input: { layerId: string; displayStart: number; row?: number }): TimelinePlan {
  const block = model.overlayById.get(input.layerId)
  if (!block) return refuse('nothing')
  if (!block.movable) return refuse(block.kind === 'pending_slot' ? 'pending' : 'unresolved')
  const layer = layerBodyOf(document, block.sceneId, block.layerId)
  if (!layer) return refuse('nothing')
  const target = resolveOverlayMove(model, block, input.displayStart)
  const delta = target.localStart - block.localStart
  if (target.crossesScene) {
    const targetScene = sceneOf(document, target.sceneId)
    const top = targetScene?.layers.at(-1)?.layer_id ?? null
    return ok([
      layerMoveToSceneSpec({ sceneId: block.sceneId, layerId: block.layerId, targetSceneId: target.sceneId, afterLayerId: top, startFrame: target.localStart }),
      ...shiftAnimations(target.sceneId, layer, delta),
    ])
  }
  const specs: CompositionOpSpec[] = []
  if (input.row !== undefined) {
    const after = afterForRow(document, model, block, input.row)
    if (after !== undefined) specs.push(layerArrangeSpec(block.sceneId, block.layerId, after))
  }
  if (delta !== 0) specs.push(layerMoveSpec(block.sceneId, block.layerId, target.localStart), ...shiftAnimations(block.sceneId, layer, delta))
  return specs.length > 0 ? ok(specs) : refuse('nothing')
}

/** Limits of an overlay's trim handle (null = not trimmable: Motion length is a parameter, placeholders belong to a job). */
export function overlayTrimBounds(model: TimelineModel, layerId: string, edge: TrimEdge): TrimBounds | null {
  const block = model.overlayById.get(layerId)
  if (!block || !block.trimmable) return null
  const min = minLengthOf(block)
  if (edge === 'start') {
    const earliest = Math.max(0, block.headroomStartFrames === null ? 0 : block.localStart - block.headroomStartFrames)
    return { minDelta: earliest - block.localStart, maxDelta: Math.max(0, block.localEnd - min - block.localStart) }
  }
  const latest = Math.min(block.sceneLengthFrames, block.headroomEndFrames === null ? block.sceneLengthFrames : block.localEnd + block.headroomEndFrames)
  return { minDelta: Math.min(0, block.localStart + min - block.localEnd), maxDelta: Math.max(0, latest - block.localEnd) }
}

/** Trim of an overlay by `delta` frames at one edge (one `layer.trim`; its animations stay inside the new window). */
export function planOverlayTrim(document: CompositionDocument, model: TimelineModel, input: { layerId: string; edge: TrimEdge; delta: number }): TimelinePlan {
  const block = model.overlayById.get(input.layerId)
  const bounds = overlayTrimBounds(model, input.layerId, input.edge)
  if (!block || !bounds) return refuse(block?.kind === 'pending_slot' ? 'pending' : 'out_of_bounds')
  const delta = Math.round(input.delta)
  if (delta === 0) return refuse('nothing')
  if (delta < bounds.minDelta || delta > bounds.maxDelta) return refuse('out_of_bounds')
  const layer = layerBodyOf(document, block.sceneId, block.layerId)
  if (!layer) return refuse('nothing')
  const start = input.edge === 'start' ? block.localStart + delta : block.localStart
  const end = input.edge === 'end' ? block.localEnd + delta : block.localEnd
  const trim = trimToRange(document, block.sceneId, layer, start, end)
  if (!trim) return refuse('outside_source')
  const animations = replaceAnimations(block.sceneId, layer, { start, end })
  if (animations === null) return refuse('no_room')
  return ok([trim, ...animations])
}

/** Limits of an In / Out ramp edge: from one frame to what the layer leaves next to the other ramp. */
export function rampBounds(model: TimelineModel, layerId: string, phase: 'enter' | 'exit'): { min: number; max: number } | null {
  const block = model.overlayById.get(layerId)
  if (!block) return null
  const current = phase === 'enter' ? block.enterFrames : block.exitFrames
  if (current === null) return null
  const other = (phase === 'enter' ? block.exitFrames : block.enterFrames) ?? 0
  return { min: 1, max: Math.max(1, block.localEnd - block.localStart - other) }
}

/** Dragging a ramp edge: the In or Out animation gets a new length (`animation.set`, other slots re-placed). */
export function planRampChange(document: CompositionDocument, model: TimelineModel, input: { layerId: string; phase: 'enter' | 'exit'; frames: number }): TimelinePlan {
  const block = model.overlayById.get(input.layerId)
  const bounds = rampBounds(model, input.layerId, input.phase)
  if (!block || !bounds) return refuse('nothing')
  const frames = Math.round(input.frames)
  if (frames < bounds.min || frames > bounds.max) return refuse('out_of_bounds')
  const layer = layerBodyOf(document, block.sceneId, block.layerId)
  const current = input.phase === 'enter' ? block.enterAnimation : block.exitAnimation
  if (!layer || !current) return refuse('nothing')
  if (current.params.duration_frames === frames) return refuse('nothing')
  const plan = planSlotChange({ sceneId: block.sceneId, layer, slot: input.phase === 'enter' ? 'in' : 'out', choice: { ...choiceOf(current), durationFrames: frames } })
  if (!plan.ok) return refuse('no_room')
  return plan.specs.length > 0 ? ok(plan.specs) : refuse('nothing')
}

// ---------------------------------------------------------------- split

/**
 * S / Ctrl+B. A selected media clip under the playhead is split there (`clip.split`); otherwise the scene under the
 * playhead is split (`scene.split`). The gateway's refusals that the document shows are answered here with their reason.
 * `relaxed`: the gateway reports the relaxed `scene.split` rules (`StagePlan.relaxedSplitEnabled`, see `planSceneSplit`).
 */
export function planSplit(
  document: CompositionDocument,
  model: TimelineModel,
  input: { frame: number; selectedLayerId?: string | null; uuid?: () => string; relaxed?: boolean },
): TimelinePlan {
  const uuid = input.uuid ?? defaultUuid
  const selected = input.selectedLayerId ? model.overlayById.get(input.selectedLayerId) : undefined
  if (selected && selected.kind === 'clip' && input.frame > selected.startFrame && input.frame < selected.endFrame) {
    if (selected.animated || selected.anchored) return refuse('clip_animated')
    const local = input.frame - selected.sceneStartFrame
    const layer = layerBodyOf(document, selected.sceneId, selected.layerId)
    if (!layer) return refuse('nothing')
    if (!splitInsideSource(document, layer, local)) return refuse('outside_source')
    return ok([clipSplitSpec({ sceneId: selected.sceneId, layerId: selected.layerId, atFrame: local, newLayerId: newLayerId(uuid()) })])
  }
  return planSceneSplit(document, model, { frame: input.frame, uuid, ...(input.relaxed === true && { relaxed: true }) })
}

function splitInsideSource(document: CompositionDocument, layer: Body, local: number): boolean {
  if (!isVideoClip(document, layer)) return true
  const range = localRangeOf(layer)
  const placement = layer['placement'] as Body
  const probe = sourceProbeOf(document, placement['source_id'] as string)
  const source = placement['source_range'] as TimelineSourceRange | undefined
  if (!range || !probe || !source) return false
  const tick = source.in_tick + ticksForFrames(local - range.start, probe.timebase, document.canvas.fps)
  return tick > source.in_tick && tick < source.out_tick
}

/**
 * `scene.split` at a display frame, checked like the gateway's handler (`scene-cut-ops.ts`).
 *
 * `relaxed` (timeline v3): the gateway takes the relaxed split rules (`COMPOSITION_RELAXED_SPLIT_ENABLED`, reported by the
 * preview manifest as `relaxed_split_enabled`). Then every clip, text and shape the cut crosses gets the id of its right
 * half or copy, every scene-local music/sfx placement it crosses the id of its right part, `split_placement_ids` is always
 * sent (it marks the relaxed op), and the editor's port of the gateway's rules (`applyOpsLocally`, pinned to the gateway by
 * the op-parity golden) decides; a refusal comes back as one of the existing reasons. Without it (default) the P02-12
 * checks below stay exactly as they were.
 */
export function planSceneSplit(document: CompositionDocument, model: TimelineModel, input: { frame: number; uuid?: () => string; relaxed?: boolean }): TimelinePlan {
  const uuid = input.uuid ?? defaultUuid
  const index = mainIndexAtFrame(model, input.frame)
  const block = index >= 0 ? model.main[index] : undefined
  if (!block) return refuse('nothing')
  if (block.narrationBound) return refuse('narration_bound')
  if (!block.resolved) return refuse('unresolved')
  const scene = sceneOf(document, block.sceneId)
  if (!scene) return refuse('nothing')
  const at = input.frame - block.startFrame
  if (at <= 0 || at >= block.lengthFrames) return refuse('split_at_edge')
  if (input.relaxed === true) {
    const crosses = (range: { start: number; end: number } | null) => range !== null && range.start < at && range.end > at
    const layerIds: Record<string, string> = {}
    for (const layer of scene.layers as Body[]) {
      const kind = layer['layer_kind']
      if ((kind === 'clip' || kind === 'text' || kind === 'shape') && crosses(localRangeOf(layer))) layerIds[layer['layer_id'] as string] = newLayerId(uuid())
    }
    const placementIds: Record<string, string> = {}
    for (const placement of document.audio.placements as Body[]) {
      if (placement['scene_id'] !== block.sceneId || placement['role'] === 'narration') continue
      const range = placement['scene_range'] as { start_frame?: unknown; end_frame?: unknown } | undefined
      if (typeof range?.start_frame === 'number' && typeof range.end_frame === 'number' && crosses({ start: range.start_frame, end: range.end_frame })) {
        placementIds[placement['placement_id'] as string] = newAudioPlacementId(uuid())
      }
    }
    const newScene = newSceneId(uuid())
    const op = { op: 'scene.split', scene_id: block.sceneId, at_frame: at, new_scene_id: newScene, split_layer_ids: layerIds, split_placement_ids: placementIds }
    const applied = applyOpsLocally(document, [op])
    if (!applied.ok) {
      const reasons: Record<string, TimelineRefusal> = {
        placeholder_not_editable: 'pending',
        scene_split_narration_bound: 'narration_bound',
        scene_length_unknown: 'unresolved',
        split_outside_scene: 'split_at_edge',
        scene_split_crosses_layer: 'crosses_layer',
        split_layer_animation_crosses_cut: 'crosses_layer',
        animated_layer_split_unsupported: 'animated_after_cut',
        animation_not_retimable: 'animated_after_cut',
        anchor_crosses_scene: 'anchor_crosses',
        scene_split_crosses_audio: 'crosses_audio',
        scene_split_inside_audio_fade: 'crosses_audio',
        scene_split_audio_outside_source: 'crosses_audio',
        split_outside_source: 'outside_source',
        scene_split_leaves_gap: 'leaves_gap',
      }
      return refuse(reasons[applied.reason] ?? 'no_room')
    }
    // A split that creates placements reads and changes the audio container too (`audio.insert`'s structural parent).
    const audio: CompositionEntityRef[] = Object.keys(placementIds).length > 0 ? [{ entity_kind: 'audio', entity_id: 'audio' }] : []
    return ok([{
      op,
      reads: [SCENE_SEQUENCE_REF, sceneRef(block.sceneId), ...audio],
      targets: [
        SCENE_SEQUENCE_REF,
        sceneRef(block.sceneId),
        sceneRef(newScene),
        ...Object.values(layerIds).map(layerRef),
        ...audio,
        ...Object.values(placementIds).map((placementId): CompositionEntityRef => ({ entity_kind: 'audio', entity_id: placementId })),
      ],
    }])
  }
  const stay: Body[] = []
  const moved = new Set<string>()
  const splitLayerIds: Record<string, string> = {}
  for (const layer of scene.layers as Body[]) {
    const range = localRangeOf(layer)
    if (!range || range.end <= at) {
      stay.push(layer)
      continue
    }
    if (layer['layer_kind'] === 'pending_slot') return refuse('pending')
    if (layerAnimationsOf(layer).length > 0) return refuse('animated_after_cut')
    if (range.start >= at) {
      moved.add(layer['layer_id'] as string)
      continue
    }
    if (layer['layer_kind'] !== 'clip') return refuse('crosses_layer')
    if (!splitInsideSource(document, layer, at)) return refuse('outside_source')
    splitLayerIds[layer['layer_id'] as string] = newLayerId(uuid())
    stay.push(layer)
  }
  for (const layer of stay) {
    const anchors = layerAnimationsOf(layer).flatMap((animation) => (animation.anchor.kind === 'after' ? [animation.anchor.layer_id] : []))
    if (anchors.some((target) => moved.has(target) || splitLayerIds[target] !== undefined)) return refuse('anchor_crosses')
  }
  for (const placement of document.audio.placements as Body[]) {
    if (placement['scene_id'] !== block.sceneId) continue
    const range = placement['scene_range'] as { start_frame?: number; end_frame?: number } | undefined
    if (typeof range?.start_frame === 'number' && typeof range.end_frame === 'number' && range.start_frame < at && range.end_frame > at) return refuse('crosses_audio')
  }
  if (block.policy === 'follow_media') {
    // The first half follows its media: some clip must reach the cut, or it would get shorter (`scene_split_leaves_gap`).
    let end = 0
    for (const layer of stay) {
      if (layer['layer_kind'] !== 'clip') continue
      const range = localRangeOf(layer)
      if (range) end = Math.max(end, Math.min(range.end, at))
    }
    if (end !== at) return refuse('leaves_gap')
  }
  return ok([sceneSplitSpec({ sceneId: block.sceneId, atFrame: at, newSceneId: newSceneId(uuid()), splitLayerIds })])
}

// ---------------------------------------------------------------- drops

/**
 * The planner's form of the cover fit: the `layer.set_transform` that makes a clip dropped on the main track cover the
 * canvas, written in the same command; null (or no hook) keeps the compiler's own fit (contain, centred).
 */
export type MainTrackCoverTransform = (input: { document: CompositionDocument; sceneId: string; layerId: string; sourceId: string }) => CompositionTransform | null

/**
 * Where the timeline gets that cover fit: the canvas's one cover helper (`lib/spark/stage/cover-transform.ts`, through
 * `SparkStageController.coverTransformFor`, which learns the media's pixel size with a time limit and answers null with the
 * contextual toolbar off, an unknown size or a media of the canvas's aspect). It may answer later; the drop is planned once
 * it has (still ONE command).
 */
export type MainTrackCoverResolver = (input: { document: CompositionDocument; sourceId: string }) => CompositionTransform | null | PromiseLike<CompositionTransform | null>

/** Where a drop on the main track goes: before main block `insertIndex`, in the section of the side the pointer is on. */
export function mainDropSection(model: TimelineModel, insertIndex: number, side: 'left' | 'right'): string | null {
  const left = model.main[insertIndex - 1]
  const right = model.main[insertIndex]
  if (side === 'left') return (left ?? right)?.sectionId ?? null
  return (right ?? left)?.sectionId ?? null
}

/** The caret of a drop on the main track: the cut nearest to the pointer (0 = before the first block, n = after the last). */
export function mainDropIndex(model: TimelineModel, frame: number): number {
  if (model.main.length === 0) return 0
  let best = 0
  let distance = Math.abs(frame)
  for (let index = 1; index <= model.main.length; index += 1) {
    const edge = index === model.main.length ? model.totalFrames : model.main[index]!.startFrame
    const d = Math.abs(frame - edge)
    if (d < distance) {
      best = index
      distance = d
    }
  }
  return best
}

/**
 * A project source (image or video) dropped on the main track: a new scene that follows its media at the caret, in the
 * section the pointer chose, holding the clip (`scene.insert` + `clip.insert_sequence`), plus the cover transform when the
 * hook gives one. One command.
 */
export function planMainMediaDrop(
  document: CompositionDocument,
  model: TimelineModel,
  input: { insertIndex: number; sectionId: string | null; sourceId: string; uuid?: () => string; coverTransform?: MainTrackCoverTransform },
): TimelinePlan & { sceneId?: string; layerId?: string } {
  const uuid = input.uuid ?? defaultUuid
  const probe = sourceProbeOf(document, input.sourceId)
  if (!document.source_media.some((source) => source.source_id === input.sourceId)) return refuse('not_attached')
  if (probe?.kind === 'audio') return refuse('audio_on_main')
  const kind = probe?.kind ?? null
  const insertIndex = Math.min(Math.max(0, input.insertIndex), model.main.length)
  const afterSceneId = model.main[insertIndex - 1]?.sceneId ?? null
  const sceneId = newSceneId(uuid())
  const layerId = newLayerId(uuid())
  const holdFrames = Math.max(1, Math.round(MAIN_TRACK_IMAGE_SECONDS * model.rate))
  const specs: CompositionOpSpec[] = [
    mediaSceneInsertSpec({ sceneId, afterSceneId, sectionId: input.sectionId }),
    clipInsertSequenceSpec({
      sceneId,
      afterLayerId: null,
      startFrame: 0,
      ...(kind !== 'video' && { imageHoldFrames: holdFrames }),
      items: [{ layerId, sourceId: input.sourceId }],
    }),
  ]
  const cover = input.coverTransform?.({ document, sceneId, layerId, sourceId: input.sourceId }) ?? null
  if (cover) {
    specs.push({
      op: { op: 'layer.set_transform', scene_id: sceneId, layer_id: layerId, transform: cover },
      reads: [layerRef(layerId)],
      targets: [layerRef(layerId)],
    })
  }
  return { ok: true, specs, sceneId, layerId }
}

/** An audio source dropped on the music lane: a music bed over the whole video from the drop (`audio.insert`, project range). */
export function planMusicDrop(document: CompositionDocument, model: TimelineModel, input: { frame: number; sourceId: string; uuid?: () => string }): TimelinePlan {
  const uuid = input.uuid ?? defaultUuid
  if (!document.source_media.some((source) => source.source_id === input.sourceId)) return refuse('not_attached')
  const probe = sourceProbeOf(document, input.sourceId)
  if (!probe || probe.kind !== 'audio' || !probe.hasAudio) return refuse('not_audio')
  const fps = document.canvas.fps
  const start = Math.min(Math.max(0, displayToPlayFrame(model, Math.round(input.frame))), Math.max(0, model.playTotalFrames - 1))
  const room = model.playTotalFrames - start
  if (room < 1) return refuse('no_room')
  const full = framesForTicks(probe.durationTicks, probe.timebase, fps)
  let outTick = probe.durationTicks
  let frames = full
  if (full > room) {
    outTick = Math.min(probe.durationTicks, ticksForFrames(room, probe.timebase, fps))
    while (outTick > 1 && framesForTicks(outTick, probe.timebase, fps) > room) outTick -= 1
    frames = framesForTicks(outTick, probe.timebase, fps)
  }
  if (frames < 1) return refuse('no_room')
  return ok([
    audioInsertSpec({
      placementId: newAudioPlacementId(uuid()),
      role: 'music',
      sourceId: input.sourceId,
      sourceRange: { in_tick: 0, out_tick: outTick },
      gainDb: MUSIC_BED_GAIN_DB,
      span: { projectRange: { start_frame: start, end_frame: start + frames } },
    }),
  ])
}

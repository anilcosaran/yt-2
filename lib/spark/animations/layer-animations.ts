import type { CompositionOpSpec, CompositionScene } from '../composition-client'
import { animationRemoveSpec, animationSetSpec, type CompositionAnimationSpec } from '../composition-typed-edits'
import type { PreviewEasing } from '../effects/preview-math'
import {
  ANIMATION_SLOTS,
  animationPreset,
  defaultDirection,
  defaultEasing,
  slotOfStored,
  slotPhase,
  type AnimationDirection,
  type AnimationPhase,
  type AnimationSlot,
  type PresetProperty,
} from './animation-catalog'

/**
 * Spark effects WP2: a layer's animations as the four slots of the Animation panel (In, Out, Combo, Effect) and the ONE
 * command that changes a slot. The gateway's compiler refuses two animations of one layer that animate the same property
 * at the same time (`animation_overlap`) and an animation outside the scene (`animation_outside_scene`), so every write
 * places the four slots inside the layer's own time window without overlap:
 *
 *   [ In ][ Combo ][ Effect ...................... ][ Out ]
 *   start                                              end
 *
 * In starts with the layer, Out ends with it, Combo follows In, Effect fills the rest of the window between them (after the
 * Combo when both animate one property, beside it otherwise). Anchors are written as scene frames (`scene_start` /
 * `scene_offset`), the convention of the AI's own animations, so an animation the AI wrote and the panel did not change
 * stays byte-identical. Only slots whose value changes are written; one change = one command (one undo step).
 */

export type StoredAnimation = CompositionAnimationSpec

export type LayerSlots = Record<AnimationSlot, StoredAnimation | null> & {
  /** Animations that do not fit the four slots (a second enter, an emphasis anchored to a word, ...): shown, never moved. */
  extra: StoredAnimation[]
}

export type SlotChoice = {
  presetId: string
  durationFrames: number
  easing: PreviewEasing
  direction: AnimationDirection | null
}

const PHASES: readonly AnimationPhase[] = ['enter', 'exit', 'emphasis']
const EASINGS: readonly PreviewEasing[] = ['linear', 'ease_in', 'ease_out', 'ease_in_out']

function isStoredAnimation(value: unknown): value is StoredAnimation {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  const ref = raw['preset_ref'] as Record<string, unknown> | undefined
  const params = raw['params'] as Record<string, unknown> | undefined
  return (
    typeof raw['animation_id'] === 'string' &&
    (PHASES as readonly unknown[]).includes(raw['phase']) &&
    !!ref &&
    typeof ref['preset_id'] === 'string' &&
    typeof ref['preset_revision'] === 'number' &&
    !!params &&
    Number.isSafeInteger(params['duration_frames']) &&
    (EASINGS as readonly unknown[]).includes(params['easing']) &&
    !!raw['anchor'] &&
    typeof raw['anchor'] === 'object'
  )
}

/** The animations a layer stores (malformed entries are skipped: the gateway refuses them anyway). */
export function layerAnimationsOf(layer: Record<string, unknown> | null | undefined): StoredAnimation[] {
  const raw = layer?.['animations']
  return Array.isArray(raw) ? raw.filter(isStoredAnimation) : []
}

/** The layer's own time window in its scene (frames, end exclusive), or null. */
export function layerRangeOf(layer: Record<string, unknown>): { start: number; end: number } | null {
  const range = (layer['layer_kind'] === 'clip' ? (layer['placement'] as Record<string, unknown> | undefined)?.['scene_range'] : layer['scene_range']) as
    | { start_frame?: unknown; end_frame?: unknown }
    | undefined
  const start = range?.start_frame
  const end = range?.end_frame
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && (end as number) > (start as number) ? { start: start as number, end: end as number } : null
}

/** Sorts a layer's animations into the panel's slots: the first of each slot shows there, the rest is `extra`. */
export function slotsOf(animations: readonly StoredAnimation[]): LayerSlots {
  const slots: LayerSlots = { in: null, out: null, combo: null, effect: null, extra: [] }
  for (const animation of animations) {
    const slot = slotOfStored(animation.phase, animation.preset_ref.preset_id)
    const sceneAnchored = animation.anchor.kind === 'scene_start' || animation.anchor.kind === 'scene_end' || animation.anchor.kind === 'scene_offset' || animation.anchor.kind === 'after'
    if (slots[slot] === null && sceneAnchored) slots[slot] = animation
    else slots.extra.push(animation)
  }
  return slots
}

/** The choice a slot shows for a stored animation. */
export function choiceOf(animation: StoredAnimation): SlotChoice {
  const direction = animation.params.direction
  return {
    presetId: animation.preset_ref.preset_id,
    durationFrames: animation.params.duration_frames,
    easing: animation.params.easing,
    direction: direction && direction !== 'none' ? direction : null,
  }
}

/**
 * The choice a preset card writes into a slot: what still fits of the slot's current animation (its length; its easing
 * and direction when the preset stays) carries over, the rest is the preset's default.
 */
export function choiceForPreset(presetId: string, slot: AnimationSlot, fps: { num: number; den: number }, current: SlotChoice | null): SlotChoice {
  const preset = animationPreset(presetId)
  const samePreset = current?.presetId === presetId
  const seconds = preset?.defaultSeconds ?? 0.5
  let direction: AnimationDirection | null = null
  if (preset?.direction === 'required') {
    // A travel direction carries over between slide and move; a pan (Ken Burns) only from another pan.
    const carried = current?.direction && (current.presetId === 'ken_burns') === (presetId === 'ken_burns') ? current.direction : null
    direction = carried ?? defaultDirection(presetId)
  }
  return {
    presetId,
    durationFrames: current && slot !== 'effect' ? current.durationFrames : Math.max(1, Math.round((seconds * fps.num) / fps.den)),
    easing: samePreset && current ? current.easing : defaultEasing(slot, presetId),
    direction,
  }
}

export type SlotPlan = { ok: true; specs: CompositionOpSpec[] } | { ok: false; reason: 'no_room' | 'unknown_layer' | 'direction_required' }

const propertiesOf = (presetId: string): readonly PresetProperty[] => animationPreset(presetId)?.properties ?? ['opacity', 'x', 'y', 'scale', 'scale_x', 'scale_y', 'blur', 'rotation', 'skew_x', 'skew_y', 'reveal', 'scramble', 'counter']
const shareProperty = (a: string, b: string) => propertiesOf(a).some((property) => propertiesOf(b).includes(property))

function anchorAt(frame: number): StoredAnimation['anchor'] {
  return frame === 0 ? { kind: 'scene_start' } : { kind: 'scene_offset', frames: frame }
}

function build(id: string, slot: AnimationSlot, choice: SlotChoice, start: number, frames: number): StoredAnimation {
  const preset = animationPreset(choice.presetId)
  const direction = preset?.direction === 'required' ? (choice.direction ?? 'up') : null
  return {
    animation_id: id,
    phase: slotPhase(slot),
    preset_ref: { preset_id: choice.presetId, preset_revision: 1 },
    params: { duration_frames: frames, easing: choice.easing, ...(direction && { direction }) },
    anchor: anchorAt(start),
  }
}

/** A fresh animation id (`anm_` + 20 hex digits; the gateway's opaque-id rule). */
export function newAnimationId(random: () => string = () => globalThis.crypto.randomUUID()): string {
  return `anm_${random().replace(/-/g, '').slice(0, 20)}`
}

/**
 * The command that sets (`choice`) or clears (`null`) one slot of a layer, re-placing the other slots so the four never
 * overlap (see the header). `{ ok: false, reason: 'no_room' }` when the layer is too short for what is asked: nothing is
 * sent and the panel says so.
 */
export function planSlotChange(input: {
  sceneId: string
  layer: Record<string, unknown>
  slot: AnimationSlot
  choice: SlotChoice | null
  newId?: () => string
}): SlotPlan {
  const range = layerRangeOf(input.layer)
  const layerId = input.layer['layer_id']
  if (!range || typeof layerId !== 'string') return { ok: false, reason: 'unknown_layer' }
  const stored = slotsOf(layerAnimationsOf(input.layer))
  const choices: Record<AnimationSlot, { id: string; choice: SlotChoice } | null> = { in: null, out: null, combo: null, effect: null }
  for (const slot of ANIMATION_SLOTS) {
    const current = stored[slot]
    choices[slot] = current ? { id: current.animation_id, choice: choiceOf(current) } : null
  }
  if (input.choice) {
    if (animationPreset(input.choice.presetId)?.direction === 'required' && !input.choice.direction) return { ok: false, reason: 'direction_required' }
    choices[input.slot] = { id: choices[input.slot]?.id ?? (input.newId ?? newAnimationId)(), choice: { ...input.choice, durationFrames: Math.max(1, Math.round(input.choice.durationFrames)) } }
  } else {
    choices[input.slot] = null
  }

  const length = range.end - range.start
  let inFrames = choices.in?.choice.durationFrames ?? 0
  let outFrames = choices.out?.choice.durationFrames ?? 0
  // The slot being changed gives way first, then the other edge; each keeps at least one frame.
  if (inFrames + outFrames > length) {
    if (input.slot === 'out') outFrames = Math.max(choices.out ? 1 : 0, length - inFrames)
    else inFrames = Math.max(choices.in ? 1 : 0, length - outFrames)
    if (inFrames + outFrames > length) {
      if (input.slot === 'out') inFrames = Math.max(choices.in ? 1 : 0, length - outFrames)
      else outFrames = Math.max(choices.out ? 1 : 0, length - inFrames)
    }
    if (inFrames + outFrames > length) return { ok: false, reason: 'no_room' }
  }
  const windowStart = range.start + inFrames
  const windowEnd = range.end - outFrames
  const room = windowEnd - windowStart

  const desired: Record<AnimationSlot, StoredAnimation | null> = { in: null, out: null, combo: null, effect: null }
  if (choices.in) desired.in = build(choices.in.id, 'in', choices.in.choice, range.start, inFrames)
  if (choices.out) desired.out = build(choices.out.id, 'out', choices.out.choice, range.end - outFrames, outFrames)
  let comboFrames = 0
  if (choices.combo) {
    comboFrames = Math.min(choices.combo.choice.durationFrames, room)
    if (comboFrames < 1) return { ok: false, reason: 'no_room' }
    desired.combo = build(choices.combo.id, 'combo', choices.combo.choice, windowStart, comboFrames)
  }
  if (choices.effect) {
    // An effect runs over the layer; next to a Combo that animates the same property it starts after it.
    const after = choices.combo && shareProperty(choices.combo.choice.presetId, choices.effect.choice.presetId) ? comboFrames : 0
    const frames = room - after
    if (frames < 1) return { ok: false, reason: 'no_room' }
    desired.effect = build(choices.effect.id, 'effect', choices.effect.choice, windowStart + after, frames)
  }

  const specs: CompositionOpSpec[] = []
  for (const slot of ANIMATION_SLOTS) {
    const before = stored[slot]
    const after = desired[slot]
    if (after && canonical(before) !== canonical(after)) specs.push(animationSetSpec(input.sceneId, layerId, after))
    else if (!after && before) specs.push(animationRemoveSpec(input.sceneId, layerId, before.animation_id))
  }
  return { ok: true, specs }
}

/** JSON with sorted keys (the server may store keys in another order than the editor builds them). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** The layer of a scene by id, as the raw document body. */
export function sceneLayerBody(scene: CompositionScene | undefined, layerId: string): Record<string, unknown> | null {
  return (scene?.layers.find((layer) => layer.layer_id === layerId) as Record<string, unknown> | undefined) ?? null
}

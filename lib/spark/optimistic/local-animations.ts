import { graphemes } from '../stage/motion-core/text'
import {
  findScenePreset,
  presetTextContent,
  scenePresetFitsLayer,
  type AnimationDirection as RecipeDirection,
  type AnimationPhase as RecipePhase,
  type Easing,
  type PresetTween as RecipeTween,
  type ScenePresetDefinition,
} from '../stage/motion-core/recipes'

/**
 * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`): the layer animations of `scene_compiler@1` in the browser, so a scene
 * whose text, shape or image enters, leaves or loops (every AI title does) is drawn by the editor's LOCAL compile like any
 * other scene, in the frame of the edit, instead of waiting for the server's picture.
 *
 * The presets are not ported: they are the Spark effects library's own (`stage/motion-core/recipes/presets.ts`, the
 * generated copy of `packages/motion-runtime/src/recipes/presets.ts`, the very definitions the gateway compiles). What is
 * ported here, from the gateway, is:
 * - the AnimationSpec check of `api-gateway/src/composition/domain/scene-compiler/scene-presets.ts`
 *   (`validateCompositionAnimation`), reduced to "is it exactly valid": anything the gateway would refuse or report is not
 *   drawn here;
 * - the anchor resolution, overlap check and text programs of `scene-compiler.ts` (`resolveAnimations`, `checkOverlaps`,
 *   `presetTweens`, `applyTextPrograms`); the tween emission is the recipes' `presetTrackFields`, the text program specs
 *   the recipes' `presetTextContent`.
 *
 * `local-animation-parity.test.ts` asserts the IR the browser emits equals the gateway's, node for node, over a golden the
 * gateway test generates from its real compiler (`optimistic-animation-parity.test.ts`). What the browser does not resolve
 * itself it does not guess: a `word` anchor (transcript timings only the server reads), an unresolved or cyclic `after`
 * anchor, an animation past the scene, two animations of one property at once, an unknown preset - the scene stays the
 * server's to draw (`null` here), exactly as before.
 */

type Json = Record<string, unknown>
/** A compiled layer of the scene, as the document stores it. */
export type AnimatedLayer = { layer_id: string; layer_kind: string } & Json
type Layer = AnimatedLayer

export type AnimationPhase = RecipePhase
export type AnimationDirection = RecipeDirection
export type AnimationEasing = Easing
export type PresetTween = RecipeTween

export type LocalAnimation = {
  animation_id: string
  phase: AnimationPhase
  preset_ref: { preset_id: string; preset_revision: number }
  params: { duration_frames: number; easing: AnimationEasing; direction?: AnimationDirection; stagger_frames?: number }
  anchor: { kind: 'scene_start' } | { kind: 'scene_end' } | { kind: 'scene_offset'; frames: number } | { kind: 'after'; layer_id: string; phase: AnimationPhase } | { kind: 'word' } & Json
}

/** A preset of the allowlist (the recipes' `findScenePreset`). */
export function findLocalPreset(presetId: string, presetRevision: number): ScenePresetDefinition | null {
  return findScenePreset(presetId, presetRevision)
}

function presetFitsLayer(preset: ScenePresetDefinition, layerKind: string): boolean {
  return scenePresetFitsLayer(preset, layerKind)
}

// ---------------------------------------------------------------- AnimationSpec check (`validateCompositionAnimation`)

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const PHASES: readonly string[] = ['enter', 'exit', 'emphasis']
const EASINGS: readonly string[] = ['linear', 'ease_in', 'ease_out', 'ease_in_out']
const DIRECTIONS: readonly string[] = ['none', 'up', 'down', 'left', 'right']
const WORD_ARTIFACT_KINDS: readonly string[] = ['transcript', 'script']

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isInteger = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min
const closed = (value: unknown, allowed: readonly string[], required: readonly string[]): value is Json =>
  isObject(value) && Object.keys(value).every((key) => allowed.includes(key)) && required.every((key) => key in value)

function anchorValid(value: unknown): boolean {
  if (!isObject(value) || typeof value['kind'] !== 'string') return false
  switch (value['kind']) {
    case 'scene_start':
    case 'scene_end':
      return closed(value, ['kind'], ['kind'])
    case 'scene_offset':
      return closed(value, ['kind', 'frames'], ['kind', 'frames']) && Number.isSafeInteger(value['frames'])
    case 'after':
      return closed(value, ['kind', 'layer_id', 'phase'], ['kind', 'layer_id', 'phase']) && typeof value['layer_id'] === 'string' && OPAQUE_ID.test(value['layer_id']) && PHASES.includes(value['phase'] as string)
    case 'word': {
      if (!closed(value, ['kind', 'transcript_or_narration', 'word_id', 'offset_frames'], ['kind', 'transcript_or_narration', 'word_id', 'offset_frames'])) return false
      const ref = value['transcript_or_narration']
      return (
        closed(ref, ['artifact_kind', 'artifact_id', 'artifact_revision'], ['artifact_kind', 'artifact_id', 'artifact_revision']) &&
        WORD_ARTIFACT_KINDS.includes(ref['artifact_kind'] as string) &&
        typeof ref['artifact_id'] === 'string' &&
        OPAQUE_ID.test(ref['artifact_id']) &&
        isInteger(ref['artifact_revision'], 1) &&
        typeof value['word_id'] === 'string' &&
        OPAQUE_ID.test(value['word_id']) &&
        Number.isSafeInteger(value['offset_frames'])
      )
    }
    default:
      return false
  }
}

/**
 * The AnimationSpec exactly as the gateway accepts it (`validateCompositionAnimation`: closed objects, a known preset at that
 * revision, the phase the preset animates, the direction it takes, stagger 0), or null. Nothing is defaulted or clamped.
 */
export function readLocalAnimation(value: unknown): LocalAnimation | null {
  if (!closed(value, ['animation_id', 'phase', 'preset_ref', 'params', 'anchor'], ['animation_id', 'phase', 'preset_ref', 'params', 'anchor'])) return null
  if (typeof value['animation_id'] !== 'string' || !OPAQUE_ID.test(value['animation_id'])) return null
  const phase = value['phase']
  if (!PHASES.includes(phase as string)) return null
  const ref = value['preset_ref']
  if (!closed(ref, ['preset_id', 'preset_revision'], ['preset_id', 'preset_revision'])) return null
  const params = value['params']
  if (!closed(params, ['duration_frames', 'easing', 'direction', 'stagger_frames'], ['duration_frames', 'easing'])) return null
  if (!isInteger(params['duration_frames'], 1) || !EASINGS.includes(params['easing'] as string)) return null
  if ('direction' in params && !DIRECTIONS.includes(params['direction'] as string)) return null
  if ('stagger_frames' in params && params['stagger_frames'] !== 0) return null
  if (typeof ref['preset_id'] !== 'string' || !OPAQUE_ID.test(ref['preset_id']) || !isInteger(ref['preset_revision'], 1)) return null
  const preset = findLocalPreset(ref['preset_id'], ref['preset_revision'])
  if (!preset || !preset.phases.includes(phase as AnimationPhase)) return null
  const direction = params['direction'] ?? 'none'
  if (preset.direction === 'required' && direction === 'none') return null
  if (preset.direction === 'none' && direction !== 'none') return null
  if (!anchorValid(value['anchor'])) return null
  return structuredClone(value) as unknown as LocalAnimation
}

// ---------------------------------------------------------------- anchors (`resolveAnimations`)

export type ResolvedAnimation = { animation: LocalAnimation; start: number }

/**
 * The start frame of every animation of the scene's compiled layers, by layer id (sorted like the compiler: start, then id),
 * or null when the browser cannot draw them exactly as the gateway does: a spec the gateway would refuse, a preset that does
 * not fit the layer, a `word` anchor, an `after` anchor that does not resolve or closes a cycle, an animation outside the
 * scene, or two animations animating one property of a layer at the same time.
 */
export function resolveLocalAnimations(
  layers: readonly Layer[],
  duration: number,
  context: { tweensOf: (layer: Layer, resolved: ResolvedAnimation) => PresetTween[] },
): Map<string, ResolvedAnimation[]> | null {
  type Slot = { layer: Layer; animation: LocalAnimation; state: 'pending' | 'visiting' | 'resolved' | 'unresolved' | 'invalid'; start: number | null }
  const slots: Slot[] = []
  const byLayer = new Map<string, Slot[]>()
  for (const layer of layers) {
    const raw = Array.isArray(layer['animations']) ? (layer['animations'] as unknown[]) : []
    for (const value of raw) {
      const animation = readLocalAnimation(value)
      if (!animation) return null
      const preset = findLocalPreset(animation.preset_ref.preset_id, animation.preset_ref.preset_revision)
      if (!preset || !presetFitsLayer(preset, layer.layer_kind)) return null
      if (animation.anchor.kind === 'word') return null
      const slot: Slot = { layer, animation, state: 'pending', start: null }
      slots.push(slot)
      byLayer.set(layer.layer_id, [...(byLayer.get(layer.layer_id) ?? []), slot])
    }
  }
  const visit = (slot: Slot): void => {
    if (slot.state !== 'pending') return
    slot.state = 'visiting'
    const { anchor, params } = slot.animation
    let start: number | null = null
    switch (anchor.kind) {
      case 'scene_start':
        start = 0
        break
      case 'scene_end':
        start = duration - params.duration_frames
        break
      case 'scene_offset':
        start = (anchor as { frames: number }).frames
        break
      case 'after': {
        const { layer_id: target, phase } = anchor as { layer_id: string; phase: AnimationPhase }
        const targets = (byLayer.get(target) ?? []).filter((candidate) => candidate.animation.phase === phase)
        if (targets.length === 0) break
        let end = 0
        let resolved = true
        for (const candidate of targets) {
          if (candidate.state !== 'visiting') visit(candidate)
          if (candidate.state === 'visiting' || candidate.state === 'invalid') {
            slot.state = 'invalid'
            return
          }
          if (candidate.state !== 'resolved' || candidate.start === null) {
            resolved = false
            break
          }
          end = Math.max(end, candidate.start + candidate.animation.params.duration_frames)
        }
        if (resolved) start = end
        break
      }
    }
    slot.start = start
    slot.state = start === null ? 'unresolved' : 'resolved'
  }
  for (const slot of slots) visit(slot)
  const out = new Map<string, ResolvedAnimation[]>()
  for (const slot of slots) {
    if (slot.state !== 'resolved' || slot.start === null) return null
    const end = slot.start + slot.animation.params.duration_frames
    if (slot.start < 0 || end > duration) return null
    out.set(slot.layer.layer_id, [...(out.get(slot.layer.layer_id) ?? []), { animation: slot.animation, start: slot.start }])
  }
  const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  for (const [layerId, list] of out) {
    list.sort((a, b) => a.start - b.start || compareIds(a.animation.animation_id, b.animation.animation_id))
    // `checkOverlaps`: two animations of one layer may not animate the same property at the same time.
    const layer = layers.find((candidate) => candidate.layer_id === layerId) as Layer
    const windows = new Map<string, Array<{ start: number; end: number }>>()
    for (const resolved of list) {
      for (const tween of context.tweensOf(layer, resolved)) {
        const entries = windows.get(tween.property) ?? []
        entries.push({ start: resolved.start, end: resolved.start + resolved.animation.params.duration_frames })
        windows.set(tween.property, entries)
      }
    }
    for (const entries of windows.values()) {
      entries.sort((a, b) => a.start - b.start || a.end - b.end)
      for (let index = 1; index < entries.length; index += 1) if (entries[index]!.start < entries[index - 1]!.end) return null
    }
    // `applyTextPrograms`: a text runs one text program (scramble or count up); both is the server's refusal to report.
    const programs = new Set(list.map((resolved) => findLocalPreset(resolved.animation.preset_ref.preset_id, resolved.animation.preset_ref.preset_revision)?.text_program).filter(Boolean))
    if (programs.size > 1) return null
  }
  return out
}

/**
 * `applyTextPrograms` of the compiler: the text program spec (scramble / counter) a text animated by such a preset carries
 * on its text node, derived from the copy alone; null when none of its animations runs one (or a count up's copy is not one
 * number: it then animates nothing).
 */
export function localTextProgram(animations: readonly ResolvedAnimation[], text: { text: string; lang: string }): Record<string, unknown> | null {
  for (const resolved of animations) {
    const preset = findLocalPreset(resolved.animation.preset_ref.preset_id, resolved.animation.preset_ref.preset_revision)
    if (preset?.text_program) return presetTextContent(preset, text)
  }
  return null
}

/** `presetTweens` of the compiler: the preset's tweens for a layer as the compiler placed it. */
export function localPresetTweens(input: {
  animation: LocalAnimation
  canvas: { width: number; height: number }
  /** The layer group's `scale` (1 when absent). */
  layerScale: number
  /** The content node's box (unscaled layer space) and rest rotation. */
  box: { width: number; height: number }
  restRotation: number
  /** The content node's text and language, for a text layer. */
  text: { text: string; lang: string } | null
}): PresetTween[] {
  const { animation } = input
  const preset = findLocalPreset(animation.preset_ref.preset_id, animation.preset_ref.preset_revision)
  if (!preset) return []
  return preset.tweens({
    phase: animation.phase,
    direction: animation.params.direction ?? 'none',
    canvas: { width: input.canvas.width, height: input.canvas.height },
    layer_scale: input.layerScale,
    box: { width: input.box.width, height: input.box.height },
    rest_rotation: input.restRotation,
    ...(input.text && { text_graphemes: graphemes(input.text.text.normalize('NFC'), input.text.lang).length }),
    // scene-presets@3 input: the copy (`count_up` counts to the number it shows).
    ...(input.text && { text: { text: input.text.text, lang: input.text.lang } }),
  })
}

/** Whether any layer of the list carries an animation (the scenes this module exists for). */
export function hasAnimations(layers: readonly Json[]): boolean {
  return layers.some((layer) => Array.isArray(layer['animations']) && (layer['animations'] as unknown[]).length > 0)
}

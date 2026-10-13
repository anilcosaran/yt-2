import type { PreviewEasing } from '../effects/preview-math'
import type { InspectorSchema } from '../stage/inspector-schema'
import { SCENE_PRESETS_ALL, findScenePreset, presetFitsText, presetProperties, type PresetProperty as RecipeProperty, type ScenePresetDefinition } from '../stage/motion-core/recipes'

/**
 * Spark effects WP2: the editor's view of the layer animation presets. The presets are the Spark effects library's own
 * (`stage/motion-core/recipes/presets.ts`, the generated copy of `packages/motion-runtime/src/recipes/presets.ts`, the very
 * definitions the gateway compiles): this file only adds the editor's view of them (slots, defaults, what the schema offers).
 * The gateway is the authority: it validates every `animation.set`, compiles the tweens and lists in the inspector schema
 * which presets a layer kind may take RIGHT NOW (the later catalogues only while their switch is open). The editor offers
 * exactly the presets the schema lists (`offeredPresets`) and draws the hover previews of the cards by sampling the same
 * recipes in the browser, without a server call (`components/spark/tools/effect-thumbs.tsx`).
 *
 * The four slots of the Animation panel (CapCut's In / Out / Combo / Effect): In = an `enter` preset, Out = an `exit`
 * preset, Combo = an emphasis loop (pulse, swing, bounce), Effect = an emphasis that runs over the layer (Ken Burns, slow
 * zoom, defocus).
 */

export type AnimationPhase = 'enter' | 'exit' | 'emphasis'
export type AnimationDirection = 'up' | 'down' | 'left' | 'right'
export type AnimationSlot = 'in' | 'out' | 'combo' | 'effect'
export type AnimatableKind = 'text' | 'shape' | 'clip'
export type PresetProperty = RecipeProperty

export const ANIMATION_SLOTS: readonly AnimationSlot[] = ['in', 'out', 'combo', 'effect']
export const ANIMATION_DIRECTIONS: readonly AnimationDirection[] = ['up', 'down', 'left', 'right']

export type AnimationPresetInfo = {
  id: string
  revision: number
  /** The catalogue that added it (1 = `scene-presets@1`, 2 = a `scene-presets@2` addition, ...). */
  catalog: number
  phases: readonly AnimationPhase[]
  direction: 'required' | 'none'
  /** Layer kinds it animates; null = text, shape and clip. */
  layerKinds: readonly AnimatableKind[] | null
  /** The emphasis slot it belongs to (enter/exit presets: null). */
  emphasisSlot: 'combo' | 'effect' | null
  /** The properties its tweens animate (two animations of one layer may not animate one property at the same time). */
  properties: readonly PresetProperty[]
  defaultSeconds: number
}

function infoOf(preset: ScenePresetDefinition): AnimationPresetInfo {
  return {
    id: preset.preset_id,
    revision: preset.preset_revision,
    catalog: preset.catalog ?? 1,
    phases: preset.phases,
    direction: preset.direction,
    layerKinds: preset.layer_kinds ?? null,
    emphasisSlot: preset.editor.slot,
    properties: presetProperties(preset),
    defaultSeconds: preset.editor.default_seconds,
  }
}

/** Every preset of the recipes, in the gateway's order (`SCENE_PRESETS`, then the later catalogues). */
export const ANIMATION_PRESETS: readonly AnimationPresetInfo[] = SCENE_PRESETS_ALL.map(infoOf)

const BY_ID = new Map(ANIMATION_PRESETS.map((preset) => [preset.id, preset]))

export function animationPreset(id: string): AnimationPresetInfo | null {
  return BY_ID.get(id) ?? null
}

/**
 * Whether a preset fits the selected layer beyond its kind: a count up needs a text that is exactly one number (the gateway
 * refuses it on any other text, `preset_text_not_numeric`).
 */
export function presetFitsTarget(preset: AnimationPresetInfo, layer: Record<string, unknown>): boolean {
  const definition = findScenePreset(preset.id, preset.revision)
  if (!definition || layer['layer_kind'] !== 'text') return true
  return presetFitsText(definition, { text: String(layer['text'] ?? ''), lang: 'und' })
}

/** The phase a slot writes. */
export function slotPhase(slot: AnimationSlot): AnimationPhase {
  return slot === 'in' ? 'enter' : slot === 'out' ? 'exit' : 'emphasis'
}

/** Whether a preset belongs in a slot of the panel. */
export function presetFitsSlot(preset: AnimationPresetInfo, slot: AnimationSlot): boolean {
  if (slot === 'in' || slot === 'out') return preset.phases.includes(slotPhase(slot))
  return preset.emphasisSlot === slot
}

/** The slot a stored animation shows in (an emphasis preset this editor does not know is shown as Combo). */
export function slotOfStored(phase: AnimationPhase, presetId: string): AnimationSlot {
  if (phase === 'enter') return 'in'
  if (phase === 'exit') return 'out'
  return animationPreset(presetId)?.emphasisSlot ?? 'combo'
}

/** The easing a slot starts with (enter decelerates into place, exit accelerates away, emphasis is even). */
export function defaultEasing(slot: AnimationSlot, presetId: string): PreviewEasing {
  if (presetId === 'typewriter') return 'linear'
  if (slot === 'in') return 'ease_out'
  if (slot === 'out') return 'ease_in'
  return slot === 'effect' ? 'ease_in_out' : 'linear'
}

/**
 * The direction a preset that needs one starts with: a slide or move travels right (it enters from the left, the most
 * asked-for "slide in"), Ken Burns pans left. The direction is always the direction of TRAVEL.
 */
export function defaultDirection(presetId: string): AnimationDirection | null {
  const preset = animationPreset(presetId)
  if (preset?.direction !== 'required') return null
  return presetId === 'ken_burns' ? 'left' : 'right'
}

/**
 * The preset ids the gateway lets this layer kind take now: the variants of the inspector schema's `animation.set` value
 * of that kind. Empty while the schema is not read (nothing is offered that the op might refuse).
 */
export function offeredPresets(schema: InspectorSchema | null, kind: AnimatableKind): ReadonlySet<string> {
  const target = schema?.targets.find((candidate) => candidate.target === kind)
  const control = target?.controls.find((candidate) => candidate.op === 'animation.set') as { value?: unknown } | undefined
  const variants = (control?.value as { oneOf?: unknown } | undefined)?.oneOf
  const ids = new Set<string>()
  if (!Array.isArray(variants)) return ids
  for (const variant of variants) {
    const id = (variant as { properties?: { preset_ref?: { properties?: { preset_id?: { const?: unknown } } } } })?.properties?.preset_ref?.properties?.preset_id?.const
    if (typeof id === 'string' && BY_ID.has(id)) ids.add(id)
  }
  return ids
}

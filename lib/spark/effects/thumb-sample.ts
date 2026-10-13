import { TRANSITION_CATALOG, type TransitionDirection, type TransitionEasing, type TransitionKind } from '../scene-transitions'
import { formatCounter, revealCount, scrambleCharacters, scrambleGraphemes, scrambleRanks, textGraphemes } from '../stage/motion-core/parity/text-fx'
import {
  REST_LOOK,
  findScenePreset,
  presetTextContent,
  resolveTransition,
  samplePreset,
  sampleTransition,
  transitionRecipe,
  type AnimationDirection,
  type AnimationPhase,
  type ClipPolygon,
  type Easing,
  type Look,
  type TransitionSample,
} from '../stage/motion-core/recipes'
import { recipeEase } from './recipe-eases'

/**
 * Spark effects library: what a hover thumbnail of the Transitions and Animations drawers shows at a progress of its loop.
 * Nothing here is a look-alike: a transition card samples the very recipe the gateway compiles the export's segment from
 * (`transitionRecipe` + `sampleTransition`) on a virtual window around a cut, an animation card samples the very preset
 * (`samplePreset`, with the runtime's own text programs for scramble and count up), both with the runtime's own ease curves
 * (`recipe-eases.ts`), on a canvas the size of the thumbnail.
 */

export type Size = { width: number; height: number }

/** The two sample pictures (drawn by `scripts/generate-fx-samples.py`): A leaves, B arrives (and is what a picture animates). */
export const FX_SAMPLE_A = '/spark/fx/sample-a.webp'
export const FX_SAMPLE_B = '/spark/fx/sample-b.webp'

/** Frames of the virtual window a card samples: the cut in its middle, like the timing rule's `floor(T / 2)`. */
export const THUMB_WINDOW_FRAMES = 30
/** Frames of the virtual animation a card samples. */
export const THUMB_ANIMATION_FRAMES = 30
/** The language a sample text is laid out in (the compiler's `TEXT_LANGUAGE`). */
const SAMPLE_LANGUAGE = 'und'

export type TransitionThumbInput = {
  kind: TransitionKind
  direction?: TransitionDirection | null
  color?: string | null
  easing?: TransitionEasing | null
}

/** The transition at `progress` (0 = the window starts, 1 = it ends), with the catalogue's defaults applied. */
export function transitionThumbFrame(input: TransitionThumbInput, progress: number, size: Size): TransitionSample {
  const entry = TRANSITION_CATALOG[input.kind]
  const direction = entry.directions && input.direction && (entry.directions as readonly string[]).includes(input.direction) ? input.direction : undefined
  const params = {
    ...(direction && { direction }),
    ...(entry.color && input.color && { color: input.color }),
    ...(entry.easing && input.easing && { easing: input.easing }),
  }
  const resolved = resolveTransition({ kind: input.kind, params })
  const recipe = transitionRecipe(resolved, size, { from_frames: THUMB_WINDOW_FRAMES / 2, duration_frames: THUMB_WINDOW_FRAMES, document_frame_offset: 0 })
  return sampleTransition(recipe, resolved, size, clamp01(progress) * THUMB_WINDOW_FRAMES, recipeEase)
}

/** The CSS clip-path of a clipping window's visible part (canvas px), or undefined for the whole picture. */
export function clipPathOf(clip: ClipPolygon | null): string | undefined {
  if (!clip) return undefined
  return `polygon(${clip.map((point) => `${round(point.x)}px ${round(point.y)}px`).join(', ')})`
}

export type PresetThumbInput = {
  presetId: string
  phase: AnimationPhase
  direction?: Exclude<AnimationDirection, 'none'> | null
  easing: Easing
}

/**
 * How the sample element of an animation card looks at `progress` (0-1), and the text a sample word shows then: the
 * graphemes the typewriter has typed, the letters a scramble has decoded, the number a count up has reached.
 */
export function presetThumbLook(input: PresetThumbInput, progress: number, size: Size, word: string): { look: Look; text: string } | null {
  const preset = findScenePreset(input.presetId, 1)
  if (!preset) return null
  const graphemes = textGraphemes(word, SAMPLE_LANGUAGE)
  const sample = { text: word, lang: SAMPLE_LANGUAGE }
  const direction: AnimationDirection = preset.direction === 'required' ? (input.direction ?? 'up') : 'none'
  const tweens = preset.tweens({
    phase: input.phase,
    direction,
    canvas: size,
    layer_scale: 1,
    box: size,
    rest_rotation: 0,
    text_graphemes: graphemes.length,
    text: sample,
  })
  const program = presetTextContent(preset, sample)
  const counter = program && 'counter' in program ? program.counter : null
  const scramble = program && 'scramble' in program ? program.scramble : null
  // At rest a text shows all its graphemes, decoded, and a counter its own number.
  const rest = { reveal: graphemes.length, scramble: 1, ...(counter && { counter: counter.value }) }
  const frame = clamp01(progress) * THUMB_ANIMATION_FRAMES
  const values = samplePreset(tweens, { phase: input.phase, params: { duration_frames: THUMB_ANIMATION_FRAMES, easing: input.easing } }, frame, recipeEase, rest)
  const look: Look = { ...REST_LOOK }
  for (const key of Object.keys(REST_LOOK) as Array<keyof Look>) if (typeof values[key] === 'number') look[key] = values[key] as number
  let shown = graphemes
  if (counter) shown = textGraphemes(formatCounter(values['counter'] ?? counter.value, counter, SAMPLE_LANGUAGE), SAMPLE_LANGUAGE)
  else if (scramble) {
    shown = scrambleGraphemes(graphemes, values['scramble'] ?? 1, Math.floor(frame), scramble, scrambleCharacters(scramble, SAMPLE_LANGUAGE), scrambleRanks(graphemes.length, scramble))
  }
  const visible = typeof values['reveal'] === 'number' ? revealCount(values['reveal'], shown.length) : shown.length
  return { look, text: shown.slice(0, visible).join('') }
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

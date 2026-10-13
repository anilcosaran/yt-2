import type { ComposerRequestedCount } from './message-context'

/**
 * QA-078 (P03-01 composer / P03-15 multi-output): the "Adet" (output count) section of the composer's canvas popover.
 * The options come from the selected image model's own limit (`max_images_per_run` of its catalog input schema, never
 * above the `image_generate@1` node bound); an option above the model maximum is never offered. A count the user named
 * in the message ("4 thumbnail üret") is preselected when the model allows it. Only a count the user chose (or named)
 * travels as `requested_count` — the untouched default 1 sends nothing, so the planner and the server's dispatch check
 * (P03-15 `validateAssistantMultiOutputDispatch`) stay the authority. Nothing here clamps a count silently (K113).
 */

/** The capability whose `count` model input carries the requested count (P03-01 `ComposerRequestedCount`). */
export const COMPOSER_OUTPUT_COUNT_CAPABILITY = 'image.generate'
/** `image_generate@1` accepts `count` 1–32 per node; a model limit above it is capped here. */
export const COMPOSER_OUTPUT_COUNT_NODE_MAX = 32
export const COMPOSER_OUTPUT_COUNT_DEFAULT = 1

export type ComposerOutputCountSource = 'explicit' | 'message' | 'default'

export type ComposerOutputCountView = {
  /** 1…model max; empty when the model does not state its limit (nothing is offered then). */
  options: number[]
  /** The checked option (1 unless the user chose or named another allowed count). */
  value: number
  source: ComposerOutputCountSource
  /** What the message carries; null for the untouched default (the server decides). */
  requestedCount: ComposerRequestedCount | null
  modelMax: number | null
}

/** `max_images_per_run` of an image model's catalog input schema; null when the model does not say. */
export function readComposerOutputCountMax(inputSchema: Record<string, unknown> | null | undefined): number | null {
  const value = inputSchema?.['max_images_per_run']
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null
  return Math.min(value, COMPOSER_OUTPUT_COUNT_NODE_MAX)
}

export function composerOutputCountOptions(modelMax: number | null): number[] {
  if (modelMax === null) return []
  return Array.from({ length: modelMax }, (_, index) => index + 1)
}

// Nouns of an image output (TR/EN, any suffix: "görseli", "thumbnails"). Digits only; number words stay text.
const OUTPUT_NOUN = String.raw`(?:görsel|gorsel|resim|fotoğraf|fotograf|foto|thumbnail|kapak|logo|poster|afiş|afis|banner|ikon|icon|illüstrasyon|illustrasyon|varyasyon|varyant|çizim|cizim|sticker|image|picture|photo|illustration|variation|variant|drawing|cover)`
const COUNTER = String.raw`(?:adet|tane|x|×)`
// Matched after `ı` → `i` (so `farklı` is `farkli`).
const ADJECTIVE = String.raw`(?:farkli|ayri|yeni|different|new|more)`
const COUNT_PATTERN = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,:/#-])(\d{1,2})\s*(?:${COUNTER}\s*)?(?:${ADJECTIVE}\s+)?${OUTPUT_NOUN}\p{L}*`,
  'giu',
)

/**
 * The output count the message names ("4 thumbnail üret", "10 farklı görsel", "3 images"), or null when it names none
 * or several different ones (ambiguous: the user picks in "Adet"). Numbers inside other tokens (`16:9`, `1080`, `#4`)
 * are not counts.
 */
export function detectComposerOutputCount(text: string): number | null {
  const counts = new Set<number>()
  for (const match of text.toLocaleLowerCase('tr').replace(/ı/gu, 'i').matchAll(COUNT_PATTERN)) {
    const value = Number(match[1])
    if (Number.isInteger(value) && value >= 1) counts.add(value)
  }
  return counts.size === 1 ? [...counts][0]! : null
}

/**
 * The popover's state for the current model and text: an explicit pick the model allows wins, then a count the message
 * names (preselected only when the model allows it), else the default 1 — which sends no requested count.
 */
export function resolveComposerOutputCount(input: {
  pick: number | null
  text: string
  modelMax: number | null
}): ComposerOutputCountView {
  const options = composerOutputCountOptions(input.modelMax)
  const allowed = (count: number | null): count is number => count !== null && options.includes(count)
  const requested = (count: number): ComposerRequestedCount => ({
    capability: COMPOSER_OUTPUT_COUNT_CAPABILITY,
    count,
    min: 1,
    max: input.modelMax,
  })
  if (allowed(input.pick)) {
    return { options, value: input.pick, source: 'explicit', requestedCount: requested(input.pick), modelMax: input.modelMax }
  }
  const named = detectComposerOutputCount(input.text)
  if (allowed(named)) {
    return { options, value: named, source: 'message', requestedCount: requested(named), modelMax: input.modelMax }
  }
  return { options, value: COMPOSER_OUTPUT_COUNT_DEFAULT, source: 'default', requestedCount: null, modelMax: input.modelMax }
}

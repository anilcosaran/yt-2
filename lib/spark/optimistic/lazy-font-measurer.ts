import { MotionError } from '../stage/motion-core/errors'
import { parseFont, otLanguage, primaryOtScript, type FontFaceDescriptor, type FontRequest, type ParsedFont, type TextMeasurer } from '../stage/motion-core/text'

/**
 * E1-N: the text measurer of the browser's local scene compile. The gateway lays text out with `createFontSetMeasurer`
 * over EVERY face of the platform catalogue (its `font_set_hash` is the hash of that whole set, and every stored layout
 * records it). The browser must produce byte-identical layouts, but it cannot download the whole catalogue to edit one
 * title: it knows the set's descriptors and hash from the preview manifest and loads only the face bytes a text layer uses.
 *
 * So this is `createFontSetMeasurer` with the two things that differ made explicit: the set hash comes from the manifest
 * (checked by the caller against `fontSetHash(descriptors)`), and a face's bytes are parsed the first time it is measured.
 * The measuring functions are the ones of `motion-core/text/measure.ts`, line for line (`measure-parity.test.ts` asserts
 * equal layouts against the real measurer on the real fonts), so a layout cannot differ from the gateway's.
 *
 * A face whose bytes are not loaded is a refusal (`font_refused`): never a fallback, never an estimate.
 */

const IGNORABLE = /\p{Default_Ignorable_Code_Point}/u
const MARK = /\p{M}/u
const SPACING_MARK = /\p{Mc}/u

const faceKey = (font: { family: string; weight: number; style?: 'normal' | 'italic' }): string => `${font.family}\u0000${font.weight}\u0000${font.style ?? 'normal'}`

export type LazyMeasurerInput = {
  /** `fonts.font_set_hash` of the preview manifest: identity of the whole pinned set. */
  fontSetHash: string
  /** Descriptors of every face of the set (family, weight, style, sha256). */
  faces: readonly FontFaceDescriptor[]
  /** Verified bytes of a face the page has loaded, or null. */
  bytesOf(sha256: string): Uint8Array | null
}

export function createLazyFontSetMeasurer(input: LazyMeasurerInput): TextMeasurer {
  const descriptors = new Map<string, FontFaceDescriptor>()
  for (const face of input.faces) descriptors.set(faceKey(face), face)
  const parsed = new Map<string, ParsedFont>()
  const hash = input.fontSetHash

  const faceOf = (font: FontRequest): ParsedFont => {
    const key = faceKey(font)
    const held = parsed.get(key)
    if (held) return held
    const descriptor = descriptors.get(key)
    if (!descriptor) {
      throw new MotionError('font_refused', `font set ${hash.slice(0, 12)} has no face ${font.family} ${font.weight} ${font.style ?? 'normal'}`, [
        { code: 'font_missing', path: '/font', message: `${font.family} ${font.weight} is not in the pinned font set (no synthesis, no fallback)` },
      ])
    }
    const bytes = input.bytesOf(descriptor.sha256)
    if (!bytes) {
      throw new MotionError('font_refused', `${font.family} ${font.weight}: the face bytes are not loaded`, [
        { code: 'font_not_loaded', path: '/font', message: 'the pinned face has not been fetched yet' },
      ])
    }
    const face = parseFont(bytes)
    parsed.set(key, face)
    return face
  }

  return {
    font_set_hash: hash,
    hasFace: (font) => descriptors.has(faceKey(font)),
    lineMetrics(font, sizePx) {
      const face = faceOf(font)
      const scale = sizePx / face.units_per_em
      return { ascent: face.ascender * scale, descent: -face.descender * scale, line_gap: face.line_gap * scale }
    },
    advances(clusters, font, sizePx, lang) {
      const face = faceOf(font)
      const script = primaryOtScript(clusters.join(''))
      const language = otLanguage(lang)
      const scale = sizePx / face.units_per_em
      const units: number[] = []
      let previousBase = -1
      clusters.forEach((cluster, index) => {
        let advance = 0
        let firstBase = -1
        let lastBase = -1
        for (const char of cluster) {
          if (IGNORABLE.test(char) || char === '\n') continue
          const glyph = face.localize(face.glyph(char.codePointAt(0) as number), script, language)
          // Combining marks are zero-advance (HarfBuzz zero-width marks); spacing marks keep their advance.
          const isMark = MARK.test(char) && !SPACING_MARK.test(char)
          if (!isMark) {
            advance += face.advance(glyph)
            if (firstBase < 0) firstBase = glyph
            lastBase = glyph
          }
        }
        if (previousBase >= 0 && firstBase >= 0) {
          const pair = face.kerning(previousBase, firstBase, script, language)
          units[index - 1] = (units[index - 1] as number) + pair.first
          advance += pair.second
        }
        units.push(advance)
        if (lastBase >= 0) previousBase = lastBase
      })
      return units.map((value) => value * scale)
    },
    missingGlyphs(cluster, font) {
      const face = faceOf(font)
      const missing: number[] = []
      for (const char of cluster) {
        if (IGNORABLE.test(char) || char === '\n') continue
        const codepoint = char.codePointAt(0) as number
        if (face.glyph(codepoint) === 0) missing.push(codepoint)
      }
      return missing
    },
  }
}

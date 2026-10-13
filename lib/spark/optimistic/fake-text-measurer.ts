import type { TextMeasurer } from '../stage/motion-core/text'

/**
 * Test double of the text measurer: deterministic widths without font files (a letter is 0.55 em wide, a space 0.3 em, line
 * height 1.2 em), so component tests can run the real local compile (`compileLocalScene`) and a fake server that compiles with
 * the same function. The layouts it gives are NOT the renderer's; the real engine is asserted against the gateway in
 * `local-preview-parity.test.ts`.
 */
export function createFakeTextMeasurer(fontSetHash = 'f'.repeat(64)): TextMeasurer {
  return {
    font_set_hash: fontSetHash,
    hasFace: () => true,
    lineMetrics: (_font, sizePx) => ({ ascent: 0.9 * sizePx, descent: 0.25 * sizePx, line_gap: 0.05 * sizePx }),
    advances: (clusters, _font, sizePx) => clusters.map((cluster) => (cluster === ' ' ? 0.3 : 0.55) * sizePx),
    missingGlyphs: () => [],
  }
}

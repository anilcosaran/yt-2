import { STUDIO_MARKUP } from './studio-markup'

// The Spark design ships its icons as one inline SVG sprite at the top of its markup
// (`<use href="#i-name">`). Reuse those symbols instead of keeping a second icon set.
const sprite = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(STUDIO_MARKUP)

/**
 * Spark effects: rail symbols the design sprite does not have, drawn in its own line style (24 px box, strokes only):
 * `transition` (two frames crossing) and `animate` (a shape leaving a motion trail).
 */
const EFFECT_SYMBOLS = [
  '<symbol id="i-transition" viewBox="0 0 24 24"><rect width="11" height="9" x="3" y="5" rx="2"/><path d="M10 19h9a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-2"/><path d="m12 13 3 3-3 3"/></symbol>',
  '<symbol id="i-animate" viewBox="0 0 24 24"><circle cx="16" cy="12" r="4.5"/><path d="M3 12h5M4.5 8h4M4.5 16h4"/></symbol>',
].join('')

/**
 * Contextual toolbar (`SPARK_CONTEXT_TOOLBAR_ENABLED`): the symbols of its controls the design sprite does not have, in the
 * same line style: fill / fit of a picture, corner radius, the sound off, the not-yet controls (underline, strikethrough,
 * line height, stroke, opacity, crop) and the keyboard of the shortcuts sheet.
 */
const TOOLBAR_SYMBOLS = [
  '<symbol id="i-fit-cover" viewBox="0 0 24 24"><rect width="18" height="14" x="3" y="5" rx="2"/><path d="M3 9l4-4M21 15l-4 4M3 15l4 4M21 9l-4-4"/></symbol>',
  '<symbol id="i-fit-contain" viewBox="0 0 24 24"><rect width="18" height="14" x="3" y="5" rx="2"/><rect width="8" height="6" x="8" y="9" rx="1"/></symbol>',
  '<symbol id="i-corner" viewBox="0 0 24 24"><path d="M4 20V11a7 7 0 0 1 7-7h9"/></symbol>',
  '<symbol id="i-mute" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></symbol>',
  '<symbol id="i-underline" viewBox="0 0 24 24"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/></symbol>',
  '<symbol id="i-strike" viewBox="0 0 24 24"><path d="M16 6a4 4 0 0 0-4-2c-2.5 0-4.5 1.4-4.5 3.5 0 1.6 1 2.6 3 3.3"/><path d="M4 12h16"/><path d="M8 18a4.5 4.5 0 0 0 4 2c2.6 0 4.5-1.5 4.5-3.6 0-.9-.3-1.6-.8-2.2"/></symbol>',
  '<symbol id="i-line-height" viewBox="0 0 24 24"><path d="M3 7l3-3 3 3M3 17l3 3 3-3M6 4v16"/><path d="M13 6h8M13 12h8M13 18h8"/></symbol>',
  '<symbol id="i-stroke" viewBox="0 0 24 24"><rect width="16" height="16" x="4" y="4" rx="2" stroke-dasharray="3 2"/></symbol>',
  '<symbol id="i-opacity" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 7h5M12 11h8M12 15h7M12 19h4"/></symbol>',
  '<symbol id="i-crop" viewBox="0 0 24 24"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></symbol>',
  // Spark styling round: a closed lock (the design's `lock` is the open one, "Lock" before it is pressed).
  '<symbol id="i-locked" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>',
  '<symbol id="i-keyboard" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15h6"/></symbol>',
  '<symbol id="i-aspect" viewBox="0 0 24 24"><rect width="18" height="12" x="3" y="6" rx="2"/><rect width="7" height="11" x="8.5" y="2" rx="1.5" stroke-dasharray="2 2"/></symbol>',
].join('')

/** Code tab (`SPARK_MOTION_CODE_TAB_ENABLED`): the brackets of the right panel's third tab, in the same line style. */
const CODE_SYMBOLS = '<symbol id="i-code" viewBox="0 0 24 24"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></symbol>'

export const STUDIO_ICON_SPRITE = (sprite ? sprite[1] : '') + EFFECT_SYMBOLS + TOOLBAR_SYMBOLS + CODE_SYMBOLS

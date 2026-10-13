/**
 * E1-G burned-in captions in the stage. The scene compiler draws a caption cue as an IR group whose role starts with
 * `caption.` (`api-gateway/.../scene-captions-compile.ts`); it is NOT a document layer (no selection, no inspector, no
 * transform), but it is a runtime layer the stage finds in the drawn scene. Captions always paint above everything of the
 * scene: a native `<video>` layer is placed between the runtime layers by paint index, so a caption group must count as
 * the topmost one or the footage would cover its own captions.
 */
export const CAPTION_ROLE_PREFIX = 'caption.'

/** Paint index of a caption group: above every document layer. */
export const CAPTION_Z_INDEX = Number.MAX_SAFE_INTEGER

export function isCaptionLayerId(layerId: string): boolean {
  return layerId.startsWith(CAPTION_ROLE_PREFIX)
}

/** The paint index a runtime layer takes when the document has no layer of that id (the compiler's own groups). */
export function runtimeOnlyZIndex(layerId: string): number {
  return isCaptionLayerId(layerId) ? CAPTION_Z_INDEX : 0
}

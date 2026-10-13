import type { CompositionDocument } from './composition-client'

/**
 * E1 D1 "Preview only": what the MP4 export cannot draw yet stays fully usable in the live preview, the export dialog
 * refuses it with its typed reason (`COMPOSITION_EXPORT_NOT_EXPORTABLE`) and charges nothing, and the editor marks such
 * layers with a small "Preview only" badge in the inspector header and on the timeline block. A package that makes one of
 * these exportable removes it from the sets below.
 *
 * R2 (render round 2) lifted video clips (composited by FFmpeg), narration, music, sound effects and clip audio (mixed to
 * -14 LUFS), and with it the burned-in captions over footage (E1-G draws them as a graphics band above the video band;
 * proven in `composition-caption-export.test.ts`). The export draws: text, shapes, images, Motion (whole scene and
 * overlay), captions, video clips and sound. What is left preview only: the project overlays (logo, watermark, lower
 * third, overlay), which the scene compiler still refuses (`project_overlay_not_compiled`).
 */

/** Timeline block kinds the export cannot draw yet (the project overlays). Clips are decided by their source. */
export const PREVIEW_ONLY_BLOCK_KINDS: ReadonlySet<string> = new Set(['logo', 'watermark', 'lower_third', 'overlay'])

/** Clip media kinds the export cannot draw yet (none since R2: video is composited). */
export const PREVIEW_ONLY_CLIP_MEDIA: ReadonlySet<string> = new Set<string>()

/** The media kind of a project source (`source_media[].storage_object.media_kind`), or null. */
export function sourceMediaKind(document: CompositionDocument | null, sourceId: string | undefined): string | null {
  if (!document || !sourceId) return null
  const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as { storage_object?: { media_kind?: unknown } } | undefined
  const kind = source?.storage_object?.media_kind
  return typeof kind === 'string' ? kind : null
}

/** A clip layer whose source is a media kind the export cannot draw yet (none today). */
export function isPreviewOnlyClip(document: CompositionDocument | null, sourceId: string | undefined): boolean {
  const kind = sourceMediaKind(document, sourceId)
  return kind !== null && PREVIEW_ONLY_CLIP_MEDIA.has(kind)
}

/** A selected layer of the stage whose media kind the export cannot draw yet (none today). */
export function isPreviewOnlyLayer(view: { kind: string; mediaKind?: string | null }): boolean {
  return view.kind === 'clip' && view.mediaKind != null && PREVIEW_ONLY_CLIP_MEDIA.has(view.mediaKind)
}

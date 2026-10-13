import type { CompositionDocument, CompositionScene, CompositionWorkingCopy } from './composition-client'

export const PROJECT_ID = 'cprj_00000000-0000-4000-8000-000000000001'

export function sceneId(n: number) {
  return `scn_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

/** A composition_document_v1 as the gateway returns it (empty by default, 16:9 1080p30). */
export function compositionDocument(overrides: Partial<CompositionDocument> = {}): CompositionDocument {
  return {
    schema_version: 1,
    project_id: PROJECT_ID,
    working_copy_version: 0,
    canvas: { aspect_ratio: '16:9', width: 1920, height: 1080, fps: { num: 30, den: 1 } },
    sections: [],
    scene_sequence: { rev: 1, scene_ids: [] },
    scenes: [],
    project_overlays: { rev: 1, layers: [] },
    audio: { rev: 1, placements: [] },
    caption_tracks: [],
    source_media: [],
    ...overrides,
  }
}

export function fixedScene(id: string, overrides: Partial<CompositionScene> = {}): CompositionScene {
  return {
    scene_id: id,
    rev: 1,
    origin: 'authored',
    timing_policy: 'fixed',
    duration_frames: 90,
    section_id: null,
    layers: [],
    ...overrides,
  }
}

/** A document whose strip holds `ids` in that order (each scene 3 s unless overridden). */
export function documentWithScenes(
  ids: string[],
  options: { version?: number; sequenceRev?: number; scenes?: CompositionScene[] } = {},
): CompositionDocument {
  return compositionDocument({
    working_copy_version: options.version ?? ids.length,
    scene_sequence: { rev: options.sequenceRev ?? ids.length + 1, scene_ids: ids },
    scenes: options.scenes ?? ids.map((id) => fixedScene(id)),
  })
}

const uuidTail = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export function layerId(n: number) {
  return `lyr_${uuidTail(n)}`
}

export function placementId(n: number) {
  return `aud_${uuidTail(n)}`
}

export function captionTrackId(n: number) {
  return `cap_${uuidTail(n)}`
}

export const SOURCE_ID = 'src_voice_1'

type AudioPlacement = CompositionDocument['audio']['placements'][number]

/** An audio placement body of composition_document_v1: scene-local or global (project_range). */
export function audioPlacement(
  id: string,
  role: 'narration' | 'music' | 'sfx',
  span: { sceneId: string } | { projectRange: { start_frame: number; end_frame: number } },
  rev = 1,
): AudioPlacement {
  return {
    placement_id: id,
    rev,
    role,
    source_id: SOURCE_ID,
    source_range: { in_tick: 0, out_tick: 48_000 },
    ...('sceneId' in span
      ? { scene_id: span.sceneId, scene_range: { start_frame: 0, end_frame: 30 } }
      : { project_range: span.projectRange }),
    gain_db: 0,
  }
}

export function captionTrack(id: string, rev = 1): CompositionDocument['caption_tracks'][number] {
  return {
    caption_track_id: id,
    rev,
    source: { artifact_kind: 'transcript', artifact_id: 'tr_1', artifact_revision: 1 },
    burn_in: true,
  }
}

type Layer = CompositionScene['layers'][number]

/** A native text layer (the font is a pinned FontRef; the catalog is P02-11). */
export function textLayer(id: string, rev = 1): Layer {
  return {
    layer_id: id,
    rev,
    layer_kind: 'text',
    text: 'Bitcoin nedir?',
    style: { font: { font_id: 'font_inter', font_revision: 'r1', sha256: 'a'.repeat(64) }, size_px: 64, color: '#ffffff' },
    scene_range: { start_frame: 0, end_frame: 90 },
  }
}

export function pendingSlotLayer(id: string, rev = 1): Layer {
  return { layer_id: id, rev, layer_kind: 'pending_slot', scene_range: { start_frame: 0, end_frame: 90 } }
}

export function workingCopy(
  document: CompositionDocument,
  role: CompositionWorkingCopy['role'] = 'owner',
): CompositionWorkingCopy {
  return { projectId: PROJECT_ID, workingCopyVersion: document.working_copy_version, role, document }
}

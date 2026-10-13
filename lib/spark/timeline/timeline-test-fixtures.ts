import type { CompositionDocument, CompositionScene } from '../composition-client'
import { compositionDocument, layerId, placementId, sceneId } from '../composition-test-fixtures'

/**
 * The three documents the timeline v2 tests read (design P1-A): a narrated AI project, an uploaded multi-video project and
 * a mixed project. 16:9 1080p at 30 fps; video sources on a 1/90000 timebase (3000 ticks per frame).
 */

type Layer = CompositionScene['layers'][number]
type Source = CompositionDocument['source_media'][number]

export const FONT = { font_id: 'font_inter', font_revision: 'r1', sha256: 'a'.repeat(64) }
export const TICKS_PER_FRAME = 3000

export function sectionId(n: number) {
  return `sec_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function videoSource(id: string, seconds: number, objectId = `obj_${id}`): Source {
  return {
    source_id: id,
    storage_object: { ref_type: 'storage_object', storage_object_id: objectId, checksum_sha256: 'c'.repeat(64), media_kind: 'video' },
    probe: { timebase: { num: 1, den: 90000 }, vfr: false, duration_ticks: Math.round(seconds * 90000), audio_channels: 2 },
  } as never
}

export function imageSource(id: string, objectId = `obj_${id}`): Source {
  return {
    source_id: id,
    storage_object: { ref_type: 'storage_object', storage_object_id: objectId, checksum_sha256: 'b'.repeat(64), media_kind: 'image' },
    probe: { timebase: { num: 1, den: 1 }, vfr: false, duration_ticks: 1, audio_channels: 0 },
  } as never
}

export function audioSource(id: string, seconds: number, objectId = `obj_${id}`): Source {
  return {
    source_id: id,
    storage_object: { ref_type: 'storage_object', storage_object_id: objectId, checksum_sha256: 'd'.repeat(64), media_kind: 'audio' },
    probe: { timebase: { num: 1, den: 48000 }, vfr: false, duration_ticks: Math.round(seconds * 48000), audio_channels: 2 },
  } as never
}

export function videoClip(id: string, sourceIdValue: string, range: [number, number], options: { inFrame?: number; transform?: Record<string, number> } = {}): Layer {
  const inTick = (options.inFrame ?? 0) * TICKS_PER_FRAME
  return {
    layer_id: id,
    rev: 1,
    layer_kind: 'clip',
    placement: {
      source_id: sourceIdValue,
      source_range: { in_tick: inTick, out_tick: inTick + (range[1] - range[0]) * TICKS_PER_FRAME },
      scene_range: { start_frame: range[0], end_frame: range[1] },
    },
    ...(options.transform && { transform: options.transform }),
  }
}

export function imageClip(id: string, sourceIdValue: string, range: [number, number], transform?: Record<string, number>): Layer {
  return {
    layer_id: id,
    rev: 1,
    layer_kind: 'clip',
    placement: { source_id: sourceIdValue, source_range: { in_tick: 0, out_tick: 1 }, scene_range: { start_frame: range[0], end_frame: range[1] } },
    ...(transform && { transform }),
  }
}

export function text(id: string, value: string, range: [number, number], animations?: unknown[]): Layer {
  return {
    layer_id: id,
    rev: 1,
    layer_kind: 'text',
    text: value,
    style: { font: FONT, size_px: 64, color: '#ffffff' },
    scene_range: { start_frame: range[0], end_frame: range[1] },
    ...(animations && { animations }),
  }
}

export function shape(id: string, range: [number, number]): Layer {
  return { layer_id: id, rev: 1, layer_kind: 'shape', shape: 'rect', fill: '#ff0000', scene_range: { start_frame: range[0], end_frame: range[1] } }
}

export function motion(id: string, range: [number, number]): Layer {
  return { layer_id: id, rev: 1, layer_kind: 'motion_instance', instance: { instance_id: 'mi_1' }, scene_range: { start_frame: range[0], end_frame: range[1] } }
}

export function fade(idValue: string, phase: 'enter' | 'exit', frames: number, at: number) {
  return {
    animation_id: idValue,
    phase,
    preset_ref: { preset_id: 'fade', preset_revision: 1 },
    params: { duration_frames: frames, easing: 'linear' },
    anchor: at === 0 ? { kind: 'scene_start' } : { kind: 'scene_offset', frames: at },
  }
}

function scene(id: string, overrides: Partial<CompositionScene>): CompositionScene {
  return { scene_id: id, rev: 1, origin: 'authored', timing_policy: 'fixed', duration_frames: 90, section_id: null, layers: [], ...overrides }
}

/**
 * A narrated AI project: three sections from the script chapters (Giriş / Gelişme / Sonuç), four scenes following their
 * narration, title texts with In/Out fades, a music bed over the whole video and burned-in captions.
 */
export function narratedProject(): CompositionDocument {
  const scenes = [
    scene(sceneId(1), { origin: 'generated', timing_policy: 'follow_narration', duration_frames: undefined, section_id: sectionId(1), layers: [text(layerId(11), 'Bitcoin nedir?', [0, 120], [fade('anm_in1', 'enter', 15, 0), fade('anm_out1', 'exit', 15, 105)])] }),
    scene(sceneId(2), { origin: 'generated', timing_policy: 'follow_narration', duration_frames: undefined, section_id: sectionId(2), layers: [text(layerId(21), 'Blok zinciri', [0, 90])] }),
    scene(sceneId(3), { origin: 'generated', timing_policy: 'follow_narration', duration_frames: undefined, section_id: sectionId(2), layers: [text(layerId(31), 'Madencilik', [30, 150])] }),
    scene(sceneId(4), { origin: 'generated', timing_policy: 'follow_narration', duration_frames: undefined, section_id: sectionId(3), layers: [text(layerId(41), 'Sonuç', [0, 60])] }),
  ]
  const narration = (n: number, scn: string, frames: number) => ({
    placement_id: placementId(n),
    rev: 1,
    role: 'narration',
    source_id: `src_voice_${n}`,
    source_range: { in_tick: 0, out_tick: frames * 1600 },
    scene_id: scn,
    scene_range: { start_frame: 0, end_frame: frames },
    gain_db: 0,
  })
  return compositionDocument({
    working_copy_version: 7,
    sections: [
      { section_id: sectionId(1), rev: 1, title: 'Giriş', script_chapter_id: 'ch_1' },
      { section_id: sectionId(2), rev: 1, title: 'Gelişme', script_chapter_id: 'ch_2' },
      { section_id: sectionId(3), rev: 1, title: 'Sonuç', script_chapter_id: 'ch_3' },
    ],
    scene_sequence: { rev: 5, scene_ids: scenes.map((item) => item.scene_id) },
    scenes,
    audio: {
      rev: 3,
      placements: [
        narration(1, sceneId(1), 120),
        narration(2, sceneId(2), 90),
        narration(3, sceneId(3), 150),
        narration(4, sceneId(4), 60),
        { placement_id: placementId(9), rev: 1, role: 'music', source_id: 'src_music', source_range: { in_tick: 0, out_tick: 420 * 1600 }, project_range: { start_frame: 0, end_frame: 420 }, gain_db: -12 },
      ],
    },
    caption_tracks: [{ caption_track_id: 'cap_00000000-0000-4000-8000-000000000001', rev: 1, source: { artifact_kind: 'script', artifact_id: 'scr_1', artifact_revision: 1 }, burn_in: true }],
    source_media: [audioSource('src_music', 20), ...[1, 2, 3, 4].map((n) => audioSource(`src_voice_${n}`, 6))],
  })
}

/** An uploaded multi-video project: three scenes following their media, one full-frame video each, no sections. */
export function uploadedProject(): CompositionDocument {
  const scenes = [
    scene(sceneId(1), { timing_policy: 'follow_media', duration_frames: undefined, layers: [videoClip(layerId(11), 'src_v1', [0, 150])] }),
    scene(sceneId(2), { timing_policy: 'follow_media', duration_frames: undefined, layers: [videoClip(layerId(21), 'src_v2', [0, 240], { inFrame: 30 })] }),
    scene(sceneId(3), { timing_policy: 'follow_media', duration_frames: undefined, layers: [videoClip(layerId(31), 'src_v3', [0, 90])] }),
  ]
  return compositionDocument({
    working_copy_version: 4,
    scene_sequence: { rev: 4, scene_ids: scenes.map((item) => item.scene_id) },
    scenes,
    source_media: [videoSource('src_v1', 10), videoSource('src_v2', 12), videoSource('src_v3', 3), imageSource('src_img'), audioSource('src_song', 30)],
  })
}

/**
 * A mixed project: a fixed image scene with a picture-in-picture video and a title (In fade), a fixed graphics-only scene
 * (shape + text) entered with a fade transition, a media scene with a video and a Motion overlay.
 */
export function mixedProject(): CompositionDocument {
  const scenes = [
    scene(sceneId(1), {
      section_id: sectionId(1),
      duration_frames: 150,
      layers: [
        imageClip(layerId(11), 'src_img', [0, 150]),
        videoClip(layerId(12), 'src_pip', [30, 120], { transform: { x: 1200, y: 600, scale: 0.4, rotation_deg: 0 } }),
        text(layerId(13), 'Başlık', [0, 90], [fade('anm_in13', 'enter', 10, 0)]),
      ],
    }),
    scene(sceneId(2), {
      section_id: sectionId(1),
      duration_frames: 120,
      transition_in: { kind: 'fade', duration_frames: 20 },
      layers: [shape(layerId(21), [0, 120]), text(layerId(22), 'Adım 1', [10, 100])],
    } as Partial<CompositionScene>),
    scene(sceneId(3), {
      section_id: sectionId(2),
      timing_policy: 'follow_media',
      duration_frames: undefined,
      layers: [videoClip(layerId(31), 'src_v1', [0, 180]), motion(layerId(32), [20, 80])],
    }),
  ]
  return compositionDocument({
    working_copy_version: 9,
    sections: [
      { section_id: sectionId(1), rev: 1, title: 'Intro' },
      { section_id: sectionId(2), rev: 2, title: 'Body' },
    ],
    scene_sequence: { rev: 6, scene_ids: scenes.map((item) => item.scene_id) },
    scenes,
    source_media: [imageSource('src_img'), videoSource('src_pip', 8), videoSource('src_v1', 10)],
  })
}

/** A long project for the perf test: `count` fixed scenes with an image, a title and a shape, plus narration on every other. */
export function longProject(count: number): CompositionDocument {
  const ids = Array.from({ length: count }, (_, index) => sceneId(index + 1))
  const scenes = ids.map((id, index) =>
    scene(id, {
      section_id: sectionId(Math.floor(index / 20) + 1),
      duration_frames: 90 + (index % 7) * 10,
      layers: [
        imageClip(layerId(index * 10 + 1), 'src_img', [0, 90]),
        text(layerId(index * 10 + 2), `Scene ${index + 1}`, [0, 60], [fade(`anm_${index}`, 'enter', 10, 0)]),
        shape(layerId(index * 10 + 3), [30, 90]),
      ],
    }),
  )
  return compositionDocument({
    working_copy_version: count,
    sections: Array.from({ length: Math.ceil(count / 20) }, (_, index) => ({ section_id: sectionId(index + 1), rev: 1, title: `Part ${index + 1}` })),
    scene_sequence: { rev: count + 1, scene_ids: ids },
    scenes,
    audio: {
      rev: 1,
      placements: ids
        .filter((_, index) => index % 2 === 0)
        .map((id, index) => ({ placement_id: placementId(index + 1), rev: 1, role: 'sfx', source_id: 'src_sfx', source_range: { in_tick: 0, out_tick: 48000 }, scene_id: id, scene_range: { start_frame: 0, end_frame: 30 }, gain_db: 0 })),
    },
    source_media: [imageSource('src_img')],
  })
}

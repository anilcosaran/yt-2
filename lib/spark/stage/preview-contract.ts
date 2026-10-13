import { z } from 'zod'

import { transitionBundleId } from './scene-plan'
import type { StageIssue, StageNativeLayer, StagePlan, StagePlanScene, StagePlanTransition, StageSceneBundle } from './stage-types'

/**
 * Wire contract of the preview routes (Y1-07 `editor-interfaces.md` section 3: `composition_preview_v1` manifest and
 * the per-scene IR), parsed exactly as the gateway sends it (snake_case, no conversion). This file owns only what the
 * STAGE reads; Y1-07's `preview-client.ts` parses the same shapes for the session side, and its types are structurally
 * the same as the ones below, so the two can be swapped without touching the stage.
 */

const issueSchema = z.object({
  code: z.string(),
  message: z.string(),
  scene_id: z.string().optional(),
  layer_id: z.string().optional(),
})

const frameRangeSchema = z.object({ start_frame: z.number().int().min(0), end_frame: z.number().int().min(0) })
const rationalSchema = z.object({ num: z.number().int().positive(), den: z.number().int().positive() })

export const previewNativeLayerSchema = z.object({
  layer_id: z.string().min(1),
  kind: z.literal('video'),
  z_index: z.number().int().min(0),
  source_id: z.string().min(1),
  storage_object_id: z.string().min(1),
  scene_range: frameRangeSchema,
  source_range: z.object({ in_tick: z.number().int().min(0), out_tick: z.number().int().min(0) }),
  source_timebase: rationalSchema,
  transform: z
    .object({ x: z.number(), y: z.number(), scale: z.number(), rotation_deg: z.number() })
    .nullable(),
  audio: z.object({ gain_db: z.number().optional(), muted: z.boolean().optional() }).nullable(),
})

const fontFaceSchema = z.object({
  font_id: z.string(),
  font_revision: z.string(),
  family: z.string(),
  weight: z.number().int(),
  style: z.enum(['normal', 'italic']),
  sha256: z.string(),
  url: z.string(),
})

/** E1-L: the transition into a scene (see `StagePlanTransition`); present only when the scene stores one. */
const manifestTransitionSchema = z.object({
  status: z.enum(['ready', 'unavailable']),
  reason: z.string().nullable(),
  kind: z.string(),
  from_scene_id: z.string(),
  requested_frames: z.number().int().positive(),
  duration_frames: z.number().int().positive().nullable(),
  from_frames: z.number().int().positive().nullable(),
  to_frames: z.number().int().positive().nullable(),
  clamped: z.boolean(),
  start_frame: z.number().int().min(0).nullable(),
  document_frame_offset: z.number().int().min(0).nullable(),
  dependency_hash: z.string().nullable(),
})

const manifestSceneSchema = z.object({
  scene_id: z.string().min(1),
  index: z.number().int().min(0),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().positive().nullable(),
  resolved_by: z.enum(['fixed', 'follow_media', 'follow_narration']),
  dependency_hash: z.string(),
  status: z.enum(['ready', 'partial', 'unavailable']),
  warnings: z.array(issueSchema),
  native_layers: z.array(previewNativeLayerSchema),
  transition_in: manifestTransitionSchema.optional(),
})

export const previewManifestSchema = z.object({
  schema_version: z.literal('composition_preview_v1'),
  project_id: z.string().min(1),
  working_copy_version: z.number().int().min(0),
  scene_compiler_version: z.number().int(),
  motion_runtime_version: z.string(),
  canvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']),
    fps: rationalSchema,
  }),
  total_frames: z.number().int().min(0),
  dependency_hash: z.string(),
  safe_area: z.object({
    profile: z.string(),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    caption: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  }),
  fonts: z.object({ font_set_hash: z.string(), faces: z.array(fontFaceSchema) }),
  /** E1-L: present (true) only while the gateway draws scene transitions. */
  transitions_enabled: z.literal(true).optional(),
  /** Spark effects library: present while the `scene-transitions@2` kinds may be written (`COMPOSITION_TRANSITIONS_V2_ENABLED`). */
  transition_catalog_version: z.literal('scene-transitions@2').optional(),
  /**
   * Timeline v3: present (true) only while the gateway's `scene.split` takes the relaxed rules
   * (`COMPOSITION_RELAXED_SPLIT_ENABLED`); the timeline then plans a relaxed split (`planSceneSplit` with `relaxed`).
   */
  relaxed_split_enabled: z.literal(true).optional(),
  scenes: z.array(manifestSceneSchema),
})

export type PreviewManifest = z.output<typeof previewManifestSchema>
export type PreviewFontFace = z.output<typeof fontFaceSchema>

const assetSchema = z.object({
  key: z.string().min(1),
  media_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byte_size: z.number().int().min(0),
  storage_object_id: z.string().min(1),
})

export const previewSceneIrSchema = z.object({
  scene_id: z.string().min(1),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().positive(),
  dependency_hash: z.string(),
  document: z.record(z.string(), z.unknown()),
  assets: z.array(assetSchema),
  warnings: z.array(issueSchema),
  native_layers: z.array(previewNativeLayerSchema),
})

export type PreviewSceneIr = z.output<typeof previewSceneIrSchema>

/** E1-L: the transition segment into a scene (`GET .../preview/transitions/{sceneId}`): the sheet document and its window. */
export const previewTransitionSchema = z.object({
  scene_id: z.string().min(1),
  from_scene_id: z.string().min(1),
  kind: z.string(),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().min(2),
  document_frame_offset: z.number().int().min(0),
  dependency_hash: z.string(),
  document: z.record(z.string(), z.unknown()),
  assets: z.array(assetSchema),
  warnings: z.array(issueSchema),
})

export type PreviewTransition = z.output<typeof previewTransitionSchema>

const issueOf = (issue: z.output<typeof issueSchema>): StageIssue => ({
  code: issue.code,
  message: issue.message,
  ...(issue.scene_id !== undefined && { sceneId: issue.scene_id }),
  ...(issue.layer_id !== undefined && { layerId: issue.layer_id }),
})

/**
 * The stage's plan from a manifest. A scene whose length is unresolved has no duration: it is listed in
 * `unresolvedSceneIds` and left out of the playable scenes (playback skips it, nothing is estimated). The start
 * frames of the playable scenes are the manifest's own resolved ones.
 */
export function planFromManifest(manifest: PreviewManifest): StagePlan {
  const scenes: StagePlanScene[] = []
  const unresolvedSceneIds: string[] = []
  const transitions: StagePlanTransition[] = []
  for (const scene of manifest.scenes) {
    if (scene.transition_in) {
      const entry = scene.transition_in
      transitions.push({
        toSceneId: scene.scene_id,
        fromSceneId: entry.from_scene_id,
        kind: entry.kind,
        status: entry.status,
        reason: entry.reason,
        requestedFrames: entry.requested_frames,
        durationFrames: entry.duration_frames,
        fromFrames: entry.from_frames,
        toFrames: entry.to_frames,
        clamped: entry.clamped,
        startFrame: entry.start_frame,
        documentFrameOffset: entry.document_frame_offset,
        dependencyHash: entry.dependency_hash,
      })
    }
    if (scene.duration_frames === null) {
      unresolvedSceneIds.push(scene.scene_id)
      continue
    }
    scenes.push({
      sceneId: scene.scene_id,
      startFrame: scene.start_frame,
      durationFrames: scene.duration_frames,
      dependencyHash: scene.dependency_hash,
      status: scene.status,
      warnings: scene.warnings.map(issueOf),
      nativeLayers: scene.native_layers as StageNativeLayer[],
    })
  }
  const { rect } = manifest.safe_area
  return {
    workingCopyVersion: manifest.working_copy_version,
    canvas: manifest.canvas,
    scenes,
    ...(transitions.length > 0 && { transitions }),
    ...(manifest.transitions_enabled === true && { transitionsEnabled: true }),
    ...(manifest.transitions_enabled === true && manifest.transition_catalog_version === 'scene-transitions@2' && { transitionCatalog: 2 as const }),
    ...(manifest.relaxed_split_enabled === true && { relaxedSplitEnabled: true }),
    unresolvedSceneIds,
    totalFrames: manifest.total_frames,
    safeArea: { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
    runtimeVersion: manifest.motion_runtime_version,
    dependencyHash: manifest.dependency_hash,
    sceneCompilerVersion: manifest.scene_compiler_version,
    fontSetHash: manifest.fonts.font_set_hash,
  }
}

/** The bundle of a scene from its wire IR; `imageUrl` turns a Storage object id into the URL an `<img>` loads. */
export function bundleFromSceneIr(ir: PreviewSceneIr, imageUrl: (storageObjectId: string) => string): StageSceneBundle {
  return {
    sceneId: ir.scene_id,
    startFrame: ir.start_frame,
    durationFrames: ir.duration_frames,
    dependencyHash: ir.dependency_hash,
    ir: ir.document,
    assets: Object.fromEntries(ir.assets.map((asset) => [asset.key, imageUrl(asset.storage_object_id)])),
    nativeLayers: ir.native_layers as StageNativeLayer[],
    warnings: ir.warnings.map(issueOf),
  }
}

/**
 * E1-L: the bundle of a transition segment. Its `sceneId` is `transitionBundleId(scene_id)` (never a real scene id, so the
 * stage never mistakes the sheet for a scene it can select in), `startFrame` the window start and `durationFrames` the length
 * of the sheet document; there are no native (video) layers in a transition the gateway can draw.
 */
export function bundleFromTransition(ir: PreviewTransition, imageUrl: (storageObjectId: string) => string): StageSceneBundle {
  const sheetFrames = typeof ir.document['duration_frames'] === 'number' ? (ir.document['duration_frames'] as number) : ir.duration_frames
  return {
    sceneId: transitionBundleId(ir.scene_id),
    startFrame: ir.start_frame,
    durationFrames: sheetFrames,
    dependencyHash: ir.dependency_hash,
    ir: ir.document,
    assets: Object.fromEntries(ir.assets.map((asset) => [asset.key, imageUrl(asset.storage_object_id)])),
    nativeLayers: [],
    warnings: ir.warnings.map(issueOf),
  }
}

type IrTextFont = { family?: unknown; weight?: unknown; style?: unknown }

/**
 * Faces of the platform catalogue the IR's text nodes use (family + weight + style of each text node, from its laid-out
 * font when it has one). A text node whose face is not in the catalogue yields nothing here: the compiler refuses such
 * a layer, so the IR never carries it.
 */
export function facesForIr(faces: readonly PreviewFontFace[], irDocument: Record<string, unknown>): PreviewFontFace[] {
  const wanted = new Set<string>()
  const key = (family: unknown, weight: unknown, style: unknown) => `${String(family)}\u0000${Number(weight)}\u0000${style === 'italic' ? 'italic' : 'normal'}`
  const visit = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const { content, children } = node as { content?: { kind?: unknown; font?: IrTextFont; layout?: { font?: IrTextFont } }; children?: unknown }
      if (content?.kind === 'text') {
        const font = content.layout?.font ?? content.font
        if (font) wanted.add(key(font.family, font.weight, font.style))
      }
      visit(children)
    }
  }
  visit(irDocument['nodes'])
  return faces.filter((face) => wanted.has(key(face.family, face.weight, face.style)))
}

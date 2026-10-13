import { inspectorSchemaResponseSchema, type InspectorSchema } from './inspector-schema'
import type { PreviewManifest, PreviewSceneIr } from './preview-contract'

/**
 * Test fixtures of the stage: a `motion-ir@1` scene document shaped like `scene_compiler@1`'s output (one background
 * shape, then per layer a group node `role = layer_id` holding one content node `role = <layer_id>.content`), and the
 * preview manifest / scene responses of `composition_preview_v1`. No network, no clock.
 */

export type FixtureLayer = {
  layerId: string
  kind: 'text' | 'shape' | 'image'
  /** The group's box on the canvas (natural geometry, or the transform's position). */
  box: { x: number; y: number; width: number; height: number }
  scale?: number
  rotation?: number
  text?: string
  fill?: string
  /** Shape layers (E1-B): the drawn shape (default `rect`) and its corner radius (canvas px, already clamped). */
  shape?: 'rect' | 'ellipse'
  cornerRadius?: number
  /** Visible window in scene-local frames (opacity 0 outside it), like the compiler's `.visible` tracks. */
  range?: { start: number; end: number }
  assetKey?: string
}

const role = (id: string) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
const SOURCE = { kind: 'typed_scene', compiler: 'scene_compiler@1' }
const basis = (value: string) => ({ role: value, slot_key: null, list_index: null })

/** Handle of a layer's group node / content node as the compiler allocates them (one occurrence each). */
export const groupHandle = (layerId: string) => `${role(layerId)}#1`
export const contentHandle = (layerId: string) => `${role(`${layerId}.content`)}#1`

export function sceneIrDocument(input: {
  width?: number
  height?: number
  fps?: number
  durationFrames: number
  layers: FixtureLayer[]
}): Record<string, unknown> {
  const width = input.width ?? 1920
  const height = input.height ?? 1080
  const nodes: unknown[] = [
    {
      handle: 'background#1',
      kind: 'shape',
      role: 'background',
      basis: basis('background'),
      source: SOURCE,
      box: { x: 0, y: 0, width, height },
      props: { fill: '#000000' },
      content: { kind: 'shape', shape: 'rect' },
    },
  ]
  const tracks: unknown[] = []
  const trackCounters = new Map<string, number>()
  for (const layer of input.layers) {
    const isText = layer.kind === 'text'
    const content =
      layer.kind === 'text'
        ? {
            kind: 'text',
            text: layer.text ?? 'Metin',
            font: { family: 'Montserrat', weight: 700, size_px: 64, style: 'normal' },
            align: 'left',
            valign: 'top',
            fit: { policy: 'wrap' },
          }
        : layer.kind === 'image'
          ? { kind: 'media', media_ref: layer.assetKey ?? 'asset_1', fit: 'contain' }
          : { kind: 'shape', shape: layer.shape ?? 'rect', ...(layer.cornerRadius !== undefined && { corner_radius: layer.cornerRadius }) }
    nodes.push({
      handle: groupHandle(layer.layerId),
      kind: 'group',
      role: layer.layerId,
      basis: basis(layer.layerId),
      source: SOURCE,
      box: layer.box,
      origin: [0, 0],
      props: { ...(layer.scale !== undefined && layer.scale !== 1 && { scale: layer.scale }), ...(layer.range && layer.range.start > 0 && { opacity: 0 }) },
      children: [
        {
          handle: contentHandle(layer.layerId),
          kind: isText ? 'text' : layer.kind === 'image' ? 'image' : 'shape',
          role: `${layer.layerId}.content`,
          basis: basis(`${layer.layerId}.content`),
          source: SOURCE,
          box: { x: 0, y: 0, width: layer.box.width, height: layer.box.height },
          props: { ...(layer.fill !== undefined && { fill: layer.fill }), ...(layer.rotation ? { rotation: layer.rotation } : {}) },
          content,
        },
      ],
    })
    const hold = (frame: number, value: number) => {
      const base = role(`${layer.layerId}.visible`)
      const order = (trackCounters.get(base) ?? 0) + 1
      trackCounters.set(base, order)
      tracks.push({
        handle: `${base}#${order}`,
        kind: 'tween',
        role: `${layer.layerId}.visible`,
        basis: basis(`${layer.layerId}.visible`),
        start: { rel: 'at', frame },
        targets: [groupHandle(layer.layerId)],
        property: 'opacity',
        from: value,
        to: value,
        ease: 'linear',
        duration_frames: 1,
        immediate_render: false,
      })
    }
    if (layer.range && layer.range.start > 0) hold(layer.range.start, 1)
    if (layer.range && layer.range.end < input.durationFrames) hold(layer.range.end, 0)
  }
  if (tracks.length === 0) {
    tracks.push({
      handle: 'rest#1',
      kind: 'tween',
      role: 'rest',
      basis: basis('rest'),
      start: { rel: 'at', frame: 0 },
      targets: ['background#1'],
      property: 'opacity',
      from: 1,
      to: 1,
      ease: 'linear',
      duration_frames: 1,
      immediate_render: false,
    })
  }
  return {
    ir_version: 'motion-ir@1',
    fps: input.fps ?? 30,
    duration_frames: input.durationFrames,
    canvas: { width, height, ratio: width >= height ? (width === height ? '1:1' : '16:9') : '9:16' },
    seed: 1,
    source: SOURCE,
    style: null,
    variables: [],
    anchors: [],
    nodes,
    labels: [],
    tracks,
  }
}

export const PREVIEW_PROJECT_ID = 'cprj_00000000-0000-4000-8000-000000000001'

export function previewManifest(input: {
  version?: number
  scenes: Array<{
    sceneId: string
    start: number
    duration: number | null
    hash?: string
    status?: 'ready' | 'partial' | 'unavailable'
    native?: PreviewManifest['scenes'][number]['native_layers']
  }>
  width?: number
  height?: number
}): PreviewManifest {
  const scenes = input.scenes.map((scene, index) => ({
    scene_id: scene.sceneId,
    index,
    start_frame: scene.start,
    duration_frames: scene.duration,
    resolved_by: 'fixed' as const,
    dependency_hash: scene.hash ?? `hash_${scene.sceneId}`,
    status: scene.status ?? (scene.duration === null ? ('unavailable' as const) : ('ready' as const)),
    warnings: [],
    native_layers: scene.native ?? [],
  }))
  return {
    schema_version: 'composition_preview_v1',
    project_id: PREVIEW_PROJECT_ID,
    working_copy_version: input.version ?? 5,
    scene_compiler_version: 1,
    motion_runtime_version: '1.0.0',
    canvas: { width: input.width ?? 1920, height: input.height ?? 1080, aspect_ratio: '16:9', fps: { num: 30, den: 1 } },
    total_frames: scenes.reduce((sum, scene) => sum + (scene.duration_frames ?? 0), 0),
    dependency_hash: 'manifest_hash',
    safe_area: {
      profile: 'title_safe',
      rect: { x: 96, y: 54, w: 1728, h: 972 },
      caption: { x: 96, y: 810, w: 1728, h: 216 },
    },
    fonts: {
      font_set_hash: 'fonts_hash',
      faces: [
        {
          font_id: 'font_montserrat',
          font_revision: 'r1',
          family: 'Montserrat',
          weight: 700,
          style: 'normal',
          sha256: 'a'.repeat(64),
          url: `/api/v1/composition/fonts/${'a'.repeat(64)}`,
        },
        {
          font_id: 'font_anton',
          font_revision: 'r1',
          family: 'Anton',
          weight: 400,
          style: 'normal',
          sha256: 'b'.repeat(64),
          url: `/api/v1/composition/fonts/${'b'.repeat(64)}`,
        },
      ],
    },
    scenes,
  }
}

export function previewSceneIr(input: {
  sceneId: string
  start: number
  duration: number
  hash?: string
  layers: FixtureLayer[]
  assets?: PreviewSceneIr['assets']
  native?: PreviewSceneIr['native_layers']
  width?: number
  height?: number
}): PreviewSceneIr {
  return {
    scene_id: input.sceneId,
    start_frame: input.start,
    duration_frames: input.duration,
    dependency_hash: input.hash ?? `hash_${input.sceneId}`,
    document: sceneIrDocument({ width: input.width, height: input.height, durationFrames: input.duration, layers: input.layers }),
    assets: input.assets ?? [],
    warnings: [],
    native_layers: input.native ?? [],
  }
}

const pin = (id: string, char: string) => ({ font_id: id, font_revision: 'r1', sha256: char.repeat(64) })

const control = (id: string, op: string, param: string | null, extra: Record<string, unknown> = {}) => ({
  control: id,
  section: 'x',
  fields: [],
  op,
  param,
  write: param === null ? 'action' : 'partial',
  ...extra,
})

/**
 * `composition_inspector_schema_v1` as the gateway publishes it (control ids and ops of `composition-inspector-schema.ts`),
 * with a small font catalogue: Montserrat (700 normal = the pin the fixture texts use, 400 normal, 700 italic) and Anton.
 * `unavailable` still lists `z_order` (the stale entry the stage must not trust: `layer.arrange` exists).
 */
export function inspectorSchemaFixture(options: { without?: string[] } = {}): InspectorSchema {
  const drop = new Set(options.without ?? [])
  const keep = <T extends { control: string }>(controls: T[]) => controls.filter((candidate) => !drop.has(candidate.control))
  return inspectorSchemaResponseSchema.parse({
    data: {
      schema_version: 'composition_inspector_schema_v1',
      text: { max_codepoints: 2000, normalization: 'NFC' },
      fonts: {
        catalog_revision: 1,
        families: [
          {
            family: 'Montserrat',
            faces: [
              { font: pin('font_montserrat', 'a'), weight: 700, style: 'normal' },
              { font: pin('font_montserrat_regular', 'e'), weight: 400, style: 'normal' },
              { font: pin('font_montserrat_italic', 'f'), weight: 700, style: 'italic' },
            ],
          },
          { family: 'Anton', faces: [{ font: pin('font_anton', 'b'), weight: 400, style: 'normal' }] },
        ],
      },
      targets: [
        {
          target: 'text',
          editable: true,
          reason: null,
          controls: keep([
            control('text.content', 'text.set', 'text'),
            control('text.font_family', 'text.set_style', 'font', { options: 'font_families' }),
            control('text.font_weight', 'text.set_style', 'font', { options: 'font_family_faces' }),
            control('text.size', 'text.set_style', 'size_px'),
            control('text.color', 'text.set_style', 'color'),
            control('text.align', 'text.set_style', 'align'),
            // Spark styling round.
            control('text.line_height', 'text.set_style', 'line_height'),
            control('text.decoration', 'text.set_style', 'text_decoration', { write: 'replace' }),
            control('text.stroke', 'text.set_style', 'stroke', { write: 'replace' }),
            control('text.opacity', 'layer.set_opacity', 'opacity', { write: 'replace' }),
            control('text.position', 'layer.set_transform', 'transform', { write: 'replace' }),
            control('text.lock', 'layer.set_locked', 'locked', { write: 'replace' }),
            control('text.remove', 'layer.remove', null),
          ]),
          unavailable: [{ control: 'z_order', reason: 'op_not_available', owner: 'P02-12' }],
        },
        {
          target: 'shape',
          editable: true,
          reason: null,
          controls: keep([
            control('shape.fill', 'shape.set_fill', 'fill'),
            control('shape.size', 'shape.set_size', 'size', { write: 'replace', requires: ['boxed_shape'] }),
            control('shape.corner_radius', 'shape.set_corner_radius', 'corner_radius_px', { requires: ['rect_shape'] }),
            control('shape.opacity', 'layer.set_opacity', 'opacity', { write: 'replace' }),
            control('shape.position', 'layer.set_transform', 'transform', { write: 'replace' }),
            control('shape.lock', 'layer.set_locked', 'locked', { write: 'replace' }),
            control('shape.remove', 'layer.remove', null),
          ]),
          unavailable: [{ control: 'z_order', reason: 'op_not_available', owner: 'P02-12' }],
        },
        {
          target: 'clip',
          editable: true,
          reason: null,
          controls: keep([
            control('clip.position', 'layer.set_transform', 'transform', { write: 'replace' }),
            control('clip.gain', 'clip.set_audio', 'gain_db', { requires: ['source_has_audio'] }),
            control('clip.mute', 'clip.set_audio', 'muted', { requires: ['source_has_audio'] }),
            control('clip.opacity', 'layer.set_opacity', 'opacity', { write: 'replace', requires: ['not_video_source'] }),
            control('clip.lock', 'layer.set_locked', 'locked', { write: 'replace' }),
            control('clip.remove', 'layer.remove', null),
          ]),
          unavailable: [{ control: 'clip.replace', reason: 'op_not_available', owner: null }],
        },
        {
          target: 'motion_instance',
          editable: true,
          reason: null,
          controls: keep([
            control('motion.position', 'layer.set_transform', 'transform', { write: 'replace' }),
            control('motion.move', 'layer.move', 'start_frame'),
            control('motion.parameter', 'motion.parameter.set', 'value', { requires: ['motion_document_v2'] }),
            control('motion.duration', 'motion.parameter.set', 'value', { requires: ['motion_document_v2'] }),
            control('motion.lock', 'layer.set_locked', 'locked', { write: 'replace' }),
            control('motion.remove', 'layer.remove', null),
          ]),
          unavailable: [{ control: 'motion.structure', reason: 'structural_edit_opens_motion_draft', owner: 'P06-02' }],
        },
        { target: 'pending_slot', editable: false, reason: 'placeholder_not_editable', controls: [], unavailable: [] },
      ],
    },
  }).data
}

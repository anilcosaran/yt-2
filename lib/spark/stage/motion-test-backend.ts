import { vi } from 'vitest'

import type { CompositionCommandBody, CompositionDocument } from '../composition-client'
import { contentHandle, groupHandle } from './stage-test-fixtures'
import { createStageBackend, type StageHarnessOptions } from './stage-test-harness'

/**
 * E1-D test backend: the stage harness' fake gateway plus what the real gateway does for a document v2 Motion instance that
 * the shared harness does not model (`motion.instance.insert` writes a minimal layer there): the stored `motion_state` with
 * the look and ratio, the exposed values (the revision's sample text, the caller's values, the duration), and
 * `motion.parameter.set` (replace or unset one value; a duration moves the layer's range). Only the network is fake; the
 * commands the UI sends are recorded in `commands` exactly as the stage tests see them.
 */

type Body = Record<string, unknown>

/** A stand-in digest stamped on the instances the fake stores (`parameter_schema_hash`, `dependency_snapshot_sha256`). */
const MOTION_INSTANCE_FIXTURE_SHA = 'c'.repeat(64)

export type MotionRevisionFake = {
  /** Text the revision's samples seed into a new instance (`parameter_id -> text`). */
  samples: Record<string, string>
  /** Parameter ids that are images (their input `{source_id}` is stored as the Storage object of that source). */
  media?: string[]
  /** Parameter ids that are colours / the duration parameter id, to tag stored values with their kind. */
  colors?: string[]
  duration?: string
}

function storedKind(revision: MotionRevisionFake, parameterId: string): 'text' | 'color' | 'media' | 'duration' {
  if (revision.media?.includes(parameterId)) return 'media'
  if (revision.colors?.includes(parameterId)) return 'color'
  if (revision.duration === parameterId) return 'duration'
  return 'text'
}

function storedValue(document: CompositionDocument, kind: string, raw: unknown): unknown {
  if (kind !== 'media') return raw
  const sourceId = typeof raw === 'string' ? raw : (raw as { source_id: string }).source_id
  const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const object = source?.['storage_object'] as Body | undefined
  return { storage_object_id: object?.['storage_object_id'], checksum_sha256: object?.['checksum_sha256'] ?? 'b'.repeat(64) }
}

function findLayer(document: CompositionDocument, layerId: string) {
  for (const scene of document.scenes) {
    const layer = scene.layers.find((candidate) => candidate.layer_id === layerId) as Body | undefined
    if (layer) return { scene, layer }
  }
  return null
}

/** Upgrades the layer the shared harness wrote for `motion.instance.insert` to the v2 shape the gateway stores. */
function applyMotionOps(document: CompositionDocument, body: CompositionCommandBody, revision: MotionRevisionFake): void {
  for (const op of body.ops as Body[]) {
    if (op['op'] === 'scene.insert' && !document.scenes.some((candidate) => candidate.scene_id === op['scene_id'])) {
      // The shared harness models `scene.insert` too (E1-N); this stays for a harness path that did not add the scene.
      const afterId = op['after_scene_id'] as string | null
      const ids = document.scene_sequence.scene_ids
      const index = afterId === null ? 0 : ids.indexOf(afterId) + 1
      ids.splice(index, 0, op['scene_id'] as string)
      document.scene_sequence.rev += 1
      document.scenes.push({ scene_id: op['scene_id'] as string, rev: 1, origin: 'authored', timing_policy: 'fixed', duration_frames: op['duration_frames'] as number, section_id: null, layers: [] } as never)
    }
    if (op['op'] === 'motion.instance.insert') {
      let found = findLayer(document, op['layer_id'] as string)
      if (!found) {
        // A scene created in the same command: the shared harness could not place the layer yet.
        const scene = document.scenes.find((candidate) => candidate.scene_id === op['scene_id'])
        if (!scene) continue
        const layer = { layer_id: op['layer_id'], rev: 1, layer_kind: 'motion_instance', scene_range: op['scene_range'] } as Body
        scene.layers.push(layer as never)
        found = { scene, layer }
      }
      const range = op['scene_range'] as { start_frame: number; end_frame: number }
      const values = new Map<string, { parameter_id: string; kind: string; value: unknown }>()
      for (const [parameterId, text] of Object.entries(revision.samples)) values.set(parameterId, { parameter_id: parameterId, kind: 'text', value: text })
      for (const [parameterId, raw] of Object.entries((op['parameter_values'] as Record<string, unknown>) ?? {})) {
        const kind = storedKind(revision, parameterId)
        values.set(parameterId, { parameter_id: parameterId, kind, value: storedValue(document, kind, raw) })
      }
      if (revision.duration) values.set(revision.duration, { parameter_id: revision.duration, kind: 'duration', value: range.end_frame - range.start_frame })
      found.layer['instance'] = {
        instance_id: op['instance_id'],
        motion_ref: op['motion_ref'],
        parameter_schema_hash: MOTION_INSTANCE_FIXTURE_SHA,
        parameter_values: [...values.values()],
        dependency_snapshot_sha256: MOTION_INSTANCE_FIXTURE_SHA,
        motion_state: {
          ir_version: 'motion-ir@1',
          blueprint_ref: 'alt-bant@1',
          energy: op['energy'] ?? 'dengeli',
          ratio: document.canvas.aspect_ratio,
          video_style: { preset_ref: op['video_style_ref'], snapshot_sha256: MOTION_INSTANCE_FIXTURE_SHA, color_roles: {}, typography_roles: {} },
          overrides: [],
          handle_versions: [],
        },
      }
    }
    if (op['op'] === 'motion.parameter.set') {
      const found = findLayer(document, op['layer_id'] as string)
      if (!found) continue
      const instance = found.layer['instance'] as { parameter_values: Array<{ parameter_id: string; kind: string; value: unknown }> }
      const parameterId = op['parameter_id'] as string
      const kind = storedKind(revision, parameterId)
      const rest = instance.parameter_values.filter((value) => value.parameter_id !== parameterId)
      instance.parameter_values = op['value'] === null ? rest : [...rest, { parameter_id: parameterId, kind, value: storedValue(document, kind, op['value']) }]
      if (revision.duration === parameterId && typeof op['value'] === 'number') {
        const range = found.layer['scene_range'] as { start_frame: number; end_frame: number }
        found.layer['scene_range'] = { start_frame: range.start_frame, end_frame: range.start_frame + (op['value'] as number) }
      }
      found.layer['rev'] = (found.layer['rev'] as number) + 1
    }
  }
}

export type MotionPreviewWarning = { code: string; message: string }

/** Where the fake compile draws a Motion overlay: its natural box on the canvas (E1-C: the layer's top-level group). */
export type MotionOverlayBox = { x: number; y: number; width: number; height: number }

export async function createMotionBackend(
  options: Pick<StageHarnessOptions, 'document' | 'role' | 'failWrites' | 'session'> & {
    revision: MotionRevisionFake
    /** The gateway's per-layer preview warning for a Motion layer (E1-C: e.g. `motion_overlay_camera_not_supported`), or null. */
    previewWarning?: (layer: { layerId: string; sceneId: string }) => MotionPreviewWarning | null
    /** Draw each Motion layer the way the E1-C compile does: a group with role = layer id and a `<layer_id>.content` child. */
    drawOverlay?: MotionOverlayBox
  },
) {
  const backend = await createStageBackend(options)
  if (options.drawOverlay) {
    const box = options.drawOverlay
    const load = backend.source.loadScene.bind(backend.source)
    backend.source.loadScene = async (sceneId, signal) => {
      const bundle = await load(sceneId, signal)
      const scene = backend.server.copy.document.scenes.find((candidate) => candidate.scene_id === sceneId)
      const nodes = bundle.ir['nodes'] as unknown[]
      const basis = (value: string) => ({ role: value, slot_key: null, list_index: null })
      const source = { kind: 'typed_scene', compiler: 'scene_compiler@1' }
      for (const layer of (scene?.layers ?? []) as Body[]) {
        if (layer['layer_kind'] !== 'motion_instance') continue
        const layerId = layer['layer_id'] as string
        nodes.push({
          handle: groupHandle(layerId),
          kind: 'group',
          role: layerId,
          basis: basis(layerId),
          source,
          box,
          origin: [0, 0],
          props: {},
          children: [
            {
              handle: contentHandle(layerId),
              kind: 'shape',
              role: `${layerId}.content`,
              basis: basis(`${layerId}.content`),
              source,
              box: { x: 0, y: 0, width: box.width, height: box.height },
              props: { fill: '#e4570f' },
              content: { kind: 'shape', shape: 'rect' },
            },
          ],
        })
      }
      return bundle
    }
  }
  if (options.previewWarning) {
    const warn = options.previewWarning
    const sync = backend.source.sync.bind(backend.source)
    backend.source.sync = async (version, signal) => {
      const plan = await sync(version, signal)
      for (const scene of plan.scenes) {
        const body = backend.server.copy.document.scenes.find((candidate) => candidate.scene_id === scene.sceneId)
        for (const layer of (body?.layers ?? []) as Body[]) {
          if (layer['layer_kind'] !== 'motion_instance') continue
          const warning = warn({ layerId: layer['layer_id'] as string, sceneId: scene.sceneId })
          if (warning) scene.warnings = [...scene.warnings, { ...warning, sceneId: scene.sceneId, layerId: layer['layer_id'] as string }]
        }
      }
      return plan
    }
  }
  const original = backend.transport.executeCommand.bind(backend.transport)
  backend.transport.executeCommand = vi.fn(async (projectId: string, body: CompositionCommandBody) => {
    const receipt = await original(projectId, body)
    applyMotionOps(backend.server.copy.document, body, options.revision)
    return receipt
  }) as never
  return backend
}

import { vi } from 'vitest'

import { AuthClientError } from '@/lib/auth/errors'

import type { SparkProject } from '../api'
import type {
  CompositionCommandBody,
  CompositionCommandReceipt,
  CompositionDocument,
  CompositionTransport,
  CompositionWorkingCopy,
} from '../composition-client'
import { SparkCompositionSession } from '../composition-session'
import { PROJECT_ID, documentWithScenes, fixedScene, sceneId, workingCopy } from '../composition-test-fixtures'
import { PlaybackStore, type PlaybackClock } from '../playback-store'
import { createFakeTextMeasurer } from '../optimistic/fake-text-measurer'
import { compileLocalScene, planLocalPreview, type LocalImageAsset } from '../optimistic/local-preview'
import { createLocalPreviewSource } from '../optimistic/local-preview-source'
import { applyOpsLocally } from '../optimistic/document-ops'
import { framesForTicks } from './placement'
import { planFromManifest, bundleFromSceneIr } from './preview-contract'
import { SparkStageController, type StageControllerOptions } from './stage-controller'
import { stageSessionPort } from './stage-session'
import { previewManifest, previewSceneIr, type FixtureLayer } from './stage-test-fixtures'
import { loadVendoredRuntime } from './stage-test-runtime'
import { StageSceneMismatchError, type StagePreviewSource, type StagePlan, type StageSceneBundle } from './stage-types'

/**
 * Shared harness of the stage integration tests: a REAL `SparkCompositionSession` over a fake gateway transport that
 * applies the typed ops the stage sends to an in-memory working copy, a preview source that "compiles" that working copy
 * with the compiler's geometry rules (natural box centred, transform = top-left + scale about it), the REAL vendored
 * motion runtime in happy-dom, a manual playback clock and the real stage controller. Only the network is fake.
 */

export const CANVAS = { width: 1920, height: 1080 }
export const TEXT_BOX = { width: 1728, height: 120 }
export const FRAME_RECT = { left: 100, top: 50, width: 960, height: 540 }

const PROJECT: SparkProject = {
  id: PROJECT_ID,
  channelId: 'ch_1',
  title: 'Test',
  aspectRatio: '16:9',
  lifecycleState: 'active',
  createdAt: '2026-09-27T10:00:00.000Z',
  updatedAt: '2026-09-27T10:00:00.000Z',
}

type Body = Record<string, unknown>

export function manualClock() {
  let time = 0
  let next = 1
  const pending = new Map<number, () => void>()
  const clock: PlaybackClock = {
    now: () => time,
    requestFrame: (callback) => {
      const handle = next++
      pending.set(handle, callback)
      return handle
    },
    cancelFrame: (handle) => void pending.delete(handle),
  }
  return {
    clock,
    advance(ms: number) {
      time += ms
      const callbacks = [...pending.values()]
      pending.clear()
      for (const callback of callbacks) callback()
    },
  }
}

/**
 * Natural layout of the fixture compiler: text = 90% canvas width frame, shape = its `size` box (E1-B) or the canvas,
 * image = contain (1000x500).
 */
function naturalOf(layer: Body): { width: number; height: number } {
  if (layer['layer_kind'] === 'text') return TEXT_BOX
  if (layer['layer_kind'] === 'shape') {
    const size = layer['size'] as { width_px?: number; height_px?: number } | undefined
    return size && typeof size.width_px === 'number' && typeof size.height_px === 'number' ? { width: size.width_px, height: size.height_px } : CANVAS
  }
  return { width: 1000, height: 500 }
}

function compileLayers(document: CompositionDocument, sceneIdValue: string): FixtureLayer[] {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneIdValue)!
  return scene.layers.flatMap((layer): FixtureLayer[] => {
    const body = layer as Body
    const kind = body['layer_kind'] as string
    if (kind === 'clip') {
      const placement = body['placement'] as { scene_range: { start_frame: number; end_frame: number } }
      const isVideo = document.source_media.find((source) => source.source_id === (body['placement'] as { source_id: string }).source_id) as Body | undefined
      if ((isVideo?.['storage_object'] as Body | undefined)?.['media_kind'] === 'video') return []
      const natural = naturalOf(body)
      const transform = body['transform'] as { x: number; y: number; scale: number; rotation_deg: number } | undefined
      return [{
        layerId: layer.layer_id,
        kind: 'image',
        assetKey: `asset_${(body['placement'] as { source_id: string }).source_id}`,
        box: { x: transform?.x ?? (CANVAS.width - natural.width) / 2, y: transform?.y ?? (CANVAS.height - natural.height) / 2, ...natural },
        ...(transform && { scale: transform.scale, rotation: transform.rotation_deg }),
        range: { start: placement.scene_range.start_frame, end: placement.scene_range.end_frame },
      }]
    }
    if (kind !== 'text' && kind !== 'shape') return []
    const natural = naturalOf(body)
    const transform = body['transform'] as { x: number; y: number; scale: number; rotation_deg: number } | undefined
    const range = body['scene_range'] as { start_frame: number; end_frame: number }
    // The compiler's shape content (E1-B): the stored shape, and a rect's radius clamped to half of the shorter side.
    const radius = kind === 'shape' && body['shape'] === 'rect' && typeof body['corner_radius_px'] === 'number' ? Math.min(body['corner_radius_px'], Math.min(natural.width, natural.height) / 2) : 0
    return [{
      layerId: layer.layer_id,
      kind,
      box: { x: transform?.x ?? (CANVAS.width - natural.width) / 2, y: transform?.y ?? (CANVAS.height - natural.height) / 2, ...natural },
      ...(transform && { scale: transform.scale, rotation: transform.rotation_deg }),
      text: body['text'] as string | undefined,
      fill: kind === 'shape' ? (body['fill'] as string) : (body['style'] as { color: string } | undefined)?.color,
      range: { start: range.start_frame, end: range.end_frame },
      ...(kind === 'shape' && { shape: body['shape'] === 'ellipse' ? ('ellipse' as const) : ('rect' as const) }),
      ...(radius > 0 && { cornerRadius: radius }),
    }]
  })
}

/** The image assets of a scene's clips (what the gateway's preview lists in `assets[]`): one per image source in use. */
function compileAssets(document: CompositionDocument, sceneIdValue: string) {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneIdValue)!
  const assets = new Map<string, { key: string; media_type: 'image/png'; width: number; height: number; byte_size: number; storage_object_id: string }>()
  for (const layer of scene.layers as Body[]) {
    if (layer['layer_kind'] !== 'clip') continue
    const sourceId = (layer['placement'] as { source_id: string }).source_id
    const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
    const storage = source?.['storage_object'] as Body | undefined
    if (storage?.['media_kind'] !== 'image') continue
    assets.set(sourceId, { key: `asset_${sourceId}`, media_type: 'image/png', width: 1000, height: 500, byte_size: 1000, storage_object_id: storage['storage_object_id'] as string })
  }
  return [...assets.values()]
}

function hashOf(document: CompositionDocument, sceneIdValue: string): string {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneIdValue)
  return `hash_${JSON.stringify(scene?.layers ?? []).length}_${JSON.stringify(scene).split('').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)}`
}

/** A probed image source of `source_media` (an image has the exact 1/1 probe the gateway writes). */
export function imageSource(sourceId: string, objectId = `obj_${sourceId}`): CompositionDocument['source_media'][number] {
  return {
    source_id: sourceId,
    storage_object: { ref_type: 'storage_object', storage_object_id: objectId, checksum_sha256: 'b'.repeat(64), media_kind: 'image' },
    probe: { timebase: { num: 1, den: 1 }, vfr: false, duration_ticks: 1, audio_channels: 0 },
  } as never
}

/** A probed video (or audio) source of `source_media`: `seconds` long on a 1/90000 timebase unless given. */
export function videoSource(
  sourceId: string,
  options: { seconds: number; kind?: 'video' | 'audio'; timebase?: { num: number; den: number }; audioChannels?: number; objectId?: string },
): CompositionDocument['source_media'][number] {
  const timebase = options.timebase ?? { num: 1, den: 90000 }
  return {
    source_id: sourceId,
    storage_object: { ref_type: 'storage_object', storage_object_id: options.objectId ?? `obj_${sourceId}`, checksum_sha256: 'c'.repeat(64), media_kind: options.kind ?? 'video' },
    probe: { timebase, vfr: false, duration_ticks: Math.round((options.seconds * timebase.den) / timebase.num), audio_channels: options.audioChannels ?? 2 },
  } as never
}

type SceneBody = CompositionDocument['scenes'][number]

function visualEnd(layer: Body): number | null {
  const range = (layer['layer_kind'] === 'clip' ? (layer['placement'] as Body | undefined)?.['scene_range'] : layer['scene_range']) as { end_frame: number } | undefined
  return range && typeof range.end_frame === 'number' ? range.end_frame : null
}

/** The scene's resolved length like the gateway's `compositionSceneLength` (null: nothing to follow yet). */
export function sceneLengthOf(scene: SceneBody): number | null {
  if (scene.timing_policy === 'fixed') return scene.duration_frames ?? null
  if (scene.timing_policy !== 'follow_media') return scene.duration_frames ?? null
  const ends = (scene.layers as Body[]).filter((layer) => layer['layer_kind'] === 'clip').map(visualEnd).filter((end): end is number => end !== null)
  return ends.length > 0 ? Math.max(...ends) : null
}

/** The server's `inv_scene_content_within_length`: a visual layer never ends after its scene. */
function assertWithinLength(document: CompositionDocument, sceneIds: Iterable<string>): void {
  for (const id of new Set(sceneIds)) {
    const scene = document.scenes.find((candidate) => candidate.scene_id === id)
    const length = scene ? sceneLengthOf(scene) : null
    if (!scene || length === null) continue
    for (const layer of scene.layers as Body[]) {
      const end = visualEnd(layer)
      if (end !== null && end > length) throw new Error(`inv_scene_content_within_length: ${String(layer['layer_id'])} ends at ${end}, the scene at ${length}`)
    }
  }
}

function placeAfter(scene: SceneBody, layer: Body, afterLayerId: string | null): void {
  const index = afterLayerId === null ? 0 : scene.layers.findIndex((candidate) => candidate.layer_id === afterLayerId) + 1
  scene.layers.splice(index, 0, layer as never)
}

/** Applies the typed ops of a command to the document (only the ops the stage sends). */
export function applyCommandOps(document: CompositionDocument, body: CompositionCommandBody, version: number): CompositionDocument {
  const next = structuredClone(document) as CompositionDocument
  next.working_copy_version = version
  for (const op of body.ops as Body[]) {
    const scene = next.scenes.find((candidate) => candidate.scene_id === op['scene_id'])
    const layer = scene?.layers.find((candidate) => candidate.layer_id === op['layer_id']) as Body | undefined
    switch (op['op']) {
      case 'scene.insert': {
        if (next.scenes.some((candidate) => candidate.scene_id === op['scene_id'])) break
        const after = op['after_scene_id'] as string | null
        const order = next.scene_sequence.scene_ids
        order.splice(after === null ? 0 : order.indexOf(after) + 1, 0, op['scene_id'] as string)
        next.scene_sequence.rev += 1
        next.scenes.push({
          scene_id: op['scene_id'] as string,
          rev: 1,
          origin: (op['origin'] as string | undefined) ?? 'authored',
          timing_policy: op['timing_policy'] as never,
          ...(op['duration_frames'] !== undefined && { duration_frames: op['duration_frames'] as number }),
          section_id: (op['section_id'] as string | null | undefined) ?? null,
          layers: [],
        })
        break
      }
      case 'scene.remove':
        next.scene_sequence.scene_ids = next.scene_sequence.scene_ids.filter((id) => id !== op['scene_id'])
        next.scenes = next.scenes.filter((candidate) => candidate.scene_id !== op['scene_id'])
        next.scene_sequence.rev += 1
        break
      case 'layer.set_transform':
        if (layer) {
          if (op['transform'] === null) delete layer['transform']
          else layer['transform'] = op['transform']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'text.set':
        if (layer) {
          layer['text'] = op['text']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'text.set_style':
        if (layer) {
          const style = layer['style'] as Body
          if (op['font'] !== undefined) style['font'] = op['font']
          if (op['size_px'] !== undefined) style['size_px'] = op['size_px']
          if (op['color'] !== undefined) style['color'] = op['color']
          if (op['align'] === null) delete style['align']
          else if (op['align'] !== undefined) style['align'] = op['align']
          // Spark styling round: `null` (or a decoration without a line) clears a field.
          for (const field of ['line_height', 'text_decoration', 'stroke']) {
            if (op[field] === undefined) continue
            const value = op[field] as Body | null
            const empty = field === 'text_decoration' && value !== null && !value['underline'] && !value['strikethrough']
            if (value === null || empty) delete style[field]
            else style[field] = value
          }
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'layer.set_opacity':
        if (layer) {
          if (op['opacity'] === null || op['opacity'] === 1) delete layer['opacity']
          else layer['opacity'] = op['opacity']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'layer.set_locked':
        if (layer) {
          if (op['locked'] === true) layer['locked'] = true
          else delete layer['locked']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'shape.set_fill':
        if (layer) {
          layer['fill'] = op['fill']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'shape.set_size':
        if (layer) {
          layer['size'] = op['size']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'shape.set_corner_radius':
        if (layer) {
          if (op['corner_radius_px'] === null) delete layer['corner_radius_px']
          else layer['corner_radius_px'] = op['corner_radius_px']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'layer.remove':
        if (scene) {
          scene.layers = scene.layers.filter((candidate) => candidate.layer_id !== op['layer_id'])
          scene.rev += 1
        }
        break
      case 'layer.arrange':
        if (scene && layer) {
          scene.layers = scene.layers.filter((candidate) => candidate.layer_id !== op['layer_id'])
          const after = op['after_layer_id'] as string | null
          const index = after === null ? 0 : scene.layers.findIndex((candidate) => candidate.layer_id === after) + 1
          scene.layers.splice(index, 0, layer as never)
          scene.rev += 1
        }
        break
      case 'text.insert':
        if (scene) {
          scene.layers.push({
            layer_id: op['layer_id'] as string,
            rev: 1,
            layer_kind: 'text',
            text: op['text'],
            style: op['style'],
            scene_range: op['scene_range'],
          } as never)
          scene.rev += 1
        }
        break
      case 'clip.insert_sequence':
        if (scene) {
          let cursor = op['start_frame'] as number
          let after = op['after_layer_id'] as string | null
          for (const item of op['items'] as Array<{ layer_id: string; source_id: string; source_range?: { in_tick: number; out_tick: number } }>) {
            const source = next.source_media.find((candidate) => candidate.source_id === item.source_id) as Body | undefined
            if (!source) throw new Error(`source_media ${item.source_id} is missing`)
            const probe = source['probe'] as { timebase: { num: number; den: number }; duration_ticks: number }
            const isImage = (source['storage_object'] as Body)['media_kind'] === 'image'
            const range = item.source_range ?? { in_tick: 0, out_tick: probe.duration_ticks }
            const frames = isImage ? (op['image_hold_frames'] as number) : framesForTicks(range.out_tick - range.in_tick, probe.timebase, next.canvas.fps)
            const clip = {
              layer_id: item.layer_id,
              rev: 1,
              layer_kind: 'clip',
              placement: { source_id: item.source_id, source_range: range, scene_range: { start_frame: cursor, end_frame: cursor + frames } },
            }
            placeAfter(scene, clip, after)
            after = item.layer_id
            cursor += frames
          }
          scene.rev += 1
        }
        break
      case 'shape.insert':
        if (scene) {
          const rest = { ...op }
          delete rest['op']
          delete rest['scene_id']
          delete rest['after_layer_id']
          placeAfter(scene, { rev: 1, layer_kind: 'shape', ...rest }, (op['after_layer_id'] as string | null) ?? null)
          scene.rev += 1
        }
        break
      case 'motion.instance.insert':
        if (scene) {
          placeAfter(
            scene,
            {
              layer_id: op['layer_id'],
              rev: 1,
              layer_kind: 'motion_instance',
              instance: { instance_id: op['instance_id'], motion_ref: op['motion_ref'], parameter_values: op['parameter_values'] ?? [], ...(op['energy'] !== undefined && { energy: op['energy'] }) },
              scene_range: op['scene_range'],
            },
            (op['after_layer_id'] as string | null) ?? null,
          )
          scene.rev += 1
        }
        break
      case 'animation.set':
        if (layer) {
          const animation = op['animation'] as { animation_id: string }
          const animations = ((layer['animations'] as Array<{ animation_id: string }> | undefined) ?? []).filter((candidate) => candidate.animation_id !== animation.animation_id)
          layer['animations'] = [...animations, animation]
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'animation.remove':
        if (layer) {
          const remaining = ((layer['animations'] as Array<{ animation_id: string }> | undefined) ?? []).filter((candidate) => candidate.animation_id !== op['animation_id'])
          if (remaining.length > 0) layer['animations'] = remaining
          else delete layer['animations']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'scene.set_timing':
        if (scene) {
          scene.timing_policy = op['timing_policy'] as never
          if (op['duration_frames'] !== undefined) scene.duration_frames = op['duration_frames'] as number
          else delete scene.duration_frames
          scene.rev += 1
        }
        break
      case 'scene.set_transition':
        if (scene) {
          if (op['kind'] === 'cut') delete (scene as Body)['transition_in']
          else
            (scene as Body)['transition_in'] = {
              kind: op['kind'],
              duration_frames: op['duration_frames'],
              ...(op['params'] !== undefined && { params: op['params'] }),
            }
          scene.rev += 1
        }
        break
      case 'scene.clear_transition':
        if (scene) {
          delete (scene as Body)['transition_in']
          scene.rev += 1
        }
        break
      case 'layer.trim':
        if (layer) {
          if (op['source_range']) {
            const placement = layer['placement'] as { source_id: string; source_range: unknown; scene_range: { start_frame: number; end_frame: number } }
            const source = next.source_media.find((candidate) => candidate.source_id === placement.source_id) as Body
            const range = op['source_range'] as { in_tick: number; out_tick: number }
            placement.source_range = range
            placement.scene_range = {
              start_frame: placement.scene_range.start_frame,
              end_frame: placement.scene_range.start_frame + framesForTicks(range.out_tick - range.in_tick, (source['probe'] as { timebase: { num: number; den: number } }).timebase, next.canvas.fps),
            }
          } else layer['scene_range'] = op['scene_range']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'canvas.set_format': {
        // P06-62 / the editor's format switch: the F35 1080p canvas of the format, refused when the canvas moved meanwhile.
        const sizes: Record<string, { width: number; height: number }> = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 } }
        const size = sizes[op['aspect_ratio'] as string]
        if (next.canvas.aspect_ratio !== op['expected_aspect_ratio'] || !size) throw new Error('canvas_format_changed')
        next.canvas = { ...next.canvas, aspect_ratio: op['aspect_ratio'] as never, ...size }
        break
      }
      case 'clip.replace_source':
        // The server's rules: the same visual kind; the clip keeps its place, timing and transform (E1-J).
        if (layer) {
          const placement = layer['placement'] as { source_id: string; source_range: unknown }
          const kindOf = (id: string) => ((next.source_media.find((candidate) => candidate.source_id === id) as Body | undefined)?.['storage_object'] as Body | undefined)?.['media_kind']
          if (!next.source_media.some((candidate) => candidate.source_id === op['source_id'])) throw new Error(`source_media ${String(op['source_id'])} is missing`)
          if (kindOf(op['source_id'] as string) !== kindOf(placement.source_id)) throw new Error('replacement_media_kind_mismatch')
          placement.source_id = op['source_id'] as string
          placement.source_range = op['source_range']
          layer['rev'] = (layer['rev'] as number) + 1
        }
        break
      case 'audio.insert':
        next.audio.placements.push({
          placement_id: op['placement_id'] as string,
          rev: 1,
          role: op['role'],
          source_id: op['source_id'],
          source_range: op['source_range'],
          gain_db: op['gain_db'],
          ...(op['scene_id'] !== undefined && { scene_id: op['scene_id'], scene_range: op['scene_range'] }),
          ...(op['project_range'] !== undefined && { project_range: op['project_range'] }),
        } as never)
        next.audio.rev += 1
        break
      case 'narration.set': {
        // The scene's narration: replaces the one the caller saw, or clears (placement null) (E1-F Voice only).
        const replaces = op['replaces_placement_id'] as string | null
        if (replaces) next.audio.placements = next.audio.placements.filter((placement) => placement.placement_id !== replaces)
        const placement = op['placement'] as Body | null
        if (placement) next.audio.placements.push({ ...placement, rev: 1, role: 'narration', scene_id: op['scene_id'] } as never)
        next.audio.rev += 1
        break
      }
      default:
        break
    }
  }
  assertWithinLength(
    next,
    (body.ops as Body[]).filter((op) => ['clip.insert_sequence', 'shape.insert', 'motion.instance.insert', 'scene.set_timing', 'layer.trim'].includes(op['op'] as string)).map((op) => op['scene_id'] as string),
  )
  return next
}

export type StageHarnessOptions = {
  document: CompositionDocument
  role?: CompositionWorkingCopy['role']
  /** Make the gateway refuse the next commands (a failed write). */
  failWrites?: boolean
  /**
   * E1-N: simulated round trip (ms) of every gateway call the editor makes: the command, the document re-read and the two
   * preview routes. The server side effect lands half-way through the round trip. 0 (default) = instant, no extra awaits.
   */
  latencyMs?: number
  /**
   * E1-N: a server that behaves like the gateway: it applies the ops with the parity-tested port (real revs, real receipts) and
   * answers the preview routes with the real local plan and compile (`planLocalPreview`, `compileLocalScene`, a fake text
   * measurer), so a picture the browser drew itself equals the server's.
   */
  real?: boolean
  fonts?: StageControllerOptions['fonts']
  coverage?: StageControllerOptions['coverage']
  onAskAi?: StageControllerOptions['onAskAi']
  /** E1-N: extra options of the session under test (`optimistic: true` draws the edits before the server answers). */
  session?: Partial<ConstructorParameters<typeof SparkCompositionSession>[0]>
  /** Extra options of the stage controller under test (the contextual toolbar switch, a media size resolver, ...). */
  controller?: Pick<StageControllerOptions, 'contextToolbar' | 'mediaSize' | 'historyKeys' | 'liveFx' | 'timers'>
  /**
   * Live FX: the fake server plans and compiles like a gateway with transitions on (`transitionsEnabled`, documents that store
   * transitions, animated layers), and (with `local`) the stage draws the editor's own copy through the local preview source.
   */
  liveFx?: boolean
  /**
   * The gateway's other release switches the fake server's preview manifest reports (with `liveFx`): the `scene-transitions@2`
   * kinds may be written (`transition_catalog_version`), `scene.split` takes the relaxed rules (`relaxed_split_enabled`).
   */
  gateway?: { transitionCatalog?: 2; relaxedSplitEnabled?: boolean }
  /** E1-N: the stage's source is the local preview source over the fake server (what the editor uses with instant editing). */
  local?: boolean
}

/**
 * The server side of the harness: a real `SparkCompositionSession` over a fake gateway transport that applies the stage's
 * typed ops, and a preview source that compiles the working copy. The shell tests mount the real editor on it; the stage
 * tests add the runtime, the clock and the controller on top (`createStageHarness`).
 */
export async function createStageBackend(options: Pick<StageHarnessOptions, 'document' | 'role' | 'failWrites' | 'latencyMs' | 'real' | 'session' | 'liveFx' | 'gateway'> & {
  /** First number of the session's id counter (default 0): a test that adds a scene needs ids that cannot meet the fixtures'. */
  idStart?: number
}) {
  const server = {
    copy: workingCopy(options.document, options.role ?? 'owner'),
    failWrites: options.failWrites ?? false,
    /** E1-N: the next `times` commands fail with `error` (an `AuthClientError` for a lost connection, a refusal, ...). */
    failWith: null as null | { error: unknown; times: number },
  }
  const commands: CompositionCommandBody[] = []
  /** E1-N: every gateway call with its start and end time (ms, `performance.now()`), in start order. */
  const calls: Array<{ name: string; start: number; end: number }> = []
  const latency = options.latencyMs ?? 0
  const sleep = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms))
  /** E1-N: the holds that are on (`hold`); a call that reaches the server while a matching one is on waits for its release. */
  const holds: Array<{ match: (name: string) => boolean; gate: Promise<void> }> = []
  const heldAt = (name: string): Promise<unknown> | null => {
    const gates = holds.filter((held) => held.match(name)).map((held) => held.gate)
    return gates.length > 0 ? Promise.all(gates) : null
  }
  const roundTrip = async <T,>(name: string, work: () => Promise<T>): Promise<T> => {
    if (latency <= 0 && heldAt(name) === null) return work()
    const entry = { name, start: performance.now(), end: 0 }
    calls.push(entry)
    if (latency > 0) await sleep(latency / 2)
    // Held: the call is on its way (in `calls`, unanswered) but the server has not received it (nothing applied or read).
    const gate = heldAt(name)
    if (gate) await gate
    try {
      return await work()
    } finally {
      if (latency > 0) await sleep(latency / 2)
      entry.end = performance.now()
    }
  }
  const transport = {
    getWorkingCopy: vi.fn(async () => roundTrip('GET document', async () => server.copy)),
    executeCommand: vi.fn((_projectId: string, body: CompositionCommandBody): Promise<CompositionCommandReceipt> => roundTrip('POST commands', async (): Promise<CompositionCommandReceipt> => {
      if (server.failWrites) throw new Error('write refused')
      if (server.failWith && server.failWith.times > 0) {
        server.failWith.times -= 1
        throw server.failWith.error
      }
      commands.push(body)
      const version = server.copy.workingCopyVersion + 1
      const exact = options.real ? applyOpsLocally(server.copy.document, body.ops) : null
      if (options.real && !exact?.ok) throw new AuthClientError('COMPOSITION_COMMAND_INVALID', 'refused', 400)
      server.copy =
        exact && exact.ok
          ? { ...server.copy, workingCopyVersion: version, document: { ...exact.document, working_copy_version: version }, etag: `"v${version}"` }
          : { ...server.copy, workingCopyVersion: version, document: applyCommandOps(server.copy.document, body, version) }
      return {
        command_id: 'ccmd_1',
        outcome: 'applied',
        receipt_status: 'applied',
        base_revision: body.base_revision,
        working_copy_version_before: body.base_revision,
        working_copy_version: version,
        undo_group_id: body.undo_group_id,
        changed_entities: exact && exact.ok ? (exact.changed as never) : [],
        removed_entities: exact && exact.ok ? (exact.removed as never) : [],
        auto_checkpoint_revision_id: null,
      }
    })),
    undo: vi.fn(),
  } as unknown as CompositionTransport
  let n = options.idStart ?? 0
  const session = new SparkCompositionSession({
    projectId: PROJECT_ID,
    transport,
    viewPreferences: { get: async () => null, save: async () => 'compact' } as never,
    getProject: async () => PROJECT,
    createId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    // WP2: the idle read-back of a copy taken from receipts runs on a wall-clock timer; a test that is about it sets the delay.
    verifyDelayMs: null,
    ...(options.session && options.session),
  })
  await session.load()

  const baseManifest = previewManifest({ scenes: [] })
  // The fixtures' text layers use the `font_inter` pin (sha 'a' x 64) next to the schema fixture's Montserrat.
  const realManifest = {
    ...baseManifest,
    // The runtime refuses a laid-out text whose font set hash is not a sha256: a valid-looking pin for the fake set.
    fonts: { ...baseManifest.fonts, font_set_hash: 'f'.repeat(64), faces: [...baseManifest.fonts.faces, { font_id: 'font_inter', font_revision: 'r1', family: 'Inter', weight: 400, style: 'normal' as const, sha256: 'a'.repeat(64), url: `/api/v1/composition/fonts/${'a'.repeat(64)}` }] },
  }
  const realInputs = (version: number) => ({
    sceneCompilerVersion: realManifest.scene_compiler_version,
    motionRuntimeVersion: realManifest.motion_runtime_version,
    fontSetHash: realManifest.fonts.font_set_hash,
    workingCopyVersion: version,
    serverPlan: null,
    liveFx: options.liveFx === true,
  })
  const realImages = (document: CompositionDocument): Map<string, LocalImageAsset> =>
    new Map(
      (document.source_media as unknown as Array<{ source_id: string; storage_object: { storage_object_id: string; checksum_sha256: string; media_kind?: string } }>)
        .filter((source) => source.storage_object.media_kind === 'image')
        .map((source) => [source.source_id, { key: source.storage_object.checksum_sha256, width: 1000, height: 500, storageObjectId: source.storage_object.storage_object_id }]),
    )
  const sync = vi.fn((version: number): Promise<StagePlan> => roundTrip('GET preview', async () => {
    const document = server.copy.document
    if (options.real) {
      const local = planLocalPreview(document, realInputs(Math.max(version, server.copy.workingCopyVersion)))!
      // The server's manifest: the same plan, without what only a plan of the browser carries (its origin, content hashes).
      const { origin, ...plan } = local.plan
      void origin
      const scenes = plan.scenes.map((scene) => {
        const { contentHash, ...wire } = scene
        void contentHash
        return wire
      })
      return {
        ...plan,
        scenes,
        safeArea: { x: 96, y: 54, width: 1728, height: 972 },
        ...(options.liveFx && { transitionsEnabled: true }),
        ...(options.liveFx && options.gateway?.transitionCatalog === 2 && { transitionCatalog: 2 as const }),
        ...(options.gateway?.relaxedSplitEnabled === true && { relaxedSplitEnabled: true }),
      }
    }
    let start = 0
    const scenes = document.scene_sequence.scene_ids.map((id) => {
      const scene = document.scenes.find((candidate) => candidate.scene_id === id)!
      const duration = sceneLengthOf(scene)
      const entry = { sceneId: id, start, duration, hash: hashOf(document, id) }
      start += duration ?? 0
      return entry
    })
    const manifestPlan = planFromManifest(previewManifest({ version: Math.max(version, server.copy.workingCopyVersion), scenes }))
    return options.liveFx ? { ...manifestPlan, transitionsEnabled: true } : manifestPlan
  }))
  /** The scene as the server compiles it NOW (whatever version the caller asked for). */
  const compileCurrent = (id: string): StageSceneBundle => {
    const document = server.copy.document
    if (options.real) {
      const local = planLocalPreview(document, realInputs(server.copy.workingCopyVersion))!
      const planned = local.scenes.get(id)!
      const compiled = compileLocalScene({ document, scene: planned, compilerVersion: realManifest.scene_compiler_version, fonts: { faces: realManifest.fonts.faces, measurer: createFakeTextMeasurer(realManifest.fonts.font_set_hash) }, images: realImages(document), animations: options.liveFx === true })
      if (!compiled.ok) throw new Error(`the fake server cannot compile ${id}: ${compiled.reason}`)
      return {
        sceneId: id,
        startFrame: planned.startFrame,
        durationFrames: planned.durationFrames as number,
        dependencyHash: planned.hash,
        ir: compiled.ir,
        assets: Object.fromEntries(compiled.assets.map((asset) => [asset.key, `/image/${asset.storageObjectId}`])),
        nativeLayers: planned.natives,
        warnings: [],
      }
    }
    const scene = document.scenes.find((candidate) => candidate.scene_id === id)!
    const start = document.scene_sequence.scene_ids.slice(0, document.scene_sequence.scene_ids.indexOf(id)).reduce(
      (sum, other) => sum + (sceneLengthOf(document.scenes.find((candidate) => candidate.scene_id === other)!) ?? 0),
      0,
    )
    const ir = previewSceneIr({ sceneId: id, start, duration: sceneLengthOf(scene) ?? 1, hash: hashOf(document, id), layers: compileLayers(document, id), assets: compileAssets(document, id) })
    return bundleFromSceneIr(ir, (objectId) => `/image/${objectId}`)
  }
  // Like the real adapter (`previewSourceFromStore`, WP1): a scene that moved on since the caller's plan is reported as a
  // mismatch carrying the newer picture, never handed out as the version that was asked for.
  const loadScene = vi.fn((id: string, _signal?: AbortSignal, dependencyHash?: string): Promise<StageSceneBundle> => roundTrip(`GET preview/scenes/${id}`, async () => {
    const bundle = compileCurrent(id)
    if (dependencyHash !== undefined && bundle.dependencyHash !== dependencyHash) throw new StageSceneMismatchError(id, dependencyHash, bundle)
    return bundle
  }))
  const source: StagePreviewSource = { sync, loadScene, ensureFonts: vi.fn(async () => undefined), dispose: () => undefined }
  /** E1-N: what the browser's local preview needs of the preview store (the fake server's manifest, no font download). */
  const localStore = {
    getSnapshot: () => ({ manifest: realManifest }),
    ensureFaces: async () => undefined,
    fontBytes: () => new Uint8Array(0),
  }
  /**
   * E1-N: holds the gateway calls whose name is `name` (`'POST commands'`, `'GET preview'`, ...; default: every call) at the
   * server's door until the returned function is called. Every matching call that reaches the server while the hold is on
   * waits there: it has started (it is in `calls`, unanswered) but the server has not received it (a held command is not in
   * `commands` and changes nothing). On release the waiting calls go on in the order they arrived. A test uses it to look at
   * the picture while no answer is possible, however slow the machine is, instead of racing the simulated latency.
   */
  const hold = (name?: string): (() => void) => {
    let open: () => void = () => undefined
    const held = { match: (call: string) => name === undefined || call === name, gate: new Promise<void>((resolve) => (open = resolve)) }
    holds.push(held)
    return () => {
      const index = holds.indexOf(held)
      if (index >= 0) holds.splice(index, 1)
      open()
    }
  }
  return { session, server, commands, calls, transport, source, sync, loadScene, localStore, hold, project: PROJECT, nextId: () => `00000000-0000-4000-8000-${String(1000 + ++n).padStart(12, '0')}` }
}

export async function createStageHarness(options: StageHarnessOptions) {
  const backend = await createStageBackend(options)
  const { session, server, commands, transport, source, sync, loadScene } = backend

  const clock = manualClock()
  const playback = new PlaybackStore({ clock: clock.clock })
  const frame = document.createElement('div')
  document.body.appendChild(frame)
  frame.getBoundingClientRect = () =>
    ({ ...FRAME_RECT, right: FRAME_RECT.left + FRAME_RECT.width, bottom: FRAME_RECT.top + FRAME_RECT.height, x: FRAME_RECT.left, y: FRAME_RECT.top, toJSON: () => ({}) }) as DOMRect

  const askAi = vi.fn()
  const media = { playbackUrl: (id: string) => `/playback/${id}`, imageUrl: (id: string) => `/image/${id}` }
  const stageSource = options.local
    ? createLocalPreviewSource({
        base: source,
        store: backend.localStore,
        media,
        probeImage: async () => ({ width: 1000, height: 500 }),
        measurer: (manifest) => createFakeTextMeasurer(manifest.fonts.font_set_hash),
        liveFx: options.liveFx === true,
      })
    : source
  const controller = new SparkStageController({
    source: stageSource,
    loadRuntime: async () => loadVendoredRuntime(),
    media,
    session: stageSessionPort(session, () => session.getSnapshot()),
    playback,
    doc: document,
    fonts: options.fonts,
    coverage: options.coverage,
    uuid: backend.nextId,
    labels: { newText: 'Yeni metin' },
    onAskAi: options.onAskAi ?? askAi,
    ...options.controller,
  })
  const push = () => {
    const copy = session.getSnapshot().workingCopy
    if (copy) controller.setWorkingCopy({ version: copy.workingCopyVersion, document: copy.document, ...(copy.localRevision !== undefined && { localRevision: copy.localRevision }) })
  }
  session.subscribe(push)
  controller.attach(frame)
  controller.setFrameWidth(FRAME_RECT.width)
  push()
  await controller.whenSettled()

  return {
    session,
    server,
    commands,
    transport,
    controller,
    playback,
    clock,
    frame,
    sync,
    loadScene,
    askAi,
    /** Holds gateway calls at the server's door until released (`createStageBackend`). */
    hold: backend.hold,
    /** Client pixel of a canvas pixel (the frame shows the canvas at 0.5). */
    client(x: number, y: number) {
      const scale = FRAME_RECT.width / CANVAS.width
      return { x: FRAME_RECT.left + x * scale, y: FRAME_RECT.top + y * scale }
    },
    dispose() {
      controller.dispose()
      frame.remove()
    },
  }
}

export const STAGE_SCENE_ID = sceneId(1)
export const STAGE_SCENE_FRAMES = 150

/** A one-scene document with the given layer bodies (scene `sceneId(1)`, 150 frames at 30 fps, 1920x1080). */
export function singleSceneDocument(layers: CompositionDocument['scenes'][number]['layers']): CompositionDocument {
  return documentWithScenes([STAGE_SCENE_ID], {
    version: 4,
    scenes: [fixedScene(STAGE_SCENE_ID, { duration_frames: STAGE_SCENE_FRAMES, rev: 3, layers })],
  })
}

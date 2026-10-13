/**
 * P05-11 test support: the P07-13 project mixes, thresholds and plan as the planner's tests read them.
 *
 * The mixes are the frozen definitions in contracts/agentic-spark/perf-measurement/v1. `expandMix` follows the
 * package's `mix_expansion` rules (scene order, layer order, round-robin asset assignment) and is checked against the
 * `expected` totals every mix declares, so the expansion here and the Python reference in the engine tests agree on
 * the same project. Where the frozen rules are silent (where audio placements, overlays and captions sit in time) the
 * conventions below are harness conventions, not part of the frozen mix. Not imported by application code.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { mulberry32 } from './test-support'
import type { WsAsset, WsAssetKind, WsAudioPlacement, WsItem, WsProject, WsScene } from './types'

const REPO_ROOT = path.resolve(__dirname, '../../../..')
export const PERF_ROOT = path.join(REPO_ROOT, 'contracts', 'agentic-spark', 'perf-measurement', 'v1')

export interface PerfAssetClass {
  class_id: string
  kind: 'image' | 'gif' | 'video' | 'audio'
  mime_type: string
  count: number
  size_bytes: number
  width?: number
  height?: number
  frame_count?: number
  duration_seconds?: number
}

export interface PerfLayer {
  kind: 'clip' | 'text' | 'shape' | 'motion_instance'
  count: number
  asset_class?: string
  animations_per_layer: number
}

export interface PerfMix {
  mix_id: string
  seed: number
  canvas: { width: number; height: number; fps: number }
  duration_seconds: number
  asset_classes: PerfAssetClass[]
  scene_groups: Array<{ group_id: string; scene_count: number; scene_seconds: number; layers: PerfLayer[] }>
  project_layers: {
    overlays: number
    caption_tracks: number
    audio_placements: Array<{ role: 'narration' | 'music' | 'sfx'; count: number; asset_class: string }>
  }
  expected: Record<string, number>
}

export interface PerfThresholdBound {
  device_profile: string
  temperature: string
  operator: '<=' | '>=' | '=='
  value: number
}

export interface PerfMetric {
  metric_id: string
  unit: string
  statistic: string
  gate: boolean
  source: { kind: string; name?: string; gap?: string }
  basis: string
  bounds: PerfThresholdBound[]
}

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(path.join(PERF_ROOT, ...parts), 'utf-8')) as T
}

export const MIX_IDS = ['mix-2min-mixed', 'mix-10min-mixed', 'mix-200-scenes'] as const
export type MixId = (typeof MIX_IDS)[number]

export function loadMix(mixId: MixId): PerfMix {
  return readJson<PerfMix>('mixes', `${mixId}.r1.json`)
}

export function loadThresholds(): Map<string, PerfMetric> {
  const file = readJson<{ metrics: PerfMetric[] }>('thresholds', 'spark-perf-thresholds.r1.json')
  return new Map(file.metrics.map((metric) => [metric.metric_id, metric]))
}

export function loadPlan(): {
  interaction_scripts: Array<{ script_id: string; steps: Array<{ action: string; count?: number; duration_ms?: number; span_seconds?: number }> }>
  runs: Array<{ run_id: string; interaction_script: string; temperature: string; project_mix?: { id: string }; metrics: string[]; device_profiles: Array<{ id: string }> }>
} {
  return readJson('plans', 'spark-perf-plan.r1.json')
}

export interface ExpandedScene {
  scene_id: string
  group_id: string
  start_frame: number
  length_frames: number
  layers: Array<{ layer_id: string; kind: PerfLayer['kind']; animations: number; asset_id?: string }>
}

/** The reference expansion of perf-rules.json `mix_expansion` (the same algorithm as the engine's Python test). */
export function expandMix(mix: PerfMix) {
  const fps = mix.canvas.fps
  const classes = new Map(mix.asset_classes.map((item) => [item.class_id, item]))
  const nextClip = new Map<string, number>([...classes.keys()].map((id) => [id, 0]))
  const scenes: ExpandedScene[] = []
  let frame = 0
  for (const group of mix.scene_groups) {
    for (let scene = 0; scene < group.scene_count; scene += 1) {
      const sceneId = `s${String(scenes.length + 1).padStart(3, '0')}`
      const layers: ExpandedScene['layers'] = []
      for (const layer of group.layers) {
        for (let copy = 0; copy < layer.count; copy += 1) {
          const entry: ExpandedScene['layers'][number] = {
            layer_id: `${sceneId}-l${String(layers.length + 1).padStart(2, '0')}`,
            kind: layer.kind,
            animations: layer.animations_per_layer,
          }
          if (layer.kind === 'clip') {
            const classId = layer.asset_class!
            const used = nextClip.get(classId)!
            entry.asset_id = `${classId}-${String((used % classes.get(classId)!.count) + 1).padStart(3, '0')}`
            nextClip.set(classId, used + 1)
          }
          layers.push(entry)
        }
      }
      const length = group.scene_seconds * fps
      scenes.push({ scene_id: sceneId, group_id: group.group_id, start_frame: frame, length_frames: length, layers })
      frame += length
    }
  }
  const references = new Map(nextClip)
  const audio: Array<{ role: 'narration' | 'music' | 'sfx'; asset_id: string }> = []
  for (const placement of mix.project_layers.audio_placements) {
    const cls = classes.get(placement.asset_class)!
    for (let copy = 0; copy < placement.count; copy += 1) {
      const used = references.get(placement.asset_class)!
      audio.push({ role: placement.role, asset_id: `${placement.asset_class}-${String((used % cls.count) + 1).padStart(3, '0')}` })
      references.set(placement.asset_class, used + 1)
    }
  }
  const visual = mix.asset_classes.filter((item) => item.kind !== 'audio')
  const budget = 2_097_152
  const totals = {
    scene_count: scenes.length,
    layer_count: scenes.reduce((sum, scene) => sum + scene.layers.length, 0),
    max_layers_in_scene: Math.max(...scenes.map((scene) => scene.layers.length)),
    total_frames: frame,
    distinct_asset_count: mix.asset_classes.reduce((sum, item) => sum + item.count, 0),
    original_bytes: mix.asset_classes.reduce((sum, item) => sum + item.count * item.size_bytes, 0),
    decoded_pixels_worst_case: visual.reduce((sum, item) => sum + item.count * item.width! * item.height! * item.frame_count!, 0),
    assets_over_preview_budget: visual.filter((item) => item.size_bytes > budget).reduce((sum, item) => sum + item.count, 0),
  }
  return { scenes, audio, totals }
}

const KIND: Record<PerfAssetClass['kind'], WsAssetKind> = { image: 'image', gif: 'gif', video: 'video', audio: 'audio' }

/**
 * The mix as the planner's normalised project. Harness conventions for what the frozen mix does not place in time:
 * narration spans the project, music placements split it evenly, sound effects start at seeded positions, overlays
 * are seeded spans of 15% of the project, a caption track spans the project.
 */
export function toWorkingSetProject(mix: PerfMix): WsProject {
  const expanded = expandMix(mix)
  const fps = mix.canvas.fps
  const random = mulberry32(mix.seed)
  const assets = new Map<string, WsAsset>()
  for (const cls of mix.asset_classes) {
    for (let number = 1; number <= cls.count; number += 1) {
      const assetId = `${cls.class_id}-${String(number).padStart(3, '0')}`
      assets.set(assetId, {
        assetId,
        kind: KIND[cls.kind],
        sizeBytes: cls.size_bytes,
        width: cls.width,
        height: cls.height,
        frameCount: cls.frame_count,
        durationSeconds: cls.duration_seconds,
      })
    }
  }

  const scenes: WsScene[] = []
  const items: WsItem[] = []
  for (const scene of expanded.scenes) {
    scenes.push({ sceneId: scene.scene_id, startFrame: scene.start_frame, endFrame: scene.start_frame + scene.length_frames })
    scene.layers.forEach((layer, order) => {
      items.push({
        itemId: layer.layer_id,
        sceneId: scene.scene_id,
        startFrame: scene.start_frame,
        endFrame: scene.start_frame + scene.length_frames,
        layerKind: layer.kind,
        zIndex: order + 1,
        ...(layer.asset_id ? { assetId: layer.asset_id } : {}),
      })
    })
  }
  const total = expanded.totals.total_frames
  for (let overlay = 0; overlay < mix.project_layers.overlays; overlay += 1) {
    const length = Math.round(total * 0.15)
    const start = Math.floor(random() * (total - length))
    items.push({ itemId: `overlay-${overlay + 1}`, sceneId: null, startFrame: start, endFrame: start + length, layerKind: 'overlay', zIndex: 1000 + overlay })
  }
  for (let track = 0; track < mix.project_layers.caption_tracks; track += 1) {
    items.push({ itemId: `caption-${track + 1}`, sceneId: null, startFrame: 0, endFrame: total, layerKind: 'caption', zIndex: 2000 + track })
  }

  const audio: WsAudioPlacement[] = []
  const musicCount = expanded.audio.filter((placement) => placement.role === 'music').length
  let musicIndex = 0
  expanded.audio.forEach((placement, order) => {
    const asset = assets.get(placement.asset_id)!
    let start = 0
    let end = total
    if (placement.role === 'music') {
      const span = Math.floor(total / musicCount)
      start = musicIndex * span
      end = musicIndex === musicCount - 1 ? total : start + span
      musicIndex += 1
    } else if (placement.role === 'sfx') {
      const length = Math.round((asset.durationSeconds ?? 2) * fps)
      start = Math.floor(random() * Math.max(1, total - length))
      end = start + length
    }
    audio.push({ placementId: `audio-${order + 1}-${placement.role}`, role: placement.role, startFrame: start, endFrame: end, assetId: placement.asset_id })
  })

  return { revision: `${mix.mix_id}@r1`, fps, totalFrames: total, scenes, items, audio, assets }
}

/**
 * What the getAll-and-premount design needs at open, for contrast: a delivery for every distinct asset, a live
 * element for every video clip and audio placement, and every visual original decoded (worst case).
 */
export function naivePremountDemand(project: WsProject) {
  const referenced = new Set<string>()
  let liveElements = 0
  for (const item of project.items) {
    if (item.layerKind !== 'clip' || !item.assetId) continue
    referenced.add(item.assetId)
    if (project.assets.get(item.assetId)?.kind === 'video') liveElements += 1
  }
  for (const placement of project.audio) {
    referenced.add(placement.assetId)
    liveElements += 1
  }
  let decodedMegapixels = 0
  for (const assetId of referenced) {
    const asset = project.assets.get(assetId)!
    if (asset.kind === 'audio' || !asset.width || !asset.height) continue
    decodedMegapixels += (asset.width * asset.height * (asset.kind === 'image' ? 1 : (asset.frameCount ?? 1))) / 1_000_000
  }
  return { deliveriesAtOpen: referenced.size, liveElements, decodedMegapixels }
}

/** True when a frozen bound (operator and value) holds for a counted value. */
export function boundHolds(bound: PerfThresholdBound, value: number): boolean {
  if (bound.operator === '<=') return value <= bound.value + 1e-9
  if (bound.operator === '>=') return value >= bound.value - 1e-9
  return Math.abs(value - bound.value) <= 1e-9
}

/** The frozen bounds of a metric that apply to a device class and a temperature. */
export function boundsFor(metric: PerfMetric, deviceClass: string, temperature: string): PerfThresholdBound[] {
  return metric.bounds.filter(
    (bound) => (bound.device_profile === 'any' || bound.device_profile === deviceClass) && (bound.temperature === 'any' || bound.temperature === temperature),
  )
}

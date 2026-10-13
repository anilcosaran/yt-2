import type { CompositionDocument, CompositionScene } from './composition-client'

/**
 * Y1-07 W4: resolved scene lengths in the browser. A faithful mirror of the gateway's
 * `api-gateway/src/composition/domain/scene-compiler/scene-timing.ts` (`compositionSceneLength`,
 * `resolveCompositionSceneTimings`), which is the authority the compiler, the export quote and the preview manifest use:
 *
 * - `fixed`: the scene's `duration_frames`.
 * - `follow_media`: the end of the scene's media, i.e. the latest `scene_range.end_frame` of its clip layers.
 * - `follow_narration`: the end of the scene's narration placement (`narration.set`, scene-local `scene_range`).
 *
 * Scenes play back to back in `scene_sequence` order. A length that cannot be derived is `null`; nothing is estimated.
 * A scene whose length is unresolved contributes zero frames to the start of the scenes after it (this is also what the
 * server's preview manifest does), so the strip, the axis and the playback clock share one timeline.
 *
 * Parity with the gateway is asserted by `scene-timing.test.ts` over `fixtures/scene-timing-parity.json`, the same
 * fixture the gateway unit test reads (copy guarded by a digest on both sides).
 */

export type SceneTimingPolicy = CompositionScene['timing_policy']

export type SparkResolvedScene = {
  sceneId: string
  /** 0-based strip position. */
  index: number
  policy: SceneTimingPolicy
  /** On the project timeline; an unresolved scene has length 0 here. */
  startFrame: number
  /** null = unresolved (follow_media without a clip, follow_narration without narration). */
  lengthFrames: number | null
  endFrame: number
}

export type SparkResolvedTimeline = {
  fps: { num: number; den: number }
  scenes: SparkResolvedScene[]
  /** Sum of the resolved lengths. */
  totalFrames: number
  unresolvedSceneIds: string[]
}

type FrameRange = { start_frame: number; end_frame: number }

function frameRange(value: unknown): FrameRange | null {
  if (!value || typeof value !== 'object') return null
  const range = value as Record<string, unknown>
  const start = range['start_frame']
  const end = range['end_frame']
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && (end as number) > (start as number) && (start as number) >= 0
    ? { start_frame: start as number, end_frame: end as number }
    : null
}

function mediaEnd(scene: CompositionScene): number | null {
  let end: number | null = null
  for (const layer of scene.layers) {
    if (layer.layer_kind !== 'clip') continue
    const placement = (layer as Record<string, unknown>)['placement']
    const range = frameRange(placement && typeof placement === 'object' ? (placement as Record<string, unknown>)['scene_range'] : undefined)
    if (range) end = Math.max(end ?? 0, range.end_frame)
  }
  return end
}

function narrationEnd(document: CompositionDocument, sceneId: string): number | null {
  let end: number | null = null
  for (const placement of document.audio.placements) {
    if (placement['role'] !== 'narration' || placement['scene_id'] !== sceneId) continue
    const range = frameRange(placement['scene_range'])
    if (range) end = Math.max(end ?? 0, range.end_frame)
  }
  return end
}

/** Length in frames of one scene by its timing policy, or null when the document cannot derive it yet. */
export function resolveSceneLength(document: CompositionDocument, scene: CompositionScene): number | null {
  if (scene.timing_policy === 'fixed') {
    return Number.isSafeInteger(scene.duration_frames) && (scene.duration_frames as number) >= 1
      ? (scene.duration_frames as number)
      : null
  }
  return scene.timing_policy === 'follow_media' ? mediaEnd(scene) : narrationEnd(document, scene.scene_id)
}

/** The project timeline of the strip: every scene of `scene_sequence` (an id without a scene body is skipped). */
export function resolveTimeline(document: CompositionDocument): SparkResolvedTimeline {
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  const scenes: SparkResolvedScene[] = []
  const unresolvedSceneIds: string[] = []
  let cursor = 0
  for (const sceneId of document.scene_sequence.scene_ids) {
    const scene = byId.get(sceneId)
    if (!scene) continue
    const lengthFrames = resolveSceneLength(document, scene)
    if (lengthFrames === null) unresolvedSceneIds.push(sceneId)
    scenes.push({
      sceneId,
      index: scenes.length,
      policy: scene.timing_policy,
      startFrame: cursor,
      lengthFrames,
      endFrame: cursor + (lengthFrames ?? 0),
    })
    cursor += lengthFrames ?? 0
  }
  return { fps: { num: document.canvas.fps.num, den: document.canvas.fps.den }, scenes, totalFrames: cursor, unresolvedSceneIds }
}

/** The scene that plays at an absolute project frame (half-open); null at or after the end, before 0, or with no scene. */
export function sceneAtFrame(timeline: SparkResolvedTimeline, frame: number): SparkResolvedScene | null {
  if (!Number.isFinite(frame) || frame < 0) return null
  // Binary search over the resolved scenes (unresolved ones are empty and never match).
  let low = 0
  let high = timeline.scenes.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const scene = timeline.scenes[mid]!
    if (frame < scene.startFrame) high = mid - 1
    else if (frame >= scene.endFrame) low = mid + 1
    else return scene
  }
  return null
}

export function framesToSeconds(fps: { num: number; den: number }, frames: number): number {
  return (frames * fps.den) / fps.num
}

export function secondsToFrames(fps: { num: number; den: number }, seconds: number): number {
  return Math.max(0, Math.round((seconds * fps.num) / fps.den))
}

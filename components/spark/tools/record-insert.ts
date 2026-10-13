import { newAudioPlacementId, newLayerId } from '@/lib/spark/composition-typed-edits'
import { pairPlacementSpecs, voicePlacementSpecs } from '@/lib/spark/recording/recording-placement'
import type { RecordingSaveDeps } from '@/lib/spark/recording/recording-session'
import { uploadRecordingFile } from '@/lib/spark/recording/recording-upload'
import { attachStorageObject, type AttachResult } from '@/lib/spark/source-attach-client'

import { insertProjectSource } from './insert-source'
import type { SparkToolContext } from './spark-tool-types'

/**
 * E1-F glue between the recorder session and the editor: the three steps of `RecordingSaveDeps` (upload into Storage,
 * attach as a project source, insert at the playhead) bound to the tool context. The context is read at call time (a
 * ref), because a save outlives the render that started it: the working copy version, the stage and the toast are the
 * freshest ones when each step runs.
 */

/**
 * What the drawer tells the user about an insert beyond "it worked" (the drawer owns the translated sentences; the
 * "saved" screen already says where the take went, and D11's trim / follow notices come from `ctx.placementNotice`).
 */
export type RecordingInsertNote = { kind: 'narrationReplaced' } | { kind: 'voiceRunsPast'; seconds: number }

/** Pacing of the wait for a recording to become a usable source (the media probe runs on the ingest lane). */
export const recordingTuning = {
  poll: { first: 1500, max: 5000, timeout: 180_000 },
}

type Sleep = (ms: number, signal: AbortSignal) => Promise<void>

const sleepAbortable: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })

/**
 * Binds the uploaded object to the project and waits for it to become usable. `not_ready` (Storage still finishing the
 * object: scan, processing) is retried like the probe wait of the attach client; both give up after the same window and
 * resolve `timeout`, which the drawer shows as "still processing" with a "check again".
 */
export async function attachRecording(
  ctx: () => SparkToolContext,
  input: { storageObjectId: string; checksumSha256: string; signal: AbortSignal },
  sleep: Sleep = sleepAbortable,
): Promise<AttachResult | { status: 'timeout' }> {
  const poll = recordingTuning.poll
  const started = Date.now()
  let delay = poll.first
  for (;;) {
    const current = ctx()
    const result = await attachStorageObject({
      projectId: current.project.id,
      storageObjectId: input.storageObjectId,
      checksum: input.checksumSha256,
      provenance: 'upload',
      baseRevision: () => ctx().composition.workingCopy?.workingCopyVersion ?? 0,
      refresh: () => ctx().actions.refresh?.() ?? Promise.resolve(),
      signal: input.signal,
      pollMs: poll,
    })
    if (result.status === 'awaiting_probe') return { status: 'timeout' }
    if (result.status !== 'failed' || result.reason !== 'not_ready') return result
    if (Date.now() - started >= poll.timeout) return { status: 'timeout' }
    await sleep(delay, input.signal)
    delay = Math.min(poll.max, Math.round(delay * 1.5))
  }
}

/** Puts a saved take on the timeline at the playhead: ONE command (one undo group) per take. */
export async function insertRecording(
  ctx: SparkToolContext,
  input: Parameters<RecordingSaveDeps['insert']>[0],
  notify: (notes: RecordingInsertNote[]) => void,
): Promise<{ applied: boolean; sceneNumber: number | null }> {
  const { take, sources } = input
  const controller = ctx.stage?.controller
  if (!controller) return { applied: false, sceneNumber: null }
  const uuid = () => globalThis.crypto.randomUUID()

  if (take.mode === 'screen' || take.mode === 'camera') {
    const sourceId = sources[take.mode]
    if (!sourceId) return { applied: false, sceneNumber: null }
    // The shared media path: D11 fits a clip that is longer than its scene and tells the user.
    const sceneNumber = await insertProjectSource(ctx, sourceId, 'video')
    return sceneNumber === null ? { applied: false, sceneNumber: null } : { applied: true, sceneNumber }
  }

  if (take.mode === 'screen_camera') {
    const screenSourceId = sources.screen
    const cameraSourceId = sources.camera
    if (!screenSourceId || !cameraSourceId) return { applied: false, sceneNumber: null }
    const camera = take.parts.find((part) => part.role === 'camera')
    const result = await controller.placeLayer(
      (placement, document) => {
        const cameraLayerId = newLayerId(uuid())
        const planned = pairPlacementSpecs({
          document,
          placement,
          screenSourceId,
          cameraSourceId,
          screenLayerId: newLayerId(uuid()),
          cameraLayerId,
          cameraSize: camera ? { width: camera.width, height: camera.height } : null,
        })
        // The camera clip is the one to select: it is the one the user moves.
        return { specs: planned.specs, selectLayerId: cameraLayerId, notice: planned.notice }
      },
      { kind: 'playhead' },
      { refresh: true },
    )
    if (result.notice) ctx.placementNotice(result.notice)
    return { applied: result.applied, sceneNumber: result.applied ? controller.currentSceneNumber() : null }
  }

  const sourceId = sources.voice
  if (!sourceId) return { applied: false, sceneNumber: null }
  let notes: RecordingInsertNote[] = []
  const result = await controller.placeLayer(
    (placement, document) => {
      const planned = voicePlacementSpecs({ document, placement, sourceId, placementId: newAudioPlacementId(uuid()) })
      if (!planned) return null
      notes = [
        ...(planned.replacedNarration ? [{ kind: 'narrationReplaced' } as const] : []),
        ...(planned.runsPastScene ? [{ kind: 'voiceRunsPast', seconds: planned.runsPastScene.seconds } as const] : []),
      ]
      return { specs: planned.specs, selectLayerId: null }
    },
    { kind: 'playhead' },
    { refresh: true },
  )
  if (result.applied && notes.length > 0) notify(notes)
  return { applied: result.applied, sceneNumber: result.applied ? controller.currentSceneNumber() : null }
}

/**
 * T1R-9: is the take already on the timeline? The document is read again first (an earlier insert may have applied after
 * the held copy was read), then every source of the take is looked for in the scenes' clips and the audio placements.
 */
export async function findRecording(
  ctx: () => SparkToolContext,
  input: Parameters<NonNullable<RecordingSaveDeps['find']>>[0],
): Promise<{ sceneNumber: number | null } | null> {
  await ctx().actions.refresh?.()
  const document = ctx().latest().workingCopy?.document
  if (!document) throw new Error('The working copy is not loaded')
  const sourceIds = new Set(Object.values(input.sources))
  const usesSource = (layer: unknown): boolean => {
    const placement = (layer as { layer_kind?: unknown; placement?: { source_id?: unknown } }).placement
    return typeof placement?.source_id === 'string' && sourceIds.has(placement.source_id)
  }
  const index = document.scene_sequence.scene_ids.findIndex((sceneId) => {
    const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
    const placed = document.audio.placements.some((entry) => {
      const placement = entry as unknown as { scene_id?: unknown; source_id?: unknown }
      return placement.scene_id === sceneId && typeof placement.source_id === 'string' && sourceIds.has(placement.source_id)
    })
    return placed || (scene?.layers.some(usesSource) ?? false)
  })
  if (index >= 0) return { sceneNumber: index + 1 }
  // A project-wide audio placement (no scene) still means the take is in.
  const global = document.audio.placements.some((entry) => {
    const source = (entry as unknown as { source_id?: unknown }).source_id
    return typeof source === 'string' && sourceIds.has(source)
  })
  return global ? { sceneNumber: null } : null
}

/** The upload into "Recordings", also run on its own by the session the moment a recording stops (T1R-10). */
export function recordingUploader(ctx: () => SparkToolContext): RecordingSaveDeps['upload'] {
  return (part, context) =>
    uploadRecordingFile({
      channelId: ctx().project.channelId,
      part,
      startedAt: context.startedAt,
      onProgress: context.onProgress,
      signal: context.signal,
    })
}

/** The save dependencies of one drawer: everything reads the freshest context through `ctx()`. */
export function recordingSaveDeps(ctx: () => SparkToolContext, notify: (notes: RecordingInsertNote[]) => void): RecordingSaveDeps {
  return {
    upload: recordingUploader(ctx),
    attach: (input) => attachRecording(ctx, input),
    insert: (input) => insertRecording(ctx(), input, notify),
    find: (input) => findRecording(ctx, input),
  }
}

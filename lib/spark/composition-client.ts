import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayConditionalRequest, gatewayRequest } from '@/lib/gateway/client'

import { sparkAspectRatios } from './api'
import { resolveSceneLength } from './scene-timing'

/**
 * Spark's single client adapter for the Composition API (P02-01): reads the working copy and
 * writes every change as one `composition_command_v1` envelope (base_revision + read_set,
 * idempotency key, undo group). The editor never sends a partial document and never keeps
 * product data in browser storage; selection and view state stay local and are never commands.
 *
 * Typed edit ops (P02-06) are `CompositionOpSpec` builders in `composition-typed-edits.ts`;
 * the envelope, CAS, idempotency, conflict and undo handling stay here.
 */

// ---------------------------------------------------------------- document (composition_document_v1)

const revSchema = z.number().int().min(1)

const layerSchema = z
  .object({ layer_id: z.string().min(1), rev: revSchema, layer_kind: z.string().min(1) })
  .passthrough()

/**
 * A project overlay (`project_overlays.layers[]`) is not a scene layer: the contract gives it an `overlay_kind`
 * (logo, watermark, lower_third) over a project range and no `layer_kind`.
 */
const projectOverlayLayerSchema = z
  .object({ layer_id: z.string().min(1), rev: revSchema, overlay_kind: z.string().min(1) })
  .passthrough()

const sectionSchema = z
  .object({
    section_id: z.string().min(1),
    rev: revSchema,
    title: z.string(),
    script_chapter_id: z.string().optional(),
  })
  .passthrough()

export const compositionTimingPolicies = ['fixed', 'follow_media', 'follow_narration'] as const

const sceneSchema = z
  .object({
    scene_id: z.string().min(1),
    rev: revSchema,
    origin: z.string(),
    timing_policy: z.enum(compositionTimingPolicies),
    duration_frames: z.number().int().positive().optional(),
    section_id: z.string().nullable(),
    layers: z.array(layerSchema),
  })
  .passthrough()

export const compositionDocumentSchema = z
  .object({
    schema_version: z.number().int(),
    project_id: z.string().min(1),
    working_copy_version: z.number().int().min(0),
    canvas: z
      .object({
        aspect_ratio: z.enum(sparkAspectRatios),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        fps: z.object({ num: z.number().int().positive(), den: z.number().int().positive() }),
      })
      .passthrough(),
    sections: z.array(sectionSchema),
    scene_sequence: z.object({ rev: revSchema, scene_ids: z.array(z.string().min(1)) }),
    scenes: z.array(sceneSchema),
    project_overlays: z.object({ rev: revSchema, layers: z.array(projectOverlayLayerSchema) }).passthrough(),
    audio: z
      .object({
        rev: revSchema,
        placements: z.array(z.object({ placement_id: z.string().min(1), rev: revSchema }).passthrough()),
      })
      .passthrough(),
    caption_tracks: z.array(z.object({ caption_track_id: z.string().min(1), rev: revSchema }).passthrough()),
    source_media: z.array(z.object({ source_id: z.string().min(1) }).passthrough()),
  })
  .passthrough()

export type CompositionDocument = z.output<typeof compositionDocumentSchema>
export type CompositionScene = CompositionDocument['scenes'][number]
export type CompositionSection = CompositionDocument['sections'][number]

export const compositionProjectRoles = ['owner', 'editor', 'viewer'] as const
export type CompositionProjectRole = (typeof compositionProjectRoles)[number]

const workingCopyResponseSchema = z.object({
  data: z.object({
    project_id: z.string().min(1),
    working_copy_version: z.number().int().min(0),
    schema_version: z.number().int(),
    role: z.enum(compositionProjectRoles),
    document: compositionDocumentSchema,
  }),
})

export type CompositionWorkingCopy = {
  projectId: string
  /** The `base_revision` of the next command. */
  workingCopyVersion: number
  role: CompositionProjectRole
  document: CompositionDocument
  /** P02-15 validator of this body (role and access included); sent back as If-None-Match. */
  etag?: string | null
  /**
   * E1-N: > 0 when `document` is the server's document with edits applied on top that the server has not confirmed yet
   * (the editor's optimistic copy); it changes with every such change, so a consumer can tell two local pictures apart
   * although `workingCopyVersion` (always the server's) did not move. Absent: the document is the server's own.
   */
  localRevision?: number
}

// ---------------------------------------------------------------- command envelope

export const compositionEntityKinds = [
  'scene_sequence',
  'section',
  'scene',
  'layer',
  'project_overlays',
  'audio',
  'caption_track',
  'pending_slot',
  'source_media',
  'canvas',
  'template_instance',
] as const
export type CompositionEntityKind = (typeof compositionEntityKinds)[number]

export type CompositionEntityRef = { entity_kind: CompositionEntityKind; entity_id: string }
export type CompositionEntityRevRef = CompositionEntityRef & { entity_rev: number }
export type CompositionRawOp = { op: string } & Record<string, unknown>

/** Containers without an id field are addressed by their kind name (P02-01 open question 2). */
export const SCENE_SEQUENCE_REF: CompositionEntityRef = { entity_kind: 'scene_sequence', entity_id: 'scene_sequence' }

/**
 * One typed op and the CAS parts it needs. `reads` are the existing entities the op depends on
 * (their current revs go to read_set); `targets` are the entities it changes, including ones it
 * creates. The P02-06 builders (`composition-typed-edits.ts`) return this shape.
 */
export type CompositionOpSpec = {
  op: CompositionRawOp
  reads: CompositionEntityRef[]
  targets: CompositionEntityRef[]
}

export type CompositionCommandBody = {
  idempotency_key: string
  base_revision: number
  read_set: CompositionEntityRevRef[]
  targets: CompositionEntityRef[]
  undo_policy: 'recorded'
  undo_group_id: string
  ops: CompositionRawOp[]
}

const entityRefSchema = z.object({ entity_kind: z.string(), entity_id: z.string() })
const entityRevRefSchema = entityRefSchema.extend({ entity_rev: z.number().int() })

const commandReceiptResponseSchema = z.object({
  data: z.object({
    command_id: z.string().min(1),
    outcome: z.enum(['applied', 'rebased', 'replayed']),
    receipt_status: z.literal('applied'),
    base_revision: z.number().int(),
    working_copy_version_before: z.number().int(),
    working_copy_version: z.number().int(),
    undo_group_id: z.string().nullable(),
    changed_entities: z.array(entityRevRefSchema),
    removed_entities: z.array(entityRefSchema),
    auto_checkpoint_revision_id: z.string().nullable(),
  }),
})
export type CompositionCommandReceipt = z.output<typeof commandReceiptResponseSchema>['data']

const undoReceiptResponseSchema = z.object({
  data: z.object({
    command_id: z.string().min(1),
    outcome: z.enum(['undone', 'nothing_to_undo']),
    undo_group_id: z.string().nullable(),
    working_copy_version: z.number().int(),
    changed_entities: z.array(entityRevRefSchema),
    removed_entities: z.array(entityRefSchema),
    auto_checkpoint_revision_id: z.string().nullable(),
    replayed: z.boolean(),
  }),
})
export type CompositionUndoReceipt = z.output<typeof undoReceiptResponseSchema>['data']

/** Spark redo: the undo receipt's shape; `undo_group_id` names the group applied again. */
const redoReceiptResponseSchema = z.object({
  data: z.object({
    command_id: z.string().min(1),
    outcome: z.enum(['redone', 'nothing_to_redo']),
    undo_group_id: z.string().nullable(),
    working_copy_version: z.number().int(),
    changed_entities: z.array(entityRevRefSchema),
    removed_entities: z.array(entityRefSchema),
    auto_checkpoint_revision_id: z.string().nullable(),
    replayed: z.boolean(),
  }),
})
export type CompositionRedoReceipt = z.output<typeof redoReceiptResponseSchema>['data']

// ---------------------------------------------------------------- transport

function projectPath(projectId: string, suffix: string) {
  return `/api/v1/composition/projects/${encodeURIComponent(projectId)}${suffix}`
}

/** P02-15: a read replica has not caught up with the caller's own write yet (retryable 503). */
export const COMPOSITION_READ_REPLICA_LAG = 'COMPOSITION_READ_REPLICA_LAG'
const REPLICA_LAG_ATTEMPTS = 3
const REPLICA_LAG_DELAY_MS = 1000

function waitFor(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Retries a read a bounded number of times while the gateway answers replica lag (never a 404). */
export async function withReplicaLagRetry<T>(
  read: () => Promise<T>,
  options: { signal?: AbortSignal; delayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      const lag = error instanceof AuthClientError && error.code === COMPOSITION_READ_REPLICA_LAG
      if (!lag || attempt >= REPLICA_LAG_ATTEMPTS) throw error
      await waitFor(options.delayMs ?? REPLICA_LAG_DELAY_MS, options.signal)
    }
  }
}

/**
 * Reads the working copy. `minVersion` is the P02-15 read floor: the working copy version the
 * editor's own last command or undo returned, so a lagging read replica never hands back an
 * older document. `revalidate` is the working copy the editor holds: its ETag goes out as
 * If-None-Match and a 304 (same version, role and access) returns that same object without a body.
 */
export async function getCompositionWorkingCopy(
  projectId: string,
  options: { signal?: AbortSignal; minVersion?: number; revalidate?: CompositionWorkingCopy | null } = {},
): Promise<CompositionWorkingCopy> {
  const query = options.minVersion !== undefined ? `?min_working_copy_version=${options.minVersion}` : ''
  const held = options.revalidate?.etag ? options.revalidate : null
  const response = await withReplicaLagRetry(
    () => gatewayConditionalRequest(projectPath(projectId, `/document${query}`), {
      schema: workingCopyResponseSchema,
      signal: options.signal,
      ifNoneMatch: held?.etag ?? null,
    }),
    { signal: options.signal },
  )
  if (response.notModified) {
    if (held) return held
    // A 304 to a read that sent no validator is not a valid answer.
    throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
  }
  const { data } = response.data
  if (data.document.working_copy_version !== data.working_copy_version) {
    throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
  }
  return {
    projectId: data.project_id,
    workingCopyVersion: data.working_copy_version,
    role: data.role,
    document: data.document,
    etag: response.etag,
  }
}

export async function executeCompositionCommand(
  projectId: string,
  body: CompositionCommandBody,
  options: { signal?: AbortSignal } = {},
): Promise<CompositionCommandReceipt> {
  const response = await gatewayRequest(projectPath(projectId, '/commands'), {
    method: 'POST',
    csrf: true,
    body,
    schema: commandReceiptResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function undoCompositionCommand(
  projectId: string,
  body: { idempotency_key: string; undo_group_id?: string },
  options: { signal?: AbortSignal } = {},
): Promise<CompositionUndoReceipt> {
  const response = await gatewayRequest(projectPath(projectId, '/undo'), {
    method: 'POST',
    csrf: true,
    body,
    schema: undoReceiptResponseSchema,
    signal: options.signal,
  })
  return response.data
}

/**
 * Spark redo: applies the caller's most recently undone group again (`undo_group_id` = the group the editor shows on top of
 * its redo stack; a different top is a 409 `COMPOSITION_REDO_STACK_CHANGED`).
 */
export async function redoCompositionCommand(
  projectId: string,
  body: { idempotency_key: string; undo_group_id?: string },
  options: { signal?: AbortSignal } = {},
): Promise<CompositionRedoReceipt> {
  const response = await gatewayRequest(projectPath(projectId, '/redo'), {
    method: 'POST',
    csrf: true,
    body,
    schema: redoReceiptResponseSchema,
    signal: options.signal,
  })
  return response.data
}

/** The Composition calls the Spark editor makes; tests pass a fake. */
export type CompositionTransport = {
  getWorkingCopy: typeof getCompositionWorkingCopy
  executeCommand: typeof executeCompositionCommand
  undo: typeof undoCompositionCommand
  /** Spark redo; absent in a transport that has none (the editor then offers no redo). */
  redo?: typeof redoCompositionCommand
}

export const compositionGatewayTransport: CompositionTransport = {
  getWorkingCopy: getCompositionWorkingCopy,
  executeCommand: executeCompositionCommand,
  undo: undoCompositionCommand,
  redo: redoCompositionCommand,
}

// ---------------------------------------------------------------- CAS helpers

function entityKey(ref: CompositionEntityRef) {
  return `${ref.entity_kind}:${ref.entity_id}`
}

/** Current rev of every versioned entity of the document (same index as the gateway, F27). */
export function indexCompositionRevs(document: CompositionDocument): Map<string, number> {
  const revs = new Map<string, number>()
  const put = (entity_kind: CompositionEntityKind, entity_id: string, rev: number) => {
    revs.set(entityKey({ entity_kind, entity_id }), rev)
  }
  put('scene_sequence', 'scene_sequence', document.scene_sequence.rev)
  put('project_overlays', 'project_overlays', document.project_overlays.rev)
  put('audio', 'audio', document.audio.rev)
  for (const section of document.sections) put('section', section.section_id, section.rev)
  for (const scene of document.scenes) {
    put('scene', scene.scene_id, scene.rev)
    for (const layer of scene.layers) {
      put(layer.layer_kind === 'pending_slot' ? 'pending_slot' : 'layer', layer.layer_id, layer.rev)
    }
  }
  for (const layer of document.project_overlays.layers) put('layer', layer.layer_id, layer.rev)
  for (const placement of document.audio.placements) put('audio', placement.placement_id, placement.rev)
  // P06-63: the AudioMixPlan is always addressable; an absent plan is the default plan at rev 1 (gateway rule).
  put('audio', 'mix_plan', (document.audio as { mix_plan?: { rev?: number } }).mix_plan?.rev ?? 1)
  for (const track of document.caption_tracks) put('caption_track', track.caption_track_id, track.rev)
  // P06-03 template instances (composition_document_v1 additive field; the passthrough schema keeps it).
  const instances = (document as { template_instances?: Array<{ instance_id?: unknown; rev?: unknown }> }).template_instances ?? []
  for (const instance of instances) {
    if (typeof instance.instance_id === 'string' && typeof instance.rev === 'number') put('template_instance', instance.instance_id, instance.rev)
  }
  return revs
}

/** The editor's state no longer matches the document it tries to change (reload before editing). */
export class CompositionStaleReadError extends Error {
  constructor(readonly entity: CompositionEntityRef) {
    super(`Entity ${entityKey(entity)} is not in the working copy`)
    this.name = 'CompositionStaleReadError'
  }
}

/** The CAS view a command is built from: the version it is based on and the current rev of every versioned entity. */
export type CompositionRevIndex = { baseRevision: number; revs: ReadonlyMap<string, number> }

/** The CAS state of the document the user sees. */
export function compositionRevIndex(document: CompositionDocument): CompositionRevIndex {
  return { baseRevision: document.working_copy_version, revs: indexCompositionRevs(document) }
}

/**
 * Y1-07 W7 receipt chaining: the CAS state after a command the server applied. `changed_entities` carry the new revs
 * (created entities included), `removed_entities` are gone; every other entity keeps the rev it had. The next queued
 * command is built from this instead of a full re-read; an entity another actor changed meanwhile is still caught by the
 * server's CAS (a `conflict`, then the editor reloads).
 */
export function chainCompositionRevIndex(
  index: CompositionRevIndex,
  receipt: Pick<CompositionCommandReceipt, 'working_copy_version' | 'changed_entities' | 'removed_entities'>,
): CompositionRevIndex {
  const revs = new Map(index.revs)
  for (const entity of receipt.changed_entities) revs.set(entityKey(entity as CompositionEntityRef), entity.entity_rev)
  for (const entity of receipt.removed_entities) revs.delete(entityKey(entity as CompositionEntityRef))
  return { baseRevision: receipt.working_copy_version, revs }
}

/**
 * Builds the CAS part of one command from the document the user saw: base_revision is its
 * working copy version, read_set the current revs of every read entity and targets exactly the
 * entities the ops change (the gateway refuses a mismatch).
 */
export function buildCompositionCommand(
  document: CompositionDocument,
  specs: readonly CompositionOpSpec[],
): Omit<CompositionCommandBody, 'idempotency_key' | 'undo_group_id' | 'undo_policy'> {
  return buildCompositionCommandFrom(compositionRevIndex(document), specs)
}

/** The same from a CAS state (the document the user saw, or the state chained from the last receipt). */
export function buildCompositionCommandFrom(
  index: CompositionRevIndex,
  specs: readonly CompositionOpSpec[],
): Omit<CompositionCommandBody, 'idempotency_key' | 'undo_group_id' | 'undo_policy'> {
  if (specs.length === 0) throw new Error('A composition command needs at least one op')
  const revs = index.revs
  const created = new Set<string>()
  const readSet = new Map<string, CompositionEntityRevRef>()
  const targets = new Map<string, CompositionEntityRef>()
  for (const spec of specs) {
    for (const read of spec.reads) {
      const key = entityKey(read)
      // An entity created earlier in the same command has no rev the caller could have read.
      if (created.has(key) || readSet.has(key)) continue
      const rev = revs.get(key)
      if (rev === undefined) throw new CompositionStaleReadError(read)
      readSet.set(key, { ...read, entity_rev: rev })
    }
    for (const target of spec.targets) {
      const key = entityKey(target)
      targets.set(key, target)
      if (!revs.has(key)) created.add(key)
    }
  }
  return {
    base_revision: index.baseRevision,
    read_set: [...readSet.values()],
    targets: [...targets.values()],
    ops: specs.map((spec) => spec.op),
  }
}

// ---------------------------------------------------------------- op builders (P02-01 ops)

const sceneRef = (sceneId: string): CompositionEntityRef => ({ entity_kind: 'scene', entity_id: sceneId })
const sectionRef = (sectionId: string): CompositionEntityRef => ({ entity_kind: 'section', entity_id: sectionId })

/** Client-chosen ids of new entities must be `<prefix>_<uuid>` (never reused after a delete). */
export function newSceneId(uuid: string) {
  return `scn_${uuid}`
}

export function newSectionId(uuid: string) {
  return `sec_${uuid}`
}

export function sceneInsertSpec(input: {
  sceneId: string
  afterSceneId: string | null
  durationFrames: number
  sectionId?: string | null
}): CompositionOpSpec {
  const sectionId = input.sectionId ?? null
  return {
    op: {
      op: 'scene.insert',
      scene_id: input.sceneId,
      after_scene_id: input.afterSceneId,
      timing_policy: 'fixed',
      duration_frames: input.durationFrames,
      section_id: sectionId,
      origin: 'authored',
    },
    reads: [SCENE_SEQUENCE_REF, ...(sectionId ? [sectionRef(sectionId)] : [])],
    targets: [SCENE_SEQUENCE_REF, sceneRef(input.sceneId)],
  }
}

export function sceneRemoveSpec(sceneId: string): CompositionOpSpec {
  return {
    op: { op: 'scene.remove', scene_id: sceneId },
    reads: [SCENE_SEQUENCE_REF, sceneRef(sceneId)],
    targets: [SCENE_SEQUENCE_REF, sceneRef(sceneId)],
  }
}

export function sceneReorderSpec(sceneId: string, afterSceneId: string | null): CompositionOpSpec {
  return {
    op: { op: 'scene.reorder', scene_id: sceneId, after_scene_id: afterSceneId },
    reads: [SCENE_SEQUENCE_REF],
    targets: [SCENE_SEQUENCE_REF],
  }
}

export function sceneSetSectionSpec(sceneId: string, sectionId: string | null): CompositionOpSpec {
  return {
    op: { op: 'scene.set_section', scene_id: sceneId, section_id: sectionId },
    reads: [sceneRef(sceneId), ...(sectionId ? [sectionRef(sectionId)] : [])],
    targets: [sceneRef(sceneId)],
  }
}

export function sectionInsertSpec(input: {
  sectionId: string
  title: string
  afterSectionId: string | null
  scriptChapterId?: string | null
}): CompositionOpSpec {
  return {
    op: {
      op: 'section.insert',
      section_id: input.sectionId,
      title: input.title,
      script_chapter_id: input.scriptChapterId ?? null,
      after_section_id: input.afterSectionId,
    },
    reads: input.afterSectionId ? [sectionRef(input.afterSectionId)] : [],
    targets: [sectionRef(input.sectionId)],
  }
}

export function sectionUpdateSpec(
  sectionId: string,
  patch: { title?: string; scriptChapterId?: string | null },
): CompositionOpSpec {
  if (patch.title === undefined && patch.scriptChapterId === undefined) {
    throw new Error('section.update needs title or scriptChapterId')
  }
  return {
    op: {
      op: 'section.update',
      section_id: sectionId,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.scriptChapterId !== undefined && { script_chapter_id: patch.scriptChapterId }),
    },
    reads: [sectionRef(sectionId)],
    targets: [sectionRef(sectionId)],
  }
}

export function sectionRemoveSpec(sectionId: string): CompositionOpSpec {
  return {
    op: { op: 'section.remove', section_id: sectionId },
    reads: [sectionRef(sectionId)],
    targets: [sectionRef(sectionId)],
  }
}

// ---------------------------------------------------------------- document reading helpers

/** Scenes in strip order (`scenes` is a set keyed by id; the order lives in scene_sequence). */
export function orderedScenes(document: CompositionDocument): CompositionScene[] {
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  return document.scene_sequence.scene_ids.flatMap((id) => {
    const scene = byId.get(id)
    return scene ? [scene] : []
  })
}

/**
 * Seconds of a scene at its RESOLVED length (Y1-07 W4: fixed duration, end of the scene's media, end of its narration;
 * the same rule as the gateway's scene timing). null only while the document cannot derive a length yet.
 */
export function sceneDurationSeconds(document: CompositionDocument, scene: CompositionScene): number | null {
  const frames = resolveSceneLength(document, scene)
  if (frames === null) return null
  const { num, den } = document.canvas.fps
  return (frames * den) / num
}

/** Frames of `seconds` at the document frame rate (F35 CFR). */
export function framesForSeconds(document: CompositionDocument, seconds: number): number {
  const { num, den } = document.canvas.fps
  return Math.max(1, Math.round((seconds * num) / den))
}

// ---------------------------------------------------------------- errors

export type CompositionFailureKind =
  | 'conflict'
  | 'undo_conflict'
  /** Spark redo: another edit changed the group after its undo, or the redo stack moved (a new edit, another device). */
  | 'redo_conflict'
  | 'forbidden'
  | 'not_found'
  | 'not_active'
  | 'rejected'
  | 'unknown_outcome'
  | 'failed'

/** Spark undo / redo: the server's stack top is not the group the editor expected (another tab, an agent job, a new edit). */
export function compositionHistoryStackChanged(error: unknown): boolean {
  return error instanceof AuthClientError && (error.code === 'COMPOSITION_UNDO_STACK_CHANGED' || error.code === 'COMPOSITION_REDO_STACK_CHANGED')
}

/**
 * How the editor reacts to a failed Composition call. `unknown_outcome` means the request may
 * have been applied (network loss or timeout): it is retried with the same idempotency key.
 */
export function classifyCompositionError(error: unknown): CompositionFailureKind {
  if (!(error instanceof AuthClientError)) return 'failed'
  if (error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT') return 'unknown_outcome'
  if (error.code === 'COMPOSITION_PROJECT_NOT_FOUND' || error.status === 404) return 'not_found'
  if (error.code === 'COMPOSITION_PROJECT_FORBIDDEN') return 'forbidden'
  if (error.code === 'COMPOSITION_PROJECT_NOT_ACTIVE') return 'not_active'
  if (error.code === 'COMPOSITION_UNDO_CONFLICT' || error.code === 'COMPOSITION_UNDO_STACK_CHANGED') return 'undo_conflict'
  if (error.code === 'COMPOSITION_REDO_CONFLICT' || error.code === 'COMPOSITION_REDO_STACK_CHANGED') return 'redo_conflict'
  if (error.code.startsWith('COMPOSITION_') && error.status === 409) return 'conflict'
  // 400: invalid for the current document; 422: not available in document v1 (e.g. motion.edit).
  if (error.code.startsWith('COMPOSITION_') && (error.status === 400 || error.status === 422)) return 'rejected'
  return 'failed'
}

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayConditionalRequest, gatewayRequest } from '@/lib/gateway/client'

import { getStorageDownloadUrl, getStoragePlaybackUrl } from '@/lib/storage/api'

import { sparkAspectRatios } from './api'

/**
 * Y1-07 W1: the browser's client of the preview reads (`GET /api/v1/composition/projects/{id}/preview` and
 * `.../preview/scenes/{sceneId}`). The manifest is a pure function of the working copy (per-scene resolved timing,
 * dependency hash, native video layers, warnings, safe area, pinned font faces); one scene's Motion IR is compiled on
 * demand by the gateway with `scene_compiler@1` in preview mode, so text is laid out once, with the pinned fonts, and
 * the browser never re-wraps it. Types are the wire shapes (snake_case), validated here.
 */

const rational = z.object({ num: z.number().int().positive(), den: z.number().int().positive() })
const frameRange = z.object({ start_frame: z.number().int().min(0), end_frame: z.number().int().min(1) })
const box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })

export const sparkPreviewIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  scene_id: z.string().optional(),
  layer_id: z.string().optional(),
})
export type SparkPreviewIssue = z.output<typeof sparkPreviewIssueSchema>

export const sparkPreviewFontFaceSchema = z.object({
  font_id: z.string(),
  font_revision: z.string(),
  family: z.string(),
  weight: z.number().int(),
  style: z.enum(['normal', 'italic']),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  url: z.string(),
})
export type SparkPreviewFontFace = z.output<typeof sparkPreviewFontFaceSchema>

export const sparkPreviewNativeLayerSchema = z.object({
  layer_id: z.string(),
  kind: z.literal('video'),
  z_index: z.number().int().min(0),
  source_id: z.string(),
  storage_object_id: z.string(),
  /** Route that plays the object: the range-capable playback BFF (`getStoragePlaybackUrl`). */
  delivery: z.literal('storage_playback'),
  scene_range: frameRange,
  source_range: z.object({ in_tick: z.number().int(), out_tick: z.number().int() }),
  source_timebase: rational,
  transform: z
    .object({ x: z.number(), y: z.number(), scale: z.number(), rotation_deg: z.number() })
    .nullable(),
  audio: z.object({ gain_db: z.number().optional(), muted: z.boolean().optional() }).nullable(),
})
export type SparkPreviewNativeLayer = z.output<typeof sparkPreviewNativeLayerSchema>

export const sparkPreviewSceneStatuses = ['ready', 'partial', 'unavailable'] as const

/**
 * E1-L (D8): the transition INTO a scene as the gateway plans it (a pure function of the working copy). `ready`: the
 * segment document can be read and is drawn over `[start_frame, start_frame + duration_frames)`; `unavailable`: the boundary
 * plays as a cut and `reason` says why (`scene_has_video`, `scene_length_unresolved`, `scene_too_short`, ...).
 */
export const sparkPreviewTransitionEntrySchema = z.object({
  status: z.enum(['ready', 'unavailable']),
  reason: z.string().nullable(),
  kind: z.string(),
  params: z.object({ direction: z.string().optional(), color: z.string().optional(), easing: z.string().optional() }).nullable(),
  from_scene_id: z.string(),
  requested_frames: z.number().int().min(1),
  duration_frames: z.number().int().min(1).nullable(),
  from_frames: z.number().int().min(1).nullable(),
  to_frames: z.number().int().min(1).nullable(),
  clamped: z.boolean(),
  start_frame: z.number().int().min(0).nullable(),
  document_frame_offset: z.number().int().min(0).nullable(),
  dependency_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
})
export type SparkPreviewTransitionEntry = z.output<typeof sparkPreviewTransitionEntrySchema>

export const sparkPreviewSceneEntrySchema = z.object({
  scene_id: z.string(),
  index: z.number().int().min(0),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().min(1).nullable(),
  resolved_by: z.enum(['fixed', 'follow_media', 'follow_narration']),
  dependency_hash: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.enum(sparkPreviewSceneStatuses),
  warnings: z.array(sparkPreviewIssueSchema),
  native_layers: z.array(sparkPreviewNativeLayerSchema),
  /** E1-L: present only when the scene stores a transition (and it is not the first scene's inert one). */
  transition_in: sparkPreviewTransitionEntrySchema.optional(),
})
export type SparkPreviewScene = z.output<typeof sparkPreviewSceneEntrySchema>

export const sparkPreviewManifestSchema = z.object({
  schema_version: z.literal('composition_preview_v1'),
  project_id: z.string(),
  working_copy_version: z.number().int().min(0),
  scene_compiler_version: z.number().int(),
  motion_runtime_version: z.string(),
  canvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    aspect_ratio: z.enum(sparkAspectRatios),
    fps: rational,
  }),
  total_frames: z.number().int().min(0),
  dependency_hash: z.string(),
  safe_area: z.object({ profile: z.string(), rect: box, caption: box }),
  fonts: z.object({ font_set_hash: z.string(), faces: z.array(sparkPreviewFontFaceSchema) }),
  warnings: z.array(sparkPreviewIssueSchema),
  /** E1-L: present (true) only while the gateway draws scene transitions (`COMPOSITION_TRANSITIONS_ENABLED`). */
  transitions_enabled: z.literal(true).optional(),
  scenes: z.array(sparkPreviewSceneEntrySchema),
})
export type SparkPreviewManifest = z.output<typeof sparkPreviewManifestSchema>

export const sparkPreviewAssetSchema = z.object({
  key: z.string(),
  media_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byte_size: z.number().int().min(0),
  storage_object_id: z.string(),
  /** Route that fetches the image: `storage_download` (`getStorageDownloadUrl`), never the 2 MiB-capped playback BFF. */
  delivery: z.literal('storage_download'),
})
export type SparkPreviewAsset = z.output<typeof sparkPreviewAssetSchema>

/**
 * The URL of a preview ref, by the route the ref itself names (`delivery`): an image the scene IR draws comes through
 * `/api/storage/download` (authorised redirect to a short-lived CDN URL, no body cap), a video clip through
 * `/api/storage/playback` (HTTP range). The playback route caps every body at 2 MiB and would truncate a large image, so
 * images must not use it; this helper is the one place that rule lives.
 */
export function sparkPreviewRefUrl(
  channelId: string,
  ref: Pick<SparkPreviewAsset, 'storage_object_id' | 'delivery'> | Pick<SparkPreviewNativeLayer, 'storage_object_id' | 'delivery'>,
  options: { fileName?: string } = {},
): string {
  const input = { channelId, objectId: ref.storage_object_id }
  return ref.delivery === 'storage_playback'
    ? getStoragePlaybackUrl(input)
    : getStorageDownloadUrl({ ...input, fileName: options.fileName ?? ref.storage_object_id })
}

export const sparkPreviewSceneIrSchema = z.object({
  scene_id: z.string(),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().min(1),
  dependency_hash: z.string().regex(/^[0-9a-f]{64}$/),
  /** `motion-ir@1` document for scene-local frames; opaque to the UI, handed to the motion runtime as is. */
  document: z.record(z.string(), z.unknown()),
  assets: z.array(sparkPreviewAssetSchema),
  warnings: z.array(sparkPreviewIssueSchema),
  native_layers: z.array(sparkPreviewNativeLayerSchema),
})
export type SparkPreviewSceneIr = z.output<typeof sparkPreviewSceneIrSchema>

/**
 * E1-L: the transition segment into a scene (`GET .../preview/transitions/{sceneId}`): ONE Motion IR document, a sheet of the
 * two neighbour scenes and the blend. The project frames `[start_frame, start_frame + duration_frames)` are drawn from it at
 * document frames `document_frame_offset + (frame - start_frame)`; the images of both scenes are in `assets`.
 */
export const sparkPreviewTransitionSchema = z.object({
  scene_id: z.string(),
  from_scene_id: z.string(),
  kind: z.string(),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().min(2),
  document_frame_offset: z.number().int().min(0),
  dependency_hash: z.string().regex(/^[0-9a-f]{64}$/),
  document: z.record(z.string(), z.unknown()),
  assets: z.array(sparkPreviewAssetSchema),
  warnings: z.array(sparkPreviewIssueSchema),
})
export type SparkPreviewTransition = z.output<typeof sparkPreviewTransitionSchema>

const manifestResponseSchema = z.object({ data: sparkPreviewManifestSchema })
const sceneResponseSchema = z.object({ data: sparkPreviewSceneIrSchema })
const transitionResponseSchema = z.object({ data: sparkPreviewTransitionSchema })

/** The gateway cannot draw this boundary's transition (a camera Motion, video, switched off, ...): the editor shows a cut. */
export class SparkPreviewTransitionUnavailableError extends Error {
  constructor(
    readonly sceneId: string,
    readonly issues: readonly { code: string; message: string }[],
  ) {
    super(`The transition into scene ${sceneId} cannot be previewed`)
    this.name = 'SparkPreviewTransitionUnavailableError'
  }
}

/** The scene's content moved on after the manifest was read (409 `COMPOSITION_PREVIEW_STALE`): re-read the manifest. */
export class SparkPreviewStaleError extends Error {
  constructor(
    readonly sceneId: string,
    readonly currentDependencyHash: string | null,
  ) {
    super(`Preview of scene ${sceneId} is stale`)
    this.name = 'SparkPreviewStaleError'
  }
}

/** A scene the gateway refuses to preview (length unresolved, unsupported canvas, scene-level compile issue). */
export class SparkPreviewSceneUnavailableError extends Error {
  constructor(
    readonly sceneId: string,
    readonly code: string,
    readonly issues: readonly { code: string; message: string }[],
  ) {
    super(`Scene ${sceneId} cannot be previewed (${code})`)
    this.name = 'SparkPreviewSceneUnavailableError'
  }
}

export type SparkPreviewClient = {
  /**
   * Reads the manifest of the working copy. `revalidate` is the manifest the caller holds: its ETag goes out as
   * If-None-Match and a 304 returns that same object (no body, no document read on the server).
   */
  getManifest(
    projectId: string,
    options?: { signal?: AbortSignal; revalidate?: SparkPreviewManifest | null },
  ): Promise<SparkPreviewManifest>
  /** Throws SparkPreviewStaleError / SparkPreviewSceneUnavailableError; other failures are AuthClientError. */
  getScene(
    projectId: string,
    sceneId: string,
    dependencyHash: string,
    options?: { signal?: AbortSignal },
  ): Promise<SparkPreviewSceneIr>
  /**
   * E1-L: the transition segment into `sceneId`. Throws SparkPreviewStaleError / SparkPreviewTransitionUnavailableError.
   * Optional so a client without it (a test double) simply has no transitions: the editor shows cuts.
   */
  getTransition?(
    projectId: string,
    sceneId: string,
    dependencyHash: string,
    options?: { signal?: AbortSignal },
  ): Promise<SparkPreviewTransition>
}

/** ETag of each manifest this module returned (the manifest type itself stays the plain wire shape). */
const manifestEtags = new WeakMap<SparkPreviewManifest, string>()

function projectPath(projectId: string, suffix: string) {
  return `/api/v1/composition/projects/${encodeURIComponent(projectId)}${suffix}`
}

function detailsOf(error: AuthClientError): Record<string, unknown> {
  return error.details && typeof error.details === 'object' && !Array.isArray(error.details)
    ? (error.details as Record<string, unknown>)
    : {}
}

function issuesOf(details: Record<string, unknown>): { code: string; message: string }[] {
  const issues = details.issues
  if (!Array.isArray(issues)) return []
  return issues.flatMap((issue) => {
    if (!issue || typeof issue !== 'object') return []
    const { code, message } = issue as { code?: unknown; message?: unknown }
    return typeof code === 'string' ? [{ code, message: typeof message === 'string' ? message : '' }] : []
  })
}

export const sparkPreviewGatewayClient: SparkPreviewClient = {
  async getManifest(projectId, options = {}) {
    const held = options.revalidate ?? null
    const etag = held ? (manifestEtags.get(held) ?? null) : null
    const response = await gatewayConditionalRequest(projectPath(projectId, '/preview'), {
      schema: manifestResponseSchema,
      signal: options.signal,
      ifNoneMatch: etag,
    })
    if (response.notModified) {
      if (held) return held
      // A 304 to a read that sent no validator is not a valid answer.
      throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
    }
    const manifest = response.data.data
    if (response.etag) manifestEtags.set(manifest, response.etag)
    return manifest
  },

  async getScene(projectId, sceneId, dependencyHash, options = {}) {
    const query = `?dependency_hash=${encodeURIComponent(dependencyHash)}`
    try {
      const response = await gatewayRequest(projectPath(projectId, `/preview/scenes/${encodeURIComponent(sceneId)}${query}`), {
        schema: sceneResponseSchema,
        signal: options.signal,
      })
      return response.data
    } catch (error) {
      if (error instanceof AuthClientError && error.status === 409) {
        const details = detailsOf(error)
        if (error.code === 'COMPOSITION_PREVIEW_STALE') {
          const current = details.current_dependency_hash
          throw new SparkPreviewStaleError(sceneId, typeof current === 'string' ? current : null)
        }
        if (error.code === 'COMPOSITION_PREVIEW_SCENE_UNAVAILABLE' || error.code === 'COMPOSITION_REVISION_NOT_COMPILABLE') {
          throw new SparkPreviewSceneUnavailableError(sceneId, error.code, issuesOf(details))
        }
      }
      throw error
    }
  },

  async getTransition(projectId, sceneId, dependencyHash, options = {}) {
    const query = `?dependency_hash=${encodeURIComponent(dependencyHash)}`
    try {
      const response = await gatewayRequest(projectPath(projectId, `/preview/transitions/${encodeURIComponent(sceneId)}${query}`), {
        schema: transitionResponseSchema,
        signal: options.signal,
      })
      return response.data
    } catch (error) {
      if (error instanceof AuthClientError && error.status === 409) {
        const details = detailsOf(error)
        if (error.code === 'COMPOSITION_PREVIEW_STALE') {
          const current = details.current_dependency_hash
          throw new SparkPreviewStaleError(sceneId, typeof current === 'string' ? current : null)
        }
        if (error.code === 'COMPOSITION_PREVIEW_TRANSITION_UNAVAILABLE' || error.code === 'COMPOSITION_REVISION_NOT_COMPILABLE') {
          throw new SparkPreviewTransitionUnavailableError(sceneId, issuesOf(details))
        }
      }
      throw error
    }
  },
}

'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P04-21 the "Yayın paketi" client of the Plan view (KARAR-VIDEO-BRIEF §12A, K293). Everything shown comes from the
 * Composition owner (`/api/v1/composition-publish-packages`, gate `COMPOSITION_PUBLISH_PACKAGE_ENABLED`): the job's
 * package with the fields whose basis moved (`stale_fields`). An edit is a partial revision on the exact revision and
 * body digest shown (compare-and-set); the server prices the thumbnail and no route publishes anything: approving a
 * plan is not a permission to publish. Nothing is kept in browser storage.
 */

export const PUBLISH_PACKAGE_QUERY_KEY = ['composition', 'publish-package'] as const

export const PUBLISH_PACKAGE_FIELDS = ['titles', 'description', 'tags', 'thumbnail', 'chapters'] as const
export type PublishPackageField = (typeof PUBLISH_PACKAGE_FIELDS)[number]

const staleReasonSchema = z.enum(['script_changed', 'shot_plan_changed', 'transcript_changed'])
export type PublishStaleReason = z.infer<typeof staleReasonSchema>

const costSchema = z.object({
  status: z.enum(['free', 'priced', 'not_ready']),
  credits: z.number().optional(),
}).passthrough()

const imageSchema = z.object({
  owner_bc: z.literal('storage'),
  resource_kind: z.literal('asset'),
  resource_id: z.string(),
  resource_revision: z.string().optional(),
}).passthrough()

const generationSchema = z.object({
  capability: z.object({ node_type: z.string(), capability: z.string(), model_id: z.string().optional() }).passthrough(),
  prompt: z.string(),
}).passthrough()

const thumbnailSchema = z.object({
  source: z.enum(['engine_frame', 'user_image', 'ai_image']),
  reason: z.string(),
  title_text: z.string().optional(),
  frame: z.object({ scene_id: z.string(), at_seconds: z.number() }).passthrough().optional(),
  image: imageSchema.optional(),
  generation: generationSchema.optional(),
  cost: costSchema,
}).passthrough()

export type PublishThumbnail = z.infer<typeof thumbnailSchema>

const bodySchema = z.object({
  schema_version: z.literal('publish_package_v1'),
  language: z.string(),
  basis: z.object({ kind: z.enum(['script', 'transcript']) }).passthrough(),
  titles: z.object({
    options: z.array(z.object({ title_id: z.string(), text: z.string() })),
    selected_title_id: z.string(),
  }),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnail: thumbnailSchema,
  chapters: z.array(z.object({ chapter_id: z.string(), start_seconds: z.number(), title: z.string() })).optional(),
}).passthrough()

export type PublishPackageBody = z.infer<typeof bodySchema>

export const publishPackageViewSchema = z.object({
  schema: z.literal('composition_publish_package_v1'),
  package_id: z.string(),
  revision: z.number().int(),
  project_id: z.string(),
  job_id: z.string(),
  origin: z.enum(['agent', 'user']),
  body: bodySchema,
  body_sha256: z.string(),
  stale_fields: z.array(z.object({
    field: z.enum(PUBLISH_PACKAGE_FIELDS),
    reasons: z.array(staleReasonSchema.or(z.string())),
  })),
  publish_permission: z.literal('not_granted_by_plan'),
  created_at: z.string(),
}).passthrough()

export type PublishPackageView = z.infer<typeof publishPackageViewSchema>

const readResponseSchema = z.object({ data: publishPackageViewSchema })
const writeResponseSchema = z.object({
  data: z.object({ outcome: z.enum(['created', 'replayed']), package: publishPackageViewSchema }).passthrough(),
})

function jobPath(projectId: string, jobId: string): string {
  return `/api/v1/composition-publish-packages/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}`
}

/** The job has no package yet (404 of the package, not of the project). */
export function isPublishPackageMissing(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 404 && error.code === 'COMPOSITION_PUBLISH_PACKAGE_NOT_FOUND'
}

/** Publish packages are not enabled in this environment (gate closed): the section is not shown. */
export function isPublishPackageUnavailable(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 503 && error.code === 'COMPOSITION_PUBLISH_PACKAGE_UNAVAILABLE'
}

/** Another tab, the assistant or a script change moved the package past the revision the panel edits. */
export function isPublishPackageConflict(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 409
    && (error.code === 'COMPOSITION_PUBLISH_PACKAGE_STALE' || error.code === 'COMPOSITION_PUBLISH_PACKAGE_IDEMPOTENCY_CONFLICT')
}

/** The edit breaks a rule of the package (placeholder text, repeated tags, ...): nothing was written. */
export function isPublishPackageRefused(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 422
    && (error.code === 'COMPOSITION_PUBLISH_PACKAGE_INVALID' || error.code === 'COMPOSITION_PUBLISH_PACKAGE_REFUSED')
}

export type PublishPackageLoad =
  | { status: 'ok'; view: PublishPackageView }
  /** No package yet, or the gate is closed, or the job is not readable: the section is not shown. */
  | { status: 'absent' }

/** The job's package; `absent` when there is none (empty sections are not shown). Other failures throw. */
export async function loadPublishPackage(projectId: string, jobId: string, options: { signal?: AbortSignal } = {}): Promise<PublishPackageLoad> {
  try {
    const result = await gatewayRequest(jobPath(projectId, jobId), { schema: readResponseSchema, signal: options.signal })
    return { status: 'ok', view: result.data }
  } catch (error) {
    if (isPublishPackageMissing(error) || isPublishPackageUnavailable(error)) return { status: 'absent' }
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return { status: 'absent' }
    throw error
  }
}

/** What an edit may change: the server derives the cost, the basis and the origin, never the client. */
export interface PublishPackagePatch {
  titles?: { options: Array<{ title_id: string; text: string }>; selected_title_id: string }
  selected_title_id?: string
  description?: string
  tags?: string[]
  thumbnail?: Omit<PublishThumbnail, 'cost'>
  chapters?: Array<{ chapter_id: string; start_seconds: number; title: string }>
}

export interface PublishPackageReviseRequest {
  projectId: string
  jobId: string
  expectedRevision: number
  expectedBodySha256: string
  idempotencyKey: string
  patch: PublishPackagePatch
}

export interface PublishPackageReviseResult {
  outcome: 'created' | 'replayed'
  view: PublishPackageView
}

/**
 * A partial revision of the package on the exact revision and body digest shown. The rewritten fields become fresh; a
 * stale field that is not rewritten stays stale. It starts no inference, pricing, media or publication.
 */
export async function revisePublishPackage(request: PublishPackageReviseRequest): Promise<PublishPackageReviseResult> {
  const result = await gatewayRequest(`${jobPath(request.projectId, request.jobId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_revision: request.expectedRevision,
      expected_body_sha256: request.expectedBodySha256,
      idempotency_key: request.idempotencyKey,
      ...request.patch,
    },
    schema: writeResponseSchema,
  })
  return { outcome: result.data.outcome, view: result.data.package }
}

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

export const sparkAspectRatios = ['16:9', '9:16', '1:1'] as const
export type SparkAspectRatio = (typeof sparkAspectRatios)[number]

export const sparkProjectLifecycleStates = ['active', 'archived', 'soft_deleted'] as const
export type SparkProjectLifecycleState = (typeof sparkProjectLifecycleStates)[number]

const sparkProjectSchema = z.object({
  id: z.string().min(1),
  channel_id: z.string().min(1),
  title: z.string(),
  aspect_ratio: z.enum(sparkAspectRatios),
  visibility: z.literal('private'),
  schema_version: z.number().int(),
  // P02-01 fields; archived and deleted projects are read-only in the editor.
  lifecycle_state: z.enum(sparkProjectLifecycleStates).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type SparkProject = {
  id: string
  channelId: string
  title: string
  aspectRatio: SparkAspectRatio
  lifecycleState?: SparkProjectLifecycleState
  createdAt: string
  updatedAt: string
}

const sparkProjectResponseSchema = z.object({ data: sparkProjectSchema })

const sparkProjectListResponseSchema = z.object({
  data: z.array(sparkProjectSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    // P02-15: a project was updated after this pagination began; restart from the first page.
    restart_required: z.boolean().optional(),
  }),
})

function toSparkProject(payload: z.output<typeof sparkProjectSchema>): SparkProject {
  return {
    id: payload.id,
    channelId: payload.channel_id,
    title: payload.title,
    aspectRatio: payload.aspect_ratio,
    ...(payload.lifecycle_state && { lifecycleState: payload.lifecycle_state }),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  }
}

export async function listSparkProjects(
  channelId: string,
  options: { cursor?: string | null; limit?: number; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.cursor) params.set('cursor', options.cursor)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/composition/projects${query}`,
    { schema: sparkProjectListResponseSchema, signal: options.signal },
  )
  return {
    projects: response.data.map(toSparkProject),
    nextCursor: response.meta.next_cursor,
    restartRequired: response.meta.restart_required ?? false,
  }
}

/** Appends a page to the list and drops ids the list already holds (P02-15 moving keyset). */
export function mergeSparkProjectPages(current: SparkProject[], page: SparkProject[]): SparkProject[] {
  const seen = new Set(current.map((project) => project.id))
  return [...current, ...page.filter((project) => !seen.has(project.id))]
}

/**
 * Creates a private Spark project. `clientRequestId` makes the call idempotent: a retry after
 * a lost response returns the same project instead of creating a second one.
 */
export async function createSparkProject(
  channelId: string,
  input: { title: string; aspectRatio: SparkAspectRatio; clientRequestId: string },
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/composition/projects`,
    {
      method: 'POST',
      csrf: true,
      body: {
        title: input.title,
        aspect_ratio: input.aspectRatio,
        client_request_id: input.clientRequestId,
      },
      schema: sparkProjectResponseSchema,
    },
  )
  return toSparkProject(response.data)
}

/** Reads one project by id; the editor opens outside the channel-scoped workspace shell. */
export async function getSparkProject(projectId: string, options: { signal?: AbortSignal } = {}) {
  const response = await gatewayRequest(
    `/api/v1/composition/projects/${encodeURIComponent(projectId)}`,
    { schema: sparkProjectResponseSchema, signal: options.signal },
  )
  return toSparkProject(response.data)
}

export function sparkProjectHref(projectId: string) {
  return `/spark/${encodeURIComponent(projectId)}`
}

/** "Yeni proje": the workspace on Sohbet in `channelId`, before the project exists (`SparkNewProjectPage`). */
export function newSparkProjectHref(channelId: string) {
  return `/spark/new?channel=${encodeURIComponent(channelId)}`
}

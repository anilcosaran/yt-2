'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { brandRevisionRefSchema } from './api'

/**
 * P06-25 Brand Elements client: the typed catalogue (`native_fragment` | `motion_ref` | `media_ref`,
 * the Motion library under its Motion filter) and Composition's Element instance insert (the Spark
 * Elements picker). The server keeps both behind `BRAND_ELEMENTS_ENABLED` (403
 * `BRAND_FEATURE_UNAVAILABLE` while off). Nothing is stored in the browser.
 */

export const BRAND_ELEMENT_KINDS = ['native_fragment', 'motion_ref', 'media_ref'] as const
export type BrandElementKind = (typeof BRAND_ELEMENT_KINDS)[number]

export const brandElementsQueryKey = (channelId: string, kind: BrandElementKind | null) =>
  ['brand', 'elements', channelId, kind ?? 'all'] as const

const placementSchema = z.object({ x: z.number(), y: z.number(), scale: z.number() })

export const brandElementPreviewSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('native'),
    aspect_ratio: z.string(),
    duration_ms: z.number(),
    layers: z.array(z.object({
      layer_key: z.string(),
      kind: z.enum(['text', 'shape', 'image']),
      placement: placementSchema,
      text_excerpt: z.string().optional(),
      color: z.string().optional(),
      shape: z.string().optional(),
      storage_object_id: z.string().optional(),
    })),
  }),
  z.object({ kind: z.literal('motion'), motion_id: z.string(), motion_revision_id: z.string() }),
  z.object({ kind: z.literal('media'), storage_object_id: z.string(), media_kind: z.enum(['image', 'video']).nullable() }),
])

export const brandElementEditabilitySchema = z.object({
  structure: z.enum(['native_layers', 'motion_revision', 'rendered_media']),
  exposed: z.array(z.object({ parameter_id: z.string(), kind: z.string() })),
  replace_media: z.boolean(),
})

export const brandElementListItemSchema = z.object({
  element_id: z.string(),
  origin: z.enum(['user', 'builtin']),
  element_kind: z.enum(BRAND_ELEMENT_KINDS),
  name: z.string(),
  localized_name: z.object({ en: z.string(), tr: z.string() }).nullable(),
  lifecycle_state: z.enum(['active', 'archived']),
  draft_version: z.number().int().nullable(),
  head_revision: z.object({ revision_id: z.string(), revision_number: z.number().int(), ref: brandRevisionRefSchema }).nullable(),
  updated_at: z.string(),
  access_role: z.enum(['owner', 'platform']),
  preview: brandElementPreviewSchema.nullable(),
  editability: brandElementEditabilitySchema,
})

export type BrandElementListItem = z.infer<typeof brandElementListItemSchema>
export type BrandElementEditability = z.infer<typeof brandElementEditabilitySchema>

const listResponseSchema = z.object({
  data: z.array(brandElementListItemSchema),
  meta: z.object({ limit: z.number().int(), next_cursor: z.string().nullable() }),
})

const instanceResponseSchema = z.object({
  data: z.object({
    project_id: z.string(),
    element_ref: brandRevisionRefSchema,
    instance: z.object({
      scene_id: z.string(),
      layers: z.record(z.string()),
      scene_range: z.object({ start_frame: z.number().int(), end_frame: z.number().int() }).nullable(),
    }),
    compile_key: z.string().nullable(),
    receipt: z.object({ outcome: z.string(), working_copy_version: z.number().int() }).passthrough(),
  }),
})

/** One page of the Elements catalogue of a channel; platform Motion entries come first on page one. */
export async function listBrandElements(input: {
  channelId: string
  kind?: BrandElementKind | null
  cursor?: string | null
  limit?: number
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ channel_id: input.channelId, limit: String(input.limit ?? 50) })
  if (input.kind) params.set('kind', input.kind)
  if (input.cursor) params.set('cursor', input.cursor)
  return gatewayRequest(`/api/v1/brand/elements?${params.toString()}`, { schema: listResponseSchema, signal: input.signal })
}

/** The display name of a catalogue card in the UI language (platform entries carry both). */
export function brandElementDisplayName(item: Pick<BrandElementListItem, 'name' | 'localized_name'>, locale: string): string {
  if (!item.localized_name) return item.name
  return locale.toLowerCase().startsWith('tr') ? item.localized_name.tr : item.localized_name.en
}

/**
 * Spark picker insert: one exact Element revision into a scene as one undoable command. The instance
 * key is the idempotency key (a retry replays), the working copy version the CAS the editor saw.
 */
export async function insertBrandElementInstance(input: {
  projectId: string
  element: z.infer<typeof brandRevisionRefSchema>
  sceneId: string
  startFrame: number
  durationFrames?: number
  parameters?: Record<string, string>
  sources?: Record<string, string>
  instanceKey: string
  expectedWorkingCopyVersion: number
}) {
  const result = await gatewayRequest(`/api/v1/composition-elements/projects/${encodeURIComponent(input.projectId)}/instances`, {
    method: 'POST',
    csrf: true,
    body: {
      element_ref: input.element,
      scene_id: input.sceneId,
      start_frame: input.startFrame,
      ...(input.durationFrames !== undefined ? { duration_frames: input.durationFrames } : {}),
      parameters: input.parameters ?? {},
      sources: input.sources ?? {},
      instance_key: input.instanceKey,
      expected_working_copy_version: input.expectedWorkingCopyVersion,
    },
    schema: instanceResponseSchema,
  })
  return result.data
}

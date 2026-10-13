import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-28 "Brand Kit'imi uygula" client (server-side state only). The impact diff comes from a `dry_run`; the apply is
 * one undoable server command (the editor's normal undo reverts it). The diff dialog visuals wait for the decision in
 * docs/plans/agentic-spark/teslim/P06-28.md; this module is its non-visual part. Behind
 * `COMPOSITION_BRAND_APPLICATION_ENABLED` (403 when off).
 */

const BASE = '/api/v1/composition-brand/projects'

export type BrandKitRef = {
  ref_type: 'brand_revision'
  brand_asset_kind: 'kit'
  brand_asset_id: string
  brand_revision_id: string
  brand_revision_digest_sha256: string
}

export type BrandApplicationScope =
  | { kind: 'project' }
  | { kind: 'scenes'; scene_ids: string[] }
  | { kind: 'template_instance'; instance_id: string }

export const brandApplicationStatuses = [
  'change',
  'unchanged',
  'override_kept',
  'locked',
  'excluded',
  'unsupported_font',
  'template_not_resolvable',
] as const
export type BrandApplicationStatus = (typeof brandApplicationStatuses)[number]

export const brandBoundFields = ['style.font', 'style.color', 'fill', 'style_ref', 'brand_kit_ref'] as const
export type BrandBoundField = (typeof brandBoundFields)[number]

const entrySchema = z
  .object({
    entity_kind: z.enum(['layer', 'caption_track', 'project']),
    entity_id: z.string(),
    scene_id: z.string().nullable(),
    field: z.enum(brandBoundFields),
    token: z.string().nullable(),
    binding: z.enum(['matched', 'declared', 'kit_reference']).nullable(),
    before: z.unknown(),
    after: z.unknown(),
    status: z.enum(brandApplicationStatuses),
    reason: z.string().nullable(),
  })
  .passthrough()
export type BrandApplicationEntry = z.infer<typeof entrySchema>

const diffSchema = z
  .object({
    supported_field_count: z.number().int(),
    counts: z.record(z.number().int()),
    untouched: z.object({ template_fixed_text: z.number().int(), clips: z.number().int() }),
    entries: z.array(entrySchema),
  })
  .passthrough()
export type BrandApplicationDiff = z.infer<typeof diffSchema>

const responseSchema = z.object({
  data: z.object({
    project_id: z.string(),
    working_copy_version: z.number().int(),
    dry_run: z.boolean(),
    diff: diffSchema.nullable(),
    receipt: z.object({ outcome: z.string() }).passthrough().nullable(),
  }),
})
export type BrandApplicationResult = z.infer<typeof responseSchema>['data']

export async function previewBrandKitApplication(
  projectId: string,
  input: { kitRef: BrandKitRef; scope?: BrandApplicationScope; expectedWorkingCopyVersion: number },
): Promise<BrandApplicationResult> {
  const response = await gatewayRequest(`${BASE}/${encodeURIComponent(projectId)}/applications`, {
    method: 'POST',
    csrf: true,
    body: {
      kit_ref: input.kitRef,
      scope: input.scope ?? { kind: 'project' },
      dry_run: true,
      expected_working_copy_version: input.expectedWorkingCopyVersion,
    },
    schema: responseSchema,
  })
  return response.data
}

export async function applyBrandKit(
  projectId: string,
  input: {
    kitRef: BrandKitRef
    scope?: BrandApplicationScope
    exclude: Array<{ entity_id: string; field: BrandBoundField }>
    requestKey: string
    expectedWorkingCopyVersion: number
  },
): Promise<BrandApplicationResult> {
  const response = await gatewayRequest(`${BASE}/${encodeURIComponent(projectId)}/applications`, {
    method: 'POST',
    csrf: true,
    body: {
      kit_ref: input.kitRef,
      scope: input.scope ?? { kind: 'project' },
      exclude: input.exclude,
      dry_run: false,
      request_key: input.requestKey,
      expected_working_copy_version: input.expectedWorkingCopyVersion,
    },
    schema: responseSchema,
  })
  return response.data
}

export async function restoreBrandDefaults(
  projectId: string,
  input: {
    entities: Array<{ entity_id: string; field: 'style.font' | 'style.color' | 'fill'; token: string }>
    requestKey: string
    expectedWorkingCopyVersion: number
  },
): Promise<{ entries: Array<Record<string, unknown>>; receipt: { outcome: string } | null }> {
  const response = await gatewayRequest(`${BASE}/${encodeURIComponent(projectId)}/brand-defaults`, {
    method: 'POST',
    csrf: true,
    body: { entities: input.entities, dry_run: false, request_key: input.requestKey, expected_working_copy_version: input.expectedWorkingCopyVersion },
    schema: z.object({
      data: z.object({ entries: z.array(z.record(z.unknown())), receipt: z.object({ outcome: z.string() }).passthrough().nullable() }).passthrough(),
    }),
  })
  return response.data
}

// ---------------------------------------------------------------- pure dialog helpers

/**
 * The diff dialog's summary: how many fields change, what stays (the user's own choices), what a lock or an unusable
 * font holds back. `canApply` is false when nothing would change (the dialog offers no empty apply).
 */
export function brandApplicationSummary(diff: BrandApplicationDiff): {
  changes: number
  kept: number
  held: number
  canApply: boolean
} {
  const count = (status: BrandApplicationStatus) => diff.entries.filter((entry) => entry.status === status).length
  const changes = count('change')
  return {
    changes,
    kept: count('override_kept'),
    held: count('locked') + count('unsupported_font') + count('template_not_resolvable'),
    canApply: changes > 0,
  }
}

/** The fields the user unticked in the diff (only changing fields can be unticked). */
export function brandApplicationExclusions(
  diff: BrandApplicationDiff,
  unticked: ReadonlySet<string>,
): Array<{ entity_id: string; field: BrandBoundField }> {
  return diff.entries
    .filter((entry) => entry.status === 'change' && unticked.has(`${entry.entity_id}|${entry.field}`))
    .map((entry) => ({ entity_id: entry.entity_id, field: entry.field }))
}

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-08 AI refinement chips and proposal cards (`/api/v1/composition-refinements`). Server state only: the chip and
 * the card are re-read from the gateway after a reload; nothing is kept in browser storage. Accept/reject name the
 * exact patch the card showed (`proposal_sha256`); a stale card is a 409 the caller refreshes.
 */

export const refinementStatuses = [
  'applied',
  'partially_applied',
  'proposed',
  'accepted',
  'accepted_partially',
  'rejected',
  'conflicted',
  'superseded',
] as const
export type RefinementStatus = (typeof refinementStatuses)[number]

const diffFieldSchema = z.object({ path: z.string(), before: z.unknown(), after: z.unknown() })
const diffEntrySchema = z.object({
  entity_kind: z.string(),
  entity_id: z.string(),
  scene_id: z.string().nullable(),
  change: z.enum(['created', 'updated', 'removed']),
  fields: z.array(diffFieldSchema),
  fields_truncated: z.boolean(),
})
const conflictSchema = z.object({
  entity_kind: z.string(),
  entity_id: z.string(),
  seen_rev: z.number().nullable(),
  current_rev: z.number().nullable(),
  reason: z.enum(['changed_since_base', 'deleted_since_base', 'unknown_base_rev']),
})

const refinementSchema = z.object({
  refinement_id: z.string(),
  project_id: z.string(),
  status: z.enum(refinementStatuses),
  proposal_sha256: z.string(),
  op_count: z.number().int(),
  classification: z.object({
    decision: z.enum(['apply_now', 'proposal', 'paid_dispatch_required']),
    reasons: z.array(z.string()),
    entity_count: z.number().int(),
    scene_removals: z.number().int(),
  }).passthrough(),
  diff: z.object({
    entries: z.array(diffEntrySchema),
    truncated: z.boolean(),
    counts: z.object({ created: z.number().int(), updated: z.number().int(), removed: z.number().int() }),
  }).passthrough(),
  receipt: z.object({
    command_id: z.string(),
    outcome: z.string(),
    undo_group_id: z.string().nullable(),
    working_copy_version: z.number().int(),
  }).nullable(),
  conflicts: z.array(conflictSchema),
  decided_at: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int(),
}).passthrough()

export type SparkRefinement = z.output<typeof refinementSchema>

const refinementResponseSchema = z.object({ data: refinementSchema })
const refinementListResponseSchema = z.object({ data: z.object({ items: z.array(refinementSchema) }) })

const base = (projectId: string) => `/api/v1/composition-refinements/projects/${encodeURIComponent(projectId)}`

export async function listSparkRefinements(
  projectId: string,
  options: { statuses?: RefinementStatus[]; limit?: number; signal?: AbortSignal } = {},
): Promise<SparkRefinement[]> {
  const params = new URLSearchParams()
  if (options.statuses && options.statuses.length > 0) params.set('status', options.statuses.join(','))
  if (options.limit) params.set('limit', String(options.limit))
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const response = await gatewayRequest(`${base(projectId)}${query}`, { schema: refinementListResponseSchema, signal: options.signal })
  return response.data.items
}

export async function getSparkRefinement(projectId: string, refinementId: string, options: { signal?: AbortSignal } = {}): Promise<SparkRefinement> {
  const response = await gatewayRequest(`${base(projectId)}/${encodeURIComponent(refinementId)}`, {
    schema: refinementResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function decideSparkRefinement(
  projectId: string,
  refinement: Pick<SparkRefinement, 'refinement_id' | 'proposal_sha256'>,
  decision: 'accept' | 'reject',
  options: { signal?: AbortSignal } = {},
): Promise<SparkRefinement> {
  const response = await gatewayRequest(`${base(projectId)}/${encodeURIComponent(refinement.refinement_id)}/${decision}`, {
    method: 'POST',
    csrf: true,
    body: { expected_proposal_sha256: refinement.proposal_sha256 },
    schema: refinementResponseSchema,
    signal: options.signal,
  })
  return response.data
}

/** A proposal card the user can still decide (open and not superseded by a newer card of the same job). */
export function isOpenSparkProposal(refinement: SparkRefinement): boolean {
  return refinement.status === 'proposed'
}

/**
 * The chip's counts: what the applied patch changed, and how many targets were left to the user because they changed
 * them while the agent was working (never overwritten).
 */
export function sparkRefinementSummary(refinement: SparkRefinement): { changed: number; kept: number; undoGroupId: string | null } {
  const counts = refinement.diff.counts
  return {
    changed: counts.created + counts.updated + counts.removed,
    kept: refinement.conflicts.length,
    undoGroupId: refinement.receipt?.undo_group_id ?? null,
  }
}

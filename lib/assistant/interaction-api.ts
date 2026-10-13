'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-23 interaction levels client: the typed chip options of a B question, the job's "Varsayımlarım" list and its
 * "Geri al", and the in-place replan state ("Plan güncelleniyor" / "Değişenler"). Every state is server data; nothing
 * is kept in browser storage (the list and the plan state are re-read on each run event and on reconnect).
 */

export const JOB_ASSUMPTIONS_QUERY_KEY = ['assistant', 'job-assumptions'] as const
export const PLAN_REPLAN_QUERY_KEY = ['assistant', 'plan-replans'] as const

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const choiceSchema = z.object({
  value: scalarSchema,
  label: z.string(),
  thumbnail: z.object({ storage_object_id: z.string(), checksum_sha256: z.string() }).optional(),
}).passthrough()

// ------------------------------------------------------------------------------------ B question chips

const questionSchema = z.object({
  schema_version: z.literal('assistant_interaction_question_v1'),
  field_key: z.string(),
  kind: z.enum(['choice', 'proposal']),
  options: z.array(z.object({ option_id: z.string(), label: z.string().min(1), value: scalarSchema }).passthrough()).min(1).max(4),
  recommended_option_id: z.string(),
}).passthrough()

/**
 * The typed options of a sent B question (`content_json.question`), recommendation first; null when the message has
 * none (older messages keep the text-inferred chips). The chip sends the option's label: that is what the user said.
 */
export function readInteractionQuestionOptions(contentJson: unknown): Array<{ label: string; value: string; hint?: string; recommended?: boolean }> | null {
  if (!contentJson || typeof contentJson !== 'object') return null
  const parsed = questionSchema.safeParse((contentJson as Record<string, unknown>).question)
  if (!parsed.success) return null
  const recommended = parsed.data.options.find((option) => option.option_id === parsed.data.recommended_option_id)
  const ordered = recommended ? [recommended, ...parsed.data.options.filter((option) => option !== recommended)] : parsed.data.options
  // An option may carry a one-line `hint` (what choosing it means); the question widget shows it under the label.
  return ordered.map((option) => ({
    label: option.label,
    value: option.label,
    ...(typeof option.hint === 'string' && option.hint ? { hint: option.hint } : {}),
    ...(option === recommended ? { recommended: true } : {}),
  }))
}

// ------------------------------------------------------------------------------------ Varsayımlarım

const assumptionRecordSchema = z.object({
  schema_version: z.literal('assumption_record_v1'),
  assumption_id: z.string(),
  job_id: z.string(),
  field_key: z.string(),
  reason_kind: z.enum(['two_reasonable_options', 'candidate_selection', 'question_budget_default', 'optional_item_omitted']),
  chosen: choiceSchema,
  alternatives: z.array(choiceSchema),
  rationale: z.string(),
  mode_at_decision: z.enum(['ask', 'auto', 'auto_full']),
  status: z.enum(['active', 'reverted', 'superseded']),
  created_at: z.string(),
}).passthrough()

const revertEffectSchema = z.object({ kind: z.enum(['undo_group', 'replan']) }).passthrough()

const assumptionItemSchema = z.object({
  record: assumptionRecordSchema,
  version: z.number().int(),
  revertible: z.boolean(),
  revert: z.object({ replacement: choiceSchema.nullable(), effect: revertEffectSchema }).nullable(),
})

const assumptionListSchema = z.object({
  data: z.object({
    schema_version: z.literal('assistant_job_assumptions_v1'),
    job_id: z.string(),
    items: z.array(assumptionItemSchema),
  }),
})

const revertResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['reverted', 'replayed']),
    item: assumptionItemSchema,
    effect: revertEffectSchema,
  }),
})

export type JobAssumptionItem = z.infer<typeof assumptionItemSchema>

/** The job's "Varsayımlarım" (newest first); null when the job is not readable. */
export async function getJobAssumptions(jobId: string, options: { signal?: AbortSignal } = {}): Promise<JobAssumptionItem[] | null> {
  try {
    const result = await gatewayRequest(`/api/v1/assistant-assumptions/jobs/${encodeURIComponent(jobId)}`, {
      schema: assumptionListSchema,
      signal: options.signal,
    })
    return result.data.items
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return null
    throw error
  }
}

/**
 * "Geri al" of one entry, optionally with one of its recorded alternatives. The idempotency key is derived from the
 * entry, its version and the choice, so a double click or a retry replays the same revert.
 */
export async function revertJobAssumption(item: JobAssumptionItem, replacement?: { value: string | number | boolean | null }) {
  const result = await gatewayRequest(`/api/v1/assistant-assumptions/${encodeURIComponent(item.record.assumption_id)}/revert`, {
    method: 'POST',
    csrf: true,
    body: revertJobAssumptionBody(item, replacement),
    schema: revertResponseSchema,
  })
  return result.data
}

export function revertJobAssumptionBody(item: JobAssumptionItem, replacement?: { value: string | number | boolean | null }) {
  const choiceKey = replacement === undefined ? 'none' : JSON.stringify(replacement.value)
  return {
    expected_version: item.version,
    ...(replacement !== undefined ? { replacement_value: replacement.value } : {}),
    idempotency_key: `assumption-revert:${item.record.assumption_id}:${item.version}:${choiceKey}`.slice(0, 255),
  }
}

/** The entries the user can still take back (active), newest first. */
export function activeJobAssumptions(items: readonly JobAssumptionItem[] | null | undefined): JobAssumptionItem[] {
  return (items ?? []).filter((item) => item.revertible && item.record.status === 'active')
}

// ------------------------------------------------------------------------------------ in-place replanning

const changeSchema = z.object({ field_key: z.string(), from: choiceSchema.nullable().optional(), to: choiceSchema.nullable() })
const estimateSchema = z.object({
  status: z.string(),
  min_credits: z.number().optional(),
  max_credits: z.number().optional(),
  point_credits: z.number().optional(),
}).passthrough().nullable()

const replanSchema = z.object({
  schema_version: z.literal('assistant_plan_replan_v1'),
  replan_id: z.string(),
  job_id: z.string(),
  generation: z.number().int(),
  state: z.enum(['updating', 'ready', 'superseded', 'canceled']),
  changes: z.array(changeSchema),
  sections: z.array(z.string()),
  dispatched: z.boolean(),
  summary: z.object({
    changes: z.array(changeSchema),
    sections: z.array(z.string()),
    estimate: z.object({ before: estimateSchema, after: estimateSchema, delta_max_credits: z.number().nullable() }),
  }).passthrough().nullable(),
  cancel_reason: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
}).passthrough()

const replanStateSchema = z.object({
  data: z.object({
    schema_version: z.literal('assistant_plan_replan_state_v1'),
    job_id: z.string(),
    updating: z.boolean(),
    latest: replanSchema.nullable(),
  }),
})

const replanRequestResponseSchema = z.object({
  data: z.object({ outcome: z.enum(['accepted', 'replayed']), replan: replanSchema }),
})

export type PlanReplanState = z.infer<typeof replanStateSchema>['data']
export type PlanReplanChangeInput = { field_key: string; from?: { value: string | number | boolean | null; label: string } | null; to: { value: string | number | boolean | null; label: string } | null }

/** "Plan güncelleniyor" / "Değişenler" state of the job's open plan; null when the job is not readable. */
export async function getPlanReplanState(jobId: string, options: { signal?: AbortSignal } = {}): Promise<PlanReplanState | null> {
  try {
    const result = await gatewayRequest(`/api/v1/assistant-plan-replans/jobs/${encodeURIComponent(jobId)}`, {
      schema: replanStateSchema,
      signal: options.signal,
    })
    return result.data
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return null
    throw error
  }
}

/** A plan input change of the open plan (Plan view / composer); the key is the caller's (one per user edit). */
export async function requestPlanReplan(jobId: string, changes: PlanReplanChangeInput[], idempotencyKey: string) {
  const result = await gatewayRequest(`/api/v1/assistant-plan-replans/jobs/${encodeURIComponent(jobId)}`, {
    method: 'POST',
    csrf: true,
    body: { changes, idempotency_key: idempotencyKey },
    schema: replanRequestResponseSchema,
  })
  return result.data
}

export interface PlanChangesNote {
  changes: Array<{ fieldKey: string; from: string | null; to: string | null }>
  /** after.max − before.max in credits; null unless both estimates are valid. */
  estimateDelta: number | null
}

/** "Değişenler" of the newest finished replan (null while updating, or when nothing finished). */
export function planChangesNote(state: PlanReplanState | null | undefined): PlanChangesNote | null {
  const latest = state?.latest
  if (!latest || latest.state !== 'ready' || !latest.summary) return null
  return {
    changes: latest.summary.changes.map((change) => ({ fieldKey: change.field_key, from: change.from?.label ?? null, to: change.to?.label ?? null })),
    estimateDelta: latest.summary.estimate.delta_max_credits,
  }
}

/** Run events after which the assumption list or the plan state is re-read. */
export function isInteractionEvent(eventType: string): boolean {
  return eventType.startsWith('assistant.assumption.') || eventType.startsWith('assistant.plan_replan.')
}

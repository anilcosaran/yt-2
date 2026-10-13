'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Yol 1 money API client (owned by Y1-01, shape in `handoff-y1/money-api.md`): the live meter of a conversation and
 * the receipt of one turn, both read-only server data (`/api/v1/assistant-spend`). With the job spend envelope switch
 * off the meter answers `enforcement: "disabled"` and the chip stays hidden.
 */

export const ASSISTANT_SPEND_METER_QUERY_KEY = ['assistant', 'spend-meter'] as const
export const ASSISTANT_SPEND_RECEIPT_QUERY_KEY = ['assistant', 'spend-receipt'] as const
/** Public run event carrying the receipt once, when the job reaches a terminal state. */
export const ASSISTANT_SPEND_RECEIPT_EVENT_TYPE = 'assistant.spend.receipt'

const modeSchema = z.enum(['ask', 'auto', 'auto_full'])

const jobMeterSchema = z.object({
  job_id: z.string(),
  run_id: z.string(),
  envelope_id: z.string(),
  envelope_status: z.enum(['open', 'draining', 'closed']),
  phase: z.enum(['preparation', 'production', 'none']),
  mode: modeSchema.nullable(),
  basis: z.string().nullable(),
  approved_ceiling_credits: z.number().nullable(),
  spent_credits: z.number(),
  outstanding_credits: z.number(),
  remaining_credits: z.number(),
  overrun_credits: z.number(),
  state: z.enum(['no_spend', 'within_ceiling', 'awaiting_approval', 'funding_required', 'closed']),
  pending_approval: z.object({
    requested_max_credits: z.number(),
    trigger: z.string(),
    asked_in_mode: z.string(),
    decision_id: z.string(),
  }).nullable(),
})

const meterSchema = z.object({
  conversation_id: z.string(),
  as_of: z.string(),
  enforcement: z.enum(['job_spend_envelope', 'disabled']),
  balance: z.object({ spendable_credits: z.number(), plan_credits: z.number() }).nullable(),
  threshold: z.object({
    auto_ask_at_credits: z.number(),
    base_credits: z.number(),
    ratio_bps: z.number(),
    floor_credits: z.number(),
    ceiling_credits: z.number(),
    user_min_credits: z.number().nullable(),
  }).passthrough().nullable(),
  job_cap: z.object({ credits: z.number().nullable(), source: z.enum(['tenant', 'user']).nullable() }),
  job: jobMeterSchema.nullable(),
  jobs: z.array(jobMeterSchema),
})

/** P7/3: what paid for a line / the turn (plan quota pools, plan credits, top-up credits). */
const fundingSchema = z.object({
  quota_credits: z.number(),
  plan_credits: z.number(),
  top_up_credits: z.number(),
  unattributed_credits: z.number(),
  source: z.enum(['quota', 'plan_credits', 'top_up', 'mixed', 'none']),
})

/** P7/3: the Workflow node a line paid for; the UI localizes `node_base_type` and falls back to `name`. */
const receiptNodeSchema = z.object({
  node_key: z.string(),
  node_type: z.string().nullable(),
  node_base_type: z.string().nullable(),
  name: z.string(),
})

const receiptSchema = z.object({
  run_id: z.string(),
  job_id: z.string(),
  conversation_id: z.string(),
  envelope_id: z.string().nullable(),
  final: z.boolean(),
  spent_credits: z.number(),
  outstanding_credits: z.number(),
  approved_ceiling_credits: z.number().nullable(),
  overrun_credits: z.number(),
  balance_after_credits: z.number().nullable(),
  as_of: z.string(),
  lines: z.array(z.object({
    kind: z.enum(['planning', 'preparation', 'production']),
    credits: z.number(),
    status: z.enum(['settled', 'outstanding', 'released']),
    // Optional: a gateway before P7/3 (or the run event payload) does not send them.
    node: receiptNodeSchema.nullable().optional(),
    funding: fundingSchema.nullable().optional(),
  })),
  lines_truncated: z.boolean(),
  funding: fundingSchema.nullable().optional(),
})

const meterResponseSchema = z.object({ data: meterSchema })
const receiptResponseSchema = z.object({ data: receiptSchema })

export type AssistantSpendMeter = z.infer<typeof meterSchema>
export type AssistantSpendJobMeter = z.infer<typeof jobMeterSchema>
export type AssistantSpendReceipt = z.infer<typeof receiptSchema>
export type AssistantSpendFunding = z.infer<typeof fundingSchema>

export async function getAssistantSpendMeter(
  input: { conversationId: string; jobId?: string | null },
  options: { signal?: AbortSignal } = {},
): Promise<AssistantSpendMeter> {
  const query = input.jobId ? `?job_id=${encodeURIComponent(input.jobId)}` : ''
  const result = await gatewayRequest(
    `/api/v1/assistant-spend/conversations/${encodeURIComponent(input.conversationId)}/meter${query}`,
    { schema: meterResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getAssistantSpendReceipt(
  input: { runId: string },
  options: { signal?: AbortSignal } = {},
): Promise<AssistantSpendReceipt> {
  const result = await gatewayRequest(
    `/api/v1/assistant-spend/runs/${encodeURIComponent(input.runId)}/receipt`,
    { schema: receiptResponseSchema, signal: options.signal },
  )
  return result.data
}

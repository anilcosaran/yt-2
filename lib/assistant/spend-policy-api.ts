'use client'

import { z } from 'zod'

import { createAssistantIdempotencyKey } from '@/lib/assistant/api'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * The user's own spend policy (`/api/v1/assistant/settings/spend-policy`, F31 + Yol 1): the Auto question floor
 * ("don't ask below N credits") and the optional cap on one job. The Y1-01 fields are optional here: a gateway without
 * them answers the older shape and the settings page leaves those rows out.
 */

export const ASSISTANT_SPEND_POLICY_QUERY_KEY = ['assistant', 'spend-policy'] as const

const policySchema = z.object({
  policy_version: z.number().int(),
  enforcement: z.enum(['job_spend_envelope', 'disabled']).optional(),
  /** The user's own "don't ask below N credits"; null = follow the tenant / plan value. */
  auto_ask_min_credits: z.number().nullable().optional(),
  /** The user's own cap on one job's estimate; null = no cap (the default). */
  job_max_credits: z.number().nullable().optional(),
  auto_threshold: z.object({
    ratio_bps: z.number(),
    floor_credits: z.number(),
    ceiling_credits: z.number(),
    effective_floor_credits: z.number(),
  }).passthrough().nullable().optional(),
  tenant_job_cap_credits: z.number().nullable().optional(),
  effective_job_cap_credits: z.number().nullable().optional(),
}).passthrough()

const policyResponseSchema = z.object({ data: policySchema })

const commandResponseSchema = z.object({
  data: z.object({
    outcome: z.enum([
      'applied',
      'replayed',
      'conflict',
      'rejected_above_plan_cap',
      'rejected_plan_cap_unavailable',
      'rejected_above_auto_ceiling',
      'rejected_idempotency_conflict',
    ]),
    policy_version: z.number().int(),
    auto_ask_min_credits: z.number().nullable().optional(),
    job_max_credits: z.number().nullable().optional(),
    /** Y1R-MONEY-1: the largest "don't ask below" the workspace accepts (its Auto ceiling A). */
    auto_ceiling_credits: z.number().optional(),
    stale_policy_version: z.number().int().optional(),
  }).passthrough(),
})

export type AssistantSpendPolicy = z.infer<typeof policySchema>
export type AssistantSpendPolicyCommandResult = z.infer<typeof commandResponseSchema>['data']

export async function getAssistantSpendPolicy(options: { signal?: AbortSignal } = {}): Promise<AssistantSpendPolicy> {
  const result = await gatewayRequest('/api/v1/assistant/settings/spend-policy', {
    schema: policyResponseSchema,
    signal: options.signal,
  })
  return result.data
}

/**
 * Every value is optional on the server: omitted = unchanged, `null` = clear (follow the tenant value / no cap). A
 * floor loosens only the Auto question, never the balance stop.
 */
export async function issueAssistantSpendPolicyCommand(input: {
  expectedPolicyVersion: number
  autoAskMinCredits?: number | null
  jobMaxCredits?: number | null
  idempotencyKey?: string
}): Promise<AssistantSpendPolicyCommandResult> {
  const result = await gatewayRequest('/api/v1/assistant/settings/spend-policy-commands', {
    method: 'POST',
    csrf: true,
    body: {
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-spend-policy'),
      expected_policy_version: input.expectedPolicyVersion,
      ...(input.autoAskMinCredits !== undefined ? { auto_ask_min_credits: input.autoAskMinCredits } : {}),
      ...(input.jobMaxCredits !== undefined ? { job_max_credits: input.jobMaxCredits } : {}),
    },
    schema: commandResponseSchema,
  })
  return result.data
}

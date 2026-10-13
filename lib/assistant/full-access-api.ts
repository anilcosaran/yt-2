'use client'

import { z } from 'zod'

import { createAssistantIdempotencyKey } from '@/lib/assistant/api'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Y1-02 Full access client (`/api/v1/full-access`): the one-time warning consent, its revoke, the workspace switch
 * "allow Full access for members" and the user's own approval limit ("ask when a job exceeds X credits", on at 1000 by
 * default). State always comes from the server; nothing is kept in browser storage.
 */

export const FULL_ACCESS_STATE_QUERY_KEY = ['assistant', 'full-access'] as const

const consentSchema = z.object({
  consent_id: z.string(),
  warning_revision: z.string(),
  shown_at: z.string(),
  accepted_at: z.string(),
  revoked_at: z.string().nullable(),
})

const limitSchema = z.object({
  enabled: z.boolean(),
  /** The user's own amount (null = the default amount applies). */
  credits: z.number().nullable(),
  /** The amount in force; null while the limit is turned off. */
  effective_credits: z.number().nullable(),
  default_credits: z.number(),
  source: z.enum(['default', 'user']),
  limit_version: z.number().int(),
  updated_at: z.string().nullable(),
})

const stateSchema = z.object({
  warning_revision: z.string(),
  consent_state: z.enum(['none', 'accepted', 'revoked', 'outdated_revision', 'blocked_by_workspace']),
  consent: consentSchema.nullable(),
  /** True when switching to Full access would be accepted right now. */
  effective: z.boolean(),
  can_enable: z.boolean(),
  ineligible_reason: z.enum(['members_not_allowed']).nullable(),
  actor_role: z.enum(['owner', 'admin', 'member']),
  limit: limitSchema.nullable(),
  workspace_policy: z.object({
    allow_members: z.boolean(),
    policy_version: z.number().int(),
    can_manage: z.boolean(),
    updated_at: z.string().nullable(),
  }),
})

const stateResponseSchema = z.object({ data: stateSchema })

const acceptResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['accepted', 'already_accepted']),
    consent: consentSchema,
  }),
})

const revokeResponseSchema = z.object({
  data: z.object({ revoked: z.boolean(), revoked_count: z.number().int() }),
})

const workspacePolicyResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['applied', 'unchanged', 'conflict']),
    allow_members: z.boolean(),
    policy_version: z.number().int(),
    stale_policy_version: z.number().int().optional(),
  }),
})

const limitCommandResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['applied', 'replayed', 'conflict', 'rejected_idempotency_conflict']),
    limit: limitSchema,
    stale_limit_version: z.number().int().optional(),
  }),
})

export type FullAccessState = z.infer<typeof stateSchema>
export type FullAccessLimit = z.infer<typeof limitSchema>
export type FullAccessConsent = z.infer<typeof consentSchema>
export type FullAccessAcceptResult = z.infer<typeof acceptResponseSchema>['data']
export type FullAccessRevokeResult = z.infer<typeof revokeResponseSchema>['data']
export type FullAccessWorkspacePolicyResult = z.infer<typeof workspacePolicyResponseSchema>['data']
export type FullAccessLimitCommandResult = z.infer<typeof limitCommandResponseSchema>['data']

type GatewayOptions = { signal?: AbortSignal }

export async function getFullAccessState(options: GatewayOptions = {}): Promise<FullAccessState> {
  const result = await gatewayRequest('/api/v1/full-access', { schema: stateResponseSchema, signal: options.signal })
  return result.data
}

/** The one-time warning consent for exactly the warning text revision the card showed. Idempotent on the server. */
export async function acceptFullAccessConsent(input: { warningRevision: string; shownAt?: Date }): Promise<FullAccessAcceptResult> {
  const result = await gatewayRequest('/api/v1/full-access/consent', {
    method: 'POST',
    csrf: true,
    body: {
      warning_revision: input.warningRevision,
      ...(input.shownAt ? { shown_at: input.shownAt.toISOString() } : {}),
    },
    schema: acceptResponseSchema,
  })
  return result.data
}

/** Revoke (settings): every active consent ends; running jobs fall back to Auto at their next step. */
export async function revokeFullAccessConsent(): Promise<FullAccessRevokeResult> {
  const result = await gatewayRequest('/api/v1/full-access/consent', {
    method: 'DELETE',
    csrf: true,
    schema: revokeResponseSchema,
  })
  return result.data
}

/** Owner / admin only: members may use Full access only while this is on (default off). */
export async function setFullAccessWorkspacePolicy(input: {
  allowMembers: boolean
  expectedPolicyVersion: number
}): Promise<FullAccessWorkspacePolicyResult> {
  const result = await gatewayRequest('/api/v1/full-access/workspace-policy', {
    method: 'PUT',
    csrf: true,
    body: { allow_members: input.allowMembers, expected_policy_version: input.expectedPolicyVersion },
    schema: workspacePolicyResponseSchema,
  })
  return result.data
}

/**
 * The user's own limit. `enabled=false` turns the question off; `credits` omitted keeps the stored amount, `null`
 * returns to the default amount, a positive number (at most four decimals) sets the user's amount.
 */
export async function issueFullAccessLimitCommand(input: {
  enabled: boolean
  credits?: number | null
  expectedLimitVersion: number
  idempotencyKey?: string
}): Promise<FullAccessLimitCommandResult> {
  const result = await gatewayRequest('/api/v1/full-access/limit', {
    method: 'PUT',
    csrf: true,
    body: {
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('full-access-limit'),
      expected_limit_version: input.expectedLimitVersion,
      enabled: input.enabled,
      ...(input.credits !== undefined ? { credits: input.credits } : {}),
    },
    schema: limitCommandResponseSchema,
  })
  return result.data
}

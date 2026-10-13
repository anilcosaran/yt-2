'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

import { parseMcpServerRegistration, type McpServerRegistration } from './mcp-registrations-api'

/**
 * QA-169 client of the P01C-07 tool review (`GET/POST /api/v1/mcp-server-registrations/{id}/tool-review`) and the
 * P01C-14 activation (`POST …/{id}/activate`). Server state only (React Query memory, never browser storage). Tool
 * descriptions are untrusted server text and are not read here; names and titles are shown as plain text.
 */

export const mcpToolReviewQueryKey = (registrationId: string) => ['connectors', 'mcp-registrations', registrationId, 'tool-review'] as const

export const MCP_TOOL_DECISIONS = ['allow', 'ask', 'block'] as const
export type McpToolDecision = (typeof MCP_TOOL_DECISIONS)[number]

/** Effects a reviewer may declare for Allow/Ask (spend/admin are gated: such a tool can only be blocked). */
export const MCP_OPEN_TOOL_EFFECTS = ['read', 'write', 'send', 'delete'] as const
export type McpOpenToolEffect = (typeof MCP_OPEN_TOOL_EFFECTS)[number]

const changeSchema = z.enum(['added', 'changed', 'unchanged', 'removed'])
export type McpToolChange = z.infer<typeof changeSchema>

const toolSchema = z.object({
  name: z.string().min(1).max(128),
  title: z.string().nullable().catch(null),
  change: changeSchema,
  media_generate: z.object({ estimated: z.boolean().catch(false) }).catch({ estimated: false }),
  allowed_decisions: z.array(z.enum(MCP_TOOL_DECISIONS)).catch([]),
  decision_required: z.boolean().catch(false),
  reviewed: z.object({
    policy: z.enum(MCP_TOOL_DECISIONS),
    effect: z.string().catch('write'),
    capability_keys: z.array(z.string()).catch([]),
  }).nullable().catch(null),
})
export type McpReviewTool = z.infer<typeof toolSchema>

const grantRenewalSchema = z.object({
  status: z.enum(['renewed', 'unchanged', 'rejected', 'failed']),
  grant_generation: z.number().int().optional(),
  reason: z.string().optional(),
})
export type McpGrantRenewal = z.infer<typeof grantRenewalSchema>

const reviewSchema = z.object({
  schema_version: z.literal('mcp_tool_review_v1'),
  registration_id: z.string().min(1),
  registration_version: z.number().int(),
  snapshot: z.object({
    id: z.string().min(1),
    completeness: z.enum(['complete', 'partial']).catch('partial'),
    reviewable: z.boolean().catch(false),
  }).nullable().catch(null),
  review_required: z.boolean().catch(false),
  tools: z.array(z.unknown()).catch([]),
  capability_namespaces: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,31}$/)).catch([]),
  grant_renewal: grantRenewalSchema.optional().catch(undefined),
})

export interface McpToolReview {
  registrationId: string
  registrationVersion: number
  snapshot: { id: string; completeness: 'complete' | 'partial'; reviewable: boolean } | null
  reviewRequired: boolean
  tools: McpReviewTool[]
  capabilityNamespaces: string[]
  grantRenewal: McpGrantRenewal | null
}

/** Drops malformed tools (never repaired); a malformed view is an error, not an empty review. */
export function parseMcpToolReview(raw: unknown): McpToolReview | null {
  const parsed = reviewSchema.safeParse(raw)
  if (!parsed.success) return null
  const view = parsed.data
  return {
    registrationId: view.registration_id,
    registrationVersion: view.registration_version,
    snapshot: view.snapshot,
    reviewRequired: view.review_required,
    tools: view.tools.flatMap((item) => {
      const tool = toolSchema.safeParse(item)
      return tool.success ? [tool.data] : []
    }),
    capabilityNamespaces: view.capability_namespaces,
    grantRenewal: view.grant_renewal ?? null,
  }
}

const envelopeSchema = z.object({ data: z.unknown() })

function reviewOrThrow(result: { data?: unknown }): McpToolReview {
  const review = parseMcpToolReview(result.data)
  if (!review) throw new Error('mcp_tool_review_response_invalid')
  return review
}

export async function getMcpToolReview(registrationId: string, options: { signal?: AbortSignal } = {}): Promise<McpToolReview> {
  return reviewOrThrow(await gatewayRequest(`/api/v1/mcp-server-registrations/${encodeURIComponent(registrationId)}/tool-review`, {
    schema: envelopeSchema,
    signal: options.signal,
  }))
}

export interface McpToolReviewDecisionInput {
  tool_name: string
  decision: McpToolDecision
  effect?: McpOpenToolEffect | null
  capability_keys?: string[] | null
}

export async function submitMcpToolReview(registrationId: string, input: {
  snapshotId: string
  expectedVersion: number
  decisions: McpToolReviewDecisionInput[]
}): Promise<McpToolReview> {
  return reviewOrThrow(await gatewayRequest(`/api/v1/mcp-server-registrations/${encodeURIComponent(registrationId)}/tool-review`, {
    method: 'POST',
    csrf: true,
    body: { snapshot_id: input.snapshotId, expected_version: input.expectedVersion, decisions: input.decisions },
    schema: envelopeSchema,
  }))
}

const activationSchema = z.object({ data: z.object({ registration: z.unknown() }) })

/** P01C-14: private conformance gate → active (or re-grant the owner after a new review). */
export async function activateMcpServerRegistration(registrationId: string, expectedVersion: number): Promise<McpServerRegistration> {
  const result = await gatewayRequest(`/api/v1/mcp-server-registrations/${encodeURIComponent(registrationId)}/activate`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion },
    schema: activationSchema,
  })
  const registration = parseMcpServerRegistration(result.data.registration)
  if (!registration) throw new Error('mcp_activation_response_invalid')
  return registration
}

export type McpToolReviewErrorKind =
  | 'stale'
  | 'decision_invalid'
  | 'snapshot_stale'
  | 'review_pending'
  | 'not_reviewed'
  | 'auth_not_supported'
  | 'no_open_tools'
  | 'disabled'
  | 'feature_unavailable'
  | 'not_found'
  | 'failed'

const ACTIVATION_REASONS: ReadonlySet<string> = new Set(['snapshot_stale', 'review_pending', 'not_reviewed', 'auth_not_supported', 'no_open_tools'])

/** Why a review or an activation (or a QA-171 renewal) did not go through — stable server codes only. */
export function describeMcpToolReviewError(error: unknown): McpToolReviewErrorKind {
  if (!isAuthClientError(error)) return 'failed'
  const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : null
  const detail = typeof details?.['detail'] === 'string' ? details['detail'] : null
  switch (error.code) {
    case 'CONNECTOR_MCP_ACTIVATION_REJECTED':
      return mcpActivationReasonKind(detail)
    case 'CONNECTOR_MCP_REGISTRATION_CONFLICT':
      return detail === 'registration_disabled' ? 'disabled' : 'stale'
    case 'CONNECTOR_MCP_TOOL_REVIEW_REJECTED':
      return detail === 'snapshot_not_latest' || detail === 'head_changed' || detail === 'no_snapshot' ? 'stale' : 'decision_invalid'
    case 'CONNECTOR_FEATURE_UNAVAILABLE':
      return 'feature_unavailable'
    case 'CONNECTOR_NOT_FOUND':
      return 'not_found'
    default:
      return error.status === 409 ? 'stale' : 'failed'
  }
}

export function mcpActivationReasonKind(reason: string | null | undefined): McpToolReviewErrorKind {
  if (reason === 'registration_disabled') return 'disabled'
  if (reason === 'version_conflict') return 'stale'
  return reason && ACTIVATION_REASONS.has(reason) ? reason as McpToolReviewErrorKind : 'failed'
}

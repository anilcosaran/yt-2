'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-10 G2 (final render) client: reads the job's latest final render gate and the export status, and sends the
 * card's decision for exactly the previewed revision/profile/quote. State always comes from the server.
 */

export const FINAL_RENDER_QUERY_KEY = ['assistant', 'final-render'] as const

const decisionSchema = z.object({
  schema_version: z.literal('final_render_decision_v1'),
  decision_id: z.string(),
  job_id: z.string(),
  target: z.object({
    project_id: z.string(),
    working_copy_version: z.number().int(),
    document_sha256: z.string(),
    output_profile: z.string(),
    quote_sha256: z.string(),
    estimated_credits: z.number(),
  }).passthrough(),
  funding: z.object({ mode: z.enum(['job_envelope', 'render_only']) }),
  gate: z.object({ resolution: z.enum(['await_human', 'policy_authorized']), show_first: z.boolean() }).passthrough(),
  state: z.enum(['awaiting_decision', 'approved', 'policy_authorized', 'rejected', 'changes_requested', 'superseded', 'expired', 'canceled']),
  version: z.number().int(),
  decided: z.object({ decision: z.string(), source: z.string() }).passthrough().optional(),
  render: z.object({ status: z.enum(['none', 'recorded', 'requested', 'refused']), export_id: z.string().optional(), refusal: z.string().optional() }),
  presented_at: z.string(),
  expires_at: z.string(),
}).passthrough()

const stateResponseSchema = z.object({
  data: z.object({
    decision: decisionSchema.nullable(),
    export: z.object({ export_id: z.string(), status: z.string(), error_code: z.string().nullable() }).passthrough().nullable(),
  }),
})

const decisionResponseSchema = z.object({
  data: z.object({ outcome: z.enum(['accepted', 'replayed']), decision: decisionSchema }),
})

export type FinalRenderDecision = z.infer<typeof decisionSchema>
export type FinalRenderState = z.infer<typeof stateResponseSchema>['data']
export type FinalRenderDecisionKind = 'approve' | 'reject'

export async function getFinalRenderState(jobId: string, options: { signal?: AbortSignal } = {}): Promise<FinalRenderState | null> {
  try {
    const result = await gatewayRequest(`/api/v1/final-render/jobs/${encodeURIComponent(jobId)}`, {
      schema: stateResponseSchema,
      signal: options.signal,
    })
    return result.data
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return null
    throw error
  }
}

/** The card's G2 decision; the key is derived from the gate, its version and the decision (retries replay). */
export async function decideFinalRender(decision: FinalRenderDecision, kind: FinalRenderDecisionKind) {
  const result = await gatewayRequest(`/api/v1/final-render/decisions/${encodeURIComponent(decision.decision_id)}`, {
    method: 'POST',
    csrf: true,
    body: finalRenderDecisionBody(decision, kind),
    schema: decisionResponseSchema,
  })
  return result.data
}

export function finalRenderDecisionBody(decision: FinalRenderDecision, kind: FinalRenderDecisionKind) {
  return {
    expected_version: decision.version,
    target: {
      working_copy_version: decision.target.working_copy_version,
      document_sha256: decision.target.document_sha256,
      output_profile: decision.target.output_profile,
      quote_sha256: decision.target.quote_sha256,
    },
    decision: kind,
    idempotency_key: `g2-card:${decision.decision_id}:${decision.version}:${kind}`,
  }
}

export type FinalRenderCardStatus =
  | 'awaiting'
  | 'expired'
  | 'starting'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'refused'
  | 'rejected'
  | 'changes_requested'
  | 'superseded'

export interface FinalRenderCardModel {
  decision: FinalRenderDecision
  status: FinalRenderCardStatus
  canDecide: boolean
  revision: number
  estimatedCredits: number
  includedInPlan: boolean
  automatic: boolean
}

const RENDERING_EXPORT_STATUSES = new Set(['authorizing', 'queued', 'dispatching', 'rendering'])

/** The G2 card (null without a gate). The button exists only while the gate waits and has not expired. */
export function buildFinalRenderCardModel(state: FinalRenderState | null, now: Date = new Date()): FinalRenderCardModel | null {
  const decision = state?.decision ?? null
  if (!decision) return null
  const expired = decision.state === 'expired' || (decision.state === 'awaiting_decision' && Date.parse(decision.expires_at) <= now.getTime())
  const status = cardStatus(decision, state?.export ?? null, expired)
  return {
    decision,
    status,
    canDecide: status === 'awaiting',
    revision: decision.target.working_copy_version,
    estimatedCredits: decision.target.estimated_credits,
    includedInPlan: decision.funding.mode === 'job_envelope',
    automatic: decision.decided?.source === 'policy',
  }
}

function cardStatus(decision: FinalRenderDecision, exportView: FinalRenderState['export'], expired: boolean): FinalRenderCardStatus {
  switch (decision.state) {
    case 'awaiting_decision':
      return expired ? 'expired' : 'awaiting'
    case 'expired':
      return 'expired'
    case 'superseded':
    case 'canceled':
      return 'superseded'
    case 'rejected':
      return 'rejected'
    case 'changes_requested':
      return 'changes_requested'
    case 'approved':
    case 'policy_authorized':
      if (decision.render.status === 'refused') return 'refused'
      if (decision.render.status !== 'requested' || !exportView) return 'starting'
      if (exportView.status === 'completed') return 'completed'
      if (RENDERING_EXPORT_STATUSES.has(exportView.status)) return 'rendering'
      return 'failed'
  }
}

export function isFinalRenderEvent(eventType: string): boolean {
  return eventType.startsWith('assistant.final_render.')
}

'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-09 G1 production approval card (P03-21 production-launch/v1 read + decision). The server presents a job's
 * ready plan by itself and records the one G1 decision; this client only reads the job's checkpoint (reconnect,
 * refresh) and sends the card's decision for the exact presented plan/quote/ceiling. Nothing is kept in browser
 * storage: every state is re-read from the server.
 */

export const PRODUCTION_LAUNCH_QUERY_KEY = ['assistant', 'production-launch'] as const

const planRefSchema = z.object({
  artifact_kind: z.literal('production_plan'),
  artifact_id: z.string(),
  artifact_revision: z.number().int(),
  content_digest_sha256: z.string(),
})

const presentationSchema = z.object({
  schema_version: z.literal('production_plan_presentation_v1'),
  presentation_id: z.string(),
  job_id: z.string(),
  plan_ref: planRefSchema,
  g1_fingerprint_sha256: z.string(),
  estimate: z.object({
    estimate_revision: z.number(),
    min_credits: z.number(),
    max_credits: z.number(),
    point_credits: z.number().optional(),
  }).optional(),
  approved_max_credits: z.number().nullable(),
  state: z.enum(['presented', 'approved', 'rejected', 'changes_requested', 'superseded', 'expired', 'canceled']),
  version: z.number().int(),
  presented_at: z.string(),
  expires_at: z.string(),
  decided: z.object({
    decision: z.enum(['approve', 'reject', 'request_changes']),
    source: z.enum(['card', 'chat_reply', 'inbox']),
  }).passthrough().optional(),
}).passthrough()

const stageSchema = z.object({
  step_id: z.string(),
  status: z.enum(['pending', 'running', 'waiting', 'blocked', 'completed', 'skipped', 'failed']),
  counters: z.object({
    completed: z.number(),
    total: z.number(),
    unit: z.enum(['chapters', 'shots', 'outputs', 'items']),
  }).optional(),
  detail_code: z.string().optional(),
}).passthrough()

const progressSchema = z.object({
  schema_version: z.literal('video_production_progress_v1'),
  job_id: z.string(),
  job_status: z.string(),
  plan_ref: planRefSchema.nullable(),
  stages: z.array(stageSchema),
  attention: z.array(z.object({ kind: z.string(), code: z.string() }).passthrough()).catch([]),
  launch: z.object({
    state: z.string(),
    started: z.boolean(),
    presentation_id: z.string().optional(),
  }).passthrough(),
}).passthrough()

const stateResponseSchema = z.object({
  data: z.object({
    progress: progressSchema,
    presentation: presentationSchema.nullable(),
    intent: z.object({ status: z.string() }).passthrough().nullable(),
  }),
})

const decisionResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['accepted', 'replayed']),
    presentation: presentationSchema,
    launch: z.object({ state: z.string(), started: z.boolean() }),
  }).passthrough(),
})

export type ProductionPlanPresentation = z.infer<typeof presentationSchema>
export type VideoProductionProgress = z.infer<typeof progressSchema>
export type ProductionLaunchState = z.infer<typeof stateResponseSchema>['data']
export type ProductionDecision = 'approve' | 'reject' | 'request_changes'

/** The job's server checkpoint (progress + current presentation); null when the job is not readable. */
export async function getProductionLaunchState(jobId: string, options: { signal?: AbortSignal } = {}): Promise<ProductionLaunchState | null> {
  try {
    const result = await gatewayRequest(`/api/v1/production-launch/jobs/${encodeURIComponent(jobId)}`, {
      schema: stateResponseSchema,
      signal: options.signal,
    })
    return result.data
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return null
    throw error
  }
}

/**
 * The card's G1 decision for exactly the presentation it shows. The idempotency key is derived from the
 * presentation, its version and the decision, so a double click or a retry after a lost answer replays the same
 * recorded decision instead of making another one.
 */
export async function decideProductionPlan(presentation: ProductionPlanPresentation, decision: ProductionDecision, comment?: string) {
  const result = await gatewayRequest(`/api/v1/production-launch/presentations/${encodeURIComponent(presentation.presentation_id)}/decisions`, {
    method: 'POST',
    csrf: true,
    body: productionDecisionBody(presentation, decision, comment),
    schema: decisionResponseSchema,
  })
  return result.data
}

export function productionDecisionBody(presentation: ProductionPlanPresentation, decision: ProductionDecision, comment?: string) {
  return {
    expected_presentation_version: presentation.version,
    plan_ref: presentation.plan_ref,
    g1_fingerprint_sha256: presentation.g1_fingerprint_sha256,
    approved_max_credits: presentation.approved_max_credits,
    decision,
    idempotency_key: `g1-card:${presentation.presentation_id}:${presentation.version}:${decision}`,
    ...(comment ? { comment } : {}),
  }
}

// ------------------------------------------------------------------------------------ written G1 reply (202)

const decisionDataSchema = z.object({
  outcome: z.enum(['accepted', 'replayed']),
  presentation: presentationSchema,
  launch: z.object({ state: z.string(), started: z.boolean() }),
}).passthrough()

/** 202 body of the message route when the message answered an open presented plan (no new job). */
export const productionG1ReplySchema = z.object({
  kind: z.literal('production_g1_reply'),
  result: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('bound'), decision: decisionDataSchema, echo: z.string() }),
    z.object({ kind: z.literal('verify'), question: z.string(), presentation_ids: z.array(z.string()) }),
    z.object({ kind: z.literal('refused'), reason: z.string(), question: z.string(), presentation_id: z.string() }),
  ]),
})

export type ProductionG1Reply = z.infer<typeof productionG1ReplySchema>

export function isProductionG1Reply(value: unknown): value is ProductionG1Reply {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'production_g1_reply'
}

/** The job whose card the reply belongs to (bound: the decided presentation's job). */
export function productionG1ReplyJobId(reply: ProductionG1Reply): string | null {
  return reply.result.kind === 'bound' ? reply.result.decision.presentation.job_id : null
}

// ------------------------------------------------------------------------------------ card model (pure)

export type ProductionG1CardStatus =
  | 'awaiting'
  | 'plan_changed'
  | 'expired'
  | 'approved'
  | 'handed_off'
  | 'queued'
  | 'producing'
  | 'funding_required'
  | 'refused'
  | 'rejected'
  | 'changes_requested'

export interface ProductionG1StageItem {
  stepId: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  counters: { completed: number; total: number; unit: string } | null
}

export interface ProductionG1CardModel {
  presentation: ProductionPlanPresentation
  status: ProductionG1CardStatus
  /** `Bu planla üret` is enabled only for the exact presented plan/quote/ceiling while the job waits on it (F17). */
  canDecide: boolean
  planRevision: number
  estimate: { min: number; max: number; point: number | null } | null
  ceiling: number | null
  stages: ProductionG1StageItem[]
}

const STAGE_STATUS: Record<z.infer<typeof stageSchema>['status'], ProductionG1StageItem['status'] | null> = {
  pending: 'pending',
  running: 'active',
  waiting: 'active',
  blocked: 'failed',
  failed: 'failed',
  completed: 'completed',
  skipped: null,
}

/**
 * The card for a job with a presented plan (null otherwise: no card for jobs without a G1 presentation). The
 * button turns off when the presentation is no longer open, expired, or the job's current plan is another revision
 * than the one shown; the server refuses such a decision anyway (K229).
 */
export function buildProductionG1CardModel(state: ProductionLaunchState | null, now: Date = new Date()): ProductionG1CardModel | null {
  const presentation = state?.presentation ?? null
  if (!state || !presentation) return null
  const progress = state.progress
  const expired = presentation.state === 'expired' || (presentation.state === 'presented' && Date.parse(presentation.expires_at) <= now.getTime())
  const planMoved = Boolean(progress.plan_ref) && !samePlanRef(progress.plan_ref!, presentation.plan_ref)
  const status = cardStatus(presentation, progress, expired, planMoved)
  const stages = progress.stages.flatMap((stage) => {
    const mapped = STAGE_STATUS[stage.status]
    return mapped ? [{ stepId: stage.step_id, status: mapped, counters: stage.counters ?? null }] : []
  })
  return {
    presentation,
    status,
    canDecide: status === 'awaiting',
    planRevision: presentation.plan_ref.artifact_revision,
    estimate: presentation.estimate
      ? { min: presentation.estimate.min_credits, max: presentation.estimate.max_credits, point: presentation.estimate.point_credits ?? null }
      : null,
    ceiling: presentation.approved_max_credits,
    stages,
  }
}

function cardStatus(
  presentation: ProductionPlanPresentation,
  progress: VideoProductionProgress,
  expired: boolean,
  planMoved: boolean,
): ProductionG1CardStatus {
  switch (presentation.state) {
    case 'presented':
      if (expired) return 'expired'
      if (planMoved || progress.launch.state !== 'awaiting_decision') return 'plan_changed'
      return 'awaiting'
    case 'superseded':
    case 'canceled':
      return 'plan_changed'
    case 'expired':
      return 'expired'
    case 'rejected':
      return 'rejected'
    case 'changes_requested':
      return 'changes_requested'
    case 'approved':
      switch (progress.launch.state) {
        case 'producing':
          return 'producing'
        case 'queued':
          return 'queued'
        case 'funding_required':
          return 'funding_required'
        case 'refused':
          return 'refused'
        case 'handed_off':
        case 'launching':
          return 'handed_off'
        default:
          return 'approved'
      }
  }
}

function samePlanRef(left: z.infer<typeof planRefSchema>, right: z.infer<typeof planRefSchema>) {
  return left.artifact_id === right.artifact_id
    && left.artifact_revision === right.artifact_revision
    && left.content_digest_sha256 === right.content_digest_sha256
}

/** Run events that change the card (the card re-reads the server checkpoint when one arrives). */
export function isProductionLaunchEvent(eventType: string): boolean {
  return eventType.startsWith('assistant.production_plan.')
    || eventType.startsWith('assistant.production_launch.')
    || eventType.startsWith('assistant.production_progress.')
}

/** Latest echo / verification note of the written approval for this job, from its durable run events. */
export function latestProductionReplyNote(events: ReadonlyArray<{ event_type: string; payload: Record<string, unknown>; sequence: number }>): { kind: 'echo' | 'question'; text: string } | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!
    if (event.event_type === 'assistant.production_plan.decided') {
      const reply = event.payload['reply']
      const echo = reply && typeof reply === 'object' ? (reply as Record<string, unknown>)['echo'] : null
      return typeof echo === 'string' && echo.trim() ? { kind: 'echo', text: echo } : null
    }
    if (event.event_type === 'assistant.production_plan.verification_required') {
      const question = event.payload['question']
      return typeof question === 'string' && question.trim() ? { kind: 'question', text: question } : null
    }
  }
  return null
}

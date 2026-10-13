'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * SV: the plan card's "Kaynağı değiştir" (P04-19 director owner routes, `/api/v1/composition-direction`). The card reads the
 * ranked candidates of ONE shot (source, model, the Workflow price) and changes that shot's source in a new ShotPlan revision
 * (the cost delta comes back). Nothing is kept in browser storage; the candidates are always the owner's current ones.
 */

export const SHOT_SOURCE_CANDIDATES_QUERY_KEY = ['composition', 'shot-source-candidates'] as const

export const CHANGEABLE_SOURCE_MODALITIES = ['typed_scene', 'brand_motion', 'own_media', 'youtorch_stock', 'ai_image', 'ai_video'] as const
export type ChangeableSourceModality = (typeof CHANGEABLE_SOURCE_MODALITIES)[number]

const alternativeSchema = z.object({
  modality: z.string(),
  label: z.string(),
  model_id: z.string().optional(),
  credits: z.number().nullable(),
  score: z.number(),
}).passthrough()

const candidatesResponseSchema = z.object({
  data: z.object({
    revision: z.number().int(),
    shot: z.object({
      shot_id: z.string(),
      alternatives: z.array(alternativeSchema),
    }).passthrough(),
  }).passthrough(),
})

export type ShotSourceAlternative = z.infer<typeof alternativeSchema>

export interface ShotSourceCandidates {
  revision: number
  alternatives: Array<ShotSourceAlternative & { modality: ChangeableSourceModality }>
}

function base(projectId: string) {
  return `/api/v1/composition-direction/projects/${encodeURIComponent(projectId)}`
}

/** The ranked sources one shot can take now (only the ones the owner lets a user pick); null when the owner cannot show them. */
export async function getShotSourceCandidates(input: { projectId: string; jobId: string; shotId: string }, options: { signal?: AbortSignal } = {}): Promise<ShotSourceCandidates | null> {
  try {
    const result = await gatewayRequest(
      `${base(input.projectId)}/shots/${encodeURIComponent(input.shotId)}/candidates?job_id=${encodeURIComponent(input.jobId)}`,
      { schema: candidatesResponseSchema, signal: options.signal },
    )
    return {
      revision: result.data.revision,
      alternatives: result.data.shot.alternatives.filter((alternative): alternative is ShotSourceAlternative & { modality: ChangeableSourceModality } =>
        (CHANGEABLE_SOURCE_MODALITIES as readonly string[]).includes(alternative.modality)),
    }
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403 || error.status === 409)) return null
    throw error
  }
}

const changeResponseSchema = z.object({
  data: z.object({
    revision: z.number().int(),
    outcome: z.string(),
    estimate_delta: z.object({
      shot_id: z.string(),
      before: z.object({ status: z.string(), credits: z.number().optional() }).passthrough().nullable(),
      after: z.object({ status: z.string(), credits: z.number().optional() }).passthrough().nullable(),
      plan_recompile_required: z.boolean(),
    }).passthrough(),
  }).passthrough(),
})

export type ShotSourceChange = z.infer<typeof changeResponseSchema>['data']

/**
 * Changes one shot's source against the exact ShotPlan revision the card shows. The key is derived from the revision, the shot
 * and the choice, so a double click or a retry after a lost answer replays the same recorded change.
 */
export async function changeShotSource(input: {
  projectId: string
  jobId: string
  shotId: string
  expectedRevision: number
  modality: ChangeableSourceModality
  modelId?: string
}): Promise<ShotSourceChange> {
  const result = await gatewayRequest(`${base(input.projectId)}/shots/${encodeURIComponent(input.shotId)}/source`, {
    method: 'POST',
    csrf: true,
    body: {
      job_id: input.jobId,
      expected_revision: input.expectedRevision,
      modality: input.modality,
      ...(input.modelId ? { model_id: input.modelId } : {}),
      idempotency_key: `card-source:${input.jobId}:${input.shotId}:${input.expectedRevision}:${input.modality}:${input.modelId ?? 'default'}`.slice(0, 128),
    },
    schema: changeResponseSchema,
  })
  return result.data
}

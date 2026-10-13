'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * QA-194 client of Settings > Developer > Connected apps "Limitler": the per-job and monthly credit caps of one installed
 * app (`GET/PATCH /api/v1/developer-installations/{id}/caps`). Server state only (React Query memory, never browser
 * storage); the server validates the bounds, allows owner/admin only and audits every change.
 */

export const developerInstallationCapsQueryKey = (installationId: string) => ['developer', 'installations', installationId, 'caps'] as const

const capsSchema = z.object({
  schema_version: z.literal('developer_installation_caps_v1'),
  installation_id: z.string().min(1),
  per_job_credits: z.number(),
  monthly_credits: z.number(),
  customized: z.boolean(),
  version: z.number().int().nullable(),
  defaults: z.object({ per_job_credits: z.number(), monthly_credits: z.number() }),
  bounds: z.object({ min: z.number(), max: z.number() }),
  can_edit: z.boolean(),
})
export type DeveloperInstallationCaps = z.infer<typeof capsSchema>

const envelope = z.object({ data: capsSchema })

export async function getDeveloperInstallationCaps(installationId: string, options: { signal?: AbortSignal } = {}): Promise<DeveloperInstallationCaps> {
  const result = await gatewayRequest(`/api/v1/developer-installations/${encodeURIComponent(installationId)}/caps`, { schema: envelope, signal: options.signal })
  return result.data
}

export async function updateDeveloperInstallationCaps(installationId: string, input: {
  perJobCredits: number
  monthlyCredits: number
  expectedVersion: number | null
}): Promise<DeveloperInstallationCaps> {
  const result = await gatewayRequest(`/api/v1/developer-installations/${encodeURIComponent(installationId)}/caps`, {
    method: 'PATCH',
    csrf: true,
    body: { per_job_credits: input.perJobCredits, monthly_credits: input.monthlyCredits, expected_version: input.expectedVersion },
    schema: envelope,
  })
  return result.data
}

export type DeveloperCapsInputProblem = 'per_job_invalid' | 'monthly_invalid' | 'monthly_below_per_job'

/**
 * The same rule the server applies (it checks again): 1…max credits, at most four decimals, monthly ≥ per-job.
 * `null` = the two values can be sent.
 */
export function developerCapsInputProblem(input: { perJob: string; monthly: string }, bounds: { min: number; max: number }): DeveloperCapsInputProblem | null {
  const valid = (value: number) => Number.isFinite(value) && value >= bounds.min && value <= bounds.max && Math.round(value * 10_000) === value * 10_000
  const perJob = Number(input.perJob.trim().replace(',', '.'))
  const monthly = Number(input.monthly.trim().replace(',', '.'))
  if (!input.perJob.trim() || !valid(perJob)) return 'per_job_invalid'
  if (!input.monthly.trim() || !valid(monthly)) return 'monthly_invalid'
  if (monthly < perJob) return 'monthly_below_per_job'
  return null
}

export function parseDeveloperCapsInput(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export type DeveloperCapsErrorKind = 'forbidden' | 'stale' | 'invalid' | 'revoked' | 'not_found' | 'failed'

/** Stable server codes only. */
export function describeDeveloperCapsError(error: unknown): DeveloperCapsErrorKind {
  if (!isAuthClientError(error)) return 'failed'
  const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : null
  const reason = typeof details?.['reason_code'] === 'string' ? details['reason_code'] : null
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'not_found'
  if (error.status === 400) return 'invalid'
  if (error.status === 409) return reason === 'installation_revoked' ? 'revoked' : 'stale'
  return 'failed'
}

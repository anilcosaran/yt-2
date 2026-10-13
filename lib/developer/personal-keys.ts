'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'
import type { DeveloperResourceCandidate } from '@/lib/developer/authorization'

/**
 * DEV-09 personal API keys (Settings > Developer > API keys). Server state only: the secret appears once in the
 * create/rotate response and is dropped when its dialog closes; lists show only a hint.
 */

export const DEVELOPER_PERSONAL_KEYS_QUERY_KEY = ['developer', 'personal-keys'] as const

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

const selectorSchema = z.object({
  kind: z.string(),
  id: z.string(),
  revision_id: z.string().optional(),
  channel_id: z.string().optional(),
})

const keySchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: z.enum(['test', 'production']),
  status: z.enum(['active', 'suspended', 'revoked']),
  suspended_reason: z.string().nullable(),
  scopes: z.array(z.string()),
  resources: z.array(selectorSchema),
  caps: z.object({ per_job_credits: z.number(), monthly_credits: z.number() }),
  ip_allowlist: z.array(z.string()),
  last_used_at: z.string().nullable(),
  last_used_ip: z.string().nullable(),
  created_by_you: z.boolean(),
  version: z.number().int(),
  created_at: z.string(),
  secrets: z.array(z.object({ id: z.string(), hint: z.string(), prefix: z.string(), expires_at: z.string(), last_used_at: z.string().nullable() })),
})
export type DeveloperPersonalKey = z.infer<typeof keySchema>

const issuedSchema = z.object({ key: keySchema, secret: z.string() })
export type DeveloperIssuedPersonalKey = z.infer<typeof issuedSchema>

export interface DeveloperPersonalKeyInput {
  name: string
  environment: 'test' | 'production'
  scopes: string[]
  resources: Array<z.infer<typeof selectorSchema>>
  caps: { per_job_credits: number; monthly_credits: number }
  ip_allowlist: string[]
}

export async function listDeveloperPersonalKeys(options: { signal?: AbortSignal } = {}): Promise<DeveloperPersonalKey[]> {
  const response = await gatewayRequest('/api/v1/developer-personal-keys', { schema: data(z.array(keySchema)), signal: options.signal })
  return response.data
}

export async function createDeveloperPersonalKey(input: DeveloperPersonalKeyInput): Promise<DeveloperIssuedPersonalKey> {
  const response = await gatewayRequest('/api/v1/developer-personal-keys', { method: 'POST', csrf: true, body: input, schema: data(issuedSchema) })
  return response.data
}

export async function rotateDeveloperPersonalKey(keyId: string, expectedVersion: number): Promise<DeveloperIssuedPersonalKey> {
  const response = await gatewayRequest(`/api/v1/developer-personal-keys/${encodeURIComponent(keyId)}/rotation`, {
    method: 'POST', csrf: true, body: { expected_version: expectedVersion }, schema: data(issuedSchema),
  })
  return response.data
}

export async function revokeDeveloperPersonalKeySecret(keyId: string, secretId: string, expectedVersion: number): Promise<DeveloperPersonalKey> {
  const response = await gatewayRequest(`/api/v1/developer-personal-keys/${encodeURIComponent(keyId)}/secrets/${encodeURIComponent(secretId)}/revoke`, {
    method: 'POST', csrf: true, body: { expected_version: expectedVersion }, schema: data(keySchema),
  })
  return response.data
}

export async function revokeDeveloperPersonalKey(keyId: string, expectedVersion: number): Promise<DeveloperPersonalKey> {
  const response = await gatewayRequest(`/api/v1/developer-personal-keys/${encodeURIComponent(keyId)}/revoke`, {
    method: 'POST', csrf: true, body: { expected_version: expectedVersion }, schema: data(keySchema),
  })
  return response.data
}

const candidateSchema = z.object({
  kind: z.string(),
  id: z.string(),
  revision_id: z.string().optional(),
  channel_id: z.string().optional(),
  display_label: z.string(),
})

export async function listDeveloperPersonalKeyCandidates(
  scopes: string[],
  input: { kind: string; channelId?: string | null; signal?: AbortSignal },
): Promise<{ items: DeveloperResourceCandidate[]; next_cursor: string | null }> {
  const query = new URLSearchParams({ scopes: scopes.join(','), kind: input.kind })
  if (input.channelId) query.set('channel_id', input.channelId)
  const response = await gatewayRequest(`/api/v1/developer-personal-keys/resource-candidates?${query.toString()}`, {
    schema: data(z.object({ items: z.array(candidateSchema), next_cursor: z.string().nullable() })),
    signal: input.signal,
  })
  return response.data
}

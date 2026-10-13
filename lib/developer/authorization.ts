'use client'

import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * DEV-02 consent screen client. The pending authorization belongs to the signed-in user only after the gateway's
 * sign-in bridge bound it in this browser; until then the gateway answers `consent_required` and the page sends the
 * browser through the bridge once. Nothing here sees a code or a token: allow/deny return the engine's resume URL,
 * which must be on the authorization server origin.
 */

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

const authorizationRequestSchema = z.object({
  interaction_id: z.string(),
  app: z.object({
    id: z.string(),
    display_name: z.string(),
    purpose: z.string().optional().default(''),
    verified_domain: z.string(),
    homepage_url: z.string().optional().default(''),
    privacy_url: z.string().optional().default(''),
  }),
  environment: z.string(),
  principal_kind: z.string(),
  requested_scopes: z.array(z.object({ scope: z.string(), access: z.string(), data_class: z.string(), resource_kinds: z.array(z.string()) })),
  resource_kinds: z.array(z.string()),
  expires_at: z.string(),
  /** DEV-15: an MCP client connecting to the Youtorch MCP server shows its credit caps (never publishes). */
  connection_kind: z.string().optional(),
  mcp: z.object({
    caps: z.object({ per_job_credits: z.number(), monthly_credits: z.number() }),
    publish_allowed: z.literal(false),
  }).nullable().optional(),
})
export type DeveloperAuthorizationRequest = z.infer<typeof authorizationRequestSchema>

export interface DeveloperConsentResource {
  kind: string
  id: string
  revision_id?: string
  channel_id?: string
}

const candidateSchema = z.object({
  kind: z.string(),
  id: z.string(),
  revision_id: z.string().optional(),
  channel_id: z.string().optional(),
  display_label: z.string(),
})
export type DeveloperResourceCandidate = z.infer<typeof candidateSchema>

/** DEV-03 typed picker: candidates of one kind (projects/assets of one chosen channel) for the bound consent. */
export async function listDeveloperAuthorizationCandidates(
  uid: string,
  input: { kind: string; channelId?: string | null; signal?: AbortSignal },
): Promise<{ items: DeveloperResourceCandidate[]; next_cursor: string | null }> {
  const query = new URLSearchParams({ kind: input.kind })
  if (input.channelId) query.set('channel_id', input.channelId)
  const response = await gatewayRequest(`/api/v1/developer-authorizations/${encodeURIComponent(uid)}/resource-candidates?${query.toString()}`, {
    schema: data(z.object({ items: z.array(candidateSchema), next_cursor: z.string().nullable() })),
    signal: input.signal,
  })
  return response.data
}

const redirectSchema = z.object({ redirect_to: z.string() })

export function developerAuthorizationQueryKey(uid: string) {
  return ['developer', 'authorization', uid] as const
}

export async function getDeveloperAuthorization(uid: string, options: { signal?: AbortSignal } = {}): Promise<DeveloperAuthorizationRequest> {
  const response = await gatewayRequest(`/api/v1/developer-authorizations/${encodeURIComponent(uid)}`, { schema: data(authorizationRequestSchema), signal: options.signal })
  return response.data
}

export async function allowDeveloperAuthorization(uid: string, resources: DeveloperConsentResource[]): Promise<string> {
  const response = await gatewayRequest(`/api/v1/developer-authorizations/${encodeURIComponent(uid)}/consent`, {
    method: 'POST',
    csrf: true,
    body: { resources },
    schema: data(redirectSchema),
  })
  return assertEngineUrl(response.data.redirect_to)
}

export async function denyDeveloperAuthorization(uid: string): Promise<string> {
  const response = await gatewayRequest(`/api/v1/developer-authorizations/${encodeURIComponent(uid)}/deny`, {
    method: 'POST',
    csrf: true,
    schema: data(redirectSchema),
  })
  return assertEngineUrl(response.data.redirect_to)
}

/** The sign-in bridge on the authorization server (binds this browser's pending authorization to the session). */
export function developerSignInBridgeUrl(uid: string, apiBaseUrl = getYoutorchApiBaseUrl()): string {
  return `${apiBaseUrl}/api/v1/oauth/interaction/${encodeURIComponent(uid)}`
}

/** Only the authorization server's own resume URL is ever followed (no open redirect through the consent page). */
export function assertEngineUrl(url: string, apiBaseUrl = getYoutorchApiBaseUrl()): string {
  const expected = new URL(`${apiBaseUrl}/api/v1/oauth/`)
  const actual = new URL(url)
  if (actual.origin !== expected.origin || !actual.pathname.startsWith(expected.pathname)) {
    throw new Error('Unexpected authorization redirect')
  }
  return actual.toString()
}

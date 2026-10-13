'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Developer Platform API client (DEV-01 Settings > Developer). Everything is server state: the release switches,
 * the scope catalogue, the workspace's connected apps and the apps it owns. A client secret appears only in the
 * response of the command that created/rotated it and is never stored in the browser.
 */

export const DEVELOPER_STATUS_QUERY_KEY = ['developer', 'status'] as const
export const DEVELOPER_SCOPES_QUERY_KEY = ['developer', 'scopes'] as const
export const DEVELOPER_APPS_QUERY_KEY = ['developer', 'apps'] as const
export const DEVELOPER_INSTALLATIONS_QUERY_KEY = ['developer', 'installations'] as const

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

const statusSchema = z.object({
  enabled: z.boolean(),
  partner_apps_enabled: z.boolean(),
  /** DEV-09 Settings > Developer > API keys (absent on an older gateway = off). */
  personal_keys_enabled: z.boolean().optional(),
  /** DEV-07 Settings > Developer > Webhooks (absent on an older gateway = off). */
  webhooks_enabled: z.boolean().optional(),
})
export type DeveloperPlatformStatus = z.infer<typeof statusSchema>

const scopeDefinitionSchema = z.object({
  scope: z.string(),
  access: z.string(),
  data_class: z.string(),
  resource_kinds: z.array(z.string()),
})
export type DeveloperScopeDefinition = z.infer<typeof scopeDefinitionSchema>

const revisionSchema = z.object({
  id: z.string(),
  revision_number: z.number().int(),
  review_state: z.string(),
  review_reason_code: z.string().nullable().optional(),
  display_name: z.string(),
  purpose: z.string().optional(),
  verified_domain: z.string().optional(),
  redirect_uris: z.array(z.string()),
  requested_scopes: z.array(z.string()),
  principal_kinds: z.array(z.string()),
  /** DEV-07 manifest webhook (the platform installs its fixed subscription with consent). */
  webhook_url: z.string().nullable().optional(),
}).passthrough()
export type DeveloperAppRevision = z.infer<typeof revisionSchema>

const clientSchema = z.object({
  client_id: z.string(),
  environment: z.string(),
  client_kind: z.string(),
  status: z.string(),
  secret_hint: z.string(),
  secret_rotated_at: z.string(),
  version: z.number().int(),
})
export type DeveloperClient = z.infer<typeof clientSchema>

const appSchema = z.object({
  id: z.string(),
  status: z.string(),
  display_name: z.string(),
  latest_revision_number: z.number().int(),
  test_revision_id: z.string().nullable(),
  active_revision_id: z.string().nullable(),
  suspended_reason: z.string().nullable().optional(),
  revisions: z.array(revisionSchema),
  clients: z.array(clientSchema),
  version: z.number().int(),
})
export type DeveloperApp = z.infer<typeof appSchema>

const issuedSchema = z.object({ client: clientSchema, client_secret: z.string() })
export type DeveloperIssuedSecret = z.infer<typeof issuedSchema>

const installationSchema = z.object({
  id: z.string(),
  app: z.object({ id: z.string(), display_name: z.string(), verified_domain: z.string() }).passthrough(),
  environment: z.string(),
  principal_kind: z.string(),
  status: z.string(),
  app_available: z.boolean(),
  grant_epoch: z.number().int(),
  consented_scopes: z.array(z.string()),
  effective_scopes: z.array(z.string()),
  resources: z.array(z.object({ kind: z.string(), id: z.string(), revision_id: z.string().optional() })),
  acts_for_viewer: z.boolean(),
  installed_at: z.string(),
  version: z.number().int(),
})
export type DeveloperInstallation = z.infer<typeof installationSchema>

export interface DeveloperAppRegistration {
  display_name: string
  purpose: string
  verified_domain: string
  homepage_url: string
  support_url: string
  privacy_url: string
  redirect_uris: string[]
  requested_scopes: string[]
  principal_kinds: string[]
}

export async function getDeveloperPlatformStatus(options: { signal?: AbortSignal } = {}): Promise<DeveloperPlatformStatus> {
  const response = await gatewayRequest('/api/v1/developer-platform/status', { schema: data(statusSchema), signal: options.signal })
  return response.data
}

export async function listDeveloperScopes(options: { signal?: AbortSignal } = {}): Promise<DeveloperScopeDefinition[]> {
  const response = await gatewayRequest('/api/v1/developer-platform/scopes', {
    schema: data(z.object({ scopes: z.array(scopeDefinitionSchema) })),
    signal: options.signal,
  })
  return response.data.scopes
}

export async function listDeveloperInstallations(options: { signal?: AbortSignal } = {}): Promise<DeveloperInstallation[]> {
  const response = await gatewayRequest('/api/v1/developer-installations', { schema: data(z.array(installationSchema)), signal: options.signal })
  return response.data
}

export async function revokeDeveloperInstallation(installationId: string, expectedVersion: number): Promise<DeveloperInstallation> {
  const response = await gatewayRequest(`/api/v1/developer-installations/${encodeURIComponent(installationId)}/revoke`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion },
    schema: data(installationSchema),
  })
  return response.data
}

export async function listDeveloperApps(options: { signal?: AbortSignal } = {}): Promise<DeveloperApp[]> {
  const response = await gatewayRequest('/api/v1/developer-apps', { schema: data(z.array(appSchema)), signal: options.signal })
  return response.data
}

export async function registerDeveloperApp(input: DeveloperAppRegistration): Promise<DeveloperApp> {
  const response = await gatewayRequest('/api/v1/developer-apps', { method: 'POST', csrf: true, body: input, schema: data(appSchema) })
  return response.data
}

const commandSchema = z.object({ app: appSchema, issued: issuedSchema.nullable() })

export async function enableDeveloperAppTesting(appId: string, input: { revisionId: string; expectedVersion: number }) {
  const response = await gatewayRequest(`/api/v1/developer-apps/${encodeURIComponent(appId)}/testing`, {
    method: 'POST',
    csrf: true,
    body: { revision_id: input.revisionId, expected_version: input.expectedVersion },
    schema: data(commandSchema),
  })
  return response.data
}

export async function activateDeveloperApp(appId: string, input: { revisionId: string; expectedVersion: number }) {
  const response = await gatewayRequest(`/api/v1/developer-apps/${encodeURIComponent(appId)}/activation`, {
    method: 'POST',
    csrf: true,
    body: { revision_id: input.revisionId, expected_version: input.expectedVersion },
    schema: data(commandSchema),
  })
  return response.data
}

export async function rotateDeveloperClientSecret(appId: string, clientId: string, expectedVersion: number): Promise<DeveloperIssuedSecret> {
  const response = await gatewayRequest(`/api/v1/developer-apps/${encodeURIComponent(appId)}/clients/${encodeURIComponent(clientId)}/secret-rotation`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion },
    schema: data(issuedSchema),
  })
  return response.data
}

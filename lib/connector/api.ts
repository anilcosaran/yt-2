'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Connector API client (P01C-13 management UI and the P03-18 Chat card use the same server API).
 * Nothing here holds a token: OAuth runs in a popup against the provider, the gateway keeps the
 * credential, and the UI only reads safe server state (catalog, connections, attempts, candidates).
 * No browser storage is used for any of it.
 */

export const CONNECTORS_QUERY_KEY = ['connectors', 'catalog'] as const
export const CONNECTOR_CONNECTIONS_QUERY_KEY = ['connectors', 'connections'] as const

const connectorCatalogEntrySchema = z.object({
  connector_slug: z.string(),
  display_name: z.string(),
  resource_kinds: z.array(z.string()),
  capabilities: z.array(z.object({
    key: z.string(),
    effect: z.string(),
    available: z.boolean(),
    gate: z.string().nullable(),
  })),
})
export type ConnectorCatalogEntry = z.infer<typeof connectorCatalogEntrySchema>

const resourceRefSchema = z.object({ resource_kind: z.string(), resource_id: z.string() })
export type ConnectorResourceRef = z.infer<typeof resourceRefSchema>

const connectorConnectionSchema = z.object({
  connection_id: z.string(),
  connector_slug: z.string(),
  display_label: z.string().nullable(),
  auth_state: z.string(),
  auth_reason_code: z.string().nullable(),
  enabled: z.boolean(),
  health: z.string(),
  version: z.number().int(),
  connection_revision: z.number().int(),
  granted_capabilities: z.array(z.string()),
  bound_resources: z.array(resourceRefSchema.extend({ display_label: z.string().nullable() })),
  grants: z.array(z.object({ grant_id: z.string(), grantee_kind: z.string(), grantee_id: z.string() }).passthrough()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type ConnectorConnection = z.infer<typeof connectorConnectionSchema>

export const connectorAttemptStatuses = ['pending', 'awaiting_resource_selection', 'completed', 'failed', 'expired', 'cancelled', 'superseded'] as const
const attemptSchema = z.object({
  attempt_id: z.string(),
  status: z.string(),
  purpose: z.string(),
  reason_code: z.string().nullable(),
  connection_id: z.string().nullable(),
  requested_capabilities: z.array(z.string()),
  requires_resource_selection: z.boolean(),
  resource_kinds: z.array(z.string()),
  expires_at: z.string(),
})
export type ConnectorAuthorizationAttempt = z.infer<typeof attemptSchema>

const candidateSchema = resourceRefSchema.extend({
  display_label: z.string().nullable(),
  source_version: z.string().nullable(),
  selected: z.boolean(),
})
export type ConnectorResourceCandidate = z.infer<typeof candidateSchema>

const selectionResultSchema = z.object({
  connection_id: z.string(),
  attempt_id: z.string().nullable(),
  grant_ids: z.array(z.string()),
  granted_capabilities: z.array(z.string()),
  missing_capabilities: z.array(z.string()),
})

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

export async function listConnectors(options: { signal?: AbortSignal } = {}): Promise<ConnectorCatalogEntry[]> {
  const response = await gatewayRequest('/api/v1/connectors', { schema: data(z.array(connectorCatalogEntrySchema)), signal: options.signal })
  return response.data
}

export async function listConnectorConnections(options: { signal?: AbortSignal } = {}): Promise<ConnectorConnection[]> {
  const response = await gatewayRequest('/api/v1/connector-connections', { schema: data(z.array(connectorConnectionSchema)), signal: options.signal })
  return response.data
}

export async function getConnectorConnection(connectionId: string, options: { signal?: AbortSignal } = {}): Promise<ConnectorConnection> {
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}`, {
    schema: data(connectorConnectionSchema),
    signal: options.signal,
  })
  return response.data
}

export async function startConnectorAuthorization(connectorSlug: string, input: {
  capabilities: string[]
  connectionId?: string | null
  connectionRequirement?: { ref: string; version: number } | null
}): Promise<{ attempt_id: string; authorization_url: string; expires_at: string; purpose: string }> {
  const response = await gatewayRequest(`/api/v1/connectors/${encodeURIComponent(connectorSlug)}/authorization-attempts`, {
    method: 'POST',
    csrf: true,
    body: {
      capabilities: input.capabilities,
      ...(input.connectionId ? { connection_id: input.connectionId } : {}),
      ...(input.connectionRequirement ? { connection_requirement: input.connectionRequirement } : {}),
    },
    schema: data(z.object({
      attempt_id: z.string(),
      authorization_url: z.string().url(),
      expires_at: z.string(),
      purpose: z.string(),
    })),
  })
  return response.data
}

export async function getConnectorAuthorizationAttempt(attemptId: string, options: { signal?: AbortSignal } = {}): Promise<ConnectorAuthorizationAttempt> {
  const response = await gatewayRequest(`/api/v1/connectors/authorization-attempts/${encodeURIComponent(attemptId)}`, {
    schema: data(attemptSchema),
    signal: options.signal,
  })
  return response.data
}

export async function cancelConnectorAuthorizationAttempt(attemptId: string): Promise<ConnectorAuthorizationAttempt> {
  const response = await gatewayRequest(`/api/v1/connectors/authorization-attempts/${encodeURIComponent(attemptId)}/cancel`, {
    method: 'POST',
    csrf: true,
    schema: data(attemptSchema),
  })
  return response.data
}

export async function listConnectorResourceCandidates(connectionId: string, input: {
  resourceKind: string
  cursor?: string | null
  signal?: AbortSignal
}): Promise<{ items: ConnectorResourceCandidate[]; next_cursor: string | null; partial: boolean }> {
  const query = new URLSearchParams({ resource_kind: input.resourceKind })
  if (input.cursor) query.set('cursor', input.cursor)
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}/resource-candidates?${query.toString()}`, {
    schema: data(z.object({ items: z.array(candidateSchema), next_cursor: z.string().nullable(), partial: z.boolean() })),
    signal: input.signal,
  })
  return response.data
}

export async function selectConnectorResources(connectionId: string, input: {
  attemptId?: string | null
  capabilities?: string[] | null
  resources: ConnectorResourceRef[]
}): Promise<z.infer<typeof selectionResultSchema>> {
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}/resource-selections`, {
    method: 'POST',
    csrf: true,
    body: {
      ...(input.attemptId ? { attempt_id: input.attemptId } : {}),
      ...(input.capabilities && !input.attemptId ? { capabilities: input.capabilities } : {}),
      resources: input.resources,
    },
    schema: data(selectionResultSchema),
  })
  return response.data
}

export async function setConnectorConnectionEnabled(connectionId: string, input: { enabled: boolean; expectedVersion: number }): Promise<ConnectorConnection> {
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}/enabled`, {
    method: 'POST',
    csrf: true,
    body: { enabled: input.enabled, expected_version: input.expectedVersion },
    schema: data(connectorConnectionSchema),
  })
  return response.data
}

export async function revokeConnectorConnection(connectionId: string): Promise<ConnectorConnection> {
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}/revoke`, {
    method: 'POST',
    csrf: true,
    schema: data(connectorConnectionSchema),
  })
  return response.data
}

export async function bindYoutubeChannel(connectionId: string, input: { channelId: string; resourceId: string }) {
  const response = await gatewayRequest(`/api/v1/connector-connections/${encodeURIComponent(connectionId)}/youtube-channel-bindings`, {
    method: 'POST',
    csrf: true,
    body: { channel_id: input.channelId, resource_id: input.resourceId },
    schema: data(z.object({
      connection_id: z.string(),
      channel_id: z.string(),
      platform_channel_id: z.string(),
      channel_status: z.string(),
    })),
  })
  return response.data
}

// ------------------------------------------------------------------------------------------ P03-18 card

export const connectionCards = ['connect', 'enable', 'reconnect', 'add_permission', 'select_account', 'retry_later', 'none'] as const
export type ConnectionCard = (typeof connectionCards)[number]
export const connectionRequirementStates = ['open', 'satisfied', 'canceled', 'superseded', 'expired'] as const
export type ConnectionRequirementState = (typeof connectionRequirementStates)[number]

export const connectionRequirementSchema = z.object({
  schema_version: z.literal('assistant_connection_requirement_v1'),
  connection_requirement_id: z.string(),
  version: z.number().int().min(1),
  job_id: z.string(),
  step_id: z.string(),
  pending_invocation_id: z.string(),
  state: z.enum(connectionRequirementStates),
  required_capabilities: z.array(z.string()),
  reason_code: z.string(),
  card: z.enum(connectionCards),
  last_attempt_outcome: z.enum(['connected', 'failed', 'cancelled', 'expired']).nullable(),
  expires_at: z.string(),
  actionable: z.boolean().optional(),
  candidate_connection_id: z.string().nullable().optional(),
  resource_constraints: z.object({
    connection_id: z.string().optional(),
    resource: resourceRefSchema.optional(),
  }).nullable().optional(),
})
export type ConnectionRequirement = z.infer<typeof connectionRequirementSchema>

export async function getConnectionRequirement(requirementId: string, options: { signal?: AbortSignal } = {}): Promise<ConnectionRequirement> {
  const response = await gatewayRequest(`/api/v1/assistant-connection-requirements/${encodeURIComponent(requirementId)}`, {
    schema: data(connectionRequirementSchema),
    signal: options.signal,
  })
  return response.data
}

export async function resolveConnectionRequirement(requirementId: string, expectedVersion: number): Promise<ConnectionRequirement> {
  const response = await gatewayRequest(`/api/v1/assistant-connection-requirements/${encodeURIComponent(requirementId)}/resolve`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion },
    schema: data(connectionRequirementSchema),
  })
  return response.data
}

/** The requirement a connection-required question message carries (`content_json`), or null. */
export function readConnectionRequirementMessage(contentJson: unknown, messageId: string): {
  requirementId: string
  capabilities: string[]
  card: ConnectionCard
} | null {
  if (!contentJson || typeof contentJson !== 'object' || Array.isArray(contentJson)) return null
  const record = contentJson as Record<string, unknown>
  if (record.type !== 'assistant.connection_required') return null
  const capabilities = Array.isArray(record.required_capabilities)
    ? record.required_capabilities.filter((item): item is string => typeof item === 'string')
    : []
  const card = connectionCards.includes(record.card as ConnectionCard) ? record.card as ConnectionCard : 'none'
  // The requirement id is derived from the wait (= the question message), never taken from free content.
  return { requirementId: `creq_${messageId}`.slice(0, 64), capabilities, card }
}

/** Connectors in the server catalog that can provide every capability (available ones only: no fake Connect). */
export function connectorsForCapabilities(catalog: ConnectorCatalogEntry[], capabilities: string[]): ConnectorCatalogEntry[] {
  return catalog.filter((entry) => capabilities.length > 0 && capabilities.every((key) =>
    entry.capabilities.some((capability) => capability.key === key && capability.available)))
}

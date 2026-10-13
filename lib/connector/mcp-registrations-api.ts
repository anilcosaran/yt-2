'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * QA-131 client of the P01C-06 private remote MCP routes (`/api/v1/mcp-server-registrations`) and of the actor's
 * capabilities (`/api/v1/mcp-server-registration-capabilities`). Server state only (React Query memory, never browser
 * storage). A registration is private to its owner, never a catalog publication and never callable here; the scan is
 * read-only and runs on the server. Server-authored text (tool descriptions) is not shown.
 */

export const MCP_REGISTRATION_CAPABILITIES_QUERY_KEY = ['connectors', 'mcp-registration-capabilities'] as const
export const MCP_REGISTRATIONS_QUERY_KEY = ['connectors', 'mcp-registrations'] as const

const capabilitiesSchema = z.object({
  data: z.object({
    schema_version: z.literal('mcp_registration_capabilities_v1'),
    feature: z.enum(['enabled', 'disabled']).catch('disabled'),
    can_register: z.boolean().catch(false),
    registration_limit: z.number().int().min(0).catch(0),
  }),
})
export type McpRegistrationCapabilities = z.infer<typeof capabilitiesSchema>['data']

const scanToolSchema = z.object({
  name: z.string().min(1).max(256),
  policy_preview: z.enum(['block', 'review_required']).catch('review_required'),
  block_reason: z.string().nullable().catch(null),
})
export type McpScannedTool = z.infer<typeof scanToolSchema>

const scanOutcomes = ['complete', 'partial', 'auth_required', 'unsupported', 'transient', 'blocked'] as const
export type McpScanOutcome = (typeof scanOutcomes)[number]

const registrationSchema = z.object({
  id: z.string().min(1),
  endpoint_url: z.string(),
  publisher_label: z.string().nullable().catch(null),
  status: z.enum(['draft', 'test', 'active', 'disabled']),
  lifecycle_stage: z.enum(['draft', 'private_test', 'active', 'disabled']),
  last_scanned_at: z.string().nullable().catch(null),
  scan: z.object({
    outcome: z.enum(scanOutcomes),
    report: z.record(z.string(), z.unknown()).catch({}),
  }).nullable().catch(null),
  version: z.number().int(),
})
type RegistrationRecord = z.infer<typeof registrationSchema>

export type McpServerRegistration = Omit<RegistrationRecord, 'scan'> & {
  scan: {
    outcome: McpScanOutcome
    /** Tools of the last complete/partial snapshot (names only; descriptions stay untrusted server data). */
    tools: McpScannedTool[]
    toolsTotal: number
    excludedTotal: number
  } | null
}

const registrationResponseSchema = z.object({ data: z.unknown() })
const registrationListResponseSchema = z.object({ data: z.array(z.unknown()).catch([]) })

/** Drops a malformed row (never repaired); reads the tool list of the scan report defensively. */
export function parseMcpServerRegistration(raw: unknown): McpServerRegistration | null {
  const parsed = registrationSchema.safeParse(raw)
  if (!parsed.success) return null
  const { scan, ...rest } = parsed.data
  if (!scan) return { ...rest, scan: null }
  const tools = readRecord(scan.report['tools'])
  const items = Array.isArray(tools?.['items']) ? tools['items'] : []
  const parsedTools = items.flatMap((item) => {
    const tool = scanToolSchema.safeParse(item)
    return tool.success ? [tool.data] : []
  })
  return {
    ...rest,
    scan: {
      outcome: scan.outcome,
      tools: parsedTools,
      toolsTotal: typeof tools?.['admitted'] === 'number' ? tools['admitted'] : parsedTools.length,
      excludedTotal: typeof tools?.['excluded_total'] === 'number' ? tools['excluded_total'] : 0,
    },
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export async function getMcpRegistrationCapabilities(options: { signal?: AbortSignal } = {}): Promise<McpRegistrationCapabilities> {
  const result = await gatewayRequest('/api/v1/mcp-server-registration-capabilities', { schema: capabilitiesSchema, signal: options.signal })
  return result.data
}

export async function listMcpServerRegistrations(options: { signal?: AbortSignal } = {}): Promise<McpServerRegistration[]> {
  const result = await gatewayRequest('/api/v1/mcp-server-registrations', { schema: registrationListResponseSchema, signal: options.signal })
  return result.data.flatMap((row) => {
    const registration = parseMcpServerRegistration(row)
    return registration ? [registration] : []
  })
}

async function registrationCommand(path: string, body?: unknown): Promise<McpServerRegistration> {
  const result = await gatewayRequest(path, { method: 'POST', csrf: true, ...(body === undefined ? {} : { body }), schema: registrationResponseSchema })
  const registration = parseMcpServerRegistration(result.data)
  if (!registration) throw new Error('mcp_registration_response_invalid')
  return registration
}

export function registerMcpServer(input: { endpointUrl: string; publisherLabel?: string | null }): Promise<McpServerRegistration> {
  const label = input.publisherLabel?.trim()
  return registrationCommand('/api/v1/mcp-server-registrations', {
    endpoint_url: input.endpointUrl.trim(),
    ...(label ? { publisher_label: label } : {}),
  })
}

export function scanMcpServerRegistration(registrationId: string): Promise<McpServerRegistration> {
  return registrationCommand(`/api/v1/mcp-server-registrations/${encodeURIComponent(registrationId)}/scan`)
}

export function disableMcpServerRegistration(registrationId: string): Promise<McpServerRegistration> {
  return registrationCommand(`/api/v1/mcp-server-registrations/${encodeURIComponent(registrationId)}/disable`)
}

export type McpRegistrationErrorKind =
  | 'endpoint_blocked'
  | 'invalid_endpoint'
  | 'forbidden'
  | 'feature_unavailable'
  | 'already_registered'
  | 'limit_reached'
  | 'not_scannable'
  | 'cooldown'
  | 'not_found'
  | 'failed'

/** The localized reason of a failed command (stable server codes only; no server text is shown). */
export function describeMcpRegistrationError(error: unknown): { kind: McpRegistrationErrorKind; retryAfterSeconds: number | null } {
  if (!isAuthClientError(error)) return { kind: 'failed', retryAfterSeconds: null }
  const details = readRecord(error.details)
  const detail = typeof details?.['detail'] === 'string' ? details['detail'] : null
  switch (error.code) {
    case 'CONNECTOR_EGRESS_BLOCKED':
      return { kind: 'endpoint_blocked', retryAfterSeconds: null }
    case 'VALIDATION_ERROR':
      return { kind: 'invalid_endpoint', retryAfterSeconds: null }
    case 'CONNECTOR_FORBIDDEN':
      return { kind: 'forbidden', retryAfterSeconds: null }
    case 'CONNECTOR_FEATURE_UNAVAILABLE':
      return { kind: 'feature_unavailable', retryAfterSeconds: null }
    case 'CONNECTOR_NOT_FOUND':
      return { kind: 'not_found', retryAfterSeconds: null }
    case 'CONNECTOR_MCP_REGISTRATION_CONFLICT':
      if (detail === 'endpoint_already_registered') return { kind: 'already_registered', retryAfterSeconds: null }
      if (detail === 'registration_limit_reached') return { kind: 'limit_reached', retryAfterSeconds: null }
      if (detail === 'registration_disabled' || detail === 'registration_active') return { kind: 'not_scannable', retryAfterSeconds: null }
      return { kind: 'failed', retryAfterSeconds: null }
    default: {
      if (error.status !== 429) return { kind: 'failed', retryAfterSeconds: null }
      const retryAfter = Number(details?.['retryAfter'])
      return { kind: 'cooldown', retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null }
    }
  }
}

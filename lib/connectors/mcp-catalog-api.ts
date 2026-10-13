import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P01C-26 client of `/api/v1/connector-mcp-catalog` (phase 2, own server gate): the user's MCP `/` templates, a
 * template render (text only — the server never executes anything) and the `@` resources as `remote_file_ref_v1`.
 * Server data only (React Query memory, never browser storage); malformed entries are dropped, never repaired; while
 * the gate is closed the lists are empty.
 */

const untrustedSchema = z.object({ trust: z.literal('untrusted_data'), content: z.unknown() }).passthrough()

const templateSchema = z.object({
  name: z.string().min(1).max(128),
  title: z.string().max(128).nullable().catch(null),
  description: untrustedSchema.nullable().catch(null),
  arguments: z.array(z.object({
    name: z.string().min(1).max(64),
    description: z.string().max(512).nullable().catch(null),
    required: z.boolean(),
  })).catch([]),
  insert_only: z.literal(true),
})

const templateConnectionSchema = z.object({
  connection_id: z.string().min(1).max(128),
  registration_id: z.string().min(1).max(128),
  connector_label: z.string().min(1).max(255),
  shared: z.boolean().catch(false),
  templates: z.array(z.unknown()).catch([]),
})

const templatesResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('connector_mcp_templates_v1'),
    feature: z.enum(['enabled', 'disabled']).catch('disabled'),
    connections: z.array(z.unknown()).catch([]),
  }),
})

const renderResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('connector_mcp_prompt_render_v1'),
    insert_text: z.string().max(8000),
    truncated: z.boolean(),
    dropped_parts: z.number().int().min(0),
    injection_signals: z.array(z.string()).catch([]),
    executes: z.literal(false),
  }),
})

const remoteFileRefSchema = z.object({
  schema_version: z.literal('remote_file_ref_v1'),
  connection_id: z.string().min(1).max(128),
  resource: z.object({ resource_kind: z.literal('mcp_server'), resource_id: z.string().min(1).max(128) }),
  file_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u),
  mime_hint: z.string().optional(),
  size_hint_bytes: z.number().int().min(0).optional(),
}).strict()

const resourceSchema = z.object({
  ref: remoteFileRefSchema,
  connector_label: z.string().min(1).max(255),
  display_label: z.string().min(1).max(255),
  description: untrustedSchema.nullable().catch(null),
  mime_type: z.string().max(160).nullable().catch(null),
  size_bytes: z.number().int().min(0).nullable().catch(null),
})

const resourcesResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('connector_mcp_resources_v1'),
    feature: z.enum(['enabled', 'disabled']).catch('disabled'),
    resources: z.array(z.unknown()).catch([]),
  }),
})

export type McpTemplate = z.infer<typeof templateSchema>
export type McpTemplateConnection = Omit<z.infer<typeof templateConnectionSchema>, 'templates'> & { templates: McpTemplate[] }
export type McpTemplateRender = z.infer<typeof renderResponseSchema>['data']
export type McpResourceCandidate = z.infer<typeof resourceSchema>

export const MCP_TEMPLATES_QUERY_KEY = ['connectors', 'mcp-catalog', 'templates'] as const
export const mcpResourcesQueryKey = (query: string) => ['connectors', 'mcp-catalog', 'resources', query] as const

export function parseMcpTemplateConnections(raw: readonly unknown[]): McpTemplateConnection[] {
  const connections: McpTemplateConnection[] = []
  for (const entry of raw) {
    const parsed = templateConnectionSchema.safeParse(entry)
    if (!parsed.success) continue
    const templates: McpTemplate[] = []
    for (const template of parsed.data.templates) {
      const parsedTemplate = templateSchema.safeParse(template)
      if (parsedTemplate.success) templates.push(parsedTemplate.data)
    }
    if (templates.length > 0) connections.push({ ...parsed.data, templates })
  }
  return connections
}

export function parseMcpResources(raw: readonly unknown[]): McpResourceCandidate[] {
  const out: McpResourceCandidate[] = []
  for (const entry of raw) {
    const parsed = resourceSchema.safeParse(entry)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export async function getMcpTemplates(options: { signal?: AbortSignal } = {}): Promise<McpTemplateConnection[]> {
  const result = await gatewayRequest('/api/v1/connector-mcp-catalog/prompts', { schema: templatesResponseSchema, signal: options.signal })
  return result.data.feature === 'enabled' ? parseMcpTemplateConnections(result.data.connections) : []
}

/** Text for the composer; nothing runs on the server or here. */
export async function renderMcpTemplate(
  input: { connectionId: string; name: string; arguments?: Record<string, string> },
  options: { signal?: AbortSignal } = {},
): Promise<McpTemplateRender> {
  const result = await gatewayRequest('/api/v1/connector-mcp-catalog/prompts/render', {
    method: 'POST',
    csrf: true,
    body: { connection_id: input.connectionId, name: input.name, arguments: input.arguments ?? {} },
    schema: renderResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getMcpResources(query: string, options: { signal?: AbortSignal } = {}): Promise<McpResourceCandidate[]> {
  const q = query.trim().slice(0, 80)
  const path = q ? `/api/v1/connector-mcp-catalog/resources?q=${encodeURIComponent(q)}` : '/api/v1/connector-mcp-catalog/resources'
  const result = await gatewayRequest(path, { schema: resourcesResponseSchema, signal: options.signal })
  return result.data.feature === 'enabled' ? parseMcpResources(result.data.resources) : []
}

/**
 * Puts a rendered template where the `/query` trigger was (the trigger token is replaced, the rest of the message
 * stays); the caret lands after the inserted text. Pure: the caller applies it as one undoable edit.
 */
export function insertMcpTemplateText(text: string, trigger: { start: number; end: number }, insert: string): { text: string; caret: number } {
  const head = text.slice(0, trigger.start)
  const tail = text.slice(trigger.end).replace(/^ /u, '')
  const joiner = tail.length > 0 && !/^\s/u.test(tail) ? ' ' : ''
  const next = `${head}${insert}${joiner}${tail}`
  return { text: next, caret: head.length + insert.length }
}

'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'
import { getOrCreateMemoryMutationAttempt } from '@/lib/memory/mutation-attempt'

/** P01B-16 list-card query (keyset pages); the filter is part of the key because a cursor is bound to it. */
export const memoryCardsQueryKey = (channelId: string | null, filter: MemoryCardsFilter = {}) => [
  'memory',
  'cards',
  channelId,
  filter,
] as const

/** Lazy detail (body + version) of one Memory item. */
export const memoryItemQueryKey = (channelId: string | null, memoryItemId: string | null) => [
  'memory',
  'item',
  channelId,
  memoryItemId,
] as const

export const memorySettingsQueryKey = (channelId: string | null) => [
  'memory',
  'settings',
  channelId,
] as const

const memoryDocumentTypeSchema = z.enum(['media_metadata', 'transcript', 'summary', 'chat_memory', 'channel_memory', 'user_memory'])
const memoryItemStatusSchema = z.enum(['pending', 'active', 'failed', 'inactive'])
const memoryAnalysisProfileSchema = z.enum([
  'summary_only',
  'description_and_tags',
  'transcript_summary',
  'full_semantic_index',
  'memory_note',
])
const memoryRuleModeSchema = z.enum(['off', 'auto', 'approval'])
const memorySceneExtractionSchema = z.enum([
  'none',
  'important',
  'funny_or_meme',
  'important_and_funny',
])
const memoryObjectCategorySchema = z.enum([
  'document',
  'image',
  'audio',
  'video',
  'data',
  'archive',
  'font',
])
const memoryRuleSourceSchema = z.enum(['any', 'storage', 'chat_upload'])
const memoryCustomRuleActionSchema = z.enum(['add', 'skip', 'approval'])
const memoryCustomRuleFieldSchema = z.enum(['always', 'size_bytes', 'duration_seconds'])
const memoryCustomRuleOperatorSchema = z.enum(['always', 'gt', 'gte', 'lt', 'lte'])

const memoryRuleSchema = z.object({
  mode: memoryRuleModeSchema.catch('auto'),
  max_size_bytes: z.number().nullable().optional().catch(undefined),
  max_duration_seconds: z.number().nullable().optional().catch(undefined),
  approval_duration_seconds: z.number().nullable().optional().catch(undefined),
  transcript_enabled: z.boolean().optional().catch(undefined),
  scene_extraction: memorySceneExtractionSchema.optional().catch(undefined),
  analysis_profile: memoryAnalysisProfileSchema.optional().catch(undefined),
})

const memoryCustomRuleSchema = z.object({
  id: z.string().optional().catch(undefined),
  label: z.string().optional().catch(undefined),
  enabled: z.boolean().optional().catch(undefined),
  source: memoryRuleSourceSchema.optional().catch('storage'),
  category: z.union([memoryObjectCategorySchema, z.literal('any')]).optional().catch('any'),
  folder_path: z.string().nullable().optional().catch(null),
  field: memoryCustomRuleFieldSchema.optional().catch('always'),
  operator: memoryCustomRuleOperatorSchema.optional().catch('always'),
  value: z.number().nullable().optional().catch(null),
  action: memoryCustomRuleActionSchema,
  analysis_profile: memoryAnalysisProfileSchema.optional().catch(undefined),
})

const memoryRulesSchema = z.object({
  document: memoryRuleSchema.optional(),
  image: memoryRuleSchema.optional(),
  audio: memoryRuleSchema.optional(),
  video: memoryRuleSchema.optional(),
  data: memoryRuleSchema.optional(),
  archive: memoryRuleSchema.optional(),
  font: memoryRuleSchema.optional(),
  custom_rules: z.array(memoryCustomRuleSchema).optional().catch([]),
}).catch({})

const memoryPermissionsSchema = z.object({
  can_read: z.boolean().catch(false),
  can_query: z.boolean().optional().catch(undefined),
  can_mutate: z.boolean().optional().catch(undefined),
  can_write_items: z.boolean().optional().catch(undefined),
  can_manage_settings: z.boolean().optional().catch(undefined),
}).catch({
  can_read: false,
  can_query: undefined,
  can_mutate: undefined,
  can_write_items: undefined,
  can_manage_settings: undefined,
}).transform((permissions) => {
  const canManageSettings = permissions.can_manage_settings ?? permissions.can_mutate ?? false
  return {
    can_read: permissions.can_read,
    can_query: permissions.can_query ?? permissions.can_read,
    can_mutate: canManageSettings,
    can_write_items: permissions.can_write_items ?? permissions.can_read,
    can_manage_settings: canManageSettings,
  }
})

const memorySettingsSchema = z.object({
  channel_id: z.string(),
  desired_enabled: z.boolean(),
  effective_enabled: z.boolean(),
  status: z.enum(['active', 'disabled_by_user', 'disabled_by_plan', 'retention', 'purged']),
  disabled_reason: z.string().nullable().catch(null),
  retention_started_at: z.string().nullable().catch(null),
  cleanup_due_at: z.string().nullable().catch(null),
  activated_at: z.string().nullable().catch(null),
  memory_rules: memoryRulesSchema,
  permissions: memoryPermissionsSchema.default({
    can_read: false,
    can_query: false,
    can_mutate: false,
  }),
})

// P01B-09 server-derived scope: `private` = only the owner (user_memory/chat_memory), `channel` = channel readers.
const memoryItemVisibilitySchema = z.enum(['private', 'channel']).optional().catch(undefined)

// P01B-10: `version` is the item's source revision, sent back as `expected_version` on PATCH/DELETE.
const memoryItemVersionSchema = z.number().int().positive().optional().catch(undefined)

const memoryItemSchema = z.object({
  id: z.string(),
  document_type: memoryDocumentTypeSchema,
  content: z.string(),
  metadata: z.record(z.unknown()).catch({}),
  visibility: memoryItemVisibilitySchema,
  status: memoryItemStatusSchema.catch('active'),
  version: memoryItemVersionSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

const memoryItemResponseSchema = z.object({
  data: memoryItemSchema,
})

// P01B-16 list card: card metadata only (no body); the detail read above returns the body.
const optionalCardTextSchema = z.string().nullable().optional().transform((value) => value ?? null).catch(null)

const memoryListCardSchema = z.object({
  id: z.string(),
  document_type: memoryDocumentTypeSchema,
  status: memoryItemStatusSchema.catch('active'),
  visibility: memoryItemVisibilitySchema,
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
  title: z.string(),
  preview: optionalCardTextSchema,
  preview_truncated: z.boolean().catch(false),
  source: optionalCardTextSchema,
  memory_kind: optionalCardTextSchema,
  mime_type: optionalCardTextSchema,
  path: optionalCardTextSchema,
  object_id: optionalCardTextSchema,
})

const memoryCardsResponseSchema = z.object({
  data: z.object({
    items: z.array(memoryListCardSchema),
    page: z.object({
      limit: z.number(),
      sort: z.enum(['created_desc', 'updated_desc']).catch('created_desc'),
      has_more: z.boolean(),
      next_cursor: z.string().nullable(),
    }),
    total: z.object({ value: z.number(), is_lower_bound: z.boolean() }).nullable().catch(null),
    fence: z.string().catch(''),
    consistency: z.object({
      changed_since_start: z.boolean().catch(false),
      read_source: z.string().catch('primary'),
    }).catch({ changed_since_start: false, read_source: 'primary' }),
  }),
})

const memorySettingsResponseSchema = z.object({
  data: memorySettingsSchema,
})

const createMemoryItemResponseSchema = z.object({
  data: z.object({
    memory_item_id: z.string(),
    document_type: memoryDocumentTypeSchema,
    content: z.string().optional().catch(''),
    metadata: z.record(z.unknown()).optional().catch({}),
    visibility: memoryItemVisibilitySchema,
    created: z.boolean(),
    status: memoryItemStatusSchema.catch('pending'),
    created_at: z.string().optional().catch(undefined),
    updated_at: z.string().optional().catch(undefined),
  }),
})

const updateMemoryItemResponseSchema = z.object({
  data: z.object({
    memory_item_id: z.string(),
    reindexed: z.boolean(),
    status: memoryItemStatusSchema.optional().catch(undefined),
    version: memoryItemVersionSchema,
  }),
})

const deleteMemoryItemResponseSchema = z.object({
  data: z.object({
    memory_item_id: z.string(),
    deleted: z.boolean(),
    idempotent: z.boolean(),
    // P01B-10: `accepted` = hidden and tombstoned now, provider cleanup finishing in durable recovery.
    completion: z.enum(['completed', 'accepted']).optional().catch(undefined),
  }),
})

const clearMemoryItemsResponseSchema = z.object({
  data: z.object({
    deleted_documents: z.number(),
    idempotent: z.boolean(),
  }).passthrough(),
})

const requestObjectIndexingResponseSchema = z.object({
  data: z.object({
    request_id: z.string(),
    object_id: z.string(),
    status: z.enum(['not_added', 'approval_required', 'pending', 'started']),
    analysis_profile: memoryAnalysisProfileSchema,
    indexing_intent: z.enum(['none', 'auto_if_allowed', 'user_selected', 'agent_requested', 'internal_policy']),
    idempotent: z.boolean(),
    decision_reason: z.string().optional().catch(undefined),
  }),
})

// P01B-04: "Belleğe de ekle" preview of the channel's ingestion decision for files about to be uploaded.
const memoryIngestionPreviewResponseSchema = z.object({
  data: z.object({
    source: memoryRuleSourceSchema.exclude(['any']),
    memory_available: z.boolean(),
    unavailable_reason: z.enum(['memory_disabled', 'memory_write_disabled', 'channel_memory_disabled']).nullable(),
    items: z.array(z.object({
      file_name: z.string(),
      category: z.string(),
      analysis_profile: memoryAnalysisProfileSchema,
      policy_result: z.enum(['queued', 'approval_required', 'not_added']),
      reason: z.string(),
      default_checked: z.boolean(),
      selectable: z.boolean(),
    })),
  }),
})

const memoryQueryResultSchema = z.object({
  id: z.string(),
  score: z.number().catch(0),
  metadata: z.record(z.unknown()).catch({}),
})

const memoryQueryResponseSchema = z.object({
  data: z.object({
    results: z.array(memoryQueryResultSchema).catch([]),
  }),
})

export type MemoryDocumentType = z.infer<typeof memoryDocumentTypeSchema>
export type MemoryItemStatus = z.infer<typeof memoryItemStatusSchema>
export type MemoryAnalysisProfile = z.infer<typeof memoryAnalysisProfileSchema>
export type MemoryRuleMode = z.infer<typeof memoryRuleModeSchema>
export type MemorySceneExtraction = z.infer<typeof memorySceneExtractionSchema>
export type MemoryObjectCategory = z.infer<typeof memoryObjectCategorySchema>
export type MemoryRuleSource = z.infer<typeof memoryRuleSourceSchema>
export type MemoryCustomRule = z.infer<typeof memoryCustomRuleSchema>
export type MemoryCustomRuleAction = z.infer<typeof memoryCustomRuleActionSchema>
export type MemoryCustomRuleField = z.infer<typeof memoryCustomRuleFieldSchema>
export type MemoryCustomRuleOperator = z.infer<typeof memoryCustomRuleOperatorSchema>
export type MemoryRule = z.infer<typeof memoryRuleSchema>
export type MemoryRules = z.infer<typeof memoryRulesSchema>
export type MemorySettings = z.infer<typeof memorySettingsSchema>
export type MemoryItem = z.infer<typeof memoryItemSchema>
export type MemoryListCard = z.infer<typeof memoryListCardSchema>
export type MemoryCardsPage = z.infer<typeof memoryCardsResponseSchema>['data']
export type MemoryQueryResult = z.infer<typeof memoryQueryResultSchema>
export type ObjectMemoryIndexingResult = z.infer<typeof requestObjectIndexingResponseSchema>['data']

/** Server-side filters of the card list (the free-text search runs over the loaded cards; the API has none). */
export type MemoryCardsFilter = {
  documentTypes?: MemoryDocumentType[]
  statuses?: MemoryItemStatus[]
  visibility?: 'private' | 'channel'
  sort?: 'created_desc' | 'updated_desc'
}

export type MemoryCardsPageInput = MemoryCardsFilter & {
  limit?: number
  cursor?: string | null
  /** Asked once per pass (first page): the count is deferred/optional on the server. */
  includeTotal?: boolean
  /** Read-your-writes floor (`ml:c<n>[.p<n>]`) from an earlier page. */
  minFence?: string | null
}

export const MEMORY_CARDS_PAGE_SIZE = 50

export async function getMemorySettings(channelId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/memory/channels/${encodeURIComponent(channelId)}/settings`, {
    schema: memorySettingsResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function updateMemorySettings(input: {
  channelId: string
  memoryEnabled: boolean
  memoryRules: MemoryRules
}) {
  const result = await gatewayRequest(`/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/settings`, {
    method: 'PATCH',
    csrf: true,
    body: {
      memory_enabled: input.memoryEnabled,
      memory_rules: input.memoryRules,
    },
    schema: memorySettingsResponseSchema,
  })
  return result.data
}

/** P01B-16: one keyset page of Memory cards (no bodies; ACL inside the query; `next_cursor` continues the pass). */
export async function listMemoryCards(
  channelId: string,
  input: MemoryCardsPageInput = {},
  options: { signal?: AbortSignal } = {},
): Promise<MemoryCardsPage> {
  const params = new URLSearchParams()
  params.set('limit', String(input.limit ?? MEMORY_CARDS_PAGE_SIZE))
  if (input.cursor) params.set('cursor', input.cursor)
  if (input.sort) params.set('sort', input.sort)
  if (input.documentTypes?.length) params.set('document_type', input.documentTypes.join(','))
  if (input.statuses?.length) params.set('status', input.statuses.join(','))
  if (input.visibility) params.set('visibility', input.visibility)
  if (input.includeTotal) params.set('include_total', 'true')
  if (input.minFence) params.set('min_fence', input.minFence)
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(channelId)}/memory-cards?${params.toString()}`,
    { schema: memoryCardsResponseSchema, signal: options.signal },
  )
  return result.data
}

/** The full item (body + version) behind a card, read when the user opens or edits it. */
export async function getMemoryItem(
  channelId: string,
  memoryItemId: string,
  options: { signal?: AbortSignal } = {},
): Promise<MemoryItem> {
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(channelId)}/memory/${encodeURIComponent(memoryItemId)}`,
    { schema: memoryItemResponseSchema, signal: options.signal },
  )
  return result.data
}

/** A card in the item shape the page helpers read: card metadata as metadata, the preview as (partial) content. */
export type MemoryCardItem = MemoryItem & { preview_truncated: boolean }

export function memoryCardToItem(card: MemoryListCard): MemoryCardItem {
  const metadata: Record<string, unknown> = { title: card.title }
  if (card.path) metadata.path = card.path
  if (card.source) metadata.source = card.source
  if (card.memory_kind) metadata.memory_kind = card.memory_kind
  if (card.mime_type) metadata.mime_type = card.mime_type
  if (card.object_id) metadata.object_id = card.object_id
  return {
    id: card.id,
    document_type: card.document_type,
    content: card.preview ?? '',
    metadata,
    visibility: card.visibility,
    status: card.status,
    version: card.version,
    created_at: card.created_at,
    updated_at: card.updated_at,
    preview_truncated: card.preview_truncated,
  }
}

export async function createMemoryItem(input: {
  channelId: string
  documentType: MemoryDocumentType
  content: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/memory`, {
    method: 'POST',
    csrf: true,
    body: {
      document_type: input.documentType,
      content: input.content,
      metadata: input.metadata,
      idempotency_key: input.idempotencyKey ?? createActionIdempotencyKey('memory-create'),
    },
    schema: createMemoryItemResponseSchema,
  })
  return result.data
}

export async function updateMemoryItem(input: {
  channelId: string
  memoryItemId: string
  content?: string
  metadata?: Record<string, unknown>
  status?: 'active' | 'inactive'
  idempotencyKey?: string
  /** P01B-10: the `version` the user read; a newer revision answers 409 MEMORY_ITEM_VERSION_CONFLICT. */
  expectedVersion?: number
}) {
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/memory/${encodeURIComponent(input.memoryItemId)}`,
    {
      method: 'PATCH',
      csrf: true,
      body: {
        content: input.content,
        metadata: input.metadata,
        status: input.status,
        idempotency_key: input.idempotencyKey ?? createActionIdempotencyKey('memory-update'),
        expected_version: input.expectedVersion,
      },
      schema: updateMemoryItemResponseSchema,
    },
  )
  return result.data
}

export async function deleteMemoryItem(input: {
  channelId: string
  memoryItemId: string
  /** P01B-10: the `version` the user saw; a newer revision answers 409 and nothing is deleted. */
  expectedVersion?: number
}) {
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/memory/${encodeURIComponent(input.memoryItemId)}`,
    {
      method: 'DELETE',
      csrf: true,
      body: {
        idempotency_key: input.expectedVersion
          ? `memory-delete:${input.memoryItemId}:v${input.expectedVersion}`
          : `memory-delete:${input.memoryItemId}`,
        expected_version: input.expectedVersion,
      },
      schema: deleteMemoryItemResponseSchema,
    },
  )
  return result.data
}

export async function clearMemoryItems(channelId: string, idempotencyKey?: string) {
  const result = await gatewayRequest(`/api/v1/memory/channels/${encodeURIComponent(channelId)}/memory`, {
    method: 'DELETE',
    csrf: true,
    body: {
      idempotency_key: idempotencyKey ?? createActionIdempotencyKey('memory-clear'),
    },
    schema: clearMemoryItemsResponseSchema,
  })
  return result.data
}

export type MemoryIngestionPreview = z.infer<typeof memoryIngestionPreviewResponseSchema>['data']

export async function previewMemoryIngestion(input: {
  channelId: string
  source?: 'storage' | 'chat_upload'
  items: Array<{ fileName: string; parentPath?: string; mimeType: string; sizeBytes?: number; durationSeconds?: number }>
}): Promise<MemoryIngestionPreview> {
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/ingestion-preview`,
    {
      method: 'POST',
      csrf: true,
      body: {
        source: input.source,
        items: input.items.map((item) => ({
          file_name: item.fileName,
          parent_path: item.parentPath || undefined,
          mime_type: item.mimeType || 'application/octet-stream',
          size_bytes: item.sizeBytes,
          duration_seconds: item.durationSeconds,
        })),
      },
      schema: memoryIngestionPreviewResponseSchema,
    },
  )
  return result.data
}

export async function requestStorageObjectMemoryIndexing(input: {
  channelId: string
  objectId: string
  /** Owner/admin "add anyway": overrides a refusing channel rule. Never together with `approve`. */
  force?: boolean
  /** S20 owner/admin "approve" of an approval_required object: clears only the approval step. */
  approve?: boolean
}) {
  const result = await gatewayRequest(
    `/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}/indexing-requests`,
    {
      method: 'POST',
      csrf: true,
      body: {
        request_id: createActionIdempotencyKey('memory-object'),
        indexing_intent: 'user_selected',
        force: input.force || undefined,
        approve: input.approve && !input.force ? true : undefined,
      },
      schema: requestObjectIndexingResponseSchema,
    },
  )
  return result.data
}

export async function queryMemory(input: {
  channelId: string
  query: string
  topK?: number
  requestId?: string
}) {
  const requestId = input.requestId?.trim() || getOrCreateMemoryMutationAttempt(
    {
      action: 'query',
      channelId: input.channelId,
      query: input.query,
      topK: input.topK,
    },
    () => createActionIdempotencyKey('memory-query'),
  ).idempotencyKey
  const result = await gatewayRequest(`/api/v1/memory/channels/${encodeURIComponent(input.channelId)}/query`, {
    method: 'POST',
    csrf: true,
    body: {
      query: input.query,
      top_k: input.topK,
      request_id: requestId,
    },
    schema: memoryQueryResponseSchema,
  })
  return result.data
}

/** P01B-10: the item changed since the user read it (PATCH/DELETE `expected_version` mismatch). */
export function isMemoryVersionConflictError(error: unknown) {
  return isAuthClientError(error) && error.code === 'MEMORY_ITEM_VERSION_CONFLICT'
}

/** P01B-16: the cursor no longer matches the list (scope/filter changed, or unreadable): restart from the first page. */
export function isMemoryListCursorError(error: unknown) {
  if (!isAuthClientError(error) || error.status !== 400) return false
  const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : {}
  return details.code_detail === 'MEMORY_LIST_CURSOR_INVALID' || details.code_detail === 'MEMORY_LIST_CURSOR_MISMATCH'
}

/** P01B-16: the replica is behind and the bounded primary read is busy; retryable after a second. */
export function isMemoryListPendingError(error: unknown) {
  return isAuthClientError(error) && error.code === 'MEMORY_LIST_PENDING'
}

export function getMemoryActionErrorMessage(error: unknown) {
  if (isAuthClientError(error)) {
    if (error.code === 'CHANNEL_NOT_FOUND' || error.code === 'NOT_FOUND') {
      return 'Selected channel is no longer available. Choose another channel.'
    }
    if (error.code === 'FORBIDDEN' || error.code === 'UNAUTHORIZED') {
      return 'You do not have access to this channel memory.'
    }
    if (error.code === 'INSUFFICIENT_ROLE') {
      return 'You do not have permission to change these Memory settings.'
    }
    if (error.code === 'MEMORY_ACTION_DISABLED') {
      return 'This Memory action is disabled for this workspace.'
    }
    if (error.code === 'MEMORY_PROVIDER_ERROR') {
      const details = getMemoryProviderErrorDetails(error.details)
      return details
        ? `Memory provider failed while creating embeddings (${details}).`
        : 'Memory provider failed while creating embeddings. Check provider key reservation and vector index health.'
    }
    if (error.code === 'GATEWAY_NETWORK_ERROR') {
      const details = getGatewayNetworkErrorDetails(error.details)
      return details
        ? `Gateway request failed before the app received a response (${details}). Check API/proxy/CORS for this request.`
        : 'Gateway request failed before the app received a response. This usually means the API/proxy returned a 502 or blocked response.'
    }
    if (error.code === 'GATEWAY_RESPONSE_INVALID') {
      return 'Gateway response format is invalid. The backend may be returning a non-JSON error page (502/invalid proxy response).'
    }
    if (error.code === 'AUTH_REQUEST_FAILED' && error.status >= 500) {
      return 'Memory backend is unavailable right now (gateway returned a server error).'
    }
    if (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'INTERNAL_ERROR') {
      return 'Memory is temporarily unavailable. Please retry shortly.'
    }
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Memory action failed.'
}

function getMemoryProviderErrorDetails(details: unknown) {
  if (!details || typeof details !== 'object') return null
  const context = details as Record<string, unknown>
  const status = context.upstream_status ?? context.status
  const code = context.upstream_code ?? context.error_code
  const message = context.upstream_message
  return [status ? `status ${String(status)}` : null, code ? String(code) : null, message ? String(message) : null]
    .filter(Boolean)
    .join(' / ') || null
}

function getGatewayNetworkErrorDetails(details: unknown) {
  if (!details || typeof details !== 'object') return null
  const context = details as Record<string, unknown>
  const method = typeof context.method === 'string' && context.method.trim()
    ? context.method.trim().toUpperCase()
    : null
  const url = typeof context.url === 'string' && context.url.trim() ? context.url.trim() : null
  const cause = typeof context.cause === 'string' && context.cause.trim() ? context.cause.trim() : null
  const request = [method, url].filter(Boolean).join(' ')
  return [request || null, cause ? `cause: ${cause}` : null]
    .filter(Boolean)
    .join(' / ') || null
}

function createActionIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${hashString([
    String(Date.now()),
    String(Math.random()),
  ].join('|'))}`
}

function hashString(value: string) {
  let h1 = 0xdeadbeef ^ value.length
  let h2 = 0x41c6ce57 ^ value.length
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

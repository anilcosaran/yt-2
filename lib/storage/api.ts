'use client'

import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest, getGatewayCsrfToken } from '@/lib/gateway/client'
import { createStorageUploadFingerprint } from '@/lib/storage/file-checksum'
import {
  getTusResumeEntry,
  removeTusResumeEntry,
  setTusResumeEntry,
  toTusResumeFile,
} from '@/lib/storage/tus-resume-store'
import {
  resolveSafeBunnyTusTargetUrl,
  resolveSafeBunnyTusUploadLocation,
  resolveSafeBunnyS3UploadUrl,
  resolveSafeBunnyS3UploadHeaders,
  resolveSafeStorageProxyUploadUrl,
} from '@/lib/storage/upload-url-security'

export const storageObjectsQueryKey = (channelId: string | null, input: StorageListInput) => [
  'storage',
  'objects',
  channelId,
  input,
] as const

export const storageUsageQueryKey = (channelId: string | null) => [
  'storage',
  'usage',
  channelId,
] as const

export const storageUsageAggregateQueryKey = ['storage', 'usage', 'aggregate'] as const

const STORAGE_BINARY_UPLOAD_TIMEOUT = {
  idleTimeoutMs: 75_000,
  totalTimeoutMs: 55 * 60_000,
} as const
const STORAGE_CONTROL_REQUEST_TIMEOUT = {
  idleTimeoutMs: 15_000,
  totalTimeoutMs: 30_000,
} as const
const STORAGE_UPLOAD_GATEWAY_TIMEOUT_MS = 75_000
const STORAGE_UPLOAD_EXPIRY_SAFETY_MS = 60_000

const storagePreviewInputSchema = z.object({
  source: z.literal('client_generated').catch('client_generated'),
  kind: z.enum(['image', 'video']),
  data_url: z.string(),
  width: z.number().catch(0),
  height: z.number().catch(0),
  duration_seconds: z.number().nullable().catch(null),
  generated_at: z.string().optional().catch(undefined),
}).nullable().catch(null)
const storageObjectPreviewSchema = z.null().catch(null)

const storageMemoryStatusSchema = z.enum([
  'not_added',
  'approval_required',
  'queued',
  'processing',
  'added',
  'failed',
])

export const storageAssetRoleSchema = z.enum([
  'generated_speech',
  'voice_reference',
  'voice_preview',
  'avatar',
  'avatar_reference',
  'avatar_shot',
  'avatar_preview',
])

export const STORAGE_AVATAR_ASSET_ROLES = [
  'avatar',
  'avatar_reference',
  'avatar_shot',
  'avatar_preview',
] as const satisfies readonly z.infer<typeof storageAssetRoleSchema>[]

export function isIndexedStorageAvatarRole(
  role: string | null | undefined,
): role is typeof STORAGE_AVATAR_ASSET_ROLES[number] {
  return Boolean(role && (STORAGE_AVATAR_ASSET_ROLES as readonly string[]).includes(role))
}

const storageObjectSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  parent_id: z.string().nullable().catch(null),
  type: z.enum(['file', 'folder']),
  status: z.enum(['pending', 'active', 'processing', 'deleted', 'quarantined', 'failed']),
  name: z.string(),
  path: z.string(),
  storage_key: z.string(),
  mime_type: z.string().nullable().catch(null),
  extension: z.string().nullable().catch(null),
  size_bytes: z.string(),
  checksum_sha256: z.string().nullable().catch(null),
  bunny_cdn_url: z.string().nullable().catch(null),
  provider_kind: z.enum(['storage', 'stream']).catch('storage'),
  provider_video_id: z.string().nullable().catch(null),
  visibility: z.enum(['private', 'internal', 'public']).catch('private'),
  duration_seconds: z.number().nullable().catch(null),
  original_size_bytes: z.string().nullable().catch(null),
  delivery_variant: z.enum(['original', 'stream']).catch('original'),
  asset_role: storageAssetRoleSchema.nullable().catch(null),
  voice_profile_id: z.string().nullable().catch(null),
  avatar_id: z.string().nullable().catch(null),
  workflow_ready: z.boolean().catch(false),
  playback_ready: z.boolean().catch(false),
  transfer_complete: z.boolean().catch(false),
  integrity_verified: z.boolean().catch(false),
  security_status: z.enum(['pending', 'clean', 'not_required', 'rejected']).catch('pending'),
  original_ready: z.boolean().catch(false),
  adaptive_ready: z.boolean().catch(false),
  readiness_reason: z.enum([
    'ready',
    'not_media',
    'terminal_status',
    'upload_incomplete',
    'checksum_missing',
    'malware_scan_pending',
    'malware_scan_rejected',
    'censor_review_required',
  ]).catch('upload_incomplete'),
  thumbnail_url: z.string().nullable().catch(null),
  metadata: z.record(z.unknown()).catch({}),
  preview: storageObjectPreviewSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional().catch(null),
  memory_status: storageMemoryStatusSchema.catch('not_added'),
  memory_request_id: z.string().nullable().catch(null),
  memory_failure_code: z.string().nullable().catch(null),
  memory_status_updated_at: z.string().nullable().catch(null),
  memory_indexed_at: z.string().nullable().catch(null),
})

const listStorageObjectsResponseSchema = z.object({
  data: z.array(storageObjectSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(0),
    offset: z.number().catch(0),
    hasMore: z.boolean().catch(false),
  }).catch({
    total: 0,
    limit: 0,
    offset: 0,
    hasMore: false,
  }),
})

const storageObjectResponseSchema = z.object({
  data: storageObjectSchema,
})

const storageUsageSchema = z.object({
  channel_id: z.string(),
  used_bytes: z.string(),
  file_count: z.number(),
  folder_count: z.number(),
  monthly_io_bytes: z.string(),
  pending_upload_bytes: z.string(),
  updated_at: z.string(),
})

const storageUsageResponseSchema = z.object({
  data: storageUsageSchema,
})

const storageUsageAggregateSchema = z.object({
  used_bytes: z.string().catch('0'),
  pending_upload_bytes: z.string().catch('0'),
  monthly_io_bytes: z.string().catch('0'),
  monthly_delivery_io_bytes: z.string().catch('0'),
  stream_storage_bytes: z.string().catch('0'),
  included_storage_bytes: z.string().catch('0'),
  included_stream_storage_bytes: z.string().catch('0'),
  included_io_bytes: z.string().catch('0'),
  file_count: z.number().catch(0),
  folder_count: z.number().catch(0),
  channel_count: z.number().catch(0),
  cycle_start: z.string().catch(''),
  cycle_end: z.string().catch(''),
  updated_at: z.string().catch(''),
})

const storageUsageAggregateResponseSchema = z.object({
  data: storageUsageAggregateSchema,
})

const storageOverviewResponseSchema = z.object({
  data: z.object({
    objects: z.object({
      data: z.array(storageObjectSchema).catch([]),
      meta: z.object({
        total: z.number().catch(0),
        limit: z.number().catch(100),
        offset: z.number().catch(0),
        hasMore: z.boolean().catch(false),
      }).catch({
        total: 0,
        limit: 100,
        offset: 0,
        hasMore: false,
      }),
    }),
    channel_usage: storageUsageSchema.nullable().catch(null),
    tenant_usage: storageUsageAggregateSchema.nullable().catch(null),
    degraded_sources: z.array(z.string()).catch([]),
  }),
})

const createFolderResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    path: z.string(),
    created: z.boolean(),
  }),
})

const initiateUploadDataSchema = z.object({
    upload_session_id: z.string(),
    object_id: z.string(),
    upload_status: z.enum([
      'pending',
      'uploading',
      'uploaded',
      'completed',
      'expired',
      'failed',
      'cancelled',
    ]).catch('pending'),
    upload_mode: z.enum(['direct', 'proxy', 'tus']),
    upload_url: z.string(),
    upload_method: z.enum(['PUT', 'POST']),
    upload_headers: z.record(z.string()).catch({}),
    provider_target: z.object({
      url: z.string().url(),
      method: z.enum(['PUT', 'POST']),
      headers: z.record(z.string()).catch({}),
      metadata: z.record(z.string()).optional().catch(undefined),
      multipart: z.object({
        part_size_bytes: z.number().int().min(5 * 1024 * 1024).max(64 * 1024 * 1024),
        parts: z.array(z.object({
          part_number: z.number().int().min(1).max(64),
          url: z.string(),
          method: z.literal('PUT'),
          headers: z.record(z.string()),
        }).strict()).min(1).max(64),
      }).strict().optional(),
    }).nullable().catch(null),
    upload_protocol: z.enum(['put', 'multipart', 'tus']).catch('put'),
    tus_metadata: z.record(z.string()).nullable().catch(null),
    provider_video_id: z.string().nullable().catch(null),
    finalize_token: z.string().nullable().catch(null),
    expires_at: z.string(),
    storage_key: z.string(),
    path: z.string(),
  }).superRefine((session, context) => {
    const transferRequired = session.upload_status === 'pending' || session.upload_status === 'uploading'
    const providerTransfer = session.upload_mode === 'direct'
      || session.upload_mode === 'tus'
      || session.upload_protocol === 'tus'
    if (transferRequired && providerTransfer && !session.provider_target) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provider_target'],
        message: 'Transfer-required direct/TUS upload response is missing a valid provider_target.',
      })
    }
  })

const initiateUploadResponseSchema = z.object({
  data: initiateUploadDataSchema,
})

/**
 * Spark timeline v3 previews: the media ingest keyframe sprite (`filmstrip`) and waveform peaks JSON (`waveform`) of a
 * source, delivered with the derivative's `variant_key` and flat `descriptor`. Both are optional and parsed tolerantly:
 * a malformed value is dropped instead of failing the delivery (the timeline then treats the preview as unavailable).
 */
export type StorageDeliveryPreviewVariant = 'filmstrip' | 'waveform'
export type StorageDeliveryBatchVariant = 'original' | 'stream' | 'thumbnail' | StorageDeliveryPreviewVariant
export type StorageDeliveryPreviewDescriptor = Record<string, number | string>

const deliveryPreviewFields = {
  variant_key: z.string().min(1).max(64).optional().catch(undefined),
  descriptor: z.record(z.string(), z.union([z.number().finite(), z.string().max(128)])).optional().catch(undefined),
}

const deliveryUrlResponseSchema = z.object({
  data: z.object({
    url: z.string(),
    expires_in_seconds: z.number(),
    expires_at: z.string().datetime(),
    variant: z.enum(['original', 'stream']),
  }),
})

/** Single-route answer of `variant=filmstrip|waveform` (kept apart so `getStorageDeliveryUrl` callers stay unchanged). */
const previewDeliveryUrlResponseSchema = z.object({
  data: z.object({
    url: z.string(),
    expires_in_seconds: z.number(),
    expires_at: z.string().datetime(),
    variant: z.enum(['filmstrip', 'waveform']),
    ...deliveryPreviewFields,
  }),
})

const thumbnailUrlResponseSchema = z.object({
  data: z.object({
    url: z.string(),
    expires_in_seconds: z.number(),
    expires_at: z.string().datetime(),
    variant: z.literal('thumbnail'),
  }),
})

const deliveryUrlBatchItemSchema = z.discriminatedUnion('status', [
  z.object({
    object_id: z.string(),
    status: z.literal('ok'),
    url: z.string(),
    expires_in_seconds: z.number(),
    expires_at: z.string().datetime(),
    variant: z.enum(['original', 'stream', 'thumbnail', 'filmstrip', 'waveform']),
    ...deliveryPreviewFields,
  }),
  z.object({
    object_id: z.string(),
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
])

export function parseStorageDeliveryUrlBatchItems(raw: unknown): Array<z.infer<typeof deliveryUrlBatchItemSchema>> {
  if (!Array.isArray(raw)) return []
  const items: Array<z.infer<typeof deliveryUrlBatchItemSchema>> = []
  for (const entry of raw) {
    const parsed = deliveryUrlBatchItemSchema.safeParse(entry)
    if (parsed.success) {
      items.push(parsed.data)
      continue
    }
    const objectId = entry
      && typeof entry === 'object'
      && 'object_id' in entry
      && typeof entry.object_id === 'string'
      ? entry.object_id.trim()
      : ''
    if (!objectId) continue
    items.push({
      object_id: objectId,
      status: 'error',
      error: {
        code: 'STORAGE_THUMBNAIL_NOT_AVAILABLE',
        message: 'Storage delivery item was malformed.',
      },
    })
  }
  return items
}

const deliveryUrlsBatchResponseSchema = z.object({
  data: z.object({
    items: z.unknown().transform(parseStorageDeliveryUrlBatchItems),
    succeeded_count: z.number().catch(0),
    failed_count: z.number().catch(0),
  }),
})

const completeUploadResponseSchema = z.object({
  data: z.object({
    object_id: z.string(),
    status: z.enum(['active', 'processing']),
    idempotent: z.boolean().catch(false),
  }),
})

const proxyUploadContentResponseSchema = z.object({
  data: z.object({
    uploaded: z.literal(true),
    size_bytes: z.number(),
    completed: z.boolean(),
    next_offset: z.number(),
    object_id: z.string(),
    status: z.enum(['pending', 'uploaded', 'active', 'processing']),
  }),
})

const deleteObjectResponseSchema = z.object({
  data: z.object({
    object_id: z.string(),
    deleted: z.boolean(),
    idempotent: z.boolean(),
  }),
})

const bulkDeleteResponseSchema = z.object({
  data: z.object({
    deleted_count: z.number(),
    items: z.array(z.object({
      object_id: z.string(),
      deleted: z.boolean(),
      idempotent: z.boolean(),
    })).catch([]),
  }),
})

const moveObjectResponseSchema = z.object({
  data: z.object({
    object_id: z.string(),
    name: z.string(),
    path: z.string(),
    idempotent: z.boolean(),
  }),
})

const updateObjectResponseSchema = moveObjectResponseSchema

const bulkMoveResponseSchema = z.object({
  data: z.object({
    moved_count: z.number(),
    items: z.array(z.object({
      object_id: z.string(),
      name: z.string(),
      path: z.string(),
      idempotent: z.boolean(),
    })).catch([]),
  }),
})

export type StorageObjectItem = z.infer<typeof storageObjectSchema>
export type StorageAssetRole = z.infer<typeof storageAssetRoleSchema>
export type StorageMemoryStatus = z.infer<typeof storageMemoryStatusSchema>
export type StorageUsage = z.infer<typeof storageUsageSchema>
export type StorageUsageAggregate = z.infer<typeof storageUsageAggregateSchema>
export type StoragePreviewInput = NonNullable<z.infer<typeof storagePreviewInputSchema>>
export type InitiateUploadResult = z.infer<typeof initiateUploadResponseSchema>['data']
export type StorageUploadTransport = 'direct' | 'tus' | 'proxy'

export function resolveStorageUploadTransport(
  session: Pick<InitiateUploadResult, 'upload_mode' | 'upload_protocol'>,
): StorageUploadTransport {
  if (session.upload_mode === 'direct') return 'direct'
  if (session.upload_protocol === 'tus') return 'tus'
  return 'proxy'
}
export type DeliveryUrlResult = z.infer<typeof deliveryUrlResponseSchema>['data']
export type DeliveryUrlsBatchResult = z.infer<typeof deliveryUrlsBatchResponseSchema>['data']
export type PreviewDeliveryUrlResult = z.infer<typeof previewDeliveryUrlResponseSchema>['data']
export type ProxyUploadContentResult = z.infer<typeof proxyUploadContentResponseSchema>['data']

export type StorageListInput = {
  parentPath?: string
  search?: string
  type?: 'file' | 'folder'
  category?: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'font' | 'data'
  assetRoles?: StorageAssetRole[]
  sourceTool?: 'viral_clips@1' | 'magic_clips@1'
  voiceProfileId?: string
  scope?: 'children' | 'descendants'
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'size_bytes'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export async function listStorageObjects(
  channelId: string,
  input: StorageListInput,
  options: { signal?: AbortSignal } = {},
) {
  const params = toStorageListParams(input)
  const query = params.toString()
  return gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(channelId)}/objects${query ? `?${query}` : ''}`, {
    schema: listStorageObjectsResponseSchema,
    signal: options.signal,
  })
}

export async function getStorageObject(input: {
  channelId: string
  objectId: string
}, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}`,
    { schema: storageObjectResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getStorageOverview(
  channelId: string,
  input: StorageListInput,
  options: { signal?: AbortSignal } = {},
) {
  const query = toStorageListParams(input).toString()
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(channelId)}/overview${query ? `?${query}` : ''}`,
    { schema: storageOverviewResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getStorageUsage(channelId: string) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(channelId)}/usage`, {
    schema: storageUsageResponseSchema,
  })
  return result.data
}

export async function getStorageUsageAggregate() {
  const result = await gatewayRequest('/api/v1/storage/usage/aggregate', {
    schema: storageUsageAggregateResponseSchema,
  })
  return result.data
}

export async function createStorageFolder(input: {
  channelId: string
  name: string
  parentPath?: string
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/folders`, {
    method: 'POST',
    csrf: true,
    body: {
      name: input.name,
      parent_path: input.parentPath || undefined,
    },
    schema: createFolderResponseSchema,
  })
  return result.data
}

export async function getStorageDeliveryUrl(input: {
  channelId: string
  objectId: string
  expiresInSeconds?: number
  variant?: 'original' | 'stream'
}) {
  const params = new URLSearchParams()
  if (input.expiresInSeconds) params.set('expires_in_seconds', String(input.expiresInSeconds))
  if (input.variant) params.set('variant', input.variant)
  const query = params.toString()
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}/url${query ? `?${query}` : ''}`,
    { schema: deliveryUrlResponseSchema },
  )
  return result.data
}

/**
 * Spark timeline v3: the signed URL of a source's filmstrip sprite or waveform peaks with the derivative's `variant_key`
 * and `descriptor`. The gateway answers 409 `STORAGE_DELIVERY_NOT_READY` (`filmstrip_unavailable` /
 * `waveform_unavailable`) while the source has no such derivative.
 */
export async function getStoragePreviewDeliveryUrl(input: {
  channelId: string
  objectId: string
  variant: StorageDeliveryPreviewVariant
  expiresInSeconds?: number
}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ variant: input.variant })
  if (input.expiresInSeconds) params.set('expires_in_seconds', String(input.expiresInSeconds))
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}/url?${params.toString()}`,
    { schema: previewDeliveryUrlResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getStorageThumbnailUrl(input: {
  channelId: string
  objectId: string
  expiresInSeconds?: number
}) {
  const params = new URLSearchParams({ variant: 'thumbnail' })
  if (input.expiresInSeconds) params.set('expires_in_seconds', String(input.expiresInSeconds))
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}/url?${params.toString()}`,
    { schema: thumbnailUrlResponseSchema },
  )
  return result.data
}

export const STORAGE_DELIVERY_URL_BATCH_SIZE = 64

/** P02-14: why a delivery URL is minted; `grid` bounds originals to the preview budget server-side. */
export type StorageDeliveryPurpose = 'grid' | 'detail' | 'playback'

export async function getStorageDeliveryUrls(input: {
  channelId: string
  items: Array<{
    objectId: string
    expiresInSeconds?: number
    variant?: StorageDeliveryBatchVariant
    purpose?: StorageDeliveryPurpose
  }>
  signal?: AbortSignal
}) {
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/delivery-urls`,
    {
      method: 'POST',
      csrf: true,
      body: {
        items: input.items.map((item) => ({
          object_id: item.objectId,
          expires_in_seconds: item.expiresInSeconds,
          variant: item.variant,
          ...(item.purpose && { purpose: item.purpose }),
        })),
      },
      schema: deliveryUrlsBatchResponseSchema,
      signal: input.signal,
    },
  )
  return result.data
}

export async function fetchStorageDeliveryUrlsInChunks(input: {
  channelId: string
  items: Array<{
    objectId: string
    expiresInSeconds?: number
    variant?: StorageDeliveryBatchVariant
    purpose?: StorageDeliveryPurpose
  }>
  signal?: AbortSignal
  onChunk?: (items: DeliveryUrlsBatchResult['items']) => void
}): Promise<DeliveryUrlsBatchResult> {
  if (input.items.length === 0) {
    return { items: [], succeeded_count: 0, failed_count: 0 }
  }

  const collected: DeliveryUrlsBatchResult['items'] = []
  for (const chunk of packStorageDeliveryUrlItems(uniqueStorageDeliveryUrlItems(input.items))) {
    const result = await getStorageDeliveryUrls({
      channelId: input.channelId,
      items: chunk,
      signal: input.signal,
    })
    collected.push(...result.items)
    input.onChunk?.(result.items)
  }

  return deliveryUrlBatchSummary(collected)
}

type StorageDeliveryUrlBatchInput = Parameters<typeof getStorageDeliveryUrls>[0]
type StorageDeliveryUrlBatchItem = StorageDeliveryUrlBatchInput['items'][number]

type PendingStorageDeliveryUrlBatch = {
  items: StorageDeliveryUrlBatchItem[]
  signal?: AbortSignal
  resolve: (value: DeliveryUrlsBatchResult) => void
  reject: (reason: unknown) => void
}

const pendingStorageDeliveryUrlBatches = new Map<string, PendingStorageDeliveryUrlBatch[]>()
const scheduledStorageDeliveryUrlBatches = new Set<string>()

function getStorageDeliveryUrlBatchKey(
  channelId: string,
  item: StorageDeliveryUrlBatchItem,
) {
  return JSON.stringify([
    channelId,
    item.expiresInSeconds ?? null,
    item.variant ?? null,
    item.purpose ?? null,
  ])
}

function deliveryUrlBatchSummary(items: DeliveryUrlsBatchResult['items']): DeliveryUrlsBatchResult {
  return {
    items,
    succeeded_count: items.filter((item) => item.status === 'ok').length,
    failed_count: items.filter((item) => item.status === 'error').length,
  }
}

function unavailableDeliveryUrlItem(objectId: string): DeliveryUrlsBatchResult['items'][number] {
  return {
    object_id: objectId,
    status: 'error',
    error: {
      code: 'STORAGE_THUMBNAIL_NOT_AVAILABLE',
      message: 'Storage delivery failed.',
    },
  }
}

function storageDeliveryUrlItemIdentity(item: {
  objectId: string
  variant?: StorageDeliveryBatchVariant
}) {
  return `${item.objectId}:${item.variant ?? ''}`
}

function uniqueStorageDeliveryUrlItems<T extends {
  objectId: string
  variant?: StorageDeliveryBatchVariant
}>(items: T[]) {
  return [...new Map(items.map((item) => [storageDeliveryUrlItemIdentity(item), item] as const)).values()]
}

function packStorageDeliveryUrlItems<T extends { objectId: string }>(items: T[]) {
  const chunks: T[][] = []
  let current: T[] = []
  const objectIdsInCurrent = new Set<string>()

  for (const item of items) {
    if (
      current.length > 0
      && (
        current.length >= STORAGE_DELIVERY_URL_BATCH_SIZE
        || objectIdsInCurrent.has(item.objectId)
      )
    ) {
      chunks.push(current)
      current = []
      objectIdsInCurrent.clear()
    }
    current.push(item)
    objectIdsInCurrent.add(item.objectId)
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

function chunkStorageDeliveryUrlItems<T>(items: T[]) {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += STORAGE_DELIVERY_URL_BATCH_SIZE) {
    chunks.push(items.slice(offset, offset + STORAGE_DELIVERY_URL_BATCH_SIZE))
  }
  return chunks
}

function isStorageDeliveryUrlRequestAborted(request: PendingStorageDeliveryUrlBatch) {
  return Boolean(request.signal?.aborted)
}

function abortReason(signal?: AbortSignal) {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError')
}

async function flushStorageDeliveryUrlBatch(
  key: string,
  channelId: string,
) {
  const pending = pendingStorageDeliveryUrlBatches.get(key) ?? []
  pendingStorageDeliveryUrlBatches.delete(key)
  if (pending.length === 0) {
    scheduledStorageDeliveryUrlBatches.delete(key)
    return
  }

  const responseByObjectId = new Map<string, DeliveryUrlsBatchResult['items'][number]>()
  const settled = new Set<number>()
  const flushController = new AbortController()

  const settleRequest = (index: number, settle: () => void) => {
    if (settled.has(index)) return
    settled.add(index)
    settle()
  }

  const rejectAbortedRequests = () => {
    pending.forEach((request, index) => {
      if (!isStorageDeliveryUrlRequestAborted(request)) return
      settleRequest(index, () => request.reject(abortReason(request.signal)))
    })
  }

  const abortFlushIfCallersAreGone = () => {
    rejectAbortedRequests()
    const live = pending.filter((_, index) => !settled.has(index))
    if (live.length === 0 && !flushController.signal.aborted) {
      flushController.abort(new DOMException('Aborted', 'AbortError'))
    }
  }

  const settleReadyRequests = () => {
    abortFlushIfCallersAreGone()
    pending.forEach((request, index) => {
      if (settled.has(index)) return
      const items: DeliveryUrlsBatchResult['items'] = []
      for (const item of request.items) {
        const result = responseByObjectId.get(item.objectId)
        if (!result) return
        items.push(result)
      }
      settleRequest(index, () => request.resolve(deliveryUrlBatchSummary(items)))
    })
  }

  for (const request of pending) {
    request.signal?.addEventListener('abort', abortFlushIfCallersAreGone)
  }

  try {
    abortFlushIfCallersAreGone()
    const uniqueItems = [...new Map(
      pending
        .filter((request, index) => !settled.has(index))
        .flatMap((request) => request.items)
        .map((item) => [item.objectId, item] as const),
    ).values()]
    if (uniqueItems.length === 0) return

    for (const chunk of chunkStorageDeliveryUrlItems(uniqueItems)) {
      abortFlushIfCallersAreGone()
      if (pending.every((_, index) => settled.has(index))) return
      const result = await getStorageDeliveryUrls({
        channelId,
        items: chunk,
        signal: flushController.signal,
      })
      for (const entry of result.items) {
        responseByObjectId.set(entry.object_id, entry)
      }
      for (const item of chunk) {
        if (!responseByObjectId.has(item.objectId)) {
          responseByObjectId.set(item.objectId, unavailableDeliveryUrlItem(item.objectId))
        }
      }
      settleReadyRequests()
    }
    pending.forEach((request, index) => {
      if (settled.has(index)) return
      settleRequest(index, () => request.reject(new Error('STORAGE_THUMBNAIL_NOT_AVAILABLE')))
    })
  } catch (error) {
    pending.forEach((request, index) => {
      if (!settled.has(index)) request.reject(error)
    })
  } finally {
    for (const request of pending) {
      request.signal?.removeEventListener('abort', abortFlushIfCallersAreGone)
    }
    const leftover = pendingStorageDeliveryUrlBatches.get(key) ?? []
    if (leftover.length > 0) {
      void flushStorageDeliveryUrlBatch(key, channelId)
    } else {
      scheduledStorageDeliveryUrlBatches.delete(key)
    }
  }
}

/**
 * Coalesces same-tick delivery URL reads from independently mounted cards, then
 * POSTs unique items in real 64-item bodies. Each caller resolves as soon as its
 * own object IDs are ready so thumbnails can appear chunk-by-chunk.
 */
export function getCoalescedStorageDeliveryUrls(
  input: StorageDeliveryUrlBatchInput,
  options: { signal?: AbortSignal } = {},
): Promise<DeliveryUrlsBatchResult> {
  if (input.items.length === 0) {
    return Promise.resolve({ items: [], succeeded_count: 0, failed_count: 0 })
  }
  const firstKey = getStorageDeliveryUrlBatchKey(input.channelId, input.items[0])
  if (input.items.some((item) => getStorageDeliveryUrlBatchKey(input.channelId, item) !== firstKey)) {
    return fetchStorageDeliveryUrlsInChunks({ ...input, signal: options.signal })
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const settleResolve = (value: DeliveryUrlsBatchResult) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const settleReject = (reason: unknown) => {
      if (settled) return
      settled = true
      reject(reason)
    }
    if (options.signal?.aborted) {
      settleReject(abortReason(options.signal))
      return
    }
    options.signal?.addEventListener('abort', () => {
      settleReject(abortReason(options.signal))
    }, { once: true })
    const pending = pendingStorageDeliveryUrlBatches.get(firstKey) ?? []
    pending.push({ items: input.items, signal: options.signal, resolve: settleResolve, reject: settleReject })
    pendingStorageDeliveryUrlBatches.set(firstKey, pending)
    if (scheduledStorageDeliveryUrlBatches.has(firstKey)) return
    scheduledStorageDeliveryUrlBatches.add(firstKey)
    globalThis.setTimeout(() => {
      void flushStorageDeliveryUrlBatch(firstKey, input.channelId)
    }, 0)
  })
}

export function storageDeliveryRefreshDelay(
  value: { expires_at?: string } | Array<{ status: string; expires_at?: string }> | undefined,
  nowMs = Date.now(),
) {
  const expiresAtValues = Array.isArray(value)
    ? value.flatMap((item) => item.status === 'ok' && item.expires_at ? [item.expires_at] : [])
    : value?.expires_at ? [value.expires_at] : []
  if (expiresAtValues.length === 0) return false
  const earliestExpiry = Math.min(...expiresAtValues.map((expiresAt) => Date.parse(expiresAt)))
  if (!Number.isFinite(earliestExpiry)) return 45 * 60_000
  return Math.max(30_000, earliestExpiry - nowMs - 5 * 60_000)
}

export function getStorageDownloadUrl(input: {
  channelId: string
  objectId: string
  fileName: string
}) {
  const params = new URLSearchParams({
    channelId: input.channelId,
    objectId: input.objectId,
    fileName: input.fileName,
  })
  return `/api/storage/download?${params.toString()}`
}

export function getStoragePlaybackUrl(input: {
  channelId: string
  objectId: string
  /** E1 D12: play the media ingest proxy (h264 720p) when the object has one, else the original (the BFF decides). */
  preferProxy?: boolean
}) {
  const params = new URLSearchParams({
    channelId: input.channelId,
    objectId: input.objectId,
    ...(input.preferProxy && { prefer: 'proxy' }),
  })
  return `/api/storage/playback?${params.toString()}`
}

export async function deleteStorageObject(input: {
  channelId: string
  objectId: string
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}`, {
    method: 'DELETE',
    csrf: true,
    body: {
      idempotency_key: `storage-delete:${input.objectId}`,
    },
    schema: deleteObjectResponseSchema,
  })
  return result.data
}

export const STORAGE_BULK_DELETE_MAX_ITEMS = 100

export async function bulkDeleteStorageObjects(input: {
  channelId: string
  objectIds: string[]
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/bulk-delete`, {
    method: 'POST',
    csrf: true,
    body: {
      object_ids: input.objectIds,
      idempotency_key: `storage-bulk-delete:${hashString([...input.objectIds].sort().join('|'))}`,
    },
    schema: bulkDeleteResponseSchema,
  })
  return result.data
}

export async function updateStorageObject(input: {
  channelId: string
  objectId: string
  name: string
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}`, {
    method: 'PATCH',
    csrf: true,
    body: {
      name: input.name,
      idempotency_key: createActionIdempotencyKey('storage-rename'),
    },
    schema: updateObjectResponseSchema,
  })
  return result.data
}

export async function moveStorageObject(input: {
  channelId: string
  objectId: string
  parentPath?: string
  name?: string
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/${encodeURIComponent(input.objectId)}/move`, {
    method: 'POST',
    csrf: true,
    body: {
      parent_path: input.parentPath ?? undefined,
      name: input.name || undefined,
      idempotency_key: `storage-move:${hashString([
        input.objectId,
        input.parentPath ?? '',
        input.name ?? '',
      ].join('|'))}`,
    },
    schema: moveObjectResponseSchema,
  })
  return result.data
}

export async function bulkMoveStorageObjects(input: {
  channelId: string
  objectIds: string[]
  parentPath?: string
}) {
  const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/objects/bulk-move`, {
    method: 'POST',
    csrf: true,
    body: {
      items: input.objectIds.map((objectId) => ({ object_id: objectId })),
      parent_path: input.parentPath ?? undefined,
      idempotency_key: `storage-bulk-move:${hashString([
        ...[...input.objectIds].sort(),
        input.parentPath ?? '',
      ].join('|'))}`,
    },
    schema: bulkMoveResponseSchema,
  })
  return result.data
}

export type StorageMemoryIngestionRequest = {
  choice?: 'default' | 'add' | 'skip'
  source?: 'storage' | 'chat_upload'
}

export async function initiateStorageUpload(input: {
  channelId: string
  file: File
  parentPath?: string
  preview?: StoragePreviewInput | null
  metadata?: Record<string, string | number | boolean | null>
  /**
   * P01B-04 "Belleğe de ekle": default = the channel's ingestion rules decide; add/skip = the uploader's choice
   * (an off/approval rule is never bypassed). `source` is the upload surface the channel's rules match on.
   */
  memoryIngestion?: StorageMemoryIngestionRequest
  checksumSha256?: string
  idempotencyKey?: string
  signal?: AbortSignal
}) {
  const fingerprint = input.checksumSha256 && input.idempotencyKey
    ? { checksumSha256: input.checksumSha256, idempotencyKey: input.idempotencyKey }
    : await createStorageUploadFingerprint({
      channelId: input.channelId,
      parentPath: input.parentPath,
      file: input.file,
      signal: input.signal,
    })
  const checksumSha256 = input.checksumSha256 ?? fingerprint.checksumSha256
  const baseIdempotencyKey = input.idempotencyKey ?? fingerprint.idempotencyKey
  const maxTerminalRetries = input.idempotencyKey ? 0 : 3

  for (let retry = 0; retry <= maxTerminalRetries; retry += 1) {
    const idempotencyKey = retry === 0 ? baseIdempotencyKey : `${baseIdempotencyKey}:retry:${retry}`
    const result = await gatewayRequest(`/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/uploads`, {
      method: 'POST',
      csrf: true,
      body: {
        file_name: input.file.name,
        parent_path: input.parentPath || undefined,
        size_bytes: input.file.size,
        mime_type: input.file.type || 'application/octet-stream',
        checksum_sha256: checksumSha256,
        preview: input.preview || undefined,
        metadata: input.metadata,
        memory_ingestion: input.memoryIngestion,
        idempotency_key: idempotencyKey,
      },
      schema: initiateUploadResponseSchema,
      signal: input.signal,
      timeoutMs: STORAGE_UPLOAD_GATEWAY_TIMEOUT_MS,
    })
    if (isTerminalUploadStatus(result.data.upload_status)) {
      if (retry < maxTerminalRetries) continue
      break
    }

    if (
      !input.idempotencyKey
      && result.data.upload_status === 'completed'
      && !await isCompletedUploadObjectReusable({
        channelId: input.channelId,
        objectId: result.data.object_id,
        checksumSha256,
        sizeBytes: input.file.size,
        signal: input.signal,
      })
    ) {
      if (retry < maxTerminalRetries) continue
      break
    }

    return result.data
  }

  throw new AuthClientError('STORAGE_UPLOAD_SESSION_UNAVAILABLE', 'Upload session is unavailable.', 409)
}

export async function uploadProxyContent(input: {
  session: InitiateUploadResult
  file: File
  onProgress: (progress: number) => void
  signal?: AbortSignal
}) {
  const csrfToken = await getGatewayCsrfToken(input.signal)
  const uploadUrl = resolveSafeStorageProxyUploadUrl(
    input.session.upload_url,
    getYoutorchApiBaseUrl(),
  )
  if (!uploadUrl) {
    throw new AuthClientError('STORAGE_UPLOAD_TARGET_INVALID', 'Upload target is not allowed.', 502)
  }
  const response = await xhrRequest({
    method: 'PUT',
    url: uploadUrl,
    body: input.file,
    withCredentials: true,
    headers: {
      'x-csrf-token': csrfToken,
      'content-type': input.file.type || 'application/octet-stream',
    },
    onProgress: input.onProgress,
    signal: input.signal,
    timeout: timeoutBeforeUploadExpiry(STORAGE_BINARY_UPLOAD_TIMEOUT, input.session.expires_at),
  })
  const parsed = proxyUploadContentResponseSchema.safeParse(response.body)
  if (!parsed.success) {
    throw new AuthClientError('STORAGE_UPLOAD_RESPONSE_INVALID', 'Upload response is invalid.', 502)
  }
  return parsed.data.data
}

export async function completeStorageUpload(input: {
  channelId: string
  uploadSessionId: string
  finalizeToken?: string | null
  signal?: AbortSignal
}) {
  const result = await gatewayRequest(
    `/api/v1/storage/channels/${encodeURIComponent(input.channelId)}/uploads/${encodeURIComponent(input.uploadSessionId)}/complete`,
    {
      method: 'POST',
      csrf: true,
      body: input.finalizeToken ? { finalize_token: input.finalizeToken } : {},
      schema: completeUploadResponseSchema,
      signal: input.signal,
      timeoutMs: STORAGE_UPLOAD_GATEWAY_TIMEOUT_MS,
    },
  )
  return result.data
}

export async function uploadDirectContent(input: {
  session: InitiateUploadResult
  file: File
  onProgress: (progress: number) => void
  signal?: AbortSignal
}) {
  if (input.session.upload_protocol === 'multipart') {
    throw new AuthClientError(
      'STORAGE_UPLOAD_TARGET_INVALID',
      'Multipart upload is restricted to authenticated internal services.',
      502,
    )
  }
  const target = input.session.provider_target
  if (!target) {
    throw new AuthClientError('STORAGE_UPLOAD_TARGET_MISSING', 'Upload target is missing.', 502)
  }
  const uploadUrl = target?.method === 'PUT'
    ? resolveSafeBunnyS3UploadUrl(target.url)
    : null
  const uploadHeaders = target
    ? resolveSafeBunnyS3UploadHeaders(
      target.headers,
      input.file.type || 'application/octet-stream',
    )
    : null
  if (!uploadUrl || !uploadHeaders) {
    throw new AuthClientError('STORAGE_UPLOAD_TARGET_INVALID', 'Upload target is not allowed.', 502)
  }
  await xhrRequest({
    method: 'PUT',
    url: uploadUrl,
    body: input.file,
    headers: uploadHeaders,
    acceptedStatusCodes: new Set([412]),
    onProgress: input.onProgress,
    signal: input.signal,
    timeout: timeoutBeforeUploadExpiry(STORAGE_BINARY_UPLOAD_TIMEOUT, input.session.expires_at),
  })
}

export async function uploadTusContent(input: {
  session: InitiateUploadResult
  file: File
  onProgress: (progress: number) => void
  signal?: AbortSignal
}) {
  const target = input.session.provider_target
  if (!target) throw new AuthClientError('STORAGE_UPLOAD_TARGET_MISSING', 'Upload target is missing.', 502)
  const targetUrl = target.method === 'POST'
    ? resolveSafeBunnyTusTargetUrl(target.url)
    : null
  if (!targetUrl) {
    throw new AuthClientError('STORAGE_UPLOAD_TARGET_INVALID', 'Upload target is not allowed.', 502)
  }

  const uploadMetadata = buildTusMetadata({
    filetype: input.file.type || 'application/octet-stream',
    title: input.file.name,
    ...(input.session.tus_metadata ?? {}),
  })

  let browserStorage: Storage | null = null
  try {
    browserStorage = typeof window === 'undefined' ? null : window.localStorage
  } catch {
    browserStorage = null
  }
  const resumeFile = toTusResumeFile(input.file)
  const uploadDeadlineAt = uploadExpiryDeadlineAt(input.session.expires_at)
  const stored = getTusResumeEntry({
    storage: browserStorage,
    sessionId: input.session.upload_session_id,
    file: resumeFile,
  })
  let uploadUrl = stored
    ? resolveSafeBunnyTusUploadLocation(stored.uploadUrl, targetUrl)
    : null
  let initialOffset = 0

  if (uploadUrl) {
    try {
      initialOffset = await readTusOffset(uploadUrl, target.headers, input.signal, uploadDeadlineAt)
      input.onProgress(Math.min(100, Math.round((initialOffset / Math.max(input.file.size, 1)) * 100)))
    } catch (error) {
      if (!(error instanceof AuthClientError) || (error.status !== 404 && error.status !== 410)) throw error
      removeTusResumeEntry(browserStorage, input.session.upload_session_id)
      uploadUrl = null
    }
  }

  if (!uploadUrl) {
    const createResponse = await xhrRequest({
      method: 'POST',
      url: targetUrl,
      headers: {
        ...target.headers,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(input.file.size),
        'Upload-Metadata': uploadMetadata,
      },
      signal: input.signal,
      timeout: timeoutBeforeDeadline(STORAGE_CONTROL_REQUEST_TIMEOUT, uploadDeadlineAt),
    })
    const location = createResponse.headers.location
    if (!location) throw new AuthClientError('STORAGE_TUS_LOCATION_MISSING', 'Upload location is missing.', 502)
    uploadUrl = resolveSafeBunnyTusUploadLocation(location, targetUrl)
    if (!uploadUrl) {
      throw new AuthClientError('STORAGE_TUS_LOCATION_INVALID', 'Upload location is not allowed.', 502)
    }
    setTusResumeEntry({
      storage: browserStorage,
      entry: {
        sessionId: input.session.upload_session_id,
        uploadUrl,
        expiresAt: input.session.expires_at,
        file: resumeFile,
      },
    })
  }

  try {
    await uploadTusPatchWithResume({
      uploadUrl,
      headers: target.headers,
      file: input.file,
      initialOffset,
      onProgress: input.onProgress,
      signal: input.signal,
      deadlineAt: uploadDeadlineAt,
    })
    removeTusResumeEntry(browserStorage, input.session.upload_session_id)
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 410)) {
      removeTusResumeEntry(browserStorage, input.session.upload_session_id)
    }
    throw error
  }
}

async function uploadTusPatchWithResume(input: {
  uploadUrl: string
  headers: Record<string, string>
  file: File
  initialOffset?: number
  onProgress: (progress: number) => void
  signal?: AbortSignal
  deadlineAt: number
}) {
  let offset = Math.max(0, Math.min(input.initialOffset ?? 0, input.file.size))
  if (offset >= input.file.size) {
    input.onProgress(100)
    return
  }
  const maxAttempts = 4
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    throwIfSignalAborted(input.signal)
    try {
      const body = input.file.slice(offset)
      await xhrRequest({
        method: 'PATCH',
        url: input.uploadUrl,
        body,
        headers: {
          ...input.headers,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        onProgress: (progress) => {
          const loadedFromSlice = Math.round((body.size * progress) / 100)
          input.onProgress(Math.min(100, Math.round(((offset + loadedFromSlice) / Math.max(input.file.size, 1)) * 100)))
        },
        signal: input.signal,
        timeout: timeoutBeforeDeadline(STORAGE_BINARY_UPLOAD_TIMEOUT, input.deadlineAt),
      })
      input.onProgress(100)
      return
    } catch (error) {
      if (isAbortError(error) || input.signal?.aborted || attempt === maxAttempts - 1) throw error
      offset = await readTusOffset(input.uploadUrl, input.headers, input.signal, input.deadlineAt)
      if (offset >= input.file.size) {
        input.onProgress(100)
        return
      }
      await delay(500 * 2 ** attempt, input.signal)
    }
  }
}

async function readTusOffset(
  uploadUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  deadlineAt = Date.now() + STORAGE_CONTROL_REQUEST_TIMEOUT.totalTimeoutMs,
) {
  const response = await xhrRequest({
    method: 'HEAD',
    url: uploadUrl,
    headers: {
      ...headers,
      'Tus-Resumable': '1.0.0',
    },
    signal,
    timeout: timeoutBeforeDeadline(STORAGE_CONTROL_REQUEST_TIMEOUT, deadlineAt),
  })
  const offset = Number(response.headers['upload-offset'] ?? 0)
  return Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : 0
}

function throwIfSignalAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0)
}

function isAbortError(error: unknown) {
  return error instanceof AuthClientError && error.code === 'STORAGE_UPLOAD_ABORTED'
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0))
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function xhrRequest(input: {
  method: string
  url: string
  headers?: Record<string, string>
  body?: XMLHttpRequestBodyInit
  withCredentials?: boolean
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  acceptedStatusCodes?: ReadonlySet<number>
  timeout?: {
    idleTimeoutMs: number
    totalTimeoutMs: number
  }
}) {
  return new Promise<{ body: unknown; headers: Record<string, string> }>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0))
      return
    }

    const xhr = new XMLHttpRequest()
    const idleTimeoutMs = positiveTimeoutMs(
      input.timeout?.idleTimeoutMs,
      STORAGE_CONTROL_REQUEST_TIMEOUT.idleTimeoutMs,
    )
    const totalTimeoutMs = positiveTimeoutMs(
      input.timeout?.totalTimeoutMs,
      STORAGE_CONTROL_REQUEST_TIMEOUT.totalTimeoutMs,
    )
    let idleTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null
    let totalTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null
    let settled = false
    const cleanup = () => {
      input.signal?.removeEventListener('abort', handleCallerAbort)
      if (idleTimeoutId !== null) globalThis.clearTimeout(idleTimeoutId)
      if (totalTimeoutId !== null) globalThis.clearTimeout(totalTimeoutId)
      idleTimeoutId = null
      totalTimeoutId = null
    }
    const finish = (complete: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      complete()
    }
    const abortAfter = (error: AuthClientError) => {
      finish(() => reject(error))
      xhr.abort()
    }
    const handleCallerAbort = () => {
      abortAfter(new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0))
    }
    const handleTimeout = (kind: 'idle' | 'total') => {
      abortAfter(new AuthClientError(
        'STORAGE_UPLOAD_TIMEOUT',
        kind === 'idle'
          ? 'Upload stopped making progress and timed out.'
          : 'Upload exceeded its maximum allowed duration.',
        408,
        {
          timeout_kind: kind,
          idle_timeout_ms: idleTimeoutMs,
          total_timeout_ms: totalTimeoutMs,
        },
      ))
    }
    const resetIdleTimeout = () => {
      if (settled) return
      if (idleTimeoutId !== null) globalThis.clearTimeout(idleTimeoutId)
      idleTimeoutId = globalThis.setTimeout(() => handleTimeout('idle'), idleTimeoutMs)
    }

    xhr.open(input.method, input.url, true)
    xhr.withCredentials = Boolean(input.withCredentials)
    input.signal?.addEventListener('abort', handleCallerAbort, { once: true })

    for (const [key, value] of Object.entries(input.headers ?? {})) {
      xhr.setRequestHeader(key, value)
    }

    xhr.upload.onprogress = (event) => {
      resetIdleTimeout()
      if (!input.onProgress || !event.lengthComputable) return
      input.onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.upload.onload = resetIdleTimeout
    xhr.onprogress = resetIdleTimeout
    xhr.onreadystatechange = resetIdleTimeout

    xhr.onload = () => {
      const headers = parseResponseHeaders(xhr.getAllResponseHeaders())
      if ((xhr.status >= 200 && xhr.status < 300) || input.acceptedStatusCodes?.has(xhr.status)) {
        finish(() => resolve({ body: parseJsonMaybe(xhr.responseText), headers }))
        return
      }

      finish(() => reject(new AuthClientError(
        'STORAGE_UPLOAD_FAILED',
        readErrorMessage(xhr.responseText),
        xhr.status,
      )))
    }
    xhr.onerror = () => {
      finish(() => reject(new AuthClientError(
        'STORAGE_UPLOAD_NETWORK_ERROR',
        'Upload request failed.',
        0,
      )))
    }
    xhr.onabort = () => {
      finish(() => reject(new AuthClientError('STORAGE_UPLOAD_ABORTED', 'Upload was cancelled.', 0)))
    }
    resetIdleTimeout()
    totalTimeoutId = globalThis.setTimeout(() => handleTimeout('total'), totalTimeoutMs)
    xhr.send(input.body)
  })
}

function positiveTimeoutMs(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.trunc(Number(value)) : fallback
}

function uploadExpiryDeadlineAt(expiresAt: string) {
  const parsedExpiry = Date.parse(expiresAt)
  const fallback = Date.now() + STORAGE_BINARY_UPLOAD_TIMEOUT.totalTimeoutMs
  if (!Number.isFinite(parsedExpiry)) return fallback
  return Math.min(fallback, parsedExpiry - STORAGE_UPLOAD_EXPIRY_SAFETY_MS)
}

function timeoutBeforeUploadExpiry(
  policy: { idleTimeoutMs: number; totalTimeoutMs: number },
  expiresAt: string,
) {
  return timeoutBeforeDeadline(policy, uploadExpiryDeadlineAt(expiresAt))
}

function timeoutBeforeDeadline(
  policy: { idleTimeoutMs: number; totalTimeoutMs: number },
  deadlineAt: number,
) {
  return {
    idleTimeoutMs: policy.idleTimeoutMs,
    totalTimeoutMs: Math.max(1, Math.min(policy.totalTimeoutMs, deadlineAt - Date.now())),
  }
}

export const __storageApiTestHooks = {
  xhrRequest,
  parseInitiateUploadResponse: (value: unknown) => initiateUploadResponseSchema.parse(value).data,
  parseStorageObject: (value: unknown) => storageObjectSchema.parse(value),
  parseStorageDeliveryUrlBatchItems,
  parsePreviewDeliveryUrlResponse: (value: unknown) => previewDeliveryUrlResponseSchema.parse(value).data,
}

function buildTusMetadata(metadata: Record<string, string>) {
  return Object.entries(metadata)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key} ${base64Encode(value)}`)
    .join(',')
}

function parseResponseHeaders(raw: string) {
  return raw.split(/\r?\n/).reduce<Record<string, string>>((headers, line) => {
    const index = line.indexOf(':')
    if (index <= 0) return headers
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim()
    return headers
  }, {})
}

function parseJsonMaybe(value: string) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function readErrorMessage(responseText: string) {
  const parsed = parseJsonMaybe(responseText)
  if (parsed && typeof parsed === 'object' && 'message' in parsed) {
    return String((parsed as { message: unknown }).message)
  }
  return 'Upload failed.'
}

function isTerminalUploadStatus(status: InitiateUploadResult['upload_status']) {
  return status === 'expired' || status === 'failed' || status === 'cancelled'
}

async function isCompletedUploadObjectReusable(input: {
  channelId: string
  objectId: string
  checksumSha256: string
  sizeBytes: number
  signal?: AbortSignal
}) {
  try {
    const object = await getStorageObject({
      channelId: input.channelId,
      objectId: input.objectId,
    }, { signal: input.signal })
    return (object.status === 'active' || object.status === 'processing')
      && object.deleted_at === null
      && object.checksum_sha256 === input.checksumSha256
      && object.size_bytes === String(input.sizeBytes)
  } catch (error) {
    if (
      error instanceof AuthClientError
      && (error.status === 404 || error.code === 'STORAGE_OBJECT_NOT_FOUND')
    ) return false
    throw error
  }
}

function toStorageListParams(input: StorageListInput) {
  const params = new URLSearchParams()
  if (input.parentPath) params.set('parent_path', input.parentPath)
  if (input.search?.trim()) params.set('search', input.search.trim())
  if (input.type) params.set('type', input.type)
  if (input.category) params.set('category', input.category)
  if (input.assetRoles?.length) params.set('asset_roles', input.assetRoles.join(','))
  if (input.sourceTool) params.set('source_tool', input.sourceTool)
  if (input.voiceProfileId) params.set('voice_profile_id', input.voiceProfileId)
  params.set('scope', input.scope ?? 'children')
  params.set('limit', String(input.limit ?? 100))
  params.set('offset', String(input.offset ?? 0))
  params.set('sort_by', input.sortBy ?? 'name')
  params.set('sort_order', input.sortOrder ?? 'asc')
  return params
}

function createActionIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${hashString([
    String(Date.now()),
    String(Math.random()),
  ].join('|'))}`
}

function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
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

'use client'

import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { gatewayRequest } from '@/lib/gateway/client'

export const REVIEW_ITEMS_QUERY_KEY = ['review', 'items'] as const
export const TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY = ['review', 'top-banner-announcements'] as const
export const PUBLIC_TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY = ['review', 'public-top-banner-announcements'] as const

const reviewItemSchema = z.object({
  id: z.string(),
  item_type: z.enum(['request', 'message']),
  status: z.string(),
  read_state: z.enum(['read', 'unread']),
  title_key: z.string(),
  message_key: z.string(),
  payload: z.record(z.unknown()).catch({}),
  thread_id: z.string().nullable().catch(null),
  request_kind: z.string().nullable().catch(null),
  allowed_actions: z.array(z.string()).catch([]),
  source_bc: z.string().nullable().catch(null),
  source_type: z.string().nullable().catch(null),
  source_id: z.string().nullable().catch(null),
  delivery_surface: z.string().nullable().catch(null),
  inbox_visible_at: z.string().nullable().catch(null),
  expires_at: z.string().nullable().catch(null),
  first_seen_at: z.string().nullable().catch(null),
  last_seen_at: z.string().nullable().catch(null),
  read_at: z.string().nullable().catch(null),
  archived_at: z.string().nullable().catch(null),
  deleted_at: z.string().nullable().catch(null),
  created_at: z.string(),
  updated_at: z.string(),
})

const reviewMessageSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  author_type: z.string(),
  author_id: z.string().nullable().catch(null),
  body: z.string(),
  payload: z.record(z.unknown()).catch({}),
  created_at: z.string(),
})

const topBannerAnnouncementSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  delivery_id: z.string().nullable().catch(null),
  status: z.string(),
  title_key: z.string(),
  message_key: z.string(),
  payload: z.record(z.unknown()).catch({}),
  scheduled_for: z.string(),
  read_at: z.string().nullable().catch(null),
  dismissed_at: z.string().nullable().catch(null),
  created_at: z.string(),
  updated_at: z.string(),
})

const reviewItemsResponseSchema = z.object({
  data: z.array(reviewItemSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(20),
    offset: z.number().catch(0),
    hasMore: z.boolean().catch(false),
  }),
})

const reviewItemResponseSchema = z.object({ data: reviewItemSchema })
const reviewMessagesResponseSchema = z.object({ data: z.array(reviewMessageSchema).catch([]) })
const reviewMessageResponseSchema = z.object({ data: reviewMessageSchema })
const topBannerAnnouncementsResponseSchema = z.object({
  data: z.array(topBannerAnnouncementSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(5),
  }).catch({ total: 0, limit: 5 }),
})
const topBannerDismissalResponseSchema = z.object({
  data: z.object({
    announcement_id: z.string(),
    dismissed_at: z.string(),
  }),
})
const decisionResponseSchema = z.object({
  data: z.object({
    item: reviewItemSchema,
    decision_id: z.string(),
    status: z.string(),
  }),
})

export type ReviewItem = z.infer<typeof reviewItemSchema>
export type ReviewMessage = z.infer<typeof reviewMessageSchema>
export type TopBannerAnnouncement = z.infer<typeof topBannerAnnouncementSchema>
export type ReviewItemsResponse = z.infer<typeof reviewItemsResponseSchema>

export async function listReviewItems(input: {
  limit?: number
  offset?: number
  type?: 'request' | 'message'
  status?: string
  readState?: 'read' | 'unread'
  visibility?: 'active' | 'archived'
  threadId?: string
  deliverySurface?: 'inbox' | 'chat_inline'
  includeHidden?: boolean
}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams()
  if (input.limit) params.set('limit', String(input.limit))
  if (input.offset) params.set('offset', String(input.offset))
  if (input.type) params.set('type', input.type)
  if (input.status) params.set('status', input.status)
  if (input.readState) params.set('read_state', input.readState)
  if (input.visibility) params.set('visibility', input.visibility)
  if (input.threadId) params.set('thread_id', input.threadId)
  if (input.deliverySurface) params.set('delivery_surface', input.deliverySurface)
  if (input.includeHidden !== undefined) params.set('include_hidden', input.includeHidden ? 'true' : 'false')
  const query = params.toString()
  return gatewayRequest(`/api/v1/review/items${query ? `?${query}` : ''}`, {
    schema: reviewItemsResponseSchema,
    signal: options.signal,
  })
}

export async function probeUnreadReviewItems() {
  const response = await listReviewItems({
    limit: 1,
    offset: 0,
    readState: 'unread',
  })

  const newest = response.data[0]
  return {
    total: response.meta.total,
    newestId: newest?.id ?? null,
    newestRevision: newest
      ? [
          newest.id,
          newest.status,
          newest.read_state,
          newest.updated_at,
          JSON.stringify(newest.payload ?? {}),
        ].join(':')
      : null,
  }
}

export function getReviewInboxEventsUrl() {
  return `${getYoutorchApiBaseUrl()}/api/v1/review/events`
}

export async function listTopBannerAnnouncements(input: { limit?: number } = {}) {
  const params = new URLSearchParams()
  if (input.limit) params.set('limit', String(input.limit))
  const query = params.toString()
  const result = await gatewayRequest(`/api/v1/review/announcements/top-banner${query ? `?${query}` : ''}`, {
    schema: topBannerAnnouncementsResponseSchema,
  })
  return result.data
}

export async function listPublicTopBannerAnnouncements(input: { limit?: number } = {}) {
  const params = new URLSearchParams()
  if (input.limit) params.set('limit', String(input.limit))
  const query = params.toString()
  const result = await gatewayRequest(`/api/v1/review/public/announcements/top-banner${query ? `?${query}` : ''}`, {
    schema: topBannerAnnouncementsResponseSchema,
  })
  return result.data
}

export async function dismissTopBannerAnnouncement(id: string) {
  const result = await gatewayRequest(`/api/v1/review/announcements/top-banner/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    csrf: true,
    schema: topBannerDismissalResponseSchema,
  })
  return result.data
}

export async function getReviewItem(id: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/review/items/${encodeURIComponent(id)}`, {
    schema: reviewItemResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function markReviewItemSeen(id: string) {
  const result = await gatewayRequest(`/api/v1/review/items/${encodeURIComponent(id)}/seen`, {
    method: 'POST',
    csrf: true,
    schema: reviewItemResponseSchema,
  })
  return result.data
}

export async function archiveReviewItem(id: string) {
  const result = await gatewayRequest(`/api/v1/review/items/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    csrf: true,
    schema: reviewItemResponseSchema,
  })
  return result.data
}

export async function unarchiveReviewItem(id: string) {
  const result = await gatewayRequest(`/api/v1/review/items/${encodeURIComponent(id)}/unarchive`, {
    method: 'POST',
    csrf: true,
    schema: reviewItemResponseSchema,
  })
  return result.data
}

export async function deleteReviewItem(id: string) {
  const result = await gatewayRequest(`/api/v1/review/items/${encodeURIComponent(id)}/delete`, {
    method: 'POST',
    csrf: true,
    schema: reviewItemResponseSchema,
  })
  return result.data
}

export async function decideReviewRequest(input: {
  requestId: string
  action: 'approve' | 'reject' | 'request_changes' | 'answer'
  comment?: string | null
  responsePayload?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/review/requests/${encodeURIComponent(input.requestId)}/decision`, {
    method: 'POST',
    csrf: true,
    body: {
      action: input.action,
      comment: input.comment ?? null,
      response_payload: input.responsePayload ?? {},
      idempotency_key: input.idempotencyKey ?? `review-decision:${input.requestId}:${crypto.randomUUID()}`,
    },
    schema: decisionResponseSchema,
  })
  return result.data
}

export async function listReviewMessages(requestId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/review/requests/${encodeURIComponent(requestId)}/messages`, {
    schema: reviewMessagesResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function addReviewMessage(input: {
  requestId: string
  body: string
  payload?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/review/requests/${encodeURIComponent(input.requestId)}/messages`, {
    method: 'POST',
    csrf: true,
    body: {
      body: input.body,
      payload: input.payload ?? {},
      idempotency_key: input.idempotencyKey ?? `review-message:${input.requestId}:${crypto.randomUUID()}`,
    },
    schema: reviewMessageResponseSchema,
  })
  return result.data
}

export function getReviewDisplayTitle(item: ReviewItem) {
  return renderReviewText(item.title_key, item.payload)
}

export function getReviewDisplayMessage(item: ReviewItem) {
  return renderReviewText(item.message_key, item.payload)
}

export function getAnnouncementDisplayTitle(item: TopBannerAnnouncement) {
  return renderReviewText(item.title_key, item.payload)
}

export function getAnnouncementDisplayMessage(item: TopBannerAnnouncement) {
  return renderReviewText(item.message_key, item.payload)
}

function renderReviewText(key: string, payload: Record<string, unknown>) {
  const nodeInputs = getRecord(payload.node_inputs)
  const directTitle = getString(payload.title)
    ?? getString(payload.approval_title)
    ?? getString(payload.review_title)
    ?? getString(nodeInputs.title)
    ?? getString(nodeInputs.approval_title)
    ?? getString(nodeInputs.review_title)
  const directMessage = getString(payload.message)
    ?? getString(payload.approval_summary)
    ?? getString(payload.approval_message)
    ?? getString(payload.review_message)
    ?? getString(payload.description)
    ?? getString(payload.reason)
    ?? getString(nodeInputs.message)
    ?? getString(nodeInputs.approval_message)
    ?? getString(nodeInputs.review_message)
    ?? getString(nodeInputs.description)
    ?? getString(nodeInputs.reason)
  const normalizedTitle = normalizeReviewDisplayText(directTitle)
  const normalizedMessage = normalizeReviewDisplayText(directMessage)
  if (key.endsWith('.title') && normalizedTitle) return normalizedTitle
  if (key.endsWith('.message') && normalizedMessage) return normalizedMessage
  if (key === 'review.workflow_gate.title') return normalizedTitle ?? 'Review pending'
  if (key === 'review.workflow_gate.message') return normalizedMessage ?? 'The workflow is waiting for your decision before it continues.'
  return key
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export const REVIEW_DISPLAY_TEXT_MAX_LENGTH = 16_000

export function normalizeReviewDisplayText(value: string | null) {
  if (!value) return null
  const text = boundReviewDisplayText(value)
  const titleMap: Record<string, string> = {
    'Gorsel uretimi onayi': 'Image generation review',
    'Video uretimi onayi': 'Video generation review',
    'Yayin onayi': 'Publishing review',
    'AI adimi onayi': 'AI step review',
    'Dosya islemi onayi': 'File operation review',
    'Devam onayi': 'Review required',
  }
  if (titleMap[text]) return titleMap[text]

  const promptParts = parseLegacyPromptApproval(text)
  if (promptParts) {
    return `Approve this prompt before ${normalizeLegacyReviewAction(promptParts.action)}: "${promptParts.prompt}".`
  }

  const materialParts = parseLegacyMaterialApproval(text)
  if (materialParts) {
    return `Approve ${normalizeLegacyMaterialPhrase(materialParts.material)} before ${normalizeLegacyReviewAction(materialParts.action)}.`
  }

  const nextStep = parseLegacyNextStepApproval(text)
  if (nextStep) {
    return `Approve before ${normalizeLegacyReviewLabel(nextStep)} starts.`
  }

  return text
    .replace(/\bsonraki adim\b/gi, 'next step')
    .replace(/\bgorsel uretimi\b/gi, 'image generation')
    .replace(/\bvideo uretimi\b/gi, 'video generation')
    .replace(/\byayin\b/gi, 'publishing')
    .replace(/\bmetin uretimi\b/gi, 'text generation')
    .replace(/\bdosya islemi\b/gi, 'file operation')
}

function boundReviewDisplayText(value: string) {
  const text = value.trim()
  if (text.length <= REVIEW_DISPLAY_TEXT_MAX_LENGTH) return text
  return `${text.slice(0, REVIEW_DISPLAY_TEXT_MAX_LENGTH - 1).trimEnd()}…`
}

function parseLegacyPromptApproval(text: string) {
  const prefix = 'Bu prompt ile '
  const separator = ': "'
  const suffix = '". Onayliyor musun?'
  if (!startsWithIgnoreCase(text, prefix) || !endsWithIgnoreCase(text, suffix)) return null
  const body = text.slice(prefix.length, text.length - suffix.length)
  const separatorIndex = body.indexOf(separator)
  if (separatorIndex <= 0) return null
  const action = body.slice(0, separatorIndex).trim()
  const prompt = body.slice(separatorIndex + separator.length).trim()
  return action && prompt ? { action, prompt } : null
}

function parseLegacyMaterialApproval(text: string) {
  const prefix = 'Bu '
  const separator = ' ile '
  const suffix = '. Onayliyor musun?'
  if (!startsWithIgnoreCase(text, prefix) || !endsWithIgnoreCase(text, suffix)) return null
  const body = text.slice(prefix.length, text.length - suffix.length)
  const separatorIndex = body.indexOf(separator)
  if (separatorIndex <= 0) return null
  const material = body.slice(0, separatorIndex).trim()
  const action = body.slice(separatorIndex + separator.length).trim()
  return material && action ? { material, action } : null
}

function parseLegacyNextStepApproval(text: string) {
  const suffix = ' baslamadan once onay gerekiyor. Onayliyor musun?'
  if (!endsWithIgnoreCase(text, suffix)) return null
  const label = text.slice(0, text.length - suffix.length).trim()
  return label || null
}

function startsWithIgnoreCase(value: string, prefix: string) {
  return value.length >= prefix.length
    && value.slice(0, prefix.length).toLocaleLowerCase('en-US') === prefix.toLocaleLowerCase('en-US')
}

function endsWithIgnoreCase(value: string, suffix: string) {
  return value.length >= suffix.length
    && value.slice(value.length - suffix.length).toLocaleLowerCase('en-US') === suffix.toLocaleLowerCase('en-US')
}

function normalizeLegacyReviewLabel(value: string) {
  const key = value.trim().toLowerCase()
  const labels: Record<string, string> = {
    'sonraki adim': 'next step',
    'gorsel uretimi': 'image generation',
    'video uretimi': 'video generation',
    yayin: 'publishing',
    'metin uretimi': 'text generation',
    'dosya islemi': 'file operation',
  }
  return labels[key] ?? value.trim()
}

function normalizeLegacyReviewAction(value: string) {
  const key = value.trim().toLowerCase()
  const actions: Record<string, string> = {
    'gorsel uretilecek': 'generating an image',
    'video uretilecek': 'generating a video',
    'icerik yayin adimina gidecek': 'publishing the content',
    'ai adimi calisacak': 'running the AI step',
    'dosya islemi baslayacak': 'starting the file operation',
    'workflow sonraki adima gececek': 'continuing the workflow',
  }
  return actions[key] ?? normalizeLegacyReviewLabel(value)
}

function normalizeLegacyMaterialPhrase(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'bagli veri') return 'connected data'
  if (key === 'bagli materyal') return '1 connected material'
  const countSuffix = ' bagli materyal'
  if (key.endsWith(countSuffix)) {
    const count = key.slice(0, -countSuffix.length)
    if (count && [...count].every((character) => character >= '0' && character <= '9')) {
      return `${count} connected materials`
    }
  }
  return value.trim()
}

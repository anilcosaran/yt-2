import { createAssistantIdempotencyKey } from '@/lib/assistant/api'
import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientKeyValueStorage,
} from '@/lib/idempotency/client-mutation-control'

export const NEW_CHAT_QUERY_PARAM = 'new'

export class NewChatIntentTracker {
  private pendingId: string | null = null
  private sourceConversationId: string | null = null

  next(currentNewChatId: string | null, currentConversationId: string | null) {
    const routeId = normalizeIntentId(currentNewChatId)
    if (routeId) {
      this.pendingId = routeId
      this.sourceConversationId = null
      return routeId
    }
    if (this.pendingId && this.sourceConversationId === currentConversationId) return this.pendingId
    this.pendingId = createNewChatIntentId()
    this.sourceConversationId = currentConversationId
    return this.pendingId
  }

  sync(currentNewChatId: string | null, currentConversationId: string | null) {
    const routeId = normalizeIntentId(currentNewChatId)
    if (routeId) {
      this.pendingId = routeId
      this.sourceConversationId = null
    } else if (currentConversationId) {
      this.pendingId = null
      this.sourceConversationId = null
    }
  }
}

export type AssistantMessageAttemptPayload = {
  conversationId: string
}

export function createAssistantMessageAttemptStore(storage?: ClientKeyValueStorage | null) {
  return new ClientMutationAttemptStore<AssistantMessageAttemptPayload>({
    storageKey: 'youtorch:assistant-message-attempts:v1',
    isPayload: isAssistantMessageAttemptPayload,
    ...(storage !== undefined ? { storage } : { storage: null }),
  })
}

export function createNewChatIntentId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function buildNewChatHref(intentId: string) {
  return `/chat?${NEW_CHAT_QUERY_PARAM}=${encodeURIComponent(intentId)}`
}

export function buildAssistantConversationIdempotencyKey(newChatId: string, channelId: string) {
  return `assistant-conversation:${stableClientFingerprint({ new_chat_id: newChatId, channel_id: channelId })}`
}

export function getAssistantMessageAttemptScope(conversationId: string) {
  return `assistant-message:${conversationId}`
}

export function getAssistantMessageAttemptFingerprint(input: {
  content: string
  contentJson: Record<string, unknown>
  modelId?: string | null
  composerSelection?: unknown
}) {
  return stableClientFingerprint(input)
}

export function createAssistantMessageIdempotencyKey() {
  return createAssistantIdempotencyKey('assistant-message')
}

function normalizeIntentId(value: string | null) {
  const normalized = value?.trim() ?? ''
  return normalized && normalized.length <= 160 ? normalized : null
}

function isAssistantMessageAttemptPayload(value: unknown): value is AssistantMessageAttemptPayload {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Partial<AssistantMessageAttemptPayload>).conversationId === 'string',
  )
}

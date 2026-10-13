import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { sparkAspectRatios, type SparkAspectRatio } from './api'

/**
 * P03-11/P03-07 Spark entries: "Open in Spark" from Chat. The server entry (Composition) creates or resolves
 * the project, binds the exact refs and places them; this client only sends the user's choice and renders the
 * server descriptor. Nothing is kept in browser storage: the entry and the project live on the server.
 */
export const sparkEntryStatuses = ['open', 'attaching', 'preparing', 'ready', 'partial', 'failed'] as const
export type SparkEntryStatus = (typeof sparkEntryStatuses)[number]

const artifactRefSchema = z.object({
  artifact_id: z.string(),
  artifact_revision: z.number().int(),
  conversation_id: z.string(),
  message_id: z.string(),
})

const projectDescriptorSchema = z.object({
  project_id: z.string().min(1),
  channel_id: z.string().min(1),
  title: z.string(),
  aspect_ratio: z.enum(sparkAspectRatios),
  lifecycle_state: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
  working_copy_version: z.number().int(),
  head_revision_id: z.string().nullable(),
  open_path: z.string().startsWith('/spark/'),
})

/** `composition_spark_handoff_v1`: the result contract a Chat card opens (project/version/revision + chat + refs). */
export const sparkHandoffSchema = z.object({
  schema_version: z.literal('composition_spark_handoff_v1'),
  project: z.object({
    project_id: z.string().min(1),
    working_copy_version: z.number().int(),
    head_revision_id: z.string().nullable(),
    open_path: z.string().startsWith('/spark/'),
  }),
  conversation_id: z.string().nullable(),
  source_message_id: z.string().nullable(),
  entry_id: z.string().nullable(),
  status: z.enum(sparkEntryStatuses),
  artifact_refs: z.array(artifactRefSchema),
})
export type SparkHandoff = z.infer<typeof sparkHandoffSchema>

const entryDescriptorSchema = z.object({
  schema_version: z.literal('composition_spark_entry_v1'),
  entry_id: z.string().nullable(),
  entry_kind: z.enum(['open_project', 'single_asset', 'artifact_set']),
  creation_intent_id: z.string().nullable(),
  status: z.enum(sparkEntryStatuses),
  failure_code: z.string().nullable(),
  project: projectDescriptorSchema.nullable(),
  openable: z.boolean(),
  items: z.array(z.object({
    index: z.number().int(),
    source_kind: z.enum(['storage_object', 'conversation_artifact']),
    storage_object_id: z.string(),
    artifact: artifactRefSchema.nullable(),
    state: z.enum(['pending', 'attached', 'awaiting_probe', 'failed']),
    source_id: z.string().nullable(),
    media_kind: z.enum(['video', 'image', 'audio']).nullable(),
    failure_code: z.string().nullable(),
    placed: z.boolean(),
  })),
  placement: z.object({
    mode: z.enum(['none', 'new_scene']),
    state: z.enum(['not_requested', 'waiting', 'applied', 'skipped']),
    scene_id: z.string().nullable(),
    command_id: z.string().nullable(),
    note: z.string().nullable(),
  }),
  conversation: z.object({
    conversation_id: z.string().nullable(),
    link_state: z.enum(['not_requested', 'linked', 'refused']),
  }),
  timings: z.object({ project_ready_ms: z.number().nullable(), settled_ms: z.number().nullable() }),
  replayed: z.boolean(),
  handoff: sparkHandoffSchema.nullable(),
})
export type SparkEntryDescriptor = z.infer<typeof entryDescriptorSchema>

const entryResponseSchema = z.object({ data: entryDescriptorSchema })

export type SparkEntryItemRequest =
  | { kind: 'storage_object'; storage_object_id: string; checksum_sha256: string; provenance: 'upload' | 'generation' }
  | { kind: 'conversation_artifact'; conversation_id: string; message_id: string; storage_object_id: string }

export type SparkEntryRequest = {
  creation_intent_id?: string
  target:
    | { kind: 'new_draft'; channel_id: string; title: string; aspect_ratio: SparkAspectRatio }
    | { kind: 'existing_project'; project_id: string }
  items?: SparkEntryItemRequest[]
  placement?: 'none' | 'new_scene'
  continue_conversation_id?: string | null
}

export async function startSparkEntry(request: SparkEntryRequest, options: { signal?: AbortSignal } = {}): Promise<SparkEntryDescriptor> {
  const response = await gatewayRequest('/api/v1/composition-spark/entries', {
    method: 'POST',
    csrf: true,
    body: request,
    schema: entryResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function getSparkEntry(entryId: string, options: { signal?: AbortSignal } = {}): Promise<SparkEntryDescriptor> {
  const response = await gatewayRequest(`/api/v1/composition-spark/entries/${encodeURIComponent(entryId)}`, {
    schema: entryResponseSchema,
    signal: options.signal,
  })
  return response.data
}

const conversationLinkSchema = z.object({
  data: z.object({
    project_id: z.string(),
    conversation_id: z.string().nullable(),
    linked_via: z.enum(['spark_entry', 'editor']).nullable(),
    updated_at: z.string().nullable(),
  }),
})

/** F34: the chat this user continues in the project (null: start a new project chat). */
export async function getSparkConversationLink(projectId: string, options: { signal?: AbortSignal } = {}): Promise<string | null> {
  const response = await gatewayRequest(`/api/v1/composition-spark/projects/${encodeURIComponent(projectId)}/conversation-link`, {
    schema: conversationLinkSchema,
    signal: options.signal,
  })
  return response.data.conversation_id
}

export async function setSparkConversationLink(projectId: string, conversationId: string): Promise<string | null> {
  const response = await gatewayRequest(`/api/v1/composition-spark/projects/${encodeURIComponent(projectId)}/conversation-link`, {
    method: 'PUT',
    csrf: true,
    body: { conversation_id: conversationId },
    schema: conversationLinkSchema,
  })
  return response.data.conversation_id
}

const projectStatusSchema = z.object({
  data: z.object({
    schema_version: z.literal('composition_spark_project_v1'),
    project: projectDescriptorSchema,
    openable: z.literal(true),
    conversation: z.object({ conversation_id: z.string().nullable() }),
    preparation: z.object({
      state: z.enum(['ready', 'preparing']),
      open_entry_ids: z.array(z.string()),
      sources: z.object({ attached: z.number().int(), awaiting_probe: z.number().int(), pending: z.number().int() }),
    }),
  }),
})
export type SparkProjectStatus = z.infer<typeof projectStatusSchema>['data']

/**
 * P03-13 server project descriptor: what "Continue in Spark" opens. The button always asks the owner (access
 * + open path); an openable project opens even while media is still being prepared.
 */
export async function getSparkProjectDescriptor(projectId: string, options: { signal?: AbortSignal } = {}): Promise<SparkProjectStatus> {
  const response = await gatewayRequest(`/api/v1/composition-spark/projects/${encodeURIComponent(projectId)}/descriptor`, {
    schema: projectStatusSchema,
    signal: options.signal,
  })
  return response.data
}

/** One chat result the message offers: the exact ref the server re-authorizes at import time. */
export type ChatResultArtifactRef = {
  conversationId: string
  messageId: string
  storageObjectId: string
  storageChannelId: string | null
  kind: 'video' | 'image' | 'audio' | 'other'
  name: string | null
}

type ChatResultMessage = {
  id: string
  conversation_id: string
  role: string
  deleted_at?: string | null
  content_json: Record<string, unknown>
}

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/**
 * The Storage-backed media of an assistant result message, in the message's order (same rule as the server
 * projection: `media_refs`/`attachments`, one ref per object). URLs are never refs: a signed or plain URL
 * without a Storage object is not importable.
 */
export function chatResultArtifactRefs(message: ChatResultMessage): ChatResultArtifactRef[] {
  if (message.role !== 'assistant' || message.deleted_at) return []
  const records = [
    ...readRecords(message.content_json['media_refs']),
    ...readRecords(message.content_json['attachments']),
  ]
  const seen = new Set<string>()
  const refs: ChatResultArtifactRef[] = []
  for (const record of records) {
    const objectId = readString(record['storage_object_id']) ?? storageObjectIdFromUri(readString(record['url']))
    if (!objectId || !OPAQUE_ID.test(objectId) || seen.has(objectId)) continue
    seen.add(objectId)
    const type = (readString(record['content_type']) ?? readString(record['mime_type']) ?? '').toLowerCase()
    refs.push({
      conversationId: message.conversation_id,
      messageId: message.id,
      storageObjectId: objectId,
      storageChannelId: readString(record['storage_channel_id']),
      kind: type.startsWith('video/') ? 'video' : type.startsWith('image/') ? 'image' : type.startsWith('audio/') ? 'audio' : 'other',
      name: readString(record['name']),
    })
  }
  return refs
}

/**
 * K44: "Open in Spark" on the same message resolves the same entry and project (retry, reconnect, a second
 * click, another tab); a deliberate new project is a new intent. The intent is derived from the message id.
 */
export async function sparkIntentForChatMessage(messageId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`chat-result:${messageId}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `chat-${hex.slice(0, 40)}`
}

/**
 * The entry request of "Open in Spark" on one result message: a persistent draft with the message's media in
 * their order, continuing this chat in the editor. The draft lives in the channel that holds the bytes.
 */
export function chatResultEntryRequest(input: {
  refs: ChatResultArtifactRef[]
  creationIntentId: string
  fallbackChannelId: string | null
  fallbackTitle: string
  aspectRatio?: SparkAspectRatio
}): SparkEntryRequest | null {
  const importable = input.refs.filter((ref) => ref.kind === 'video' || ref.kind === 'image' || ref.kind === 'audio')
  const channelId = importable.find((ref) => ref.storageChannelId)?.storageChannelId ?? input.fallbackChannelId
  if (importable.length === 0 || !channelId) return null
  const first = importable[0]!
  const title = (first.name ?? input.fallbackTitle).trim().slice(0, 120) || input.fallbackTitle
  return {
    creation_intent_id: input.creationIntentId,
    target: { kind: 'new_draft', channel_id: channelId, title, aspect_ratio: input.aspectRatio ?? '16:9' },
    items: importable.map((ref) => ({
      kind: 'conversation_artifact',
      conversation_id: ref.conversationId,
      message_id: ref.messageId,
      storage_object_id: ref.storageObjectId,
    })),
    continue_conversation_id: first.conversationId,
  }
}

/**
 * Card state from the owner's descriptor only (P03-07): there is no "queued" state here — an entry is never
 * waiting in a capacity queue, and the card never claims one without a durable ticket.
 */
export type SparkEntryCardState = 'preparing' | 'ready' | 'partial' | 'failed'

export function sparkEntryCardState(status: SparkEntryStatus): SparkEntryCardState {
  if (status === 'ready' || status === 'open') return 'ready'
  if (status === 'partial') return 'partial'
  if (status === 'failed') return 'failed'
  return 'preparing'
}

/** A `composition_spark_handoff_v1` a result message carries (tool result / card), or null. */
export function readSparkHandoff(contentJson: Record<string, unknown>): SparkHandoff | null {
  const candidate = contentJson['spark_handoff'] ?? contentJson['composition_spark_handoff']
  const parsed = sparkHandoffSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : []
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function storageObjectIdFromUri(value: string | null): string | null {
  if (!value) return null
  const match = /^storage:\/\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/.exec(value)
  return match?.[1] ?? null
}

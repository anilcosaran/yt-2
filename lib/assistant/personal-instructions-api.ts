'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P01B-03 "Asistan kurallari" client: the Assistant PersonalInstruction owner facade. Rules are server data only;
 * the page keeps nothing in browser storage and shows a loading state until the list arrives.
 */
export const personalInstructionsQueryKey = (channelId: string | null) => ['assistant', 'personal-instructions', channelId] as const
export const personalInstructionDetailQueryKey = (instructionId: string | null) => ['assistant', 'personal-instruction', instructionId] as const

const preferenceSlotSchema = z.enum(['avatar', 'voice', 'template', 'intro', 'outro'])

const preferenceSchema = z.object({
  schema_version: z.literal('personal_instruction_preference_v1'),
  condition: z.object({
    content_types: z.array(z.string()).catch([]),
    project_id: z.string().nullable().catch(null),
  }),
  bindings: z.array(z.object({
    slot: preferenceSlotSchema,
    ref: z.record(z.unknown()).nullable(),
    label: z.string().nullable().catch(null),
  })),
})

const sourceRequestSchema = z.object({
  kind: z.literal('explicit_user_request'),
  surface: z.enum(['chat', 'script_canvas', 'memory_page']).catch('memory_page'),
  conversation_id: z.string().nullable().catch(null),
  message_id: z.string().nullable().catch(null),
  excerpt: z.string().nullable().catch(null),
})

const revisionSchema = z.object({
  id: z.string(),
  revision_number: z.number(),
  title: z.string().nullable(),
  body: z.string(),
  content_hash_sha256: z.string(),
  created_at: z.string(),
  preference: preferenceSchema.nullable().catch(null),
  source_request: sourceRequestSchema.nullable().catch(null),
})

const instructionSchema = z.object({
  schema_version: z.literal('personal_instruction_view_v1'),
  id: z.string(),
  scope: z.object({ level: z.enum(['personal', 'channel']), channel_id: z.string().nullable() }),
  visibility: z.enum(['private', 'shared']),
  acl_version: z.number(),
  version: z.number(),
  status: z.enum(['active', 'disabled', 'deleted']),
  enabled: z.boolean(),
  title: z.string().nullable(),
  kind: z.enum(['rule', 'preference']),
  revision_count: z.number(),
  owner: z.boolean(),
  current_revision: revisionSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

const listResponseSchema = z.object({ data: z.object({ items: z.array(instructionSchema) }) })
const envelopeResponseSchema = z.object({ data: z.object({ instruction: instructionSchema }) })
const detailResponseSchema = z.object({ data: z.object({ instruction: instructionSchema, revisions: z.array(revisionSchema) }) })
const deleteResponseSchema = z.object({ data: z.object({ instruction_id: z.string(), deleted: z.literal(true) }) })

export type PersonalInstruction = z.infer<typeof instructionSchema>
export type PersonalInstructionRevision = z.infer<typeof revisionSchema>
export type PersonalInstructionPreference = z.infer<typeof preferenceSchema>
export type PersonalInstructionPreferenceSlot = z.infer<typeof preferenceSlotSchema>

export async function listPersonalInstructions(input: { channelId: string | null }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ limit: '200' })
  if (input.channelId) params.set('channel_id', input.channelId)
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions?${params.toString()}`, {
    schema: listResponseSchema,
    signal: options.signal,
  })
  return result.data.items
}

export async function getPersonalInstruction(instructionId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions/${encodeURIComponent(instructionId)}`, {
    schema: detailResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function createPersonalInstruction(input: {
  scope: 'personal' | 'channel'
  channelId: string | null
  title: string | null
  body: string
  idempotencyKey: string
}) {
  const result = await gatewayRequest('/api/v1/assistant/personal-instructions', {
    method: 'POST',
    csrf: true,
    body: {
      scope: input.scope,
      channel_id: input.scope === 'channel' ? input.channelId : null,
      title: input.title,
      body: input.body,
      idempotency_key: input.idempotencyKey,
    },
    schema: envelopeResponseSchema,
  })
  return result.data.instruction
}

export async function revisePersonalInstruction(input: {
  instructionId: string
  expectedVersion: number
  title: string | null
  body: string
  idempotencyKey: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions/${encodeURIComponent(input.instructionId)}/revisions`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_version: input.expectedVersion,
      title: input.title,
      body: input.body,
      idempotency_key: input.idempotencyKey,
    },
    schema: envelopeResponseSchema,
  })
  return result.data.instruction
}

export async function setPersonalInstructionEnabled(input: { instructionId: string; expectedVersion: number; enabled: boolean }) {
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions/${encodeURIComponent(input.instructionId)}`, {
    method: 'PATCH',
    csrf: true,
    body: { expected_version: input.expectedVersion, enabled: input.enabled },
    schema: envelopeResponseSchema,
  })
  return result.data.instruction
}

export async function deletePersonalInstruction(input: { instructionId: string; expectedVersion: number }) {
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions/${encodeURIComponent(input.instructionId)}`, {
    method: 'DELETE',
    csrf: true,
    body: { expected_version: input.expectedVersion },
    schema: deleteResponseSchema,
  })
  return result.data
}

/**
 * S29: share a CHANNEL rule with the members of its own channel (they can read it and it applies to their assistant
 * in that channel), or make it private again (revokes every grant). Owner only; carries the ACL version the user saw.
 */
export async function setChannelRuleSharing(input: {
  instructionId: string
  channelId: string
  expectedAclVersion: number
  shared: boolean
}) {
  const result = await gatewayRequest(`/api/v1/assistant/personal-instructions/${encodeURIComponent(input.instructionId)}/visibility`, {
    method: 'POST',
    csrf: true,
    body: input.shared
      ? {
        visibility: 'shared',
        expected_acl_version: input.expectedAclVersion,
        audience: [
          { kind: 'channel_members', id: input.channelId, permission: 'read' },
          { kind: 'channel_members', id: input.channelId, permission: 'use_in_context' },
        ],
      }
      : { visibility: 'private', expected_acl_version: input.expectedAclVersion, audience: [] },
    schema: envelopeResponseSchema,
  })
  return result.data.instruction
}

/** A new idempotency key per user intent; kept in component state (never browser storage) and reused on retry. */
export function createRuleIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

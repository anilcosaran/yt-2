'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Spark context meter client: the context usage of one conversation (`GET /api/v1/assistant-context/conversations/{id}/usage`),
 * read-only server data. `not_recorded` means no assistant call of the conversation was measured yet.
 */

export const ASSISTANT_CONTEXT_USAGE_QUERY_KEY = ['assistant', 'context-usage'] as const

export const CONTEXT_SECTION_KEYS = [
  'system',
  'tools',
  'skill_index',
  'skills',
  'rules',
  'memory',
  'history',
  'tool_results',
  'turn_state',
  'user_message',
] as const
export type ContextSectionKey = (typeof CONTEXT_SECTION_KEYS)[number]

const totalsSchema = z.object({
  planner_calls: z.number(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  credits: z.number(),
})

const skillSchema = z.object({
  skill_id: z.string(),
  name: z.string().nullable(),
  layer: z.string().nullable(),
  selected_by: z.string().nullable(),
  tokens: z.number(),
})

const lastTurnSchema = z.object({
  run_id: z.string(),
  recorded_at: z.string(),
  input_tokens: z.number(),
  input_token_kind: z.enum(['counted', 'estimated']),
  input_token_source: z.string(),
  counted_input_tokens: z.number(),
  counted_input_token_source: z.string(),
  output_tokens: z.number(),
  cache_read_input_tokens: z.number().nullable(),
  cache_write_input_tokens: z.number().nullable(),
  context_window_tokens: z.number().nullable(),
  max_input_tokens: z.number().nullable(),
  limit_tokens: z.number(),
  used_ratio: z.number(),
  until_trim_tokens: z.number().nullable(),
  output_budget: z.object({ tokens: z.number(), kind: z.string().nullable() }).nullable(),
  credits: z.number(),
  // A section key a newer gateway adds is dropped, never an error.
  sections: z.array(z.object({ key: z.string(), tokens: z.number() })),
  skills: z.array(skillSchema),
  sections_basis: z.string(),
  trimming: z.object({
    applied: z.boolean(),
    steps: z.array(z.string()),
    omitted_messages: z.number(),
    compacted_messages: z.number(),
    memory_matches_omitted: z.number(),
    user_skill_index_trimmed: z.boolean(),
  }),
})

const usageSchema = z.object({
  schema: z.literal('assistant_context_usage_v1'),
  conversation_id: z.string(),
  status: z.enum(['recorded', 'not_recorded']),
  last_turn: lastTurnSchema.nullable(),
  job_totals: totalsSchema.extend({ run_id: z.string() }).nullable(),
  conversation_totals: totalsSchema,
})

const responseSchema = z.object({ data: usageSchema })

export type AssistantContextUsage = z.infer<typeof usageSchema>
export type AssistantContextUsageLastTurn = z.infer<typeof lastTurnSchema>
export type AssistantContextUsageTotals = z.infer<typeof totalsSchema>
export type AssistantContextUsageSkill = z.infer<typeof skillSchema>

export async function getAssistantContextUsage(
  input: { conversationId: string },
  options: { signal?: AbortSignal } = {},
): Promise<AssistantContextUsage> {
  const result = await gatewayRequest(
    `/api/v1/assistant-context/conversations/${encodeURIComponent(input.conversationId)}/usage`,
    { schema: responseSchema, signal: options.signal },
  )
  return result.data
}

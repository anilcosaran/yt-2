'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P01B-01/02 Memory page tab gate (`assistant_memory_facade_v1`). The Knowledge tab is Memory BC and always
 * present; the Assistant rules and Skills tabs are facades over their Assistant owners and are shown only when
 * the server reports them enabled. A closed or unreadable gate hides the tab; no local or demo state replaces it.
 */
export const assistantMemoryFacadeQueryKey = ['assistant', 'memory-facade'] as const

const facadeTabSchema = z.object({
  enabled: z.boolean().catch(false),
  reason: z.enum(['disabled_by_operator', 'not_available']).nullable().catch(null),
})

const closedTab = { enabled: false, reason: 'not_available' as const }

const facadeSchema = z.object({
  schema_version: z.literal('assistant_memory_facade_v1'),
  tabs: z.object({
    knowledge: facadeTabSchema.catch({ enabled: true, reason: null }),
    rules: facadeTabSchema.catch(closedTab),
    skills: facadeTabSchema.extend({ ai_authoring: facadeTabSchema.catch(closedTab) }).catch({ ...closedTab, ai_authoring: closedTab }),
  }),
})

const facadeResponseSchema = z.object({ data: facadeSchema })

export type AssistantMemoryFacade = z.infer<typeof facadeSchema>
export type AssistantMemoryFacadeTab = z.infer<typeof facadeTabSchema>

export const CLOSED_ASSISTANT_MEMORY_FACADE: AssistantMemoryFacade = {
  schema_version: 'assistant_memory_facade_v1',
  tabs: {
    knowledge: { enabled: true, reason: null },
    rules: closedTab,
    skills: { ...closedTab, ai_authoring: closedTab },
  },
}

export async function getAssistantMemoryFacade(options: { signal?: AbortSignal } = {}): Promise<AssistantMemoryFacade> {
  const result = await gatewayRequest('/api/v1/assistant/memory-facade', {
    schema: facadeResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export type MemoryPageTab = 'knowledge' | 'rules' | 'skills'

/** The tab to show for a requested `?tab=` value: an unknown or closed tab falls back to Knowledge. */
export function resolveMemoryPageTab(requested: string | null, facade: AssistantMemoryFacade | null): MemoryPageTab {
  if (requested === 'rules' && facade?.tabs.rules.enabled) return 'rules'
  if (requested === 'skills' && facade?.tabs.skills.enabled) return 'skills'
  return 'knowledge'
}

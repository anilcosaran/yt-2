import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-15 multi-image job card (`/api/v1/assistant-multi-output/runs/{runId}`): one card, N stable output slots.
 * Server state only — the card is re-read after a reconnect and shows the same boxes; nothing is kept in browser
 * storage. There is no single progress percentage for a batch: every slot has its own state.
 */

export const multiOutputSlotStates = ['queued', 'running', 'ready', 'failed', 'missing', 'unknown', 'cancelled'] as const
export type MultiOutputSlotState = (typeof multiOutputSlotStates)[number]

const imageSchema = z.object({
  storage_object_id: z.string().nullable(),
  url: z.string().nullable(),
  mime_type: z.string().nullable(),
})

const slotSchema = z.object({
  slot_id: z.string(),
  slot_index: z.number().int(),
  batch_key: z.string(),
  state: z.enum(multiOutputSlotStates),
  output: imageSchema.nullable(),
  retryable: z.boolean(),
  reason: z.enum(['content_refused', 'funding_required', 'provider_returned_fewer', 'outcome_unknown']).nullable(),
})

const cardSchema = z.object({
  schema: z.literal('assistant_multi_output_card_v1'),
  run_id: z.string(),
  source: z.object({ kind: z.enum(['workflow', 'agent']), id: z.string() }),
  requested_count: z.number().int(),
  planned_count: z.number().int(),
  count_conflict: z.object({ requested: z.number().int(), planned: z.number().int() }).nullable(),
  progress_mode: z.literal('per_slot'),
  slots: z.array(slotSchema),
  counts: z.record(z.enum(multiOutputSlotStates), z.number().int()),
  terminal: z.boolean(),
  retry: z.object({
    allowed: z.boolean(),
    slot_ids: z.array(z.string()),
    count: z.number().int(),
    blocked_reason: z.enum(['job_running', 'nothing_to_retry', 'outcome_unknown']).nullable(),
  }),
  cost: z.object({ charged_credits: z.number() }),
})

export type MultiOutputCard = z.output<typeof cardSchema>
export type MultiOutputSlot = z.output<typeof slotSchema>

const cardResponseSchema = z.object({ data: cardSchema.nullable() })

export async function getMultiOutputCard(runId: string, options: { signal?: AbortSignal } = {}): Promise<MultiOutputCard | null> {
  const response = await gatewayRequest(`/api/v1/assistant-multi-output/runs/${encodeURIComponent(runId)}`, {
    schema: cardResponseSchema,
    signal: options.signal,
  })
  return response.data
}

/** Ready images can be opened at once, before the rest of the batch finishes. */
export function readyMultiOutputSlots(card: MultiOutputCard): MultiOutputSlot[] {
  return card.slots.filter((slot) => slot.state === 'ready' && slot.output !== null)
}

/** Whether the card should be polled again (a terminal card never changes by itself). */
export function isMultiOutputCardSettled(card: MultiOutputCard): boolean {
  return card.terminal
}

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P01D-06 AI skill authoring client for the Memory → Skills "AI ile oluştur" entry. The server writes only a DRAFT
 * revision of the user's own skill: nothing is validated, activated, installed or shared by a generation. One
 * request is at most one bounded paid attempt (idempotency key per user intent; a replay costs nothing).
 */

export const skillAiAvailabilityQueryKey = ['assistant', 'skill-generations', 'availability'] as const

const generationSchema = z.object({
  generation_id: z.string(),
  status: z.enum(['running', 'needs_input', 'completed', 'failed', 'outcome_unknown']),
  failure_code: z.string().nullable().catch(null),
  questions: z.array(z.object({ id: z.string(), text: z.string() })).catch([]),
  result: z.object({
    skill_id: z.string(),
    skill_revision_id: z.string(),
    revision_number: z.number(),
  }).passthrough().nullable().catch(null),
}).passthrough()

export type SkillAiGeneration = z.infer<typeof generationSchema>

const TERMINAL: ReadonlyArray<SkillAiGeneration['status']> = ['needs_input', 'completed', 'failed', 'outcome_unknown']

export function isSkillAiGenerationTerminal(generation: SkillAiGeneration) {
  return TERMINAL.includes(generation.status)
}

/** Whether AI authoring is wired (job spend envelope on); the button stays disabled otherwise. */
export async function getSkillAiAvailability(options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest('/api/v1/assistant/skill-generations/availability', {
    schema: z.object({ data: z.object({ available: z.boolean() }) }),
    signal: options.signal,
  })
  return result.data.available
}

/** Create a new skill draft from an instruction, or answer the guide's questions of a previous generation. */
export async function generateSkillDraft(input: {
  instruction: string
  locale?: string
  previousGenerationId?: string | null
  answers?: Array<{ questionId: string; text: string }>
  idempotencyKey: string
}) {
  const result = await gatewayRequest('/api/v1/assistant/skill-generations', {
    method: 'POST',
    csrf: true,
    body: {
      mode: 'create',
      instruction: input.instruction,
      locale: input.locale || undefined,
      previous_generation_id: input.previousGenerationId || undefined,
      answers: input.answers?.length
        ? input.answers.map((answer) => ({ question_id: answer.questionId, text: answer.text }))
        : undefined,
      idempotency_key: input.idempotencyKey,
    },
    schema: z.object({ data: z.object({ generation: generationSchema, replayed: z.boolean() }) }),
  })
  return result.data
}

export async function getSkillAiGeneration(generationId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-generations/${encodeURIComponent(generationId)}`, {
    schema: z.object({ data: z.object({ generation: generationSchema }) }),
    signal: options.signal,
  })
  return result.data.generation
}

/** A running generation (another tab, a retry) is read until it is terminal; never re-requested (no second charge). */
export async function waitForSkillAiGeneration(
  generation: SkillAiGeneration,
  options: { intervalMs?: number; maxPolls?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<SkillAiGeneration> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  let current = generation
  for (let poll = 0; poll < (options.maxPolls ?? 30) && !isSkillAiGenerationTerminal(current); poll += 1) {
    await sleep(options.intervalMs ?? 2_000)
    current = await getSkillAiGeneration(current.generation_id)
  }
  return current
}

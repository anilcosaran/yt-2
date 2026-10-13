'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P01D-11 Chat skill authoring cards (`content_json.skill_authoring_card`) and the one explicit step a card offers:
 * activating the reviewed revision (P01D-07, bound to the review digest the card shows). Product data stays on the
 * server; the card only reads the message and the activation response.
 */

const skillRefSchema = z.object({
  skill_id: z.string(),
  name: z.string().catch(''),
  skill_revision_id: z.string().nullable().catch(null),
  revision_number: z.number().nullable().catch(null),
  status: z.string().nullable().catch(null),
})

const savedCardSchema = z.object({
  schema_version: z.literal('skill_saved_card_v1'),
  tool_id: z.string(),
  outcome: z.enum(['draft_saved', 'needs_input', 'not_saved']),
  skill: skillRefSchema.nullable().catch(null),
  authored_by: z.enum(['user', 'ai_draft']).catch('ai_draft'),
  questions: z.array(z.object({ id: z.string(), text: z.string() })).catch([]),
  diff_summary: z.object({
    lines_added: z.number().catch(0),
    lines_removed: z.number().catch(0),
    manifest_fields: z.array(z.string()).catch([]),
    authoring_sections: z.array(z.string()).catch([]),
  }).nullable().catch(null),
  next_step: z.string().catch('review_and_activate'),
})

const diffCardSchema = z.object({
  schema_version: z.literal('skill_diff_card_v1'),
  tool_id: z.string(),
  skill: skillRefSchema,
  baseline: z.object({ skill_revision_id: z.string(), revision_number: z.number() }).nullable().catch(null),
  manifest: z.array(z.object({
    field: z.string(),
    kind: z.string(),
    added: z.array(z.string()).optional(),
    removed: z.array(z.string()).optional(),
  })).catch([]),
  authoring: z.array(z.object({ section: z.string(), added: z.number(), removed: z.number(), changed: z.number() })).catch([]),
  body: z.object({ changed: z.boolean(), lines_added: z.number(), lines_removed: z.number(), truncated: z.boolean() }).catch({
    changed: false, lines_added: 0, lines_removed: 0, truncated: false,
  }),
})

const resultCardSchema = z.object({
  schema_version: z.literal('skill_result_card_v1'),
  tool_id: z.string(),
  kind: z.enum(['search', 'read', 'validate', 'test', 'activation_review', 'deactivated']),
  status: z.enum(['ok', 'failed', 'not_available', 'needs_user_action']),
  skill: skillRefSchema.nullable().catch(null),
  items: z.array(z.object({ skill_id: z.string(), name: z.string(), description: z.string().catch(''), source: z.string().catch('') })).optional(),
  excerpt: z.object({ description: z.string().catch(''), required_capabilities: z.array(z.string()).catch([]) }).optional(),
  validation: z.object({ ok: z.boolean(), finding_codes: z.array(z.string()).catch([]), issues: z.array(z.object({ code: z.string() }).passthrough()).catch([]) }).optional(),
  review: z.object({
    review_digest_sha256: z.string(),
    capabilities: z.array(z.object({ ref: z.string(), kind: z.string(), status: z.string(), added: z.boolean().catch(false) })).catch([]),
    risk: z.object({ level: z.string().nullable().catch(null), raised: z.boolean().catch(false) }).catch({ level: null, raised: false }),
    conflicts: z.number().catch(0),
    validation_ok: z.boolean().catch(false),
    test_status: z.string().catch('not_available'),
    actions: z.array(z.object({ kind: z.string(), allowed: z.boolean(), reason: z.string().nullable().catch(null) })).catch([]),
  }).optional(),
  reason: z.string().nullable().catch(null),
})

export const skillAuthoringCardSchema = z.union([savedCardSchema, diffCardSchema, resultCardSchema])
export type SkillAuthoringCard = z.infer<typeof skillAuthoringCardSchema>
export type SkillSavedCard = z.infer<typeof savedCardSchema>
export type SkillDiffCard = z.infer<typeof diffCardSchema>
export type SkillResultCard = z.infer<typeof resultCardSchema>

/** The cards of one assistant message (unknown or malformed cards are dropped, never guessed). */
export function readSkillAuthoringCards(contentJson: Record<string, unknown> | null | undefined): SkillAuthoringCard[] {
  const envelope = contentJson?.skill_authoring_card
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return []
  const cards = (envelope as Record<string, unknown>).cards
  if (!Array.isArray(cards)) return []
  return cards.flatMap((card) => {
    const parsed = skillAuthoringCardSchema.safeParse(card)
    return parsed.success ? [parsed.data] : []
  })
}

const activationResponseSchema = z.object({
  data: z.object({
    acceptance: z.object({ acceptance_id: z.string(), status: z.string() }).passthrough(),
    replayed: z.boolean(),
  }),
})

/**
 * The user's explicit activation of the reviewed revision in Chat: the owner's personal installation on the chat
 * surface. The idempotency key is stable per card, so a double click is the same accepted step.
 */
export async function activateReviewedSkillRevision(input: {
  skillId: string
  revisionId: string
  reviewDigestSha256: string
  idempotencyKey: string
}) {
  const result = await gatewayRequest(
    `/api/v1/assistant/skills/${encodeURIComponent(input.skillId)}/revisions/${encodeURIComponent(input.revisionId)}/activate`,
    {
      method: 'POST',
      csrf: true,
      body: {
        expected_review_digest_sha256: input.reviewDigestSha256,
        surfaces: ['chat'],
        auto_use: 'auto',
        idempotency_key: input.idempotencyKey,
      },
      schema: activationResponseSchema,
    },
  )
  return result.data
}

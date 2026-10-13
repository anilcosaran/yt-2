import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { createMentionChip, type ComposerChip } from './composer-state'
import { ownerRefIdentityKey, ownerRefSchema, type OwnerRef } from './owner-refs'
import type { TypedComposerMenuGroup, TypedComposerMenuItem } from './use-typed-composer'

/**
 * P03-02 composer resource discovery client. Candidates come from the owners' own projections through
 * `GET /api/v1/assistant-composer/resources` with an exact owner ref (revision/version/checksum). The label is only
 * shown; identity is the ref, so a same-name, renamed or copy-pasted resource never changes what a mention points to.
 * Drafts are never offered in normal Chat (the server returns published/ready resources only).
 */

export const COMPOSER_RESOURCE_KINDS = ['avatar', 'voice', 'brand_template', 'brand_kit', 'asset', 'model', 'project'] as const
export type ComposerResourceKind = (typeof COMPOSER_RESOURCE_KINDS)[number]
export const MENTION_ROLES = ['image_reference', 'first_frame', 'style', 'avatar'] as const
export type MentionRole = (typeof MENTION_ROLES)[number]

const candidateSchema = z.object({
  resource_kind: z.enum(COMPOSER_RESOURCE_KINDS),
  ref: z.unknown(),
  display_label: z.string().min(1).max(255),
  detail: z.string().max(255).nullable().catch(null),
  supported_roles: z.array(z.enum(MENTION_ROLES)).catch([]),
  default_role: z.enum(MENTION_ROLES).nullable().catch(null),
  updated_at: z.string().nullable().catch(null),
  ambiguous_label: z.boolean().catch(false),
})

const searchResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('composer_resource_search_v1'),
    query: z.string(),
    candidates: z.array(z.unknown()).catch([]),
    unavailable_kinds: z.array(z.object({
      kind: z.enum(COMPOSER_RESOURCE_KINDS),
      reason: z.enum(['not_available', 'source_failed']),
    })).catch([]),
  }),
})

export type ComposerResourceCandidate = Omit<z.infer<typeof candidateSchema>, 'ref'> & { ref: OwnerRef }

export type ComposerResourceSearchResult = {
  query: string
  candidates: ComposerResourceCandidate[]
  failedKinds: ComposerResourceKind[]
}

export const COMPOSER_RESOURCES_QUERY_KEY = ['assistant', 'composer-resources'] as const

/**
 * Parses the server candidates. A candidate whose ref is not a valid v1 owner ref is dropped (it could not be pinned),
 * never repaired from its label.
 */
export function parseComposerResourceCandidates(raw: readonly unknown[]): ComposerResourceCandidate[] {
  const candidates: ComposerResourceCandidate[] = []
  for (const entry of raw) {
    const parsed = candidateSchema.safeParse(entry)
    if (!parsed.success) continue
    const ref = ownerRefSchema.safeParse(parsed.data.ref)
    if (!ref.success) continue
    candidates.push({ ...parsed.data, ref: ref.data })
  }
  return candidates
}

export async function searchComposerResources(
  input: { channelId: string; query: string; locale: 'tr' | 'en'; kinds?: readonly ComposerResourceKind[] },
  options: { signal?: AbortSignal } = {},
): Promise<ComposerResourceSearchResult> {
  const params = new URLSearchParams({ channel_id: input.channelId, q: input.query, locale: input.locale })
  if (input.kinds && input.kinds.length > 0) params.set('kinds', input.kinds.join(','))
  const result = await gatewayRequest(`/api/v1/assistant-composer/resources?${params.toString()}`, {
    schema: searchResponseSchema,
    signal: options.signal,
  })
  return {
    query: result.data.query,
    candidates: parseComposerResourceCandidates(result.data.candidates),
    failedKinds: result.data.unavailable_kinds.filter((entry) => entry.reason === 'source_failed').map((entry) => entry.kind),
  }
}

/**
 * The chip a candidate becomes. The mention role starts at the resource's default purpose; the v1 message carries it
 * once the contract has a `Mention.role` field (see the P03-02 delivery record).
 */
export function mentionChipFromCandidate(candidate: ComposerResourceCandidate) {
  return createMentionChip({
    ref: candidate.ref,
    label: candidate.display_label,
    resourceKind: candidate.resource_kind,
    role: candidate.default_role,
  })
}

/** Roles a chip may switch to; a role outside the candidate's supported set is never offered. */
export function mentionRoleOptions(candidate: Pick<ComposerResourceCandidate, 'supported_roles'>): MentionRole[] {
  return MENTION_ROLES.filter((role) => candidate.supported_roles.includes(role))
}

type Describe = (candidate: ComposerResourceCandidate) => string

/** Menu groups by kind, in registry order; ambiguous labels carry their distinguishing detail (K162). */
export function composerResourceMenuGroups(candidates: readonly ComposerResourceCandidate[], describe: Describe): TypedComposerMenuGroup[] {
  return COMPOSER_RESOURCE_KINDS.flatMap((kind) => {
    const items: TypedComposerMenuItem[] = candidates
      .filter((candidate) => candidate.resource_kind === kind)
      .map((candidate) => {
        const chip = mentionChipFromCandidate(candidate)
        return { id: chip.key, group: kind, label: candidate.display_label, description: describe(candidate), chip }
      })
    return items.length > 0 ? [{ id: kind, items }] : []
  })
}

/**
 * Fresh owner labels for chips after a reconnect or a rename: only a candidate with the exact same identity (same
 * revision/version/checksum) relabels a chip; a different revision of the same resource never swaps the ref.
 */
export function relabelFromCandidates(candidates: readonly ComposerResourceCandidate[]): (chip: ComposerChip) => string | null {
  const labels = new Map(candidates.map((candidate) => [ownerRefIdentityKey(candidate.ref), candidate.display_label]))
  return (chip) => (chip.kind === 'mention' ? labels.get(ownerRefIdentityKey(chip.ref)) ?? null : null)
}

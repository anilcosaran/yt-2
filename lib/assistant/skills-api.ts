'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Memory -> Skills client over the Assistant skill facade (P01B-03 mount, P01D-10 views): Hazir (catalog), Yuklu
 * (installations), Benim / Benimle paylasilan, Guncellemeler, fork, manual authoring and the owner lifecycle. Skills
 * are Assistant server data: nothing is kept in browser storage and Memory stores no skill copy. Every command sends
 * the version the user saw (CAS) and an idempotency key created once per user intent.
 */
export const skillInstallationsQueryKey = (channelId: string | null) => ['assistant', 'skill-installations', channelId] as const
export const skillCatalogQueryKey = (category: string | null) => ['assistant', 'skill-catalog', category] as const
export const skillLibraryQueryKey = (view: 'mine' | 'shared') => ['assistant', 'skills', view] as const
export const skillUpdatesQueryKey = (channelId: string | null) => ['assistant', 'skill-updates', channelId] as const
export const skillDetailQueryKey = (source: 'catalog' | 'tenant', skillId: string | null) => ['assistant', 'skill-detail', source, skillId] as const

export const SKILL_CATALOG_CATEGORIES = [
  'video', 'short_video', 'news', 'education', 'marketing', 'brand', 'research', 'script', 'image', 'workflow', 'other',
] as const
export const SKILL_MANIFEST_SURFACES = ['new_chat', 'spark_chat', 'workflow_design', 'workflow_execution'] as const
export const SKILL_ACTIVATION_SURFACES = ['chat', 'spark', 'workflow_authoring'] as const

const installScopeKindSchema = z.enum(['personal', 'channel', 'workspace'])
const ownerScopeSchema = z.enum(['platform', 'personal', 'workspace'])
const activationSurfaceSchema = z.enum(SKILL_ACTIVATION_SURFACES)
const riskSchema = z.enum(['low', 'medium', 'high']).catch('low')
const revisionStatusSchema = z.string()

export const skillIndexEntrySchema = z.object({
  skill_id: z.string(),
  skill_revision_id: z.string(),
  revision_number: z.number(),
  skill_scope: ownerScopeSchema,
  name: z.string(),
  description: z.string().catch(''),
  locale: z.string().catch(''),
  compatible_surfaces: z.array(z.string()).catch([]),
  trigger_examples: z.array(z.string()).catch([]),
  required_capabilities: z.array(z.string()).catch([]),
  risk_level: riskSchema,
  body_digest_sha256: z.string(),
  status: revisionStatusSchema,
  sunset_at: z.string().nullable().catch(null),
})

export const skillInstallationSchema = z.object({
  schema_version: z.literal('skill_installation_v1'),
  installation_id: z.string(),
  source_layer: ownerScopeSchema,
  install_scope: z.object({ kind: installScopeKindSchema, id: z.string() }),
  skill: z.object({ skill_id: z.string(), skill_revision_id: z.string(), body_digest_sha256: z.string() }),
  update_policy: z.enum(['pinned', 'security_metadata_patch_auto', 'review_diff_required']),
  activation: z.object({
    enabled: z.boolean(),
    surfaces: z.array(activationSurfaceSchema).catch([]),
    auto_use: z.enum(['auto', 'user_only']),
    activation_version: z.number(),
  }),
  status: z.enum(['installed', 'disabled', 'uninstalled']),
  created_at: z.string(),
  updated_at: z.string(),
})

const installationRuntimeSchema = z.union([
  z.object({ usable: z.literal(true) }),
  z.object({ usable: z.literal(false), reason: z.enum(['revoked', 'sunset', 'not_selectable', 'disabled']) }),
])

export const skillInstallationViewSchema = z.object({
  installation: skillInstallationSchema,
  source_layer: ownerScopeSchema,
  revision: skillIndexEntrySchema,
  runtime: installationRuntimeSchema,
})

const catalogListItemSchema = z.object({
  skill: z.object({ id: z.string(), name: z.string(), publisher_id: z.string().nullable() }),
  revision: skillIndexEntrySchema,
  catalog: z.object({
    title: z.string(),
    category: z.string(),
    locale: z.string(),
    entry_digest_sha256: z.string(),
    published_at: z.string().nullable().catch(null),
  }),
})

const catalogDetailSchema = z.object({
  skill: z.object({ id: z.string(), name: z.string(), publisher_id: z.string().nullable() }),
  current: z.object({
    revision: skillIndexEntrySchema,
    catalog: z.object({
      title: z.string(),
      category: z.string(),
      locale: z.string(),
      changelog: z.string().catch(''),
      provenance: z.object({ source_kind: z.string() }).passthrough(),
      published_at: z.string().nullable().catch(null),
    }),
  }).nullable(),
  history: z.array(z.object({
    event_kind: z.string(),
    revision_number: z.number(),
    changelog: z.string().nullable().catch(null),
    created_at: z.string(),
  })).catch([]),
})

const skillDefinitionSchema = z.object({
  id: z.string(),
  owner_scope: ownerScopeSchema,
  owner_user_id: z.string().nullable(),
  name: z.string(),
  current_revision_id: z.string().nullable(),
  latest_revision_number: z.number(),
  acl_version: z.number(),
  version: z.number(),
  updated_at: z.string(),
})

export const skillRevisionSummarySchema = z.object({
  id: z.string(),
  skill_id: z.string(),
  revision_number: z.number(),
  body_digest_sha256: z.string(),
  status: revisionStatusSchema,
  status_version: z.number(),
  authored_by_kind: z.string().catch('user'),
  created_at: z.string(),
  description: z.string().optional().catch(undefined),
})

const skillListItemSchema = z.object({
  skill: skillDefinitionSchema,
  current_revision: skillRevisionSummarySchema.nullable(),
  latest_revision: skillRevisionSummarySchema.nullable(),
})

const skillDetailSchema = z.object({
  skill: skillDefinitionSchema,
  revisions: z.array(skillRevisionSummarySchema),
  access: z.object({ read: z.boolean(), use_in_context: z.boolean(), edit: z.boolean(), owner: z.boolean() }),
})

const skillRevisionSchema = skillRevisionSummarySchema.extend({
  manifest: z.record(z.unknown()),
  body: z.string(),
  authoring: z.record(z.unknown()).catch({}),
})

const catalogDiffSchema = z.object({
  change_class: z.enum(['initial', 'metadata_only', 'behavior', 'capability_or_risk']),
  body_changed: z.boolean(),
  triggers_changed: z.boolean(),
  capabilities: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }),
  risk_level: z.object({ from: z.string().nullable(), to: z.string() }),
})

const updateItemSchema = z.object({
  installation: skillInstallationSchema,
  pinned: skillIndexEntrySchema,
  pinned_runtime: z.object({ usable: z.boolean(), reason: z.string().optional() }),
  deprecation: z.object({ sunset_at: z.string().nullable(), replacement_skill_id: z.string().nullable() }).nullable(),
  update: z.object({
    installation_id: z.string(),
    direction: z.enum(['forward', 'backward']),
    from: z.object({ skill_revision_id: z.string(), revision_number: z.number(), body_digest_sha256: z.string() }),
    to: skillIndexEntrySchema,
    diff: catalogDiffSchema,
    changelog: z.string().nullable(),
    capability_grant_required: z.array(z.string()),
    blocked: z.object({ reason: z.string() }).nullable(),
    update_digest_sha256: z.string(),
  }).nullable(),
  can_apply: z.boolean(),
})

// skill_revision_diff_v1 (S31: rendered as a readable changed-fields summary, no line-by-line viewer).
const revisionDiffSchema = z.object({
  body: z.object({
    changed: z.boolean(),
    hunks: z.array(z.object({ lines: z.array(z.object({ op: z.string() }).passthrough()).catch([]) }).passthrough()).catch([]),
    truncated: z.boolean().catch(false),
  }).passthrough(),
  manifest: z.array(z.object({
    field: z.string(),
    kind: z.enum(['scalar', 'list']).optional().catch(undefined),
    from: z.unknown().optional(),
    to: z.unknown().optional(),
    added: z.array(z.string()).optional().catch(undefined),
    removed: z.array(z.string()).optional().catch(undefined),
  }).passthrough()).catch([]),
  authoring: z.array(z.object({
    section: z.string(),
    added: z.array(z.string()).catch([]),
    removed: z.array(z.string()).catch([]),
    changed: z.array(z.string()).catch([]),
  }).passthrough()).catch([]),
  unchanged: z.boolean(),
}).passthrough()

const draftSchema = z.object({
  id: z.string(),
  skill_id: z.string(),
  base_revision_number: z.number(),
  document: z.object({ manifest: z.record(z.unknown()), body: z.string(), authoring: z.record(z.unknown()).catch({}) }),
  draft_version: z.number(),
  status: z.string(),
})

const pageSchema = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.object({ items: z.array(item), next_cursor: z.string().nullable() }) })

export type SkillIndexEntry = z.infer<typeof skillIndexEntrySchema>
export type SkillInstallation = z.infer<typeof skillInstallationSchema>
export type SkillInstallationView = z.infer<typeof skillInstallationViewSchema>
export type SkillCatalogListItem = z.infer<typeof catalogListItemSchema>
export type SkillCatalogDetail = z.infer<typeof catalogDetailSchema>
export type SkillListItem = z.infer<typeof skillListItemSchema>
export type SkillDetail = z.infer<typeof skillDetailSchema>
export type SkillRevision = z.infer<typeof skillRevisionSchema>
export type SkillRevisionSummary = z.infer<typeof skillRevisionSummarySchema>
export type SkillUpdateItem = z.infer<typeof updateItemSchema>
export type SkillRevisionDiff = z.infer<typeof revisionDiffSchema>
export type SkillDraft = z.infer<typeof draftSchema>

export type SkillManifestInput = {
  name: string
  description: string
  locale: string
  compatible_surfaces: string[]
  trigger_examples: string[]
  negative_trigger_examples: string[]
  required_capabilities: string[]
  dependencies: Array<{ skill_id: string }>
  risk_level: 'low' | 'medium' | 'high'
}

// --- reads ----------------------------------------------------------------------------------------------------------

export async function listSkillInstallations(input: { channelId: string | null }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ limit: '200' })
  if (input.channelId) params.set('channel_id', input.channelId)
  const result = await gatewayRequest(`/api/v1/assistant/skill-installations?${params.toString()}`, {
    schema: z.object({ data: z.object({ items: z.array(skillInstallationViewSchema) }) }),
    signal: options.signal,
  })
  return result.data.items
}

export async function listSkillCatalog(input: { category: string | null; after?: string | null }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ limit: '50' })
  if (input.category) params.set('category', input.category)
  if (input.after) params.set('after', input.after)
  const result = await gatewayRequest(`/api/v1/assistant/skills/catalog?${params.toString()}`, {
    schema: pageSchema(catalogListItemSchema),
    signal: options.signal,
  })
  return result.data
}

export async function getCatalogSkill(skillId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/catalog/${encodeURIComponent(skillId)}`, {
    schema: z.object({ data: catalogDetailSchema }),
    signal: options.signal,
  })
  return result.data
}

export async function listSkills(input: { view: 'mine' | 'shared'; before?: string | null }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ view: input.view, limit: '50' })
  if (input.before) params.set('before', input.before)
  const result = await gatewayRequest(`/api/v1/assistant/skills?${params.toString()}`, {
    schema: pageSchema(skillListItemSchema),
    signal: options.signal,
  })
  return result.data
}

export async function getSkill(skillId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(skillId)}`, {
    schema: z.object({ data: skillDetailSchema }),
    signal: options.signal,
  })
  return result.data
}

export async function getSkillRevision(skillId: string, revisionId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(skillId)}/revisions/${encodeURIComponent(revisionId)}`, {
    schema: z.object({ data: skillRevisionSchema }),
    signal: options.signal,
  })
  return result.data
}

export async function diffSkillRevision(skillId: string, revisionId: string, options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(skillId)}/revisions/${encodeURIComponent(revisionId)}/diff`, {
    schema: z.object({ data: revisionDiffSchema }),
    signal: options.signal,
  })
  return result.data
}

export async function listSkillUpdates(input: { channelId: string | null }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ limit: '200' })
  if (input.channelId) params.set('channel_id', input.channelId)
  const result = await gatewayRequest(`/api/v1/assistant/skill-installations/updates?${params.toString()}`, {
    schema: z.object({ data: z.object({ items: z.array(updateItemSchema) }) }),
    signal: options.signal,
  })
  return result.data.items
}

// --- commands -------------------------------------------------------------------------------------------------------

const commandSchema = z.object({ data: z.record(z.unknown()) })

export async function installSkill(input: {
  skillId: string
  revisionId: string
  bodyDigestSha256: string
  scope: { kind: 'personal' | 'channel' | 'workspace'; id?: string | null }
  surfaces: Array<(typeof SKILL_ACTIVATION_SURFACES)[number]>
  autoUse: 'auto' | 'user_only'
  updatePolicy: 'pinned' | 'security_metadata_patch_auto' | 'review_diff_required'
  idempotencyKey: string
}) {
  const result = await gatewayRequest('/api/v1/assistant/skill-installations', {
    method: 'POST',
    csrf: true,
    body: {
      skill_id: input.skillId,
      skill_revision_id: input.revisionId,
      expected_body_digest_sha256: input.bodyDigestSha256,
      scope: input.scope.kind === 'channel' ? { kind: 'channel', id: input.scope.id } : { kind: input.scope.kind },
      activation: { enabled: true, surfaces: input.surfaces, auto_use: input.autoUse },
      update_policy: input.updatePolicy,
      idempotency_key: input.idempotencyKey,
    },
    schema: commandSchema,
  })
  return result.data
}

export async function changeSkillActivation(input: { installationId: string; expectedActivationVersion: number; enabled: boolean; idempotencyKey: string }) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-installations/${encodeURIComponent(input.installationId)}`, {
    method: 'PATCH',
    csrf: true,
    body: { expected_activation_version: input.expectedActivationVersion, enabled: input.enabled, idempotency_key: input.idempotencyKey },
    schema: commandSchema,
  })
  return result.data
}

export async function uninstallSkill(input: { installationId: string; expectedActivationVersion: number; idempotencyKey: string }) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-installations/${encodeURIComponent(input.installationId)}`, {
    method: 'DELETE',
    csrf: true,
    body: { expected_activation_version: input.expectedActivationVersion, idempotency_key: input.idempotencyKey },
    schema: commandSchema,
  })
  return result.data
}

export async function applySkillUpdate(input: {
  installationId: string
  expectedActivationVersion: number
  toRevisionId: string
  bodyDigestSha256: string
  updateDigestSha256: string
  grantedCapabilities: string[]
  idempotencyKey: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-installations/${encodeURIComponent(input.installationId)}/update`, {
    method: 'POST',
    csrf: true,
    body: {
      expected_activation_version: input.expectedActivationVersion,
      to_revision_id: input.toRevisionId,
      expected_body_digest_sha256: input.bodyDigestSha256,
      expected_update_digest_sha256: input.updateDigestSha256,
      granted_capabilities: input.grantedCapabilities,
      idempotency_key: input.idempotencyKey,
    },
    schema: commandSchema,
  })
  return result.data
}

export async function forkSkill(input: { skillId: string; revisionId: string; bodyDigestSha256: string; idempotencyKey: string }) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(input.skillId)}/forks`, {
    method: 'POST',
    csrf: true,
    body: { revision_id: input.revisionId, expected_body_digest_sha256: input.bodyDigestSha256, idempotency_key: input.idempotencyKey },
    schema: commandSchema,
  })
  return result.data
}

export async function createSkill(input: { manifest: SkillManifestInput; body: string; idempotencyKey: string }) {
  const result = await gatewayRequest('/api/v1/assistant/skills', {
    method: 'POST',
    csrf: true,
    body: { manifest: input.manifest, body: input.body, idempotency_key: input.idempotencyKey },
    schema: z.object({ data: z.object({ skill: skillDefinitionSchema, revision: skillRevisionSummarySchema.passthrough() }).passthrough() }),
  })
  return result.data
}

export async function transitionSkillRevision(input: {
  skillId: string
  revisionId: string
  toStatus: 'draft' | 'validating' | 'testable' | 'private' | 'workspace' | 'deprecated'
  expectedStatusVersion: number
  idempotencyKey: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(input.skillId)}/revisions/${encodeURIComponent(input.revisionId)}/status`, {
    method: 'POST',
    csrf: true,
    body: { to_status: input.toStatus, expected_status_version: input.expectedStatusVersion, idempotency_key: input.idempotencyKey },
    schema: z.object({ data: z.object({ revision: skillRevisionSummarySchema.passthrough() }).passthrough() }),
  })
  return result.data
}

export async function deleteSkill(input: { skillId: string; expectedVersion: number; idempotencyKey: string }) {
  const result = await gatewayRequest(`/api/v1/assistant/skills/${encodeURIComponent(input.skillId)}`, {
    method: 'DELETE',
    csrf: true,
    body: { expected_version: input.expectedVersion, idempotency_key: input.idempotencyKey },
    schema: commandSchema,
  })
  return result.data
}

export async function openSkillDraft(input: { skillId: string; idempotencyKey: string }) {
  const result = await gatewayRequest('/api/v1/assistant/skill-drafts', {
    method: 'POST',
    csrf: true,
    body: { skill_id: input.skillId, idempotency_key: input.idempotencyKey },
    schema: z.object({ data: z.object({ draft: draftSchema }).passthrough() }),
  })
  return result.data.draft
}

export async function autosaveSkillDraft(input: { draftId: string; expectedDraftVersion: number; manifest: Record<string, unknown>; body: string; authoring: Record<string, unknown> }) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-drafts/${encodeURIComponent(input.draftId)}`, {
    method: 'PATCH',
    csrf: true,
    body: {
      expected_draft_version: input.expectedDraftVersion,
      document: { manifest: input.manifest, body: input.body, authoring: input.authoring },
    },
    schema: z.object({ data: z.object({ draft: draftSchema }).passthrough() }),
  })
  return result.data.draft
}

export async function saveSkillDraft(input: { draftId: string; expectedDraftVersion: number; idempotencyKey: string }) {
  const result = await gatewayRequest(`/api/v1/assistant/skill-drafts/${encodeURIComponent(input.draftId)}/save`, {
    method: 'POST',
    csrf: true,
    body: { expected_draft_version: input.expectedDraftVersion, idempotency_key: input.idempotencyKey },
    schema: z.object({ data: z.object({ revision: skillRevisionSummarySchema.passthrough(), created: z.boolean() }).passthrough() }),
  })
  return result.data
}

export async function discardSkillDraft(input: { draftId: string; expectedDraftVersion: number }) {
  await gatewayRequest(`/api/v1/assistant/skill-drafts/${encodeURIComponent(input.draftId)}/discard`, {
    method: 'POST',
    csrf: true,
    body: { expected_draft_version: input.expectedDraftVersion },
    schema: commandSchema,
  })
}

/**
 * Owner activation of a tenant skill revision: the lifecycle is draft -> validating -> testable -> private (the
 * validator and security scan gate run inside the owner). Each step sends the status_version the previous step
 * returned; a failed gate stops the chain and reports the owner's error.
 */
export async function activateSkillRevision(input: {
  skillId: string
  revision: Pick<SkillRevisionSummary, 'id' | 'status' | 'status_version'>
  target: 'private' | 'workspace'
  idempotencyKey: string
}) {
  const path: Array<'validating' | 'testable' | 'private' | 'workspace'> = []
  if (input.revision.status === 'draft') path.push('validating', 'testable', input.target)
  else if (input.revision.status === 'validating') path.push('testable', input.target)
  else if (input.revision.status === 'testable') path.push(input.target)
  let statusVersion = input.revision.status_version
  let last: SkillRevisionSummary | null = null
  for (const toStatus of path) {
    const result = await transitionSkillRevision({
      skillId: input.skillId,
      revisionId: input.revision.id,
      toStatus,
      expectedStatusVersion: statusVersion,
      idempotencyKey: `${input.idempotencyKey}:${toStatus}`,
    })
    last = result.revision
    statusVersion = result.revision.status_version
  }
  return last
}

export function createSkillIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

/** Lines of a textarea -> trimmed, non-empty list (examples). */
export function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

/** Comma/line separated capability refs -> unique list. */
export function splitCapabilities(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)))
}

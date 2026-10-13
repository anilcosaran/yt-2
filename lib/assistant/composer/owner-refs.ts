import { z } from 'zod'

/**
 * P03-01: typed owner refs the shared composer carries, mirrored from
 * `contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json` (P00-03). A ref is the identity of a chip:
 * the display label never is. Every field name and pattern follows the contract; the contract reader
 * (`lib/contracts/agentic-spark/generated`) is the conformance check in the tests.
 */

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256 = /^[a-f0-9]{64}$/
const MODEL_ID = /^[A-Za-z0-9._:-]{1,128}$/
const CAPABILITY_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
const CONNECTOR_TOOL_NAME = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/

export const OWNER_BCS = [
  'assistant', 'avatar', 'billing', 'brand', 'composition', 'connector',
  'memory', 'provider', 'review', 'storage', 'voice', 'workflow',
] as const
export type OwnerBc = (typeof OWNER_BCS)[number]

const opaqueId = z.string().regex(OPAQUE_ID)
const sha256 = z.string().regex(SHA256)
const version = z.number().int().min(0)
const capabilityKey = z.string().max(128).regex(CAPABILITY_KEY)

export const skillRevisionRefSchema = z.object({
  ref_type: z.literal('skill_revision'),
  skill_id: opaqueId,
  skill_revision_id: opaqueId,
  skill_scope: z.enum(['system_internal', 'platform', 'workspace', 'personal']),
  body_digest_sha256: sha256,
}).strict()

export const capabilityRefSchema = z.object({
  ref_type: z.literal('capability'),
  capability_key: capabilityKey,
  owner_bc: z.enum(OWNER_BCS),
  capability_revision: opaqueId.optional(),
}).strict()

export const connectorToolRefSchema = z.object({
  ref_type: z.literal('connector_tool'),
  connector_definition_id: opaqueId,
  tool_name: z.string().max(128).regex(CONNECTOR_TOOL_NAME),
  tool_revision_id: opaqueId,
}).strict()

export const connectedAccountRefSchema = z.object({
  ref_type: z.literal('connected_account'),
  connector_definition_id: opaqueId,
  connection_id: opaqueId,
  connection_revision: version,
}).strict()

export const brandRevisionRefSchema = z.object({
  ref_type: z.literal('brand_revision'),
  brand_asset_kind: z.enum(['kit', 'element', 'template', 'motion']),
  brand_asset_id: opaqueId,
  brand_revision_id: opaqueId,
  brand_revision_digest_sha256: sha256,
}).strict()

export const storageObjectRefSchema = z.object({
  ref_type: z.literal('storage_object'),
  storage_object_id: opaqueId,
  checksum_sha256: sha256,
  media_kind: z.enum(['video', 'image', 'audio', 'document', 'other']).optional(),
  byte_size: z.number().int().min(0).optional(),
}).strict()

export const modelCatalogRefSchema = z.object({
  ref_type: z.literal('model_catalog'),
  model_id: z.string().regex(MODEL_ID),
  model_catalog_revision: opaqueId,
  capability_key: capabilityKey,
  capability_revision: opaqueId,
}).strict()

const snapshotPair = <T extends { execution_snapshot_id?: string; execution_snapshot_sha256?: string }>(value: T) =>
  (value.execution_snapshot_id === undefined) === (value.execution_snapshot_sha256 === undefined)

export const avatarRefSchema = z.object({
  ref_type: z.literal('avatar'),
  avatar_id: opaqueId,
  avatar_version: version,
  execution_snapshot_id: opaqueId.optional(),
  execution_snapshot_sha256: sha256.optional(),
}).strict().refine(snapshotPair, 'execution_snapshot_id and execution_snapshot_sha256 go together')

export const voiceProfileRefSchema = z.object({
  ref_type: z.literal('voice_profile'),
  voice_profile_id: opaqueId,
  voice_profile_version: version,
  execution_snapshot_id: opaqueId.optional(),
  execution_snapshot_sha256: sha256.optional(),
}).strict().refine(snapshotPair, 'execution_snapshot_id and execution_snapshot_sha256 go together')

export const ownerRefSchema = z.union([
  skillRevisionRefSchema,
  capabilityRefSchema,
  connectorToolRefSchema,
  connectedAccountRefSchema,
  brandRevisionRefSchema,
  storageObjectRefSchema,
  modelCatalogRefSchema,
  avatarRefSchema,
  voiceProfileRefSchema,
])

export const invocationTargetRefSchema = z.union([capabilityRefSchema, connectorToolRefSchema])

export type SkillRevisionRef = z.infer<typeof skillRevisionRefSchema>
export type CapabilityRef = z.infer<typeof capabilityRefSchema>
export type ConnectorToolRef = z.infer<typeof connectorToolRefSchema>
export type ConnectedAccountRef = z.infer<typeof connectedAccountRefSchema>
export type BrandRevisionRef = z.infer<typeof brandRevisionRefSchema>
export type StorageObjectRef = z.infer<typeof storageObjectRefSchema>
export type ModelCatalogRef = z.infer<typeof modelCatalogRefSchema>
export type AvatarRef = z.infer<typeof avatarRefSchema>
export type VoiceProfileRef = z.infer<typeof voiceProfileRefSchema>
export type OwnerRef = z.infer<typeof ownerRefSchema>
export type InvocationTargetRef = z.infer<typeof invocationTargetRefSchema>

export function isCapabilityKey(value: string): boolean {
  return value.length <= 128 && CAPABILITY_KEY.test(value)
}

export function isOpaqueId(value: string): boolean {
  return OPAQUE_ID.test(value)
}

export function isSha256(value: string): boolean {
  return SHA256.test(value)
}

export function isModelId(value: string): boolean {
  return MODEL_ID.test(value)
}

/**
 * Deterministic identity of an owner ref: ids, revision and digest, never a label. Two chips with the same key are
 * the same resource revision, so a rename, a same-name resource or a copy/paste never changes (or merges) identity.
 */
export function ownerRefIdentityKey(ref: OwnerRef): string {
  switch (ref.ref_type) {
    case 'skill_revision':
      return `skill_revision:${ref.skill_id}@${ref.skill_revision_id}#${ref.body_digest_sha256}`
    case 'capability':
      return `capability:${ref.owner_bc}:${ref.capability_key}@${ref.capability_revision ?? '-'}`
    case 'connector_tool':
      return `connector_tool:${ref.connector_definition_id}:${ref.tool_name}@${ref.tool_revision_id}`
    case 'connected_account':
      return `connected_account:${ref.connector_definition_id}:${ref.connection_id}@${ref.connection_revision}`
    case 'brand_revision':
      return `brand_revision:${ref.brand_asset_kind}:${ref.brand_asset_id}@${ref.brand_revision_id}#${ref.brand_revision_digest_sha256}`
    case 'storage_object':
      return `storage_object:${ref.storage_object_id}#${ref.checksum_sha256}`
    case 'model_catalog':
      return `model_catalog:${ref.model_id}@${ref.model_catalog_revision}/${ref.capability_key}@${ref.capability_revision}`
    case 'avatar':
      return `avatar:${ref.avatar_id}@${ref.avatar_version}${ref.execution_snapshot_id ? `/${ref.execution_snapshot_id}` : ''}`
    case 'voice_profile':
      return `voice_profile:${ref.voice_profile_id}@${ref.voice_profile_version}${ref.execution_snapshot_id ? `/${ref.execution_snapshot_id}` : ''}`
  }
}

/**
 * Owner identity without the revision: the same avatar/template/asset across revisions. Used only to find the
 * current display label of a chip after a reconnect or a rename (identity keeps its exact revision).
 */
export function ownerRefResourceKey(ref: OwnerRef): string {
  switch (ref.ref_type) {
    case 'skill_revision':
      return `skill:${ref.skill_id}`
    case 'capability':
      return `capability:${ref.owner_bc}:${ref.capability_key}`
    case 'connector_tool':
      return `connector_tool:${ref.connector_definition_id}:${ref.tool_name}`
    case 'connected_account':
      return `connected_account:${ref.connector_definition_id}:${ref.connection_id}`
    case 'brand_revision':
      return `brand:${ref.brand_asset_kind}:${ref.brand_asset_id}`
    case 'storage_object':
      return `storage_object:${ref.storage_object_id}`
    case 'model_catalog':
      return `model:${ref.model_id}:${ref.capability_key}`
    case 'avatar':
      return `avatar:${ref.avatar_id}`
    case 'voice_profile':
      return `voice_profile:${ref.voice_profile_id}`
  }
}

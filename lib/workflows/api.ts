'use client'

import { normalizeViralClipsParams } from '@/lib/workflows/viral-clips-params'


import { z } from 'zod'
import { toPublicRuntimeError } from '@/lib/public-runtime-error'
import { publicCatalogText, publicRequestedModelId, publicModelLabel, publicWorkflowByline, sanitizePublicMetadata } from '@/lib/public-model-display'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { isAuthClientError, parseAuthErrorResponse } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'
import {
  ClientMutationAttemptStore,
  isAmbiguousMutationError,
  stableClientFingerprint,
} from '@/lib/idempotency/client-mutation-control'
import type {
  Workflow,
  WorkflowDefinitionEdge,
  WorkflowDefinitionNode,
  WorkflowNodePort,
  WorkflowNodePortType,
  WorkflowRunStatus,
  WorkflowStatus,
} from '@/lib/types'
import {
  getWorkflowNodeDescription,
  getWorkflowNodeProvider,
  getWorkflowNodeSubtitle,
  getWorkflowNodeTitle,
} from '@/lib/workflows/node-display'
import { parseMediaDownloaderVideoUrl } from '@/lib/workflows/media-downloader-quote'
import { workflowNodeOutputReadyField } from '@/lib/workflows/node-output-ready'
import { assistantComposerCatalogDataSchema } from '@/lib/assistant/api'

export const WORKFLOWS_QUERY_KEY = ['workflows'] as const
export const WORKFLOW_DEFINITIONS_QUERY_KEY = [...WORKFLOWS_QUERY_KEY, 'definitions'] as const
export const WORKFLOW_NODE_CATALOG_QUERY_KEY = [...WORKFLOWS_QUERY_KEY, 'node-catalog'] as const
export const MEDIA_TRANSCRIPTS_QUERY_KEY = [...WORKFLOWS_QUERY_KEY, 'media-transcripts'] as const

type WorkflowLifecycleIntent = { workflowId: string; action: 'resume' | 'retry' }
const workflowLifecycleAttemptStore = new ClientMutationAttemptStore<WorkflowLifecycleIntent>({
  storageKey: 'youtorch:workflow-lifecycle-attempts:v1',
  isPayload: (value): value is WorkflowLifecycleIntent => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<WorkflowLifecycleIntent>
    return typeof candidate.workflowId === 'string'
      && (candidate.action === 'resume' || candidate.action === 'retry')
  },
})

export function mediaTranscriptsQueryKey(channelId: string, sourceObjectId: string) {
  return [...MEDIA_TRANSCRIPTS_QUERY_KEY, channelId, sourceObjectId] as const
}

export function workflowDefinitionsQueryKey(
  channelId: string | null | undefined,
  input: { status?: WorkflowDefinitionStatus | null; limit?: number; offset?: number } = {},
) {
  return [
    ...WORKFLOW_DEFINITIONS_QUERY_KEY,
    channelId ?? 'none',
    input.status ?? 'all',
    input.limit ?? 20,
    input.offset ?? 0,
  ] as const
}

const workflowDefinitionStatusSchema = z.enum(['draft', 'active', 'archived'])

const isoDateStringSchema = z.string().or(z.date()).transform((value) =>
  value instanceof Date ? value.toISOString() : value
)

const workflowDefinitionBaseSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  project_id: z.string().nullable().catch(null),
  name: z.string(),
  status: workflowDefinitionStatusSchema,
  current_draft_revision_id: z.string().nullable().catch(null),
  current_published_revision_id: z.string().nullable().catch(null),
  created_by: z.string().nullable().catch(null),
  version: z.number().optional().catch(undefined),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
  deleted_at: isoDateStringSchema.nullable().optional().catch(null),
})

const workflowDefinitionRevisionSchema = z.object({
  id: z.string(),
  definition_id: z.string(),
  channel_id: z.string(),
  revision_no: z.number().catch(0),
  status: z.enum(['draft', 'published', 'archived']),
  source_revision_id: z.string().nullable().catch(null),
  patch_source: z.string().nullable().catch(null),
  dsl_version: z.string().catch('2'),
  dsl_json: z.record(z.unknown()).catch({}),
  dsl_hash: z.string().catch(''),
  layout_json: z.record(z.unknown()).catch({}),
  meta_json: z.record(z.unknown()).catch({}),
  node_catalog_snapshot: z.record(z.unknown()).catch({}),
  estimate_id: z.string().nullable().catch(null),
  published_at: isoDateStringSchema.nullable().catch(null),
  created_by: z.string().nullable().catch(null),
  version: z.number().optional().catch(undefined),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
})

const workflowEstimateNodeSchema = z.object({
  node_key: z.string().catch(''),
  node_type: z.string().catch(''),
  estimated_credits: z.number().catch(0),
  balance_needed: z.number().catch(0),
  quota_applied: z.number().catch(0),
  currency_unit: z.string().catch('credits'),
  pricing_snapshot_hash: z.string().nullable().optional().catch(null),
  warnings: z.array(z.string()).optional().catch([]),
}).strip()

const viralClipsQuotaSchema = z.object({
  quota_key: z.literal('workflow:monthly_viral_clips'),
  remaining_clips: z.number().int().min(1),
  max_clips_this_run: z.number().int().min(1).max(10),
  limited: z.boolean(),
}).strip()

const workflowEstimateSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  project_id: z.string().nullable().catch(null),
  definition_id: z.string().nullable().catch(null),
  revision_id: z.string().nullable().catch(null),
  workflow_id: z.string().nullable().catch(null),
  dsl_hash: z.string().catch(''),
  input_hash: z.string().catch(''),
  status: z.enum(['quoted', 'locked', 'used', 'expired', 'stale', 'superseded']).catch('quoted'),
  source: z.string().catch('revision'),
  total_estimated_credits: z.number().catch(0),
  total_balance_needed: z.number().catch(0),
  total_quota_applied: z.number().catch(0),
  currency_unit: z.string().catch('credits'),
  expires_at: isoDateStringSchema,
  stale_reason: z.string().nullable().catch(null),
  superseded_by_estimate_id: z.string().nullable().catch(null),
  created_by: z.string().nullable().catch(null),
  created_at: isoDateStringSchema,
  nodes: z.array(workflowEstimateNodeSchema).catch([]),
  viral_clips_quota: viralClipsQuotaSchema.optional().catch(undefined),
}).strip()

const workflowRunProjectionSchema = z.object({
  queue_reason: z.string().nullable().optional().catch(null),
  queue_active_count: z.number().int().nonnegative().optional().catch(undefined),
  queue_reserved_count: z.number().int().nonnegative().optional().catch(undefined),
  queue_waiting_count: z.number().int().nonnegative().optional().catch(undefined),
  queue_concurrency_limit: z.number().int().positive().optional().catch(undefined),
  queued_since: z.string().nullable().optional().catch(null),
  first_node_started_at: z.string().nullable().optional().catch(null),
  id: z.string(),
  channel_id: z.string(),
  project_id: z.string().nullable().catch(null),
  definition_id: z.string().nullable().catch(null),
  revision_id: z.string().nullable().catch(null),
  estimate_id: z.string().nullable().catch(null),
  execution_snapshot_id: z.string().nullable().optional().catch(null),
  workflow_id: z.string(),
  status: z.string().catch('running'),
  metadata: z.object({
    parked: z.boolean().optional().catch(undefined),
    park_weight: z.number().optional().catch(undefined),
    admission_decision: z.string().optional().catch(undefined),
    park_state: z.string().optional().catch(undefined),
    park_expires_at: z.string().optional().catch(undefined),
    queue_position: z.number().optional().catch(undefined),
  }).strip().optional().catch(undefined),
  admission: z.object({
    decision: z.enum(['admitted', 'parked']).optional().catch(undefined),
    state: z.enum(['live_wait', 'parked', 'failed_balance']).optional().catch(undefined),
    park_expires_at: z.string().nullable().optional().catch(null),
    queue_position: z.number().nullable().optional().catch(null),
    retryable: z.boolean().optional().catch(undefined),
  }).strip().optional().catch(undefined),
  error_message: z.string().nullable().optional().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null).optional(),
  idempotency_key: z.string().nullable().catch(null),
  total_estimated_credits: z.number().catch(0),
  total_actual_credits: z.number().optional().catch(0),
  started_at: isoDateStringSchema.nullable().optional().catch(null),
  completed_at: isoDateStringSchema.nullable().optional().catch(null),
  created_by: z.string().nullable().optional().catch(null),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema.optional().catch(undefined),
  viral_clips_quota: viralClipsQuotaSchema.optional().catch(undefined),
}).strip()

const workflowEstimateResponseSchema = z.object({
  data: workflowEstimateSchema,
})

const workflowRunProjectionResponseSchema = z.object({
  data: workflowRunProjectionSchema,
})

const workflowRunProjectionListResponseSchema = z.object({
  data: z.array(workflowRunProjectionSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(20),
    offset: z.number().catch(0),
    hasMore: z.boolean().catch(false),
  }),
})

export const workflowDefinitionSchema = workflowDefinitionBaseSchema.extend({
  last_run: workflowRunProjectionSchema.nullable().optional().catch(null),
})

const workflowDefinitionDetailPayloadSchema = z.object({
  definition: workflowDefinitionSchema,
  revisions: z.array(workflowDefinitionRevisionSchema).catch([]),
}).or(
  workflowDefinitionSchema.extend({
    revisions: z.array(workflowDefinitionRevisionSchema).catch([]),
  }).transform((value) => {
    const { revisions, ...definition } = value
    return { definition, revisions }
  })
)

const workflowDefinitionListResponseSchema = z.object({
  data: z.array(workflowDefinitionSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(20),
    offset: z.number().catch(0),
    hasMore: z.boolean().catch(false),
  }),
})

const workflowDefinitionDetailResponseSchema = z.object({
  data: workflowDefinitionDetailPayloadSchema,
})

const workflowDefinitionMutationResponseSchema = z.object({
  data: workflowDefinitionSchema,
})

const workflowDefinitionCreateResponseSchema = z.object({
  data: workflowDefinitionDetailPayloadSchema,
})

const workflowDefinitionRevisionMutationResponseSchema = z.object({
  data: workflowDefinitionRevisionSchema,
})

const workflowLifecycleResponseSchema = z.object({
  data: z.object({
    workflow_id: z.string(),
    cancelled: z.boolean().optional().catch(undefined),
    cancel_requested: z.boolean().optional().catch(undefined),
    accepted: z.boolean().optional().catch(undefined),
    current_status: z.string().optional().catch(undefined),
    message: z.string().nullable().optional().catch(null),
    resumed: z.boolean().optional().catch(undefined),
  }).strip(),
})

const workflowRetryResponseSchema = z.object({
  data: z.object({
    original_workflow_id: z.string().catch(''),
    workflow_id: z.string(),
    total_credits_estimated: z.number().catch(0),
    retried: z.boolean().catch(true),
  }).strip(),
})

const workflowRunCostNodeSchema = z.object({
  node_key: z.string().catch(''),
  node_type: z.string().nullable().catch(null),
  estimated_credits: z.number().catch(0),
  reserved_credits: z.number().catch(0),
  actual_credits: z.number().catch(0),
  refunded_credits: z.number().catch(0),
  debt_credits: z.number().catch(0),
  drift_credits: z.number().catch(0),
  status: z.string().catch('unknown'),
}).strip()

const workflowRunCostSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  status: z.string().catch('unknown'),
  estimated_credits: z.number().catch(0),
  reserved_credits: z.number().catch(0),
  charged_credits: z.number().catch(0),
  refunded_credits: z.number().catch(0),
  debt_credits: z.number().catch(0),
  drift_credits: z.number().catch(0),
  currency_unit: z.string().catch('credits'),
  nodes: z.array(workflowRunCostNodeSchema).catch([]),
}).strip()

const workflowRunCostResponseSchema = z.object({
  data: workflowRunCostSchema,
})

const workflowNodeCatalogPortSchema = z.object({
  name: z.string().catch(''),
  type: z.string().catch('any'),
  required: z.boolean().catch(false),
  default: z.unknown().optional(),
  description: z.string().catch(''),
  min_value: z.number().nullable().optional().catch(null),
  max_value: z.number().nullable().optional().catch(null),
  allowed_values: z.array(z.unknown()).nullable().optional().catch(null),
  mime_types: z.array(z.string()).nullable().optional().catch(null),
  max_duration: z.number().nullable().optional().catch(null),
  max_size_mb: z.number().nullable().optional().catch(null),
  form_role: z.string().nullable().optional().catch(null),
}).passthrough()

const workflowNodeFormFieldBindingSchema = z.object({
  name: z.string().catch(''),
  source: z.literal('node').catch('node'),
  required: z.boolean().catch(false),
  has_allowed_values: z.boolean().catch(false),
}).strip()

const workflowNodeFormContractSchema = z.object({
  standard_fields: z.record(workflowNodeFormFieldBindingSchema).catch({}),
}).catch({ standard_fields: {} })

export const workflowNodeCatalogItemSchema = z.preprocess((value) => sanitizePublicMetadata(value), z.object({
  node_type: z.string(),
  description: z.string().catch('').transform((value) => publicCatalogText(value)),
  input_schema: z.record(workflowNodeCatalogPortSchema).catch({}),
  input_classification: z.record(z.unknown()).catch({}),
  form_contract: workflowNodeFormContractSchema,
  output_schema: z.record(workflowNodeCatalogPortSchema).catch({}),
  schema_hash: z.string().catch(''),
  capability: z.string().catch(''),
  node_class: z.string().catch(''),
  cost_estimate: z.record(z.unknown()).catch({}),
  pricing_metadata: z.record(z.unknown()).catch({}),
  provider_requirement: z.record(z.unknown()).catch({}),
  runtime_requirement: z.record(z.unknown()).catch({}),
  timeout: z.record(z.unknown()).nullable().catch(null),
  retry_policy: z.record(z.unknown()).catch({}),
  artifact_output_type: z.string().catch(''),
  disabled: z.boolean().catch(false),
  maintenance: z.boolean().catch(false),
  ui_visibility: z.string().catch('hidden'),
  version: z.string().catch('1'),
  status: z.string().catch('active'),
}).strip())

const workflowNodeCatalogResponseSchema = z.object({
  data: z.object({
    nodes: z.array(workflowNodeCatalogItemSchema).catch([]),
    total: z.number().catch(0),
  }).strip(),
})

const workflowWorkspaceBootstrapResponseSchema = z.object({
  data: z.object({
    definitions: z.array(workflowDefinitionSchema).catch([]),
    definitions_meta: z.object({
      total: z.number().catch(0),
      limit: z.number().catch(100),
      offset: z.number().catch(0),
      hasMore: z.boolean().catch(false),
    }),
    node_catalog: z.object({
      nodes: z.array(workflowNodeCatalogItemSchema).catch([]),
      total: z.number().catch(0),
    }).nullable(),
    composer_catalog: assistantComposerCatalogDataSchema.nullable(),
    degraded_sources: z.array(z.string()).catch([]),
  }),
})

const workflowNodeOutputSchema = z.object({
  nodeKey: z.string().catch(''),
  nodeType: z.string().catch(''),
  status: z.string().catch('unknown'),
  outputData: z.unknown(),
  outputHash: z.string().catch(''),
  creditsCharged: z.number().catch(0),
  createdAt: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
}).strip()

const workflowOutputSchema = z.object({
  workflowId: z.string().catch(''),
  outputs: z.array(workflowNodeOutputSchema).catch([]),
  finalOutput: workflowNodeOutputSchema.nullable().catch(null),
  finalOutputs: z.array(workflowNodeOutputSchema).catch([]),
}).strip()

const workflowOutputResponseSchema = z.object({
  data: workflowOutputSchema,
})

// Public Media Downloader quote contract. Preserve it without passing through
// private supplier, transport or pricing fields from the response.
const mediaDownloaderQuoteSnapshotSchema = z.object({
  snapshot_id: z.string(),
  fingerprint: z.string(),
  expires_at: isoDateStringSchema,
  selected_variant_id: z.string(),
  displayed_estimated_credits: z.number(),
  variants: z.array(z.object({
    variant_id: z.string(),
    download_variant: z.enum(['video_with_audio', 'video_only', 'audio_only', 'metadata_only']),
    resolution: z.number().nullable(),
    container: z.string(),
    estimated_media_bytes: z.number(),
    estimated_credits: z.number(),
    estimate_kind: z.string(),
  }).strip()),
  metadata: z.object({
    title: z.string().nullable().optional(),
    thumbnail_url: z.string().nullable().optional(),
    duration_seconds: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  }).strip().optional(),
}).strip()

const workflowAdmissionSchema = z.object({
  decision: z.enum(['admitted', 'parked']),
  state: z.enum(['live_wait', 'parked', 'failed_balance']),
  park_expires_at: z.string().nullable(),
  queue_position: z.number().int().nonnegative().nullable(),
  retryable: z.boolean(),
}).strip()

const workflowAgentLaunchSchema = z.object({
  agent_id: z.string(),
  admission: workflowAdmissionSchema.optional(),
  total_credits_estimated: z.number().catch(0),
  ephemeral_estimate_snapshot: z.record(z.unknown()).optional().catch(undefined),
  quote_snapshot: mediaDownloaderQuoteSnapshotSchema.optional(),
  viral_clips_quota: viralClipsQuotaSchema.optional().catch(undefined),
}).strip()

const workflowAgentEstimateSchema = z.object({
  node_type: z.string().catch(''),
  total_credits_estimated: z.number().catch(0),
  ephemeral_estimate_snapshot: z.record(z.unknown()).optional().catch(undefined),
  quote_snapshot: mediaDownloaderQuoteSnapshotSchema.optional(),
  viral_clips_quota: viralClipsQuotaSchema.optional().catch(undefined),
  // LAT-04 / Y11: sent back with the launch; a matching unexpired quote skips the second server validation.
  launch_quote: z.object({
    quote_id: z.string().regex(/^wvq_[a-f0-9]{48}$/),
    expires_at: z.string(),
  }).optional().catch(undefined),
}).strip()

/** LAT-04: the launch quote of an estimate while it stays valid for at least `marginMs` more. */
export function validWorkflowAgentLaunchQuote(
  estimate: { launch_quote?: { quote_id: string; expires_at: string } } | null | undefined,
  nowMs: number = Date.now(),
  marginMs = 15_000,
): { quote_id: string; expires_at: string } | null {
  const quote = estimate?.launch_quote
  if (!quote) return null
  const expiresAtMs = Date.parse(quote.expires_at)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs - nowMs <= marginMs) return null
  return quote
}

const workflowAgentStatusNodeSchema = z.object({
  pricingSource: z.enum(['explicit_free', 'provider_model_rule', 'declared_flat', 'node_calculator', 'runtime_profile']).nullable().optional().catch(null),
  finalPolicy: z.enum(['provider_rule_actual', 'contract_rate_actual_units', 'locked_estimate', 'node_reported']).nullable().optional().catch(null),
  queueReason: z.string().nullable().optional().catch(null),
  queueActiveCount: z.number().int().nonnegative().optional().catch(undefined),
  queueReservedCount: z.number().int().nonnegative().optional().catch(undefined),
  queueWaitingCount: z.number().int().nonnegative().optional().catch(undefined),
  queueConcurrencyLimit: z.number().int().positive().optional().catch(undefined),
  queuedSince: z.string().nullable().optional().catch(null),
  firstNodeStartedAt: z.string().nullable().optional().catch(null),
  nodeKey: z.string().catch(''),
  nodeType: z.string().catch(''),
  status: z.string().catch('unknown'),
  creditsCharged: z.number().catch(0),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  // GEN-04: the node's result is already stored while the node/run is still finishing.
  outputReady: workflowNodeOutputReadyField,
}).strip()

const workflowCreditReservationSchema = z.object({
  id: z.string(),
  estimatedCredits: z.number().catch(0),
  reservedCredits: z.number().catch(0),
  spentCredits: z.number().catch(0),
  refundableCredits: z.number().catch(0),
  refundedCredits: z.number().catch(0),
  waivedDebtCredits: z.number().catch(0),
  netChargedCredits: z.number().catch(0),
  debtCredits: z.number().catch(0),
  status: z.string().catch('unknown'),
  updatedAt: z.string().catch(''),
}).strip()

const workflowAgentStatusSchema = z.object({
  deliveryStatus: z.literal('payment_review').optional(),
  // LAT-01 three-field status (gateway WORKFLOW_STATUS_THREE_FIELD_ENABLED); absent from older gateways.
  runtimeTerminal: z.boolean().optional().catch(undefined),
  financeSettlement: z.enum(['pending', 'settled', 'attention']).optional().catch(undefined),
  artifactDelivery: z.enum(['pending', 'ready', 'held', 'none']).optional().catch(undefined),
  outputReady: z.boolean().optional().catch(undefined),
  admission: workflowAdmissionSchema.optional(),
  pausedReason: z.string().nullable().optional(),
  currentNodeKey: z.string().nullable().optional(),
  queueReason: z.string().nullable().optional().catch(null),
  queueActiveCount: z.number().int().nonnegative().optional().catch(undefined),
  queueReservedCount: z.number().int().nonnegative().optional().catch(undefined),
  queueWaitingCount: z.number().int().nonnegative().optional().catch(undefined),
  queueConcurrencyLimit: z.number().int().positive().optional().catch(undefined),
  queuedSince: z.string().nullable().optional().catch(null),
  firstNodeStartedAt: z.string().nullable().optional().catch(null),
  workflowId: z.string().catch(''),
  status: z.string().catch('unknown'),
  stage: z.string().nullable().optional().catch(null),
  progress: z.number().catch(0),
  totalCreditsEstimated: z.number().catch(0),
  totalCreditsCharged: z.number().catch(0),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  runType: z.string().optional().catch(undefined),
  invocationSource: z.string().optional().catch(undefined),
  cancelMode: z.string().nullable().optional().catch(null),
  cancelRequestedAt: z.string().nullable().optional().catch(null),
  settlementStatus: z.string().optional().catch(undefined),
  settlementPendingReason: z.string().nullable().optional().catch(null),
  creditReservation: workflowCreditReservationSchema.nullable().optional().catch(null),
  nodes: z.array(workflowAgentStatusNodeSchema).catch([]),
}).strip()

const workflowAgentOutputSchema = z.object({
  agentId: z.string().catch(''),
  status: z.string().catch('unknown'),
  nodeKey: z.string().catch(''),
  nodeType: z.string().catch(''),
  output: z.unknown().nullable().catch(null),
  outputHash: z.string().nullable().catch(null),
  creditsCharged: z.number().catch(0),
  createdAt: z.string().nullable().catch(null),
  message: z.string().optional().catch(undefined),
}).strip()

const recentWorkflowOutputMediaSchema = z.object({
  kind: z.string().catch('data'),
  downloadId: z.string().nullable().catch(null),
  url: z.string().nullable().catch(null),
  previewUrl: z.string().nullable().catch(null),
  downloadUrl: z.string().nullable().catch(null),
  storageObjectId: z.string().nullable().catch(null),
  sourceUrl: z.string().nullable().catch(null),
  fileName: z.string().nullable().catch(null),
  mimeType: z.string().nullable().catch(null),
  sizeBytes: z.number().nonnegative().nullable().catch(null),
  durationSeconds: z.number().nonnegative().nullable().catch(null),
  downloadElapsedSeconds: z.number().nonnegative().nullable().catch(null),
  processingElapsedSeconds: z.number().nonnegative().nullable().catch(null),
  creditsCharged: z.number().nonnegative().nullable().catch(null),
  storageStatus: z.string().nullable().catch(null),
  workflowReady: z.boolean().nullable().catch(null),
  title: z.string().nullable().catch(null),
  cta: z.string().nullable().catch(null),
  socialCaption: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  hashtags: z.array(z.string()).max(5).catch([]),
  titleAlternatives: z.array(z.string()).max(2).catch([]),
  captionAlternatives: z.array(z.string()).max(2).catch([]),
  tone: z.string().nullable().catch(null),
  viralPotentialScore: z.number().min(0).max(100).nullable().catch(null),
  editorialSummary: z.string().nullable().catch(null),
  selectionReason: z.string().nullable().catch(null),
}).strip()

/** One run history item of the tools workspace (also parses LLM-03 fast-lane runs, which use the same field names). */
export const recentWorkflowOutputItemSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  const requestedModelId = publicRequestedModelId(record)
  return requestedModelId ? {
    ...record,
    modelId: requestedModelId,
    modelLabel: record.modelId === requestedModelId ? record.modelLabel : publicModelLabel(requestedModelId),
  } : value
}, z.object({
  deliveryStatus: z.literal('payment_review').optional(),
  queueReason: z.string().nullable().optional().catch(null),
  queueActiveCount: z.number().int().nonnegative().optional().catch(undefined),
  queueReservedCount: z.number().int().nonnegative().optional().catch(undefined),
  queueWaitingCount: z.number().int().nonnegative().optional().catch(undefined),
  queueConcurrencyLimit: z.number().int().positive().optional().catch(undefined),
  queuedSince: z.string().nullable().optional().catch(null),
  firstNodeStartedAt: z.string().nullable().optional().catch(null),
  id: z.string().catch(''),
  workflowId: z.string().catch(''),
  agentId: z.string().catch(''),
  nodeKey: z.string().catch(''),
  nodeType: z.string().catch(''),
  status: z.string().catch('unknown'),
  prompt: z.string().nullable().catch(null),
  sourceUrls: z.array(z.string()).max(10).catch([]),
  modelLabel: z.string().nullable().catch(null).transform((value) => value ? publicModelLabel(value) : null),
  modelId: z.string().nullable().catch(null),
  provider: z.string().nullable().catch(null).transform((): string | null => null),
  totalCreditsEstimated: z.number().catch(0),
  totalCreditsCharged: z.number().catch(0),
  nodeCreditsCharged: z.number().catch(0),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  outputHash: z.string().nullable().catch(null),
  reportMarkdown: z.string().nullable().optional().catch(null),
  outputFormat: z.string().nullable().optional().catch(null),
  outputPreview: z.unknown().nullable().catch(null),
  media: z.array(recentWorkflowOutputMediaSchema).catch([]),
  createdAt: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
  completedAt: z.string().nullable().catch(null),
}).strip())

const workflowAgentCancelSchema = z.object({
  agent_id: z.string().catch(''),
  status: z.string().catch('unknown'),
  cancelled: z.boolean().catch(false),
  cancel_requested: z.boolean().catch(false),
  message: z.string().nullable().catch(null),
}).strip()

const workflowAgentLaunchResponseSchema = z.object({
  data: workflowAgentLaunchSchema,
})

const workflowAgentCancelResponseSchema = z.object({
  data: workflowAgentCancelSchema,
})

const workflowAgentEstimateResponseSchema = z.object({
  data: workflowAgentEstimateSchema,
})

const workflowAgentStatusResponseSchema = z.object({
  data: workflowAgentStatusSchema,
})

const workflowRuntimeStatusResponseSchema = z.object({
  data: workflowAgentStatusSchema,
})

const workflowAgentOutputResponseSchema = z.object({
  data: workflowAgentOutputSchema,
})

const recentWorkflowOutputsResponseSchema = z.object({
  data: z.object({
    items: z.array(recentWorkflowOutputItemSchema).catch([]),
    nextCursor: z.string().nullable().catch(null),
    hasMore: z.boolean().catch(false),
    limit: z.number().catch(20),
  }).strip(),
})

const mediaTranscriptArtifactSchema = z.object({
  id: z.string(),
  status: z.enum(['processing', 'ready', 'failed', 'deleting', 'deleted']),
  model_id: z.string(),
  source_language: z.string(),
  settings: z.record(z.unknown()).catch({}),
  duration_seconds: z.number().nullable().catch(null),
  failure_code: z.string().nullable().catch(null),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
  downloadable: z.boolean().catch(false),
})

const mediaTranscriptArtifactsResponseSchema = z.object({
  data: z.object({
    items: z.array(mediaTranscriptArtifactSchema).catch([]),
  }),
})

const deleteMediaTranscriptArtifactResponseSchema = z.object({
  data: z.object({
    artifact_id: z.string(),
    status: z.enum(['deleting', 'deleted']),
    retry_after_seconds: z.number().nullable().catch(null),
  }),
})

export type WorkflowDefinitionStatus = z.infer<typeof workflowDefinitionStatusSchema>
export type WorkflowDefinitionRecord = z.infer<typeof workflowDefinitionSchema>
export type WorkflowDefinitionRevision = z.infer<typeof workflowDefinitionRevisionSchema>
export type WorkflowDefinitionDetail = z.infer<typeof workflowDefinitionDetailPayloadSchema>
export type WorkflowEstimate = z.infer<typeof workflowEstimateSchema>
export type WorkflowRunProjection = z.infer<typeof workflowRunProjectionSchema>
export type WorkflowRunCost = z.infer<typeof workflowRunCostSchema>
export type WorkflowNodeCatalogItem = z.infer<typeof workflowNodeCatalogItemSchema>
export type WorkflowNodeCatalogPort = z.infer<typeof workflowNodeCatalogPortSchema>
export type WorkflowNodeOutput = z.infer<typeof workflowNodeOutputSchema>
export type WorkflowOutputResult = z.infer<typeof workflowOutputSchema>
export type WorkflowAgentLaunchResult = z.infer<typeof workflowAgentLaunchSchema>
export type WorkflowAgentCancelResult = z.infer<typeof workflowAgentCancelSchema>
export type WorkflowAgentEstimateResult = z.infer<typeof workflowAgentEstimateSchema>
export type ViralClipsQuotaSnapshot = z.infer<typeof viralClipsQuotaSchema>
export type WorkflowAgentStatusResult = z.infer<typeof workflowAgentStatusSchema>
export type WorkflowRuntimeStatus = z.infer<typeof workflowAgentStatusSchema>
export type WorkflowAgentOutputResult = z.infer<typeof workflowAgentOutputSchema>
export type RecentWorkflowOutputMedia = z.infer<typeof recentWorkflowOutputMediaSchema>
export type RecentWorkflowOutputItem = z.infer<typeof recentWorkflowOutputItemSchema>
export type RecentWorkflowOutputsResult = z.infer<typeof recentWorkflowOutputsResponseSchema>['data']
export type MediaTranscriptArtifact = z.infer<typeof mediaTranscriptArtifactSchema>
export type MediaTranscriptDownloadFormat = 'txt' | 'srt' | 'vtt'
type GatewayRequestOptions = { signal?: AbortSignal; timeoutMs?: number }

export type WorkflowDefinitionPersistencePayload = {
  project_id?: string
  name: string
  dsl_json: Record<string, unknown>
  layout_json: Record<string, unknown>
  meta_json: Record<string, unknown>
  node_catalog_snapshot: Record<string, unknown>
}

export type WorkflowRevisionPersistencePayload = {
  source_revision_id?: string
  patch_source?: string
  expected_version?: number
  dsl_json: Record<string, unknown>
  layout_json: Record<string, unknown>
  meta_json: Record<string, unknown>
  node_catalog_snapshot: Record<string, unknown>
}

export async function listWorkflowDefinitions(
  channelId: string,
  input: { status?: WorkflowDefinitionStatus | null; limit?: number; offset?: number } = {},
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams()
  if (input.status) query.set('status', input.status)
  if (input.limit != null) query.set('limit', String(input.limit))
  if (input.offset != null) query.set('offset', String(input.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions${suffix}`,
    { schema: workflowDefinitionListResponseSchema, signal: options.signal },
  )

  return {
    items: response.data,
    meta: response.meta,
  }
}

export async function getWorkflowWorkspaceBootstrap(
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/bootstrap`,
    { schema: workflowWorkspaceBootstrapResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function getWorkflowDefinition(channelId: string, definitionId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}`,
    { schema: workflowDefinitionDetailResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function createWorkflowDefinition(
  channelId: string,
  input: WorkflowDefinitionPersistencePayload,
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions`,
    {
      method: 'POST',
      csrf: true,
      body: input,
      schema: workflowDefinitionCreateResponseSchema,
    },
  )
  return response.data
}

export async function updateWorkflowDefinition(
  channelId: string,
  definitionId: string,
  input: { name?: string; projectId?: string | null },
) {
  const body: { name?: string; project_id?: string | null } = {}
  if (input.name !== undefined) body.name = input.name
  if (input.projectId !== undefined) body.project_id = input.projectId

  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}`,
    {
      method: 'PATCH',
      csrf: true,
      body,
      schema: workflowDefinitionMutationResponseSchema,
    },
  )
  return response.data
}

export async function archiveWorkflowDefinition(channelId: string, definitionId: string) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/archive`,
    {
      method: 'POST',
      csrf: true,
      schema: workflowDefinitionMutationResponseSchema,
    },
  )
  return response.data
}

export async function createWorkflowRevision(
  channelId: string,
  definitionId: string,
  input: WorkflowRevisionPersistencePayload,
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/revisions`,
    {
      method: 'POST',
      csrf: true,
      body: input,
      schema: workflowDefinitionRevisionMutationResponseSchema,
    },
  )
  return response.data
}

export async function updateWorkflowRevision(
  channelId: string,
  definitionId: string,
  revisionId: string,
  input: WorkflowRevisionPersistencePayload,
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}`,
    {
      method: 'PATCH',
      csrf: true,
      body: input,
      schema: workflowDefinitionRevisionMutationResponseSchema,
    },
  )
  return response.data
}

export async function publishWorkflowRevision(
  channelId: string,
  definitionId: string,
  revisionId: string,
  input: { estimateId?: string | null; userInputs?: Record<string, unknown> } = {},
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
    {
      method: 'POST',
      csrf: true,
      body: {
        estimate_id: input.estimateId ?? undefined,
        user_inputs: input.userInputs ?? {},
      },
      schema: workflowDefinitionRevisionMutationResponseSchema,
    },
  )
  return response.data
}

export async function estimateWorkflowRevision(
  channelId: string,
  definitionId: string,
  revisionId: string,
  input: { projectId?: string | null; userInputs?: Record<string, unknown> } = {},
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}/estimate`,
    {
      method: 'POST',
      csrf: true,
      body: {
        project_id: input.projectId ?? undefined,
        user_inputs: input.userInputs ?? {},
      },
      schema: workflowEstimateResponseSchema,
    },
  )
  return response.data
}

export async function executeWorkflowRevision(
  channelId: string,
  definitionId: string,
  revisionId: string,
  input: {
    projectId: string
    estimateId: string
    idempotencyKey: string
    userInputs?: Record<string, unknown>
    expectedViralClipsQuota?: ViralClipsQuotaSnapshot
    /** PIPE-05: an earlier run of this workflow whose finished, unchanged steps are reused (not run or charged again). */
    resultReuseSourceWorkflowId?: string | null
  },
) {
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}/execute`,
    {
      method: 'POST',
      csrf: true,
      body: {
        project_id: input.projectId,
        estimate_id: input.estimateId,
        idempotency_key: input.idempotencyKey,
        user_inputs: input.userInputs ?? {},
        expected_viral_clips_quota: input.expectedViralClipsQuota,
        ...(input.resultReuseSourceWorkflowId
          ? { result_reuse_source_workflow_id: input.resultReuseSourceWorkflowId }
          : {}),
      },
      schema: workflowRunProjectionResponseSchema,
    },
  )
  return response.data
}

export async function listWorkflowDefinitionRuns(
  channelId: string,
  definitionId: string,
  input: { limit?: number; offset?: number } = {},
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams()
  if (input.limit != null) query.set('limit', String(input.limit))
  if (input.offset != null) query.set('offset', String(input.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await gatewayRequest(
    `/api/v1/channels/${encodeURIComponent(channelId)}/workflows/definitions/${encodeURIComponent(definitionId)}/runs${suffix}`,
    { schema: workflowRunProjectionListResponseSchema, signal: options.signal },
  )

  return {
    items: response.data,
    meta: response.meta,
  }
}

export async function cancelWorkflowRun(workflowId: string) {
  const response = await gatewayRequest(
    `/api/v1/workflows/${encodeURIComponent(workflowId)}/cancel`,
    {
      method: 'POST',
      csrf: true,
      schema: workflowLifecycleResponseSchema,
    },
  )
  return response.data
}

export async function resumeWorkflowRun(workflowId: string) {
  const attempt = getOrCreateWorkflowLifecycleAttempt({ workflowId, action: 'resume' })
  try {
    const response = await gatewayRequest(
      `/api/v1/workflows/${encodeURIComponent(workflowId)}/resume`,
      {
        method: 'POST',
        csrf: true,
        body: { idempotency_key: attempt.idempotencyKey },
        schema: workflowLifecycleResponseSchema,
      },
    )
    workflowLifecycleAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
    return response.data
  } catch (error) {
    if (!isAmbiguousMutationError(error)) {
      workflowLifecycleAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
    }
    throw error
  }
}

export async function retryWorkflowRun(workflowId: string) {
  const attempt = getOrCreateWorkflowLifecycleAttempt({ workflowId, action: 'retry' })
  try {
    const response = await gatewayRequest(
      `/api/v1/workflows/${encodeURIComponent(workflowId)}/retry`,
      {
        method: 'POST',
        csrf: true,
        body: { idempotency_key: attempt.idempotencyKey },
        schema: workflowRetryResponseSchema,
      },
    )
    workflowLifecycleAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
    return response.data
  } catch (error) {
    if (!isAmbiguousMutationError(error)) {
      workflowLifecycleAttemptStore.clear(attempt.scope, attempt.idempotencyKey)
    }
    throw error
  }
}

function getOrCreateWorkflowLifecycleAttempt(payload: WorkflowLifecycleIntent) {
  const scope = `${payload.action}:${payload.workflowId}`
  const fingerprint = stableClientFingerprint(payload)
  return workflowLifecycleAttemptStore.find(scope, fingerprint)
    ?? workflowLifecycleAttemptStore.save({
      scope,
      fingerprint,
      idempotencyKey: createWorkflowActionIdempotencyKey(`workflow-${payload.action}`),
      payload,
    })
}

export async function getWorkflowRunCost(workflowId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/${encodeURIComponent(workflowId)}/cost`,
    { schema: workflowRunCostResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function listWorkflowNodeCatalog(options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest('/api/v1/workflows/nodes/catalog', {
    schema: workflowNodeCatalogResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function getWorkflowOutput(workflowId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/${encodeURIComponent(workflowId)}/output`,
    { schema: workflowOutputResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function getWorkflowStatus(workflowId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/${encodeURIComponent(workflowId)}/status`,
    { schema: workflowRuntimeStatusResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function launchWorkflowAgent(input: {
  projectId: string
  channelId?: string | null
  nodeType: string
  params: Record<string, unknown>
  idempotencyKey: string
  expectedViralClipsQuota?: ViralClipsQuotaSnapshot
  /** LAT-04 / Y11: the displayed estimate's unexpired launch quote id. */
  launchQuoteId?: string | null
}, options: GatewayRequestOptions = {}) {
  const execute = async () => {
    const response = await gatewayRequest('/api/v1/workflows/agents/execute', {
      method: 'POST',
      csrf: true,
      signal: options.signal,
      body: {
        project_id: input.projectId,
        channel_id: input.channelId ?? undefined,
        node_type: input.nodeType,
        params: input.nodeType === 'viral_clips@1' ? normalizeViralClipsParams(input.params) : input.params,
        idempotency_key: input.idempotencyKey,
        expected_viral_clips_quota: input.expectedViralClipsQuota,
        launch_quote_id: input.launchQuoteId ?? undefined,
      },
      schema: workflowAgentLaunchResponseSchema,
    })
    return response.data
  }

  try {
    return await execute()
  } catch (error) {
    if (options.signal?.aborted) throw error
    const ambiguousTransportFailure = isAuthClientError(error)
      && (error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT')
    if (!ambiguousTransportFailure) throw error

    // The execute endpoint is idempotent. Reconcile one ambiguous transport
    // failure with the exact same key so an accepted workflow is returned
    // instead of asking the user to submit (and potentially pay for) it again.
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    return execute()
  }
}

export async function estimateWorkflowAgent(input: {
  channelId?: string | null
  nodeType: string
  params: Record<string, unknown>
  idempotencyKey?: string
}, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest('/api/v1/workflows/agents/estimate', {
    method: 'POST',
    csrf: true,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    body: {
      channel_id: input.channelId ?? undefined,
      node_type: input.nodeType,
      params: input.nodeType === 'viral_clips@1' ? normalizeViralClipsParams(input.params) : input.params,
      idempotency_key: input.idempotencyKey,
    },
    schema: workflowAgentEstimateResponseSchema,
  })
  return response.data
}

export async function getWorkflowAgentStatus(agentId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/agents/${encodeURIComponent(agentId)}/status`,
    { schema: workflowAgentStatusResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function getWorkflowAgentOutput(agentId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/agents/${encodeURIComponent(agentId)}/output`,
    { schema: workflowAgentOutputResponseSchema, signal: options.signal },
  )
  return response.data
}

export async function cancelWorkflowAgent(agentId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/agents/${encodeURIComponent(agentId)}/cancel`,
    {
      method: 'POST',
      csrf: true,
      signal: options.signal,
      schema: workflowAgentCancelResponseSchema,
    },
  )
  return response.data
}

export async function listRecentWorkflowOutputs(input: {
  channelId?: string | null
  nodeType: string
  kind?: 'image' | 'video' | 'audio' | 'document' | 'data' | null
  limit?: number
  cursor?: string | null
}, options: GatewayRequestOptions = {}) {
  const query = new URLSearchParams()
  if (input.channelId) query.set('channel_id', input.channelId)
  query.set('node_type', input.nodeType)
  if (input.kind) query.set('kind', input.kind)
  if (input.limit != null) query.set('limit', String(input.limit))
  if (input.cursor) query.set('cursor', input.cursor)
  const response = await gatewayRequest(`/api/v1/workflows/recent-outputs?${query.toString()}`, {
    schema: recentWorkflowOutputsResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function listMediaTranscriptArtifacts(
  input: { channelId: string; sourceObjectId: string },
  options: GatewayRequestOptions = {},
) {
  const response = await gatewayRequest(
    `/api/v1/workflows/channels/${encodeURIComponent(input.channelId)}/media/${encodeURIComponent(input.sourceObjectId)}/transcripts`,
    { schema: mediaTranscriptArtifactsResponseSchema, signal: options.signal },
  )
  return response.data.items
}

export async function deleteMediaTranscriptArtifact(input: {
  channelId: string
  sourceObjectId: string
  artifactId: string
}) {
  const response = await gatewayRequest(
    `/api/v1/workflows/channels/${encodeURIComponent(input.channelId)}/media/${encodeURIComponent(input.sourceObjectId)}/transcripts/${encodeURIComponent(input.artifactId)}`,
    {
      method: 'DELETE',
      csrf: true,
      schema: deleteMediaTranscriptArtifactResponseSchema,
    },
  )
  return response.data
}

export function getMediaTranscriptDownloadUrl(input: {
  channelId: string
  sourceObjectId: string
  artifactId: string
  format: MediaTranscriptDownloadFormat
}) {
  const path = `/api/v1/workflows/channels/${encodeURIComponent(input.channelId)}/media/${encodeURIComponent(input.sourceObjectId)}/transcripts/${encodeURIComponent(input.artifactId)}/download`
  return `${getYoutorchApiBaseUrl()}${path}?format=${encodeURIComponent(input.format)}`
}

export async function getMediaTranscriptText(
  input: { channelId: string; sourceObjectId: string; artifactId: string },
  options: GatewayRequestOptions = {},
) {
  const response = await fetch(getMediaTranscriptDownloadUrl({ ...input, format: 'txt' }), {
    credentials: 'include',
    cache: 'no-store',
    signal: options.signal,
  })
  if (!response.ok) throw await parseAuthErrorResponse(response)
  return response.text()
}

export async function getMediaTranscriptTimedText(
  input: { channelId: string; sourceObjectId: string; artifactId: string },
  options: GatewayRequestOptions = {},
) {
  for (const format of ['vtt', 'srt', 'txt'] as const) {
    const response = await fetch(getMediaTranscriptDownloadUrl({ ...input, format }), {
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
    })
    if (!response.ok) continue
    return response.text()
  }
  throw new Error('TRANSCRIPT_TEXT_UNAVAILABLE')
}

export function buildWorkflowDefinitionPayload(
  workflow: Workflow,
  options: { projectId?: string | null } = {},
): WorkflowDefinitionPersistencePayload {
  const persistence = buildWorkflowPersistenceSnapshot(workflow)

  return {
    ...(options.projectId ? { project_id: options.projectId } : {}),
    name: workflow.name.trim() || 'Untitled workflow',
    ...persistence,
  }
}

export function buildWorkflowRevisionPayload(
  workflow: Workflow,
  options: { sourceRevisionId?: string | null; patchSource?: string | null; expectedVersion?: number } = {},
): WorkflowRevisionPersistencePayload {
  const persistence = buildWorkflowPersistenceSnapshot(workflow)

  return {
    ...(options.sourceRevisionId ? { source_revision_id: options.sourceRevisionId } : {}),
    ...(options.patchSource ? { patch_source: options.patchSource } : {}),
    ...(options.expectedVersion != null ? { expected_version: options.expectedVersion } : {}),
    ...persistence,
  }
}

export function createWorkflowActionIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${hashString([
    String(Date.now()),
    String(Math.random()),
  ].join('|'))}`
}

export function getWorkflowEditableRevision(detail: WorkflowDefinitionDetail) {
  return selectEditableRevision(detail)
}

export function getWorkflowPublishedRevision(detail: WorkflowDefinitionDetail) {
  const publishedId = detail.definition.current_published_revision_id
  if (publishedId) {
    const published = detail.revisions.find((revision) => revision.id === publishedId)
    if (published) return published
  }
  return detail.revisions.find((revision) => revision.status === 'published') ?? null
}

function buildWorkflowPersistenceSnapshot(workflow: Workflow) {
  const executableNodes = workflow.nodes.filter(isExecutableWorkflowNode)
  const idMap = createWorkflowNodeUidMap(executableNodes)
  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]))
  const helperInputsByTarget = collectHelperEdgeInputs(workflow, executableNodes, nodeById)
  const dslNodes = executableNodes.map((node, index) => {
    const uid = idMap.get(node.id) ?? `node_${index + 1}`
    const type = normalizeWorkflowNodeType(node)

    return {
      uid,
      index,
      type,
      inputs: {
        ...buildDslNodeInputs(node, type),
        ...(helperInputsByTarget.get(node.id) ?? {}),
      },
      alias: node.title.trim().slice(0, 120) || uid,
    }
  })
  const dslWires = workflow.edges
    .map((edge) => buildDslWire(edge, nodeById, idMap))
    .filter(isDslWire)
  const nodeTypes = uniqueStrings(dslNodes.map((node) => node.type))

  return {
    dsl_json: {
      id: workflow.id,
      dsl_version: '2',
      kind: 'user_defined',
      version: '1',
      nodes: dslNodes,
      wires: dslWires,
    },
    layout_json: {
      source: 'youtorch-ui',
      nodes: workflow.nodes.map((node) => {
        const imageLabel = node.kind === 'image' ? imageDisplayLabelForNode(node) : null
        const settings = buildLayoutNodeSettings(node)
        const inputPorts = node.kind === 'image'
          ? imageInputPortsForTask(getImageTask(settings))
          : normalizeWorkflowPorts(node.inputPorts, node.inputs, 'input')
        const outputPorts = node.kind === 'image'
          ? imageOutputPorts()
          : normalizeWorkflowPorts(node.outputPorts, node.outputs, 'output')
        return {
          id: node.id,
          uid: idMap.get(node.id) ?? node.id,
          kind: node.kind,
          title: node.title,
          subtitle: node.kind === 'image' ? imageDisplayText(node.subtitle, imageLabel) : node.subtitle,
          provider: imageLabel ?? node.provider,
          status: node.status,
          cost: node.cost,
          description: node.description,
          position: node.position,
          settings,
          input_ports: inputPorts,
          output_ports: outputPorts,
        }
      }),
      edges: workflow.edges.map((edge) => ({
        id: edge.id,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        original_source: edge.source,
        original_target: edge.target,
        source_port: edge.sourcePort ?? parseEdgeLabelPorts(edge.label)?.port ?? null,
        target_input: edge.targetInput ?? parseEdgeLabelPorts(edge.label)?.input ?? null,
      })),
    },
    meta_json: {
      source: 'workflow-builder',
      description: workflow.description,
      trigger_type: workflow.triggerType,
      trigger_label: workflow.triggerLabel,
      schedule: workflow.schedule,
      status: workflow.status,
      ui_node_count: workflow.nodes.length,
      ui_edge_count: workflow.edges.length,
    },
    node_catalog_snapshot: {
      source: 'youtorch-ui',
      dsl_version: '2',
      node_types: nodeTypes,
      node_count: executableNodes.length,
    },
  }
}

function isExecutableWorkflowNode(node: WorkflowDefinitionNode) {
  return node.kind !== 'note' && node.kind !== 'input'
}

function collectHelperEdgeInputs(
  workflow: Workflow,
  executableNodes: WorkflowDefinitionNode[],
  nodeById: ReadonlyMap<string, WorkflowDefinitionNode>,
) {
  const executableIds = new Set(executableNodes.map((node) => node.id))
  const helperInputs = new Map<string, Record<string, unknown>>()

  for (const edge of workflow.edges) {
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    if (!sourceNode || !targetNode) continue
    if (sourceNode.kind !== 'input' || !executableIds.has(targetNode.id)) continue

    const labelPorts = parseEdgeLabelPorts(edge.label)
    const targetInput = edge.targetInput
      ?? getPortIdFromHandle(edge.targetHandle, 'input')
      ?? labelPorts?.input
      ?? firstPortId(targetNode.inputPorts, targetNode.inputs, 'input')
      ?? 'input'
    const normalizedInput = normalizePortName(targetInput)
    const helperValue = getHelperNodeValue(sourceNode, normalizedInput)
    if (helperValue === null) continue

    const targetInputs = helperInputs.get(targetNode.id) ?? {}
    targetInputs[helperCompileInputKey(normalizedInput, helperValue)] = helperValue
    helperInputs.set(targetNode.id, targetInputs)
  }

  return helperInputs
}

function getHelperNodeValue(node: WorkflowDefinitionNode, targetInput = '') {
  const storageId = typeof node.settings?.helper_storage_object_id === 'string'
    ? node.settings.helper_storage_object_id.trim()
    : ''
  const fallback = typeof node.settings?.helper_value === 'string'
    ? node.settings.helper_value.trim()
    : ''
  const port = targetInput.toLowerCase()
  if (
    port.includes('storage_object')
    || port.includes('reference_')
    || isUrlClassPort(port)
  ) {
    return storageId || null
  }
  if (looksLikeHttpUrl(fallback)) return storageId || null
  return storageId || fallback || null
}

function helperCompileInputKey(port: string, value: string) {
  if (isUrlClassPort(port) && !looksLikeHttpUrl(value)) return 'storage_object_id'
  return port
}

function isUrlClassPort(port: string) {
  return port.includes('url') || port === 'video_url' || port === 'cdn_url'
}

function looksLikeHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function createWorkflowNodeUidMap(nodes: WorkflowDefinitionNode[]) {
  const used = new Set<string>()
  const map = new Map<string, string>()

  nodes.forEach((node, index) => {
    const uid = createWorkflowNodeUid(node.id, index, used)
    map.set(node.id, uid)
  })

  return map
}

function createWorkflowNodeUid(value: string, index: number, used: Set<string>) {
  const fallback = `node_${index + 1}`
  let uid = (value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+/, '')

  if (!/^[A-Za-z]/.test(uid)) uid = `node_${uid}`
  if (uid.length < 3) uid = `${uid}_${index + 1}`
  uid = uid.slice(0, 120)

  const base = uid || fallback
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`.slice(0, 128)
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function normalizeWorkflowNodeType(node: WorkflowDefinitionNode) {
  const settings = getRecord(node.settings)
  const candidates = [
    getString(settings.node_type),
    getString(settings.workflow_node_type),
    node.subtitle,
    node.provider,
    node.kind,
  ]

  for (const candidate of candidates) {
    if (isWorkflowNodeType(candidate)) return candidate
  }

  const typeByKind: Record<WorkflowDefinitionNode['kind'], string> = {
    input: 'input@1',
    trigger: 'input@1',
    ai: 'prompt_generate@1',
    image: 'image_generate@1',
    render: 'render@1',
    publish: 'upload@1',
    logic: 'review_gate@1',
    analytics: 'summarize_media@1',
    note: 'response@1',
    provider: 'response@1',
  }

  return typeByKind[node.kind] ?? 'response@1'
}

function isWorkflowNodeType(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*@\d+$/.test(value.trim())
}

function buildDslNodeInputs(node: WorkflowDefinitionNode, type: string) {
  if (type === 'viral_clips@1') return normalizeViralClipsParams(buildGenericDslNodeInputs(node))
  if (type === 'input@1') {
    return {
      fields: normalizeWorkflowPorts(node.outputPorts, node.outputs ?? ['input'], 'output').slice(0, 20).map((port) => ({
        name: normalizePortName(port.id),
        type: toInputNodeFieldType(port.type ?? inferInputFieldType(port.id)),
      })),
    }
  }

  if (hasCatalogInputSchema(node)) {
    const inputs = buildGenericDslNodeInputs(node)
    if (type === 'prompt_enhance@1') {
      const instruction = getString(node.settings?.instruction)
      if (instruction) inputs.instruction = instruction
    }
    return inputs
  }

  if (type === 'prompt_generate@1') {
    const settings = node.settings ?? {}
    return {
      instruction: (getString(settings.instruction) ?? node.description) || node.title,
      model_id: getString(settings.model_id) ?? DEFAULT_PROMPT_MODEL_ID,
    }
  }

  if (type === 'prompt_enhance@1') {
    const settings = node.settings ?? {}
    return {
      prompt: (getString(settings.prompt) ?? node.description) || node.title,
      ...(getString(settings.instruction) ? { instruction: getString(settings.instruction) } : {}),
      model_id: getString(settings.model_id) ?? DEFAULT_PROMPT_MODEL_ID,
    }
  }

  if (type === 'image_generate@1') {
    const settings = node.settings ?? {}
    const task = getImageTask(settings)
    const modelId = getImageModelIdForTask(settings, task, node)
    return {
      prompt: node.description || node.title,
      task,
      count: getImageCount(settings),
      ...(modelId ? { model_id: modelId } : {}),
      ...buildImageOptionInputs(settings),
    }
  }

  if (type === 'video_generate@1') {
    const settings = node.settings ?? {}
    return {
      prompt: (getString(settings.prompt) ?? node.description) || node.title,
      aspect_ratio: getString(settings.aspect_ratio) ?? '16:9',
      style: getString(settings.style) ?? 'mock video render',
      duration_seconds: getNumber(settings.duration_seconds) ?? 5,
      ...(getString(settings.model_id) ? { model_id: getString(settings.model_id) } : {}),
      ...(getString(settings.first_frame_url) ? { first_frame_url: getString(settings.first_frame_url) } : {}),
      ...(getString(settings.image_url) ? { image_url: getString(settings.image_url) } : {}),
    }
  }

  if (type === 'review_gate@1') {
    const allowRequestChanges = getReviewMode(node.settings ?? {}) === 'Approve / Reject / Request changes'
    const reviewTextInputs = buildReviewGateTextInputs(node)
    return allowRequestChanges
      ? {
          allowed_actions: ['approve', 'reject', 'request_changes'],
          fail_actions: ['reject', 'request_changes'],
          ...reviewTextInputs,
        }
      : {
          allowed_actions: ['approve', 'reject'],
          fail_actions: ['reject'],
          ...reviewTextInputs,
        }
  }

  return buildGenericDslNodeInputs(node)
}

function hasCatalogInputSchema(node: WorkflowDefinitionNode) {
  return Object.keys(getRecord(getRecord(node.settings).__catalog_input_schema)).length > 0
}

function buildGenericDslNodeInputs(node: WorkflowDefinitionNode) {
  const settings = getRecord(node.settings)
  const catalogInputSchema = getRecord(settings.__catalog_input_schema)
  const schemaEntries = Object.entries(catalogInputSchema)
    .map(([key, value]) => {
      const port = getRecord(value)
      return [normalizePortName(getString(port.name) ?? key), port] as const
    })
  const schemaByKey = new Map(schemaEntries)
  const inputKeys = schemaByKey.size > 0
    ? [...schemaByKey.keys()]
    : Object.keys(settings).filter((key) => !isWorkflowUiOnlySetting(key)).map(normalizePortName)
  const mediaDownloaderNode = isMediaDownloaderSettings(settings)
  const mediaDownloaderUrl = mediaDownloaderNode ? getMediaDownloaderSingleUrl(settings) : null
  const mediaDownloaderClipMode = getMediaDownloaderClipMode(settings)

  const inputs: Record<string, unknown> = {}
  inputKeys.forEach((key) => {
    if (isWorkflowUiOnlySetting(key)) return
    if (mediaDownloaderNode && ['url', 'urls', 'platform', 'max_items', 'allow_playlist'].includes(key)) return
    if (mediaDownloaderNode && key === 'resolution') return
    if (mediaDownloaderNode && key === 'metadata') return
    if (mediaDownloaderNode && key === 'quality' && settings.variant_id) return
    if (mediaDownloaderClipMode === 'full' && (key === 'start_time' || key === 'end_time')) return
    const value = mediaDownloaderNode && key === 'mode' && settings[key] === 'metadata'
      ? 'download'
      : settings[key]
    if (value === undefined || value === null) return
    inputs[key] = coerceGenericWorkflowInput(value, schemaByKey.get(key))
  })
  if (mediaDownloaderNode) {
    if (mediaDownloaderUrl) inputs.url = mediaDownloaderUrl
    for (const key of ['snapshot_id', 'variant_id', 'displayed_estimated_credits'] as const) {
      if (settings[key] !== undefined && settings[key] !== null && settings[key] !== '') {
        inputs[key] = settings[key]
      }
    }
  }

  return inputs
}

function getMediaDownloaderClipMode(settings: Record<string, unknown>): 'full' | 'clip' | null {
  if (!isMediaDownloaderSettings(settings)) return null
  const explicitMode = settings.__media_downloader_clip_mode
  if (explicitMode === 'full' || explicitMode === 'clip') return explicitMode
  const hasStart = settings.start_time !== undefined && settings.start_time !== null && settings.start_time !== ''
  const hasEnd = settings.end_time !== undefined && settings.end_time !== null && settings.end_time !== ''
  return hasStart || hasEnd ? 'clip' : 'full'
}

function isMediaDownloaderSettings(settings: Record<string, unknown>) {
  const nodeType = getString(settings.node_type) ?? getString(settings.workflow_node_type) ?? ''
  return nodeType === 'media_downloader' || nodeType.startsWith('media_downloader@')
}

function getMediaDownloaderSingleUrl(settings: Record<string, unknown>): string | null {
  const direct = typeof settings.url === 'string' ? settings.url.trim() : ''
  if (direct) {
    const parsed = parseMediaDownloaderVideoUrl(direct)
    if (!parsed) throw new Error('MEDIA_DOWNLOADER_INVALID_VIDEO_URL')
    return parsed.url
  }

  const urls = settings.urls
  const legacyUrls = Array.isArray(urls)
    ? urls.map((value) => String(value).trim()).filter(Boolean)
    : typeof urls === 'string'
      ? urls.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean)
      : []
  if (legacyUrls.length === 0) return null
  if (legacyUrls.length !== 1) throw new Error('MEDIA_DOWNLOADER_SINGLE_URL_REQUIRED')
  const parsed = parseMediaDownloaderVideoUrl(legacyUrls[0] ?? '')
  if (!parsed) throw new Error('MEDIA_DOWNLOADER_INVALID_VIDEO_URL')
  return parsed.url
}

function isWorkflowUiOnlySetting(key: string) {
  return key.startsWith('__')
    || key === 'node_type'
    || key === 'workflow_node_type'
    || key.startsWith('helper_')
    || key === 'review_gate'
    || key === 'review_mode'
    || key === 'approval_copy_mode'
    || key === 'content_format'
    || key === 'guide_width'
    || key === 'guide_height'
    || key === 'consent_accepted'
}

function coerceGenericWorkflowInput(value: unknown, schema: Record<string, unknown> | undefined) {
  const type = getString(schema?.type)
  if (type === 'integer') {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
    return Number.isFinite(parsed) ? Math.round(parsed) : value
  }
  if (type === 'float') {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value
    const normalized = String(value).trim().toLocaleLowerCase('en-US')
    if (normalized === 'true' || normalized === 'on' || normalized === '1') return true
    if (normalized === 'false' || normalized === 'off' || normalized === '0') return false
    return value
  }
  if ((type === 'dict' || type === 'list') && typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      if (type === 'list') {
        return value.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)
      }
      return value
    }
  }
  return value
}

function buildDslWire(
  edge: WorkflowDefinitionEdge,
  nodeById: ReadonlyMap<string, WorkflowDefinitionNode>,
  idMap: Map<string, string>,
) {
  const source = idMap.get(edge.source)
  const target = idMap.get(edge.target)
  if (!source || !target) return null

  const sourceNode = nodeById.get(edge.source)
  const targetNode = nodeById.get(edge.target)
  const labelPorts = parseEdgeLabelPorts(edge.label)
  const sourcePort = edge.sourcePort
    ?? getPortIdFromHandle(edge.sourceHandle, 'output')
    ?? labelPorts?.port
    ?? firstPortId(sourceNode?.outputPorts, sourceNode?.outputs, 'output')
  const targetInput = edge.targetInput
    ?? getPortIdFromHandle(edge.targetHandle, 'input')
    ?? labelPorts?.input
    ?? firstPortId(targetNode?.inputPorts, targetNode?.inputs, 'input')

  return {
    from: source,
    to: target,
    port: normalizePortName(sourcePort ?? 'output'),
    input: normalizePortName(targetInput ?? 'input'),
  }
}

function parseEdgeLabelPorts(label?: string) {
  if (!label) return null
  const [port, input] = label.split('->').map((part) => normalizePortName(part))
  if (!port || !input) return null
  return { port, input }
}

function normalizePortName(value: string) {
  const port = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return port || 'input'
}

function inferInputFieldType(name: string) {
  const value = name.toLowerCase()
  if (value.includes('video')) return 'video_url'
  if (value.includes('audio')) return 'audio_url'
  if (value.includes('image') || value.includes('thumbnail')) return 'image_url'
  if (value.includes('count') || value.includes('number')) return 'number'
  if (value.includes('enabled') || value.includes('flag')) return 'boolean'
  return 'text'
}

function normalizeWorkflowPorts(
  ports: WorkflowNodePort[] | undefined,
  names: string[] | undefined,
  direction: 'input' | 'output',
): WorkflowNodePort[] {
  const source: Array<WorkflowNodePort | string> = Array.isArray(ports)
    ? ports
    : names?.length
      ? names
      : [direction === 'input' ? 'input' : 'output']
  const seen = new Set<string>()
  return source.map((value, index) => {
    const port = typeof value === 'string'
      ? { id: value, label: humanizePortName(value), type: inferWorkflowPortType(value) }
      : value
    const id = uniquePortId(normalizePortName(port.id || port.label || `${direction}_${index + 1}`), seen)
    return {
      id,
      label: port.label || humanizePortName(id),
      type: port.type ?? inferWorkflowPortType(id),
      required: port.required,
    }
  })
}

function firstPortId(
  ports: WorkflowNodePort[] | undefined,
  names: string[] | undefined,
  direction: 'input' | 'output',
) {
  return normalizeWorkflowPorts(ports, names, direction)[0]?.id
}

function getPortIdFromHandle(handle: string | null | undefined, direction: 'input' | 'output') {
  const prefix = direction === 'input' ? 'input:' : 'output:'
  if (!handle?.startsWith(prefix)) return null
  return normalizePortName(handle.slice(prefix.length))
}

function toInputNodeFieldType(type: WorkflowNodePortType | string) {
  if (type === 'video') return 'video_url'
  if (type === 'audio') return 'audio_url'
  if (type === 'image') return 'image_url'
  if (type === 'integer') return 'number'
  if (type === 'string') return 'text'
  return type
}

const imageTaskOptions = [
  { value: 'text_to_image', label: 'Text to image' },
  { value: 'image_to_image', label: 'Image to image' },
  { value: 'reference_image', label: 'Reference' },
  { value: 'first_last_frame', label: 'First-last frame' },
] as const
const AUTO_IMAGE_MODEL_ID = 'auto-image'
const FLUX_KLEIN_MODEL_ID = 'flux-2-klein-4b'
const fluxKleinModelIds = new Set([FLUX_KLEIN_MODEL_ID])
const imageInputTasks = new Set(['image_to_image', 'reference_image', 'first_last_frame'])
const DEFAULT_PROMPT_MODEL_ID = 'auto-llm'

type ImageModelSelectionContext = {
  provider?: string | null
  subtitle?: string | null
}

function getImageTask(settings: Record<string, unknown>) {
  const rawValue = String(settings.image_task ?? settings.task ?? 'text_to_image')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLocaleLowerCase('en-US')
  const match = imageTaskOptions.find((option) => option.value === rawValue || option.label.replace(/[\s-]+/g, '_').toLocaleLowerCase('en-US') === rawValue)
  return match?.value ?? 'text_to_image'
}

function getImageModelIdForTask(
  settings: Record<string, unknown>,
  task: string,
  context: ImageModelSelectionContext = {},
) {
  const rawModelId = getString(settings.model_id)
  const modelId = canonicalImageModelId(rawModelId)
  const visibleModelId = imageModelIdFromProvider(context.provider) ?? imageModelIdFromProvider(context.subtitle)
  const selectedModelId = modelId && modelId !== AUTO_IMAGE_MODEL_ID
    ? modelId
    : visibleModelId ?? modelId
  if (!selectedModelId) return null
  return imageInputTasks.has(task) && fluxKleinModelIds.has(selectedModelId)
    ? AUTO_IMAGE_MODEL_ID
    : selectedModelId
}

function canonicalImageModelId(value: string | null) {
  if (!value) return null
  const normalized = normalizeImageSelectionValue(value)
  if (isFluxImageSelection(value, normalized)) {
    return FLUX_KLEIN_MODEL_ID
  }
  const gptImageModelId = gptImageModelIdFromSelection(normalized)
  if (gptImageModelId) return gptImageModelId
  return value
}

function imageModelIdFromProvider(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeImageSelectionValue(value)
  if (isFluxImageSelection(value, normalized)) {
    return FLUX_KLEIN_MODEL_ID
  }
  const gptImageModelId = gptImageModelIdFromSelection(normalized)
  if (gptImageModelId) return gptImageModelId
  return null
}

function imageDisplayLabelForNode(node: WorkflowDefinitionNode) {
  const settings = getRecord(node.settings)
  return imageDisplayLabelForSettings(settings, {
    provider: node.provider,
    subtitle: node.subtitle,
  })
}

function imageDisplayLabelForSettings(
  settings: Record<string, unknown>,
  context: ImageModelSelectionContext,
) {
  const task = getImageTask(settings)
  const modelId = getImageModelIdForTask(settings, task, context)
  return imageModelLabelFromId(modelId)
    ?? imageModelLabelFromSelection(context.provider)
    ?? imageModelLabelFromSelection(context.subtitle)
}

function imageDisplayText(value: string | null | undefined, imageLabel: string | null) {
  if (!imageLabel) return value ?? ''
  if (!value) return imageLabel
  return imageModelLabelFromSelection(value) ? imageLabel : value
}

function imageModelLabelFromSelection(value: string | null | undefined) {
  if (!value) return null
  return imageModelLabelFromId(canonicalImageModelId(value))
    ?? imageModelLabelFromId(imageModelIdFromProvider(value))
}

function imageModelLabelFromId(value: string | null | undefined) {
  if (!value) return null
  const modelId = canonicalImageModelId(value)
  if (modelId === FLUX_KLEIN_MODEL_ID) return 'FLUX.2 Klein 4B'
  if (modelId === 'gpt-image-2') return 'GPT Image 2'
  if (modelId === AUTO_IMAGE_MODEL_ID) return 'Auto Image'
  return null
}

function isFluxImageSelection(value: string, normalized: string) {
  return fluxKleinModelIds.has(value)
    || normalized === 'flux'
    || normalized === 'openrouter'
    || normalized === 'openrouter_flux'
    || normalized === 'flux_4b'
    || normalized === 'flux_2_klein_4b'
    || normalized === 'flux2_klein_4b'
    || normalized.includes('flux_2_klein_4b')
}

function gptImageModelIdFromSelection(normalized: string) {
  if (normalized === 'gpt_image_2' || normalized.endsWith('_gpt_image_2')) return 'gpt-image-2'
  return null
}

function normalizeImageSelectionValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getImageCount(settings: Record<string, unknown>) {
  const value = Number(settings.image_count ?? settings.count ?? 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(10, Math.max(1, Math.round(value)))
}

const imageOptionInputKeys = [
  'aspect_ratio',
  'size',
  'quality',
  'resolution',
  'output_format',
  'background',
  'input_fidelity',
  'style',
] as const

function buildImageOptionInputs(settings: Record<string, unknown>) {
  const inputs: Record<string, unknown> = {}
  imageOptionInputKeys.forEach((key) => {
    const value = getString(settings[key])
    if (value) inputs[key] = value
  })
  const outputCompression = readImageInteger(settings.output_compression)
  if (outputCompression !== null) inputs.output_compression = outputCompression
  return inputs
}

function readImageOptionSettings(
  nodeInputs: Record<string, unknown>,
  layoutSettings: Record<string, unknown>,
) {
  const settings: Record<string, unknown> = {}
  imageOptionInputKeys.forEach((key) => {
    if (layoutSettings[key] !== undefined) return
    const value = getString(nodeInputs[key])
    if (value) settings[key] = value
  })
  if (layoutSettings.output_compression === undefined) {
    const outputCompression = readImageInteger(nodeInputs.output_compression)
    if (outputCompression !== null) settings.output_compression = outputCompression
  }
  return settings
}

function readImageInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function imageInputPortsForTask(task: string): WorkflowNodePort[] {
  const promptPort: WorkflowNodePort = { id: 'prompt', label: 'Prompt', type: 'string', required: false }
  if (task === 'image_to_image') {
    return [promptPort, { id: 'image_urls', label: 'Image', type: 'image' }]
  }
  if (task === 'reference_image') {
    return [promptPort, { id: 'reference_image_urls', label: 'Reference', type: 'image' }]
  }
  if (task === 'first_last_frame') {
    return [
      promptPort,
      { id: 'first_frame_url', label: 'First frame', type: 'image' },
      { id: 'last_frame_url', label: 'Last frame', type: 'image' },
    ]
  }
  return [promptPort]
}

function imageOutputPorts(): WorkflowNodePort[] {
  return [{ id: 'image_url', label: 'Image', type: 'image' }]
}

const reviewModeOptions = ['Approve / Reject', 'Approve / Reject / Request changes'] as const

function getReviewMode(settings: Record<string, unknown>) {
  const rawValue = String(settings.review_mode ?? 'Approve / Reject')
    .trim()
    .toLocaleLowerCase('en-US')
  if (rawValue.replace(/[\s/_-]+/g, '_').includes('request_changes')) {
    return 'Approve / Reject / Request changes'
  }
  return reviewModeOptions.find((option) => option.toLocaleLowerCase('en-US') === rawValue)
    ?? 'Approve / Reject'
}

function getReviewModeFromInputs(inputs: Record<string, unknown>) {
  const actions = getArray(inputs.allowed_actions).map((action) => String(action).toLocaleLowerCase('en-US'))
  return actions.includes('request_changes')
    ? 'Approve / Reject / Request changes'
    : 'Approve / Reject'
}

function buildReviewGateTextInputs(node: WorkflowDefinitionNode) {
  const settings = getRecord(node.settings)
  const copyMode = getReviewCopyMode(settings)
  if (copyMode !== 'manual') {
    return { approval_copy_mode: 'auto' }
  }

  const title = getString(settings.approval_title)
  const reason = getString(settings.approval_reason)
  const prompt = getString(settings.approval_prompt) ?? reason
  const message = getString(settings.approval_message)
  const impact = getString(settings.approval_impact)

  return {
    approval_copy_mode: 'manual',
    ...(title ? { approval_title: title } : {}),
    ...(reason ? { approval_reason: reason } : {}),
    ...(prompt ? { approval_prompt: prompt } : {}),
    ...(message ? { approval_message: message } : {}),
    ...(impact ? { approval_impact: impact } : {}),
  }
}

function getReviewCopyMode(settings: Record<string, unknown>) {
  return getString(settings.approval_copy_mode) === 'manual' ? 'manual' : 'auto'
}

function isReviewGateNodeType(nodeType: string) {
  return nodeType.toLocaleLowerCase('en-US') === 'review_gate@1'
}

function isReviewGateSettings(settings: Record<string, unknown>) {
  const nodeType = getString(settings.node_type) ?? getString(settings.workflow_node_type)
  return nodeType?.toLocaleLowerCase('en-US') === 'review_gate@1' || settings.review_gate === true
}

function reviewGateInputPorts(): WorkflowNodePort[] {
  return [{ id: 'input', label: 'Input', type: 'any', required: false }]
}

function reviewGateOutputPorts(): WorkflowNodePort[] {
  return [{ id: 'approved', label: 'Approved', type: 'any' }]
}

function isPromptGenerateNodeType(nodeType: string) {
  return nodeType.toLocaleLowerCase('en-US') === 'prompt_generate@1'
}

function isPromptEnhanceNodeType(nodeType: string) {
  return nodeType.toLocaleLowerCase('en-US') === 'prompt_enhance@1'
}

function isPromptToolNodeType(nodeType: string) {
  return isPromptGenerateNodeType(nodeType) || isPromptEnhanceNodeType(nodeType)
}

function isVideoGenerateNodeType(nodeType: string) {
  return nodeType.toLocaleLowerCase('en-US') === 'video_generate@1'
}

function promptToolInputPorts(nodeType: string): WorkflowNodePort[] {
  if (isPromptGenerateNodeType(nodeType)) return []
  return [{ id: 'prompt', label: 'Prompt', type: 'string' }]
}

function promptToolOutputPorts(): WorkflowNodePort[] {
  return [{ id: 'prompt', label: 'Prompt', type: 'string' }]
}

function sanitizeNodeSettings(settings: Record<string, unknown> | undefined) {
  const nextSettings = { ...(settings ?? {}) }
  if (typeof nextSettings.helper_preview_url === 'string' && nextSettings.helper_preview_url.startsWith('blob:')) {
    delete nextSettings.helper_preview_url
  }
  return nextSettings
}

function buildLayoutNodeSettings(node: WorkflowDefinitionNode) {
  const settings = sanitizeNodeSettings(node.settings)
  if (isReviewGateSettings(settings)) return sanitizeReviewGateSettings(settings)
  if (node.kind !== 'image') return settings

  const task = getImageTask(settings)
  const modelId = getImageModelIdForTask(settings, task, node)
  return {
    ...settings,
    image_task: task,
    image_count: getImageCount(settings),
    ...(modelId ? { model_id: modelId } : {}),
  }
}

function sanitizeReviewGateSettings(settings: Record<string, unknown>) {
  const copyMode = getReviewCopyMode(settings)
  const nextSettings: Record<string, unknown> = {
    ...settings,
    approval_copy_mode: copyMode,
  }
  if (copyMode === 'manual') return nextSettings

  delete nextSettings.approval_title
  delete nextSettings.approval_reason
  delete nextSettings.approval_prompt
  delete nextSettings.approval_message
  delete nextSettings.approval_impact
  delete nextSettings.review_title
  delete nextSettings.review_message
  return nextSettings
}

function inferWorkflowPortType(value: string): WorkflowNodePortType {
  const normalized = value.toLocaleLowerCase('en-US')
  if (normalized.includes('image') || normalized.includes('thumbnail')) return 'image'
  if (normalized.includes('video') || normalized.includes('mp4')) return 'video'
  if (normalized.includes('audio')) return 'audio'
  if (normalized.includes('count') || normalized.includes('width') || normalized.includes('height')) return 'integer'
  if (normalized.includes('duration') || normalized.includes('score')) return 'float'
  if (normalized.includes('enabled') || normalized.includes('flag')) return 'boolean'
  if (normalized.includes('transcript')) return 'transcript'
  if (normalized.includes('segments')) return 'segments'
  if (normalized.includes('metadata') || normalized.includes('json')) return 'dict'
  if (normalized.includes('list') || normalized.includes('items') || normalized.includes('variants')) return 'list'
  return 'string'
}

function getWorkflowPortType(value: unknown): WorkflowNodePortType | undefined {
  if (typeof value !== 'string') return undefined
  return isWorkflowNodePortType(value) ? value : undefined
}

function isWorkflowNodePortType(value: string): value is WorkflowNodePortType {
  return [
    'string',
    'integer',
    'float',
    'boolean',
    'video',
    'audio',
    'image',
    'transcript',
    'segments',
    'timeline',
    'dict',
    'list',
    'any',
  ].includes(value)
}

function humanizePortName(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function uniquePortId(base: string, seen: Set<string>) {
  let candidate = base || 'port'
  let suffix = 2
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  seen.add(candidate)
  return candidate
}

function isDslWire(wire: ReturnType<typeof buildDslWire>): wire is {
  from: string
  to: string
  port: string
  input: string
} {
  return Boolean(wire)
}

export function mapWorkflowDefinitionRecordToWorkflow(
  definition: WorkflowDefinitionRecord,
  options: { channelName?: string | null; ownerName?: string | null; locale?: string } = {},
): Workflow {
  const status = mapDefinitionStatus(definition.status)
  const hasDraft = Boolean(definition.current_draft_revision_id)
  const hasPublished = Boolean(definition.current_published_revision_id)
  const revisionLabel = hasDraft ? 'Draft' : hasPublished ? 'Published' : '-'
  const lastRun = definition.last_run ?? null

  return {
    id: definition.id,
    name: definition.name,
    description: getDefinitionDescription(definition, null),
    channel: options.channelName || definition.channel_id,
    projectId: definition.project_id,
    owner: options.ownerName || definition.created_by || 'Workflow BC',
    status,
    triggerType: 'manual',
    triggerLabel: hasPublished ? 'Manual run' : 'Draft run',
    schedule: revisionLabel,
    lastRunAt: lastRun ? getWorkflowRunTimestamp(lastRun) ?? 'No runs yet' : 'No runs yet',
    lastRunStatus: lastRun ? mapWorkflowRunProjectionStatus(lastRun.status) : 'never',
    nextRunAt: status === 'draft' ? 'Draft' : 'Manual',
    runCount24h: 0,
    averageCost: '0c',
    successRate: 0,
    nodesCount: 1,
    updatedAt: formatWorkflowDate(definition.updated_at, options.locale),
    metrics: [
      { label: 'Status', value: formatWorkflowStatus(status) },
      { label: 'Revision', value: revisionLabel },
      { label: 'Avg. cost', value: '0c' },
    ],
    nodes: createDefinitionSummaryNodes(definition, null),
    edges: [],
  }
}

function getWorkflowRunTimestamp(run: WorkflowRunProjection) {
  return run.completed_at
    ?? run.started_at
    ?? run.updated_at
    ?? run.created_at
    ?? null
}

function mapWorkflowRunProjectionStatus(status: string | null | undefined): WorkflowRunStatus {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return 'never'
  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') return 'success'
  if (normalized === 'failed' || normalized === 'error') return 'failed'
  if (normalized === 'running' || normalized === 'started' || normalized === 'in_process' || normalized === 'in_progress' || normalized === 'processing' || normalized === 'executing') return 'running'
  if (normalized === 'launching' || normalized === 'pending' || normalized === 'queued') return 'running'
  if (
    normalized === 'cancelling'
    || normalized === 'draining'
    || normalized === 'settlement_pending'
    || normalized === 'paused'
    || normalized === 'waiting'
    || normalized.includes('review')
    || normalized.includes('payment')
  ) {
    return 'warning'
  }
  return 'never'
}

export function mapWorkflowDefinitionDetailToWorkflow(
  detail: WorkflowDefinitionDetail,
  options: { channelName?: string | null; ownerName?: string | null } = {},
): Workflow {
  const revision = selectEditableRevision(detail)
  const nodes = revision ? mapDslNodesToCanvasNodes(revision) : createDefinitionSummaryNodes(detail.definition, null)
  const edges = revision ? mapRevisionToCanvasEdges(revision, new Set(nodes.map((node) => node.id))) : []
  const status = mapDefinitionStatus(detail.definition.status)

  return {
    ...mapWorkflowDefinitionRecordToWorkflow(detail.definition, options),
    description: getDefinitionDescription(detail.definition, revision),
    status,
    triggerLabel: inferTriggerLabel(nodes),
    schedule: revision ? `${formatRevisionStatus(revision.status)} r${revision.revision_no}` : 'No revision',
    nodesCount: nodes.length,
    metrics: [
      { label: 'Status', value: formatWorkflowStatus(status) },
      { label: 'Node', value: `${nodes.length} node` },
      { label: 'Revision', value: revision ? `r${revision.revision_no}` : '-' },
    ],
    nodes,
    edges,
  }
}

function mapDefinitionStatus(status: WorkflowDefinitionStatus): WorkflowStatus {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  return 'draft'
}

function formatWorkflowStatus(status: WorkflowStatus) {
  if (status === 'active') return 'Active'
  if (status === 'paused') return 'Paused'
  if (status === 'failed') return 'Failed'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

function formatRevisionStatus(status: WorkflowDefinitionRevision['status']) {
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

function getDefinitionDescription(
  definition: WorkflowDefinitionRecord,
  revision: WorkflowDefinitionRevision | null,
) {
  const metaDescription = getString(revision?.meta_json.description)
    ?? getString(revision?.meta_json.summary)
    ?? getString(revision?.meta_json.title)
  if (metaDescription) return metaDescription
  if (definition.status === 'archived') return 'Archived workflow definition.'
  if (definition.current_published_revision_id) return 'Saved workflow definition with a published revision.'
  if (definition.current_draft_revision_id) return 'Draft workflow definition.'
  return 'Saved workflow definition.'
}

function createDefinitionSummaryNodes(
  definition: WorkflowDefinitionRecord,
  revision: WorkflowDefinitionRevision | null,
): WorkflowDefinitionNode[] {
  return [{
    id: `${definition.id}-definition`,
    title: definition.name,
    subtitle: revision ? `Revision r${revision.revision_no}` : 'Definition',
    kind: definition.status === 'active' ? 'trigger' : 'provider',
    provider: 'Youtorch',
    status: 'never',
    cost: '0c',
    description: getDefinitionDescription(definition, revision),
    position: { x: 80, y: 160 },
    outputs: revision ? ['revision'] : ['definition'],
  }]
}

function createRevisionSummaryNodes(revision: WorkflowDefinitionRevision): WorkflowDefinitionNode[] {
  return [{
    id: `${revision.id}-revision`,
    title: `Revision r${revision.revision_no}`,
    subtitle: formatRevisionStatus(revision.status),
    kind: 'provider',
    provider: 'Youtorch',
    status: 'never',
    cost: '0c',
    description: `DSL hash ${revision.dsl_hash || 'not available'}`,
    position: { x: 80, y: 160 },
    outputs: ['revision'],
  }]
}

function selectEditableRevision(detail: WorkflowDefinitionDetail) {
  const preferredId = detail.definition.current_draft_revision_id
    ?? detail.definition.current_published_revision_id
  if (preferredId) {
    const preferred = detail.revisions.find((revision) => revision.id === preferredId)
    if (preferred) return preferred
  }
  return detail.revisions[0] ?? null
}

function mapDslNodesToCanvasNodes(revision: WorkflowDefinitionRevision): WorkflowDefinitionNode[] {
  const rawNodes = getArray(revision.dsl_json.nodes)
  const wires = getDslWires(revision.dsl_json)
  const layoutIndex = createWorkflowLayoutIndex(revision.layout_json)
  const outputPortsByNodeId = indexWireOutputPorts(wires)
  const nodes = rawNodes.map((rawNode, index) => {
    const node = getRecord(rawNode)
    const uid = getString(node.uid) ?? `node-${index + 1}`
    const nodeType = getString(node.type) ?? 'workflow.node@1'
    const alias = getString(node.alias)
    const nodeInputs = getRecord(node.inputs)
    const layoutNode = layoutIndex.nodesById.get(uid) ?? {}
    const settings = readNodeSettings(nodeType, nodeInputs, layoutNode)
    const kind = inferNodeKind(nodeType, settings)
    const isReviewGate = isReviewGateNodeType(nodeType)
    const isPromptTool = isPromptToolNodeType(nodeType)
    const inputs = isReviewGate
      ? reviewGateInputPorts().map((port) => port.id)
      : isPromptTool
        ? promptToolInputPorts(nodeType).map((port) => port.id)
      : kind === 'image'
        ? imageInputPortsForTask(getImageTask(settings)).map((port) => port.id)
        : Object.keys(nodeInputs)
    const outputs = outputPortsByNodeId.get(uid) ?? []
    const inputPorts = isReviewGate
      ? reviewGateInputPorts()
      : isPromptTool
        ? promptToolInputPorts(nodeType)
      : kind === 'image'
        ? imageInputPortsForTask(getImageTask(settings))
        : readLayoutPorts(layoutNode.input_ports, inputs, 'input')
    const outputPorts = isReviewGate
      ? reviewGateOutputPorts()
      : isPromptTool
        ? promptToolOutputPorts()
      : kind === 'image'
        ? imageOutputPorts()
        : readLayoutPorts(layoutNode.output_ports, outputs, 'output')
    const imageLabel = kind === 'image'
      ? imageDisplayLabelForSettings(settings, {
          provider: getString(layoutNode.provider),
          subtitle: getString(layoutNode.subtitle),
        })
      : null

    return {
      id: uid,
      title: getWorkflowNodeTitle(nodeType, alias),
      subtitle: kind === 'image'
        ? imageDisplayText(getString(layoutNode.subtitle), imageLabel)
        : getWorkflowNodeSubtitle(nodeType),
      kind,
      provider: imageLabel ?? publicWorkflowByline(getString(layoutNode.provider) ?? inferNodeProvider(nodeType)),
      status: 'never',
      cost: '0c',
      description: getWorkflowNodeDescription(
        nodeType,
        getString(nodeInputs.description)
          ?? getString(nodeInputs.instruction)
          ?? getString(nodeInputs.prompt),
      ),
      position: readLayoutPosition(layoutIndex, uid, index, layoutNode),
      inputs: inputPorts.map((port) => port.id),
      outputs: outputPorts.map((port) => port.id),
      inputPorts,
      outputPorts,
      settings,
    } satisfies WorkflowDefinitionNode
  })

  const dslNodeIds = new Set(nodes.map((node) => node.id))
  const layoutOnlyNodes = readLayoutOnlyCanvasNodes(revision.layout_json, layoutIndex, nodes.length, dslNodeIds)
  const mappedNodes = [...nodes, ...layoutOnlyNodes]

  return mappedNodes.length > 0 ? mappedNodes : createRevisionSummaryNodes(revision)
}

function mapRevisionToCanvasEdges(
  revision: WorkflowDefinitionRevision,
  nodeIds: Set<string>,
): WorkflowDefinitionEdge[] {
  const dslEdges = mapDslWiresToCanvasEdges(revision.dsl_json)
  const seenEdges = new Set(dslEdges.map(workflowEdgeIdentity))
  const layoutEdges = readLayoutCanvasEdges(revision.layout_json, nodeIds, seenEdges)
  return [...dslEdges, ...layoutEdges]
}

function mapDslWiresToCanvasEdges(dslJson: Record<string, unknown>): WorkflowDefinitionEdge[] {
  return getDslWires(dslJson)
    .map((wire, index) => {
      const source = getString(wire.from)
      const target = getString(wire.to)
      if (!source || !target) return null
      const port = getString(wire.port)
      const input = getString(wire.input)
      const normalizedPort = port ? normalizePortName(port) : null
      const normalizedInput = input ? normalizePortName(input) : null
      const edge: WorkflowDefinitionEdge = {
        id: `${source}-${target}-${port ?? 'out'}-${input ?? 'in'}-${index}`,
        source,
        target,
        sourceHandle: normalizedPort ? `output:${normalizedPort}` : null,
        targetHandle: normalizedInput ? `input:${normalizedInput}` : null,
      }

      if (normalizedPort) edge.sourcePort = normalizedPort
      if (normalizedInput) edge.targetInput = normalizedInput
      if (port && input) edge.label = `${port}->${input}`
      return edge
    })
    .filter(isWorkflowDefinitionEdge)
}

function readLayoutCanvasEdges(
  layoutJson: Record<string, unknown>,
  nodeIds: Set<string>,
  seenEdges: Set<string>,
): WorkflowDefinitionEdge[] {
  return getArray(layoutJson.edges)
    .map((rawEdge, index) => {
      const layoutEdge = getRecord(rawEdge)
      const source = getString(layoutEdge.source) ?? getString(layoutEdge.original_source)
      const target = getString(layoutEdge.target) ?? getString(layoutEdge.original_target)
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return null

      const sourcePort = getString(layoutEdge.source_port)
        ?? getString(layoutEdge.sourcePort)
        ?? getString(layoutEdge.port)
      const targetInput = getString(layoutEdge.target_input)
        ?? getString(layoutEdge.targetInput)
        ?? getString(layoutEdge.input)
      const normalizedPort = sourcePort ? normalizePortName(sourcePort) : null
      const normalizedInput = targetInput ? normalizePortName(targetInput) : null
      const edge: WorkflowDefinitionEdge = {
        id: getString(layoutEdge.id) ?? `${source}-${target}-${sourcePort ?? 'out'}-${targetInput ?? 'in'}-layout-${index}`,
        source,
        target,
        sourceHandle: normalizedPort ? `output:${normalizedPort}` : null,
        targetHandle: normalizedInput ? `input:${normalizedInput}` : null,
      }

      if (normalizedPort) edge.sourcePort = normalizedPort
      if (normalizedInput) edge.targetInput = normalizedInput
      if (sourcePort && targetInput) edge.label = `${sourcePort}->${targetInput}`
      const identity = workflowEdgeIdentity(edge)
      if (seenEdges.has(identity)) return null
      seenEdges.add(identity)
      return edge
    })
    .filter(isWorkflowDefinitionEdge)
}

function workflowEdgeIdentity(edge: WorkflowDefinitionEdge) {
  return [
    edge.source,
    edge.target,
    edge.sourcePort ?? '',
    edge.targetInput ?? '',
  ].join('|')
}

function getDslWires(dslJson: Record<string, unknown>) {
  return getArray(dslJson.wires).map(getRecord)
}

function createWorkflowLayoutIndex(layoutJson: Record<string, unknown>) {
  const nodesById = new Map<string, Record<string, unknown>>()
  for (const rawNode of getArray(layoutJson.nodes)) {
    const node = getRecord(rawNode)
    for (const key of [getString(node.uid), getString(node.id), getString(node.node_uid)]) {
      if (key && !nodesById.has(key)) nodesById.set(key, node)
    }
  }

  return {
    nodesById,
    nodesRecord: getRecord(layoutJson.nodes),
    positionsRecord: getRecord(layoutJson.positions),
  }
}

function indexWireOutputPorts(wires: Record<string, unknown>[]) {
  const portsByNodeId = new Map<string, string[]>()
  const seenPortsByNodeId = new Map<string, Set<string>>()
  for (const wire of wires) {
    const nodeId = getString(wire.from)
    if (!nodeId) continue
    const port = getString(wire.port) ?? 'output'
    const seenPorts = seenPortsByNodeId.get(nodeId) ?? new Set<string>()
    if (seenPorts.has(port)) continue
    seenPorts.add(port)
    seenPortsByNodeId.set(nodeId, seenPorts)
    const ports = portsByNodeId.get(nodeId) ?? []
    ports.push(port)
    portsByNodeId.set(nodeId, ports)
  }
  return portsByNodeId
}

function readLayoutPosition(
  layoutIndex: ReturnType<typeof createWorkflowLayoutIndex>,
  uid: string,
  index: number,
  fromNodesArray: Record<string, unknown>,
) {
  const fromNodesRecord = getRecord(layoutIndex.nodesRecord[uid])
  const fromPositionsRecord = getRecord(layoutIndex.positionsRecord[uid])

  return readPosition(fromNodesArray)
    ?? readPosition(fromNodesRecord)
    ?? readPosition(fromPositionsRecord)
    ?? { x: 80 + (index % 4) * 320, y: 160 + Math.floor(index / 4) * 190 }
}

function readLayoutPorts(
  value: unknown,
  fallbackNames: string[],
  direction: 'input' | 'output',
): WorkflowNodePort[] {
  const rawPorts = getArray(value)
  if (Array.isArray(value) && rawPorts.length === 0) return []
  if (rawPorts.length === 0) {
    return normalizeWorkflowPorts(undefined, fallbackNames.length ? fallbackNames : [direction === 'input' ? 'input' : 'output'], direction)
  }

  return normalizeWorkflowPorts(rawPorts.map((rawPort) => {
    const port = getRecord(rawPort)
    return {
      id: getString(port.id) ?? getString(port.name) ?? '',
      label: getString(port.label) ?? getString(port.name) ?? getString(port.id) ?? '',
      type: getWorkflowPortType(port.type),
      required: typeof port.required === 'boolean' ? port.required : undefined,
    } satisfies WorkflowNodePort
  }), undefined, direction)
}

function readNodeSettings(
  nodeType: string,
  nodeInputs: Record<string, unknown>,
  layoutNode: Record<string, unknown>,
) {
  const layoutSettings = getRecord(layoutNode.settings)
  if (isReviewGateNodeType(nodeType)) {
    const copyMode = getReviewCopyMode({
      ...nodeInputs,
      ...layoutSettings,
    })
    return sanitizeReviewGateSettings({
      ...layoutSettings,
      node_type: 'review_gate@1',
      review_gate: true,
      review_mode: layoutSettings.review_mode ?? getReviewModeFromInputs(nodeInputs),
      approval_copy_mode: copyMode,
    })
  }
  if (isPromptGenerateNodeType(nodeType)) {
    return {
      ...layoutSettings,
      node_type: 'prompt_generate@1',
      instruction: layoutSettings.instruction ?? nodeInputs.instruction ?? nodeInputs.prompt ?? '',
      model_id: layoutSettings.model_id ?? nodeInputs.model_id ?? DEFAULT_PROMPT_MODEL_ID,
    }
  }
  if (isPromptEnhanceNodeType(nodeType)) {
    return {
      ...layoutSettings,
      node_type: 'prompt_enhance@1',
      prompt: layoutSettings.prompt ?? nodeInputs.prompt ?? '',
      model_id: layoutSettings.model_id ?? nodeInputs.model_id ?? DEFAULT_PROMPT_MODEL_ID,
    }
  }
  if (isVideoGenerateNodeType(nodeType)) {
    return {
      ...layoutSettings,
      node_type: 'video_generate@1',
      render_task: layoutSettings.render_task ?? 'text_to_video',
      prompt: layoutSettings.prompt ?? nodeInputs.prompt ?? '',
      aspect_ratio: layoutSettings.aspect_ratio ?? nodeInputs.aspect_ratio ?? '16:9',
      style: layoutSettings.style ?? nodeInputs.style ?? 'mock video render',
      duration_seconds: layoutSettings.duration_seconds ?? nodeInputs.duration_seconds ?? 5,
      model_id: layoutSettings.model_id ?? nodeInputs.model_id,
      first_frame_url: layoutSettings.first_frame_url ?? nodeInputs.first_frame_url,
      image_url: layoutSettings.image_url ?? nodeInputs.image_url,
    }
  }
  if (inferNodeKind(nodeType, layoutSettings) !== 'image') return layoutSettings

  const rawTask = layoutSettings.image_task ?? nodeInputs.task ?? 'text_to_image'
  const task = getImageTask({
    ...layoutSettings,
    image_task: rawTask,
  })
  const rawModelId = layoutSettings.model_id === AUTO_IMAGE_MODEL_ID && nodeInputs.model_id !== undefined
    ? nodeInputs.model_id
    : layoutSettings.model_id ?? nodeInputs.model_id ?? AUTO_IMAGE_MODEL_ID
  const modelId = getImageModelIdForTask(
    { ...layoutSettings, model_id: rawModelId },
    task,
    {
      provider: getString(layoutNode.provider),
      subtitle: getString(layoutNode.subtitle),
    },
  )

  return {
    ...layoutSettings,
    ...readImageOptionSettings(nodeInputs, layoutSettings),
    node_type: 'image_generate@1',
    image_task: rawTask,
    image_count: layoutSettings.image_count ?? nodeInputs.count ?? 1,
    model_id: modelId ?? AUTO_IMAGE_MODEL_ID,
  }
}

function readLayoutOnlyCanvasNodes(
  layoutJson: Record<string, unknown>,
  layoutIndex: ReturnType<typeof createWorkflowLayoutIndex>,
  startIndex: number,
  existingNodeIds: Set<string>,
): WorkflowDefinitionNode[] {
  return getArray(layoutJson.nodes)
    .map(getRecord)
    .filter((node) => {
      const id = getString(node.id) ?? getString(node.uid) ?? getString(node.node_uid)
      if (!id || existingNodeIds.has(id)) return false
      return getString(node.kind) === 'note' || getString(node.kind) === 'input'
    })
    .map((node, index) => {
      const id = getString(node.id) ?? getString(node.uid) ?? getString(node.node_uid) ?? `layout-${index + 1}`
      const settings = getRecord(node.settings)
      const kind = getString(node.kind) === 'input' ? 'input' : 'note'
      const fallbackOutput = getString(settings.helper_input) ?? 'output'
      const inputPorts = kind === 'input'
        ? readLayoutPorts(node.input_ports ?? [], [], 'input')
        : []
      const outputPorts = kind === 'input'
        ? readLayoutPorts(node.output_ports, [fallbackOutput], 'output')
        : []

      return {
        id,
        title: getString(node.title) ?? (kind === 'input' ? humanizePortName(fallbackOutput) : 'Guide'),
        subtitle: getString(node.subtitle) ?? (kind === 'input' ? 'Canvas input' : 'Canvas note'),
        kind,
        provider: publicWorkflowByline(getString(node.provider)) || (kind === 'input' ? 'Input' : 'Note'),
        status: 'never',
        cost: getString(node.cost) ?? '0c',
        description: getString(node.description) ?? getString(settings.helper_value) ?? '',
        position: readLayoutPosition(
          layoutIndex,
          id,
          startIndex + index,
          layoutIndex.nodesById.get(id) ?? node,
        ),
        settings,
        inputs: inputPorts.map((port) => port.id),
        outputs: outputPorts.map((port) => port.id),
        inputPorts,
        outputPorts,
      } satisfies WorkflowDefinitionNode
    })
}

function readPosition(record?: Record<string, unknown>) {
  if (!record) return null
  const directX = getNumber(record.x)
  const directY = getNumber(record.y)
  if (directX != null && directY != null) return { x: directX, y: directY }

  const position = getRecord(record.position)
  const x = getNumber(position.x)
  const y = getNumber(position.y)
  return x != null && y != null ? { x, y } : null
}

function isWorkflowDefinitionEdge(edge: WorkflowDefinitionEdge | null): edge is WorkflowDefinitionEdge {
  return Boolean(edge)
}

function inferTriggerLabel(nodes: WorkflowDefinitionNode[]) {
  const trigger = nodes.find((node) => node.kind === 'trigger')
  return trigger?.title ?? 'Manual run'
}

function inferNodeKind(nodeType: string, settings: Record<string, unknown> = {}): WorkflowDefinitionNode['kind'] {
  const value = nodeType.toLowerCase()
  if ((value === 'input@1' || value.includes('input@1')) && settings.helper_input) return 'input'
  if (value.includes('trigger') || value.includes('event')) return 'trigger'
  if (value.includes('publish') || value.includes('upload')) return 'publish'
  if (value.includes('image_generate') || value.includes('image.generate')) return 'image'
  if (value.includes('render') || value.includes('video') || value.includes('thumbnail')) return 'render'
  if (value.includes('review') || value.includes('gate') || value.includes('if') || value.includes('branch') || value.includes('router') || value.includes('merge')) return 'logic'
  if (value.includes('analytics') || value.includes('metric') || value.includes('watch')) return 'analytics'
  if (value.includes('ai') || value.includes('llm') || value.includes('model') || value.includes('prompt')) return 'ai'
  return 'provider'
}

function inferNodeProvider(nodeType: string) {
  return getWorkflowNodeProvider(nodeType)
}

function formatWorkflowDate(value: string, locale = 'en') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

const workflowNodeStatusSchema = z.object({
  pricingSource: z.enum(['explicit_free', 'provider_model_rule', 'declared_flat', 'node_calculator', 'runtime_profile']).nullable().optional().catch(null),
  finalPolicy: z.enum(['provider_rule_actual', 'contract_rate_actual_units', 'locked_estimate', 'node_reported']).nullable().optional().catch(null),
  nodeKey: z.string(),
  nodeType: z.string(),
  status: z.string(),
  creditsCharged: z.number().catch(0),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  // GEN-04: the node's result is already stored while the node/run is still finishing.
  outputReady: workflowNodeOutputReadyField,
})

const workflowListItemSchema = z.object({
  workflowId: z.string(),
  projectId: z.string(),
  status: z.string(),
  priority: z.string(),
  totalNodes: z.number().catch(0),
  totalCreditsCharged: z.number().catch(0),
  currentNodeKey: z.string().nullable().catch(null),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  createdAt: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
})

const workflowListResponseSchema = z.object({
  data: z.object({
    workflows: z.array(workflowListItemSchema).catch([]),
    total: z.number().catch(0),
    limit: z.number().catch(20),
    offset: z.number().catch(0),
  }),
})

const workflowDetailSchema = z.object({
  workflowId: z.string(),
  projectId: z.string(),
  templateId: z.string().nullable().catch(null),
  status: z.string(),
  priority: z.string(),
  currentNodeKey: z.string().nullable().catch(null),
  pausedReason: z.string().nullable().catch(null),
  errorMessage: z.string().nullable().catch(null).transform((value) => toPublicRuntimeError(value)?.message ?? null),
  progress: z.number().catch(0),
  totalNodes: z.number().catch(0),
  completedNodes: z.number().catch(0),
  failedNodes: z.number().catch(0),
  skippedNodes: z.number().catch(0),
  totalCreditsEstimated: z.number().catch(0),
  totalCreditsReserved: z.number().catch(0),
  totalCreditsCharged: z.number().catch(0),
  runType: z.string().optional().catch(undefined),
  invocationSource: z.string().optional().catch(undefined),
  cancelMode: z.string().nullable().optional().catch(null),
  cancelRequestedAt: z.string().nullable().optional().catch(null),
  settlementStatus: z.string().optional().catch(undefined),
  settlementPendingReason: z.string().nullable().optional().catch(null),
  creditReservation: workflowCreditReservationSchema.nullable().optional().catch(null),
  // Payment-review delivery hold; only the status poll reports it (see mergeWorkflowRuntimeStatus).
  deliveryStatus: z.literal('payment_review').optional().catch(undefined),
  // LAT-01: filled from the status poll (see mergeWorkflowRuntimeStatus); the detail read may omit them.
  runtimeTerminal: z.boolean().optional().catch(undefined),
  financeSettlement: z.enum(['pending', 'settled', 'attention']).optional().catch(undefined),
  artifactDelivery: z.enum(['pending', 'ready', 'held', 'none']).optional().catch(undefined),
  outputReady: z.boolean().optional().catch(undefined),
  startedAt: z.string().nullable().catch(null),
  finishedAt: z.string().nullable().catch(null),
  durationMs: z.number().nullable().catch(null),
  createdAt: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
  dslJson: z.record(z.unknown()).catch({}),
  nodes: z.array(workflowNodeStatusSchema).catch([]),
})

const workflowDetailResponseSchema = z.object({
  data: workflowDetailSchema,
})

export type WorkflowRuntimeListItem = z.infer<typeof workflowListItemSchema>
export type WorkflowRuntimeDetail = z.infer<typeof workflowDetailSchema>

export async function listWorkflows(input: {
  status?: string | null
  limit?: number
  offset?: number
} = {}, options: GatewayRequestOptions = {}) {
  const query = new URLSearchParams()
  if (input.status) query.set('status', input.status)
  if (input.limit != null) query.set('limit', String(input.limit))
  if (input.offset != null) query.set('offset', String(input.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await gatewayRequest(`/api/v1/workflows${suffix}`, {
    schema: workflowListResponseSchema,
    signal: options.signal,
  })
  return response.data
}

export async function getWorkflow(workflowId: string, options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest(`/api/v1/workflows/${encodeURIComponent(workflowId)}`, {
    schema: workflowDetailResponseSchema,
    signal: options.signal,
  })
  return response.data
}

function hashString(value: string) {
  let h1 = 0xdeadbeef ^ value.length
  let h2 = 0x41c6ce57 ^ value.length
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

'use client'

import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { productionG1ReplySchema, type ProductionG1Reply } from '@/lib/assistant/production-launch-api'
import { gatewayRequest } from '@/lib/gateway/client'
import { toPublicRuntimeError } from '@/lib/public-runtime-error'
import { publicCatalogText, publicInputSchema, publicMetadataRecord, publicModelLabel, publicModelQuality, publicModelSpeed, publicModelEstimatedCredits, publicModelCostLabel, publicModelPricingRule, publicModelVisibility } from '@/lib/public-model-display'

export const ASSISTANT_CONVERSATIONS_QUERY_KEY = ['assistant', 'conversations'] as const
export const ASSISTANT_ACTIVE_RUNS_QUERY_KEY = ['assistant', 'active-runs'] as const
export const ASSISTANT_COMPOSER_CATALOG_QUERY_KEY = ['assistant', 'composer-catalog'] as const
export const ASSISTANT_CONVERSATIONS_UPDATED_EVENT = 'youtorch:assistant-conversations-updated'

const assistantRunStateSchema = z.enum([
  'created',
  'running',
  'waiting_for_user',
  'waiting_for_approval',
  'waiting_for_payment',
  'waiting_on_workflow',
  'waiting_on_agent',
  'cancelling',
  'draining',
  'cancellation_attention_required',
  'completed',
  'failed',
  'cancelled',
])

const assistantMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])

const assistantConversationSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().catch(null),
  title: z.string().nullable().catch(null),
  status: z.string(),
  metadata: z.record(z.unknown()).catch({}).transform(publicMetadataRecord),
  last_message_at: z.string().nullable().catch(null),
  archived_at: z.string().nullable().catch(null),
  deleted_at: z.string().nullable().catch(null),
  version: z.number().catch(0),
  created_at: z.string(),
  updated_at: z.string(),
})

const assistantMessageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  run_id: z.string().nullable().catch(null),
  role: assistantMessageRoleSchema,
  content: z.string(),
  content_json: z.record(z.unknown()).catch({}).transform(publicMetadataRecord),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().catch(null),
})

const assistantRunSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  trigger_message_id: z.string(),
  state: assistantRunStateSchema,
  model_id: z.string().nullable().catch(null),
  planner_version: z.string().nullable().catch(null),
  metadata: z.record(z.unknown()).catch({}).transform(publicMetadataRecord),
  error_code: z.string().nullable().catch(null),
  error_message: z.string().nullable().catch(null),
  started_at: z.string().nullable().catch(null),
  completed_at: z.string().nullable().catch(null),
  failed_at: z.string().nullable().catch(null),
  cancelled_at: z.string().nullable().catch(null),
  version: z.number().catch(0),
  created_at: z.string(),
  updated_at: z.string(),
})

export const assistantRunEventSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  sequence: z.number().catch(0),
  event_type: z.string(),
  payload: z.record(z.unknown()).catch({}).transform(publicMetadataRecord),
  public: z.boolean().catch(true),
  transient: z.boolean().optional().catch(false),
  created_at: z.preprocess((value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    return new Date().toISOString()
  }, z.string()),
}).transform(sanitizeAssistantRunEvent)

const assistantConversationListResponseSchema = z.object({
  data: z.object({
    conversations: z.array(assistantConversationSchema).catch([]),
    total: z.number().catch(0),
  }),
})

const assistantConversationResponseSchema = z.object({
  data: assistantConversationSchema,
})

const assistantConversationDetailResponseSchema = z.object({
  data: z.object({
    conversation: assistantConversationSchema,
    messages: z.array(assistantMessageSchema).catch([]),
    next_message_cursor: z.string().nullable(),
  }),
})

const assistantMessagePageResponseSchema = z.object({
  data: z.object({
    messages: z.array(assistantMessageSchema),
    next_cursor: z.string().nullable(),
  }),
})

const assistantActiveRunSummarySchema = z.object({
  run_id: z.string(),
  conversation_id: z.string(),
  state: assistantRunStateSchema,
  waiting_reason: z.string().nullable(),
  updated_at: z.string().datetime(),
  conversation_archived: z.boolean(),
})

const assistantActiveRunPageResponseSchema = z.object({
  data: z.object({
    runs: z.array(assistantActiveRunSummarySchema),
    conversation_ids: z.array(z.string()),
    next_cursor: z.string().nullable(),
  }),
})

const assistantMessageAppendResponseSchema = z.object({
  data: z.object({
    message: assistantMessageSchema,
    run: assistantRunSchema,
    event: assistantRunEventSchema,
    outbox_event: z.object({
      id: z.string(),
      status: z.string(),
    }).strip(),
    replayed: z.boolean().catch(false),
  }),
})

const assistantMessageAddResponseSchema = z.object({
  data: z.union([assistantMessageAppendResponseSchema.shape.data, productionG1ReplySchema]),
})

const assistantRunStatusResponseSchema = z.object({
  data: z.object({
    run_id: z.string(),
    conversation_id: z.string(),
    state: assistantRunStateSchema,
    // QA-081: the job version a steer fences with (P01-15 run status / snapshot).
    job_version: z.number().int().min(0).optional().catch(undefined),
    error_code: z.string().nullable().catch(null),
    error_message: z.string().nullable().catch(null),
    started_at: z.string().nullable().catch(null),
    completed_at: z.string().nullable().catch(null),
    failed_at: z.string().nullable().catch(null),
    cancelled_at: z.string().nullable().catch(null),
    updated_at: z.string(),
  }),
})

const assistantRunEventsResponseSchema = z.object({
  data: z.object({
    events: z.array(assistantRunEventSchema).catch([]),
  }),
})

const stopAssistantRunResponseSchema = z.object({
  data: z.object({
    run_id: z.string(),
    state: assistantRunStateSchema,
    cancelled: z.boolean().catch(false),
    cancel_requested: z.boolean().catch(false),
    replayed: z.boolean().catch(false),
    event: assistantRunEventSchema.nullable().catch(null),
    skipped: z.boolean().catch(false),
  }).strip(),
})

const resumeAssistantRunResponseSchema = z.object({
  data: z.object({
    run_id: z.string(),
    state: z.string(),
    payment_wait_state_id: z.string(),
    resume_mode: z.string(),
    downstream_called: z.boolean().catch(false),
    skipped: z.boolean().catch(false),
    events: z.array(assistantRunEventSchema).catch([]),
  }),
})

const continueAssistantRunResponseSchema = z.object({
  data: z.object({
    run_id: z.string(),
    state: assistantRunStateSchema,
    skipped: z.boolean().catch(false),
    event: assistantRunEventSchema.nullable().catch(null),
  }),
})

const assistantComposerChatProfileIdSchema = z.enum(['fast', 'pro', 'max'])
const assistantComposerApprovalModeSchema = z.enum(['ask', 'autonomous'])
const assistantComposerAspectRatioSchema = z.enum(['16:9', '9:16', '1:1'])

export const assistantComposerSelectionSchema = z.object({
  chat_profile: assistantComposerChatProfileIdSchema,
  model_id: z.string(),
  approval_mode: assistantComposerApprovalModeSchema,
  video_duration_seconds: z.number(),
  aspect_ratio: assistantComposerAspectRatioSchema,
  selected_models: z.record(z.string().nullable()).catch({}),
  selected_model_inputs: z.record(z.record(z.unknown())).catch({}),
})

const assistantComposerModelRefSchema = z.object({
  id: z.string(),
  label: z.string().transform((value) => publicModelLabel(value)),
  capability: z.string(),
  model_type: z.enum(['concrete', 'auto']),
  description: z.string().catch('Model').transform((value) => publicCatalogText(value, 'Model')),
  quality: z.string().catch('Standard').transform((value) => publicModelQuality(value)),
  speed: z.string().catch('Standard').transform((value) => publicModelSpeed(value)),
  cost_label: z.string().catch('Estimate unavailable'),
  estimated_credits: z.number().nullable().catch(null),
  input_schema: z.record(z.unknown()).catch({}).transform(publicInputSchema),
  pricing_rule: z.record(z.unknown()).catch({}).transform(publicModelPricingRule),
  rate_limit: z.record(z.unknown()).catch({}).transform(() => ({})),
  capacity_limit: z.record(z.unknown()).catch({}).transform(() => ({})),
  visibility: z.record(z.unknown()).catch({}).transform(publicModelVisibility),
  cost_metadata: z.record(z.unknown()).catch({}).transform(() => ({})),
}).transform((model) => ({ ...model, cost_label: publicModelCostLabel(model.cost_label, model.estimated_credits), estimated_credits: publicModelEstimatedCredits(model.estimated_credits, model.cost_label) }))

export const assistantComposerCatalogDataSchema = z.object({
    plan_type: z.string(),
    defaults: assistantComposerSelectionSchema,
    chat_profiles: z.array(z.object({
      id: assistantComposerChatProfileIdSchema,
      label: z.string(),
      detail: z.string().transform((value) => publicCatalogText(value)),
      model_id: z.string(),
      model_label: z.string().transform((value) => publicModelLabel(value)),
      estimated_credits: z.number().nullable().catch(null),
    })).catch([]),
    chat_models: z.array(assistantComposerModelRefSchema).catch([]),
    image_models: z.array(assistantComposerModelRefSchema).catch([]),
    video_models: z.array(assistantComposerModelRefSchema).catch([]),
    aspect_ratios: z.array(z.object({
      id: assistantComposerAspectRatioSchema,
      label: z.string(),
      detail: z.string(),
    })).catch([]),
    duration: z.object({
      min_seconds: z.number().int().positive(),
      default_seconds: z.number().int().positive(),
      max_seconds: z.number().int().positive(),
      scale_max_seconds: z.number().int().positive().optional(),
      step_seconds: z.number().int().positive(),
      source_feature_key: z.string().catch('max_video_duration_seconds'),
    }),
    approval_modes: z.array(z.object({
      id: assistantComposerApprovalModeSchema,
      label: z.string(),
      detail: z.string(),
    })).catch([]),
    // P03-01 (Q74): canonical three-level modes (Ask / Auto / Tam erişim); older gateways omit the list.
    modes: z.array(z.object({
      id: z.enum(['ask', 'auto', 'auto_full']),
      label: z.string(),
      detail: z.string(),
    })).catch([]),
    source: z.string().catch('model_catalog'),
})

const assistantComposerCatalogResponseSchema = z.object({
  data: assistantComposerCatalogDataSchema,
})

// P01-11 settings-lifecycle v1 (server authority for the job's planner model; P01A-11 runtime). Only the fields the
// composer reads are parsed; the server stays the single owner of the settings.
const assistantSettingsModeSchema = z.enum(['ask', 'auto', 'auto_full'])

const assistantConversationSettingsResponseSchema = z.object({
  data: z.object({
    defaults: z.object({
      conversation_id: z.string(),
      defaults_version: z.number().int(),
      default_mode: assistantSettingsModeSchema,
      default_planner_model_id: z.string(),
    }),
    job: z.object({
      job_id: z.string(),
      job_settings_version: z.number().int(),
      requested_planner_model_id: z.string(),
      effective_planner_model_id: z.string(),
      pending_model_switch: z.object({ target_model_id: z.string(), command_id: z.string() }).nullable().catch(null),
      model_epoch: z.number().int(),
      // P03-01/P03-14: the selected job's own mode (requested vs. effective, e.g. Tam erişim without consent).
      requested_mode: assistantSettingsModeSchema.nullable().optional().catch(null),
      effective_mode: assistantSettingsModeSchema.nullable().optional().catch(null),
    }).nullable().catch(null),
  }),
})

export const assistantSettingsCommandOutcomeSchema = z.enum([
  'applied',
  'replayed',
  'rejected_idempotency_conflict',
  'rejected_forbidden',
  'rejected_defaults_owner_only',
  'rejected_missing_target',
  'rejected_target_not_found',
  'rejected_target_terminal',
  'rejected_full_access_consent_required',
  'rejected_unsupported_model',
  'conflict',
])

const assistantSettingsCommandResponseSchema = z.object({
  data: z.object({
    command_id: z.string(),
    outcome: assistantSettingsCommandOutcomeSchema,
    conversation_defaults_version: z.number().int(),
    job_settings_version: z.number().int().optional(),
  }),
})

export type AssistantRunState = z.infer<typeof assistantRunStateSchema>
export type AssistantConversation = z.infer<typeof assistantConversationSchema>
export type AssistantMessage = z.infer<typeof assistantMessageSchema>
export type AssistantRun = z.infer<typeof assistantRunSchema>
export type AssistantRunEvent = z.infer<typeof assistantRunEventSchema>
export type AssistantConversationDetail = z.infer<typeof assistantConversationDetailResponseSchema>['data']
export type AssistantMessagePage = z.infer<typeof assistantMessagePageResponseSchema>['data']
export type AssistantActiveRunSummary = z.infer<typeof assistantActiveRunSummarySchema>
export type AssistantActiveRunPage = z.infer<typeof assistantActiveRunPageResponseSchema>['data']
export type AssistantMessageAppendResult = z.infer<typeof assistantMessageAppendResponseSchema>['data']
export type AssistantRunStatus = z.infer<typeof assistantRunStatusResponseSchema>['data']
export type AssistantComposerSelection = z.infer<typeof assistantComposerSelectionSchema>
export type AssistantComposerCatalog = z.infer<typeof assistantComposerCatalogResponseSchema>['data']
export type AssistantConversationSettings = z.infer<typeof assistantConversationSettingsResponseSchema>['data']
export type AssistantSettingsCommandOutcome = z.infer<typeof assistantSettingsCommandOutcomeSchema>
export type AssistantSettingsCommandResult = z.infer<typeof assistantSettingsCommandResponseSchema>['data']
type AssistantGatewayOptions = { signal?: AbortSignal }

export const ASSISTANT_CONVERSATION_SETTINGS_QUERY_KEY = ['assistant', 'conversation-settings'] as const

/** Server settings of a conversation and, when `jobId` is given, of that exact job (P01-11/P01A-11). */
export async function getAssistantConversationSettings(
  input: { conversationId: string; jobId?: string | null },
  options: AssistantGatewayOptions = {},
): Promise<AssistantConversationSettings> {
  const query = input.jobId ? `?job_id=${encodeURIComponent(input.jobId)}` : ''
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/${encodeURIComponent(input.conversationId)}/settings${query}`,
    { schema: assistantConversationSettingsResponseSchema, signal: options.signal },
  )
  return result.data
}

/**
 * Planner model change (settings_command_v1). With an exact selected job the change applies to that job's next
 * inference boundary and to new jobs (dual-version CAS); without one only the new-job default changes. The result is
 * explicit and never partial: a stale version is `conflict`, a gone target is rejected, never broadcast.
 */
export async function issueAssistantPlannerModelCommand(input: {
  conversationId: string
  plannerModelId: string
  expectedConversationDefaultsVersion: number
  selectedJob?: { jobId: string; expectedJobSettingsVersion: number } | null
  /**
   * S9: change only the selected job (`selected_job_only`, no defaults version). Used when the server said the new-job
   * default belongs to the conversation owner but the actor started this job.
   */
  jobOnly?: boolean
  idempotencyKey?: string
}): Promise<AssistantSettingsCommandResult> {
  const jobOnly = Boolean(input.jobOnly && input.selectedJob)
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/${encodeURIComponent(input.conversationId)}/settings-commands`,
    {
      method: 'POST',
      csrf: true,
      body: {
        idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-settings'),
        scope: jobOnly ? 'selected_job_only' : input.selectedJob ? 'selected_job_and_future' : 'future_jobs_only',
        ...(input.selectedJob
          ? {
            selected_job_id: input.selectedJob.jobId,
            expected_job_settings_version: input.selectedJob.expectedJobSettingsVersion,
          }
          : {}),
        ...(jobOnly ? {} : { expected_conversation_defaults_version: input.expectedConversationDefaultsVersion }),
        changes: { planner_model_id: input.plannerModelId },
        source: 'composer_control',
      },
      schema: assistantSettingsCommandResponseSchema,
    },
  )
  return result.data
}

/**
 * P03-01 (Q74) mode change through the same settings_command_v1 authority as the planner model: with an exact selected
 * job it applies to that job's next dispatch and to new jobs (dual-version CAS); without one only the new-job default
 * changes (`future_jobs_only`). `auto_full` without the user's full-access consent is refused by the server.
 */
export async function issueAssistantModeCommand(input: {
  conversationId: string
  mode: 'ask' | 'auto' | 'auto_full'
  expectedConversationDefaultsVersion: number
  selectedJob?: { jobId: string; expectedJobSettingsVersion: number } | null
  fullAccessConsentId?: string | null
  idempotencyKey?: string
}): Promise<AssistantSettingsCommandResult> {
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/${encodeURIComponent(input.conversationId)}/settings-commands`,
    {
      method: 'POST',
      csrf: true,
      body: {
        idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-settings'),
        scope: input.selectedJob ? 'selected_job_and_future' : 'future_jobs_only',
        ...(input.selectedJob
          ? {
            selected_job_id: input.selectedJob.jobId,
            expected_job_settings_version: input.selectedJob.expectedJobSettingsVersion,
          }
          : {}),
        expected_conversation_defaults_version: input.expectedConversationDefaultsVersion,
        changes: { mode: input.mode },
        source: 'composer_control',
        ...(input.fullAccessConsentId ? { full_access_consent_id: input.fullAccessConsentId } : {}),
      },
      schema: assistantSettingsCommandResponseSchema,
    },
  )
  return result.data
}

export async function getAssistantComposerCatalog(): Promise<AssistantComposerCatalog> {
  const result = await gatewayRequest('/api/v1/assistant/composer/catalog', {
    schema: assistantComposerCatalogResponseSchema,
  })
  return result.data
}

export async function listAssistantConversations(
  input: { limit?: number; offset?: number; channelId?: string | null } = {},
  options: AssistantGatewayOptions = {},
) {
  const params = new URLSearchParams()
  params.set('limit', String(input.limit ?? 20))
  params.set('offset', String(input.offset ?? 0))
  if (input.channelId?.trim()) params.set('channel_id', input.channelId.trim())
  const result = await gatewayRequest(`/api/v1/assistant/conversations?${params.toString()}`, {
    schema: assistantConversationListResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function createAssistantConversation(input: {
  title?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const result = await gatewayRequest('/api/v1/assistant/conversations', {
    method: 'POST',
    csrf: true,
    body: {
      title: input.title ?? null,
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-conversation'),
    },
    schema: assistantConversationResponseSchema,
  })
  return result.data
}

export async function getAssistantConversation(
  conversationId: string,
  options: AssistantGatewayOptions = {},
): Promise<AssistantConversationDetail> {
  const result = await gatewayRequest(`/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}`, {
    schema: assistantConversationDetailResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function listAssistantConversationMessages(
  input: { conversationId: string; limit?: number; before?: string | null },
  options: AssistantGatewayOptions = {},
): Promise<AssistantMessagePage> {
  const params = new URLSearchParams()
  params.set('limit', String(input.limit ?? 100))
  if (input.before) params.set('before', input.before)
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/${encodeURIComponent(input.conversationId)}/messages?${params.toString()}`,
    { schema: assistantMessagePageResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function listAssistantActiveRuns(
  input: { limit?: number; before?: string | null } = {},
  options: AssistantGatewayOptions = {},
): Promise<AssistantActiveRunPage> {
  const params = new URLSearchParams()
  params.set('limit', String(input.limit ?? 100))
  if (input.before) params.set('before', input.before)
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/active-runs?${params.toString()}`,
    { schema: assistantActiveRunPageResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function archiveAssistantConversation(conversationId: string): Promise<AssistantConversation> {
  const result = await gatewayRequest(`/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}/archive`, {
    method: 'POST',
    csrf: true,
    schema: assistantConversationResponseSchema,
  })
  return result.data
}

export async function deleteAssistantConversation(conversationId: string): Promise<AssistantConversation> {
  const result = await gatewayRequest(`/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    csrf: true,
    schema: assistantConversationResponseSchema,
  })
  return result.data
}

export async function addAssistantMessage(input: {
  conversationId: string
  content: string
  contentJson?: Record<string, unknown>
  modelId?: string | null
  /** Legacy `approval_mode` selection or the canonical P03-01 selection carrying `mode`. */
  composerSelection?: AssistantComposerSelection | Record<string, unknown> | null
  idempotencyKey?: string
}): Promise<AssistantMessageAppendResult | ProductionG1Reply> {
  // A v1 message context carries its own target (`job_target`, or none = server-resolved, P01-13); the legacy body
  // `mode` never travels with it (the gateway rejects both together).
  const isMessageContextV1 = input.contentJson?.schema_version === 'assistant_message_context_v1'
  const result = await gatewayRequest(
    `/api/v1/assistant/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    {
      method: 'POST',
      csrf: true,
      body: {
        mode: isMessageContextV1 ? undefined : 'new',
        content: input.content,
        content_json: input.contentJson ?? {},
        model_id: input.modelId ?? undefined,
        composer_selection: input.composerSelection ?? undefined,
        idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-message'),
      },
      // P03-09: a written answer to an open presented plan returns the G1 reply instead of a new job.
      schema: assistantMessageAddResponseSchema,
    },
  )
  return result.data
}

export async function answerAssistantRun(input: {
  runId: string
  questionMessageId: string
  content: string
  contentJson?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<AssistantMessageAppendResult> {
  const result = await gatewayRequest(`/api/v1/assistant/runs/${encodeURIComponent(input.runId)}/answer`, {
    method: 'POST',
    csrf: true,
    body: {
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-answer'),
      question_message_id: input.questionMessageId,
      content: input.content,
      content_json: input.contentJson ?? {},
    },
    schema: assistantMessageAppendResponseSchema,
  })
  return result.data
}

export async function getAssistantRunStatus(
  runId: string,
  options: AssistantGatewayOptions = {},
): Promise<AssistantRunStatus> {
  const result = await gatewayRequest(`/api/v1/assistant/runs/${encodeURIComponent(runId)}/status`, {
    schema: assistantRunStatusResponseSchema,
    signal: options.signal,
  })
  return sanitizeAssistantRunStatus(result.data)
}

export async function listAssistantRunEvents(input: {
  runId: string
  afterSequence?: number
  limit?: number
}, options: AssistantGatewayOptions = {}) {
  const params = new URLSearchParams()
  if (input.afterSequence) params.set('after_sequence', String(input.afterSequence))
  params.set('limit', String(input.limit ?? 100))
  const result = await gatewayRequest(
    `/api/v1/assistant/runs/${encodeURIComponent(input.runId)}/events?${params.toString()}`,
    { schema: assistantRunEventsResponseSchema, signal: options.signal },
  )
  return result.data.events.map(sanitizeAssistantRunEvent)
}

export async function stopAssistantRun(input: {
  runId: string
  reason?: string
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/runs/${encodeURIComponent(input.runId)}/stop`, {
    method: 'POST',
    csrf: true,
    body: {
      reason: input.reason ?? 'user_requested',
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-stop'),
    },
    schema: stopAssistantRunResponseSchema,
  })
  return result.data
}

export async function resumeAssistantRun(input: {
  runId: string
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/runs/${encodeURIComponent(input.runId)}/resume`, {
    method: 'POST',
    csrf: true,
    body: {
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-resume'),
    },
    schema: resumeAssistantRunResponseSchema,
  })
  return result.data
}

export async function continueAssistantRun(input: {
  runId: string
  approvalTargetType: 'draft' | 'tool'
  approvalTargetId: string
  approvalTargetHash: string
  idempotencyKey?: string
}) {
  const result = await gatewayRequest(`/api/v1/assistant/runs/${encodeURIComponent(input.runId)}/continue`, {
    method: 'POST',
    csrf: true,
    body: {
      idempotency_key: input.idempotencyKey ?? createAssistantIdempotencyKey('assistant-continue'),
      approval_target_type: input.approvalTargetType,
      approval_target_id: input.approvalTargetId,
      approval_target_hash: input.approvalTargetHash,
    },
    schema: continueAssistantRunResponseSchema,
  })
  return result.data
}

export function getAssistantRunStreamUrl(runId: string) {
  return `${getYoutorchApiBaseUrl()}/api/v1/assistant/runs/${encodeURIComponent(runId)}/stream`
}

export function createAssistantEventSource(runId: string) {
  return new EventSource(getAssistantRunStreamUrl(runId), { withCredentials: true })
}

export function parseAssistantRunEvent(data: string): AssistantRunEvent | null {
  try {
    return sanitizeAssistantRunEvent(assistantRunEventSchema.parse(JSON.parse(data)))
  } catch {
    return null
  }
}

export function parseAssistantRunState(value: unknown): AssistantRunState | null {
  const parsed = assistantRunStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function inferAssistantRunState(event: AssistantRunEvent): AssistantRunState | null {
  const payloadState = parseAssistantRunState(event.payload.state)
  if (payloadState) return payloadState
  if (event.event_type === 'run.started') return 'running'
  if (event.event_type === 'run.completed') return 'completed'
  if (event.event_type === 'run.failed') return 'failed'
  if (event.event_type === 'run.cancelled') return 'cancelled'
  if (event.event_type === 'run.cancel_requested') return 'cancelling'
  if (event.event_type === 'run.cancellation_attention_required') return 'cancellation_attention_required'
  if (event.event_type === 'run.waiting_for_payment' || event.event_type === 'payment.waiting' || event.event_type === 'payment.resume_failed') return 'waiting_for_payment'
  if (event.event_type === 'run.waiting_for_user') return 'waiting_for_user'
  if (event.event_type === 'run.waiting_for_approval') return 'waiting_for_approval'
  if (event.event_type === 'run.waiting_on_workflow') return 'waiting_on_workflow'
  if (event.event_type === 'run.waiting_on_agent') return 'waiting_on_agent'
  return null
}

export function shouldApplyAssistantRunEvent(lastSequence: number, event: AssistantRunEvent) {
  return event.transient || event.sequence <= 0 || event.sequence > lastSequence
}

export function shouldApplyAssistantRunStatus(
  requestedAfterSequence: number,
  latestSequence: number,
) {
  return requestedAfterSequence === latestSequence
}

export const __assistantApiTestHooks = {
  parseMessagePageResponse: (value: unknown) => assistantMessagePageResponseSchema.parse(value).data,
  parseActiveRunPageResponse: (value: unknown) => assistantActiveRunPageResponseSchema.parse(value).data,
}

function sanitizeAssistantRunStatus(status: AssistantRunStatus): AssistantRunStatus {
  const publicError = toPublicRuntimeError(status.error_message ?? status.error_code)
  if (!publicError) return status
  return {
    ...status,
    error_code: publicError.code,
    error_message: publicError.message,
  }
}

function sanitizeAssistantRunEvent<T extends { event_type: string; payload: Record<string, unknown> }>(event: T): T {
  if (event.event_type !== 'run.failed' && event.event_type !== 'payment.resume_failed') return event
  const payload = Object.fromEntries(Object.entries(event.payload).filter(([key]) => [
    'run_id', 'handoff_id', 'payment_wait_state_id', 'workflow_id', 'node_type', 'model_id',
    'state', 'error_code', 'error_message', 'code', 'message',
  ].includes(key)))
  const rawMessage = readString(payload.error_message) ?? readString(payload.message)
  const rawCode = readString(payload.error_code) ?? readString(payload.code)
  const publicError = toPublicRuntimeError(rawMessage ?? rawCode)
  if (!publicError) return { ...event, payload }
  return {
    ...event,
    payload: {
      ...payload,
      error_code: publicError.code,
      error_message: publicError.message,
      ...(Object.prototype.hasOwnProperty.call(payload, 'message') ? { message: publicError.message } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'code') ? { code: publicError.code } : {}),
    },
  }
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function createAssistantIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

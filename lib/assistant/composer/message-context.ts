import { isCommandChip, type ComposerState } from './composer-state'
import type { ComposerSurface } from './composer-menu'
import type { ComposerMode } from './composer-mode'
import {
  isCapabilityKey,
  isModelId,
  isOpaqueId,
  ownerRefIdentityKey,
  type InvocationTargetRef,
  type OwnerRef,
  type SkillRevisionRef,
  type StorageObjectRef,
} from './owner-refs'

/**
 * P03-01 normalized submit: every composer surface sends one canonical `assistant_message_context_v1` object
 * (`contracts/agentic-spark/assistant-runtime/v1/assistant-message-context.schema.json`). Typed parts come only from
 * chips and explicit host state (job target, reply binding); nothing is derived from the text, so `/image_generate`,
 * a URL or a code block in the text is sent as text and never becomes a command. Mode, grant and budget authority
 * stay on the server; `composer_selection.mode` is a hint.
 */

export const ASSISTANT_MESSAGE_CONTEXT_V1 = 'assistant_message_context_v1' as const
const COMPOSITION_PROJECT_ID = /^cprj_[0-9a-f-]{36}$/
const MOTION_DRAFT_ID = /^bmotd_[A-Za-z0-9_-]{1,64}$/
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const MODEL_INPUT_KEY = /^[a-z][a-z0-9_]{0,63}$/
const MAX_CONTENT_LENGTH = 64_000
const MAX_MODEL_INPUT_CAPABILITIES = 16
const MAX_MODEL_INPUTS = 32
const MAX_MODEL_INPUT_ARRAY = 16
const MAX_SELECTED_SKILLS = 8
const MAX_PREFERRED_TOOLS = 8
const MAX_EDIT_CONTEXT_LAYERS = 16

type ModelInputPrimitive = string | number | boolean
export type ComposerModelInputValue = ModelInputPrimitive | null | ModelInputPrimitive[]

export type ComposerSelectionV1 = {
  chat_profile: 'fast' | 'pro' | 'max'
  model_id: string
  mode: ComposerMode
  video_duration_seconds?: number
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  selected_models?: Record<string, string | null>
  selected_model_inputs?: Record<string, Record<string, ComposerModelInputValue>>
}

export type ComposerJobTarget =
  | { relation: 'new_job' }
  | { relation: 'reply' | 'steer' | 'supersede'; job_id: string; expected_job_version: number }

export type ComposerReplyTo = { pending_invocation_id: string; expected_pending_version: number }

/**
 * P03-07 EditContext (P00-13 `motion-spark/v1/edit-context`): the playhead and selection the user made on the working
 * copy version the Spark message says it saw. A binding hint, never a write authority.
 */
export type ComposerEditContext = {
  project_id: string
  base_revision: number
  playhead_frame: number
  /** `layer_ids` (Y1-07 W8, additive v1): composition layers selected on the canvas inside `scene_id` (max 16). */
  selection?: { scene_id?: string; layer_ids?: string[]; handles?: string[]; slot_ids?: string[] }
  time_range?: { start_frame: number; end_frame: number }
  locale?: string
}

/** Spark workspace snapshot of one message: the project, the version seen and (optionally) its EditContext. */
export type ComposerSparkContext = {
  projectId: string
  seenWorkingCopyVersion: number
  editContext?: ComposerEditContext | null
}

/**
 * E1-H: the Motion screen chat's context (`surface: 'motion_authoring'`): the private Motion draft the chat edits and the
 * draft version the user saw. A binding hint, never a grant (the Gateway re-checks the draft owner on every tool call and an
 * edit names the version it read).
 */
export type ComposerMotionContext = { draftId: string; seenDraftVersion: number }

/** The surfaces that send `assistant_message_context_v1`: the composer's two plus the Motion screen's chat. */
export type MessageSurface = ComposerSurface | 'motion_authoring'

export type AssistantMessageContextV1 = {
  schema_version: typeof ASSISTANT_MESSAGE_CONTEXT_V1
  surface: MessageSurface
  surface_context?:
    | { project_id: string; seen_working_copy_version: number; edit_context?: ComposerEditContext }
    | { draft_id: string; seen_draft_version: number }
  channel_id?: string
  locale?: string
  attachments?: StorageObjectRef[]
  mentions?: Array<{ ref: OwnerRef; display_label: string }>
  selected_skill_refs?: SkillRevisionRef[]
  preferred_tools?: InvocationTargetRef[]
  composer_selection?: ComposerSelectionV1
  job_target?: ComposerJobTarget
  reply_to?: ComposerReplyTo
  pinned_constraints?: string[]
}

/**
 * The number of outputs the user asked for (e.g. 4 images). It travels as the capability's `count` model input and is
 * checked against the selected model's own bounds here and again by the Provider catalog at dispatch; it is never
 * clamped silently (K113).
 */
export type ComposerRequestedCount = {
  capability: string
  count: number
  min: number
  max: number | null
}

export type ComposerSubmitIssue =
  | { code: 'empty' }
  | { code: 'content_too_long' }
  | { code: 'spark_context_missing' }
  | { code: 'spark_edit_context_mismatch' }
  | { code: 'motion_context_missing' }
  | { code: 'requested_count_out_of_range'; count: number; min: number; max: number | null }
  | { code: 'too_many_commands' }
  | { code: 'reply_requires_reply_target' }
  | { code: 'invalid_job_target' }
  | { code: 'invalid_composer_selection'; field: string }

export type ComposerSubmitInput = {
  surface: MessageSurface
  sparkContext?: ComposerSparkContext | null
  /** E1-H: required for the Motion screen chat (`motion_authoring`), forbidden elsewhere. */
  motionContext?: ComposerMotionContext | null
  channelId?: string | null
  locale?: string | null
  state: ComposerState
  /** Storage attachments the host manages next to the chips (e.g. the Chat upload tray). */
  attachments?: readonly StorageObjectRef[]
  composerSelection?: ComposerSelectionV1 | null
  requestedCount?: ComposerRequestedCount | null
  jobTarget?: ComposerJobTarget | null
  replyTo?: ComposerReplyTo | null
  /** Localized text for a message that has only chips/attachments (the API requires non-empty content). */
  fallbackContent?: string | null
}

export type ComposerSubmission =
  | { ok: true; content: string; contentJson: AssistantMessageContextV1 }
  | { ok: false; issues: ComposerSubmitIssue[] }

export function buildComposerSubmission(input: ComposerSubmitInput): ComposerSubmission {
  const issues: ComposerSubmitIssue[] = []
  const { state } = input

  const attachments = dedupeRefs([
    ...(input.attachments ?? []),
    ...state.chips.flatMap((chip) => (chip.kind === 'attachment' ? [chip.ref] : [])),
  ])
  const mentions = state.chips.flatMap((chip) => (chip.kind === 'mention' ? [{ ref: chip.ref, display_label: displayLabel(chip.label) }] : []))
  const commands = state.chips.filter(isCommandChip)
  if (commands.length > 1) issues.push({ code: 'too_many_commands' })
  const selectedSkillRefs = dedupeRefs(commands.flatMap((chip) => (chip.kind === 'skill' ? [chip.ref] : []))).slice(0, MAX_SELECTED_SKILLS)
  const preferredTools = dedupeRefs(commands.flatMap((chip) => (chip.kind === 'tool' ? [chip.ref] : []))).slice(0, MAX_PREFERRED_TOOLS)

  const text = state.text.trim()
  const hasTyped = attachments.length > 0 || mentions.length > 0 || commands.length > 0
  const content = text || (hasTyped ? (input.fallbackContent?.trim() || commands[0]?.label || '') : '')
  if (!content) issues.push({ code: 'empty' })
  if (content.length > MAX_CONTENT_LENGTH) issues.push({ code: 'content_too_long' })

  let surfaceContext: AssistantMessageContextV1['surface_context']
  if (input.surface === 'spark_chat') {
    const spark = input.sparkContext
    if (!spark || !COMPOSITION_PROJECT_ID.test(spark.projectId) || !Number.isInteger(spark.seenWorkingCopyVersion) || spark.seenWorkingCopyVersion < 0) {
      issues.push({ code: 'spark_context_missing' })
    } else {
      surfaceContext = { project_id: spark.projectId, seen_working_copy_version: spark.seenWorkingCopyVersion }
      // P03-07: one snapshot — the EditContext names the same project and was made on the version the message saw
      // (the Gateway refuses anything else, so a mismatch is caught here instead of a 400).
      const edit = spark.editContext
      if (edit) {
        if (!isEditContextOf(edit, spark)) issues.push({ code: 'spark_edit_context_mismatch' })
        else surfaceContext = { ...surfaceContext, edit_context: edit }
      }
    }
  } else if (input.surface === 'motion_authoring') {
    const motion = input.motionContext
    if (!motion || !MOTION_DRAFT_ID.test(motion.draftId) || !Number.isInteger(motion.seenDraftVersion) || motion.seenDraftVersion < 1) {
      issues.push({ code: 'motion_context_missing' })
    } else {
      surfaceContext = { draft_id: motion.draftId, seen_draft_version: motion.seenDraftVersion }
    }
  }

  const composerSelection = input.composerSelection
    ? normalizeComposerSelection(input.composerSelection, input.requestedCount ?? null, issues)
    : undefined

  const jobTarget = input.jobTarget ?? undefined
  if (jobTarget && jobTarget.relation !== 'new_job'
    && (!isOpaqueId(jobTarget.job_id) || !Number.isInteger(jobTarget.expected_job_version) || jobTarget.expected_job_version < 0)) {
    issues.push({ code: 'invalid_job_target' })
  }
  const replyTo = input.replyTo ?? undefined
  if (replyTo && jobTarget?.relation !== 'reply') issues.push({ code: 'reply_requires_reply_target' })

  if (issues.length > 0) return { ok: false, issues }

  const channelId = input.channelId?.trim()
  const locale = input.locale?.trim()
  const contentJson: AssistantMessageContextV1 = {
    schema_version: ASSISTANT_MESSAGE_CONTEXT_V1,
    surface: input.surface,
    ...(surfaceContext ? { surface_context: surfaceContext } : {}),
    ...(channelId && isOpaqueId(channelId) ? { channel_id: channelId } : {}),
    ...(locale && LOCALE.test(locale) ? { locale } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(selectedSkillRefs.length > 0 ? { selected_skill_refs: selectedSkillRefs } : {}),
    ...(preferredTools.length > 0 ? { preferred_tools: preferredTools } : {}),
    ...(composerSelection ? { composer_selection: composerSelection } : {}),
    ...(jobTarget ? { job_target: jobTarget } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  }
  return { ok: true, content, contentJson }
}

function normalizeComposerSelection(
  selection: ComposerSelectionV1,
  requestedCount: ComposerRequestedCount | null,
  issues: ComposerSubmitIssue[],
): ComposerSelectionV1 | undefined {
  if (!isModelId(selection.model_id)) {
    issues.push({ code: 'invalid_composer_selection', field: 'model_id' })
    return undefined
  }
  const selectedModels = Object.fromEntries(
    Object.entries(selection.selected_models ?? {})
      .filter(([capability, modelId]) => isCapabilityKey(capability) && (modelId === null || isModelId(modelId)))
      .slice(0, MAX_MODEL_INPUT_CAPABILITIES),
  )
  const selectedModelInputs: Record<string, Record<string, ComposerModelInputValue>> = {}
  for (const [capability, inputs] of Object.entries(selection.selected_model_inputs ?? {})) {
    if (!isCapabilityKey(capability) || Object.keys(selectedModelInputs).length >= MAX_MODEL_INPUT_CAPABILITIES) continue
    selectedModelInputs[capability] = sanitizeModelInputs(inputs)
  }
  if (requestedCount) {
    const { count, min, max, capability } = requestedCount
    const outOfRange = !Number.isInteger(count) || count < min || (max !== null && count > max)
    if (outOfRange || !isCapabilityKey(capability)) {
      issues.push({ code: 'requested_count_out_of_range', count, min, max })
    } else {
      selectedModelInputs[capability] = { ...(selectedModelInputs[capability] ?? {}), count }
    }
  }
  const duration = selection.video_duration_seconds
  return {
    chat_profile: selection.chat_profile,
    model_id: selection.model_id,
    mode: selection.mode,
    ...(typeof duration === 'number' && Number.isInteger(duration) && duration >= 5 && duration <= 14_400
      ? { video_duration_seconds: duration } : {}),
    ...(selection.aspect_ratio ? { aspect_ratio: selection.aspect_ratio } : {}),
    ...(Object.keys(selectedModels).length > 0 ? { selected_models: selectedModels } : {}),
    ...(Object.keys(selectedModelInputs).length > 0 ? { selected_model_inputs: selectedModelInputs } : {}),
  }
}

function isEditContextOf(edit: ComposerEditContext, spark: ComposerSparkContext): boolean {
  return edit.project_id === spark.projectId
    && edit.base_revision === spark.seenWorkingCopyVersion
    && Number.isInteger(edit.playhead_frame)
    && edit.playhead_frame >= 0
    && hasValidLayerIds(edit.selection?.layer_ids)
}

/** The contract's `selection.layer_ids`: at most 16 unique ids; a bad list is caught here instead of as a 400. */
function hasValidLayerIds(layerIds: readonly string[] | undefined): boolean {
  if (layerIds === undefined) return true
  return Array.isArray(layerIds) && layerIds.length <= MAX_EDIT_CONTEXT_LAYERS && new Set(layerIds).size === layerIds.length
    && layerIds.every((id) => isOpaqueId(id))
}

/** Keeps only contract-shaped model inputs (typed scalars and short scalar arrays); nested objects are not inputs. */
function sanitizeModelInputs(inputs: Record<string, unknown>): Record<string, ComposerModelInputValue> {
  const result: Record<string, ComposerModelInputValue> = {}
  for (const [key, value] of Object.entries(inputs)) {
    if (Object.keys(result).length >= MAX_MODEL_INPUTS || !MODEL_INPUT_KEY.test(key)) continue
    if (value === null || typeof value === 'string' || typeof value === 'boolean') result[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
    else if (Array.isArray(value) && value.length <= MAX_MODEL_INPUT_ARRAY
      && value.every((item) => typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))) {
      result[key] = value as ModelInputPrimitive[]
    }
  }
  return result
}

function dedupeRefs<T extends OwnerRef>(refs: readonly T[]): T[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = ownerRefIdentityKey(ref)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function displayLabel(label: string): string {
  const trimmed = label.trim() || '—'
  return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed
}

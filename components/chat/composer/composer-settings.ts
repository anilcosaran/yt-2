import type * as React from 'react'
import { RectangleHorizontal, RectangleVertical, Square } from 'lucide-react'

import type { ChatTranslator } from '@/components/chat/chat-copy'
import type { WorkflowCanvasImageModel } from '@/components/workflows/workflow-canvas'
import { assistantComposerSelectionSchema, type AssistantComposerCatalog, type AssistantComposerSelection } from '@/lib/assistant/api'
import type { PlannerModelCommandResult, plannerModelHint } from '@/lib/assistant/planner-model-selection'

/**
 * The main Chat composer's settings (models, output, duration, canvas): their shape, the catalog's options and the
 * rules that keep a pick valid for the catalog and turn it into the message's `composer_selection`.
 */

export type ComposerChatProfile = AssistantComposerSelection['chat_profile']
export type ComposerApprovalMode = AssistantComposerSelection['approval_mode']
export type ComposerAspectRatio = AssistantComposerSelection['aspect_ratio']

export type ComposerSettings = {
  chatProfile: ComposerChatProfile
  /** P01A-11: exact chat model picked before the conversation exists; committed on the first send. */
  chatModelId: string | null
  approvalMode: ComposerApprovalMode
  durationSeconds: number
  aspectRatio: ComposerAspectRatio
  imageModelId: string | null
  videoModelId: string | null
  imageTask: string
  imageSize: string
  imageResolution: string
  imageQuality: string
  imageOutputFormat: string
}

export type ComposerProfileOption = {
  id: ComposerChatProfile
  label: string
  detail: string
  credits: number | null
  modelId: string
  modelLabel: string
}

export type ComposerAspectOption = {
  id: ComposerAspectRatio
  label: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
}

export type ComposerModelOption = {
  id: string
  label: string
  description: string
  quality: string
  cost: string
  speed: string
  estimatedCredits: number | null
  inputSchema: Record<string, unknown>
  pricingRule: Record<string, unknown>
  rateLimit: Record<string, unknown>
  capacityLimit: Record<string, unknown>
}

export type ComposerInputOption = {
  id: string
  label: string
  detail: string
}

export type ComposerApprovalOption = {
  id: ComposerApprovalMode
  label: string
  detail: string
}

export type ComposerOptions = {
  chatProfiles: ComposerProfileOption[]
  /** P01A-11: exact supported chat models of the catalog (a Fast/Pro/Max profile is not a model identity). */
  chatModels: ComposerModelOption[]
  approvalModes: ComposerApprovalOption[]
  aspectRatios: ComposerAspectOption[]
  imageModels: ComposerModelOption[]
  videoModels: ComposerModelOption[]
}

export const FALLBACK_IMAGE_SCHEMA: Record<string, unknown> = {
  tasks: ['text_to_image', 'image_to_image', 'reference_image', 'first_last_frame'],
  default_task: 'text_to_image',
  sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
  default_size: 'auto',
  qualities: ['auto', 'low', 'medium', 'high'],
  default_quality: 'auto',
  backgrounds: ['auto', 'opaque', 'transparent'],
  default_background: 'auto',
  output_formats: ['png', 'jpeg', 'webp'],
  default_output_format: 'png',
  output_compression_supported: true,
  output_compression_formats: ['jpeg', 'webp'],
  default_output_compression: 100,
  input_fidelity_supported: true,
  input_fidelities: ['low', 'high'],
  default_input_fidelity: 'low',
  max_images_per_run: 10,
}

export function getFallbackComposerImageModels(t: ChatTranslator): ComposerModelOption[] {
  return [
  {
    id: 'flux-2-klein-4b',
    label: 'FLUX.2 Klein 4B',
    description: t('composer.fluxDescription'),
    quality: t('composer.high'),
    cost: t('composer.resolutionCredits'),
    speed: t('composer.fastSpeed'),
    estimatedCredits: null,
    inputSchema: {
      tasks: ['text_to_image'],
      default_task: 'text_to_image',
      aspect_ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      default_aspect_ratio: '1:1',
      resolutions: ['1k', '2k', '4k'],
      default_resolution: '1k',
      styles: ['auto', 'natural', 'vivid', 'cinematic', 'anime'],
      default_style: 'auto',
      max_images_per_run: 1,
    },
    pricingRule: {},
    rateLimit: {},
    capacityLimit: {},
  },
  createFallbackComposerImageModel(t, 'gpt-image-2', 'GPT Image 2', {
    quality: t('composer.highest'),
    description: t('composer.defaultImageDescription'),
    inputSchema: {
      ...FALLBACK_IMAGE_SCHEMA,
      tasks: ['text_to_image', 'image_to_image', 'reference_image'],
      input_fidelity_supported: false,
    },
  }),
]
}

export function createFallbackComposerImageModel(
  t: ChatTranslator,
  id: string,
  label: string,
  overrides: Partial<Pick<ComposerModelOption, 'description' | 'quality' | 'speed' | 'inputSchema'>> = {},
): ComposerModelOption {
  return {
    id,
    label,
    description: overrides.description ?? t('composer.genericImageDescription', { model: label }),
    quality: overrides.quality ?? t('composer.high'),
    cost: t('composer.imagePricing'),
    speed: overrides.speed ?? t('composer.mediumSpeed'),
    estimatedCredits: null,
    inputSchema: overrides.inputSchema ?? FALLBACK_IMAGE_SCHEMA,
    // Prices come from the current server catalog, including the retail tariff.
    pricingRule: {},
    rateLimit: {},
    capacityLimit: {},
  }
}

export const COMPOSER_VIDEO_DURATION_MIN_SECONDS = 5
export const IMAGE_GENERATE_CAPABILITY = 'image.generate'
export const VIDEO_GENERATE_CAPABILITY = 'video.generate'
export const DEFAULT_IMAGE_MODEL_ID = 'flux-2-klein-4b'

export const COMPOSER_DURATION_PRESETS = [15, 30, 60, 180, 300] as const

export const COMPOSER_DURATION_SLIDER_STEP_SECONDS = 1
export type ComposerDurationUnit = 'seconds' | 'minutes'
export const COMPOSER_DEFAULT_SETTINGS: ComposerSettings = {
  chatProfile: 'fast',
  chatModelId: null,
  // Q62: a new conversation starts in Auto (legacy spelling 'autonomous').
  approvalMode: 'autonomous',
  durationSeconds: 30,
  aspectRatio: '16:9',
  imageModelId: null,
  videoModelId: null,
  imageTask: 'text_to_image',
  imageSize: '',
  imageResolution: '',
  imageQuality: 'auto',
  imageOutputFormat: 'png',
}

export function getFallbackComposerProfileOptions(t: ChatTranslator): ComposerProfileOption[] {
  return [
    { id: 'fast', label: t('composer.fast'), detail: t('composer.fastDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
    { id: 'pro', label: t('composer.pro'), detail: t('composer.proDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
    { id: 'max', label: t('composer.max'), detail: t('composer.maxDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
  ]
}

export function getFallbackComposerApprovalOptions(t: ChatTranslator): ComposerApprovalOption[] {
  return [
    { id: 'ask', label: t('composer.ask'), detail: t('composer.askDetail') },
    { id: 'autonomous', label: t('composer.auto'), detail: t('composer.autoDetail') },
  ]
}

export function getFallbackComposerAspectOptions(t: ChatTranslator): ComposerAspectOption[] {
  return [
    { id: '16:9', label: t('composer.landscape'), detail: t('composer.landscapeDetail'), icon: RectangleHorizontal },
    { id: '9:16', label: t('composer.short'), detail: t('composer.shortDetail'), icon: RectangleVertical },
    { id: '1:1', label: t('composer.square'), detail: t('composer.squareDetail'), icon: Square },
  ]
}

export const PLANNER_MODEL_HINT_KEYS: Record<NonNullable<ReturnType<typeof plannerModelHint>>, string> = {
  current_step: 'composer.modelCurrentStep',
  next_step: 'composer.modelNextStep',
  unavailable: 'composer.modelUnavailable',
}

export const PLANNER_MODEL_NOTICE_KEYS: Record<PlannerModelCommandResult, string> = {
  applied: 'composer.modelNextStep',
  job_only: 'composer.modelChangeJobOnly',
  stale: 'composer.modelChangeStale',
  target_gone: 'composer.modelChangeTargetGone',
  unsupported: 'composer.modelChangeUnsupported',
  forbidden: 'composer.modelChangeForbidden',
  defaults_owner_only: 'composer.modelChangeDefaultsOwnerOnly',
  failed: 'composer.modelChangeFailed',
}

export function plannerModelNoticeKey(result: PlannerModelCommandResult): string {
  return PLANNER_MODEL_NOTICE_KEYS[result]
}

export function buildComposerOptions(catalog: AssistantComposerCatalog | null, t: ChatTranslator): ComposerOptions {
  return {
    chatProfiles: catalog?.chat_profiles.length
      ? catalog.chat_profiles.map((profile) => ({
        id: profile.id,
        label: localizedProfileLabel(profile.id, profile.label, t),
        detail: localizedProfileDetail(profile.id, profile.detail, t),
        credits: profile.estimated_credits,
        modelId: profile.model_id,
        modelLabel: profile.model_label,
      }))
      : getFallbackComposerProfileOptions(t),
    chatModels: (catalog?.chat_models ?? []).map((model) => toComposerModelOption(model, t)),
    approvalModes: catalog?.approval_modes.length
      ? catalog.approval_modes.map((mode) => ({
        id: mode.id,
        label: mode.id === 'ask' ? t('composer.ask') : t('composer.auto'),
        detail: mode.id === 'ask' ? t('composer.askDetail') : t('composer.autoDetail'),
      }))
      : getFallbackComposerApprovalOptions(t),
    aspectRatios: catalog?.aspect_ratios.length
      ? catalog.aspect_ratios.map((aspect) => ({
        id: aspect.id,
        label: localizedAspectLabel(aspect.id, aspect.label, t),
        detail: localizedAspectDetail(aspect.id, aspect.detail, t),
        icon: iconForAspectRatio(aspect.id),
      }))
      : getFallbackComposerAspectOptions(t),
    imageModels: mergeComposerModelOptions(
      (catalog?.image_models ?? []).map((model) => toComposerModelOption(model, t)),
      getFallbackComposerImageModels(t),
    ),
    videoModels: (catalog?.video_models ?? []).map((model) => toComposerModelOption(model, t)),
  }
}

export function localizedProfileLabel(id: ComposerChatProfile, fallback: string, t: ChatTranslator) {
  if (id === 'fast') return t('composer.fast')
  if (id === 'pro') return t('composer.pro')
  if (id === 'max') return t('composer.max')
  return fallback
}

export function localizedProfileDetail(id: ComposerChatProfile, fallback: string, t: ChatTranslator) {
  if (id === 'fast') return t('composer.fastDetail')
  if (id === 'pro') return t('composer.proDetail')
  if (id === 'max') return t('composer.maxDetail')
  return fallback
}

export function localizedAspectLabel(id: ComposerAspectRatio, fallback: string, t: ChatTranslator) {
  if (id === '16:9') return t('composer.landscape')
  if (id === '9:16') return t('composer.short')
  if (id === '1:1') return t('composer.square')
  return fallback
}

export function localizedAspectDetail(id: ComposerAspectRatio, fallback: string, t: ChatTranslator) {
  if (id === '16:9') return t('composer.landscapeDetail')
  if (id === '9:16') return t('composer.shortDetail')
  if (id === '1:1') return t('composer.squareDetail')
  return fallback
}

export function toComposerModelOption(model: AssistantComposerCatalog['image_models'][number], t: ChatTranslator): ComposerModelOption {
  const fallback = getFallbackComposerImageModels(t).find((option) => option.id === model.id)
  return {
    id: model.id,
    label: model.label,
    description: fallback?.description ?? model.description,
    quality: localizeModelRating(model.quality, t),
    cost: model.cost_label,
    speed: localizeModelSpeed(model.speed, t),
    estimatedCredits: model.estimated_credits,
    inputSchema: model.input_schema,
    pricingRule: model.pricing_rule,
    rateLimit: model.rate_limit,
    capacityLimit: model.capacity_limit,
  }
}

export function localizeModelRating(value: string, t: ChatTranslator) {
  if (value.toLowerCase() === 'highest') return t('composer.highest')
  if (value.toLowerCase() === 'high') return t('composer.high')
  if (value.toLowerCase() === 'draft') return t('composer.draft')
  return value
}

export function localizeModelSpeed(value: string, t: ChatTranslator) {
  if (value.toLowerCase() === 'fast') return t('composer.fastSpeed')
  if (value.toLowerCase() === 'medium') return t('composer.mediumSpeed')
  return value
}

export function iconForAspectRatio(value: ComposerAspectRatio) {
  if (value === '9:16') return RectangleVertical
  if (value === '1:1') return Square
  return RectangleHorizontal
}

export function reconcileComposerSettings(settings: ComposerSettings, catalog: AssistantComposerCatalog, t: ChatTranslator): ComposerSettings {
  const options = buildComposerOptions(catalog, t)
  const defaults = catalog.defaults
  const chatProfile = options.chatProfiles.some((option) => option.id === settings.chatProfile)
    ? settings.chatProfile
    : defaults.chat_profile
  const approvalMode = options.approvalModes.some((option) => option.id === settings.approvalMode)
    ? settings.approvalMode
    : defaults.approval_mode
  const aspectRatio = options.aspectRatios.some((option) => option.id === settings.aspectRatio)
    ? settings.aspectRatio
    : defaults.aspect_ratio
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(defaults, options.imageModels), options.imageModels)
  const imageModel = selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
  const imageModelId = imageModel?.id ?? requestedImageModelId
  const videoModelId = selectCatalogModelId(settings.videoModelId, getSelectedComposerModelId(defaults, VIDEO_GENERATE_CAPABILITY), options.videoModels)
  return {
    chatProfile,
    chatModelId: selectCatalogModelId(settings.chatModelId, defaults.model_id, options.chatModels),
    approvalMode,
    durationSeconds: clampVideoDurationSeconds(settings.durationSeconds || defaults.video_duration_seconds, catalog.duration.max_seconds, catalog.duration.min_seconds),
    aspectRatio,
    imageModelId,
    videoModelId,
    ...reconcileImageModelInputs(settings, imageModel),
  }
}

export function areComposerSettingsEqual(left: ComposerSettings, right: ComposerSettings) {
  return left.chatProfile === right.chatProfile
    && left.chatModelId === right.chatModelId
    && left.approvalMode === right.approvalMode
    && left.durationSeconds === right.durationSeconds
    && left.aspectRatio === right.aspectRatio
    && left.imageModelId === right.imageModelId
    && left.videoModelId === right.videoModelId
    && left.imageTask === right.imageTask
    && left.imageSize === right.imageSize
    && left.imageResolution === right.imageResolution
    && left.imageQuality === right.imageQuality
    && left.imageOutputFormat === right.imageOutputFormat
}

export function selectCatalogModelId(current: string | null, fallback: string | null, options: ComposerModelOption[]) {
  if (current && options.some((option) => option.id === current)) return current
  if (fallback && options.some((option) => option.id === fallback)) return fallback
  return options[0]?.id ?? null
}

export function defaultImageModelId(defaults: AssistantComposerCatalog['defaults'] | null, options: ComposerModelOption[]) {
  if (options.some((option) => option.id === DEFAULT_IMAGE_MODEL_ID)) return DEFAULT_IMAGE_MODEL_ID
  return getSelectedComposerModelId(defaults, IMAGE_GENERATE_CAPABILITY)
}

export function reconcileImageModelInputs(settings: ComposerSettings, model: ComposerModelOption | null): Pick<ComposerSettings, 'imageTask' | 'imageSize' | 'imageResolution' | 'imageQuality' | 'imageOutputFormat'> {
  return {
    imageTask: selectModelInputValue(settings.imageTask, model, 'tasks', readSchemaString(model, 'default_task') ?? 'text_to_image'),
    imageSize: selectModelInputValue(settings.imageSize, model, 'sizes', readSchemaString(model, 'default_size') ?? ''),
    imageResolution: selectModelInputValue(settings.imageResolution, model, 'resolutions', readSchemaString(model, 'default_resolution') ?? ''),
    imageQuality: selectModelInputValue(settings.imageQuality, model, 'qualities', readSchemaString(model, 'default_quality') ?? 'auto'),
    imageOutputFormat: selectModelInputValue(settings.imageOutputFormat, model, 'output_formats', readSchemaString(model, 'default_output_format') ?? 'png'),
  }
}

export function selectModelInputValue(current: string, model: ComposerModelOption | null, key: string, fallback: string) {
  const values = schemaStringList(model, key)
  if (values.length === 0) return current || fallback
  if (current && values.includes(current)) return current
  if (fallback && values.includes(fallback)) return fallback
  return values[0] ?? fallback
}

export function schemaStringList(model: ComposerModelOption | null, key: string): string[] {
  if (!model) return []
  const raw = model.inputSchema[key]
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

export function readSchemaString(model: ComposerModelOption | null, key: string) {
  const value = model?.inputSchema[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function composerModelSupportsImageTask(model: ComposerModelOption, task: string) {
  const tasks = schemaStringList(model, 'tasks')
  return tasks.length === 0 || tasks.includes(task)
}

export function selectComposerImageModelForTask(
  modelId: string | null,
  task: string,
  models: ComposerModelOption[],
) {
  const selected = models.find((model) => model.id === modelId) ?? null
  if (selected && composerModelSupportsImageTask(selected, task)) return selected
  return models.find((model) => composerModelSupportsImageTask(model, task)) ?? selected ?? models[0] ?? null
}

export function composerImageTaskOptions(models: ComposerModelOption[]): ComposerInputOption[] {
  const values = Array.from(new Set(models.flatMap((model) => schemaStringList(model, 'tasks'))))
  const tasks = values.length > 0 ? values : ['text_to_image']
  return tasks.map((value) => ({
    id: value,
    label: formatComposerInputLabel(value),
    detail: value,
  }))
}

export function modelInputOptions(model: ComposerModelOption | null, key: string): ComposerInputOption[] {
  return schemaStringList(model, key).map((value) => ({
    id: value,
    label: formatComposerInputLabel(value),
    detail: value,
  }))
}

export function formatComposerInputLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** QA-078: the image model the message will name (same choice as `serializeComposerSelection`). */
export function selectedComposerImageModel(settings: ComposerSettings, catalog: AssistantComposerCatalog | null, options: ComposerOptions) {
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(catalog?.defaults ?? null, options.imageModels), options.imageModels)
  return selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
}

export function serializeComposerSelection(
  settings: ComposerSettings,
  catalog: AssistantComposerCatalog | null,
  options: ComposerOptions,
  /** P01A-11: the server-committed planner model of an existing conversation (null before it exists). */
  committedPlannerModelId: string | null = null,
): AssistantComposerSelection {
  const maxSeconds = catalog?.duration.max_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const minSeconds = catalog?.duration.min_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const fallbackProfile = options.chatProfiles.find((option) => option.id === settings.chatProfile) ?? options.chatProfiles[0] ?? { id: 'fast', label: '', detail: '', credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' }
  // The exact model is the identity; the profile field is kept only because composer_selection still carries it.
  const plannerModelId = committedPlannerModelId ?? settings.chatModelId ?? fallbackProfile.modelId
  const chatProfile = options.chatProfiles.find((option) => option.modelId === plannerModelId) ?? fallbackProfile
  const aspectRatio = options.aspectRatios.some((option) => option.id === settings.aspectRatio)
    ? settings.aspectRatio
    : catalog?.defaults.aspect_ratio ?? '16:9'
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(catalog?.defaults ?? null, options.imageModels), options.imageModels)
  const imageModel = selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
  return {
    chat_profile: chatProfile.id,
    model_id: plannerModelId,
    approval_mode: options.approvalModes.some((option) => option.id === settings.approvalMode)
      ? settings.approvalMode
      : catalog?.defaults.approval_mode ?? 'ask',
    video_duration_seconds: clampVideoDurationSeconds(settings.durationSeconds, maxSeconds, minSeconds),
    aspect_ratio: aspectRatio,
    selected_models: {
      [IMAGE_GENERATE_CAPABILITY]: imageModel?.id ?? requestedImageModelId,
      [VIDEO_GENERATE_CAPABILITY]: selectCatalogModelId(settings.videoModelId, getSelectedComposerModelId(catalog?.defaults ?? null, VIDEO_GENERATE_CAPABILITY), options.videoModels),
    },
    selected_model_inputs: {
      [IMAGE_GENERATE_CAPABILITY]: imageComposerInputs(settings, imageModel),
    },
  }
}

export function imageComposerInputs(settings: ComposerSettings, model?: ComposerModelOption | null): Record<string, unknown> {
  return {
    task: settings.imageTask,
    ...(settings.imageSize ? { size: settings.imageSize } : {}),
    ...(settings.imageResolution ? { resolution: settings.imageResolution } : {}),
    quality: settings.imageQuality,
    output_format: settings.imageOutputFormat,
    ...implicitModelInput(model, 'background', 'default_background', 'auto'),
    ...implicitModelInput(model, 'input_fidelity', 'default_input_fidelity'),
  }
}

export function mergeComposerModelOptions(
  suppliedModels: ComposerModelOption[],
  fallbackModels: ComposerModelOption[],
) {
  const byId = new Map<string, ComposerModelOption>()
  fallbackModels.forEach((model) => byId.set(model.id, model))
  suppliedModels.forEach((model) => byId.set(model.id, model))
  return Array.from(byId.values())
}

export function toWorkflowCanvasImageModel(model: ComposerModelOption): WorkflowCanvasImageModel {
  return {
    id: model.id,
    label: model.label,
    estimated_credits: model.estimatedCredits,
    input_schema: model.inputSchema,
    pricing_rule: model.pricingRule,
  }
}

export function implicitModelInput(model: ComposerModelOption | null | undefined, field: string, defaultField: string, fallback?: string): Record<string, string> {
  if (!model) return {}
  const settings = schemaStringList(model, 'settings')
  if (!settings.includes(field)) return {}
  const value = readSchemaString(model, defaultField) ?? fallback ?? null
  return value ? { [field]: value } : {}
}

export function getSelectedComposerModelId(
  selection: Pick<AssistantComposerSelection, 'selected_models'> | null,
  capability: typeof IMAGE_GENERATE_CAPABILITY | typeof VIDEO_GENERATE_CAPABILITY,
) {
  const selected = selection?.selected_models?.[capability]
  if (typeof selected === 'string' && selected.trim()) return selected
  return null
}

export function clampVideoDurationSeconds(value: number, maxSeconds: number, minSeconds = COMPOSER_VIDEO_DURATION_MIN_SECONDS) {
  if (!Number.isFinite(value)) return minSeconds
  return Math.min(Math.max(Math.round(value), minSeconds), maxSeconds)
}

export function getComposerDurationScaleMax(planMaxSeconds: number, scaleMaxSeconds: number | null) {
  if (!Number.isFinite(scaleMaxSeconds)) return planMaxSeconds
  return Math.max(planMaxSeconds, Math.round(scaleMaxSeconds ?? planMaxSeconds))
}

export function parseComposerDurationInteger(value: string, unit: ComposerDurationUnit) {
  const normalizedValue = value.trim()
  if (!/^\d+$/.test(normalizedValue)) return null
  const integerValue = Number.parseInt(normalizedValue, 10)
  if (!Number.isSafeInteger(integerValue) || integerValue <= 0) return null
  const seconds = unit === 'minutes' ? integerValue * 60 : integerValue
  return Number.isSafeInteger(seconds) ? seconds : null
}

/** Settings handed over from elsewhere (a new chat started on the new tab): each known field of its kind, else the default. */
export function readComposerSettings(value: unknown): ComposerSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const defaults = COMPOSER_DEFAULT_SETTINGS
  const shape = assistantComposerSelectionSchema.shape
  const text = (key: keyof ComposerSettings) => (typeof record[key] === 'string' ? record[key] as string : null)
  const chatProfile = shape.chat_profile.safeParse(record.chatProfile)
  const approvalMode = shape.approval_mode.safeParse(record.approvalMode)
  const aspectRatio = shape.aspect_ratio.safeParse(record.aspectRatio)
  const durationSeconds = typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds) ? record.durationSeconds : null
  return {
    chatProfile: chatProfile.success ? chatProfile.data : defaults.chatProfile,
    chatModelId: text('chatModelId'),
    approvalMode: approvalMode.success ? approvalMode.data : defaults.approvalMode,
    durationSeconds: durationSeconds ?? defaults.durationSeconds,
    aspectRatio: aspectRatio.success ? aspectRatio.data : defaults.aspectRatio,
    imageModelId: text('imageModelId'),
    videoModelId: text('videoModelId'),
    imageTask: text('imageTask') ?? defaults.imageTask,
    imageSize: text('imageSize') ?? defaults.imageSize,
    imageResolution: text('imageResolution') ?? defaults.imageResolution,
    imageQuality: text('imageQuality') ?? defaults.imageQuality,
    imageOutputFormat: text('imageOutputFormat') ?? defaults.imageOutputFormat,
  }
}

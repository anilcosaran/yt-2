import type { WorkflowNodePort, WorkflowNodePortType } from '@/lib/types'
import {
  FLOW_ANGLE_CUSTOM,
  FLOW_ANGLE_PRESET_LABELS,
  FLOW_ANGLE_PRESETS,
  resolveAngleChoice,
  resolveAngleSettings,
} from '@/lib/workflows/angle-intent'
import { voiceCloneLanguagesForModel } from '@/lib/workflows/voice-clone-languages'
import { TRANSCRIPT_SOURCE_LANGUAGE_OPTIONS } from '@/lib/transcription/whisper-language-codes'

export const MAX_FRAME_EXTRACT_PIXEL_FRAMES = 250_000_000
export const DEFAULT_FLOW_UPLOAD_PATH = 'outputs/flows'
export const DEFAULT_PROMPT_MODELS = ['auto-llm', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'] as const
export const DEFAULT_ANGLE_MODELS = [
  'angle-multiview-v1',
  'angle-qwen-image-3',
  'angle-qwen-image-3-pro',
  'angle-flux-2-pro',
  'angle-gpt-image-2',
  'angle-gpt-image-2.5-sunburst',
  'angle-gpt-image-2.5-flare',
  'angle-flux-2-max',
  'angle-flux-2-klein-4b',
  'angle-gemini-3.1-flash-image',
  'angle-seedream-5-pro',
] as const
export const DEFAULT_AVATAR_MODELS = ['kling-avatar-v1'] as const
export const AVATAR_GENERATE_TASKS = ['human_clone', 'digital_human'] as const
/** Avatar `duration_seconds` left unset: the node lip-syncs the whole speech track (its length, at most 10 s). */
export const AVATAR_DURATION_AUTO = 'auto'
const AVATAR_DURATION_CHOICES = Array.from({ length: 19 }, (_, index) => String(1 + index * 0.5))

export type FlowNodeChatModel = {
  id: string
  label?: string
  cost_label?: string
  estimated_credits?: number | null
}

export type FlowNodeSettings = Record<string, unknown>

export type FlowNodeLike = {
  kind?: string
  settings?: FlowNodeSettings
  inputPorts?: WorkflowNodePort[]
  outputPorts?: WorkflowNodePort[]
  inputs?: string[]
  outputs?: string[]
}

export type FlowNodeFieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'toggle'
  | 'storage_media'
  | 'voice_profile'
  | 'voice_reference'
  | 'warning'
  | 'channel_warning'
  | 'index_strip'
  | 'frame_gallery'
  | 'range_mode'
  | 'media_preview'
  | 'angle_intent'
  | 'channel_link'

export type FlowNodeFieldPatch = {
  title?: string
  subtitle?: string
  provider?: string
  description?: string
  settings?: FlowNodeSettings
}

export type FlowNodeField = {
  label: string
  value: string
  kind: FlowNodeFieldKind
  settingKey?: string
  patchForValue?: (value: string) => FlowNodeFieldPatch
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  mediaKind?: 'audio' | 'video' | 'image'
  size?: 'compact' | 'large'
  hint?: string
  galleryItems?: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>
}

export type FlowNodeFieldContext = {
  includeAdvanced?: boolean
  chatModels?: FlowNodeChatModel[]
  runtimeGallery?: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>
}

const FRAME_EXTRACT_MODES = [
  'first',
  'last',
  'first_last',
  'timestamp',
  'timestamps',
  'evenly_spaced',
  'interval',
  'sample_fps',
] as const

const MEDIA_TRANSFORM_ACTIONS = [
  'trim',
  'reframe',
  'smart_reframe',
  'camera',
  'effects',
  'audio',
  'orientation',
  'convert',
] as const

const JSON_BLOB_FIELD_IDS = new Set([
  'canvas',
  'output',
  'trim',
  'resize',
  'caption_overrides',
  'caption_override',
  'overrides',
  'framing',
  'effects',
  'composition_json',
  'compositionjson',
])

const HIDDEN_CONFIG_WIRE_IDS = new Set([
  'media_ref',
  'video_width',
  'video_height',
  'duration_sec',
  'storage_object_id',
  'width',
  'height',
  'model_id',
  'quality',
  'count',
  'font_size',
  'position',
  'style_name',
  'subtitle_mode',
  'source_language',
  'target_language',
  'timestamps',
  'instruction',
  'voice_profile_id',
  'speed',
  'volume',
  'output_format',
  'top_p',
  'emotion',
  'bit_rate',
  'bitrate',
  'sample_rate',
  'encoding',
  'temperature',
  'seed',
  'language',
  'path',
  'storage_types',
  'review_mode',
  'render_mode',
  'render_task',
  'apply',
  'max_items',
  'angles',
  'style',
  'avatar_id',
  'shot_id',
  'task',
  'source_video',
])

type MediaTransformAction = (typeof MEDIA_TRANSFORM_ACTIONS)[number]
type FrameExtractMode = (typeof FRAME_EXTRACT_MODES)[number]

export function flowNodeTypeKey(settings?: FlowNodeSettings): string {
  const raw = String(settings?.node_type ?? settings?.workflow_node_type ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
  return raw.split('@')[0] ?? ''
}

export function isFlowNodeType(settings: FlowNodeSettings | undefined, typeKey: string) {
  return flowNodeTypeKey(settings) === typeKey
}

export function hasFlowNodePortProfile(data: FlowNodeLike) {
  return getFlowNodePorts(data, 'input') !== null || getFlowNodePorts(data, 'output') !== null
}

export type FlowPortCompatibilityContext = {
  targetNodeType?: string | null
  targetPortId?: string | null
}

export function areFlowPortTypesCompatible(
  sourceType: WorkflowNodePortType | undefined,
  targetType: WorkflowNodePortType | undefined,
  context?: FlowPortCompatibilityContext,
) {
  if (!sourceType) return false
  if (isMapItemsTarget(context)) return sourceType === 'list'
  if (!targetType || targetType === 'any' || sourceType === 'any') return true
  if (sourceType === 'list') return targetType === 'list'
  if (sourceType === targetType) return true
  if (targetType === 'list' && (
    sourceType === 'image'
    || sourceType === 'video'
    || sourceType === 'audio'
    || sourceType === 'string'
  )) return true
  return false
}

export function mergeFlowNodeSettings(
  current: FlowNodeSettings | undefined,
  patch: FlowNodeSettings | undefined,
): FlowNodeSettings {
  const next: FlowNodeSettings = { ...(current ?? {}) }
  if (!patch) return next
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) delete next[key]
    else next[key] = value
  }
  return next
}

function isMapItemsTarget(context?: FlowPortCompatibilityContext) {
  const nodeType = (context?.targetNodeType ?? '').split('@')[0]?.trim().toLowerCase().replace(/-/g, '_')
  const portId = (context?.targetPortId ?? '').trim().toLowerCase()
  return nodeType === 'map' && portId === 'items'
}

export function isJsonBlobCatalogField(portId: string, portType?: string) {
  const id = normalizeFlowName(portId)
  if (JSON_BLOB_FIELD_IDS.has(id)) return true
  return portType === 'dict'
}

export function getCaptionWorkflowInlineFieldOrder(
  settings: FlowNodeSettings | undefined,
  _includeAdvanced = false,
): string[] {
  const subtitleMode = stringSetting(settings, 'subtitle_mode', 'original')
  return [
    'storage_object_id',
    'subtitle_mode',
    ...(['translated', 'bilingual'].includes(subtitleMode) ? ['target_language'] : []),
    ...(subtitleMode === 'bilingual' ? ['bilingual_order'] : []),
    'style_name',
    'position',
    'font_size',
  ]
}

export function getFlowNodePorts(
  data: FlowNodeLike,
  direction: 'input' | 'output',
): WorkflowNodePort[] | null {
  const settings = data.settings ?? {}
  const typeKey = flowNodeTypeKey(settings)
  if (!typeKey) return null

  if (typeKey === 'caption') {
    return direction === 'input'
      ? [port('video_url', 'Video', 'video', false)]
      : [port('cdn_url', 'Video', 'video')]
  }

  if (typeKey === 'frame_extract') {
    if (direction === 'input') return [port('storage_object_id', 'Video', 'video', false)]
    return frameExtractOutputPorts(stringSetting(settings, 'mode', 'first'))
  }

  if (typeKey === 'map') {
    return direction === 'input'
      ? [port('items', 'Items', 'list')]
      : [port('item', 'Each item', 'any')]
  }

  if (typeKey === 'media_downloader') {
    if (direction === 'input') return [port('url', 'URL', 'string', false)]
    return [port('items', 'Downloads', 'list')]
  }

  if (typeKey === 'prompt_generate') {
    return direction === 'input'
      ? [port('image_url', 'Image', 'image', false)]
      : [port('prompt', 'Prompt', 'string')]
  }

  if (typeKey === 'prompt_enhance') {
    return direction === 'input'
      ? [port('prompt', 'Prompt', 'string')]
      : [port('prompt', 'Prompt', 'string')]
  }

  if (typeKey === 'speech_generate') {
    return direction === 'input'
      ? [port('text', 'Text', 'string')]
      : [port('audio_url', 'Voice', 'audio')]
  }

  if (typeKey === 'transcript') {
    return direction === 'input'
      ? [port('storage_object_id', 'Video', 'video', false)]
      : [port('transcript', 'Transcript', 'transcript')]
  }

  if (typeKey === 'video_to_gif') {
    return direction === 'input'
      ? [port('storage_object_id', 'Video', 'video', false)]
      : [port('gif', 'Gif', 'video')]
  }

  if (typeKey === 'voice_clone') {
    return direction === 'input'
      ? [port('reference_storage_object_id', 'Reference voice', 'audio', false)]
      : [port('voice_profile_id', 'Voice', 'string')]
  }

  if (typeKey === 'media_transform') {
    return direction === 'input'
      ? [port('storage_object_id', 'Video', 'video', false)]
      : [port('video_url', 'Video', 'video')]
  }

  if (typeKey === 'render') {
    return direction === 'input'
      ? [port('clips', 'Clips', 'list', false)]
      : [port('video_url', 'Video', 'video')]
  }

  if (typeKey === 'angle') {
    return direction === 'input'
      ? [port('source_image', 'Image', 'image', false)]
      : [port('images', 'Angles', 'list')]
  }

  if (typeKey === 'avatar_generate') {
    return direction === 'input'
      ? [
        port('source_image', 'Reference image', 'image', false),
        port('audio', 'Voice', 'audio', false),
      ]
      : [
        port('image_url', 'Image', 'image'),
        port('video_url', 'Video', 'video'),
      ]
  }

  if (typeKey === 'upload') {
    return direction === 'input'
      ? [port('media', 'Media', 'any')]
      : [port('uploaded', 'Uploaded', 'list')]
  }

  if (typeKey === 'review_gate') {
    return direction === 'input'
      ? [port('input', 'Input', 'any', false)]
      : [port('approved', 'Output', 'any')]
  }

  return null
}

export function frameExtractOutputPorts(modeValue: string): WorkflowNodePort[] {
  const mode = normalizeFrameExtractMode(modeValue)
  if (mode === 'first') return [port('first_frame', 'First frame', 'image')]
  if (mode === 'last') return [port('last_frame', 'Last frame', 'image')]
  if (mode === 'first_last') {
    return [
      port('first_frame', 'First frame', 'image'),
      port('last_frame', 'Last frame', 'image'),
    ]
  }
  return [port('frames', 'Frames', 'list')]
}

export function hasFlowNodeAdvancedFields(data: FlowNodeLike, chatModels: FlowNodeChatModel[] = []) {
  const core = getFlowNodeInlineFields(data, { includeAdvanced: false, chatModels })
  if (!core) return false
  const advanced = getFlowNodeInlineFields(data, { includeAdvanced: true, chatModels }) ?? core
  return advanced.some((field) => !core.some((item) => item.settingKey === field.settingKey && item.kind === field.kind && item.label === field.label))
}

export function getFlowNodeInlineFields(
  data: FlowNodeLike,
  context: FlowNodeFieldContext = {},
): FlowNodeField[] | null {
  const settings = data.settings ?? {}
  const typeKey = flowNodeTypeKey(settings)
  if (!typeKey) return null
  const includeAdvanced = Boolean(context.includeAdvanced)

  if (typeKey === 'caption') return captionFields(settings)
  if (typeKey === 'frame_extract') return frameExtractFields(settings, includeAdvanced)
  if (typeKey === 'map') return mapFields(settings)
  if (typeKey === 'media_downloader') return mediaDownloaderFields(settings)
  if (typeKey === 'prompt_generate') return promptGenerateFields(settings, context.chatModels)
  if (typeKey === 'prompt_enhance') return promptEnhanceFields(settings, context.chatModels)
  if (typeKey === 'speech_generate') return speechGenerateFields(settings, includeAdvanced)
  if (typeKey === 'transcript') return transcriptFields(settings, includeAdvanced)
  if (typeKey === 'video_to_gif') return videoToGifFields(settings, includeAdvanced)
  if (typeKey === 'voice_clone') return voiceCloneFields(settings)
  if (typeKey === 'media_transform') return mediaTransformFields(settings)
  if (typeKey === 'render') return renderFields(settings)
  if (typeKey === 'upload') return uploadFields(settings)
  if (typeKey === 'angle') return angleFields(settings)
  if (typeKey === 'avatar_generate') return avatarGenerateFields(settings, includeAdvanced)
  if (typeKey === 'review_gate') return reviewFields(settings)
  return null
}

export function estimateFrameExtractCount(settings?: FlowNodeSettings) {
  const mode = normalizeFrameExtractMode(stringSetting(settings, 'mode', 'first'))
  if (mode === 'first_last') return 2
  if (mode === 'timestamps') return Math.max(1, parseTimestampList(stringSetting(settings, '__frame_timestamps_input', timestampsDisplay(settings))).length)
  if (mode === 'interval' || mode === 'evenly_spaced') return integerSetting(settings, 'count', 1)
  if (mode === 'sample_fps') {
    const start = numberSetting(settings, 'start_sec', 0)
    const end = optionalNumber(settings?.end_sec) ?? optionalNumber(settings?.duration_sec)
    const fps = numberSetting(settings, 'sampling_fps', 1)
    const limit = integerSetting(settings, 'max_frames', 120)
    if (end !== null && end > start) return Math.min(Math.max(1, Math.ceil((end - start) * fps)), limit)
    return limit
  }
  return 1
}

export function isFrameExtractWorkloadTooLarge(settings?: FlowNodeSettings) {
  const count = estimateFrameExtractCount(settings)
  const resize = readRecord(settings?.resize)
  const width = optionalNumber(resize.width)
  const height = optionalNumber(resize.height)
  if (width !== null && height !== null) {
    return count * width * height > MAX_FRAME_EXTRACT_PIXEL_FRAMES
  }
  return count > 120
}

export function formatFlowFieldOption(settingKey: string | undefined, option: string) {
  const key = normalizeFlowName(settingKey ?? '')
  const labels: Record<string, Record<string, string>> = {
    subtitle_mode: {
      original: 'Original',
      translated: 'Translated only',
      bilingual: 'Dual language',
    },
    bilingual_order: {
      source_above: 'Original above · Translation below',
      translation_above: 'Translation above · Original below',
    },
    mode: {
      first: 'First frame',
      last: 'Last frame',
      first_last: 'First + last',
      timestamp: 'Specific time',
      timestamps: 'Multiple specific times',
      evenly_spaced: 'Evenly spaced',
      interval: 'Every N seconds',
      sample_fps: 'Continuous sampling',
      fast: 'Fast · quick scan',
      medium: 'Medium · broad scan',
      high: 'High · deep research',
      ultra: 'Ultra · maximum evidence',
    },
    task: {
      human_clone: 'Clone person',
      digital_human: 'Digital human',
    },
    prompt: { ...FLOW_ANGLE_PRESET_LABELS },
    angle_choice: { ...FLOW_ANGLE_PRESET_LABELS },
    destination: {
      assets: 'Save to Assets',
      youtube: 'YouTube publish is not supported',
    },
    timestamps: {
      none: 'None',
      segment: 'Segment',
      word: 'Word',
    },
    fit: {
      contain: 'Contain',
      cover: 'Cover',
      stretch: 'Stretch',
      crop: 'Crop',
      fit: 'Fit',
      blur: 'Blur background',
    },
    __media_transform_purpose: {
      trim: 'Trim video',
      reframe: 'Resize or crop',
      smart_reframe: 'Smart reframe',
      camera: 'Manual camera',
      effects: 'Speed & effects',
      audio: 'Adjust audio',
      orientation: 'Rotate or flip',
      convert: 'Convert video',
    },
    quality: {
      economy: 'Economy',
      standard: 'Standard',
      high: 'High',
      draft: 'Draft',
      best_available: 'Best available',
    },
    output_format: {
      wav: 'WAV',
      mp3: 'MP3',
      ogg: 'OGG',
      pcm: 'PCM',
      jpg: 'JPG',
      png: 'PNG',
      webp: 'WebP',
      mp4: 'MP4',
      webm: 'WebM',
    },
    loop: {
      '0': 'Forever',
      '1': '1 time',
      '2': '2 times',
      '5': '5 times',
      '10': '10 times',
    },
  }
  return labels[key]?.[option]
    ?? option.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

export function shouldHideCatalogPortAsWire(portId: string) {
  return HIDDEN_CONFIG_WIRE_IDS.has(normalizeFlowName(portId)) || JSON_BLOB_FIELD_IDS.has(normalizeFlowName(portId))
}

function captionFields(settings: FlowNodeSettings): FlowNodeField[] {
  const order = getCaptionWorkflowInlineFieldOrder(settings)
  const subtitleMode = stringSetting(settings, 'subtitle_mode', 'original')
  return order.map((key) => {
    if (key === 'storage_object_id') return mediaField(settings, 'Media', 'video')
    if (key === 'subtitle_mode') {
      return {
        ...selectField(settings, 'subtitle_mode', 'Subtitle mode', catalogOptions(settings, 'subtitle_mode', ['original', 'translated', 'bilingual']), 'original'),
        patchForValue: (nextMode: string) => ({
          settings: nextMode === 'bilingual'
            ? { subtitle_mode: 'bilingual' }
            : nextMode === 'translated'
              ? {
                subtitle_mode: 'translated',
                bilingual_order: undefined,
                source_style_name: undefined,
                translation_style_name: undefined,
                source_font_scale: undefined,
                translation_font_scale: undefined,
              }
              : {
                subtitle_mode: 'original',
                target_language: undefined,
                bilingual_order: undefined,
                source_style_name: undefined,
                translation_style_name: undefined,
                source_font_scale: undefined,
                translation_font_scale: undefined,
              },
        }),
      }
    }
    if (key === 'target_language') {
      return selectField(settings, 'target_language', 'Translate to', catalogOptions(settings, 'target_language', ['en', 'tr', 'de']), 'en')
    }
    if (key === 'bilingual_order') {
      return selectField(settings, 'bilingual_order', 'Line order', catalogOptions(settings, 'bilingual_order', ['source_above', 'translation_above']), 'source_above')
    }
    if (key === 'style_name') {
      return selectField(settings, 'style_name', 'Caption style', catalogOptions(settings, 'style_name', ['auto', 'tiktok_bold']), 'auto')
    }
    if (key === 'position') {
      return selectField(settings, 'position', 'Position', catalogOptions(settings, 'position', ['style_default', 'top', 'middle', 'bottom']), 'style_default')
    }
    return numberField(settings, 'font_size', 'Font size', 44, { min: 18, max: 96, step: 1 })
  }).filter((field) => field.settingKey !== 'target_language' || ['translated', 'bilingual'].includes(subtitleMode))
}


function frameExtractFields(settings: FlowNodeSettings, includeAdvanced: boolean): FlowNodeField[] {
  const mode = normalizeFrameExtractMode(stringSetting(settings, 'mode', 'first'))
  const fields: FlowNodeField[] = [
    mediaField(settings, 'Media', 'video'),
    {
      ...selectField(settings, 'mode', 'Mode', catalogOptions(settings, 'mode', [...FRAME_EXTRACT_MODES]), 'first'),
      patchForValue: (nextMode: string) => ({
        settings: {
          mode: nextMode,
          ...(nextMode !== 'timestamp' ? { timestamp_sec: undefined } : {}),
          ...(nextMode !== 'timestamps' ? { timestamps: undefined, __frame_timestamps_input: undefined } : {}),
          ...(nextMode !== 'interval' ? { interval_sec: undefined } : {}),
          ...(!['interval', 'evenly_spaced'].includes(nextMode) ? { count: undefined } : {}),
          ...(nextMode !== 'sample_fps' ? { sampling_fps: undefined, start_sec: undefined, end_sec: undefined, max_frames: undefined } : {}),
          ...frameExtractModeDefaults(nextMode),
        },
      }),
    },
  ]

  if (mode === 'timestamp') {
    fields.push(numberField(settings, 'timestamp_sec', 'Time', 0, { min: 0, max: 86_400, step: 0.01 }))
  }
  if (mode === 'timestamps') {
    fields.push({
      label: 'Times',
      value: stringSetting(settings, '__frame_timestamps_input', timestampsDisplay(settings)),
      kind: 'text',
      settingKey: '__frame_timestamps_input',
      hint: 'Comma-separated seconds',
      patchForValue: (value) => ({
        settings: {
          __frame_timestamps_input: value,
          timestamps: parseTimestampList(value),
        },
      }),
    })
  }
  if (mode === 'interval') {
    fields.push(numberField(settings, 'interval_sec', 'Every', 1, { min: 0.1, max: 86_400, step: 0.1 }))
    fields.push(numberField(settings, 'count', 'Frame limit', 10, { min: 1, max: 120, step: 1 }))
  }
  if (mode === 'evenly_spaced') {
    fields.push(numberField(settings, 'count', 'Frame count', 6, { min: 1, max: 120, step: 1 }))
  }
  if (mode === 'sample_fps') {
    fields.push({
      ...selectField(settings, 'sampling_fps', 'Sampling', ['0.1', '0.25', '0.5', '1', '2'], String(numberSetting(settings, 'sampling_fps', 1))),
      patchForValue: (value) => ({ settings: { sampling_fps: Number(value) } }),
    })
    fields.push(numberField(settings, 'max_frames', 'Max frames', 120, { min: 1, max: 120, step: 1 }))
    fields.push(numberField(settings, 'start_sec', 'Start', 0, { min: 0, max: 86_400, step: 0.1 }))
    fields.push(numberField(settings, 'end_sec', 'End', 0, { min: 0, max: 86_400, step: 0.1 }))
  }

  if (isFrameExtractWorkloadTooLarge(settings)) {
    fields.push({
      label: 'Warning',
      value: 'This frame batch is too large to render safely. Lower the count or resize.',
      kind: 'warning',
    })
  }

  if (!includeAdvanced) return fields
  const resize = readRecord(settings.resize)
  return [
    ...fields,
    nestedNumber(settings, 'resize', 'width', 'Width', optionalNumber(resize.width), { min: 16, max: 4096, step: 1 }),
    nestedNumber(settings, 'resize', 'height', 'Height', optionalNumber(resize.height), { min: 16, max: 4096, step: 1 }),
    nestedSelect(settings, 'resize', 'fit', 'Fit', String(resize.fit ?? 'contain'), ['contain', 'cover', 'stretch']),
    selectField(settings, 'output_format', 'Format', catalogOptions(settings, 'output_format', ['jpg', 'png', 'webp']), 'jpg'),
  ]
}

function mapFields(settings: FlowNodeSettings): FlowNodeField[] {
  const current = optionalNumber(settings.max_items)
  const mode = current == null ? 'all' : 'limit'
  const fields: FlowNodeField[] = [{
    label: 'Items',
    value: mode,
    kind: 'select',
    settingKey: 'max_items',
    options: ['all', 'limit'],
    optionLabels: {
      all: 'All inputs',
      limit: 'Limit',
    },
    hint: 'All inputs runs once per list item, up to 200. Limit starts at 10.',
    patchForValue: (next) => ({
      settings: {
        max_items: next === 'limit' ? (current ?? 10) : undefined,
      },
    }),
  }]
  if (mode === 'limit') {
    fields.push(numberField(settings, 'max_items', 'Max items', 10, { min: 1, max: 200, step: 1 }))
  }
  return fields
}

function mediaDownloaderFields(settings: FlowNodeSettings): FlowNodeField[] {
  const legacyUrls = Array.isArray(settings.urls)
    ? settings.urls.map((item) => String(item).trim()).filter(Boolean)
    : typeof settings.urls === 'string'
      ? settings.urls.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)
      : []
  const legacyUrl = legacyUrls.length === 1 ? legacyUrls[0] ?? '' : ''
  return [{
    label: 'URL',
    value: stringSetting(settings, 'url') || legacyUrl,
    kind: 'text',
    settingKey: 'url',
    patchForValue: (value) => ({
      settings: {
        url: value,
        urls: undefined,
        __media_downloader_source_mode: undefined,
      },
    }),
  }]
}

function promptGenerateFields(settings: FlowNodeSettings, chatModels?: FlowNodeChatModel[]): FlowNodeField[] {
  return [
    {
      label: 'Image',
      value: stringSetting(settings, 'storage_object_id') || stringSetting(settings, 'image_url'),
      kind: 'storage_media',
      settingKey: 'image_url',
      mediaKind: 'image',
      patchForValue: (value) => ({
        settings: {
          image_url: value || undefined,
          storage_object_id: value || undefined,
        },
      }),
    },
    {
      label: 'Instruction',
      value: stringSetting(settings, 'instruction'),
      kind: 'textarea',
      settingKey: 'instruction',
      size: 'large',
    },
    modelSelect(settings, chatModels),
  ]
}

function promptEnhanceFields(settings: FlowNodeSettings, chatModels?: FlowNodeChatModel[]): FlowNodeField[] {
  return [
    modelSelect(settings, chatModels),
    {
      label: 'Instruction',
      value: stringSetting(settings, 'instruction'),
      kind: 'textarea',
      settingKey: 'instruction',
      size: 'large',
    },
  ]
}

function speechGenerateFields(settings: FlowNodeSettings, includeAdvanced: boolean): FlowNodeField[] {
  const fields: FlowNodeField[] = [
    {
      label: 'Voice',
      value: stringSetting(settings, 'voice_profile_id', 'default'),
      kind: 'voice_profile',
      settingKey: 'voice_profile_id',
    },
    {
      label: 'Text',
      value: stringSetting(settings, 'text'),
      kind: 'textarea',
      settingKey: 'text',
      size: 'large',
    },
    selectField(settings, 'language', 'Language', catalogOptions(settings, 'language', ['en', 'tr', 'de', 'es', 'fr', 'it', 'pt', 'auto']), stringSetting(settings, 'language', 'en')),
  ]
  if (!includeAdvanced) return fields
  return [
    ...fields,
    selectField(settings, 'model_id', 'Model', catalogOptions(settings, 'model_id', ['speech-natural-v1', 'speech-expressive-v1']), stringSetting(settings, 'model_id')),
    numberField(settings, 'speed', 'Speed', 1, { min: 0.25, max: 4, step: 0.05 }),
    numberField(settings, 'volume', 'Volume', 1, { min: 0.1, max: 4, step: 0.05 }),
    selectField(settings, 'output_format', 'Output format', catalogOptions(settings, 'output_format', ['wav', 'mp3', 'ogg']), 'wav'),
    {
      label: 'Emotion',
      value: stringSetting(settings, 'emotion'),
      kind: 'text',
      settingKey: 'emotion',
    },
    numberField(settings, 'bit_rate', 'Bitrate', 128_000, { min: 1, max: 2_000_000, step: 1000 }),
  ]
}

function transcriptFields(settings: FlowNodeSettings, includeAdvanced: boolean): FlowNodeField[] {
  const fields: FlowNodeField[] = [
    mediaField(settings, 'Media', 'video'),
    selectField(settings, 'model_id', 'Model', catalogOptions(settings, 'model_id', ['whisper-1']), stringSetting(settings, 'model_id', 'whisper-1')),
    selectField(settings, 'source_language', 'Source language', [...TRANSCRIPT_SOURCE_LANGUAGE_OPTIONS], 'auto'),
  ]
  if (!includeAdvanced) return fields
  return [
    ...fields,
    selectField(settings, 'timestamps', 'Timestamps', catalogOptions(settings, 'timestamps', ['none', 'segment', 'word']), 'none'),
  ]
}

function videoToGifFields(settings: FlowNodeSettings, includeAdvanced: boolean): FlowNodeField[] {
  const trim = readRecord(settings.trim)
  const fields: FlowNodeField[] = [
    mediaField(settings, 'Media', 'video'),
    nestedInteger(settings, 'trim', 'start_sec', 'Start second', optionalNumber(trim.start_sec) ?? 0, { min: 0, max: 86_400 }),
    nestedInteger(settings, 'trim', 'end_sec', 'End second', optionalNumber(trim.end_sec) ?? 30, { min: 0, max: 86_400 }),
    selectFieldFromValue('fit', 'Fit', stringSetting(settings, 'fit', 'contain'), ['contain', 'cover', 'stretch']),
    numberField(settings, 'loop', 'Loop', 2, { min: 0, max: 65_535, step: 1 }),
  ]
  if (!includeAdvanced) return fields
  return [
    ...fields,
    numberField(settings, 'width', 'Width', 640, { min: 64, max: 1920, step: 1 }),
    {
      ...numberField(settings, 'height', 'Height', optionalNumber(settings.height) ?? 0, { min: 0, max: 1920, step: 1 }),
      hint: '0 keeps the source aspect ratio',
      patchForValue: (value) => {
        const height = Math.max(0, Math.round(Number(value) || 0))
        return { settings: { height: height > 0 ? height : undefined } }
      },
    },
    numberField(settings, 'fps', 'FPS', 10, { min: 1, max: 30, step: 1 }),
    selectField(settings, 'quality', 'Quality', catalogOptions(settings, 'quality', ['draft', 'standard', 'high']), 'standard'),
  ]
}

function voiceCloneFields(settings: FlowNodeSettings): FlowNodeField[] {
  const modelId = stringSetting(settings, 'target_speech_model_id', stringSetting(settings, 'model_id', 'speech-natural-v1'))
  return [
    {
      label: 'Reference voice',
      value: stringSetting(settings, 'reference_storage_object_id'),
      kind: 'storage_media',
      settingKey: 'reference_storage_object_id',
      mediaKind: 'audio',
      size: 'compact',
    },
    {
      ...selectField(settings, 'target_speech_model_id', 'Voice model', catalogOptions(settings, 'target_speech_model_id', ['speech-natural-v1', 'speech-expressive-v1']), modelId),
      patchForValue: (nextModel) => {
        const languages = voiceCloneLanguagesForModel(nextModel)
        const currentLanguage = stringSetting(settings, 'language', 'en')
        return {
          settings: {
            target_speech_model_id: nextModel,
            language: languages.includes(currentLanguage) ? currentLanguage : 'en',
          },
        }
      },
    },
    {
      label: 'Voice name',
      value: stringSetting(settings, 'display_name'),
      kind: 'text',
      settingKey: 'display_name',
    },
    selectField(
      settings,
      'language',
      'Language',
      catalogOptions(settings, 'language', voiceCloneLanguagesForModel(modelId)),
      stringSetting(settings, 'language', 'en'),
    ),
    toggleField(settings, 'consent_accepted', 'I confirm this is my own voice', false),
  ]
}

function mediaTransformFields(settings: FlowNodeSettings): FlowNodeField[] {
  const action = mediaTransformAction(settings)
  const trim = readRecord(settings.trim)
  const canvas = readRecord(settings.canvas)
  const output = readRecord(settings.output)
  const effects = readRecord(settings.effects)
  const playback = readRecord(effects.playback)
  const fields: FlowNodeField[] = [
    mediaField(settings, 'Media', 'video'),
    {
      ...selectFieldFromValue('__media_transform_purpose', 'Action', action, [...MEDIA_TRANSFORM_ACTIONS]),
      patchForValue: (nextAction) => mediaTransformActionPatch(settings, nextAction),
    },
  ]

  if (action === 'trim') {
    fields.push(nestedNumber(settings, 'trim', 'start_sec', 'Start', optionalNumber(trim.start_sec) ?? 0, { min: 0, max: 86_400, step: 0.1 }))
    fields.push(nestedNumber(settings, 'trim', 'end_sec', 'End', optionalNumber(trim.end_sec) ?? 0, { min: 0, max: 86_400, step: 0.1 }))
    fields.push(nestedSelect(settings, 'trim', 'cut_mode', 'Cut mode', String(trim.cut_mode ?? 'exact'), ['exact', 'fast']))
  }
  if (action === 'reframe') {
    fields.push(nestedSelect(settings, 'canvas', 'aspect_ratio', 'Aspect ratio', String(canvas.aspect_ratio ?? '9:16'), ['original', '9:16', '1:1', '16:9', 'custom']))
    fields.push(nestedSelect(settings, 'canvas', 'fit', 'Fit', String(canvas.fit ?? 'crop'), ['crop', 'fit', 'blur']))
    if (String(canvas.aspect_ratio ?? '') === 'custom') {
      fields.push(nestedNumber(settings, 'canvas', 'width', 'Width', optionalNumber(canvas.width), { min: 64, max: 4096, step: 2 }))
      fields.push(nestedNumber(settings, 'canvas', 'height', 'Height', optionalNumber(canvas.height), { min: 64, max: 4096, step: 2 }))
    }
  }
  if (action === 'smart_reframe') {
    fields.push(nestedSelect(settings, 'canvas', 'aspect_ratio', 'Aspect ratio', String(canvas.aspect_ratio ?? '9:16'), ['9:16', '1:1', '16:9']))
  }
  if (action === 'camera') {
    const framing = readRecord(settings.framing)
    const manual = readRecord(framing.manual)
    const focal = readRecord(manual.focal_point)
    fields.push({
      label: 'Zoom',
      value: String(optionalNumber(manual.zoom) ?? 1),
      kind: 'number',
      min: 1,
      max: 4,
      step: 0.05,
      patchForValue: (value) => patchManualZoom(settings, Number(value)),
    })
    fields.push({
      label: 'Focus X',
      value: String(optionalNumber(focal.x) ?? 0.5),
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      patchForValue: (value) => patchManualFocal(settings, 'x', Number(value)),
    })
    fields.push({
      label: 'Focus Y',
      value: String(optionalNumber(focal.y) ?? 0.5),
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      patchForValue: (value) => patchManualFocal(settings, 'y', Number(value)),
    })
  }
  if (action === 'effects') {
    fields.push({
      label: 'Speed',
      value: String(optionalNumber(playback.speed) ?? 1),
      kind: 'number',
      min: 0.25,
      max: 4,
      step: 0.05,
      patchForValue: (value) => patchEffect(settings, 'playback', 'speed', Number(value)),
    })
  }
  if (action === 'audio') {
    fields.push(nestedSelect(settings, 'output', 'audio', 'Audio', String(output.audio ?? 'keep'), ['keep', 'mute']))
    fields.push(nestedNumber(settings, 'output', 'volume_percent', 'Volume', optionalNumber(output.volume_percent) ?? 100, { min: 0, max: 200, step: 1 }))
  }
  if (action === 'orientation') {
    fields.push(nestedSelect(settings, 'output', 'rotation_degrees', 'Rotate', String(output.rotation_degrees ?? 0), ['0', '90', '180', '270']))
    fields.push(nestedSelect(settings, 'output', 'flip', 'Flip', String(output.flip ?? 'none'), ['none', 'horizontal', 'vertical', 'both']))
  }
  if (action === 'convert') {
    fields.push(nestedSelect(settings, 'output', 'format', 'Format', String(output.format ?? 'mp4'), ['mp4', 'webm']))
    fields.push(nestedSelect(settings, 'output', 'quality', 'Quality', String(output.quality ?? 'standard'), ['draft', 'standard', 'high']))
  }
  return fields
}

function renderFields(settings: FlowNodeSettings): FlowNodeField[] {
  return [
    selectField(settings, 'quality', 'Quality', catalogOptions(settings, 'quality', ['draft', 'standard', 'high']), stringSetting(settings, 'quality', 'high')),
  ]
}

function uploadFields(settings: FlowNodeSettings): FlowNodeField[] {
  const destination = stringSetting(settings, 'destination', 'assets')
  if (destination === 'youtube') {
    return [{
      label: 'YouTube publish',
      value: 'not_supported',
      kind: 'warning',
      settingKey: 'destination',
    }]
  }
  return [{
    label: 'Path',
    value: stringSetting(settings, 'path', DEFAULT_FLOW_UPLOAD_PATH),
    kind: 'text',
    settingKey: 'path',
  }]
}

function angleFields(settings: FlowNodeSettings): FlowNodeField[] {
  const resolved = resolveAngleSettings({
    prompt: stringSetting(settings, 'prompt'),
    angles: settings.angles,
    angle: settings.angle,
  })
  const choice = resolveAngleChoice({
    prompt: resolved.prompt,
    angles: resolved.angles,
    choice: settings.angle_choice,
  })
  return [
    {
      label: 'Image',
      value: stringSetting(settings, 'storage_object_id') || stringSetting(settings, 'source_image'),
      kind: 'storage_media',
      settingKey: 'source_image',
      mediaKind: 'image',
      patchForValue: (value) => ({
        settings: {
          source_image: value || undefined,
          storage_object_id: value || undefined,
        },
      }),
    },
    {
      label: 'Angle',
      value: choice === FLOW_ANGLE_CUSTOM && typeof settings.prompt === 'string'
        ? settings.prompt
        : resolved.prompt,
      kind: 'angle_intent',
      settingKey: 'prompt',
      options: [...FLOW_ANGLE_PRESETS, FLOW_ANGLE_CUSTOM],
      optionLabels: { ...FLOW_ANGLE_PRESET_LABELS },
      galleryItems: [{ url: choice, label: FLOW_ANGLE_PRESET_LABELS[choice] }],
      patchForValue: (value) => ({
        settings: {
          angle_choice: FLOW_ANGLE_CUSTOM,
          prompt: value,
          angles: [{ id: 'angle-1', label: 'Custom angle', prompt: value }],
          angle: undefined,
        },
      }),
    },
    catalogModelSelect(settings, 'model_id', 'Model', undefined, [...DEFAULT_ANGLE_MODELS], 'angle-multiview-v1'),
  ]
}

function avatarGenerateFields(
  settings: FlowNodeSettings,
  includeAdvanced: boolean,
): FlowNodeField[] {
  const fields: FlowNodeField[] = [
    {
      ...selectFieldFromValue(
        'task',
        'Task',
        stringSetting(settings, 'task', 'digital_human'),
        [...AVATAR_GENERATE_TASKS],
      ),
      optionLabels: {
        human_clone: 'Clone person',
        digital_human: 'Digital human',
      },
    },
    {
      label: 'Reference image',
      value: stringSetting(settings, 'storage_object_id') || stringSetting(settings, 'source_image'),
      kind: 'storage_media',
      settingKey: 'source_image',
      mediaKind: 'image',
      patchForValue: (value: string) => ({
        settings: {
          source_image: value || undefined,
          storage_object_id: value || undefined,
        },
      }),
    },
    {
      label: 'Avatar voice',
      value: stringSetting(settings, 'voice_profile_id', 'default'),
      kind: 'voice_profile',
      settingKey: 'voice_profile_id',
    },
    {
      label: 'Prompt',
      value: stringSetting(settings, 'prompt'),
      kind: 'textarea',
      settingKey: 'prompt',
      size: 'large',
    },
    catalogModelSelect(settings, 'model_id', 'Model', undefined, [...DEFAULT_AVATAR_MODELS], 'kling-avatar-v1'),
  ]
  if (!includeAdvanced) return fields
  return [
    ...fields,
    selectField(settings, 'quality', 'Quality', catalogOptions(settings, 'quality', ['std', 'pro']), 'std'),
    selectField(settings, 'orientation', 'Orientation', catalogOptions(settings, 'orientation', ['portrait', 'landscape']), 'portrait'),
    avatarDurationField(settings),
  ]
}

/**
 * Avatar duration is optional: unset reads "Auto (speech length)" and nothing is sent, so the node follows the speech
 * track (the gateway fills the measured length of a Storage audio). Only a value the user picks is written.
 */
function avatarDurationField(settings: FlowNodeSettings): FlowNodeField {
  const chosen = optionalNumber(settings.duration_seconds)
  const value = chosen === null ? AVATAR_DURATION_AUTO : String(chosen)
  return {
    label: 'Duration',
    value,
    kind: 'select',
    settingKey: 'duration_seconds',
    options: uniqueStrings([AVATAR_DURATION_AUTO, ...AVATAR_DURATION_CHOICES, value]),
    optionLabels: { [AVATAR_DURATION_AUTO]: 'terms.durationAutoSpeech' },
    patchForValue: (next) => {
      const seconds = next === AVATAR_DURATION_AUTO ? null : optionalNumber(next)
      return { settings: { duration_seconds: seconds ?? undefined } }
    },
  }
}

/**
 * Catalog port defaults the canvas must not write into a new node's settings because an unset value has its own
 * meaning: an avatar without `duration_seconds` follows its speech track instead of the contract's 5 s.
 */
export function isCatalogDefaultLeftUnset(nodeType: string, settingKey: string) {
  return flowNodeTypeKey({ node_type: nodeType }) === 'avatar_generate' && settingKey === 'duration_seconds'
}

export function isYoutubePublishUploadSettings(settings?: FlowNodeSettings) {
  return flowNodeTypeKey(settings) === 'upload'
    && stringSetting(settings, 'destination', 'assets') === 'youtube'
}

export function workflowHasYoutubePublishUpload(nodes: Array<{ settings?: FlowNodeSettings }>) {
  return nodes.some((node) => isYoutubePublishUploadSettings(node.settings))
}

function reviewFields(settings: FlowNodeSettings): FlowNodeField[] {
  const preview = getReviewInboundPreview(settings)
  if (!preview) return []
  return [{
    label: 'Preview',
    value: preview.url,
    kind: 'media_preview',
    mediaKind: preview.kind,
  }]
}

export function getReviewInboundPreview(settings?: FlowNodeSettings): { url: string; kind: 'image' | 'video' } | null {
  const candidates = [
    stringSetting(settings, 'media_preview_url'),
    stringSetting(settings, 'preview_url'),
    stringSetting(settings, 'helper_preview_url'),
    stringSetting(settings, 'image_url'),
    stringSetting(settings, 'video_url'),
    stringSetting(settings, 'cdn_url'),
    stringSetting(settings, 'input'),
  ]
  const url = candidates.find((value) => looksLikeMediaUrl(value))
  if (!url) return null
  return {
    url,
    kind: /(?:\.mp4|\.webm|\.mov|video)/i.test(url) ? 'video' : 'image',
  }
}

function looksLikeMediaUrl(value: string) {
  if (!value.trim()) return false
  return /^(https?:|blob:|data:image|data:video|storage:)/i.test(value) || /\.(png|jpe?g|webp|gif|mp4|webm|mov)(?:$|\?)/i.test(value)
}

function mediaField(settings: FlowNodeSettings, label: string, mediaKind: 'audio' | 'video' | 'image'): FlowNodeField {
  return {
    label,
    value: stringSetting(settings, 'storage_object_id'),
    kind: 'storage_media',
    settingKey: 'storage_object_id',
    mediaKind,
  }
}

function modelSelect(settings: FlowNodeSettings, chatModels?: FlowNodeChatModel[]): FlowNodeField {
  return catalogModelSelect(settings, 'model_id', 'Model', chatModels, [...DEFAULT_PROMPT_MODELS], 'auto-llm')
}

function catalogModelSelect(
  settings: FlowNodeSettings,
  key: string,
  label: string,
  catalogModels: FlowNodeChatModel[] | undefined,
  fallback: string[],
  defaultId: string,
): FlowNodeField {
  const current = stringSetting(settings, key, defaultId)
  const catalog = catalogOptions(settings, key, fallback)
  const models = catalogModels?.filter((model) => model.id) ?? []
  const options = uniqueStrings([
    current,
    ...(models.length > 0 ? models.map((model) => model.id) : catalog),
  ]).filter(Boolean)
  const optionLabels = Object.fromEntries(models.map((model) => [model.id, model.label || model.id]))
  return {
    label,
    value: options.includes(current) ? current : (options[0] ?? defaultId),
    kind: 'select',
    settingKey: key,
    options: options.length > 0 ? options : [defaultId],
    optionLabels,
  }
}

function selectField(
  settings: FlowNodeSettings,
  key: string,
  label: string,
  options: string[],
  fallback: string,
): FlowNodeField {
  return selectFieldFromValue(key, label, stringSetting(settings, key, fallback), uniqueStrings([fallback, ...options]))
}

function selectFieldFromValue(key: string, label: string, value: string, options: string[]): FlowNodeField {
  return {
    label,
    value,
    kind: 'select',
    settingKey: key,
    options: uniqueStrings([...options, value]),
  }
}

function numberField(
  settings: FlowNodeSettings,
  key: string,
  label: string,
  fallback: number,
  bounds: { min?: number; max?: number; step?: number },
): FlowNodeField {
  const current = optionalNumber(settings[key])
  return {
    label,
    value: String(current ?? fallback),
    kind: 'number',
    settingKey: key,
    ...bounds,
  }
}

function toggleField(settings: FlowNodeSettings, key: string, label: string, fallback: boolean): FlowNodeField {
  const value = settings[key]
  const enabled = typeof value === 'boolean' ? value : fallback
  return {
    label,
    value: enabled ? 'true' : 'false',
    kind: 'toggle',
    settingKey: key,
  }
}

function nestedSelect(
  settings: FlowNodeSettings,
  objectKey: string,
  field: string,
  label: string,
  value: string,
  options: string[],
): FlowNodeField {
  return {
    label,
    value,
    kind: 'select',
    settingKey: `${objectKey}.${field}`,
    options: uniqueStrings([value, ...options]),
    patchForValue: (next) => ({
      settings: {
        [objectKey]: {
          ...readRecord(settings[objectKey]),
          [field]: coerceSelectValue(next),
        },
      },
    }),
  }
}

function nestedNumber(
  settings: FlowNodeSettings,
  objectKey: string,
  field: string,
  label: string,
  value: number | null | undefined,
  bounds: { min?: number; max?: number; step?: number },
): FlowNodeField {
  return {
    label,
    value: String(value ?? ''),
    kind: 'number',
    settingKey: `${objectKey}.${field}`,
    ...bounds,
    patchForValue: (next) => ({
      settings: {
        [objectKey]: {
          ...readRecord(settings[objectKey]),
          [field]: next === '' ? undefined : Number(next),
        },
      },
    }),
  }
}

function nestedInteger(
  settings: FlowNodeSettings,
  objectKey: string,
  field: string,
  label: string,
  value: number,
  bounds: { min?: number; max?: number },
): FlowNodeField {
  return {
    label,
    value: String(Math.max(bounds.min ?? 0, Math.round(value))),
    kind: 'number',
    settingKey: `${objectKey}.${field}`,
    min: bounds.min ?? 0,
    max: bounds.max,
    step: 1,
    patchForValue: (next) => ({
      settings: {
        [objectKey]: {
          ...readRecord(settings[objectKey]),
          [field]: Math.max(bounds.min ?? 0, Math.round(Number(next) || 0)),
        },
      },
    }),
  }
}

function mediaTransformAction(settings: FlowNodeSettings): MediaTransformAction {
  const explicit = String(settings.__media_transform_purpose ?? '').toLocaleLowerCase('en-US')
  if (MEDIA_TRANSFORM_ACTIONS.includes(explicit as MediaTransformAction)) return explicit as MediaTransformAction
  if (settings.trim && Object.keys(readRecord(settings.trim)).length > 0) return 'trim'
  const output = readRecord(settings.output)
  const volumePercent = optionalNumber(output.volume_percent)
  if (output.audio === 'mute' || (volumePercent !== null && volumePercent !== 100)) return 'audio'
  if (Number(output.rotation_degrees ?? 0) || output.flip && output.flip !== 'none') return 'orientation'
  const canvas = readRecord(settings.canvas)
  if (canvas.aspect_ratio && canvas.aspect_ratio !== 'original') return 'reframe'
  return 'trim'
}

function mediaTransformActionPatch(settings: FlowNodeSettings, nextAction: string): FlowNodeFieldPatch {
  const action = MEDIA_TRANSFORM_ACTIONS.includes(nextAction as MediaTransformAction) ? nextAction as MediaTransformAction : 'trim'
  const nextOutput: FlowNodeSettings = {
    format: String(readRecord(settings.output).format ?? 'mp4'),
    quality: String(readRecord(settings.output).quality ?? 'standard'),
    audio: 'keep',
    volume_percent: 100,
    rotation_degrees: 0,
    flip: 'none',
  }
  const nextCanvas: FlowNodeSettings = action === 'reframe' || action === 'smart_reframe' || action === 'camera'
    ? { aspect_ratio: '9:16', fit: 'crop' }
    : { aspect_ratio: 'original', fit: 'crop' }
  const nextFraming: FlowNodeSettings = action === 'smart_reframe'
    ? { mode: 'face_track', tracking_profile: 'steady_face_v2' }
    : action === 'camera'
      ? { mode: 'manual', manual: { focal_point: { x: 0.5, y: 0.5 }, zoom: 1, interpolation: 'smooth', keyframes: [] } }
      : { mode: 'none' }
  return {
    settings: {
      __media_transform_purpose: action,
      trim: action === 'trim' ? readRecord(settings.trim) : undefined,
      effects: action === 'effects' ? readRecord(settings.effects) : undefined,
      canvas: nextCanvas,
      framing: nextFraming,
      output: nextOutput,
    },
  }
}

function patchManualZoom(settings: FlowNodeSettings, value: number): FlowNodeFieldPatch {
  const framing = readRecord(settings.framing)
  const manual = readRecord(framing.manual)
  return {
    settings: {
      framing: {
        ...framing,
        mode: 'manual',
        manual: {
          ...manual,
          zoom: value,
        },
      },
    },
  }
}

function patchManualFocal(settings: FlowNodeSettings, axis: 'x' | 'y', value: number): FlowNodeFieldPatch {
  const framing = readRecord(settings.framing)
  const manual = readRecord(framing.manual)
  const focal = readRecord(manual.focal_point)
  return {
    settings: {
      framing: {
        ...framing,
        mode: 'manual',
        manual: {
          ...manual,
          focal_point: { ...focal, [axis]: value },
        },
      },
    },
  }
}

function patchEffect(settings: FlowNodeSettings, group: string, name: string, value: unknown): FlowNodeFieldPatch {
  const effects = readRecord(settings.effects)
  return {
    settings: {
      effects: {
        ...effects,
        [group]: {
          ...readRecord(effects[group]),
          [name]: value,
        },
      },
    },
  }
}

function frameExtractModeDefaults(mode: string): FlowNodeSettings {
  if (mode === 'interval') return { interval_sec: 1, count: 10 }
  if (mode === 'evenly_spaced') return { count: 6 }
  if (mode === 'sample_fps') return { sampling_fps: 1, max_frames: 120, start_sec: 0 }
  if (mode === 'timestamp') return { timestamp_sec: 0 }
  return {}
}

function normalizeFrameExtractMode(value: string): FrameExtractMode {
  const normalized = value.trim().toLocaleLowerCase('en-US')
  return FRAME_EXTRACT_MODES.includes(normalized as FrameExtractMode) ? normalized as FrameExtractMode : 'first'
}

function timestampsDisplay(settings?: FlowNodeSettings) {
  const stored = stringSetting(settings, '__frame_timestamps_input')
  if (stored) return stored
  if (!Array.isArray(settings?.timestamps)) return ''
  return settings.timestamps.filter((value): value is number => typeof value === 'number').join(', ')
}

export function parseTimestampList(value: string) {
  return uniqueNumbers(value.split(/[,\s]+/).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0))
}

function catalogOptions(settings: FlowNodeSettings, key: string, fallback: string[]) {
  const port = catalogPort(settings, key)
  for (const optionKey of ['allowed_values', 'values', 'options', 'enum']) {
    const value = port[optionKey]
    if (Array.isArray(value) && value.length > 0) return uniqueStrings(value.map((item) => String(item)))
  }
  return fallback
}

function catalogPort(settings: FlowNodeSettings, key: string) {
  const schema = readRecord(settings.__catalog_input_schema)
  const direct = schema[key]
  if (direct) return readRecord(direct)
  const match = Object.entries(schema).find(([name, value]) => {
    const port = readRecord(value)
    return normalizeFlowName(String(port.name ?? name)) === normalizeFlowName(key)
  })
  return match ? readRecord(match[1]) : {}
}

function port(id: string, label: string, type: WorkflowNodePortType, required?: boolean): WorkflowNodePort {
  return required === undefined ? { id, label, type } : { id, label, type, required }
}

function stringSetting(settings: FlowNodeSettings | undefined, key: string, fallback = '') {
  const value = settings?.[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function integerSetting(settings: FlowNodeSettings | undefined, key: string, fallback: number) {
  const value = optionalNumber(settings?.[key])
  return value === null ? fallback : Math.round(value)
}

function numberSetting(settings: FlowNodeSettings | undefined, key: string, fallback: number) {
  return optionalNumber(settings?.[key]) ?? fallback
}

function optionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function coerceSelectValue(value: string) {
  if (value === 'true' || value === 'false') return value === 'true'
  const numeric = Number(value)
  if (value.trim() !== '' && Number.isFinite(numeric) && String(numeric) === value) return numeric
  return value
}

function readRecord(value: unknown): FlowNodeSettings {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value as FlowNodeSettings } : {}
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values))
}

function normalizeFlowName(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-US')
}

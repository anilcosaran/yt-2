import type {
  AvatarAnglePreset,
  AvatarAppearance,
  AvatarLookModelId,
  AvatarShot,
  AvatarShotKind,
} from '@/lib/avatar/api'

export const AVATAR_OPEN_TARGET = 'shots_looks_detail' as const
export const SHOT_OPEN_TARGET = 'shot_inspector' as const

export const AVATAR_SHOT_FAST_ACTIONS = [
  'appearance',
  'edit',
  'look',
  'angles',
  'crop',
  'upscale',
  'voice',
] as const

export type AvatarShotFastAction = (typeof AVATAR_SHOT_FAST_ACTIONS)[number]

export const AVATAR_APPEARANCE_PRESET_IDS = [
  'studio_quality',
  'natural',
  'glam',
  'cinematic',
] as const

export type AvatarAppearancePresetId = (typeof AVATAR_APPEARANCE_PRESET_IDS)[number]

export const AVATAR_APPEARANCE_UI = 'presets' as const
export const AVATAR_APPEARANCE_APPLY_MODE = 'immediate' as const
export const AVATAR_CROP_SELECT_MODE = 'interactive-select' as const

export const AVATAR_APPEARANCE_PRESETS: ReadonlyArray<{
  id: AvatarAppearancePresetId
  appearance: AvatarAppearance
}> = [
  {
    id: 'studio_quality',
    appearance: {
      smooth_skin: 72,
      makeup: 38,
      remove_blemishes: 80,
      slim_face: 18,
      exposure: 54,
      brilliance: 62,
      highlights: 56,
      shadows: 44,
      contrast: 52,
      brightness: 54,
      saturation: 48,
      warmth: 50,
    },
  },
  {
    id: 'natural',
    appearance: {
      smooth_skin: 22,
      makeup: 8,
      remove_blemishes: 28,
      slim_face: 0,
      exposure: 50,
      brilliance: 50,
      highlights: 50,
      shadows: 50,
      contrast: 48,
      brightness: 50,
      saturation: 50,
      warmth: 50,
    },
  },
  {
    id: 'glam',
    appearance: {
      smooth_skin: 58,
      makeup: 78,
      remove_blemishes: 52,
      slim_face: 32,
      exposure: 56,
      brilliance: 64,
      highlights: 60,
      shadows: 42,
      contrast: 54,
      brightness: 56,
      saturation: 58,
      warmth: 58,
    },
  },
  {
    id: 'cinematic',
    appearance: {
      smooth_skin: 34,
      makeup: 24,
      remove_blemishes: 36,
      slim_face: 10,
      exposure: 48,
      brilliance: 44,
      highlights: 38,
      shadows: 62,
      contrast: 66,
      brightness: 48,
      saturation: 44,
      warmth: 60,
    },
  },
]

export type CreateAvatarShotRequest = {
  avatarId: string
  channelId: string
  kind: AvatarShotKind
  prompt?: string
  appearance?: Partial<AvatarAppearance>
  sourceShotId?: string
  catalogTemplateId?: string
  angle?: AvatarAnglePreset
  cropBox?: Record<string, unknown> | null
  modelId?: AvatarLookModelId
}

export type CropBox = {
  x: number
  y: number
  width: number
  height: number
}

export function resolveAvatarOpenTarget() {
  return AVATAR_OPEN_TARGET
}

export function resolveShotOpenTarget() {
  return SHOT_OPEN_TARGET
}

export function listShotFastActions() {
  return AVATAR_SHOT_FAST_ACTIONS
}

export function appearancePresetPayload(presetId: AvatarAppearancePresetId): AvatarAppearance {
  const preset = AVATAR_APPEARANCE_PRESETS.find((entry) => entry.id === presetId)
  if (!preset) {
    throw new Error(`Unknown appearance preset: ${presetId}`)
  }
  return { ...preset.appearance }
}

export function resolveAppearanceApplyMode() {
  return AVATAR_APPEARANCE_APPLY_MODE
}

export function resolveAppearanceUi() {
  return AVATAR_APPEARANCE_UI
}

export function resolveCropMode(action: AvatarShotFastAction | null) {
  return action === 'crop' ? AVATAR_CROP_SELECT_MODE : 'idle'
}

export function matchAppearancePresetId(appearance: AvatarAppearance | null | undefined) {
  if (!appearance) return null
  for (const preset of AVATAR_APPEARANCE_PRESETS) {
    const keys = Object.keys(preset.appearance) as Array<keyof AvatarAppearance>
    if (keys.every((key) => appearance[key] === preset.appearance[key])) return preset.id
  }
  return null
}

export function buildAppearanceShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
  presetId: AvatarAppearancePresetId
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'appearance',
    appearance: appearancePresetPayload(input.presetId),
    sourceShotId: input.sourceShotId,
  }
}

export function buildAppearancePatchRequest(input: {
  avatarId: string
  shotId: string
  channelId: string
  presetId: AvatarAppearancePresetId
}) {
  return {
    avatarId: input.avatarId,
    shotId: input.shotId,
    channelId: input.channelId,
    appearance: appearancePresetPayload(input.presetId),
  }
}

export function buildEditShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
  prompt: string
  modelId?: AvatarLookModelId
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'edit',
    prompt: input.prompt,
    sourceShotId: input.sourceShotId,
    ...(input.modelId ? { modelId: input.modelId } : {}),
  }
}

export function buildLookShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
  prompt: string
  modelId?: AvatarLookModelId
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'look',
    prompt: input.prompt,
    sourceShotId: input.sourceShotId,
    ...(input.modelId ? { modelId: input.modelId } : {}),
  }
}

export function buildAngleShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
  angle: AvatarAnglePreset
  prompt: string
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'angle',
    prompt: input.prompt,
    angle: input.angle,
    sourceShotId: input.sourceShotId,
  }
}

export function buildUpscaleShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'upscale',
    sourceShotId: input.sourceShotId,
  }
}

export function buildCropShotRequest(input: {
  avatarId: string
  channelId: string
  sourceShotId: string
  cropBox: CropBox
}): CreateAvatarShotRequest {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    kind: 'crop',
    sourceShotId: input.sourceShotId,
    cropBox: input.cropBox,
  }
}

export function buildVoiceAssignRequest(input: {
  avatarId: string
  channelId: string
  voiceProfileId: string | null
}) {
  return {
    avatarId: input.avatarId,
    channelId: input.channelId,
    voiceProfileId: input.voiceProfileId,
  }
}

export function toShotCreateBody(input: CreateAvatarShotRequest) {
  return {
    kind: input.kind,
    prompt: input.prompt,
    appearance: input.appearance,
    source_shot_id: input.sourceShotId,
    catalog_template_id: input.catalogTemplateId,
    angle: input.angle,
    crop_box: input.cropBox,
    model_id: input.modelId,
  }
}

export function toAssignAvatarVoiceBody(input: { voiceProfileId?: string | null }) {
  return { voice_profile_id: input.voiceProfileId ?? null }
}

export function resolveLookSourceShotId(
  shots: Array<Pick<AvatarShot, 'id' | 'status' | 'is_primary'>>,
  primaryShotId: string | null,
) {
  const completed = shots.filter((shot) => shot.status === 'completed')
  return completed.find((shot) => shot.id === primaryShotId)?.id
    ?? completed.find((shot) => shot.is_primary)?.id
    ?? completed[0]?.id
    ?? null
}

export function parseCropBox(crop: { x: string; y: string; width: string; height: string }): CropBox | null {
  const x = Number(crop.x)
  const y = Number(crop.y)
  const width = Number(crop.width)
  const height = Number(crop.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

export function cropBoxFromUnknown(box: Record<string, unknown> | null | undefined): CropBox | null {
  if (!box) return null
  const x = asFiniteNumber(box.x)
  const y = asFiniteNumber(box.y)
  const width = asFiniteNumber(box.width ?? box.w)
  const height = asFiniteNumber(box.height ?? box.h)
  if (x === null || y === null || width === null || height === null) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function asFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

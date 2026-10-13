'use client'

import { z } from 'zod'

import { AuthClientError, parseAuthErrorResponse } from '@/lib/auth/errors'
import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { getPublicRecordingApiBaseUrl } from '@/lib/avatar/origin-host'
import {
  RECORDING_CAPTURE_KINDS,
  RECORDING_CAPTURE_STEP_STATES,
  alignCaptureUploadFile,
  buildPublicRecordingCompleteBody,
  buildPublicRecordingUploadBody,
  type RecordingCaptureKind,
} from '@/lib/avatar/recording-capture'
import { gatewayRequest } from '@/lib/gateway/client'
import {
  ClientMutationAttemptStore,
  isAmbiguousMutationError,
  stableClientFingerprint,
  type ClientKeyValueStorage,
} from '@/lib/idempotency/client-mutation-control'
import {
  resolveStorageUploadTransport,
  uploadDirectContent,
  type InitiateUploadResult,
} from '@/lib/storage/api'
import { toAssignAvatarVoiceBody, toShotCreateBody } from '@/lib/avatar/shot-actions'
import type { AvatarCharacterPayload, AvatarVoicePayload } from '@/lib/avatar/character'
import {
  avatarEntitlementResponseSchema,
  type AvatarExpectedPrice,
} from '@/lib/avatar/entitlement'

export {
  avatarEntitlementQueryKey,
  AVATAR_ENTITLEMENT_QUERY_KEY,
  type AvatarEntitlement,
  type AvatarExpectedPrice,
} from '@/lib/avatar/entitlement'

export const AVATARS_QUERY_KEY = ['avatar', 'list'] as const
export const AVATAR_DETAIL_QUERY_KEY = ['avatar', 'detail'] as const
export const AVATAR_SHOTS_QUERY_KEY = ['avatar', 'shots'] as const
export const PUBLIC_AVATARS_QUERY_KEY = ['avatar', 'public'] as const
export const RECORDING_SESSION_QUERY_KEY = ['avatar', 'recording-session'] as const

type AvatarShotAttemptPayload = {
  avatarId: string
  channelId: string
}

const avatarShotAttemptStore = createAvatarShotAttemptStore()

export const AVATAR_APPEARANCE_KEYS = [
  'smooth_skin',
  'makeup',
  'remove_blemishes',
  'slim_face',
  'exposure',
  'brilliance',
  'highlights',
  'shadows',
  'contrast',
  'brightness',
  'saturation',
  'warmth',
] as const

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = {
  smooth_skin: 0,
  makeup: 0,
  remove_blemishes: 0,
  slim_face: 0,
  exposure: 50,
  brilliance: 50,
  highlights: 50,
  shadows: 50,
  contrast: 50,
  brightness: 50,
  saturation: 50,
  warmth: 50,
}

export const AVATAR_ANGLE_PRESETS = [
  'front',
  'three_quarter_left',
  'three_quarter_right',
  'left_profile',
  'right_profile',
  'slight_up',
  'slight_down',
] as const

export const AVATAR_ANGLE_PROMPTS: Record<AvatarAnglePreset, string> = {
  front: 'Keep the same person and clothing. Recreate the portrait from a direct front-facing camera angle, eyes to camera, neutral head pose.',
  three_quarter_left: "Keep the same person and clothing. Recreate the portrait from a three-quarter camera angle to the subject's left.",
  three_quarter_right: "Keep the same person and clothing. Recreate the portrait from a three-quarter camera angle to the subject's right.",
  left_profile: 'Keep the same person and clothing. Recreate the portrait as a true left profile, camera at 90 degrees.',
  right_profile: 'Keep the same person and clothing. Recreate the portrait as a true right profile, camera at 90 degrees.',
  slight_up: 'Keep the same person and clothing. Recreate the portrait from a slightly low camera, looking mildly upward.',
  slight_down: 'Keep the same person and clothing. Recreate the portrait from a slightly high camera, looking mildly downward.',
}

export const AVATAR_LOOK_MODEL_IDS = [
  'angle-gpt-image-2.5-sunburst',
  'angle-gpt-image-2.5-flare',
] as const
export type AvatarLookModelId = typeof AVATAR_LOOK_MODEL_IDS[number]
export const DEFAULT_AVATAR_LOOK_MODEL_ID: AvatarLookModelId = 'angle-gpt-image-2.5-sunburst'

export const AVATAR_STORAGE_ROLES = [
  'avatar',
  'avatar_reference',
  'avatar_shot',
  'avatar_preview',
] as const

const listMetaSchema = z.object({
  total: z.number().catch(0),
  limit: z.number().catch(20),
  offset: z.number().catch(0),
  hasMore: z.boolean().catch(false),
  nextCursor: z.string().nullable().catch(null),
})

export const avatarOriginSchema = z.enum(['human_clone', 'digital_human', 'public_template'])
export const avatarStatusSchema = z.enum([
  'provisioning',
  'ready',
  'failed',
  'disabled',
  'deleting',
  'deleted',
])
export const avatarShotStatusSchema = z.enum(['processing', 'completed', 'failed'])
export const avatarShotKindSchema = z.enum([
  'create',
  'look',
  'appearance',
  'edit',
  'angle',
  'upscale',
  'crop',
  'public_template',
])
export const avatarKindSchema = z.enum(['human_clone', 'digital_human'])
export const recordingSessionStateSchema = z.enum([
  'created',
  'opened',
  'uploading',
  'uploaded',
  'consumed',
  'expired',
  'revoked',
])
export const avatarBackgroundModeSchema = z.enum(['original', 'removed', 'color'])
export const avatarOrientationSchema = z.enum(['landscape', 'portrait'])
export const avatarAnglePresetSchema = z.enum(AVATAR_ANGLE_PRESETS)

const appearanceShape = Object.fromEntries(
  AVATAR_APPEARANCE_KEYS.map((key) => [key, z.number().catch(DEFAULT_AVATAR_APPEARANCE[key])]),
) as unknown as { [K in AvatarAppearanceKey]: z.ZodType<number> }

export const avatarAppearanceSchema = z.object(appearanceShape).catch(DEFAULT_AVATAR_APPEARANCE)

export const digitalHumanBriefSchema = z.object({
  prompt: z.string(),
  style: z.string().nullable().optional().catch(null),
  orientation: avatarOrientationSchema.nullable().optional().catch(null),
  age: z.string().nullable().optional().catch(null),
  gender: z.string().nullable().optional().catch(null),
  ethnicity: z.string().nullable().optional().catch(null),
  name: z.string().nullable().optional().catch(null),
})

export const avatarSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  display_name: z.string(),
  origin: avatarOriginSchema,
  status: avatarStatusSchema,
  primary_shot_id: z.string().nullable().catch(null),
  default_voice_profile_id: z.string().nullable().catch(null),
  catalog_template_id: z.string().nullable().catch(null),
  source_storage_object_id: z.string().nullable().optional().catch(null),
  preview_storage_object_id: z.string().nullable().optional().catch(null),
  audio_storage_object_id: z.string().nullable().optional().catch(null),
  failure_code: z.string().nullable().catch(null),
  recording_refund_status: z.enum(["none", "pending", "completed"]).nullable().optional().catch(null),
  metadata: z.record(z.unknown()).catch({}),
  created_at: z.string(),
  updated_at: z.string(),
})

const cropBoxSchema = z.record(z.unknown()).nullable().catch(null)

export const avatarShotSchema = z.object({
  id: z.string(),
  avatar_id: z.string(),
  display_name: z.string(),
  status: avatarShotStatusSchema,
  kind: avatarShotKindSchema,
  is_primary: z.boolean().catch(false),
  storage_object_id: z.string().nullable().catch(null),
  source_shot_id: z.string().nullable().catch(null),
  appearance: avatarAppearanceSchema,
  prompt: z.string().nullable().catch(null),
  background_mode: avatarBackgroundModeSchema.catch('original'),
  background_color: z.string().nullable().catch(null),
  crop_box: cropBoxSchema,
  workflow_id: z.string().nullable().catch(null),
  failure_code: z.string().nullable().catch(null),
  created_at: z.string(),
  updated_at: z.string(),
})

export const publicAvatarTemplateSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  style: z.string().nullable().catch(null),
  gender: z.enum(['female', 'male', 'nonbinary', 'unknown']).nullable().catch(null),
  age_band: z.enum(['young', 'adult', 'mature', 'unknown']).nullable().catch(null),
  ethnicity: z.string().nullable().catch(null),
  orientation: avatarOrientationSchema.nullable().catch(null),
  featured: z.boolean().catch(false),
  tags: z.array(z.string()).catch([]),
  preview_url: z.string().nullable().catch(null),
  preview_storage_key: z.string().nullable().optional().catch(null),
  status: z.string().optional().catch(undefined),
})

const recordingConstraintsSchema = z.object({
  width: z.number().catch(1920),
  height: z.number().catch(1080),
  fps: z.number().catch(30),
  min_duration_seconds: z.number().catch(8),
  max_duration_seconds: z.number().catch(60),
  consent_script: z.string().catch(''),
  voice_min_duration_seconds: z.number().optional().catch(undefined),
  voice_max_duration_seconds: z.number().optional().catch(undefined),
  image_max_bytes: z.number().optional().catch(undefined),
  voice_max_bytes: z.number().optional().catch(undefined),
})

export const recordingCaptureKindSchema = z.enum(RECORDING_CAPTURE_KINDS)
export const recordingCaptureStepStateSchema = z.enum(RECORDING_CAPTURE_STEP_STATES)
export const recordingCaptureModeSchema = z.enum(['photo_voice', 'video'])

const recordingCaptureStepSchema = z.object({
  state: recordingCaptureStepStateSchema.catch('pending'),
}).passthrough().catch({ state: 'pending' as const })

export const recordingCaptureStepsSchema = z.object({
  identity_image: recordingCaptureStepSchema.optional().catch(undefined),
  voice_sample: recordingCaptureStepSchema.optional().catch(undefined),
})

export const recordingSessionSchema = z.object({
  id: z.string(),
  token: z.string().optional().catch(undefined),
  recording_url: z.string().optional().catch(undefined),
  expires_at: z.string(),
  qr_payload: z.string().nullable().optional().catch(null),
  constraints: recordingConstraintsSchema.catch({
    width: 1920,
    height: 1080,
    fps: 30,
    min_duration_seconds: 8,
    max_duration_seconds: 60,
    consent_script: '',
  }),
  state: recordingSessionStateSchema,
  language: z.string().catch('en'),
  consent_script: z.string().catch(''),
  prompter_text: z.string().catch(''),
  storage_object_id: z.string().nullable().catch(null),
  channel_id: z.string().optional().catch(undefined),
  avatar_id: z.string().nullable().optional().catch(null),
  display_name: z.string().nullable().optional().catch(null),
  upload_session_id: z.string().nullable().optional().catch(null),
  recovery_required: z.boolean().optional().catch(undefined),
  token_generation: z.number().optional().catch(undefined),
  auto_create_status: z.enum(['pending', 'failed', 'completed']).nullable().optional().catch(null),
  refund_status: z.enum(['none', 'pending', 'completed']).nullable().optional().catch(null),
  auto_create_failure_code: z.string().nullable().optional().catch(null),
  capture_mode: recordingCaptureModeSchema.nullable().optional().catch(null),
  steps: recordingCaptureStepsSchema.nullable().optional().catch(null),
})

const recordingUploadSessionSchema = z.object({
  upload_session_id: z.string(),
  object_id: z.string().optional().catch(undefined),
  upload_url: z.string(),
  upload_method: z.enum(['PUT', 'POST']).catch('PUT'),
  upload_headers: z.record(z.string()).catch({}),
  finalize_token: z.string().nullable().catch(null),
  expires_at: z.string().optional().catch(undefined),
  upload_mode: z.enum(['direct', 'proxy', 'tus']).optional().catch(undefined),
  upload_protocol: z.enum(['put', 'multipart', 'tus']).optional().catch(undefined),
  tus_metadata: z.record(z.string()).nullable().optional().catch(null),
  storage_key: z.string().optional().catch(undefined),
  path: z.string().optional().catch(undefined),
  provider_target: z.object({
    url: z.string(),
    method: z.enum(['PUT', 'POST']),
    headers: z.record(z.string()).catch({}),
    metadata: z.record(z.string()).optional().catch(undefined),
  }).nullable().optional().catch(null),
}).passthrough()

const avatarResponseSchema = z.object({ data: avatarSchema })
const avatarListResponseSchema = z.object({
  data: z.array(avatarSchema).catch([]),
  meta: listMetaSchema.catch({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
    nextCursor: null,
  }),
})
const avatarShotResponseSchema = z.object({ data: avatarShotSchema })
const avatarShotListResponseSchema = z.object({
  data: z.array(avatarShotSchema).catch([]),
  meta: listMetaSchema.optional().catch(undefined),
})
const publicAvatarListResponseSchema = z.object({
  data: z.array(publicAvatarTemplateSchema).catch([]),
  meta: listMetaSchema.catch({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
    nextCursor: null,
  }),
})
const recordingSessionResponseSchema = z.object({ data: recordingSessionSchema })
const recordingUploadResponseSchema = z.object({ data: recordingUploadSessionSchema })
const recordingCompleteResponseSchema = z.object({
  data: z.object({
    storage_object_id: z.string().nullable().optional().catch(null),
    state: recordingSessionStateSchema.optional().catch(undefined),
    idempotent: z.boolean().optional().catch(undefined),
    avatar_id: z.string().nullable().optional().catch(null),
    display_name: z.string().nullable().optional().catch(null),
    auto_create_status: z.enum(['pending', 'failed', 'completed']).nullable().optional().catch(null),
    refund_status: z.enum(['none', 'pending', 'completed']).nullable().optional().catch(null),
    steps: recordingCaptureStepsSchema.nullable().optional().catch(null),
  }).passthrough(),
})
const emptyDataResponseSchema = z.object({ data: z.unknown().optional() }).passthrough()

export type Avatar = z.infer<typeof avatarSchema>
export type AvatarOrigin = z.infer<typeof avatarOriginSchema>
export type AvatarStatus = z.infer<typeof avatarStatusSchema>
export type AvatarKind = z.infer<typeof avatarKindSchema>
export type AvatarShot = z.infer<typeof avatarShotSchema>
export type AvatarShotStatus = z.infer<typeof avatarShotStatusSchema>
export type AvatarShotKind = z.infer<typeof avatarShotKindSchema>
export type AvatarAppearance = Record<AvatarAppearanceKey, number>
export type AvatarAppearanceKey = typeof AVATAR_APPEARANCE_KEYS[number]
export type AvatarAnglePreset = typeof AVATAR_ANGLE_PRESETS[number]
export type AvatarOrientation = z.infer<typeof avatarOrientationSchema>
export type DigitalHumanBrief = z.infer<typeof digitalHumanBriefSchema>
export type PublicAvatarTemplate = z.infer<typeof publicAvatarTemplateSchema>
export type RecordingSession = z.infer<typeof recordingSessionSchema>
export type RecordingSessionState = z.infer<typeof recordingSessionStateSchema>
export type RecordingConstraints = z.infer<typeof recordingConstraintsSchema>
export type RecordingCaptureMode = z.infer<typeof recordingCaptureModeSchema>
export type RecordingCaptureSteps = z.infer<typeof recordingCaptureStepsSchema>
export type RecordingCompleteResult = z.infer<typeof recordingCompleteResponseSchema>['data']
export type { RecordingCaptureKind } from '@/lib/avatar/recording-capture'
export type RecordingUploadSession = z.infer<typeof recordingUploadSessionSchema>
export type AvatarListResponse = z.infer<typeof avatarListResponseSchema>
export type PublicAvatarListResponse = z.infer<typeof publicAvatarListResponseSchema>

export type AvatarListInput = {
  channelId: string
  cursor?: string
  limit?: number
  origin?: AvatarOrigin
  status?: AvatarStatus
}

export type PublicAvatarListInput = {
  search?: string
  style?: string
  gender?: 'female' | 'male' | 'nonbinary' | 'unknown'
  ageBand?: 'young' | 'adult' | 'mature' | 'unknown'
  featured?: boolean
  cursor?: string
  limit?: number
}

type GatewayRequestOptions = {
  signal?: AbortSignal
}

export function avatarsQueryKey(input: AvatarListInput) {
  return [...AVATARS_QUERY_KEY, input] as const
}

export function avatarQueryKey(channelId: string | null, avatarId: string | null) {
  return [...AVATAR_DETAIL_QUERY_KEY, channelId, avatarId] as const
}

export function avatarShotsQueryKey(channelId: string | null, avatarId: string | null) {
  return [...AVATAR_SHOTS_QUERY_KEY, channelId, avatarId] as const
}

export function publicAvatarsQueryKey(input: PublicAvatarListInput = {}) {
  return [...PUBLIC_AVATARS_QUERY_KEY, input] as const
}

export function recordingSessionQueryKey(sessionId: string | null) {
  return [...RECORDING_SESSION_QUERY_KEY, sessionId] as const
}

export function createAvatarIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

export function resolveRecordingPageUrl(session: Pick<RecordingSession, 'token' | 'recording_url' | 'qr_payload'>) {
  const token = resolveRecordingToken(session)
  if (session.recording_url?.trim()) return session.recording_url.trim()
  if (session.qr_payload?.trim()?.startsWith('http')) return session.qr_payload.trim()
  if (token && typeof window !== 'undefined') {
    return `${window.location.origin}/r/${encodeURIComponent(token)}`
  }
  return token ? `/r/${encodeURIComponent(token)}` : ''
}

export function resolveRecordingToken(
  session: Pick<RecordingSession, 'token' | 'recording_url' | 'qr_payload'>,
) {
  if (session.token?.trim()) return session.token.trim()
  for (const value of [session.recording_url, session.qr_payload]) {
    const match = value?.trim().match(/\/r\/([^/?#]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return ''
}

export async function listAvatars(input: AvatarListInput, options: GatewayRequestOptions = {}) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.limit !== undefined) query.set('limit', String(input.limit))
  if (input.origin) query.set('origin', input.origin)
  if (input.status) query.set('status', input.status)
  return gatewayRequest(`/api/v1/avatars?${query.toString()}`, {
    schema: avatarListResponseSchema,
    signal: options.signal,
  })
}

export async function getAvatar(
  avatarId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(avatarId)}?${query.toString()}`,
    { schema: avatarResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function getAvatarEntitlement(channelId: string, options: GatewayRequestOptions = {}) {
  const query = new URLSearchParams({ channel_id: channelId })
  const result = await gatewayRequest(`/api/v1/avatars/entitlement?${query.toString()}`, {
    schema: avatarEntitlementResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export type CreateAvatarInput = {
  channelId: string
  kind: AvatarKind
  displayName: string
  idempotencyKey: string
  sourceStorageObjectId?: string
  recordingSessionId?: string
  brief?: DigitalHumanBrief
  catalogTemplateId?: string
  character?: AvatarCharacterPayload
  voice?: AvatarVoicePayload
  expectedPrice?: AvatarExpectedPrice
}

export function buildAvatarCreateBody(input: CreateAvatarInput) {
  return stripUndefined({
    channel_id: input.channelId,
    kind: input.kind,
    display_name: input.displayName,
    idempotency_key: input.idempotencyKey,
    source_storage_object_id: input.sourceStorageObjectId,
    recording_session_id: input.recordingSessionId,
    brief: input.brief,
    catalog_template_id: input.catalogTemplateId,
    character: input.character,
    voice: input.voice,
    expected_price: input.expectedPrice,
  }) as Record<string, unknown>
}

export async function createAvatar(
  input: CreateAvatarInput,
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest('/api/v1/avatars', {
    method: 'POST',
    csrf: true,
    body: buildAvatarCreateBody(input),
    schema: avatarResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export type AvatarVoiceCloneInput = {
  avatarId: string
  channelId: string
  source: 'recording' | 'upload'
  storageObjectId?: string
  consentAccepted?: boolean
  expectedPrice?: AvatarExpectedPrice
  idempotencyKey?: string
}

export function buildAvatarVoiceCloneBody(input: AvatarVoiceCloneInput) {
  if (input.source === 'upload') {
    return stripUndefined({
      source: 'upload',
      storage_object_id: input.storageObjectId,
      consent_accepted: input.consentAccepted === true ? true : undefined,
      expected_price: input.expectedPrice,
      idempotency_key: input.idempotencyKey,
    }) as Record<string, unknown>
  }
  return stripUndefined({
    source: 'recording',
    expected_price: input.expectedPrice,
    idempotency_key: input.idempotencyKey,
  }) as Record<string, unknown>
}

/** Clones a voice for this avatar (from the private capture recording or an uploaded file). */
export async function cloneAvatarVoice(
  input: AvatarVoiceCloneInput,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(input.avatarId)}/voice/clone?${query.toString()}`,
    {
      method: 'POST',
      csrf: true,
      body: buildAvatarVoiceCloneBody(input),
      schema: emptyDataResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function deleteAvatar(
  input: { avatarId: string; channelId: string },
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(input.avatarId)}?${query.toString()}`,
    {
      method: 'DELETE',
      csrf: true,
      schema: z.object({
        data: z.object({
          deleted: z.literal(true).or(z.boolean()),
          idempotent: z.boolean().optional(),
        }).passthrough(),
      }),
      signal: options.signal,
    },
  )
  return result.data
}

export async function renameAvatar(
  input: { avatarId: string; channelId: string; displayName: string },
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(input.avatarId)}?${query.toString()}`,
    {
      method: 'PATCH',
      csrf: true,
      body: { display_name: input.displayName },
      schema: avatarResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function assignAvatarVoice(
  input: { avatarId: string; channelId: string; voiceProfileId?: string | null },
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(input.avatarId)}/voice?${query.toString()}`,
    {
      method: 'POST',
      csrf: true,
      body: toAssignAvatarVoiceBody(input),
      schema: avatarResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function listAvatarShots(
  avatarId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(avatarId)}/shots?${query.toString()}`,
    { schema: avatarShotListResponseSchema, signal: options.signal },
  )
  return result.data
}

export type CreateAvatarShotInput = {
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
  idempotencyKey?: string
}

export function createAvatarShotAttemptStore(storage?: ClientKeyValueStorage | null) {
  return new ClientMutationAttemptStore<AvatarShotAttemptPayload>({
    storageKey: 'youtorch:avatar-shot-attempts:v1',
    isPayload: (value): value is AvatarShotAttemptPayload => Boolean(
      value
      && typeof value === 'object'
      && typeof (value as Partial<AvatarShotAttemptPayload>).avatarId === 'string'
      && typeof (value as Partial<AvatarShotAttemptPayload>).channelId === 'string',
    ),
    ...(storage !== undefined ? { storage } : {}),
  })
}

export function getAvatarShotAttemptFingerprint(input: CreateAvatarShotInput) {
  return stableClientFingerprint({
    avatar_id: input.avatarId,
    channel_id: input.channelId,
    body: toShotCreateBody(input),
  })
}

export function getAvatarShotAttemptScope(input: CreateAvatarShotInput, fingerprint: string) {
  return `avatar-shot:${input.channelId}:${input.avatarId}:${fingerprint}`
}

export async function createAvatarShot(
  input: CreateAvatarShotInput,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const explicitIdempotencyKey = input.idempotencyKey?.trim() || null
  const fingerprint = getAvatarShotAttemptFingerprint(input)
  const scope = getAvatarShotAttemptScope(input, fingerprint)
  const storedAttempt = explicitIdempotencyKey ? null : avatarShotAttemptStore.find(scope, fingerprint)
  const attempt = storedAttempt ?? (explicitIdempotencyKey
    ? { idempotencyKey: explicitIdempotencyKey }
    : avatarShotAttemptStore.save({
        scope,
        fingerprint,
        idempotencyKey: createAvatarIdempotencyKey('avatar-shot'),
        payload: { avatarId: input.avatarId, channelId: input.channelId },
      }))

  try {
    const result = await gatewayRequest(
      `/api/v1/avatars/${encodeURIComponent(input.avatarId)}/shots?${query.toString()}`,
      {
        method: 'POST',
        csrf: true,
        body: { ...toShotCreateBody(input), idempotency_key: attempt.idempotencyKey },
        schema: avatarShotResponseSchema,
        signal: options.signal,
      },
    )
    if (!explicitIdempotencyKey) avatarShotAttemptStore.clear(scope, attempt.idempotencyKey)
    return result.data
  } catch (error) {
    if (!explicitIdempotencyKey && !isAmbiguousMutationError(error)) {
      avatarShotAttemptStore.clear(scope, attempt.idempotencyKey)
    }
    throw error
  }
}

export async function patchAvatarShot(
  input: {
    avatarId: string
    shotId: string
    channelId: string
    appearance?: Partial<AvatarAppearance>
    prompt?: string | null
    backgroundMode?: z.infer<typeof avatarBackgroundModeSchema>
    backgroundColor?: string | null
    cropBox?: Record<string, unknown> | null
    primary?: boolean
  },
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: input.channelId })
  const result = await gatewayRequest(
    `/api/v1/avatars/${encodeURIComponent(input.avatarId)}/shots/${encodeURIComponent(input.shotId)}?${query.toString()}`,
    {
      method: 'PATCH',
      csrf: true,
      body: {
        appearance: input.appearance,
        prompt: input.prompt,
        background_mode: input.backgroundMode,
        background_color: input.backgroundColor,
        crop_box: input.cropBox,
        primary: input.primary,
        is_primary: input.primary,
      },
      schema: avatarShotResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function listPublicAvatars(
  input: PublicAvatarListInput = {},
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams()
  if (input.search) query.set('search', input.search)
  if (input.style) query.set('style', input.style)
  if (input.gender) query.set('gender', input.gender)
  if (input.ageBand) query.set('age_band', input.ageBand)
  if (input.featured !== undefined) query.set('featured', String(input.featured))
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.limit !== undefined) query.set('limit', String(input.limit))
  const suffix = query.toString()
  return gatewayRequest(`/api/v1/public-avatars${suffix ? `?${suffix}` : ''}`, {
    schema: publicAvatarListResponseSchema,
    signal: options.signal,
  })
}

export async function recreatePublicAvatar(
  input: {
    templateId: string
    channelId: string
    displayName: string
    idempotencyKey: string
    expectedPrice?: AvatarExpectedPrice
  },
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    `/api/v1/public-avatars/${encodeURIComponent(input.templateId)}/recreate`,
    {
      method: 'POST',
      csrf: true,
      body: stripUndefined({
        channel_id: input.channelId,
        display_name: input.displayName,
        idempotency_key: input.idempotencyKey,
        expected_price: input.expectedPrice,
      }),
      schema: avatarResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export type CreateRecordingSessionInput = {
  channelId: string
  avatarId?: string
  language?: string
  idempotencyKey: string
  expectedPrice?: AvatarExpectedPrice
  createVoiceFromRecording?: boolean
}

export function buildRecordingSessionCreateBody(input: CreateRecordingSessionInput) {
  return stripUndefined({
    channel_id: input.channelId,
    avatar_id: input.avatarId,
    language: input.language,
    idempotency_key: input.idempotencyKey,
    expected_price: input.expectedPrice,
    create_voice_from_recording: input.createVoiceFromRecording,
  }) as Record<string, unknown>
}

export async function createRecordingSession(
  input: CreateRecordingSessionInput,
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest('/api/v1/recording-sessions', {
    method: 'POST',
    csrf: true,
    body: buildRecordingSessionCreateBody(input),
    schema: recordingSessionResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getRecordingSession(sessionId: string, options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest(
    `/api/v1/recording-sessions/${encodeURIComponent(sessionId)}`,
    { schema: recordingSessionResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function patchRecordingSession(
  input: { sessionId: string; displayName: string },
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    `/api/v1/recording-sessions/${encodeURIComponent(input.sessionId)}`,
    {
      method: 'PATCH',
      csrf: true,
      body: { display_name: input.displayName },
      schema: recordingSessionResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function rotateRecordingSessionToken(
  input: { sessionId: string; idempotencyKey: string },
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    `/api/v1/recording-sessions/${encodeURIComponent(input.sessionId)}/rotate`,
    {
      method: 'POST',
      csrf: true,
      body: { idempotency_key: input.idempotencyKey },
      schema: recordingSessionResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function revokeRecordingSession(sessionId: string, options: GatewayRequestOptions = {}) {
  await gatewayRequest(`/api/v1/recording-sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
    csrf: true,
    schema: emptyDataResponseSchema,
    signal: options.signal,
  })
}

export async function getPublicRecordingSession(token: string, options: GatewayRequestOptions = {}) {
  const result = await publicGatewayRequest(
    `/api/v1/record/${encodeURIComponent(token)}`,
    { schema: recordingSessionResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function openPublicRecordingSession(token: string, options: GatewayRequestOptions = {}) {
  const result = await publicGatewayRequest(
    `/api/v1/record/${encodeURIComponent(token)}/open`,
    { method: 'POST', schema: recordingSessionResponseSchema, signal: options.signal },
  )
  return result.data
}

export async function createPublicRecordingUpload(
  input: {
    token: string
    fileName: string
    sizeBytes: number
    mimeType: string
    checksumSha256: string
    idempotencyKey: string
    captureKind: RecordingCaptureKind
    /** Voice samples only: measured recording length in milliseconds. */
    durationMs?: number
  },
  options: GatewayRequestOptions = {},
) {
  const result = await publicGatewayRequest(
    `/api/v1/record/${encodeURIComponent(input.token)}/uploads`,
    {
      method: 'POST',
      body: buildPublicRecordingUploadBody(input),
      schema: recordingUploadResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function completePublicRecordingUpload(
  input: {
    token: string
    uploadSessionId: string
    finalizeToken?: string | null
    consentAccepted: true
    captureKind: RecordingCaptureKind
  },
  options: GatewayRequestOptions = {},
) {
  const result = await publicGatewayRequest(
    `/api/v1/record/${encodeURIComponent(input.token)}/complete`,
    {
      method: 'POST',
      body: buildPublicRecordingCompleteBody(input),
      schema: recordingCompleteResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

/**
 * Uploads one capture step (identity photo or voice sample) through the token API:
 * initiate (per-kind upload intent) -> direct PUT -> complete. The session becomes `uploaded`
 * once both kinds are completed.
 */
export async function uploadPublicRecordingCapture(
  input: {
    token: string
    file: File
    captureKind: RecordingCaptureKind
    /** Voice samples only: measured recording length in milliseconds. */
    durationMs?: number
    checksumSha256: string
    consentAccepted: true
    onProgress?: (progress: number) => void
  },
  options: GatewayRequestOptions = {},
) {
  input.onProgress?.(2)
  const file = alignCaptureUploadFile(input.file, input.captureKind)
  const upload = await createPublicRecordingUpload({
    token: input.token,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    checksumSha256: input.checksumSha256,
    idempotencyKey: input.checksumSha256,
    captureKind: input.captureKind,
    durationMs: input.durationMs,
  }, options)
  if (!upload.finalize_token) {
    throw new AuthClientError('STORAGE_UPLOAD_TARGET_INVALID', 'Recording upload is missing a finalize token.', 502)
  }
  input.onProgress?.(8)
  await putPublicRecordingFile(upload, file, {
    ...options,
    onProgress: (progress) => input.onProgress?.(8 + Math.round(progress * 0.86)),
  })
  input.onProgress?.(96)
  const completed = await completePublicRecordingUpload({
    token: input.token,
    uploadSessionId: upload.upload_session_id,
    finalizeToken: upload.finalize_token,
    consentAccepted: input.consentAccepted,
    captureKind: input.captureKind,
  }, options)
  input.onProgress?.(100)
  return completed
}

export async function putPublicRecordingFile(
  session: RecordingUploadSession,
  file: File,
  options: GatewayRequestOptions & { onProgress?: (progress: number) => void } = {},
) {
  const initiated = toRecordingInitiateResult(session)
  const transport = resolveStorageUploadTransport({
    upload_mode: initiated.upload_mode,
    upload_protocol: initiated.upload_protocol,
  })
  if (transport !== 'direct') {
    throw new AuthClientError(
      'STORAGE_UPLOAD_TARGET_INVALID',
      'Recording upload requires a direct PUT target.',
      502,
    )
  }
  await uploadDirectContent({
    session: initiated,
    file,
    onProgress: options.onProgress ?? (() => undefined),
    signal: options.signal,
  })
}

function toRecordingInitiateResult(session: RecordingUploadSession): InitiateUploadResult {
  const protocol = session.upload_protocol
    ?? (session.upload_mode === 'tus' || session.upload_method === 'POST' ? 'tus' : 'put')
  const mode = session.upload_mode
    ?? (protocol === 'tus' ? 'tus' : 'direct')
  return {
    upload_session_id: session.upload_session_id,
    object_id: session.object_id ?? session.upload_session_id,
    upload_status: 'pending',
    upload_mode: mode,
    upload_url: session.upload_url,
    upload_method: session.upload_method,
    upload_headers: session.upload_headers,
    provider_target: session.provider_target ?? null,
    upload_protocol: protocol,
    tus_metadata: session.tus_metadata ?? null,
    provider_video_id: null,
    finalize_token: session.finalize_token,
    expires_at: session.expires_at ?? new Date(Date.now() + 15 * 60_000).toISOString(),
    storage_key: session.storage_key ?? '',
    path: session.path ?? '',
  }
}

async function publicGatewayRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    schema: TSchema
    signal?: AbortSignal
  },
): Promise<z.output<TSchema>> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  const body = options.body === undefined ? undefined : JSON.stringify(stripUndefined(options.body))
  if (options.body !== undefined) headers['content-type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${getPublicRecordingApiBaseUrl(getYoutorchApiBaseUrl())}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'omit',
      headers,
      body,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new AuthClientError('GATEWAY_NETWORK_ERROR', 'Gateway request failed before receiving a response.', 502, {
      path,
      method,
      cause: error instanceof Error ? error.message : String(error),
    })
  }

  if (!response.ok) throw await parseAuthErrorResponse(response)

  try {
    return options.schema.parse(await response.json())
  } catch {
    throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
  }
}

function stripUndefined(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

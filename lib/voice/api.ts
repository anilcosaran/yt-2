'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

export const VOICE_PROFILES_QUERY_KEY = ['voice', 'profiles'] as const
const opaqueVoiceIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/)

export const voiceConsentSubjectTypeSchema = z.enum([
  'self',
  'authorized_third_party',
  'licensed_voice',
])

const instantVoiceCloneConsentSchema = z.object({
  consent_id: opaqueVoiceIdentifierSchema,
  status: z.enum(['granted', 'revoked', 'expired']),
  reference_storage_object_id: opaqueVoiceIdentifierSchema,
  policy_version: z.string().min(1),
  expires_at: z.string().nullable(),
  replayed: z.boolean().catch(false),
})

const instantVoiceCloneConsentResponseSchema = z.object({
  data: instantVoiceCloneConsentSchema,
})

export const voiceProfileOriginSchema = z.enum([
  'stock',
  'instant_clone',
  'professional_clone',
  'designed',
  'localized',
])

export const voiceProfileStatusSchema = z.enum([
  'provisioning',
  'ready',
  'failed',
  'disabled',
  'deleting',
  'deleted',
])

export const voiceProfileSchema = z.object({
  id: z.string(),
  channel_id: z.string().nullable().catch(null),
  display_name: z.string(),
  origin: voiceProfileOriginSchema,
  status: voiceProfileStatusSchema,
  default_language: z.string().nullable().catch(null),
  supported_languages: z.array(z.string()).catch([]),
  preview_available: z.boolean().catch(false),
  catalog: z.object({
    description: z.string().nullable().catch(null),
    gender: z.enum(['female', 'male', 'nonbinary', 'unknown']).catch('unknown'),
    age_band: z.enum(['young', 'adult', 'mature', 'unknown']).catch('unknown'),
    accent: z.string().nullable().catch(null),
    tone_tags: z.array(z.string()).catch([]),
    use_case_tags: z.array(z.string()).catch([]),
    featured: z.boolean().catch(false),
    demo_text: z.string().nullable().catch(null),
    demo_language: z.string().nullable().catch(null),
  }).catch({
    description: null,
    gender: 'unknown',
    age_band: 'unknown',
    accent: null,
    tone_tags: [],
    use_case_tags: [],
    featured: false,
    demo_text: null,
    demo_language: null,
  }),
  compatible_model_ids: z.array(z.string()).catch([]),
  created_at: z.string(),
  updated_at: z.string(),
})

const voiceProfileResponseSchema = z.object({
  data: voiceProfileSchema,
})

const voiceProfilePreviewResponseSchema = z.object({
  data: z.object({
    voice_profile_id: opaqueVoiceIdentifierSchema,
    url: z.string().url(),
    expires_in_seconds: z.number().int().positive(),
  }),
})

const voiceProfileFavoritesResponseSchema = z.object({
  data: z.object({
    voice_profile_ids: z.array(opaqueVoiceIdentifierSchema).catch([]),
  }),
})

const voiceProfileListResponseSchema = z.object({
  data: z.array(voiceProfileSchema).catch([]),
  meta: z.object({
    total: z.number().catch(0),
    limit: z.number().catch(20),
    offset: z.number().catch(0),
    hasMore: z.boolean().catch(false),
    nextCursor: z.string().nullable().catch(null),
  }),
})

export const voiceProfileDeletionStatusSchema = z.enum(['deleting', 'deleted'])

const deleteVoiceProfileResponseSchema = z.object({
  data: z.object({
    voice_profile_id: z.string(),
    status: voiceProfileDeletionStatusSchema,
    idempotent: z.boolean().catch(false),
  }),
})

export type VoiceProfile = z.infer<typeof voiceProfileSchema>
export type VoiceProfileOrigin = z.infer<typeof voiceProfileOriginSchema>
export type VoiceProfileStatus = z.infer<typeof voiceProfileStatusSchema>
export type VoiceProfileDeletionStatus = z.infer<typeof voiceProfileDeletionStatusSchema>
export type VoiceProfileListResponse = z.infer<typeof voiceProfileListResponseSchema>
export type DeleteVoiceProfileResult = z.infer<typeof deleteVoiceProfileResponseSchema>['data']
export type InstantVoiceCloneConsent = z.infer<typeof instantVoiceCloneConsentSchema>
export type VoiceConsentSubjectType = z.infer<typeof voiceConsentSubjectTypeSchema>

export type VoiceProfileListInput = {
  channelId?: string
  modelId?: string
  language?: string
  profileId?: string
  search?: string
  gender?: 'female' | 'male' | 'nonbinary' | 'unknown'
  ageBand?: 'young' | 'adult' | 'mature' | 'unknown'
  accent?: string
  tag?: string
  featured?: boolean
  origin?: VoiceProfileOrigin
  status?: VoiceProfileStatus
  cursor?: string
  limit?: number
  offset?: number
}

type GatewayRequestOptions = {
  signal?: AbortSignal
}

export function voiceProfilesQueryKey(input: VoiceProfileListInput = {}) {
  return [...VOICE_PROFILES_QUERY_KEY, input] as const
}

export function voiceProfileQueryKey(channelId: string | null, voiceProfileId: string | null) {
  return [...VOICE_PROFILES_QUERY_KEY, 'detail', channelId, voiceProfileId] as const
}

export async function listVoiceProfiles(
  input: VoiceProfileListInput = {},
  options: GatewayRequestOptions = {},
) {
  return gatewayRequest(buildVoiceProfilesRequestPath(input), {
    schema: voiceProfileListResponseSchema,
    signal: options.signal,
  })
}

export function buildVoiceProfilesRequestPath(input: VoiceProfileListInput = {}) {
  const query = toVoiceProfileListParams(input).toString()
  return `/api/v1/voice-profiles${query ? `?${query}` : ''}`
}

export async function getVoiceProfile(
  voiceProfileId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: channelId })
  const result = await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(voiceProfileId)}?${query.toString()}`,
    {
      schema: voiceProfileResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function getVoiceProfilePreview(
  voiceProfileId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: channelId })
  const result = await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(voiceProfileId)}/preview?${query.toString()}`,
    {
      schema: voiceProfilePreviewResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function listVoiceProfileFavorites(
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest('/api/v1/voice-profiles/favorites', {
    schema: voiceProfileFavoritesResponseSchema,
    signal: options.signal,
  })
  return result.data.voice_profile_ids
}

export async function favoriteVoiceProfile(
  voiceProfileId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const query = new URLSearchParams({ channel_id: channelId })
  await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(voiceProfileId)}/favorite?${query.toString()}`,
    {
      method: 'PUT',
      csrf: true,
      schema: z.object({ data: z.object({ voice_profile_id: opaqueVoiceIdentifierSchema }) }),
      signal: options.signal,
    },
  )
}

export async function unfavoriteVoiceProfile(
  voiceProfileId: string,
  options: GatewayRequestOptions = {},
) {
  await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(voiceProfileId)}/favorite`,
    {
      method: 'DELETE',
      csrf: true,
      schema: z.object({ data: z.object({ voice_profile_id: opaqueVoiceIdentifierSchema }) }),
      signal: options.signal,
    },
  )
}

export async function renameVoiceProfile(
  input: {
    voiceProfileId: string
    channelId: string
    displayName: string
  },
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(input.voiceProfileId)}?${new URLSearchParams({ channel_id: input.channelId }).toString()}`,
    {
      method: 'PATCH',
      csrf: true,
      body: {
        display_name: input.displayName,
      },
      schema: voiceProfileResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

export async function deleteVoiceProfile(
  voiceProfileId: string,
  channelId: string,
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    `/api/v1/voice-profiles/${encodeURIComponent(voiceProfileId)}?${new URLSearchParams({ channel_id: channelId }).toString()}`,
    {
      method: 'DELETE',
      csrf: true,
      schema: deleteVoiceProfileResponseSchema,
      signal: options.signal,
    },
  )
  return result.data
}

/**
 * Creates the auditable consent record used by an instant-clone launch.
 *
 * The caller sends the user's attestation, never a consent ID. The returned
 * opaque ID is server-issued and must only be forwarded to the matching launch.
 */
export async function grantInstantVoiceCloneConsent(
  input: {
    channelId: string
    referenceStorageObjectId: string
    subjectType: VoiceConsentSubjectType
    targetSpeechModelId: string
    language: string
    accepted: true
    idempotencyKey: string
    evidenceStorageObjectId?: string
  },
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest('/api/v1/voice-consents', {
    method: 'POST',
    csrf: true,
    body: {
      channel_id: input.channelId,
      subject_type: input.subjectType,
      target_speech_model_id: input.targetSpeechModelId,
      language: input.language,
      reference_storage_object_id: input.referenceStorageObjectId,
      evidence_storage_object_id: input.evidenceStorageObjectId,
      accepted: input.accepted,
      idempotency_key: input.idempotencyKey,
    },
    schema: instantVoiceCloneConsentResponseSchema,
    signal: options.signal,
  })
  return result.data
}

function toVoiceProfileListParams(input: VoiceProfileListInput) {
  const params = new URLSearchParams()
  if (input.channelId) params.set('channel_id', input.channelId)
  if (input.modelId) params.set('model_id', input.modelId)
  if (input.language) params.set('language', input.language)
  if (input.profileId) params.set('profile_id', input.profileId)
  if (input.search) params.set('search', input.search)
  if (input.gender) params.set('gender', input.gender)
  if (input.ageBand) params.set('age_band', input.ageBand)
  if (input.accent) params.set('accent', input.accent)
  if (input.tag) params.set('tag', input.tag)
  if (input.featured !== undefined) params.set('featured', String(input.featured))
  if (input.origin) params.set('origin', input.origin)
  if (input.status) params.set('status', input.status)
  if (input.cursor) params.set('cursor', input.cursor)
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  if (input.offset !== undefined) params.set('offset', String(input.offset))
  return params
}

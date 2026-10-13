'use client'

import { z } from 'zod'

import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'
import { AuthClientError, isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest, getGatewayCsrfToken } from '@/lib/gateway/client'

/**
 * P06-21 Community PublisherIdentity client (`/api/v1/community/me/profile`, `usernames/availability`, `me/avatar/*`,
 * `avatars/delivery`; login only). The username belongs to the ACTOR and is unique on its normalized form; the server
 * alone decides (the availability answer is a hint, never a reservation). The avatar is a bounded, sanitized thumbnail
 * that lives with the platform, not in a user channel. Product data is never kept in browser storage. The Community
 * profile screens are a pending UI decision; this client, the local validation and the notices are the non-visual parts.
 */
const BASE = '/api/v1/community'

export const COMMUNITY_USERNAME = { minLength: 3, maxLength: 30, pattern: /^[a-z0-9_]{3,30}$/ } as const
export const COMMUNITY_AVATAR = {
  maxBytes: 256 * 1024,
  minEdge: 32,
  maxEdge: 512,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const

/** The server's single normalization (NFKC, trimmed, lowercased); the server stays the authority. */
export function normalizeCommunityUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

export type CommunityUsernameProblem = 'empty' | 'invalid_characters' | 'too_short' | 'too_long'

/**
 * Local format check for instant feedback (same order as the server: empty → characters → length). Reserved and taken
 * names are only known to the server, so `null` means "format ok", never "available".
 */
export function communityUsernameProblem(raw: string): CommunityUsernameProblem | null {
  const normalized = normalizeCommunityUsername(raw)
  if (normalized.length === 0) return 'empty'
  if (!/^[a-z0-9_]+$/.test(normalized)) return 'invalid_characters'
  if (normalized.length < COMMUNITY_USERNAME.minLength) return 'too_short'
  if (normalized.length > COMMUNITY_USERNAME.maxLength) return 'too_long'
  return null
}

const profileSchema = z.object({
  schema_version: z.literal('community_profile_v1'),
  identity_id: z.string(),
  username: z.string(),
  avatar: z.object({ present: z.boolean(), version: z.number().int().min(0), mime_type: z.string().nullable(), width: z.number().nullable(), height: z.number().nullable() }),
  verified: z.boolean(),
  version: z.number().int().min(1),
  created_at: z.string(),
})
export type CommunityProfile = z.output<typeof profileSchema>

const profileEnvelopeSchema = z.object({
  data: z.object({
    profile: profileSchema.nullable(),
    username_policy: z.object({ min_length: z.number(), max_length: z.number(), pattern: z.string(), rename: z.boolean() }),
    avatar_policy: z.object({ mime_types: z.array(z.string()), max_bytes: z.number(), min_edge_px: z.number(), max_edge_px: z.number() }),
  }),
})
export type CommunityProfileState = z.output<typeof profileEnvelopeSchema>['data']

const claimSchema = z.object({ data: z.object({ profile: profileSchema, created: z.boolean() }) })
const profileOnlySchema = z.object({ data: z.object({ profile: profileSchema }) })

const availabilitySchema = z.object({
  data: z.object({
    availability: z.object({
      username: z.string(),
      available: z.boolean(),
      reason: z.enum(['empty', 'invalid_characters', 'too_short', 'too_long', 'reserved', 'taken', 'yours']).optional(),
      check: z.enum(['policy', 'hint', 'exact']),
      bloom: z.enum(['false_positive', 'unavailable']).optional(),
      guaranteed: z.literal(false),
    }),
  }),
})
export type CommunityUsernameAvailability = z.output<typeof availabilitySchema>['data']['availability']

const intentSchema = z.object({
  schema_version: z.literal('community_avatar_intent_v1'),
  intent_id: z.string(),
  state: z.enum(['awaiting_upload', 'uploaded', 'attached', 'rejected', 'expired']),
  reason_code: z.string().nullable(),
  upload: z.object({ method: z.literal('PUT'), path: z.string(), content_type: z.string(), max_bytes: z.number() }).nullable(),
  expires_at: z.string(),
  version: z.number(),
})
export type CommunityAvatarIntent = z.output<typeof intentSchema>
const intentEnvelopeSchema = z.object({ data: z.object({ intent: intentSchema, created: z.boolean().optional() }) })

const deliverySchema = z.object({
  data: z.object({
    items: z.array(z.discriminatedUnion('status', [
      z.object({ post_id: z.string(), status: z.literal('ok'), avatar_version: z.number(), url: z.string(), expires_at: z.string() }),
      z.object({ post_id: z.string(), status: z.literal('no_avatar') }),
      z.object({ post_id: z.string(), status: z.literal('unavailable') }),
    ])),
  }),
})
export type CommunityAvatarDeliveryItem = z.output<typeof deliverySchema>['data']['items'][number]

export async function getCommunityProfile(options: { signal?: AbortSignal } = {}): Promise<CommunityProfileState> {
  return (await gatewayRequest(`${BASE}/me/profile`, { schema: profileEnvelopeSchema, signal: options.signal })).data
}

/** First claim of the username (a replay answers the same profile; a rename does not exist). */
export async function claimCommunityUsername(input: { username: string; expectedVersion?: number }): Promise<{ profile: CommunityProfile; created: boolean }> {
  const response = await gatewayRequest(`${BASE}/me/profile`, {
    method: 'PUT',
    csrf: true,
    body: { username: input.username, expected_version: input.expectedVersion },
    schema: claimSchema,
  })
  return response.data
}

/** One availability check. A hint or exact answer, never a reservation: the claim can still lose the race. */
export async function checkCommunityUsername(username: string, options: { signal?: AbortSignal } = {}): Promise<CommunityUsernameAvailability> {
  const response = await gatewayRequest(`${BASE}/usernames/availability?username=${encodeURIComponent(username)}`, {
    schema: availabilitySchema,
    signal: options.signal,
  })
  return response.data.availability
}

export type UsernameCheckState =
  | { status: 'idle' }
  | { status: 'checking'; username: string }
  | { status: 'result'; username: string; availability: CommunityUsernameAvailability }
  | { status: 'problem'; username: string; problem: CommunityUsernameProblem }
  | { status: 'throttled'; username: string; retryAfterSeconds: number }
  | { status: 'error'; username: string }

/**
 * Debounced, latest-wins availability checker (framework-free): typing never sends a request per keystroke, an older
 * answer never overwrites a newer input, a local format problem never reaches the server and a throttled check says when
 * to try again. Timers and the check function are injected (tests use a fake clock).
 */
export function createUsernameChecker(options: {
  onState: (state: UsernameCheckState) => void
  check?: (username: string, signal: AbortSignal) => Promise<CommunityUsernameAvailability>
  debounceMs?: number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}) {
  const check = options.check ?? ((username: string, signal: AbortSignal) => checkCommunityUsername(username, { signal }))
  const setTimer = options.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms))
  const clearTimer = options.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  let generation = 0
  let timer: unknown = null
  let controller: AbortController | null = null

  const cancel = () => {
    generation += 1
    if (timer !== null) clearTimer(timer)
    timer = null
    controller?.abort()
    controller = null
  }

  return {
    input(raw: string) {
      cancel()
      const current = generation
      const username = normalizeCommunityUsername(raw)
      if (username.length === 0) {
        options.onState({ status: 'idle' })
        return
      }
      const problem = communityUsernameProblem(raw)
      if (problem) {
        options.onState({ status: 'problem', username, problem })
        return
      }
      options.onState({ status: 'checking', username })
      timer = setTimer(() => {
        timer = null
        const request = new AbortController()
        controller = request
        check(username, request.signal).then(
          (availability) => {
            if (current === generation) options.onState({ status: 'result', username, availability })
          },
          (error: unknown) => {
            if (current !== generation) return
            const retry = isAuthClientError(error) && error.code === 'COMMUNITY_USERNAME_CHECK_THROTTLED' ? Number((error.details as Record<string, unknown> | undefined)?.['retry_after_seconds']) : NaN
            options.onState(Number.isFinite(retry) ? { status: 'throttled', username, retryAfterSeconds: retry } : { status: 'error', username })
          },
        )
      }, options.debounceMs ?? 350)
    },
    cancel,
  }
}

/** The pixel size an avatar is scaled to before upload: the long edge is at most 512 px, never enlarged. */
export function communityAvatarTargetSize(width: number, height: number): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null
  const scale = Math.min(1, COMMUNITY_AVATAR.maxEdge / Math.max(width, height))
  const target = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
  return Math.min(target.width, target.height) < COMMUNITY_AVATAR.minEdge ? null : target
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as ArrayBuffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createCommunityAvatarIntent(input: { mimeType: string; sizeBytes: number; checksumSha256: string; intentKey: string }): Promise<CommunityAvatarIntent> {
  const response = await gatewayRequest(`${BASE}/me/avatar/upload-intents`, {
    method: 'POST',
    csrf: true,
    body: { mime_type: input.mimeType, size_bytes: input.sizeBytes, checksum_sha256: input.checksumSha256, intent_key: input.intentKey },
    schema: intentEnvelopeSchema,
  })
  return response.data.intent
}

/** The bounded raw bytes of the declared image (the server verifies size, digest and type, then sanitizes it). */
export async function uploadCommunityAvatarContent(input: { intent: CommunityAvatarIntent; bytes: Blob; signal?: AbortSignal; fetcher?: typeof fetch }): Promise<CommunityAvatarIntent> {
  if (!input.intent.upload) throw new AuthClientError('COMMUNITY_AVATAR_INTENT_STATE', 'This avatar upload cannot take bytes.', 409)
  const fetcher = input.fetcher ?? fetch
  const csrf = await getGatewayCsrfToken(input.signal, fetcher)
  const response = await fetcher(`${getYoutorchApiBaseUrl()}${input.intent.upload.path}`, {
    method: 'PUT',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'x-csrf-token': csrf, 'content-type': input.intent.upload.content_type },
    body: input.bytes,
    signal: input.signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; context?: unknown } } | null)?.error
    throw new AuthClientError(error?.code ?? 'COMMUNITY_AVATAR_UPLOAD_FAILED', error?.message ?? 'Avatar upload failed.', response.status, error?.context)
  }
  const parsed = intentEnvelopeSchema.safeParse(payload)
  if (!parsed.success) throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Gateway response was invalid.', 502)
  return parsed.data.data.intent
}

export async function attachCommunityAvatar(input: { intentId: string; expectedVersion: number }): Promise<CommunityProfile> {
  const response = await gatewayRequest(`${BASE}/me/avatar`, {
    method: 'PUT',
    csrf: true,
    body: { intent_id: input.intentId, expected_version: input.expectedVersion },
    schema: profileOnlySchema,
  })
  return response.data.profile
}

export async function removeCommunityAvatar(expectedVersion: number): Promise<CommunityProfile> {
  const response = await gatewayRequest(`${BASE}/me/avatar?expected_version=${expectedVersion}`, {
    method: 'DELETE',
    csrf: true,
    schema: profileOnlySchema,
  })
  return response.data.profile
}

/** Avatar URLs of the publishers of VISIBLE cards (≤ 24 post ids); a missing avatar keeps the card's initials. */
export async function getCommunityAvatarDelivery(postIds: string[], options: { signal?: AbortSignal } = {}): Promise<CommunityAvatarDeliveryItem[]> {
  const response = await gatewayRequest(`${BASE}/avatars/delivery`, {
    method: 'POST',
    csrf: true,
    body: { post_ids: postIds.slice(0, 24) },
    schema: deliverySchema,
    signal: options.signal,
  })
  return response.data.items
}

/** Identity errors that deserve one localized, explanatory notice (everything else keeps the caller's generic handling). */
export type CommunityProfileNotice =
  | { kind: 'usernameTaken' }
  | { kind: 'usernameImmutable'; username: string }
  | { kind: 'usernameInvalid'; reason: 'empty' | 'invalid_characters' | 'too_short' | 'too_long' | 'reserved' }
  | { kind: 'checkThrottled'; retryAfterSeconds: number }
  | { kind: 'avatarInvalid'; reason: string }
  | { kind: 'avatarLimit'; retryAfterSeconds: number }
  | { kind: 'avatarNotReady' }
  | { kind: 'avatarUnavailable' }
  | { kind: 'profileRequired' }
  | { kind: 'versionConflict' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

const USERNAME_REASONS = new Set(['empty', 'invalid_characters', 'too_short', 'too_long', 'reserved'])

export function communityProfileNotice(error: unknown): CommunityProfileNotice | null {
  if (!isAuthClientError(error)) return null
  const details = record(error.details)
  switch (error.code) {
    case 'COMMUNITY_USERNAME_TAKEN':
      return { kind: 'usernameTaken' }
    case 'COMMUNITY_USERNAME_IMMUTABLE':
      return { kind: 'usernameImmutable', username: String(details?.['username'] ?? '') }
    case 'COMMUNITY_USERNAME_INVALID': {
      const reason = String(details?.['reason'] ?? '')
      return USERNAME_REASONS.has(reason) ? { kind: 'usernameInvalid', reason: reason as never } : null
    }
    case 'COMMUNITY_USERNAME_CHECK_THROTTLED':
      return { kind: 'checkThrottled', retryAfterSeconds: Math.max(1, Number(details?.['retry_after_seconds']) || 1) }
    case 'COMMUNITY_AVATAR_INVALID':
      return { kind: 'avatarInvalid', reason: String(details?.['reason'] ?? 'unsupported_type') }
    case 'COMMUNITY_AVATAR_LIMIT':
      return { kind: 'avatarLimit', retryAfterSeconds: Math.max(1, Number(details?.['retry_after_seconds']) || 60) }
    case 'COMMUNITY_AVATAR_NOT_READY':
      return { kind: 'avatarNotReady' }
    case 'COMMUNITY_PROFILE_OWNER_NOT_CONFIGURED':
      return { kind: 'avatarUnavailable' }
    case 'COMMUNITY_PROFILE_REQUIRED':
      return { kind: 'profileRequired' }
    case 'COMMUNITY_PROFILE_VERSION_CONFLICT':
      return { kind: 'versionConflict' }
    default:
      return null
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string

const AVATAR_REASONS = new Set([
  'unsupported_type', 'mime_mismatch', 'size_mismatch', 'size_limit_exceeded', 'checksum_mismatch', 'corrupt_image',
  'animated_image', 'dimensions_out_of_range', 'storage_refused', 'storage_quota_exceeded', 'not_ready_timeout',
])

/** The notice text from the `Community.profile` messages (no technical code ever reaches the user). */
export function communityProfileMessage(notice: CommunityProfileNotice, t: Translate): string {
  switch (notice.kind) {
    case 'usernameTaken':
      return t('usernameTaken')
    case 'usernameImmutable':
      return t('usernameImmutable', { username: notice.username })
    case 'usernameInvalid':
      return t(`usernameReasons.${notice.reason}`)
    case 'checkThrottled':
      return t('checkThrottled', { seconds: notice.retryAfterSeconds })
    case 'avatarInvalid':
      return t(`avatarReasons.${AVATAR_REASONS.has(notice.reason) ? notice.reason : 'unsupported_type'}`)
    case 'avatarLimit':
      return t('avatarLimit')
    case 'avatarNotReady':
      return t('avatarNotReady')
    case 'avatarUnavailable':
      return t('avatarUnavailable')
    case 'profileRequired':
      return t('profileRequired')
    case 'versionConflict':
      return t('versionConflict')
  }
}

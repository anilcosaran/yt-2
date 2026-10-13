import { z } from 'zod'

import type { CreditPrice } from '@/lib/billing/credit-price'
import { normalizeCredits } from '@/lib/billing/credit-price'

export const AVATAR_ENTITLEMENT_QUERY_KEY = ['avatar', 'entitlement'] as const

export function avatarEntitlementQueryKey(channelId: string | null) {
  return [...AVATAR_ENTITLEMENT_QUERY_KEY, channelId] as const
}

const nonNegative = z.number().finite().nonnegative()

export const avatarEntitlementSchema = z.object({
  enabled: z.boolean().catch(false),
  clone_enabled: z.boolean().catch(false),
  voice_clone_enabled: z.boolean().catch(false),
  plan: z.string().nullable().catch(null),
  free_avatars: z.object({
    limit: nonNegative.catch(0),
    used: nonNegative.catch(0),
    reserved: nonNegative.catch(0),
    remaining: nonNegative.catch(0),
    resets_at: z.string().nullable().catch(null),
  }).catch({ limit: 0, used: 0, reserved: 0, remaining: 0, resets_at: null }),
  avatars: z.object({
    active: nonNegative.catch(0),
    fair_use_limit: nonNegative.nullable().catch(null),
  }).catch({ active: 0, fair_use_limit: null }),
  concurrency: z.object({ limit: nonNegative.nullable().catch(null) }).catch({ limit: null }),
  credits: z.object({ available: z.number().finite().nullable().catch(null) }).catch({ available: null }),
  estimates: z.object({
    clone_credits: nonNegative.nullable().catch(null),
    character_credits: nonNegative.nullable().catch(null),
    shot_credits: nonNegative.nullable().catch(null),
    voice_clone_credits: nonNegative.nullable().catch(null),
    /** Peak credits the workflows reserve (must be available to start); the shown price stays the estimate. */
    clone_required_credits: nonNegative.nullable().optional().catch(null),
    character_required_credits: nonNegative.nullable().optional().catch(null),
    shot_required_credits: nonNegative.nullable().optional().catch(null),
  }).catch({ clone_credits: null, character_credits: null, shot_credits: null, voice_clone_credits: null }),
  /**
   * Additive to the pinned contract (the gateway sends it): custom voice profile slots. The
   * UI disables "create voice from my recording" once every slot is used.
   */
  voice_profiles: z.object({
    used: nonNegative.catch(0),
    limit: nonNegative.nullable().catch(null),
  }).nullable().optional().catch(null),
})

export const avatarEntitlementResponseSchema = z.object({ data: avatarEntitlementSchema })

export type AvatarEntitlement = z.infer<typeof avatarEntitlementSchema>

export type AvatarExpectedPrice =
  | { mode: 'free' }
  | { mode: 'credits'; credits: number }

export type AvatarCreationKind = 'human_clone' | 'digital_human'

/** Display fallbacks used only when the entitlement estimate is missing (plan section 4.3). */
export const AVATAR_FALLBACK_ESTIMATES = {
  clone_credits: 59,
  character_credits: 19,
  shot_credits: 19,
  voice_clone_credits: 1,
} as const

export function avatarEstimate(
  entitlement: AvatarEntitlement | null | undefined,
  key: keyof typeof AVATAR_FALLBACK_ESTIMATES,
) {
  const value = entitlement?.estimates[key]
  return typeof value === 'number' && value > 0 ? value : AVATAR_FALLBACK_ESTIMATES[key]
}

/** Reservation peak for an action, or `null` when the gateway did not send one. */
export function avatarRequiredCredits(
  entitlement: AvatarEntitlement | null | undefined,
  key: 'clone_required_credits' | 'character_required_credits' | 'shot_required_credits',
) {
  const value = entitlement?.estimates[key]
  return typeof value === 'number' && value > 0 ? value : null
}

/**
 * Reservation peak for a virtual character. With a reference image the workflow reserves the
 * image-edit peak, which equals the shot peak, so the higher of the two applies.
 */
export function characterRequiredCredits(
  entitlement: AvatarEntitlement | null | undefined,
  hasReference: boolean,
) {
  const character = avatarRequiredCredits(entitlement, 'character_required_credits')
  if (!hasReference) return character
  const shot = avatarRequiredCredits(entitlement, 'shot_required_credits')
  if (character === null) return shot
  return shot === null ? character : Math.max(character, shot)
}

export function isAvatarFairUseReached(entitlement: AvatarEntitlement | null | undefined) {
  const limit = entitlement?.avatars.fair_use_limit
  return typeof limit === 'number' && limit > 0 && entitlement!.avatars.active >= limit
}

export function isVoiceProfileSlotsFull(entitlement: AvatarEntitlement | null | undefined) {
  const slots = entitlement?.voice_profiles
  return Boolean(slots && typeof slots.limit === 'number' && slots.used >= slots.limit)
}

/**
 * Price of one avatar creation. The free monthly allowance always wins when it has room (the user
 * cannot choose to pay with credits instead). Voice from a recording is covered by the allowance;
 * an uploaded voice clone for a virtual character is always a separate credit charge.
 */
export function resolveAvatarCreationPrice(input: {
  entitlement: AvatarEntitlement | null | undefined
  kind: AvatarCreationKind
  createVoiceFromRecording?: boolean
  uploadVoiceClone?: boolean
  /** Exact per-request estimate (credits) when available, e.g. from the agent estimate endpoint. */
  estimateCredits?: number | null
  /** Virtual character with a reference image (image edit reserves more than text-to-image). */
  hasReference?: boolean
}): CreditPrice {
  const { entitlement } = input
  if (!entitlement) return { kind: 'pending' }
  if (entitlement.free_avatars.remaining > 0) {
    return {
      kind: 'free',
      remaining: entitlement.free_avatars.remaining,
      limit: entitlement.free_avatars.limit,
    }
  }
  const voiceCredits = avatarEstimate(entitlement, 'voice_clone_credits')
  if (input.kind === 'human_clone') {
    const clone = avatarEstimate(entitlement, 'clone_credits')
    const withoutVoice = input.createVoiceFromRecording === false
    const credits = withoutVoice ? Math.max(0, clone - voiceCredits) : clone
    const required = avatarRequiredCredits(entitlement, 'clone_required_credits')
    return {
      kind: 'credits',
      credits: normalizeCredits(credits),
      ...(required !== null
        ? { reserveCredits: normalizeCredits(withoutVoice ? Math.max(0, required - voiceCredits) : required) }
        : {}),
    }
  }
  const image = typeof input.estimateCredits === 'number' && input.estimateCredits > 0
    ? input.estimateCredits
    : avatarEstimate(entitlement, 'character_credits')
  const voice = input.uploadVoiceClone ? voiceCredits : 0
  const required = characterRequiredCredits(entitlement, Boolean(input.hasReference))
  return {
    kind: 'credits',
    credits: normalizeCredits(image + voice),
    ...(required !== null ? { reserveCredits: normalizeCredits(required + voice) } : {}),
  }
}

export function toAvatarExpectedPrice(price: CreditPrice): AvatarExpectedPrice | null {
  if (price.kind === 'free') return { mode: 'free' }
  if (price.kind === 'credits') return { mode: 'credits', credits: price.credits }
  return null
}

export type AvatarPurchaseErrorKind =
  | 'price_changed'
  | 'insufficient_credits'
  | 'clone_disabled'
  | 'voice_clone_disabled'
  | 'voice_slots_full'
  | 'fair_use'
  | 'disabled'
  | 'other'

/** Maps gateway error codes from avatar create / recording session / voice clone to UI states. */
export function classifyAvatarPurchaseError(error: unknown): AvatarPurchaseErrorKind {
  const code = readErrorCode(error)
  if (!code) return 'other'
  if (code === 'AVATAR_PRICE_CHANGED') return 'price_changed'
  if (code === 'AVATAR_INSUFFICIENT_CREDITS' || code.includes('INSUFFICIENT_BALANCE') || code.includes('INSUFFICIENT_CREDITS')) {
    return 'insufficient_credits'
  }
  if (code === 'AVATAR_CLONE_DISABLED') return 'clone_disabled'
  if (code.startsWith('VOICE_') && code.includes('CLONE') && (code.includes('DISABLED') || code.includes('NOT_ENABLED'))) {
    return 'voice_clone_disabled'
  }
  if (code.startsWith('VOICE_') && code.includes('SLOT_CAPACITY')) return 'voice_slots_full'
  if (code === 'AVATAR_FAIR_USE_LIMIT_REACHED' || code === 'AVATAR_SLOT_CAPACITY_EXCEEDED') return 'fair_use'
  if (code === 'AVATAR_DISABLED') return 'disabled'
  return 'other'
}

/** Returns the server's current price from a 409 `AVATAR_PRICE_CHANGED` payload, when present. */
export function readChangedAvatarPrice(error: unknown): AvatarExpectedPrice | null {
  if (!error || typeof error !== 'object' || !('details' in error)) return null
  const details = (error as { details?: unknown }).details
  if (!details || typeof details !== 'object') return null
  const record = details as Record<string, unknown>
  const candidate = (record.current_price ?? record.price ?? record) as Record<string, unknown>
  if (candidate?.mode === 'free') return { mode: 'free' }
  if (candidate?.mode === 'credits' && typeof candidate.credits === 'number') {
    return { mode: 'credits', credits: candidate.credits }
  }
  return null
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code.toUpperCase() : null
}

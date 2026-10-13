import type { VoiceProfile } from '@/lib/voice/api'

export type ExactVoiceProfileCompatibility =
  | { status: 'unverified'; profile: null }
  | { status: 'incompatible'; profile: null }
  | { status: 'compatible'; profile: VoiceProfile }

/**
 * Treat only the exact requested id as authoritative. A paginated catalog page
 * (or a server that accidentally ignores profile_id) must never prove that a
 * selected profile is compatible.
 */
export function findExactCompatibleVoiceProfile(
  profiles: readonly VoiceProfile[],
  requestedProfileId: string,
) {
  const normalizedId = requestedProfileId.trim()
  if (!normalizedId) return null
  return profiles.find((profile) => profile.id === normalizedId) ?? null
}

export function resolveExactVoiceProfileCompatibility(
  profiles: readonly VoiceProfile[],
  requestedProfileId: string,
  lookupSucceeded: boolean,
): ExactVoiceProfileCompatibility {
  if (!lookupSucceeded || !requestedProfileId.trim()) {
    return { status: 'unverified', profile: null }
  }
  const profile = findExactCompatibleVoiceProfile(profiles, requestedProfileId)
  return profile
    ? { status: 'compatible', profile }
    : { status: 'incompatible', profile: null }
}

/** Keep an exact-compatible selected profile visible even when it is beyond page one. */
export function mergeCompatibleVoiceProfiles(
  pageProfiles: readonly VoiceProfile[],
  exactProfile: VoiceProfile | null,
) {
  if (!exactProfile || pageProfiles.some((profile) => profile.id === exactProfile.id)) {
    return [...pageProfiles]
  }
  return [exactProfile, ...pageProfiles]
}

import { getMyFeatureLimits } from '@/lib/feature-control/api'

/** Feature Control key of the single-file upload size of the user's plan (D10). */
export const UPLOAD_LIMIT_FEATURE_KEY = 'max_storage_upload_size_mb'

/**
 * The plan's per-file upload limit in megabytes, or null when it cannot be read (the server still refuses an oversized
 * file with a typed error, so a missing answer only means "no early warning"). Nothing is cached in browser storage.
 */
export async function readUploadLimitMb(load: typeof getMyFeatureLimits = getMyFeatureLimits): Promise<number | null> {
  try {
    const limits = await load()
    const value = limits.features.find((feature) => feature.key === UPLOAD_LIMIT_FEATURE_KEY)?.value
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

const MIB = 1024 * 1024

/** The largest file of a take that is over the limit (bytes), or null when every file fits (or the limit is unknown). */
export function oversizedPart(parts: ReadonlyArray<{ sizeBytes: number }>, limitMb: number | null): number | null {
  if (limitMb === null) return null
  const largest = Math.max(0, ...parts.map((part) => part.sizeBytes))
  return largest > limitMb * MIB ? largest : null
}

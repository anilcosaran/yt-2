import { AuthClientError } from '@/lib/auth/errors'

/**
 * WP4: the reason the gateway gave for refusing a Motion write (`motion.instance.insert`, a Motion field or structure edit),
 * so the editor can say WHY instead of a generic "could not be saved". The gateway answers 422
 * `COMPOSITION_MOTION_EDIT_REFUSED` / `COMPOSITION_MOTION_INSTANCE_UNAVAILABLE` with `context.reason` (and `issues[].code`).
 * Only reasons the editor has a sentence for are passed on; any other Motion refusal is `other`.
 */

export const MOTION_REFUSAL_REASONS = [
  'energy_not_available',
  'ratio_not_available',
  'video_style_unavailable',
  'parameter_required',
  'unknown_parameter',
  'duration_out_of_range',
  'duration_is_scene_range',
  'text_too_long',
  'media_not_ready',
  'project_private_revision_unavailable',
  'motion_revision_unavailable',
  'motion_instances_disabled',
  'motion_fonts_unavailable',
  'compile_refused',
] as const

export type MotionRefusalReason = (typeof MOTION_REFUSAL_REASONS)[number] | 'other'

const MOTION_REFUSAL_CODES: ReadonlySet<string> = new Set(['COMPOSITION_MOTION_EDIT_REFUSED', 'COMPOSITION_MOTION_INSTANCE_UNAVAILABLE'])
const KNOWN: ReadonlySet<string> = new Set(MOTION_REFUSAL_REASONS)

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {})

/** The Motion refusal reason of a failed command, or null when the error is not a Motion refusal. */
export function motionRefusalOf(error: unknown): MotionRefusalReason | null {
  if (!(error instanceof AuthClientError) || !MOTION_REFUSAL_CODES.has(error.code)) return null
  const details = record(error.details)
  const issues = Array.isArray(details['issues']) ? details['issues'] : []
  const reason = details['reason']
  // A generic compile refusal names the specific cause in its issues.
  const candidates = [reason === 'compile_refused' ? null : reason, ...issues.map((issue) => record(issue)['code']), reason]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && KNOWN.has(candidate)) return candidate as MotionRefusalReason
  }
  return 'other'
}

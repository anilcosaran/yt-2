/**
 * Code tab: the cheap check before anything is sent (owner decision 2026-10-04: "if it breaks, the scene breaks", but a source
 * that is not even JSON never goes to the server). Hard failures block Apply; the Motion authoring validator
 * (`validateMotionDraft`) runs after the source is written to the private draft and is the real gate (see `motion-code-apply.ts`).
 *
 * Checks, all local and synchronous:
 * - the text parses as JSON and is an object (the Motion editor's own rule, `MotionEditorSession.saveSource`);
 * - it is not larger than a sane source (a pasted file, not a Motion);
 * - it keeps the top-level `manifest` and `body` objects the source it was opened from has (a source that lost them can only
 *   be refused by the validator, with a worse message).
 */

/** Characters; a typed Motion pattern is a few KiB, a megabyte is a wrong paste. */
export const MOTION_SOURCE_MAX_CHARS = 1_000_000

export type MotionSourceIssueCode = 'empty' | 'not_json' | 'not_object' | 'too_large' | 'missing_manifest' | 'missing_body'

export type MotionSourceIssue = { code: MotionSourceIssueCode; /** Parser message for `not_json`; never the source text. */ detail?: string }

export type MotionSourceCheck =
  | { ok: true; pattern: Record<string, unknown>; /** The parsed source differs from the one the tab was opened from. */ changed: boolean }
  | { ok: false; issues: MotionSourceIssue[] }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Key-order independent comparison of two JSON values (what "unchanged" means for a re-saved source). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, index) => sameJson(item, b[index]))
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && sameJson(a[key], b[key]))
  }
  return false
}

export function checkMotionSourceText(text: string, baseline: Record<string, unknown>): MotionSourceCheck {
  if (text.trim().length === 0) return { ok: false, issues: [{ code: 'empty' }] }
  if (text.length > MOTION_SOURCE_MAX_CHARS) return { ok: false, issues: [{ code: 'too_large' }] }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { ok: false, issues: [{ code: 'not_json', ...(error instanceof Error && { detail: error.message }) }] }
  }
  if (!isObject(parsed)) return { ok: false, issues: [{ code: 'not_object' }] }
  const issues: MotionSourceIssue[] = []
  if (isObject(baseline['manifest']) && !isObject(parsed['manifest'])) issues.push({ code: 'missing_manifest' })
  if (isObject(baseline['body']) && !isObject(parsed['body'])) issues.push({ code: 'missing_body' })
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, pattern: parsed, changed: !sameJson(parsed, baseline) }
}

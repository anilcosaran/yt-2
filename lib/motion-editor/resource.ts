import { AuthClientError } from '@/lib/auth/errors'

import { MOTION_DRAFT_ID_PATTERN } from './api'

/**
 * P06-02 explicit resource states of the Motion screen. An invalid, missing or forbidden resource is NEVER replaced by
 * a default (no default Kit, style or Motion opens in its place): the screen shows the matching state and stops. 403 and
 * 404 are different answers — 404 = not visible to this user (unknown, another owner's, another tenant's); 403 = it is
 * there but the action is refused (the feature is closed, the source cannot be shared, the project cannot be edited).
 */

export type MotionResourceFailure =
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'invalid'
  | 'conflict'
  | 'video_style_unavailable'
  | 'error'

export type ClassifiedMotionError = { kind: MotionResourceFailure; code: string | null; reason: string | null }

function reasonOf(error: AuthClientError): string | null {
  const details = error.details
  if (details && typeof details === 'object' && 'reason' in details && typeof (details as { reason: unknown }).reason === 'string') {
    return (details as { reason: string }).reason
  }
  return null
}

export function classifyMotionEditorError(error: unknown): ClassifiedMotionError {
  if (!(error instanceof AuthClientError)) return { kind: 'error', code: null, reason: null }
  const reason = reasonOf(error)
  const base = { code: error.code, reason }
  if (error.code === 'BRAND_MOTION_VIDEO_STYLE_UNAVAILABLE') return { kind: 'video_style_unavailable', ...base }
  if (error.status === 403) return { kind: error.code === 'BRAND_MOTION_AUTHORING_UNAVAILABLE' ? 'unavailable' : 'forbidden', ...base }
  if (error.status === 404) return { kind: 'not_found', ...base }
  if (error.status === 409) return { kind: 'conflict', ...base }
  if (error.status === 400 || error.status === 422) return { kind: 'invalid', ...base }
  return { kind: 'error', ...base }
}

export type MotionEditorRoute = { ok: true; draftId: string } | { ok: false; failure: 'invalid' }

/** The route parameter is checked before anything is read: a malformed id is an explicit invalid state, not a lookup. */
export function parseMotionEditorRoute(draftId: string | undefined): MotionEditorRoute {
  return draftId && MOTION_DRAFT_ID_PATTERN.test(draftId) ? { ok: true, draftId } : { ok: false, failure: 'invalid' }
}

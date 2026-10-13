'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-23 member report client (`POST /api/v1/community/posts/{id}/reports`; login only). A member reports the EXACT
 * revision they see with a bounded reason and an optional note. One report per member and revision (a repeat answers the
 * first one), new reports are limited per member, and a report only gathers evidence for a moderator: the answer says
 * nothing about a case, a count or a decision. The report screen is a pending UI decision; this client, the local checks
 * and the notices are the non-visual parts.
 */
const BASE = '/api/v1/community'

export const communityReportReasons = ['spam', 'sexual_content', 'violence', 'hate_or_harassment', 'copyright', 'privacy', 'other'] as const
export type CommunityReportReason = (typeof communityReportReasons)[number]
export const COMMUNITY_REPORT_NOTE_MAX = 500

const reportSchema = z.object({
  schema_version: z.literal('community_report_v1'),
  report_id: z.string(),
  post_id: z.string(),
  revision: z.number().int().min(1),
  reason: z.enum(communityReportReasons),
  created_at: z.string(),
})
export type CommunityReport = z.output<typeof reportSchema>

const responseSchema = z.object({ data: z.object({ report: reportSchema, created: z.boolean() }) })

/** The note as it is sent: trimmed and composed (NFC); an empty note is no note. */
export function normalizeCommunityReportNote(raw: string): string | null {
  const normalized = raw.normalize('NFC').trim()
  return normalized.length > 0 ? normalized : null
}

/** Local check for instant feedback (the server checks again); `null` = fine. */
export function communityReportNoteProblem(raw: string): 'too_long' | null {
  const note = normalizeCommunityReportNote(raw)
  return note !== null && note.length > COMMUNITY_REPORT_NOTE_MAX ? 'too_long' : null
}

export async function reportCommunityPost(input: {
  postId: string
  revision: number
  reason: CommunityReportReason
  note?: string
}): Promise<{ report: CommunityReport; created: boolean }> {
  const note = input.note === undefined ? null : normalizeCommunityReportNote(input.note)
  const response = await gatewayRequest(`${BASE}/posts/${encodeURIComponent(input.postId)}/reports`, {
    method: 'POST',
    csrf: true,
    body: { revision: input.revision, reason: input.reason, ...(note !== null && { note }) },
    schema: responseSchema,
  })
  return response.data
}

/** Report errors that deserve one localized, explanatory notice (everything else keeps the caller's generic handling). */
export type CommunityReportNotice =
  | { kind: 'limit'; retryAfterSeconds: number }
  | { kind: 'own' }
  | { kind: 'changed' }
  | { kind: 'unavailable' }
  | { kind: 'noteTooLong' }
  | { kind: 'failed' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function communityReportNotice(error: unknown): CommunityReportNotice | null {
  if (!isAuthClientError(error)) return null
  const details = record(error.details)
  switch (error.code) {
    case 'COMMUNITY_REPORT_LIMIT':
      return { kind: 'limit', retryAfterSeconds: Math.max(1, Number(details?.['retry_after_seconds']) || 60) }
    case 'COMMUNITY_REPORT_NOT_ALLOWED':
      return { kind: 'own' }
    case 'COMMUNITY_REVISION_CHANGED':
      return { kind: 'changed' }
    case 'COMMUNITY_POST_NOT_FOUND':
    case 'COMMUNITY_UNAVAILABLE':
      return { kind: 'unavailable' }
    case 'COMMUNITY_INVALID':
      return details?.['reason'] === 'note_too_long' ? { kind: 'noteTooLong' } : { kind: 'failed' }
    default:
      return null
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** The notice text from the `Community.report` messages (no technical code ever reaches the user). */
export function communityReportMessage(notice: CommunityReportNotice, t: Translate): string {
  switch (notice.kind) {
    case 'limit':
      return t('limit', { seconds: notice.retryAfterSeconds })
    case 'own':
      return t('own')
    case 'changed':
      return t('changed')
    case 'unavailable':
      return t('unavailable')
    case 'noteTooLong':
      return t('noteTooLong', { max: COMMUNITY_REPORT_NOTE_MAX })
    case 'failed':
      return t('failed')
  }
}

/** The confirmation after a report was accepted (a repeat is told so, never turned into a second report). */
export function communityReportOutcomeMessage(outcome: { created: boolean }, t: Translate): string {
  return outcome.created ? t('thanks') : t('alreadyReported')
}

export function communityReportReasonLabel(reason: CommunityReportReason, t: Translate): string {
  return t(`reasons.${reason}`)
}

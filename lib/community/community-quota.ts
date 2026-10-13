import { isAuthClientError } from '@/lib/auth/errors'

/**
 * P06-20 Community daily quota (Q10) on the client: the server alone enforces it (a disabled button is never the
 * guard); when a publish or a new like is refused with `COMMUNITY_DAILY_QUOTA_EXCEEDED`, the UI shows ONE explanatory,
 * localized toast — the daily limit and when it renews in the user's own time — never a modal, a second confirmation
 * or a technical code. Community previews paused by the platform budget get their own short notice.
 */
export type CommunityQuotaAction = 'publish' | 'like'

export type CommunityQuotaNotice = {
  action: CommunityQuotaAction
  limit: number
  used: number
  resetAt: Date
}

export type CommunityNotice =
  | { kind: 'quota'; quota: CommunityQuotaNotice }
  | { kind: 'previewsPaused' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** The quota details of a refused request, or null for any other error. */
export function communityQuotaNotice(error: unknown): CommunityQuotaNotice | null {
  if (!isAuthClientError(error) || error.code !== 'COMMUNITY_DAILY_QUOTA_EXCEEDED') return null
  const details = record(error.details)
  const action = details?.['action']
  const limit = Number(details?.['limit'])
  const used = Number(details?.['used'])
  const resetAt = new Date(String(details?.['reset_at'] ?? ''))
  if ((action !== 'publish' && action !== 'like') || !Number.isFinite(limit) || !Number.isFinite(resetAt.getTime())) return null
  return { action, limit, used: Number.isFinite(used) ? used : limit, resetAt }
}

/** Community errors that deserve a user-facing notice (everything else keeps the caller's generic handling). */
export function communityNotice(error: unknown): CommunityNotice | null {
  const quota = communityQuotaNotice(error)
  if (quota) return { kind: 'quota', quota }
  if (isAuthClientError(error) && error.code === 'COMMUNITY_PREVIEW_CAPACITY_EXHAUSTED') return { kind: 'previewsPaused' }
  return null
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * The toast text, from the `Community.quota` messages: the limit and the renewal time in the viewer's locale and time
 * zone (a different local day also shows the date).
 */
export function communityNoticeMessage(
  notice: CommunityNotice,
  t: Translate,
  options: { locale: string; now: Date; timeZone?: string },
): string {
  if (notice.kind === 'previewsPaused') return t('previewsPaused')
  const { quota } = notice
  const sameDay = (date: Date) => new Intl.DateTimeFormat(options.locale, { dateStyle: 'short', timeZone: options.timeZone }).format(date)
  const time = new Intl.DateTimeFormat(options.locale, {
    ...(sameDay(quota.resetAt) === sameDay(options.now) ? {} : { month: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: options.timeZone,
  }).format(quota.resetAt)
  return t(quota.action === 'publish' ? 'publishExhausted' : 'likeExhausted', { limit: quota.limit, time })
}

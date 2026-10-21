'use client'

import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, ChevronLeft, ChevronRight, Megaphone, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  dismissTopBannerAnnouncement,
  getAnnouncementDisplayMessage,
  getAnnouncementDisplayTitle,
  listPublicTopBannerAnnouncements,
  listTopBannerAnnouncements,
  PUBLIC_TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY,
  TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY,
  type TopBannerAnnouncement,
} from '@/lib/review/api'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

const ANNOUNCEMENT_STALE_MS = 2 * 60_000
const ANNOUNCEMENT_QUERY_GC_MS = 10 * 60_000
const DISMISSED_STORAGE_KEY = 'youtorch:review-top-banner-dismissed'
const MAX_LOCAL_DISMISSALS = 200
// An announcement without colours of its own takes the shell's: the sidebar's surface and text (#121212 and #d4d4d4 in
// the dark theme), so the banner reads as part of the window. The creative banner's frame is its own document and
// cannot read the theme's variables, so it gets the same colours as values.
const THEME_BANNER_BACKGROUND = 'var(--sidebar)'
const THEME_BANNER_TEXT = 'var(--sidebar-foreground)'
const THEME_BANNER_FRAME_COLORS = {
  dark: { background: '#121212', text: '#d4d4d4' },
  light: { background: '#f3f1ea', text: '#1f1e1d' },
} as const

export function MemberAnnouncementBar() {
  const query = useQuery({
    queryKey: TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY,
    queryFn: () => listTopBannerAnnouncements({ limit: 5 }),
    staleTime: ANNOUNCEMENT_STALE_MS,
    gcTime: ANNOUNCEMENT_QUERY_GC_MS,
  })

  return <AnnouncementBar announcements={query.data ?? []} persistDismissal />
}

export function PublicAnnouncementBar() {
  const query = useQuery({
    queryKey: PUBLIC_TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY,
    queryFn: () => listPublicTopBannerAnnouncements({ limit: 5 }),
    staleTime: ANNOUNCEMENT_STALE_MS,
    gcTime: ANNOUNCEMENT_QUERY_GC_MS,
  })

  return <AnnouncementBar announcements={query.data ?? []} />
}

export function AnnouncementBar({
  announcements,
  className,
  persistDismissal = false,
}: {
  announcements: TopBannerAnnouncement[]
  className?: string
  persistDismissal?: boolean
}) {
  const queryClient = useQueryClient()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(() => new Set())
  const dismissMutation = useMutation({
    mutationFn: dismissTopBannerAnnouncement,
    onSuccess: () => {
      if (persistDismissal) void queryClient.invalidateQueries({ queryKey: TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY })
    },
    onError: (_error, id) => {
      setDismissedIds((current) => {
        const next = new Set(current)
        next.delete(id)
        writeDismissedIds(next)
        return next
      })
      if (persistDismissal) void queryClient.invalidateQueries({ queryKey: TOP_BANNER_ANNOUNCEMENTS_QUERY_KEY })
    },
  })

  React.useEffect(() => {
    setDismissedIds(readDismissedIds())
  }, [])

  const visibleAnnouncements = React.useMemo(
    () => announcements.filter((announcement) => !announcement.dismissed_at && !dismissedIds.has(announcement.id)),
    [announcements, dismissedIds],
  )

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(visibleAnnouncements.length - 1, 0)))
  }, [visibleAnnouncements.length])

  const handleDismiss = React.useCallback((announcement: TopBannerAnnouncement) => {
    if (!isAnnouncementDismissible(announcement.payload)) return
    setDismissedIds((current) => {
      const next = new Set(current)
      next.add(announcement.id)
      writeDismissedIds(next)
      return next
    })
    if (persistDismissal) dismissMutation.mutate(announcement.id)
  }, [dismissMutation, persistDismissal])

  if (visibleAnnouncements.length === 0) return null

  const active = visibleAnnouncements[activeIndex] ?? visibleAnnouncements[0]
  const hasMultiple = visibleAnnouncements.length > 1

  return (
    <div className={cn('shrink-0 border-b border-border bg-background', className)}>
      <AnnouncementContent
        announcement={active}
        onDismiss={() => handleDismiss(active)}
        showPrevious={hasMultiple ? () => setActiveIndex((current) => (current - 1 + visibleAnnouncements.length) % visibleAnnouncements.length) : undefined}
        showNext={hasMultiple ? () => setActiveIndex((current) => (current + 1) % visibleAnnouncements.length) : undefined}
        positionLabel={hasMultiple ? `${activeIndex + 1} / ${visibleAnnouncements.length}` : undefined}
      />
    </div>
  )
}

function AnnouncementContent({
  announcement,
  onDismiss,
  showPrevious,
  showNext,
  positionLabel,
}: {
  announcement: TopBannerAnnouncement
  onDismiss: () => void
  showPrevious?: () => void
  showNext?: () => void
  positionLabel?: string
}) {
  const style = getBannerStyle(announcement.payload)
  const variant = getBannerVariant(announcement.payload)
  const dismissible = isAnnouncementDismissible(announcement.payload)

  if (variant === 'creative') {
    return (
      <CreativeAnnouncementContent
        announcement={announcement}
        style={style}
        dismissible={dismissible}
        onDismiss={onDismiss}
        showPrevious={showPrevious}
        showNext={showNext}
        positionLabel={positionLabel}
      />
    )
  }

  return (
    <CompactAnnouncementContent
      announcement={announcement}
      style={style}
      dismissible={dismissible}
      onDismiss={onDismiss}
      showPrevious={showPrevious}
      showNext={showNext}
      positionLabel={positionLabel}
    />
  )
}

function CompactAnnouncementContent({
  announcement,
  style,
  dismissible,
  onDismiss,
  showPrevious,
  showNext,
  positionLabel,
}: {
  announcement: TopBannerAnnouncement
  style: ReturnType<typeof getBannerStyle>
  dismissible: boolean
  onDismiss: () => void
  showPrevious?: () => void
  showNext?: () => void
  positionLabel?: string
}) {
  const cta = getAnnouncementCta(announcement)
  const message = getAnnouncementDisplayMessage(announcement)
  const centered = style.contentAlign === 'center'

  return (
    <div
      className={cn(
        'relative flex min-h-12 items-center px-3 py-2 md:min-h-11 md:px-4',
        centered ? 'justify-center' : 'gap-2',
        dismissible && (centered ? 'px-12 md:px-16' : 'pr-12 md:pr-14'),
      )}
      style={{
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.textColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      }}
      role="status"
      aria-live="polite"
    >
      {positionLabel ? (
        <AnnouncementStepper
          label={positionLabel}
          showPrevious={showPrevious}
          showNext={showNext}
        />
      ) : null}

      <div className={cn('flex min-w-0 items-center gap-3', centered ? 'mx-auto w-full max-w-6xl justify-center text-center' : 'flex-1')}>
        {!centered ? <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}

        <p
          className={cn('min-w-0 overflow-hidden leading-5', centered ? 'max-w-full' : 'flex-1')}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          } as React.CSSProperties}
        >
          <span className="font-semibold">{getAnnouncementDisplayTitle(announcement)}</span>
          {message ? <span className="opacity-85"> - {message}</span> : null}
        </p>

        {cta ? <AnnouncementCta cta={cta} style={style} /> : null}
      </div>
      {dismissible ? <AnnouncementDismissButton onDismiss={onDismiss} overlay={false} /> : null}
    </div>
  )
}

function CreativeAnnouncementContent({
  announcement,
  style,
  dismissible,
  onDismiss,
  showPrevious,
  showNext,
  positionLabel,
}: {
  announcement: TopBannerAnnouncement
  style: ReturnType<typeof getBannerStyle>
  dismissible: boolean
  onDismiss: () => void
  showPrevious?: () => void
  showNext?: () => void
  positionLabel?: string
}) {
  const tAuto = useTranslations('Auto')
  const { resolvedTheme } = useTheme()
  const html = getPayloadString(announcement.payload.creative_html)
  const css = getPayloadString(announcement.payload.creative_css) ?? ''
  const creativeMode = getPayloadString(announcement.payload.creative_mode)
  const media = getAnnouncementMedia(announcement.payload)
  const cta = getAnnouncementCta(announcement)
  const hasHtml = creativeMode === 'html' && html
  const centered = style.contentAlign === 'center'

  return (
    <div
      className="relative overflow-hidden"
      style={{
        minHeight: style.heightPx,
        height: style.heightPx,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.textColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      }}
      role="status"
      aria-live="polite"
    >
      {positionLabel ? (
        <AnnouncementStepper
          label={positionLabel}
          showPrevious={showPrevious}
          showNext={showNext}
          overlay
        />
      ) : null}

      {hasHtml ? (
        <iframe
          title={tAuto('youtorch_announcement_7df8c0a5')}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay; fullscreen; picture-in-picture"
          srcDoc={buildBannerSrcDoc(html, css, style, resolvedTheme === 'dark' ? 'dark' : 'light')}
          className="h-full w-full border-0 bg-transparent"
        />
      ) : (
        <>
          {media ? (
            <div className="absolute inset-0">
              {media.type === 'video' ? (
                <video
                  src={media.url}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt={media.alt} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/45" />
            </div>
          ) : null}
          <div
            className={cn(
              'relative z-10 mx-auto flex h-full max-w-6xl items-center gap-4 px-4 py-4 md:px-6',
              centered ? 'justify-center text-center' : 'justify-between',
              dismissible && 'pr-14 md:pr-16',
            )}
          >
            <div className={cn('min-w-0', centered ? 'max-w-3xl flex-none' : 'flex-1')}>
              <h2 className="text-2xl font-semibold leading-7 md:text-3xl md:leading-9">{getAnnouncementDisplayTitle(announcement)}</h2>
              <p
                className={cn('mt-2 overflow-hidden text-sm leading-5 opacity-90 md:text-base md:leading-6', !centered && 'max-w-3xl')}
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                } as React.CSSProperties}
              >
                {getAnnouncementDisplayMessage(announcement)}
              </p>
            </div>
            {cta ? <AnnouncementCta cta={cta} style={style} /> : null}
          </div>
        </>
      )}

      {dismissible ? <AnnouncementDismissButton onDismiss={onDismiss} overlay /> : null}
    </div>
  )
}

function AnnouncementCta({
  cta,
  style,
}: {
  cta: NonNullable<ReturnType<typeof getAnnouncementCta>>
  style: ReturnType<typeof getBannerStyle>
}) {
  const className = 'h-8 shrink-0 gap-1.5 whitespace-nowrap rounded-md px-3'
  const buttonStyle = { backgroundColor: style.buttonBackgroundColor, color: style.buttonTextColor }
  if (cta.external) {
    return (
      <Button asChild size="sm" className={className} style={buttonStyle}>
        <a href={cta.href} target="_blank" rel="noreferrer">
          {cta.label}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </Button>
    )
  }

  return (
    <Button asChild size="sm" className={className} style={buttonStyle}>
      <Link href={cta.href}>
        {cta.label}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </Button>
  )
}

function AnnouncementDismissButton({
  onDismiss,
  overlay,
}: {
  onDismiss: () => void
  overlay: boolean
}) {
  const tAuto = useTranslations('Auto')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        'absolute right-2 top-1/2 z-20 h-8 w-8 -translate-y-1/2 text-current hover:bg-current/10',
        overlay && 'top-3 translate-y-0 bg-black/30 text-white backdrop-blur-sm hover:bg-black/45',
      )}
      onClick={onDismiss}
      aria-label={tAuto('dismiss_announcement_9c53340b')}
    >
      <X className="h-4 w-4" />
    </Button>
  )
}

function AnnouncementStepper({
  label,
  showPrevious,
  showNext,
  overlay = false,
}: {
  label: string
  showPrevious?: () => void
  showNext?: () => void
  overlay?: boolean
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className={cn('flex shrink-0 items-center gap-1', overlay && 'absolute left-2 top-2 z-20 rounded-md bg-black/35 px-1 text-white backdrop-blur-sm')}>
      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 text-current hover:bg-current/10" onClick={showPrevious} aria-label={tAuto('previous_announcement_f65bd870')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-xs font-medium">{label}</span>
      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 text-current hover:bg-current/10" onClick={showNext} aria-label={tAuto('next_announcement_d78f600c')}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function getAnnouncementCta(announcement: TopBannerAnnouncement) {
  const label = getPayloadString(announcement.payload.cta_label)
  const href = getPayloadString(announcement.payload.cta_href)
  if (!label || !href || !isSafeHref(href)) return null
  return { label, href, external: /^https?:\/\//i.test(href) }
}

function getAnnouncementMedia(payload: Record<string, unknown>) {
  const type = getPayloadString(payload.media_type)
  const url = getPayloadString(payload.media_url)
  if ((type !== 'image' && type !== 'video') || !url || !isSafeAssetUrl(url)) return null
  return {
    type,
    url,
    alt: getPayloadString(payload.media_alt) ?? getPayloadString(payload.title) ?? 'Announcement media',
  }
}

function getBannerVariant(payload: Record<string, unknown>) {
  const variant = getPayloadString(payload.banner_variant)
  if (variant === 'compact' || variant === 'creative') return variant
  const creativeMode = getPayloadString(payload.creative_mode)
  return creativeMode === 'html' || creativeMode === 'media' ? 'creative' : 'compact'
}

function isAnnouncementDismissible(payload: Record<string, unknown>) {
  return getPayloadString(payload.dismiss_behavior) !== 'persistent'
}

function getBannerStyle(payload: Record<string, unknown>) {
  const style = isRecord(payload.banner_style) ? payload.banner_style : {}
  const gradientFrom = safeOptionalColor(style.background_gradient_from)
  const gradientTo = safeOptionalColor(style.background_gradient_to)
  const gradientAngle = clampNumber(getNumber(style.background_gradient_angle_deg), 0, 360, 90)
  return {
    backgroundColor: safeColor(style.background_color, THEME_BANNER_BACKGROUND),
    backgroundImage: gradientFrom && gradientTo ? `linear-gradient(${gradientAngle}deg, ${gradientFrom}, ${gradientTo})` : undefined,
    textColor: safeColor(style.text_color, THEME_BANNER_TEXT),
    fontFamily: safeFontFamily(style.font_family, 'Inter, Arial, sans-serif'),
    fontSize: clampNumber(getNumber(style.font_size_px), 12, 20, 14),
    fontWeight: clampNumber(getNumber(style.font_weight), 400, 800, 500),
    buttonBackgroundColor: safeColor(style.button_background_color, '#22c55e'),
    buttonTextColor: safeColor(style.button_text_color, '#052e16'),
    heightPx: clampNumber(getNumber(style.height_px), 88, 320, 148),
    contentAlign: safeContentAlign(style.content_align),
  }
}

function buildBannerSrcDoc(html: string, css: string, style: ReturnType<typeof getBannerStyle>, scheme: 'dark' | 'light') {
  const safeHtml = sanitizeCreativeHtml(html)
  const safeCss = sanitizeCreativeCss(css)
  const themeColors = THEME_BANNER_FRAME_COLORS[scheme]
  const background = style.backgroundImage
    ?? (style.backgroundColor === THEME_BANNER_BACKGROUND ? themeColors.background : style.backgroundColor)
  const textColor = style.textColor === THEME_BANNER_TEXT ? themeColors.text : style.textColor
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{width:100%;height:100%;margin:0;background:${background};color:${textColor};font-family:${style.fontFamily};font-size:${style.fontSize}px;font-weight:${style.fontWeight};overflow:hidden}body{min-height:100%;padding:0}*{box-sizing:border-box;min-width:0}a{color:inherit}img,video{max-width:100%;max-height:100%;object-fit:cover}.yt-banner,.yt-banner-root{width:100%;height:100%}.yt-banner-line{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}${safeCss}</style></head><body>${safeHtml}</body></html>`
}

function sanitizeCreativeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|form|input|textarea|button|meta|link|base)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form|input|textarea|button|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
}

function sanitizeCreativeCss(value: string) {
  return value
    .replace(/@import[^;]+;/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/expression\s*\(/gi, '')
}

function readDismissedIds() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

function writeDismissedIds(value: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(value).slice(-MAX_LOCAL_DISMISSALS)))
  } catch {
    // Local storage can be disabled; the optimistic in-memory hide still works for this session.
  }
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function safeOptionalColor(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null
}

function safeContentAlign(value: unknown): 'left' | 'center' {
  return value === 'left' || value === 'center' ? value : 'center'
}

function safeFontFamily(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120 || /[;{}<>]/.test(trimmed)) return fallback
  return trimmed
}

function clampNumber(value: number | null, min: number, max: number, fallback: number) {
  if (value === null) return fallback
  return Math.min(max, Math.max(min, value))
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function isSafeHref(href: string) {
  return (href.startsWith('/') && !href.startsWith('//')) || /^https?:\/\/[^\s]+$/i.test(href)
}

function isSafeAssetUrl(href: string) {
  return isSafeHref(href)
}

function getPayloadString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

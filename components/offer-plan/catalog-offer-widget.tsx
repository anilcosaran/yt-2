'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import type { BillingPeriod, PlanPackage } from '@/lib/offer/api'

type CatalogWidget = {
  enabled: boolean
  position: 'left' | 'right'
  title?: string | null
  description?: string | null
  locales?: Record<string, { title?: string | null; description?: string | null }>
  background_color?: string | null
  text_color?: string | null
  accent_color?: string | null
  countdown_style: 'digital' | 'flip' | 'ring' | 'minimal'
  show_countdown: boolean
  show_confetti: boolean
  show_shimmer: boolean
  media_kind: 'none' | 'image' | 'video'
  media_url?: string | null
  replace_countdown_with_media: boolean
}

type CatalogWidgetCandidate = {
  offerId: string
  validUntil: string | null
  widget: CatalogWidget
  discountPercent: number
}

export function resolveCatalogOfferWidget(
  packages: PlanPackage[],
  period: BillingPeriod,
  nowMs: number,
): CatalogWidgetCandidate | null {
  const candidates: CatalogWidgetCandidate[] = []
  for (const pkg of packages) {
    const periodOffer = pkg.periods[period]
    if (!periodOffer) continue
    const widget = periodOffer.display_config.catalog_widget
    if (!widget?.enabled) continue
    if (periodOffer.valid_until && new Date(periodOffer.valid_until).getTime() <= nowMs) continue
    candidates.push({
      offerId: periodOffer.offer_id,
      validUntil: periodOffer.valid_until,
      widget,
      discountPercent: periodOffer.pricing.discount_percent,
    })
  }
  candidates.sort((left, right) => {
    const leftEnd = left.validUntil ? new Date(left.validUntil).getTime() : Number.MAX_SAFE_INTEGER
    const rightEnd = right.validUntil ? new Date(right.validUntil).getTime() : Number.MAX_SAFE_INTEGER
    return leftEnd - rightEnd
  })
  return candidates[0] ?? null
}

export function CatalogOfferWidget({
  packages,
  period,
  language,
  serverNow,
  onExpired,
}: {
  packages: PlanPackage[]
  period: BillingPeriod
  language: string
  serverNow: string | null
  onExpired: () => void
}) {
  const nowMs = serverNow ? new Date(serverNow).getTime() : Date.now()
  const candidate = resolveCatalogOfferWidget(packages, period, nowMs)
  const [remainingMs, setRemainingMs] = React.useState(() =>
    candidate?.validUntil ? Math.max(0, new Date(candidate.validUntil).getTime() - nowMs) : 0,
  )

  React.useEffect(() => {
    if (!candidate?.validUntil) {
      setRemainingMs(0)
      return
    }
    const endsAt = new Date(candidate.validUntil).getTime()
    const tick = () => {
      const next = Math.max(0, endsAt - Date.now())
      setRemainingMs(next)
      if (next <= 0) onExpired()
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [candidate?.offerId, candidate?.validUntil, onExpired])

  if (!candidate) return null
  if (candidate.validUntil && remainingMs <= 0) return null

  const widget = candidate.widget
  const locale = resolveWidgetLocale(widget.locales, language)
  const title = locale?.title || widget.title || widget.locales?.en?.title || defaultTitle(candidate.discountPercent)
  const description = locale?.description || widget.description || widget.locales?.en?.description || defaultDescription(candidate.discountPercent, Boolean(candidate.validUntil))
  const background = widget.background_color || '#111111'
  const text = widget.text_color || '#f5f5f5'
  const accent = widget.accent_color || '#f4b63f'
  const showMedia = widget.media_kind !== 'none' && Boolean(widget.media_url)
  const showCountdown = Boolean(candidate.validUntil)
    && widget.show_countdown
    && !(widget.replace_countdown_with_media && showMedia)
  const media = showMedia ? (
    widget.media_kind === 'video' ? (
      <video src={widget.media_url ?? undefined} className="h-20 w-32 rounded-md object-cover" autoPlay muted loop playsInline />
    ) : (
      <img src={widget.media_url ?? ''} alt="" className="h-20 w-32 rounded-md object-cover" />
    )
  ) : null

  return (
    <div
      className="relative mx-auto mt-8 w-full max-w-4xl overflow-hidden rounded-[18px] px-5 py-4 shadow-lg"
      style={{ backgroundColor: background, color: text, border: `1px solid ${accent}33` }}
    >
      {widget.show_confetti ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 12% 20%, ${accent} 0 3px, transparent 4px), radial-gradient(circle at 78% 28%, ${text} 0 2px, transparent 3px), radial-gradient(circle at 62% 78%, ${accent} 0 2px, transparent 3px)`,
          }}
        />
      ) : null}
      {widget.show_shimmer ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-[catalogWidgetShimmer_2.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      ) : null}
      <div className={cn('relative flex flex-col items-center gap-4 sm:flex-row', widget.position === 'right' && 'sm:flex-row-reverse')}>
        {(media || showCountdown) ? (
          <div className="shrink-0">
            {widget.replace_countdown_with_media && media ? media : showCountdown ? (
              <CountdownBlocks remainingMs={remainingMs} styleName={widget.countdown_style} accent={accent} text={text} language={language} />
            ) : media}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            {resolveWidgetEyebrow(candidate.discountPercent, language)}
          </p>
          <h2 className="mt-1 text-xl font-semibold leading-tight">{title}</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
        </div>
      </div>
    </div>
  )
}

export function resolveWidgetLocale(
  locales: CatalogWidget['locales'] | undefined,
  language: string,
) {
  if (!locales) return undefined
  const normalized = normalizeUiLanguage(language)
  return locales[normalized] ?? locales.en
}

export function resolveWidgetEyebrow(discountPercent: number, language: string) {
  if (normalizeUiLanguage(language) === 'tr') {
    return discountPercent > 0 ? `%${discountPercent} indirim` : 'Sureli teklif'
  }
  return discountPercent > 0 ? `Up to ${discountPercent}% off` : 'Limited offer'
}

function normalizeUiLanguage(language: string) {
  return language.toLowerCase().split('-')[0] || 'en'
}

export function defaultTitle(discountPercent: number) {
  return discountPercent > 0 ? `AI models up to ${discountPercent}% off` : 'Limited-time offer'
}

export function defaultDescription(discountPercent: number, hasEnd: boolean) {
  if (discountPercent > 0) {
    return hasEnd
      ? 'Discounted catalog pricing is live. The offer ends when this countdown reaches zero.'
      : 'Discounted catalog pricing is live.'
  }
  return 'This catalog offer is only available while the window is open.'
}

function CountdownBlocks({
  remainingMs,
  styleName,
  accent,
  text,
  language,
}: {
  remainingMs: number
  styleName: CatalogWidget['countdown_style']
  accent: string
  text: string
  language: string
}) {
  const parts = splitDuration(remainingMs, language)
  if (styleName === 'minimal') {
    return (
      <p className="text-sm font-semibold tabular-nums">
        {parts.days}{parts.dayUnit} {parts.hours}{parts.hourUnit} {parts.minutes}{parts.minuteUnit} {parts.seconds}{parts.secondUnit}
      </p>
    )
  }
  if (styleName === 'ring') {
    return (
      <div className="grid grid-cols-4 gap-2">
        {parts.entries.map(([label, value]) => (
          <div key={label} className="flex size-14 flex-col items-center justify-center rounded-full border" style={{ borderColor: accent, color: text }}>
            <span className="text-sm font-bold tabular-nums">{String(value).padStart(2, '0')}</span>
            <span className="text-[9px] uppercase opacity-70">{label}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-4 gap-2">
      {parts.entries.map(([label, value]) => (
        <div
          key={label}
          className={cn(
            'min-w-14 rounded-lg px-2 py-2 text-center',
            styleName === 'flip' ? 'bg-black/40 shadow-inner' : 'bg-white/10',
          )}
        >
          <div className="text-lg font-bold tabular-nums leading-none">{String(value).padStart(2, '0')}</div>
          <div className="mt-1 text-[9px] uppercase tracking-wide opacity-70">{label}</div>
        </div>
      ))}
    </div>
  )
}

function splitDuration(remainingMs: number, language: string) {
  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const units = normalizeUiLanguage(language) === 'tr'
    ? { day: 'g', hour: 'sa', minute: 'dk', second: 'sn', days: 'gun', hrs: 'saat', min: 'dk', sec: 'sn' }
    : { day: 'd', hour: 'h', minute: 'm', second: 's', days: 'days', hrs: 'hrs', min: 'min', sec: 'sec' }
  return {
    days,
    hours,
    minutes,
    seconds,
    dayUnit: units.day,
    hourUnit: units.hour,
    minuteUnit: units.minute,
    secondUnit: units.second,
    entries: [
      [units.days, days],
      [units.hrs, hours],
      [units.min, minutes],
      [units.sec, seconds],
    ] as Array<[string, number]>,
  }
}

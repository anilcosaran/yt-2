'use client'

import * as React from 'react'
import {
  AudioLines,
  Beef,
  CakeSlice,
  Calendar,
  ChefHat,
  Citrus,
  CircleAlert,
  Clock,
  Coffee,
  CookingPot,
  Croissant,
  EggFried,
  EyeOff,
  FileText,
  Film,
  Fish,
  Flame,
  Hash,
  Hourglass,
  IceCreamCone,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  MessageCircle,
  Mic,
  Music,
  Music2,
  Pizza,
  Quote,
  Salad,
  Sandwich,
  ScrollText,
  ShieldAlert,
  Soup,
  Sparkles,
  Star,
  Store,
  Tag,
  UserRound,
  Users,
  Utensils,
  WandSparkles,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import { formatDuration } from './library-logic'
import type { AnalysisState, AssetAvailability, AssetCover, AssetKind, LibraryAsset, LibraryCollection } from './library-types'

export const GLYPHS: Record<string, LucideIcon> = {
  'audio-lines': AudioLines,
  beef: Beef,
  'cake-slice': CakeSlice,
  calendar: Calendar,
  'chef-hat': ChefHat,
  citrus: Citrus,
  coffee: Coffee,
  'cooking-pot': CookingPot,
  croissant: Croissant,
  'egg-fried': EggFried,
  'file-text': FileText,
  film: Film,
  fish: Fish,
  flame: Flame,
  hash: Hash,
  'ice-cream-cone': IceCreamCone,
  image: ImageIcon,
  'message-circle': MessageCircle,
  mic: Mic,
  music: Music,
  'music-2': Music2,
  pizza: Pizza,
  quote: Quote,
  salad: Salad,
  sandwich: Sandwich,
  'scroll-text': ScrollText,
  soup: Soup,
  sparkles: Sparkles,
  store: Store,
  tag: Tag,
  users: Users,
  utensils: Utensils,
  wine: Wine,
}

/** Icons offered when creating or editing a collection. */
export const COLLECTION_ICONS = ['utensils', 'pizza', 'coffee', 'store', 'chef-hat', 'users', 'quote', 'calendar', 'music', 'film', 'image', 'sparkles', 'tag', 'wine'] as const
export const COLLECTION_HUES = [24, 8, 330, 280, 262, 220, 200, 170, 150, 110, 48] as const

export const KIND_ICONS: Record<AssetKind, LucideIcon> = {
  video: Film,
  image: ImageIcon,
  audio: AudioLines,
  avatar: UserRound,
  motion: WandSparkles,
  template: LayoutTemplate,
  text: FileText,
}

export function hueGradient(hue: number) {
  return `linear-gradient(135deg, hsl(${hue} 78% 56%) 0%, hsl(${(hue + 342) % 360} 72% 30%) 100%)`
}

export function AssetCoverView({
  cover,
  kind,
  className,
  iconClassName,
  alt = '',
}: {
  cover: AssetCover
  kind: AssetKind
  className?: string
  iconClassName?: string
  alt?: string
}) {
  if (cover.type === 'image') {
    return (
      <div className={cn('relative overflow-hidden bg-muted', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </div>
    )
  }
  const Icon = GLYPHS[cover.icon] ?? KIND_ICONS[kind]
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)} style={{ background: hueGradient(cover.hue) }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      <Icon className={cn('relative size-10 text-white/90 drop-shadow-sm', iconClassName)} strokeWidth={1.6} />
    </div>
  )
}

export function CollectionGlyph({
  collection,
  size = 'md',
  className,
}: {
  collection: Pick<LibraryCollection, 'icon' | 'hue' | 'smart'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = GLYPHS[collection.icon] ?? Sparkles
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center text-white shadow-sm',
        size === 'sm' && 'size-6 rounded-md',
        size === 'md' && 'size-9 rounded-xl',
        size === 'lg' && 'size-14 rounded-2xl',
        className,
      )}
      style={{ background: hueGradient(collection.hue) }}
    >
      <Icon className={cn(size === 'sm' ? 'size-3.5' : size === 'md' ? 'size-[18px]' : 'size-7')} strokeWidth={2} />
      {collection.smart && size !== 'sm' && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-background bg-foreground text-background">
          <Sparkles className="size-2.5" strokeWidth={2.4} />
        </span>
      )}
    </span>
  )
}

export function KindChip({ kind, duration, className }: { kind: AssetKind; duration?: number; className?: string }) {
  const Icon = KIND_ICONS[kind]
  const label = formatDuration(duration)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm', className)}>
      <Icon className="size-3" />
      {label}
    </span>
  )
}

export function AnalysisBadge({ state, compact = false }: { state: AnalysisState; compact?: boolean }) {
  const t = useTranslations('Library.analysisState')
  if (state === 'analyzed') {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Sparkles className="size-3" />{t('analyzed')}
      </span>
    )
  }
  const tone = state === 'failed'
    ? 'bg-red-500/90 text-white'
    : state === 'skipped'
      ? 'bg-black/55 text-white/85'
      : 'bg-sky-500/90 text-white'
  const Icon = state === 'failed' ? CircleAlert : state === 'skipped' ? EyeOff : state === 'queued' ? Hourglass : Loader2
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm', tone)}>
      <Icon className={cn('size-3', state === 'analyzing' && 'animate-spin')} />
      {t(state)}
    </span>
  )
}

export function AvailabilityBadge({ availability, className }: { availability: AssetAvailability; className?: string }) {
  const t = useTranslations('Library.availability')
  if (availability.state === 'available') return null
  const config: Record<Exclude<AssetAvailability['state'], 'available'>, { icon: LucideIcon; tone: string }> = {
    cooldown: { icon: Clock, tone: 'bg-amber-500/90 text-black' },
    exhausted: { icon: CircleAlert, tone: 'bg-orange-600/90 text-white' },
    hidden: { icon: EyeOff, tone: 'bg-black/60 text-white' },
    blocked_consent: { icon: ShieldAlert, tone: 'bg-rose-600/90 text-white' },
    blocked_quality: { icon: CircleAlert, tone: 'bg-zinc-700/90 text-white' },
    blocked_license: { icon: ShieldAlert, tone: 'bg-zinc-700/90 text-white' },
    blocked_duplicate: { icon: EyeOff, tone: 'bg-violet-600/90 text-white' },
    pending_analysis: { icon: Hourglass, tone: 'bg-sky-600/90 text-white' },
    expired: { icon: Calendar, tone: 'bg-zinc-600/90 text-white' },
  }
  const { icon: Icon, tone } = config[availability.state]
  const label = availability.state === 'cooldown'
    ? t('cooldownDays', { days: availability.daysLeft })
    : availability.state === 'exhausted'
      ? t('exhaustedCount', { used: availability.used, limit: availability.limit })
      : t(availability.state)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm', tone, className)}>
      <Icon className="size-3" />
      {label}
    </span>
  )
}

export function PinnedMark() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-md bg-amber-400 text-black">
      <Star className="size-3 fill-current" />
    </span>
  )
}

export function useRelativeTime() {
  const format = useFormatter()
  return React.useCallback((iso: string | null | undefined) => (iso ? format.relativeTime(new Date(iso), new Date()) : '—'), [format])
}

export function TagList({ tags, max = 3, className }: { tags: string[]; max?: number; className?: string }) {
  if (!tags.length) return null
  const rest = tags.length - max
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.slice(0, max).map((tag) => (
        <span key={tag} className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
      ))}
      {rest > 0 && <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  children,
  className,
}: {
  icon: LucideIcon
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  )
}

/** Thin stacked bar: available / cooldown / exhausted / blocked. */
export function AvailabilityBar({ summary, className }: { summary: { available: number; cooldown: number; exhausted: number; blocked: number }; className?: string }) {
  const total = summary.available + summary.cooldown + summary.exhausted + summary.blocked
  if (!total) return <div className={cn('h-1.5 rounded-full bg-muted', className)} />
  const part = (value: number) => `${(value / total) * 100}%`
  return (
    <div className={cn('flex h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <span className="bg-emerald-500" style={{ width: part(summary.available) }} />
      <span className="bg-amber-400" style={{ width: part(summary.cooldown) }} />
      <span className="bg-orange-600" style={{ width: part(summary.exhausted) }} />
      <span className="bg-zinc-500" style={{ width: part(summary.blocked) }} />
    </div>
  )
}

export function assetMatchesQuery(asset: LibraryAsset, query: string) {
  const needle = query.trim().toLocaleLowerCase('tr')
  if (!needle) return true
  return [asset.name, ...asset.analysis.tags, asset.analysis.summary ?? '', asset.generatedBy?.prompt ?? '']
    .join(' ')
    .toLocaleLowerCase('tr')
    .includes(needle)
}

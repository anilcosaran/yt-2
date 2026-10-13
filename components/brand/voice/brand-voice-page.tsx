'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MapPin, Mars, NonBinary, Pause, Play, Plus, Star, Venus, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { BrandSearch, BrandSegmented, BrandTabs } from '@/components/brand/brand-controls'
import { LanguageFlagIcon } from '@/components/i18n/language-flag-icon'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { getMyFeatureLimits, MY_FEATURE_LIMITS_QUERY_KEY } from '@/lib/feature-control/api'
import { getLanguageFlagRegion } from '@/lib/i18n/language-display'
import { cn } from '@/lib/utils'
import {
  getVoiceProfilePreview,
  listVoiceProfiles,
  voiceProfilesQueryKey,
  type VoiceProfile,
} from '@/lib/voice/api'

type Tab = 'explore' | 'mine'
type Filters = { query: string; gender: string; ageBand: string; language: string; accent: string; tags: string[] }

const GENDERS = ['all', 'female', 'male', 'nonbinary'] as const
const AGES = ['all', 'young', 'adult', 'mature'] as const
const TAGS_SHOWN = 10
/** The sign beside each gender, in its colour, in the filter and on the cards. */
const GENDER_SIGNS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  female: { icon: Venus, color: 'text-pink-500 dark:text-pink-400' },
  male: { icon: Mars, color: 'text-sky-500 dark:text-sky-400' },
  nonbinary: { icon: NonBinary, color: 'text-violet-500 dark:text-violet-400' },
}

function GenderSign({ gender, className }: { gender: string; className?: string }) {
  const sign = GENDER_SIGNS[gender]
  if (!sign) return null
  const SignIcon = sign.icon
  return <SignIcon className={cn(sign.color, className)} />
}
const EMPTY_FILTERS: Filters = { query: '', gender: 'all', ageBand: 'all', language: 'all', accent: 'all', tags: [] }

/**
 * Marka > Sesler: the voice library as cards, two to a row. The catalog's voices and the channel's own clones in two
 * tabs; filters by gender (with its sign) and age, language (with its flag) and accent, and tone or use (chips); each
 * card plays its preview in place. One voice plays at a time.
 */
export function BrandVoicePage() {
  const t = useTranslations('BrandVoice')
  const { activeChannelId, isLoading: channelLoading } = useActiveChannel()
  const [tab, setTab] = React.useState<Tab>('explore')
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const [favorites, setFavorites] = React.useState<ReadonlySet<string>>(() => new Set())
  const [allTags, setAllTags] = React.useState(false)

  const mineQuery = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId: activeChannelId ?? undefined, origin: 'instant_clone', limit: 100 }),
    queryFn: ({ signal }) => listVoiceProfiles({ channelId: activeChannelId ?? undefined, origin: 'instant_clone', limit: 100 }, { signal }),
    enabled: Boolean(activeChannelId),
  })
  const stockQuery = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId: activeChannelId ?? undefined, origin: 'stock', status: 'ready', limit: 100 }),
    queryFn: ({ signal }) => listVoiceProfiles({ channelId: activeChannelId ?? undefined, origin: 'stock', status: 'ready', limit: 100 }, { signal }),
    enabled: Boolean(activeChannelId),
  })
  const limitsQuery = useQuery({
    queryKey: MY_FEATURE_LIMITS_QUERY_KEY,
    queryFn: getMyFeatureLimits,
    enabled: Boolean(activeChannelId),
  })

  const mine = mineQuery.data?.data ?? []
  const stock = stockQuery.data?.data ?? []
  const used = mineQuery.data?.meta.total ?? mine.length
  const maxSlots = limitsQuery.data?.features.find((feature) => feature.key === 'max_custom_voice_profiles')?.value
  const source = tab === 'mine' ? mine : stock
  const languages = [...new Set(source.flatMap((profile) => profile.supported_languages))].sort()
  const accents = [...new Set(source.flatMap((profile) => (profile.catalog.accent ? [profile.catalog.accent] : [])))].sort((a, b) => a.localeCompare(b, 'tr'))
  // Tone and use tags, the most common first; a few show, the rest open on demand (a chosen one always shows).
  const tagCounts = new Map<string, number>()
  for (const profile of source) for (const tag of [...profile.catalog.tone_tags, ...profile.catalog.use_case_tags]) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const tags = [...tagCounts.keys()].sort((a, b) => (tagCounts.get(b)! - tagCounts.get(a)!) || a.localeCompare(b, 'tr'))
  const shownTags = allTags ? tags : [...new Set([...tags.slice(0, TAGS_SHOWN), ...filters.tags])]
  const visible = filterVoices(source, filters)
  const activeQuery = tab === 'mine' ? mineQuery : stockQuery
  const filtered = filters.query !== '' || filters.gender !== 'all' || filters.ageBand !== 'all' || filters.language !== 'all' || filters.accent !== 'all' || filters.tags.length > 0
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }))
  const languageName = (code: string) => (t.has(`languageNames.${code}`) ? t(`languageNames.${code}`) : code.toUpperCase())

  if (channelLoading) return <WorkspaceRouteLoading />
  if (!activeChannelId) return <WorkspaceChannelRequired compact />

  return (
    <div className="hg-scrollbar relative h-full overflow-y-auto bg-background">
      <div className="relative mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden h-8 items-center rounded-full border border-border px-3 text-xs tabular-nums text-muted-foreground sm:inline-flex">
              {typeof maxSlots === 'number' ? t('slotUsage', { used, max: maxSlots }) : t('slotUnknown')}
            </span>
            <Button asChild className="h-9 rounded-full px-4">
              <Link href="/tools?tool=voice-clone"><Plus className="size-4" />{t('createClone')}</Link>
            </Button>
          </div>
        </header>

        <div className="mt-6">
          <BrandTabs
            label={t('title')}
            value={tab}
            tabs={[{ id: 'explore', label: t('tabs.explore'), count: stock.length }, { id: 'mine', label: t('tabs.mine'), count: mine.length }]}
            onChange={(value) => {
              setTab(value)
              setFilters(EMPTY_FILTERS)
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <BrandSearch value={filters.query} onChange={(query) => set({ query })} placeholder={t('search')} className="min-w-[160px]" />
          <BrandSegmented
            label={t('filters.gender.label')}
            value={filters.gender}
            options={GENDERS.map((id) => ({ id, label: t(`filters.gender.${id}`), icon: <GenderSign gender={id} /> }))}
            onChange={(gender) => set({ gender })}
          />
          <BrandSegmented label={t('filters.age.label')} value={filters.ageBand} options={AGES.map((id) => ({ id, label: t(`filters.age.${id}`) }))} onChange={(ageBand) => set({ ageBand })} />
          {languages.length > 1 ? (
            <FilterSelect
              value={filters.language}
              onChange={(language) => set({ language })}
              allLabel={t('filters.allLanguages')}
              allIcon={<LanguageFlagIcon region={null} />}
              options={languages.map((code) => ({ id: code, label: languageName(code), icon: <LanguageFlagIcon region={getLanguageFlagRegion(code)} /> }))}
            />
          ) : null}
          {accents.length > 1 ? (
            <FilterSelect
              value={filters.accent}
              onChange={(accent) => set({ accent })}
              allLabel={t('filters.allAccents')}
              allIcon={<MapPin className="size-3.5 text-muted-foreground" />}
              options={accents.map((accent) => ({ id: accent, label: accent, icon: <MapPin className="size-3.5 text-muted-foreground" /> }))}
            />
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('filters.tags')}>
            {shownTags.map((tag) => {
              const on = filters.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ tags: on ? filters.tags.filter((item) => item !== tag) : [...filters.tags, tag] })}
                  className={cn(
                    'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
                    on ? 'border-foreground/20 bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {capitalize(tag)}
                </button>
              )
            })}
            {tags.length > TAGS_SHOWN ? (
              <button type="button" onClick={() => setAllTags(!allTags)} className="h-7 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
                {allTags ? t('filters.fewerTags') : t('filters.moreTags', { count: tags.length - TAGS_SHOWN })}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex h-6 items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{t('count', { count: visible.length })}</span>
          {filtered ? (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
              <X className="size-3" />
              {t('filters.clear')}
            </button>
          ) : null}
        </div>

        <div className="mt-2">
          {activeQuery.isLoading ? (
            <EmptyState icon={Loader2} title={t('loading')} spinning />
          ) : activeQuery.isError ? (
            <EmptyState title={t('loadFailed')} actionLabel={t('retry')} onAction={() => void activeQuery.refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState
              title={tab === 'mine' && !filtered ? t('emptyMine') : t('emptyExplore')}
              description={tab === 'mine' && !filtered ? t('emptyMineHint') : undefined}
              actionLabel={tab === 'mine' && !filtered ? t('createClone') : filtered ? t('filters.clear') : undefined}
              href={tab === 'mine' && !filtered ? '/tools?tool=voice-clone' : undefined}
              onAction={filtered ? () => setFilters(EMPTY_FILTERS) : undefined}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((profile) => (
                <VoiceCard
                  key={profile.id}
                  channelId={activeChannelId}
                  profile={profile}
                  languageName={languageName}
                  playing={playingId === profile.id}
                  onPlayingChange={(playing) => setPlayingId((current) => (playing ? profile.id : current === profile.id ? null : current))}
                  favorite={favorites.has(profile.id)}
                  onFavorite={() => setFavorites((current) => {
                    const next = new Set(current)
                    if (next.has(profile.id)) next.delete(profile.id)
                    else next.add(profile.id)
                    return next
                  })}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function VoiceCard({ channelId, profile, languageName, playing, onPlayingChange, favorite, onFavorite }: {
  channelId: string
  profile: VoiceProfile
  languageName: (code: string) => string
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  favorite: boolean
  onFavorite: () => void
}) {
  const t = useTranslations('BrandVoice')
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const requestRef = React.useRef(0)
  const [loading, setLoading] = React.useState(false)
  const ready = profile.status === 'ready'
  const { catalog } = profile
  const tags = [...catalog.tone_tags, ...catalog.use_case_tags].slice(0, 3)

  // Another voice started (or this card left the list): stop this one.
  React.useEffect(() => {
    if (playing) return
    requestRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
  }, [playing])
  React.useEffect(() => () => {
    requestRef.current += 1
    audioRef.current?.pause()
  }, [])

  const toggle = async () => {
    if (!profile.preview_available) return
    if (playing) {
      onPlayingChange(false)
      return
    }
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    const preview = await getVoiceProfilePreview(profile.id, channelId).catch(() => null)
    setLoading(false)
    if (!preview || requestRef.current !== requestId) return
    const audio = new Audio(preview.url)
    audio.onended = () => onPlayingChange(false)
    audio.onerror = () => onPlayingChange(false)
    audioRef.current = audio
    onPlayingChange(true)
    void audio.play().catch(() => onPlayingChange(false))
  }

  return (
    <li
      className={cn(
        'group flex flex-col gap-3 rounded-2xl border p-4 transition-colors',
        playing ? 'border-foreground/25 bg-muted/40' : 'border-border bg-card/40 hover:border-foreground/15 hover:bg-card/70',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!profile.preview_available}
          aria-label={playing ? t('stopPreview') : t('preview')}
          title={playing ? t('stopPreview') : t('preview')}
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          style={{ background: voiceGradient(profile.id) }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : playing ? <Equalizer /> : <Play className="ml-0.5 size-4 fill-current" />}
          {playing ? <Pause className="absolute size-4 fill-current opacity-0 transition-opacity group-hover:opacity-100" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-medium text-foreground">{profile.display_name}</p>
            {catalog.featured ? <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10.5px] font-medium text-primary">{t('featured')}</span> : null}
            {!ready ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {profile.status === 'failed' ? t('failed') : t('provisioning')}
              </span>
            ) : null}
          </div>
          {/* Who the voice is, at a glance: its languages by flag, its gender by sign, its age and accent. */}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {profile.supported_languages.map((code) => (
              <span key={code} className="inline-flex items-center gap-1.5">
                <LanguageFlagIcon region={getLanguageFlagRegion(code)} className="h-3 w-4 rounded-[2px]" />
                {languageName(code)}
              </span>
            ))}
            {catalog.gender !== 'unknown' ? (
              <span className="inline-flex items-center gap-1">
                <GenderSign gender={catalog.gender} className="size-3.5" />
                {t(`filters.gender.${catalog.gender}`)}
              </span>
            ) : null}
            {catalog.age_band !== 'unknown' ? <span>{t(`filters.age.${catalog.age_band}`)}</span> : null}
            {catalog.accent ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {catalog.accent}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? t('unfavorite') : t('favorite')}
          title={favorite ? t('unfavorite') : t('favorite')}
          className={cn(
            '-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted',
            favorite ? 'text-amber-400' : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100',
          )}
        >
          <Star className={cn('size-4', favorite && 'fill-current')} />
        </button>
      </div>

      {catalog.description ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{catalog.description}</p> : null}

      <div className="mt-auto flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{capitalize(tag)}</span>
          ))}
        </div>
        <Waveform seed={profile.id} playing={playing} color={voiceColor(profile.id)} />
      </div>
    </li>
  )
}

/** The voice as a small waveform: still, then moving in the voice's colour while its preview plays. */
function Waveform({ seed, playing, color }: { seed: string; playing: boolean; color: string }) {
  const bars = waveformBars(seed)
  return (
    <span className="flex h-6 shrink-0 items-center gap-[2px]" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className={cn('w-[2px] rounded-full transition-colors', playing ? 'animate-[voice-eq_0.9s_ease-in-out_infinite]' : 'bg-muted-foreground/30')}
          style={{ height: `${Math.round(height * 100)}%`, backgroundColor: playing ? color : undefined, animationDelay: playing ? `${(index % 6) * 0.12}s` : undefined }}
        />
      ))}
    </span>
  )
}

/** Bars that move while a preview plays. */
function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => (
        <span key={bar} className="w-[3px] origin-bottom animate-[voice-eq_0.9s_ease-in-out_infinite] rounded-full bg-white" style={{ height: '100%', animationDelay: `${bar * 0.15}s` }} />
      ))}
    </span>
  )
}

/** The waveform's bar heights (0.25–1), the same for a voice every time. */
function waveformBars(seed: string) {
  let hash = 7
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  const bars: number[] = []
  for (let index = 0; index < 22; index += 1) {
    hash = (hash * 53 + 17 + index) % 9973
    bars.push(0.25 + (hash % 75) / 100)
  }
  return bars
}

/** A filter menu; each option may show an icon before its name (a flag, a pin), in the menu and on the trigger. */
function FilterSelect({ value, onChange, allLabel, allIcon, options }: {
  value: string
  onChange: (value: string) => void
  allLabel: string
  allIcon?: React.ReactNode
  options: Array<{ id: string; label: string; icon?: React.ReactNode }>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={cn('h-9 min-w-[132px] rounded-lg border-border bg-card/40 text-xs', value !== 'all' && 'text-foreground')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="flex items-center gap-2">{allIcon}{allLabel}</span>
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex items-center gap-2">{option.icon}{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction, href, spinning }: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  href?: string
  spinning?: boolean
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      {Icon ? <Icon className={cn('size-5 text-muted-foreground', spinning && 'animate-spin')} /> : null}
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && href ? (
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-full"><Link href={href}>{actionLabel}</Link></Button>
      ) : actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" className="mt-4 rounded-full" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  )
}

function filterVoices(profiles: VoiceProfile[], filters: Filters) {
  const query = filters.query.trim().toLocaleLowerCase('tr')
  return profiles.filter((profile) => {
    const { catalog } = profile
    if (filters.gender !== 'all' && catalog.gender !== filters.gender) return false
    if (filters.ageBand !== 'all' && catalog.age_band !== filters.ageBand) return false
    if (filters.language !== 'all' && !profile.supported_languages.includes(filters.language)) return false
    if (filters.accent !== 'all' && catalog.accent !== filters.accent) return false
    if (filters.tags.length > 0 && !filters.tags.every((tag) => catalog.tone_tags.includes(tag) || catalog.use_case_tags.includes(tag))) return false
    if (!query) return true
    return [profile.display_name, catalog.description ?? '', catalog.accent ?? '', ...catalog.tone_tags, ...catalog.use_case_tags]
      .some((text) => text.toLocaleLowerCase('tr').includes(query))
  })
}

/** A voice's hue, from its id, so the same voice always looks the same. */
function voiceHue(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

/** A voice's colour: a soft two-tone gradient (its play button) and the plain tone (its moving waveform). */
function voiceGradient(id: string) {
  const hue = voiceHue(id)
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 45%))`
}

function voiceColor(id: string) {
  return `hsl(${voiceHue(id)} 70% 58%)`
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('tr') + text.slice(1)
}

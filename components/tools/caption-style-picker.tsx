'use client'

import * as React from 'react'
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'

import {
  CAPTION_STYLE_NAMES,
  CaptionStyleThumbnail,
} from '@/components/tools/caption-style-preview-field'
import { ToolField, type ToolChoice } from '@/components/tools/tool-primitives'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

type CaptionStyleFilter = 'all' | 'motion' | 'depth' | 'clean' | 'highlight'

const FILTERS: Array<{ value: CaptionStyleFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'motion', label: 'Motion' },
  { value: 'depth', label: '3D' },
  { value: 'clean', label: 'Clean' },
  { value: 'highlight', label: 'Highlight' },
]

const DEPTH_STYLES = new Set([
  '3d_pop',
  'candy_depth',
  'retro_offset',
  'chrome_lift',
  'soft_clay',
  'acid_sticker',
])

const MOTION_STYLES = new Set([
  'typewriter_clean',
  'kinetic_slide',
  'focus_fade',
  'tiktok_bold',
  'tiktok_outline',
  'minimal_pop',
  'word_by_word',
  'headline_bold',
  'headline_caps',
  'neon_green',
  'neon_pink',
])

const CLEAN_STYLES = new Set([
  'classic_white',
  'classic_bold',
  'classic_black',
  'youtube_clean',
  'shorts_readable',
  'aesthetic_italic',
  'mono_focus',
  'editorial_serif',
  'minimal_thin',
  'minimal_shadow',
  'sentence',
])

function matchesFilter(value: string, filter: CaptionStyleFilter) {
  if (filter === 'all') return true
  if (value === 'auto') return false
  if (filter === 'depth') return DEPTH_STYLES.has(value)
  if (filter === 'motion') return MOTION_STYLES.has(value)
  if (filter === 'clean') return CLEAN_STYLES.has(value)
  return value.startsWith('word_highlight_')
    || value.startsWith('karaoke_')
    || value.startsWith('box_')
    || value === 'bold_yellow'
}

function styleFamily(value: string) {
  if (value === 'auto') return 'Smart match'
  if (DEPTH_STYLES.has(value)) return '3D depth'
  if (MOTION_STYLES.has(value)) return 'Motion'
  if (CLEAN_STYLES.has(value)) return 'Clean'
  if (value.startsWith('karaoke_')) return 'Karaoke'
  if (value.startsWith('word_highlight_')) return 'Highlight'
  if (value.startsWith('box_')) return 'Box'
  return 'Caption'
}

function styleDescription(value: string, resolvedStyleName: string) {
  if (value === 'auto') return `Adapts to the source · ${formatCaptionStyleName(resolvedStyleName)}`
  if (value === 'typewriter_clean') return 'Letter-by-letter reveal with a cursor'
  if (value === 'kinetic_slide') return 'Slides upward into the safe area'
  if (value === 'focus_fade') return 'Active word stays bright; context dims'
  if (DEPTH_STYLES.has(value)) return 'Hard outline and offset depth'
  if (value.startsWith('karaoke_')) return 'Progressive spoken-word sweep'
  if (value.startsWith('word_highlight_')) return 'Timed active-word color'
  if (value.startsWith('box_')) return 'High-contrast caption card'
  if (MOTION_STYLES.has(value)) return 'Timed emphasis for short-form video'
  if (CLEAN_STYLES.has(value)) return 'Readable, restrained typography'
  return 'Production-ready caption preset'
}

function formatCaptionStyleName(value: string) {
  if (value === '3d_pop') return '3D Pop'
  if (value === 'youtube_clean') return 'YouTube Clean'
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function CaptionStylePicker({
  label = 'Caption style',
  hint,
  value,
  options,
  resolvedStyleName = 'tiktok_bold',
  disabled = false,
  onValueChange,
}: {
  label?: string
  hint?: string
  value: string
  options: ToolChoice[]
  resolvedStyleName?: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<CaptionStyleFilter>('all')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const uniqueOptions = React.useMemo(() => {
    const supplied = new Map(options.filter((option) => option.value).map((option) => [option.value, option]))
    const canonicalValues = ['auto', ...CAPTION_STYLE_NAMES]
    const canonical = canonicalValues.map((styleName) => supplied.get(styleName) ?? {
      value: styleName,
      label: styleName === 'auto' ? 'Auto' : formatCaptionStyleName(styleName),
    })
    const canonicalSet = new Set(canonicalValues)
    return [...canonical, ...options.filter((option) => option.value && !canonicalSet.has(option.value))]
  }, [options])
  const resolvedAutoStyle = resolvedStyleName === 'auto' ? 'tiktok_bold' : resolvedStyleName
  const selectedOption = uniqueOptions.find((option) => option.value === value)
    ?? uniqueOptions[0]
  const selectedPreviewStyle = value === 'auto' ? resolvedAutoStyle : value
  const selectedLabel = value === 'auto'
    ? tAuto('auto_caption_style', { style: toolCopy(formatCaptionStyleName(resolvedAutoStyle)) })
    : toolCopy(selectedOption?.label ?? formatCaptionStyleName(value))
  const localizedStyleDescription = (styleValue: string) => styleValue === 'auto'
    ? tAuto('caption_style_adapts', { style: toolCopy(formatCaptionStyleName(resolvedAutoStyle)) })
    : toolCopy(styleDescription(styleValue, resolvedAutoStyle))
  const normalizedQuery = query.trim().toLowerCase()
  const visibleOptions = React.useMemo(() => uniqueOptions.filter((option) => {
    if (!matchesFilter(option.value, filter)) return false
    if (!normalizedQuery) return true
    const searchable = [
      option.label,
      option.value,
      styleFamily(option.value),
      styleDescription(option.value, resolvedAutoStyle),
    ].join(' ').toLowerCase()
    return searchable.includes(normalizedQuery)
  }), [filter, normalizedQuery, resolvedAutoStyle, uniqueOptions])

  return (
    <ToolField label={label} hint={hint ?? tAuto('caption_styles_plus_auto', { count: Math.max(0, uniqueOptions.length - 1) })}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            data-caption-style-picker-trigger="true"
            className="group @container flex w-full items-center gap-3 rounded-xl border border-border bg-panel/40 p-2 text-left shadow-none transition hover:border-primary/45 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.07] shadow-sm @max-[20rem]:h-10 @max-[20rem]:w-16">
              <CaptionStyleThumbnail styleName={selectedPreviewStyle} compact active />
            </div>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                {value === 'auto' ? <Sparkles className="size-3.5 shrink-0 text-primary" /> : null}
                <span className="truncate text-sm font-semibold text-foreground @max-[20rem]:line-clamp-2 @max-[20rem]:whitespace-normal">{selectedLabel}</span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground @max-[20rem]:hidden">
                {localizedStyleDescription(value)}
              </span>
            </span>
            <ChevronDown className={cn('mr-1 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          aria-label={label}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => inputRef.current?.focus())
          }}
          className="flex max-h-[var(--radix-popover-content-available-height)] min-h-0 w-[min(580px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-border bg-popover/95 p-0 shadow-2xl backdrop-blur-xl"
          data-caption-style-picker="gallery"
        >
          <div className="shrink-0 border-b border-border/80 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tAuto('search_caption_style_count', { count: uniqueOptions.length })}
                aria-label={tAuto('search_caption_styles_40251b51')}
                className="h-10 rounded-xl border-border bg-panel/50 pl-9 shadow-none"
              />
            </div>
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label={tAuto('filter_caption_styles_ef2ac27d')}>
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                    filter === item.value
                      ? 'border-primary/35 bg-primary/15 text-primary'
                      : 'border-border bg-panel/40 text-muted-foreground hover:border-primary/25 hover:text-foreground',
                  )}
                >
                  {toolCopy(item.label)}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[min(380px,48vh)] min-h-0 shrink">
            <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
              {visibleOptions.map((option) => {
                const selected = option.value === value
                const previewStyle = option.value === 'auto' ? resolvedAutoStyle : option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    data-caption-style-option={option.value}
                    onClick={() => {
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'caption-style-card group overflow-hidden rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary/55 bg-primary/[0.08] shadow-[0_0_0_1px_rgb(var(--primary)/0.08)]'
                        : 'border-border/80 bg-panel/35 hover:border-primary/35 hover:bg-accent/35',
                    )}
                  >
                    <div className="relative h-[92px] overflow-hidden rounded-lg">
                      <CaptionStyleThumbnail styleName={previewStyle} active={selected} />
                      {selected ? (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <span className="flex items-start gap-2 px-1.5 pb-1 pt-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">{toolCopy(option.label)}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {localizedStyleDescription(option.value)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {toolCopy(styleFamily(option.value))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            {visibleOptions.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center px-6 text-center">
                <Search className="size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold text-foreground"><UiText id="no_caption_styles_found_9ce06f56" /></p>
                <p className="mt-1 text-xs text-muted-foreground"><UiText id="try_another_name_or_category_1bc1c5ca" /></p>
              </div>
            ) : null}
          </ScrollArea>
          <p className="shrink-0 border-t border-border/80 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
            <UiText id="font_color_outline_box_and_depth_match_the_rende_f156274e" /></p>
        </PopoverContent>
      </Popover>

      <style>{"[data-caption-style-thumbnail] [data-caption-style-word] { display: inline-block; animation: caption-style-word 2.65s ease-in-out infinite; animation-play-state: paused; will-change: color, opacity, transform; } [data-caption-style-thumbnail][data-caption-style-mode='karaoke'] [data-caption-style-word] { animation-name: caption-style-karaoke; animation-duration: 3s; } [data-caption-style-thumbnail][data-caption-style-mode='focus_fade'] [data-caption-style-word] { animation-name: caption-style-focus; } [data-caption-style-word-by-word] { animation: caption-style-word-by-word 3.2s cubic-bezier(.2,.8,.2,1) infinite; animation-play-state: paused; will-change: opacity, transform; } [data-caption-style-thumbnail][data-caption-style-mode='kinetic_slide'] [data-caption-style-copy] { animation: caption-style-slide 2.8s cubic-bezier(.2,.8,.2,1) infinite; animation-delay: -.8s; animation-play-state: paused; will-change: opacity, transform; } [data-caption-style-thumbnail][data-caption-style-mode='sentence'] [data-caption-style-copy] { animation: caption-style-sentence 2.8s ease-in-out infinite; animation-play-state: paused; } [data-caption-style-typewriter-text] { display: inline-block; overflow: hidden; animation: caption-style-typewriter 3s steps(13, end) infinite; animation-delay: -1.25s; animation-play-state: paused; clip-path: inset(0 100% 0 0); } [data-caption-style-cursor] { animation: caption-style-cursor .72s step-end infinite; animation-play-state: paused; } .caption-style-card:hover [data-caption-style-word], .caption-style-card:focus-visible [data-caption-style-word], .caption-style-card:hover [data-caption-style-copy], .caption-style-card:focus-visible [data-caption-style-copy], .caption-style-card:hover [data-caption-style-typewriter-text], .caption-style-card:focus-visible [data-caption-style-typewriter-text], .caption-style-card:hover [data-caption-style-cursor], .caption-style-card:focus-visible [data-caption-style-cursor], .caption-style-card:hover [data-caption-style-word-by-word], .caption-style-card:focus-visible [data-caption-style-word-by-word], [data-caption-style-active='true'] [data-caption-style-word], [data-caption-style-active='true'] [data-caption-style-copy], [data-caption-style-active='true'] [data-caption-style-typewriter-text], [data-caption-style-active='true'] [data-caption-style-cursor], [data-caption-style-active='true'] [data-caption-style-word-by-word] { animation-play-state: running; } @keyframes caption-style-word { 0%, 18% { color: var(--caption-style-accent); opacity: 1; transform: scale(1.10); } 30%, 100% { color: var(--caption-style-base); opacity: .88; transform: scale(1); } } @keyframes caption-style-focus { 0%, 18% { color: var(--caption-style-accent); opacity: 1; transform: scale(1.04); } 30%, 100% { color: var(--caption-style-base); opacity: .34; transform: scale(1); } } @keyframes caption-style-karaoke { 0%, 78% { color: var(--caption-style-accent); opacity: 1; transform: scale(1); } 88%, 100% { color: var(--caption-style-base); opacity: .88; transform: scale(1); } } @keyframes caption-style-word-by-word { 0% { opacity: 0; transform: scale(.76); } 5%, 21% { opacity: 1; transform: scale(1.08); } 24%, 100% { opacity: 0; transform: scale(1); } } @keyframes caption-style-slide { 0%, 6% { opacity: 0; transform: translateY(13px); } 18%, 78% { opacity: 1; transform: translateY(0); } 92%, 100% { opacity: 0; transform: translateY(-4px); } } @keyframes caption-style-sentence { 0%, 8%, 90%, 100% { opacity: .46; transform: translateY(2px); } 18%, 80% { opacity: 1; transform: translateY(0); } } @keyframes caption-style-typewriter { 0%, 10% { clip-path: inset(0 100% 0 0); } 62%, 86% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 100% 0 0); } } @keyframes caption-style-cursor { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } } @media (prefers-reduced-motion: reduce) { [data-caption-style-thumbnail] * { animation: none !important; } [data-caption-style-typewriter-text] { clip-path: none !important; } }"}</style>
    </ToolField>
  )
}

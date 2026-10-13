'use client'

// The new-chat start page's inspiration wall: example videos and tools as an edge-to-edge masonry wall without
// gaps. A card does not run anything; "Kullan" fills the composer (prompt, format, length, mode) and the user sends it.

import * as React from 'react'
import Image from 'next/image'
import { ArrowUpRight, Clapperboard, Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export type ChatStartMode = 'agent' | 'script'

export type ChatStartExample = {
  id: string
  kind: 'example' | 'tool'
  image: string
  /** Card shape in the masonry grid (follows the picture). */
  shape: 'square' | 'portrait' | 'landscape' | 'wide'
  aspectRatio: '16:9' | '9:16' | '1:1'
  /** Undefined for image tools: the composer keeps its current length. */
  durationSeconds?: number
  mode: ChatStartMode
  prompt: string
}

const EXAMPLES: Array<Omit<ChatStartExample, 'prompt'>> = [
  { id: 'news', kind: 'example', image: '/flows/news.png', shape: 'square', aspectRatio: '16:9', durationSeconds: 60, mode: 'agent' },
  { id: 'tips', kind: 'example', image: '/flows/tips.png', shape: 'square', aspectRatio: '9:16', durationSeconds: 30, mode: 'agent' },
  { id: 'clips', kind: 'tool', image: '/tools/video-module.png', shape: 'square', aspectRatio: '9:16', durationSeconds: 30, mode: 'agent' },
  { id: 'angles', kind: 'example', image: '/tools/angle/front.jpg', shape: 'portrait', aspectRatio: '9:16', durationSeconds: 15, mode: 'agent' },
  { id: 'storyboard', kind: 'example', image: '/auth/storyboard-timeline.png', shape: 'landscape', aspectRatio: '16:9', durationSeconds: 90, mode: 'script' },
  { id: 'expert', kind: 'example', image: '/flows/expert.png', shape: 'square', aspectRatio: '9:16', durationSeconds: 45, mode: 'agent' },
  { id: 'background', kind: 'tool', image: '/tools/image-module.png', shape: 'square', aspectRatio: '1:1', mode: 'agent' },
  { id: 'avatar', kind: 'tool', image: '/brand/clone-human-card.png', shape: 'wide', aspectRatio: '16:9', durationSeconds: 60, mode: 'agent' },
  { id: 'educational', kind: 'example', image: '/flows/educational.png', shape: 'square', aspectRatio: '16:9', durationSeconds: 120, mode: 'script' },
  { id: 'lookbook', kind: 'example', image: '/tools/angle/side.jpg', shape: 'portrait', aspectRatio: '9:16', durationSeconds: 20, mode: 'agent' },
  { id: 'sales', kind: 'example', image: '/flows/sales.png', shape: 'square', aspectRatio: '9:16', durationSeconds: 30, mode: 'agent' },
  { id: 'captions', kind: 'tool', image: '/tools/media-module.png', shape: 'square', aspectRatio: '9:16', durationSeconds: 60, mode: 'agent' },
  { id: 'campaign', kind: 'example', image: '/auth/campaign-publishing.png', shape: 'landscape', aspectRatio: '9:16', durationSeconds: 30, mode: 'script' },
  { id: 'character', kind: 'tool', image: '/brand/virtual-character-card.png', shape: 'wide', aspectRatio: '9:16', durationSeconds: 30, mode: 'agent' },
  { id: 'course', kind: 'example', image: '/flows/course.png', shape: 'square', aspectRatio: '16:9', durationSeconds: 90, mode: 'script' },
  { id: 'topdown', kind: 'example', image: '/tools/angle/top-down.jpg', shape: 'portrait', aspectRatio: '9:16', durationSeconds: 15, mode: 'agent' },
  { id: 'demo', kind: 'example', image: '/auth/ai-video-workspace.png', shape: 'landscape', aspectRatio: '16:9', durationSeconds: 60, mode: 'agent' },
]

const SHAPE_CLASS: Record<ChatStartExample['shape'], string> = {
  square: 'aspect-square',
  portrait: 'aspect-[9/14]',
  landscape: 'aspect-[10/7]',
  wide: 'aspect-[3/2]',
}

type Filter = 'all' | 'example' | 'tool'

export function ChatStartGallery({ onUse }: { onUse: (example: ChatStartExample) => void }) {
  const t = useTranslations('Chat.startGallery')
  const [filter, setFilter] = React.useState<Filter>('all')
  const items = EXAMPLES.filter((item) => filter === 'all' || item.kind === filter)

  return (
    <section aria-labelledby="chat-start-gallery-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-4 sm:px-6">
        <div>
          <h2 id="chat-start-gallery-title" className="font-display text-xl text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'example', 'tool'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                'h-8 rounded-full px-3.5 text-sm font-medium transition-colors',
                filter === value ? 'bg-foreground text-background' : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t(`filter.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 columns-2 gap-0 overflow-hidden rounded-2xl sm:mx-6 sm:columns-3 lg:columns-4 xl:columns-5">
        {items.map((item) => (
          <GalleryCard key={item.id} item={item} onUse={onUse} />
        ))}
      </div>
    </section>
  )
}

function GalleryCard({ item, onUse }: { item: Omit<ChatStartExample, 'prompt'>; onUse: (example: ChatStartExample) => void }) {
  const t = useTranslations('Chat.startGallery')
  const title = t(`items.${item.id}.title`)
  const meta = [
    item.aspectRatio,
    item.durationSeconds ? durationLabel(item.durationSeconds, t) : t('image'),
    item.mode === 'script' ? t('scriptMode') : null,
  ].filter(Boolean).join(' · ')
  const KindIcon = item.kind === 'tool' ? Wrench : Clapperboard

  return (
    <button
      type="button"
      onClick={() => onUse({ ...item, prompt: t(`items.${item.id}.prompt`) })}
      aria-label={t('useLabel', { title })}
      className="group relative block w-full break-inside-avoid overflow-hidden bg-muted text-left outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className={cn('relative w-full', SHAPE_CLASS[item.shape])}>
        <Image
          src={item.image}
          alt=""
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        <KindIcon className="size-3" />
        {t(`kind.${item.kind}`)}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-12">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{title}</span>
          <span className="block truncate text-xs text-white/70">{meta}</span>
        </span>
        <span className="inline-flex shrink-0 translate-y-1 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          {t('use')}
          <ArrowUpRight className="size-3.5" />
        </span>
      </span>
    </button>
  )
}

function durationLabel(seconds: number, t: (key: string, values?: Record<string, number>) => string) {
  if (seconds < 60) return t('seconds', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? t('minutesSeconds', { minutes, seconds: rest }) : t('minutes', { count: minutes })
}

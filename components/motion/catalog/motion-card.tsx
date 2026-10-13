'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { metaLine, titleOf, type CatalogItem } from '@/lib/motion-editor/catalog-model'
import type { CatalogPreview, CatalogPreviewSource } from '@/lib/motion-editor/catalog-preview-source'
import type { LiveSlotPool } from '@/lib/motion-editor/live-slots'

import type { MotionPlayerDeps } from '../motion-runtime-player'
import { MotionCardPreview } from './motion-card-preview'

/**
 * One catalog card: a live preview on top (plays on hover or keyboard focus), then name, length and format, and the category.
 * The whole card is ONE button that opens the Motion's dialog, so it is reachable and operable by keyboard.
 */
export function MotionCatalogCard({
  item,
  pool,
  source,
  playerDeps,
  suspended,
  onOpen,
}: {
  item: CatalogItem
  pool: LiveSlotPool
  source: CatalogPreviewSource
  playerDeps?: MotionPlayerDeps
  suspended: boolean
  onOpen: (id: string) => void
}) {
  const t = useTranslations('Motion.catalog')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const title = titleOf(item, locale)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [live, setLive] = React.useState<CatalogPreview | null>(null)
  const onMeta = React.useCallback((preview: CatalogPreview) => setLive(preview), [])
  const meta = metaLine(item, live ? { durationSeconds: live.durationFrames / live.fps, ratio: live.ratio } : null)

  return (
    <li className="min-w-0">
      <button
        type="button"
        className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-[border-color,box-shadow,transform] hover:border-foreground/25 hover:shadow-md focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-haspopup="dialog"
        data-motion-card={item.id}
        data-motion-kind={item.kind}
        data-motion-category={item.category}
        onClick={() => onOpen(item.id)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div className="relative">
          <MotionCardPreview item={item} title={title} pool={pool} source={source} {...(playerDeps && { playerDeps })} suspended={suspended} playing={hovered || focused} onMeta={onMeta} />
          {item.premium || item.kind === 'draft' ? (
            <span className="absolute top-2 left-2 flex gap-1.5">
              {item.premium ? (
                <Badge className="gap-1 bg-black/60 text-white backdrop-blur" variant="secondary">
                  {item.locked ? <Lock className="size-3" aria-hidden /> : null}
                  {item.locked ? t('card.locked') : t('card.premium')}
                </Badge>
              ) : null}
              {item.kind === 'draft' ? <Badge className="bg-black/60 text-white backdrop-blur" variant="secondary">{t('card.draft')}</Badge> : null}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 p-3.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate font-mono">{item.kind === 'draft' ? [t('card.draftVersion', { version: item.draftVersion ?? 0 }), meta].filter(Boolean).join(' · ') : meta}</span>
            <Badge variant="outline" className="shrink-0 font-normal">{t(`categories.${item.category}`)}</Badge>
          </span>
        </div>
      </button>
    </li>
  )
}

'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  ANGLE_GALLERY_ITEMS,
  type AngleGalleryItem,
} from '@/lib/tools/angle-gallery'

export function AngleGalleryGrid({
  selectedIds,
  onToggle,
}: {
  selectedIds: readonly string[]
  onToggle: (id: string) => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div
      role="group"
      aria-label={tAuto('angle_presets_8e0f1ee2')}
      className="grid grid-cols-3 gap-2"
    >
      {ANGLE_GALLERY_ITEMS.map((item) => (
        <AngleGalleryCard
          key={item.id}
          item={item}
          selected={selectedIds.includes(item.id)}
          label={tAuto(item.labelKey)}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  )
}

function AngleGalleryCard({
  item,
  selected,
  label,
  onToggle,
}: {
  item: AngleGalleryItem
  selected: boolean
  label: string
  onToggle: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}, ${item.degree}`}
      onClick={onToggle}
      className={cn(
        'group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary/45 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/35',
      )}
    >
      <span className="relative block aspect-[3/4] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageSrc}
          alt=""
          width={1080}
          height={1920}
          className="h-full w-full object-cover"
        />
      </span>
      <span className="flex items-start justify-between gap-1.5 px-2 py-1.5">
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold leading-4 text-foreground">
            {label}
          </span>
          <span className="block text-[10px] tabular-nums text-muted-foreground">
            {item.degree}
          </span>
        </span>
        <span
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-transparent',
          )}
          aria-hidden="true"
        >
          <Check className="size-2.5" />
        </span>
      </span>
      <span className="sr-only">
        {selected ? tAuto('selected_angles_8a573250') : null}
      </span>
    </button>
  )
}

import * as React from 'react'

import type { CatalogItem } from '@/lib/motion-editor/catalog-model'
import { cn } from '@/lib/utils'

/**
 * The static face of a Motion card: a deterministic gradient with the Motion's sample text (or its title). It is what a card
 * shows before its live picture is drawn, while it has no player slot (the live cap), when it has no compile to draw
 * (platform Motions today) and when the runtime fails. It never pretends to move.
 */
export function MotionPoster({ item, title, large = false, className }: { item: CatalogItem; title: string; large?: boolean; className?: string }) {
  const face = item.sampleText ?? title
  return (
    <div
      className={cn('absolute inset-0 flex items-center justify-center overflow-hidden p-4 text-center', className)}
      style={{ background: `linear-gradient(135deg,hsl(${item.hue} 38% 34%),hsl(${(item.hue + 55) % 360} 36% 14%))` }}
      data-motion-poster=""
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
      <span className={cn('relative line-clamp-3 font-semibold tracking-tight text-white/95 drop-shadow', large ? 'text-3xl' : 'text-lg')}>{face}</span>
    </div>
  )
}

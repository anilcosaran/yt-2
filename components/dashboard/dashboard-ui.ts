import { cn } from '@/lib/utils'

/** The home page's surface: a large-radius hairline panel on nearly the page's own colour, with no rules inside. */
export const panel = 'rounded-2xl border border-border bg-card/70'

/** A soft segmented control: a tinted track, the chosen item a step lighter. */
export const segTrack = 'flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-0.5'

export function segItem(on: boolean) {
  return cn(
    'rounded-full px-3 py-1 text-[13px] font-medium transition-colors',
    on ? 'bg-foreground/[0.1] text-foreground' : 'text-muted-foreground hover:text-foreground',
  )
}

/** A count or value at the end of a row. */
export const pill = 'shrink-0 rounded-full bg-foreground/[0.08] px-2.5 py-1 text-[12px] font-medium tabular-nums'

/** A row that lights up on hover instead of being ruled off from its neighbours. */
export const softRow = 'rounded-xl transition-colors hover:bg-foreground/[0.035]'

/** Green for growth, rose for a drop. */
export function trendTone(up: boolean) {
  return up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
}

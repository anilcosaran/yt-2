import { Skeleton } from '@/components/ui/skeleton'

const GHOST_CARDS = [
  { left: '18%', top: '22%', height: 168 },
  { left: '46%', top: '14%', height: 208 },
  { left: '40%', top: '56%', height: 148 },
]

/** The board on its way: its dotted surface, its bars and a few card outlines (shown only after a beat). */
export function CanvasLoading() {
  return (
    <div
      aria-busy="true"
      className="route-in relative h-full min-h-[24rem] overflow-hidden bg-background"
      style={{
        backgroundImage: 'radial-gradient(color-mix(in oklab, var(--foreground) 13%, transparent) 1.2px, transparent 1.2px)',
        backgroundSize: '24px 24px',
      }}
    >
      <Skeleton className="absolute left-3 top-3 h-10 w-64 rounded-2xl" />
      <Skeleton className="absolute right-3 top-3 size-10 rounded-2xl" />
      {GHOST_CARDS.map((card) => (
        <Skeleton
          key={`${card.left}-${card.top}`}
          className="absolute hidden w-[296px] rounded-2xl md:block"
          style={{ left: card.left, top: card.top, height: card.height }}
        />
      ))}
      <Skeleton className="absolute bottom-4 left-4 hidden h-10 w-48 rounded-2xl sm:block" />
      <Skeleton className="absolute bottom-4 left-1/2 h-10 w-80 -translate-x-1/2 rounded-2xl" />
    </div>
  )
}

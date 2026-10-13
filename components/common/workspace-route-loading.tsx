import { Skeleton } from '@/components/ui/skeleton'

export function WorkspaceRouteLoading() {
  return (
    // Shown only after a beat (`route-in`): a quick navigation never flashes the skeleton.
    <div className="hg-scrollbar route-in relative h-full overflow-hidden bg-background">
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto min-h-full w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-[65vw]" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  )
}
import { PageContainer } from '@/components/common/page-container'
import { Skeleton } from '@/components/ui/skeleton'

export function WorkspaceRouteLoading() {
  return (
    // Shown only after a beat (`route-in`): a quick navigation never flashes the skeleton. Same frame and heading
    // shape as the page that is coming, so nothing jumps when it lands.
    <PageContainer className="route-in overflow-hidden">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-[65vw]" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </PageContainer>
  )
}

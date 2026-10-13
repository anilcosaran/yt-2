'use client'

import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { Skeleton } from '@/components/ui/skeleton'

export function ChannelsPageLoading() {
  return <WorkspaceRouteLoading />
}

export function ChannelPageLoadingContent() {
  return <WorkspaceRouteLoading />
}

export function ChannelPageSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      <Skeleton className="h-11 w-full rounded-none" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-lg" />
    </div>
  )
}

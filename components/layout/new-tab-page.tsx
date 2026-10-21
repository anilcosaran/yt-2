'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { RouteSpinner } from '@/components/common/route-spinner'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { newSparkProjectHref } from '@/lib/spark/api'
import { openNewTab } from '@/lib/work-tabs'

/**
 * The new tab's old address (`/new`): the new tab is a new project now ("+" opens `/spark/new` straight away), so a
 * link here opens one in the active channel, in the new tab. Without a channel there is nowhere to make it, and the
 * projects list says so.
 */
export function NewTabPage() {
  const router = useRouter()
  const { activeChannelId, isLoading } = useActiveChannel()

  React.useEffect(() => {
    if (isLoading) return
    if (!activeChannelId) {
      router.replace('/spark')
      return
    }
    openNewTab()
    router.replace(newSparkProjectHref(activeChannelId))
  }, [activeChannelId, isLoading, router])

  return <RouteSpinner />
}

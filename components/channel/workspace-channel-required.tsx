'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { CHANNELS_QUERY_KEY } from '@/lib/channel/api'
import { WORKSPACE_BOOTSTRAP_QUERY_KEY } from '@/lib/workspace/api'

export function WorkspaceChannelRequired({
  compact = false,
}: {
  compact?: boolean
}) {
  const tChannels = useTranslations('Channels')
  const queryClient = useQueryClient()
  const { refreshChannels } = useActiveChannel()
  const [pending, setPending] = React.useState(false)

  const retry = async () => {
    if (pending) return
    setPending(true)
    try {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_BOOTSTRAP_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY })
      await refreshChannels()
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className={
        compact
          ? 'flex min-h-[340px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-6 text-center'
          : 'mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center'
      }
    >
      <Link2 className="h-9 w-9 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{tChannels('retryWorkspace')}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {tChannels('workspacePreparing')}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => void retry()} disabled={pending}>
          {tChannels('retryWorkspace')}
        </Button>
        <Button asChild variant="outline">
          <Link href="/channels?view=connection">{tChannels('connectChannel')}</Link>
        </Button>
      </div>
    </div>
  )
}

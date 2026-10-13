'use client'

import * as React from 'react'

import type { Channel } from '@/lib/channel/api'

export const ACTIVE_CHANNEL_STORAGE_KEY = 'youtorch.activeChannelId'

export type ActiveChannelContextValue = {
  channels: Channel[]
  activeChannel: Channel | null
  activeChannelId: string | null
  workspaceReady: boolean
  setActiveChannelId: (channelId: string) => void
  isLoading: boolean
  error: Error | null
  refreshChannels: () => Promise<unknown>
}

const ActiveChannelContext = React.createContext<ActiveChannelContextValue | null>(null)

export function ActiveChannelProvider({
  value,
  children,
}: {
  value: ActiveChannelContextValue
  children: React.ReactNode
}) {
  return (
    <ActiveChannelContext.Provider value={value}>
      {children}
    </ActiveChannelContext.Provider>
  )
}

export function useActiveChannel() {
  const context = React.useContext(ActiveChannelContext)
  if (!context) {
    throw new Error('useActiveChannel must be used inside MainLayout')
  }
  return context
}

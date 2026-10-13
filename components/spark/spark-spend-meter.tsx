'use client'

import * as React from 'react'
import { QueryClientContext } from '@tanstack/react-query'

import { ChatSpendMeter } from '@/components/chat/spend-meter-chip'

/**
 * Y1-02 (Kalan 2, mounted with Y1-08): the credit meter of the Spark side chat. The side chat is an ordinary Assistant
 * conversation, so the same server meter (`GET /api/v1/assistant-spend/conversations/{id}/meter`) and the same chip as
 * the Chat page apply; nothing is computed here. Nothing shows without a linked conversation, with the job spend
 * envelope switch off (the chip renders null), or in a tree without the app's QueryClient (the pane's static render
 * tests): the guard keeps the pane usable there instead of throwing.
 */
export function SparkSpendMeter({ conversationId, working }: { conversationId: string | null; working: boolean }) {
  const client = React.useContext(QueryClientContext)
  if (!client || !conversationId) return null
  return (
    <ChatSpendMeter
      conversationId={conversationId}
      runActive={working}
      runState={working ? 'working' : null}
      mode={null}
      className="pb-2"
    />
  )
}

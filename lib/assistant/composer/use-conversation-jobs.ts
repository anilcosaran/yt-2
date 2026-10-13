'use client'

import * as React from 'react'

import { parseAssistantRunEvent, type AssistantRunEvent } from '@/lib/assistant/api'
import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'

import {
  applyConversationJobEvent,
  conversationJobsFromSnapshot,
  isBackgroundTranscriptEvent,
  type ConversationJobs,
} from './conversation-jobs'

const EMPTY_JOBS: ConversationJobs = new Map()

export function getAssistantConversationStreamUrl(conversationId: string) {
  return `${getYoutorchApiBaseUrl()}/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}/stream`
}

/**
 * P03-14: every job of the conversation from the P01-15 conversation stream (one SSE; the browser resumes it with
 * `Last-Event-ID`, the snapshot restores each job's state after a reconnect). Events of jobs other than the focused one
 * are handed to `onBackgroundEvent` so the transcript can pick up a late answer without moving the focus.
 */
export function useConversationJobs(input: {
  conversationId: string | null
  enabled: boolean
  focusedJobId: string | null
  onBackgroundEvent: (event: AssistantRunEvent) => void
}): ConversationJobs {
  const { conversationId, enabled } = input
  const [state, setState] = React.useState<{ conversationId: string | null; jobs: ConversationJobs }>({ conversationId: null, jobs: EMPTY_JOBS })
  const focusedRef = React.useRef(input.focusedJobId)
  const onBackgroundRef = React.useRef(input.onBackgroundEvent)
  React.useEffect(() => {
    focusedRef.current = input.focusedJobId
    onBackgroundRef.current = input.onBackgroundEvent
  }, [input.focusedJobId, input.onBackgroundEvent])

  React.useEffect(() => {
    if (!enabled || !conversationId || typeof window === 'undefined' || typeof window.EventSource === 'undefined') return undefined
    const source = new EventSource(getAssistantConversationStreamUrl(conversationId), { withCredentials: true })
    const handleSnapshot = (message: MessageEvent<string>) => {
      try {
        const jobs = conversationJobsFromSnapshot(JSON.parse(message.data))
        setState({ conversationId, jobs })
      } catch {
        // A malformed snapshot keeps the last known jobs; the next snapshot/reconnect repairs it.
      }
    }
    const handleRunEvent = (message: MessageEvent<string>) => {
      const event = parseAssistantRunEvent(message.data)
      if (!event) return
      setState((current) => (current.conversationId === conversationId
        ? { conversationId, jobs: applyConversationJobEvent(current.jobs, event) }
        : { conversationId, jobs: applyConversationJobEvent(EMPTY_JOBS, event) }))
      if (isBackgroundTranscriptEvent(event, focusedRef.current)) onBackgroundRef.current(event)
    }
    source.addEventListener('snapshot', handleSnapshot as EventListener)
    source.addEventListener('run_event', handleRunEvent as EventListener)
    return () => {
      source.removeEventListener('snapshot', handleSnapshot as EventListener)
      source.removeEventListener('run_event', handleRunEvent as EventListener)
      source.close()
    }
  }, [conversationId, enabled])

  return state.conversationId === conversationId ? state.jobs : EMPTY_JOBS
}

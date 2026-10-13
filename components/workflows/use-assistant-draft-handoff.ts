'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'

import { loadAssistantWorkflowDraft, readAssistantDraftRef } from '@/lib/assistant/light-view/assistant-draft-handoff'
import type { Workflow } from '@/lib/types'

/**
 * P03-16: opens an Assistant workflow draft in Flows from its server refs (`?assistant_conversation=&assistant_message=`).
 * The draft is read from the server (plus this tab's unsaved Chat canvas edits) and handed to the page once per ref
 * as an unsaved local draft; a Flows save turns it into a real definition. Nothing is read from browser storage.
 */
export function useAssistantDraftHandoff(input: {
  enabled: boolean
  onLoaded: (workflow: Workflow) => void
  onUnavailable: () => void
}) {
  const searchParams = useSearchParams()
  const ref = readAssistantDraftRef(searchParams)
  const key = ref ? `${ref.conversationId}:${ref.messageId}` : null
  const query = useQuery({
    queryKey: ['assistant', 'workflow-draft-handoff', key],
    queryFn: ({ signal }) => loadAssistantWorkflowDraft(ref!, undefined, { signal }),
    enabled: input.enabled && ref !== null,
    staleTime: Infinity,
    retry: 1,
  })
  const handledRef = React.useRef<string | null>(null)
  // The page passes plain callbacks; the latest ones are used and their identity never re-triggers the handoff.
  const callbacksRef = React.useRef({ onLoaded: input.onLoaded, onUnavailable: input.onUnavailable })
  React.useEffect(() => {
    callbacksRef.current = { onLoaded: input.onLoaded, onUnavailable: input.onUnavailable }
  })
  React.useEffect(() => {
    if (!key || handledRef.current === key) return
    if (query.isSuccess) {
      handledRef.current = key
      if (query.data) callbacksRef.current.onLoaded(query.data)
      else callbacksRef.current.onUnavailable()
    } else if (query.isError) {
      handledRef.current = key
      callbacksRef.current.onUnavailable()
    }
  }, [key, query.data, query.isError, query.isSuccess])
  return { loading: ref !== null && query.isLoading }
}

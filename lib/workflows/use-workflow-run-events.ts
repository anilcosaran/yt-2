'use client'

import * as React from 'react'

import {
  getWorkflowRunEventsUrl,
  WorkflowRunEventsConnection,
  type WorkflowRunEventMessage,
} from '@/lib/workflows/run-events'

/**
 * LAT-03: one tenant-wide run event stream per mounted screen. `connected` tells callers to stretch their status
 * polls to the safety interval; every failure turns it false so polling resumes at its normal rate.
 */
export function useWorkflowRunEvents(input: {
  enabled: boolean
  onEvent: (event: WorkflowRunEventMessage) => void
  onReady?: () => void
}): { connected: boolean } {
  const { enabled } = input
  const [connected, setConnected] = React.useState(false)
  const onEventRef = React.useRef(input.onEvent)
  const onReadyRef = React.useRef(input.onReady)
  React.useEffect(() => {
    onEventRef.current = input.onEvent
    onReadyRef.current = input.onReady
  }, [input.onEvent, input.onReady])

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.EventSource === 'undefined') return undefined
    const connection = new WorkflowRunEventsConnection({
      createSource: () => new EventSource(getWorkflowRunEventsUrl(), { withCredentials: true }),
      onEvent: (event) => onEventRef.current(event),
      onReady: () => onReadyRef.current?.(),
      onConnectedChange: setConnected,
    })
    connection.start()
    return () => connection.stop()
  }, [enabled])

  return { connected: enabled && connected }
}

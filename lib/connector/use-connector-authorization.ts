'use client'

import * as React from 'react'

import {
  cancelConnectorAuthorizationAttempt,
  getConnectorAuthorizationAttempt,
  listConnectorResourceCandidates,
  selectConnectorResources,
  startConnectorAuthorization,
  type ConnectorAuthorizationAttempt,
  type ConnectorResourceCandidate,
} from './api'
import { openConnectorPopup, waitForConnectorPopup } from './oauth-popup'

export type ConnectorAuthorizationFlow =
  | { phase: 'idle' }
  | { phase: 'popup' }
  | { phase: 'select'; attempt: ConnectorAuthorizationAttempt; candidates: ConnectorResourceCandidate[]; partial: boolean; resourceKind: string }
  | { phase: 'finishing' }
  | { phase: 'done'; connectionId: string | null; attemptId: string }
  | { phase: 'error'; reason: 'popup_blocked' | 'closed' | 'failed' | 'no_resources' }

export interface StartConnectorAuthorizationInput {
  connectorSlug: string
  capabilities: string[]
  /** Reauth / incremental scope for exactly this connection. */
  connectionId?: string | null
  /** P03-18: the Chat requirement (ref + exact version) this consent belongs to; management connects omit it. */
  connectionRequirement?: { ref: string; version: number } | null
}

/**
 * The shared Connect flow (P01C-13 management UI and the P03-18 Chat card): popup → provider consent → result page
 * message → authenticated attempt read → optional resource pick → owner grant. A blocked popup starts nothing; a
 * closed popup cancels the open attempt and is never shown as connected. Server state only, nothing stored locally.
 */
export function useConnectorAuthorization() {
  const [flow, setFlow] = React.useState<ConnectorAuthorizationFlow>({ phase: 'idle' })
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => () => abortRef.current?.abort(), [])

  const loadCandidates = React.useCallback(async (attempt: ConnectorAuthorizationAttempt) => {
    const resourceKind = attempt.resource_kinds[0]
    if (!attempt.connection_id || !resourceKind) {
      setFlow({ phase: 'error', reason: 'failed' })
      return
    }
    const page = await listConnectorResourceCandidates(attempt.connection_id, { resourceKind })
    if (page.items.length === 0) {
      setFlow({ phase: 'error', reason: 'no_resources' })
      return
    }
    setFlow({ phase: 'select', attempt, candidates: page.items, partial: page.partial, resourceKind })
  }, [])

  const start = React.useCallback(async (input: StartConnectorAuthorizationInput) => {
    // Opened synchronously inside the click handler; a blocked popup never starts an attempt.
    const popup = openConnectorPopup()
    if (!popup) {
      setFlow({ phase: 'error', reason: 'popup_blocked' })
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFlow({ phase: 'popup' })
    let attemptId: string | null = null
    try {
      const started = await startConnectorAuthorization(input.connectorSlug, {
        capabilities: input.capabilities,
        connectionId: input.connectionId ?? null,
        connectionRequirement: input.connectionRequirement ?? null,
      })
      attemptId = started.attempt_id
      popup.location.href = started.authorization_url
      const result = await waitForConnectorPopup(popup, window, controller.signal)
      if (result.kind !== 'message' || result.attemptId !== attemptId) {
        // Closed, timed out or foreign: cancel our open attempt so the waiting job records it; never "connected".
        await cancelConnectorAuthorizationAttempt(attemptId).catch(() => undefined)
        setFlow({ phase: 'error', reason: 'closed' })
        return
      }
      const attempt = await getConnectorAuthorizationAttempt(attemptId)
      if (attempt.status === 'awaiting_resource_selection') {
        await loadCandidates(attempt)
        return
      }
      if (attempt.status === 'completed') {
        setFlow({ phase: 'done', connectionId: attempt.connection_id, attemptId })
        return
      }
      setFlow({ phase: 'error', reason: attempt.status === 'cancelled' ? 'closed' : 'failed' })
    } catch {
      if (!popup.closed) popup.close()
      if (attemptId) await cancelConnectorAuthorizationAttempt(attemptId).catch(() => undefined)
      setFlow({ phase: 'error', reason: 'failed' })
    }
  }, [loadCandidates])

  /** Completes the attempt with the picked resource; returns the connection (null when it did not complete). */
  const select = React.useCallback(async (candidate: ConnectorResourceCandidate): Promise<{ connectionId: string } | null> => {
    if (flow.phase !== 'select' || !flow.attempt.connection_id) return null
    const { attempt } = flow
    setFlow({ phase: 'finishing' })
    try {
      const result = await selectConnectorResources(attempt.connection_id!, {
        attemptId: attempt.attempt_id,
        resources: [{ resource_kind: candidate.resource_kind, resource_id: candidate.resource_id }],
      })
      setFlow({ phase: 'done', connectionId: result.connection_id, attemptId: attempt.attempt_id })
      return { connectionId: result.connection_id }
    } catch {
      setFlow({ phase: 'error', reason: 'failed' })
      return null
    }
  }, [flow])

  const cancel = React.useCallback(async () => {
    if (flow.phase === 'select') await cancelConnectorAuthorizationAttempt(flow.attempt.attempt_id).catch(() => undefined)
    abortRef.current?.abort()
    setFlow({ phase: 'idle' })
  }, [flow])

  const reset = React.useCallback(() => setFlow({ phase: 'idle' }), [])

  return { flow, start, select, cancel, reset }
}

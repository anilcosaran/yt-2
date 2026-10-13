'use client'

/**
 * OAuth popup for Connector authorization attempts (MIMARI §3). The popup message carries only the opaque
 * attempt id and a coarse outcome; the caller reads the real state from the authenticated attempt endpoint.
 * A message is accepted only from this origin and from the popup window we opened. A blocked popup starts
 * nothing; a closed popup is reported as `closed` (never as a successful connection).
 */

export const CONNECTOR_OAUTH_MESSAGE_TYPE = 'youtorch.connector_oauth_result'
export const CONNECTOR_OAUTH_RESULT_PATH = '/connector-oauth/result'

export type ConnectorPopupResult =
  | { kind: 'message'; attemptId: string | null; outcome: string }
  | { kind: 'closed' }
  | { kind: 'timeout' }

const POPUP_FEATURES = 'popup=yes,width=520,height=720'
const POPUP_POLL_MS = 500
const POPUP_TIMEOUT_MS = 10 * 60_000

/**
 * Opens an empty popup synchronously (inside the click handler, so the browser does not block it). Returns null
 * when the browser blocked it; the caller must not start an attempt then.
 */
export function openConnectorPopup(win: Window = window): Window | null {
  try {
    return win.open('about:blank', 'youtorch-connector-oauth', POPUP_FEATURES)
  } catch {
    return null
  }
}

export function readConnectorOAuthMessage(event: MessageEvent, expected: { origin: string; source: Window | null }): { attemptId: string | null; outcome: string } | null {
  if (event.origin !== expected.origin) return null
  if (!expected.source || event.source !== expected.source) return null
  const data = event.data as unknown
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (record.type !== CONNECTOR_OAUTH_MESSAGE_TYPE) return null
  const outcome = typeof record.outcome === 'string' ? record.outcome.slice(0, 64) : 'failed'
  const attemptId = typeof record.attempt_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,63}$/.test(record.attempt_id)
    ? record.attempt_id
    : null
  return { attemptId, outcome }
}

/** Waits for the result page's message, the popup closing, or a bound; always cleans up its listeners. */
export function waitForConnectorPopup(popup: Window, win: Window = window, signal?: AbortSignal): Promise<ConnectorPopupResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ConnectorPopupResult) => {
      if (settled) return
      settled = true
      win.removeEventListener('message', onMessage)
      win.clearInterval(poll)
      win.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const onMessage = (event: MessageEvent) => {
      const message = readConnectorOAuthMessage(event, { origin: win.location.origin, source: popup })
      if (message) finish({ kind: 'message', ...message })
    }
    const onAbort = () => finish({ kind: 'closed' })
    win.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort)
    const poll = win.setInterval(() => {
      if (popup.closed) finish({ kind: 'closed' })
    }, POPUP_POLL_MS)
    const timeout = win.setTimeout(() => finish({ kind: 'timeout' }), POPUP_TIMEOUT_MS)
  })
}

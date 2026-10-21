import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'

import { decodeComposerClipboard, encodeComposerClipboard, type ComposerState } from './composer-state'
import { COMPOSER_DEFAULT_MODE, isComposerMode, type ComposerMode } from './composer-mode'

/**
 * A new chat started outside the Chat (the new tab's composer): what was written there and how it was set up, handed
 * to `/chat?new=<intentId>`, which restores it into its own composer and sends it as the conversation's first
 * message. It lives in this tab's session storage under the new chat's intent id, is read once, and is cleared with
 * the browser principal (`SENSITIVE_PREFIXES`). Chips keep their exact refs through the composer clipboard encoding.
 * Without session storage it stays in this page's memory, which a client-side navigation keeps.
 */

export const NEW_CHAT_HANDOFF_PREFIX = 'youtorch:new-chat-handoff:'

const VERSION = 1
const MAX_ASSETS = 32

const unstored = new Map<string, string>()
registerBrowserPrincipalLifecycleResetter(() => unstored.clear())

export type NewChatHandoff = {
  state: ComposerState
  /** The attached files, in the composer's own shape; the composer checks each one when it restores them. */
  assets: readonly unknown[]
  /** `asset id → image1`: the names the text's `@image1` tokens use. */
  assetLabels: Readonly<Record<string, string>>
  /** The composer's settings (models, output, duration, canvas); checked by the composer. */
  settings: unknown
  mode: { mode: ComposerMode; consentId: string | null }
  /** The "Adet" pick (QA-078), null when none was made. */
  outputCount: number | null
}

export function newChatHandoffKey(intentId: string) {
  return `${NEW_CHAT_HANDOFF_PREFIX}${intentId}`
}

/** Stores the handoff for the new chat `intentId` (in memory when the browser keeps no session storage). */
export function writeNewChatHandoff(intentId: string, handoff: NewChatHandoff) {
  const payload = JSON.stringify({
    v: VERSION,
    text: handoff.state.text,
    chips: encodeComposerClipboard(handoff.state.chips).json,
    assets: handoff.assets.slice(0, MAX_ASSETS),
    assetLabels: handoff.assetLabels,
    settings: handoff.settings,
    mode: handoff.mode,
    outputCount: handoff.outputCount,
  })
  const key = newChatHandoffKey(intentId)
  try {
    window.sessionStorage.setItem(key, payload)
  } catch {
    unstored.set(key, payload)
  }
}

/** Reads the handoff of the new chat `intentId` once (it is removed); null when there is none or it is unreadable. */
export function takeNewChatHandoff(intentId: string): NewChatHandoff | null {
  const key = newChatHandoffKey(intentId)
  let raw = unstored.get(key) ?? null
  unstored.delete(key)
  try {
    const stored = window.sessionStorage.getItem(key)
    if (stored !== null) {
      window.sessionStorage.removeItem(key)
      raw = stored
    }
  } catch {
    // No session storage: only the in-memory copy can be there.
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const record = readRecord(parsed)
  if (!record || record.v !== VERSION || typeof record.text !== 'string') return null
  const mode = readRecord(record.mode)
  const labels = readRecord(record.assetLabels) ?? {}
  return {
    state: { text: record.text, chips: typeof record.chips === 'string' ? decodeComposerClipboard(record.chips) : [] },
    assets: Array.isArray(record.assets) ? record.assets.slice(0, MAX_ASSETS) : [],
    assetLabels: Object.fromEntries(Object.entries(labels).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    settings: record.settings ?? null,
    mode: mode && isComposerMode(mode.mode)
      ? { mode: mode.mode, consentId: typeof mode.consentId === 'string' ? mode.consentId : null }
      : { mode: COMPOSER_DEFAULT_MODE, consentId: null },
    outputCount: typeof record.outputCount === 'number' && Number.isSafeInteger(record.outputCount) && record.outputCount > 0
      ? record.outputCount
      : null,
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

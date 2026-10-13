import { stableClientFingerprint, type ClientKeyValueStorage } from '@/lib/idempotency/client-mutation-control'
import { resetGatewayAuthTransport } from '@/lib/gateway/client'

export const BROWSER_PRINCIPAL_STORAGE_KEY = 'youtorch:browser-principal:v1'
export const BROWSER_PRINCIPAL_CHANGED_EVENT = 'youtorch:browser-principal-changed'
const principalLifecycleResetters = new Set<() => void>()
let volatilePrincipal: string | null = null
const SENSITIVE_EXACT_KEYS = new Set([
  'youtorch.activeChannelId',
  'youtorch:account-plan-sync',
  'youtorch:workspace-drafts',
  'youtorch:offer-redeem-intents:v1',
  'youtorch:pending-offer-purchase-sync',
  'youtorch:onboarding-assignment-refresh',
])
const SENSITIVE_PREFIXES = [
  'youtorch:flow-',
  'youtorch:memory-',
  'youtorch:review-',
  'youtorch:tool-',
  'youtorch:transcript-',
  'youtorch:workflow-',
  'youtorch:youtube-',
  'youtorch:storage-upload',
  'youtorch:tus-',
  'youtorch:recording-',
  'youtorch:voice:',
  'youtorch.brand-kits',
  'youtorch.avatar.recording-draft',
]

type BrowserStorage = ClientKeyValueStorage & { key(index: number): string | null; readonly length: number }

export function getBrowserPrincipalScope(profile: { email?: string | null } | null | undefined) {
  const email = profile?.email?.trim().toLowerCase()
  return email ? stableClientFingerprint({ email }) : null
}

export function bindBrowserPrincipal(
  principal: string,
  stores: { local?: BrowserStorage | null; session?: BrowserStorage | null } = {},
) {
  const local = stores.local === undefined ? resolveStorage('localStorage') : stores.local
  const session = stores.session === undefined ? resolveStorage('sessionStorage') : stores.session
  const markerStorage = local ?? session
  const previous = markerStorage
    ? safeGet(markerStorage, BROWSER_PRINCIPAL_STORAGE_KEY) ?? volatilePrincipal
    : volatilePrincipal
  if (previous !== principal) {
    if (previous) resetGatewayAuthTransport()
    clearPrincipalSensitiveStorage({ local, session })
    notifyPrincipalLifecycleResetters()
  }
  volatilePrincipal = principal
  try {
    markerStorage?.setItem(BROWSER_PRINCIPAL_STORAGE_KEY, principal)
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
  if (previous !== principal && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROWSER_PRINCIPAL_CHANGED_EVENT, { detail: principal }))
  }
}

export function readBrowserPrincipalScope(storage?: BrowserStorage | null) {
  const markerStorage = storage === undefined
    ? resolveStorage('localStorage') ?? resolveStorage('sessionStorage')
    : storage
  return markerStorage ? safeGet(markerStorage, BROWSER_PRINCIPAL_STORAGE_KEY) ?? volatilePrincipal : volatilePrincipal
}

export function clearBrowserPrincipalState(
  stores: { local?: BrowserStorage | null; session?: BrowserStorage | null } = {},
) {
  const local = stores.local === undefined ? resolveStorage('localStorage') : stores.local
  const session = stores.session === undefined ? resolveStorage('sessionStorage') : stores.session
  resetGatewayAuthTransport()
  clearPrincipalSensitiveStorage({ local, session })
  notifyPrincipalLifecycleResetters()
  volatilePrincipal = null
  for (const storage of new Set([local, session])) {
    try {
      storage?.removeItem?.(BROWSER_PRINCIPAL_STORAGE_KEY)
    } catch {
      // Best-effort marker cleanup.
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROWSER_PRINCIPAL_CHANGED_EVENT, { detail: null }))
  }
}

export function clearBrowserPrincipalSessionState(storage?: BrowserStorage | null) {
  const session = storage === undefined ? resolveStorage('sessionStorage') : storage
  clearPrincipalSensitiveStorage({ local: null, session })
  notifyPrincipalLifecycleResetters()
  volatilePrincipal = null
}

export function registerBrowserPrincipalLifecycleResetter(resetter: () => void) {
  principalLifecycleResetters.add(resetter)
  return () => {
    principalLifecycleResetters.delete(resetter)
  }
}

function notifyPrincipalLifecycleResetters() {
  for (const reset of principalLifecycleResetters) {
    try {
      reset()
    } catch {
      // One consumer must not prevent the remaining principal state from being revoked.
    }
  }
}

function clearPrincipalSensitiveStorage(stores: { local: BrowserStorage | null; session: BrowserStorage | null }) {
  for (const storage of [stores.local, stores.session]) {
    if (!storage) continue
    for (const key of listStorageKeys(storage)) {
      if (!isPrincipalSensitiveKey(key)) continue
      try {
        storage.removeItem?.(key)
      } catch {
        // Continue clearing the remaining keys.
      }
    }
  }
}

function isPrincipalSensitiveKey(key: string) {
  return SENSITIVE_EXACT_KEYS.has(key) || SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function listStorageKeys(storage: BrowserStorage) {
  const keys: string[] = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key) keys.push(key)
    }
  } catch {
    return keys
  }
  return keys
}

function safeGet(storage: BrowserStorage, key: string) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function resolveStorage(name: 'localStorage' | 'sessionStorage'): BrowserStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window[name]
  } catch {
    return null
  }
}

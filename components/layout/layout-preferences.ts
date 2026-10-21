export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'youtorch.sidebar.collapsed.new-theme'
export const SIDEBAR_COLLAPSED_EVENT = 'youtorch.sidebar.collapsed.change'
export const SIDEBAR_WIDTH_STORAGE_KEY = 'youtorch.sidebar.width.new-theme'
export const SIDEBAR_DEFAULT_WIDTH = 304
export const SIDEBAR_MIN_WIDTH = 240
export const SIDEBAR_MAX_WIDTH = 420
export const INVITE_EARN_HIDDEN_STORAGE_KEY = 'youtorch.sidebar.inviteEarn.hidden'
export const INVITE_EARN_HIDDEN_EVENT = 'youtorch.sidebar.inviteEarn.hidden.change'

/** Storage can be missing or blocked (private windows, blocked site data): the shell then keeps its defaults. */
export function readStoredPreference(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function storePreference(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Not remembered in this browser; the choice still holds until the page reloads.
  }
}

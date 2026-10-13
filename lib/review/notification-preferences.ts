export const INBOX_NOTIFICATION_SOUND_STORAGE_KEY = 'youtorch:inbox-notification-sound'
export const INBOX_NOTIFICATION_SOUND_CHANGED_EVENT = 'youtorch:inbox-notification-sound-changed'

export function readInboxNotificationSoundEnabled() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(INBOX_NOTIFICATION_SOUND_STORAGE_KEY) !== 'false'
}

export function writeInboxNotificationSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(INBOX_NOTIFICATION_SOUND_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new CustomEvent<boolean>(INBOX_NOTIFICATION_SOUND_CHANGED_EVENT, { detail: enabled }))
}

import { RecordingSession } from './recording-session'

/**
 * One recorder session per project, kept outside React so a take survives the drawer being closed or another tool being
 * opened (live capture is released with the drawer; see `RecordingSession.releaseDevices`). Only one session is kept: the
 * editor of another project replaces it (the old editor is gone) once the take it holds has finished uploading into "Recordings"
 * (T1R-10: nothing a user recorded is dropped by switching project), and the page going away releases every device.
 */
let current: { projectId: string; session: RecordingSession } | null = null
let pageHideInstalled = false

function installPageHide(): void {
  if (pageHideInstalled || typeof window === 'undefined') return
  pageHideInstalled = true
  // A page that goes away (tab closed, navigation) must not leave the camera or the screen share on.
  window.addEventListener('pagehide', () => current?.session.releaseDevices())
}

export function recordingSessionFor(projectId: string, create: () => RecordingSession = () => new RecordingSession()): RecordingSession {
  installPageHide()
  if (current?.projectId === projectId) return current.session
  current?.session.disposeWhenIdle()
  current = { projectId, session: create() }
  return current.session
}

/** Drops the kept session (tests, and "sign out"). */
export function resetRecordingSessions(): void {
  current?.session.dispose()
  current = null
}

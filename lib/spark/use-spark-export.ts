'use client'

import * as React from 'react'

import { createSparkExportSession, type SparkExportSession, type SparkExportState } from './export-session'

/**
 * Y1-07 W10: the export session of one editor page. Created once per project; the session (and a running export) survives
 * the dialog being closed and reopened, and its timers stop with the page.
 */
export function useSparkExport(projectId: string): { session: SparkExportSession; state: SparkExportState } {
  const [session] = React.useState(() => createSparkExportSession({ projectId }))
  React.useEffect(() => () => session.dispose(), [session])
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  return { session, state }
}

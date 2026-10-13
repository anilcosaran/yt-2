'use client'

import * as React from 'react'

import { createSparkPreviewStore, type SparkPreviewState, type SparkPreviewStore } from './preview-store'

/**
 * Y1-07: one preview store per opened project, re-synced whenever the session's working copy version changes.
 * `workingCopyVersion` is `null` until the working copy is loaded (nothing is read before then).
 */
export function useSparkPreview(
  projectId: string,
  workingCopyVersion: number | null,
  options: { createStore?: (projectId: string) => SparkPreviewStore } = {},
): { store: SparkPreviewStore; state: SparkPreviewState } {
  const createStore = options.createStore
  const [store] = React.useState(() => (createStore ? createStore(projectId) : createSparkPreviewStore({ projectId })))
  React.useEffect(() => () => store.dispose(), [store])
  React.useEffect(() => {
    if (workingCopyVersion !== null) void store.sync(workingCopyVersion)
  }, [store, workingCopyVersion])
  const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return { store, state }
}

'use client'

import * as React from 'react'

import type { SparkCompositionState } from '@/lib/spark/composition-session'

/**
 * E1-N: with optimistic writes an edit lives in the editor's memory until the server has it. Closing the tab or leaving the
 * page in that window (a change on its way, or one that could not be sent) would lose it, so the browser asks first. The
 * server is still the only place anything is kept: this never stores a thing, it only warns.
 */
export function hasUnsavedEdits(state: Pick<SparkCompositionState, 'optimistic' | 'pendingWrites' | 'saveState'>): boolean {
  return state.saveState === 'error' || (state.optimistic === true && (state.pendingWrites ?? 0) > 0)
}

export function useUnsavedEditsWarning(unsaved: boolean): void {
  React.useEffect(() => {
    if (!unsaved) return undefined
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])
}

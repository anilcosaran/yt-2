'use client'

import * as React from 'react'

import { historyShortcutOf } from '@/lib/spark/history/history-shortcuts'

/**
 * Binds the editor's undo / redo keys to the window (`historyShortcutOf`). A history key is always taken from the page (the
 * browser has nothing to undo outside a field), so it never reaches the browser; it acts only when the editor may write, and
 * redo only with `redo` (`SPARK_REDO_ENABLED`; off, the key is left alone and the canvas says "soon" as before).
 */
export function useHistoryShortcuts(input: { canWrite: boolean; redo: boolean; onUndo: () => void; onRedo: () => void }): void {
  const latest = React.useRef(input)
  React.useLayoutEffect(() => {
    latest.current = input
  })
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = historyShortcutOf(event)
      if (!shortcut) return
      const { canWrite, redo, onUndo, onRedo } = latest.current
      if (shortcut === 'redo' && !redo) return
      event.preventDefault()
      if (!canWrite) return
      if (shortcut === 'undo') onUndo()
      else onRedo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

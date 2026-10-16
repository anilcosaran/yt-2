'use client'

import * as React from 'react'

/** What a card on the board can ask the editor for. */
export type CanvasBoardActions = {
  boardId: string
  /** A work card opens in its popup; a note starts editing in place. */
  openNode: (nodeId: string) => void
  runNode: (nodeId: string) => void
  /** The note being written in, if any. */
  editingNoteId: string | null
  stopEditingNote: () => void
}

export const CanvasBoardContext = React.createContext<CanvasBoardActions | null>(null)

export function useCanvasBoard() {
  const value = React.useContext(CanvasBoardContext)
  if (!value) throw new Error('useCanvasBoard is used outside a canvas board')
  return value
}

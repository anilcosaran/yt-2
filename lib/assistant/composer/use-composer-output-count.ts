'use client'

import * as React from 'react'

import { resolveComposerOutputCount, type ComposerOutputCountView } from './composer-output-count'

export type ComposerOutputCountControl = ComposerOutputCountView & {
  /** The user's explicit pick in this composer context (null: none). */
  pick: number | null
  select: (count: number) => void
  /** Clears the pick after a send; `restore(previous)` puts it back when the send failed. */
  restore: (count: number | null) => void
  /** The state for exactly the text being sent. */
  resolveFor: (text: string) => ComposerOutputCountView
}

/**
 * QA-078 composer "Adet" state (memory only, never browser storage). The pick belongs to one composer context (another
 * conversation starts at the default again) and to one message: the host clears it after a send, like the chips.
 */
export function useComposerOutputCount(input: {
  contextKey: string
  text: string
  modelMax: number | null
}): ComposerOutputCountControl {
  const { contextKey, modelMax, text } = input
  const [state, setState] = React.useState<{ key: string; count: number } | null>(null)
  const pick = state?.key === contextKey ? state.count : null
  const view = React.useMemo(() => resolveComposerOutputCount({ pick, text, modelMax }), [modelMax, pick, text])
  const select = React.useCallback((count: number) => setState({ key: contextKey, count }), [contextKey])
  const restore = React.useCallback(
    (count: number | null) => setState(count === null ? null : { key: contextKey, count }),
    [contextKey],
  )
  const resolveFor = React.useCallback(
    (value: string) => resolveComposerOutputCount({ pick, text: value, modelMax }),
    [modelMax, pick],
  )
  return { ...view, pick, select, restore, resolveFor }
}

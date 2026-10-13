'use client'

import * as React from 'react'

import {
  addComposerChips,
  commitComposerEdit,
  COMPOSER_CLIPBOARD_MIME,
  createComposerHistory,
  decodeComposerClipboard,
  encodeComposerClipboard,
  redoComposerEdit,
  relabelComposerChips,
  removeComposerChip,
  undoComposerEdit,
  type ComposerChip,
  type ComposerHistory,
  type ComposerState,
} from './composer-state'
import { detectComposerTrigger, removeTriggerText, type ComposerTrigger } from './composer-trigger'
import { composerMenuKeyAction, type ComposerMenuStop, type ComposerMenuSwitchStop } from './composer-menu-stops'
import { applyTemplateInsert, type ComposerTemplateInsertAction } from './composer-menu-templates'

/**
 * P03-01 shared composer hook (Dashboard Chat and Spark Chat). It owns text + typed chips with one undo history,
 * derives the slash/mention trigger from the caret, and handles menu keys, paste and undo. Selecting a menu item only
 * adds a chip — the hook never calls a server. The host renders the menu groups for the current trigger and sends
 * the normalized submission (`buildComposerSubmission`).
 */

export type TypedComposerMenuItem = {
  id: string
  group: string
  label: string
  description: string
  /** A command item adds this chip. */
  chip?: ComposerChip
  /** QA-172: a template item inserts text instead (the host renders it; nothing is sent). */
  insert?: ComposerTemplateInsertAction
}

/** QA-172: the `/query` token a template replaces (checked again when the rendered text arrives). */
export type TypedComposerTriggerRange = { start: number; end: number; token: string }

export type TypedComposerMenuGroup = { id: string; items: TypedComposerMenuItem[] }

type HistoryAction =
  | { type: 'edit'; next: (present: ComposerState) => ComposerState; coalesce?: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; state?: ComposerState }
  | { type: 'relabel'; labelFor: (chip: ComposerChip) => string | null }

function historyReducer(history: ComposerHistory, action: HistoryAction): ComposerHistory {
  switch (action.type) {
    case 'edit': {
      const next = action.next(history.present)
      if (next === history.present) return history
      // Typing coalesces per word, so undo steps back word by word instead of erasing the whole message.
      const coalesceKey = action.coalesce ? `typing:${next.text.split(/\s+/u).length}` : null
      return commitComposerEdit(history, next, { coalesceKey })
    }
    case 'undo':
      return undoComposerEdit(history)
    case 'redo':
      return redoComposerEdit(history)
    case 'reset':
      return createComposerHistory(action.state)
    case 'relabel': {
      // Display-only refresh (P03-02 rename/reconnect): never an undo step and never a ref change.
      const present = relabelComposerChips(history.present, action.labelFor)
      return present === history.present ? history : { ...history, present }
    }
  }
}

export type TypedComposer = ReturnType<typeof useTypedComposer>

/** The text token of a mention chip: `@` plus its label without spaces (`@Ece_Avatar`). */
export function composerMentionToken(label: string) {
  return `@${label.trim().replace(/\s+/gu, '_')}`
}

function replaceTriggerWithToken(text: string, trigger: ComposerTrigger, token: string): { text: string; caret: number } {
  const head = text.slice(0, trigger.start)
  const tail = text.slice(trigger.end).replace(/^ /u, '')
  const inserted = `${token} `
  return { text: `${head}${inserted}${tail}`, caret: head.length + inserted.length }
}

export function useTypedComposer(options: {
  /** Changing context (another conversation/channel) clears chips; the typed text stays. */
  resetKey: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /**
   * QA-172: a template item was chosen; the host renders it (after a form for required arguments) and calls
   * `insertText` with the result. Absent: template items do nothing.
   */
  onInsertAction?: (
    action: ComposerTemplateInsertAction,
    range: TypedComposerTriggerRange,
    insertText: (range: TypedComposerTriggerRange, text: string) => void,
  ) => void
  /**
   * A picked `@` resource also stays in the text as its token (`@image1`, `@Ece_Avatar`) where the `@query` was,
   * so the message reads naturally; the chip still carries the exact ref. Off: the `@query` text is removed.
   */
  mentionTokens?: boolean
}) {
  const { textareaRef, onInsertAction, mentionTokens = false } = options
  const [history, dispatch] = React.useReducer(historyReducer, undefined, () => createComposerHistory())
  const [caret, setCaret] = React.useState(0)
  const [activeEntry, setActiveEntry] = React.useState<{ key: string | null; index: number }>({ key: null, index: 0 })
  const [dismissedTriggerKey, setDismissedTriggerKey] = React.useState<string | null>(null)
  const [rejectedChips, setRejectedChips] = React.useState<ComposerChip[]>([])
  const resetKeyRef = React.useRef(options.resetKey)
  const pendingCaretRef = React.useRef<number | null>(null)
  const state = history.present

  React.useEffect(() => {
    if (resetKeyRef.current === options.resetKey) return
    resetKeyRef.current = options.resetKey
    dispatch({ type: 'edit', next: (present) => (present.chips.length > 0 ? { ...present, chips: [] } : present) })
  }, [options.resetKey])

  // Caret moves requested by an edit (menu selection, undo) apply after React committed the new text.
  React.useLayoutEffect(() => {
    const position = pendingCaretRef.current
    const element = textareaRef.current
    if (position === null || !element) return
    pendingCaretRef.current = null
    element.focus()
    element.setSelectionRange(position, position)
    setCaret(position)
  }, [state, textareaRef])

  const detected = React.useMemo(() => detectComposerTrigger(state.text, caret), [caret, state.text])
  const triggerKey = detected ? `${detected.kind}:${detected.start}:${detected.query}` : null
  const trigger: ComposerTrigger | null = detected && triggerKey !== dismissedTriggerKey ? detected : null

  // The highlighted menu row belongs to one trigger; a new query starts again at the first row.
  const activeExplicit = activeEntry.key === triggerKey
  const activeIndex = activeExplicit ? activeEntry.index : 0

  const setText = React.useCallback((next: string | ((current: string) => string), editOptions: { coalesce?: boolean } = {}) => {
    dispatch({
      type: 'edit',
      coalesce: editOptions.coalesce ?? false,
      next: (present) => {
        const value = typeof next === 'function' ? next(present.text) : next
        return value === present.text ? present : { ...present, text: value }
      },
    })
  }, [])

  const addChips = React.useCallback((chips: readonly ComposerChip[]) => {
    dispatch({ type: 'edit', next: (present) => addComposerChips(present, chips).state })
    setRejectedChips(addComposerChips(state, chips).rejected)
  }, [state])

  const removeChip = React.useCallback((key: string) => {
    dispatch({ type: 'edit', next: (present) => removeComposerChip(present, key) })
  }, [])

  const reset = React.useCallback((next?: ComposerState) => {
    dispatch({ type: 'reset', state: next })
    setDismissedTriggerKey(null)
    setRejectedChips([])
  }, [])

  // QA-172: the text the next insert is computed from (committed text; the caret lands after the insert).
  const latestTextRef = React.useRef(state.text)
  React.useLayoutEffect(() => {
    latestTextRef.current = state.text
  }, [state.text])

  /** Replaces the `/query` token (or, if it changed meanwhile, the caret position) with `text` as one undo step. */
  const insertText = React.useCallback((range: TypedComposerTriggerRange, text: string) => {
    const base = latestTextRef.current
    const result = applyTemplateInsert(base, range, text, caret)
    // One non-coalesced edit: a single undo brings the `/query` token back.
    dispatch({ type: 'edit', next: (present) => (present.text === base ? { ...present, text: result.text } : present) })
    pendingCaretRef.current = result.caret
  }, [caret])

  const selectMenuItem = React.useCallback((item: TypedComposerMenuItem) => {
    if (!trigger) return
    if (item.insert) {
      // QA-172: the menu closes; the host inserts the rendered template text later (nothing is sent).
      setDismissedTriggerKey(triggerKey)
      onInsertAction?.(item.insert, { start: trigger.start, end: trigger.end, token: state.text.slice(trigger.start, trigger.end) }, insertText)
      return
    }
    if (!item.chip) return
    const chip = item.chip
    const removed = mentionTokens && chip.kind === 'mention'
      ? replaceTriggerWithToken(state.text, trigger, composerMentionToken(chip.label))
      : removeTriggerText(state.text, trigger)
    dispatch({ type: 'edit', next: (present) => addComposerChips({ ...present, text: removed.text }, [chip]).state })
    setRejectedChips(addComposerChips({ ...state, text: removed.text }, [chip]).rejected)
    pendingCaretRef.current = removed.caret
  }, [insertText, mentionTokens, onInsertAction, state, trigger, triggerKey])

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value, { coalesce: true })
    setCaret(event.target.selectionStart ?? event.target.value.length)
  }, [setText])

  const handleSelect = React.useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(event.currentTarget.selectionStart ?? 0)
  }, [])

  /**
   * Returns true when the key was consumed by the menu or the undo history. `menuItems` are the menu's keyboard stops
   * in display order; QA-140: a connection header row is a stop too — Space turns its switch (`onToggleSwitch`),
   * Enter/Tab on it do nothing.
   */
  const handleKeyDown = React.useCallback((
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    menuItems: readonly ComposerMenuStop[],
    menuOptions: { onToggleSwitch?: (stop: ComposerMenuSwitchStop) => void } = {},
  ) => {
    if (trigger) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedTriggerKey(triggerKey)
        return true
      }
      const action = composerMenuKeyAction(menuItems, activeIndex, activeExplicit, event)
      if (action) {
        event.preventDefault()
        if (action.kind === 'move') setActiveEntry({ key: triggerKey, index: action.index })
        else if (action.kind === 'select') selectMenuItem(action.item)
        else if (action.kind === 'toggle') menuOptions.onToggleSwitch?.(action.stop)
        // `consume`: a header row is not an item — nothing is selected and the message is not sent.
        return true
      }
    }
    const modifier = event.metaKey || event.ctrlKey
    if (modifier && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
      event.preventDefault()
      dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
      pendingCaretRef.current = null
      return true
    }
    if (modifier && !event.altKey && (event.key === 'y' || event.key === 'Y')) {
      event.preventDefault()
      dispatch({ type: 'redo' })
      return true
    }
    // Backspace at the very start removes the last chip (same chip object; undo restores it).
    if (event.key === 'Backspace' && !modifier) {
      const element = event.currentTarget
      if (element.selectionStart === 0 && element.selectionEnd === 0 && state.chips.length > 0) {
        event.preventDefault()
        removeChip(state.chips[state.chips.length - 1]!.key)
        return true
      }
    }
    return false
  }, [activeExplicit, activeIndex, removeChip, selectMenuItem, state.chips, trigger, triggerKey])

  /** Pasting copied chips restores their exact refs; plain pasted text stays text (never resolved by label). */
  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const payload = event.clipboardData?.getData(COMPOSER_CLIPBOARD_MIME)
    if (!payload) return false
    const chips = decodeComposerClipboard(payload)
    if (chips.length === 0) return false
    event.preventDefault()
    addChips(chips)
    return true
  }, [addChips])

  const copyChips = React.useCallback((event: React.ClipboardEvent, chips: readonly ComposerChip[]) => {
    if (chips.length === 0 || !event.clipboardData) return
    const encoded = encodeComposerClipboard(chips)
    event.preventDefault()
    event.clipboardData.setData(COMPOSER_CLIPBOARD_MIME, encoded.json)
    event.clipboardData.setData('text/plain', encoded.text)
  }, [])

  return {
    state,
    text: state.text,
    chips: state.chips,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    trigger,
    activeIndex,
    /** The user moved the highlight for this trigger (otherwise it rests on the first selectable item). */
    activeExplicit,
    rejectedChips,
    setText,
    addChips,
    removeChip,
    reset,
    selectMenuItem,
    insertText,
    handleChange,
    handleSelect,
    handleKeyDown,
    handlePaste,
    copyChips,
    relabel: React.useCallback((labelFor: (chip: ComposerChip) => string | null) => dispatch({ type: 'relabel', labelFor }), []),
    undo: React.useCallback(() => dispatch({ type: 'undo' }), []),
    redo: React.useCallback(() => dispatch({ type: 'redo' }), []),
  }
}

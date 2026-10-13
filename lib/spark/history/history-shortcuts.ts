/**
 * The editor's undo / redo keys (the design's shortcuts): Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. Alt
 * combinations are not history keys. A key pressed while typing (an input, a textarea, a select or editable text) belongs to
 * the field: the browser's own undo of the text runs there. Pure; `use-history-shortcuts.ts` binds it to the window.
 */
export type HistoryShortcut = 'undo' | 'redo'

export type HistoryKeyEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: EventTarget | null
}

export function historyShortcutOf(event: HistoryKeyEvent): HistoryShortcut | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  const shortcut: HistoryShortcut | null = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' && !event.shiftKey ? 'redo' : null
  if (!shortcut) return null
  return typingTarget(event.target) ? null : shortcut
}

function typingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as { closest?: unknown }).closest !== 'function') return false
  const element = target as unknown as { isContentEditable?: boolean; closest(selector: string): unknown }
  return element.isContentEditable === true || element.closest('input, textarea, select, [contenteditable="true"]') !== null
}

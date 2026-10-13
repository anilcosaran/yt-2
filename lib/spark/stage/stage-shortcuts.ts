/**
 * The canvas keyboard shortcuts the "?" sheet lists (`SPARK_CONTEXT_TOOLBAR_ENABLED`), in the order the sheet shows them. One
 * source for the sheet and its test: every entry is a key the stage controller (`handleKeyDown`) or the editor shell handles,
 * except the ones marked `soon` (shown as not available yet). `mod` is Ctrl, or Cmd on a Mac. Pure data.
 */

export type ShortcutGroup = 'select' | 'edit' | 'move' | 'playback' | 'history'

export type StageShortcut = {
  /** Message key under `Spark.editor.stage.shortcuts.items`. */
  id: string
  group: ShortcutGroup
  /** Alternatives; each one is pressed together (`mod` = Ctrl / Cmd). */
  keys: ReadonlyArray<readonly string[]>
  /** Listed, but not available yet (redo: until `SPARK_REDO_ENABLED`, see `shortcutSoon`). */
  soon?: boolean
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ['select', 'edit', 'move', 'playback', 'history']

export const STAGE_SHORTCUTS: readonly StageShortcut[] = [
  { id: 'deselect', group: 'select', keys: [['Esc']] },
  { id: 'nextLayer', group: 'select', keys: [['Tab'], ['Shift', 'Tab']] },
  { id: 'editText', group: 'edit', keys: [['Enter']] },
  { id: 'delete', group: 'edit', keys: [['Delete'], ['Backspace']] },
  { id: 'duplicate', group: 'edit', keys: [['mod', 'D']] },
  { id: 'copy', group: 'edit', keys: [['mod', 'C']] },
  { id: 'paste', group: 'edit', keys: [['mod', 'V']] },
  // Spark styling round: the selected text's underline and strikethrough (the toolbar's toggles).
  { id: 'underline', group: 'edit', keys: [['mod', 'U']] },
  { id: 'strikethrough', group: 'edit', keys: [['mod', 'Shift', 'X']] },
  { id: 'forward', group: 'edit', keys: [[']'], ['Shift', ']']] },
  { id: 'backward', group: 'edit', keys: [['['], ['Shift', '[']] },
  { id: 'askAi', group: 'edit', keys: [['mod', 'K']] },
  { id: 'nudge', group: 'move', keys: [['←', '↑', '→', '↓']] },
  { id: 'nudgeFar', group: 'move', keys: [['Shift', '←↑→↓']] },
  { id: 'dragAxis', group: 'move', keys: [['Shift', 'drag']] },
  { id: 'dragFree', group: 'move', keys: [['mod', 'drag']] },
  { id: 'resizeCentre', group: 'move', keys: [['Alt', 'drag']] },
  { id: 'play', group: 'playback', keys: [['Space']] },
  { id: 'frame', group: 'playback', keys: [[','], ['.']] },
  { id: 'second', group: 'playback', keys: [['Shift', ','], ['Shift', '.']] },
  { id: 'ends', group: 'playback', keys: [['Home'], ['End']] },
  { id: 'undo', group: 'history', keys: [['mod', 'Z']] },
  { id: 'redo', group: 'history', keys: [['mod', 'Shift', 'Z'], ['mod', 'Y']], soon: true },
  { id: 'sheet', group: 'history', keys: [['?']] },
]

/** Whether the sheet shows the shortcut as not available yet: redo is available once `SPARK_REDO_ENABLED` is on. */
export function shortcutSoon(shortcut: StageShortcut, available: { redo: boolean }): boolean {
  if (shortcut.id === 'redo') return shortcut.soon === true && !available.redo
  return shortcut.soon === true
}

/** Whether the page runs on a Mac (the sheet then shows ⌘ for `mod`). */
export function isMacPlatform(platform: string | undefined = typeof navigator === 'undefined' ? undefined : navigator.platform): boolean {
  return typeof platform === 'string' && /mac|iphone|ipad|ipod/i.test(platform)
}

/** The key cap of one key name (`mod` becomes Ctrl or ⌘). */
export function keyCap(key: string, mac: boolean): string {
  if (key === 'mod') return mac ? '⌘' : 'Ctrl'
  if (key === 'Alt' && mac) return '⌥'
  return key
}

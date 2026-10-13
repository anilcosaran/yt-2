import type { ComposerConnectionSwitchRow } from './composer-menu-connection-switches'
import type { TypedComposerMenuGroup, TypedComposerMenuItem } from './use-typed-composer'

/**
 * QA-140 keyboard of the `/` menu with the QA-126 per-conversation connection switch rows: ↑/↓ walk every row in
 * the order the menu shows it — the selectable items and the connection header rows — Space on a header row turns
 * that connection's switch, Enter on a header row does nothing (it neither selects a tool nor sends the message).
 * The highlight starts on the first selectable item, never on a header, so typing a space after `/` still types.
 */

export type ComposerMenuSwitchStop = {
  kind: 'switch'
  /** Namespaced so it can never equal a menu item id. */
  id: string
  connectionId: string
  label: string
  enabled: boolean
}

export type ComposerMenuStop = TypedComposerMenuItem | ComposerMenuSwitchStop

export function isComposerMenuSwitchStop(stop: ComposerMenuStop | null | undefined): stop is ComposerMenuSwitchStop {
  return Boolean(stop) && (stop as { kind?: unknown }).kind === 'switch'
}

export function composerMenuSwitchStopId(connectionId: string): string {
  return `connection-switch:${connectionId}`
}

/**
 * Every keyboard stop in display order. Without switch rows it is the flattened items (the menu as before); with
 * them the "Connections" group lists, per row, the header then its visible tools, then the tools without a row
 * (the order `ConnectionSwitchRows` renders).
 */
export function buildComposerMenuStops(
  groups: readonly TypedComposerMenuGroup[],
  rows: readonly ComposerConnectionSwitchRow[] | null,
): ComposerMenuStop[] {
  return groups.flatMap((group): ComposerMenuStop[] => {
    if (group.id !== 'connections' || !rows || rows.length === 0) return group.items
    const byId = new Map(group.items.map((item) => [item.id, item] as const))
    const placed = new Set(rows.flatMap((row) => row.itemIds))
    const stops: ComposerMenuStop[] = []
    for (const row of rows) {
      stops.push({ kind: 'switch', id: composerMenuSwitchStopId(row.connectionId), connectionId: row.connectionId, label: row.label, enabled: row.enabled })
      if (!row.enabled) continue
      for (const itemId of row.itemIds) {
        const item = byId.get(itemId)
        if (item) stops.push(item)
      }
    }
    return [...stops, ...group.items.filter((item) => !placed.has(item.id))]
  })
}

/**
 * The highlighted stop: the one the user moved to (clamped), else the first selectable item (a header row only when
 * nothing else is in the menu, e.g. every connection is off).
 */
export function effectiveComposerMenuIndex(stops: readonly ComposerMenuStop[], index: number, explicit: boolean): number {
  if (stops.length === 0) return 0
  if (explicit) return Math.min(Math.max(index, 0), stops.length - 1)
  const first = stops.findIndex((stop) => !isComposerMenuSwitchStop(stop))
  return first === -1 ? 0 : first
}

export type ComposerMenuKeyAction =
  | { kind: 'move'; index: number }
  | { kind: 'select'; item: TypedComposerMenuItem }
  | { kind: 'toggle'; stop: ComposerMenuSwitchStop }
  /** The key belongs to the menu but does nothing (Enter/Tab on a header row). */
  | { kind: 'consume' }

/**
 * What a key does in the open menu (null: not a menu key — e.g. Space on a tool row types a space). ↑/↓ move over
 * every stop; Enter/Tab select the highlighted item; on a header row Space turns its switch and Enter/Tab do nothing.
 */
export function composerMenuKeyAction(
  stops: readonly ComposerMenuStop[],
  index: number,
  explicit: boolean,
  key: { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): ComposerMenuKeyAction | null {
  if (stops.length === 0) return null
  const current = effectiveComposerMenuIndex(stops, index, explicit)
  if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
    const step = key.key === 'ArrowDown' ? 1 : -1
    return { kind: 'move', index: (current + step + stops.length) % stops.length }
  }
  const stop = stops[current]
  const confirm = (key.key === 'Enter' && !key.shiftKey) || key.key === 'Tab'
  if (isComposerMenuSwitchStop(stop)) {
    if (key.key === ' ' && !key.shiftKey && !key.altKey && !key.ctrlKey && !key.metaKey) return { kind: 'toggle', stop }
    return confirm ? { kind: 'consume' } : null
  }
  return confirm && stop ? { kind: 'select', item: stop } : null
}

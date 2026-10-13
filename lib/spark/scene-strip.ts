/**
 * P02-16 scene strip behaviour that needs no new visual element: keyboard reorder/select/delete
 * (SAHNE §8: ←/→ select, Alt+←/→ reorder, Delete with undo), the screen reader label ("Scene 3 of
 * 12, 0:21") and the windowed range of the drawer's scene list (K240: 200 scenes stay bounded).
 * Framework-free so the editor and the tests share it.
 */

export type StripKey = { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }

export type StripAction =
  | { kind: 'select'; sceneId: string }
  | { kind: 'move'; sceneId: string; afterSceneId: string | null }
  | { kind: 'remove'; sceneId: string }

/**
 * The strip action for a key pressed on a focused scene card, or null when the key is not the
 * strip's. `order` is the strip order; `canWrite` gates reorder and delete (viewer, archived).
 */
export function stripKeyAction(order: readonly string[], sceneId: string, key: StripKey, canWrite: boolean): StripAction | null {
  const index = order.indexOf(sceneId)
  if (index < 0 || key.ctrlKey || key.metaKey) return null
  if (key.key === 'ArrowLeft' || key.key === 'ArrowRight') {
    const step = key.key === 'ArrowLeft' ? -1 : 1
    if (key.shiftKey) return null
    if (!key.altKey) {
      const target = order[index + step]
      return target ? { kind: 'select', sceneId: target } : null
    }
    if (!canWrite) return null
    // Alt+←: place before the previous scene; Alt+→: after the next one.
    if (step < 0) {
      if (index === 0) return null
      return { kind: 'move', sceneId, afterSceneId: index >= 2 ? order[index - 2]! : null }
    }
    if (index === order.length - 1) return null
    return { kind: 'move', sceneId, afterSceneId: order[index + 1]! }
  }
  if ((key.key === 'Delete' || key.key === 'Backspace') && !key.altKey && !key.shiftKey) {
    return canWrite ? { kind: 'remove', sceneId } : null
  }
  return null
}

/**
 * Where a dragged scene lands when dropped before/after a target card (drawer list and strip,
 * decision S16): the `after_scene_id` of the single `scene.reorder`, or undefined when the drop
 * moves nothing (onto itself or an unknown card).
 */
export function afterSceneIdForDrop(
  order: readonly string[],
  fromSceneId: string,
  targetSceneId: string,
  after: boolean,
): string | null | undefined {
  if (fromSceneId === targetSceneId || !order.includes(fromSceneId)) return undefined
  const rest = order.filter((id) => id !== fromSceneId)
  const targetIndex = rest.indexOf(targetSceneId)
  if (targetIndex < 0) return undefined
  const afterSceneId = after ? targetSceneId : targetIndex > 0 ? rest[targetIndex - 1]! : null
  // Dropping right next to its own place is not a move.
  const current = order.indexOf(fromSceneId)
  const currentAfter = current > 0 ? order[current - 1]! : null
  return afterSceneId === currentAfter ? undefined : afterSceneId
}

/** Rows of a vertical list to render: [start, end) plus the spacer heights around them. */
export type ListWindow = { start: number; end: number; before: number; after: number }

/**
 * Windowed range of a list of equal-height rows. Without a measured row or viewport (first paint,
 * tests) every row is rendered; otherwise only the rows in view plus `overscan` on each side.
 */
export function listWindow(input: {
  count: number
  rowHeight: number
  scrollTop: number
  viewportHeight: number
  overscan?: number
}): ListWindow {
  const { count, rowHeight, scrollTop, viewportHeight } = input
  const overscan = input.overscan ?? 4
  if (count === 0) return { start: 0, end: 0, before: 0, after: 0 }
  if (!(rowHeight > 0) || !(viewportHeight > 0)) return { start: 0, end: count, before: 0, after: 0 }
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const visible = Math.ceil(viewportHeight / rowHeight) + 1
  const start = Math.max(0, Math.min(count - 1, first - overscan))
  const end = Math.min(count, first + visible + overscan)
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight }
}

/** Scroll position that brings row `index` fully into view (unchanged when it already is). */
export function scrollTopFor(input: { index: number; rowHeight: number; scrollTop: number; viewportHeight: number }): number {
  const top = input.index * input.rowHeight
  const bottom = top + input.rowHeight
  if (top < input.scrollTop) return top
  if (bottom > input.scrollTop + input.viewportHeight) return Math.max(0, bottom - input.viewportHeight)
  return input.scrollTop
}

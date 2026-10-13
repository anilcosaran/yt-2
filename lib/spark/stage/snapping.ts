import type { StageRect } from './stage-types'

/**
 * Snapping guides of a move (D8): the moving box's centre and edges snap to the canvas centre lines and to the safe-area
 * edges (server config from the preview manifest, never hard-coded). The threshold is in SCREEN pixels so the feel does
 * not change with the zoom; it is divided by the frame scale here. Guides are canvas coordinates.
 */

export type SnapGuides = { v: number | null; h: number | null }

export type SnapResult = { dx: number; dy: number; guides: SnapGuides }

export const SNAP_THRESHOLD_SCREEN_PX = 6

type Candidates = Array<[value: number, target: number]>

function snapAxis(candidates: Candidates, threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null
  for (const [value, target] of candidates) {
    const delta = target - value
    if (Math.abs(delta) < threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: target }
  }
  return best
}

/** Offsets that move `box` onto the nearest guides within the threshold, plus the guides to show. */
export function snapMove(
  box: StageRect,
  canvas: { width: number; height: number },
  safeArea: StageRect | null,
  scale: number,
  thresholdScreenPx = SNAP_THRESHOLD_SCREEN_PX,
): SnapResult {
  const threshold = thresholdScreenPx / scale
  const xs: Candidates = [[box.x + box.width / 2, canvas.width / 2]]
  const ys: Candidates = [[box.y + box.height / 2, canvas.height / 2]]
  if (safeArea) {
    xs.push([box.x, safeArea.x], [box.x + box.width, safeArea.x + safeArea.width])
    ys.push([box.y, safeArea.y], [box.y + box.height, safeArea.y + safeArea.height])
  }
  const x = snapAxis(xs, threshold)
  const y = snapAxis(ys, threshold)
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides: { v: x?.at ?? null, h: y?.at ?? null } }
}

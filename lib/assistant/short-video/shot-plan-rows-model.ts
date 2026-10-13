import type { ScriptReviewShot } from '@/lib/assistant/script-review/script-review-api'
import { shotSourceChip, type ShotSourceChip } from '@/lib/assistant/script-review/script-review-model'

/**
 * SV: the shot list of the plan card (pure). One row per shot with the director's pinned source and the server's price; the total
 * adds only what the server priced (an unpriced shot is counted aside, never added as 0). The plan's own estimate (voice-over and
 * every other line included) stays the G1 card's figure; this list is the per-shot part of it.
 */

export interface ShotPlanRow {
  shotId: string
  order: number
  seconds: number
  /** What the viewer sees in this shot (the director's description, else the plan's visual intent). */
  intent: string
  chip: ShotSourceChip | null
}

export interface ShotPlanRowsModel {
  rows: ShotPlanRow[]
  totalSeconds: number
  /** Sum of the credits the server priced for the shots' pinned sources. */
  shotCredits: number
  /** Shots whose source is not priced now (or has no source yet). */
  unpricedShots: number
  draft: boolean
}

export function buildShotPlanRowsModel(input: { shots: readonly ScriptReviewShot[]; mode: 'final' | 'storyboard_draft' }): ShotPlanRowsModel {
  const rows = [...input.shots]
    .sort((left, right) => left.order - right.order)
    .map((shot): ShotPlanRow => ({
      shotId: shot.shot_id,
      order: shot.order,
      seconds: shot.planned_seconds,
      intent: (shot.direction?.intent.description || shot.visual_intent || '').trim(),
      chip: shotSourceChip(shot),
    }))
  let shotCredits = 0
  let unpricedShots = 0
  for (const row of rows) {
    if (row.chip?.cost.kind === 'priced') shotCredits += row.chip.cost.credits
    else if (!row.chip || row.chip.cost.kind === 'not_ready') unpricedShots += 1
  }
  return {
    rows,
    totalSeconds: Math.round(rows.reduce((total, row) => total + row.seconds, 0) * 1000) / 1000,
    shotCredits: Math.round(shotCredits * 10_000) / 10_000,
    unpricedShots,
    draft: input.mode === 'storyboard_draft',
  }
}

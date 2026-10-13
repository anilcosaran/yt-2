import { nearestBoundary, targetBoundary } from '@/lib/spark/effects/transition-browser'
import { TRANSITION_KINDS, type TransitionKind } from '@/lib/spark/scene-transitions'

import type { SparkToolEntry } from '../spark-tool-types'
import { applyTransitionKind } from '../transition-actions'
import { TRANSITION_CARD_KIND, TransitionsToolDrawer } from '../transitions-drawer'

const isTransitionKind = (value: unknown): value is TransitionKind => typeof value === 'string' && (TRANSITION_KINDS as readonly string[]).includes(value)

/**
 * Rail "Transitions" (Spark effects WP1): the Transitions browser. Shown only while the UI pod's
 * `SPARK_TRANSITIONS_BROWSER_ENABLED` is on; it needs the stage (the preview plan says whether the gateway draws
 * transitions, and the cut is played after applying). A card dropped on the timeline lands on the nearest cut, one dropped
 * on the canvas on the selected cut; a card dropped on a chip of the strip is handled by the chip itself.
 */
export const transitionsTool: SparkToolEntry = {
  id: 'transitions',
  icon: 'transition',
  labelKey: 'tools.transitions',
  visible: (ctx) => ctx.effects?.transitionsBrowser === true,
  availability: (ctx) => {
    if (!ctx.stage) return { enabled: false, titleKey: 'comingSoon' }
    if (!ctx.hasScene) return { enabled: false, titleKey: 'stage.needsScene' }
    return { enabled: true }
  },
  Drawer: TransitionsToolDrawer,
  onDrop: async (ctx, drop, target) => {
    if (drop.kind !== 'card' || drop.drag.kind !== TRANSITION_CARD_KIND || !isTransitionKind(drop.drag.data['kind'])) return false
    const document = ctx.latest().workingCopy?.document
    if (!document || !ctx.stageCanWrite) return false
    const boundary = target.kind === 'timeline' ? nearestBoundary(document, target.frame) : targetBoundary(document, ctx.latest().selectedSceneId)
    if (!boundary) return false
    ctx.actions.select(boundary.sceneId)
    return applyTransitionKind(ctx, [boundary.sceneId], drop.drag.data['kind'], { preview: true })
  },
}

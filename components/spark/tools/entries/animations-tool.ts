import { AnimationsToolDrawer } from '../animations-drawer'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Animations" (Spark effects WP2): In / Out / Combo / Effect preset cards for the selected layer. Shown only while the
 * UI pod's `SPARK_ANIMATIONS_PANEL_ENABLED` is on; it needs the stage (the selection and the inspector schema that lists
 * the presets the gateway accepts) and a scene.
 */
export const animationsTool: SparkToolEntry = {
  id: 'animations',
  icon: 'animate',
  labelKey: 'tools.animations',
  visible: (ctx) => ctx.effects?.animationsPanel === true,
  availability: (ctx) => {
    if (!ctx.stage) return { enabled: false, titleKey: 'comingSoon' }
    if (!ctx.hasScene) return { enabled: false, titleKey: 'stage.needsScene' }
    return { enabled: true }
  },
  Drawer: AnimationsToolDrawer,
}

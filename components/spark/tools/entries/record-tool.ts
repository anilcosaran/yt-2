import { RecordToolDrawer } from '../record-drawer'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Record" (E1-F, D7): Screen, Camera, Screen + camera and Voice only. A take is uploaded into the Storage folder
 * "Recordings", bound to the project and inserted at the playhead, so the tool needs the stage (the playhead and the
 * placement live there), a scene to put the take in and the right to write.
 */
export const recordTool: SparkToolEntry = {
  id: 'record',
  icon: 'record',
  labelKey: 'tools.record',
  availability: (ctx) => {
    if (!ctx.stage) return { enabled: false, titleKey: 'comingSoon' }
    if (!ctx.stageCanWrite) return { enabled: false, titleKey: 'readOnly' }
    if (!ctx.hasScene) return { enabled: false, titleKey: 'stage.needsScene' }
    return { enabled: true, titleKey: 'record.title' }
  },
  Drawer: RecordToolDrawer,
}

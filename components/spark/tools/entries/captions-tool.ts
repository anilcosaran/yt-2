import { CaptionsToolDrawer } from '../captions-tool-drawer'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Captions" (E1-G): the drawer turns captions on for a source of the project (the AI narration, a voice-over or an
 * uploaded video: price first, then the transcription), picks one of the four platform looks and turns tracks off. The rail
 * button stays enabled whatever the gateway switch says: with captions closed the drawer says so and still turns existing
 * tracks off.
 */
export const captionsTool: SparkToolEntry = {
  id: 'captions',
  icon: 'captions',
  labelKey: 'tools.captions',
  availability: () => ({ enabled: true }),
  Drawer: CaptionsToolDrawer,
}

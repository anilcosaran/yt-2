import type { CompositionDocument } from '../composition-client'
import { sceneLayerViews } from './document-layers'

/**
 * Selection of the canvas (D3): local view state, never a command and never stored in the browser (K131). Structurally
 * the same as Y1-07's `SparkCanvasSelection`, so the shell hands it to the Ask-AI context unchanged. `layerIds = []`
 * means "the scene as a whole"; `timeRange` is the ruler's marked range (absolute project frames, end exclusive).
 */

export type StageFrameRange = { startFrame: number; endFrame: number }

export type StageSelection = {
  sceneId: string
  layerIds: readonly string[]
  timeRange: StageFrameRange | null
}

const EMPTY: readonly string[] = []

export class StageSelectionStore {
  private selection: StageSelection | null = null
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = (): StageSelection | null => this.selection

  /** Selects one layer of a scene (Stage 1 is single selection; the type already carries more). */
  selectLayer(sceneId: string, layerId: string): void {
    const current = this.selection
    if (current && current.sceneId === sceneId && current.layerIds.length === 1 && current.layerIds[0] === layerId) return
    this.set({ sceneId, layerIds: [layerId], timeRange: current?.timeRange ?? null })
  }

  /** Selects the scene as a whole (no layer). */
  selectScene(sceneId: string): void {
    const current = this.selection
    if (current && current.sceneId === sceneId && current.layerIds.length === 0) return
    this.set({ sceneId, layerIds: EMPTY, timeRange: current?.timeRange ?? null })
  }

  setTimeRange(range: StageFrameRange | null): void {
    const current = this.selection
    if (!current) return
    if (current.timeRange === range || (current.timeRange && range && current.timeRange.startFrame === range.startFrame && current.timeRange.endFrame === range.endFrame)) return
    this.set({ ...current, timeRange: range })
  }

  clear(): void {
    if (this.selection === null) return
    this.set(null)
  }

  /** Drops layers that no longer exist (a deleted layer never stays a silent wrong target) and a vanished scene. */
  prune(document: CompositionDocument | null): void {
    const current = this.selection
    if (!current) return
    if (!document) return
    if (!document.scenes.some((scene) => scene.scene_id === current.sceneId)) {
      this.set(null)
      return
    }
    if (current.layerIds.length === 0) return
    const alive = new Set(sceneLayerViews(document, current.sceneId).map((view) => view.layerId))
    const kept = current.layerIds.filter((id) => alive.has(id))
    if (kept.length === current.layerIds.length) return
    this.set({ ...current, layerIds: kept.length === 0 ? EMPTY : kept })
  }

  private set(next: StageSelection | null): void {
    this.selection = next
    for (const listener of [...this.listeners]) listener()
  }
}

/** The single selected layer, or null (none, several, or the scene as a whole). */
export function singleLayerId(selection: StageSelection | null): string | null {
  return selection && selection.layerIds.length === 1 ? selection.layerIds[0]! : null
}

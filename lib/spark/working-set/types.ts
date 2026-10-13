/**
 * P05-11 normalised project view the working-set planner reads. It is deliberately smaller than the Composition
 * document: time-placed items, the assets they reference and the scenes, with the probe facts a decode estimate
 * needs. An adapter from the document (and from the P02-19 probe/derivative state) is the next slice; the planner
 * and its tests do not depend on the document type.
 */

export type WsAssetKind = 'image' | 'gif' | 'video' | 'audio'

export interface WsAsset {
  readonly assetId: string
  readonly kind: WsAssetKind
  readonly sizeBytes: number
  readonly width?: number
  readonly height?: number
  /** Frames of a GIF or video; 1 for an image. */
  readonly frameCount?: number
  readonly durationSeconds?: number
}

export type WsLayerKind = 'clip' | 'text' | 'shape' | 'motion_instance' | 'overlay' | 'caption'

export interface WsScene {
  readonly sceneId: string
  readonly startFrame: number
  /** Exclusive. */
  readonly endFrame: number
}

export interface WsItem {
  readonly itemId: string
  readonly sceneId: string | null
  readonly startFrame: number
  /** Exclusive. */
  readonly endFrame: number
  readonly layerKind: WsLayerKind
  /** Stacking order inside its scene; a higher value is on top. */
  readonly zIndex: number
  readonly assetId?: string
}

export type WsAudioRole = 'narration' | 'music' | 'sfx'

export interface WsAudioPlacement {
  readonly placementId: string
  readonly role: WsAudioRole
  readonly startFrame: number
  /** Exclusive. */
  readonly endFrame: number
  readonly assetId: string
}

export interface WsProject {
  /** Identity of the document revision; a new value means every cached fact about the project is stale. */
  readonly revision: string
  readonly fps: number
  readonly totalFrames: number
  readonly scenes: readonly WsScene[]
  readonly items: readonly WsItem[]
  readonly audio: readonly WsAudioPlacement[]
  readonly assets: ReadonlyMap<string, WsAsset>
}

import { sceneAtFrame } from './scene-plan'

/**
 * Maps between the playback frame and the scene strip. The strip draws one card per scene (the unresolved ones too, with a
 * dash), the plan holds only scenes with a resolved length, so the mapping goes through the scene id and a fraction inside
 * the card: the playhead sits at `fraction` of the card of the scene the frame is in, and a click or drag at a point of a
 * card seeks to the frame at that fraction of the scene. Pure functions; the shell supplies the cards' measured rectangles.
 */

/** The part of a plan the strip mapping reads (`StagePlan` satisfies it). */
type PlayableScenes = { scenes: ReadonlyArray<{ sceneId: string; startFrame: number; durationFrames: number }> }

export type StripCardRect = { sceneId: string; left: number; right: number }
export type StripTarget = { sceneId: string; fraction: number }

/** The card and the fraction (0 to 1) inside it for a client x; the gaps between cards snap to the nearer card edge. */
export function seekTargetAtX(cards: readonly StripCardRect[], x: number): StripTarget | null {
  const first = cards[0]
  const last = cards[cards.length - 1]
  if (!first || !last) return null
  if (x <= first.left) return { sceneId: first.sceneId, fraction: 0 }
  if (x >= last.right) return { sceneId: last.sceneId, fraction: 1 }
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]!
    if (x >= card.left && x <= card.right) {
      const width = card.right - card.left
      return { sceneId: card.sceneId, fraction: width <= 0 ? 0 : (x - card.left) / width }
    }
    const next = cards[index + 1]
    if (next && x > card.right && x < next.left) {
      return x - card.right < next.left - x ? { sceneId: card.sceneId, fraction: 1 } : { sceneId: next.sceneId, fraction: 0 }
    }
  }
  return null
}

/** The absolute frame at `fraction` of a scene; null when the scene has no resolved length (playback skips it). */
export function frameAtStrip(plan: PlayableScenes, target: StripTarget): number | null {
  const scene = plan.scenes.find((candidate) => candidate.sceneId === target.sceneId)
  if (!scene) return null
  const local = Math.round(Math.min(1, Math.max(0, target.fraction)) * scene.durationFrames)
  return scene.startFrame + Math.min(local, Math.max(0, scene.durationFrames - 1))
}

/** The scene card and the fraction the playhead is at, or null when the plan holds no scene at that frame. */
export function stripPlayhead(plan: PlayableScenes & { totalFrames: number }, frame: number): StripTarget | null {
  const at = sceneAtFrame(plan, frame)
  if (!at) return null
  return { sceneId: at.scene.sceneId, fraction: at.scene.durationFrames <= 0 ? 0 : at.localFrame / at.scene.durationFrames }
}

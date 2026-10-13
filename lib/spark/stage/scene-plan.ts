import type { StageFps, StagePlan, StagePlanScene, StagePlanTransition } from './stage-types'

/**
 * Time model of the stage (D2): integer frames at the canvas fps, scenes back to back in strip order. The resolved
 * scene lengths come from the preview plan (the gateway's `compositionSceneLength`); nothing here estimates.
 */

export function fpsOf(fps: StageFps): number {
  return fps.num / fps.den
}

export function framesToSeconds(frames: number, fps: StageFps): number {
  return (frames * fps.den) / fps.num
}

export function secondsToFrames(seconds: number, fps: StageFps): number {
  return Math.round((seconds * fps.num) / fps.den)
}

export type SceneAt<S extends { startFrame: number; durationFrames: number } = StagePlanScene> = { index: number; scene: S; localFrame: number }

/** The scene holding an absolute `frame` (clamped into the plan) and the frame inside it; null for an empty plan. */
export function sceneAtFrame<S extends { startFrame: number; durationFrames: number }>(plan: { scenes: readonly S[]; totalFrames: number }, frame: number): SceneAt<S> | null {
  const { scenes } = plan
  if (scenes.length === 0) return null
  const clamped = Math.min(Math.max(0, Math.floor(frame)), Math.max(0, plan.totalFrames - 1))
  let low = 0
  let high = scenes.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (scenes[middle]!.startFrame <= clamped) low = middle
    else high = middle - 1
  }
  const scene = scenes[low]!
  const localFrame = Math.min(Math.max(0, clamped - scene.startFrame), Math.max(0, scene.durationFrames - 1))
  return { index: low, scene, localFrame }
}

/** E1-L: the id a transition segment has as a mounted "scene" (never a real scene id: nothing in it is selectable). */
export const transitionBundleId = (toSceneId: string): string => `transition:${toSceneId}`

/** What the stage shows at one absolute frame: a scene at its own frame, or a transition segment at its document frame. */
export type Presentation =
  | { kind: 'scene'; index: number; scene: StagePlanScene; localFrame: number }
  | {
      /** Live FX: the stage blends the two scene pictures itself (`transition-blend.ts`). */
      kind: 'blend'
      /** Index of the INCOMING scene. */
      index: number
      /** The incoming scene. */
      scene: StagePlanScene
      /** The outgoing scene. */
      from: StagePlanScene
      transition: StagePlanTransition
      /** Frames into the window (0 = its first frame). */
      step: number
      /** The scene that holds the frame (selection, warnings, editing): the outgoing one before the cut, the incoming one from it. */
      holder: 'from' | 'to'
      /** Frame of the outgoing scene (may pass its last frame: it holds its end state) and of the incoming one (may be < 0). */
      fromFrame: number
      toFrame: number
      /** The holder's own frame (what the stage edits and hit-tests at). */
      localFrame: number
    }
  | {
      kind: 'transition'
      /** Index of the INCOMING scene. */
      index: number
      scene: StagePlanScene
      transition: StagePlanTransition
      /** Frame of the segment document (`documentFrameOffset + frame - startFrame`). */
      localFrame: number
    }

/**
 * E1-L (D8): the frame's presentation. Inside the window of a READY transition the picture is the transition segment (the
 * two scenes and the blend, one document); everywhere else it is the scene holding the frame, as before. Scene starts and
 * the total length are untouched by transitions, so `sceneAtFrame` stays the authority for selection and editing.
 */
export function presentationAtFrame(
  plan: { scenes: readonly StagePlanScene[]; totalFrames: number; transitions?: readonly StagePlanTransition[] },
  frame: number,
  skip?: ReadonlySet<string>,
): Presentation | null {
  const at = sceneAtFrame(plan, frame)
  if (!at) return null
  const clamped = Math.min(Math.max(0, Math.floor(frame)), Math.max(0, plan.totalFrames - 1))
  for (const transition of plan.transitions ?? []) {
    if (transition.status !== 'ready' || transition.startFrame === null || transition.durationFrames === null || transition.documentFrameOffset === null) continue
    if (clamped < transition.startFrame || clamped >= transition.startFrame + transition.durationFrames) continue
    if (skip?.has(transitionKey(transition))) continue
    const index = plan.scenes.findIndex((scene) => scene.sceneId === transition.toSceneId)
    if (index < 0) continue
    if (transition.blend) {
      const from = plan.scenes[index - 1]
      if (!from || from.sceneId !== transition.fromSceneId) continue
      const scene = plan.scenes[index]!
      const holder = clamped < scene.startFrame ? 'from' : 'to'
      const fromFrame = clamped - from.startFrame
      const toFrame = clamped - scene.startFrame
      return { kind: 'blend', index, scene, from, transition, step: clamped - transition.startFrame, holder, fromFrame, toFrame, localFrame: holder === 'from' ? fromFrame : toFrame }
    }
    return { kind: 'transition', index, scene: plan.scenes[index]!, transition, localFrame: transition.documentFrameOffset + (clamped - transition.startFrame) }
  }
  return { kind: 'scene', index: at.index, scene: at.scene, localFrame: at.localFrame }
}

/** Cache key of a transition segment: it changes exactly when what the segment draws changes. */
export const transitionKey = (transition: Pick<StagePlanTransition, 'toSceneId' | 'dependencyHash'>): string => `${transition.toSceneId}\u0000${transition.dependencyHash ?? ''}`

/** The ready transition into the scene at `index`, or null. */
export function transitionInto(plan: { scenes: readonly StagePlanScene[]; transitions?: readonly StagePlanTransition[] }, index: number): StagePlanTransition | null {
  const scene = plan.scenes[index]
  if (!scene) return null
  return (plan.transitions ?? []).find((transition) => transition.toSceneId === scene.sceneId && transition.status === 'ready') ?? null
}

export function sceneIndexOf(plan: Pick<StagePlan, 'scenes'>, sceneId: string): number {
  return plan.scenes.findIndex((scene) => scene.sceneId === sceneId)
}

/** Absolute start frame of a scene, or null when the plan does not hold it. */
export function sceneStartFrame(plan: Pick<StagePlan, 'scenes'>, sceneId: string): number | null {
  return plan.scenes.find((scene) => scene.sceneId === sceneId)?.startFrame ?? null
}

/** The scene after `index` (the prefetch target while a scene plays), or null at the end. */
export function nextScene(plan: Pick<StagePlan, 'scenes'>, index: number): StagePlanScene | null {
  return plan.scenes[index + 1] ?? null
}

/** `m:ss.t` of a frame (the dock's time label). */
export function formatFrameTime(frame: number, fps: StageFps): string {
  const seconds = Math.max(0, framesToSeconds(frame, fps))
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds % 1) * 10)
  return `${minutes}:${String(rest).padStart(2, '0')}.${tenths}`
}

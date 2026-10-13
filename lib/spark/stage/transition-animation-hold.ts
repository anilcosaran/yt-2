import type { CompositionDocument } from '../composition-client'

/**
 * Timeline v3 — a scene's OWN animations inside a transition window, in the browser (the live FX blend). A mirror of
 * `api-gateway/src/composition/domain/scene-compiler/scene-transition-animations.ts`; both run the shared `animation_holds`
 * vectors of `fixtures/scene-transition-parity.json`, and `transition-blend-parity.test.ts` reads the gateway's segments back
 * with the vendored runtime against pictures held here.
 *
 * RULE: inside the window the outgoing scene's EXIT animations and the incoming scene's ENTRY animations are not played, so
 * the two whole pictures blend (owner feedback 2026-10-03: transitions looked like "closing / opening" because the AI's titles
 * fade out at a scene's end and in at the next one's start). Per tween of such an animation (`<layer_id>.<animation_id>`):
 *
 * - outgoing scene, hold frame `h` = the window's first frame in the scene's own frames: a tween that ends at or before `h` is
 *   untouched; one that starts at or after `h` is removed; one running at `h` is held at its value at `h`.
 * - incoming scene, hold frame `h` = the window's end in the scene's own frames: a tween that starts at or after `h` is
 *   untouched; any other is held at its value at `h`, shown from the window's first frame on (`immediate_render`).
 *
 * A held picture is only drawn inside the window (outside it the scene's own picture is), so neither picture jumps at an edge.
 * A tween whose value cannot be computed exactly here is left as it is. Pure; nothing to hold returns the same object.
 */

export type TransitionHoldSide = 'from' | 'to'

/** What one picture of a blend holds: the frame of the scene the values are taken at and the animation track roles. */
export type TransitionHold = { side: TransitionHoldSide; frame: number; roles: readonly string[] }

/** The phase whose animations a side holds (outgoing: exit, incoming: enter). */
export const TRANSITION_HOLD_PHASE = { from: 'exit', to: 'enter' } as const

type IrTrack = Record<string, unknown> & { kind?: unknown; role?: unknown; tracks?: unknown }

/** The track roles (`<layer_id>.<animation_id>`) of a scene's animations of one phase, sorted (gateway `transitionAnimationRoles`). */
export function transitionAnimationRoles(document: CompositionDocument, sceneId: string, phase: 'enter' | 'exit'): string[] {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  const roles: string[] = []
  for (const layer of scene?.layers ?? []) {
    const animations = (layer as Record<string, unknown>)['animations']
    if (!Array.isArray(animations)) continue
    for (const animation of animations as Array<{ animation_id?: unknown; phase?: unknown }>) {
      if (animation?.phase === phase && typeof animation.animation_id === 'string') roles.push(`${layer.layer_id}.${animation.animation_id}`)
    }
  }
  return roles.sort()
}

/** The eases of the scene compiler's animations, as the runtime evaluates them (gateway `easeAt`). */
function easeAt(name: unknown, progress: number): number | null {
  const t = progress <= 0 ? 0 : progress >= 1 ? 1 : progress
  switch (name) {
    case 'linear':
    case 'none':
      return t
    case 'cubic.in':
      return t * t * t
    case 'cubic.out':
      return 1 - (1 - t) ** 3
    case 'cubic.inOut':
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    default:
      return null
  }
}

type Key = { offset: number; value: unknown; ease?: unknown }

/** Keyframes (offsets 0-100) at an eased progress: linear between neighbours (the runtime's `ease_each` default). */
function keyframesAt(keys: readonly Key[], eased: number): number | null {
  if (keys.length === 0 || keys.some((key) => typeof key.value !== 'number' || (key.ease !== undefined && key.ease !== 'linear'))) return null
  const at = (eased <= 0 ? 0 : eased >= 1 ? 1 : eased) * 100
  const first = keys[0] as { offset: number; value: number }
  if (at <= first.offset) return first.value
  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1] as { offset: number; value: number }
    const next = keys[index] as { offset: number; value: number }
    if (at <= next.offset) {
      const span = next.offset - previous.offset
      return span <= 0 ? next.value : previous.value + ((next.value - previous.value) * (at - previous.offset)) / span
    }
  }
  return (keys[keys.length - 1] as { value: number }).value
}

/** A tween's value at `progress` (0-1), or null when it cannot be computed exactly here (gateway `tweenValueAt`). */
export function tweenValueAt(track: IrTrack, progress: number): number | null {
  if (track['repeat'] !== undefined || track['yoyo'] !== undefined || track['stagger'] !== undefined) return null
  const eased = easeAt(track['ease'], progress)
  if (eased === null) return null
  const keyframes = track['keyframes']
  if (Array.isArray(keyframes)) {
    if (track['ease_each'] !== undefined && track['ease_each'] !== 'linear') return null
    return keyframesAt(keyframes as Key[], eased)
  }
  const from = track['from']
  const to = track['to']
  if (typeof from !== 'number' || typeof to !== 'number') return null
  return from + (to - from) * eased
}

const q = (value: number): number => Math.round(value * 1e4) / 1e4

function held(track: IrTrack, value: number, immediate: boolean): IrTrack {
  const out: IrTrack = { ...track, from: q(value), to: q(value), ease: 'linear', immediate_render: immediate }
  delete out['keyframes']
  delete out['ease_each']
  return out
}

function holdTrack(track: IrTrack, hold: { side: TransitionHoldSide; frame: number }): IrTrack | null {
  const start = track['start'] as { rel?: unknown; frame?: unknown } | undefined
  if (start?.rel !== 'at' || typeof start.frame !== 'number') return track
  const duration = Math.max(1, typeof track['duration_frames'] === 'number' ? track['duration_frames'] : 1)
  const end = start.frame + duration
  if (hold.side === 'from') {
    if (end <= hold.frame) return track
    if (start.frame >= hold.frame) return null
    const value = tweenValueAt(track, (hold.frame - start.frame) / duration)
    return value === null ? track : held(track, value, typeof track['immediate_render'] === 'boolean' ? track['immediate_render'] : true)
  }
  if (start.frame >= hold.frame) return track
  const value = tweenValueAt(track, Math.min(1, (hold.frame - start.frame) / duration))
  return value === null ? track : held(track, value, true)
}

/** The tracks of a scene IR with the side's animations held (the same array when nothing changes). */
export function holdTransitionTracks(input: readonly unknown[], hold: TransitionHold): readonly unknown[] {
  const roles = new Set(hold.roles)
  if (roles.size === 0) return input
  const walk = (tracks: readonly unknown[]): readonly unknown[] => {
    let changed = false
    const out: unknown[] = []
    for (const entry of tracks) {
      const track = entry as IrTrack
      if (track.kind === 'timeline' && Array.isArray(track.tracks)) {
        const inner = walk(track.tracks)
        if (inner !== track.tracks) changed = true
        out.push(inner === track.tracks ? track : { ...track, tracks: [...inner] })
        continue
      }
      if (track.kind !== 'tween' || typeof track.role !== 'string' || !roles.has(track.role)) {
        out.push(track)
        continue
      }
      const next = holdTrack(track, hold)
      if (next !== track) changed = true
      if (next) out.push(next)
    }
    return changed ? out : tracks
  }
  return walk(input)
}

/** A scene IR with the side's animations held for the window (the same object when nothing changes). */
export function holdTransitionAnimations(ir: Record<string, unknown>, hold: TransitionHold): Record<string, unknown> {
  const tracks = ir['tracks']
  if (!Array.isArray(tracks)) return ir
  const next = holdTransitionTracks(tracks, hold)
  return next === tracks ? ir : { ...ir, tracks: [...next] }
}

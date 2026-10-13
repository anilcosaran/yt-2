import { newSceneId, sceneInsertSpec, type CompositionDocument, type CompositionOpSpec } from './composition-client'
import {
  motionInstanceInsertSpec,
  newLayerId,
  newMotionInstanceId,
  type CompositionMotionEnergy,
  type CompositionMotionParameterInput,
} from './composition-typed-edits'
import type { MotionCard } from './motion-catalog'
import { projectImageSources, projectVideoStyleRef } from './motion-layers'
import type { OverlayBlock } from './motion-overlay-support'
import { sparkAddSceneMode, type SparkAddSceneMode } from './template-policy'

/**
 * E1-D: what "+" on a Motion card, or a card dropped on the canvas or the timeline, writes. A Motion is an OVERLAY of a scene
 * (D2): a `motion_instance` layer with its own partial `scene_range` right above the scene's other layers, so the footage or
 * the picture underneath keeps playing. One gesture is one command, so the plan is one `motion.instance.insert` spec.
 *
 * The plan decides everything the UI can know before it asks the server (the server still checks it all and compiles the
 * instance before it writes anything): the premium purchase (E1-I), the look, the canvas ratio, the scene length, a
 * required image. A refusal names its reason so the drawer can say it; nothing is clamped silently.
 */

/** Seconds a Motion plays when its natural length is not stated: inside the Motion's own duration range, capped to the scene. */
export const DEFAULT_MOTION_SECONDS = 4

export type MotionInsertRefusal =
  /** A premium Motion is bought once per workspace (D3, E1-I): until the workspace owns it, it cannot be placed. */
  | { reason: 'premium_not_bought' }
  | { reason: 'no_scene' }
  /** No VideoStyle preset to insert with: the surface is closed or listed none. */
  | { reason: 'video_style_unavailable' }
  | { reason: 'ratio_not_available'; ratio: string }
  /** The scene has less room after the start than the Motion's shortest length. */
  | { reason: 'scene_too_short'; minSeconds: number }
  /** The Motion has a required image field and the project holds no image yet. */
  | { reason: 'needs_image' }
  /** The Motion moves a camera, follows word/beat timing or draws unstaged content: it can only be a scene of its own (E1-C). */
  | { reason: 'own_scene_only'; cause: OverlayBlock }
  /** A template-bound project adds scenes from its template, not from a Motion card. */
  | { reason: 'scene_policy'; mode: Exclude<SparkAddSceneMode, 'freeform'> }
  /** WP4: a project-private revision (an AI Motion scene of ONE project) is not a library Motion: the server refuses it anywhere else. */
  | { reason: 'project_private' }
  /** WP4: the Motion's typed source offers none of the energies an instance can start with. */
  | { reason: 'energy_not_available' }

export type MotionInsertPlan =
  | {
      ok: true
      sceneId: string
      layerId: string
      instanceId: string
      /** Scene-local frames the overlay plays over. */
      range: { start_frame: number; end_frame: number }
      /** The overlay was shortened to end with the scene (its natural length did not fit after the start). */
      shortened: boolean
      specs: CompositionOpSpec[]
    }
  | { ok: false; refusal: MotionInsertRefusal }

export type MotionInsertInput = {
  document: CompositionDocument
  card: MotionCard
  /** The scene to overlay, its resolved length and the scene-local frame the insert starts at. */
  sceneId: string
  sceneFrames: number
  localFrame: number
  /** The top layer of the scene (the new layer goes right above it). */
  lastLayerId: string | null
  fps: { num: number; den: number }
  /** The look to insert with: the project's own Motion look when it has one, else this preset (the first listed). */
  defaultVideoStyleRef: string | null
  /** What is known about the revision's overlay support (`motion-overlay-support.ts`); null = nothing rules it out. */
  overlayBlock?: OverlayBlock | null
  /**
   * WP4: the energies the revision's typed source offers when the card does not state them (a saved Motion); null = not
   * known, the insert then names no energy and the server starts with one the Motion offers.
   */
  energies?: readonly CompositionMotionEnergy[] | null
  uuid: () => string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * The energy a new instance starts with: Balanced when the Motion offers it, else Calm or Lively, whichever it offers (the
 * server's own default). Null when the energies are not known: the insert names none and the server picks the same way.
 */
export function startingEnergy(energies: readonly CompositionMotionEnergy[] | null): CompositionMotionEnergy | undefined {
  if (!energies) return undefined
  return (['dengeli', 'sakin', 'canli'] as const).find((energy) => energies.includes(energy))
}

/** WP4: what the UI can know before the server about a Motion's revision itself (its scope and its energies). */
export function motionRevisionRefusal(card: MotionCard, knownEnergies: readonly CompositionMotionEnergy[] | null = null): MotionInsertRefusal | null {
  if (card.ref.scope !== 'library') return { reason: 'project_private' }
  const energies = card.energies ?? knownEnergies
  if (energies && startingEnergy(energies) === undefined) return { reason: 'energy_not_available' }
  return null
}

export function planMotionInsert(input: MotionInsertInput): MotionInsertPlan {
  const { document, card } = input
  const refuse = (refusal: MotionInsertRefusal): MotionInsertPlan => ({ ok: false, refusal })
  if (card.premium && card.owned !== true) return refuse({ reason: 'premium_not_bought' })
  const revisionRefusal = motionRevisionRefusal(card, input.energies ?? null)
  if (revisionRefusal) return refuse(revisionRefusal)
  if (input.overlayBlock) return refuse({ reason: 'own_scene_only', cause: input.overlayBlock })
  if (!(input.sceneFrames > 0)) return refuse({ reason: 'no_scene' })
  const videoStyleRef = projectVideoStyleRef(document) ?? input.defaultVideoStyleRef
  if (!videoStyleRef) return refuse({ reason: 'video_style_unavailable' })
  const ratio = document.canvas.aspect_ratio
  if (!card.aspectRatios.includes(ratio)) return refuse({ reason: 'ratio_not_available', ratio })

  const fps = input.fps.num / input.fps.den
  const start = clamp(Math.floor(input.localFrame), 0, input.sceneFrames - 1)
  const room = input.sceneFrames - start
  const range = card.durationRange
  const natural = clamp(Math.round(DEFAULT_MOTION_SECONDS * fps), range?.minFrames ?? 1, range?.maxFrames ?? Number.MAX_SAFE_INTEGER)
  const length = Math.min(natural, room)
  if (range && length < range.minFrames) return refuse({ reason: 'scene_too_short', minSeconds: Math.ceil((range.minFrames / fps) * 10) / 10 })

  // A required image field takes the project's first image; the Properties panel changes it afterwards.
  const parameterValues: Record<string, CompositionMotionParameterInput> = {}
  const required = card.parameters.filter((parameter) => parameter.kind === 'media' && parameter.required && parameter.spark_editable)
  if (required.length > 0) {
    const image = projectImageSources(document)[0]
    if (!image) return refuse({ reason: 'needs_image' })
    for (const parameter of required) parameterValues[parameter.parameter_id] = { source_id: image.sourceId }
  }

  const layerId = newLayerId(input.uuid())
  const instanceId = newMotionInstanceId(input.uuid())
  const sceneRange = { start_frame: start, end_frame: start + length }
  return {
    ok: true,
    sceneId: input.sceneId,
    layerId,
    instanceId,
    range: sceneRange,
    shortened: length < natural,
    specs: [
      motionInstanceInsertSpec({
        sceneId: input.sceneId,
        layerId,
        afterLayerId: input.lastLayerId,
        instanceId,
        motionRef: card.ref,
        sceneRange,
        videoStyleRef,
        ...withEnergy(startingEnergy(card.energies ?? input.energies ?? null)),
        parameterValues,
      }),
    ],
  }
}

const withEnergy = (energy: CompositionMotionEnergy | undefined): { energy?: CompositionMotionEnergy } => (energy ? { energy } : {})

export type MotionScenePlan =
  | { ok: true; sceneId: string; layerId: string; instanceId: string; durationFrames: number; specs: CompositionOpSpec[] }
  | { ok: false; refusal: MotionInsertRefusal }

/**
 * "Add as new scene": the Motion as a scene of its own, right after `afterSceneId` (the selected scene; null = first), as
 * the whole-scene instance the compiler has always drawn. This is the way for a Motion that cannot sit over other layers
 * (a camera Motion, E1-C) and for any title-card style Motion. ONE command (a scene and its Motion layer): one undo group.
 * A template-bound project adds scenes from its template, so the plan refuses there with the same reason the `+` has.
 */
export function planMotionScene(input: {
  document: CompositionDocument
  card: MotionCard
  afterSceneId: string | null
  fps: { num: number; den: number }
  defaultVideoStyleRef: string | null
  /** WP4: the energies the typed source offers when the card does not state them (see `MotionInsertInput.energies`). */
  energies?: readonly CompositionMotionEnergy[] | null
  uuid: () => string
}): MotionScenePlan {
  const { document, card } = input
  const refuse = (refusal: MotionInsertRefusal): MotionScenePlan => ({ ok: false, refusal })
  if (card.premium && card.owned !== true) return refuse({ reason: 'premium_not_bought' })
  const revisionRefusal = motionRevisionRefusal(card, input.energies ?? null)
  if (revisionRefusal) return refuse(revisionRefusal)
  const mode = sparkAddSceneMode(document)
  if (mode !== 'freeform') return refuse({ reason: 'scene_policy', mode })
  const videoStyleRef = projectVideoStyleRef(document) ?? input.defaultVideoStyleRef
  if (!videoStyleRef) return refuse({ reason: 'video_style_unavailable' })
  const ratio = document.canvas.aspect_ratio
  if (!card.aspectRatios.includes(ratio)) return refuse({ reason: 'ratio_not_available', ratio })

  const range = card.durationRange
  const fps = input.fps.num / input.fps.den
  const durationFrames = clamp(Math.round(DEFAULT_MOTION_SECONDS * fps), range?.minFrames ?? 1, range?.maxFrames ?? Number.MAX_SAFE_INTEGER)

  const parameterValues: Record<string, CompositionMotionParameterInput> = {}
  const required = card.parameters.filter((parameter) => parameter.kind === 'media' && parameter.required && parameter.spark_editable)
  if (required.length > 0) {
    const image = projectImageSources(document)[0]
    if (!image) return refuse({ reason: 'needs_image' })
    for (const parameter of required) parameterValues[parameter.parameter_id] = { source_id: image.sourceId }
  }

  const sceneId = newSceneId(input.uuid())
  const layerId = newLayerId(input.uuid())
  const instanceId = newMotionInstanceId(input.uuid())
  return {
    ok: true,
    sceneId,
    layerId,
    instanceId,
    durationFrames,
    specs: [
      sceneInsertSpec({ sceneId, afterSceneId: input.afterSceneId, durationFrames }),
      motionInstanceInsertSpec({
        sceneId,
        layerId,
        afterLayerId: null,
        instanceId,
        motionRef: card.ref,
        sceneRange: { start_frame: 0, end_frame: durationFrames },
        videoStyleRef,
        ...withEnergy(startingEnergy(card.energies ?? input.energies ?? null)),
        parameterValues,
      }),
    ],
  }
}

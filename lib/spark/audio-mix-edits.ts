import type { CompositionEntityRef, CompositionOpSpec } from './composition-client'
import type { CompositionFrameRange } from './composition-typed-edits'

/**
 * P06-63 Spark builders of the A-lane audio commands (`audio.adjust`, `audio.set_duck`, `audio.automate`,
 * `audio.set_fade`). Reads/targets mirror the gateway handlers: every plan command reads and targets the `audio`
 * entity `mix_plan` (an absent plan is the default plan at rev 1), a clip gain/fade reads its placement. Semantics
 * stay in the gateway: nothing is applied locally and out-of-range values are refused there, never clamped here.
 */

export const AUDIO_MIX_BUSES = ['voice', 'source_dialogue', 'music', 'sfx', 'ambience'] as const
export type AudioMixBus = (typeof AUDIO_MIX_BUSES)[number]

export const AUDIO_MIX_PLAN_REF: CompositionEntityRef = { entity_kind: 'audio', entity_id: 'mix_plan' }
const placementRef = (placementId: string): CompositionEntityRef => ({ entity_kind: 'audio', entity_id: placementId })

export type AudioBusChange = { deltaDb: number } | { gainDb: number } | { mute: boolean }

export function audioAdjustBusSpec(bus: AudioMixBus, change: AudioBusChange): CompositionOpSpec {
  const body = 'deltaDb' in change ? { delta_db: change.deltaDb } : 'gainDb' in change ? { gain_db: change.gainDb } : { mute: change.mute }
  return { op: { op: 'audio.adjust', target: { bus }, ...body }, reads: [AUDIO_MIX_PLAN_REF], targets: [AUDIO_MIX_PLAN_REF] }
}

export function audioAdjustPlacementSpec(placementId: string, change: { deltaDb: number } | { gainDb: number }): CompositionOpSpec {
  const body = 'deltaDb' in change ? { delta_db: change.deltaDb } : { gain_db: change.gainDb }
  return {
    op: { op: 'audio.adjust', target: { placement_id: placementId }, ...body },
    reads: [placementRef(placementId)],
    targets: [placementRef(placementId)],
  }
}

export type AudioDuckChange = {
  depthDb?: number
  depthDeltaDb?: number
  attackMs?: number
  releaseMs?: number
  backgroundLevelOffsetDb?: number
  backgroundDeltaDb?: number
}

export function audioSetDuckSpec(change: AudioDuckChange): CompositionOpSpec {
  const op: Record<string, unknown> = { op: 'audio.set_duck' }
  if (change.depthDb !== undefined) op.depth_db = change.depthDb
  if (change.depthDeltaDb !== undefined) op.depth_delta_db = change.depthDeltaDb
  if (change.attackMs !== undefined) op.attack_ms = change.attackMs
  if (change.releaseMs !== undefined) op.release_ms = change.releaseMs
  if (change.backgroundLevelOffsetDb !== undefined) op.background_level_offset_db = change.backgroundLevelOffsetDb
  if (change.backgroundDeltaDb !== undefined) op.background_delta_db = change.backgroundDeltaDb
  if (Object.keys(op).length === 1) throw new Error('audio.set_duck needs at least one change')
  return { op: op as CompositionOpSpec['op'], reads: [AUDIO_MIX_PLAN_REF], targets: [AUDIO_MIX_PLAN_REF] }
}

export function audioAutomateSetSpec(envelope: {
  envelopeId: string
  bus: AudioMixBus
  projectRange: CompositionFrameRange
  gainDb: number
  rampMs?: number
}): CompositionOpSpec {
  return {
    op: {
      op: 'audio.automate',
      action: 'set',
      envelope: {
        envelope_id: envelope.envelopeId,
        bus: envelope.bus,
        project_range: envelope.projectRange,
        gain_db: envelope.gainDb,
        ramp_ms: envelope.rampMs ?? 300,
      },
    },
    reads: [AUDIO_MIX_PLAN_REF],
    targets: [AUDIO_MIX_PLAN_REF],
  }
}

export function audioAutomateRemoveSpec(envelopeId: string): CompositionOpSpec {
  return { op: { op: 'audio.automate', action: 'remove', envelope_id: envelopeId }, reads: [AUDIO_MIX_PLAN_REF], targets: [AUDIO_MIX_PLAN_REF] }
}

/** `null` removes a fade. */
export function audioSetFadeSpec(placementId: string, fades: { fadeInMs?: number | null; fadeOutMs?: number | null }): CompositionOpSpec {
  if (fades.fadeInMs === undefined && fades.fadeOutMs === undefined) throw new Error('audio.set_fade needs fadeInMs or fadeOutMs')
  return {
    op: {
      op: 'audio.set_fade',
      placement_id: placementId,
      ...(fades.fadeInMs !== undefined && { fade_in_ms: fades.fadeInMs }),
      ...(fades.fadeOutMs !== undefined && { fade_out_ms: fades.fadeOutMs }),
    },
    reads: [placementRef(placementId)],
    targets: [placementRef(placementId)],
  }
}

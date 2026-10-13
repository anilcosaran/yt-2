import type { VoiceProfile } from '@/lib/voice/api'

import type { CompositionDocument } from './composition-client'
import { MAX_VOICE_SCENES_PER_REQUEST, type NarrationVoiceRun, type NarrationVoiceState, type SceneVoice } from './narration-voice-client'

/**
 * E1-K pure rules of the scene panel's Voice row: which scenes a request covers, what the picker lists, and what a
 * finished run means for the scene the user is looking at. No I/O, no clock.
 */

export type VoiceScope = 'scene' | 'all'
export type VoiceTab = 'all' | 'stock' | 'mine'

/**
 * A short fingerprint of everything in the working copy that decides the Voice row: each scene's script binding and its
 * narration placements (id + provenance digest). The voice state is read again when it changes (a narration replaced by
 * the job, a recording added, a scene rebound), not on every layer drag.
 */
export function voiceSignature(document: CompositionDocument): string {
  const parts: string[] = []
  for (const sceneId of document.scene_sequence.scene_ids) {
    const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
    const binding = scene?.['narration_binding'] as { script?: { artifact_id?: string; artifact_revision?: number }; beat_ids?: string[] } | undefined
    const placements = document.audio.placements
      .filter((placement) => placement['role'] === 'narration' && placement['scene_id'] === sceneId)
      .map((placement) => {
        const provenance = placement['narration_provenance'] as { spec_sha256?: string } | undefined
        return `${placement.placement_id}@${placement.rev}:${provenance?.spec_sha256?.slice(0, 12) ?? ''}`
      })
    parts.push(`${sceneId}|${binding?.script?.artifact_id ?? ''}.${binding?.script?.artifact_revision ?? ''}|${(binding?.beat_ids ?? []).join(',')}|${placements.join(',')}`)
  }
  return parts.join(';')
}

/** The scenes "Apply to all scenes" covers: every scene whose script can be spoken, in strip order. */
export function narratedSceneIds(state: NarrationVoiceState): string[] {
  return state.scenes.filter((scene) => scene.script.state === 'ready').map((scene) => scene.scene_id)
}

export type AllScenesAvailability = { ok: true; sceneIds: string[] } | { ok: false; reason: 'none' | 'too_many'; count: number }

export function allScenesAvailability(state: NarrationVoiceState): AllScenesAvailability {
  const sceneIds = narratedSceneIds(state)
  if (sceneIds.length === 0) return { ok: false, reason: 'none', count: 0 }
  if (sceneIds.length > MAX_VOICE_SCENES_PER_REQUEST) return { ok: false, reason: 'too_many', count: sceneIds.length }
  return { ok: true, sceneIds }
}

/** What the row says about the scene's narration now. */
export type CurrentVoiceView =
  | { kind: 'voice'; name: string; language: string; seconds: number | null }
  | { kind: 'generated'; seconds: number | null }
  | { kind: 'supplied'; seconds: number | null }
  | { kind: 'none' }

export function currentVoiceView(scene: SceneVoice | undefined): CurrentVoiceView {
  if (!scene?.narration) return { kind: 'none' }
  const seconds = scene.narration.duration_seconds
  if (scene.voice) return { kind: 'voice', name: scene.voice.display_name, language: scene.voice.language, seconds }
  return scene.narration.source_mode === 'supplied_audio' ? { kind: 'supplied', seconds } : { kind: 'generated', seconds }
}

/** `tr-TR` → `tr`: the language of a voice or script compared without its region. */
export function primaryLanguage(tag: string | null | undefined): string {
  return (tag ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? ''
}

/** Whether a voice profile says it speaks the language (a profile that lists none is not excluded: the server decides). */
export function profileSpeaks(profile: Pick<VoiceProfile, 'supported_languages' | 'default_language'>, language: string | null): boolean {
  if (!language) return true
  const wanted = primaryLanguage(language)
  const listed = [...profile.supported_languages, profile.default_language ?? ''].map(primaryLanguage).filter(Boolean)
  return listed.length === 0 || listed.includes(wanted)
}

export function filterVoices(profiles: readonly VoiceProfile[], input: { tab: VoiceTab; search: string }): VoiceProfile[] {
  const needle = input.search.trim().toLowerCase()
  return profiles.filter((profile) => {
    if (profile.status !== 'ready') return false
    if (input.tab === 'stock' && profile.origin !== 'stock') return false
    if (input.tab === 'mine' && profile.origin === 'stock') return false
    if (!needle) return true
    const haystack = [profile.display_name, profile.catalog.description ?? '', profile.catalog.accent ?? '', ...profile.catalog.tone_tags, ...profile.catalog.use_case_tags]
    return haystack.some((text) => text.toLowerCase().includes(needle))
  })
}

/** Counts of a finished run for the summary sentence. */
export function runTotals(run: NarrationVoiceRun) {
  return {
    total: run.scenes.length,
    applied: run.scenes.filter((scene) => scene.state === 'applied').length,
    failed: run.scenes.filter((scene) => scene.state === 'failed').length,
    attention: run.scenes.filter((scene) => scene.state === 'needs_attention').length,
    extended: run.scenes.filter((scene) => scene.scene_extended === true).length,
  }
}

/** The scene numbers (1-based, strip order) of scene ids, for the price lines. */
export function sceneNumberOf(document: CompositionDocument, sceneId: string): number {
  return document.scene_sequence.scene_ids.indexOf(sceneId) + 1
}

const ATTENTION_REASONS = new Set(['narration_changed', 'script_changed', 'scene_removed', 'working_copy_moved', 'result_unusable'])

/** The message key (under `attention.`) for the reason a result was not applied; unknown reasons read as `other`. */
export function attentionKey(reason: string): string {
  return ATTENTION_REASONS.has(reason) ? reason : 'other'
}

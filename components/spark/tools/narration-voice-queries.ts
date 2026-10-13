'use client'

import * as React from 'react'
import { QueryClientContext, keepPreviousData, useQuery } from '@tanstack/react-query'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import {
  classifyNarrationVoiceError,
  getNarrationVoice,
  getNarrationVoiceRun,
  type NarrationVoiceRun,
  type NarrationVoiceState,
} from '@/lib/spark/narration-voice-client'
import { attentionKey, runTotals, voiceSignature } from '@/lib/spark/scene-voice'

/**
 * E1-K shared server reads of the scene voice change. The state (what each scene's narration is, which voice made it and
 * which voice job runs) and the progress of a run live in the react-query cache so the editor-level watcher
 * (`scene-voice-jobs.tsx`, always mounted while the editor is open) and the scene panel's Voice row see the same data.
 * Nothing here is written to browser storage: the cache is memory only and the server holds the truth.
 */

const POLL_MS = 3_000
/** How often a running voice change is read. A holder (not a constant) so a test can read it faster; production never writes it. */
export const sceneVoicePolling = { intervalMs: POLL_MS }
/** The editor stops watching a run after this long (the server keeps working and the narration still changes). */
export const MAX_WATCH_MS = 20 * 60 * 1000

/**
 * Whether a query cache is mounted (the root layout always mounts one). Without it the Voice row and its watcher stay out
 * (the row keeps the design's disabled placeholder) instead of failing: a hand-built editor tree in a test, a story.
 */
export function useHasQueryClient(): boolean {
  return React.useContext(QueryClientContext) !== undefined
}

export const voiceStatePrefix = (projectId: string) => ['spark', 'narration-voice', projectId] as const
export const voiceRunKey = (projectId: string, runId: string) => ['spark', 'narration-voice-run', projectId, runId] as const

/** The voice state of the project; read again when the narrations or script bindings of the document change. */
export function useNarrationVoiceState(projectId: string, document: CompositionDocument | null) {
  const signature = document ? voiceSignature(document) : null
  return useQuery({
    queryKey: [...voiceStatePrefix(projectId), signature],
    queryFn: ({ signal }) => getNarrationVoice(projectId, { signal }),
    enabled: signature !== null,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    // A narration replaced by a job changes the key: the previous answer stays until the new one arrives, so a job being
    // watched is never dropped for the instant the state is read again.
    placeholderData: keepPreviousData,
  })
}

/**
 * Whether a failed read of a run ends its watch: a run the server does not know, or that this user may not read, is not read
 * again (a blip is, at the next tick).
 */
export function runReadStopped(error: unknown): boolean {
  if (!error) return false
  const failure = classifyNarrationVoiceError(error)
  return failure === 'not_found' || failure === 'forbidden' || failure === 'unavailable'
}

/**
 * The progress of one run. `poll` is true for the watcher only: the Voice row reads the same cache entry without a timer
 * of its own, so one run is never polled twice.
 */
export function useNarrationVoiceRun(projectId: string, runId: string | null, options: { poll: boolean; enabled?: boolean }) {
  return useQuery({
    queryKey: voiceRunKey(projectId, runId ?? ''),
    queryFn: ({ signal }) => getNarrationVoiceRun(projectId, runId!, { signal }),
    enabled: runId !== null && (options.enabled ?? true),
    retry: false,
    refetchOnWindowFocus: false,
    ...(options.poll
      ? {
          refetchInterval: (query: { state: { data?: NarrationVoiceRun; error: unknown } }) =>
            query.state.data?.state === 'done' || runReadStopped(query.state.error) ? false : sceneVoicePolling.intervalMs,
        }
      : {}),
  })
}

export function runningJobsOf(state: NarrationVoiceState | undefined): string[] {
  const ids = new Set<string>()
  for (const scene of state?.scenes ?? []) if (scene.job) ids.add(scene.job.production_run_id)
  return [...ids]
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * ONE notice for a finished run: what changed (and with which voice), what failed and what was left unchanged. A run of a
 * single scene says it in one sentence, and says when the scene got longer because the new voice reads longer.
 */
export function voiceRunNotice(run: NarrationVoiceRun, t: Translate): { text: string; tone: 'ok' | 'error' } {
  const totals = runTotals(run)
  const voiceName = run.scenes.find((scene) => scene.voice.display_name)?.voice.display_name || t('theNewVoice')
  if (totals.total === 1) {
    const only = run.scenes[0]!
    if (only.state === 'applied') return { text: `${t('done', { voice: voiceName })}${only.scene_extended ? ` ${t('doneExtended')}` : ''}`, tone: 'ok' }
    if (only.state === 'needs_attention') return { text: t(`attention.${attentionKey(only.reason ?? 'result_unusable')}`), tone: 'error' }
    return { text: t('runFailed'), tone: 'error' }
  }
  const parts: string[] = []
  if (totals.applied > 0) parts.push(t('doneMany', { applied: totals.applied, total: totals.total, voice: voiceName }))
  if (totals.failed > 0) parts.push(t('runFailed'))
  if (totals.attention > 0) parts.push(t('attentionMany', { count: totals.attention }))
  return { text: parts.join(' '), tone: totals.failed + totals.attention > 0 ? 'error' : 'ok' }
}

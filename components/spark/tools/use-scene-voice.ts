'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import {
  classifyNarrationVoiceError,
  quoteNarrationVoice,
  requestNarrationVoice,
  type NarrationVoiceFailure,
  type NarrationVoiceQuote,
} from '@/lib/spark/narration-voice-client'
import { allScenesAvailability, filterVoices, narratedSceneIds, profileSpeaks, type AllScenesAvailability, type VoiceScope, type VoiceTab } from '@/lib/spark/scene-voice'
import { getVoiceProfilePreview, listVoiceProfiles, type VoiceProfile } from '@/lib/voice/api'

import { useNarrationVoiceRun, useNarrationVoiceState, voiceStatePrefix } from './narration-voice-queries'

/**
 * E1-K state of the scene panel's Voice row: the server's per-scene voice state, the voices of the picker (with a preview
 * player) and the flow price -> confirm. Everything durable lives on the server (the quote, the paid job, the narration
 * replacement) and the editor-level watcher (`scene-voice-jobs.tsx`) follows a started job to its end, so this hook only
 * remembers what the user is doing right now and reads the running job from the same cache.
 */

export type SceneVoiceFlow =
  | { kind: 'idle' }
  | { kind: 'quoting'; scope: VoiceScope }
  | { kind: 'quote'; scope: VoiceScope; voiceId: string; quote: NarrationVoiceQuote; key: string; priceChanged: boolean }
  | { kind: 'starting'; scope: VoiceScope }
  | { kind: 'error'; failure: NarrationVoiceFailure }

type Translate = (key: string, values?: Record<string, string | number>) => string

export type SceneVoiceInput = {
  projectId: string
  channelId: string
  document: CompositionDocument
  sceneId: string
  toast: (text: string, tone?: 'ok' | 'error') => void
  t: Translate
}

const newKey = () => `voice-${globalThis.crypto.randomUUID()}`

export function useSceneVoice(input: SceneVoiceInput) {
  const { projectId, channelId, document, sceneId } = input
  const queryClient = useQueryClient()
  const stateQuery = useNarrationVoiceState(projectId, document)
  const state = stateQuery.data
  const thisScene = state?.scenes.find((scene) => scene.scene_id === sceneId)
  const scriptLanguage = thisScene?.script.language ?? null
  const modelId = state?.model_id ?? null
  const allScenes: AllScenesAvailability | null = state ? allScenesAvailability(state) : null

  // The long-lived callbacks read the latest props through a ref (the hook re-renders on every document change).
  const latest = React.useRef(input)
  React.useLayoutEffect(() => {
    latest.current = input
  })

  // ---------------------------------------------------------------- the preview player
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = React.useState(false)
  const audio = React.useRef<HTMLAudioElement | null>(null)
  const previewRequest = React.useRef(0)
  const stopPreview = React.useCallback(() => {
    previewRequest.current += 1
    audio.current?.pause()
    audio.current = null
    setPlayingId(null)
  }, [])
  React.useEffect(() => stopPreview, [stopPreview])
  const togglePreview = async (profile: VoiceProfile) => {
    if (playingId === profile.id) {
      stopPreview()
      return
    }
    stopPreview()
    const request = previewRequest.current
    setPlayingId(profile.id)
    setPreviewFailed(false)
    const fail = () => {
      if (previewRequest.current !== request) return
      audio.current = null
      setPlayingId(null)
      setPreviewFailed(true)
    }
    try {
      const preview = await getVoiceProfilePreview(profile.id, channelId)
      if (previewRequest.current !== request) return
      const player = new Audio(preview.url)
      player.onended = () => {
        if (audio.current !== player) return
        audio.current = null
        setPlayingId(null)
      }
      player.onerror = fail
      audio.current = player
      const played = player.play() as Promise<void> | undefined
      if (played && typeof played.catch === 'function') played.catch(fail)
    } catch {
      fail()
    }
  }

  // ---------------------------------------------------------------- the picker
  const [open, setOpenState] = React.useState(false)
  /** Closing the picker also stops the sample that plays. */
  const setOpen = (value: boolean) => {
    if (!value) stopPreview()
    setOpenState(value)
  }
  const [tab, setTab] = React.useState<VoiceTab>('all')
  const [search, setSearch] = React.useState('')
  const [languageMode, setLanguageMode] = React.useState<'script' | 'all'>('script')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const narrowed = languageMode === 'script' && scriptLanguage !== null && modelId !== null
  const voicesQuery = useQuery({
    queryKey: ['spark', 'voice-profiles', channelId, narrowed ? modelId : null, narrowed ? scriptLanguage : null],
    queryFn: ({ signal }) =>
      listVoiceProfiles({ channelId, limit: 100, ...(narrowed ? { modelId: modelId!, language: scriptLanguage! } : {}) }, { signal }),
    enabled: open && state !== undefined && state.enabled,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const profiles = React.useMemo<VoiceProfile[]>(() => voicesQuery.data?.data ?? [], [voicesQuery.data])
  const voices = React.useMemo(() => filterVoices(profiles, { tab, search }), [profiles, tab, search])
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null
  const selectedSpeaks = selected ? profileSpeaks(selected, scriptLanguage) : false

  // ---------------------------------------------------------------- the flow
  const [flow, setFlow] = React.useState<SceneVoiceFlow>({ kind: 'idle' })
  const token = React.useRef(0)
  const flowRef = React.useRef(flow)
  React.useLayoutEffect(() => {
    flowRef.current = flow
  })

  // Another scene was picked: what was open for the old one (picker, price, error) does not follow.
  const previousScene = React.useRef(sceneId)
  React.useEffect(() => {
    if (previousScene.current === sceneId) return
    previousScene.current = sceneId
    stopPreview()
    setOpenState(false)
    if (flowRef.current.kind !== 'starting') {
      token.current += 1
      setFlow({ kind: 'idle' })
    }
  }, [sceneId, stopPreview])

  const quote = async (scope: VoiceScope, voiceId: string, priceChanged = false) => {
    const current = state
    if (!current) return
    const sceneIds = scope === 'scene' ? [latest.current.sceneId] : allScenesAvailability(current).ok ? narratedSceneIds(current) : []
    if (sceneIds.length === 0) return
    const mine = ++token.current
    setFlow({ kind: 'quoting', scope })
    try {
      const result = await quoteNarrationVoice(latest.current.projectId, { sceneIds, voiceProfileId: voiceId })
      if (token.current !== mine) return
      setFlow({ kind: 'quote', scope, voiceId, quote: result, key: newKey(), priceChanged })
    } catch (error) {
      if (token.current !== mine) return
      setFlow({ kind: 'error', failure: classifyNarrationVoiceError(error) })
    }
  }

  /** The run this row shows: the job the server reports for the scene, or the one just started here (until the state catches up). */
  const [startedRunId, setStartedRunId] = React.useState<string | null>(null)
  const runId = thisScene?.job?.production_run_id ?? startedRunId
  const runQuery = useNarrationVoiceRun(projectId, runId, { poll: false })
  const runFinished = runQuery.data?.state === 'done'
  const running = runId !== null && !runFinished && !runQuery.isError
  const runTotal = runQuery.data?.scenes.length ?? 0
  const runReady = runQuery.data?.scenes.filter((scene) => scene.state === 'applied').length ?? 0

  const confirm = async () => {
    const current = flowRef.current
    if (current.kind !== 'quote' || current.quote.billable_scenes === 0) return
    const mine = ++token.current
    setFlow({ kind: 'starting', scope: current.scope })
    const sceneIds = current.quote.scenes.map((scene) => scene.scene_id)
    try {
      const result = await requestNarrationVoice(latest.current.projectId, {
        sceneIds,
        voiceProfileId: current.voiceId,
        expectedCredits: current.quote.total_credits,
        idempotencyKey: current.key,
      })
      if (token.current !== mine) return
      const stopped = result.scenes.filter((scene) => scene.state === 'not_started')
      if (stopped.length > 0) latest.current.toast(latest.current.t('partialStart', { count: stopped.length }), 'error')
      setFlow({ kind: 'idle' })
      if (result.started === 0 || !result.production_run_id) {
        latest.current.toast(latest.current.t('nothingStarted'), 'error')
        return
      }
      setOpen(false)
      setStartedRunId(result.production_run_id)
      // The server now reports the job: the editor-level watcher picks it up from the state.
      await queryClient.invalidateQueries({ queryKey: voiceStatePrefix(latest.current.projectId) })
    } catch (error) {
      if (token.current !== mine) return
      const failure = classifyNarrationVoiceError(error)
      if (failure === 'quote_changed') {
        // The price moved between the quote and the confirmation: show the new price, never start at a different one.
        await quote(current.scope, current.voiceId, true)
        return
      }
      // The answer may have been lost after the server started the job: read the state, which names a running job.
      if (failure === 'offline' || failure === 'unknown') void queryClient.invalidateQueries({ queryKey: voiceStatePrefix(latest.current.projectId) })
      setFlow({ kind: 'error', failure })
    }
  }

  const cancel = () => {
    token.current += 1
    setFlow({ kind: 'idle' })
  }

  return {
    stateQuery,
    state,
    thisScene,
    scriptLanguage,
    modelId,
    allScenes,
    open,
    setOpen,
    tab,
    setTab,
    search,
    setSearch,
    languageMode,
    setLanguageMode,
    voicesQuery,
    voices,
    selected,
    selectedId,
    selectedSpeaks,
    select: (profile: VoiceProfile) => setSelectedId(profile.id),
    playingId,
    previewFailed,
    togglePreview,
    flow,
    running,
    runTotal,
    runReady,
    applyToScene: () => selectedId && void quote('scene', selectedId),
    applyToAll: () => selectedId && void quote('all', selectedId),
    confirm: () => void confirm(),
    cancel,
    dismissError: () => setFlow({ kind: 'idle' }),
  }
}

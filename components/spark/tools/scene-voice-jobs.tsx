'use client'

import * as React from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  MAX_WATCH_MS,
  runReadStopped,
  runningJobsOf,
  useHasQueryClient,
  useNarrationVoiceRun,
  useNarrationVoiceState,
  voiceRunNotice,
  voiceStatePrefix,
} from './narration-voice-queries'
import type { SparkToolContext } from './spark-tool-types'

/** Runs whose end was already announced (per query cache): a run is never announced twice, even when its watcher mounts again. */
const announcedRuns = new WeakMap<QueryClient, Set<string>>()
function announcedOf(client: QueryClient): Set<string> {
  let found = announcedRuns.get(client)
  if (!found) {
    found = new Set()
    announcedRuns.set(client, found)
  }
  return found
}

/**
 * E1-K editor-level watcher of the scene voice changes. It is mounted by the shell for as long as the editor is open (the
 * scene panel comes and goes with the selection, so it cannot own this): every voice job the server reports (started
 * here, in another tab, or before a reload) is read until it ends; each scene whose narration was replaced makes the
 * editor re-read the working copy (the stage then plays the new narration), and the end of a run raises ONE notice.
 * Renders nothing.
 */
export function SceneVoiceJobs({ ctx }: { ctx: SparkToolContext }) {
  return useHasQueryClient() ? <WatchedJobs ctx={ctx} /> : null
}

function WatchedJobs({ ctx }: { ctx: SparkToolContext }) {
  const state = useNarrationVoiceState(ctx.project.id, ctx.document)
  const reported = runningJobsOf(state.data)
  // A run is followed from the moment the server reports it until its end has been read here. The state can stop naming
  // the run first (the server clears the jobs when the run ends, and the state is read again whenever a narration changes,
  // e.g. right after the first scene of the run was applied): the run is still read to its end, so its ONE notice is
  // raised and the Voice row leaves its running view.
  const [followed, setFollowed] = React.useState<{ reported: string; ids: readonly string[] }>({ reported: '', ids: [] })
  const reportedKey = reported.join(' ')
  if (followed.reported !== reportedKey) {
    // The state named other runs: the new ones are followed from now on (adjusted while rendering, no extra commit).
    setFollowed((current) => ({ reported: reportedKey, ids: [...current.ids, ...reported.filter((id) => !current.ids.includes(id))] }))
  }
  const ended = (runId: string) =>
    setFollowed((current) => (current.ids.includes(runId) ? { ...current, ids: current.ids.filter((id) => id !== runId) } : current))
  const runIds = [...new Set([...followed.ids, ...reported])]
  return (
    <>
      {runIds.map((runId) => (
        <RunWatcher key={runId} runId={runId} ctx={ctx} onEnded={ended} />
      ))}
    </>
  )
}

function RunWatcher({ runId, ctx, onEnded }: { runId: string; ctx: SparkToolContext; onEnded: (runId: string) => void }) {
  const t = useTranslations('Spark.editor.sceneVoice')
  const queryClient = useQueryClient()
  const projectId = ctx.project.id
  const [since] = React.useState(() => Date.now())
  const [giveUp, setGiveUp] = React.useState(false)
  const run = useNarrationVoiceRun(projectId, runId, { poll: true, enabled: !giveUp })

  // The long-lived effects below read the latest context, translator and end callback through a ref.
  const latest = React.useRef({ ctx, t, onEnded })
  React.useLayoutEffect(() => {
    latest.current = { ctx, t, onEnded }
  })

  const applied = run.data?.scenes.filter((scene) => scene.state === 'applied').length ?? 0
  const done = run.data?.state === 'done'
  const seen = React.useRef(0)
  React.useEffect(() => {
    if (applied > seen.current) {
      seen.current = applied
      void latest.current.ctx.actions.refresh?.()
    }
  }, [applied])

  React.useEffect(() => {
    const announced = announcedOf(queryClient)
    if (!done || !run.data || announced.has(runId)) return
    announced.add(runId)
    const notice = voiceRunNotice(run.data, (key, values) => (latest.current.t as unknown as (k: string, v?: Record<string, string | number>) => string)(key, values))
    if (notice.text) latest.current.ctx.toast(notice.text, notice.tone)
    // The server no longer reports the job: the state is read again so the Voice row leaves its running view.
    void queryClient.invalidateQueries({ queryKey: voiceStatePrefix(projectId) })
  }, [done, run.data, runId, projectId, queryClient])

  React.useEffect(() => {
    if (done || giveUp) return undefined
    const timer = window.setTimeout(() => {
      setGiveUp(true)
      latest.current.ctx.toast(latest.current.t('watchStopped'), 'error')
    }, Math.max(0, MAX_WATCH_MS - (Date.now() - since)))
    return () => window.clearTimeout(timer)
  }, [done, giveUp, since])

  // A failed read: the state is read again (the Voice row leaves its running view once the server no longer reports the job).
  const failed = run.isError
  React.useEffect(() => {
    if (failed) void queryClient.invalidateQueries({ queryKey: voiceStatePrefix(projectId) })
  }, [failed, projectId, queryClient])

  // The watch is over when the run's end was read, when the server will say nothing more about the run (it does not know it,
  // or this user may not read it) or when the editor gave up: from then on the run is followed only while the state names it.
  const stopped = failed && runReadStopped(run.error)
  React.useEffect(() => {
    if (done || stopped || giveUp) latest.current.onEnded(runId)
  }, [done, stopped, giveUp, runId])

  return null
}

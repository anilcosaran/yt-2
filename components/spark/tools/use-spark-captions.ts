'use client'

import * as React from 'react'

import {
  bindCaptionTranscript,
  captionFailureOf,
  listCaptionSources,
  listCaptionStyles,
  quoteCaptions,
  requestCaptions,
  type CaptionFailure,
  type CaptionQuote,
  type CaptionSource,
  type CaptionSources,
  type CaptionStyle,
} from '@/lib/spark/captions-client'

/**
 * E1-G the state of the Captions drawer: the captionable sources of the project with the state of their transcripts and
 * tracks (server state, re-read while a transcription runs and whenever the working copy changes), the per-source flow
 * (price -> confirm -> running) and the four looks. Nothing is persisted in the browser: a closed tab loses nothing, the
 * job and the track live on the server and the drawer reads them back.
 *
 * The finished transcript is bound to the track by the server (the P03-06 handoff job); when the drawer sees a ready
 * transcript for a source the user started, it binds it at once itself (idempotent, free) so the track does not wait for
 * the job's next turn, then re-reads the working copy.
 */

const POLL_MS = 3000
/** A `failed` transcript only counts after the job was seen running, or after this long (an older failed attempt may exist). */
const FAILED_GRACE_MS = 45_000
/** A request the drawer waits for is dropped from its own watch list after this long (the server keeps going). */
const WATCH_MS = 20 * 60_000

export type SourceFlow =
  | { phase: 'quoting' }
  /** `unsure`: the last confirmation got no answer (network, timeout, server error): confirming again is safe, the server hands back a launch that did start. */
  | { phase: 'quote'; quote: CaptionQuote; key: string; changed: boolean; unsure?: boolean }
  | { phase: 'starting'; quote: CaptionQuote }
  | { phase: 'error'; failure: CaptionFailure }

export type CaptionsTrackRef = { caption_track_id: string; style_ref?: { brand_asset_id?: string } | null }

export type UseSparkCaptionsInput = {
  projectId: string
  /** The working copy's version: a change re-reads the sources (a track was added or removed). */
  documentVersion: number | null
  /** Re-reads the working copy (the session's `refresh`); absent in a read-only editor. */
  refresh?: () => Promise<void>
  /** Called once a source's captions are on (a track exists for a source the user started). */
  onCaptionsOn?: (source: CaptionSource) => void
  onStarted?: (source: CaptionSource) => void
  onFailed?: (source: CaptionSource) => void
}

type Watch = { startedAt: number; sawProcessing: boolean; binding: boolean }

function newKey(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

export function useSparkCaptions(input: UseSparkCaptionsInput) {
  const { projectId, documentVersion } = input
  const [sources, setSources] = React.useState<CaptionSources | null>(null)
  const [styles, setStyles] = React.useState<CaptionStyle[]>([])
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [flows, setFlows] = React.useState<Record<string, SourceFlow>>({})
  // Sources whose launch was requested or runs: the drawer keeps Add closed for them until the track exists (T1R-1).
  const [watchedIds, setWatchedIds] = React.useState<readonly string[]>([])
  const watching = watchedIds.length
  const watches = React.useRef(new Map<string, Watch>())
  const callbacks = React.useRef(input)
  // The confirm step reads the latest flows/sources without being re-created on every render.
  const flowsRef = React.useRef(flows)
  const sourcesRef = React.useRef(sources)
  React.useEffect(() => {
    callbacks.current = input
    flowsRef.current = flows
    sourcesRef.current = sources
  })

  const setFlow = React.useCallback((sourceId: string, flow: SourceFlow | null) => {
    setFlows((current) => {
      const next = { ...current }
      if (flow) next[sourceId] = flow
      else delete next[sourceId]
      return next
    })
  }, [])

  const unwatch = React.useCallback((sourceId: string) => {
    if (watches.current.delete(sourceId)) setWatchedIds([...watches.current.keys()])
  }, [])

  const reload = React.useCallback(async (): Promise<CaptionSources | null> => {
    try {
      const next = await listCaptionSources(projectId)
      setSources(next)
      setStatus('ready')
      const now = Date.now()
      for (const source of next.sources) {
        const watch = watches.current.get(source.source_id)
        if (!watch) continue
        if (source.track) {
          unwatch(source.source_id)
          await callbacks.current.refresh?.()
          callbacks.current.onCaptionsOn?.(source)
        } else if (source.transcript.state === 'ready' && source.transcript.artifact_id && source.transcript.artifact_revision && !watch.binding) {
          // The job is done: bind the transcript now (free, idempotent) instead of waiting for the server's handoff turn.
          watch.binding = true
          try {
            await bindCaptionTranscript(projectId, {
              sourceId: source.source_id,
              artifactId: source.transcript.artifact_id,
              artifactRevision: source.transcript.artifact_revision,
              idempotencyKey: `capbind-${source.source_id}-${source.transcript.artifact_id}-${source.transcript.artifact_revision}`.slice(0, 120),
            })
            await callbacks.current.refresh?.()
            const bound = await listCaptionSources(projectId)
            setSources(bound)
            unwatch(source.source_id)
            const done = bound.sources.find((candidate) => candidate.source_id === source.source_id)
            if (done?.track) callbacks.current.onCaptionsOn?.(done)
          } catch (error) {
            watch.binding = false
            setFlow(source.source_id, { phase: 'error', failure: captionFailureOf(error) })
            unwatch(source.source_id)
          }
        } else if (source.transcript.state === 'processing') {
          watch.sawProcessing = true
        } else if (source.transcript.state === 'failed' && (watch.sawProcessing || now - watch.startedAt > FAILED_GRACE_MS)) {
          unwatch(source.source_id)
          setFlow(source.source_id, { phase: 'error', failure: 'unknown' })
          callbacks.current.onFailed?.(source)
        } else if (now - watch.startedAt > WATCH_MS) {
          unwatch(source.source_id)
        }
      }
      return next
    } catch {
      setStatus((current) => (current === 'ready' ? current : 'error'))
      return null
    }
  }, [projectId, setFlow, unwatch])

  // First read, and a re-read whenever the working copy changed (a track was added, removed or restyled).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Server state is read into the drawer when it opens and when the working copy changes.
    void reload()
  }, [reload, documentVersion])

  React.useEffect(() => {
    let cancelled = false
    void listCaptionStyles()
      .then((result) => {
        if (!cancelled) setStyles(result.enabled ? result.styles : [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const processing = sources?.sources.some((source) => source.transcript.state === 'processing' && !source.track) ?? false
  React.useEffect(() => {
    if (!processing && watching === 0) return undefined
    const timer = window.setInterval(() => void reload(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [processing, watching, reload])

  const begin = React.useCallback(
    async (sourceId: string) => {
      setFlow(sourceId, { phase: 'quoting' })
      try {
        const quote = await quoteCaptions(projectId, { sourceId })
        if (quote.state === 'processing') {
          setFlow(sourceId, null)
          watches.current.set(sourceId, { startedAt: Date.now(), sawProcessing: true, binding: false })
          setWatchedIds([...watches.current.keys()])
          await reload()
          return
        }
        setFlow(sourceId, { phase: 'quote', quote, key: newKey('captions'), changed: false })
      } catch (error) {
        setFlow(sourceId, { phase: 'error', failure: captionFailureOf(error) })
      }
    },
    [projectId, reload, setFlow],
  )

  const confirm = React.useCallback(
    async (sourceId: string) => {
      const flow = flowsRef.current[sourceId]
      if (!flow || flow.phase !== 'quote') return
      setFlow(sourceId, { phase: 'starting', quote: flow.quote })
      try {
        // The confirmed price is always sent, 0 for a free one: the server launches a paid job only against the price the
        // user saw, so a transcript that stopped being usable meanwhile asks again instead of charging (T1R-2).
        const result = await requestCaptions(projectId, {
          sourceId,
          expectedCredits: flow.quote.estimated_credits,
          idempotencyKey: flow.key,
        })
        setFlow(sourceId, null)
        const source = sourcesRef.current?.sources.find((candidate) => candidate.source_id === sourceId)
        if (result.state === 'bound') {
          await callbacks.current.refresh?.()
          const fresh = await reload()
          const done = fresh?.sources.find((candidate) => candidate.source_id === sourceId)
          if (done) callbacks.current.onCaptionsOn?.(done)
          return
        }
        watches.current.set(sourceId, { startedAt: Date.now(), sawProcessing: false, binding: false })
        setWatchedIds([...watches.current.keys()])
        if (source) callbacks.current.onStarted?.(source)
        await reload()
      } catch (error) {
        const failure = captionFailureOf(error)
        if (failure === 'quote_changed') {
          // The price moved: show the new price and ask again (a new confirmation, a new idempotency key).
          try {
            const quote = await quoteCaptions(projectId, { sourceId })
            setFlow(sourceId, { phase: 'quote', quote, key: newKey('captions'), changed: true })
            return
          } catch (again) {
            setFlow(sourceId, { phase: 'error', failure: captionFailureOf(again) })
            return
          }
        }
        if (failure === 'unknown') {
          // No answer (network, timeout, server error): whether the job started is unknown. The same quote and key stay on
          // screen; confirming again is safe because the server hands back a launch that did start (T1R-1).
          setFlow(sourceId, { phase: 'quote', quote: flow.quote, key: flow.key, changed: false, unsure: true })
          return
        }
        setFlow(sourceId, { phase: 'error', failure })
      }
    },
    [projectId, reload, setFlow],
  )

  const cancel = React.useCallback((sourceId: string) => setFlow(sourceId, null), [setFlow])

  const watched = React.useMemo(() => new Set(watchedIds), [watchedIds])

  return { status, sources, styles, flows, watched, begin, confirm, cancel, reload }
}

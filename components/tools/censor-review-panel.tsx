'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStorageDeliveryUrl } from '@/lib/storage/api'
import { estimateWorkflowAgent, getWorkflowAgentStatus, launchWorkflowAgent } from '@/lib/workflows/api'
import { getCensorReview, getCensorSubtitles, saveCensorReview, type CensorOperation, type CensorReview } from '@/lib/workflows/censor-review'

export function CensorReviewPanel({ channelId, objectId, status, count = 0, onCompleted }: {
  channelId: string; objectId: string; status: string; count?: number
  onCompleted?: (objectId: string, status: string, count: number) => void
}) {
  const t = useTranslations('Auto')
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState<CensorReview | null>(null)
  const [draftGeneration, setDraftGeneration] = useState(0)
  const [operations, setOperations] = useState<CensorOperation[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [estimate, setEstimate] = useState<{ revision: number; credits: number } | null>(null)
  const [run, setRun] = useState<string | null>(null)
  const [playback, setPlayback] = useState<{ url: string; start: number; end: number; output: boolean; request: number } | null>(null)
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const video = useRef<HTMLVideoElement | null>(null)
  const playbackRequest = useRef(0)
  const replay = useRef<{ signature: string; key: string } | null>(null)
  const onCompletedRef = useRef(onCompleted)
  useEffect(() => { onCompletedRef.current = onCompleted }, [onCompleted])

  function applyReview(data: CensorReview) {
    setReview(data)
    if (data.completed_output_object_id !== objectId && data.completed_status) {
      onCompletedRef.current?.(data.completed_output_object_id, data.completed_status, data.completed_summary?.applied_count ?? 0)
    }
  }
  async function load(signal?: AbortSignal) {
    const data = await getCensorReview(channelId, objectId, 0, signal)
    if (!signal?.aborted) applyReview(data)
    return data
  }
  useEffect(() => {
    if (!open) { video.current?.pause(); return }
    const controller = new AbortController()
    void getCensorReview(channelId, objectId, 0, controller.signal)
      .then((data) => { if (!controller.signal.aborted) applyReview(data) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => {
      controller.abort()
      playbackRequest.current += 1
      video.current?.pause()
    }
    // Object and channel identity define this private review session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, objectId, channelId])

  useEffect(() => {
    if (!run) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const result = await getWorkflowAgentStatus(run!, { signal: controller.signal })
        if (controller.signal.aborted) return
        if (['completed', 'succeeded', 'success'].includes(result.status)) {
          await load(controller.signal)
          setRun(null)
          setEstimate(null)
        } else if (['failed', 'cancelled', 'canceled'].includes(result.status)) {
          setError(true)
          setRun(null)
        } else timer = setTimeout(() => void poll(), 3000)
      } catch { if (!controller.signal.aborted) { setError(true); setRun(null) } }
    }
    void poll()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, channelId, objectId])

  function queue(operation: CensorOperation) {
    setOperations((current) => [...current, operation])
    setEstimate(null)
    setError(false)
  }
  async function saveAndEstimate() {
    if (!review || busy || run) return
    setBusy(true); setError(false)
    try {
      let revision = review.revision
      if (operations.length) {
        const signature = JSON.stringify([review.revision, operations])
        if (replay.current?.signature !== signature) replay.current = { signature, key: crypto.randomUUID() }
        const saved = await saveCensorReview(channelId, objectId, review.revision, operations, replay.current.key)
        revision = saved.revision
        setOperations([])
        await load()
      }
      const quote = await estimateWorkflowAgent({ channelId, nodeType: 'media_transform@1',
        params: { storage_object_id: objectId, censor_review_revision: revision } })
      setEstimate({ revision, credits: quote.total_credits_estimated })
    } catch { setError(true) } finally { setBusy(false) }
  }
  async function launch() {
    if (!estimate || busy || run) return
    setBusy(true); setError(false)
    try {
      const result = await launchWorkflowAgent({ projectId: channelId, channelId, nodeType: 'media_transform@1',
        params: { storage_object_id: objectId, censor_review_revision: estimate.revision },
        idempotencyKey: `censor-render:${objectId}:${estimate.revision}` })
      setRun(result.agent_id)
    } catch { setError(true) } finally { setBusy(false) }
  }
  async function listen(start: number, end: number, output = false) {
    if (!review) return
    const request = ++playbackRequest.current
    video.current?.pause()
    setError(false)
    try {
      const delivery = await getStorageDeliveryUrl({ channelId, objectId: output ? review.completed_output_object_id : review.source_storage_object_id, variant: 'original' })
      if (request !== playbackRequest.current) return
      setPlayback({ url: delivery.url, start: Math.max(0, start - 0.3), end: end + 0.3, output, request })
    } catch { if (request === playbackRequest.current) setError(true) }
  }
  const statusKey = ['off', 'applied', 'no_matches', 'needs_review', 'failed'].includes(status) ? status : 'failed'
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(false) }}>
    <DialogTrigger asChild><button type="button" className="w-full min-w-0 px-2.5 py-2 text-left text-xs leading-5 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
      {t(`censor_review_${statusKey}`, { count })} · {t('censor_review_open')}
    </button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] min-w-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{t('censor_review_title')}</DialogTitle><DialogDescription>{t('censor_review_source_clock')}</DialogDescription></DialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{t('censor_review_error')}</p> : null}
      {!review ? <p role="status">{t('censor_review_loading')}</p> : <>
        <p role="status" className="text-xs text-muted-foreground">{run ? t('censor_review_rendering') : operations.length || review.revision > review.completed_revision ? t('censor_review_draft') : t('censor_review_ready', { revision: review.completed_revision })}</p>
        <Button variant="outline" size="sm" onClick={() => void listen(review.source_spans[0]?.start_sec ?? 0, review.source_spans[0]?.end_sec ?? review.source_duration_sec)}>{t('censor_review_source_open')}</Button>
        {playback ? <p className="text-xs text-muted-foreground">{t(playback.output ? 'censor_review_output_playback' : 'censor_review_source_playback')}</p> : null}
        {playback ? <video key={playback.request} ref={video} controls src={playback.url} className="aspect-video w-full rounded-lg bg-black"
          onLoadedMetadata={(event) => {
            if (playback.request !== playbackRequest.current) return
            event.currentTarget.currentTime = playback.start
            void event.currentTarget.play().catch(() => { if (playback.request === playbackRequest.current) setError(true) })
          }}
          onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= playback.end) event.currentTarget.pause() }} /> : null}
        {review.subtitles_available && !['needs_review', 'failed'].includes(review.completed_status ?? status) ? <div className="flex gap-2">
          {(['srt', 'vtt'] as const).map((format) => <Button key={format} size="sm" variant="outline" disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              const subtitle = await getCensorSubtitles(channelId, review.completed_output_object_id, format)
              const href = URL.createObjectURL(new Blob([subtitle.text], { type: format === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8' }))
              const anchor = document.createElement('a'); anchor.href = href; anchor.download = subtitle.file_name; anchor.click()
              setTimeout(() => URL.revokeObjectURL(href), 1000)
            } catch { setError(true) } finally { setBusy(false) }
          }}>{t('censor_review_download_subtitles', { format: format.toUpperCase() })}</Button>)}
        </div> : null}
        <div className="min-w-0 space-y-3">
          {review.events.map((event) => <CensorEventRow key={`${review.revision}:${draftGeneration}:${event.event_id}`} event={event} disabled={busy || Boolean(run)}
            queue={queue} listen={listen} outputReady={!['needs_review', 'failed'].includes(review.completed_status ?? status)} />)}
          {review.has_more ? <Button variant="outline" disabled={busy} onClick={async () => {
            setBusy(true)
            try { const more = await getCensorReview(channelId, objectId, review.events.length, undefined, review.revision); setReview({ ...more, events: [...review.events, ...more.events] }) }
            catch { setError(true) } finally { setBusy(false) }
          }}>{t('censor_review_more')}</Button> : null}
        </div>
        <fieldset disabled={busy || Boolean(run)} className="min-w-0 space-y-2 rounded-lg border p-3">
          <legend className="px-1 text-sm">{t('censor_review_add')}</legend>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <label className="min-w-0 text-xs">{t('censor_review_start')}<Input type="number" min="0" step="0.01" value={manualStart} onChange={(e) => setManualStart(e.target.value)} /></label>
            <label className="min-w-0 text-xs">{t('censor_review_end')}<Input type="number" min="0" step="0.01" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} /></label>
          </div>
          <Button size="sm" variant="outline" disabled={!manualStart || !manualEnd || Number(manualEnd) <= Number(manualStart)} onClick={() => {
            queue({ action: 'add', start_sec: Number(manualStart), end_sec: Number(manualEnd) }); setManualStart(''); setManualEnd('')
          }}>{t('censor_review_censor')}</Button>
        </fieldset>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button disabled={busy || Boolean(run) || operations.length === 0 && review.revision === review.completed_revision} onClick={() => void saveAndEstimate()}>{t('censor_review_save_estimate')}</Button>
          <Button variant="outline" disabled={busy || Boolean(run)} onClick={() => queue({ action: 'disable' })}>{t('censor_review_disable')}</Button>
          {operations.length > 0 ? <Button variant="ghost" disabled={busy || Boolean(run)} onClick={() => { setOperations([]); setEstimate(null); replay.current = null; setDraftGeneration((value) => value + 1) }}>{t('censor_review_discard')}</Button> : null}
        </div>
        {estimate ? <Button disabled={busy || Boolean(run)} onClick={() => void launch()}>{t('censor_review_launch', { credits: estimate.credits })}</Button> : null}
      </>}
    </DialogContent>
  </Dialog>
}

function CensorEventRow({ event, disabled, queue, listen, outputReady }: {
  event: CensorReview['events'][number]; disabled: boolean; outputReady: boolean
  queue: (operation: CensorOperation) => void; listen: (start: number, end: number, output?: boolean) => Promise<void>
}) {
  const t = useTranslations('Auto')
  const [start, setStart] = useState(String(event.source_interval?.start_sec ?? ''))
  const [end, setEnd] = useState(String(event.source_interval?.end_sec ?? ''))
  const [decision, setDecision] = useState(event.decision)
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-lg border p-3">
    <p className="break-words text-sm">{event.context ?? t('censor_review_untimed')}</p>
    {event.reason_code ? <p className="text-xs text-amber-700 dark:text-amber-300">{t('censor_review_needs_review', { count: 0 })}</p> : null}
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <label className="min-w-0 text-xs">{t('censor_review_start')}<Input type="number" min="0" step="0.01" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label className="min-w-0 text-xs">{t('censor_review_end')}<Input type="number" min="0" step="0.01" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!start || !end || Number(end) <= Number(start)} onClick={() => { queue({ action: 'adjust', event_id: event.event_id, start_sec: Number(start), end_sec: Number(end) }); setDecision('censor') }}>{t('censor_review_adjust')}</Button>
      <Button size="sm" variant="outline" onClick={() => { queue({ action: decision === 'censor' ? 'ignore' : 'restore', event_id: event.event_id }); setDecision(decision === 'censor' ? 'ignore' : 'censor') }}>{t(decision === 'censor' ? 'censor_review_ignore' : 'censor_review_censor')}</Button>
      {outputReady && event.output_intervals.length > 0 ? <Button size="sm" variant="ghost" onClick={() => void listen(event.output_intervals[0]!.start_sec, event.output_intervals[0]!.end_sec, true)}>{t('censor_review_output_listen')}</Button> : null}
      <Button size="sm" variant="ghost" disabled={!start || !end} aria-label={t('censor_review_listen')} onClick={() => void listen(Number(start), Number(end))}><Play className="size-4" /></Button>
    </div>
  </fieldset>
}

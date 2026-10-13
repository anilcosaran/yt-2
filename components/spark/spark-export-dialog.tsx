'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import type { SparkExport, SparkExportQuote } from '@/lib/spark/export-client'
import { sparkExportTerminalStatuses } from '@/lib/spark/export-client'
import type { SparkExportFailure, SparkExportState } from '@/lib/spark/export-session'
import { getStorageDownloadUrl } from '@/lib/storage/api'

import { StudioIcon } from './studio-icon'
import './spark-export-dialog.css'

/** Reason keys the gateway's preflight sends (`composition-export-preflight.rules.ts`); anything else shows its own text. */
const KNOWN_REASON_KEYS: ReadonlySet<string> = new Set([
  'video_layer', 'captions', 'motion', 'overlays', 'crop', 'global_clip_span', 'shape', 'media_kind', 'image_unavailable',
  'image_changed', 'image_too_large', 'font', 'operation_running', 'timing_unresolved', 'timing_cycle', 'animation_overlap',
  'animation_outside_scene', 'layer_outside_scene', 'text_layout', 'canvas', 'compile_refused',
  // E1-C Motion overlay reasons (the gateway names them per layer): camera, word timing, format, length, availability, content.
  'motion_camera', 'motion_timing', 'motion_format', 'motion_length', 'motion_unavailable', 'motion_content',
  // E1-G caption reasons: track unreadable, text or font not drawable, captions over a Motion-only scene.
  'captions_unavailable', 'captions_text', 'captions_font', 'captions_motion_scene',
  // R2: what footage and sound can still be refused for.
  'video_source', 'video_animation', 'video_composite', 'audio_placement',
  // E1-L scene transitions (their texts live in `Spark.transitions.json`).
  'transitions', 'transition_camera', 'transition_content', 'transition_anchor', 'transition_invalid', 'transition_video',
])
const KNOWN_FAILURE_CODES: ReadonlySet<string> = new Set([
  'COMPOSITION_RENDERER_PIN_MISSING', 'COMPOSITION_EXPORT_NOT_EXPORTABLE', 'COMPOSITION_EXPORT_TIMING_UNRESOLVED',
  'COMPOSITION_EXPORT_CANVAS_UNSUPPORTED', 'COMPOSITION_EXPORT_TOO_LONG', 'COMPOSITION_EXPORT_EMPTY',
  'COMPOSITION_EXPORT_PROFILE_NOT_ENABLED', 'COMPOSITION_EXPORT_ATTEMPT_LIMIT', 'COMPOSITION_EXPORT_QUOTE_CHANGED',
  'COMPOSITION_EXPORT_IDEMPOTENCY_CONFLICT', 'COMPOSITION_EXPORT_STATE_CONFLICT', 'COMPOSITION_PROJECT_FORBIDDEN',
  'COMPOSITION_PROJECT_NOT_FOUND', 'NETWORK',
])
const KNOWN_QUEUE_REASONS: ReadonlySet<string> = new Set([
  'tenant_daily_render_output_limit', 'render_output_exceeds_daily_limit', 'tenant_launch_queue_full', 'tenant_launch_parked',
  'waiting_for_credit', 'render_capacity_busy', 'tenant_node_concurrency_limit', 'tenant_api_pool_share_limit', 'tenant_run_share_limit',
])
const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  'render_qc_failed', 'render_segment_qc_failed', 'frame_qc_rejected', 'composition_revision_not_compilable',
  'composition_render_manifest_mismatch', 'composition_media_not_rendered', 'composition_media_unavailable', 'composition_media_changed',
  'composition_media_unreadable', 'render_audio_qc_failed', 'node_progress_stall', 'render_capacity_wait_expired',
  'renderer_unavailable', 'output_profile_not_enabled', 'render_canvas_unsupported',
])
const MAX_REASONS_SHOWN = 5

/** m:ss for a length in seconds. */
export function formatExportLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** "5.0 MB" style size, decimal megabytes. */
export function formatExportSize(bytes: number, locale: string): string {
  const megabytes = bytes / 1_000_000
  const digits = megabytes >= 100 ? 0 : 1
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(megabytes)} MB`
}

/**
 * Y1-07 W10: the export dialog (design `.modal-bg` / `.modal` shell with the media modal's `.mm-foot`; recommended option
 * V9 of the evidence report), opened by the editor's primary "Generate" button. It is a pure view of the export session:
 * price (the exact quote the click approves) -> progress (status, lane, the reason and expiry of a wait, percent) -> result
 * (download, or the honest reason nothing was produced and that nothing was charged).
 */
export function SparkExportDialog({
  state,
  channelId,
  projectTitle,
  onAccept,
  onCancel,
  onRestart,
  onClose,
}: {
  state: SparkExportState
  channelId: string
  projectTitle: string
  onAccept: () => void
  onCancel: () => void
  onRestart: () => void
  onClose: () => void
}) {
  const t = useTranslations('Spark.editor.export')
  const locale = useLocale()
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const exportJob = state.export
  const running = state.phase === 'requesting' || (state.phase === 'tracking' && exportJob !== null && !sparkExportTerminalStatuses.has(exportJob.status))

  // Escape closes (the export itself keeps going on the server); Tab stays inside the dialog.
  React.useEffect(() => {
    const dialog = dialogRef.current
    dialog?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const credits = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)
  const when = (iso: string) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }

  return (
    <div
      className="modal-bg"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal exp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-title"
        aria-busy={running || state.phase === 'quoting'}
        tabIndex={-1}
      >
        <div className="modal-h">
          <h3 id="exp-title">{t('title')}</h3>
          <button type="button" className="ib sm" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <StudioIcon name="x" />
          </button>
        </div>
        <div className="exp-body" aria-live="polite">
          <ExportBody state={state} t={t} credits={credits} when={when} locale={locale} />
        </div>
        <div className="mm-foot exp-foot">
          <ExportActions state={state} t={t} credits={credits} onAccept={onAccept} onCancel={onCancel} onRestart={onRestart} onClose={onClose} channelId={channelId} projectTitle={projectTitle} />
        </div>
      </div>
    </div>
  )
}

type T = ReturnType<typeof useTranslations>

function ExportBody({
  state,
  t,
  credits,
  when,
  locale,
}: {
  state: SparkExportState
  t: T
  credits: (value: number) => string
  when: (iso: string) => string
  locale: string
}) {
  const { phase, quote, export: job, failure } = state
  if (phase === 'idle' || phase === 'quoting') {
    return (
      <div className="exp-wait" role="status">
        <span className="spin" aria-hidden />
        <span>{t('quoting')}</span>
      </div>
    )
  }
  if (phase === 'quote_failed' && failure) return <ExportFailure failure={failure} t={t} when={when} />
  if ((phase === 'quoted' || phase === 'requesting') && quote) {
    return (
      <>
        {failure ? (
          <p className="exp-note" role="alert">
            {knownFailureText(failure, t)}
          </p>
        ) : null}
        <QuoteSummary quote={quote} t={t} credits={credits} />
        {quote.renderer.available ? (
          <p className="exp-note">{t('consent')}</p>
        ) : (
          <div className="exp-note" role="alert">
            <b>{t('rendererUnavailableTitle')}</b>
            <p>{t('rendererUnavailableBody')}</p>
            {quote.renderer.reason ? <small>{t('result.code', { code: quote.renderer.reason })}</small> : null}
          </div>
        )}
        {phase === 'requesting' ? (
          <div className="exp-wait" role="status">
            <span className="spin" aria-hidden />
            <span>{t('status.authorizing')}</span>
          </div>
        ) : null}
      </>
    )
  }
  if ((phase === 'tracking' || phase === 'ended') && job) {
    return <ExportProgress job={job} state={state} t={t} credits={credits} when={when} locale={locale} />
  }
  return null
}

function QuoteSummary({ quote, t, credits }: { quote: SparkExportQuote; t: T; credits: (value: number) => string }) {
  const fps = quote.canvas.fps.num / quote.canvas.fps.den
  return (
    <dl className="exp-rows">
      <div>
        <dt>{t('format')}</dt>
        <dd>{t('formatValue', { width: quote.canvas.width, height: quote.canvas.height, fps: Number.isInteger(fps) ? fps : Number(fps.toFixed(2)) })}</dd>
      </div>
      <div>
        <dt>{t('length')}</dt>
        <dd>{formatExportLength(quote.output_seconds)}</dd>
      </div>
      <div>
        <dt>{t('price')}</dt>
        <dd data-export-price>{t('priceValue', { credits: credits(quote.estimated_credits) })}</dd>
      </div>
      {quote.render_plan ? (
        <div>
          <dt>{t('render')}</dt>
          <dd>{t(`lane.${quote.render_plan.lane}`)}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function knownFailureText(failure: SparkExportFailure, t: T): string {
  return KNOWN_FAILURE_CODES.has(failure.code) ? t(`failure.${failure.code}`) : t('failure.generic')
}

function ExportFailure({ failure, t, when }: { failure: SparkExportFailure; t: T; when: (iso: string) => string }) {
  const shown = failure.reasons.slice(0, MAX_REASONS_SHOWN)
  const hidden = Math.max(failure.reasonCount, failure.reasons.length) - shown.length
  return (
    <div className="exp-note" role="alert">
      <b>{t('failureTitle')}</b>
      <p>{knownFailureText(failure, t)}</p>
      {failure.code === 'COMPOSITION_EXPORT_TOO_LONG' && failure.outputSeconds !== null && failure.maxOutputSeconds !== null ? (
        <p>{t('tooLong', { length: formatExportLength(failure.outputSeconds), max: formatExportLength(failure.maxOutputSeconds) })}</p>
      ) : null}
      {failure.code === 'COMPOSITION_EXPORT_ATTEMPT_LIMIT' && failure.retryAfter ? <p>{t('retryAfter', { time: when(failure.retryAfter) })}</p> : null}
      {shown.length > 0 ? (
        <ul className="exp-reasons">
          {shown.map((reason, index) => (
            <li key={`${reason.code}:${reason.layerId ?? reason.sceneId ?? index}`} data-reason-key={reason.reasonKey}>
              {KNOWN_REASON_KEYS.has(reason.reasonKey) ? t(`reason.${reason.reasonKey}`) : reason.message || t('reason.compile_refused')}
            </li>
          ))}
          {hidden > 0 ? <li>{t('failureMoreReasons', { n: hidden })}</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

function ExportProgress({
  job,
  state,
  t,
  credits,
  when,
  locale,
}: {
  job: SparkExport
  state: SparkExportState
  t: T
  credits: (value: number) => string
  when: (iso: string) => string
  locale: string
}) {
  const lane = job.render_lane ?? job.queue?.lane ?? null
  if (job.status === 'completed') {
    const output = job.output
    return (
      <div className="exp-result" role="status">
        <b>{t('result.completedTitle')}</b>
        {output ? <p>{t('result.completedBody', { length: formatExportLength(output.output_seconds), size: formatExportSize(output.size_bytes, locale) })}</p> : <p>{t('result.preparingDownload')}</p>}
      </div>
    )
  }
  if (job.status === 'cancelled') {
    return (
      <div className="exp-result" role="status">
        <b>{t('result.cancelledTitle')}</b>
        <p>{t('result.cancelledBody')}</p>
      </div>
    )
  }
  if (job.status === 'renderer_unavailable') {
    const reason = typeof job.error?.context.reason === 'string' ? job.error.context.reason : null
    return (
      <div className="exp-note" role="alert">
        <b>{t('result.rendererUnavailableTitle')}</b>
        <p>{t('result.rendererUnavailableBody')}</p>
        {reason ? <small>{t('result.code', { code: reason })}</small> : null}
      </div>
    )
  }
  if (job.status === 'funding_required') {
    return (
      <div className="exp-note" role="alert">
        <b>{t('result.fundingTitle')}</b>
        <p>{t('result.fundingBody', { credits: credits(job.price.estimated_credits) })}</p>
      </div>
    )
  }
  if (job.status === 'failed') {
    const code = job.error?.code ?? null
    return (
      <div className="exp-note" role="alert">
        <b>{t('result.failedTitle')}</b>
        <p>{code && KNOWN_ERROR_CODES.has(code) ? t(`error.${code}`) : t('result.failedBody')}</p>
        <p>{t('result.failedBody')}</p>
        {code ? <small>{t('result.code', { code })}</small> : null}
      </div>
    )
  }
  // authorizing / queued / dispatching / rendering
  const queue = job.queue
  const percent = job.status === 'rendering' && typeof job.progress_percent === 'number' ? Math.round(job.progress_percent) : null
  const stopping = state.cancelling || job.cancel_requested === true
  let line: string
  if (stopping) line = t('status.stopping')
  else if (job.status === 'rendering') line = queue ? t('status.waitingForWorker') : percent !== null ? t('status.renderingPercent', { percent }) : t('status.rendering')
  else if (job.status === 'queued') line = t('status.queued')
  else if (job.status === 'dispatching') line = t('status.dispatching')
  else line = t('status.authorizing')
  return (
    <div className="exp-progress" role="status">
      <div className="exp-wait">
        <span className="spin" aria-hidden />
        <span>{line}</span>
      </div>
      {percent !== null && !queue ? (
        <div className="exp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('status.rendering')}>
          <i style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      {queue ? (
        <ul className="exp-queue">
          <li>{KNOWN_QUEUE_REASONS.has(queue.reason) ? t(`queue.reason.${queue.reason}`) : queue.scope ? t(`queue.scope.${queue.scope}`) : t('status.queued')}</li>
          {queue.retry_at ? <li>{t('queue.retryAt', { time: when(queue.retry_at) })}</li> : null}
          {queue.expires_at ? <li>{t('queue.expires', { time: when(queue.expires_at) })}</li> : null}
        </ul>
      ) : null}
      {lane ? <p className="exp-lane">{t('queue.lane', { lane: t(`lane.${lane}`) })}</p> : null}
      {state.pollError ? <p className="exp-note">{t('status.pollError')}</p> : null}
      {state.failure && state.failure.code !== 'COMPOSITION_EXPORT_QUOTE_CHANGED' ? <p className="exp-note" role="alert">{knownFailureText(state.failure, t)}</p> : null}
    </div>
  )
}

function ExportActions({
  state,
  t,
  credits,
  onAccept,
  onCancel,
  onRestart,
  onClose,
  channelId,
  projectTitle,
}: {
  state: SparkExportState
  t: T
  credits: (value: number) => string
  onAccept: () => void
  onCancel: () => void
  onRestart: () => void
  onClose: () => void
  channelId: string
  projectTitle: string
}) {
  const { phase, quote, export: job, failure } = state
  const closeButton = (
    <button type="button" className="btn ghost" onClick={onClose}>
      {t('close')}
    </button>
  )
  if (phase === 'idle' || phase === 'quoting') return closeButton
  if (phase === 'quote_failed') {
    return (
      <>
        {closeButton}
        <span className="grow" />
        <button type="button" className="btn" onClick={onRestart}>
          {failure?.code === 'COMPOSITION_EXPORT_QUOTE_CHANGED' ? t('checkPrice') : t('tryAgain')}
        </button>
      </>
    )
  }
  if ((phase === 'quoted' || phase === 'requesting') && quote) {
    return (
      <>
        {closeButton}
        <span className="grow" />
        <button type="button" className="btn primary" disabled={phase === 'requesting' || !quote.renderer.available} onClick={onAccept}>
          {t('accept', { credits: credits(quote.estimated_credits) })}
        </button>
      </>
    )
  }
  if (job && (phase === 'tracking' || phase === 'ended')) {
    if (!sparkExportTerminalStatuses.has(job.status)) {
      const stopping = state.cancelling || job.cancel_requested === true
      return (
        <>
          {closeButton}
          <span className="grow" />
          <button type="button" className="btn" disabled={stopping} onClick={onCancel}>
            {stopping ? t('cancelling') : t('cancel')}
          </button>
        </>
      )
    }
    if (job.status === 'completed' && job.output) {
      const href = getStorageDownloadUrl({ channelId, objectId: job.output.storage_object_id, fileName: `${projectTitle.trim() || 'video'}.mp4` })
      return (
        <>
          {closeButton}
          <span className="grow" />
          <button type="button" className="btn" onClick={onRestart}>
            {t('exportAgain')}
          </button>
          <a className="btn primary" href={href} download>
            {t('result.download')}
          </a>
        </>
      )
    }
    return (
      <>
        {closeButton}
        <span className="grow" />
        <button type="button" className="btn" onClick={onRestart}>
          {t('exportAgain')}
        </button>
      </>
    )
  }
  return closeButton
}

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { SPARK_MEDIA_ACCEPT, type MediaFileRefusal } from '@/lib/spark/media/media-files'
import type { SparkMediaUploader, UploadItem } from '@/lib/spark/media/media-upload'
import { isFileDrag } from '@/lib/spark/stage/placement'

import { Icon } from '../studio-parts'
import type { SparkToolContext } from '../spark-tool-types'
import { autoPlacesUploads, uploadAndPlace, type SparkMediaAdder } from './media-services'

/**
 * The Upload tab (D10): a drop zone and a file picker for several files at once, each with its own progress and cancel,
 * going to the Storage folder "Spark". A finished file is part of the project (images at once; a video or audio file
 * shows "Processing..." until its probe exists) and is added to the scene from its row, or from "My media" later. Files
 * the editor cannot use (GIF, SVG, other types) are refused here with the reason, never uploaded.
 */
export function MediaUploadTab({ ctx, uploader, adder }: { ctx: SparkToolContext; uploader: SparkMediaUploader; adder: SparkMediaAdder }) {
  const t = useTranslations('Spark.editor.media.upload')
  const state = React.useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, uploader.getSnapshot)
  const busy = React.useSyncExternalStore(adder.subscribe, adder.getSnapshot, adder.getSnapshot).busy
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const [refused, setRefused] = React.useState<Array<{ name: string; reason: MediaFileRefusal }>>([])
  const canWrite = ctx.canWrite

  // WP5a: with instant editing a picked file goes to the playhead by itself once it is ready (no extra "Add").
  const autoPlace = autoPlacesUploads(ctx)
  const take = (files: File[]) => {
    if (!canWrite || files.length === 0) return
    const result = autoPlace ? uploadAndPlace(ctx, files, { kind: 'playhead' }) : uploader.add(files)
    setRefused(result.refused)
  }

  const finished = state.items.some((item) => item.phase === 'ready' || item.phase === 'failed' || item.phase === 'cancelled')
  return (
    <>
      <div
        className={`dropzone big upload-zone${over ? ' over' : ''}`}
        style={{ marginTop: 10 }}
        onDragOver={(event) => {
          if (!canWrite || !isFileDrag(event.dataTransfer)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          setOver(false)
          if (!canWrite || !isFileDrag(event.dataTransfer)) return
          event.preventDefault()
          event.stopPropagation()
          take(Array.from(event.dataTransfer.files))
        }}
      >
        <Icon name="upload" />
        <b>{t('dropTitle')}</b>
        <span>{t('dropHint')}</span>
        <button type="button" className="btn sm" disabled={!canWrite} title={ctx.writeTitle} onClick={() => inputRef.current?.click()}>
          {t('choose')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={SPARK_MEDIA_ACCEPT}
          aria-label={t('inputLabel')}
          onChange={(event) => {
            take(Array.from(event.target.files ?? []))
            // The same file can be picked again after it was removed from the list.
            event.target.value = ''
          }}
        />
        <small>{t('formats')}</small>
        <small>{t('noGif')}</small>
      </div>

      {refused.length > 0 ? (
        <ul className="upload-refused" role="alert">
          {refused.map((file, index) => (
            <li key={`${file.name}:${index}`}>{t(`refused.${file.reason}`, { name: file.name })}</li>
          ))}
        </ul>
      ) : null}

      {state.items.length > 0 ? (
        <>
          <div className="dr-label">
            <span>{t('queue')}</span>
            {finished ? (
              <button type="button" className="lnk" onClick={() => uploader.clearFinished()}>
                {t('clear')}
              </button>
            ) : null}
          </div>
          <ul className="upload-list" aria-live="polite">
            {state.items.map((item) => (
              <UploadRow key={item.id} item={item} ctx={ctx} uploader={uploader} adder={adder} busy={busy[item.id] ?? null} autoPlace={autoPlace} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

function UploadRow({
  item,
  ctx,
  uploader,
  adder,
  busy,
  autoPlace,
}: {
  item: UploadItem
  ctx: SparkToolContext
  uploader: SparkMediaUploader
  adder: SparkMediaAdder
  busy: 'binding' | 'processing' | 'placing' | null
  /** WP5a: the file goes to the playhead by itself once it is ready. */
  autoPlace: boolean
}) {
  const t = useTranslations('Spark.editor.media.upload')
  const running = item.phase === 'queued' || item.phase === 'uploading' || item.phase === 'finalizing' || item.phase === 'binding' || (item.phase === 'processing' && !item.stalled)
  const now = useTicker(item.phase === 'processing' && !item.stalled && item.processingSince !== null)
  const status = statusText(t, item, now)
  const hint = autoPlace && running ? t('autoPlaceHint') : null
  return (
    <li className={`up-row ${item.phase}`} data-phase={item.phase} data-upload={item.id} data-still-processing={item.stillProcessing || undefined}>
      <span className={`up-ic${item.previewUrl ? ' thumb' : ''}`} aria-hidden>
        {/* WP5a: the picked file itself, at once (a picture, or a muted frame of the video), with its state as the badge. */}
        {item.previewUrl && item.kind === 'image' ? <img src={item.previewUrl} alt="" /> : null}
        {item.previewUrl && item.kind === 'video' ? <video src={item.previewUrl} muted playsInline preload="metadata" /> : null}
        {!item.previewUrl ? <Icon name={item.kind === 'audio' ? 'music' : item.kind === 'video' ? 'video' : 'image'} /> : null}
      </span>
      <div className="up-main">
        <div className="up-name" title={item.name}>
          {item.name}
          {item.measured?.durationSeconds ? <span className="up-dur">{formatDuration(item.measured.durationSeconds)}</span> : null}
        </div>
        <div className={`up-status${item.phase === 'failed' ? ' err' : ''}`} role={item.phase === 'failed' ? 'alert' : undefined}>
          {status}
        </div>
        {hint ? <div className="up-hint">{hint}</div> : null}
        {item.phase === 'uploading' || item.phase === 'queued' ? (
          <div className="up-bar" role="progressbar" aria-label={t('progressLabel', { name: item.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
            <i style={{ width: `${item.progress}%` }} />
          </div>
        ) : null}
      </div>
      <div className="up-actions">
        {running && (item.phase === 'queued' || item.phase === 'uploading') ? (
          <button type="button" className="ib xs" title={t('cancel')} aria-label={t('cancelLabel', { name: item.name })} onClick={() => uploader.cancel(item.id)}>
            <Icon name="x" size="sm" />
          </button>
        ) : null}
        {running && item.phase !== 'queued' && item.phase !== 'uploading' ? <span className="spin" aria-hidden /> : null}
        {item.phase === 'ready' && item.sourceId ? (
          <button
            type="button"
            className="btn sm"
            disabled={!ctx.canWrite || busy !== null}
            title={ctx.writeTitle}
            aria-label={t('addLabel', { name: item.name })}
            onClick={() => void adder.addSource(item.id, item.sourceId!, item.kind)}
          >
            <Icon name="plus" size="sm" />
            {t('add')}
          </button>
        ) : null}
        {item.phase === 'processing' && item.stalled ? (
          <button type="button" className="btn sm" onClick={() => uploader.recheck(item.id)}>
            {t('recheck')}
          </button>
        ) : null}
        {item.phase === 'failed' || item.phase === 'cancelled' ? (
          <button type="button" className="btn sm" onClick={() => uploader.retry(item.id)}>
            {t('retry')}
          </button>
        ) : null}
        {!running ? (
          <button type="button" className="ib xs" title={t('dismiss')} aria-label={t('dismissLabel', { name: item.name })} onClick={() => uploader.dismiss(item.id)}>
            <Icon name="x" size="sm" />
          </button>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Re-renders every second while `active` (the visible processing time); returns the time of the last tick (the first
 * second after it turns active may read a little early: the elapsed time is never shown below 0:00).
 */
function useTicker(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!active) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function statusText(t: ReturnType<typeof useTranslations>, item: UploadItem, now: number): string {
  switch (item.phase) {
    case 'uploading':
      return t('phases.uploading', { percent: item.progress })
    case 'processing': {
      if (item.stalled) return t('phases.stalled')
      // WP5a: how long it has been processing; a long one says that it keeps waiting (no dead end).
      const elapsed = item.processingSince !== null ? formatDuration((now - item.processingSince) / 1000) : null
      if (item.stillProcessing) return elapsed ? t('phases.stillProcessingFor', { elapsed }) : t('phases.stillProcessing')
      return elapsed ? t('phases.processingFor', { elapsed }) : t('phases.processing')
    }
    case 'failed':
      if (item.failure === 'too_large') return item.limitMb ? t('failures.too_large', { limit: item.limitMb }) : t('failures.too_large_unknown')
      return t(`failures.${item.failure ?? 'unknown'}`)
    default:
      return t(`phases.${item.phase}`)
  }
}

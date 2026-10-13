'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { formatCaptureClock } from '@/lib/avatar/recording-capture'
import { permissionHelpPlatform } from '@/lib/avatar/recording-media'
import { recordingSessionFor } from '@/lib/spark/recording/recording-registry'
import { supportsDeviceRecording, supportsDisplayCapture, type RecordingSession } from '@/lib/spark/recording/recording-session'
import {
  RECORDING_MAX_MS,
  RECORDING_WARN_MS,
  type RecordedTake,
  type RecordingError,
  type RecordingMode,
  type RecordingRole,
  type RecordingSnapshot,
  type SaveFailure,
} from '@/lib/spark/recording/recording-types'
import { oversizedPart, readUploadLimitMb } from '@/lib/spark/recording/upload-limit'

import './record-drawer.css'
import { recordingSaveDeps, recordingUploader, type RecordingInsertNote } from './record-insert'
import { DownloadPart, LevelMeter, LiveVideo, TakePlayer, UploadBar, megabytes, partStageText } from './record-views'
import type { SparkToolDrawerProps } from './spark-tool-types'
import { Icon, Toggle } from './studio-parts'

type T = ReturnType<typeof useTranslations>

const SAVE_FAILURE_KEY: Readonly<Record<SaveFailure, string>> = {
  too_large: 'errors.tooLarge',
  unsupported_type: 'errors.unsupportedType',
  upload_failed: 'errors.uploadFailed',
  not_ready: 'errors.notReady',
  probe_invalid: 'errors.probeInvalid',
  too_long: 'errors.tooLong',
  attach_failed: 'errors.attachFailed',
  forbidden: 'errors.forbidden',
  insert_failed: 'errors.insertFailed',
}

function permissionHelpKey(userAgent: string) {
  switch (permissionHelpPlatform(userAgent)) {
    case 'ios':
      return 'permissionHelpIos' as const
    case 'android':
      return 'permissionHelpAndroid' as const
    case 'firefox':
      return 'permissionHelpFirefox' as const
    case 'safari':
      return 'permissionHelpSafari' as const
    default:
      return 'permissionHelpChrome' as const
  }
}

/** The sentence (and the browser-specific help) of a device refusal; the texts of the avatar capture are reused. */
function deviceErrorText(media: T, t: T, error: Extract<RecordingError, { kind: 'device' }>): { message: string; help?: string } {
  const help = media(permissionHelpKey(typeof navigator === 'undefined' ? '' : navigator.userAgent))
  const { device, problem } = error
  if (problem === 'insecure') return { message: media('insecureContext') }
  if (problem === 'unsupported') return { message: device === 'screen' ? t('errors.screenUnsupported') : media(device === 'camera' ? 'cameraUnsupported' : 'micUnsupported') }
  if (device === 'screen') return { message: problem === 'denied' ? t('errors.screenDenied') : t('errors.screenBusy') }
  if (problem === 'not_found') return { message: media(device === 'camera' ? 'noCamera' : 'noMicrophone') }
  if (problem === 'denied') return { message: media(device === 'camera' ? 'cameraDenied' : 'micDenied'), help }
  return { message: media(device === 'camera' ? 'cameraBusy' : 'micBusy'), help }
}

const MODE_ICON: Readonly<Record<RecordingMode, string>> = { screen: 'monitor', camera: 'video', screen_camera: 'user', voice: 'mic' }
const MODE_KEY: Readonly<Record<RecordingMode, string>> = { screen: 'screen', camera: 'camera', screen_camera: 'screenCamera', voice: 'voice' }

/**
 * Rail "Record" (E1-F, D7): Screen, Camera, Screen + camera and Voice only. The drawer is a view of the project's
 * `RecordingSession` (`lib/spark/recording`): pick a mode (the browser asks for permission), check the live preview and
 * the microphone level, record (pause / resume, 10-minute countdown), review the take (play it, retake it), then "Add to
 * video" uploads it into the Storage folder "Recordings", binds it to the project and inserts it at the playhead.
 */
export function RecordToolDrawer({ ctx }: SparkToolDrawerProps) {
  const t = useTranslations('Spark.editor.record')
  const media = useTranslations('RecordingStudio')
  const session = React.useMemo(() => recordingSessionFor(ctx.project.id), [ctx.project.id])
  const snap = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const ctxRef = React.useRef(ctx)
  const tRef = React.useRef(t)
  React.useLayoutEffect(() => {
    ctxRef.current = ctx
    tRef.current = t
  })
  // Live capture never outlives the drawer: a running recording is stopped and kept as the take, an open capture is closed.
  React.useEffect(() => () => session.releaseDevices(), [session])

  // The plan's per-file upload limit (Feature Control `max_storage_upload_size_mb`): an early warning before a long upload.
  const [limitMb, setLimitMb] = React.useState<number | null>(null)
  React.useEffect(() => {
    let active = true
    void readUploadLimitMb().then((value) => {
      if (active) setLimitMb(value)
    })
    return () => {
      active = false
    }
  }, [])
  // T1R-10: the take is uploaded into "Recordings" the moment the recording stops (server persistence); the session keeps the
  // uploader after the drawer closes, so a recording stopped by closing it is saved too.
  React.useEffect(() => {
    session.setUploader(recordingUploader(() => ctxRef.current), limitMb)
  }, [session, limitMb])

  // "Add to video" / "Try again": the save reads the freshest context through the ref each time one of its steps runs.
  const saveNow = () =>
    void session.save(
      recordingSaveDeps(
        () => ctxRef.current,
        (notes: RecordingInsertNote[]) => {
          const text = tRef.current
          const sentences = notes.map((note) => (note.kind === 'narrationReplaced' ? text('toast.narrationReplaced') : text('toast.voiceRunsPast', { seconds: note.seconds })))
          if (sentences.length > 0) ctxRef.current.toast(sentences.join(' '))
        },
      ),
    )

  // Move the focus to the main control of the new step (stop while recording, add after the review, ...).
  const rootRef = React.useRef<HTMLDivElement>(null)
  const phase = snap.phase
  React.useEffect(() => {
    if (phase !== 'idle') rootRef.current?.querySelector<HTMLElement>('[data-rec-primary]')?.focus()
  }, [phase, snap.save?.step])

  return (
    <div className="dr-body" ref={rootRef}>
      {phase === 'idle' ? <ModeList ctx={ctx} snap={snap} session={session} t={t} limitMb={limitMb} /> : null}
      {phase === 'requesting' ? <Requesting snap={snap} session={session} t={t} /> : null}
      {phase === 'ready' || phase === 'recording' || phase === 'paused' ? <Capture snap={snap} session={session} t={t} /> : null}
      {phase === 'finishing' ? (
        <div className="rec-status" role="status">
          <span className="spin" />
          {t('finishing')}
        </div>
      ) : null}
      {phase === 'review' && snap.take ? <Review ctx={ctx} take={snap.take} persist={snap.persist} session={session} t={t} limitMb={limitMb} onAdd={saveNow} /> : null}
      {phase === 'saving' && snap.save ? <Saving snap={snap} session={session} t={t} onRetry={saveNow} /> : null}
      {phase === 'saved' ? (
        <div className="rec-stack">
          <div className="rec-card" role="status">
            <div className="rec-row">
              <Icon name="check-c" />
              <b>{t('saved.title')}</b>
            </div>
            <small>{t('saved.body', { scene: snap.insertedSceneNumber ?? 1 })}</small>
          </div>
          <button type="button" className="btn primary w100" data-rec-primary onClick={() => session.discard()}>
            {t('saved.again')}
          </button>
        </div>
      ) : null}
      {phase === 'error' && snap.error ? <ErrorView snap={snap} error={snap.error} session={session} t={t} media={media} /> : null}
    </div>
  )
}

function ModeList({ ctx, snap, session, t, limitMb }: { ctx: SparkToolDrawerProps['ctx']; snap: RecordingSnapshot; session: RecordingSession; t: T; limitMb: number | null }) {
  const canDevices = supportsDeviceRecording()
  const canDisplay = supportsDisplayCapture()
  const row = (mode: RecordingMode) => {
    const unsupported = !canDevices || ((mode === 'screen' || mode === 'screen_camera') && !canDisplay)
    const key = MODE_KEY[mode]
    return (
      <button
        key={mode}
        type="button"
        className="opt-row"
        disabled={unsupported || !ctx.stageCanWrite}
        title={unsupported ? (canDevices ? t('screenUnsupportedTitle') : t('unsupported')) : (ctx.writeTitle ?? undefined)}
        onClick={() => void session.start(mode)}
      >
        <span className="opt-ic">
          <Icon name={MODE_ICON[mode]} />
        </span>
        <span>
          <b>{t(`modes.${key}.label`)}</b>
          <small>{t(`modes.${key}.hint`)}</small>
        </span>
      </button>
    )
  }
  return (
    <>
      {row('screen')}
      {row('camera')}
      {row('screen_camera')}
      <Toggle label={t('microphone')} hint={t('microphoneHint')} on={snap.withMic} disabled={!canDevices} onClick={() => session.setMicrophone(!snap.withMic)} />
      <div className="dr-label">{t('audioSection')}</div>
      {row('voice')}
      <p className="rec-note">{t('limitNote', { minutes: Math.round(RECORDING_MAX_MS / 60_000) })}</p>
      {limitMb !== null ? <p className="rec-note">{t('limitPlan', { limit: Math.round(limitMb * 10) / 10 })}</p> : null}
      {!canDevices ? <p className="rec-note">{t('unsupported')}</p> : null}
    </>
  )
}

function Requesting({ snap, session, t }: { snap: RecordingSnapshot; session: RecordingSession; t: T }) {
  const hint = snap.mode === 'screen' || snap.mode === 'screen_camera' ? 'screen' : snap.mode === 'camera' ? 'camera' : 'voice'
  return (
    <div className="rec-stack">
      <div className="rec-status" role="status">
        <span className="spin" />
        {t('requesting.title')}
      </div>
      <p className="rec-note">{t(`requesting.${hint}`)}</p>
      <button type="button" className="btn w100" onClick={() => session.cancel()}>
        {t('cancel')}
      </button>
    </div>
  )
}

function Capture({ snap, session, t }: { snap: RecordingSnapshot; session: RecordingSession; t: T }) {
  const recording = snap.phase === 'recording'
  const paused = snap.phase === 'paused'
  const live = recording || paused
  const remaining = Math.max(0, snap.maxMs - snap.elapsedMs)
  const warn = live && remaining <= RECORDING_WARN_MS
  const voice = snap.mode === 'voice'
  return (
    <div className="rec-stack">
      {live ? (
        <>
          <div className="rec-status">
            <span className={`rec-dot${recording ? ' live' : ''}`} aria-hidden />
            <span>{paused ? t('paused') : t('recording')}</span>
            <span className={`rec-left${warn ? ' warn' : ''}`}>{t('timeLeft', { time: formatCaptureClock(remaining) })}</span>
          </div>
          <div className="rec-clock" role="timer" aria-label={t('elapsed', { time: formatCaptureClock(snap.elapsedMs) })}>
            {formatCaptureClock(snap.elapsedMs)}
          </div>
        </>
      ) : (
        <div className="rec-status" role="status">
          <b>{t('ready.title')}</b>
        </div>
      )}
      {snap.screenStream || snap.cameraStream ? (
        <div className={`rec-previews${snap.screenStream && snap.cameraStream ? ' pair' : ''}`}>
          {snap.screenStream ? (
            <div className="rec-view">
              <span>{t('previews.screen')}</span>
              <LiveVideo stream={snap.screenStream} label={t('previews.screen')} />
            </div>
          ) : null}
          {snap.cameraStream ? (
            <div className="rec-view">
              <span>{t('previews.camera')}</span>
              <LiveVideo stream={snap.cameraStream} label={t('previews.camera')} mirror />
            </div>
          ) : null}
        </div>
      ) : null}
      {snap.hasMic ? <LevelMeter session={session} label={t('micLevel')} /> : null}
      {snap.micUnavailable ? <p className="rec-note" role="status">{t('micUnavailable')}</p> : null}
      {warn ? (
        <p className="rec-note" role="status">
          {t('limitSoon', { seconds: Math.ceil(remaining / 1000) })}
        </p>
      ) : null}
      {!live ? <p className="rec-note">{voice ? t('ready.voiceHint') : t('ready.hint')}</p> : null}
      {live ? (
        <div className="rec-actions">
          <button type="button" className="btn" onClick={() => (paused ? session.resume() : session.pause())}>
            <Icon name={paused ? 'play' : 'pause'} size="sm" />
            {paused ? t('resume') : t('pause')}
          </button>
          <button type="button" className="btn primary" data-rec-primary onClick={() => void session.stop()}>
            <Icon name="stop" size="sm" />
            {t('stop')}
          </button>
        </div>
      ) : (
        <div className="rec-actions">
          <button type="button" className="btn" onClick={() => session.cancel()}>
            {t('cancel')}
          </button>
          <button type="button" className="btn primary" data-rec-primary onClick={() => session.beginRecording()}>
            <Icon name="record" size="sm" />
            {t('start')}
          </button>
        </div>
      )}
    </div>
  )
}

function Review({
  ctx,
  take,
  persist,
  session,
  t,
  limitMb,
  onAdd,
}: {
  ctx: SparkToolDrawerProps['ctx']
  take: RecordedTake
  persist: RecordingSnapshot['persist']
  session: RecordingSession
  t: T
  limitMb: number | null
  onAdd: () => void
}) {
  const note = take.mode === 'voice' ? 'voice' : take.mode === 'screen_camera' ? 'pair' : 'video'
  const size = take.parts.reduce((sum, part) => sum + part.sizeBytes, 0)
  const roleLabel = (role: RecordingRole) => t(`review.parts.${role}`)
  const tooLarge = oversizedPart(take.parts, limitMb)
  return (
    <div className="rec-stack">
      <div className="dr-label">{t('review.title')}</div>
      <div className={`rec-previews${take.parts.length > 1 ? ' pair' : ''}`}>
        {take.parts.map((part) => (
          <div className="rec-view" key={part.role}>
            <span>{roleLabel(part.role)}</span>
            <TakePlayer part={part} label={roleLabel(part.role)} />
          </div>
        ))}
      </div>
      <p className="rec-note">{t('review.meta', { duration: formatCaptureClock(take.durationMs), size: megabytes(size) })}</p>
      {take.hitLimit ? <p className="rec-note" role="status">{t('review.limitReached')}</p> : null}
      {take.interrupted ? <p className="rec-note" role="status">{t('review.interrupted')}</p> : null}
      {tooLarge !== null && limitMb !== null ? (
        <div className="rec-error" role="alert">
          <small>{t('review.tooLarge', { size: megabytes(tooLarge), limit: Math.round(limitMb * 10) / 10 })}</small>
        </div>
      ) : null}
      <Persisted persist={persist} t={t} roleLabel={roleLabel} onRetry={() => session.retryPersist()} />
      <p className="rec-note">{t(`review.notes.${note}`)}</p>
      {persist?.status !== 'saved' ? (
        <div className="rec-actions" data-rec-downloads>
          {take.parts.map((part) => (
            <DownloadPart key={part.role} part={part} startedAt={take.startedAt} label={take.parts.length > 1 ? t('review.downloadPart', { name: roleLabel(part.role) }) : t('review.download')} />
          ))}
        </div>
      ) : null}
      <div className="rec-actions">
        <button type="button" className="btn" onClick={() => void session.retake()}>
          <Icon name="refresh" size="sm" />
          {t('retake')}
        </button>
        <button type="button" className="btn primary" data-rec-primary disabled={!ctx.stageCanWrite || tooLarge !== null} title={ctx.writeTitle ?? undefined} onClick={onAdd}>
          {t('add')}
        </button>
      </div>
    </div>
  )
}

/** T1R-10: where the take is in its own upload into "Recordings" (before and independent of adding it to the video). */
function Persisted({ persist, t, roleLabel, onRetry }: { persist: RecordingSnapshot['persist']; t: T; roleLabel: (role: RecordingRole) => string; onRetry: () => void }) {
  if (!persist) return null
  if (persist.status === 'saved') return <p className="rec-note" role="status" data-rec-persist="saved">{t('review.persist.saved')}</p>
  if (persist.status === 'uploading') {
    const percent = Math.round(persist.parts.reduce((sum, part) => sum + (part.storageObjectId ? 100 : part.progress), 0) / Math.max(1, persist.parts.length))
    return (
      <div data-rec-persist="uploading">
        <p className="rec-note" role="status">
          <span className="spin" aria-hidden /> {t('review.persist.uploading', { percent })}
        </p>
        <UploadBar percent={percent} label={persist.parts.map((part) => roleLabel(part.role)).join(', ')} />
      </div>
    )
  }
  return (
    <div className="rec-error" role="alert" data-rec-persist="failed">
      <small>{persist.failure ? t(SAVE_FAILURE_KEY[persist.failure]) : t('review.persist.failed')}</small>
      <small>{t('review.persist.failed')}</small>
      {persist.failure !== 'too_large' && persist.failure !== 'unsupported_type' && persist.failure !== 'forbidden' ? (
        <button type="button" className="btn sm" onClick={onRetry}>
          {t('review.persist.retry')}
        </button>
      ) : null}
    </div>
  )
}

function Saving({ snap, session, t, onRetry }: { snap: RecordingSnapshot; session: RecordingSession; t: T; onRetry: () => void }) {
  const save = snap.save!
  const roleLabel = (role: RecordingRole) => t(`review.parts.${role}`)
  const busy = save.step === 'uploading' || save.step === 'processing' || save.step === 'inserting'
  return (
    <div className="rec-stack">
      <div className="dr-label">{t('saving.title')}</div>
      <div className="rec-card">
        {save.parts.map((part) => (
          <div key={part.role}>
            <div className="rec-row">
              <b>{roleLabel(part.role)}</b>
              <small data-rec-part-stage={part.stage}>
                {partStageText(part, {
                  waiting: t('saving.waiting'),
                  uploading: (percent) => t('saving.uploading', { name: roleLabel(part.role), percent }),
                  processing: t('saving.processing'),
                  stalled: t('saving.stalledTitle'),
                  ready: t('saving.ready'),
                  failed: t('saving.failed'),
                })}
              </small>
              {part.stage === 'processing' || part.stage === 'uploading' ? <span className="spin" aria-hidden /> : null}
            </div>
            {part.stage === 'uploading' ? <UploadBar percent={part.progress} label={roleLabel(part.role)} /> : null}
          </div>
        ))}
      </div>
      {save.step === 'processing' ? <p className="rec-note" role="status">{t('saving.processingHint')}</p> : null}
      {save.step === 'inserting' ? (
        <p className="rec-note" role="status">
          {t('saving.inserting')}
        </p>
      ) : null}
      {save.step === 'stalled' ? (
        <div className="rec-error" role="alert">
          <b>{t('saving.stalledTitle')}</b>
          <small>{t('saving.stalledHint')}</small>
        </div>
      ) : null}
      {save.step === 'failed' && save.failure ? (
        <div className="rec-error" role="alert">
          <small>{t(SAVE_FAILURE_KEY[save.failure])}</small>
        </div>
      ) : null}
      {save.step === 'inserting' ? null : busy ? (
        <button type="button" className="btn w100" onClick={() => session.cancelSave()}>
          {t('saving.cancel')}
        </button>
      ) : (
        <div className="rec-actions">
          <button type="button" className="btn" onClick={() => session.cancelSave()}>
            {t('back')}
          </button>
          <button type="button" className="btn primary" data-rec-primary onClick={onRetry}>
            {save.step === 'stalled' ? t('saving.checkAgain') : t('tryAgain')}
          </button>
        </div>
      )}
    </div>
  )
}

function ErrorView({
  snap,
  error,
  session,
  t,
  media,
}: {
  snap: RecordingSnapshot
  error: RecordingError
  session: RecordingSession
  t: T
  media: T
}) {
  const copy = error.kind === 'device' ? deviceErrorText(media, t, error) : { message: t('errors.recorder') }
  return (
    <div className="rec-stack">
      <div className="rec-error" role="alert">
        <b>{copy.message}</b>
        {copy.help ? <small>{copy.help}</small> : null}
      </div>
      <div className="rec-actions">
        <button type="button" className="btn" onClick={() => session.discard()}>
          {t('back')}
        </button>
        <button type="button" className="btn primary" data-rec-primary onClick={() => void (snap.mode ? session.start(snap.mode) : session.discard())}>
          {t('tryAgain')}
        </button>
      </div>
    </div>
  )
}

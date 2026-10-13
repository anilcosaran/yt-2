'use client'

import * as React from 'react'
import { Camera, Check, ChevronDown, Mic } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import {
  CaptureButton,
  CaptureNotice,
  CaptureProgress,
  CaptureStepHeader,
  CaptureSuccess,
  CaptureSurface,
  CaptureWordmark,
  type CaptureLayout,
} from '@/components/recording/capture-ui'
import { PhotoCaptureStep, type PhotoCaptureLabels } from '@/components/recording/photo-capture-step'
import { VoiceCaptureStep, type VoiceCaptureLabels } from '@/components/recording/voice-capture-step'
import type { RecordingSession } from '@/lib/avatar/api'
import {
  captureStepsFromSnapshot,
  combinedUploadProgress,
  pendingCaptureUploads,
  resolveCaptureStartStep,
  resolveVoiceLimits,
  validateCaptureFile,
  type RecordingCaptureKind,
  type RecordingCaptureStepsState,
} from '@/lib/avatar/recording-capture'
import { recordingCopyForLanguage } from '@/lib/avatar/recording-copy'
import { permissionHelpPlatform, type MediaProblem } from '@/lib/avatar/recording-media'
import { cn } from '@/lib/utils'

export type AvatarCaptureKind = RecordingCaptureKind

export type AvatarCaptureConstraints = {
  /** Stop becomes available after this many seconds (default 5). */
  voiceMinSeconds?: number | null
  /** Voice recording auto-stops at this many seconds (default 15). */
  voiceMaxSeconds?: number | null
  /** Client-side size guard for the photo (default 15 MiB). */
  imageMaxBytes?: number | null
  /** Client-side size guard for the voice sample (default 5 MiB). */
  voiceMaxBytes?: number | null
}

export type AvatarCaptureUploadMeta = {
  /** Voice sample only: measured recording length in milliseconds. */
  durationMs?: number
}

export type AvatarCaptureFlowProps = {
  /**
   * `fullscreen` covers the viewport (origin phone page, safe-area aware);
   * `embedded` renders a white rounded card inside an existing page. Both are always light.
   */
  layout?: CaptureLayout
  /** Full consent script shown under "details"; falls back to the built-in copy for the UI locale. */
  consentScript?: string | null
  constraints?: AvatarCaptureConstraints
  /**
   * Server step states used to resume: an uploaded photo starts at the voice step, both uploaded
   * shows the success screen. Use `captureStepsFromSnapshot(session.steps)` to build it.
   */
  stepsState?: RecordingCaptureStepsState | null
  /**
   * Uploads one capture. Called sequentially (photo first, then voice) after the voice sample is
   * accepted; kinds already uploaded are skipped. Reject with an Error whose message is safe to show.
   */
  onUpload: (
    kind: AvatarCaptureKind,
    file: File,
    meta: AvatarCaptureUploadMeta,
    onProgress: (percent: number) => void,
  ) => Promise<void>
  /** Called once, before the first capture, after consent is given (e.g. to open the session). */
  onBeforeStart?: () => Promise<void> | void
  /** Called once after every pending capture has been uploaded in this flow. */
  onCompleted?: () => void
  /** Overrides the success screen copy (defaults: "Done" / "You can go back to your computer."). */
  successCopy?: { title?: string; description?: string }
  className?: string
}

type FlowStage = 'intro' | 'photo' | 'voice' | 'uploading' | 'failed' | 'done'

/**
 * Two-step avatar capture: consent -> one front photo -> ~15 s voice sample -> upload -> done.
 * Minimal black & white UI that always renders in a light appearance.
 */
export function AvatarCaptureFlow({
  layout = 'embedded',
  consentScript,
  constraints,
  stepsState,
  onUpload,
  onBeforeStart,
  onCompleted,
  successCopy,
  className,
}: AvatarCaptureFlowProps) {
  const t = useTranslations('RecordingStudio')
  const locale = useLocale()
  const voiceLimits = resolveVoiceLimits({
    minSeconds: constraints?.voiceMinSeconds,
    maxSeconds: constraints?.voiceMaxSeconds,
  })

  const serverPhotoDone = stepsState?.identity_image === 'uploaded'
  const serverVoiceDone = stepsState?.voice_sample === 'uploaded'
  const [rawStage, setStage] = React.useState<FlowStage>(() => (
    resolveCaptureStartStep(stepsState) === 'done' ? 'done' : 'intro'
  ))
  const [consent, setConsent] = React.useState(false)
  const [consentError, setConsentError] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [startError, setStartError] = React.useState<string | null>(null)
  const [photo, setPhoto] = React.useState<File | null>(null)
  const [voice, setVoice] = React.useState<{ file: File; durationMs: number } | null>(null)
  const [localUploaded, setLocalUploaded] = React.useState<ReadonlySet<AvatarCaptureKind>>(() => new Set())
  const [progress, setProgress] = React.useState(0)
  const [failure, setFailure] = React.useState<{ kind: AvatarCaptureKind; message: string } | null>(null)
  const beforeStartDoneRef = React.useRef(false)
  const consentInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadingRef = React.useRef(false)
  const completedRef = React.useRef(false)

  const uploaded = React.useMemo(() => {
    const kinds = new Set(localUploaded)
    if (serverPhotoDone) kinds.add('identity_image')
    if (serverVoiceDone) kinds.add('voice_sample')
    return kinds
  }, [localUploaded, serverPhotoDone, serverVoiceDone])
  const photoDone = uploaded.has('identity_image')
  const voiceDone = uploaded.has('voice_sample')

  // Another device (or an earlier visit) may finish both steps while this flow is idle.
  const stage: FlowStage = photoDone && voiceDone && (rawStage === 'intro' || rawStage === 'photo' || rawStage === 'voice')
    ? 'done'
    : rawStage

  React.useEffect(() => {
    if (stage !== 'uploading') return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [stage])

  const resolvedConsent = consentScript?.trim() || recordingCopyForLanguage(locale).consent_script

  const problemCopy = React.useCallback((problem: MediaProblem, device: 'camera' | 'microphone') => {
    const help = t(helpKey(typeof navigator === 'undefined' ? '' : navigator.userAgent))
    switch (problem) {
      case 'insecure':
        return { message: t('insecureContext') }
      case 'unsupported':
        return { message: t(device === 'camera' ? 'cameraUnsupported' : 'micUnsupported') }
      case 'not_found':
        return { message: t(device === 'camera' ? 'noCamera' : 'noMicrophone') }
      case 'denied':
        return { message: t(device === 'camera' ? 'cameraDenied' : 'micDenied'), help }
      default:
        return { message: t(device === 'camera' ? 'cameraBusy' : 'micBusy'), help }
    }
  }, [t])

  const photoLabels: PhotoCaptureLabels = {
    openingCamera: t('openingCamera'),
    takePhoto: t('takePhoto'),
    retake: t('retake'),
    usePhoto: t('usePhoto'),
    tryAgain: t('tryAgain'),
    captureFailed: t('captureFailed'),
    problem: (problem) => problemCopy(problem, 'camera'),
  }

  const voiceLabels: VoiceCaptureLabels = {
    readingLanguage: t('readingLanguage'),
    anotherText: t('anotherText'),
    startRecording: t('startRecording'),
    stop: t('stop'),
    stopIn: (seconds) => t('stopIn', { seconds }),
    recordAgain: t('recordAgain'),
    useVoice: t('useVoice'),
    play: t('play'),
    pause: t('pause'),
    tryAgain: t('tryAgain'),
    emptyRecording: t('emptyRecording'),
    tooShort: (seconds) => t('tooShort', { seconds }),
    problem: (problem) => problemCopy(problem, 'microphone'),
  }

  const runUploads = async (files: { photo: File | null; voice: { file: File; durationMs: number } | null }) => {
    if (uploadingRef.current) return
    const kinds = pendingCaptureUploads(uploaded)
    if (!kinds.length) {
      finish()
      return
    }
    const items = kinds.map((kind) => {
      const file = kind === 'identity_image' ? files.photo : files.voice?.file ?? null
      return { kind, file, progress: 0 }
    })
    const missing = items.find((item) => !item.file)
    if (missing) {
      setStage(missing.kind === 'identity_image' ? 'photo' : 'voice')
      return
    }
    for (const item of items) {
      const problem = validateCaptureFile(item.file!, item.kind, {
        imageMaxBytes: constraints?.imageMaxBytes,
        voiceMaxBytes: constraints?.voiceMaxBytes,
      })
      if (problem) {
        setFailure({
          kind: item.kind,
          message: problem === 'too_large'
            ? t('fileTooLarge')
            : problem === 'empty' ? t('emptyRecording') : t('uploadFailed'),
        })
        setStage('failed')
        return
      }
    }

    uploadingRef.current = true
    setFailure(null)
    setProgress(0)
    setStage('uploading')
    const report = () => setProgress(combinedUploadProgress(
      items.map((item) => ({ bytes: item.file!.size, progress: item.progress })),
    ))
    for (const item of items) {
      try {
        await onUpload(
          item.kind,
          item.file!,
          item.kind === 'voice_sample' ? { durationMs: files.voice?.durationMs } : {},
          (percent) => {
            item.progress = percent
            report()
          },
        )
        item.progress = 100
        report()
        setLocalUploaded((current) => new Set(current).add(item.kind))
      } catch (error) {
        uploadingRef.current = false
        setFailure({
          kind: item.kind,
          message: error instanceof Error && error.message ? error.message : t('uploadFailed'),
        })
        setStage('failed')
        return
      }
    }
    uploadingRef.current = false
    finish()
  }

  const finish = () => {
    setStage('done')
    if (completedRef.current) return
    completedRef.current = true
    onCompleted?.()
  }

  const start = async () => {
    // The DOM checkbox is authoritative if it was ticked before React finished hydrating.
    const accepted = consent || consentInputRef.current?.checked === true
    if (!accepted) {
      setConsentError(true)
      return
    }
    if (!consent) setConsent(true)
    if (starting) return
    setStartError(null)
    if (!beforeStartDoneRef.current && onBeforeStart) {
      setStarting(true)
      try {
        await onBeforeStart()
        beforeStartDoneRef.current = true
      } catch (error) {
        setStartError(error instanceof Error && error.message ? error.message : t('uploadFailed'))
        return
      } finally {
        setStarting(false)
      }
    }
    beforeStartDoneRef.current = true
    setStage(photoDone ? 'voice' : 'photo')
  }

  const successTitle = successCopy?.title ?? t('successTitle')
  const successDescription = successCopy?.description ?? t('successDescription')
  const brand = layout === 'fullscreen' ? <CaptureWordmark /> : null

  let content: React.ReactNode
  if (stage === 'done') {
    content = <CaptureSuccess title={successTitle} description={successDescription} />
  } else if (stage === 'uploading') {
    content = <CaptureProgress value={progress} title={t('uploadingTitle')} hint={t('uploadingKeepOpen')} />
  } else if (stage === 'failed') {
    content = (
      <div className="flex flex-1 flex-col justify-center gap-4 py-6">
        <CaptureNotice>{failure?.message ?? t('uploadFailed')}</CaptureNotice>
        <CaptureButton className="w-full" onClick={() => void runUploads({ photo, voice })}>
          {t('tryAgain')}
        </CaptureButton>
        <CaptureButton
          variant="secondary"
          className="w-full"
          onClick={() => {
            setFailure(null)
            setStage(failure?.kind === 'identity_image' ? 'photo' : 'voice')
          }}
        >
          {failure?.kind === 'identity_image' ? t('retake') : t('recordAgain')}
        </CaptureButton>
      </div>
    )
  } else if (stage === 'photo') {
    content = (
      <div className="flex flex-col gap-6">
        <CaptureStepHeader
          step={1}
          total={2}
          stepLabel={t('stepLabel', { current: 1, total: 2 })}
          title={t('photoTitle')}
          description={t('photoInstruction')}
        />
        <PhotoCaptureStep
          labels={photoLabels}
          onUse={(file) => {
            setPhoto(file)
            // Voice already uploaded, or recorded earlier and only the photo upload failed.
            if (voiceDone || voice) {
              void runUploads({ photo: file, voice })
              return
            }
            setStage('voice')
          }}
        />
      </div>
    )
  } else if (stage === 'voice') {
    content = (
      <div className="flex flex-col gap-6">
        <CaptureStepHeader
          step={2}
          total={2}
          stepLabel={t('stepLabel', { current: 2, total: 2 })}
          title={t('voiceTitle')}
          description={t('voiceInstruction')}
        />
        <VoiceCaptureStep
          minMs={voiceLimits.minMs}
          maxMs={voiceLimits.maxMs}
          labels={voiceLabels}
          onUse={(file, durationMs) => {
            const next = { file, durationMs }
            setVoice(next)
            void runUploads({ photo, voice: next })
          }}
        />
      </div>
    )
  } else {
    content = (
      <Intro
        consent={consent}
        consentInputRef={consentInputRef}
        consentError={consentError}
        consentScript={resolvedConsent}
        photoDone={photoDone}
        voiceSeconds={voiceLimits.maxSeconds}
        starting={starting}
        startError={startError}
        onConsentChange={(value) => {
          setConsent(value)
          if (value) setConsentError(false)
        }}
        onStart={() => void start()}
        t={t}
      />
    )
  }

  return (
    <CaptureSurface layout={layout} brand={brand} className={className}>
      {content}
    </CaptureSurface>
  )
}

function Intro({
  consent,
  consentInputRef,
  consentError,
  consentScript,
  photoDone,
  voiceSeconds,
  starting,
  startError,
  onConsentChange,
  onStart,
  t,
}: {
  consent: boolean
  consentInputRef: React.RefObject<HTMLInputElement | null>
  consentError: boolean
  consentScript: string
  photoDone: boolean
  voiceSeconds: number
  starting: boolean
  startError: string | null
  onConsentChange: (value: boolean) => void
  onStart: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const consentId = React.useId()
  return (
    <div className="flex flex-1 flex-col sm:flex-none">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t('introTitle')}</h1>
        <p className="mt-2 text-base leading-7 text-neutral-500">{t('introDescription')}</p>
      </div>

      <ol className="mt-8 divide-y divide-neutral-200 rounded-3xl border border-neutral-200">
        <IntroStep
          icon={<Camera className="size-5" aria-hidden />}
          title={t('introPhoto')}
          hint={t('introPhotoHint')}
          done={photoDone}
          doneLabel={t('stepDone')}
        />
        <IntroStep
          icon={<Mic className="size-5" aria-hidden />}
          title={t('introVoice')}
          hint={t('introVoiceHint', { seconds: voiceSeconds })}
          done={false}
          doneLabel={t('stepDone')}
        />
      </ol>

      <div className="mt-8 flex-1 sm:flex-none">
        <div className="flex items-start gap-3">
          <input
            ref={consentInputRef}
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(event) => onConsentChange(event.target.checked)}
            aria-invalid={consentError || undefined}
            className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-neutral-950"
          />
          <label htmlFor={consentId} className="cursor-pointer text-sm leading-6 text-neutral-900">
            {t('consentLabel')}
          </label>
        </div>
        <details className="group mt-2 pl-8">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline [&::-webkit-details-marker]:hidden">
            {t('consentDetails')}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{consentScript}</p>
        </details>
      </div>

      <div className="mt-8 space-y-3">
        {consentError ? <CaptureNotice>{t('consentRequired')}</CaptureNotice> : null}
        {startError ? <CaptureNotice>{startError}</CaptureNotice> : null}
        <CaptureButton
          className={cn('w-full', !consent && 'bg-neutral-300 hover:bg-neutral-300')}
          busy={starting}
          onClick={onStart}
          aria-disabled={!consent || undefined}
        >
          {photoDone ? t('continue') : t('start')}
        </CaptureButton>
      </div>
    </div>
  )
}

function IntroStep({
  icon,
  title,
  hint,
  done,
  doneLabel,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  done: boolean
  doneLabel: string
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-4">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900',
        )}
      >
        {done ? <Check className="size-5" aria-hidden /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-neutral-950">{title}</span>
        <span className="block text-sm leading-5 text-neutral-500">{done ? doneLabel : hint}</span>
      </span>
    </li>
  )
}

function helpKey(userAgent: string) {
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

/**
 * Maps a recording session snapshot onto the capture flow inputs (consent, voice limits and
 * resumable step states). Works for both the public token snapshot and the owner snapshot.
 */
export function captureFlowPropsFromSession(
  session: Pick<RecordingSession, 'consent_script' | 'constraints' | 'steps'>,
): Pick<AvatarCaptureFlowProps, 'consentScript' | 'constraints' | 'stepsState'> {
  return {
    consentScript: session.consent_script || session.constraints.consent_script || null,
    constraints: {
      voiceMinSeconds: session.constraints.voice_min_duration_seconds,
      voiceMaxSeconds: session.constraints.voice_max_duration_seconds,
      imageMaxBytes: session.constraints.image_max_bytes,
      voiceMaxBytes: session.constraints.voice_max_bytes,
    },
    stepsState: captureStepsFromSnapshot(session.steps),
  }
}

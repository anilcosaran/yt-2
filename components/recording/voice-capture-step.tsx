'use client'

import * as React from 'react'
import { Languages, Mic, Pause, Play, Shuffle, Square } from 'lucide-react'

import { CaptureButton, CaptureIconButton, CaptureNotice } from '@/components/recording/capture-ui'
import {
  captureFileFromBlob,
  formatCaptureClock,
  preferredAudioRecorderMimeType,
} from '@/lib/avatar/recording-capture'
import {
  deviceRecordingLanguage,
  nextReadingTextIndex,
  readingTextCount,
  readingTextFor,
  toggleRecordingLanguage,
  type RecordingLanguage,
} from '@/lib/avatar/recording-copy'
import {
  createCaptureAudioContext,
  isSecureMediaContext,
  mediaProblemFromError,
  openVoiceMicrophone,
  prefersAppleAudioContainer,
  startLevelMeter,
  stopMediaStream,
  supportsVoiceRecording,
  transcodeVoiceRecordingToWav,
  type MediaProblem,
} from '@/lib/avatar/recording-media'
import { cn } from '@/lib/utils'

type VoicePhase = 'idle' | 'starting' | 'recording' | 'finishing' | 'review' | 'error'

export type VoiceCaptureLabels = {
  readingLanguage: string
  anotherText: string
  startRecording: string
  stop: string
  stopIn: (seconds: number) => string
  recordAgain: string
  useVoice: string
  play: string
  pause: string
  tryAgain: string
  emptyRecording: string
  tooShort: (seconds: number) => string
  problem: (problem: MediaProblem) => { message: string; help?: string }
}

type RecordedVoice = { file: File; url: string; durationMs: number }

/**
 * Audio-only voice sample: shows a short text to read (TR/EN, 4 texts each), records the raw
 * microphone with a live level bar, allows stopping after `minMs` and auto-stops at `maxMs`.
 */
export function VoiceCaptureStep({
  minMs,
  maxMs,
  labels,
  onUse,
}: {
  minMs: number
  maxMs: number
  labels: VoiceCaptureLabels
  onUse: (file: File, durationMs: number) => void
}) {
  const [language, setLanguage] = React.useState<RecordingLanguage>(() => deviceRecordingLanguage())
  const [textIndex, setTextIndex] = React.useState(0)
  const [phase, setPhase] = React.useState<VoicePhase>('idle')
  const [elapsedMs, setElapsedMs] = React.useState(0)
  const [problem, setProblem] = React.useState<MediaProblem | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [recorded, setRecorded] = React.useState<RecordedVoice | null>(null)

  const mountedRef = React.useRef(true)
  const streamRef = React.useRef<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<number | null>(null)
  const startedAtRef = React.useRef(0)
  const stopElapsedRef = React.useRef<number | null>(null)
  const stopMeterRef = React.useRef<(() => void) | null>(null)
  const levelBarRef = React.useRef<HTMLDivElement | null>(null)
  const recordedUrlRef = React.useRef<string | null>(null)
  const textBoxRef = React.useRef<HTMLDivElement | null>(null)

  const text = readingTextFor(language, textIndex)
  const recording = phase === 'recording'
  const busy = phase === 'starting' || phase === 'recording' || phase === 'finishing'
  const canStop = recording && elapsedMs >= minMs

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseMedia = React.useCallback(() => {
    clearTimer()
    stopMeterRef.current?.()
    stopMeterRef.current = null
    stopMediaStream(streamRef.current)
    streamRef.current = null
  }, [clearTimer])

  const replaceRecorded = React.useCallback((next: RecordedVoice | null) => {
    if (recordedUrlRef.current && recordedUrlRef.current !== next?.url) URL.revokeObjectURL(recordedUrlRef.current)
    recordedUrlRef.current = next?.url ?? null
    setRecorded(next)
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        try {
          recorder.stop()
        } catch {
          /* Already stopped. */
        }
      }
      releaseMedia()
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current)
      recordedUrlRef.current = null
    }
  }, [releaseMedia])

  React.useEffect(() => {
    textBoxRef.current?.scrollTo({ top: 0 })
  }, [text])

  const stopRecording = React.useCallback((force = false) => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    const elapsed = performance.now() - startedAtRef.current
    if (!force && elapsed < minMs) return
    clearTimer()
    stopElapsedRef.current = Math.min(elapsed, maxMs)
    setElapsedMs(stopElapsedRef.current)
    setPhase('finishing')
    try {
      recorder.stop()
    } catch {
      releaseMedia()
      setPhase('idle')
    }
  }, [clearTimer, maxMs, minMs, releaseMedia])

  const startRecording = async () => {
    if (busy) return
    setProblem(null)
    setNotice(null)
    replaceRecorded(null)
    if (!isSecureMediaContext()) {
      setProblem('insecure')
      setPhase('error')
      return
    }
    if (!supportsVoiceRecording()) {
      setProblem('unsupported')
      setPhase('error')
      return
    }
    setPhase('starting')
    // Created inside the tap so iOS allows the meter's AudioContext to run.
    const audioContext = createCaptureAudioContext()
    let stream: MediaStream
    try {
      stream = await openVoiceMicrophone()
    } catch (error) {
      void audioContext?.close().catch(() => undefined)
      if (!mountedRef.current) return
      setProblem(mediaProblemFromError(error, isSecureMediaContext()))
      setPhase('error')
      return
    }
    if (!mountedRef.current) {
      stopMediaStream(stream)
      void audioContext?.close().catch(() => undefined)
      return
    }
    streamRef.current = stream

    const ua = navigator.userAgent
    const mimeType = preferredAudioRecorderMimeType(
      (type) => MediaRecorder.isTypeSupported(type),
      prefersAppleAudioContainer(ua, navigator.platform, navigator.maxTouchPoints),
    )
    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        void audioContext?.close().catch(() => undefined)
        releaseMedia()
        setProblem('unsupported')
        setPhase('error')
        return
      }
    }

    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const durationMs = stopElapsedRef.current ?? Math.min(performance.now() - startedAtRef.current, maxMs)
      stopElapsedRef.current = null
      const type = recorder.mimeType || mimeType
      const blob = new Blob(chunksRef.current, type ? { type } : undefined)
      chunksRef.current = []
      recorderRef.current = null
      releaseMedia()
      if (!mountedRef.current) return
      if (blob.size <= 0) {
        setNotice(labels.emptyRecording)
        setPhase('idle')
        return
      }
      if (durationMs < minMs - 250) {
        setNotice(labels.tooShort(Math.ceil(minMs / 1000)))
        setPhase('idle')
        return
      }
      void finalizeVoiceRecording(blob, type, durationMs, maxMs).then((result) => {
        if (!mountedRef.current) return
        if (result.durationMs < minMs - 250) {
          setNotice(labels.tooShort(Math.ceil(minMs / 1000)))
          setPhase('idle')
          return
        }
        replaceRecorded({ file: result.file, url: URL.createObjectURL(result.file), durationMs: result.durationMs })
        setElapsedMs(result.durationMs)
        setPhase('review')
      })
    }

    stopMeterRef.current = startLevelMeter(stream, (level) => {
      const bar = levelBarRef.current
      if (bar) bar.style.transform = `scaleX(${Math.max(0.02, level)})`
    }, audioContext)

    try {
      recorder.start()
    } catch {
      recorderRef.current = null
      releaseMedia()
      setProblem('unsupported')
      setPhase('error')
      return
    }
    startedAtRef.current = performance.now()
    stopElapsedRef.current = null
    setElapsedMs(0)
    setPhase('recording')
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current
      if (elapsed >= maxMs) {
        stopRecording(true)
        return
      }
      setElapsedMs(elapsed)
    }, 100)
  }

  const recordAgain = () => {
    replaceRecorded(null)
    setElapsedMs(0)
    setNotice(null)
    setPhase('idle')
  }

  const switchLanguage = () => {
    if (busy) return
    setLanguage((current) => toggleRecordingLanguage(current))
  }

  const nextText = () => {
    if (busy) return
    setTextIndex((current) => nextReadingTextIndex(current, readingTextCount(language)))
  }

  const problemCopy = problem ? labels.problem(problem) : null
  const stopSeconds = Math.max(1, Math.ceil((minMs - elapsedMs) / 1000))

  if (phase === 'review' && recorded) {
    return (
      <div className="flex flex-col gap-6">
        <VoicePreview recording={recorded} playLabel={labels.play} pauseLabel={labels.pause} />
        <div className="grid grid-cols-2 gap-3">
          <CaptureButton variant="secondary" onClick={recordAgain}>
            {labels.recordAgain}
          </CaptureButton>
          <CaptureButton onClick={() => onUse(recorded.file, recorded.durationMs)}>
            {labels.useVoice}
          </CaptureButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div
        ref={textBoxRef}
        lang={language}
        tabIndex={0}
        className={cn(
          'max-h-[38dvh] min-h-36 overflow-y-auto overscroll-contain rounded-3xl border px-5 py-4 text-lg leading-8 text-neutral-950 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950',
          recording ? 'border-neutral-950' : 'border-neutral-200',
        )}
      >
        {text}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CaptureIconButton label={labels.readingLanguage} onClick={switchLanguage} disabled={busy}>
            <Languages className="size-4" aria-hidden />
            <span>{language.toUpperCase()}</span>
          </CaptureIconButton>
          <CaptureIconButton label={labels.anotherText} onClick={nextText} disabled={busy}>
            <Shuffle className="size-4" aria-hidden />
          </CaptureIconButton>
        </div>
        <p className="flex items-center gap-2 text-sm tabular-nums text-neutral-500" aria-live="off">
          {recording ? <span className="size-2 animate-pulse rounded-full bg-neutral-950" aria-hidden /> : null}
          <span className={cn(recording && 'text-neutral-950')}>{formatCaptureClock(elapsedMs)}</span>
          <span>/ {formatCaptureClock(maxMs)}</span>
        </p>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
        <div
          ref={levelBarRef}
          className={cn(
            'h-full origin-left rounded-full bg-neutral-950 transition-transform duration-75',
            recording ? 'opacity-100' : 'opacity-0',
          )}
          style={{ transform: 'scaleX(0.02)' }}
        />
      </div>

      {problemCopy ? (
        <div className="mt-5">
          <CaptureNotice help={problemCopy.help}>{problemCopy.message}</CaptureNotice>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-5">
          <CaptureNotice>{notice}</CaptureNotice>
        </div>
      ) : null}

      <div className="mt-6">
        {recording || phase === 'finishing' ? (
          <CaptureButton
            className="w-full"
            disabled={!canStop}
            busy={phase === 'finishing'}
            onClick={() => stopRecording(false)}
          >
            {canStop || phase === 'finishing' ? <Square className="size-4 fill-current" aria-hidden /> : null}
            {canStop || phase === 'finishing' ? labels.stop : labels.stopIn(stopSeconds)}
          </CaptureButton>
        ) : (
          <CaptureButton className="w-full" busy={phase === 'starting'} onClick={() => void startRecording()}>
            {phase === 'starting' ? null : <Mic className="size-4" aria-hidden />}
            {phase === 'error' ? labels.tryAgain : labels.startRecording}
          </CaptureButton>
        )}
      </div>
    </div>
  )
}

/**
 * Decodes the recording and re-encodes it as 16-bit PCM mono WAV (exact duration, one upload type
 * for WebM and Safari/iOS MP4). Falls back to the original container and the timer duration when the
 * browser cannot decode it.
 */
async function finalizeVoiceRecording(
  blob: Blob,
  mimeType: string,
  timerDurationMs: number,
  maxMs: number,
): Promise<{ file: File; durationMs: number }> {
  try {
    return await transcodeVoiceRecordingToWav(blob, { maxDurationMs: maxMs })
  } catch {
    return {
      file: captureFileFromBlob(blob, 'voice_sample', mimeType),
      durationMs: Math.round(Math.min(timerDurationMs, maxMs)),
    }
  }
}

function VoicePreview({
  recording,
  playLabel,
  pauseLabel,
}: {
  recording: RecordedVoice
  playLabel: string
  pauseLabel: string
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [positionMs, setPositionMs] = React.useState(0)
  const durationMs = Math.max(1, recording.durationMs)
  const progress = Math.min(1, positionMs / durationMs)

  const toggle = () => {
    const node = audioRef.current
    if (!node) return
    if (node.paused) {
      if (node.ended || positionMs >= durationMs) node.currentTime = 0
      void node.play().catch(() => setPlaying(false))
    } else {
      node.pause()
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-neutral-200 px-4 py-4">
      <audio
        ref={audioRef}
        src={recording.url}
        preload="auto"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPositionMs(durationMs)
        }}
        onTimeUpdate={(event) => setPositionMs(event.currentTarget.currentTime * 1000)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? pauseLabel : playLabel}
        title={playing ? pauseLabel : playLabel}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
      >
        {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
        <div
          className="h-full origin-left rounded-full bg-neutral-950"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <span className="shrink-0 text-sm tabular-nums text-neutral-500">
        {formatCaptureClock(playing || positionMs > 0 ? Math.min(positionMs, durationMs) : durationMs)}
      </span>
    </div>
  )
}

'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  FileAudio,
  FolderOpen,
  Loader2,
  Mic,
  Square,
  Scissors,
  Upload,
  X,
} from 'lucide-react'

import {
  StorageMediaPickerDialog,
  uploadStorageMedia,
  type StorageMediaSelection,
} from '@/components/storage/storage-media-input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  getStorageDownloadUrl,
  getStorageObject,
  storageUsageAggregateQueryKey,
  storageUsageQueryKey,
  type StorageObjectItem,
} from '@/lib/storage/api'
import { openFileInput } from '@/lib/storage/open-file-picker'
import { publicRuntimeErrorMessageForError } from '@/lib/public-runtime-error'
import {
  MAX_BROWSER_VOICE_REFERENCE_SOURCE_BYTES,
  buildVoiceReferenceClipMetadata,
  buildVoiceReferenceWaveformPeaks,
  createInitialVoiceReferenceTrimRange,
  createVoiceReferenceClipFileName,
  encodeVoiceReferenceMonoPcm16Wav,
  formatVoiceReferenceTime,
  normalizeVoiceReferenceTrimRange,
  readVoiceReferenceTrimConstraints,
  validateVoiceReferenceTrimRange,
  type EncodedVoiceReferenceWav,
  type VoiceReferenceTrimAnchor,
  type VoiceReferenceTrimRange,
} from '@/lib/audio/voice-reference-trim'
import {
  selectVoiceReferenceRecorderMimeType,
  voiceReferenceRecordingFileExtension,
} from '@/lib/audio/voice-reference-recorder'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

type DecodedVoiceReferenceSource = {
  key: string
  channelId: string
  storageObjectId: string | null
  captureMethod: 'browser_microphone' | 'local_file' | 'storage'
  fileName: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
  sampleRate: number
  channels: Float32Array[]
  peaks: number[]
}

type VoiceReferencePhase = {
  kind: 'decoding' | 'uploading' | 'verifying'
  label: string
  progress?: number
}

type VoiceReferencePreview = {
  signature: string
  url: string
  encoded: EncodedVoiceReferenceWav
}

type FinalizedVoiceReference = {
  channelId: string
  objectId: string
  signature: string
}

type PendingVoiceReference = {
  channelId: string
  objectId: string
  signature: string
}

type VoiceReferenceRecorderState = {
  kind: 'idle' | 'requesting' | 'recording' | 'stopping'
  elapsedSeconds: number
  level: number
}

export type VoiceReferenceAudioInputProps = {
  channelId: string | null
  value: string
  inputSchema?: Record<string, unknown>
  disabled?: boolean
  uploadMetadata?: Record<string, string | number | boolean | null>
  onChange: (storageObjectId: string | null) => void
  onBusyChange?: (busy: boolean) => void
}

const WAVEFORM_BINS = 96
const PREVIEW_DEBOUNCE_MS = 140
const STORAGE_READY_POLL_MS = 2_500
const STORAGE_READY_TIMEOUT_MS = 120_000
const AUDIO_METADATA_TIMEOUT_MS = 15_000
const RANGE_STEP_SECONDS = 0.05
const MAX_SOURCE_DURATION_SECONDS = 5 * 60
const MAX_DECODED_PCM_BYTES = 128 * 1024 * 1024
const RECORDING_HARD_LIMIT_SECONDS = 10
const RECORDING_METER_BARS = 12
const IDLE_RECORDER_STATE: VoiceReferenceRecorderState = { kind: 'idle', elapsedSeconds: 0, level: 0 }

/**
 * Selects and trims one instant-clone reference without exposing the source
 * object to the workflow. `onChange` receives only a finalized, ready Storage
 * object ID (or null when the edited selection is no longer finalized).
 */
export function VoiceReferenceAudioInput({
  channelId,
  value,
  inputSchema,
  disabled = false,
  uploadMetadata,
  onChange,
  onBusyChange,
}: VoiceReferenceAudioInputProps) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const queryClient = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const sourceRequestRef = React.useRef(0)
  const sourceAbortRef = React.useRef<AbortController | null>(null)
  const applyAbortRef = React.useRef<AbortController | null>(null)
  const applyInFlightRef = React.useRef(false)
  const previewUrlRef = React.useRef<string | null>(null)
  const onChangeRef = React.useRef(onChange)
  const onBusyChangeRef = React.useRef(onBusyChange)
  const valueRef = React.useRef(value)
  const externalValueAttemptRef = React.useRef<string | null>(null)
  const manualSourcePendingRef = React.useRef(false)
  const activeChannelRef = React.useRef(channelId)
  const previousChannelRef = React.useRef(channelId)
  const channelGenerationRef = React.useRef(0)
  const uploadIdempotencyKeysRef = React.useRef(new Map<string, string>())
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const recorderStreamRef = React.useRef<MediaStream | null>(null)
  const recorderChunksRef = React.useRef<Blob[]>([])
  const recorderSessionRef = React.useRef(0)
  const recorderStartedAtRef = React.useRef(0)
  const recorderIntervalRef = React.useRef<number | null>(null)
  const recorderTimeoutRef = React.useRef<number | null>(null)
  const recorderAudioContextRef = React.useRef<AudioContext | null>(null)
  const recorderSourceNodeRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
  const recorderAnimationFrameRef = React.useRef<number | null>(null)

  const constraints = React.useMemo(
    () => readVoiceReferenceTrimConstraints(inputSchema),
    [inputSchema],
  )
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [source, setSource] = React.useState<DecodedVoiceReferenceSource | null>(null)
  const [range, setRange] = React.useState<VoiceReferenceTrimRange>({
    startSeconds: 0,
    endSeconds: constraints.maxSeconds,
  })
  const [phase, setPhase] = React.useState<VoiceReferencePhase | null>(null)
  const [preview, setPreview] = React.useState<VoiceReferencePreview | null>(null)
  const [finalized, setFinalized] = React.useState<FinalizedVoiceReference | null>(null)
  const [pendingFinalization, setPendingFinalization] = React.useState<PendingVoiceReference | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [recorderState, setRecorderState] = React.useState<VoiceReferenceRecorderState>(IDLE_RECORDER_STATE)
  const recordingLimitSeconds = React.useMemo(
    () => Math.max(1, Math.min(RECORDING_HARD_LIMIT_SECONDS, constraints.maxSeconds)),
    [constraints.maxSeconds],
  )
  const busy = phase !== null || recorderState.kind !== 'idle'

  const cleanupRecordingResources = React.useCallback(() => {
    if (recorderIntervalRef.current !== null) {
      window.clearInterval(recorderIntervalRef.current)
      recorderIntervalRef.current = null
    }
    if (recorderTimeoutRef.current !== null) {
      window.clearTimeout(recorderTimeoutRef.current)
      recorderTimeoutRef.current = null
    }
    if (recorderAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(recorderAnimationFrameRef.current)
      recorderAnimationFrameRef.current = null
    }
    recorderSourceNodeRef.current?.disconnect()
    recorderSourceNodeRef.current = null
    const audioContext = recorderAudioContextRef.current
    recorderAudioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined)
    }
    const stream = recorderStreamRef.current
    recorderStreamRef.current = null
    stream?.getTracks().forEach((track) => track.stop())
    recorderStartedAtRef.current = 0
  }, [])

  const disposeActiveRecording = React.useCallback((updateState = true) => {
    recorderSessionRef.current += 1
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // The recorder already transitioned while the cleanup was running.
        }
      }
    }
    recorderChunksRef.current = []
    cleanupRecordingResources()
    if (updateState) setRecorderState(IDLE_RECORDER_STATE)
  }, [cleanupRecordingResources])

  React.useEffect(() => {
    activeChannelRef.current = channelId
    onChangeRef.current = onChange
    valueRef.current = value
  }, [channelId, onChange, value])

  React.useEffect(() => {
    onBusyChangeRef.current = onBusyChange
  }, [onBusyChange])

  React.useEffect(() => {
    onBusyChangeRef.current?.(busy)
  }, [busy])

  const replacePreview = React.useCallback((next: VoiceReferencePreview | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== next?.url) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = next?.url ?? null
    setPreview(next)
  }, [])

  React.useEffect(() => {
    if (previousChannelRef.current === channelId) return
    disposeActiveRecording()
    previousChannelRef.current = channelId
    channelGenerationRef.current += 1
    sourceRequestRef.current += 1
    sourceAbortRef.current?.abort()
    sourceAbortRef.current = null
    applyAbortRef.current?.abort()
    applyAbortRef.current = null
    applyInFlightRef.current = false
    manualSourcePendingRef.current = false
    externalValueAttemptRef.current = null
    uploadIdempotencyKeysRef.current.clear()
    replacePreview(null)
    setPickerOpen(false)
    setSource(null)
    setFinalized(null)
    setPendingFinalization(null)
    setPhase(null)
    setError(null)
  }, [channelId, disposeActiveRecording, replacePreview])

  React.useEffect(() => () => {
    sourceAbortRef.current?.abort()
    applyAbortRef.current?.abort()
    disposeActiveRecording(false)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    onBusyChangeRef.current?.(false)
  }, [disposeActiveRecording])

  const clearFinalizedValue = React.useCallback(() => {
    setFinalized(null)
    if (valueRef.current) onChangeRef.current(null)
  }, [])

  const setEditedRange = React.useCallback((nextRange: VoiceReferenceTrimRange) => {
    setRange(nextRange)
    replacePreview(null)
    setPendingFinalization(null)
    clearFinalizedValue()
  }, [clearFinalizedValue, replacePreview])

  const prepareBlobSource = React.useCallback(async (input: {
    channelId: string
    blob: Blob
    fileName: string
    mimeType: string
    storageObjectId: string | null
    sourceKey: string
    captureMethod: DecodedVoiceReferenceSource['captureMethod']
    acceptExistingValue?: boolean
  }) => {
    if (activeChannelRef.current !== input.channelId) return
    const channelGeneration = channelGenerationRef.current
    const requestId = sourceRequestRef.current + 1
    sourceRequestRef.current = requestId
    setPhase({ kind: 'decoding', label: 'Reading recording' })
    setError(null)
    replacePreview(null)
    if (!input.acceptExistingValue) clearFinalizedValue()
    setFinalized(null)
    setPendingFinalization(null)

    try {
      if (input.blob.size <= 0) throw new Error('The selected recording is empty.')
      if (input.blob.size > MAX_BROWSER_VOICE_REFERENCE_SOURCE_BYTES) {
        throw new Error('Choose a source recording smaller than 100 MB before trimming.')
      }
      const metadataDurationSeconds = await readVoiceReferenceBlobDuration(input.blob)
      if (
        sourceRequestRef.current !== requestId
        || activeChannelRef.current !== input.channelId
        || channelGenerationRef.current !== channelGeneration
      ) return
      if (metadataDurationSeconds > MAX_SOURCE_DURATION_SECONDS) {
        throw new Error('Choose a source recording no longer than 5 minutes before trimming.')
      }
      const decoded = await decodeVoiceReferenceBlob(input.blob)
      if (
        sourceRequestRef.current !== requestId
        || activeChannelRef.current !== input.channelId
        || channelGenerationRef.current !== channelGeneration
      ) return
      if (!Number.isFinite(decoded.durationSeconds) || decoded.durationSeconds <= 0) {
        throw new Error('The recording duration could not be read.')
      }

      const nextSource: DecodedVoiceReferenceSource = {
        key: input.sourceKey,
        channelId: input.channelId,
        storageObjectId: input.storageObjectId,
        captureMethod: input.captureMethod,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.blob.size,
        durationSeconds: decoded.durationSeconds,
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        peaks: buildVoiceReferenceWaveformPeaks(decoded.channels, WAVEFORM_BINS),
      }
      const nextRange = createInitialVoiceReferenceTrimRange(decoded.durationSeconds, constraints)
      const nextSignature = clipSignature(nextSource, nextRange)
      setSource(nextSource)
      setRange(nextRange)
      if (
        input.acceptExistingValue
        && input.storageObjectId
        && Math.abs(nextRange.endSeconds - decoded.durationSeconds) <= 0.001
        && validateVoiceReferenceTrimRange({
          range: nextRange,
          sourceDurationSeconds: decoded.durationSeconds,
          constraints,
        }) === null
      ) {
        setFinalized({ channelId: input.channelId, objectId: input.storageObjectId, signature: nextSignature })
      } else if (input.acceptExistingValue && valueRef.current === input.storageObjectId) {
        onChangeRef.current(null)
      }
    } catch (sourceError) {
      if (
        sourceRequestRef.current !== requestId
        || activeChannelRef.current !== input.channelId
        || channelGenerationRef.current !== channelGeneration
        || isAbortError(sourceError)
      ) return
      setSource(null)
      setError(errorMessage(sourceError, 'The recording could not be opened.'))
      if (input.acceptExistingValue && valueRef.current === input.storageObjectId) {
        onChangeRef.current(null)
      }
    } finally {
      if (
        activeChannelRef.current === input.channelId
        && channelGenerationRef.current === channelGeneration
      ) manualSourcePendingRef.current = false
      if (
        sourceRequestRef.current === requestId
        && activeChannelRef.current === input.channelId
        && channelGenerationRef.current === channelGeneration
      ) setPhase(null)
    }
  }, [clearFinalizedValue, constraints, replacePreview])

  const prepareLocalFile = React.useCallback(async (file: File) => {
    if (!channelId) return
    if (!isAudioFile(file)) {
      setError('Choose an audio recording.')
      return
    }
    manualSourcePendingRef.current = true
    externalValueAttemptRef.current = valueRef.current
      ? voiceReferenceScopeKey(channelId, valueRef.current)
      : null
    sourceAbortRef.current?.abort()
    sourceAbortRef.current = null
    await prepareBlobSource({
      channelId,
      blob: file,
      fileName: file.name,
      mimeType: file.type || inferAudioMimeType(file.name),
      storageObjectId: null,
      captureMethod: 'local_file',
      sourceKey: `local:${channelId}:${file.name}:${file.size}:${file.lastModified}`,
    })
  }, [channelId, prepareBlobSource])
  const startRecordingMeter = React.useCallback((stream: MediaStream, sessionId: number) => {
    const AudioContextConstructor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    let audioContext: AudioContext | null = null
    try {
      audioContext = new AudioContextConstructor()
      const sourceNode = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.72
      sourceNode.connect(analyser)
      recorderAudioContextRef.current = audioContext
      recorderSourceNodeRef.current = sourceNode
      const samples = new Uint8Array(analyser.fftSize)

      const updateLevel = () => {
        if (recorderSessionRef.current !== sessionId || recorderRef.current?.state === 'inactive') return
        analyser.getByteTimeDomainData(samples)
        let peak = 0
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample - 128) / 128)
        }
        setRecorderState((current) => (
          current.kind === 'recording'
            ? { ...current, level: Math.min(1, peak * 1.5) }
            : current
        ))
        recorderAnimationFrameRef.current = window.requestAnimationFrame(updateLevel)
      }
      recorderAnimationFrameRef.current = window.requestAnimationFrame(updateLevel)
    } catch {
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close().catch(() => undefined)
      }
    }
  }, [])

  const stopVoiceRecording = React.useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recorderIntervalRef.current !== null) {
      window.clearInterval(recorderIntervalRef.current)
      recorderIntervalRef.current = null
    }
    if (recorderTimeoutRef.current !== null) {
      window.clearTimeout(recorderTimeoutRef.current)
      recorderTimeoutRef.current = null
    }
    setRecorderState((current) => (
      current.kind === 'recording'
        ? { ...current, kind: 'stopping', level: 0 }
        : current
    ))
    recorder.stop()
  }, [])

  const startVoiceRecording = React.useCallback(async () => {
    if (!channelId || disabled || phase || recorderState.kind !== 'idle') return
    if (
      typeof navigator === 'undefined'
      || !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === 'undefined'
    ) {
      setError(tAuto('voice_recording_not_supported_f0c99113'))
      return
    }

    const scopeChannelId = channelId
    const sessionId = recorderSessionRef.current + 1
    recorderSessionRef.current = sessionId
    setPickerOpen(false)
    setError(null)
    setRecorderState({ kind: 'requesting', elapsedSeconds: 0, level: 0 })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      if (
        recorderSessionRef.current !== sessionId
        || activeChannelRef.current !== scopeChannelId
      ) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      recorderStreamRef.current = stream
      const mimeType = selectVoiceReferenceRecorderMimeType(
        typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
          : undefined,
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorderChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (recorderSessionRef.current === sessionId && event.data.size > 0) {
          recorderChunksRef.current.push(event.data)
        }
      }
      recorder.onerror = () => {
        if (recorderSessionRef.current !== sessionId) return
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
        recorderRef.current = null
        recorderChunksRef.current = []
        cleanupRecordingResources()
        setRecorderState(IDLE_RECORDER_STATE)
        setError(tAuto('voice_recording_failed_1df89a4d'))
      }
      recorder.onstop = () => {
        const chunks = recorderChunksRef.current
        recorderChunksRef.current = []
        recorderRef.current = null
        cleanupRecordingResources()
        if (
          recorderSessionRef.current !== sessionId
          || activeChannelRef.current !== scopeChannelId
        ) return

        setRecorderState(IDLE_RECORDER_STATE)
        const recordedMimeType = recorder.mimeType || mimeType || chunks[0]?.type || 'audio/webm'
        const blob = new Blob(chunks, { type: recordedMimeType })
        if (blob.size <= 0) {
          setError(tAuto('recording_is_empty_9fcb80d2'))
          return
        }

        manualSourcePendingRef.current = true
        externalValueAttemptRef.current = valueRef.current
          ? voiceReferenceScopeKey(scopeChannelId, valueRef.current)
          : null
        sourceAbortRef.current?.abort()
        sourceAbortRef.current = null
        const extension = voiceReferenceRecordingFileExtension(recordedMimeType)
        void prepareBlobSource({
          channelId: scopeChannelId,
          blob,
          fileName: `voice-reference-${Date.now()}.${extension}`,
          mimeType: recordedMimeType,
          storageObjectId: null,
          captureMethod: 'browser_microphone',
          sourceKey: `microphone:${scopeChannelId}:${sessionId}:${blob.size}`,
        })
      }

      recorder.start(250)
      recorderStartedAtRef.current = performance.now()
      setRecorderState({ kind: 'recording', elapsedSeconds: 0, level: 0 })
      startRecordingMeter(stream, sessionId)
      recorderIntervalRef.current = window.setInterval(() => {
        if (recorderSessionRef.current !== sessionId) return
        const elapsedSeconds = Math.min(
          recordingLimitSeconds,
          Math.max(0, (performance.now() - recorderStartedAtRef.current) / 1_000),
        )
        setRecorderState((current) => (
          current.kind === 'recording' ? { ...current, elapsedSeconds } : current
        ))
      }, 100)
      recorderTimeoutRef.current = window.setTimeout(
        stopVoiceRecording,
        recordingLimitSeconds * 1_000,
      )
    } catch (recordingError) {
      if (recorderSessionRef.current !== sessionId) return
      recorderRef.current = null
      recorderChunksRef.current = []
      cleanupRecordingResources()
      setRecorderState(IDLE_RECORDER_STATE)
      const message = recordingError instanceof DOMException
        && (recordingError.name === 'NotAllowedError' || recordingError.name === 'SecurityError')
        ? tAuto('microphone_access_denied_1a0c4f27')
        : recordingError instanceof DOMException
          && (recordingError.name === 'NotFoundError' || recordingError.name === 'DevicesNotFoundError')
          ? tAuto('microphone_not_found_223cb946')
          : tAuto('voice_recording_could_not_start_7e07c11c')
      setError(message)
    }
  }, [
    channelId,
    cleanupRecordingResources,
    disabled,
    phase,
    prepareBlobSource,
    recorderState.kind,
    recordingLimitSeconds,
    startRecordingMeter,
    stopVoiceRecording,
    tAuto,
  ])

  const prepareStorageSelection = React.useCallback(async (
    selection: StorageMediaSelection,
    acceptExistingValue = false,
  ) => {
    if (!channelId) return
    const scopeChannelId = channelId
    const channelGeneration = channelGenerationRef.current
    manualSourcePendingRef.current = !acceptExistingValue
    if (!acceptExistingValue) {
      externalValueAttemptRef.current = valueRef.current
        ? voiceReferenceScopeKey(scopeChannelId, valueRef.current)
        : null
    }
    const declaredSize = Number(selection.sizeBytes)
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BROWSER_VOICE_REFERENCE_SOURCE_BYTES) {
      manualSourcePendingRef.current = false
      setError('Choose a source recording smaller than 100 MB before trimming.')
      if (acceptExistingValue) {
        externalValueAttemptRef.current = null
        if (valueRef.current === selection.storageObjectId) onChangeRef.current(null)
      } else {
        clearFinalizedValue()
      }
      return
    }

    sourceAbortRef.current?.abort()
    const controller = new AbortController()
    sourceAbortRef.current = controller
    setPhase({ kind: 'decoding', label: 'Opening Storage recording' })
    setError(null)
    try {
      const response = await fetch(getStorageDownloadUrl({
        channelId: scopeChannelId,
        objectId: selection.storageObjectId,
        fileName: selection.name,
      }), {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Storage recording could not be downloaded.')
      const downloaded = await response.blob()
      const contentType = downloaded.type || selection.mimeType || inferAudioMimeType(selection.name)
      const blob = downloaded.type ? downloaded : new Blob([downloaded], { type: contentType })
      if (
        controller.signal.aborted
        || activeChannelRef.current !== scopeChannelId
        || channelGenerationRef.current !== channelGeneration
      ) return
      await prepareBlobSource({
        channelId: scopeChannelId,
        blob,
        fileName: selection.name,
        mimeType: contentType,
        storageObjectId: selection.storageObjectId,
        captureMethod: 'storage',
        sourceKey: `storage:${scopeChannelId}:${selection.storageObjectId}`,
        acceptExistingValue,
      })
    } catch (storageError) {
      if (
        controller.signal.aborted
        || activeChannelRef.current !== scopeChannelId
        || channelGenerationRef.current !== channelGeneration
        || isAbortError(storageError)
      ) return
      manualSourcePendingRef.current = false
      setPhase(null)
      setError(errorMessage(storageError, 'Storage recording could not be opened.'))
      if (acceptExistingValue) {
        externalValueAttemptRef.current = null
        if (valueRef.current === selection.storageObjectId) onChangeRef.current(null)
      }
    }
  }, [channelId, clearFinalizedValue, prepareBlobSource])

  React.useEffect(() => {
    if (!value) {
      externalValueAttemptRef.current = null
      return
    }
    const scopedValueKey = voiceReferenceScopeKey(channelId, value)
    if (
      !channelId
      || disabled
      || busy
      || manualSourcePendingRef.current
      || (finalized?.channelId === channelId && finalized.objectId === value)
      || (source?.channelId === channelId && source.storageObjectId === value)
      || externalValueAttemptRef.current === scopedValueKey
    ) return

    externalValueAttemptRef.current = scopedValueKey
    let cancelled = false
    let handedOffToDownload = false
    const controller = new AbortController()
    void (async () => {
      try {
        const object = await getStorageObject(
          { channelId, objectId: value },
          { signal: controller.signal },
        )
        if (cancelled) return
        if (!isReadyAudioStorageObject(object)) {
          externalValueAttemptRef.current = null
          setError('The selected reference is not ready for voice cloning.')
          onChangeRef.current(null)
          return
        }
        handedOffToDownload = true
        await prepareStorageSelection(storageSelectionFromObject(object), true)
      } catch (loadError) {
        if (externalValueAttemptRef.current === scopedValueKey) {
          externalValueAttemptRef.current = null
        }
        if (
          cancelled
          || isAbortError(loadError)
          || activeChannelRef.current !== channelId
          || valueRef.current !== value
        ) return
        setError(publicRuntimeErrorMessageForError(loadError, 'The selected reference could not be opened.'))
        onChangeRef.current(null)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
      if (!handedOffToDownload && externalValueAttemptRef.current === scopedValueKey) {
        externalValueAttemptRef.current = null
      }
    }
  }, [
    busy,
    channelId,
    disabled,
    finalized?.channelId,
    finalized?.objectId,
    prepareStorageSelection,
    source?.channelId,
    source?.storageObjectId,
    value,
  ])

  React.useEffect(() => {
    if (!source || source.channelId !== channelId) return
    const normalized = normalizeVoiceReferenceTrimRange({
      range,
      sourceDurationSeconds: source.durationSeconds,
      constraints,
      anchor: 'both',
    })
    if (
      Math.abs(normalized.startSeconds - range.startSeconds) <= 0.001
      && Math.abs(normalized.endSeconds - range.endSeconds) <= 0.001
    ) return
    const timeoutId = window.setTimeout(() => setEditedRange(normalized), 0)
    return () => window.clearTimeout(timeoutId)
  }, [channelId, constraints, range, setEditedRange, source])

  const rangeError = source
    ? validateVoiceReferenceTrimRange({
      range,
      sourceDurationSeconds: source.durationSeconds,
      constraints,
    })
    : null
  const currentSignature = source ? clipSignature(source, range) : ''
  const finalizedCurrentSelection = Boolean(
    finalized
    && finalized.channelId === channelId
    && finalized.objectId === value
    && finalized.signature === currentSignature,
  )

  React.useEffect(() => {
    if (!source || source.channelId !== channelId || rangeError) return
    const signature = clipSignature(source, range)
    const timeoutId = window.setTimeout(() => {
      try {
        const encoded = encodeVoiceReferenceMonoPcm16Wav({
          channels: source.channels,
          sampleRate: source.sampleRate,
          range,
        })
        const url = URL.createObjectURL(encoded.blob)
        replacePreview({ signature, url, encoded })
      } catch (previewError) {
        setError(errorMessage(previewError, 'The selected clip could not be prepared.'))
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [channelId, range, rangeError, replacePreview, source])

  const updateRange = React.useCallback((values: number[]) => {
    if (!source || source.channelId !== channelId || values.length < 2) return
    const proposed = {
      startSeconds: values[0] ?? range.startSeconds,
      endSeconds: values[1] ?? range.endSeconds,
    }
    const anchor = changedTrimAnchor(range, proposed)
    setEditedRange(normalizeVoiceReferenceTrimRange({
      range: proposed,
      sourceDurationSeconds: source.durationSeconds,
      constraints,
      anchor,
    }))
  }, [channelId, constraints, range, setEditedRange, source])

  const applyClip = React.useCallback(async () => {
    if (
      !channelId
      || !source
      || source.channelId !== channelId
      || rangeError
      || busy
      || applyInFlightRef.current
      || finalizedCurrentSelection
    ) return
    const scopeChannelId = channelId
    const channelGeneration = channelGenerationRef.current
    const signature = clipSignature(source, range)
    let encoded: EncodedVoiceReferenceWav
    try {
      encoded = preview?.signature === signature
        ? preview.encoded
        : encodeVoiceReferenceMonoPcm16Wav({
          channels: source.channels,
          sampleRate: source.sampleRate,
          range,
        })
    } catch (encodeError) {
      setError(errorMessage(encodeError, 'The selected clip could not be prepared.'))
      return
    }
    if (encoded.byteLength > constraints.maxBytes) {
      setError('The selected WAV clip exceeds the selected model file-size limit.')
      return
    }

    applyInFlightRef.current = true
    applyAbortRef.current?.abort()
    const controller = new AbortController()
    applyAbortRef.current = controller
    const isCurrentOperation = () => (
      !controller.signal.aborted
      && activeChannelRef.current === scopeChannelId
      && channelGenerationRef.current === channelGeneration
    )
    clearFinalizedValue()
    setError(null)
    const file = new File(
      [encoded.blob],
      createVoiceReferenceClipFileName(source.fileName, range),
      { type: 'audio/wav', lastModified: Date.now() },
    )
    const canonicalMetadata = buildVoiceReferenceClipMetadata({
      sourceStorageObjectId: source.storageObjectId,
      sourceFileName: source.fileName,
      sourceDurationSeconds: source.durationSeconds,
      range,
      encodedDurationSeconds: encoded.durationSeconds,
      sampleRate: encoded.sampleRate,
    })

    try {
      let objectId = pendingFinalization?.channelId === scopeChannelId
        && pendingFinalization.signature === signature
        ? pendingFinalization.objectId
        : null
      if (!objectId) {
        setPhase({ kind: 'uploading', label: 'Uploading selected clip', progress: 0 })
        const idempotencyScope = `${scopeChannelId}:${signature}`
        const idempotencyKey = getOrCreateVoiceReferenceUploadKey(
          uploadIdempotencyKeysRef.current,
          idempotencyScope,
        )
        const selection = await uploadStorageMedia(
          scopeChannelId,
          file,
          'audio',
          { ...uploadMetadata, ...canonicalMetadata, capture_method: source.captureMethod },
          (progress) => {
            if (isCurrentOperation()) {
              setPhase({
                kind: 'uploading',
                label: 'Uploading selected clip',
                progress,
              })
            }
          },
          { idempotencyKey, signal: controller.signal },
        )
        if (!isCurrentOperation()) return
        objectId = selection.storageObjectId
        setPendingFinalization({ channelId: scopeChannelId, objectId, signature })
      }
      if (!isCurrentOperation()) return
      setPhase({ kind: 'verifying', label: 'Finishing security checks' })
      await waitForReadyVoiceReference({
        channelId: scopeChannelId,
        objectId,
        signal: controller.signal,
      })
      if (!isCurrentOperation()) return
      setPendingFinalization(null)
      setFinalized({ channelId: scopeChannelId, objectId, signature })
      externalValueAttemptRef.current = voiceReferenceScopeKey(scopeChannelId, objectId)
      onChangeRef.current(objectId)
      void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', scopeChannelId] })
      void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(scopeChannelId) })
      void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
    } catch (uploadError) {
      if (!isCurrentOperation() || isAbortError(uploadError)) return
      setError(publicRuntimeErrorMessageForError(uploadError, 'The selected clip could not be saved to Storage.'))
    } finally {
      if (applyAbortRef.current === controller) {
        applyAbortRef.current = null
        applyInFlightRef.current = false
        if (isCurrentOperation()) setPhase(null)
      }
    }
  }, [
    busy,
    channelId,
    clearFinalizedValue,
    constraints.maxBytes,
    finalizedCurrentSelection,
    pendingFinalization,
    preview,
    queryClient,
    range,
    rangeError,
    source,
    uploadMetadata,
  ])

  const clearSource = React.useCallback(() => {
    sourceRequestRef.current += 1
    sourceAbortRef.current?.abort()
    sourceAbortRef.current = null
    replacePreview(null)
    setSource(null)
    setPendingFinalization(null)
    setError(null)
    setPhase(null)
    clearFinalizedValue()
    externalValueAttemptRef.current = channelId && valueRef.current
      ? voiceReferenceScopeKey(channelId, valueRef.current)
      : null
  }, [channelId, clearFinalizedValue, replacePreview])

  const selectedDuration = Math.max(0, range.endSeconds - range.startSeconds)
  const sliderDisabled = disabled
    || busy
    || !source
    || source.channelId !== channelId
    || source.durationSeconds < constraints.minSeconds
  const previewCurrent = preview?.signature === currentSignature ? preview : null
  const estimatedWavBytes = source
    ? 44 + Math.ceil(selectedDuration * source.sampleRate) * 2
    : 0
  const applyDisabled = disabled
    || busy
    || !channelId
    || !source
    || source.channelId !== channelId
    || Boolean(rangeError)
    || estimatedWavBytes > constraints.maxBytes
    || finalizedCurrentSelection
  const recorderStatusLabel = recorderState.kind === 'requesting'
    ? tAuto('requesting_microphone_access_e540a241')
    : recorderState.kind === 'recording'
      ? tAuto('recording_voice_7fd1c129')
      : recorderState.kind === 'stopping'
        ? tAuto('finishing_recording_482a003e')
        : null

  return (
    <div className="space-y-3">
      <div className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-border bg-panel/40 p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
          {finalizedCurrentSelection
            ? <CheckCircle2 className="size-5 text-emerald-600" />
            : <FileAudio className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {source?.fileName ?? (value ? tAuto('reference_recording_9aff77b2') : tAuto('choose_a_reference_recording_77b5100a'))}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {(phase?.label ? toolCopy(phase.label) : null)
              ?? recorderStatusLabel
              ?? (finalizedCurrentSelection
                ? tAuto('selected_clip_is_ready_in_storage_d5f22638')
                : source
                  ? tAuto('voice_source_trim_hint', { duration: formatVoiceReferenceTime(source.durationSeconds), min: formatVoiceReferenceTime(constraints.minSeconds), max: formatVoiceReferenceTime(constraints.maxSeconds) })
                  : tAuto('local_audio_stays_in_your_browser_until_you_save_032a411d'))}
          </span>
        </span>
        {source || value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || busy}
            aria-label={tAuto('clear_reference_recording_2e81aea9')}
            title={tAuto('clear_reference_recording_2e81aea9')}
            onClick={clearSource}
            className="size-9 shrink-0 rounded-lg hover:bg-accent"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={
            !channelId
            || phase !== null
            || recorderState.kind === 'requesting'
            || recorderState.kind === 'stopping'
            || (disabled && recorderState.kind !== 'recording')
          }
          aria-label={recorderState.kind === 'recording'
            ? tAuto('stop_recording_d77426b1')
            : tAuto('record_voice_33726173')}
          title={recorderState.kind === 'recording'
            ? tAuto('stop_recording_d77426b1')
            : tAuto('record_voice_33726173')}
          aria-pressed={recorderState.kind === 'recording'}
          onClick={() => {
            if (recorderState.kind === 'recording') stopVoiceRecording()
            else void startVoiceRecording()
          }}
          className={cn(
            'h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold',
            recorderState.kind === 'recording'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-foreground text-background hover:bg-foreground/90',
          )}
        >
          {recorderState.kind === 'requesting'
            ? <Loader2 className="size-4 animate-spin" />
            : recorderState.kind === 'recording'
              ? <Square className="size-3.5 fill-current" />
              : <Mic className="size-4" />}
          <span className="hidden sm:inline">
            {recorderState.kind === 'recording'
              ? tAuto('stop_recording_d77426b1')
              : tAuto('record_voice_33726173')}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || busy || !channelId}
          aria-label={tAuto('choose_recording_from_storage_4ebb98d7')}
          title={tAuto('choose_recording_from_storage_4ebb98d7')}
          onClick={() => setPickerOpen(true)}
          className="size-9 shrink-0 rounded-lg border-0 bg-transparent shadow-none hover:bg-accent"
        >
          <FolderOpen className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || !channelId}
          onClick={() => openFileInput(fileInputRef.current)}
          className="h-9 shrink-0 rounded-lg border-0 bg-transparent px-3.5 text-sm font-semibold shadow-none hover:bg-accent"
        >
          {phase?.kind === 'decoding' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <span className="hidden sm:inline"><UiText id="local_file_576d5ace" /></span>
        </Button>
      </div>

      {recorderState.kind !== 'idle' ? (
        <div className="rounded-xl border border-border bg-panel/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {recorderState.kind === 'requesting' || recorderState.kind === 'stopping' ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" role="status" aria-live="polite">
              {recorderStatusLabel}
            </span>
            {recorderState.kind === 'recording' || recorderState.kind === 'stopping' ? (
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatVoiceReferenceTime(recorderState.elapsedSeconds)} / {formatVoiceReferenceTime(recordingLimitSeconds)}
              </span>
            ) : null}
          </div>
          {recorderState.kind === 'recording' ? (
            <div
              className="mt-2 flex h-5 items-end gap-0.5 overflow-hidden rounded-md bg-background/40 px-1.5 py-1"
              role="meter"
              aria-label={tAuto('microphone_input_level_30b45f20')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(recorderState.level * 100)}
            >
              {Array.from({ length: RECORDING_METER_BARS }, (_, index) => {
                const active = recorderState.level * RECORDING_METER_BARS > index
                const height = 35 + ((index * 37) % 65)
                return (
                  <span
                    key={index}
                    className={cn(
                      'min-w-0 flex-1 rounded-full transition-colors duration-75',
                      active ? 'bg-destructive' : 'bg-muted',
                    )}
                    style={{ height: `${height}%` }}
                  />
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.wav,.webm"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            setPickerOpen(false)
            void prepareLocalFile(file)
          }
          event.target.value = ''
        }}
      />

      {phase ? (
        <div className="rounded-xl border border-border bg-panel/40 px-3 py-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="min-w-0 flex-1 truncate">{toolCopy(phase.label)}</span>
            {phase.kind === 'uploading' && phase.progress !== undefined ? (
              <span className="font-medium text-foreground">{phase.progress}%</span>
            ) : null}
          </div>
          {phase.kind === 'uploading' ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.max(4, phase.progress ?? 0)}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs leading-5 text-destructive" role="alert">{error}</p> : null}

      {source ? (
        <section className="space-y-3 rounded-xl border border-border bg-panel/40 p-3.5" aria-label={tAuto('voice_reference_trim_editor_1776545a')}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground"><UiText id="select_the_clearest_voice_section_ccb87727" /></p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <UiText id="only_the_selected_part_is_saved_as_a_new_private_980bda47" /></p>
            </div>
            <span className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
              rangeError
                ? 'border-destructive/35 bg-destructive/5 text-destructive'
                : 'border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}>
              {formatVoiceReferenceTime(selectedDuration)} selected
            </span>
          </div>

          <div className="relative flex h-20 items-center gap-px overflow-hidden rounded-xl border border-border bg-background/40 px-2" aria-hidden="true">
            {source.peaks.map((peak, index) => {
              const positionSeconds = ((index + 0.5) / source.peaks.length) * source.durationSeconds
              const selected = positionSeconds >= range.startSeconds && positionSeconds <= range.endSeconds
              return (
                <span
                  key={index}
                  className={cn(
                    'min-w-0 flex-1 rounded-full transition-colors',
                    selected ? 'bg-primary' : 'bg-muted-foreground/25',
                  )}
                  style={{ height: `${Math.max(8, Math.round(peak * 62))}px` }}
                />
              )
            })}
          </div>

          <Slider
            value={[range.startSeconds, range.endSeconds]}
            min={0}
            max={source.durationSeconds}
            step={RANGE_STEP_SECONDS}
            minStepsBetweenThumbs={Math.ceil(constraints.minSeconds / RANGE_STEP_SECONDS)}
            disabled={sliderDisabled}
            onValueChange={updateRange}
          />
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span><UiText id="start_952f3754" />{' '}{formatVoiceReferenceTime(range.startSeconds)}</span>
            <span><UiText id="allowed_77c7b490" />{' '}{formatVoiceReferenceTime(constraints.minSeconds)}–{formatVoiceReferenceTime(constraints.maxSeconds)}</span>
            <span><UiText id="end_a2bb9d34" />{' '}{formatVoiceReferenceTime(range.endSeconds)}</span>
          </div>

          {rangeError ? <p className="text-xs text-destructive" role="alert">{rangeError}</p> : null}
          {!rangeError && estimatedWavBytes > constraints.maxBytes ? (
            <p className="text-xs text-destructive" role="alert">
              <UiText id="the_selected_wav_clip_exceeds_the_selected_model_b2c393c1" /></p>
          ) : null}

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Scissors className="size-3.5" />
              <UiText id="selected_clip_preview_9197dc00" /></div>
            {previewCurrent ? (
              <audio
                key={previewCurrent.url}
                src={previewCurrent.url}
                controls
                preload="metadata"
                aria-label={tAuto('preview_selected_voice_reference_clip_c79f384c')}
                className="h-10 w-full"
              />
            ) : (
              <div className="flex h-10 items-center gap-2 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" />
                <UiText id="preparing_selected_clip_preview_b490b367" /></div>
            )}
          </div>

          <Button
            type="button"
            disabled={applyDisabled}
            onClick={() => void applyClip()}
            className="h-11 w-full justify-center rounded-xl font-semibold"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : finalizedCurrentSelection ? <CheckCircle2 className="size-4" /> : <Scissors className="size-4" />}
            {finalizedCurrentSelection ? tAuto('selected_clip_ready_0455deb6') : tAuto('use_selected_clip_271f5b84')}
          </Button>
        </section>
      ) : null}

      <StorageMediaPickerDialog
        open={pickerOpen}
        channelId={channelId}
        selectedObjectId={source?.channelId === channelId ? source.storageObjectId ?? undefined : undefined}
        mediaKind="audio"
        uploadState={null}
        onOpenChange={setPickerOpen}
        onUpload={() => openFileInput(fileInputRef.current)}
        onSelect={(selection) => {
          setPickerOpen(false)
          void prepareStorageSelection(selection)
        }}
      />
    </div>
  )
}

async function decodeVoiceReferenceBlob(blob: Blob): Promise<{
  durationSeconds: number
  sampleRate: number
  channels: Float32Array[]
}> {
  const AudioContextConstructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) throw new Error('This browser cannot edit audio recordings.')
  const context = new AudioContextConstructor()
  try {
    const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer())
    const decodedPcmBytes = audioBuffer.length
      * audioBuffer.numberOfChannels
      * Float32Array.BYTES_PER_ELEMENT
    if (decodedPcmBytes > MAX_DECODED_PCM_BYTES) {
      throw new Error('The decoded recording is too large to edit safely in this browser.')
    }
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => (
      new Float32Array(audioBuffer.getChannelData(index))
    ))
    if (channels.length === 0) throw new Error('The recording does not contain an audio channel.')
    return {
      durationSeconds: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels,
    }
  } catch (decodeError) {
    if (
      decodeError instanceof Error
      && decodeError.message === 'The decoded recording is too large to edit safely in this browser.'
    ) throw decodeError
    throw new Error('This recording format could not be decoded by the browser.', { cause: decodeError })
  } finally {
    await context.close().catch(() => undefined)
  }
}

async function readVoiceReferenceBlobDuration(blob: Blob): Promise<number> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = document.createElement('audio')
      let settled = false
      let timeoutId = 0
      const finish = (durationSeconds: number | null, failure?: Error) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        audio.removeEventListener('loadedmetadata', onLoadedMetadata)
        audio.removeEventListener('error', onError)
        audio.removeAttribute('src')
        audio.load()
        if (failure) reject(failure)
        else if (durationSeconds !== null) resolve(durationSeconds)
      }
      const onLoadedMetadata = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          finish(null, new Error('The recording duration could not be read safely.'))
          return
        }
        finish(audio.duration)
      }
      const onError = () => finish(null, new Error('The recording metadata could not be read.'))
      audio.addEventListener('loadedmetadata', onLoadedMetadata)
      audio.addEventListener('error', onError)
      timeoutId = window.setTimeout(() => {
        finish(null, new Error('The recording metadata took too long to read.'))
      }, AUDIO_METADATA_TIMEOUT_MS)
      audio.preload = 'metadata'
      audio.src = objectUrl
      audio.load()
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function waitForReadyVoiceReference(input: {
  channelId: string
  objectId: string
  signal: AbortSignal
}): Promise<StorageObjectItem> {
  const deadline = Date.now() + STORAGE_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (input.signal.aborted) throw new DOMException('Operation aborted.', 'AbortError')
    const object = await getStorageObject({
      channelId: input.channelId,
      objectId: input.objectId,
    }, { signal: input.signal })
    if (isReadyAudioStorageObject(object)) return object
    if (object.status === 'failed' || object.status === 'quarantined' || object.status === 'deleted') {
      throw new Error('Storage security checks rejected the selected clip.')
    }
    await waitForDelay(STORAGE_READY_POLL_MS, input.signal)
  }
  throw new Error('Storage is still checking the selected clip. Try again shortly.')
}

function isReadyAudioStorageObject(object: StorageObjectItem): boolean {
  return object.type === 'file'
    && object.status === 'active'
    && object.workflow_ready
    && object.mime_type?.startsWith('audio/') === true
}

function storageSelectionFromObject(object: StorageObjectItem): StorageMediaSelection {
  return {
    storageObjectId: object.id,
    name: object.name,
    mimeType: object.mime_type,
    sizeBytes: object.size_bytes,
    status: object.status === 'active' ? 'active' : 'processing',
    durationSeconds: object.duration_seconds,
    width: null,
    height: null,
    previewUrl: null,
  }
}

function clipSignature(source: DecodedVoiceReferenceSource, range: VoiceReferenceTrimRange): string {
  return [
    source.key,
    source.sampleRate,
    Math.round(range.startSeconds * 1_000),
    Math.round(range.endSeconds * 1_000),
  ].join(':')
}

function voiceReferenceScopeKey(channelId: string | null, objectId: string): string {
  return `${channelId ?? 'no-channel'}:${objectId}`
}

function getOrCreateVoiceReferenceUploadKey(
  keys: Map<string, string>,
  scope: string,
): string {
  const existing = keys.get(scope)
  if (existing) return existing
  const nonce = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const key = `voice-reference-trim:${nonce}`
  keys.set(scope, key)
  return key
}

function changedTrimAnchor(
  previous: VoiceReferenceTrimRange,
  next: VoiceReferenceTrimRange,
): VoiceReferenceTrimAnchor {
  const startChanged = Math.abs(previous.startSeconds - next.startSeconds) > 0.001
  const endChanged = Math.abs(previous.endSeconds - next.endSeconds) > 0.001
  if (startChanged && !endChanged) return 'start'
  if (endChanged && !startChanged) return 'end'
  return 'both'
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(aac|flac|m4a|mp3|oga|ogg|wav|wave|webm)$/i.test(file.name)
}

function inferAudioMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'm4a') return 'audio/mp4'
  if (extension === 'ogg' || extension === 'oga') return 'audio/ogg'
  if (extension === 'webm') return 'audio/webm'
  if (extension === 'flac') return 'audio/flac'
  if (extension === 'aac') return 'audio/aac'
  return 'audio/wav'
}

function waitForDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Operation aborted.', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Operation aborted.', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

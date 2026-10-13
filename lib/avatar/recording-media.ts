/**
 * Browser media helpers for the two-step avatar capture: front camera + still photo, raw voice
 * microphone and a lightweight input level meter. The pure parts (error mapping, platform
 * detection) are exported separately so they can be unit tested without a DOM.
 */

import {
  CAPTURE_DEFAULTS,
  audioMeterLevel,
  fitWithinMaxEdge,
} from '@/lib/avatar/recording-capture'
import { encodeVoiceWav } from '@/lib/avatar/wav-encoder'

export type MediaProblem = 'insecure' | 'unsupported' | 'denied' | 'not_found' | 'busy' | 'unknown'

export function mediaProblemFromError(error: unknown, secureContext = true): MediaProblem {
  if (!secureContext) return 'insecure'
  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name ?? '')
    : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not_found'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  if (name === 'NotSupportedError' || name === 'TypeError') return 'unsupported'
  return 'unknown'
}

export type PermissionHelpPlatform = 'ios' | 'android' | 'firefox' | 'safari' | 'chrome'

export function permissionHelpPlatform(userAgent: string): PermissionHelpPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  if (/Firefox/i.test(userAgent)) return 'firefox'
  if (/Safari/i.test(userAgent) && !/Chrome|Chromium|Edg/i.test(userAgent)) return 'safari'
  return 'chrome'
}

/** WebKit (iOS browsers and desktop Safari) records audio as MP4/AAC; others prefer WebM/Opus. */
export function prefersAppleAudioContainer(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true
  return /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|Firefox/i.test(userAgent)
}

export function isSecureMediaContext(): boolean {
  return typeof window === 'undefined' || window.isSecureContext !== false
}

export function supportsCameraCapture(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export function supportsVoiceRecording(): boolean {
  return supportsCameraCapture() && typeof MediaRecorder !== 'undefined'
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      /* Track already ended. */
    }
  })
}

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  zoom?: { min?: number }
  resizeMode?: string[]
}

/** Opens the front camera without audio, asking for a large frame and the widest (unzoomed) view. */
export async function openFrontCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'user' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  })
  const track = stream.getVideoTracks()[0]
  if (!track || typeof track.getCapabilities !== 'function') return stream
  try {
    const capabilities = track.getCapabilities() as ExtendedTrackCapabilities
    const advanced: Array<Record<string, unknown>> = []
    if (typeof capabilities.zoom?.min === 'number') advanced.push({ zoom: capabilities.zoom.min })
    if (capabilities.resizeMode?.includes('none')) advanced.push({ resizeMode: 'none' })
    if (advanced.length) {
      await track.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => undefined)
    }
  } catch {
    /* Capabilities are optional. */
  }
  return stream
}

/** Raw microphone for the voice sample: no browser processing so the clone hears the real voice. */
export async function openVoiceMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  })
}

type ImageCaptureLike = { takePhoto: () => Promise<Blob> }
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob && blob.size > 0 ? resolve(blob) : reject(new Error('empty_photo'))),
      'image/jpeg',
      quality,
    )
  })
}

function drawToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  options: { maxEdge: number; quality: number },
): Promise<Blob> {
  const size = fitWithinMaxEdge(width, height, options.maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('no_canvas'))
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, size.width, size.height)
  return canvasToJpeg(canvas, options.quality)
}

/**
 * Takes an un-mirrored still at the camera's best available resolution. Uses
 * `ImageCapture.takePhoto()` where supported (full sensor still), otherwise draws the current
 * video frame. The result is re-encoded as JPEG with the long edge capped at `maxEdge`.
 */
export async function capturePhotoFromStream(
  stream: MediaStream | null,
  video: HTMLVideoElement | null,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<Blob> {
  const settings = {
    maxEdge: options.maxEdge ?? CAPTURE_DEFAULTS.photoMaxEdge,
    quality: options.quality ?? CAPTURE_DEFAULTS.photoQuality,
  }
  const track = stream?.getVideoTracks()[0]
  const ImageCaptureCtor = (globalThis as { ImageCapture?: ImageCaptureConstructor }).ImageCapture
  if (track && track.readyState === 'live' && ImageCaptureCtor && typeof createImageBitmap === 'function') {
    try {
      const photo = await withTimeout(new ImageCaptureCtor(track).takePhoto(), 4000)
      const bitmap = await createImageBitmap(photo)
      try {
        if (bitmap.width >= 2 && bitmap.height >= 2) {
          return await drawToJpeg(bitmap, bitmap.width, bitmap.height, settings)
        }
      } finally {
        bitmap.close?.()
      }
    } catch {
      /* Fall back to the live video frame. */
    }
  }
  if (!video || video.videoWidth < 2 || video.videoHeight < 2) throw new Error('camera_not_ready')
  return drawToJpeg(video, video.videoWidth, video.videoHeight, settings)
}

type AudioContextConstructor = typeof AudioContext

export function createCaptureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = (window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext)
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

/**
 * Streams a smoothed 0..1 input level to `onLevel` on every animation frame. Pass an
 * AudioContext created inside the user gesture so iOS lets it run.
 */
export function startLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
  context: AudioContext | null = createCaptureAudioContext(),
): () => void {
  if (!context) return () => undefined
  let frame = 0
  let smoothed = 0
  let source: MediaStreamAudioSourceNode | null = null
  try {
    void context.resume().catch(() => undefined)
    source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const floats = new Float32Array(analyser.fftSize)
    const bytes = new Uint8Array(analyser.fftSize)
    const canReadFloats = typeof analyser.getFloatTimeDomainData === 'function'
    const tick = () => {
      let level: number
      if (canReadFloats) {
        analyser.getFloatTimeDomainData(floats)
        level = audioMeterLevel(floats)
      } else {
        analyser.getByteTimeDomainData(bytes)
        level = audioMeterLevel(Array.from(bytes, (value) => (value - 128) / 128))
      }
      smoothed = Math.max(level, smoothed * 0.86)
      onLevel(smoothed)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
  } catch {
    /* Metering is optional. */
  }
  return () => {
    if (frame) window.cancelAnimationFrame(frame)
    try {
      source?.disconnect()
    } catch {
      /* Already disconnected. */
    }
    void context.close().catch(() => undefined)
  }
}

type DecodingContext = {
  decodeAudioData: BaseAudioContext['decodeAudioData']
  close?: () => Promise<void>
}

function createDecodingContext(): DecodingContext | null {
  if (typeof window === 'undefined') return null
  const Offline = (window.OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext)
  if (Offline) {
    try {
      return new Offline(1, 1, 48_000)
    } catch {
      /* Fall back to a realtime context. */
    }
  }
  return createCaptureAudioContext()
}

function decodeWithContext(context: DecodingContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    // Older WebKit only supports the callback form and returns undefined.
    const maybePromise = context.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined
    if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject)
  })
}

/**
 * Decodes a recorded voice sample (WebM/Opus, Safari/iOS MP4/AAC, ...) and re-encodes it as a
 * 16-bit PCM mono WAV so the upload always has a supported type and an exact duration.
 */
export async function transcodeVoiceRecordingToWav(
  blob: Blob,
  options: { maxDurationMs?: number | null } = {},
): Promise<{ file: File; durationMs: number }> {
  const context = createDecodingContext()
  if (!context) throw new Error('audio_decode_unsupported')
  try {
    const decoded = await decodeWithContext(context, await blob.arrayBuffer())
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index))
    const result = encodeVoiceWav({ channels, sampleRate: decoded.sampleRate, maxDurationMs: options.maxDurationMs })
    if (result.sampleCount === 0) throw new Error('audio_decode_empty')
    const file = new File([result.wav], 'avatar-voice.wav', { type: 'audio/wav', lastModified: Date.now() })
    return { file, durationMs: result.durationMs }
  } finally {
    void context.close?.().catch(() => undefined)
  }
}

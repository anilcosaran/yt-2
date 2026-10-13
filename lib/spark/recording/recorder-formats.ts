import { baseMimeType, preferredAudioRecorderMimeType } from '@/lib/avatar/recording-capture'
import { prefersAppleAudioContainer } from '@/lib/avatar/recording-media'

import type { RecordingRole } from './recording-types'

/**
 * Container and codec choice of the recorder (D7: WebM, VP9 + Opus with a VP8 fallback). Browsers without WebM recording
 * (older Safari) fall back to MP4/H.264, which the Storage policy accepts as well. `isTypeSupported` is
 * `MediaRecorder.isTypeSupported`, injected so the choice is testable.
 */

const VIDEO_WEBM = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const
const VIDEO_MP4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'] as const

function firstSupported(candidates: readonly string[], isTypeSupported: (type: string) => boolean): string {
  return (
    candidates.find((type) => {
      try {
        return isTypeSupported(type)
      } catch {
        return false
      }
    }) ?? ''
  )
}

/** The recorder type of a video take (screen or camera); '' lets the browser choose its default. */
export function pickVideoRecorderType(isTypeSupported: (type: string) => boolean, applePreferred = false): string {
  return firstSupported(applePreferred ? [...VIDEO_MP4, ...VIDEO_WEBM] : [...VIDEO_WEBM, ...VIDEO_MP4], isTypeSupported)
}

/** The recorder type of a voice take; '' lets the browser choose its default. */
export function pickAudioRecorderType(isTypeSupported: (type: string) => boolean, applePreferred = false): string {
  return preferredAudioRecorderMimeType(isTypeSupported, applePreferred)
}

export function pickRecorderType(role: RecordingRole, isTypeSupported: (type: string) => boolean, applePreferred = false): string {
  return role === 'voice' ? pickAudioRecorderType(isTypeSupported, applePreferred) : pickVideoRecorderType(isTypeSupported, applePreferred)
}

/** Bits per second of the encoders: sized so a 10-minute take stays a manageable upload (screen text stays readable). */
export const RECORDER_BITRATE = {
  screenVideo: 2_000_000,
  cameraVideo: 1_500_000,
  audio: 96_000,
} as const

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/webm': 'weba',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
}

/** Storage's file policy ties the extension to the media type, so the extension follows the type the recorder produced. */
export function extensionForMime(mime: string, role: RecordingRole): string {
  const base = baseMimeType(mime)
  const known = EXTENSION_BY_MIME[base]
  if (known) return known
  return role === 'voice' ? 'weba' : 'webm'
}

/** The media type of a take: the recorder's own type without parameters, else the one that was asked for. */
export function mimeForTake(recorderType: string, requested: string, role: RecordingRole): string {
  const base = baseMimeType(recorderType) || baseMimeType(requested)
  if (base) return base
  return role === 'voice' ? 'audio/webm' : 'video/webm'
}

/**
 * The Storage file name of one part: `<role>-<UTC date>-<UTC time>.<ext>` (no characters Storage's path policy refuses).
 * The two parts of a Screen + camera take share the timestamp, so they sort together.
 */
export function recordingFileName(role: RecordingRole, startedAtMs: number, extension: string): string {
  const stamp = new Date(startedAtMs).toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-')
  return `${role}-${stamp}.${extension}`
}

/** Apple browsers record into MP4 containers (same rule as the avatar capture). */
export function applePreferredBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return prefersAppleAudioContainer(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
}

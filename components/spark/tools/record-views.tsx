'use client'

import * as React from 'react'

import type { RecordingSession } from '@/lib/spark/recording/recording-session'
import { recordingFileName } from '@/lib/spark/recording/recorder-formats'
import type { RecordedPart, RecordingRole, SavePartState } from '@/lib/spark/recording/recording-types'

/** Presentational pieces of the Record drawer: live preview, microphone meter, take player, progress bar. */

/** A live capture stream (always muted: the user hears themselves through the room, not through the preview). */
export function LiveVideo({ stream, label, mirror = false }: { stream: MediaStream; label: string; mirror?: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    element.srcObject = stream
    return () => {
      element.srcObject = null
    }
  }, [stream])
  // The camera self-view is mirrored like a mirror (the recording itself is not).
  return <video ref={ref} className={`rec-video${mirror ? ' mirror' : ''}`} autoPlay muted playsInline aria-label={label} />
}

/** The microphone level; reads its own store so a loud room does not re-render the whole drawer. */
export function LevelMeter({ session, label }: { session: RecordingSession; label: string }) {
  const level = React.useSyncExternalStore(session.subscribeLevel, session.getLevel, session.getLevel)
  const percent = Math.round(level * 100)
  return (
    <div className="rec-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <i style={{ width: `${percent}%` }} />
    </div>
  )
}

/** An object URL of a blob for as long as the component shows it. */
function useObjectUrl(blob: Blob): string | null {
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    let created: string | null = null
    try {
      created = URL.createObjectURL(blob)
    } catch {
      created = null
    }
    // The URL is a resource of the effect (created here, revoked in the cleanup), so it cannot be derived while rendering:
    // React StrictMode runs the cleanup once before the first paint and a memoised URL would be revoked too early.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(created)
    return () => {
      if (created) URL.revokeObjectURL(created)
    }
  }, [blob])
  return url
}

/** Plays a recorded part back (the take review). */
export function TakePlayer({ part, label }: { part: RecordedPart; label: string }) {
  const url = useObjectUrl(part.blob)
  if (!url) return null
  return part.role === 'voice' ? (
    <audio className="rec-audio" controls preload="metadata" src={url} aria-label={label} />
  ) : (
    <video className="rec-video" controls playsInline preload="metadata" src={url} aria-label={label} />
  )
}

/**
 * T1R-10: the take as a file of the user's own, offered next to every state that keeps it only in this page (a failed or
 * refused upload, a take over the plan's size limit). A link to the blob, so nothing leaves the browser by this button.
 */
export function DownloadPart({ part, startedAt, label }: { part: RecordedPart; startedAt: number; label: string }) {
  const url = useObjectUrl(part.blob)
  if (!url) return null
  return (
    <a className="btn sm" href={url} download={recordingFileName(part.role, startedAt, part.extension)} data-rec-download={part.role}>
      {label}
    </a>
  )
}

export function UploadBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="rec-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  )
}

export function megabytes(bytes: number): string {
  return (Math.round(bytes / 104_857.6) / 10).toFixed(1)
}

export type RoleLabels = Readonly<Record<RecordingRole, string>>

export function partStageText(
  part: SavePartState,
  texts: { waiting: string; uploading: (percent: number) => string; processing: string; stalled: string; ready: string; failed: string },
): string {
  switch (part.stage) {
    case 'waiting':
      return texts.waiting
    case 'uploading':
      return texts.uploading(part.progress)
    case 'processing':
      return texts.processing
    case 'stalled':
      return texts.stalled
    case 'ready':
      return texts.ready
    default:
      return texts.failed
  }
}

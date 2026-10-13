'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { CaptureButton, CaptureNotice } from '@/components/recording/capture-ui'
import { captureFileFromBlob } from '@/lib/avatar/recording-capture'
import {
  capturePhotoFromStream,
  isSecureMediaContext,
  mediaProblemFromError,
  openFrontCamera,
  stopMediaStream,
  supportsCameraCapture,
  type MediaProblem,
} from '@/lib/avatar/recording-media'
import { cn } from '@/lib/utils'

type PhotoPhase = 'opening' | 'live' | 'capturing' | 'review' | 'error'

export type PhotoCaptureLabels = {
  openingCamera: string
  takePhoto: string
  retake: string
  usePhoto: string
  tryAgain: string
  captureFailed: string
  problem: (problem: MediaProblem) => { message: string; help?: string }
}

/**
 * Live front-camera preview (mirrored on screen only) with an oval face guide. The shutter
 * produces an un-mirrored JPEG that the user confirms with "Use photo" or discards with "Retake".
 */
export function PhotoCaptureStep({
  labels,
  onUse,
}: {
  labels: PhotoCaptureLabels
  onUse: (file: File) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const mountedRef = React.useRef(true)
  const requestRef = React.useRef(0)
  const [phase, setPhase] = React.useState<PhotoPhase>('opening')
  const [videoReady, setVideoReady] = React.useState(false)
  const [problem, setProblem] = React.useState<MediaProblem | null>(null)
  const [captureError, setCaptureError] = React.useState(false)
  const [photo, setPhoto] = React.useState<{ file: File; url: string } | null>(null)
  const photoUrlRef = React.useRef<string | null>(null)

  const releaseCamera = React.useCallback(() => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  /** Opens the camera for `request`; state only changes after the first await. */
  const connectCamera = React.useCallback(async (request: number) => {
    await Promise.resolve()
    if (!mountedRef.current || request !== requestRef.current) return
    if (!isSecureMediaContext()) {
      setProblem('insecure')
      setPhase('error')
      return
    }
    if (!supportsCameraCapture()) {
      setProblem('unsupported')
      setPhase('error')
      return
    }
    try {
      releaseCamera()
      const stream = await openFrontCamera()
      if (!mountedRef.current || request !== requestRef.current) {
        stopMediaStream(stream)
        return
      }
      streamRef.current = stream
      const node = videoRef.current
      if (node) {
        node.srcObject = stream
        node.muted = true
        node.setAttribute('playsinline', 'true')
        node.setAttribute('webkit-playsinline', 'true')
        void node.play().catch(() => undefined)
      }
      setPhase('live')
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      setProblem(mediaProblemFromError(error, isSecureMediaContext()))
      setPhase('error')
    }
  }, [releaseCamera])

  const reopenCamera = React.useCallback(() => {
    const request = ++requestRef.current
    setProblem(null)
    setCaptureError(false)
    setVideoReady(false)
    setPhase('opening')
    void connectCamera(request)
  }, [connectCamera])

  React.useEffect(() => {
    mountedRef.current = true
    void connectCamera(++requestRef.current)
    return () => {
      mountedRef.current = false
      requestRef.current += 1
      releaseCamera()
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = null
    }
  }, [connectCamera, releaseCamera])

  const setPhotoState = (next: { file: File; url: string } | null) => {
    if (photoUrlRef.current && photoUrlRef.current !== next?.url) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = next?.url ?? null
    setPhoto(next)
  }

  const takePhoto = async () => {
    if (phase !== 'live' || !videoReady) return
    setCaptureError(false)
    setPhase('capturing')
    try {
      const blob = await capturePhotoFromStream(streamRef.current, videoRef.current)
      if (!mountedRef.current) return
      const file = captureFileFromBlob(blob, 'identity_image', 'image/jpeg')
      setPhotoState({ file, url: URL.createObjectURL(file) })
      setPhase('review')
    } catch {
      if (!mountedRef.current) return
      setCaptureError(true)
      setPhase('live')
    }
  }

  const retake = () => {
    setPhotoState(null)
    setCaptureError(false)
    if (streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) {
      setPhase('live')
      void videoRef.current?.play().catch(() => undefined)
      return
    }
    reopenCamera()
  }

  const usePhoto = () => {
    if (!photo) return
    releaseCamera()
    onUse(photo.file)
  }

  const problemCopy = problem ? labels.problem(problem) : null
  const reviewing = phase === 'review' && photo

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'relative aspect-[3/4] w-[min(100%,42dvh)] min-w-[15rem] overflow-hidden rounded-[28px] bg-neutral-100',
          phase === 'error' && 'hidden',
        )}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          disablePictureInPicture
          onLoadedMetadata={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          className={cn(
            'absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-300',
            videoReady ? 'opacity-100' : 'opacity-0',
          )}
        />
        {reviewing ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <FaceGuide />
        )}
        {phase === 'opening' || (phase === 'live' && !videoReady) ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {labels.openingCamera}
          </div>
        ) : null}
        {phase === 'capturing' ? <div className="absolute inset-0 animate-pulse bg-white/40" aria-hidden /> : null}
      </div>

      {phase === 'error' && problemCopy ? (
        <div className="w-full space-y-4">
          <CaptureNotice help={problemCopy.help}>{problemCopy.message}</CaptureNotice>
          <CaptureButton className="w-full" onClick={reopenCamera}>
            {labels.tryAgain}
          </CaptureButton>
        </div>
      ) : null}

      {captureError ? (
        <div className="mt-4 w-full">
          <CaptureNotice>{labels.captureFailed}</CaptureNotice>
        </div>
      ) : null}

      {reviewing ? (
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <CaptureButton variant="secondary" onClick={retake}>
            {labels.retake}
          </CaptureButton>
          <CaptureButton onClick={usePhoto}>{labels.usePhoto}</CaptureButton>
        </div>
      ) : phase !== 'error' ? (
        <div className="mt-6 flex w-full justify-center">
          <button
            type="button"
            aria-label={labels.takePhoto}
            title={labels.takePhoto}
            disabled={phase !== 'live' || !videoReady}
            onClick={() => void takePhoto()}
            className={cn(
              'flex size-[76px] items-center justify-center rounded-full border-[3px] border-neutral-950 p-1 transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4',
              'active:scale-95 disabled:cursor-not-allowed disabled:border-neutral-300',
            )}
          >
            <span
              className={cn(
                'flex size-full items-center justify-center rounded-full transition',
                phase === 'live' && videoReady ? 'bg-neutral-950' : 'bg-neutral-300',
              )}
            >
              {phase === 'capturing' ? <Loader2 className="size-5 animate-spin text-white" aria-hidden /> : null}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function FaceGuide() {
  const maskId = `face-guide-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width="300" height="400" fill="white" />
          <ellipse cx="150" cy="178" rx="96" ry="126" fill="black" />
        </mask>
      </defs>
      <rect width="300" height="400" fill="black" fillOpacity="0.22" mask={`url(#${maskId})`} />
      <ellipse
        cx="150"
        cy="178"
        rx="96"
        ry="126"
        fill="none"
        stroke="white"
        strokeOpacity="0.9"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
    </svg>
  )
}

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  AvatarCaptureFlow,
  captureFlowPropsFromSession,
  type AvatarCaptureFlowProps,
} from '@/components/recording/avatar-capture-flow'
import {
  CaptureMessage,
  CaptureSuccess,
  CaptureSurface,
  CaptureWordmark,
} from '@/components/recording/capture-ui'
import {
  getPublicRecordingSession,
  openPublicRecordingSession,
  uploadPublicRecordingCapture,
  type RecordingSession,
} from '@/lib/avatar/api'
import { resolveCaptureStartStep } from '@/lib/avatar/recording-capture'
import { isPublicRecordingToken } from '@/lib/avatar/origin-host'
import { getSafeAuthMessage, AuthClientError } from '@/lib/auth/errors'
import { calculateFileSha256 } from '@/lib/storage/file-checksum'

type LoadProblem = 'invalid' | 'expired' | 'failed'

/** Origin phone page (`/r/{token}`): loads the public session and runs the two-step capture. */
export function RecordingTokenPage({ token }: { token: string }) {
  const t = useTranslations('PublicRecorder')
  const tokenValid = isPublicRecordingToken(token)
  const [session, setSession] = React.useState<RecordingSession | null>(null)
  const [loadProblem, setLoadProblem] = React.useState<{ kind: LoadProblem; message?: string } | null>(null)
  const problem: { kind: LoadProblem; message?: string } | null = tokenValid ? loadProblem : { kind: 'invalid' }
  const loading = tokenValid && !session && !loadProblem
  const sessionRef = React.useRef<RecordingSession | null>(null)

  React.useEffect(() => {
    sessionRef.current = session
  }, [session])

  React.useEffect(() => {
    if (!tokenValid) return
    const controller = new AbortController()
    void getPublicRecordingSession(token, { signal: controller.signal })
      .then((current) => setSession(current))
      .catch((caught) => {
        if ((caught as Error).name === 'AbortError' || controller.signal.aborted) return
        if (caught instanceof AuthClientError && caught.status === 404) {
          setLoadProblem({ kind: 'invalid' })
          return
        }
        if (caught instanceof AuthClientError && (caught.status === 410 || caught.status === 409)) {
          setLoadProblem({ kind: 'expired' })
          return
        }
        setLoadProblem({ kind: 'failed', message: getSafeAuthMessage(caught) })
      })
    return () => controller.abort()
  }, [token, tokenValid])

  const handleBeforeStart = React.useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.state !== 'created') return
    try {
      const opened = await openPublicRecordingSession(token)
      setSession(opened)
    } catch (caught) {
      throw new Error(getSafeAuthMessage(caught) || t('loadFailed'))
    }
  }, [t, token])

  const handleUpload = React.useCallback<AvatarCaptureFlowProps['onUpload']>(
    async (kind, file, meta, onProgress) => {
      try {
        const checksumSha256 = await calculateFileSha256(file)
        await uploadPublicRecordingCapture({
          token,
          file,
          captureKind: kind,
          durationMs: meta.durationMs,
          checksumSha256,
          consentAccepted: true,
          onProgress,
        })
      } catch (caught) {
        if (caught instanceof AuthClientError && caught.status === 410) throw new Error(t('expired'))
        throw new Error(getSafeAuthMessage(caught) || t('uploadFailed'))
      }
    },
    [t, token],
  )

  if (loading) {
    return (
      <CaptureSurface layout="fullscreen" brand={<CaptureWordmark />}>
        <CaptureMessage busy title={t('loading')} />
      </CaptureSurface>
    )
  }

  if (problem || !session) {
    const kind = problem?.kind ?? 'failed'
    return (
      <CaptureSurface layout="fullscreen" brand={<CaptureWordmark />}>
        <CaptureMessage
          title={kind === 'expired' ? t('expired') : kind === 'invalid' ? t('invalid') : t('loadFailed')}
          description={kind === 'failed' ? problem?.message : null}
          hint={t('backHint')}
        />
      </CaptureSurface>
    )
  }

  if (session.state === 'expired' || session.state === 'revoked') {
    return (
      <CaptureSurface layout="fullscreen" brand={<CaptureWordmark />}>
        <CaptureMessage title={t('expired')} hint={t('backHint')} />
      </CaptureSurface>
    )
  }

  if (resolveCaptureStartStep(null, session.state) === 'done') {
    return (
      <CaptureSurface layout="fullscreen" brand={<CaptureWordmark />}>
        <CaptureSuccess title={t('successTitle')} description={t('successDescription')} />
      </CaptureSurface>
    )
  }

  return (
    <AvatarCaptureFlow
      layout="fullscreen"
      {...captureFlowPropsFromSession(session)}
      successCopy={{ title: t('successTitle'), description: t('successDescription') }}
      onBeforeStart={handleBeforeStart}
      onUpload={handleUpload}
    />
  )
}

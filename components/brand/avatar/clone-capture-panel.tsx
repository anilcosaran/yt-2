'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Circle, Copy, Loader2, Pencil, RefreshCw } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { RecordingQr } from '@/components/recording/recording-qr'
import {
  AvatarCaptureFlow,
  captureFlowPropsFromSession,
  type AvatarCaptureKind,
} from '@/components/recording/avatar-capture-flow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createAvatarIdempotencyKey,
  createRecordingSession,
  getRecordingSession,
  patchRecordingSession,
  recordingSessionQueryKey,
  resolveRecordingPageUrl,
  resolveRecordingToken,
  rotateRecordingSessionToken,
  revokeRecordingSession,
  uploadPublicRecordingCapture,
  type AvatarExpectedPrice,
  type RecordingSession,
} from '@/lib/avatar/api'
import {
  clearRecordingCaptureDraft,
  readRecordingCaptureDraft,
  writeRecordingCaptureDraft,
} from '@/lib/avatar/recording-draft'
import { readBrowserPrincipalScope, BROWSER_PRINCIPAL_CHANGED_EVENT } from '@/lib/auth/browser-principal-storage'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { calculateFileSha256 } from '@/lib/storage/file-checksum'
import { cn } from '@/lib/utils'

export type CloneCaptureMode = 'webcam' | 'phone'

/** Price acknowledgement and voice option sent when this panel has to open a new session. */
export type CloneCaptureSessionOptions = {
  expectedPrice: AvatarExpectedPrice
  createVoiceFromRecording: boolean
}

type RecordingSecrets = {
  token: string
  recording_url: string
  qr_payload: string
}

const EMPTY_SECRETS: RecordingSecrets = {
  token: '',
  recording_url: '',
  qr_payload: '',
}

function overlayRecordingSecrets(
  next: RecordingSession,
  current: RecordingSecrets,
): { session: RecordingSession; secrets: RecordingSecrets } {
  if (next.recovery_required) {
    return {
      secrets: EMPTY_SECRETS,
      session: { ...next, token: undefined, recording_url: undefined, qr_payload: null },
    }
  }
  const token = resolveRecordingToken(next) || current.token
  const recordingUrl = next.recording_url?.trim() || current.recording_url
  const qrPayload = next.qr_payload?.trim() || current.qr_payload || recordingUrl
  const secrets: RecordingSecrets = token || recordingUrl
    ? { token, recording_url: recordingUrl, qr_payload: qrPayload }
    : current
  return {
    secrets,
    session: {
      ...next,
      token: token || next.token,
      recording_url: recordingUrl || next.recording_url,
      qr_payload: qrPayload || next.qr_payload,
    },
  }
}

function persistDraft(
  channelId: string,
  session: Pick<RecordingSession, 'id' | 'token' | 'recording_url' | 'qr_payload' | 'expires_at'>,
) {
  const token = resolveRecordingToken(session)
  const recordingUrl = resolveRecordingPageUrl(session)
  writeRecordingCaptureDraft(channelId, {
    id: session.id,
    token,
    recording_url: recordingUrl,
    qr_payload: session.qr_payload?.trim() || recordingUrl,
    expires_at: session.expires_at,
  })
}

export function CloneCapturePanel({
  active,
  channelId,
  onModeChange,
  onSessionChange,
  initialSession = null,
  sessionOptions = null,
  autoStart = true,
  onRequireStart,
  showReservedName = true,
}: {
  active: boolean
  channelId: string
  onModeChange: (mode: CloneCaptureMode) => void
  onSessionChange: (session: RecordingSession | null) => void
  /** A session the caller already opened (after the priced "Start recording" click). */
  initialSession?: RecordingSession | null
  /** Used when the panel itself must open a replacement session (refresh after expiry). */
  sessionOptions?: CloneCaptureSessionOptions | null
  /**
   * When false the panel never opens a session on its own: it only resumes `initialSession` or the
   * stored draft, and calls `onRequireStart` so the caller can show the priced confirm step again.
   */
  autoStart?: boolean
  onRequireStart?: () => void
  showReservedName?: boolean
}) {
  const t = useTranslations('BrandAvatar')
  const locale = useLocale()
  const [mode, setMode] = React.useState<CloneCaptureMode>('phone')
  const [session, setSession] = React.useState<RecordingSession | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const copiedTimerRef = React.useRef<number | null>(null)
  const startedRef = React.useRef(false)
  const secretsRef = React.useRef<RecordingSecrets>(EMPTY_SECRETS)
  const onSessionChangeRef = React.useRef(onSessionChange)
  const onModeChangeRef = React.useRef(onModeChange)
  const initialSessionRef = React.useRef(initialSession)
  const sessionOptionsRef = React.useRef(sessionOptions)
  const onRequireStartRef = React.useRef(onRequireStart)
  React.useEffect(() => {
    sessionOptionsRef.current = sessionOptions
    onRequireStartRef.current = onRequireStart
  }, [onRequireStart, sessionOptions])
  const lastParentNotifyKeyRef = React.useRef('')
  const [secrets, setSecrets] = React.useState<RecordingSecrets>(EMPTY_SECRETS)
  const [principal, setPrincipal] = React.useState(() => readBrowserPrincipalScope())
  const scopeEpoch = React.useRef(0)
  const currentChannel = React.useRef(channelId)
  React.useEffect(() => {
    currentChannel.current = channelId
  }, [channelId])
  const captureScope = React.useCallback(() => {
    const epoch = scopeEpoch.current
    const owner = readBrowserPrincipalScope()
    return () => scopeEpoch.current === epoch && currentChannel.current === channelId
      && readBrowserPrincipalScope() === owner
  }, [channelId])
  React.useEffect(() => {
    const changed = () => { scopeEpoch.current += 1; setPrincipal(readBrowserPrincipalScope()) }
    window.addEventListener(BROWSER_PRINCIPAL_CHANGED_EVENT, changed)
    return () => { scopeEpoch.current += 1; window.removeEventListener(BROWSER_PRINCIPAL_CHANGED_EVENT, changed) }
  }, [])

  React.useEffect(() => {
    onSessionChangeRef.current = onSessionChange
    onModeChangeRef.current = onModeChange
  }, [onModeChange, onSessionChange])

  const setModeAndNotify = (next: CloneCaptureMode) => {
    setMode(next)
    onModeChangeRef.current(next)
  }

  const notifyParent = React.useCallback((next: RecordingSession | null) => {
    const key = next
      ? `${next.id}:${next.state}:${next.storage_object_id ?? ''}:${next.avatar_id ?? ''}:${next.display_name ?? ''}:${next.auto_create_status ?? ''}:${next.refund_status ?? ''}:${next.recovery_required ? '1' : '0'}`
      : ''
    if (key === lastParentNotifyKeyRef.current) return
    lastParentNotifyKeyRef.current = key
    onSessionChangeRef.current(next)
  }, [])

  const applySession = React.useCallback((next: RecordingSession | null) => {
    if (!next) {
      secretsRef.current = EMPTY_SECRETS
      setSecrets(EMPTY_SECRETS)
      setSession(null)
      notifyParent(null)
      return
    }
    const merged = overlayRecordingSecrets(next, secretsRef.current)
    secretsRef.current = merged.secrets
    setSecrets(merged.secrets)
    setSession(merged.session)
    notifyParent(merged.session)
  }, [notifyParent])

  const mergeSession = React.useCallback((current: RecordingSession | null, next: RecordingSession) => {
    const base = current ?? next
    return overlayRecordingSecrets({
      ...next,
      token: next.token || base.token,
      recording_url: next.recording_url || base.recording_url,
      qr_payload: next.qr_payload || base.qr_payload,
    }, secretsRef.current).session
  }, [])

  const startSession = React.useCallback(async () => {
    const isCurrent = captureScope()
    const options = sessionOptionsRef.current
    if (!autoStart && !options) {
      onRequireStartRef.current?.()
      return undefined
    }
    const created = await createRecordingSession({
      channelId,
      language: locale,
      idempotencyKey: createAvatarIdempotencyKey('recording-session'),
      expectedPrice: options?.expectedPrice,
      createVoiceFromRecording: options?.createVoiceFromRecording,
    })
    if (!isCurrent()) return
    applySession(created)
    persistDraft(channelId, created)
    return created
  }, [applySession, autoStart, captureScope, channelId, locale])

  React.useEffect(() => {
    scopeEpoch.current += 1
    startedRef.current = false
    applySession(null)
  }, [active, applySession, channelId, principal])

  React.useEffect(() => {
    if (!active) {
      startedRef.current = false
      secretsRef.current = EMPTY_SECRETS
      applySession(null)
      setCreateError(null)
      setCreating(false)
      setRefreshing(false)
      setCopied(false)
      setMode('phone')
      onModeChangeRef.current('phone')
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    let cancelled = false
    const isCurrent = captureScope()
    setCreating(true)
    setCreateError(null)
    void restoreOrStartSession()
      .catch((error) => {
        if (!cancelled) {
          startedRef.current = false
          setCreateError(getSafeAuthMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) setCreating(false)
      })
    return () => {
      cancelled = true
    }

    async function restoreOrStartSession() {
      const provided = initialSessionRef.current
      if (provided && provided.state !== 'expired' && provided.state !== 'revoked') {
        initialSessionRef.current = null
        applySession(provided)
        persistDraft(channelId, provided)
        return
      }
      const draft = readRecordingCaptureDraft(channelId)
      if (draft) {
        try {
          const current = await getRecordingSession(draft.id)
          if (cancelled || !isCurrent()) return
          if (current.state !== 'expired' && current.state !== 'revoked') {
            applySession({
              ...current,
              token: current.token || draft.token,
              recording_url: current.recording_url || draft.recording_url,
              qr_payload: current.qr_payload || draft.qr_payload,
            })
            persistDraft(channelId, {
              ...current,
              token: current.token || draft.token,
              recording_url: current.recording_url || draft.recording_url,
              qr_payload: current.qr_payload || draft.qr_payload,
            })
            return
          }
        } catch (error) {
          if (cancelled || !isCurrent()) return
          const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
          if (status !== 404 && status !== 410) throw error
        }
        if (cancelled || !isCurrent()) return
        clearRecordingCaptureDraft(channelId)
      }
      if (!cancelled && isCurrent()) await startSession()
    }
  }, [active, applySession, captureScope, channelId, principal, startSession])

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
    }
  }, [])

  const sessionQuery = useQuery({
    queryKey: [...recordingSessionQueryKey(session?.id ?? null), principal],
    queryFn: ({ signal }) => getRecordingSession(session!.id, { signal }),
    enabled: Boolean(active && session?.id),
    refetchInterval: (query) => {
      const state = query.state.data?.state ?? session?.state
      if (query.state.data?.refund_status === 'pending') return 2_000
      if (state === 'consumed' || state === 'expired' || state === 'revoked') {
        return false
      }
      if (query.state.data?.auto_create_status === 'failed') {
        return false
      }
      if (state === 'uploaded' && query.state.data?.avatar_id) {
        return false
      }
      return 2_000
    },
  })

  const liveSession = React.useMemo(() => {
    if (!session) return null
    const incoming = sessionQuery.data && (sessionQuery.data.token_generation ?? 1) >= (session.token_generation ?? 1)
      ? {
          ...sessionQuery.data,
          token: sessionQuery.data.token || session.token,
          recording_url: sessionQuery.data.recording_url || session.recording_url,
          qr_payload: sessionQuery.data.qr_payload || session.qr_payload,
        }
      : session
    return overlayRecordingSecrets(incoming, secrets).session
  }, [secrets, session, sessionQuery.data])
  const uploaded = liveSession?.state === 'uploaded' || liveSession?.state === 'consumed'
  const qrTarget = liveSession ? resolveRecordingPageUrl(liveSession) : ''
  const expiry = useExpiryClock(liveSession?.expires_at)

  React.useEffect(() => {
    notifyParent(liveSession)
  }, [liveSession, notifyParent])

  React.useEffect(() => {
    if (!active || !liveSession?.id) return
    if (liveSession.state === 'consumed' || liveSession.avatar_id) {
      clearRecordingCaptureDraft(channelId)
      return
    }
    persistDraft(channelId, liveSession)
  }, [active, channelId, liveSession])

  const handleCaptureUpload = async (
    kind: AvatarCaptureKind,
    file: File,
    meta: { durationMs?: number },
    onProgress: (progress: number) => void,
  ) => {
    const isCurrent = captureScope()
    const token = liveSession ? resolveRecordingToken(liveSession) : secrets.token
    if (!liveSession || !token) throw new Error(t('qrUnavailable'))
    try {
      const checksumSha256 = await calculateFileSha256(file)
      if (!isCurrent()) return
      await uploadPublicRecordingCapture({
        token,
        file,
        checksumSha256,
        consentAccepted: true,
        captureKind: kind,
        durationMs: meta.durationMs,
        onProgress: (progress) => { if (isCurrent()) onProgress(progress) },
      })
      if (!isCurrent()) return
      const next = mergeSession(liveSession, await getRecordingSession(liveSession.id))
      if (isCurrent()) applySession(next)
    } catch (error) {
      throw new Error(getSafeAuthMessage(error) || t('qrUnavailable'))
    }
  }

  const recoverSession = React.useCallback(async () => {
    if (!liveSession?.id || refreshing) return
    const isCurrent = captureScope()
    setRefreshing(true)
    setCreateError(null)
    try {
      const rotated = await rotateRecordingSessionToken({
        sessionId: liveSession.id,
        idempotencyKey: createAvatarIdempotencyKey('recording-rotate'),
      })
      if (!isCurrent()) return
      secretsRef.current = EMPTY_SECRETS
      applySession(rotated)
      persistDraft(channelId, rotated)
    } catch (error) {
      if (isCurrent()) setCreateError(getSafeAuthMessage(error) || t('qrUnavailable'))
    } finally {
      if (isCurrent()) setRefreshing(false)
    }
  }, [applySession, captureScope, channelId, liveSession?.id, refreshing, t])

  const refreshSession = React.useCallback(async () => {
    if (refreshing) return
    if (liveSession?.id && !expiry.expired && !uploaded) { await recoverSession(); return }
    const isCurrent = captureScope()
    setRefreshing(true)
    setCreateError(null)
    try {
      if (liveSession?.id) {
        await revokeRecordingSession(liveSession.id)
      }
      if (!isCurrent()) return
      clearRecordingCaptureDraft(channelId)
      secretsRef.current = EMPTY_SECRETS
      startedRef.current = true
      await startSession()
    } catch (error) {
      if (isCurrent()) { startedRef.current = false; setCreateError(getSafeAuthMessage(error)) }
    } finally {
      if (isCurrent()) setRefreshing(false)
    }
  }, [captureScope, channelId, expiry.expired, liveSession?.id, recoverSession, refreshing, startSession, uploaded])

  const copyLink = async () => {
    if (!qrTarget) return
    try {
      await navigator.clipboard.writeText(qrTarget)
      setCopied(true)
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      toast.error(getSafeAuthMessage(error))
    }
  }

  const photoState = liveSession?.steps?.identity_image?.state ?? (uploaded ? 'uploaded' : 'pending')
  const voiceState = liveSession?.steps?.voice_sample?.state ?? (uploaded ? 'uploaded' : 'pending')

  return (
    <div data-clone-capture="panel" className="mx-auto w-full max-w-2xl space-y-5">
      <div
        role="tablist"
        aria-label={t('captureTitle')}
        className="mx-auto flex w-full max-w-xs rounded-full bg-muted/80 p-1"
      >
        <ModeTab
          active={mode === 'phone'}
          label={t('capturePhone')}
          onClick={() => setModeAndNotify('phone')}
        />
        <ModeTab
          active={mode === 'webcam'}
          label={t('captureWebcam')}
          onClick={() => setModeAndNotify('webcam')}
        />
      </div>

      {createError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {createError}
        </p>
      ) : null}

      {liveSession?.auto_create_status === 'failed' ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('recordingGenerationFailed')}{' '}
          {t(liveSession.refund_status === 'pending' ? 'recordingRefundPending'
            : liveSession.refund_status === 'completed' ? 'recordingRefundCompleted' : 'recordingRefundNone')}
        </div>
      ) : null}

      {liveSession && showReservedName ? (
        <ReservedAvatarName
          session={liveSession}
          disabled={uploaded || refreshing}
          onRenamed={(session) => applySession(mergeSession(liveSession, session))}
        />
      ) : null}

      {mode === 'phone' ? (
        creating && !liveSession ? (
          <BusyState label={t('waitingForVideo')} />
        ) : (
          <div className="flex flex-col items-center gap-5 rounded-[28px] border border-border/70 px-5 py-8 text-center">
            {qrTarget ? (
              <div className="rounded-3xl bg-white p-3 shadow-sm">
                <RecordingQr value={qrTarget} alt={t('capturePhone')} size={220} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('qrUnavailable')}</p>
            )}
            <p className="max-w-xs text-sm text-muted-foreground">{t('phoneScanHint')}</p>
            <div className="flex items-center gap-2" data-capture-steps="progress">
              <CaptureStepPill label={t('stepPhoto')} state={photoState} />
              <CaptureStepPill label={t('stepVoice')} state={voiceState} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-foreground disabled:opacity-50"
                disabled={!qrTarget}
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? t('copied') : t('copyLink')}
              </button>
              <span aria-hidden>·</span>
              <span>{expiry.expired ? t('qrExpired') : t('linkExpiresIn', { time: expiry.label })}</span>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-foreground disabled:opacity-50"
                disabled={refreshing}
                onClick={() => void (liveSession?.recovery_required && !expiry.expired ? recoverSession() : refreshSession())}
              >
                <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                {t('refreshNow')}
              </button>
            </div>
          </div>
        )
      ) : null}

      {mode === 'webcam' ? (
        creating && !liveSession ? (
          <BusyState label={t('waitingForVideo')} />
        ) : liveSession ? (
          <AvatarCaptureFlow
            layout="embedded"
            {...captureFlowPropsFromSession(liveSession)}
            onUpload={handleCaptureUpload}
            successCopy={{ title: t('captureReceived'), description: t('createdAndProcessing') }}
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t('qrUnavailable')}</p>
        )
      ) : null}
    </div>
  )
}

function CaptureStepPill({ label, state }: { label: string; state: string }) {
  const t = useTranslations('BrandAvatar')
  const done = state === 'uploaded'
  const busy = state === 'uploading'
  return (
    <span
      data-capture-step-state={state}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        done ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground',
      )}
      title={done ? t('stepReceived') : t('stepWaiting')}
    >
      {done ? <Check className="size-3.5" /> : busy ? <Loader2 className="size-3.5 animate-spin" /> : <Circle className="size-3" />}
      {label}
    </span>
  )
}

function ReservedAvatarName({
  session,
  disabled,
  onRenamed,
}: {
  session: RecordingSession
  disabled?: boolean
  onRenamed: (session: RecordingSession) => void
}) {
  const t = useTranslations('BrandAvatar')
  const reserved = session.display_name?.trim() || ''
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(reserved)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!editing) setValue(reserved)
  }, [editing, reserved])

  const save = async () => {
    const next = value.trim()
    if (!next || next === reserved || saving || disabled) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      onRenamed(await patchRecordingSession({ sessionId: session.id, displayName: next }))
      setEditing(false)
    } catch (caught) {
      setError(getSafeAuthMessage(caught) || t('nameTaken'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-lg space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t('reservedName')}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            maxLength={120}
            autoFocus
            disabled={saving || disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
              if (event.key === 'Escape') setEditing(false)
            }}
          />
          <Button type="button" size="sm" className="rounded-xl" disabled={saving || disabled} onClick={() => void save()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : t('saveName')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{reserved || t('qrUnavailable')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            disabled={disabled || !session.id}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
            {t('editName')}
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function ModeTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold transition sm:text-sm',
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function BusyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      {label}
    </div>
  )
}

function useExpiryClock(expiresAt: string | undefined) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!expiresAt) return { label: '--:--', expired: false }
  const remainingMs = new Date(expiresAt).getTime() - now
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { label: '00:00', expired: true }
  }
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return {
    label: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    expired: false,
  }
}

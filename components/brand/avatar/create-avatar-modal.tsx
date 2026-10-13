'use client'

import * as React from 'react'
import { ArrowLeft, Lock, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { AvatarCharacterForm, describeCreateError } from '@/components/brand/avatar/avatar-character-form'
import { AvatarUpgradePanel } from '@/components/brand/avatar/avatar-upgrade-panel'
import { AvatarUpgradeNote } from '@/components/brand/avatar/avatar-voice-controls'
import { CloneCapturePanel, type CloneCaptureMode } from '@/components/brand/avatar/clone-capture-panel'
import { CreditActionButton } from '@/components/billing/credit-action-button'
import type { StorageMediaSelection } from '@/components/storage/storage-media-input'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createAvatar,
  createAvatarIdempotencyKey,
  createRecordingSession,
  patchRecordingSession,
  type Avatar,
  type AvatarKind,
  type DigitalHumanBrief,
  type RecordingSession,
} from '@/lib/avatar/api'
import { characterDraftFromBrief } from '@/lib/avatar/character'
import { nextAvatarDisplayName } from '@/lib/avatar/display-name'
import {
  avatarEstimate,
  classifyAvatarPurchaseError,
  isAvatarFairUseReached,
  isVoiceProfileSlotsFull,
  resolveAvatarCreationPrice,
  toAvatarExpectedPrice,
  type AvatarEntitlement,
} from '@/lib/avatar/entitlement'
import { clearRecordingCaptureDraft, readRecordingCaptureDraft } from '@/lib/avatar/recording-draft'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import type { CreditPrice } from '@/lib/billing/credit-price'
import { cn } from '@/lib/utils'

export type CreateAvatarStep = 'kind' | 'upgrade' | 'clone_confirm' | 'clone_capture' | 'character'

const ignoreCloneCaptureMode: (mode: CloneCaptureMode) => void = () => {}

export const AVATAR_KIND_IMAGES: Record<AvatarKind, string> = {
  human_clone: '/brand/clone-human-card.png',
  digital_human: '/brand/virtual-character-card.png',
}

/** Resolves where the flow starts for a requested kind (upgrade for Basic clones, resume a draft). */
export function resolveCreateAvatarStep(input: {
  kind: AvatarKind | null | undefined
  entitlement: AvatarEntitlement | null
  hasRecordingDraft: boolean
}): CreateAvatarStep {
  if (input.kind === 'digital_human') return 'character'
  if (input.kind === 'human_clone') {
    if (input.entitlement && !input.entitlement.clone_enabled) return 'upgrade'
    return input.hasRecordingDraft ? 'clone_capture' : 'clone_confirm'
  }
  return 'kind'
}

type CreateAvatarFlowProps = {
  channelId: string
  entitlement: AvatarEntitlement | null
  initialKind?: AvatarKind | null
  initialSourceStorageObjectId?: string | null
  initialBrief?: Partial<DigitalHumanBrief> | null
  existingNames?: string[]
  onClose: () => void
  onCreated: (avatar: Avatar) => void
  onEntitlementStale?: () => void
  /** Test/preview hook: start on a specific step. */
  initialStep?: CreateAvatarStep
}

/** Avatar creation as a stepped dialog (desktop ~720px, character step ~960px, mobile full screen). */
export function CreateAvatarModal({
  open,
  onOpenChange,
  ...flow
}: Omit<CreateAvatarFlowProps, 'onClose'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [wide, setWide] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-avatar-surface="create-avatar-modal"
        className={cn(
          'flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-[20px] p-0',
          wide ? 'sm:max-w-[960px]' : 'sm:max-w-[720px]',
          'max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0',
        )}
      >
        {open ? (
          <CreateAvatarFlow
            {...flow}
            onClose={() => onOpenChange(false)}
            onWideChange={setWide}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function CreateAvatarFlow({
  channelId,
  entitlement,
  initialKind = null,
  initialSourceStorageObjectId = null,
  initialBrief = null,
  existingNames = [],
  onClose,
  onCreated,
  onEntitlementStale,
  initialStep,
  onWideChange,
}: CreateAvatarFlowProps & { onWideChange?: (wide: boolean) => void }) {
  const t = useTranslations('BrandAvatar')
  const tFlow = useTranslations('BrandAvatar.createFlow')
  const sourceObjectId = initialSourceStorageObjectId?.trim() || ''
  const requestedKind: AvatarKind | null = sourceObjectId ? 'digital_human' : initialKind
  const chooserAvailable = !requestedKind
  const [step, setStep] = React.useState<CreateAvatarStep>(() => initialStep ?? resolveCreateAvatarStep({
    kind: requestedKind,
    entitlement,
    hasRecordingDraft: Boolean(readRecordingCaptureDraft(channelId)),
  }))
  const [captureSession, setCaptureSession] = React.useState<RecordingSession | null>(null)
  const [startedSession, setStartedSession] = React.useState<RecordingSession | null>(null)
  const [captureError, setCaptureError] = React.useState<string | null>(null)
  const defaultDisplayName = React.useMemo(() => nextAvatarDisplayName(existingNames), [existingNames])
  const initialDraft = React.useMemo(() => characterDraftFromBrief(initialBrief), [initialBrief])
  const initialReference = React.useMemo<StorageMediaSelection | null>(() => sourceObjectId ? {
    storageObjectId: sourceObjectId,
    name: '',
    mimeType: null,
    sizeBytes: '0',
    status: 'active',
    durationSeconds: null,
    width: null,
    height: null,
    previewUrl: null,
  } : null, [sourceObjectId])
  const createdIdRef = React.useRef<string | null>(null)
  const fallbackStartedRef = React.useRef(false)

  // Late entitlement: a Basic user who opened "Clone" before the plan loaded gets the upgrade panel.
  const effectiveStep: CreateAvatarStep = (step === 'clone_confirm' || step === 'clone_capture')
    && entitlement && !entitlement.clone_enabled && !startedSession && !readRecordingCaptureDraftSafe(channelId)
    ? 'upgrade'
    : step

  React.useEffect(() => {
    onWideChange?.(effectiveStep === 'character')
  }, [effectiveStep, onWideChange])

  const finishClone = React.useCallback((avatar: Avatar) => {
    if (createdIdRef.current && createdIdRef.current !== avatar.id) return
    createdIdRef.current = avatar.id
    clearRecordingCaptureDraft(channelId)
    onCreated(avatar)
  }, [channelId, onCreated])

  // Recording finished: the gateway auto-creates the avatar; open it as soon as its id appears.
  React.useEffect(() => {
    const session = captureSession
    if (!session) return
    if (session.auto_create_status === 'failed') {
      fallbackStartedRef.current = false
      return
    }
    const avatarId = session.avatar_id
    if (avatarId) {
      if (createdIdRef.current === avatarId) return
      finishClone(provisioningCloneAvatar({ session, avatarId, channelId }))
      return
    }
    const ready = session.state === 'uploaded' || session.state === 'consumed'
    if (!ready || createdIdRef.current || fallbackStartedRef.current) return
    fallbackStartedRef.current = true
    void createAvatar({
      channelId,
      kind: 'human_clone',
      displayName: session.display_name || defaultDisplayName,
      idempotencyKey: `rec-auto:${session.id}`,
      recordingSessionId: session.id,
    }).then(finishClone).catch((caught) => {
      fallbackStartedRef.current = false
      setCaptureError(getSafeAuthMessage(caught))
    })
  }, [captureSession, channelId, defaultDisplayName, finishClone])

  const captureFailure = captureSession?.auto_create_status === 'failed'
    ? t('avatarFailedHint', { code: captureSession.auto_create_failure_code || t('statusFailed') })
    : captureError

  const goBack = () => {
    if (!chooserAvailable || effectiveStep === 'kind') {
      onClose()
      return
    }
    setCaptureError(null)
    setStep('kind')
  }

  const chooseKind = (kind: AvatarKind) => {
    setStep(resolveCreateAvatarStep({
      kind,
      entitlement,
      hasRecordingDraft: Boolean(readRecordingCaptureDraftSafe(channelId)),
    }))
  }

  const title = effectiveStep === 'kind'
    ? t('createTitle')
    : effectiveStep === 'character'
      ? t('designTitle')
      : effectiveStep === 'upgrade'
        ? tFlow('upgradeStepTitle')
        : t('cloneTitle')
  const subtitle = effectiveStep === 'kind'
    ? t('createDescription')
    : effectiveStep === 'clone_capture'
      ? t('captureSubtitle')
      : effectiveStep === 'clone_confirm'
        ? tFlow('cloneConfirmSubtitle')
        : effectiveStep === 'character'
          ? tFlow('characterSubtitle')
          : null

  return (
    <div data-avatar-create-flow={effectiveStep} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 sm:px-5">
        {chooserAvailable && effectiveStep !== 'kind' ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={t('backToAvatars')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 px-1">
          <DialogTitle className="truncate pr-0 text-base font-semibold">{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription className="truncate text-xs">{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="hg-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {effectiveStep === 'kind' ? (
          <AvatarKindChooser entitlement={entitlement} onChoose={chooseKind} />
        ) : null}

        {effectiveStep === 'upgrade' ? (
          <AvatarUpgradePanel
            shotCredits={avatarEstimate(entitlement, 'shot_credits')}
            onCreateCharacter={() => setStep('character')}
          />
        ) : null}

        {effectiveStep === 'clone_confirm' ? (
          <CloneConfirmStep
            channelId={channelId}
            entitlement={entitlement}
            defaultDisplayName={defaultDisplayName}
            onEntitlementStale={onEntitlementStale}
            onStarted={(session) => {
              setStartedSession(session)
              setCaptureError(null)
              setStep('clone_capture')
            }}
            onUpgrade={() => setStep('upgrade')}
          />
        ) : null}

        {effectiveStep === 'clone_capture' ? (
          <div data-avatar-create-step="clone_capture" className="space-y-4">
            <CloneCapturePanel
              active
              channelId={channelId}
              initialSession={startedSession}
              autoStart={false}
              sessionOptions={null}
              onRequireStart={() => {
                setStartedSession(null)
                setStep('clone_confirm')
              }}
              onModeChange={ignoreCloneCaptureMode}
              onSessionChange={setCaptureSession}
            />
            {captureFailure ? (
              <p role="alert" className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                {captureFailure}
              </p>
            ) : captureSession?.state === 'uploaded' || captureSession?.state === 'consumed' ? (
              <p className="mx-auto max-w-xl rounded-xl border border-border bg-panel/40 px-3 py-2 text-center text-sm text-foreground">
                {t('captureReceived')}
              </p>
            ) : (
              <p className="mx-auto max-w-xl text-center text-xs text-muted-foreground">{tFlow('captureKeepsRunning')}</p>
            )}
          </div>
        ) : null}

        {effectiveStep === 'character' ? (
          <AvatarCharacterForm
            channelId={channelId}
            entitlement={entitlement}
            defaultDisplayName={defaultDisplayName}
            initialDraft={initialDraft}
            initialReference={initialReference}
            onCreated={onCreated}
            onEntitlementStale={onEntitlementStale}
          />
        ) : null}
      </div>
    </div>
  )
}

function readRecordingCaptureDraftSafe(channelId: string) {
  try {
    return readRecordingCaptureDraft(channelId)
  } catch {
    return null
  }
}

function provisioningCloneAvatar(input: { session: RecordingSession; avatarId: string; channelId: string }): Avatar {
  const now = new Date().toISOString()
  return {
    id: input.avatarId,
    channel_id: input.channelId,
    display_name: input.session.display_name || '',
    origin: 'human_clone',
    status: 'provisioning',
    primary_shot_id: null,
    default_voice_profile_id: null,
    catalog_template_id: null,
    source_storage_object_id: input.session.storage_object_id,
    preview_storage_object_id: null,
    audio_storage_object_id: null,
    failure_code: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  }
}

/** Price text under a kind card: `Free · 7 left`, or `≈59 credits` / `≈19 credits`. */
export function useAvatarKindPriceLabel(entitlement: AvatarEntitlement | null, kind: AvatarKind) {
  const t = useTranslations('BrandAvatar.createFlow')
  if (!entitlement) return t('priceLoading')
  if (entitlement.free_avatars.remaining > 0) {
    return t('priceFreeLeft', { remaining: entitlement.free_avatars.remaining })
  }
  const credits = kind === 'human_clone'
    ? avatarEstimate(entitlement, 'clone_credits')
    : avatarEstimate(entitlement, 'character_credits')
  return t('priceCredits', { count: credits })
}

export function AvatarKindChooser({
  entitlement,
  onChoose,
  className,
}: {
  entitlement: AvatarEntitlement | null
  onChoose: (kind: AvatarKind) => void
  className?: string
}) {
  return (
    <div data-create-choice="kind" className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <AvatarKindCard kind="human_clone" entitlement={entitlement} onClick={() => onChoose('human_clone')} />
      <AvatarKindCard kind="digital_human" entitlement={entitlement} onClick={() => onChoose('digital_human')} />
    </div>
  )
}

export function AvatarKindCard({
  kind,
  entitlement,
  onClick,
  className,
}: {
  kind: AvatarKind
  entitlement: AvatarEntitlement | null
  onClick: () => void
  className?: string
}) {
  const t = useTranslations('BrandAvatar')
  const tFlow = useTranslations('BrandAvatar.createFlow')
  const priceLabel = useAvatarKindPriceLabel(entitlement, kind)
  const fairUse = isAvatarFairUseReached(entitlement)
  const needsUpgrade = kind === 'human_clone' && entitlement !== null && !entitlement.clone_enabled
  const free = (entitlement?.free_avatars.remaining ?? 0) > 0
  return (
    <button
      type="button"
      data-avatar-kind-card={kind}
      disabled={fairUse}
      onClick={onClick}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border bg-panel/40 text-left transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span className="relative block aspect-[16/10] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_KIND_IMAGES[kind]} alt="" className="h-full w-full object-cover" />
        {needsUpgrade ? (
          <span
            data-avatar-kind-badge="upgrade"
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm"
          >
            <Lock className="size-3" />
            {tFlow('starterBadge')}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="font-semibold text-foreground">{kind === 'human_clone' ? t('cloneTitle') : t('designTitle')}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {kind === 'human_clone' ? t('cloneDescription') : t('designDescription')}
        </span>
        <span className="mt-3 flex items-center gap-2">
          <span
            data-avatar-kind-price={free ? 'free' : 'credits'}
            className={cn(
              'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
              free ? 'bg-primary/10 text-primary' : 'bg-accent text-foreground',
            )}
          >
            {priceLabel}
          </span>
        </span>
        {fairUse ? <span className="mt-2 text-xs text-muted-foreground">{tFlow('fairUse')}</span> : null}
      </span>
    </button>
  )
}

export function CloneConfirmStep({
  channelId,
  entitlement,
  defaultDisplayName,
  onStarted,
  onUpgrade,
  onEntitlementStale,
}: {
  channelId: string
  entitlement: AvatarEntitlement | null
  defaultDisplayName: string
  onStarted: (session: RecordingSession) => void
  onUpgrade: () => void
  onEntitlementStale?: () => void
}) {
  const tFlow = useTranslations('BrandAvatar.createFlow')
  const t = useTranslations('BrandAvatar')
  const locale = useLocale()
  const [name, setName] = React.useState(defaultDisplayName)
  const voiceCloneEnabled = entitlement?.voice_clone_enabled ?? false
  const slotsFull = isVoiceProfileSlotsFull(entitlement)
  const voiceAvailable = voiceCloneEnabled && !slotsFull
  const [voiceOn, setVoiceOn] = React.useState(true)
  const createVoice = voiceAvailable && voiceOn
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const price: CreditPrice = resolveAvatarCreationPrice({
    entitlement,
    kind: 'human_clone',
    createVoiceFromRecording: createVoice,
  })
  const voiceCredits = avatarEstimate(entitlement, 'voice_clone_credits')
  const freeStatus = price.kind === 'free'
    ? tFlow('freeStatus', { remaining: price.remaining ?? 0, limit: price.limit ?? 0 })
    : null

  const start = async () => {
    const expectedPrice = toAvatarExpectedPrice(price)
    if (!expectedPrice || pending) return
    setPending(true)
    setError(null)
    try {
      const session = await createRecordingSession({
        channelId,
        language: locale,
        idempotencyKey: createAvatarIdempotencyKey('recording-session'),
        expectedPrice,
        createVoiceFromRecording: createVoice,
      })
      const chosen = name.trim()
      let next = session
      if (chosen && chosen !== session.display_name) {
        next = await patchRecordingSession({ sessionId: session.id, displayName: chosen })
          .then((patched) => ({
            ...patched,
            token: patched.token || session.token,
            recording_url: patched.recording_url || session.recording_url,
            qr_payload: patched.qr_payload || session.qr_payload,
          }))
          .catch(() => session)
      }
      onStarted(next)
    } catch (caught) {
      const kind = classifyAvatarPurchaseError(caught)
      if (kind !== 'other') onEntitlementStale?.()
      if (kind === 'clone_disabled') {
        onUpgrade()
        return
      }
      setError(describeCreateError(caught, tFlow))
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-avatar-create-step="clone_confirm" className="mx-auto max-w-lg space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('reservedName')}</span>
        <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        <span className="mt-1.5 block text-xs text-muted-foreground">{t('displayNameHint')}</span>
      </label>

      <div className="rounded-2xl border border-border p-4" data-clone-voice-option={createVoice ? 'on' : 'off'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{tFlow('voiceFromRecording')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {slotsFull && entitlement?.voice_profiles
                ? tFlow('voiceSlotsFull', {
                    used: entitlement.voice_profiles.used,
                    limit: entitlement.voice_profiles.limit ?? 0,
                  })
                : price.kind === 'free'
                  ? tFlow('voiceFromRecordingIncluded')
                  : tFlow('voiceFromRecordingPrice', { credits: voiceCredits })}
            </p>
          </div>
          <Switch
            checked={createVoice}
            disabled={!voiceAvailable || pending}
            aria-label={tFlow('voiceFromRecording')}
            onCheckedChange={setVoiceOn}
          />
        </div>
        {!voiceCloneEnabled && entitlement ? (
          <div className="mt-3">
            <AvatarUpgradeNote message={tFlow('voiceCloneUpgrade')} />
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{tFlow('cloneConsentNote')}</p>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <CreditActionButton
        id="avatar-clone-start"
        label={tFlow('startRecording')}
        busyLabel={tFlow('startingRecording')}
        price={price}
        availableCredits={entitlement?.credits.available ?? null}
        busy={pending}
        upgradeRequired={Boolean(entitlement && !entitlement.clone_enabled)}
        onUpgrade={onUpgrade}
        blockedReason={isAvatarFairUseReached(entitlement) ? tFlow('fairUse') : !name.trim() ? tFlow('nameRequired') : null}
        freeStatus={freeStatus}
        onClick={() => void start()}
      />
    </div>
  )
}

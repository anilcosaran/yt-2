'use client'

import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Mic, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { CreditActionButton, upgradePlanHref } from '@/components/billing/credit-action-button'
import { VoiceReferenceAudioInput } from '@/components/tools/voice-reference-audio-input'
import { VoiceProfilePickerDialog } from '@/components/tools/voice-profile-picker-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  assignAvatarVoice,
  avatarQueryKey,
  AVATARS_QUERY_KEY,
  cloneAvatarVoice,
  createAvatarIdempotencyKey,
  type Avatar,
} from '@/lib/avatar/api'
import { resolveVoiceCloneReferenceSchema } from '@/lib/avatar/voice-clone-reference'
import { readVoiceReferenceTrimConstraints } from '@/lib/audio/voice-reference-trim'
import {
  DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
  getDiscoveryToolsCatalog,
} from '@/lib/discovery/api'
import {
  avatarEstimate,
  classifyAvatarPurchaseError,
  isVoiceProfileSlotsFull,
  type AvatarEntitlement,
} from '@/lib/avatar/entitlement'
import { buildVoiceAssignRequest } from '@/lib/avatar/shot-actions'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { cn } from '@/lib/utils'
import {
  getVoiceProfile,
  listVoiceProfiles,
  voiceProfileQueryKey,
  voiceProfilesQueryKey,
} from '@/lib/voice/api'

export const AVATAR_UPGRADE_HREF = upgradePlanHref('/brand?section=avatars')

/** Stock voices plus the channel's own instant clones, as used by the shot inspector. */
export function useAvatarVoiceLibrary(channelId: string | null, enabled: boolean) {
  const stock = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId: channelId ?? undefined, origin: 'stock', limit: 80 }),
    queryFn: ({ signal }) => listVoiceProfiles({ channelId: channelId ?? undefined, origin: 'stock', limit: 80 }, { signal }),
    enabled: Boolean(channelId) && enabled,
  })
  const custom = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId: channelId ?? undefined, origin: 'instant_clone', limit: 80 }),
    queryFn: ({ signal }) => listVoiceProfiles({ channelId: channelId ?? undefined, origin: 'instant_clone', limit: 80 }, { signal }),
    enabled: Boolean(channelId) && enabled,
  })
  const profiles = React.useMemo(
    () => [...(custom.data?.data ?? []), ...(stock.data?.data ?? [])],
    [custom.data?.data, stock.data?.data],
  )
  return {
    profiles,
    stockLoading: stock.isLoading,
    customLoading: custom.isLoading,
    stockError: stock.isError,
    customError: custom.isError,
    retryStock: () => void stock.refetch(),
    retryCustom: () => void custom.refetch(),
  }
}

export function AvatarVoiceLibraryPicker({
  channelId,
  value,
  disabled,
  onChange,
}: {
  channelId: string | null
  value: string | null
  disabled?: boolean
  onChange: (voiceProfileId: string | null) => void
}) {
  const library = useAvatarVoiceLibrary(channelId, true)
  return (
    <VoiceProfilePickerDialog
      channelId={channelId}
      modelId=""
      modelLanguages={[]}
      profiles={library.profiles}
      value={value ?? ''}
      disabled={disabled}
      stockLoading={library.stockLoading}
      customLoading={library.customLoading}
      stockError={library.stockError}
      customError={library.customError}
      onRetryStock={library.retryStock}
      onRetryCustom={library.retryCustom}
      onValueChange={(voiceProfileId) => onChange(voiceProfileId || null)}
    />
  )
}

export type AvatarVoiceUploadValue = {
  /** Trimmed WAV reference produced by the Tools voice reference trim flow. */
  storageObjectId: string | null
  consentAccepted: boolean
}

export function isVoiceUploadReady(value: AvatarVoiceUploadValue) {
  return Boolean(value.storageObjectId && value.consentAccepted)
}

export const EMPTY_VOICE_UPLOAD: AvatarVoiceUploadValue = {
  storageObjectId: null,
  consentAccepted: false,
}

/** Reference-audio window of the default voice clone model (Tools discovery catalog). */
export function useVoiceCloneReferenceSchema() {
  const query = useQuery({
    queryKey: DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => getDiscoveryToolsCatalog({ signal }),
    staleTime: DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  })
  return React.useMemo(() => resolveVoiceCloneReferenceSchema(query.data), [query.data])
}

/**
 * Voice file for cloning: reuses the Tools voice reference input (upload, record or pick from
 * Storage, then trim to the voice clone model's min/max window). The trimmed WAV Storage object is
 * what gets sent as `voice.storage_object_id`. Includes the "I have the right to use this voice"
 * consent.
 */
export function AvatarVoiceUploadField({
  channelId,
  value,
  disabled,
  onChange,
  onBusyChange,
}: {
  channelId: string | null
  value: AvatarVoiceUploadValue
  disabled?: boolean
  onChange: (value: AvatarVoiceUploadValue) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const t = useTranslations('BrandAvatar.avatarVoice')
  const schema = useVoiceCloneReferenceSchema()
  const window = React.useMemo(() => readVoiceReferenceTrimConstraints(schema), [schema])
  const consentId = React.useId()
  return (
    <div className="space-y-2.5" data-avatar-voice="upload" data-voice-window={`${window.minSeconds}-${window.maxSeconds}`}>
      <VoiceReferenceAudioInput
        channelId={channelId}
        value={value.storageObjectId ?? ''}
        inputSchema={schema}
        disabled={disabled}
        uploadMetadata={{
          asset_kind: 'voice_reference',
          origin_node_type: 'voice_clone@1',
          memory_indexing: 'disabled',
        }}
        onBusyChange={onBusyChange}
        onChange={(storageObjectId) => onChange({ ...value, storageObjectId })}
      />
      <p className="text-xs text-muted-foreground">
        {t('uploadHint', { min: window.minSeconds, max: window.maxSeconds })}
      </p>
      <label htmlFor={consentId} className="flex items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          id={consentId}
          className="mt-0.5"
          checked={value.consentAccepted}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, consentAccepted: checked === true })}
        />
        <span>{t('uploadConsent')}</span>
      </label>
    </div>
  )
}

/** Inline "needs a higher plan" note used for voice cloning on Basic. */
export function AvatarUpgradeNote({ message }: { message: string }) {
  const t = useTranslations('BrandAvatar.upgrade')
  return (
    <div
      data-avatar-upgrade="note"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel/50 px-3 py-2.5 text-sm"
    >
      <span className="text-muted-foreground">{message}</span>
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link href={AVATAR_UPGRADE_HREF}>
          <ArrowUpRight className="size-3.5" />
          {t('cta')}
        </Link>
      </Button>
    </div>
  )
}

/** Header chip in the avatar detail: assigned voice name, or "Add voice". */
export function AvatarVoiceChip({
  avatar,
  channelId,
  entitlement,
  onAvatarChange,
}: {
  avatar: Avatar
  channelId: string | null
  entitlement: AvatarEntitlement | null
  onAvatarChange: (avatar: Avatar) => void
}) {
  const t = useTranslations('BrandAvatar.avatarVoice')
  const [open, setOpen] = React.useState(false)
  const voiceId = avatar.default_voice_profile_id
  const voiceQuery = useQuery({
    queryKey: voiceProfileQueryKey(channelId, voiceId),
    queryFn: ({ signal }) => getVoiceProfile(voiceId!, channelId!, { signal }),
    enabled: Boolean(channelId && voiceId),
    staleTime: 60_000,
  })
  const label = voiceId
    ? (voiceQuery.data?.display_name ?? t('chipAssigned'))
    : t('chipAdd')
  return (
    <>
      <button
        type="button"
        data-avatar-voice-chip={voiceId ? 'assigned' : 'empty'}
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition',
          voiceId
            ? 'border-border bg-panel/60 text-foreground hover:border-foreground/30'
            : 'border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        )}
      >
        {voiceId ? <Mic className="size-3.5 shrink-0" /> : <Plus className="size-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </button>
      {open ? (
        <AvatarVoiceDialog
          open={open}
          onOpenChange={setOpen}
          avatar={avatar}
          channelId={channelId}
          entitlement={entitlement}
          onAvatarChange={onAvatarChange}
        />
      ) : null}
    </>
  )
}

function AvatarVoiceDialog({
  open,
  onOpenChange,
  avatar,
  channelId,
  entitlement,
  onAvatarChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  avatar: Avatar
  channelId: string | null
  entitlement: AvatarEntitlement | null
  onAvatarChange: (avatar: Avatar) => void
}) {
  const t = useTranslations('BrandAvatar.avatarVoice')
  const tAvatar = useTranslations('BrandAvatar')
  const queryClient = useQueryClient()
  const [upload, setUpload] = React.useState<AvatarVoiceUploadValue>(EMPTY_VOICE_UPLOAD)
  const [uploadBusy, setUploadBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const voiceCloneEnabled = entitlement?.voice_clone_enabled ?? false
  const slotsFull = isVoiceProfileSlotsFull(entitlement)
  const voiceCredits = avatarEstimate(entitlement, 'voice_clone_credits')
  const canCloneFromRecording = avatar.origin === 'human_clone' && Boolean(avatar.audio_storage_object_id)

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: avatarQueryKey(channelId, avatar.id) }),
      queryClient.invalidateQueries({ queryKey: AVATARS_QUERY_KEY }),
    ])
  }, [avatar.id, channelId, queryClient])

  const assignMutation = useMutation({
    mutationFn: (voiceProfileId: string | null) => assignAvatarVoice(buildVoiceAssignRequest({
      avatarId: avatar.id,
      channelId: channelId!,
      voiceProfileId,
    })),
    onSuccess: (next) => {
      onAvatarChange(next)
      toast.success(tAvatar('voiceAssigned'))
      void invalidate()
    },
    onError: (caught) => toast.error(tAvatar('actionFailed'), { description: getSafeAuthMessage(caught) }),
  })

  const cloneMutation = useMutation({
    mutationFn: (source: 'recording' | 'upload') => cloneAvatarVoice({
      avatarId: avatar.id,
      channelId: channelId!,
      source,
      storageObjectId: source === 'upload' ? upload.storageObjectId ?? undefined : undefined,
      consentAccepted: source === 'upload' ? upload.consentAccepted : undefined,
      expectedPrice: { mode: 'credits', credits: voiceCredits },
      idempotencyKey: createAvatarIdempotencyKey('avatar-voice-clone'),
    }),
    onSuccess: async () => {
      setError(null)
      toast.success(t('cloneQueued'))
      onOpenChange(false)
      await invalidate()
    },
    onError: (caught) => {
      const kind = classifyAvatarPurchaseError(caught)
      setError(kind === 'insufficient_credits'
        ? t('errorInsufficient')
        : kind === 'voice_clone_disabled'
          ? t('upgradeRequired')
          : kind === 'voice_slots_full'
            ? t('slotsFull')
            : getSafeAuthMessage(caught))
    },
  })

  const uploadReady = isVoiceUploadReady(upload) && !uploadBusy
  const availableCredits = entitlement?.credits.available ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]" data-avatar-voice="dialog">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t('libraryTitle')}</p>
          <AvatarVoiceLibraryPicker
            channelId={channelId}
            value={avatar.default_voice_profile_id}
            disabled={assignMutation.isPending || !channelId}
            onChange={(voiceProfileId) => assignMutation.mutate(voiceProfileId)}
          />
          {avatar.default_voice_profile_id ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={assignMutation.isPending}
              onClick={() => assignMutation.mutate(null)}
            >
              {tAvatar('clearVoice')}
            </Button>
          ) : null}
        </section>

        {canCloneFromRecording ? (
          <section className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">{t('recordingTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('recordingHint')}</p>
            {!voiceCloneEnabled ? (
              <AvatarUpgradeNote message={t('upgradeRequired')} />
            ) : (
              <CreditActionButton
                label={t('recordingAction')}
                size="sm"
                price={{ kind: 'credits', credits: voiceCredits, approximate: true }}
                availableCredits={availableCredits}
                busy={cloneMutation.isPending && cloneMutation.variables === 'recording'}
                blockedReason={slotsFull ? t('slotsFull') : null}
                onClick={() => cloneMutation.mutate('recording')}
              />
            )}
          </section>
        ) : null}

        <section className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">{t('uploadTitle')}</p>
          {!voiceCloneEnabled ? (
            <AvatarUpgradeNote message={t('upgradeRequired')} />
          ) : (
            <>
              <AvatarVoiceUploadField
                channelId={channelId}
                value={upload}
                disabled={cloneMutation.isPending}
                onChange={setUpload}
                onBusyChange={setUploadBusy}
              />
              <CreditActionButton
                label={t('uploadAction')}
                size="sm"
                price={{ kind: 'credits', credits: voiceCredits, approximate: true }}
                availableCredits={availableCredits}
                busy={cloneMutation.isPending && cloneMutation.variables === 'upload'}
                blockedReason={slotsFull ? t('slotsFull') : !uploadReady ? t('uploadIncomplete') : null}
                onClick={() => cloneMutation.mutate('upload')}
              />
            </>
          )}
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

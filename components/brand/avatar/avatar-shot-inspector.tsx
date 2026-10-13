'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Loader2,
  Maximize2,
  Mic,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { ShotPreview } from '@/components/brand/avatar/avatar-shot-preview'
import { useAvatarImagePrice } from '@/components/brand/avatar/use-avatar-pricing'
import { CreditActionButton } from '@/components/billing/credit-action-button'
import { VoiceProfilePickerDialog } from '@/components/tools/voice-profile-picker-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToolPromptArea } from '@/components/tools/tool-primitives'
import {
  AVATAR_ANGLE_PRESETS,
  AVATAR_ANGLE_PROMPTS,
  AVATAR_LOOK_MODEL_IDS,
  DEFAULT_AVATAR_LOOK_MODEL_ID,
  assignAvatarVoice,
  avatarQueryKey,
  avatarShotsQueryKey,
  createAvatarShot,
  patchAvatarShot,
  type Avatar,
  type AvatarAnglePreset,
  type AvatarLookModelId,
  type AvatarShot,
} from '@/lib/avatar/api'
import type { AvatarEntitlement } from '@/lib/avatar/entitlement'
import type { CreditPrice } from '@/lib/billing/credit-price'
import {
  AVATAR_APPEARANCE_PRESETS,
  AVATAR_SHOT_FAST_ACTIONS,
  buildAngleShotRequest,
  buildAppearancePatchRequest,
  buildAppearanceShotRequest,
  buildCropShotRequest,
  buildEditShotRequest,
  buildLookShotRequest,
  buildUpscaleShotRequest,
  buildVoiceAssignRequest,
  matchAppearancePresetId,
  resolveAppearanceApplyMode,
  resolveCropMode,
  type AvatarAppearancePresetId,
  type AvatarShotFastAction,
  type CropBox,
  cropBoxFromUnknown,
} from '@/lib/avatar/shot-actions'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { cn } from '@/lib/utils'
import {
  listVoiceProfiles,
  voiceProfilesQueryKey,
  type VoiceProfile,
} from '@/lib/voice/api'

const FAST_ACTION_ICONS: Record<AvatarShotFastAction, LucideIcon> = {
  appearance: Palette,
  edit: Wand2,
  look: Sun,
  angles: RotateCcw,
  crop: Crop,
  upscale: Maximize2,
  voice: Mic,
}

export function AvatarShotInspector({
  avatar,
  shot,
  open,
  channelId,
  entitlement = null,
  onOpenChange,
  onAvatarChange,
}: {
  avatar: Avatar
  shot: AvatarShot | null
  open: boolean
  channelId: string
  entitlement?: AvatarEntitlement | null
  onOpenChange: (open: boolean) => void
  onAvatarChange: (avatar: Avatar) => void
}) {
  const t = useTranslations('BrandAvatar')
  const queryClient = useQueryClient()
  const [expandedAction, setExpandedAction] = React.useState<AvatarShotFastAction | null>(null)
  const [editPrompt, setEditPrompt] = React.useState('')
  const [lookPrompt, setLookPrompt] = React.useState('')
  const [crop, setCrop] = React.useState<CropBox | null>(null)
  const [appliedPresetId, setAppliedPresetId] = React.useState<AvatarAppearancePresetId | null>(null)
  const [editModelId, setEditModelId] = React.useState<AvatarLookModelId>(DEFAULT_AVATAR_LOOK_MODEL_ID)

  React.useEffect(() => {
    if (!open) {
      setExpandedAction(null)
      return
    }
    setExpandedAction(null)
    setEditPrompt(shot?.prompt ?? '')
    setLookPrompt('')
    setCrop(cropBoxFromUnknown(shot?.crop_box ?? null))
    setAppliedPresetId(matchAppearancePresetId(shot?.appearance))
  }, [open, shot?.id])

  const shotLocked = Boolean(
    shot?.status === 'processing' || avatar.status === 'provisioning',
  )
  const cropInteractive = resolveCropMode(expandedAction) === 'interactive-select'
  const pricedAction = expandedAction === 'edit' || expandedAction === 'look'
    || expandedAction === 'angles' || expandedAction === 'appearance'
  const shotPrice = useAvatarImagePrice({
    channelId,
    entitlement,
    sourceStorageObjectId: shot?.storage_object_id ?? null,
    modelId: expandedAction === 'edit' ? editModelId : DEFAULT_AVATAR_LOOK_MODEL_ID,
    enabled: Boolean(open && shot?.storage_object_id && pricedAction && !shotLocked),
  })

  const stockVoicesQuery = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId, origin: 'stock', limit: 80 }),
    queryFn: ({ signal }) => listVoiceProfiles({
      channelId,
      origin: 'stock',
      limit: 80,
    }, { signal }),
    enabled: Boolean(open && expandedAction === 'voice'),
  })
  const customVoicesQuery = useQuery({
    queryKey: voiceProfilesQueryKey({ channelId, origin: 'instant_clone', limit: 80 }),
    queryFn: ({ signal }) => listVoiceProfiles({
      channelId,
      origin: 'instant_clone',
      limit: 80,
    }, { signal }),
    enabled: Boolean(open && expandedAction === 'voice'),
  })
  const voiceProfiles = [
    ...(customVoicesQuery.data?.data ?? []),
    ...(stockVoicesQuery.data?.data ?? []),
  ]

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: avatarShotsQueryKey(channelId, avatar.id) }),
      queryClient.invalidateQueries({ queryKey: avatarQueryKey(channelId, avatar.id) }),
    ])
  }, [avatar.id, channelId, queryClient])

  const appearanceMutation = useMutation({
    mutationFn: async (presetId: AvatarAppearancePresetId) => {
      if (!shot) throw new Error('missing_shot')
      await patchAvatarShot(buildAppearancePatchRequest({
        avatarId: avatar.id,
        shotId: shot.id,
        channelId,
        presetId,
      }))
      return createAvatarShot(buildAppearanceShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
        presetId,
      }))
    },
    onSuccess: async () => {
      toast.success(t('appearanceApplied'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const editMutation = useMutation({
    mutationFn: () => {
      if (!shot) throw new Error('missing_shot')
      return createAvatarShot(buildEditShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
        prompt: editPrompt.trim(),
        modelId: editModelId,
      }))
    },
    onSuccess: async () => {
      toast.success(t('shotQueued'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const lookMutation = useMutation({
    mutationFn: () => {
      if (!shot) throw new Error('missing_shot')
      return createAvatarShot(buildLookShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
        prompt: lookPrompt.trim(),
      }))
    },
    onSuccess: async () => {
      toast.success(t('shotQueued'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const angleMutation = useMutation({
    mutationFn: (angle: AvatarAnglePreset) => {
      if (!shot) throw new Error('missing_shot')
      return createAvatarShot(buildAngleShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
        angle,
        prompt: AVATAR_ANGLE_PROMPTS[angle],
      }))
    },
    onSuccess: async () => {
      toast.success(t('shotQueued'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const upscaleMutation = useMutation({
    mutationFn: () => {
      if (!shot) throw new Error('missing_shot')
      return createAvatarShot(buildUpscaleShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
      }))
    },
    onSuccess: async () => {
      toast.success(t('shotQueued'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const cropMutation = useMutation({
    mutationFn: async () => {
      if (!shot || !crop) throw new Error('missing_crop')
      await patchAvatarShot({
        avatarId: avatar.id,
        shotId: shot.id,
        channelId,
        cropBox: crop,
      })
      return createAvatarShot(buildCropShotRequest({
        avatarId: avatar.id,
        channelId,
        sourceShotId: shot.id,
        cropBox: crop,
      }))
    },
    onSuccess: async () => {
      toast.success(t('shotQueued'))
      await invalidate()
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const primaryMutation = useMutation({
    mutationFn: () => patchAvatarShot({
      avatarId: avatar.id,
      shotId: shot!.id,
      channelId,
      primary: true,
    }),
    onSuccess: invalidate,
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const voiceMutation = useMutation({
    mutationFn: (voiceProfileId: string | null) => assignAvatarVoice(buildVoiceAssignRequest({
      avatarId: avatar.id,
      channelId,
      voiceProfileId,
    })),
    onSuccess: (next) => {
      onAvatarChange(next)
      toast.success(t('voiceAssigned'))
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const applyPreset = (presetId: AvatarAppearancePresetId) => {
    if (shotLocked || !shot) return
    if (resolveAppearanceApplyMode() !== 'immediate') return
    setAppliedPresetId(presetId)
    appearanceMutation.mutate(presetId)
  }

  const selectAction = (action: AvatarShotFastAction) => {
    setExpandedAction(action)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50 backdrop-blur-[3px]"
        className="top-[50%] left-[50%] flex h-auto max-h-[calc(100vh-40px)] min-h-[min(460px,82vh)] w-[min(1220px,calc(100vw-12px))] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-[20px] border-[#232525] bg-[#0A0A0A] p-0 text-[#FAFAFA] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-w-[1220px]"
      >
        {open && shot ? (
          <>
            <DialogTitle className="sr-only">{shot.display_name || t('shotInspectorTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{avatar.display_name}</DialogDescription>
            <AvatarShotInspectorPanel
            avatar={avatar}
            shot={shot}
            channelId={channelId}
            expandedAction={expandedAction}
            appliedPresetId={appliedPresetId}
            editPrompt={editPrompt}
            lookPrompt={lookPrompt}
            editModelId={editModelId}
            onEditModelChange={setEditModelId}
            shotPrice={shotPrice}
            availableCredits={entitlement?.credits.available ?? null}
            crop={crop}
            cropInteractive={cropInteractive}
            shotLocked={shotLocked}
            appearancePending={appearanceMutation.isPending}
            editPending={editMutation.isPending}
            lookPending={lookMutation.isPending}
            anglePending={angleMutation.isPending}
            upscalePending={upscaleMutation.isPending}
            cropPending={cropMutation.isPending}
            primaryPending={primaryMutation.isPending}
            voicePending={voiceMutation.isPending}
            voiceProfiles={voiceProfiles}
            stockLoading={stockVoicesQuery.isLoading}
            customLoading={customVoicesQuery.isLoading}
            stockError={stockVoicesQuery.isError}
            customError={customVoicesQuery.isError}
            onRetryStock={() => void stockVoicesQuery.refetch()}
            onRetryCustom={() => void customVoicesQuery.refetch()}
            onExpandAction={selectAction}
            onBackToActions={() => setExpandedAction(null)}
            onApplyPreset={applyPreset}
            onEditPromptChange={setEditPrompt}
            onLookPromptChange={setLookPrompt}
            onGenerateEdit={() => editMutation.mutate()}
            onGenerateLook={() => lookMutation.mutate()}
            onGenerateAngle={(angle) => angleMutation.mutate(angle)}
            onUpscale={() => upscaleMutation.mutate()}
            onCropChange={setCrop}
            onApplyCrop={() => cropMutation.mutate()}
            onAssignVoice={(voiceProfileId) => voiceMutation.mutate(voiceProfileId)}
            onClearVoice={() => voiceMutation.mutate(null)}
            onSetPrimary={() => primaryMutation.mutate()}
            onClose={() => onOpenChange(false)}
          />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function AvatarShotInspectorPanel({
  avatar,
  shot,
  channelId,
  expandedAction,
  appliedPresetId,
  editPrompt,
  lookPrompt,
  editModelId = DEFAULT_AVATAR_LOOK_MODEL_ID,
  onEditModelChange,
  shotPrice = { kind: 'pending' },
  availableCredits = null,
  crop,
  cropInteractive,
  shotLocked,
  appearancePending,
  editPending,
  lookPending,
  anglePending,
  upscalePending,
  cropPending,
  primaryPending,
  voicePending,
  voiceProfiles,
  stockLoading,
  customLoading,
  stockError,
  customError,
  onRetryStock,
  onRetryCustom,
  onExpandAction,
  onBackToActions,
  onApplyPreset,
  onEditPromptChange,
  onLookPromptChange,
  onGenerateEdit,
  onGenerateLook,
  onGenerateAngle,
  onUpscale,
  onCropChange,
  onApplyCrop,
  onAssignVoice,
  onClearVoice,
  onSetPrimary,
  onClose,
}: {
  avatar: Avatar
  shot: AvatarShot
  channelId: string | null
  expandedAction: AvatarShotFastAction | null
  appliedPresetId: AvatarAppearancePresetId | null
  editPrompt: string
  lookPrompt: string
  editModelId?: AvatarLookModelId
  onEditModelChange?: (modelId: AvatarLookModelId) => void
  /** Price of one generated image for edit/look/appearance/angle (always credits). */
  shotPrice?: CreditPrice
  availableCredits?: number | null
  crop: CropBox | null
  cropInteractive: boolean
  shotLocked: boolean
  appearancePending: boolean
  editPending: boolean
  lookPending: boolean
  anglePending: boolean
  upscalePending: boolean
  cropPending: boolean
  primaryPending: boolean
  voicePending: boolean
  voiceProfiles: VoiceProfile[]
  stockLoading: boolean
  customLoading: boolean
  stockError: boolean
  customError: boolean
  onRetryStock: () => void
  onRetryCustom: () => void
  onExpandAction: (action: AvatarShotFastAction) => void
  onBackToActions: () => void
  onApplyPreset: (presetId: AvatarAppearancePresetId) => void
  onEditPromptChange: (value: string) => void
  onLookPromptChange: (value: string) => void
  onGenerateEdit: () => void
  onGenerateLook: () => void
  onGenerateAngle: (angle: AvatarAnglePreset) => void
  onUpscale: () => void
  onCropChange: (crop: CropBox) => void
  onApplyCrop: () => void
  onAssignVoice: (voiceProfileId: string | null) => void
  onClearVoice: () => void
  onSetPrimary: () => void
  onClose: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const cropReady = Boolean(crop && crop.width > 0 && crop.height > 0)

  return (
    <div
      data-avatar-surface="shot-inspector"
      data-shot-open-target="shot_inspector"
      data-appearance-ui="presets"
      className="flex max-h-[inherit] min-h-0 min-w-0 flex-1 flex-col"
    >
      <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 overflow-hidden bg-[#0A0A0A] px-3 sm:h-[72px] sm:gap-3 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6]">
          <Sparkles className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="truncate pr-0 text-[15px] font-semibold tracking-[-0.01em] text-[#FAFAFA]">
            {shot.display_name || t('shotInspectorTitle')}
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-[#8F8F8F]">
            {avatar.display_name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {shot.is_primary ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="inline-flex h-9 rounded-full border-[#2A2A2A] bg-[#111315] px-2 text-xs text-[#E6E6E6] sm:px-3 sm:text-sm"
              disabled={primaryPending}
              onClick={onSetPrimary}
            >
              {t('setPrimary')}
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6] sm:size-10"
          >
            <X className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-10">
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-7 pb-5 pt-2 sm:px-8 lg:pl-12 lg:pr-6">
          <ShotPreview
            channelId={channelId}
            shot={shot}
            crop={crop}
            cropInteractive={cropInteractive}
            onCropChange={onCropChange}
            className="aspect-[4/5] h-auto w-full max-w-[420px] border-[#232525] bg-[#111315]"
          />
        </div>

        <aside className="mr-0 mb-0 flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-none border-t border-[#232525] bg-[#0C0D0D] lg:mb-4 lg:mr-6 lg:mt-1 lg:max-h-none lg:w-[340px] lg:rounded-[20px] lg:border">
          <div className="border-b border-[#1A1B1B] px-5 py-4">
            <p className="text-[15px] font-semibold text-[#FAFAFA]">{t('fastMenuTitle')}</p>
            <p className="mt-1 text-[13px] text-[#8F8F8F]">{t('fastMenuHint')}</p>
          </div>
          <div className="tools-scrollbar min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
            {shotLocked ? (
              <p className="mb-3 rounded-xl border border-[#2A2A2A] bg-[#111315] px-3 py-2 text-xs text-[#8F8F8F]">
                {t('shotBusyHint')}
              </p>
            ) : null}

            {expandedAction ? (
              <div>
                <button
                  type="button"
                  onClick={onBackToActions}
                  className="mb-3 inline-flex items-center gap-1 px-1 text-[13px] text-[#8F8F8F]"
                >
                  <ChevronLeft className="size-4" />
                  {t('fastMenuTitle')}
                </button>
                {expandedAction === 'appearance' || expandedAction === 'angles' ? (
                  <ImagePriceNote price={shotPrice} />
                ) : null}
                {expandedAction === 'appearance' ? (
                  <AppearancePresetPanel
                    appliedPresetId={appliedPresetId}
                    pending={appearancePending}
                    disabled={shotLocked}
                    onApply={onApplyPreset}
                  />
                ) : null}
                {expandedAction === 'edit' ? (
                  <div className="space-y-3" data-shot-edit="prompt">
                    <p className="text-[13px] text-[#8F8F8F]">{t('editHint')}</p>
                    <ToolPromptArea
                      value={editPrompt}
                      onChange={onEditPromptChange}
                      placeholder={t('editPromptPlaceholder')}
                      maxLength={600}
                    />
                    <div role="radiogroup" aria-label={t('shotModel')} className="grid grid-cols-2 gap-2">
                      {AVATAR_LOOK_MODEL_IDS.map((modelId) => (
                        <button
                          key={modelId}
                          type="button"
                          role="radio"
                          aria-checked={editModelId === modelId}
                          onClick={() => onEditModelChange?.(modelId)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left text-xs',
                            editModelId === modelId ? 'border-[#FAFAFA]/60 bg-[#111315] text-[#FAFAFA]' : 'border-[#2A2A2A] text-[#8F8F8F] hover:bg-[#111315]',
                          )}
                        >
                          {t(modelId === 'angle-gpt-image-2.5-flare' ? 'shotModelFast' : 'shotModelBest')}
                        </button>
                      ))}
                    </div>
                    <CreditActionButton
                      id="avatar-shot-edit"
                      label={t('generateEdit')}
                      busyLabel={t('generating')}
                      price={shotPrice}
                      availableCredits={availableCredits}
                      busy={editPending}
                      disabled={shotLocked || !editPrompt.trim()}
                      statusClassName="text-[13px] text-[#8F8F8F]"
                      onClick={onGenerateEdit}
                    />
                  </div>
                ) : null}
                {expandedAction === 'look' ? (
                  <div className="space-y-3">
                    <ToolPromptArea
                      value={lookPrompt}
                      onChange={onLookPromptChange}
                      placeholder={t('designALookPlaceholder')}
                      maxLength={600}
                    />
                    <CreditActionButton
                      id="avatar-shot-look"
                      label={t('generateLook')}
                      busyLabel={t('generating')}
                      price={shotPrice}
                      availableCredits={availableCredits}
                      busy={lookPending}
                      disabled={shotLocked || !lookPrompt.trim()}
                      statusClassName="text-[13px] text-[#8F8F8F]"
                      onClick={onGenerateLook}
                    />
                  </div>
                ) : null}
                {expandedAction === 'angles' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {AVATAR_ANGLE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={shotLocked || anglePending}
                        onClick={() => onGenerateAngle(preset)}
                        className="rounded-xl border border-[#2A2A2A] px-3 py-3 text-left text-sm text-[#FAFAFA] hover:bg-[#111315] disabled:opacity-50"
                      >
                        {t(`angles.${preset}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {expandedAction === 'voice' ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-[#8F8F8F]">{t('voiceHint')}</p>
                    <VoiceProfilePickerDialog
                      channelId={channelId}
                      modelId=""
                      modelLanguages={[]}
                      profiles={voiceProfiles}
                      value={avatar.default_voice_profile_id ?? ''}
                      stockLoading={stockLoading}
                      customLoading={customLoading}
                      stockError={stockError}
                      customError={customError}
                      onRetryStock={onRetryStock}
                      onRetryCustom={onRetryCustom}
                      onValueChange={(voiceProfileId) => onAssignVoice(voiceProfileId || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!avatar.default_voice_profile_id || voicePending}
                      onClick={onClearVoice}
                    >
                      {t('clearVoice')}
                    </Button>
                  </div>
                ) : null}
                {expandedAction === 'upscale' ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-[#8F8F8F]">{t('fastActions.upscale.hint')}</p>
                    <Button
                      type="button"
                      disabled={shotLocked || upscalePending}
                      onClick={onUpscale}
                    >
                      {upscalePending ? <Loader2 className="size-4 animate-spin" /> : null}
                      {t('upscale')}
                    </Button>
                  </div>
                ) : null}
                {expandedAction === 'crop' ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-[#8F8F8F]">{t('cropSelectHint')}</p>
                    <Button
                      type="button"
                      disabled={shotLocked || !cropReady || cropPending}
                      onClick={onApplyCrop}
                    >
                      {cropPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      {t('applyCrop')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <FastActionList
                pendingAction={upscalePending ? 'upscale' : null}
                onSelect={onExpandAction}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function ImagePriceNote({ price }: { price: CreditPrice }) {
  const t = useTranslations('BrandAvatar.pricing')
  return (
    <p data-shot-price-note={price.kind} className="mb-3 px-1 text-[13px] text-[#8F8F8F]">
      {price.kind === 'credits'
        ? t('perImage', { count: price.credits })
        : price.kind === 'pending'
          ? t('perImagePending')
          : t('perImageUnknown')}
    </p>
  )
}

function FastActionList({
  pendingAction,
  onSelect,
}: {
  pendingAction: AvatarShotFastAction | null
  onSelect: (action: AvatarShotFastAction) => void
}) {
  const t = useTranslations('BrandAvatar')
  return (
    <div className="space-y-2.5" data-fast-menu="shot">
      {AVATAR_SHOT_FAST_ACTIONS.map((action) => {
        const Icon = FAST_ACTION_ICONS[action]
        return (
          <button
            key={action}
            type="button"
            data-fast-action={action}
            onClick={() => onSelect(action)}
            className="flex w-full items-center gap-3 rounded-[18px] border border-[#2A2A2A] px-3.5 py-3.5 text-left hover:bg-[#111315]"
          >
            <Icon className="size-[18px] shrink-0 text-[#C8C8C8]" strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[#FAFAFA]">
                {t(`fastActions.${action}.label`)}
                {pendingAction === action ? <Loader2 className="size-3.5 animate-spin" /> : null}
              </span>
              <span className="mt-0.5 block text-[13px] text-[#8F8F8F]">
                {t(`fastActions.${action}.hint`)}
              </span>
            </span>
            <ChevronRight className="size-4 text-[#6F6F6F]" />
          </button>
        )
      })}
    </div>
  )
}

function AppearancePresetPanel({
  appliedPresetId,
  pending,
  disabled,
  onApply,
}: {
  appliedPresetId: AvatarAppearancePresetId | null
  pending: boolean
  disabled: boolean
  onApply: (presetId: AvatarAppearancePresetId) => void
}) {
  const t = useTranslations('BrandAvatar')
  return (
    <div className="space-y-2.5" data-appearance-apply="immediate">
      {AVATAR_APPEARANCE_PRESETS.map((preset) => {
        const selected = appliedPresetId === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            data-appearance-preset={preset.id}
            disabled={disabled || pending}
            onClick={() => onApply(preset.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-[18px] border px-3.5 py-3.5 text-left disabled:opacity-50',
              selected ? 'border-primary/60 bg-primary/10' : 'border-[#2A2A2A] hover:bg-[#111315]',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[#FAFAFA]">
                {t(`presets.${preset.id}.label`)}
              </span>
              <span className="mt-0.5 block text-[13px] text-[#8F8F8F]">
                {t(`presets.${preset.id}.hint`)}
              </span>
            </span>
            {pending && selected ? <Loader2 className="size-4 animate-spin text-[#C8C8C8]" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export const __avatarShotInspectorTestHooks = {
  AvatarShotInspectorPanel,
  FastActionList,
  AppearancePresetPanel,
}

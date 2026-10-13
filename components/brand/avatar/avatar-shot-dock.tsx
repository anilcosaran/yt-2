'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Check, Coins, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useAvatarImagePrice } from '@/components/brand/avatar/use-avatar-pricing'
import { ADD_CREDITS_HREF } from '@/components/billing/credit-action-button'
import { AgentScope, AgentSuggestions } from '@/components/spark/agent/agent-thread'
import {
  PromptBox,
  PromptBoxChip,
  PromptBoxInput,
  PromptBoxNote,
  PromptBoxSend,
  PromptBoxSpacer,
} from '@/components/spark/agent/prompt-box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AVATAR_LOOK_MODEL_IDS,
  DEFAULT_AVATAR_LOOK_MODEL_ID,
  avatarQueryKey,
  avatarShotsQueryKey,
  createAvatarShot,
  listAvatarShots,
  type Avatar,
  type AvatarLookModelId,
} from '@/lib/avatar/api'
import type { AvatarEntitlement } from '@/lib/avatar/entitlement'
import { buildLookShotRequest, resolveLookSourceShotId } from '@/lib/avatar/shot-actions'
import { resolveCreditActionState, type CreditPrice } from '@/lib/billing/credit-price'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'

const MAX_LOOK_PROMPT_CHARS = 600
const LOOK_SUGGESTION_IDS = ['studio', 'office', 'outdoor', 'podcast', 'stage'] as const

/**
 * The new-shot box of Avatarlar, fixed at the bottom of the page (Higgsfield's prompt bar): opened by "Yeni shot" on an
 * avatar card or on the avatar's page, it stays while the user makes shots. The box is the shared prompt box (Spark's
 * composer); its bar holds the avatar, the reference shot and the model, then the price and send.
 */
export function AvatarShotDock({
  channelId,
  entitlement,
  avatars,
  avatarId,
  focusKey,
  onAvatarChange,
  onQueued,
  onClose,
}: {
  channelId: string
  entitlement: AvatarEntitlement | null
  /** The avatars the box can pick from (the user's own). */
  avatars: Avatar[]
  avatarId: string
  /** Changes each time the box is asked for, so it takes the focus again. */
  focusKey: number
  onAvatarChange: (avatar: Avatar) => void
  /** A shot is on its way for this avatar. */
  onQueued?: (avatar: Avatar) => void
  onClose: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const queryClient = useQueryClient()
  const input = React.useRef<HTMLTextAreaElement>(null)
  const [prompt, setPrompt] = React.useState('')
  const [modelId, setModelId] = React.useState<AvatarLookModelId>(DEFAULT_AVATAR_LOOK_MODEL_ID)
  const [pickedSourceShotId, setPickedSourceShotId] = React.useState<string | null>(null)
  const avatar = avatars.find((entry) => entry.id === avatarId) ?? null
  const locked = !avatar || avatar.status !== 'ready'

  React.useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [focusKey])

  const shotsQuery = useQuery({
    queryKey: avatarShotsQueryKey(channelId, avatarId),
    queryFn: ({ signal }) => listAvatarShots(avatarId, channelId, { signal }),
    enabled: Boolean(avatar),
  })
  const completed = React.useMemo(
    () => (shotsQuery.data ?? []).filter((shot) => shot.status === 'completed' && shot.storage_object_id),
    [shotsQuery.data],
  )
  const defaultSourceShotId = resolveLookSourceShotId(shotsQuery.data ?? [], avatar?.primary_shot_id ?? null)
  const sourceShotId = completed.some((shot) => shot.id === pickedSourceShotId) ? pickedSourceShotId : defaultSourceShotId
  const source = completed.find((shot) => shot.id === sourceShotId) ?? null
  const price = useAvatarImagePrice({
    channelId,
    entitlement,
    sourceStorageObjectId: source?.storage_object_id ?? null,
    modelId,
    enabled: Boolean(source?.storage_object_id) && !locked,
  })
  const availableCredits = entitlement?.credits.available ?? null
  const credit = resolveCreditActionState({ price, availableCredits })

  const mutation = useMutation({
    mutationFn: () => createAvatarShot(buildLookShotRequest({
      avatarId,
      channelId,
      sourceShotId: sourceShotId!,
      prompt: prompt.trim(),
      modelId,
    })),
    onSuccess: async () => {
      setPrompt('')
      // Up top: the box sits where toasts open.
      toast.success(t('shotQueued'), { position: 'top-center' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: avatarShotsQueryKey(channelId, avatarId) }),
        queryClient.invalidateQueries({ queryKey: avatarQueryKey(channelId, avatarId) }),
      ])
      if (avatar) onQueued?.(avatar)
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  const canSend = Boolean(prompt.trim()) && Boolean(sourceShotId) && !locked && !mutation.isPending
    && credit.block !== 'insufficient' && credit.block !== 'reserve' && credit.block !== 'unavailable'
  const send = () => {
    if (canSend) mutation.mutate()
  }

  return (
    <div
      data-shot-composer="dock"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-4 pt-10 duration-300 ease-out animate-in fade-in-0 slide-in-from-bottom-6 md:px-8 md:pb-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose()
      }}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[760px]">
        <div className="mb-2 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            {!prompt && !locked ? (
              <AgentScope sprite>
                <AgentSuggestions
                  label={t('dock.suggestions')}
                  items={LOOK_SUGGESTION_IDS.map((id) => ({ id, label: t(`lookSuggestion.${id}`) }))}
                  onPick={(item) => {
                    setPrompt(t(`lookSuggestionPrompt.${item.id as (typeof LOOK_SUGGESTION_IDS)[number]}`))
                    input.current?.focus()
                  }}
                />
              </AgentScope>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dock.close')}
            title={t('dock.close')}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <PromptBox
          as="form"
          className="pb-float"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
          bar={(
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PromptBoxChip
                    srLabel={t('dock.avatar')}
                    title={avatar?.display_name}
                    icon={<AvatarThumb channelId={channelId} objectId={avatar?.preview_storage_object_id ?? null} />}
                    label={avatar ? shortName(avatar.display_name) : t('dock.avatar')}
                    caret
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-60 overflow-y-auto">
                  {avatars.map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      disabled={entry.status !== 'ready'}
                      onClick={() => {
                        setPickedSourceShotId(null)
                        onAvatarChange(entry)
                      }}
                      className="gap-2"
                    >
                      <AvatarThumb channelId={channelId} objectId={entry.preview_storage_object_id ?? null} large />
                      <span className="truncate">{entry.display_name}</span>
                      {entry.id === avatarId ? <Check className="ml-auto size-3.5" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PromptBoxChip
                    disabled={locked || completed.length === 0}
                    srLabel={t('sourceShot')}
                    title={t('sourceShot')}
                    icon={<AvatarThumb channelId={channelId} objectId={source?.storage_object_id ?? null} square />}
                    label={source?.display_name ?? t('sourceShot')}
                    caret
                    collapse
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-60 overflow-y-auto">
                  {completed.map((shot) => (
                    <DropdownMenuItem key={shot.id} onClick={() => setPickedSourceShotId(shot.id)} className="gap-2">
                      <AvatarThumb channelId={channelId} objectId={shot.storage_object_id} square large />
                      <span className="truncate">{shot.display_name}</span>
                      {shot.id === sourceShotId ? <Check className="ml-auto size-3.5" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PromptBoxChip
                    disabled={locked}
                    srLabel={t('shotModel')}
                    icon={<Sparkles />}
                    label={t(lookModelLabelKey(modelId))}
                    caret
                    collapse
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {AVATAR_LOOK_MODEL_IDS.map((id) => (
                    <DropdownMenuItem key={id} onClick={() => setModelId(id)} className="flex-col items-start gap-0.5">
                      <span className="flex w-full items-center gap-2 text-sm">
                        {t(lookModelLabelKey(id))}
                        {id === modelId ? <Check className="ml-auto size-3.5" /> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{t(lookModelHintKey(id))}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <PromptBoxSpacer />
              {price.kind === 'credits' && !locked ? (
                <PromptBoxNote icon={<Coins />} title={t('pricing.settleHint', { max: 40 })}>
                  {t('dock.cost', { count: price.credits })}
                </PromptBoxNote>
              ) : null}
              <PromptBoxSend label={t('generateLook')} disabled={!canSend} busy={mutation.isPending} />
            </>
          )}
        >
          <PromptBoxInput
            ref={input}
            rows={2}
            value={prompt}
            maxLength={MAX_LOOK_PROMPT_CHARS}
            disabled={locked}
            aria-label={t('newShot')}
            placeholder={locked ? t('composerLocked') : t('composerPlaceholder')}
            onChange={(event) => setPrompt(event.target.value)}
            onSend={send}
          />
        </PromptBox>
        <CreditNote price={price} availableCredits={availableCredits} locked={locked} />
      </div>
    </div>
  )
}

/** Why the box cannot send when credits are short, or the price is unknown. */
function CreditNote({ price, availableCredits, locked }: { price: CreditPrice; availableCredits: number | null; locked: boolean }) {
  const tCredit = useTranslations('CreditAction')
  if (locked) return null
  const credit = resolveCreditActionState({ price, availableCredits })
  if (credit.block === 'insufficient' || credit.block === 'reserve') {
    return (
      <p role="status" data-shot-composer-note={credit.block} className="mt-2 text-center text-xs text-foreground">
        {credit.block === 'reserve'
          ? tCredit('statusReserve', {
              required: credit.reserveCredits ?? 0,
              price: credit.requiredCredits ?? 0,
              available: availableCredits ?? 0,
            })
          : tCredit('statusInsufficient', { required: credit.requiredCredits ?? 0, available: availableCredits ?? 0 })}
        {' · '}
        <Link href={ADD_CREDITS_HREF} className="font-medium underline-offset-4 hover:underline">{tCredit('addCredits')}</Link>
      </p>
    )
  }
  if (price.kind === 'unavailable') {
    return <p role="status" className="mt-2 text-center text-xs text-muted-foreground">{tCredit('statusUnavailable')}</p>
  }
  return null
}

/** A storage picture as the chip's thumbnail (round for an avatar, rounded square for a shot). */
function AvatarThumb({ channelId, objectId, square, large }: { channelId: string; objectId: string | null; square?: boolean; large?: boolean }) {
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: objectId ?? '',
    enabled: Boolean(objectId),
    allowOriginalImageFallback: true,
  })
  const shape = `${square ? 'rounded-[5px]' : 'rounded-full'} ${large ? 'size-7' : ''}`
  return thumbnail.data?.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnail.data.url} alt="" className={`pb-thumb shrink-0 bg-muted object-cover ${shape}`} />
  ) : (
    <span className={`pb-thumb shrink-0 bg-muted ${shape}`} />
  )
}

/** "Deniz — Sunucu" → "Deniz": the chip keeps the name, the menu the whole title. */
function shortName(name: string) {
  return name.split(' — ')[0]?.trim() || name
}

function lookModelLabelKey(modelId: AvatarLookModelId) {
  return modelId === 'angle-gpt-image-2.5-flare' ? 'shotModelFast' : 'shotModelBest'
}

function lookModelHintKey(modelId: AvatarLookModelId) {
  return modelId === 'angle-gpt-image-2.5-flare' ? 'shotModelFastHint' : 'shotModelBestHint'
}

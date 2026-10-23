'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2, Pencil, Plus, Star, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { AvatarOverflowMenu } from '@/components/brand/avatar/avatar-overflow-menu'
import { AvatarVoiceChip } from '@/components/brand/avatar/avatar-voice-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  avatarShotsQueryKey,
  listAvatarShots,
  renameAvatar,
  type Avatar,
  type AvatarShot,
} from '@/lib/avatar/api'
import type { AvatarEntitlement } from '@/lib/avatar/entitlement'
import { resolveShotOpenTarget } from '@/lib/avatar/shot-actions'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'

export function AvatarLooksDetail({
  avatar,
  channelId,
  entitlement = null,
  onBack,
  onAvatarChange,
  onDelete,
  startRenaming = false,
  onShotOpen,
  onNewShot,
}: {
  avatar: Avatar
  channelId: string
  entitlement?: AvatarEntitlement | null
  onBack: () => void
  onAvatarChange: (avatar: Avatar) => void
  onDelete?: () => void
  startRenaming?: boolean
  onShotOpen: (shot: AvatarShot) => void
  /** Opens the new-shot box at the bottom of the page (`AvatarShotDock`). */
  onNewShot: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const [displayName, setDisplayName] = React.useState(avatar.display_name)

  React.useEffect(() => {
    setDisplayName(avatar.display_name)
  }, [avatar.id, avatar.display_name])

  const shotsQuery = useQuery({
    queryKey: avatarShotsQueryKey(channelId, avatar.id),
    queryFn: ({ signal }) => listAvatarShots(avatar.id, channelId, { signal }),
    refetchInterval: (query) => (
      query.state.data?.some((shot) => shot.status === 'processing') || avatar.status === 'provisioning' || avatar.recording_refund_status === 'pending'
        ? 3_000
        : false
    ),
  })

  const shots = React.useMemo(() => shotsQuery.data ?? [], [shotsQuery.data])

  const renameMutation = useMutation({
    mutationFn: () => renameAvatar({
      avatarId: avatar.id,
      channelId,
      displayName: displayName.trim(),
    }),
    onSuccess: (next) => {
      onAvatarChange(next)
      toast.success(t('saveName'))
    },
    onError: (error) => toast.error(t('actionFailed'), { description: getSafeAuthMessage(error) }),
  })

  return (
    <AvatarLooksDetailView
      avatar={avatar}
      channelId={channelId}
      entitlement={entitlement}
      onAvatarChange={onAvatarChange}
      shots={shots}
      shotsLoading={shotsQuery.isLoading}
      shotsError={shotsQuery.isError}
      displayName={displayName}
      renamePending={renameMutation.isPending}
      onDisplayNameChange={setDisplayName}
      onSaveName={() => renameMutation.mutate()}
      onBack={onBack}
      onDelete={onDelete}
      startRenaming={startRenaming}
      onRetryShots={() => void shotsQuery.refetch()}
      onShotOpen={(shot) => {
        if (resolveShotOpenTarget() !== 'shot_inspector') return
        onShotOpen(shot)
      }}
      onNewShot={onNewShot}
    />
  )
}

export function AvatarLooksDetailView({
  avatar,
  channelId,
  entitlement = null,
  onAvatarChange,
  shots,
  shotsLoading,
  shotsError,
  displayName,
  renamePending,
  onDisplayNameChange,
  onSaveName,
  onBack,
  onDelete,
  startRenaming = false,
  onRetryShots,
  onShotOpen,
  onNewShot,
}: {
  avatar: Avatar
  channelId: string | null
  entitlement?: AvatarEntitlement | null
  onAvatarChange?: (avatar: Avatar) => void
  shots: AvatarShot[]
  shotsLoading: boolean
  shotsError: boolean
  displayName: string
  renamePending: boolean
  onDisplayNameChange: (value: string) => void
  onSaveName: () => void
  onBack: () => void
  onDelete?: () => void
  startRenaming?: boolean
  onRetryShots: () => void
  onShotOpen: (shot: AvatarShot) => void
  onNewShot: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const [renaming, setRenaming] = React.useState(startRenaming)
  const shotLocked = avatar.status !== 'ready'
  React.useEffect(() => {
    if (startRenaming) setRenaming(true)
  }, [startRenaming, avatar.id])
  const originLabel = avatar.origin === 'human_clone'
    ? t('originClone')
    : avatar.origin === 'public_template'
      ? t('originTemplate')
      : t('originDigital')
  const statusLabel = avatar.status === 'ready'
    ? t('statusReady')
    : avatar.status === 'failed'
      ? t('statusFailed')
      : avatar.status === 'disabled'
        ? t('statusDisabled')
        : t('statusProvisioning')
  const orderedShots = orderShotsForGallery(shots)
  const processingCount = shots.filter((shot) => shot.status === 'processing').length
  const objectId = avatar.preview_storage_object_id || ''
  const headerThumb = useStorageThumbnailUrl({
    channelId,
    objectId,
    enabled: Boolean(channelId && objectId),
    allowOriginalImageFallback: true,
  })

  return (
    <div
      data-avatar-surface="shots-looks-detail"
      data-avatar-open-target="shots_looks_detail"
      className="relative mx-auto flex min-h-full max-w-[1440px] flex-col px-4 pb-10 pt-6 md:px-8 md:pt-8 xl:px-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onBack} aria-label={t('backToAvatars')}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-accent">
            {headerThumb.data?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerThumb.data.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="absolute inset-0 m-auto size-5 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={displayName}
                  maxLength={120}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                  className="h-9 max-w-sm"
                  aria-label={t('displayName')}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  disabled={renamePending || !displayName.trim()}
                  onClick={() => {
                    onSaveName()
                    setRenaming(false)
                  }}
                >
                  <Check className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-2xl text-foreground">{displayName}</h1>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setRenaming(true)}
                  aria-label={t('rename')}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {originLabel} · {statusLabel}
                {avatar.audio_storage_object_id ? ` · ${t('voiceRecorded')}` : ''}
              </p>
              {onAvatarChange ? (
                <AvatarVoiceChip
                  avatar={avatar}
                  channelId={channelId}
                  entitlement={entitlement}
                  onAvatarChange={onAvatarChange}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            data-create-shot="design-a-look"
            className="rounded-full"
            disabled={shotLocked}
            onClick={onNewShot}
          >
            <Plus className="size-4" />
            {t('newShot')}
          </Button>
          {onDelete ? (
            <AvatarOverflowMenu
              onRename={() => setRenaming(true)}
              onDelete={onDelete}
            />
          ) : null}
        </div>
      </div>

      {avatar.status === 'failed' ? (
        <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('avatarFailedHint', { code: avatar.failure_code || t('statusFailed') })}
          {avatar.recording_refund_status === 'pending' ? ' ' + t('recordingRefundPending') : ''}
          {avatar.recording_refund_status === 'completed' ? ' ' + t('recordingRefundCompleted') : ''}
        </p>
      ) : avatar.status === 'provisioning' || processingCount > 0 ? (
        <p
          data-avatar-progress="generating"
          className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          {avatar.status === 'provisioning' ? t('avatarPreparing') : t('shotsGenerating', { count: processingCount })}
        </p>
      ) : null}

      <section className="mt-6 flex-1">
        {shotsLoading ? (
          <ShotMasonry>
            {[0, 1, 2].map((index) => (
              <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-accent" />
            ))}
          </ShotMasonry>
        ) : shotsError ? (
          <div className="rounded-2xl border border-dashed border-border bg-panel/30 p-6 text-center">
            <p className="text-sm text-destructive">{t('loadFailed')}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={onRetryShots}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <ShotMasonry>
            <div key="new-shot">
              <button
                type="button"
                data-create-shot="design-a-look-tile"
                onClick={onNewShot}
                disabled={shotLocked}
                className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center transition hover:border-foreground/40 hover:bg-panel/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex size-11 items-center justify-center rounded-full border border-border">
                  <Plus className="size-5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-foreground">{t('newShot')}</span>
                <span className="mt-1 text-xs text-muted-foreground">{t('newShotHint')}</span>
              </button>
            </div>
            {orderedShots.map((shot) => (
              <MasonryShotTile
                key={shot.id}
                channelId={channelId}
                shot={shot}
                onOpen={() => onShotOpen(shot)}
              />
            ))}
          </ShotMasonry>
        )}
      </section>
    </div>
  )
}

const MASONRY_BREAKPOINTS = [
  { query: '(min-width: 1280px)', columns: 4 },
  { query: '(min-width: 640px)', columns: 3 },
] as const

function readMasonryColumns() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 4
  return MASONRY_BREAKPOINTS.find((item) => window.matchMedia(item.query).matches)?.columns ?? 2
}

function subscribeMasonryColumns(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const lists = MASONRY_BREAKPOINTS.map((item) => window.matchMedia(item.query))
  lists.forEach((list) => list.addEventListener('change', onChange))
  return () => lists.forEach((list) => list.removeEventListener('change', onChange))
}

/** Pinterest-style masonry: items flow left to right into the shortest-by-count column. */
export function distributeMasonryItems<T>(items: T[], columns: number): T[][] {
  const count = Math.max(1, Math.floor(columns))
  const result: T[][] = Array.from({ length: count }, () => [])
  items.forEach((item, index) => result[index % count]!.push(item))
  return result
}

function ShotMasonry({ children }: { children: React.ReactNode }) {
  const columns = React.useSyncExternalStore(subscribeMasonryColumns, readMasonryColumns, () => 4)
  const items = React.Children.toArray(children)
  return (
    <div data-shot-layout="masonry" className="flex items-start gap-3">
      {distributeMasonryItems(items, columns).map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-3">
          {column}
        </div>
      ))}
    </div>
  )
}

function MasonryShotTile({
  channelId,
  shot,
  onOpen,
}: {
  channelId: string | null
  shot: AvatarShot
  onOpen: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: shot.storage_object_id ?? '',
    enabled: Boolean(channelId && shot.storage_object_id && shot.status === 'completed'),
    allowOriginalImageFallback: true,
  })
  const url = shot.status === 'completed' ? thumbnail.data?.url : null

  return (
    <div>
      <button
        type="button"
        data-shot-open-target="shot_inspector"
        data-shot-status={shot.status}
        onClick={onOpen}
        disabled={shot.status === 'processing'}
        className="group relative block w-full overflow-hidden rounded-2xl bg-accent text-left outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-progress"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={shot.display_name} className="block h-auto w-full" loading="lazy" />
        ) : (
          <span className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {shot.status === 'processing' ? (
              <>
                <span className="absolute inset-0 animate-pulse bg-gradient-to-b from-accent via-panel/60 to-accent" />
                <Loader2 className="relative size-5 animate-spin" />
                <span className="relative text-xs font-medium">{t('shotProcessing')}</span>
              </>
            ) : shot.status === 'failed' ? (
              <span className="px-4 text-center text-xs font-medium text-destructive">{t('shotFailed')}</span>
            ) : (
              <UserRound className="size-6" />
            )}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          {shot.is_primary ? <Star className="size-3.5 fill-current" aria-label={t('primaryShot')} /> : null}
          <span className="truncate text-xs font-medium">{shot.display_name}</span>
        </span>
      </button>
    </div>
  )
}

export function orderShotsForGallery(shots: AvatarShot[]) {
  return [...shots].sort((left, right) => {
    if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  })
}

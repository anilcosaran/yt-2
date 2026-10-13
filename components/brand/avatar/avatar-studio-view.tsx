'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Loader2, Palette, Plus, Sparkles, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { AvatarLooksDetail } from '@/components/brand/avatar/avatar-looks-detail'
import { AvatarOverflowMenu } from '@/components/brand/avatar/avatar-overflow-menu'
import { AvatarShotDock } from '@/components/brand/avatar/avatar-shot-dock'
import { AvatarShotInspector } from '@/components/brand/avatar/avatar-shot-inspector'
import { AvatarKindCard, CreateAvatarModal } from '@/components/brand/avatar/create-avatar-modal'
import { AVATAR_UPGRADE_HREF } from '@/components/brand/avatar/avatar-voice-controls'
import { useAvatarEntitlement } from '@/components/brand/avatar/use-avatar-pricing'
import { ADD_CREDITS_HREF } from '@/components/billing/credit-action-button'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandSearch, BrandSegmented, BrandTabs } from '@/components/brand/brand-controls'
import {
  avatarsQueryKey,
  createAvatarIdempotencyKey,
  deleteAvatar,
  listAvatars,
  listPublicAvatars,
  publicAvatarsQueryKey,
  recreatePublicAvatar,
  type Avatar,
  type AvatarKind,
  type AvatarShot,
  type DigitalHumanBrief,
  type PublicAvatarTemplate,
} from '@/lib/avatar/api'
import {
  classifyAvatarPurchaseError,
  resolveAvatarCreationPrice,
  toAvatarExpectedPrice,
  type AvatarEntitlement,
} from '@/lib/avatar/entitlement'
import { describeCreateError } from '@/components/brand/avatar/avatar-character-form'
import { readRecordingCaptureDraft } from '@/lib/avatar/recording-draft'
import { resolveAvatarOpenTarget, resolveShotOpenTarget } from '@/lib/avatar/shot-actions'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { getOpaqueVoiceRouteParam } from '@/lib/voice/tool-route-params'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'
import { cn } from '@/lib/utils'

export function AvatarStudioView() {
  const t = useTranslations('BrandAvatar')
  const tFlow = useTranslations('BrandAvatar.createFlow')
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { activeChannelId, isLoading: channelLoading, workspaceReady } = useActiveChannel()
  const [tab, setTab] = React.useState('mine')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createKind, setCreateKind] = React.useState<AvatarKind | null>(null)
  const [createSourceId, setCreateSourceId] = React.useState<string | null>(null)
  const [createBrief, setCreateBrief] = React.useState<Partial<DigitalHumanBrief> | null>(null)
  const routeSourceStorageObjectId = React.useMemo(
    () => getOpaqueVoiceRouteParam(searchParams.get('source_storage_object_id')),
    [searchParams],
  )
  const routeAvatarId = React.useMemo(
    () => searchParams.get('avatar')?.trim() || null,
    [searchParams],
  )
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<Avatar | null>(null)
  const [selectedShot, setSelectedShot] = React.useState<AvatarShot | null>(null)
  const [search, setSearch] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [gender, setGender] = React.useState('')
  const [ageBand, setAgeBand] = React.useState('')
  const [featured, setFeatured] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<Avatar | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [renameOnOpen, setRenameOnOpen] = React.useState(false)
  const [justCreatedId, setJustCreatedId] = React.useState<string | null>(null)
  // The new-shot box at the bottom of the page: which avatar it makes a shot of; `key` refocuses it when asked again.
  const [dock, setDock] = React.useState<{ avatarId: string; key: number } | null>(null)
  const openDock = (avatar: Avatar) => setDock((current) => ({ avatarId: avatar.id, key: (current?.key ?? 0) + 1 }))
  const {
    entitlement,
    refresh: refreshEntitlement,
  } = useAvatarEntitlement(activeChannelId ?? null, Boolean(activeChannelId) && workspaceReady)

  const avatarsQuery = useQuery({
    queryKey: avatarsQueryKey({ channelId: activeChannelId ?? '' }),
    queryFn: ({ signal }) => listAvatars({ channelId: activeChannelId!, limit: 50 }, { signal }),
    enabled: Boolean(activeChannelId) && workspaceReady,
    refetchInterval: (query) => getAvatarListRefetchInterval(
      query.state.data?.data ?? [],
      Boolean(activeChannelId && readRecordingCaptureDraft(activeChannelId)),
    ),
  })

  const templatesQuery = useQuery({
    queryKey: publicAvatarsQueryKey({
      search: search || undefined,
      style: style || undefined,
      gender: gender ? (gender as 'female' | 'male' | 'nonbinary' | 'unknown') : undefined,
      ageBand: ageBand ? (ageBand as 'young' | 'adult' | 'mature' | 'unknown') : undefined,
      featured: featured || undefined,
      limit: 40,
    }),
    queryFn: ({ signal }) => listPublicAvatars({
      search: search || undefined,
      style: style || undefined,
      gender: gender ? (gender as 'female' | 'male' | 'nonbinary' | 'unknown') : undefined,
      ageBand: ageBand ? (ageBand as 'young' | 'adult' | 'mature' | 'unknown') : undefined,
      featured: featured || undefined,
      limit: 40,
    }, { signal }),
    enabled: tab === 'explore',
  })

  const canCreate = Boolean(activeChannelId) && workspaceReady

  const openCreate = (kind: AvatarKind | null = null, brief: Partial<DigitalHumanBrief> | null = null) => {
    if (!canCreate) {
      toast.error(t('needChannel'))
      return
    }
    setCreateSourceId(null)
    setCreateBrief(brief)
    setCreateKind(kind)
    setCreateOpen(true)
    setSelectedSnapshot(null)
    setSelectedShot(null)
  }

  React.useEffect(() => {
    if (!routeSourceStorageObjectId || !activeChannelId || !workspaceReady) return
    setCreateKind('digital_human')
    setCreateSourceId(routeSourceStorageObjectId)
    setCreateOpen(true)
  }, [activeChannelId, routeSourceStorageObjectId, workspaceReady])

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateKind(null)
    setCreateSourceId(null)
    setCreateBrief(null)
    if (!routeSourceStorageObjectId || typeof window === 'undefined') return
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('source_storage_object_id')
    window.history.replaceState(window.history.state, '', nextUrl)
  }

  const avatars = avatarsQuery.data?.data ?? []
  const selected = selectedSnapshot
    ? avatars.find((avatar) => avatar.id === selectedSnapshot.id)
      ?? (avatarsQuery.isSuccess && !avatarsQuery.isFetching ? null : selectedSnapshot)
    : null
  const selectedMissing = Boolean(
    selectedSnapshot
    && selectedSnapshot.id !== justCreatedId
    && avatarsQuery.isSuccess
    && !avatarsQuery.isFetching
    && !avatars.some((avatar) => avatar.id === selectedSnapshot.id),
  )
  const openedRouteAvatarIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (justCreatedId && avatars.some((avatar) => avatar.id === justCreatedId)) setJustCreatedId(null)
  }, [avatars, justCreatedId])

  React.useEffect(() => {
    if (!routeAvatarId || openedRouteAvatarIdRef.current === routeAvatarId) return
    const match = avatars.find((avatar) => avatar.id === routeAvatarId)
    if (!match) return
    openedRouteAvatarIdRef.current = routeAvatarId
    setSelectedSnapshot(match)
    setCreateOpen(false)
  }, [avatars, routeAvatarId])

  const handleCreated = React.useCallback((avatar: Avatar) => {
    toast.success(t('created'))
    void queryClient.invalidateQueries({ queryKey: avatarsQueryKey({ channelId: activeChannelId ?? '' }) })
    void refreshEntitlement()
    setCreateOpen(false)
    setCreateKind(null)
    setCreateSourceId(null)
    setCreateBrief(null)
    setTab('mine')
    setRenameOnOpen(false)
    setSelectedShot(null)
    // Open the new avatar right away so its generating shots are visible.
    setJustCreatedId(avatar.id)
    setSelectedSnapshot(avatar)
  }, [activeChannelId, queryClient, refreshEntitlement, t])

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDelete || !activeChannelId || deleting) return
    setDeleting(true)
    try {
      await deleteAvatar({ avatarId: pendingDelete.id, channelId: activeChannelId })
      toast.success(t('deleted'))
      setPendingDelete(null)
      if (selected?.id === pendingDelete.id) {
        setSelectedSnapshot(null)
        setSelectedShot(null)
      }
      await queryClient.invalidateQueries({ queryKey: avatarsQueryKey({ channelId: activeChannelId }) })
      void refreshEntitlement()
    } catch (error) {
      toast.error(t('deleteFailed'), { description: getSafeAuthMessage(error) })
    } finally {
      setDeleting(false)
    }
  }, [activeChannelId, deleting, pendingDelete, queryClient, refreshEntitlement, selected?.id, t])

  if (channelLoading) {
    return <WorkspaceRouteLoading />
  }
  if (!activeChannelId || !workspaceReady) {
    return <WorkspaceChannelRequired compact />
  }

  const dockElement = dock ? (
    <AvatarShotDock
      channelId={activeChannelId}
      entitlement={entitlement}
      avatars={avatars}
      avatarId={dock.avatarId}
      focusKey={dock.key}
      onAvatarChange={(next) => {
        setDock((current) => (current ? { ...current, avatarId: next.id } : current))
        // On an avatar's page the box and the page show the same avatar.
        if (selected) {
          setSelectedShot(null)
          setSelectedSnapshot(next)
        }
      }}
      onQueued={(avatar) => {
        // From the list, go to the avatar so the new shot is seen being made.
        if (selected) return
        setRenameOnOpen(false)
        setSelectedShot(null)
        setSelectedSnapshot(avatar)
      }}
      onClose={() => setDock(null)}
    />
  ) : null

  if (selectedMissing) {
    return (
      <div className="flex min-h-72 flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-panel/60 p-6 text-center">
          <UserRound className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">{t('selectedUnavailable')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('selectedUnavailableDescription')}</p>
          <Button className="mt-4" variant="outline" onClick={() => {
            setRenameOnOpen(false)
            setSelectedSnapshot(null)
            setSelectedShot(null)
          }}>
            {t('backToAvatars')}
          </Button>
        </div>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col">
        <div className={cn('hg-scrollbar relative min-h-0 flex-1 overflow-y-auto', dock && 'pb-56')}>
        <AvatarLooksDetail
          avatar={selected}
          channelId={activeChannelId}
          entitlement={entitlement}
          onBack={() => {
            setRenameOnOpen(false)
            setSelectedSnapshot(null)
            setSelectedShot(null)
          }}
          startRenaming={renameOnOpen}
          onAvatarChange={(next) => {
            setRenameOnOpen(false)
            setSelectedSnapshot(next)
          }}
          onDelete={() => setPendingDelete(selected)}
          onShotOpen={(shot) => {
            if (resolveShotOpenTarget() !== 'shot_inspector') return
            setSelectedShot(shot)
          }}
          onNewShot={() => openDock(selected)}
        />
        </div>
        {dockElement}
        <AvatarShotInspector
          avatar={selected}
          shot={selectedShot}
          open={Boolean(selectedShot)}
          channelId={activeChannelId}
          entitlement={entitlement}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedShot(null)
          }}
          onAvatarChange={setSelectedSnapshot}
        />
        <AppAlertDialog
          open={Boolean(pendingDelete)}
          title={t('deleteConfirmTitle')}
          description={t('deleteConfirmDescription')}
          confirmLabel={deleting ? t('deleting') : t('delete')}
          cancelLabel={t('cancel')}
          tone="destructive"
          busy={deleting}
          onOpenChange={(open) => {
            if (!open && !deleting) setPendingDelete(null)
          }}
          onConfirm={() => void confirmDelete()}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background">
      <div className={cn('hg-scrollbar relative min-h-0 flex-1 overflow-y-auto', dock && 'pb-56')}>
      <div className="relative mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <AvatarEntitlementChip entitlement={entitlement} />
            <Button type="button" onClick={() => openCreate()} className="h-9 rounded-full px-4">
              <Plus className="size-4" />
              {t('create')}
            </Button>
          </div>
        </header>

        <div className="mt-6">
          <BrandTabs
            label={t('title')}
            value={tab === 'explore' ? 'explore' : 'mine'}
            tabs={[
              { id: 'mine', label: t('myAvatars'), count: avatars.length },
              { id: 'explore', label: t('exploreAvatars'), count: templatesQuery.data?.data.length },
            ]}
            onChange={setTab}
          />
        </div>

        {tab !== 'explore' ? (
          <div className="mt-5">
            {avatarsQuery.isLoading ? (
              <StateCard icon={Loader2} title={t('loading')} spinning />
            ) : avatarsQuery.isError ? (
              <StateCard title={t('loadFailed')} actionLabel={t('retry')} onAction={() => void avatarsQuery.refetch()} />
            ) : avatars.length === 0 ? (
              <div data-avatar-empty="kind-cards" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <AvatarKindCard kind="human_clone" entitlement={entitlement} onClick={() => openCreate('human_clone')} />
                <AvatarKindCard kind="digital_human" entitlement={entitlement} onClick={() => openCreate('digital_human')} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {avatars.map((avatar) => (
                  <AvatarCard
                    key={avatar.id}
                    channelId={activeChannelId}
                    avatar={avatar}
                    onOpen={() => {
                      if (resolveAvatarOpenTarget() !== 'shots_looks_detail') return
                      setRenameOnOpen(false)
                      setSelectedShot(null)
                      setSelectedSnapshot(avatar)
                      setDock((current) => (current ? { ...current, avatarId: avatar.id } : current))
                    }}
                    onNewShot={() => openDock(avatar)}
                    onRename={() => {
                      if (resolveAvatarOpenTarget() !== 'shots_looks_detail') return
                      setSelectedShot(null)
                      setRenameOnOpen(true)
                      setSelectedSnapshot(avatar)
                    }}
                    onDelete={() => setPendingDelete(avatar)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <BrandSearch value={search} onChange={setSearch} placeholder={t('searchAvatars')} />
              <BrandSegmented
                label={t('anyStyle')}
                value={style}
                onChange={setStyle}
                options={[
                  { id: '', label: t('filterAll') },
                  { id: 'cinematic', label: t('styleCinematic') },
                  { id: 'realistic', label: t('styleRealistic') },
                  { id: 'illustrated', label: t('styleIllustrated') },
                ]}
              />
              <BrandSegmented
                label={t('anyGender')}
                value={gender}
                onChange={setGender}
                options={[
                  { id: '', label: t('filterAll') },
                  { id: 'female', label: t('female') },
                  { id: 'male', label: t('male') },
                ]}
              />
              <BrandSegmented
                label={t('anyAge')}
                value={ageBand}
                onChange={setAgeBand}
                options={[
                  { id: '', label: t('filterAll') },
                  { id: 'young', label: t('young') },
                  { id: 'adult', label: t('adult') },
                  { id: 'mature', label: t('mature') },
                ]}
              />
              <button
                type="button"
                aria-pressed={featured}
                onClick={() => setFeatured((current) => !current)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                  featured ? 'border-foreground/20 bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Sparkles className="size-3.5" />
                {t('featuredOnly')}
              </button>
            </div>
            {templatesQuery.isLoading ? (
              <StateCard icon={Loader2} title={t('loading')} spinning />
            ) : templatesQuery.isError ? (
              <StateCard title={t('templatesLoadFailed')} actionLabel={t('retry')} onAction={() => void templatesQuery.refetch()} />
            ) : (templatesQuery.data?.data.length ?? 0) === 0 ? (
              <StateCard title={t('emptyTemplates')} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {templatesQuery.data?.data.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={async () => {
                      try {
                        await recreatePublicAvatar({
                          templateId: template.id,
                          channelId: activeChannelId,
                          displayName: template.display_name,
                          idempotencyKey: createAvatarIdempotencyKey('recreate-public'),
                          expectedPrice: toAvatarExpectedPrice(resolveAvatarCreationPrice({
                            entitlement,
                            kind: 'digital_human',
                          })) ?? undefined,
                        })
                        toast.success(t('created'))
                        await queryClient.invalidateQueries({ queryKey: avatarsQueryKey({ channelId: activeChannelId }) })
                        void refreshEntitlement()
                        setTab('mine')
                      } catch (error) {
                        if (classifyAvatarPurchaseError(error) !== 'other') void refreshEntitlement()
                        toast.error(t('createFailed'), { description: describeCreateError(error, tFlow) })
                      }
                    }}
                    onCreateLike={() => openCreate('digital_human', {
                      prompt: t('stylePrompt', { name: template.display_name }),
                      style: template.style,
                      gender: template.gender,
                      age: template.age_band,
                      orientation: template.orientation,
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      {dockElement}
      <AppAlertDialog
        open={Boolean(pendingDelete)}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDescription')}
        confirmLabel={deleting ? t('deleting') : t('delete')}
        cancelLabel={t('cancel')}
        tone="destructive"
        busy={deleting}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        onConfirm={() => void confirmDelete()}
      />
      <CreateAvatarModal
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate()
        }}
        channelId={activeChannelId}
        entitlement={entitlement}
        initialKind={createKind}
        initialSourceStorageObjectId={createSourceId}
        initialBrief={createBrief}
        existingNames={avatars.map((avatar) => avatar.display_name)}
        onCreated={handleCreated}
        onEntitlementStale={() => void refreshEntitlement()}
      />
    </div>
  )
}

/** `Free avatars 7/10 · 4,820 credits` (Basic: credits only). Opens credit/plan links. */
export function AvatarEntitlementChip({ entitlement }: { entitlement: AvatarEntitlement | null }) {
  const t = useTranslations('BrandAvatar.studioChip')
  const format = useFormatter()
  if (!entitlement) return null
  const credits = entitlement.credits.available
  const freeLimit = entitlement.free_avatars.limit
  const parts = [
    freeLimit > 0 ? t('free', { remaining: entitlement.free_avatars.remaining, limit: freeLimit }) : null,
    typeof credits === 'number' ? t('credits', { count: Math.max(0, Math.floor(credits)) }) : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  const resetsAt = entitlement.free_avatars.resets_at ? new Date(entitlement.free_avatars.resets_at) : null
  const resetLabel = freeLimit > 0 && resetsAt && Number.isFinite(resetsAt.getTime())
    ? t('resets', { date: format.dateTime(resetsAt, { dateStyle: 'medium' }) })
    : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-avatar-entitlement-chip={freeLimit > 0 ? 'free' : 'credits'}
          title={resetLabel}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-panel/60 px-3 text-xs font-medium text-foreground transition hover:border-foreground/30"
        >
          <Coins className="size-3.5 text-muted-foreground" />
          {parts.join(' · ')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {resetLabel ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{resetLabel}</p> : null}
        <DropdownMenuItem asChild>
          <Link href={ADD_CREDITS_HREF}>{t('addCredits')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={AVATAR_UPGRADE_HREF}>{t('plans')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getAvatarListRefetchInterval(avatars: Avatar[], hasDraft: boolean): number | false {
  const provisioning = avatars.some((avatar) => avatar.status === "provisioning")
  const refundPending = avatars.some((avatar) => avatar.recording_refund_status === "pending")
  return provisioning || refundPending || hasDraft ? 4_000 : false
}

export const __avatarStudioTestHooks = {
  resolveAvatarCardOpenTarget: resolveAvatarOpenTarget,
  resolveShotClickOpenTarget: resolveShotOpenTarget,
  getAvatarListRefetchInterval,
}

function AvatarCard({
  channelId,
  avatar,
  onOpen,
  onNewShot,
  onRename,
  onDelete,
}: {
  channelId: string
  avatar: Avatar
  onOpen: () => void
  /** Opens the new-shot box at the bottom of the page with this avatar. */
  onNewShot: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const objectId = avatar.preview_storage_object_id || ''
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId,
    enabled: Boolean(objectId),
    allowOriginalImageFallback: true,
  })
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

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-muted/30 text-left">
      <button type="button" onClick={onOpen} className="relative block aspect-[3/4] w-full overflow-hidden">
        {thumbnail.data?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail.data.url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <UserRound className="absolute inset-0 m-auto size-8 text-muted-foreground" />
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">{originLabel}</span>
        {avatar.status === 'provisioning' ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="mt-2 text-xs font-medium text-white">{t('statusProvisioning')}</span>
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 block p-3 text-left">
          <span className="block truncate text-sm font-medium text-white">{avatar.display_name}</span>
          {avatar.status === 'failed' ? (
            <span className="mt-0.5 block truncate text-[11px] text-red-300">
              {avatar.failure_code ? t('avatarFailedHint', { code: avatar.failure_code }) : t('statusFailed')}
              {avatar.recording_refund_status === 'pending' ? ' ' + t('recordingRefundPending') : ''}
              {avatar.recording_refund_status === 'completed' ? ' ' + t('recordingRefundCompleted') : ''}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-[11px] text-white/65">{statusLabel}</span>
          )}
        </span>
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        {avatar.status === 'ready' ? (
          <button
            type="button"
            onClick={onNewShot}
            className="flex h-8 items-center gap-1 rounded-lg bg-black/45 pl-2 pr-2.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 max-sm:px-2"
          >
            <Plus className="size-3.5" />
            {/* On a phone the card is narrow: the plus alone, beside the origin badge. */}
            <span className="max-sm:sr-only">{t('newShot')}</span>
          </button>
        ) : null}
        <div className="rounded-lg bg-black/45 text-white backdrop-blur-sm">
          <AvatarOverflowMenu onRename={onRename} onDelete={onDelete} />
        </div>
      </div>
    </article>
  )
}

function TemplateCard({
  template,
  onUse,
  onCreateLike,
}: {
  template: PublicAvatarTemplate
  onUse: () => Promise<void>
  onCreateLike: () => void
}) {
  const t = useTranslations('BrandAvatar')
  const [busy, setBusy] = React.useState(false)
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-muted/30">
      <div className="relative aspect-[3/4] overflow-hidden">
        {template.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={template.preview_url} alt={template.display_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <Palette className="absolute inset-0 m-auto size-7 text-muted-foreground" />
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {template.featured ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
            <Sparkles className="size-3" />
            {t('featuredOnly')}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="truncate text-sm font-medium text-white">{template.display_name}</p>
          {/* The two actions open under the name on hover (always shown on touch screens). */}
          <div className="grid max-h-0 gap-1.5 overflow-hidden opacity-0 transition-all duration-200 group-focus-within:mt-2 group-focus-within:max-h-24 group-focus-within:opacity-100 group-hover:mt-2 group-hover:max-h-24 group-hover:opacity-100 max-md:mt-2 max-md:max-h-24 max-md:opacity-100">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="h-8 rounded-full"
              onClick={() => {
                setBusy(true)
                void onUse().finally(() => setBusy(false))
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('recreate')}
            </Button>
            <button type="button" onClick={onCreateLike} className="h-7 rounded-full text-xs font-medium text-white/80 transition-colors hover:text-white">
              {t('createInThisStyle')}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function StateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  spinning,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  spinning?: boolean
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/30 p-8 text-center">
      {Icon ? <Icon className={cn('size-6 text-muted-foreground', spinning && 'animate-spin')} /> : null}
      <p className="mt-3 font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  )
}

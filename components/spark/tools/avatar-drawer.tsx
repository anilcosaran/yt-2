'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  avatarShotsQueryKey,
  avatarsQueryKey,
  getAvatarEntitlement,
  listAvatarShots,
  listAvatars,
  listPublicAvatars,
  publicAvatarsQueryKey,
  type Avatar,
  type AvatarShot,
  type PublicAvatarTemplate,
} from '@/lib/avatar/api'
import { avatarEntitlementQueryKey } from '@/lib/avatar/entitlement'
import { AVATAR_CARD_KIND, avatarLookToDragData, type AvatarLook } from '@/lib/spark/avatar-insert'
import { writeCardDrag } from '@/lib/spark/stage/placement'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'

import './avatar-drawer.css'
import { insertAvatarLook } from './avatar-insert-flow'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'
import { EmptyNote, Icon } from './studio-parts'

/** Typing settles before the stock catalogue is searched (one request per pause). */
const SEARCH_DEBOUNCE_MS = 300
/** The Brand avatar studio: "Create your own avatar" opens it in a new tab so the project stays open. */
export const AVATAR_STUDIO_HREF = '/brand?section=avatars'

/**
 * E1-J Avatar drawer (D6, design `TOOLS.avatar`): "Stock" (the public catalogue, `/api/v1/public-avatars`) and "My
 * avatars" (the workspace's ready avatars, `/api/v1/avatars`) as a grid of cards. A click (or Enter) adds the avatar's
 * IMAGE at the playhead as an ordinary layer, a drag onto the canvas or the timeline adds it there (D14); an own avatar's
 * "Looks" button lists its other looks. "Create your own avatar" opens the Brand avatar studio. Free: talking avatars
 * (generated video) are a later round. The whole drawer is disabled with a reason while Feature Control `avatar_enabled`
 * is off for the workspace (the entitlement says so).
 */
export function AvatarToolDrawer({ ctx }: SparkToolDrawerProps) {
  const t = useTranslations('Spark.editor.avatarTool')
  const channelId = ctx.project.channelId
  const entitlement = useQuery({
    queryKey: avatarEntitlementQueryKey(channelId),
    queryFn: ({ signal }) => getAvatarEntitlement(channelId, { signal }),
    staleTime: 60_000,
  })

  if (entitlement.isPending) {
    return (
      <div className="dr-body">
        <div className="dr-label" role="status" aria-live="polite">
          <span className="spin" aria-hidden />
          {t('loading')}
        </div>
      </div>
    )
  }
  if (entitlement.isError) {
    return (
      <div className="dr-body">
        <div className="mm-empty" role="alert" style={{ padding: '32px 12px' }}>
          {t('entitlementFailed')}
          <button type="button" className="lnk" onClick={() => void entitlement.refetch()}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }
  if (!entitlement.data.enabled) {
    return (
      <div className="dr-body" data-avatar-disabled>
        <EmptyNote title={t('disabledTitle')} body={t('disabledBody')} />
      </div>
    )
  }
  return <AvatarBrowser ctx={ctx} />
}

type Tab = 'stock' | 'mine'

function AvatarBrowser({ ctx }: { ctx: SparkToolContext }) {
  const t = useTranslations('Spark.editor.avatarTool')
  const channelId = ctx.project.channelId
  const [tab, setTab] = React.useState<Tab>('stock')
  const [query, setQuery] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [looksOf, setLooksOf] = React.useState<Avatar | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const canAdd = ctx.stageCanWrite

  React.useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const stock = useQuery({
    queryKey: publicAvatarsQueryKey({ ...(search && { search }), limit: 40 }),
    queryFn: ({ signal }) => listPublicAvatars({ ...(search && { search }), limit: 40 }, { signal }),
    enabled: tab === 'stock',
  })
  const mine = useQuery({
    queryKey: avatarsQueryKey({ channelId, status: 'ready', limit: 50 }),
    queryFn: ({ signal }) => listAvatars({ channelId, status: 'ready', limit: 50 }, { signal }),
    enabled: tab === 'mine' && looksOf === null,
  })

  const insert = async (key: string, look: AvatarLook) => {
    if (busyKey !== null || !canAdd) return
    setBusyKey(key)
    try {
      const placed = await insertAvatarLook(ctx, look)
      // A stock picture is a signed, short-lived URL: after a failure read the catalogue again so a retry gets a fresh one.
      if (!placed && look.source === 'public') void stock.refetch()
    } finally {
      setBusyKey(null)
    }
  }

  const needle = query.trim().toLowerCase()
  const ownAvatars = (mine.data?.data ?? []).filter((avatar) => needle === '' || avatar.display_name.toLowerCase().includes(needle))

  if (looksOf) {
    return (
      <LooksView
        ctx={ctx}
        avatar={looksOf}
        busyKey={busyKey}
        canAdd={canAdd}
        onBack={() => setLooksOf(null)}
        onInsert={insert}
      />
    )
  }

  return (
    <div className="dr-body">
      <div className="search">
        <Icon name="search" size="sm" />
        <input
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="seg" role="tablist" style={{ marginTop: 10 }}>
        <button type="button" role="tab" aria-selected={tab === 'stock'} className={tab === 'stock' ? 'on' : undefined} onClick={() => setTab('stock')}>
          {t('tabs.stock')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : undefined} onClick={() => setTab('mine')}>
          {t('tabs.mine')}
        </button>
      </div>
      {tab === 'stock' ? (
        <StockGrid
          result={stock}
          busyKey={busyKey}
          canAdd={canAdd}
          writeTitle={ctx.writeTitle}
          onInsert={insert}
        />
      ) : (
        <MineGrid
          result={mine}
          avatars={ownAvatars}
          channelId={channelId}
          busyKey={busyKey}
          canAdd={canAdd}
          writeTitle={ctx.writeTitle}
          onInsert={insert}
          onLooks={setLooksOf}
        />
      )}
    </div>
  )
}

type CardAction = (key: string, look: AvatarLook) => Promise<void>

function CreateTile() {
  const t = useTranslations('Spark.editor.avatarTool')
  return (
    <a className="av-create" href={AVATAR_STUDIO_HREF} target="_blank" rel="noopener noreferrer" title={t('createTitle')}>
      <Icon name="plus" />
      {t('create')}
    </a>
  )
}

function GridStatus({ loading, failed, onRetry }: { loading: boolean; failed: boolean; onRetry: () => void }) {
  const t = useTranslations('Spark.editor.avatarTool')
  if (loading) {
    return (
      <div className="dr-label" role="status" aria-live="polite">
        <span className="spin" aria-hidden />
        {t('loading')}
      </div>
    )
  }
  if (failed) {
    return (
      <div className="mm-empty" role="alert" style={{ padding: '32px 12px' }}>
        {t('loadFailed')}
        <button type="button" className="lnk" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    )
  }
  return null
}

function StockGrid({
  result,
  busyKey,
  canAdd,
  writeTitle,
  onInsert,
}: {
  result: { data: { data: PublicAvatarTemplate[] } | undefined; isPending: boolean; isError: boolean; refetch: () => unknown }
  busyKey: string | null
  canAdd: boolean
  writeTitle: string | undefined
  onInsert: CardAction
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  const templates = result.data?.data ?? []
  return (
    <>
      <div className="dr-label">
        {t('presenters')} <span>{templates.length}</span>
      </div>
      <GridStatus loading={result.isPending} failed={result.isError} onRetry={() => void result.refetch()} />
      {!result.isPending && !result.isError && templates.length === 0 ? (
        <div className="mm-empty" style={{ padding: '16px 12px' }}>
          {t('emptyStock')}
        </div>
      ) : null}
      <div className="grid2">
        {templates.map((template) => {
          const look: AvatarLook | null = template.preview_url
            ? { source: 'public', templateId: template.id, name: template.display_name, previewUrl: template.preview_url }
            : null
          return (
            <AvatarCard
              key={template.id}
              cardKey={`public:${template.id}`}
              name={template.display_name}
              sub={template.style ?? ''}
              look={look}
              imageUrl={template.preview_url}
              busyKey={busyKey}
              canAdd={canAdd}
              writeTitle={writeTitle}
              onInsert={onInsert}
            />
          )
        })}
        <CreateTile />
      </div>
    </>
  )
}

function MineGrid({
  result,
  avatars,
  channelId,
  busyKey,
  canAdd,
  writeTitle,
  onInsert,
  onLooks,
}: {
  result: { isPending: boolean; isError: boolean; refetch: () => unknown }
  avatars: Avatar[]
  channelId: string
  busyKey: string | null
  canAdd: boolean
  writeTitle: string | undefined
  onInsert: CardAction
  onLooks: (avatar: Avatar) => void
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  return (
    <>
      <div className="dr-label">
        {t('presenters')} <span>{avatars.length}</span>
      </div>
      <GridStatus loading={result.isPending} failed={result.isError} onRetry={() => void result.refetch()} />
      {!result.isPending && !result.isError && avatars.length === 0 ? (
        <div className="mm-empty" style={{ padding: '16px 12px' }}>
          {t('emptyMine')}
        </div>
      ) : null}
      <div className="grid2">
        {avatars.map((avatar) => (
          <OwnAvatarCard
            key={avatar.id}
            avatar={avatar}
            channelId={channelId}
            busyKey={busyKey}
            canAdd={canAdd}
            writeTitle={writeTitle}
            onInsert={onInsert}
            onLooks={onLooks}
          />
        ))}
        <CreateTile />
      </div>
    </>
  )
}

function ownLook(avatar: Avatar, storageObjectId: string | null): AvatarLook {
  return {
    source: 'own',
    avatarId: avatar.id,
    name: avatar.display_name,
    storageObjectId,
    primaryShotId: avatar.primary_shot_id,
    previewObjectId: avatar.preview_storage_object_id ?? null,
  }
}

function OwnAvatarCard({
  avatar,
  channelId,
  busyKey,
  canAdd,
  writeTitle,
  onInsert,
  onLooks,
}: {
  avatar: Avatar
  channelId: string
  busyKey: string | null
  canAdd: boolean
  writeTitle: string | undefined
  onInsert: CardAction
  onLooks: (avatar: Avatar) => void
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  const objectId = avatar.preview_storage_object_id ?? ''
  const thumbnail = useStorageThumbnailUrl({ channelId, objectId, enabled: Boolean(objectId), allowOriginalImageFallback: true })
  return (
    <div className="av-wrap">
      <AvatarCard
        cardKey={`own:${avatar.id}`}
        name={avatar.display_name}
        sub=""
        look={ownLook(avatar, null)}
        imageUrl={thumbnail.data?.url ?? null}
        busyKey={busyKey}
        canAdd={canAdd}
        writeTitle={writeTitle}
        onInsert={onInsert}
      />
      <button type="button" className="av-looks" aria-label={t('looks', { name: avatar.display_name })} onClick={() => onLooks(avatar)}>
        {t('looksButton')}
      </button>
    </div>
  )
}

/** One card of the design's grid (`.av-card`): a click or Enter adds the look, a drag carries it (D14). */
function AvatarCard({
  cardKey,
  name,
  sub,
  look,
  imageUrl,
  busyKey,
  canAdd,
  writeTitle,
  onInsert,
}: {
  cardKey: string
  name: string
  sub: string
  look: AvatarLook | null
  imageUrl: string | null
  busyKey: string | null
  canAdd: boolean
  writeTitle: string | undefined
  onInsert: CardAction
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  const busy = busyKey === cardKey
  const disabled = !canAdd || look === null || (busyKey !== null && !busy)
  const activate = () => {
    if (!disabled && look) void onInsert(cardKey, look)
  }
  return (
    <div
      className={`av-card${busy ? ' on' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={t('add', { name })}
      title={writeTitle ?? t('dragHint')}
      draggable={!disabled}
      data-avatar-card={cardKey}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      }}
      onDragStart={(event) => {
        if (!look) return
        writeCardDrag(event.dataTransfer, { tool: 'avatar', kind: AVATAR_CARD_KIND, data: avatarLookToDragData(look) })
      }}
    >
      <div className="av-img">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" draggable={false} />
        ) : (
          <Icon name="user" />
        )}
      </div>
      <span className="av-check" role={busy ? 'status' : undefined} aria-label={busy ? t('adding') : undefined}>
        {busy ? <span className="spin" aria-hidden /> : null}
      </span>
      <div className="av-name">{name}</div>
      <div className="av-sub">{sub}</div>
    </div>
  )
}

function LooksView({
  ctx,
  avatar,
  busyKey,
  canAdd,
  onBack,
  onInsert,
}: {
  ctx: SparkToolContext
  avatar: Avatar
  busyKey: string | null
  canAdd: boolean
  onBack: () => void
  onInsert: CardAction
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  const channelId = ctx.project.channelId
  const shots = useQuery({
    queryKey: avatarShotsQueryKey(channelId, avatar.id),
    queryFn: ({ signal }) => listAvatarShots(avatar.id, channelId, { signal }),
  })
  const looks = (shots.data ?? []).filter((shot) => shot.status === 'completed' && shot.storage_object_id)
  return (
    <div className="dr-body">
      <button type="button" className="btn ghost sm av-back" onClick={onBack}>
        <Icon name="left" size="sm" />
        {t('back')}
      </button>
      <div className="dr-label">
        {t('looks', { name: avatar.display_name })} <span>{looks.length}</span>
      </div>
      <GridStatus loading={shots.isPending} failed={shots.isError} onRetry={() => void shots.refetch()} />
      {!shots.isPending && !shots.isError && looks.length === 0 ? (
        <div className="mm-empty" style={{ padding: '16px 12px' }}>
          {t('noLooks')}
        </div>
      ) : null}
      <div className="grid2">
        {looks.map((shot, index) => (
          <LookCard key={shot.id} shot={shot} index={index} avatar={avatar} channelId={channelId} busyKey={busyKey} canAdd={canAdd} writeTitle={ctx.writeTitle} onInsert={onInsert} />
        ))}
      </div>
    </div>
  )
}

function LookCard({
  shot,
  index,
  avatar,
  channelId,
  busyKey,
  canAdd,
  writeTitle,
  onInsert,
}: {
  shot: AvatarShot
  index: number
  avatar: Avatar
  channelId: string
  busyKey: string | null
  canAdd: boolean
  writeTitle: string | undefined
  onInsert: CardAction
}) {
  const t = useTranslations('Spark.editor.avatarTool')
  const objectId = shot.storage_object_id ?? ''
  const thumbnail = useStorageThumbnailUrl({ channelId, objectId, enabled: Boolean(objectId), allowOriginalImageFallback: true })
  return (
    <AvatarCard
      cardKey={`look:${shot.id}`}
      name={shot.display_name || t('lookName', { n: index + 1 })}
      sub={avatar.display_name}
      look={ownLook(avatar, objectId || null)}
      imageUrl={thumbnail.data?.url ?? null}
      busyKey={busyKey}
      canAdd={canAdd}
      writeTitle={writeTitle}
      onInsert={onInsert}
    />
  )
}

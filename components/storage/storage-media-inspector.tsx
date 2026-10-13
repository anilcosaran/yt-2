'use client'

import * as React from 'react'
import {
  AudioLines,
  Captions,
  ChevronRight,
  Download,
  File as FileIcon,
  FileText,
  FileVideo,
  Frame,
  Image as ImageIcon,
  Languages,
  Mic,
  Play,
  Scissors,
  Share2,
  Shuffle,
  Stamp,
  UserRound,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { StorageObjectItem } from '@/lib/storage/api'
import { cn } from '@/lib/utils'
import { publicModelLabel } from '@/lib/public-model-display'

export type StorageInspectorKind = 'image' | 'video' | 'audio' | 'text' | 'unsupported'
export type StorageInspectorTab = 'edit' | 'actions' | 'transcript' | 'info'

export type StorageInspectorTaskDetails = {
  tool?: string | null
  node?: string | null
  action?: string | null
  model?: string | null
  provider?: string | null
  taskId?: string | null
  creditsUsed?: number | null
  createdAt?: string | null
  completedAt?: string | null
  mediaSizeBytes?: number | null
  mediaDurationSeconds?: number | null
}

type InspectorSurface = 'video' | 'image' | 'gif' | 'audio' | 'voice' | 'document'

type EditTool = {
  title: string
  hint: string
  icon: LucideIcon
  href: string
  badgeKey?: 'beta' | 'new'
}

export function StorageMediaInspector({
  open,
  item,
  title,
  subtitle,
  storageObjectId,
  kind,
  isGif,
  isVoice,
  isAvatar,
  overlayHint,
  taskDetails,
  media,
  transcript,
  showSidePanel = true,
  onOpenChange,
  onDownload,
  onShare,
  onOpenHref,
  onUseVoiceAsset,
  voiceActionLabel,
  canDownload,
}: {
  open: boolean
  item?: StorageObjectItem | null
  title?: string
  subtitle?: string
  storageObjectId?: string | null
  kind: StorageInspectorKind
  isGif: boolean
  isVoice: boolean
  isAvatar: boolean
  overlayHint?: React.ReactNode
  taskDetails?: StorageInspectorTaskDetails | null
  media: React.ReactNode
  transcript?: React.ReactNode
  showSidePanel?: boolean
  onOpenChange: (open: boolean) => void
  onDownload: () => void
  onShare: () => Promise<void> | void
  onOpenHref: (href: string) => void
  onUseVoiceAsset?: () => void
  voiceActionLabel?: string | null
  canDownload: boolean
}) {
  const t = useTranslations('Storage')
  const format = useFormatter()
  const [tab, setTab] = React.useState<StorageInspectorTab>('info')
  const [copied, setCopied] = React.useState(false)
  const surface = getInspectorSurface({ kind, isGif, isVoice })
  const displayTitle = title?.trim() || item?.name || ''
  const displaySubtitle = subtitle?.trim()
    || (item ? t('inspector.createdOn', { date: formatInspectorDate(item.created_at, format) }) : '')
  const toolObjectId = storageObjectId?.trim() || item?.id || ''

  React.useEffect(() => {
    if (!open) return
    setTab(showSidePanel ? defaultInspectorTab(surface) : 'info')
    setCopied(false)
  }, [open, item?.id, surface, showSidePanel])

  const tabs = getInspectorTabs(surface, Boolean(transcript), t)
  const editTools = getInspectorEditTools(toolObjectId, surface, isAvatar, t)
  const compactMedia = surface === 'image' || surface === 'gif' || surface === 'document' || surface === 'audio' || surface === 'voice'
  const fitVisualMedia = surface === 'image' || surface === 'gif' || surface === 'document'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50 backdrop-blur-[3px]"
        className={cn(
          'top-[50%] left-[50%] flex translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-[20px] border-[#232525] bg-[#0A0A0A] p-0 text-[#FAFAFA] shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
          compactMedia
            ? 'h-auto max-h-[calc(100vh-40px)] min-h-[min(460px,82vh)] w-[min(1220px,calc(100vw-12px))] sm:max-w-[1220px]'
            : 'h-auto max-h-[calc(100vh-40px)] min-h-[min(560px,86vh)] w-[min(1360px,calc(100vw-12px))] sm:max-w-[1360px]',
        )}
      >
        {open ? (
          <div className="flex max-h-[inherit] min-h-0 min-w-0 flex-1 flex-col">
            <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 overflow-hidden bg-[#0A0A0A] px-3 sm:h-[72px] sm:gap-3 sm:px-5">
              <InspectorAvatar kind={kind} isGif={isGif} />
              <div className="min-w-0 flex-1 leading-tight">
                <DialogTitle className="truncate pr-0 text-[15px] font-semibold tracking-[-0.01em] text-[#FAFAFA]" title={displayTitle}>
                  {displayTitle}
                </DialogTitle>
                {displaySubtitle ? (
                  <DialogDescription className="mt-0.5 truncate text-[13px] text-[#8F8F8F]">
                    {displaySubtitle}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">{displayTitle}</DialogDescription>
                )}
                {overlayHint ? <p className="mt-1 truncate text-xs text-[#8F8F8F]">{overlayHint}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {canDownload ? (
                  <button
                    type="button"
                    onClick={() => onDownload()}
                    aria-label={t('inspector.download')}
                    className="inline-flex size-9 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6] sm:size-10"
                  >
                    <Download className="size-4" strokeWidth={1.8} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    await onShare()
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1600)
                  }}
                  aria-label={copied ? t('inspector.copied') : t('inspector.share')}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-[#FAFAFA] px-2.5 text-[13px] font-semibold text-[#0A0A0A] sm:h-10 sm:px-4"
                >
                  <Share2 className="size-4" strokeWidth={1.8} />
                  <span className="hidden sm:inline">{copied ? t('inspector.copied') : t('inspector.share')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label={t('inspector.close')}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6] sm:size-10"
                >
                  <X className="size-[18px]" strokeWidth={1.8} />
                </button>
              </div>
            </header>

            <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', showSidePanel && 'lg:flex-row lg:gap-10')}>
              <div className={cn(
                'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-7 pb-5 pt-2 sm:px-8',
                showSidePanel ? 'lg:pl-12 lg:pr-6' : 'lg:px-12',
              )}>
                <div className={cn(
                  'flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#111315]',
                  fitVisualMedia
                    ? 'h-[min(70vh,820px)] min-h-[240px] w-full max-w-[920px]'
                    : compactMedia
                      ? 'h-auto w-full max-w-[920px]'
                    : 'h-full min-h-[240px] w-full max-w-[920px]',
                )}>
                  {media}
                </div>
              </div>

              {showSidePanel ? (
              <aside className="mr-0 mb-0 flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-none border-t border-[#232525] bg-[#0C0D0D] lg:mb-4 lg:mr-6 lg:mt-1 lg:max-h-none lg:w-[340px] lg:rounded-[20px] lg:border">
                <div className="tools-scrollbar flex items-center gap-5 overflow-x-auto border-b border-[#1A1B1B] px-5">
                  {tabs.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setTab(entry.id)}
                      className={cn(
                        'relative shrink-0 py-4 text-[14px] font-medium',
                        tab === entry.id ? 'text-[#FAFAFA]' : 'text-[#8F8F8F]',
                      )}
                    >
                      {entry.label}
                      {tab === entry.id ? (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#FAFAFA]" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className={cn(
                  'min-h-0 flex-1 px-3.5 py-4',
                  tab === 'transcript' ? 'flex flex-col overflow-hidden' : 'tools-scrollbar overflow-y-auto',
                )}>
                  {tab === 'edit' ? (
                    <EditToolsList
                      tools={editTools}
                      onOpenHref={(href) => {
                        onOpenChange(false)
                        onOpenHref(href)
                      }}
                    />
                  ) : null}

                  {tab === 'actions' ? (
                    <ActionPanel
                      surface={surface}
                      voiceActionLabel={voiceActionLabel}
                      onVoiceAction={onUseVoiceAsset && voiceActionLabel ? () => {
                        onOpenChange(false)
                        onUseVoiceAsset()
                      } : undefined}
                    />
                  ) : null}

                  {tab === 'transcript' ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {transcript ?? (
                        <p className="px-1 text-[13px] text-[#8F8F8F]">{t('inspector.transcriptUnavailable')}</p>
                      )}
                    </div>
                  ) : null}

                  {tab === 'info' ? (
                    <InfoPanel item={item ?? null} kind={kind} taskDetails={taskDetails} />
                  ) : null}
                </div>
              </aside>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function InspectorAvatar({
  kind,
  isGif,
}: {
  kind: StorageInspectorKind
  isGif: boolean
}) {
  const Icon = isGif || kind === 'image'
    ? ImageIcon
    : kind === 'video'
      ? Play
      : kind === 'audio'
        ? AudioLines
        : kind === 'text'
          ? FileText
          : FileIcon
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6]">
      <Icon className="size-4" strokeWidth={1.8} />
    </span>
  )
}

function EditToolsList({
  tools,
  onOpenHref,
}: {
  tools: EditTool[]
  onOpenHref: (href: string) => void
}) {
  const t = useTranslations('Storage')
  const avatar = tools.find((tool) => tool.href.includes('/brand'))
  const rest = tools.filter((tool) => tool !== avatar)

  return (
    <div>
      {avatar ? (
        <button
          type="button"
          onClick={() => onOpenHref(avatar.href)}
          className="mb-5 flex w-full items-center gap-3 rounded-[18px] border border-[#2A2A2A] px-3.5 py-3.5 text-left hover:bg-[#111315]"
        >
          <avatar.icon className="size-[18px] shrink-0 text-[#C8C8C8]" strokeWidth={1.7} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#FAFAFA]">{avatar.title}</span>
            <span className="mt-0.5 block text-[13px] text-[#8F8F8F]">{avatar.hint}</span>
          </span>
          <ChevronRight className="size-4 text-[#6F6F6F]" />
        </button>
      ) : null}
      {rest.length > 0 ? (
        <p className="mb-3 px-1 text-[15px] font-semibold text-[#FAFAFA]">{t('inspector.makeEdits')}</p>
      ) : null}
      <div className="space-y-2.5">
        {rest.map((tool) => (
          <button
            key={tool.title}
            type="button"
            onClick={() => onOpenHref(tool.href)}
            className="flex w-full items-center gap-3 rounded-[18px] border border-[#2A2A2A] px-3.5 py-3.5 text-left hover:bg-[#111315]"
          >
            <tool.icon className="size-[18px] shrink-0 text-[#C8C8C8]" strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[#FAFAFA]">
                {tool.title}
                {tool.badgeKey === 'beta' ? (
                  <span className="rounded-full bg-[#0B6A86] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                    {t('inspector.badgeBeta')}
                  </span>
                ) : null}
                {tool.badgeKey === 'new' ? (
                  <span className="rounded-full bg-[#F4F4F4] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#111111]">
                    {t('inspector.badgeNew')}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] text-[#8F8F8F]">{tool.hint}</span>
            </span>
            <ChevronRight className="size-4 text-[#6F6F6F]" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ActionPanel({
  surface,
  voiceActionLabel,
  onVoiceAction,
}: {
  surface: InspectorSurface
  voiceActionLabel?: string | null
  onVoiceAction?: () => void
}) {
  const t = useTranslations('Storage')
  return (
    <div className="space-y-3 px-1">
      <p className="text-[14px] leading-6 text-[#8F8F8F]">
        {surface === 'gif'
          ? t('inspector.gifHint')
          : surface === 'document'
            ? t('inspector.documentHint')
            : t('inspector.audioHint')}
      </p>
      {onVoiceAction && voiceActionLabel ? (
        <Button
          type="button"
          onClick={onVoiceAction}
          className="h-10 rounded-full bg-[#FAFAFA] px-4 text-[#0A0A0A] hover:bg-[#FAFAFA]/90"
        >
          <Mic className="size-4" />
          {voiceActionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function InfoPanel({
  item,
  kind,
  taskDetails,
}: {
  item: StorageObjectItem | null
  kind: StorageInspectorKind
  taskDetails?: StorageInspectorTaskDetails | null
}) {
  const t = useTranslations('Storage')
  const format = useFormatter()
  const extension = item ? getInspectorExtension(item) : kind.toUpperCase()
  const mediaRows = item ? [
    { label: t('inspector.info.type'), value: extension || t('inspector.info.unknownType') },
    { label: t('inspector.info.size'), value: formatInspectorBytes(Number(item.size_bytes), format) },
    { label: t('inspector.info.mime'), value: item.mime_type || t('inspector.info.unknownType') },
    { label: t('inspector.info.created'), value: formatInspectorDateTime(item.created_at, format) },
    { label: t('inspector.info.updated'), value: formatInspectorDateTime(item.updated_at, format) },
    { label: t('inspector.info.path'), value: item.path },
    { label: t('inspector.info.status'), value: item.status },
    item.duration_seconds != null
      ? { label: t('inspector.info.duration'), value: formatInspectorDuration(item.duration_seconds) }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row)) : [
    { label: t('inspector.info.type'), value: extension || t('inspector.info.unknownType') },
    Number.isFinite(taskDetails?.mediaSizeBytes)
      ? {
          label: t('inspector.info.size'),
          value: formatInspectorBytes(Math.max(0, Number(taskDetails?.mediaSizeBytes)), format),
        }
      : null,
    Number.isFinite(taskDetails?.mediaDurationSeconds)
      ? {
          label: t('inspector.info.duration'),
          value: formatInspectorDuration(Math.max(0, Number(taskDetails?.mediaDurationSeconds))),
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row))
  const taskCreatedAt = taskDetails?.createdAt?.trim()
  const taskCompletedAt = taskDetails?.completedAt?.trim()
  const taskRows = taskDetails ? [
    taskDetails.tool?.trim()
      ? { label: t('inspector.info.tool'), value: taskDetails.tool.trim() }
      : null,
    taskDetails.node?.trim()
      ? { label: t('inspector.info.node'), value: formatInspectorNodeType(taskDetails.node) }
      : null,
    taskDetails.action?.trim()
      ? { label: t('inspector.info.action'), value: taskDetails.action.trim() }
      : null,
    taskDetails.model?.trim()
      ? { label: t('inspector.info.model'), value: publicModelLabel(taskDetails.model) }
      : null,
    Number.isFinite(taskDetails.creditsUsed)
      ? {
          label: t('inspector.info.creditsUsed'),
          value: t('inspector.info.creditsValue', {
            value: Math.max(0, Number(taskDetails.creditsUsed)),
          }),
        }
      : null,
    taskCreatedAt
      ? { label: t('inspector.info.taskCreated'), value: formatInspectorDateTime(taskCreatedAt, format) }
      : null,
    taskCompletedAt
      ? { label: t('inspector.info.completed'), value: formatInspectorDateTime(taskCompletedAt, format) }
      : null,
    taskCreatedAt && taskCompletedAt
      ? {
          label: t('inspector.info.elapsed'),
          value: formatInspectorElapsed(taskCreatedAt, taskCompletedAt, t),
        }
      : null,
    taskDetails.taskId?.trim()
      ? { label: t('inspector.info.taskId'), value: taskDetails.taskId.trim() }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row)) : []

  return (
    <div className="space-y-5 px-1">
      {taskRows.length > 0 ? (
        <InspectorInfoSection title={t('inspector.info.taskDetails')} rows={taskRows} />
      ) : null}
      <InspectorInfoSection title={t('inspector.info.mediaDetails')} rows={mediaRows} />
    </div>
  )
}

function InspectorInfoSection({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#686B6B]">{title}</h3>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={`${row.label}:${row.value}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-[13px] leading-5">
            <dt className="text-[#8F8F8F]">{row.label}</dt>
            <dd className="break-words text-right font-medium text-[#FAFAFA]" title={row.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function getInspectorSurface({
  kind,
  isGif,
  isVoice,
}: {
  kind: StorageInspectorKind
  isGif: boolean
  isVoice: boolean
}): InspectorSurface {
  if (isGif) return 'gif'
  if (isVoice) return 'voice'
  if (kind === 'video') return 'video'
  if (kind === 'image') return 'image'
  if (kind === 'audio') return 'audio'
  return 'document'
}

function defaultInspectorTab(surface: InspectorSurface): StorageInspectorTab {
  if (surface === 'video' || surface === 'image') return 'edit'
  if (surface === 'audio' || surface === 'voice') return 'actions'
  return 'info'
}

function getInspectorTabs(
  surface: InspectorSurface,
  hasTranscript: boolean,
  t: ReturnType<typeof useTranslations>,
) {
  if (surface === 'video') {
    return [
      { id: 'edit' as const, label: t('inspector.tabs.edit') },
      ...(hasTranscript ? [{ id: 'transcript' as const, label: t('inspector.tabs.transcript') }] : []),
      { id: 'info' as const, label: t('inspector.tabs.info') },
    ]
  }
  if (surface === 'image') {
    return [
      { id: 'edit' as const, label: t('inspector.tabs.edit') },
      { id: 'info' as const, label: t('inspector.tabs.info') },
    ]
  }
  if (surface === 'audio' || surface === 'voice') {
    return [
      { id: 'actions' as const, label: t('inspector.tabs.actions') },
      ...(hasTranscript ? [{ id: 'transcript' as const, label: t('inspector.tabs.transcript') }] : []),
      { id: 'info' as const, label: t('inspector.tabs.info') },
    ]
  }
  return [
    { id: 'info' as const, label: t('inspector.tabs.info') },
    { id: 'actions' as const, label: t('inspector.tabs.actions') },
  ]
}

function getInspectorEditTools(
  storageObjectId: string,
  surface: InspectorSurface,
  isAvatar: boolean,
  t: ReturnType<typeof useTranslations>,
): EditTool[] {
  const id = storageObjectId
  if (surface === 'video') {
    return [
      {
        title: isAvatar ? t('avatarActions.openInBrand') : t('inspector.createAvatar'),
        hint: t('inspector.createAvatarHint'),
        icon: UserRound,
        href: inspectorAvatarHref(id, 'video'),
      },
      {
        title: t('inspector.magicClips'),
        hint: t('inspector.magicClipsHint'),
        icon: Scissors,
        href: inspectorToolHref('viral-clips', id),
        badgeKey: 'new',
      },
      {
        title: t('inspector.captions'),
        hint: t('inspector.captionsHint'),
        icon: Captions,
        href: inspectorToolHref('captions', id),
      },
      {
        title: t('inspector.translate'),
        hint: t('inspector.translateHint'),
        icon: Languages,
        href: inspectorToolHref('captions', id),
        badgeKey: 'beta',
      },
      {
        title: t('inspector.transform'),
        hint: t('inspector.transformHint'),
        icon: Shuffle,
        href: inspectorToolHref('media-transform', id),
      },
      {
        title: t('inspector.overlay'),
        hint: t('inspector.overlayHint'),
        icon: Stamp,
        href: inspectorToolHref('brand-overlay', id),
      },
      {
        title: t('inspector.frames'),
        hint: t('inspector.framesHint'),
        icon: Frame,
        href: inspectorToolHref('frame-extract', id),
      },
      {
        title: t('inspector.gif'),
        hint: t('inspector.gifToolHint'),
        icon: FileVideo,
        href: inspectorToolHref('video-to-gif', id),
      },
    ]
  }
  if (surface === 'image') {
    return [
      {
        title: isAvatar ? t('avatarActions.openInBrand') : t('inspector.createAvatar'),
        hint: t('inspector.createAvatarHint'),
        icon: UserRound,
        href: inspectorAvatarHref(id, 'image'),
      },
      {
        title: t('inspector.transform'),
        hint: t('inspector.imageTransformHint'),
        icon: Shuffle,
        href: inspectorToolHref('media-transform', id),
      },
      {
        title: t('inspector.wand'),
        hint: t('inspector.wandHint'),
        icon: Wand2,
        href: inspectorToolHref('avatar', id),
      },
    ]
  }
  return []
}

function inspectorToolHref(toolId: string, storageObjectId: string) {
  const params = new URLSearchParams({ tool: toolId })
  if (storageObjectId) params.set('storage_object_id', storageObjectId)
  return `/tools?${params.toString()}`
}

function inspectorAvatarHref(storageObjectId: string, surface: InspectorSurface) {
  const params = new URLSearchParams({ section: 'avatars' })
  if (surface === 'image' && storageObjectId) {
    params.set('source_storage_object_id', storageObjectId)
  }
  return `/brand?${params.toString()}`
}

function getInspectorExtension(item: StorageObjectItem) {
  const explicit = item.extension?.toLowerCase().replace(/^\./, '')
  if (explicit) return explicit.toUpperCase()
  const match = item.name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1]?.toUpperCase() ?? ''
}

function formatInspectorBytes(value: number, format: ReturnType<typeof useFormatter>) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  const maximumFractionDigits = amount >= 10 || index === 0 ? 0 : 1
  return `${format.number(amount, { maximumFractionDigits })} ${units[index]}`
}

function formatInspectorDate(value: string, format: ReturnType<typeof useFormatter>) {
  return format.dateTime(new Date(value), { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatInspectorDateTime(value: string, format: ReturnType<typeof useFormatter>) {
  return format.dateTime(new Date(value), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatInspectorDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remaining = rounded % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

function formatInspectorElapsed(
  createdAt: string,
  completedAt: string,
  t: ReturnType<typeof useTranslations>,
) {
  const createdAtMs = Date.parse(createdAt)
  const completedAtMs = Date.parse(completedAt)
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(completedAtMs) || completedAtMs < createdAtMs) {
    return t('inspector.info.unknownType')
  }
  return t('inspector.info.elapsedSeconds', {
    value: Math.max(0, Math.round((completedAtMs - createdAtMs) / 1_000)),
  })
}

function formatInspectorNodeType(value: string) {
  return value
    .trim()
    .replace(/@\d+(?:\.\d+)*$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

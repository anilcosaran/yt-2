'use client'

import * as React from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useQuery } from '@tanstack/react-query'
import { ChannelCreateDialog } from '@/components/channel/channel-create-dialog'
import { getMyFeatureLimits } from '@/lib/feature-control/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import type { Channel } from '@/lib/channel/api'
import { cn } from '@/lib/utils'
import {
  Check,
  CircleAlert,
  ChevronsUpDown,
  PlusCircle,
  Settings2,
  Youtube,
} from 'lucide-react'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export interface ChannelOption {
  id: string
  name: string
  handle: string
  initials: string
  tone: string
  status?: string
  logoUrl?: string | null
}

interface ChannelSwitcherProps {
  channels: ChannelOption[]
  selectedChannel?: ChannelOption | null
  onSelect: (channelId: string) => void
  onCreated?: (channel: Channel) => void
  loading?: boolean
  error?: string | null
  collapsed?: boolean
  showAvatar?: boolean
  triggerClassName?: string
  avatarClassName?: string
}

export function ChannelSwitcher({
  channels,
  selectedChannel,
  onSelect,
  onCreated,
  loading = false,
  error = null,
  collapsed = false,
  showAvatar = true,
  triggerClassName,
  avatarClassName,
}: ChannelSwitcherProps) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const blurTriggerOnCloseRef = React.useRef(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const limitsQuery = useQuery({
    queryKey: ['feature-limits', 'my'],
    queryFn: getMyFeatureLimits,
    staleTime: 60_000,
  })
  const channelLimit = limitsQuery.data?.features.find((feature) => feature.key === 'max_youtube_channels')?.value
  const canAddChannel = limitsQuery.isSuccess
    && typeof channelLimit === 'number'
    && channels.length > 0
    && channels.length < channelLimit
  const needsConnect = channels.length === 0
    || channels.some((channel) => channel.status === 'setup' || channel.status === 'disconnected')

  const handleChannelSelect = (channelId: string) => {
    blurTriggerOnCloseRef.current = true
    onSelect(channelId)
  }

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      disabled={loading}
      className={cn(
        'group flex min-w-0 items-center rounded-[9px] text-left text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent dark:hover:bg-muted/55',
        loading && 'cursor-default hover:bg-transparent',
        collapsed
          ? 'h-10 w-10 justify-center p-0'
          : 'h-10 w-full gap-3 px-2.5',
        triggerClassName,
      )}
      aria-label={tAuto('aktif_kanali_degistir_9cf8c7cd')}
    >
      {loading ? (
        collapsed ? <Skeleton className="h-6 w-6 rounded-[5px]" /> : <ChannelTriggerSkeleton />
      ) : collapsed ? (
        <ChannelMark className="h-6 w-6" />
      ) : (
        <>
          {showAvatar && (
            selectedChannel ? (
              <ChannelAvatar channel={selectedChannel} className={cn('h-6 w-6', avatarClassName)} />
            ) : (
              <ChannelMark className="h-6 w-6" />
            )
          )}
          <span className="min-w-0 flex-1 truncate font-display text-[15px] leading-5">
            {selectedChannel?.name ?? tAuto('kanal_secilmedi_eeceff61')}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  )

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-normal">
            {loading ? tAuto('kanallar_yukleniyor_67347bd6') : selectedChannel?.name ?? tAuto('kanal_secilmedi_eeceff61')}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      )}

      <DropdownMenuContent
        align="start"
        side={collapsed ? 'right' : 'bottom'}
        sideOffset={8}
        onCloseAutoFocus={(event) => {
          if (!blurTriggerOnCloseRef.current) return

          event.preventDefault()
          triggerRef.current?.blur()
          blurTriggerOnCloseRef.current = false
        }}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[288px] max-w-[calc(100vw-24px)] rounded-lg border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
      >
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground"><UiText id="aktif_kanal_01e6dbad" /></p>
        </div>

        {loading ? (
          <ChannelListSkeleton />
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            {tChannels('workspacePreparing')}
          </div>
        ) : (
          channels.map((channel) => (
            <DropdownMenuItem
              key={channel.id}
              onSelect={() => handleChannelSelect(channel.id)}
              className="gap-2 rounded-md px-2 py-2"
            >
              <ChannelAvatar channel={channel} className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{channel.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {channel.handle}
                </span>
              </span>
              {channel.id === selectedChannel?.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem asChild className="gap-2 rounded-md px-2 py-2">
          <Link href="/channels?view=settings">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <UiText id="kanal_yonetimi_2e59be4d" /></Link>
        </DropdownMenuItem>
        {needsConnect ? (
          <DropdownMenuItem asChild className="gap-2 rounded-md px-2 py-2">
            <Link href="/channels?view=connection">
              <Youtube className="h-4 w-4 text-muted-foreground" />
              {tChannels('connectChannel')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canAddChannel ? (
          <DropdownMenuItem
            className="gap-2 rounded-md px-2 py-2"
            onSelect={() => {
              setCreateOpen(true)
            }}
          >
            <PlusCircle className="h-4 w-4 text-muted-foreground" />
            <UiText id="kanal_ekle_ec976e3e" /></DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </DropdownMenu>
  )
}

function ChannelMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center text-[#FF0033]',
        className,
      )}
    >
      <Youtube className="h-4 w-4 stroke-[2.3]" />
    </span>
  )
}

function ChannelAvatar({
  channel,
  className,
}: {
  channel: ChannelOption
  className?: string
}) {
  return (
    <Avatar className={cn('shrink-0 rounded-lg', className)}>
      {channel.logoUrl && <AvatarImage src={channel.logoUrl} alt="" />}
      <AvatarFallback className="rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-[10px] font-bold text-white">
        {channel.initials}
      </AvatarFallback>
    </Avatar>
  )
}

function ChannelTriggerSkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-5 rounded-full" />
      <Skeleton className="h-3.5 min-w-0 flex-1" />
      <Skeleton className="h-3.5 w-3.5 shrink-0" />
    </>
  )
}

function ChannelListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-1">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center gap-2 py-1.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

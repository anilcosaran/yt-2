'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Archive,
  BookOpenText,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ASSISTANT_CONVERSATIONS_QUERY_KEY,
  ASSISTANT_CONVERSATIONS_UPDATED_EVENT,
  ASSISTANT_ACTIVE_RUNS_QUERY_KEY,
  archiveAssistantConversation,
  deleteAssistantConversation,
  listAssistantActiveRuns,
  listAssistantConversations,
  type AssistantActiveRunSummary,
  type AssistantConversation,
} from '@/lib/assistant/api'
import {
  buildNewChatHref,
  createNewChatIntentId,
  NewChatIntentTracker,
  NEW_CHAT_QUERY_PARAM,
} from '@/lib/assistant/client-intents'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { SidebarToggleIcon } from '@/components/layout/sidebar-toggle-icon'

const CHAT_LIST_LIMIT = 50
const CHAT_QUERY_PARAM = 'id'
const LEGACY_CHAT_QUERY_PARAM = 'chat'
const ACTIVE_RUN_UPDATED_EVENT = 'youtorch:assistant-active-run-updated'
const subscribeToChatSidebarHydration = () => () => undefined
const getChatSidebarClientHydrationSnapshot = () => true
const getChatSidebarServerHydrationSnapshot = () => false

type ChatSidebarProps = {
  collapsed?: boolean
  onCollapsedChange?: (next: boolean | ((current: boolean) => boolean)) => void
}

export function ChatSidebar({ collapsed = false, onCollapsedChange }: ChatSidebarProps) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const tNav = useTranslations('Navigation')
  const now = useNow({ updateInterval: 60_000 })
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { activeChannelId } = useActiveChannel()
  const mounted = React.useSyncExternalStore(
    subscribeToChatSidebarHydration,
    getChatSidebarClientHydrationSnapshot,
    getChatSidebarServerHydrationSnapshot,
  )
  const [activeRunConversationIds, setActiveRunConversationIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const newChatIntentRef = React.useRef(new NewChatIntentTracker())
  const canUseChannel = mounted && Boolean(activeChannelId)
  const activeChatId = mounted ? searchParams.get(CHAT_QUERY_PARAM) ?? searchParams.get(LEGACY_CHAT_QUERY_PARAM) : null
  const activeNewChatId = mounted ? searchParams.get(NEW_CHAT_QUERY_PARAM) : null

  const conversationsQuery = useQuery({
    queryKey: [...ASSISTANT_CONVERSATIONS_QUERY_KEY, activeChannelId],
    queryFn: ({ signal }) => listAssistantConversations(
      { channelId: activeChannelId, limit: CHAT_LIST_LIMIT, offset: 0 },
      { signal },
    ),
    enabled: canUseChannel,
    staleTime: 15_000,
  })
  const activeRunsQuery = useInfiniteQuery({
    queryKey: ASSISTANT_ACTIVE_RUNS_QUERY_KEY,
    queryFn: ({ pageParam, signal }) => listAssistantActiveRuns(
      { limit: 100, before: pageParam },
      { signal },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage, _allPages, _lastPageParam, allPageParams) => {
      const nextCursor = lastPage.next_cursor
      return nextCursor && !allPageParams.includes(nextCursor) ? nextCursor : undefined
    },
    enabled: mounted,
    staleTime: 5_000,
    retry: 2,
    refetchInterval: 15_000,
  })

  React.useEffect(() => {
    if (
      !activeRunsQuery.hasNextPage
      || activeRunsQuery.isFetchingNextPage
      || activeRunsQuery.isFetchNextPageError
    ) return
    void activeRunsQuery.fetchNextPage()
  }, [
    activeRunsQuery.data?.pages.length,
    activeRunsQuery.fetchNextPage,
    activeRunsQuery.hasNextPage,
    activeRunsQuery.isFetchNextPageError,
    activeRunsQuery.isFetchingNextPage,
  ])

  React.useEffect(() => {
    newChatIntentRef.current.sync(activeNewChatId, activeChatId)
  }, [activeChatId, activeNewChatId])

  React.useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_CONVERSATIONS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_ACTIVE_RUNS_QUERY_KEY })
    }
    window.addEventListener(ASSISTANT_CONVERSATIONS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(ASSISTANT_CONVERSATIONS_UPDATED_EVENT, refresh)
  }, [queryClient])

  React.useEffect(() => {
    function handleActiveRunUpdate(event: Event) {
      const detail = (event as CustomEvent<{ conversationId?: string | null; active?: boolean }>).detail
      const conversationId = typeof detail?.conversationId === 'string' ? detail.conversationId : null
      if (!conversationId) return
      setActiveRunConversationIds((current) => {
        const next = new Set(current)
        if (detail?.active) next.add(conversationId)
        else next.delete(conversationId)
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_ACTIVE_RUNS_QUERY_KEY })
    }
    window.addEventListener(ACTIVE_RUN_UPDATED_EVENT, handleActiveRunUpdate)
    return () => window.removeEventListener(ACTIVE_RUN_UPDATED_EVENT, handleActiveRunUpdate)
  }, [queryClient])

  const conversations = React.useMemo(() => {
    return (conversationsQuery.data?.conversations ?? [])
      .filter((conversation) => {
        const channelId = getString(conversation.metadata.channel_id) ?? getString(conversation.metadata.channelId)
        // The list is already requested for the active channel; only drop chats tagged with another channel.
        return !activeChannelId || !channelId || channelId === activeChannelId
      })
      .sort(compareConversationRecency)
  }, [activeChannelId, conversationsQuery.data?.conversations])
  React.useEffect(() => {
    if (!activeRunsQuery.data) return
    setActiveRunConversationIds(new Set(
      activeRunsQuery.data.pages.flatMap((page) => page.conversation_ids),
    ))
  }, [activeRunsQuery.data])

  function handleNewChat() {
    if (!canUseChannel) return
    const intentId = newChatIntentRef.current.next(activeNewChatId, activeChatId)
    router.push(newChatHref(intentId))
  }

  function handleToggleCollapsed() {
    onCollapsedChange?.((current) => !current)
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-full flex-col items-center border-r border-border bg-panel py-3 text-foreground">
        <div className="flex w-full flex-col items-center gap-2 px-1">
          <CompactSidebarLink label={tAuto('back_to_dashboard_b3963db5')} href="/dashboard">
            <ArrowLeft className="size-4" />
          </CompactSidebarLink>
          <CompactSidebarButton label={tNav('newVideo')} onClick={handleNewChat} disabled={!canUseChannel} emphasized>
            <Plus className="size-4" />
          </CompactSidebarButton>
          <CompactSidebarLink label={tAuto('skills_e09212c7')} href="/memory">
            <Sparkles className="size-4" />
          </CompactSidebarLink>
          <CompactSidebarLink label={tAuto('instructions_ed58f297')} href="/memory">
            <BookOpenText className="size-4" />
          </CompactSidebarLink>
          <CompactSidebarButton label={tAuto('expand_chat_menu_4dae8c3e')} onClick={handleToggleCollapsed}>
            <SidebarToggleIcon className="size-4" />
          </CompactSidebarButton>
          <div className="my-1 h-px w-8 bg-sidebar-border" />
        </div>

        <div className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
          {!mounted || conversationsQuery.isLoading ? (
            <>
              <div className="size-9 rounded-md bg-accent/70" />
              <div className="size-9 rounded-md bg-accent/55" />
              <div className="size-9 rounded-md bg-accent/45" />
            </>
          ) : conversations.length === 0 ? null : (
            conversations.slice(0, 24).map((conversation) => (
              <CompactConversationLink
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeChatId}
                running={activeRunConversationIds.has(conversation.id)}
              />
            ))
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-panel text-foreground">
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CompactSidebarLink label={tAuto('back_to_dashboard_b3963db5')} href="/dashboard">
            <ArrowLeft className="size-4" />
          </CompactSidebarLink>
          <button
            type="button"
            aria-label={tAuto('collapse_chat_menu_f3c584df')}
            title={tAuto('collapse_chat_menu_f3c584df')}
            onClick={handleToggleCollapsed}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SidebarToggleIcon className="size-[18px]" />
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <SidebarTopLink primary href="/chat" label={tNav('newVideo')} icon={Plus} disabled={!canUseChannel} onClick={(event) => {
            event.preventDefault()
            handleNewChat()
          }} />
          <SidebarTopLink href="/memory" label={tAuto('skills_e09212c7')} icon={Sparkles} />
          <SidebarTopLink href="/memory" label={tAuto('instructions_ed58f297')} icon={BookOpenText} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between px-3 pb-1.5 pt-4 text-[13px] font-medium text-muted-foreground">
          <span>{tChat('sidebar.recentWork')}</span>
          {mounted && conversationsQuery.isFetching && <RefreshCw className="size-3 animate-spin" />}
        </div>

        {!mounted || conversationsQuery.isLoading ? (
          <div className="space-y-1.5 px-1">
            <SidebarSkeleton />
            <SidebarSkeleton />
            <SidebarSkeleton />
          </div>
        ) : conversationsQuery.isError ? (
          <button
            type="button"
            className="mx-1 flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 py-3 text-xs text-destructive"
            onClick={() => { void conversationsQuery.refetch() }}
          >
            <RefreshCw className="size-3.5" />
            Chat list unavailable. Try again.
          </button>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-1.5 text-sm text-muted-foreground">
            <UiText id="no_chats_yet_198b4b30" /></p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((conversation) => (
              <ConversationLink
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeChatId}
                running={activeRunConversationIds.has(conversation.id)}
                isCurrent={conversation.id === activeChatId}
                now={now}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function ConversationLink({
  conversation,
  active,
  running,
  isCurrent,
  now,
}: {
  conversation: AssistantConversation
  active: boolean
  running: boolean
  isCurrent: boolean
  now: Date
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const format = useFormatter()
  const title = getConversationTitle(conversation, tChat('copy.newChat'), (channel) => tChat('sidebar.channelChat', { channel }))
  const conversationDate = getConversationDate(conversation)
  const age = conversationDate ? format.relativeTime(conversationDate, { now, style: 'narrow' }) : ''
  const router = useRouter()
  const queryClient = useQueryClient()
  const actionTriggerRef = React.useRef<HTMLButtonElement>(null)
  const blurActionTriggerOnCloseRef = React.useRef(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [actionFocused, setActionFocused] = React.useState(false)
  const archiveMutation = useMutation({
    mutationFn: () => archiveAssistantConversation(conversation.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_CONVERSATIONS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_ACTIVE_RUNS_QUERY_KEY })
      notifyConversationListChanged()
      if (isCurrent) router.push(newChatHref())
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteAssistantConversation(conversation.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_CONVERSATIONS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_ACTIVE_RUNS_QUERY_KEY })
      notifyConversationListChanged()
      if (isCurrent) router.push(newChatHref())
    },
  })
  const busy = archiveMutation.isPending || deleteMutation.isPending
  const actionError = archiveMutation.error
    ? 'Chat could not be archived. Try again.'
    : deleteMutation.error
      ? 'Chat could not be deleted. Try again.'
      : null
  const showActions = menuOpen || actionFocused || busy

  function blurActionTriggerOnClose() {
    blurActionTriggerOnCloseRef.current = true
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
        'group relative flex min-h-9 animate-in items-center rounded-xl text-sm transition-colors fade-in slide-in-from-left-1 duration-150',
        active
          ? 'bg-accent text-foreground'
          : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
        )}
      >
      <Link
        href={chatHref(conversation.id)}
        className="min-w-0 flex-1 rounded-xl px-3 py-1.5 pr-20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block truncate leading-5">{title}</span>
      </Link>
      <span
        className={cn(
          'absolute right-2 top-1/2 flex h-7 min-w-8 -translate-y-1/2 items-center justify-end text-[11px] leading-none text-muted-foreground/75 transition-opacity',
          showActions ? 'opacity-0' : 'group-hover:opacity-0',
        )}
      >
        {running ? <Loader2 className="size-3.5 animate-spin" /> : age}
      </span>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={actionTriggerRef}
            type="button"
            aria-label={tAuto('chat_actions_c08e62f1')}
            disabled={busy}
            onFocus={() => setActionFocused(true)}
            onBlur={() => setActionFocused(false)}
            className={cn(
              'absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-background/70 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 group-hover:opacity-100',
              showActions && 'opacity-100',
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreVertical className="size-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          onPointerDownOutside={blurActionTriggerOnClose}
          onCloseAutoFocus={(event) => {
            if (!blurActionTriggerOnCloseRef.current) return

            event.preventDefault()
            actionTriggerRef.current?.blur()
            setActionFocused(false)
            blurActionTriggerOnCloseRef.current = false
          }}
          className="w-40 p-1"
        >
          <DropdownMenuItem
            className="gap-2 rounded-md px-2 py-2 text-sm"
            onSelect={() => {
              blurActionTriggerOnClose()
              archiveMutation.reset()
              deleteMutation.reset()
              archiveMutation.mutate()
            }}
          >
            <Archive className="size-4 text-muted-foreground" />
            <UiText id="archive_2621c6fd" /></DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 rounded-md px-2 py-2 text-sm text-red-600 focus:text-red-600 dark:text-red-300 dark:focus:text-red-300"
            onSelect={() => {
              blurActionTriggerOnClose()
              archiveMutation.reset()
              deleteMutation.reset()
              deleteMutation.mutate()
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
      {actionError ? (
        <p role="alert" className="px-2.5 text-[11px] leading-4 text-destructive">{actionError}</p>
      ) : null}
    </div>
  )
}

function SidebarTopLink({
  href,
  label,
  icon: Icon,
  disabled = false,
  primary = false,
  onClick,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  /** The outlined "Yeni sohbet" button at the top, as in the workspace menu. */
  primary?: boolean
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <Link
      href={href}
      onClick={disabled ? (event) => event.preventDefault() : onClick}
      aria-disabled={disabled}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        primary
          ? 'mb-1.5 border border-border bg-background/40 text-foreground shadow-xs hover:bg-accent'
          : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function CompactSidebarButton({
  label,
  children,
  disabled,
  onClick,
  emphasized = false,
}: {
  label: string
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  emphasized?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        emphasized
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border hover:bg-accent dark:bg-background/70'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function CompactSidebarLink({
  label,
  href,
  children,
}: {
  label: string
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  )
}

function CompactConversationLink({
  conversation,
  active,
  running,
}: {
  conversation: AssistantConversation
  active: boolean
  running: boolean
}) {
  const tChat = useTranslations('Chat')
  const title = getConversationTitle(conversation, tChat('copy.newChat'), (channel) => tChat('sidebar.channelChat', { channel }))
  return (
    <Link
      href={chatHref(conversation.id)}
      aria-label={title}
      title={title}
      className={cn(
        'flex size-8 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground',
      )}
    >
      {running ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquare className="size-3.5" />}
    </Link>
  )
}

function SidebarSkeleton() {
  return (
    <div className="flex h-12 items-center gap-3 rounded-[9px] px-2.5">
      <Skeleton className="size-7 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-2.5 w-3/4 rounded-full" />
        <Skeleton className="h-2 w-1/2 rounded-full" />
      </div>
    </div>
  )
}

function chatHref(conversationId: string) {
  return `/chat?${CHAT_QUERY_PARAM}=${encodeURIComponent(conversationId)}`
}

function newChatHref(intentId = createNewChatIntentId()) {
  return buildNewChatHref(intentId)
}

function getConversationTitle(
  conversation: AssistantConversation,
  newChatLabel: string,
  channelChatLabel: (channel: string) => string,
) {
  const title = conversation.title?.trim()
  if (title) return title
  const channelName = getString(conversation.metadata.channel_name) ?? getString(conversation.metadata.channelName)
  if (channelName) return channelChatLabel(channelName)
  return newChatLabel
}

function getConversationDate(conversation: AssistantConversation) {
  const value = conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function compareConversationRecency(left: AssistantConversation, right: AssistantConversation) {
  return conversationTime(right) - conversationTime(left)
}

function mergeActiveRunSummaries(runs: AssistantActiveRunSummary[]) {
  const byConversation = new Map<string, AssistantActiveRunSummary>()
  for (const run of runs) {
    const existing = byConversation.get(run.conversation_id)
    if (!existing || Date.parse(run.updated_at) > Date.parse(existing.updated_at)) {
      byConversation.set(run.conversation_id, run)
    }
  }
  return Array.from(byConversation.values()).sort(
    (left, right) => (Date.parse(right.updated_at) || 0) - (Date.parse(left.updated_at) || 0),
  )
}

function notifyConversationListChanged() {
  window.dispatchEvent(new Event(ASSISTANT_CONVERSATIONS_UPDATED_EVENT))
}

function conversationTime(conversation: AssistantConversation) {
  return Date.parse(conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at) || 0
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const __chatSidebarTestHooks = {
  mergeActiveRunSummaries,
}

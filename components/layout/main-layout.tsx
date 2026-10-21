'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CreditCard,
  Database,
  Info,
  Menu,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { AppHeader } from './app-header'
import type { AgentPanelState } from './agent-panel'
import { AppSidebar, type SidebarPreviewModule } from './app-sidebar'
import { WorkspaceIconRail, type WorkspaceRailModule } from './workspace-icon-rail'
import { ActionCenterAlertBar, type ActionCenterAlert } from './action-center-alert-bar'
import { MemberAnnouncementBar } from './announcement-bar'
import { ChannelSlotSelectionDialog } from '@/components/channel/channel-slot-selection-dialog'
import {
  resetBrowserAccountClientCaches,
  type AccountProfileTenant,
} from '@/components/account/browser-account-client'
import {
  BROWSER_PRINCIPAL_STORAGE_KEY,
  bindBrowserPrincipal,
  clearBrowserPrincipalSessionState,
  getBrowserPrincipalScope,
} from '@/lib/auth/browser-principal-storage'
import type { ChannelOption } from './channel-switcher'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { SidebarNavItem } from './app-sidebar'
import {
  ACTIVE_CHANNEL_STORAGE_KEY,
  ActiveChannelProvider,
} from '@/lib/channel/active-channel'
import {
  CHANNELS_QUERY_KEY,
  CHANNEL_SLOT_SELECTION_QUERY_KEY,
  type Channel,
} from '@/lib/channel/api'
import {
  ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY,
  getActionCenterDisplayCtaLabel,
  getActionCenterDisplayMessage,
  getActionCenterDisplayTitle,
  getActionCenterSafeCta,
  listGlobalActionCenterItems,
  repairChannelActionCenterItems,
  type ActionCenterItem,
} from '@/lib/action-center/api'
import {
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from './layout-preferences'
import { ACCOUNT_PROFILE_QUERY_KEY } from '@/components/account/browser-account-client'
import { BILLING_QUOTA_USAGE_QUERY_KEY } from '@/lib/billing/api'
import { getWorkspaceBootstrap, WORKSPACE_BOOTSTRAP_QUERY_KEY } from '@/lib/workspace/api'
import { AuthClientError } from '@/lib/auth/errors'
import { useTranslations } from 'next-intl'
import { SidebarToggleIcon } from './sidebar-toggle-icon'

// The agent panel (and the Spark styles it brings) loads the first time "AI'a sor" opens it.
const AgentPanel = dynamic(() => import('./agent-panel').then((mod) => mod.AgentPanel))

const CHANNELS_STALE_MS = 10 * 60_000
const ACTION_CENTER_STALE_MS = 2 * 60_000
const SHELL_QUERY_GC_MS = 30 * 60_000
const SIDEBAR_RAIL_WIDTH = 76
const SIDEBAR_KEYBOARD_RESIZE_STEP = 12

interface SidebarContentRenderProps {
  collapsed: boolean
  onCollapsedChange: (next: boolean | ((current: boolean) => boolean)) => void
}

interface MainLayoutProps {
  children: React.ReactNode
  appName?: string
  appIcon?: React.ReactNode
  sidebarTitle?: string
  sidebarSubtitle?: string
  sidebarTitleIcon?: React.ReactNode
  sidebarBackHref?: string
  sidebarBackLabel?: string
  sidebarItems: SidebarNavItem[]
  sidebarBottomItems?: SidebarNavItem[]
  sidebarContent?: React.ReactNode | ((props: SidebarContentRenderProps) => React.ReactNode)
  showHeader?: boolean
  showAnnouncementBar?: boolean
  showActionCenterAlerts?: boolean
  forceExpandedSidebar?: boolean
  className?: string
  rightPanel?: React.ReactNode
  accountInitialProfile?: AccountProfileTenant | null
}

export function MainLayout({
  children,
  appName,
  appIcon,
  sidebarTitle,
  sidebarSubtitle,
  sidebarTitleIcon,
  sidebarBackHref,
  sidebarBackLabel,
  sidebarItems,
  sidebarBottomItems,
  sidebarContent,
  showHeader = true,
  showAnnouncementBar = true,
  showActionCenterAlerts = true,
  forceExpandedSidebar = false,
  className,
  rightPanel,
  accountInitialProfile = null,
}: MainLayoutProps) {
  const tAuto = useTranslations('Auto')
  const tLayout = useTranslations('Layout')
  const tActionCenter = useTranslations('ActionCenter')
  const tChannels = useTranslations('Channels')
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [sidebarPreviewOpen, setSidebarPreviewOpen] = React.useState(false)
  const [sidebarPreviewPinned, setSidebarPreviewPinned] = React.useState(false)
  const [sidebarPreviewModule, setSidebarPreviewModule] = React.useState<SidebarPreviewModule | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_DEFAULT_WIDTH)
  const [sidebarResizeSession, setSidebarResizeSession] = React.useState<{
    startX: number
    startWidth: number
  } | null>(null)
  const [selectedChannelId, setSelectedChannelIdState] = React.useState<string | null>(null)
  const [preferencesHydrated, setPreferencesHydrated] = React.useState(false)
  const [agentPanel, setAgentPanel] = React.useState<AgentPanelState>('closed')
  const [agentPanelLoaded, setAgentPanelLoaded] = React.useState(false)
  // A page without the top bar (the Chat) has no "AI'a sor": the panel closes there.
  if (!showHeader && agentPanel !== 'closed') setAgentPanel('closed')
  const queryClient = useQueryClient()
  const router = useRouter()
  const boundPrincipalRef = React.useRef<string | null>(null)
  const desktopSidebarFrameRef = React.useRef<HTMLDivElement>(null)
  const channelActionCenterRepairAttempted = React.useRef(false)
  const channelsQuery = useQuery({
    queryKey: WORKSPACE_BOOTSTRAP_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const bootstrap = await getWorkspaceBootstrap({ signal })
      queryClient.setQueryData(CHANNELS_QUERY_KEY, bootstrap.channels)
      if (!bootstrap.degraded_sources.includes('pending_slot_selection')) {
        queryClient.setQueryData(CHANNEL_SLOT_SELECTION_QUERY_KEY, bootstrap.pending_slot_selection)
      }
      if (bootstrap.global_alerts) {
        queryClient.setQueryData(ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY, bootstrap.global_alerts)
      }
      queryClient.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, bootstrap.tenant)
      if (bootstrap.quota_usage) {
        queryClient.setQueryData(BILLING_QUOTA_USAGE_QUERY_KEY, bootstrap.quota_usage)
      }
      return bootstrap
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && (!data.workspace_ready || data.channels.length === 0)) return 2000
      return false
    },
    staleTime: CHANNELS_STALE_MS,
    gcTime: SHELL_QUERY_GC_MS,
    retry: (failureCount, error) => {
      if (isRetryableWorkspaceError(error)) return failureCount < 3
      return failureCount < 1
    },
    retryDelay: (failureCount) => Math.min(1000 * 2 ** failureCount, 4000),
  })
  const globalActionCenterQuery = useQuery({
    queryKey: ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY,
    queryFn: ({ signal }) => listGlobalActionCenterItems({ signal }),
    enabled: showActionCenterAlerts && channelsQuery.isSuccess,
    staleTime: ACTION_CENTER_STALE_MS,
    gcTime: SHELL_QUERY_GC_MS,
  })
  const channels = channelsQuery.data?.channels ?? []
  const workspaceReady = channelsQuery.data?.workspace_ready === true
  const bootstrappedProfile = channelsQuery.isSuccess
    ? queryClient.getQueryData<AccountProfileTenant>(ACCOUNT_PROFILE_QUERY_KEY) ?? accountInitialProfile
    : accountInitialProfile
  const resolvedChannelId =
    selectedChannelId && channels.some((channel) => channel.id === selectedChannelId)
      ? selectedChannelId
      : channels[0]?.id ?? null
  const selectedChannel = channels.find((channel) => channel.id === resolvedChannelId) ?? null
  const channelLoading = !preferencesHydrated
    || channelsQuery.isPending
    || (channelsQuery.isFetching && !channelsQuery.isSuccess)
  const activeChannelId = preferencesHydrated ? resolvedChannelId : null
  const channelOptions = React.useMemo(
    () => channels.map((channel) => toChannelOption(channel, channelStatusLabel(channel.status, tChannels))),
    [channels, tChannels],
  )
  const selectedChannelOption = selectedChannel
    ? toChannelOption(selectedChannel, channelStatusLabel(selectedChannel.status, tChannels))
    : activeChannelId
      ? toFallbackChannelOption(
        activeChannelId,
        tLayout('channelTemporarilyUnavailable'),
        tLayout('selectedChannelPreserved'),
      )
      : null
  const channelError = channelsQuery.error instanceof Error
    ? channelsQuery.error.message
    : channelsQuery.error
      ? tLayout('channelsLoadFailed')
      : null
  const refreshChannels = React.useCallback(() => channelsQuery.refetch(), [channelsQuery.refetch])
  const actionCenterAlerts = React.useMemo<ActionCenterAlert[]>(() => {
    return (globalActionCenterQuery.data ?? []).map((item) => {
      const title = getActionCenterDisplayTitle(item)
      const message = getActionCenterDisplayMessage(item)
      const ctaLabel = getActionCenterDisplayCtaLabel(item)
      return toGlobalActionCenterAlert(item, {
        title: tActionCenter(title.key, title.values),
        description: tActionCenter(message.key, message.values),
        ctaLabel: ctaLabel ? tActionCenter(ctaLabel.key, ctaLabel.values) : null,
      })
    })
  }, [globalActionCenterQuery.data, tActionCenter])

  React.useEffect(() => {
    if (channelActionCenterRepairAttempted.current) return
    if (!showActionCenterAlerts || !channelsQuery.isSuccess || !globalActionCenterQuery.isSuccess) return
    const hasFirstChannelMissing = globalActionCenterQuery.data.some(
      (item) => item.source_type === 'first_channel_missing',
    )
    if (channels.length === 0 && hasFirstChannelMissing) return
    if (channels.length > 0 && !hasFirstChannelMissing) return

    channelActionCenterRepairAttempted.current = true
    void repairChannelActionCenterItems()
      .then(() => queryClient.invalidateQueries({ queryKey: ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY }))
      .catch((error) => {
        if (error instanceof AuthClientError && (error.status === 401 || error.status === 403)) return
        channelActionCenterRepairAttempted.current = false
      })
  }, [
    channels.length,
    channelsQuery.isSuccess,
    globalActionCenterQuery.data,
    globalActionCenterQuery.isSuccess,
    queryClient,
    showActionCenterAlerts,
  ])

  const setSelectedChannelId = React.useCallback((channelId: string) => {
    setSelectedChannelIdState(channelId)
    window.localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, channelId)
  }, [])

  const clearSelectedChannelId = React.useCallback(() => {
    setSelectedChannelIdState(null)
    window.localStorage.removeItem(ACTIVE_CHANNEL_STORAGE_KEY)
  }, [])

  React.useLayoutEffect(() => {
    const root = document.documentElement
    const initialPrincipal = getBrowserPrincipalScope(accountInitialProfile)
    if (initialPrincipal) {
      bindBrowserPrincipal(initialPrincipal)
      boundPrincipalRef.current = initialPrincipal
    }
    const storedWidth = readStoredSidebarWidth()
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    setSidebarWidth(storedWidth)
    root.style.setProperty('--youtorch-sidebar-width', `${storedWidth}px`)
    setSelectedChannelIdState(window.localStorage.getItem(ACTIVE_CHANNEL_STORAGE_KEY))
    setPreferencesHydrated(true)
    delete root.dataset.youtorchSidebarCollapsed

  }, [accountInitialProfile])

  React.useEffect(() => {
    const principal = getBrowserPrincipalScope(bootstrappedProfile)
    if (principal) {
      bindBrowserPrincipal(principal)
      boundPrincipalRef.current = principal
    }
  }, [bootstrappedProfile?.email])

  React.useEffect(() => {
    const handlePrincipalStorageChange = (event: StorageEvent) => {
      if (event.key !== BROWSER_PRINCIPAL_STORAGE_KEY) return
      if (event.newValue === boundPrincipalRef.current) return
      clearBrowserPrincipalSessionState()
      resetBrowserAccountClientCaches()
      boundPrincipalRef.current = event.newValue
      queryClient.clear()
      setSelectedChannelIdState(null)
      setPreferencesHydrated(false)
      router.replace('/login')
      router.refresh()
    }

    window.addEventListener('storage', handlePrincipalStorageChange)
    return () => window.removeEventListener('storage', handlePrincipalStorageChange)
  }, [queryClient, router])

  React.useEffect(() => {
    if (!preferencesHydrated) return
    if (channelsQuery.isPending) return
    if (channelsQuery.isError && channels.length === 0) return

    if (channels.length === 0) {
      if (selectedChannelId) clearSelectedChannelId()
      return
    }

    if (selectedChannelId && channels.some((channel) => channel.id === selectedChannelId)) return
    setSelectedChannelId(channels[0].id)
  }, [
    channels,
    channelsQuery.isError,
    channelsQuery.isPending,
    clearSelectedChannelId,
    preferencesHydrated,
    selectedChannelId,
    setSelectedChannelId,
  ])

  const activeChannelContext = React.useMemo(() => ({
    channels,
    activeChannel: selectedChannel,
    activeChannelId,
    workspaceReady,
    setActiveChannelId: setSelectedChannelId,
    isLoading: channelLoading,
    error: channelsQuery.error instanceof Error ? channelsQuery.error : null,
    refreshChannels,
  }), [
    channels,
    activeChannelId,
    channelLoading,
    channelsQuery.error,
    refreshChannels,
    selectedChannel,
    setSelectedChannelId,
    workspaceReady,
  ])

  const updateSidebarCollapsed = React.useCallback((next: boolean | ((current: boolean) => boolean)) => {
    if (forceExpandedSidebar) return
    const nextValue = typeof next === 'function' ? next(sidebarCollapsed) : next
    if (!nextValue) {
      setSidebarPreviewOpen(false)
      setSidebarPreviewPinned(false)
      setSidebarPreviewModule(null)
    }
    setSidebarCollapsed(nextValue)
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue))
    window.dispatchEvent(new CustomEvent(SIDEBAR_COLLAPSED_EVENT, { detail: nextValue }))
  }, [forceExpandedSidebar, sidebarCollapsed])

  const effectiveSidebarCollapsed = forceExpandedSidebar ? false : sidebarCollapsed
  const sidebarPreviewVisible = effectiveSidebarCollapsed
    && sidebarPreviewModule !== null
    && (sidebarPreviewOpen || sidebarPreviewPinned)

  const closeSidebarPreview = React.useCallback(() => {
    setSidebarPreviewOpen(false)
    setSidebarPreviewPinned(false)
    setSidebarPreviewModule(null)
  }, [])

  const handleRailModulePreview = React.useCallback((module: WorkspaceRailModule) => {
    if (!effectiveSidebarCollapsed) return
    setSidebarPreviewModule(module === 'assets' ? 'library' : module)
    setSidebarPreviewOpen(true)
  }, [closeSidebarPreview, effectiveSidebarCollapsed])

  const handleRailModuleActivate = React.useCallback((module: WorkspaceRailModule) => {
    if (!effectiveSidebarCollapsed) return
    setSidebarPreviewModule(module === 'assets' ? 'library' : module)
    setSidebarPreviewOpen(true)
    setSidebarPreviewPinned(true)
  }, [closeSidebarPreview, effectiveSidebarCollapsed])

  const handleSidebarPreviewCollapsedChange = React.useCallback((next: boolean | ((current: boolean) => boolean)) => {
    closeSidebarPreview()
    updateSidebarCollapsed(next)
  }, [closeSidebarPreview, updateSidebarCollapsed])


  React.useEffect(() => {
    if (!sidebarPreviewPinned) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (target instanceof Node && desktopSidebarFrameRef.current?.contains(target)) return
      closeSidebarPreview()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebarPreview()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeSidebarPreview, sidebarPreviewPinned])

  const startSidebarResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (effectiveSidebarCollapsed) return
    event.preventDefault()
    setSidebarResizeSession({ startX: event.clientX, startWidth: sidebarWidth })
  }, [effectiveSidebarCollapsed, sidebarWidth])

  const setAndStoreSidebarWidth = React.useCallback((nextWidth: number) => {
    const clampedWidth = clampSidebarWidth(nextWidth)
    setSidebarWidth(clampedWidth)
    document.documentElement.style.setProperty('--youtorch-sidebar-width', `${clampedWidth}px`)
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampedWidth))
  }, [])

  const handleSidebarResizeKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null

    if (event.key === 'ArrowLeft') nextWidth = sidebarWidth - SIDEBAR_KEYBOARD_RESIZE_STEP
    if (event.key === 'ArrowRight') nextWidth = sidebarWidth + SIDEBAR_KEYBOARD_RESIZE_STEP
    if (event.key === 'Home') nextWidth = SIDEBAR_MIN_WIDTH
    if (event.key === 'End') nextWidth = SIDEBAR_MAX_WIDTH

    if (nextWidth === null) return
    event.preventDefault()
    setAndStoreSidebarWidth(nextWidth)
  }, [setAndStoreSidebarWidth, sidebarWidth])

  React.useEffect(() => {
    if (!sidebarResizeSession) return

    const root = document.documentElement
    const previousCursor = root.style.cursor
    const previousUserSelect = root.style.userSelect
    let latestWidth = sidebarResizeSession.startWidth

    const handlePointerMove = (event: PointerEvent) => {
      latestWidth = clampSidebarWidth(
        sidebarResizeSession.startWidth + event.clientX - sidebarResizeSession.startX,
      )
      setSidebarWidth(latestWidth)
      root.style.setProperty('--youtorch-sidebar-width', `${latestWidth}px`)
    }
    const finishResize = () => {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(latestWidth))
      setSidebarResizeSession(null)
    }

    root.style.cursor = 'col-resize'
    root.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishResize, { once: true })
    window.addEventListener('pointercancel', finishResize, { once: true })

    return () => {
      root.style.cursor = previousCursor
      root.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
    }
  }, [sidebarResizeSession])

  const renderSidebarContent = React.useCallback((
    collapsed: boolean,
    onCollapsedChange: (next: boolean | ((current: boolean) => boolean)) => void = updateSidebarCollapsed,
  ) => {
    if (typeof sidebarContent === 'function') {
      return sidebarContent({
        collapsed,
        onCollapsedChange,
      })
    }
    return sidebarContent
  }, [sidebarContent, updateSidebarCollapsed])

  React.useEffect(() => {
    const handleSidebarPreference = (event: Event) => {
      const nextCollapsed = Boolean((event as CustomEvent<boolean>).detail)
      if (!nextCollapsed) {
        setSidebarPreviewOpen(false)
        setSidebarPreviewPinned(false)
        setSidebarPreviewModule(null)
      }
      setSidebarCollapsed(nextCollapsed)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) {
        const nextCollapsed = event.newValue === 'true'
        if (!nextCollapsed) {
          setSidebarPreviewOpen(false)
          setSidebarPreviewPinned(false)
          setSidebarPreviewModule(null)
        }
        setSidebarCollapsed(nextCollapsed)
      }
      if (event.key === SIDEBAR_WIDTH_STORAGE_KEY) {
        const nextWidth = clampSidebarWidth(Number(event.newValue))
        setSidebarWidth(nextWidth)
        document.documentElement.style.setProperty('--youtorch-sidebar-width', `${nextWidth}px`)
      }
    }

    window.addEventListener(SIDEBAR_COLLAPSED_EVENT, handleSidebarPreference)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, handleSidebarPreference)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return (
    <ActiveChannelProvider value={activeChannelContext}>
      <div className={cn('flex h-screen flex-col bg-sidebar', className)}>
        {showAnnouncementBar && <MemberAnnouncementBar />}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <div
            ref={desktopSidebarFrameRef}
            data-workspace-sidebar-frame
            className="relative hidden shrink-0 md:flex"
            onMouseLeave={() => {
              if (!sidebarPreviewPinned) closeSidebarPreview()
            }}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                if (!sidebarPreviewPinned) closeSidebarPreview()
              }
            }}
            style={{
              width: effectiveSidebarCollapsed
                ? SIDEBAR_RAIL_WIDTH
                : `calc(${SIDEBAR_RAIL_WIDTH}px + var(--youtorch-sidebar-width, ${sidebarWidth}px))`,
            }}
          >
            <WorkspaceIconRail
              initialProfile={bootstrappedProfile}
              accountProfileEnabled={channelsQuery.isSuccess || Boolean(accountInitialProfile)}
              onModulePreview={handleRailModulePreview}
              onModuleActivate={handleRailModuleActivate}
            />
            {sidebarPreviewVisible && sidebarPreviewModule && (
              <div
                data-sidebar-preview
                className="absolute inset-y-0 left-[76px] z-50 min-w-0 overflow-hidden border-r border-border bg-sidebar shadow-[18px_0_40px_rgba(0,0,0,0.28)]"
                style={{
                  width: `min(var(--youtorch-sidebar-width, ${sidebarWidth}px), calc(100vw - ${SIDEBAR_RAIL_WIDTH}px))`,
                }}
              >
                <React.Suspense fallback={<SidebarFallback />}>
                  <AppSidebar
                    title={sidebarTitle}
                    subtitle={sidebarSubtitle}
                    titleIcon={sidebarTitleIcon}
                    backHref={sidebarBackHref}
                    backLabel={sidebarBackLabel}
                    items={sidebarItems}
                    bottomItems={sidebarBottomItems}
                    channels={channelOptions}
                    selectedChannel={selectedChannelOption}
                    onChannelSelect={setSelectedChannelId}
                    onChannelCreated={(channel) => setSelectedChannelId(channel.id)}
                    channelLoading={channelLoading}
                    channelError={channelError}
                    previewModule={sidebarPreviewModule}
                    className="h-full w-full"
                    collapsed={false}
                    onCollapsedChange={handleSidebarPreviewCollapsedChange}
                  />
                </React.Suspense>
              </div>
            )}
            {!effectiveSidebarCollapsed && (
              <div
                className="h-full min-w-0 overflow-hidden"
                style={{ width: `var(--youtorch-sidebar-width, ${sidebarWidth}px)` }}
              >
                <React.Suspense fallback={<SidebarFallback />}>
                  {renderSidebarContent(false) ?? (
                    <AppSidebar
                      title={sidebarTitle}
                      subtitle={sidebarSubtitle}
                      titleIcon={sidebarTitleIcon}
                      backHref={sidebarBackHref}
                      backLabel={sidebarBackLabel}
                      items={sidebarItems}
                      bottomItems={sidebarBottomItems}
                      channels={channelOptions}
                      selectedChannel={selectedChannelOption}
                      onChannelSelect={setSelectedChannelId}
                      onChannelCreated={(channel) => setSelectedChannelId(channel.id)}
                      channelLoading={channelLoading}
                      channelError={channelError}
                      className="w-full"
                      collapsed={false}
                      onCollapsedChange={updateSidebarCollapsed}
                    />
                  )}
                </React.Suspense>
              </div>
            )}
            {!effectiveSidebarCollapsed && (
              <div
                role="separator"
                aria-label={tAuto('resize_sidebar_1b96244f')}
                aria-orientation="vertical"
                aria-valuemin={SIDEBAR_MIN_WIDTH}
                aria-valuemax={SIDEBAR_MAX_WIDTH}
                aria-valuenow={sidebarWidth}
                tabIndex={0}
                className="group absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none outline-none"
                onPointerDown={startSidebarResize}
                onDoubleClick={() => setAndStoreSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
                onKeyDown={handleSidebarResizeKeyDown}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/55 group-focus-visible:bg-primary" />
              </div>
            )}
          </div>

          {/* Mobile Sidebar */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[min(23rem,calc(100vw-1rem))] p-0">
              <SheetTitle className="sr-only">
                {sidebarTitle ? `${sidebarTitle} navigasyonu` : tAuto('navigasyon_menusu_1ef74756')}
              </SheetTitle>
              <div className="flex h-full">
                <WorkspaceIconRail
                  initialProfile={bootstrappedProfile}
                  accountProfileEnabled={channelsQuery.isSuccess || Boolean(accountInitialProfile)}
                />
                <div className="min-w-0 flex-1">
                  <React.Suspense fallback={<SidebarFallback />}>
                    {renderSidebarContent(false) ?? (
                      <AppSidebar
                        title={sidebarTitle}
                        subtitle={sidebarSubtitle}
                        titleIcon={sidebarTitleIcon}
                        backHref={sidebarBackHref}
                        backLabel={sidebarBackLabel}
                        items={sidebarItems}
                        bottomItems={sidebarBottomItems}
                        channels={channelOptions}
                        selectedChannel={selectedChannelOption}
                        onChannelSelect={setSelectedChannelId}
                        onChannelCreated={(channel) => setSelectedChannelId(channel.id)}
                        channelLoading={channelLoading}
                        channelError={channelError}
                        onCollapsedChange={() => setMobileOpen(false)}
                      />
                    )}
                  </React.Suspense>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* The page panel: inset from the window on desktop, rounded, with a hairline edge (no shadow). */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:my-2 md:mr-2 md:rounded-[10px] md:border md:border-border">
            {!showHeader && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label={tAuto('open_chat_menu_36eaf49e')}
                title={tAuto('open_chat_menu_36eaf49e')}
                className="fixed left-3 top-3 z-50 flex size-10 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                <Menu className="size-5" />
              </button>
            )}
            {effectiveSidebarCollapsed && !showHeader && !sidebarPreviewVisible && (
              <button
                type="button"
                onClick={() => updateSidebarCollapsed(false)}
                aria-label={tAuto('open_chat_menu_36eaf49e')}
                title={tAuto('open_chat_menu_36eaf49e')}
                className="fixed left-[calc(76px+0.5rem)] top-3 z-50 hidden size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
              >
                <SidebarToggleIcon className="size-5" />
              </button>
            )}
            {showHeader && (
              <AppHeader
                appName={appName}
                appIcon={appIcon}
                onToggleDesktopSidebar={() => updateSidebarCollapsed((current) => !current)}
                onOpenMobileSidebar={() => setMobileOpen(true)}
                sidebarCollapsed={effectiveSidebarCollapsed}
                askAiOpen={agentPanel !== 'closed'}
                onAskAi={() => {
                  setAgentPanelLoaded(true)
                  setAgentPanel((current) => (current === 'open' ? 'closed' : 'open'))
                }}
              />
            )}
            {showActionCenterAlerts && <ActionCenterAlertBar alerts={actionCenterAlerts} />}

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Page Content */}
              <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>

              {/* Optional Right Panel */}
              {rightPanel && (
                <div className="hidden lg:block border-l border-border">
                  {rightPanel}
                </div>
              )}
            </div>

            {/* The agent panel floats over the page's right side; it stays mounted once opened (its conversation too). */}
            {showHeader && agentPanelLoaded && <AgentPanel state={agentPanel} onStateChange={setAgentPanel} />}
          </div>
        </div>
        <ChannelSlotSelectionDialog
          channels={channels}
          enabled={channelsQuery.isSuccess}
          onSelectionConfirmed={(channelIds) => {
            if (channelIds[0]) setSelectedChannelId(channelIds[0])
          }}
        />
      </div>
    </ActiveChannelProvider>
  )
}

function SidebarFallback() {
  return <div className="h-full w-full bg-sidebar" />
}

function toGlobalActionCenterAlert(
  item: ActionCenterItem,
  text: { title: string; description: string; ctaLabel: string | null },
): ActionCenterAlert {
  const cta = getActionCenterSafeCta(item)

  return {
    id: item.id,
    title: text.title,
    description: text.description,
    ctaLabel: text.ctaLabel ?? undefined,
    href: cta.href,
    target: cta.target,
    rel: cta.rel,
    tone: getActionCenterTone(item),
    icon: getActionCenterIcon(item),
  }
}

function getActionCenterTone(item: ActionCenterItem): ActionCenterAlert['tone'] {
  if (item.severity === 'critical' || item.severity === 'high') return 'critical'
  if (item.severity === 'medium') return 'warning'
  if (item.kind === 'info') return 'info'
  return 'neutral'
}

function getActionCenterIcon(item: ActionCenterItem): LucideIcon {
  if (item.source_bc === 'channel' || item.category === 'setup') return Youtube
  if (item.category === 'billing') return CreditCard
  if (item.category === 'storage') return Database
  if (item.kind === 'info') return Info
  return AlertTriangle
}

function isRetryableWorkspaceError(error: unknown) {
  if (!(error instanceof AuthClientError)) return false
  if (error.status === 503 || error.status === 409) return true
  return error.code === 'CHANNEL_WORKSPACE_NOT_READY'
    || error.code === 'AUTH_CLAIMS_NOT_READY'
    || error.code === 'CONFLICT'
}

function channelStatusLabel(
  status: Channel['status'],
  tChannels: (key: string) => string,
) {
  if (status === 'setup') return tChannels('statusSetup')
  if (status === 'connected') return tChannels('statusConnected')
  if (status === 'disconnected') return tChannels('statusDisconnected')
  if (status === 'plan_paused') return tChannels('statusPaused')
  if (status === 'removing') return tChannels('statusRemoving')
  return tChannels('statusRemoved')
}

function toChannelOption(channel: Channel, statusLabel: string): ChannelOption {
  return {
    id: channel.id,
    name: channel.name,
    handle: channel.platform_channel_id
      ? formatPlatformHandle(channel.platform_channel_id)
      : statusLabel,
    initials: getInitials(channel.name),
    tone: getChannelTone(channel.id),
    status: channel.status,
    logoUrl: channel.settings.logoUrl,
  }
}

function toFallbackChannelOption(channelId: string, name: string, handle: string): ChannelOption {
  return {
    id: channelId,
    name,
    handle,
    initials: 'YT',
    tone: 'bg-[#6B7A90]',
    status: 'loading',
    logoUrl: null,
  }
}

function formatPlatformHandle(platformChannelId: string) {
  return platformChannelId.startsWith('@') ? platformChannelId : `@${platformChannelId}`
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return initials || 'YT'
}

function getChannelTone(id: string) {
  const tones = ['bg-[#ff0033]', 'bg-[#3157d5]', 'bg-[#25c7ad]', 'bg-[#6554C0]', 'bg-[#FFAB00]']
  const index = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length
  return tones[index]
}

function readStoredSidebarWidth() {
  return clampSidebarWidth(Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)))
}

function clampSidebarWidth(width: number) {
  if (!Number.isFinite(width) || width <= 0) return SIDEBAR_DEFAULT_WIDTH
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

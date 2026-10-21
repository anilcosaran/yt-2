'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChannelSwitcher, type ChannelOption } from './channel-switcher'
import { useSettingsSectionsWithDeveloper } from '@/components/settings/developer/use-developer-settings-nav'
import type { Channel } from '@/lib/channel/api'
import {
  INVITE_EARN_HIDDEN_EVENT,
  INVITE_EARN_HIDDEN_STORAGE_KEY,
} from './layout-preferences'
import {
  ACCOUNT_PLAN_SYNC_UPDATED_EVENT,
  ACCOUNT_PROFILE_QUERY_KEY,
  ACCOUNT_PROFILE_UPDATED_EVENT,
  applyAccountPlanSync,
  createBrowserAccountClient,
  readAccountPlanSyncState,
  resetBrowserAccountClientCaches,
  type AccountPlanSyncState,
  type AccountProfileTenant,
} from '@/components/account/browser-account-client'
import { createBrowserAuthGatewayClient } from '@/lib/auth/browser-gateway-client'
import { createFirebaseAuthDriver } from '@/lib/auth/firebase-client'
import { LibrarySidebarNav } from '@/components/library/library-sidebar-nav'
import { clearBrowserPrincipalState } from '@/lib/auth/browser-principal-storage'
import {
  BILLING_BALANCE_UPDATED_EVENT,
  BILLING_QUOTA_USAGE_QUERY_KEY,
  getBillingQuotaUsage,
  type BillingQuotaUsage,
} from '@/lib/billing/api'
import { useTheme } from 'next-themes'
import {
  Bell,
  Bot,
  Captions,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Clapperboard,
  Coins,
  Crop,
  Droplets,
  Download,
  ExternalLink,
  Flame,
  FileText,
  FileVideo,
  Frame,
  Gauge,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  Mic,
  Mic2,
  Plus,
  ReceiptText,
  MoreHorizontal,
  ArrowLeft,
  Inbox,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  Folder,
  Lightbulb,
  ListChecks,
  SlidersHorizontal,
  Settings as SettingsLucide,
  ShieldCheck,
  Sparkles,
  Stamp,
  Shuffle,
  Sun,
  Type,
  UserRound,
  UploadCloud,
  Upload,
  Video,
  Volume2,
  WalletCards,
  Wand2,
  Waypoints,
  Workflow,
  MonitorPlay,
  Brain,
  Plug,
  WandSparkles,
  Workflow as WorkflowIcon,
  Wrench,
  Zap,
} from 'lucide-react'
import type { NavItem } from '@/lib/types'
import {
  DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
  getCachedDiscoveryToolsCatalog,
  getDiscoveryToolsCatalog,
  type DiscoveryToolCatalogItem,
  type DiscoveryToolsCatalog,
} from '@/lib/discovery/api'
import {
  listWorkflowNodeFavoriteTypes,
} from '@/lib/workflows/node-favorites'
import { UiText } from '@/components/i18n/ui-text'
import { listSparkProjects } from '@/lib/spark/api'
import { openWorkTab, sparkProjectWorkHref } from '@/lib/work-tabs'
import { useFormatter, useTranslations } from 'next-intl'
import { SidebarToggleIcon } from './sidebar-toggle-icon'

export type SidebarNavItem = Omit<NavItem, 'children'> & {
  type?: 'item' | 'section'
  onSelect?: () => void
  disabled?: boolean
  iconSurface?: boolean
  children?: SidebarNavItem[]
}

export type SidebarPreviewModule = 'overview' | 'brand' | 'tools' | 'library'

interface AppSidebarProps {
  title?: string
  subtitle?: string
  titleIcon?: React.ReactNode
  backHref?: string
  backLabel?: string
  items: SidebarNavItem[]
  bottomItems?: SidebarNavItem[]
  channels?: ChannelOption[]
  selectedChannel?: ChannelOption | null
  onChannelSelect?: (channelId: string) => void
  onChannelCreated?: (channel: Channel) => void
  channelLoading?: boolean
  channelError?: string | null
  hideChannelSwitcher?: boolean
  previewModule?: SidebarPreviewModule
  className?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

type SidebarToolOption = {
  id: string
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconBackground: string
  iconForeground: string
  iconShape: string
  iconCss: string
  iconAssetUrl: string | null
  favorite: boolean
  sortOrder: number
  status: DiscoveryToolCatalogItem['status']
}

export function AppSidebar({
  title,
  subtitle,
  titleIcon,
  backHref,
  backLabel,
  items,
  bottomItems,
  channels,
  selectedChannel,
  onChannelSelect,
  onChannelCreated,
  channelLoading = false,
  channelError = null,
  hideChannelSwitcher = false,
  previewModule,
  className,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const tAuto = useTranslations('Auto')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const currentPath = previewModule === 'tools'
    ? '/tools'
    : queryString ? `${pathname}?${queryString}` : pathname
  const showWorkspaceSwitcher = !backHref && !title
  const isToolsMode = showWorkspaceSwitcher && (previewModule === 'tools' || (!previewModule && pathname.startsWith('/tools')))
  const isBrandMode = showWorkspaceSwitcher && (previewModule === 'brand' || (!previewModule && pathname.startsWith('/brand')))
  const isSettingsMode = showWorkspaceSwitcher && !previewModule && pathname.startsWith('/settings')
  const isLibraryMode = showWorkspaceSwitcher && (previewModule === 'library' || (!previewModule && pathname.startsWith('/library')))
  const settingsActiveSection = pathname.startsWith('/settings/transactions')
    ? 'transactions'
    : pathname.startsWith('/settings/top-up')
      ? 'billing'
      : searchParams.get('section') ?? 'general'

  if (isSettingsMode) {
    return (
      <TooltipProvider delayDuration={0}>
        <aside className={cn('workspace-sidebar flex h-full min-h-0 w-full flex-col bg-sidebar antialiased', className)}>
          <SettingsSidebarNav
            active={settingsActiveSection}
            onCollapse={() => onCollapsedChange?.(true)}
          />
        </aside>
      </TooltipProvider>
    )
  }

  if (isLibraryMode) {
    return (
      <TooltipProvider delayDuration={0}>
        <aside className={cn('workspace-sidebar flex h-full min-h-0 w-full flex-col bg-sidebar antialiased', className)}>
          <LibrarySidebarNav
            channelName={selectedChannel?.name ?? tAuto('test_kanal_58fe45ee')}
            onCollapse={() => onCollapsedChange?.(true)}
          />
        </aside>
      </TooltipProvider>
    )
  }

  if (isBrandMode) {
    return (
      <TooltipProvider delayDuration={0}>
        <aside className={cn('workspace-sidebar flex h-full min-h-0 w-full flex-col bg-sidebar antialiased', className)}>
          <BrandSidebarNav
            active={previewModule === 'brand' ? 'kits' : searchParams.get('section') ?? 'kits'}
            channelName={selectedChannel?.name ?? tAuto('test_kanal_58fe45ee')}
            kitId={previewModule === 'brand' ? undefined : searchParams.get('kit') ?? undefined}
            onCollapse={() => onCollapsedChange?.(true)}
          />
        </aside>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'workspace-sidebar flex h-full min-h-0 w-full flex-col bg-sidebar antialiased',
        className,
      )}>
        {/* Header */}
        {(backHref || title) && (
          <div className={cn(
            'relative flex shrink-0 flex-col border-b border-sidebar-border px-3 py-3',
            collapsed && 'items-center px-2'
          )}>
            {backHref && !collapsed && (
              <Link
                href={backHref}
                className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{backLabel || tAuto('geri_4928cfc9')}</span>
              </Link>
            )}
            {title && (
              <div className={cn('flex items-center gap-2', !collapsed && onCollapsedChange && 'pr-10', collapsed && 'justify-center')}>
                {titleIcon}
                {!collapsed && (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-sidebar-foreground">{title}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground">{subtitle}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {!collapsed && onCollapsedChange && (
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={tAuto('collapse_sidebar_9e687628')}
              >
              <SidebarToggleIcon className="size-[18px]" />
              </button>
            )}
          </div>
        )}

        {showWorkspaceSwitcher && !isToolsMode && (
          <SidebarTopContext
            collapsed={collapsed}
            channels={channels}
            selectedChannel={selectedChannel}
            onChannelSelect={onChannelSelect}
            onChannelCreated={onChannelCreated}
            channelLoading={channelLoading}
            channelError={channelError}
            hideChannelSwitcher={hideChannelSwitcher}
            onCollapse={() => onCollapsedChange?.(true)}
          />
        )}

        {/* Navigation */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3',
            showWorkspaceSwitcher ? 'pt-3' : 'py-2',
            isToolsMode
              ? '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'hover-scrollbar',
          )}
        >
          <nav className="flex flex-col gap-0">
            {isToolsMode ? (
              <SidebarToolsNav
                currentPath={currentPath}
                collapsed={collapsed}
                onCollapse={() => onCollapsedChange?.(true)}
              />
            ) : (
              <SidebarNavigationItems
                items={items}
                currentPath={currentPath}
                collapsed={collapsed}
                recentWorkChannelId={showWorkspaceSwitcher ? selectedChannel?.id ?? null : undefined}
              />
            )}
          </nav>
        </div>

        {/* Bottom Items */}
        {bottomItems && bottomItems.length > 0 && (
          <div className="shrink-0 border-t border-sidebar-border px-2.5 py-2">
            <nav className="mb-2 flex flex-col gap-0.5">
              {bottomItems.map((item) => (
                <NavItemComponent
                  key={item.id}
                  item={item}
                  currentPath={currentPath}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>
        )}

      </aside>
    </TooltipProvider>
  )
}

const settingsSidebarSections = [
  {
    labelKey: 'workspace',
    items: [
      { id: 'general', labelKey: 'general', href: '/settings?section=general', icon: UserRound },
      { id: 'preferences', labelKey: 'preferences', href: '/settings?section=preferences', icon: SlidersHorizontal },
      { id: 'approvals', labelKey: 'approvals', href: '/settings?section=approvals', icon: ListChecks },
      { id: 'notifications', labelKey: 'notifications', href: '/settings?section=notifications', icon: Bell },
      { id: 'security', labelKey: 'loginSecurity', href: '/settings?section=security', icon: ShieldCheck },
    ],
  },
  {
    labelKey: 'billing',
    items: [
      { id: 'billing', labelKey: 'billing', href: '/settings?section=billing', icon: WalletCards },
      { id: 'usage', labelKey: 'usage', href: '/settings?section=usage', icon: Coins },
      { id: 'limits', labelKey: 'limits', href: '/settings?section=limits', icon: Gauge },
      { id: 'transactions', labelKey: 'transactions', href: '/settings/transactions', icon: ReceiptText },
    ],
  },
] as const

function SettingsSidebarNav({ active, onCollapse }: { active: string; onCollapse?: () => void }) {
  const tAuto = useTranslations('Auto')
  const tNav = useTranslations('Navigation')
  const sections = useSettingsSectionsWithDeveloper(settingsSidebarSections)
  return (
    <div className="hg-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border/70 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-sidebar-accent text-foreground">
            <SettingsLucide className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] text-foreground"><UiText id="settings_c7f73bb5" /></p>
            <p className="truncate text-[11px] text-muted-foreground"><UiText id="account_workspace_111697b5" /></p>
          </div>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={tAuto('collapse_sidebar_9e687628')}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SidebarToggleIcon className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-5 px-3 py-3" aria-label={tAuto('settings_sections_2e7109bd')}>
        {sections.map((section) => (
          <div key={section.labelKey}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tNav(section.labelKey)}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const selected = active === item.id
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={selected ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      selected
                        ? 'bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <span className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      selected
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border bg-background/40 text-muted-foreground group-hover:text-foreground',
                    )}>
                      <item.icon className="size-[17px]" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{tNav(item.labelKey)}</span>
                    {selected && <ChevronRight className="size-4 shrink-0 text-primary" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

const brandSidebarSections = [
  {
    titleKey: 'brand',
    items: [
      { id: 'kits', labelKey: 'brandKits', descriptionKey: 'createDefaultEdit', icon: LayoutGrid },
    ],
  },
  {
    titleKey: 'talent',
    items: [
      { id: 'avatars', labelKey: 'avatars', descriptionKey: 'avatarsDescription', icon: UserRound },
      { id: 'voices', labelKey: 'voices', descriptionKey: 'voicesDescription', icon: Mic2 },
    ],
  },
  {
    titleKey: 'identity',
    items: [
      { id: 'colors', labelKey: 'colors', descriptionKey: 'interactiveColorPicker', icon: Droplets },
      { id: 'fonts', labelKey: 'fonts', descriptionKey: 'titleBodyType', icon: Type },
      { id: 'captions', labelKey: 'captions', descriptionKey: 'styleBrandColors', icon: Captions },
      { id: 'logos', labelKey: 'logos', descriptionKey: 'marksAssets', icon: ImageIcon },
      { id: 'watermark', labelKey: 'watermark', descriptionKey: 'assetPlacementOpacity', icon: Stamp },
    ],
  },
  // P06-01: the former local-only "Effects & transitions" item returns with the server Video style (P06-36).
] as const

function BrandSidebarNav({ active, channelName, kitId, onCollapse }: { active: string; channelName: string; kitId?: string; onCollapse?: () => void }) {
  const tAuto = useTranslations('Auto')
  const tNav = useTranslations('Navigation')
  const visibleSections = kitId
    ? brandSidebarSections
    : brandSidebarSections.filter((section) => section.titleKey === 'brand' || section.titleKey === 'talent')
  return (
    <div className="hg-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-sidebar-accent text-foreground">
            <Palette className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{kitId
              ? tAuto('brand_kit_editor_7cd06cbe')
              : active === 'avatars'
                ? tNav('avatars')
                : active === 'voices'
                  ? tNav('voices')
                  : tAuto('brand_kits_f149e70b')}</p>
            <p className="text-[11px] text-muted-foreground">{channelName}</p>
          </div>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={tAuto('collapse_sidebar_9e687628')}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SidebarToggleIcon className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-5 px-3 py-3">
        {visibleSections.map((section) => (
          <div key={section.titleKey}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tNav(section.titleKey)}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const selected = active === item.id
                return (
                  <Link
                    key={item.id}
                    href={item.id === 'kits'
                      ? '/brand?section=kits'
                      : `/brand?section=${item.id}${kitId ? `&kit=${encodeURIComponent(kitId)}` : ''}`
                    }
                    aria-current={selected ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      selected ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      selected
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border bg-background/40 text-muted-foreground',
                    )}>
                      <item.icon className="size-[17px]" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block truncate text-sm', selected ? 'font-medium text-foreground' : 'text-sidebar-foreground')}>
                        {tNav(item.labelKey)}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{tNav(item.descriptionKey)}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

function SidebarTopContext({
  collapsed,
  channels,
  selectedChannel,
  onChannelSelect,
  onChannelCreated,
  channelLoading,
  channelError,
  hideChannelSwitcher,
  onCollapse,
}: {
  collapsed: boolean
  channels?: ChannelOption[]
  selectedChannel?: ChannelOption | null
  onChannelSelect?: (channelId: string) => void
  onChannelCreated?: (channel: Channel) => void
  channelLoading: boolean
  channelError: string | null
  hideChannelSwitcher: boolean
  onCollapse?: () => void
}) {
  const tAuto = useTranslations('Auto')
  const hasChannelSwitcher = Boolean(!hideChannelSwitcher && channels && onChannelSelect)

  return (
    <div className={cn('shrink-0 px-3 pt-3', collapsed && 'px-1.5')}>
      <div className={cn('flex items-center gap-1', collapsed && 'justify-center')}>
        {hasChannelSwitcher && (
          <div className="min-w-0 flex-1">
          <ChannelSwitcher
            channels={channels!}
            selectedChannel={selectedChannel}
            onSelect={onChannelSelect!}
            onCreated={onChannelCreated}
            loading={channelLoading}
            error={channelError}
            collapsed={collapsed}
            avatarClassName="size-7"
            triggerClassName="h-auto gap-2 rounded-lg px-2 py-1.5"
          />
          </div>
        )}
        {!collapsed && (
          <>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={tAuto('collapse_sidebar_9e687628')}
              >
                <SidebarToggleIcon className="size-[18px]" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SidebarToolsNav({
  currentPath,
  collapsed,
  onCollapse,
}: {
  currentPath: string
  collapsed: boolean
  onCollapse?: () => void
}) {
  const tAuto = useTranslations('Auto')
  const queryClient = useQueryClient()
  const [hydrated, setHydrated] = React.useState(false)
  const [favoriteNodeTypes, setFavoriteNodeTypes] = React.useState<Set<string>>(
    () => new Set(),
  )
  const catalogQuery = useQuery({
    queryKey: DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => getDiscoveryToolsCatalog({ signal }),
    staleTime: DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  React.useEffect(() => {
    setHydrated(true)
    const cached = getCachedDiscoveryToolsCatalog(Date.now(), { allowStale: true })
    if (!cached) return
    queryClient.setQueryData(DISCOVERY_TOOLS_CATALOG_QUERY_KEY, cached.data, { updatedAt: cached.updatedAt })
  }, [queryClient])

  React.useEffect(() => {
    const controller = new AbortController()
    listWorkflowNodeFavoriteTypes({ signal: controller.signal })
      .then((nodeTypes) => setFavoriteNodeTypes(new Set(nodeTypes)))
      .catch((error: unknown) => {
        if (isAbortLikeError(error)) return
      })
    return () => controller.abort()
  }, [])

  const tools = React.useMemo(
    () => getSidebarToolOptions(catalogQuery.data, favoriteNodeTypes),
    [catalogQuery.data, favoriteNodeTypes],
  )
  const showLoading = !hydrated || (catalogQuery.isLoading && tools.length === 0)
  const browseActive = currentPath === '/tools'

  return (
    <>
      {!collapsed && (
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg text-foreground"><UiText id="tools_4fa8cc86" /></span>
            {showLoading ? (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="flex min-w-6 items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {tools.length}
              </span>
            )}
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label={tAuto('collapse_sidebar_9e687628')}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <SidebarToggleIcon className="size-[18px]" />
            </button>
          )}
        </div>
      )}
      <Link
        href="/tools"
        aria-current={browseActive ? 'page' : undefined}
        className={cn(
          'mb-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          browseActive
            ? 'bg-accent text-foreground ring-1 ring-border'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
          <LayoutGrid className="size-[18px]" />
        </span>
        {!collapsed && <span className="flex-1 text-left"><UiText id="browse_all_3d5d84ec" /></span>}
      </Link>
      {showLoading ? <SidebarToolsLoading collapsed={collapsed} /> : null}
      {!showLoading && tools.length === 0 ? (
        <SidebarToolsEmptyState collapsed={collapsed} onRetry={() => catalogQuery.refetch()} />
      ) : null}
      {!showLoading ? tools.map((tool) => (
        <SidebarToolNavItem
          key={tool.id}
          tool={tool}
          active={isSidebarToolActive(tool, currentPath)}
          collapsed={collapsed}
        />
      )) : null}
    </>
  )
}

function SidebarToolNavItem({
  tool,
  active,
  collapsed,
}: {
  tool: SidebarToolOption
  active: boolean
  collapsed: boolean
}) {
  const tAuto = useTranslations('Auto')
  const Icon = tool.icon
  const item = (
    <Link href={tool.href} className="block">
      <div
        className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
        active
            ? 'bg-accent text-foreground ring-1 ring-border'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          collapsed && 'justify-center gap-0 px-0',
        )}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-105',
            getSidebarToolGradientClass(tool.id),
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{tool.label}</span>
            {tool.status === 'maintenance' ? (
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title={tAuto('maintenance_94de303b')} />
            ) : null}
          </span>
        )}
      </div>
    </Link>
  )

  if (!collapsed) return item

  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="right" className="font-normal">
        {tool.label}
      </TooltipContent>
    </Tooltip>
  )
}

function getSidebarToolGradientClass(toolId: string) {
  const id = toolId.trim().toLowerCase().replace(/_/g, '-')
  if (id.includes('media-transform') || id.includes('transform')) return 'from-sky-500 to-blue-600'
  if (id.includes('video-gif') || id.includes('gif')) return 'from-emerald-500 to-green-600'
  if (id.includes('frame')) return 'from-rose-500 to-red-600'
  if (id.includes('magic-clip') || id.includes('clip')) return 'from-amber-500 to-yellow-600'
  if (id.includes('transcript')) return 'from-cyan-500 to-teal-600'
  if (id.includes('caption')) return 'from-violet-500 to-purple-600'
  if (id.includes('text-to-speech') || id === 'tts' || id.includes('speech-generate')) return 'from-teal-500 to-emerald-600'
  if (id.includes('voice-clone')) return 'from-sky-500 to-blue-600'
  if (id.includes('brand-overlay') || id.includes('overlay')) return 'from-fuchsia-500 to-pink-600'
  if (id.includes('downloader') || id.includes('download')) return 'from-emerald-500 to-green-600'
  if (id.includes('prompt-enhance') || id.includes('enhance')) return 'from-amber-500 to-orange-600'
  if (id.includes('prompt-generate')) return 'from-violet-500 to-purple-600'
  if (id.includes('research')) return 'from-cyan-500 to-teal-600'
  if (id.includes('upload')) return 'from-teal-500 to-emerald-600'
  if (id.includes('image')) return 'from-fuchsia-500 to-pink-600'
  return 'from-amber-500 to-orange-600'
}

function SidebarToolsSectionLabel({
  icon: Icon,
  label,
  count,
  collapsed,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count: number
  collapsed: boolean
}) {
  if (collapsed) return null

  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[11px] font-semibold uppercase leading-4 tracking-normal text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="tabular-nums">{count}</span>
    </div>
  )
}

function SidebarToolsLoading({ collapsed }: { collapsed: boolean }) {
  const tAuto = useTranslations('Auto')
  const rows = Array.from({ length: collapsed ? 4 : 6 })

  return (
    <div className="space-y-1 px-0.5 pt-1" aria-busy="true" aria-label={tAuto('loading_tools_3534999e')}>
      {rows.map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex h-10 items-center gap-2.5 rounded-[6px] px-2',
            collapsed && 'justify-center px-0',
          )}
        >
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          {!collapsed ? (
            <Skeleton className="block h-3.5 w-28" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function SidebarToolsEmptyState({
  collapsed,
  onRetry,
}: {
  collapsed: boolean
  onRetry: () => void
}) {
  const tAuto = useTranslations('Auto')
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={tAuto('refresh_tools_311c385e')}
            onClick={onRetry}
            className="mt-1 flex h-10 w-full items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
          >
            <Wrench className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-normal">
          <UiText id="no_tools_added_a751bef5" /></TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="mx-1 mt-2 rounded-[9px] border border-dashed border-sidebar-border px-3 py-3 text-sm text-muted-foreground">
      <div className="flex items-start gap-2.5">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sidebar-foreground"><UiText id="no_tools_added_a751bef5" /></p>
          <p className="mt-1 text-xs leading-5"><UiText id="discovery_catalog_has_no_active_tools_dc19bb26" /></p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <UiText id="refresh_56e3badc" /></button>
        </div>
      </div>
    </div>
  )
}

function getSidebarToolOptions(
  catalog: DiscoveryToolsCatalog | undefined,
  favoriteNodeTypes: Set<string>,
): SidebarToolOption[] {
  if (!catalog) return []

  const seen = new Set<string>()
  return catalog.tools
    .filter((tool) => tool.status !== 'disabled')
    .map((tool) => {
      const id = tool.tool_id.trim()
      const nodeType = tool.execution.node_type.trim()
      const iconBackground = getSidebarCatalogIconBackground(tool)
      const fallbackLabel = cleanSidebarCatalogToken(tool.short_title) ?? cleanSidebarCatalogToken(tool.title) ?? formatSidebarToolId(id)
      return {
        id,
        label: getNewThemeSidebarToolLabel(id, fallbackLabel),
        description: formatSidebarToolDescription(tool),
        href: getSidebarToolHref(id),
        icon: getSidebarCatalogIcon(tool),
        iconBackground,
        iconForeground: getSidebarCatalogIconForeground(tool, iconBackground),
        iconShape: 'auto',
        iconCss: '',
        iconAssetUrl: null,
        favorite: nodeType ? favoriteNodeTypes.has(nodeType) : false,
        sortOrder: tool.ui.sort_order,
        status: tool.status,
      }
    })
    .filter((tool) => {
      if (!tool.id || seen.has(tool.id)) return false
      seen.add(tool.id)
      return true
    })
    .sort((left, right) => {
      const sourceOrderDelta = getNewThemeSidebarToolOrder(left.id) - getNewThemeSidebarToolOrder(right.id)
      if (sourceOrderDelta !== 0) return sourceOrderDelta
      const orderDelta = left.sortOrder - right.sortOrder
      if (orderDelta !== 0) return orderDelta
      return left.label.localeCompare(right.label)
    })
}

function getNewThemeSidebarToolLabel(toolId: string, fallback: string) {
  const id = toolId.trim().toLowerCase().replace(/_/g, '-')
  if (id.includes('media-transform') || id.includes('transform')) return 'Media Transform'
  if (id.includes('video-gif') || id.includes('gif')) return 'Video to GIF'
  if (id.includes('frame')) return 'Frames'
  if (id.includes('viral-clip') || id.includes('magic-clip')) return 'Viral Clips'
  if (id.includes('transcript')) return 'Transcript'
  if (id.includes('caption')) return 'Caption'
  if (id.includes('text-to-speech') || id === 'tts' || id.includes('speech-generate')) return 'Text to Speech'
  if (id.includes('voice-clone')) return 'Voice Clone'
  if (id.includes('brand-overlay') || id.includes('overlay')) return 'Brand Overlay'
  if (id.includes('media-downloader') || id.includes('downloader')) return 'Media Downloader'
  if (id.includes('prompt-enhance')) return 'Prompt Enhance'
  if (id.includes('prompt-generate')) return 'Prompt Generate'
  if (id.includes('research')) return 'Research Agent'
  if (id.includes('upload')) return 'Upload'
  if (id.includes('image')) return 'Image'
  if (id.includes('video')) return 'Video'
  return fallback
}

function getNewThemeSidebarToolOrder(toolId: string) {
  const label = getNewThemeSidebarToolLabel(toolId, '').toLowerCase()
  const order = [
    'image',
    'video',
    'media transform',
    'video to gif',
    'frames',
    'viral clips',
    'transcript',
    'caption',
    'text to speech',
    'voice clone',
    'brand overlay',
    'media downloader',
    'prompt enhance',
    'prompt generate',
    'research agent',
    'upload',
  ]
  const index = order.indexOf(label)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function getSidebarToolHref(toolId: string) {
  const params = new URLSearchParams({ tool: toolId })
  return `/tools?${params.toString()}`
}

function isSidebarToolActive(tool: SidebarToolOption, currentPath: string) {
  const [currentPathname, currentQuery = ''] = currentPath.split('?')
  if (currentPathname !== '/tools') return false
  return new URLSearchParams(currentQuery).get('tool') === tool.id
}

function SidebarToolGlyph({
  shape,
  Icon,
  className,
}: {
  shape?: string
  Icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const normalized = shape?.trim().toLowerCase()
  if (!normalized || normalized === 'auto' || normalized === 'lucide') {
    return <Icon className={className} />
  }

  if (normalized === 'media-transform') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[10%] top-[18%] h-[48%] w-[58%] rounded-[3px] border-[2px] border-current/95" />
        <span className="absolute bottom-[14%] right-[8%] h-[48%] w-[58%] rounded-[3px] border-[2px] border-current/70" />
        <span className="absolute left-[42%] top-[42%] h-[16%] w-[16%] rounded-full bg-current" />
      </span>
    )
  }

  if (normalized === 'captions') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute inset-x-[10%] bottom-[12%] h-[56%] rounded-[4px] border-[2px] border-current/80" />
        <span className="absolute left-[20%] top-[42%] h-[10%] w-[60%] rounded-full bg-current" />
        <span className="absolute left-[20%] top-[62%] h-[10%] w-[42%] rounded-full bg-current/80" />
      </span>
    )
  }

  if (normalized === 'motion') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[38%] top-[9%] h-[18%] w-[18%] rounded-full bg-current" />
        <span className="absolute left-[42%] top-[29%] h-[30%] w-[13%] rotate-[-12deg] rounded-full bg-current" />
        <span className="absolute left-[22%] top-[44%] h-[12%] w-[34%] rotate-[-28deg] rounded-full bg-current/85" />
        <span className="absolute left-[48%] top-[55%] h-[12%] w-[34%] rotate-[42deg] rounded-full bg-current/85" />
        <span className="absolute bottom-[12%] left-[20%] h-[12%] w-[30%] rotate-[38deg] rounded-full bg-current" />
      </span>
    )
  }

  if (normalized === 'cube') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[18%] top-[28%] h-[44%] w-[44%] rotate-45 rounded-[3px] border-[2px] border-current/90" />
        <span className="absolute left-[40%] top-[18%] h-[44%] w-[44%] rotate-45 rounded-[3px] border-[2px] border-current/60" />
        <span className="absolute left-[40%] top-[40%] h-[28%] w-[28%] rotate-45 bg-current/28" />
      </span>
    )
  }

  if (normalized === 'spark') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[44%] top-[8%] h-[84%] w-[12%] rounded-full bg-current" />
        <span className="absolute left-[8%] top-[44%] h-[12%] w-[84%] rounded-full bg-current" />
        <span className="absolute left-[20%] top-[20%] h-[60%] w-[12%] rotate-45 rounded-full bg-current/70" />
        <span className="absolute right-[20%] top-[20%] h-[60%] w-[12%] -rotate-45 rounded-full bg-current/70" />
      </span>
    )
  }

  return <Icon className={className} />
}

function getSidebarCatalogIcon(discoveryTool: DiscoveryToolCatalogItem): React.ComponentType<{ className?: string }> {
  const token = `${discoveryTool.ui.icon} ${discoveryTool.tool_id} ${discoveryTool.title} ${discoveryTool.model_kind} ${discoveryTool.category}`.toLowerCase()
  if (token.includes('magic') || token.includes('clip')) return Clapperboard
  if (token.includes('gif')) return FileVideo
  if (token.includes('frame')) return Frame
  if (token.includes('download')) return Download
  if (token.includes('brand') || token.includes('overlay')) return Stamp
  if (token.includes('caption')) return Captions
  if (token.includes('transcript') || token.includes('transcribe')) return FileText
  if (token.includes('voice clone')) return Mic
  if (token.includes('speech') || token.includes('tts')) return Volume2
  if (token.includes('research') || token.includes('agent')) return Bot
  if (token.includes('prompt generate')) return Sparkles
  if (token.includes('prompt') || token.includes('enhance')) return Wand2
  if (token.includes('transform')) return Shuffle
  if (token.includes('upload')) return Upload
  if (token.includes('image')) return ImageIcon
  if (token.includes('video') || token.includes('clapper')) return Video
  if (token.includes('crop') || token.includes('transform')) return Crop
  if (token.includes('workflow') || token.includes('flow')) return WorkflowIcon
  if (token.includes('text') || token.includes('prompt')) return Type
  if (token.includes('spark') || token.includes('enhance') || token.includes('magic')) return Sparkles
  if (token.includes('voice') || token.includes('audio') || token.includes('mic')) return Mic2
  if (token.includes('avatar')) return UserRound
  if (token.includes('viral') || token.includes('short')) return Flame
  if (token.includes('mockup')) return LayoutGrid
  if (token.includes('agent') || token.includes('bot')) return Bot
  return WandSparkles
}

function getSidebarCatalogIconBackground(discoveryTool: DiscoveryToolCatalogItem) {
  const token = `${discoveryTool.ui.icon} ${discoveryTool.tool_id} ${discoveryTool.title} ${discoveryTool.category} ${discoveryTool.model_kind}`.toLowerCase()
  if (token.includes('magic') || token.includes('clip')) return '#F59E0B'
  if (token.includes('gif') || token.includes('download')) return '#10B981'
  if (token.includes('frame')) return '#F43F5E'
  if (token.includes('caption')) return '#8B5CF6'
  if (token.includes('transform') || token.includes('crop')) return '#0EA5E9'
  if (token.includes('voice clone')) return '#0EA5E9'
  if (token.includes('voice') || token.includes('speech') || token.includes('tts')) return '#14B8A6'
  if (token.includes('transcript') || token.includes('transcribe') || token.includes('research')) return '#06B6D4'
  if (token.includes('prompt enhance')) return '#F59E0B'
  if (token.includes('prompt') || token.includes('brand')) return '#8B5CF6'
  if (token.includes('upload')) return '#14B8A6'
  if (token.includes('image')) return '#D946EF'
  if (token.includes('video')) return '#F59E0B'

  const accent = cleanSidebarCatalogToken(discoveryTool.ui.accent)?.toLowerCase()
  const hexAccent = normalizeSidebarHexColor(accent)
  if (hexAccent) return hexAccent
  if (accent === 'fuchsia') return '#D946EF'
  if (accent === 'emerald') return '#10B981'
  if (accent === 'amber') return '#F59E0B'
  if (accent === 'info') return '#00B8D9'
  if (accent === 'warning') return '#F59E0B'
  if (accent === 'destructive') return '#EF4444'

  if (token.includes('motion')) return '#C6FF00'
  if (token.includes('3d') || token.includes('three')) return '#9AA3AF'
  if (token.includes('caption')) return '#7C3AED'
  if (token.includes('transform') || token.includes('crop')) return '#168CFF'
  if (token.includes('render')) return '#4F7DFF'
  if (token.includes('image')) return '#22BDF2'
  if (token.includes('transcript') || token.includes('transcribe')) return '#252C3A'
  if (token.includes('voice') || token.includes('audio') || token.includes('mic')) return '#252C3A'
  if (token.includes('flow') || token.includes('agent') || token.includes('prompt')) return '#FFA70B'
  if (token.includes('video') || token.includes('clapper')) return '#FFB31A'
  return '#6E5BFF'
}

function getSidebarCatalogIconForeground(discoveryTool: DiscoveryToolCatalogItem, background: string) {
  const rawForeground = typeof discoveryTool.ui.icon_foreground === 'string'
    ? discoveryTool.ui.icon_foreground
    : undefined
  const configured = normalizeSidebarHexColor(rawForeground)
  if (configured) return configured
  const rgb = hexToRgb(background)
  if (!rgb) return '#ffffff'
  return getRelativeLuminance(rgb) > 0.58 ? '#17130A' : '#ffffff'
}

function getSidebarIconSurfaceStyle(
  baseColor: string,
  foregroundColor: string,
  override?: React.CSSProperties,
): React.CSSProperties {
  const base = hexToRgb(baseColor) ?? { r: 91, g: 140, b: 255 }
  const deep = mixRgb(base, { r: 0, g: 0, b: 0 }, 0.22)

  return {
    background: `linear-gradient(135deg, ${rgbCss(base)} 0%, ${rgbCss(deep)} 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.28)',
    color: foregroundColor,
    ...override,
  }
}

function parseSidebarIconCss(value: string | null | undefined): React.CSSProperties | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined

  const allowedProperties: Record<string, keyof React.CSSProperties> = {
    background: 'background',
    'background-color': 'backgroundColor',
    'border-radius': 'borderRadius',
    border: 'border',
    'box-shadow': 'boxShadow',
    color: 'color',
  }
  const style: React.CSSProperties = {}

  for (const declaration of normalized.split(';')) {
    const [rawKey, ...rawValue] = declaration.split(':')
    const key = rawKey?.trim().toLowerCase()
    const cssKey = key ? allowedProperties[key] : undefined
    if (!cssKey) continue

    const cssValue = rawValue.join(':').trim()
    if (!cssValue || cssValue.length > 220 || /url\s*\(|expression\s*\(|javascript:|[<>{}]/i.test(cssValue)) continue
    const target = style as Record<string, string>
    target[cssKey] = cssValue
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function formatSidebarToolDescription(tool: DiscoveryToolCatalogItem) {
  const category = cleanSidebarCatalogToken(tool.category) ?? formatSidebarModelKind(tool.model_kind)
  const modelCount = tool.models.length
  if (modelCount > 0) return `${category} / ${modelCount} model${modelCount === 1 ? '' : 's'}`
  return `${category} / ${formatSidebarModelKind(tool.model_kind)}`
}

function formatSidebarModelKind(modelKind: DiscoveryToolCatalogItem['model_kind']) {
  if (modelKind === 'voice') return 'Audio'
  if (modelKind === 'agent') return 'Flow'
  return modelKind.slice(0, 1).toUpperCase() + modelKind.slice(1)
}

function cleanSidebarCatalogToken(value: string | undefined | null) {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === 'catalog') return undefined
  return normalized
}

function formatSidebarToolId(toolId: string) {
  return toolId
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function normalizeSidebarCatalogAssetUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return ''
  if (normalized.startsWith('/')) return normalized
  if (/^https:\/\/[^<>"'\s]+$/i.test(normalized)) return normalized
  if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[^<>"'\s]*$/i.test(normalized)) return normalized
  return ''
}

function normalizeSidebarHexColor(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : undefined
}

function hexToRgb(value: string | null | undefined) {
  const normalized = normalizeSidebarHexColor(value)
  if (!normalized) return null
  const int = Number.parseInt(normalized.slice(1), 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function mixRgb(
  color: { r: number; g: number; b: number },
  mix: { r: number; g: number; b: number },
  amount: number,
) {
  const ratio = clampNumber(amount, 0, 1)
  return {
    r: Math.round(color.r + (mix.r - color.r) * ratio),
    g: Math.round(color.g + (mix.g - color.g) * ratio),
    b: Math.round(color.b + (mix.b - color.b) * ratio),
  }
}

function rgbCss(color: { r: number; g: number; b: number }, alpha?: number) {
  if (typeof alpha === 'number') {
    return `rgb(${color.r} ${color.g} ${color.b} / ${clampNumber(alpha, 0, 1)})`
  }
  return `rgb(${color.r} ${color.g} ${color.b})`
}

function getRelativeLuminance(color: { r: number; g: number; b: number }) {
  const toLinear = (channel: number) => {
    const normalized = clampNumber(channel, 0, 255) / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (0.2126 * toLinear(color.r)) + (0.7152 * toLinear(color.g)) + (0.0722 * toLinear(color.b))
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function isAbortLikeError(error: unknown) {
  return (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
}

function useSidebarCreditBalance(enabled: boolean) {
  const queryClient = useQueryClient()
  const quotaUsageQuery = useQuery({
    queryKey: BILLING_QUOTA_USAGE_QUERY_KEY,
    queryFn: getBillingQuotaUsage,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    enabled,
  })

  React.useEffect(() => {
    const handleBalanceUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: BILLING_QUOTA_USAGE_QUERY_KEY })
    }

    window.addEventListener(BILLING_BALANCE_UPDATED_EVENT, handleBalanceUpdate)
    return () => window.removeEventListener(BILLING_BALANCE_UPDATED_EVENT, handleBalanceUpdate)
  }, [queryClient])

  return {
    creditBalance: quotaUsageQuery.data ? getAvailableCredits(quotaUsageQuery.data) : null,
    creditLoading: quotaUsageQuery.isLoading,
  }
}

function CreditPanelContent({
  hideInviteEarn,
  inviteEarnPreferenceReady,
  creditBalance,
  creditLoading,
}: {
  hideInviteEarn: boolean
  inviteEarnPreferenceReady: boolean
  creditBalance: number | null
  creditLoading: boolean
}) {
  const formatter = useFormatter()
  const balanceLabel = formatter.number(creditBalance ?? 0, { maximumFractionDigits: 4 })
  const isOutOfCredits = !creditLoading && (creditBalance ?? 0) <= 0

  return (
    <div className="space-y-2">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-accent/50 to-background/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Coins className="size-3.5" strokeWidth={2} />
            </span>
            <UiText id="credits_bfac50d6" /></span>
          <Link
            href="/settings?section=usage"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <UiText id="view_69bd4ef9" /><ChevronRight className="size-3" />
          </Link>
        </div>

        <div className="mt-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[30px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-foreground">
              {creditLoading ? '...' : balanceLabel}
            </span>
            {!creditLoading && <span className="shrink-0 text-xs font-medium text-muted-foreground">credits</span>}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground"><UiText id="available_balance_adba4012" /></p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/settings/top-up"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-foreground px-2 text-xs font-semibold text-background transition-[transform,background-color] hover:-translate-y-px hover:bg-foreground/90"
          >
            <Plus className="size-3.5" />
            <UiText id="add_credits_5367d642" /></Link>
          <Link
            href="/settings?section=usage"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/55 px-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Gauge className="size-3.5 text-muted-foreground" />
            <UiText id="usage_0bb18642" /></Link>
        </div>

        {isOutOfCredits && (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground"><UiText id="out_of_credits_13ebf199" /></p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground"><UiText id="add_credits_to_keep_tools_and_workflows_running_c3a07d81" /></p>
          </div>
        )}
      </section>

      {inviteEarnPreferenceReady && !hideInviteEarn && (
        <button
          type="button"
          className="group flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-2 text-left transition-colors hover:border-amber-400/35 hover:bg-amber-400/[0.11]"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-500 transition-colors group-hover:bg-amber-400/15 dark:text-amber-300">
            <Gift className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-4 text-foreground"><UiText id="invite_earn_25b8348e" /></span>
            <span className="block truncate text-[11px] leading-4 text-muted-foreground"><UiText id="earn_200_credits_15934cd3" /></span>
          </span>
          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-600 dark:text-amber-300">
            +200
          </span>
        </button>
      )}
    </div>
  )
}

function SidebarUpgradePrompt({ collapsed }: { collapsed: boolean }) {
  const tAuto = useTranslations('Auto')
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/settings?section=billing"
            aria-label={tAuto('upgrade_plan_e80fe7c8')}
            className="relative flex h-10 w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(90deg,#2855D8_0%,#4772F2_62%,#8B5CF6_100%)] text-white shadow-sm transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-sidebar-ring before:absolute before:-inset-y-2 before:-left-1/2 before:w-1/3 before:skew-x-[-18deg] before:animate-[account-upgrade-shimmer_5s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/34 before:to-transparent dark:bg-[linear-gradient(90deg,#111A3F_0%,#1D3E9F_34%,#3F5BE7_68%,#8757E8_100%)]"
          >
            <Zap className="relative z-10 h-4 w-4 fill-white/90 text-white" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-normal">
          <UiText id="upgrade_plan_e80fe7c8" /></TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link
      href="/settings?section=billing"
      className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(90deg,#2855D8_0%,#4772F2_62%,#8B5CF6_100%)] px-2.5 py-2.5 text-left text-white shadow-[0_10px_24px_rgba(71,114,242,0.26)] transition-[filter,transform,box-shadow] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_12px_28px_rgba(71,114,242,0.34)] focus-visible:ring-2 focus-visible:ring-sidebar-ring before:absolute before:-inset-y-2 before:-left-1/2 before:w-1/3 before:skew-x-[-18deg] before:animate-[account-upgrade-shimmer_5s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/34 before:to-transparent dark:bg-[linear-gradient(90deg,#111A3F_0%,#1D3E9F_34%,#3F5BE7_68%,#8757E8_100%)] dark:shadow-[0_10px_24px_rgba(40,85,216,0.24)] dark:hover:shadow-[0_12px_28px_rgba(40,85,216,0.32)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
        <Zap className="h-4 w-4 fill-white/90 text-white" />
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-5 text-white">
          <UiText id="upgrade_plan_e80fe7c8" /></span>
        <span className="block truncate text-xs leading-4 text-white/72">
          <UiText id="unlock_full_videos_66e854f6" /></span>
      </span>
      <ChevronRight className="relative z-10 h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export function AccountMenu({
  collapsed,
  initialProfile,
  enabled,
  variant = 'sidebar',
  active = false,
}: {
  collapsed: boolean
  initialProfile?: AccountProfileTenant | null
  enabled: boolean
  variant?: 'sidebar' | 'rail'
  active?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [hideInviteEarn, setHideInviteEarn] = React.useState(false)
  const [inviteEarnPreferenceReady, setInviteEarnPreferenceReady] = React.useState(false)
  const [planSyncState, setPlanSyncState] = React.useState<AccountPlanSyncState | null>(null)
  const accountClient = React.useMemo(() => createBrowserAccountClient(), [])
  const authGateway = React.useMemo(() => createBrowserAuthGatewayClient(), [])
  const firebaseAuth = React.useMemo(() => createFirebaseAuthDriver(), [])
  const accountQuery = useQuery({
    queryKey: ACCOUNT_PROFILE_QUERY_KEY,
    queryFn: () => accountClient.getCurrentProfile(),
    initialData: initialProfile ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    enabled,
  })
  const { creditBalance, creditLoading } = useSidebarCreditBalance(enabled)
  const account = applyAccountPlanSync(accountQuery.data ?? null, planSyncState)
  const accountLoading = !account
  const accountImageUrl = firebaseAuth.currentUser()?.photoURL ?? getAccountProfileImageUrl(account)
  const accountName = getAccountDisplayName(account)
  const accountLabel = accountName || 'Account'
  const planLabel = account ? formatPlanLabel(account.plan_type) : ''
  const initials = getInitials(account?.name || account?.email || '')
  const shouldShowUpgradePrompt = isBasicPlan(account?.plan_type)

  React.useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const profile = (event as CustomEvent<AccountProfileTenant>).detail
      if (!profile) return
      queryClient.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, profile)
    }

    window.addEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, handleProfileUpdate)
    return () => window.removeEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, handleProfileUpdate)
  }, [queryClient])

  React.useEffect(() => {
    setPlanSyncState(readAccountPlanSyncState())

    const handlePlanSyncUpdate = (event: Event) => {
      setPlanSyncState((event as CustomEvent<AccountPlanSyncState | null>).detail ?? readAccountPlanSyncState())
    }

    window.addEventListener(ACCOUNT_PLAN_SYNC_UPDATED_EVENT, handlePlanSyncUpdate)
    return () => window.removeEventListener(ACCOUNT_PLAN_SYNC_UPDATED_EVENT, handlePlanSyncUpdate)
  }, [])

  React.useEffect(() => {
    setHideInviteEarn(window.localStorage.getItem(INVITE_EARN_HIDDEN_STORAGE_KEY) === 'true')
    setInviteEarnPreferenceReady(true)

    const handleInviteEarnPreference = (event: Event) => {
      setHideInviteEarn(Boolean((event as CustomEvent<boolean>).detail))
      setInviteEarnPreferenceReady(true)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== INVITE_EARN_HIDDEN_STORAGE_KEY) return
      setHideInviteEarn(event.newValue === 'true')
      setInviteEarnPreferenceReady(true)
    }

    window.addEventListener(INVITE_EARN_HIDDEN_EVENT, handleInviteEarnPreference)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(INVITE_EARN_HIDDEN_EVENT, handleInviteEarnPreference)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      await Promise.allSettled([
        Promise.resolve().then(() => authGateway.logout()),
        Promise.resolve().then(() => firebaseAuth.signOut()),
      ])
    } finally {
      clearBrowserPrincipalState()
      resetBrowserAccountClientCaches()
      queryClient.clear()
      setIsLoggingOut(false)
      router.replace('/login')
      router.refresh()
    }
  }

  return (
    <div className={cn('shrink-0', variant === 'rail' ? 'p-0' : 'border-t border-border p-2')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={accountLoading ? tAuto('loading_account_222d9d5f') : `Open account and credits for ${accountLabel}`}
            title={accountLoading ? tAuto('loading_account_222d9d5f') : accountLabel}
            className={cn(
              'flex items-center text-left text-foreground outline-none transition-colors',
              variant === 'rail'
                ? 'size-10 justify-center rounded-full p-0 ring-2 ring-offset-2 ring-offset-sidebar hover:bg-accent'
                : collapsed
                  ? 'h-10 w-full justify-center rounded-xl px-0 hover:bg-accent'
                  : 'w-full gap-3 rounded-xl px-2 py-2 hover:bg-accent',
              variant === 'rail' && (active ? 'ring-primary' : 'ring-border hover:ring-primary/60'),
            )}
          >
            {accountLoading ? (
              <AccountMenuTriggerSkeleton collapsed={collapsed} />
            ) : (
              <>
                <Avatar className="size-9 shrink-0">
                  {accountImageUrl && <AvatarImage src={accountImageUrl} alt="" />}
                  <AvatarFallback className="bg-emerald-500/90 text-sm font-semibold text-emerald-950">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-5">
                        {accountLabel}
                      </span>
                      <span className="block truncate text-xs leading-4 text-muted-foreground">
                        {planLabel}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </>
                )}
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        {!accountLoading && (
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={12}
            collisionPadding={12}
            className="w-[316px] rounded-[22px] border border-border/70 bg-popover/94 p-2 text-popover-foreground shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl supports-[backdrop-filter]:bg-popover/84 dark:border-white/10 dark:bg-popover/95"
          >
            <CreditPanelContent
              hideInviteEarn={hideInviteEarn}
              inviteEarnPreferenceReady={inviteEarnPreferenceReady}
              creditBalance={creditBalance}
              creditLoading={creditLoading}
            />

            <DropdownMenuSeparator className="mx-1 my-2 bg-border/80" />
            {shouldShowUpgradePrompt && (
              <AccountMenuItem icon={Sparkles} href="/settings?section=billing">
                <UiText id="upgrade_plan_e80fe7c8" /></AccountMenuItem>
            )}
            <AccountMenuItem icon={SettingsLucide} href="/settings?section=general"><UiText id="ayarlar_e3258c51" /></AccountMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-10 rounded-xl px-2.5 text-[13px] font-medium text-popover-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span><UiText id="tema_6ae1bcaf" /></span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  sideOffset={8}
                  className="w-40 rounded-lg border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                >
                  <DropdownMenuRadioGroup
                    value={theme ?? 'system'}
                    onValueChange={(value) => setTheme(value)}
                  >
                    <DropdownMenuRadioItem
                      value="light"
                      className="rounded-md py-2 text-sm text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <Sun className="h-4 w-4 text-muted-foreground" />
                      <UiText id="light_a36ef8ab" /></DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="dark"
                      className="rounded-md py-2 text-sm text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <UiText id="dark_ae1ef014" /></DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="paper"
                      className="rounded-md py-2 text-sm text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <UiText id="theme_paper" /></DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="system"
                      className="rounded-md py-2 text-sm text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <UiText id="system_bc0792d8" /></DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="mx-1 my-2 bg-border/80" />

            <AccountMenuItem icon={LifeBuoy}><UiText id="yard_m_eaba0a79" /></AccountMenuItem>
            <DropdownMenuItem
              disabled={isLoggingOut}
              onSelect={(event) => {
                event.preventDefault()
                void handleLogout()
              }}
              className="h-10 rounded-xl px-2.5 text-[13px] font-medium text-popover-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              {isLoggingOut ? tAuto('c_k_s_yap_l_yor_96649809') : tAuto('oturumu_kapat_1b468eb8')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  )
}

function AccountMenuTriggerSkeleton({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <Skeleton className="h-8 w-8 rounded-full" />
  }

  return (
    <>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </span>
      <Skeleton className="h-4 w-4 shrink-0" />
    </>
  )
}

function AccountMenuItem({
  icon: Icon,
  href,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  href?: string
  children: React.ReactNode
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </>
  )

  if (href) {
    return (
      <DropdownMenuItem asChild className="h-10 rounded-xl px-2.5 text-[13px] font-medium text-popover-foreground focus:bg-accent focus:text-accent-foreground">
        <Link href={href}>{content}</Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem className="h-10 rounded-xl px-2.5 text-[13px] font-medium text-popover-foreground focus:bg-accent focus:text-accent-foreground">
      {content}
    </DropdownMenuItem>
  )
}

function getAccountDisplayName(account: AccountProfileTenant | null) {
  return account?.name?.trim() || account?.email?.trim() || ''
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function formatPlanLabel(plan?: string) {
  if (!plan) return 'Account'
  if (plan === 'max') return 'Max'
  return plan.slice(0, 1).toUpperCase() + plan.slice(1)
}

function isBasicPlan(plan?: string | null) {
  return plan?.toLowerCase() === 'basic'
}

const PLAN_INCLUDED_CREDITS_QUOTA_KEY = 'billing:plan_included_credits'


function getAvailableCredits(quotaUsage: BillingQuotaUsage) {
  if (typeof quotaUsage.available_credits === 'number') {
    return quotaUsage.available_credits
  }

  const topUpBalance = quotaUsage.top_up_balance_credits ?? quotaUsage.credit_balance
  const planRemaining = quotaUsage.plan_included_credits?.remaining ?? quotaUsage.quotas.reduce((sum, quota) => {
    if (!isPlanIncludedCreditsQuota(quota.quota_key)) return sum
    return sumCredits(sum, quota.remaining_quota)
  }, 0)

  return sumCredits(planRemaining, topUpBalance)
}

function isPlanIncludedCreditsQuota(quotaKey: string) {
  return quotaKey === PLAN_INCLUDED_CREDITS_QUOTA_KEY
}

function sumCredits(...values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100
}

function getAccountProfileImageUrl(account: AccountProfileTenant | null) {
  return account?.picture_url ?? account?.photo_url ?? account?.avatar_url ?? null
}

interface SidebarNavigationItemsProps {
  items: SidebarNavItem[]
  currentPath: string
  collapsed: boolean
  /** The channel whose recent projects are listed under the sections; undefined hides the list (non-workspace menus). */
  recentWorkChannelId?: string | null
}

function SidebarNavigationItems({ items, currentPath, collapsed, recentWorkChannelId }: SidebarNavigationItemsProps) {
  const leadingItems: SidebarNavItem[] = []
  const sections: Array<{ section: SidebarNavItem; items: SidebarNavItem[] }> = []
  let currentSection: { section: SidebarNavItem; items: SidebarNavItem[] } | null = null

  for (const item of items) {
    if (item.type === 'section') {
      currentSection = { section: item, items: [] }
      sections.push(currentSection)
    } else if (currentSection) {
      currentSection.items.push(item)
    } else {
      leadingItems.push(item)
    }
  }

  const renderItems = (list: SidebarNavItem[]) => list.map((item) => (
    <NavItemComponent key={item.id} item={item} currentPath={currentPath} collapsed={collapsed} />
  ))

  return (
    <>
      {leadingItems.length > 0 && (
        <div className="flex flex-col gap-0.5">{renderItems(leadingItems)}</div>
      )}
      {sections.map(({ section, items: sectionItems }) => (
        collapsed ? (
          <div key={section.id} className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border/60 pt-2">{renderItems(sectionItems)}</div>
        ) : (
          <SidebarSection key={section.id} label={section.label}>{renderItems(sectionItems)}</SidebarSection>
        )
      ))}
      {!collapsed && recentWorkChannelId !== undefined && (
        <SidebarRecentProjects channelId={recentWorkChannelId} currentPath={currentPath} />
      )}
    </>
  )
}

/** A sentence-case group label that folds its items away; the chevron shows on hover or while folded. */
function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="pt-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between rounded-md px-2.5 pb-1 text-left text-[12.5px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 transition-[transform,opacity]', open ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : '-rotate-90')} />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  )
}

const SIDEBAR_RECENT_PROJECTS = 5

/**
 * The channel's latest projects, newest first: a new video is a project ("Yeni video"), so recent work is here. A
 * project opens as its work tab, where it was left, like a card on the projects page; "Tümünü gör" is that page.
 */
function SidebarRecentProjects({ channelId, currentPath }: { channelId: string | null; currentPath: string }) {
  const tNav = useTranslations('Navigation')
  const router = useRouter()
  const projectsQuery = useQuery({
    queryKey: ['spark-projects', channelId, 'sidebar-recent'],
    queryFn: ({ signal }) => listSparkProjects(channelId ?? '', { limit: SIDEBAR_RECENT_PROJECTS, signal }),
    enabled: Boolean(channelId),
    staleTime: 15_000,
  })
  const loaded = projectsQuery.data?.projects
  const projects = (loaded ?? [])
    .filter((project) => (project.lifecycleState ?? 'active') === 'active')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, SIDEBAR_RECENT_PROJECTS)
  const openPath = currentPath.split('?')[0] ?? ''

  // A project made since the list was read (named from its first sentence) is looked up once it is on screen.
  const openId = /^\/spark\/([^/]+)$/.exec(openPath)?.[1]
  const unknown = openId && openId !== 'new' && openId !== 'lab' && loaded && !loaded.some((project) => encodeURIComponent(project.id) === openId) ? openId : null
  const lookedUp = React.useRef<string | null>(null)
  const { refetch } = projectsQuery
  React.useEffect(() => {
    if (!unknown || lookedUp.current === unknown) return
    lookedUp.current = unknown
    void refetch()
  }, [unknown, refetch])

  if (!channelId || (!projectsQuery.isPending && projects.length === 0)) return null

  return (
    <SidebarSection label={tNav('recentWork')}>
      {projectsQuery.isPending
        ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="mx-3 my-1.5 h-4 rounded-md" />)
        : projects.map((project) => {
          const href = `/spark/${encodeURIComponent(project.id)}`
          const active = openPath === href
          return (
            <Link
              key={project.id}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                // A plain click opens it as its tab, where it was left; a modified one is the browser's.
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                openWorkTab({ kind: 'spark', id: project.id, title: project.title })
                router.push(sparkProjectWorkHref(project.id))
              }}
              className={cn(
                'truncate rounded-md px-2.5 py-1.5 text-[14px] transition-colors',
                active ? 'bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              {project.title.trim() || tNav('untitledWork')}
            </Link>
          )
        })}
      <Link href="/spark" className="rounded-md px-2.5 py-1.5 text-[14px] text-muted-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-foreground">
        {tNav('seeAllWork')}
      </Link>
    </SidebarSection>
  )
}

interface NavItemComponentProps {
  item: SidebarNavItem
  currentPath: string
  depth?: number
  collapsed?: boolean
}

function NavItemComponent({ item, currentPath, depth = 0, collapsed = false }: NavItemComponentProps) {
  const hasChildren = item.children && item.children.length > 0
  const hasActiveChild = Boolean(item.children?.some((child) => isNavItemActive(child, currentPath)))
  const [isOpen, setIsOpen] = React.useState(item.defaultOpen ?? hasActiveChild)
  const isActive = Boolean(item.isActive || isHrefActive(item.href, currentPath))
  const canSelect = Boolean(item.onSelect && !item.disabled)
  const isDisabled = Boolean(item.disabled || (!item.href && !canSelect && !hasChildren))

  React.useEffect(() => {
    if (hasActiveChild) setIsOpen(true)
  }, [hasActiveChild])

  if (item.type === 'section') {
    if (collapsed) return null

    return (
      <div className={cn('flex items-center justify-between px-2.5 pb-1 pt-5', depth > 0 && 'ml-4')}>
        <span className="text-[12.5px] font-medium text-muted-foreground/70">{item.label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground/70" />
      </div>
    )
  }

  const Icon = item.icon ? getIcon(item.icon) : null

  if (item.id === 'new-task' && item.href && !hasChildren && !collapsed) {
    return (
      <NewTaskNavItem
        item={item}
        Icon={Icon}
        isActive={isActive}
        isDisabled={isDisabled}
        depth={depth}
      />
    )
  }

  // Quiet rows that light up: the items rest in a muted grey and only the one on screen (or under the pointer) is
  // bright, so the menu has depth instead of one flat white list. Regular weight, small icons and 32px rows keep it
  // light rather than heavy.
  const content = (
    <div
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[14px] font-normal leading-5 transition-colors',
        isActive
          ? 'bg-sidebar-accent text-foreground'
          : hasActiveChild
            ? 'text-foreground hover:bg-sidebar-accent/70'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
        isDisabled && 'cursor-default text-muted-foreground/60 hover:bg-transparent',
        depth > 0 && !collapsed && 'text-[14px] font-medium',
        collapsed && 'min-h-9 justify-center gap-0 px-0'
      )}
    >
      {/* Icon */}
      {Icon && (
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center text-current [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.6]',
            item.iconSurface && 'h-6 w-6 rounded-md bg-accent text-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2.3]',
            isActive && item.iconSurface && 'bg-background text-sidebar-foreground shadow-sm',
            isActive ? 'text-foreground' : 'text-sidebar-icon group-hover:text-foreground',
            item.iconColor
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}

      {/* Label */}
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

      {/* Badge */}
      {item.badge !== undefined && !collapsed && (
        <span
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/[0.08] px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
        >
          {item.badge}
        </span>
      )}

      {item.badge !== undefined && collapsed && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
      )}

      {/* Actions */}
      {item.showActions && !collapsed && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button className="rounded p-0.5 hover:bg-sidebar-accent">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
          <button className="rounded p-0.5 hover:bg-sidebar-accent">
            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* External Link Icon */}
      {item.isExternal && !collapsed && (
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
      )}

      {hasChildren && !collapsed && (
        <span className="ml-auto flex h-4 w-4 items-center justify-center text-muted-foreground">
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      )}
    </div>
  )

  const itemButton = (
    <button
      type="button"
      onClick={item.onSelect}
      disabled={isDisabled && !hasChildren}
      className="w-full text-left disabled:cursor-default"
    >
      {content}
    </button>
  )

  const staticItem = <div aria-disabled={isDisabled}>{content}</div>

  if (hasChildren && collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={item.label}
            className="w-full text-left"
          >
            {content}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-[220px] rounded-lg border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {item.label}
          </div>
          {item.children!.map((child) => (
            <CollapsedChildMenuItem
              key={child.id}
              item={child}
              currentPath={currentPath}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const wrappedContent = collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {item.href && !hasChildren ? (
          <Link href={item.href} prefetch={item.isExternal ? false : undefined} target={item.isExternal ? '_blank' : undefined}>
            {content}
          </Link>
        ) : canSelect || hasChildren ? (
          itemButton
        ) : (
          staticItem
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="font-normal">
        {item.label}
      </TooltipContent>
    </Tooltip>
  ) : item.href && !hasChildren ? (
    <Link href={item.href} prefetch={item.isExternal ? false : undefined} target={item.isExternal ? '_blank' : undefined}>
      {content}
    </Link>
  ) : canSelect || hasChildren ? (
    itemButton
  ) : (
    staticItem
  )

  if (hasChildren && !collapsed) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          {wrappedContent}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border/80 pb-0.5 pl-2 pt-0.5">
            {item.children!.map((child) => (
              <NavItemComponent
                key={child.id}
                item={child}
                currentPath={currentPath}
                depth={depth + 1}
                collapsed={collapsed}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return wrappedContent
}

function NewTaskNavItem({
  item,
  Icon,
  isActive,
  isDisabled,
  depth,
}: {
  item: SidebarNavItem
  Icon: React.ComponentType<{ className?: string }> | null
  isActive: boolean
  isDisabled: boolean
  depth: number
}) {

  return (
    <div>
      <Link
        href={item.href!}
        prefetch={item.isExternal ? false : undefined}
        target={item.isExternal ? '_blank' : undefined}
        className={cn(
          'group mb-2 flex min-w-0 items-center gap-2.5 rounded-lg border border-border px-2.5 py-[7px] text-sm font-medium text-foreground transition-colors',
          isActive ? 'bg-sidebar-accent' : 'bg-background/60 hover:bg-sidebar-accent',
          depth > 0 && 'text-[14px]',
          isDisabled && 'pointer-events-none',
        )}
      >
        {Icon && (
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center text-current [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.8]',
              item.iconSurface && 'h-6 w-6 rounded-md bg-accent text-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2.3]',
              isActive && item.iconSurface && 'bg-background text-sidebar-foreground shadow-sm',
              item.iconColor,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>

    </div>
  )
}


function CollapsedChildMenuItem({
  item,
  currentPath,
}: {
  item: SidebarNavItem
  currentPath: string
}) {
  const Icon = item.icon ? getIcon(item.icon) : null
  const isActive = Boolean(item.isActive || isHrefActive(item.href, currentPath))
  const canSelect = Boolean(item.onSelect && !item.disabled)
  const isDisabled = Boolean(item.disabled || (!item.href && !canSelect))

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
          {item.badge}
        </span>
      )}
    </>
  )

  if (item.href && !item.children?.length) {
    return (
      <DropdownMenuItem
        asChild
        disabled={isDisabled}
        className={cn(
          'gap-2 rounded-md px-2 py-2 text-sm',
          isActive && 'bg-accent text-accent-foreground',
        )}
      >
        <Link href={item.href} prefetch={item.isExternal ? false : undefined} target={item.isExternal ? '_blank' : undefined}>
          {content}
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      disabled={isDisabled}
      onSelect={(event) => {
        if (!canSelect) return
        event.preventDefault()
        item.onSelect?.()
      }}
      className={cn(
        'gap-2 rounded-md px-2 py-2 text-sm',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      {content}
    </DropdownMenuItem>
  )
}

function isNavItemActive(item: SidebarNavItem, currentPath: string): boolean {
  return Boolean(
    item.isActive
      || isHrefActive(item.href, currentPath)
      || item.children?.some((child) => isNavItemActive(child, currentPath))
  )
}

function isHrefActive(href: string | undefined, currentPath: string): boolean {
  if (!href) return false

  const hrefWithoutHash = href.split('#')[0]
  const [hrefPath, hrefQuery = ''] = hrefWithoutHash.split('?')
  const [currentPathname, currentQuery = ''] = currentPath.split('?')

  if (hrefPath === '/') {
    return currentPathname === '/' && (!hrefQuery || hrefQuery === currentQuery)
  }

  if (hrefQuery) {
    if (currentPathname !== hrefPath) return false
    if (hrefQuery === currentQuery) return true

    const defaultViews: Record<string, string> = {
      '/channels': 'statistics',
    }
    const defaultView = defaultViews[hrefPath] ?? hrefPath.replace('/', '')
    return !currentQuery && hrefQuery === `view=${defaultView}`
  }

  return currentPathname === hrefPath || currentPathname.startsWith(`${hrefPath}/`)
}

// Icon mapper
export function getIcon(iconName: string) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    home: HomeIcon,
    inbox: Inbox,
    plus: Plus,
    chat: MessageCircle,
    target: TargetIcon,
    folder: Folder,
    users: UsersIcon,
    settings: SettingsIcon,
    star: StarIcon,
    clock: ClockIcon,
    bell: BellIcon,
    zap: ZapIcon,
    layers: LayersIcon,
    grid: GridIcon,
    list: ListIcon,
    hash: HashIcon,
    file: FileIcon,
    edit: EditIcon,
    eye: EyeIcon,
    shield: ShieldIcon,
    archive: ArchiveIcon,
    refresh: RefreshIcon,
    calendar: CalendarIcon,
    timeline: SlidersHorizontal,
    workflow: Workflow,
    channel: MonitorPlay,
    memory: Brain,
    plug: Plug,
    wrench: Wrench,
    truck: TruckIcon,
    bar: BarIcon,
    table: TableIcon,
    box: BoxIcon,
    lightbulb: Lightbulb,
    chart: ChartIcon,
    puzzle: Waypoints,
    video: Video,
    clapperboard: Clapperboard,
  }
  return icons[iconName] || null
}

// Icon Components
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function TimelineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </svg>
  )
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  )
}

function BarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  )
}

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.074-.802.38-.769.85.052.633-.244 1.267-.812 1.599-1.266.74-2.751.851-4.084.325l-1.329-.532a1.745 1.745 0 0 1-1.098-1.621V15.5a1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5v.674c0 1.178-.639 2.266-1.665 2.845l-1.329.532c-1.333.526-2.818.415-4.084-.325-.568-.332-.864-.966-.812-1.599.033-.47-.299-.924-.769-.85a.98.98 0 0 1-.837.276l-1.611-1.611c-.47-.47-.706-1.087-.706-1.704s.235-1.233.706-1.704l1.568-1.568c.23-.23.338-.556.289-.878-.074-.47.38-.802.85-.769.633.052 1.267-.244 1.599-.812.74-1.266.851-2.751.325-4.084l-.532-1.329a1.745 1.745 0 0 1 1.621-1.098h.674a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5h-.674c-1.178 0-2.266-.639-2.845-1.665l-.532-1.329c-.526-1.333-.415-2.818.325-4.084.332-.568.966-.864 1.599-.812.47.033.924-.299.85-.769a.98.98 0 0 1-.276-.837l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.556.338.878.289.47-.074.802.38.769.85-.052.633.244 1.267.812 1.599 1.266.74 2.751.851 4.084.325l1.329-.532a1.745 1.745 0 0 1 1.621 1.098v.674a1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5v-.674c0-1.178.639-2.266 1.665-2.845l1.329-.532c1.333-.526 2.818-.415 4.084.325.568.332.864.966.812 1.599-.033.47.299.924.769.85a.98.98 0 0 1 .837-.276l1.611 1.611c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.568 1.568c-.23.23-.338.556-.289.878.074.47-.38.802-.85.769-.633-.052-1.267.244-1.599.812-.74 1.266-.851 2.751-.325 4.084l.532 1.329a1.745 1.745 0 0 1-1.098 1.621h-.674a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5h.674c1.178 0 2.266.639 2.845 1.665l.532 1.329c.526 1.333.415 2.818-.325 4.084-.332.568-.966.864-1.599.812-.47-.033-.924.299-.85.769z" />
      <path d="M12 9v.01" />
      <path d="M11 15h2" />
      <path d="M11 12h2" />
    </svg>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { YoutorchIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  Clapperboard,
  Inbox,
  LayoutGrid,
  LibraryBig,
  Lightbulb,
  Menu,
  Palette,
  Puzzle,
  Shapes,
  Video,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SidebarToggleIcon } from './sidebar-toggle-icon'
import { WORK_TAB_TRANSITION } from '@/lib/page-transitions'
import { rememberLastPage, useWorkTabs, workTabFromPath } from '@/lib/work-tabs'
import { NewTabButton, WorkTabStrip } from './work-tabs'

interface AppHeaderProps {
  appName?: string
  appIcon?: React.ReactNode
  onToggleDesktopSidebar?: () => void
  onOpenMobileSidebar?: () => void
  sidebarCollapsed?: boolean
  className?: string
}

/** The page the bar names, by path prefix (Navigation labels). */
const PAGE_TITLES: Array<{ prefix: string; labelKey: string; icon: LucideIcon }> = [
  { prefix: '/dashboard', labelKey: 'overview', icon: LayoutGrid },
  { prefix: '/inbox', labelKey: 'inbox', icon: Inbox },
  { prefix: '/spark', labelKey: 'projects', icon: Clapperboard },
  { prefix: '/canvas', labelKey: 'canvas', icon: Shapes },
  { prefix: '/calendar', labelKey: 'calendar', icon: CalendarDays },
  { prefix: '/channels', labelKey: 'channel', icon: Video },
  { prefix: '/memory', labelKey: 'memory', icon: Lightbulb },
  { prefix: '/apps', labelKey: 'connectors', icon: Puzzle },
  { prefix: '/workflows', labelKey: 'automation', icon: Workflow },
  { prefix: '/library', labelKey: 'assets', icon: LibraryBig },
  { prefix: '/brand', labelKey: 'brand', icon: Palette },
  { prefix: '/tools', labelKey: 'tools', icon: Wrench },
]

const pageFor = (path: string | null) =>
  path ? PAGE_TITLES.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`)) : undefined

/**
 * The page panel's top bar: `[page item] | [tabs…] [+]`. The page item is pinned first: the sidebar page on screen,
 * or while work is on screen the page the user came from (`lastPage` in `lib/work-tabs.ts`). "AI'a sor" is not
 * here: it is the agent panel's own launcher, in the page panel's bottom right corner (`ask-ai-button.tsx`).
 */
export function AppHeader(props: AppHeaderProps) {
  // An unsaved Flow is told from the automation list by its query, which is read on the client: until then the
  // bar is drawn from the path alone.
  return (
    <React.Suspense fallback={<HeaderBar {...props} search="" />}>
      <HeaderBarWithQuery {...props} />
    </React.Suspense>
  )
}

function HeaderBarWithQuery(props: AppHeaderProps) {
  const search = useSearchParams().toString()
  return <HeaderBar {...props} search={search} />
}

function HeaderBar({
  appName = 'Youtorch',
  appIcon,
  onToggleDesktopSidebar,
  onOpenMobileSidebar,
  sidebarCollapsed = false,
  className,
  search,
}: AppHeaderProps & { search: string }) {
  const tAuto = useTranslations('Auto')
  const tNav = useTranslations('Navigation')
  const pathname = usePathname()
  const displayAppName = appName || 'Youtorch'
  const { tabs, lastPage } = useWorkTabs()
  const work = workTabFromPath(pathname, search)
  // The page item is the one on screen unless an open work tab is.
  const onWorkTab = Boolean(work && tabs.some((tab) => tab.kind === work.kind && tab.id === work.id))
  const current = pageFor(pathname)
  const page = onWorkTab ? pageFor(lastPage) ?? current ?? pageFor('/dashboard') : current
  // Only a page of its own is remembered: an address that belongs to a tab never is.
  const pagePrefix = work ? undefined : current?.prefix
  React.useEffect(() => {
    if (pagePrefix) rememberLastPage(pagePrefix)
  }, [pagePrefix])

  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-3 md:px-3.5',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        onClick={onOpenMobileSidebar}
        aria-label={tAuto('open_menu_197101e9')}
      >
        <Menu className="size-[18px]" />
      </Button>

      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
          onClick={onToggleDesktopSidebar}
          aria-label={tAuto('expand_sidebar_f462e889')}
        >
          <SidebarToggleIcon className="size-[18px]" />
        </Button>
      )}

      <div className="flex items-center gap-2 md:hidden">
        {appIcon || <YoutorchIcon className="size-6" />}
        <span className="hidden text-sm font-semibold text-foreground sm:inline">{displayAppName}</span>
      </div>

      {page && (
        <Link
          href={page.prefix}
          transitionTypes={[WORK_TAB_TRANSITION]}
          aria-current={onWorkTab ? undefined : 'page'}
          className={cn(
            'hidden h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 md:flex',
            onWorkTab ? 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground' : 'bg-foreground/[0.07] text-foreground',
          )}
        >
          <page.icon className="size-4 shrink-0" />
          <span>{tNav(page.labelKey)}</span>
        </Link>
      )}

      <div className={cn('flex min-w-0 flex-1 items-center gap-1', page && 'md:border-l md:border-border md:pl-1.5')}>
        <React.Suspense fallback={null}>
          <WorkTabStrip className="min-w-24" />
        </React.Suspense>
        <NewTabButton />
      </div>

    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Flame,
  LibraryBig,
  LayoutGrid,
  Palette,
  Wrench,
} from 'lucide-react'

import type { AccountProfileTenant } from '@/components/account/browser-account-client'
import { cn } from '@/lib/utils'
import { AccountMenu } from './app-sidebar'
import { useTranslations } from 'next-intl'

export type WorkspaceRailModule = 'overview' | 'assets' | 'brand' | 'tools'

const railItems = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutGrid, match: 'workspace', module: 'overview' },
  { href: '/library', labelKey: 'assets', icon: LibraryBig, match: 'assets', module: 'assets' },
  { href: '/brand', labelKey: 'brand', icon: Palette, match: 'brand', module: 'brand' },
  { href: '/tools', labelKey: 'tools', icon: Wrench, match: 'tools', module: 'tools' },
] as const

interface WorkspaceIconRailProps {
  className?: string
  initialProfile?: AccountProfileTenant | null
  accountProfileEnabled?: boolean
  onModulePreview?: (module: WorkspaceRailModule) => void
  onModuleActivate?: (module: WorkspaceRailModule) => void
}

export function WorkspaceIconRail({
  className,
  initialProfile = null,
  accountProfileEnabled = true,
  onModulePreview,
  onModuleActivate,
}: WorkspaceIconRailProps) {
  const tAuto = useTranslations('Auto')
  const tNav = useTranslations('Navigation')
  const pathname = usePathname()
  const toolsActive = pathname.startsWith('/tools')
  const brandActive = pathname.startsWith('/brand')
  const assetsActive = pathname.startsWith('/library') || pathname.startsWith('/storage')
  const settingsActive = pathname.startsWith('/settings')

  return (
    <aside
      aria-label={tAuto('workspace_modules_f087f2d9')}
      className={cn(
        'workspace-icon-rail flex h-full w-[76px] shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-3 text-foreground',
        className,
      )}
    >
      <Link
        href="/dashboard"
        aria-label={tAuto('youtorch_overview_4e02ae39')}
      className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20 transition-transform hover:scale-105"
      >
        <Flame className="size-5" strokeWidth={2.2} />
      </Link>


      <nav className="flex flex-col items-center gap-1">
        {railItems.map((item) => {
          const active = item.match === 'tools'
            ? toolsActive
            : item.match === 'brand'
              ? brandActive
              : item.match === 'assets'
                ? assetsActive
                : !toolsActive && !brandActive && !assetsActive && !settingsActive

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={tNav(item.labelKey)}
              onMouseEnter={() => onModulePreview?.(item.module)}
              onFocus={() => onModulePreview?.(item.module)}
              onClick={() => onModuleActivate?.(item.module)}
              className={cn(
                'group flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-3 transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl border transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-transparent group-hover:border-border group-hover:bg-accent',
                )}
              >
                <item.icon className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="max-w-full truncate whitespace-nowrap text-center">
                {tNav(item.labelKey)}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center pb-1">
        <AccountMenu
          variant="rail"
          collapsed
          active={settingsActive}
          initialProfile={initialProfile}
          enabled={accountProfileEnabled}
        />
      </div>
    </aside>
  )
}

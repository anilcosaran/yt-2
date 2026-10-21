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
        'workspace-icon-rail flex h-full w-[76px] shrink-0 flex-col items-center gap-1 bg-sidebar py-3 text-foreground',
        className,
      )}
    >
      <Link
        href="/dashboard"
        aria-label={tAuto('youtorch_overview_4e02ae39')}
        className="mb-3 flex size-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-orange-500 to-rose-500 text-white transition-transform hover:scale-105"
      >
        <Flame className="size-[18px]" strokeWidth={2.2} />
      </Link>

      {/* Light, like the sidebar beside it: muted marks and captions at rest, the module on screen bright on a soft
          fill. No borders. */}
      <nav className="flex flex-col items-center gap-0.5">
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
                'group flex w-16 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10.5px] leading-[13px] transition-colors',
                active
                  ? 'font-medium text-foreground'
                  : 'font-normal text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground group-hover:bg-sidebar-accent/60 group-hover:text-foreground',
                )}
              >
                <item.icon className="size-[17px]" strokeWidth={1.6} />
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

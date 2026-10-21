'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { createMainSidebarItems } from './main-sidebar-items'
import { MainLayout } from './main-layout'

const ChatSidebar = dynamic(
  () => import('@/components/chat/chat-sidebar').then((mod) => mod.ChatSidebar),
  { loading: () => <SidebarFallback /> },
)

const workspaceShellPrefixes = [
  '/apps',
  '/brand',
  '/calendar',
  '/channels',
  '/chat',
  '/customers',
  '/dashboard',
  '/favorites',
  '/inbox',
  '/library',
  '/memory',
  '/models',
  '/new',
  '/recent',
  '/settings',
  '/spark',
  '/storage',
  '/tools',
  '/workflows',
]

export function AppShellBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const tNav = useTranslations('Navigation')
  const mainSidebarItems = React.useMemo(
    () => createMainSidebarItems((key) => tNav(key)),
    [tNav],
  )
  // "Yeni video" from any page lands in the chat: its menu is loaded while the browser is idle, so the switch does
  // not show an empty menu for a moment.
  React.useEffect(() => {
    const warm = () => void import('@/components/chat/chat-sidebar')
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(warm, { timeout: 2000 })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = setTimeout(warm, 600)
    return () => clearTimeout(timer)
  }, [])

  if (!usesWorkspaceShell(pathname)) return <>{children}</>

  if (pathname === '/chat' || pathname?.startsWith('/chat/')) {
    return (
      <MainLayout
        appName="Youtorch"
        sidebarItems={mainSidebarItems}
          sidebarContent={({ collapsed, onCollapsedChange }) => (
          <React.Suspense fallback={<SidebarFallback />}>
            <ChatSidebar collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
          </React.Suspense>
        )}
        showHeader={false}
        showAnnouncementBar={false}
        showActionCenterAlerts={false}
      >
        {children}
      </MainLayout>
    )
  }

  // An opened Spark project is work in a tab of the shell (`./work-tabs`). The workspace without a project
  // (`/spark/lab`, for review links and screenshots) stays full-screen, outside it.
  if (isSparkLabPath(pathname)) return <>{children}</>

  return (
    <MainLayout appName="Youtorch" sidebarItems={mainSidebarItems}>
      {children}
    </MainLayout>
  )
}

function isSparkLabPath(pathname: string | null) {
  return pathname === '/spark/lab' || Boolean(pathname?.startsWith('/spark/lab/'))
}

export function usesWorkspaceShell(pathname: string | null) {
  if (!pathname) return false
  return workspaceShellPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function SidebarFallback() {
  return <div className="h-full w-full bg-sidebar" />
}

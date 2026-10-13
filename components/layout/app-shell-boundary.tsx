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
  '/channels',
  '/chat',
  '/customers',
  '/dashboard',
  '/favorites',
  '/inbox',
  '/library',
  '/memory',
  '/models',
  '/motion',
  '/recent',
  '/settings',
  '/spark',
  '/storage',
  '/tools',
  '/workflows',
]

export function AppShellBoundary({ children, motionEnabled = false }: { children: React.ReactNode; motionEnabled?: boolean }) {
  const pathname = usePathname()
  const tNav = useTranslations('Navigation')
  const mainSidebarItems = React.useMemo(
    () => createMainSidebarItems((key) => tNav(key), { motion: motionEnabled }),
    [tNav, motionEnabled],
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

  // An opened Spark project is a full-screen editor with its own top bar, outside the shell.
  if (isSparkEditorPath(pathname)) return <>{children}</>

  return (
    <MainLayout appName="Youtorch" sidebarItems={mainSidebarItems}>
      {children}
    </MainLayout>
  )
}

function isSparkEditorPath(pathname: string | null) {
  return Boolean(pathname?.startsWith('/spark/') && pathname.length > '/spark/'.length)
}

export function usesWorkspaceShell(pathname: string | null) {
  if (!pathname) return false
  return workspaceShellPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function SidebarFallback() {
  return <div className="h-full w-full border-r border-border bg-panel" />
}

import type { SidebarNavItem } from './app-sidebar'

export type MainSidebarOptions = {
  /** E1-D: the "Motion" entry next to Spark (the UI pod's `MOTION_UI_ENABLED` switch; off by default). */
  motion?: boolean
}

export function createMainSidebarItems(t: (key: string) => string, options: MainSidebarOptions = {}): SidebarNavItem[] {
  return [
    { id: 'new-task', label: t('newVideo'), icon: 'plus', href: '/chat?new=1' },
    { id: 'inbox', label: t('inbox'), icon: 'inbox', href: '/inbox', badge: 1 },
    { id: 'workspace-section', label: t('workspace'), type: 'section' },
    { id: 'channel-settings', label: t('channel'), icon: 'video', href: '/channels?view=settings' },
    { id: 'memory', label: t('memory'), icon: 'lightbulb', href: '/memory' },
    { id: 'connectors', label: t('connectors'), icon: 'puzzle', href: '/apps' },
    { id: 'workflows', label: t('flows'), icon: 'timeline', href: '/workflows' },
    { id: 'more-section', label: t('more'), type: 'section' },
    { id: 'spark', label: t('spark'), icon: 'clapperboard', href: '/spark' },
    ...(options.motion ? [{ id: 'motion', label: t('motion'), icon: 'motion', href: '/motion' }] : []),
  ]
}

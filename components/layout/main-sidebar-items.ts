import type { SidebarNavItem } from './app-sidebar'

export function createMainSidebarItems(t: (key: string) => string): SidebarNavItem[] {
  return [
    { id: 'new-task', label: t('newVideo'), icon: 'plus', href: '/chat?new=1' },
    { id: 'inbox', label: t('inbox'), icon: 'inbox', href: '/inbox', badge: 1 },
    { id: 'projects', label: t('projects'), icon: 'clapperboard', href: '/spark' },
    { id: 'canvas', label: t('canvas'), icon: 'canvas', href: '/canvas' },
    { id: 'workspace-section', label: t('workspace'), type: 'section' },
    { id: 'channel-settings', label: t('channel'), icon: 'video', href: '/channels?view=settings' },
    { id: 'memory', label: t('memory'), icon: 'lightbulb', href: '/memory' },
    { id: 'connectors', label: t('connectors'), icon: 'puzzle', href: '/apps' },
    { id: 'workflows', label: t('automation'), icon: 'timeline', href: '/workflows' },
  ]
}

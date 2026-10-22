import type { SidebarNavItem } from './app-sidebar'

export function createMainSidebarItems(t: (key: string) => string): SidebarNavItem[] {
  return [
    // A new video is a new project: `/new` opens one in the active channel, in the new tab, like the tab bar's "+".
    { id: 'new-task', label: t('newVideo'), icon: 'plus', href: '/new' },
    // The day's two places sit on top: what needs an answer and what goes out when.
    { id: 'inbox', label: t('inbox'), icon: 'inbox', href: '/inbox', badge: 1 },
    { id: 'calendar', label: t('calendar'), icon: 'calendar', href: '/calendar' },
    // Everything else lives in the workspace: the work first (each opens as its own tab), then what it runs on.
    { id: 'workspace-section', label: t('workspace'), type: 'section' },
    { id: 'projects', label: t('projects'), icon: 'clapperboard', href: '/spark' },
    // A canvas is a project of its own: a free node canvas, opened as its own tab like a project.
    { id: 'canvas', label: t('canvas'), icon: 'canvas', href: '/canvas' },
    { id: 'workflows', label: t('automation'), icon: 'workflow', href: '/workflows' },
    { id: 'channel-settings', label: t('channel'), icon: 'channel', href: '/channels?view=settings' },
    { id: 'memory', label: t('memory'), icon: 'memory', href: '/memory' },
    { id: 'connectors', label: t('connectors'), icon: 'plug', href: '/apps' },
  ]
}

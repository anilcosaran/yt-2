'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ExternalLink, Target, Folder, Users, Settings, Zap, Headphones, Compass, FileText, Globe, GitBranch, MoreHorizontal } from 'lucide-react'
import type { Application } from '@/lib/types'

interface AppCardProps {
  app: Application
  className?: string
}

const iconMap: Record<string, React.ReactNode> = {
  headphones: <Headphones className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  compass: <Compass className="h-5 w-5" />,
  zap: <Zap className="h-5 w-5" />,
  folder: <Folder className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
  file: <FileText className="h-5 w-5" />,
  globe: <Globe className="h-5 w-5" />,
  'git-branch': <GitBranch className="h-5 w-5" />,
  link: <ExternalLink className="h-5 w-5" />,
  help: <HelpIcon className="h-5 w-5" />,
  box: <BoxIcon className="h-5 w-5" />,
  trello: <TrelloIcon className="h-5 w-5" />,
}

export function AppCard({ app, className }: AppCardProps) {
  const icon = iconMap[app.icon] || <Folder className="h-5 w-5" />

  return (
    <Link
      href={app.href}
      target={app.isExternal ? '_blank' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm',
        className
      )}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: app.iconBg || '#6B778C' }}
      >
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{app.name}</span>
      {app.isExternal && (
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      )}
    </Link>
  )
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function TrelloIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="6" width="4" height="10" rx="1" fill="currentColor" />
      <rect x="14" y="6" width="4" height="6" rx="1" fill="currentColor" />
    </svg>
  )
}

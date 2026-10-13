'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { YoutorchIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  FileText,
  Lightbulb,
  Menu,
  MessageCircle,
  Plus,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { SidebarToggleIcon } from './sidebar-toggle-icon'

interface AppHeaderProps {
  appName?: string
  appIcon?: React.ReactNode
  onToggleDesktopSidebar?: () => void
  onOpenMobileSidebar?: () => void
  sidebarCollapsed?: boolean
  className?: string
}

export function AppHeader({
  appName = 'Youtorch',
  appIcon,
  onToggleDesktopSidebar,
  onOpenMobileSidebar,
  sidebarCollapsed = false,
  className,
}: AppHeaderProps) {
  const tAuto = useTranslations('Auto')
  const displayAppName = appName || 'Youtorch'

  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        onClick={onOpenMobileSidebar}
        aria-label={tAuto('open_menu_197101e9')}
      >
        <Menu className="size-5" />
      </Button>

      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
          onClick={onToggleDesktopSidebar}
          aria-label={tAuto('expand_sidebar_f462e889')}
        >
          <SidebarToggleIcon className="size-5" />
        </Button>
      )}

      <div className="flex items-center gap-2 md:hidden">
        {appIcon || <YoutorchIcon className="size-7" />}
        <span className="hidden text-sm font-semibold text-foreground sm:inline">{displayAppName}</span>
      </div>

      <div className="relative flex h-10 min-w-0 max-w-xl flex-1 items-center">
        <MessageCircle className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" />
        <Input
          data-app-header-search
          placeholder={tAuto('ask_anything_3030326b')}
          className="h-full w-full rounded-xl border-border bg-panel/60 pl-10 pr-3 text-sm shadow-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="hidden h-10 shrink-0 gap-2 rounded-xl border border-border bg-panel/60 px-3.5 text-sm font-medium text-foreground shadow-none hover:bg-accent sm:inline-flex"
      >
        <Sparkles className="size-4 text-primary" />
        <UiText id="ask_ai_8dbaeb8e" /></Button>

      <CreateMenu />
    </header>
  )
}

function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-10 shrink-0 gap-1.5 rounded-xl border-border bg-panel/60 px-3.5 text-sm font-semibold text-foreground shadow-none hover:bg-accent"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline"><UiText id="create_6e157c5d" /></span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-1.5">
        <DropdownMenuItem className="gap-2 rounded-md px-2 py-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <UiText id="video_olustur_6a1a648f" /></DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-md px-2 py-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <UiText id="fikir_olustur_9854f12c" /></DropdownMenuItem>
        <DropdownMenuItem className="gap-2 rounded-md px-2 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <UiText id="script_olustur_b715be2e" /></DropdownMenuItem>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem className="gap-2 rounded-md px-2 py-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <UiText id="video_yukle_145bb6f4" /></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

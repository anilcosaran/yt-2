'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Clapperboard, Plus, SquarePlus, Workflow, X, type LucideIcon } from 'lucide-react'

import { useOptionalActiveChannel } from '@/lib/channel/active-channel'
import { WORK_TAB_TRANSITION } from '@/lib/page-transitions'
import { newSparkProjectHref } from '@/lib/spark/api'
import { cn } from '@/lib/utils'
import {
  closeWorkTab,
  moveWorkTab,
  NEW_TAB_PATH,
  openNewTab,
  rememberWorkTabLocation,
  useWorkTabs,
  workTabFromPath,
  workTabHref,
  type WorkTab,
  type WorkTabKind,
} from '@/lib/work-tabs'

/** A tab's mark is its kind: a project, an automation, or the new tab. */
const KIND_ICONS: Record<WorkTabKind, LucideIcon> = { spark: Clapperboard, flow: Workflow, new: SquarePlus }

const tabKey = (tab: Pick<WorkTab, 'kind' | 'id'>) => `${tab.kind}:${tab.id}`

/** Where the new tab opens: a new project in the active channel (`/new` finds the channel itself). */
function useNewTabHref() {
  const activeChannelId = useOptionalActiveChannel()?.activeChannelId
  return activeChannelId ? newSparkProjectHref(activeChannelId) : NEW_TAB_PATH
}

/**
 * The open work in the top bar: one quiet tab per project or automation (its icon and name), and the new tab, the
 * one on screen filled (an unsaved Flow is on the new tab, `workTabFromPath`). A tab opens where it was left, at
 * once, with no motion; its cross (or a middle click) closes it, and closing the one on screen moves to its
 * neighbour. Tabs are dragged to a new place, the others making room as it passes their middle. The address of the
 * tab on screen is kept as it changes, so its view comes back with it.
 */
export function WorkTabStrip({ className }: { className?: string }) {
  const t = useTranslations('Navigation.workTabs')
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const { tabs } = useWorkTabs()
  const newTabHref = useNewTabHref()
  const active = workTabFromPath(pathname, search)
  const activeKind = active?.kind
  const activeId = active?.id
  const activeOpen = Boolean(active && tabs.some((tab) => tab.kind === active.kind && tab.id === active.id))
  const strip = React.useRef<HTMLElement>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (activeKind && activeId) rememberWorkTabLocation(activeKind, activeId, search)
  }, [activeKind, activeId, activeOpen, search])

  // The tab on screen is never left scrolled out of a crowded strip.
  const activeKey = activeOpen ? `${activeKind}:${activeId}` : null
  React.useEffect(() => {
    if (activeKey) strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeKey, tabs.length])

  if (tabs.length === 0) return null

  const close = (tab: WorkTab) => {
    const next = closeWorkTab(tab.kind, tab.id)
    if (tab.kind === activeKind && tab.id === activeId) router.push(next, { transitionTypes: [WORK_TAB_TRANSITION] })
  }

  // The dragged tab moves as soon as it passes the middle of another: past it going right, before it going left,
  // so a wide neighbour never swaps back and forth under the pointer.
  const dragOver = (event: React.DragEvent<HTMLElement>, index: number) => {
    if (!dragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const from = tabs.findIndex((tab) => tabKey(tab) === dragging)
    if (from === -1 || from === index) return
    const box = event.currentTarget.getBoundingClientRect()
    const past = event.clientX > box.left + box.width / 2
    if ((index > from && past) || (index < from && !past)) moveWorkTab(tabs[from]!.kind, tabs[from]!.id, index)
  }

  return (
    <nav
      ref={strip}
      aria-label={t('label')}
      className={cn('flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]', className)}
      // Let go anywhere on the strip: the tab is in its place already.
      onDragOver={(event) => {
        if (dragging) event.preventDefault()
      }}
      onDrop={(event) => event.preventDefault()}
    >
      {tabs.map((tab, index) => {
        const key = tabKey(tab)
        const on = tab.kind === activeKind && tab.id === activeId
        const Icon = KIND_ICONS[tab.kind]
        const title = tab.kind === 'new' ? t('newTab') : tab.title || t('untitled')
        return (
          <div
            key={key}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', title)
              setDragging(key)
            }}
            onDragOver={(event) => dragOver(event, index)}
            onDragEnd={() => setDragging(null)}
            className={cn(
              'group flex h-8 min-w-24 max-w-[15rem] shrink items-center rounded-md transition-colors',
              on
                ? 'bg-foreground/[0.07] text-foreground'
                : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
              dragging === key && 'opacity-50',
            )}
            onAuxClick={(event) => {
              if (event.button !== 1) return
              event.preventDefault()
              close(tab)
            }}
          >
            <Link
              href={tab.kind === 'new' ? newTabHref : workTabHref(tab)}
              transitionTypes={[WORK_TAB_TRANSITION]}
              aria-current={on ? 'page' : undefined}
              title={title}
              // The tab is dragged, not its link.
              draggable={false}
              className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 pr-1 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{title}</span>
            </Link>
            <button
              type="button"
              onClick={() => close(tab)}
              aria-label={t('close', { title })}
              className={cn(
                'mr-1 grid size-5 shrink-0 place-items-center rounded text-muted-foreground outline-none transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50',
                on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        )
      })}
    </nav>
  )
}

/** "+" after the strip: opens the new tab on a new project (or goes to the new tab that is open), like a browser's. */
export function NewTabButton({ className }: { className?: string }) {
  const t = useTranslations('Navigation.workTabs')
  const router = useRouter()
  const newTabHref = useNewTabHref()
  return (
    <button
      type="button"
      aria-label={t('add')}
      title={t('add')}
      onClick={() => {
        openNewTab()
        router.push(newTabHref, { transitionTypes: [WORK_TAB_TRANSITION] })
      }}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <Plus className="size-4" aria-hidden />
    </button>
  )
}

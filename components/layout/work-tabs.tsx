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

/** How far the pointer moves before a press on a tab becomes a drag (less is a click). */
const DRAG_THRESHOLD = 4
const SETTLE_MS = 160
const TAB_SLIDE = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`

type TabDrag = {
  key: string
  from: number
  /** The slot it would drop into, among all the tabs. */
  to: number
  /** How far the lifted tab is from where it started. */
  dx: number
  /** How far a tab it passes slides to make room: its width and the gap. */
  room: number
  /** Let go: gliding into its slot before the strip takes the new order. */
  settling: boolean
}

const EDGE_FADE = '24px'

/**
 * A strip with more tabs than room, like a browser's: the tabs shrink first, then the strip scrolls sideways (the
 * wheel turns into a sideways scroll over it, a touch swipes it) and fades out on the side where more tabs are
 * hidden. The tab on screen is always scrolled into view. Returns the strip's mask, or nothing when all is shown.
 */
function useStripOverflow(strip: React.RefObject<HTMLElement | null>, count: number) {
  const [hidden, setHidden] = React.useState<{ start: boolean; end: boolean }>({ start: false, end: false })
  React.useEffect(() => {
    const element = strip.current
    if (!element) return
    const update = () => {
      const max = element.scrollWidth - element.clientWidth
      const start = element.scrollLeft > 1
      const end = element.scrollLeft < max - 1
      setHidden((previous) => (previous.start === start && previous.end === end ? previous : { start, end }))
    }
    const wheel = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      element.scrollLeft += event.deltaY
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    element.addEventListener('wheel', wheel, { passive: false })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      element.removeEventListener('wheel', wheel)
      observer.disconnect()
    }
  }, [strip, count])
  if (hidden.start && hidden.end) return `linear-gradient(to right, transparent, #000 ${EDGE_FADE}, #000 calc(100% - ${EDGE_FADE}), transparent)`
  if (hidden.start) return `linear-gradient(to right, transparent, #000 ${EDGE_FADE})`
  if (hidden.end) return `linear-gradient(to right, #000 calc(100% - ${EDGE_FADE}), transparent)`
  return undefined
}

/** Where a tab is drawn during a drag: the lifted one under the pointer, the ones it passed a slot over. */
function tabOffset(drag: TabDrag, index: number) {
  if (index === drag.from) return drag.dx
  if (drag.from < index && index <= drag.to) return -drag.room
  if (drag.to <= index && index < drag.from) return drag.room
  return 0
}

/**
 * Dragging a tab along the strip, like a browser's: past a few pixels the press lifts it (raised, the grabbing hand)
 * and it follows the pointer within the strip, while the tabs it passes the middle of slide aside to show where it
 * lands. Let go, it glides into that slot and the order is kept (`moveWorkTab`); the click that ends a drag opens
 * nothing. Mouse and pen only: on touch the strip scrolls.
 */
function useTabDrag(strip: React.RefObject<HTMLElement | null>, tabs: WorkTab[]) {
  const [drag, setDrag] = React.useState<TabDrag | null>(null)
  // On the frame the new order lands, nothing slides: the tabs are already drawn where they now are.
  const [instant, setInstant] = React.useState(false)
  const cleanup = React.useRef<(() => void) | null>(null)

  React.useEffect(() => () => cleanup.current?.(), [])

  const startDrag = (event: React.PointerEvent<HTMLElement>, from: number) => {
    if (event.button !== 0 || event.pointerType === 'touch' || drag) return
    // The cross closes, it does not drag.
    if ((event.target as HTMLElement).closest('button')) return
    const boxes = Array.from(strip.current?.children ?? [], (child) => child.getBoundingClientRect())
    const box = boxes[from]
    const tab = tabs[from]
    if (!box || !tab || boxes.length !== tabs.length) return
    const startX = event.clientX
    const pointerId = event.pointerId
    const gap = boxes[from + 1] ? boxes[from + 1]!.left - box.right : from > 0 ? box.left - boxes[from - 1]!.right : 0
    const room = box.width + gap
    // Within the tabs, and within what the strip shows of them when it is scrolled.
    const shown = strip.current!.getBoundingClientRect()
    const minDx = Math.min(0, Math.max(boxes[0]!.left, shown.left) - box.left)
    const maxDx = Math.max(0, Math.min(boxes[boxes.length - 1]!.right, shown.right) - box.right)
    let current: TabDrag | null = null

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const raw = moveEvent.clientX - startX
      if (!current && Math.abs(raw) < DRAG_THRESHOLD) return
      const dx = Math.min(maxDx, Math.max(minDx, raw))
      const centre = box.left + box.width / 2 + dx
      const to = boxes.reduce((slot, other, index) => (index !== from && other.left + other.width / 2 < centre ? slot + 1 : slot), 0)
      if (!current) {
        document.documentElement.style.cursor = 'grabbing'
        document.documentElement.style.userSelect = 'none'
      }
      current = { key: tabKey(tab), from, to, dx, room, settling: false }
      setDrag(current)
    }

    const end = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      stop()
      const done = current
      if (!done) return
      // The click this release makes would open the tab: a drag is not a click.
      const swallow = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      const slot = boxes[done.to]!
      const settleDx = done.to > from ? slot.right - box.right : done.to < from ? slot.left - box.left : 0
      setDrag({ ...done, dx: settleDx, settling: true })
      const timer = window.setTimeout(() => {
        setInstant(true)
        if (done.to !== from) moveWorkTab(tab.kind, tab.id, done.to)
        setDrag(null)
        requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)))
      }, SETTLE_MS)
      cleanup.current = () => window.clearTimeout(timer)
    }

    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      document.documentElement.style.cursor = ''
      document.documentElement.style.userSelect = ''
      cleanup.current = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    cleanup.current = stop
  }

  return { drag, instant, startDrag }
}

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
  const { drag, instant, startDrag } = useTabDrag(strip, tabs)
  const edges = useStripOverflow(strip, tabs.length)

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

  return (
    <nav
      ref={strip}
      aria-label={t('label')}
      // Room above and below for a lifted tab's shadow, which the scrolling strip would otherwise cut.
      className={cn('-my-2 flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none]', className)}
      style={{ maskImage: edges, WebkitMaskImage: edges }}
    >
      {tabs.map((tab, index) => {
        const key = tabKey(tab)
        const on = tab.kind === activeKind && tab.id === activeId
        const Icon = KIND_ICONS[tab.kind]
        const title = tab.kind === 'new' ? t('newTab') : tab.title || t('untitled')
        const lifted = drag?.key === key
        const offset = drag ? tabOffset(drag, index) : 0
        return (
          <div
            key={key}
            onPointerDown={(event) => startDrag(event, index)}
            style={{
              transform: offset ? `translateX(${offset}px)` : undefined,
              // The lifted tab follows the pointer; the others slide aside, and it settles into its place.
              transition: instant ? 'none' : drag ? (lifted && !drag.settling ? 'none' : TAB_SLIDE) : undefined,
            }}
            className={cn(
              // A crowded strip squeezes the tabs; the one on screen keeps enough of its name to be read.
              'group flex h-8 max-w-[15rem] shrink select-none items-center rounded-md transition-colors',
              on ? 'min-w-40' : 'min-w-32',
              on
                ? 'bg-foreground/[0.07] text-foreground'
                : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
              lifted && 'relative z-10 scale-[1.04] bg-popover text-foreground shadow-[0_6px_18px_rgba(0,0,0,0.32)] ring-1 ring-border',
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

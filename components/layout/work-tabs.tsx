'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Clapperboard, Pin, Plus, Shapes, SquarePlus, Workflow, X, type LucideIcon } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useOptionalActiveChannel } from '@/lib/channel/active-channel'
import { WORK_TAB_TRANSITION } from '@/lib/page-transitions'
import { newSparkProjectHref } from '@/lib/spark/api'
import { cn } from '@/lib/utils'
import {
  closeOtherWorkTabs,
  closeWorkTab,
  closeWorkTabsAfter,
  moveWorkTab,
  NEW_TAB_PATH,
  openNewTab,
  rememberWorkTabLocation,
  setWorkTabPinned,
  useWorkTabs,
  workTabFromPath,
  workTabHref,
  type WorkTab,
  type WorkTabKind,
} from '@/lib/work-tabs'

/** A tab's mark is its kind: a project, an automation, a canvas, or the new tab. */
const KIND_ICONS: Record<WorkTabKind, LucideIcon> = { spark: Clapperboard, flow: Workflow, canvas: Shapes, new: SquarePlus }

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

const EDGE_FADE = 24
/** The width an arrow covers at the strip's edge; a tab scrolled to that edge stops clear of it. */
const ARROW_ROOM = 32
/** Holding an arrow: after `HOLD_DELAY` ms the strip keeps gliding, `HOLD_SPEED` px a ms, until it is let go. */
const HOLD_DELAY = 350
const HOLD_SPEED = 0.6
/** Clicks closer together than this step on from where the last one is heading, not from mid-glide. */
const STEP_CHAIN = 450

/**
 * A strip with more tabs than room, like a browser's: the tabs shrink first, then the strip scrolls sideways (the
 * wheel turns into a sideways scroll over it, a touch swipes it, an arrow shows on the side where more tabs are
 * hidden). The tab on screen is always scrolled into view. Returns which sides have tabs out of view.
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
  return hidden
}

/** The strip fades out under an arrow, so a tab passing beneath it is never read as a cut-off tab. */
function stripMask(hidden: { start: boolean; end: boolean }) {
  if (!hidden.start && !hidden.end) return undefined
  const start = hidden.start ? `transparent ${ARROW_ROOM}px, #000 ${ARROW_ROOM + EDGE_FADE}px` : '#000'
  const end = hidden.end ? `#000 calc(100% - ${ARROW_ROOM + EDGE_FADE}px), transparent calc(100% - ${ARROW_ROOM}px)` : '#000'
  return `linear-gradient(to right, ${start}, ${end})`
}

/**
 * Where one step towards `direction` lands from `from`: the first tab hidden on that side comes fully into view,
 * clear of the arrow; with none left, the strip's end.
 */
function tabStepTarget(element: HTMLElement, direction: 1 | -1, from: number) {
  const box = element.getBoundingClientRect()
  const spans = Array.from(element.children, (child) => {
    const rect = child.getBoundingClientRect()
    return { left: rect.left - box.left + element.scrollLeft, right: rect.right - box.left + element.scrollLeft }
  })
  const max = element.scrollWidth - element.clientWidth
  if (direction === 1) {
    const view = element.clientWidth - ARROW_ROOM
    const next = spans.find((span) => span.right > from + view + 1)
    return next ? Math.min(max, next.right - view) : max
  }
  const previous = spans.findLast((span) => span.left < from + ARROW_ROOM - 1)
  return previous ? Math.max(0, previous.left - ARROW_ROOM) : 0
}

/**
 * The strip's arrows: a click scrolls one tab (smoothly, unless motion is reduced), quick clicks chain on, and
 * holding one glides the strip until it is let go or reaches the end.
 */
function useStripArrows(strip: React.RefObject<HTMLElement | null>) {
  const pending = React.useRef<{ left: number; at: number } | null>(null)
  const hold = React.useRef<{ timer?: number; frame?: number; glided: boolean }>({ glided: false })

  const stop = React.useCallback(() => {
    window.clearTimeout(hold.current.timer)
    if (hold.current.frame !== undefined) cancelAnimationFrame(hold.current.frame)
    hold.current.timer = undefined
    hold.current.frame = undefined
  }, [])
  React.useEffect(() => stop, [stop])

  const step = (direction: 1 | -1) => {
    const element = strip.current
    if (!element) return
    const now = performance.now()
    const from = pending.current && now - pending.current.at < STEP_CHAIN ? pending.current.left : element.scrollLeft
    const left = tabStepTarget(element, direction, from)
    pending.current = { left, at: now }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({ left, behavior: still ? 'auto' : 'smooth' })
  }

  const glide = (direction: 1 | -1) => {
    const element = strip.current
    if (!element) return
    hold.current.glided = true
    pending.current = null
    let last = performance.now()
    const frame = (time: number) => {
      element.scrollLeft += direction * HOLD_SPEED * (time - last)
      last = time
      const max = element.scrollWidth - element.clientWidth
      // The arrow goes away at the end, so its pointer-up may never come.
      if (direction === 1 ? element.scrollLeft >= max - 1 : element.scrollLeft <= 0) stop()
      else hold.current.frame = requestAnimationFrame(frame)
    }
    hold.current.frame = requestAnimationFrame(frame)
  }

  return (direction: 1 | -1) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return
      stop()
      hold.current.glided = false
      hold.current.timer = window.setTimeout(() => glide(direction), HOLD_DELAY)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      // A hold already moved the strip; its release is not a step as well.
      if (hold.current.glided) hold.current.glided = false
      else step(direction)
    },
  })
}

function StripArrow({ side, label, ...handlers }: { side: 'start' | 'end'; label: string } & ReturnType<ReturnType<typeof useStripArrows>>) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      // Keyboard focus walks the tabs themselves, which scroll into view; the arrow is for the pointer.
      tabIndex={-1}
      aria-label={label}
      title={label}
      className={cn(
        'absolute top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
        side === 'start' ? 'left-0' : 'right-0',
      )}
      {...handlers}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
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
    // Within its part of the tabs (a pinned tab among the pinned ones, the others after them), and within what the
    // strip shows of them when it is scrolled.
    const pinned = tabs.filter((entry) => entry.pinned).length
    const first = tab.pinned ? 0 : pinned
    const last = tab.pinned ? pinned - 1 : boxes.length - 1
    const shown = strip.current!.getBoundingClientRect()
    const minDx = Math.min(0, Math.max(boxes[first]!.left, shown.left) - box.left)
    const maxDx = Math.max(0, Math.min(boxes[last]!.right, shown.right) - box.right)
    let current: TabDrag | null = null

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const raw = moveEvent.clientX - startX
      if (!current && Math.abs(raw) < DRAG_THRESHOLD) return
      const dx = Math.min(maxDx, Math.max(minDx, raw))
      const centre = box.left + box.width / 2 + dx
      const passed = boxes.reduce((slot, other, index) => (index !== from && other.left + other.width / 2 < centre ? slot + 1 : slot), 0)
      const to = Math.max(first, Math.min(last, passed))
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
 * The open work in the top bar: one quiet tab per project, automation or canvas (its icon and name), and the new tab, the
 * one on screen filled (an unsaved Flow is on the new tab, `workTabFromPath`). A tab opens where it was left, at
 * once, with no motion; its cross (or a middle click) closes it, and closing the one on screen moves to its
 * neighbour. Tabs are dragged to a new place, the others making room as it passes their middle. A right click opens a
 * tab's menu, like a browser's: pin or unpin it, close it, the others or the ones after it (pinned tabs stay). The
 * address of the tab on screen is kept as it changes, so its view comes back with it.
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
  const hidden = useStripOverflow(strip, tabs.length)
  const arrow = useStripArrows(strip)
  const mask = stripMask(hidden)

  React.useEffect(() => {
    if (activeKind && activeId) rememberWorkTabLocation(activeKind, activeId, search)
  }, [activeKind, activeId, activeOpen, search])

  // The tab on screen is never left scrolled out of a crowded strip.
  const activeKey = activeOpen ? `${activeKind}:${activeId}` : null
  React.useEffect(() => {
    if (activeKey) strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeKey, tabs.length])

  if (tabs.length === 0) return null

  const hrefOf = (tab: WorkTab) => (tab.kind === 'new' ? newTabHref : workTabHref(tab))
  const close = (tab: WorkTab) => {
    const next = closeWorkTab(tab.kind, tab.id)
    if (tab.kind === activeKind && tab.id === activeId) router.push(next, { transitionTypes: [WORK_TAB_TRANSITION] })
  }
  // Closing the others (or the ones after it) from a tab's menu: when that closes the tab on screen, go to this one.
  const activeIndex = activeOpen ? tabs.findIndex((tab) => tab.kind === activeKind && tab.id === activeId) : -1
  const activePinned = Boolean(tabs[activeIndex]?.pinned)
  const closeOthers = (tab: WorkTab, index: number) => {
    const leaves = activeIndex !== -1 && activeIndex !== index && !activePinned
    closeOtherWorkTabs(tab.kind, tab.id)
    if (leaves) router.push(hrefOf(tab), { transitionTypes: [WORK_TAB_TRANSITION] })
  }
  const closeAfter = (tab: WorkTab, index: number) => {
    const leaves = activeIndex > index && !activePinned
    closeWorkTabsAfter(tab.kind, tab.id)
    if (leaves) router.push(hrefOf(tab), { transitionTypes: [WORK_TAB_TRANSITION] })
  }

  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <nav
        ref={strip}
        aria-label={t('label')}
        // Room above and below for a lifted tab's shadow, which the scrolling strip would otherwise cut; and at the
        // sides for the arrows, so the tab on screen is never scrolled in under one.
        className="-my-2 flex min-w-0 scroll-px-8 items-center gap-1 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none]"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {tabs.map((tab, index) => {
          const key = tabKey(tab)
          const on = tab.kind === activeKind && tab.id === activeId
          const Icon = KIND_ICONS[tab.kind]
          const title = tab.kind === 'new' ? t('newTab') : tab.title || t('untitled')
          const lifted = drag?.key === key
          const offset = drag ? tabOffset(drag, index) : 0
          return (
            <ContextMenu key={key}>
              <ContextMenuTrigger asChild>
                <div
                  onPointerDown={(event) => startDrag(event, index)}
                  style={{
                    transform: offset ? `translateX(${offset}px)` : undefined,
                    // The lifted tab follows the pointer; the others slide aside, and it settles into its place.
                    transition: instant ? 'none' : drag ? (lifted && !drag.settling ? 'none' : TAB_SLIDE) : undefined,
                  }}
                  className={cn(
                    'group flex h-8 select-none items-center rounded-md transition-colors',
                    // A crowded strip squeezes the tabs; the one on screen keeps enough of its name to be read. A
                    // pinned tab keeps one short width, its name still there: every project has the same icon.
                    tab.pinned ? 'w-28 shrink-0' : cn('max-w-[15rem] shrink', on ? 'min-w-40' : 'min-w-32'),
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
                    href={hrefOf(tab)}
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
                  {tab.pinned ? (
                    // Where the cross would be: a pinned tab closes from its menu (or a middle click).
                    <span className="mr-1 grid size-5 shrink-0 place-items-center text-muted-foreground/70" title={t('pinned')}>
                      <Pin className="size-3" aria-hidden />
                    </span>
                  ) : (
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
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-44">
                {tab.kind === 'new' ? null : (
                  <ContextMenuItem onSelect={() => setWorkTabPinned(tab.kind, tab.id, !tab.pinned)}>
                    {tab.pinned ? t('unpin') : t('pin')}
                  </ContextMenuItem>
                )}
                <ContextMenuItem onSelect={() => close(tab)}>{t('closeTab')}</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={!tabs.some((other) => other !== tab && !other.pinned)}
                  onSelect={() => closeOthers(tab, index)}
                >
                  {t('closeOthers')}
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!tabs.slice(index + 1).some((other) => !other.pinned)}
                  onSelect={() => closeAfter(tab, index)}
                >
                  {t('closeRight')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </nav>
      {hidden.start ? <StripArrow side="start" label={t('scrollStart')} {...arrow(-1)} /> : null}
      {hidden.end ? <StripArrow side="end" label={t('scrollEnd')} {...arrow(1)} /> : null}
    </div>
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

'use client'

import * as React from 'react'

// Open work, as tabs in the page panel's top bar: a Spark project or a saved Flow automation, each opened straight
// into its work, and at most one new tab ("+", a new project at `/spark/new`), in the order the user dragged them
// to. Everything else is
// a page (the sidebar's, a chat, Plan › Üretim inside a project); an unsaved Flow draft is the new tab's, like
// `/spark/new`, until it is saved. A tab keeps the address it was left at (a project's view), so coming back lands
// there. Work that is open already is focused where it is, never opened twice. Pinned tabs lead the strip. At most
// `MAX_TABS` are open: one more drops the oldest that is neither pinned nor on screen. The bar's first item is the
// page the user came from (`lastPage`), kept while work is on screen. Kept per browser and cleared when another
// account signs in (`WORK_TABS_STORAGE_KEY` is principal-bound).

export type WorkTabKind = 'spark' | 'flow' | 'new'
/** The work a tab can hold; the new tab turns into one of these (`replaceWorkTab`). */
export type WorkKind = Exclude<WorkTabKind, 'new'>

export type WorkTab = {
  kind: WorkTabKind
  id: string
  title: string
  /** The query the tab was left at, without `?`. */
  search: string
  /** Kept at the start of the strip, and never closed to make room or by closing the others. */
  pinned?: boolean
}

type WorkTabsState = {
  tabs: WorkTab[]
  /** The last page of the sidebar on screen (its path), the bar's first item while work is on screen. */
  lastPage: string | null
}

export const WORK_TABS_STORAGE_KEY = 'youtorch:work-tabs:v1'
/** There is one new tab at most, so it has one id. */
export const NEW_TAB_ID = 'new'
export const NEW_TAB_PATH = '/new'
// The strip scrolls once it is full (`WorkTabStrip`), so the limit is only there to keep it from growing for ever.
const MAX_TABS = 15
/** An unsaved Flow's id (`createDraftWorkflowId` in the Flow page); saving gives it a real one. */
const FLOW_DRAFT_PREFIX = 'wf-draft-'
const EMPTY: WorkTabsState = { tabs: [], lastPage: null }

const listeners = new Set<() => void>()
let current: WorkTabsState | null = null

function parse(raw: string | null): WorkTabsState {
  if (!raw) return EMPTY
  try {
    const value = JSON.parse(raw) as Partial<WorkTabsState>
    let newTab = false
    const tabs = Array.isArray(value.tabs)
      ? value.tabs
          .filter((tab): tab is WorkTab =>
            Boolean(tab)
            && (tab.kind === 'spark' || tab.kind === 'flow' || tab.kind === 'new')
            && typeof tab.id === 'string'
            && tab.id.length > 0
            && typeof tab.title === 'string'
            && typeof tab.search === 'string')
          .filter((tab) => {
            if (tab.kind !== 'new') return true
            if (newTab) return false
            newTab = true
            return true
          })
          .map((tab) => (tab.kind === 'new'
            ? { ...tab, id: NEW_TAB_ID, search: '', pinned: undefined }
            : {
                ...tab,
                search: tab.kind === 'spark' ? projectSearchWithoutMode(tab.search) : tab.search,
                pinned: tab.pinned === true || undefined,
              }))
      : []
    const lastPage = typeof value.lastPage === 'string' && value.lastPage.startsWith('/') ? value.lastPage : null
    return { tabs: withinLimit(pinnedFirst(tabs)), lastPage }
  } catch {
    return EMPTY
  }
}

let resetRegistered = false

/**
 * Another account signed in: its storage was cleared, so forget what was read for the previous one. The principal
 * module is imported on first use, not with this one: loading it first runs into the cycle through its own
 * imports (gateway → mock → offer, which registers a resetter on load) before it is initialised.
 */
function registerPrincipalReset() {
  if (resetRegistered) return
  resetRegistered = true
  void import('@/lib/auth/browser-principal-storage').then(({ registerBrowserPrincipalLifecycleResetter }) =>
    registerBrowserPrincipalLifecycleResetter(() => {
      current = null
      listeners.forEach((listener) => listener())
    }),
  )
}

function read(): WorkTabsState {
  registerPrincipalReset()
  if (current) return current
  try {
    current = parse(window.localStorage.getItem(WORK_TABS_STORAGE_KEY))
  } catch {
    current = EMPTY
  }
  return current
}

function write(next: WorkTabsState) {
  if (next === current) return
  current = next
  try {
    window.localStorage.setItem(WORK_TABS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The tabs still hold for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another browser tab opened or closed work: read it again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== WORK_TABS_STORAGE_KEY && event.key !== null) return
    current = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The open tabs and the last page; empty on the server and until hydration. */
export function useWorkTabs() {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY)
}

const same = (tab: WorkTab, kind: WorkTabKind, id: string) => tab.kind === kind && tab.id === id

/** Pinned tabs lead the strip; each part keeps its own order. */
function pinnedFirst(tabs: WorkTab[]) {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)]
}

/**
 * At most `MAX_TABS`, without asking: past it the first tabs in the strip go (it is in the order work was opened,
 * unless tabs were dragged; a pick in the new tab takes that tab's spot), skipping the pinned ones, the one on
 * screen and `keep` (the one just opened). With nothing else left to close, the strip holds more.
 */
function withinLimit(tabs: WorkTab[], keep?: WorkTab): WorkTab[] {
  if (tabs.length <= MAX_TABS) return tabs
  const onScreen = typeof window === 'undefined' ? null : workTabFromPath(window.location.pathname, window.location.search)
  const kept = [...tabs]
  while (kept.length > MAX_TABS) {
    const oldest = kept.findIndex((tab) => !tab.pinned && tab !== keep && !(onScreen && same(tab, onScreen.kind, onScreen.id)))
    if (oldest === -1) return kept
    kept.splice(oldest, 1)
  }
  return kept
}

export function workTabPath(kind: WorkTabKind, id: string) {
  if (kind === 'new') return NEW_TAB_PATH
  return kind === 'spark' ? `/spark/${encodeURIComponent(id)}` : `/workflows/${encodeURIComponent(id)}`
}

export function workTabHref(tab: Pick<WorkTab, 'kind' | 'id' | 'search'>) {
  return `${workTabPath(tab.kind, tab.id)}${tab.search ? `?${tab.search}` : ''}`
}

/**
 * The tab an address belongs to: `/spark/<projectId>`, `/workflows/<workflowId>`, or the new tab's `/new`. Work
 * not made yet is the new tab's too, and becomes its own tab in the same spot once it is: a new project before its
 * first sentence (`/spark/new`) and an unsaved Flow (`/workflows?draftId=wf-draft-…`, `/workflows?new=1`). `search`
 * is the address's query, with or without `?`; without it a draft reads as the automation list.
 */
export function workTabFromPath(pathname: string | null, search?: string | null): { kind: WorkTabKind; id: string } | null {
  const newTab = { kind: 'new' as const, id: NEW_TAB_ID }
  if (pathname === NEW_TAB_PATH || pathname === '/spark/new') return newTab
  if ((pathname === '/workflows' || pathname === '/workflows/') && search) {
    const params = new URLSearchParams(search)
    if (params.get('new') === '1' || params.get('draftId')?.startsWith(FLOW_DRAFT_PREFIX)) return newTab
    return null
  }
  const match = pathname?.match(/^\/(spark|workflows)\/([^/]+)\/?$/)
  if (!match) return null
  const kind: WorkTabKind = match[1] === 'spark' ? 'spark' : 'flow'
  let id: string
  try {
    id = decodeURIComponent(match[2]!)
  } catch {
    return null
  }
  // `/spark/lab` is the workspace without a project.
  if (kind === 'spark' && (id === 'new' || id === 'lab')) return null
  // A draft at its own address is sent on to `?draftId=`; it is not saved work either.
  if (kind === 'flow' && id.startsWith(FLOW_DRAFT_PREFIX)) return newTab
  return { kind, id }
}

/**
 * A project's query without the Flow mode projects used to have (`mode=flow`): its canvas is Plan › Üretim now
 * (`v=b&board=flow`). Any other query comes back as it was.
 */
export function projectSearchWithoutMode(search: string): string {
  const params = new URLSearchParams(search)
  if (!params.has('mode')) return search
  const flow = params.get('mode') === 'flow'
  params.delete('mode')
  if (flow) {
    params.set('v', 'b')
    params.set('board', 'flow')
  }
  return params.toString()
}

/** Where opening a Spark project lands: its open tab where it was left, otherwise the project. Client only. */
export function sparkProjectWorkHref(projectId: string) {
  const tab = read().tabs.find((entry) => same(entry, 'spark', projectId))
  return tab ? workTabHref(tab) : workTabPath('spark', projectId)
}

/** The tabs with `tab` named `title` (an empty title keeps its name). */
function renamed(tabs: WorkTab[], tab: WorkTab, title: string) {
  if (!title || tab.title === title) return tabs
  return tabs.map((entry) => (entry === tab ? { ...entry, title } : entry))
}

/**
 * Opens a tab for the work at the end of the strip, or names the open one again where it is. One past `MAX_TABS`
 * drops the oldest tab not on screen.
 */
export function openWorkTab(input: { kind: WorkKind; id: string; title: string }) {
  const state = read()
  const existing = state.tabs.find((tab) => same(tab, input.kind, input.id))
  if (existing) {
    const tabs = renamed(state.tabs, existing, input.title)
    if (tabs !== state.tabs) write({ ...state, tabs })
    return
  }
  const tab: WorkTab = { kind: input.kind, id: input.id, title: input.title, search: '' }
  write({ ...state, tabs: withinLimit([...state.tabs, tab], tab) })
}

/** Opens the new tab at the end of the strip, unless it is open already. Returns its address. */
export function openNewTab() {
  const state = read()
  if (!state.tabs.some((tab) => tab.kind === 'new')) {
    const tab: WorkTab = { kind: 'new', id: NEW_TAB_ID, title: '', search: '' }
    write({ ...state, tabs: withinLimit([...state.tabs, tab], tab) })
  }
  return NEW_TAB_PATH
}

/**
 * What was picked in the new tab takes its place in the strip: the work's tab, or nothing when the pick is a page.
 * Work that is open already keeps its tab where it is (where it was left, too) and the new tab closes. Without a
 * new tab, work opens as usual.
 */
export function replaceWorkTab(next: { kind: WorkKind; id: string; title: string } | null) {
  const state = read()
  const index = state.tabs.findIndex((tab) => tab.kind === 'new')
  if (index === -1) {
    if (next) openWorkTab(next)
    return
  }
  const existing = next ? state.tabs.find((tab) => same(tab, next.kind, next.id)) : undefined
  if (!next || existing) {
    const tabs = state.tabs.filter((_, position) => position !== index)
    write({ ...state, tabs: existing && next ? renamed(tabs, existing, next.title) : tabs })
    return
  }
  const tab: WorkTab = { kind: next.kind, id: next.id, title: next.title, search: '' }
  write({ ...state, tabs: state.tabs.map((entry, position) => (position === index ? tab : entry)) })
}

/**
 * Moves a tab to `index` in the strip (dragged there), within its part: a pinned tab among the pinned ones, the
 * others after them. The others keep their order.
 */
export function moveWorkTab(kind: WorkTabKind, id: string, index: number) {
  const state = read()
  const from = state.tabs.findIndex((tab) => same(tab, kind, id))
  if (from === -1) return
  const pinned = state.tabs.filter((tab) => tab.pinned).length
  const [first, last] = state.tabs[from]!.pinned ? [0, pinned - 1] : [pinned, state.tabs.length - 1]
  const to = Math.max(first, Math.min(index, last))
  if (from === to) return
  const tabs = [...state.tabs]
  const [tab] = tabs.splice(from, 1)
  tabs.splice(to, 0, tab!)
  write({ ...state, tabs })
}

/** The address an open tab is at now (a project's view). The new tab always opens on a new project. */
export function rememberWorkTabLocation(kind: WorkTabKind, id: string, search: string) {
  if (kind === 'new') return
  const state = read()
  const tab = state.tabs.find((entry) => same(entry, kind, id))
  if (!tab || tab.search === search) return
  write({ ...state, tabs: state.tabs.map((entry) => (entry === tab ? { ...entry, search } : entry)) })
}

/** The sidebar page on screen, kept as the bar's first item while work is on screen. */
export function rememberLastPage(path: string) {
  const state = read()
  if (state.lastPage !== path) write({ ...state, lastPage: path })
}

/**
 * Closes a tab. Returns where to go when it was the one on screen: the tab after it, else the one before it, else
 * the list its work came from (for the new tab, the page the user came from).
 */
export function closeWorkTab(kind: WorkTabKind, id: string): string {
  const state = read()
  const index = state.tabs.findIndex((tab) => same(tab, kind, id))
  const fallback = kind === 'spark' ? '/spark' : kind === 'flow' ? '/workflows' : state.lastPage ?? '/dashboard'
  if (index === -1) return fallback
  const tabs = state.tabs.filter((_, position) => position !== index)
  write({ ...state, tabs })
  const neighbour = tabs[index] ?? tabs[index - 1]
  return neighbour ? workTabHref(neighbour) : fallback
}

/** Pins a tab (after the pinned ones) or unpins it (first after them). The new tab is not pinned. */
export function setWorkTabPinned(kind: WorkTabKind, id: string, pinned: boolean) {
  if (kind === 'new') return
  const state = read()
  const tab = state.tabs.find((entry) => same(entry, kind, id))
  if (!tab || Boolean(tab.pinned) === pinned) return
  const rest = state.tabs.filter((entry) => entry !== tab)
  const at = rest.filter((entry) => entry.pinned).length
  write({ ...state, tabs: [...rest.slice(0, at), { ...tab, pinned: pinned || undefined }, ...rest.slice(at)] })
}

/** Closes every tab but this one and the pinned ones. */
export function closeOtherWorkTabs(kind: WorkTabKind, id: string) {
  const state = read()
  const tabs = state.tabs.filter((tab) => tab.pinned || same(tab, kind, id))
  if (tabs.length !== state.tabs.length) write({ ...state, tabs })
}

/** Closes the tabs after this one in the strip, except the pinned ones. */
export function closeWorkTabsAfter(kind: WorkTabKind, id: string) {
  const state = read()
  const index = state.tabs.findIndex((tab) => same(tab, kind, id))
  if (index === -1) return
  const tabs = state.tabs.filter((tab, position) => position <= index || tab.pinned)
  if (tabs.length !== state.tabs.length) write({ ...state, tabs })
}

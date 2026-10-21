'use client'

import * as React from 'react'

// The channel's calendar (`/calendar`): its videos only — published, scheduled, waiting for approval — and the strong
// slots still empty. Real YouTube publishing is not supported yet (`YOUTUBE_UPLOAD_PUBLISH_UNSUPPORTED`), so the
// calendar is a demo store: a seed laid around today plus what the user changed, kept per browser (best effort) and
// cleared when another account signs in (the `youtorch:youtube-` prefix is principal-bound).
//
// Times are wall-clock times: a `Date` whose UTC fields are the viewer's local clock (`wallNow`). The app formats
// dates in UTC (next-intl `timeZone: 'UTC'`), so what is stored is exactly what is shown, with no DST arithmetic.

export type CalendarStatus = 'live' | 'scheduled' | 'review' | 'approved'
export type CalendarSource = 'spark' | 'short' | 'flow'

export type CalendarItem = {
  id: string
  title: string
  thumbnail: string | null
  source: CalendarSource
  /** `approved`: a clip that passed review and waits for a slot (`at` is null); the rest are on the calendar. */
  status: CalendarStatus
  /** Wall-clock ISO time; null for an approved clip without a slot. */
  at: string | null
  views?: number
  /** A scheduled automation (Flow), shown for reference: not moved or approved here. */
  automation?: boolean
}

export type NewCalendarItem = Pick<CalendarItem, 'title' | 'source'> & {
  id?: string
  thumbnail?: string | null
  at: Date
  status: Exclude<CalendarStatus, 'approved'>
}

export type SlotReason = 'peak' | 'evening' | 'weekend'
export type StrongSlot = { at: Date; reason: SlotReason }

export const CALENDAR_STORAGE_KEY = 'youtorch:youtube-calendar:v1'
const DAY_MS = 86_400_000
/** A strong slot counts as taken when a video goes out this close to it. */
const SLOT_TAKEN_MS = 3 * 3_600_000

/** The channel's strongest hours, Monday = 0: when its audience watches most. */
const STRONG_HOURS: { weekday: number; hour: number; reason: SlotReason }[] = [
  { weekday: 1, hour: 18, reason: 'evening' },
  { weekday: 4, hour: 21, reason: 'peak' },
  { weekday: 6, hour: 12, reason: 'weekend' },
]

// ---------- wall-clock dates ----------

/** The viewer's local clock as a wall-clock date, to the minute. */
export function wallNow(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()))
}

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Monday 0 … Sunday 6. */
export function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -weekdayIndex(date))
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

/** `2026-10-24`, the calendar's `?date=`. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parseDayKey(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The same day at another wall-clock time. */
export function withTime(day: Date, hours: number, minutes: number): Date {
  return new Date(startOfDay(day).getTime() + (hours * 60 + minutes) * 60_000)
}

/** The calendar page focused on an item's day and on the item. */
export function calendarHref(item: Pick<CalendarItem, 'id' | 'at'>): string {
  const params = new URLSearchParams()
  if (item.at) params.set('date', item.at.slice(0, 10))
  params.set('item', item.id)
  return `/calendar?${params.toString()}`
}

export function itemDate(item: CalendarItem): Date | null {
  return item.at ? new Date(item.at) : null
}

// ---------- the seed: the channel's videos around today ----------

type SeedEntry = Omit<CalendarItem, 'at'> & { day: number; hour: number; minute?: number }

const SEED: SeedEntry[] = [
  { id: 'seed-live-1', day: -1, hour: 18, title: 'Yapay zekâyla 1 saatte 10 Shorts', thumbnail: '/flows/tips.png', source: 'spark', status: 'live', views: 12_400 },
  { id: 'seed-live-2', day: -4, hour: 12, title: 'Telefonla stüdyo ışığı: 3 adım', thumbnail: '/brand/avatars/presenter.jpg', source: 'short', status: 'live', views: 3_100 },
  { id: 'seed-live-3', day: -6, hour: 19, minute: 30, title: 'Kanal büyütürken yapılan 5 hata', thumbnail: '/brand/avatars/studio.jpg', source: 'spark', status: 'live', views: 28_900 },
  { id: 'seed-live-4', day: -9, hour: 12, title: 'İlk videoya hazırlık listesi', thumbnail: '/flows/course.png', source: 'short', status: 'live', views: 5_600 },
  { id: 'seed-live-5', day: -13, hour: 18, title: 'Mikrofon seçimi: 3 bütçe, 1 kazanan', thumbnail: '/flows/expert.png', source: 'spark', status: 'live', views: 41_200 },
  { id: 'seed-live-6', day: -17, hour: 12, title: 'Kurguda zaman kazandıran kısayol', thumbnail: '/brand/avatars/man.jpg', source: 'short', status: 'live', views: 2_300 },
  { id: 'seed-scheduled-1', day: 1, hour: 18, title: 'Ürün incelemesi: 30 gün sonra', thumbnail: '/flows/sales.png', source: 'spark', status: 'scheduled' },
  { id: 'seed-review-1', day: 2, hour: 12, title: 'İlk 3 saniyede izleyiciyi tut', thumbnail: '/brand/avatars/closeup.jpg', source: 'short', status: 'review' },
  { id: 'seed-review-2', day: 2, hour: 19, minute: 30, title: 'Işık kurulumunda tek hata', thumbnail: '/brand/avatars/side.jpg', source: 'short', status: 'review' },
  { id: 'seed-flow-1', day: 4, hour: 10, title: 'Haftalık trend özeti', thumbnail: '/flows/news.png', source: 'flow', status: 'scheduled', automation: true },
  { id: 'seed-scheduled-2', day: 5, hour: 12, title: 'Kısa kurgu: önce/sonra', thumbnail: '/brand/avatars/woman.jpg', source: 'short', status: 'scheduled' },
  { id: 'seed-scheduled-3', day: 8, hour: 18, title: 'Bir videoyu baştan sona planlamak', thumbnail: '/flows/educational.png', source: 'spark', status: 'scheduled' },
  { id: 'seed-review-3', day: 10, hour: 12, title: 'Yorumlardan video fikri çıkarmak', thumbnail: '/brand/avatars/anchor.jpg', source: 'short', status: 'review' },
  { id: 'seed-flow-2', day: 11, hour: 10, title: 'Haftalık trend özeti', thumbnail: '/flows/news.png', source: 'flow', status: 'scheduled', automation: true },
  { id: 'seed-scheduled-4', day: 15, hour: 21, title: 'Sorularınızı yanıtlıyorum #4', thumbnail: '/brand/avatars/character.jpg', source: 'spark', status: 'scheduled' },
]

/** Clips that passed review and wait for a slot ("Doldur" lists them). */
const SEED_APPROVED: Omit<CalendarItem, 'at' | 'status'>[] = [
  { id: 'seed-approved-1', title: 'Kurguda 3 kısayol', thumbnail: '/brand/avatars/creature.jpg', source: 'short' },
  { id: 'seed-approved-2', title: 'Mikrofonsuz temiz ses', thumbnail: '/brand/avatars/presenter.jpg', source: 'short' },
]

function seedItems(now: Date): CalendarItem[] {
  const today = startOfDay(now)
  return [
    ...SEED.map(({ day, hour, minute = 0, ...item }) => ({ ...item, at: withTime(addDays(today, day), hour, minute).toISOString() })),
    ...SEED_APPROVED.map((item) => ({ ...item, status: 'approved' as const, at: null })),
  ]
}

// ---------- the store ----------

type Patch = { at?: string | null; status?: CalendarStatus }
type Persisted = { added: CalendarItem[]; patches: Record<string, Patch> }

const EMPTY: Persisted = { added: [], patches: {} }
const listeners = new Set<() => void>()
let persisted: Persisted | null = null
let snapshot: CalendarItem[] | null = null
let resetRegistered = false

const STATUSES: readonly CalendarStatus[] = ['live', 'scheduled', 'review', 'approved']
const SOURCES: readonly CalendarSource[] = ['spark', 'short', 'flow']

function isItem(value: unknown): value is CalendarItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CalendarItem>
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && (item.thumbnail === null || typeof item.thumbnail === 'string')
    && SOURCES.includes(item.source as CalendarSource)
    && STATUSES.includes(item.status as CalendarStatus)
    && (item.at === null || (typeof item.at === 'string' && !Number.isNaN(Date.parse(item.at))))
}

function parse(raw: string | null): Persisted {
  if (!raw) return EMPTY
  try {
    const value = JSON.parse(raw) as Partial<Persisted>
    const added = Array.isArray(value.added) ? value.added.filter(isItem) : []
    const patches: Record<string, Patch> = {}
    if (value.patches && typeof value.patches === 'object') {
      for (const [id, patch] of Object.entries(value.patches)) {
        if (!patch || typeof patch !== 'object') continue
        const next: Patch = {}
        if (patch.at === null || (typeof patch.at === 'string' && !Number.isNaN(Date.parse(patch.at)))) next.at = patch.at
        if (STATUSES.includes(patch.status as CalendarStatus)) next.status = patch.status
        patches[id] = next
      }
    }
    return { added, patches }
  } catch {
    return EMPTY
  }
}

/** Another account signed in: its storage was cleared, so forget what was read for the previous one. */
function registerPrincipalReset() {
  if (resetRegistered) return
  resetRegistered = true
  void import('@/lib/auth/browser-principal-storage').then(({ registerBrowserPrincipalLifecycleResetter }) =>
    registerBrowserPrincipalLifecycleResetter(() => {
      persisted = null
      snapshot = null
      listeners.forEach((listener) => listener())
    }),
  )
}

function readPersisted(): Persisted {
  registerPrincipalReset()
  if (persisted) return persisted
  try {
    persisted = parse(window.localStorage.getItem(CALENDAR_STORAGE_KEY))
  } catch {
    persisted = EMPTY
  }
  return persisted
}

function write(next: Persisted) {
  persisted = next
  snapshot = null
  try {
    window.localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The calendar still holds for this visit.
  }
  listeners.forEach((listener) => listener())
}

/** Every item, the seed with the user's changes applied; stable until the next change. */
export function getCalendarItems(): CalendarItem[] {
  if (snapshot) return snapshot
  const { added, patches } = readPersisted()
  const seed = seedItems(wallNow())
  const seedIds = new Set(seed.map((item) => item.id))
  snapshot = [...seed, ...added.filter((item) => !seedIds.has(item.id))].map((item) => {
    const patch = patches[item.id]
    return patch ? { ...item, ...patch } : item
  })
  return snapshot
}

export function subscribeCalendar(listener: () => void) {
  listeners.add(listener)
  // Another browser tab changed the calendar: read it again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CALENDAR_STORAGE_KEY && event.key !== null) return
    persisted = null
    snapshot = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The calendar's items; null on the server and until hydration. */
export function useCalendarItems(): CalendarItem[] | null {
  return React.useSyncExternalStore(subscribeCalendar, getCalendarItems, () => null)
}

export function findCalendarItem(id: string): CalendarItem | null {
  return getCalendarItems().find((item) => item.id === id) ?? null
}

function patchItem(id: string, patch: Patch) {
  const state = readPersisted()
  const addedIndex = state.added.findIndex((item) => item.id === id)
  if (addedIndex >= 0) {
    const added = state.added.slice()
    added[addedIndex] = { ...added[addedIndex]!, ...patch }
    write({ ...state, added })
    return
  }
  write({ ...state, patches: { ...state.patches, [id]: { ...state.patches[id], ...patch } } })
}

/** Adds a video to the calendar; an `id` already on it is placed again instead (the same clip twice is one item). */
export function addCalendarItem(input: NewCalendarItem): CalendarItem {
  const at = input.at.toISOString()
  const existing = input.id ? findCalendarItem(input.id) : null
  if (existing) {
    patchItem(existing.id, { at, status: input.status })
    return { ...existing, at, status: input.status }
  }
  const item: CalendarItem = {
    id: input.id ?? `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title.trim() || 'Video',
    thumbnail: input.thumbnail ?? null,
    source: input.source,
    status: input.status,
    at,
  }
  const state = readPersisted()
  write({ ...state, added: [...state.added, item] })
  return item
}

/** Reschedules an item to another day, keeping its time of day. Published videos and automations stay put. */
export function moveCalendarItem(id: string, day: Date): CalendarItem | null {
  const item = findCalendarItem(id)
  const from = item ? itemDate(item) : null
  if (!item || !from || !canMove(item)) return null
  const at = new Date(startOfDay(day).getTime() + (from.getTime() - startOfDay(from).getTime())).toISOString()
  patchItem(id, { at })
  return { ...item, at }
}

/** Approves a clip waiting for review (or an approved one without a slot) and puts it at `at`. */
export function approveCalendarItem(id: string, at: Date, status: 'live' | 'scheduled' = 'scheduled'): CalendarItem | null {
  const item = findCalendarItem(id)
  if (!item || item.automation) return null
  const iso = at.toISOString()
  patchItem(id, { at: iso, status })
  return { ...item, at: iso, status }
}

export function canMove(item: CalendarItem): boolean {
  return !item.automation && (item.status === 'scheduled' || item.status === 'review')
}

// ---------- strong slots ----------

/** The strong slots in [from, to) that are still ahead of `now` and empty. */
export function strongSlotsBetween(from: Date, to: Date, items: readonly CalendarItem[], now: Date): StrongSlot[] {
  const taken = items
    .filter((item) => item.at && item.status !== 'approved')
    .map((item) => Date.parse(item.at!))
  const slots: StrongSlot[] = []
  for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
    for (const strong of STRONG_HOURS) {
      if (strong.weekday !== weekdayIndex(day)) continue
      const at = withTime(day, strong.hour, 0)
      if (at <= now || at >= to || at < from) continue
      if (taken.some((time) => Math.abs(time - at.getTime()) < SLOT_TAKEN_MS)) continue
      slots.push({ at, reason: strong.reason })
    }
  }
  return slots
}

/** The next empty strong slots from `now`, the soonest first. */
export function nextStrongSlots(items: readonly CalendarItem[], now: Date, count = 3): StrongSlot[] {
  return strongSlotsBetween(now, addDays(startOfDay(now), 28), items, now).slice(0, count)
}

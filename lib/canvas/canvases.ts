'use client'

import * as React from 'react'

// The user's canvases: each one a project of its own, a free node canvas (`components/canvas`) that opens as a work
// tab (`lib/work-tabs.ts`, kind `canvas`). Only the list is kept here, in this browser (`yt2.canvases`), the most
// recently changed first; without storage it holds for this visit. What is on a canvas is its run (`useLabRun`, key
// `canvas:<id>`), kept in memory while the app runs.

export type Canvas = {
  id: string
  title: string
  /** Epoch milliseconds. */
  createdAt: number
  /** Epoch milliseconds: made, renamed or opened. */
  updatedAt: number
}

export const CANVASES_STORAGE_KEY = 'yt2.canvases'
const DEFAULT_TITLE = 'Adsız canvas'
const MAX_TITLE = 80

const listeners = new Set<() => void>()
let current: Canvas[] | null = null

const newestFirst = (a: Canvas, b: Canvas) => b.updatedAt - a.updatedAt

function isCanvas(value: unknown): value is Canvas {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<Canvas>
  return typeof entry.id === 'string'
    && entry.id.length > 0
    && typeof entry.title === 'string'
    && Number.isFinite(entry.createdAt)
    && Number.isFinite(entry.updatedAt)
}

function parse(raw: string | null): Canvas[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value
      .filter(isCanvas)
      .filter((entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      })
      .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }))
      .sort(newestFirst)
  } catch {
    return []
  }
}

function read(): Canvas[] {
  if (current) return current
  try {
    current = parse(window.localStorage.getItem(CANVASES_STORAGE_KEY))
  } catch {
    current = []
  }
  return current
}

function write(next: Canvas[]) {
  current = next
  try {
    window.localStorage.setItem(CANVASES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The list still holds for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another browser tab changed the list: read it again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CANVASES_STORAGE_KEY && event.key !== null) return
    current = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const cleanTitle = (title: string | undefined) => title?.trim().slice(0, MAX_TITLE) ?? ''

/** The canvases, the most recently changed first. Client only. */
export function listCanvases(): Canvas[] {
  return read()
}

/** Makes a canvas at the head of the list and returns it. */
export function createCanvas(title?: string): Canvas {
  const now = Date.now()
  const canvas: Canvas = {
    id: `cv-${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    title: cleanTitle(title) || DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
  }
  write([canvas, ...read()])
  return canvas
}

/** Names a canvas again; an empty name keeps the one it has. */
export function renameCanvas(id: string, title: string) {
  const name = cleanTitle(title)
  const list = read()
  const canvas = list.find((entry) => entry.id === id)
  if (!canvas || !name || canvas.title === name) return
  write(list.map((entry) => (entry === canvas ? { ...entry, title: name, updatedAt: Date.now() } : entry)).sort(newestFirst))
}

/** Marks a canvas as just used (it was opened), which brings it to the head of the list. */
export function touchCanvas(id: string) {
  const list = read()
  const canvas = list.find((entry) => entry.id === id)
  if (!canvas) return
  write(list.map((entry) => (entry === canvas ? { ...entry, updatedAt: Date.now() } : entry)).sort(newestFirst))
}

export function removeCanvas(id: string) {
  const list = read()
  if (list.some((entry) => entry.id === id)) write(list.filter((entry) => entry.id !== id))
  try {
    window.localStorage.removeItem(canvasContentKey(id))
  } catch {
    // Storage is unavailable: there is nothing kept to remove.
  }
}

/** Where what is on a canvas is kept in this browser (`canvas-editor.tsx`), apart from the list. */
export const canvasContentKey = (id: string) => `yt2.canvas.${id}`

/** The canvases, the most recently changed first; `null` until they are read on the client (server, hydration). */
export function useCanvases(): Canvas[] | null {
  return React.useSyncExternalStore<Canvas[] | null>(subscribe, read, () => null)
}

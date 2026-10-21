'use client'

import * as React from 'react'

// One clock for the canvas pages' relative times ("2 dakika önce"): the current time on the client, moved on every
// `TICK_MS` while something shows it. Read on the client only (0 on the server and while hydrating), so a time is
// never measured from when the page was first served.

const TICK_MS = 30_000

const listeners = new Set<() => void>()
let now = 0
let timer: number | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    // Nothing showed a time for a while: start from now, not from the last tick.
    now = Date.now()
    timer = window.setInterval(() => {
      now = Date.now()
      listeners.forEach((entry) => entry())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}

function read() {
  if (!now) now = Date.now()
  return now
}

/** The current time in epoch milliseconds, kept fresh to half a minute; 0 until it is read on the client. */
export function useClock() {
  return React.useSyncExternalStore(subscribe, read, () => 0)
}

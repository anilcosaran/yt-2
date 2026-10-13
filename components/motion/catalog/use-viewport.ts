'use client'

import * as React from 'react'

/** True while the element is within (a margin around) the viewport. Without `IntersectionObserver` it is always true. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin = '160px'): boolean {
  const [inView, setInView] = React.useState(() => typeof IntersectionObserver === 'undefined')
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1]
      if (latest) setInView(latest.isIntersecting)
    }, { rootMargin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin])
  return inView
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The user's `prefers-reduced-motion` setting (false where it cannot be read, e.g. on the server). */
export function usePrefersReducedMotion(): boolean {
  const subscribe = React.useCallback((listener: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    query.addEventListener?.('change', listener)
    return () => query.removeEventListener?.('change', listener)
  }, [])
  const read = React.useCallback(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY).matches : false), [])
  return React.useSyncExternalStore(subscribe, read, () => false)
}

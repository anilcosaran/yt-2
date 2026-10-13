'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const GIVE_UP_MS = 12_000

/**
 * A thin bar along the top while a page is on its way: a click on an in-app link shows at once that something is
 * happening, before the page (or its loading state) arrives and the page transition plays. The bar waits a beat
 * before it shows (`nav-progress`), so an instant navigation shows nothing, and it ends when the address changes.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const location = `${pathname}?${search.toString()}`
  const [state, setState] = React.useState({ active: false, at: location })
  if (state.at !== location) setState({ active: false, at: location })

  React.useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setState((current) => ({ ...current, active: true }))
    }
    // Capture: a Next link handles the click itself (and prevents the default) after this runs.
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  React.useEffect(() => {
    if (!state.active) return
    const timer = window.setTimeout(() => setState((current) => ({ ...current, active: false })), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [state.active])

  if (!state.active) return null
  return <div aria-hidden="true" className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" />
}

'use client'

import * as React from 'react'
import localFont from 'next/font/local'

import { STUDIO_ICON_SPRITE } from '../studio/studio-icons'
import { LabOverlayContext } from './lab-context'
import { ratioOf, type LabRatio } from './lab-model'
import '../studio/studio.css'
import './lab.css'
import './lab-look.css'

// Symbols the design sprite does not have, in its own line style (24 px box, strokes only).
export const LAB_SYMBOLS = [
  '<symbol id="i-split" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></symbol>',
  '<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
  '<symbol id="i-magnet" viewBox="0 0 24 24"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/></symbol>',
  '<symbol id="i-note" viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13h6M8 17h4"/></symbol>',
  '<symbol id="i-brain" viewBox="0 0 24 24"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></symbol>',
].join('')

// The display face of the Spark design (`--st-font-display` in `studio.css`).
export const instrumentSans = localFont({
  src: '../../../app/fonts/InstrumentSans-Variable.woff2',
  weight: '400 600',
  style: 'normal',
  variable: '--font-instrument-sans',
  display: 'swap',
})

/** A scrollbar shows while its pane is being scrolled and goes a moment after (see `lab.css`). */
export function useLabScrollbars() {
  const fading = React.useRef(new WeakMap<Element, number>())
  return React.useCallback((event: React.UIEvent) => {
    const pane = event.target
    if (!(pane instanceof HTMLElement)) return
    pane.classList.add('lb-scroller', 'lb-scrolling')
    window.clearTimeout(fading.current.get(pane))
    fading.current.set(pane, window.setTimeout(() => pane.classList.remove('lb-scrolling'), 900))
  }, [])
}

/**
 * The Spark workspace's style scope for its parts shown somewhere else (the plan canvas of the main Chat): the calm
 * shapes, the studio root with the format's ratio, the icon sprite and the overlay layer the Flow board mounts in.
 * It fills its parent, which gives it its size.
 */
export function LabFrame({ ratio, className, children }: { ratio: LabRatio; className?: string; children: React.ReactNode }) {
  const [overlay, setOverlay] = React.useState<HTMLDivElement | null>(null)
  const showScrollbar = useLabScrollbars()
  const shape = ratioOf(ratio)
  return (
    <div className={`lb-calm relative h-full overflow-hidden${className ? ` ${className}` : ''}`}>
      <LabOverlayContext.Provider value={overlay}>
        <div className={`yt-studio lb-root ${instrumentSans.variable}`} data-ratio={shape.id} onScrollCapture={showScrollbar} style={{ '--lb-ar': shape.css, '--lb-r': shape.value } as React.CSSProperties}>
          <svg aria-hidden style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: STUDIO_ICON_SPRITE + LAB_SYMBOLS }} />
          <div className="st-shell lb-shell">{children}</div>
        </div>
        <div className="lb-overlay" ref={setOverlay} />
      </LabOverlayContext.Provider>
    </div>
  )
}

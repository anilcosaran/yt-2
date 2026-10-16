'use client'

import dynamic from 'next/dynamic'

import { CanvasLoading } from './canvas-loading'

// Boards live in this browser: the canvas renders on the client only, with the loading board in its place meanwhile.
const CanvasWorkspace = dynamic(() => import('./canvas-workspace').then((mod) => mod.CanvasWorkspace), {
  ssr: false,
  loading: () => <CanvasLoading />,
})

/** `/canvas` opens the last board, `/canvas/<id>` that board (read from the address). */
export function CanvasPage() {
  return (
    <div className="h-full min-h-0">
      <CanvasWorkspace />
    </div>
  )
}

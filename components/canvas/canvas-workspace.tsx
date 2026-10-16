'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shapes } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

import { CanvasEditor } from './canvas-editor'
import { useCanvasStore } from './canvas-store'

const BOARD_PATH = '/canvas/'

/**
 * The board to show: the one in the address, else the last one opened. Boards live in this browser, so opening
 * another one only changes the address (history API, which Next's router follows): no page load, back and forward work.
 */
export function CanvasWorkspace() {
  const pathname = usePathname()
  const fromPath = pathname?.startsWith(BOARD_PATH) ? decodeURIComponent(pathname.slice(BOARD_PATH.length)) : null
  // The board just opened, until the address has caught up (deleting the open board must not flash "not found").
  const [pending, setPending] = React.useState<string | null>(null)
  if (pending && pending === fromPath) setPending(null)
  const lastBoardId = useCanvasStore((state) => state.lastBoardId)
  const latestId = useCanvasStore((state) => state.order.at(-1) ?? null)
  const boardId = pending || fromPath || lastBoardId || latestId
  const exists = useCanvasStore((state) => Boolean(boardId && state.boards[boardId]))

  React.useEffect(() => {
    if (!boardId || !exists) return
    useCanvasStore.getState().openBoard(boardId)
    // `/canvas` names the board it opened, so back and forward later return to this board, not to the newest one.
    if (!fromPath && !pending) window.history.replaceState(null, '', `${BOARD_PATH}${encodeURIComponent(boardId)}`)
  }, [boardId, exists, fromPath, pending])

  const openBoard = React.useCallback((nextId: string) => {
    useCanvasStore.getState().openBoard(nextId)
    setPending(nextId)
    window.history.pushState(null, '', `${BOARD_PATH}${encodeURIComponent(nextId)}`)
  }, [])

  if (!boardId || !exists) return <CanvasMissing />
  return <CanvasEditor key={boardId} boardId={boardId} onOpenBoard={openBoard} />
}

function CanvasMissing() {
  const t = useTranslations('Canvas.missing')
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Shapes className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-xl text-foreground">{t('title')}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('description')}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/canvas">{t('back')}</Link>
      </Button>
    </div>
  )
}

'use client'

import * as React from 'react'
import { Check, ChevronDown, CircleHelp, Loader2, Plus, Shapes, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { CanvasDockButton, canvasDockClass } from './canvas-dock'
import { useCanvasAgo } from './canvas-node-parts'
import { useCanvasSaveState, useCanvasStore } from './canvas-store'

/**
 * The board's name (written in place), the other boards behind its caret, and whether it is saved. Boards live in this
 * browser, so "saved" says so.
 */
export function CanvasTopBar({ boardId, onOpenBoard }: { boardId: string; onOpenBoard: (boardId: string) => void }) {
  const t = useTranslations('Canvas')
  const ago = useCanvasAgo()
  const title = useCanvasStore((state) => state.boards[boardId]?.title ?? '')
  const boards = useCanvasStore((state) => state.boards)
  const order = useCanvasStore((state) => state.order)
  const renameBoard = useCanvasStore((state) => state.renameBoard)
  const createBoard = useCanvasStore((state) => state.createBoard)
  const deleteBoard = useCanvasStore((state) => state.deleteBoard)
  const saving = useCanvasSaveState((state) => state.saving)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const recent = React.useMemo(
    () => order.map((id) => boards[id]).filter(Boolean).sort((left, right) => right.updatedAt - left.updatedAt),
    [boards, order],
  )
  const cardCount = boards[boardId]?.nodes.length ?? 0

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-start justify-between gap-2 px-3">
      <div className={`${canvasDockClass} min-w-0 max-w-[min(32rem,calc(100%-4rem))] pl-2.5`}>
        <Shapes className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={title}
          onChange={(event) => renameBoard(boardId, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
          }}
          placeholder={t('untitled')}
          aria-label={t('board.nameLabel')}
          className="field-sizing-content ml-1.5 h-8 min-w-24 max-w-72 truncate rounded-lg bg-transparent px-1.5 text-sm font-semibold text-foreground outline-none placeholder:text-foreground/80 hover:bg-accent/60 focus:bg-accent/60"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CanvasDockButton label={t('board.switch')} side="bottom">
              <ChevronDown />
            </CanvasDockButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-72 p-1.5">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t('board.yours')}</DropdownMenuLabel>
            <div className="youtorch-thin-scrollbar max-h-72 overflow-y-auto">
              {recent.map((board) => (
                <DropdownMenuItem key={board.id} className="gap-2 rounded-md px-2 py-2" onSelect={() => onOpenBoard(board.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{board.title.trim() || t('untitled')}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('board.meta', { count: board.nodes.length, ago: ago(board.updatedAt) })}
                    </span>
                  </span>
                  {board.id === boardId ? <Check className="size-4 text-foreground" /> : null}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-md px-2 py-2" onSelect={() => onOpenBoard(createBoard())}>
              <Plus className="size-4" />
              {t('board.create')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" className="gap-2 rounded-md px-2 py-2" onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              {t('board.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1 hidden h-5 w-px bg-border @2xl:block" aria-hidden />
        <span className="hidden items-center gap-1.5 whitespace-nowrap pr-2 text-xs text-muted-foreground @2xl:flex" aria-live="polite">
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          {saving ? t('board.saving') : t('board.saved')}
        </span>
      </div>

      <div className={canvasDockClass}>
        <Popover>
          <PopoverTrigger asChild>
            <CanvasDockButton label={t('shortcuts.title')} side="bottom">
              <CircleHelp />
            </CanvasDockButton>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-72 rounded-xl p-3">
            <p className="text-sm font-semibold text-foreground">{t('shortcuts.title')}</p>
            <dl className="mt-2 space-y-1.5 text-xs">
              {SHORTCUTS.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t(`shortcuts.${label}`)}</dt>
                  <dd className="flex shrink-0 gap-1">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</dd>
                </div>
              ))}
            </dl>
          </PopoverContent>
        </Popover>
      </div>

      <AppAlertDialog
        open={confirmDelete}
        tone="destructive"
        title={t('board.deleteTitle')}
        description={t('board.deleteDescription', { count: cardCount })}
        confirmLabel={t('board.deleteConfirm')}
        cancelLabel={t('board.cancel')}
        closeLabel={t('board.cancel')}
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          setConfirmDelete(false)
          onOpenBoard(deleteBoard(boardId))
        }}
      />
    </div>
  )
}

const SHORTCUTS: Array<[string[], string]> = [
  [['/'], 'add'],
  [['2×'], 'addHere'],
  [['N'], 'note'],
  [['↵'], 'open'],
  [['Ctrl', 'D'], 'duplicate'],
  [['Ctrl', 'C'], 'copy'],
  [['Ctrl', 'V'], 'paste'],
  [['Ctrl', 'A'], 'selectAll'],
  [['Del'], 'delete'],
  [['Ctrl', 'Z'], 'undo'],
  [['Space'], 'pan'],
  [['Ctrl', 'Scroll'], 'zoom'],
]

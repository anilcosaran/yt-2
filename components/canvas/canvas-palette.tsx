'use client'

import { useTranslations } from 'next-intl'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'

import { CANVAS_KINDS, CANVAS_NODE_KINDS, CANVAS_WORK_KINDS, type CanvasNodeKind } from './canvas-model'
import { CanvasKindTile } from './canvas-node-parts'

/** The drag data of a card dragged from the menu onto the board. */
export const CANVAS_KIND_MIME = 'application/x-yt2-canvas-kind'

/** The key that adds each kind (shown in the menu; the editor listens for them). */
export const CANVAS_KIND_KEYS: Record<CanvasNodeKind, string> = {
  text: '1',
  image: '2',
  video: '3',
  voice: '4',
  link: '5',
  note: 'N',
}

export function isCanvasNodeKind(value: string): value is CanvasNodeKind {
  return (CANVAS_NODE_KINDS as readonly string[]).includes(value)
}

/** What can go on the board: search, pick with the keyboard, or drag a row onto the board. */
export function CanvasPalette({ onPick }: { onPick: (kind: CanvasNodeKind) => void }) {
  const t = useTranslations('Canvas')
  return (
    <Command loop className="rounded-xl">
      <CommandInput autoFocus placeholder={t('palette.search')} />
      <CommandList className="max-h-[22rem] p-1">
        <CommandEmpty>{t('palette.empty')}</CommandEmpty>
        <CommandGroup heading={t('palette.work')}>
          {CANVAS_WORK_KINDS.map((kind) => <PaletteItem key={kind} kind={kind} onPick={onPick} />)}
        </CommandGroup>
        <CommandGroup heading={t('palette.organize')}>
          <PaletteItem kind="note" onPick={onPick} />
        </CommandGroup>
      </CommandList>
      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{t('palette.dragHint')}</p>
    </Command>
  )
}

function PaletteItem({ kind, onPick }: { kind: CanvasNodeKind; onPick: (kind: CanvasNodeKind) => void }) {
  const t = useTranslations('Canvas.kinds')
  const name = t(`${kind}.name`)
  const description = t(`${kind}.description`)
  return (
    <CommandItem
      value={`${kind} ${name} ${description}`}
      onSelect={() => onPick(kind)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(CANVAS_KIND_MIME, kind)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      className="cursor-grab gap-3 rounded-lg px-2 py-2 active:cursor-grabbing"
    >
      <CanvasKindTile kind={kind} color={CANVAS_KINDS[kind].color} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <CommandShortcut>{CANVAS_KIND_KEYS[kind]}</CommandShortcut>
    </CommandItem>
  )
}

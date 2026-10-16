'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

import { CANVAS_KINDS, type CanvasNodeKind } from './canvas-model'
import { CanvasKindTile } from './canvas-node-parts'

const QUICK_KINDS: CanvasNodeKind[] = ['text', 'image', 'video', 'note']

/** An empty board: what it is for, a few cards to start with, and an example to look around in. */
export function CanvasEmptyState({ onAdd, onExample }: { onAdd: (kind: CanvasNodeKind) => void; onExample: () => void }) {
  const t = useTranslations('Canvas')
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-md flex-col items-center text-center">
        <div className="flex -space-x-2" aria-hidden>
          {(['text', 'image', 'voice'] as const).map((kind) => (
            <CanvasKindTile key={kind} kind={kind} color={CANVAS_KINDS[kind].color} className="size-10 rounded-xl ring-4 ring-background [&_svg]:size-[18px]" />
          ))}
        </div>
        <h2 className="mt-5 font-display text-xl text-foreground">{t('empty.title')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('empty.description')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {QUICK_KINDS.map((kind) => {
            const Icon = CANVAS_KINDS[kind].icon
            return (
              <Button key={kind} type="button" variant="outline" size="sm" onClick={() => onAdd(kind)}>
                <Icon />
                {t(`kinds.${kind}.name`)}
              </Button>
            )
          })}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          {t('empty.hint')}{' '}
          <button type="button" onClick={onExample} className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('empty.example')}
          </button>
        </p>
      </div>
    </div>
  )
}

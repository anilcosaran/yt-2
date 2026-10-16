'use client'

// A work card, opened: a wide popup with what the card made in the middle and the card's prompt box under it. What
// you write goes onto the card as you type (the whole visit is one undo step on the board), so closing never loses
// text. Settings sit in the box's bar as chips; every version the card made stays one click away.

import * as React from 'react'
import {
  AlertCircle,
  AlignLeft,
  Gauge,
  Images,
  Loader2,
  Mic,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from '@/components/spark/agent/prompt-box'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { useCanvasBoard } from './canvas-context'
import { canvasMessageLines } from './canvas-mock'
import { CANVAS_KINDS, optionValue, shownResult, type CanvasNode } from './canvas-model'
import {
  CanvasKindTile,
  CanvasResultView,
  CanvasRunningView,
  CanvasStatusBadge,
  useCanvasAgo,
  useCanvasNodeTitle,
} from './canvas-node-parts'
import { useCanvasStore } from './canvas-store'

const OPTION_ICONS: Record<string, LucideIcon> = {
  format: AlignLeft,
  length: Ruler,
  ratio: RectangleHorizontal,
  count: Images,
  duration: Timer,
  voice: Mic,
  speed: Gauge,
}

export function CanvasNodeDialog({ nodeId, onClose }: { nodeId: string | null; onClose: () => void }) {
  const { boardId } = useCanvasBoard()
  // The popup keeps showing its card while it fades out.
  const [shownId, setShownId] = React.useState(nodeId)
  if (nodeId && shownId !== nodeId) setShownId(nodeId)
  const node = useCanvasStore((state) => (shownId ? state.boards[boardId]?.nodes.find((entry) => entry.id === shownId) ?? null : null))

  return (
    <Dialog open={Boolean(nodeId && node)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[min(46rem,calc(100dvh-3rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"
      >
        {node ? <CanvasNodeSheet key={node.id} node={node} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CanvasNodeSheet({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const t = useTranslations('Canvas')
  const { boardId, runNode } = useCanvasBoard()
  const updateNodeData = useCanvasStore((state) => state.updateNodeData)
  const stopNode = useCanvasStore((state) => state.stopNode)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { data } = node
  const title = useCanvasNodeTitle(data)
  const result = shownResult(data)
  const running = data.status === 'running'
  const canRun = data.input.trim().length > 0 && !running
  const examples = canvasMessageLines(t.raw(`kinds.${data.kind}.examples`))

  const update = (patch: Partial<CanvasNode['data']>) => updateNodeData(boardId, node.id, patch)
  const run = () => {
    if (canRun) runNode(node.id)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {running && <div aria-hidden className="nav-progress pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5" />}

      <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <CanvasKindTile kind={data.kind} color={data.color} className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <input
            value={data.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={t(`kinds.${data.kind}.name`)}
            aria-label={t('dialog.titleLabel')}
            className="w-full bg-transparent font-display text-lg leading-6 text-foreground outline-none placeholder:text-foreground/85"
          />
          <p className="truncate text-xs text-muted-foreground">{t(`kinds.${data.kind}.description`)}</p>
        </div>
        <CanvasStatusBadge status={data.status} />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('dialog.close')} className="text-muted-foreground">
          <X />
        </Button>
      </header>

      <div className="youtorch-thin-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {running ? (
          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t(`kinds.${data.kind}.working`)}
            </p>
            <CanvasRunningView kind={data.kind} />
          </div>
        ) : data.status === 'error' && data.error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground">{t(`errors.${data.error}`)}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t(`errors.${data.error}Hint`)}</p>
            <Button type="button" variant="outline" size="sm" className="mt-5" disabled={!canRun} onClick={run}>
              <RotateCcw />
              {t('dialog.retry')}
            </Button>
          </div>
        ) : result ? (
          <CanvasResultView result={result} color={data.color} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <CanvasKindTile kind={data.kind} color={data.color} className="size-11 rounded-xl [&_svg]:size-5" />
            <p className="mt-4 text-sm font-medium text-foreground">{t('dialog.emptyTitle')}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t(`kinds.${data.kind}.emptyHint`)}</p>
            {examples.length > 0 && (
              <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      update({ input: example })
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {data.results.length > 1 && (
        <Versions node={node} onPick={(index) => update({ shown: index, status: data.status === 'error' ? 'done' : data.status })} />
      )}

      <div className="border-t border-border px-4 pb-4 pt-3">
        <PromptBox
          as="form"
          onSubmit={(event) => {
            event.preventDefault()
            run()
          }}
          bar={(
            <>
              {CANVAS_KINDS[data.kind].options.map((option) => {
                const Icon = OPTION_ICONS[option.id] ?? AlignLeft
                const value = optionValue(data, option.id)
                return (
                  <DropdownMenu key={option.id}>
                    <DropdownMenuTrigger asChild>
                      <PromptBoxChip
                        icon={<Icon />}
                        label={t(`options.${option.id}.values.${value}`)}
                        srLabel={t(`options.${option.id}.label`)}
                        title={t(`options.${option.id}.label`)}
                        caret
                        collapse
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-52">
                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t(`options.${option.id}.label`)}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={value}
                        onValueChange={(next) => update({ options: { ...data.options, [option.id]: next } })}
                      >
                        {option.values.map((entry) => (
                          <DropdownMenuRadioItem key={entry} value={entry}>
                            {t(`options.${option.id}.values.${entry}`)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              })}
              <PromptBoxSpacer />
              {running
                ? <PromptBoxSend mode="stop" label={t('card.stop')} onClick={() => stopNode(boardId, node.id)} />
                : <PromptBoxSend label={t(`kinds.${data.kind}.run`)} disabled={!canRun} />}
            </>
          )}
        >
          <PromptBoxInput
            ref={inputRef}
            autoFocus
            value={data.input}
            onChange={(event) => update({ input: event.target.value })}
            onSend={run}
            placeholder={t(`kinds.${data.kind}.placeholder`)}
            aria-label={t(`kinds.${data.kind}.inputLabel`)}
          />
        </PromptBox>
      </div>
    </div>
  )
}

/** Every result the card made, newest first; the picked one is what the card shows. */
function Versions({ node, onPick }: { node: CanvasNode; onPick: (index: number) => void }) {
  const t = useTranslations('Canvas.dialog')
  const ago = useCanvasAgo()
  const { results, shown } = node.data
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-border px-5 py-2">
      <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">{t('versions')}</span>
      {results.map((result, index) => (
        <button
          key={result.id}
          type="button"
          aria-pressed={shown === index}
          title={ago(result.at)}
          onClick={() => onPick(index)}
          className={cn(
            'h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium tabular-nums transition-colors',
            shown === index ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )}
        >
          {t('version', { number: results.length - index })}
          {index === 0 ? <span className="ml-1.5 font-normal text-muted-foreground">{t('latest')}</span> : null}
        </button>
      ))}
    </div>
  )
}

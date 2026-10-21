'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { ArrowLeft, History } from 'lucide-react'

import { STAGE_KIND } from '@/components/spark/lab/lab-chain'
import { LabFrame } from '@/components/spark/lab/lab-frame'
import type { LabScene } from '@/components/spark/lab/lab-model'
import { Icon } from '@/components/spark/lab/lab-parts'
import { ChainBoard, canvasActivity } from '@/components/spark/lab/plan-chain'
import { useLabRun, type CanvasSnapshot, type LabRun, type LabRunInit } from '@/components/spark/lab/use-lab-run'
import { ActivitySpinner } from '@/components/ui/activity-spinner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { canvasContentKey, renameCanvas, touchCanvas, useCanvases, type Canvas } from '@/lib/canvas/canvases'
import { closeWorkTab, openWorkTab } from '@/lib/work-tabs'

import { useClock } from './use-clock'

const LIST_HREF = '/canvas'
// A canvas starts empty: no plan, no scenes. Kept outside render so the run and the board get the same values each time.
const RUN_INIT: LabRunInit = {}
const NO_SCENES: LabScene[] = []
const MAX_TITLE = 80

type CanvasActivity = ReturnType<typeof canvasActivity>

/**
 * One canvas, as a work tab of the shell (`lib/work-tabs.ts`): a slim bar (its name, what is being made, what was made
 * last) over the node canvas of a project's Plan › Üretim without the plan (`ChainBoard`, `free`). What is on it is
 * the run of `canvas:<id>`, which goes on while the user is elsewhere in the app. Opening it brings it to the head of
 * the list and opens (or names) its tab; a canvas this browser does not know closes its tab and says so.
 */
export function CanvasEditor({ canvasId }: { canvasId: string }) {
  const t = useTranslations('Canvas.editor')
  const router = useRouter()
  const canvases = useCanvases()
  const canvas = canvases?.find((entry) => entry.id === canvasId)
  const missing = canvases !== null && !canvas
  const title = canvas?.title

  React.useEffect(() => {
    touchCanvas(canvasId)
  }, [canvasId])

  React.useEffect(() => {
    if (title !== undefined) openWorkTab({ kind: 'canvas', id: canvasId, title })
  }, [canvasId, title])

  React.useEffect(() => {
    if (missing) closeWorkTab('canvas', canvasId)
  }, [missing, canvasId])

  if (canvas) return <CanvasWorkspace canvas={canvas} />
  // The list is read once the page is on the client; until then there is nothing to tell.
  if (!missing) return null
  return (
    <div className="flex h-full items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center" role="alert">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        <Button variant="outline" onClick={() => router.push(LIST_HREF)}>
          <ArrowLeft className="size-4" aria-hidden />
          {t('back')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Keeps what is on a canvas in this browser, so it is there again after a reload: put back once when the canvas opens
 * (unless its run already has something on it, from earlier in this visit, which is newer), then saved a moment after
 * each change. Pictures dropped from the computer are kept by name only; Storage keeps the files.
 */
function useKeptCanvas(run: LabRun, id: string) {
  const key = canvasContentKey(id)
  const loadedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (loadedFor.current === key) return
    loadedFor.current = key
    if (run.state.canvas.added.length || run.state.canvas.log.length) return
    try {
      const kept = window.localStorage.getItem(key)
      if (kept) run.canvas.load(JSON.parse(kept) as CanvasSnapshot)
    } catch {
      // Storage is unavailable or what was kept is unreadable: the canvas opens empty.
    }
  }, [key, run])
  const { canvas, edits, picks } = run.state
  React.useEffect(() => {
    if (loadedFor.current !== key) return
    const timer = window.setTimeout(() => {
      try {
        const snapshot: CanvasSnapshot = { canvas: { ...canvas, queue: undefined } as CanvasSnapshot['canvas'], edits, picks }
        window.localStorage.setItem(key, JSON.stringify(snapshot))
      } catch {
        // Storage is full or unavailable: the canvas still works for this visit.
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [key, canvas, edits, picks])
}

function CanvasWorkspace({ canvas }: { canvas: Canvas }) {
  const run = useLabRun(RUN_INIT, `canvas:${canvas.id}`)
  useKeptCanvas(run, canvas.id)
  const activity = canvasActivity(run.state)
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <CanvasTitle key={canvas.id} id={canvas.id} title={canvas.title} />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {activity.running ? <RunningStatus title={activity.running.title} queued={activity.queued} /> : null}
          <RecentlyMade recent={activity.recent} />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <LabFrame ratio="16:9">
            <div className="lb-canvas-body h-full">
              <ChainBoard run={run} scenes={NO_SCENES} free />
            </div>
          </LabFrame>
        </div>
      </div>
    </div>
  )
}

/** Focuses the name field as it appears, its text selected to be typed over. */
const selectOnMount = (node: HTMLInputElement | null) => {
  node?.focus()
  node?.select()
}

/** The canvas's name; a click turns it into a field. Enter or leaving the field saves it, Escape keeps the old one. */
function CanvasTitle({ id, title }: { id: string; title: string }) {
  const t = useTranslations('Canvas.editor')
  const [draft, setDraft] = React.useState<string | null>(null)
  // Enter and Escape end the edit; the blur of the field going away after them is not a second end.
  const ended = React.useRef(false)

  const finish = (save: boolean) => {
    if (ended.current || draft === null) return
    ended.current = true
    if (save) renameCanvas(id, draft)
    setDraft(null)
  }

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => {
          ended.current = false
          setDraft(title)
        }}
        title={t('rename')}
        className="flex h-8 min-w-0 max-w-[min(28rem,60%)] items-center rounded-md px-2 text-[13.5px] font-medium text-foreground outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate">{title}</span>
      </button>
    )
  }

  return (
    <input
      ref={selectOnMount}
      value={draft}
      maxLength={MAX_TITLE}
      aria-label={t('titleLabel')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
        }
      }}
      className="h-8 w-72 min-w-0 max-w-[60%] rounded-md border border-border bg-background px-2 text-[13.5px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  )
}

/** What the canvas is making now ("Üretiliyor · Görsel") and how many wait after it. */
function RunningStatus({ title, queued }: { title: string; queued: number }) {
  const t = useTranslations('Canvas.editor')
  return (
    <span role="status" className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <ActivitySpinner className="size-3.5 shrink-0" />
      <span className="truncate">{t('running', { title })}</span>
      {queued > 0 ? <span className="shrink-0 text-muted-foreground/70">· {t('queued', { count: queued })}</span> : null}
    </span>
  )
}

/** "Son üretilenler": what was made on the canvas, newest first, in a small popover. */
function RecentlyMade({ recent }: { recent: CanvasActivity['recent'] }) {
  const t = useTranslations('Canvas.editor')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground"
        >
          <History className="size-4" aria-hidden />
          {t('recent')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 p-1">
        {recent.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{t('recentEmpty')}</p>
        ) : (
          <RecentList recent={recent} label={t('recent')} />
        )}
      </PopoverContent>
    </Popover>
  )
}

// The kind's mark is a symbol of the Spark sprite (drawn by `LabFrame` on this page), styled here as it is inside it.
const GLYPH_CLASS =
  'grid size-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-muted-foreground [&_svg]:size-3.5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]'

/** Mounted only while the popover is open, so its clock runs only then. */
function RecentList({ recent, label }: { recent: CanvasActivity['recent']; label: string }) {
  const format = useFormatter()
  const now = useClock()
  return (
    <ul className="hg-scrollbar max-h-80 overflow-y-auto" aria-label={label}>
      {recent.map((item, index) => (
        <li key={`${item.id}:${item.at}:${index}`} className="flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px]">
          <span className={GLYPH_CLASS}>
            <Icon name={STAGE_KIND[item.kind].icon} size="sm" />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {now ? format.relativeTime(Math.min(item.at, now), now) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

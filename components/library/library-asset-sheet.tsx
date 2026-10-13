'use client'

// Asset preview: a centred dialog with the media on the left and a panel on the right (title, one meta line,
// Spark / download / more, Memory, the AI tools that fit the item, collections, AI analysis with editable tags,
// the owner's notes). Usage limits, cooldowns, quality scores and consent are deliberately not shown here.

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Brain,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Crop,
  Download,
  Ellipsis,
  ImageDown,
  Loader2,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Scissors,
  Speech,
  Stamp,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { formatBytes, formatDuration } from './library-logic'
import { useLibraryStore } from './library-store'
import type { LibraryAsset, LibraryCollection } from './library-types'
import { AssetCoverView, CollectionGlyph, useRelativeTime } from './library-ui'

type StepHandler = (id: string) => void

export function LibraryAssetSheet({
  assetId,
  onClose,
  siblingIds,
}: {
  assetId: string | null
  onClose: () => void
  /** Ids in the order the grid shows them; previous/next follows it. Defaults to the store order of the current view. */
  siblingIds?: string[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const assets = useLibraryStore((state) => state.assets)

  // Previous/next. The step is applied here at once (no frame where the dialog sees a missing item, e.g. after a
  // delete); when the page drives the dialog through the `asset` URL param, the param is rewritten too (native
  // history API: no server round trip), which brings a new `assetId` and clears the local step.
  const [step, setStep] = React.useState<string | null>(null)
  const [stepBase, setStepBase] = React.useState(assetId)
  if (stepBase !== assetId) {
    setStepBase(assetId)
    setStep(null)
  }
  const currentId = assetId ? step ?? assetId : null
  const asset = currentId ? assets.find((item) => item.id === currentId) ?? null : null

  // Keep the last item while the dialog animates out, so it does not flash empty.
  const [lastAsset, setLastAsset] = React.useState<LibraryAsset | null>(asset)
  if (asset && asset !== lastAsset) setLastAsset(asset)
  const shown = asset ?? lastAsset
  const open = Boolean(asset)

  const order = React.useMemo(() => {
    if (siblingIds?.length) return siblingIds
    const collectionId = searchParams.get('collection')
    const kind = searchParams.get('type')
    return assets
      .filter((item) => (collectionId ? item.collectionIds.includes(collectionId) : kind ? item.kind === kind : true))
      .map((item) => item.id)
  }, [assets, searchParams, siblingIds])
  const neighbours = React.useMemo(() => {
    if (!currentId) return { prevId: null, nextId: null }
    let list = order
    let index = list.indexOf(currentId)
    if (index === -1) {
      list = assets.map((item) => item.id)
      index = list.indexOf(currentId)
    }
    if (index === -1) return { prevId: null, nextId: null }
    return { prevId: list[index - 1] ?? null, nextId: list[index + 1] ?? null }
  }, [assets, currentId, order])
  const { prevId, nextId } = neighbours

  const urlDriven = Boolean(assetId) && searchParams.get('asset') === assetId
  const goTo = React.useCallback<StepHandler>((id) => {
    setStep(id)
    if (!urlDriven) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('asset', id)
    window.history.replaceState(null, '', `${pathname}?${next.toString()}`)
  }, [pathname, searchParams, urlDriven])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && (target.isContentEditable || target.closest(KEY_NAV_IGNORE))) return
      const id = event.key === 'ArrowLeft' ? prevId : nextId
      if (!id) return
      event.preventDefault()
      goTo(id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [goTo, nextId, open, prevId])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/60"
        onOpenAutoFocus={(event) => {
          // Focus the dialog itself rather than its first button (no stray focus ring on an arrow or the close button).
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
        onEscapeKeyDown={(event) => {
          // Esc inside the rename field cancels the rename instead of closing the preview.
          if (event.target instanceof HTMLElement && event.target.closest('[data-rename-field]')) event.preventDefault()
        }}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-background p-0 outline-none sm:max-w-6xl md:h-[min(88vh,780px)] md:flex-row md:rounded-3xl"
      >
        {shown && (
          <AssetPreview key={shown.id} asset={shown} prevId={prevId} nextId={nextId} onStep={goTo} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Arrow keys from these places belong to the control, not to previous/next. */
const KEY_NAV_IGNORE = 'input, textarea, select, [role="menu"], [role="listbox"], [role="alertdialog"], [data-slot="popover-content"]'

function AssetPreview({
  asset,
  prevId,
  nextId,
  onStep,
  onClose,
}: {
  asset: LibraryAsset
  prevId: string | null
  nextId: string | null
  onStep: StepHandler
  onClose: () => void
}) {
  const t = useTranslations('Library.preview')
  return (
    <>
      <PreviewStage asset={asset} prevId={prevId} nextId={nextId} onStep={onStep} />
      <PreviewPanel asset={asset} fallbackId={nextId ?? prevId} onStep={onStep} onClose={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        title={t('close')}
        className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground md:border-transparent md:bg-transparent"
      >
        <X className="size-4" />
      </button>
    </>
  )
}

/* ------------------------------------------------------------------------------------------------ stage */

function PreviewStage({
  asset,
  prevId,
  nextId,
  onStep,
}: {
  asset: LibraryAsset
  prevId: string | null
  nextId: string | null
  onStep: StepHandler
}) {
  const t = useTranslations('Library.preview')
  const duration = asset.kind === 'video' || asset.kind === 'audio' || asset.kind === 'motion' ? formatDuration(asset.durationSeconds) : null
  return (
    <div className="relative flex h-[40dvh] shrink-0 items-center justify-center bg-muted/60 p-4 sm:p-6 md:h-auto md:min-w-0 md:flex-1 md:p-10 dark:bg-black/40">
      <StageMedia asset={asset} />
      {duration && (
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground backdrop-blur-sm">
          {duration}
        </span>
      )}
      {prevId && <StepButton direction="previous" label={t('previous')} onClick={() => onStep(prevId)} />}
      {nextId && <StepButton direction="next" label={t('next')} onClick={() => onStep(nextId)} />}
    </div>
  )
}

function StageMedia({ asset }: { asset: LibraryAsset }) {
  if (asset.kind === 'text' && asset.text) {
    return (
      <div className="max-h-full w-full max-w-xl overflow-y-auto whitespace-pre-line rounded-2xl border border-border bg-card p-6 text-sm leading-7 text-card-foreground shadow-sm">
        {asset.text}
      </div>
    )
  }
  if (asset.cover.type === 'image') {
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.cover.src} alt={asset.name} className="absolute inset-0 m-auto max-h-full max-w-full rounded-xl object-contain shadow-sm" />
      </div>
    )
  }
  const square = asset.kind === 'audio' || asset.kind === 'avatar'
  return (
    <AssetCoverView
      cover={asset.cover}
      kind={asset.kind}
      alt={asset.name}
      iconClassName="size-14"
      className={cn('shadow-sm', square ? 'aspect-square w-44 rounded-3xl sm:w-56 md:w-64' : 'aspect-video max-h-full w-full max-w-xl rounded-2xl')}
    />
  )
}

function StepButton({ direction, label, onClick }: { direction: 'previous' | 'next'; label: string; onClick: () => void }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background',
        direction === 'previous' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" />
    </button>
  )
}

/* ------------------------------------------------------------------------------------------------ panel */

function PreviewPanel({
  asset,
  fallbackId,
  onStep,
  onClose,
}: {
  asset: LibraryAsset
  /** Shown after this item is deleted; null closes the preview. */
  fallbackId: string | null
  onStep: StepHandler
  onClose: () => void
}) {
  const t = useTranslations('Library.preview')
  const tKind = useTranslations('Library.kind')
  const relative = useRelativeTime()
  const router = useRouter()
  const [renaming, setRenaming] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [navigating, startNavigation] = React.useTransition()
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)
  const skipMenuFocus = React.useRef(false)

  const duration = formatDuration(asset.durationSeconds)
  const meta = [
    tKind(asset.kind),
    duration ?? (asset.width && asset.height ? `${asset.width}×${asset.height}` : null),
    formatBytes(asset.sizeBytes),
    relative(asset.createdAt),
  ].filter(Boolean).join(' · ')
  const tools = getPreviewTools(asset)
  const prompt = asset.generatedBy?.prompt.trim()

  const openTool = (href: string) => {
    setPendingHref(href)
    startNavigation(() => router.push(href))
  }
  const download = () => {
    if (!downloadAsset(asset)) toast(t('downloadUnavailable'))
  }
  const remove = () => {
    useLibraryStore.getState().deleteAssets([asset.id])
    toast(t('deleted'))
    if (fallbackId) onStep(fallbackId)
    else onClose()
  }

  return (
    <div className="hover-scrollbar flex min-h-0 flex-auto flex-col overflow-y-auto md:w-[400px] md:flex-none md:border-l md:border-border">
      <div className="flex flex-col gap-7 p-6">
        <header className="space-y-1.5 pr-10">
          {renaming ? (
            <>
              <DialogTitle className="sr-only">{asset.name}</DialogTitle>
              <RenameField asset={asset} onDone={() => setRenaming(false)} />
            </>
          ) : (
            <DialogTitle className="pr-0 font-display text-xl font-medium leading-snug text-foreground">{asset.name}</DialogTitle>
          )}
          <DialogDescription>{meta}</DialogDescription>
        </header>

        <div className="flex items-center gap-2">
          <Button className="flex-1 rounded-full" onClick={() => toast(t('useInSparkToast'))}>
            <Clapperboard />
            {t('useInSpark')}
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={download} aria-label={t('download')} title={t('download')}>
            <Download />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full" aria-label={t('more')} title={t('more')}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              onCloseAutoFocus={(event) => {
                // The rename field / delete confirmation takes focus; don't hand it back to the ⋯ button.
                if (!skipMenuFocus.current) return
                skipMenuFocus.current = false
                event.preventDefault()
              }}
            >
              <DropdownMenuItem onSelect={() => { skipMenuFocus.current = true; setRenaming(true) }}>
                <Pencil />
                {t('rename')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => { skipMenuFocus.current = true; setConfirmDelete(true) }}>
                <Trash2 />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <PreviewMemory asset={asset} />

        {tools.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-foreground">{t('tools')}</h3>
            <div className="-mx-2 grid gap-0.5">
              {tools.map((tool) => {
                const pending = navigating && pendingHref === tool.href
                return (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={() => openTool(tool.href)}
                    disabled={navigating}
                    className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                      <tool.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{t(`tool.${tool.key}.title`)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t(`tool.${tool.key}.hint`)}</span>
                    </span>
                    {pending ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <PreviewCollections asset={asset} />

        <PreviewAnalysis asset={asset} />

        <PreviewNotes asset={asset} />

        {prompt && (
          <details className="group border-t border-border pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              {t('details')}
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 text-sm">
              <p className="text-xs text-muted-foreground">{t('prompt')}</p>
              <p className="mt-0.5 leading-6 text-foreground">“{prompt}”</p>
            </div>
          </details>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteBody', { name: asset.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RenameField({ asset, onDone }: { asset: LibraryAsset; onDone: () => void }) {
  const t = useTranslations('Library.preview')
  const [value, setValue] = React.useState(asset.name)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const finished = React.useRef(false)
  React.useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const finish = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    const next = value.trim()
    if (save && next && next !== asset.name) useLibraryStore.getState().renameAsset(asset.id, next)
    onDone()
  }
  return (
    <Input
      ref={inputRef}
      data-rename-field=""
      aria-label={t('nameLabel')}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          finish(false)
        }
      }}
      className="h-9 font-display text-lg font-medium md:text-lg"
    />
  )
}

/* ------------------------------------------------------------------------------------------------ notes */

/** The owner's notes, one per line: add with Enter, click one to edit it, × removes it. AI reads them when picking. */
function PreviewNotes({ asset }: { asset: LibraryAsset }) {
  const t = useTranslations('Library.preview')
  const notes = asset.notes ?? []
  const [draft, setDraft] = React.useState('')
  const [editing, setEditing] = React.useState<number | null>(null)
  const draftRef = React.useRef('')

  const commitDraft = React.useCallback((text: string) => {
    const note = text.trim()
    draftRef.current = ''
    if (!note) return
    const store = useLibraryStore.getState()
    const current = store.assets.find((item) => item.id === asset.id)?.notes ?? []
    store.setNotes(asset.id, [...current, note])
  }, [asset.id])
  // Closing the preview (Esc, outside click) or stepping to another item unmounts the field without a blur.
  React.useEffect(() => () => commitDraft(draftRef.current), [commitDraft])

  const setNotes = (next: string[]) => useLibraryStore.getState().setNotes(asset.id, next)
  const add = () => {
    commitDraft(draft)
    setDraft('')
  }

  return (
    <section>
      <h3 className="text-sm font-medium text-foreground">{t('notes.title')}</h3>
      <p className="mb-2.5 mt-0.5 text-xs text-muted-foreground">{t('notes.hint')}</p>
      {notes.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {notes.map((note, index) => (
            <li key={`${index}-${note}`} className="group flex items-start gap-2 rounded-xl bg-muted/50 py-2 pl-3 pr-1.5 text-sm text-foreground">
              {editing === index ? (
                <NoteEditor
                  initial={note}
                  label={t('notes.edit')}
                  onDone={(value) => {
                    setEditing(null)
                    if (value === null) return
                    setNotes(value.trim() ? notes.map((item, position) => (position === index ? value : item)) : notes.filter((_, position) => position !== index))
                  }}
                />
              ) : (
                <button type="button" onClick={() => setEditing(index)} title={t('notes.edit')} className="min-w-0 flex-1 text-left leading-5">
                  {note}
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotes(notes.filter((_, position) => position !== index))}
                aria-label={t('notes.remove')}
                title={t('notes.remove')}
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Plus className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={draft}
          onChange={(event) => {
            draftRef.current = event.target.value
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={notes.length ? t('notes.add') : t('notes.placeholder')}
          aria-label={t('notes.add')}
          className="h-9 w-full rounded-xl border border-dashed border-border bg-transparent pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
    </section>
  )
}

/** Inline editor for one note: Enter or leaving the field saves (empty removes the note), Esc cancels. */
function NoteEditor({ initial, label, onDone }: { initial: string; label: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = React.useState(initial)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const done = React.useRef(false)
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])
  const finish = (next: string | null) => {
    if (done.current) return
    done.current = true
    onDone(next)
  }
  return (
    <input
      ref={inputRef}
      // Esc cancels the edit instead of closing the preview (see the dialog's onEscapeKeyDown).
      data-rename-field=""
      aria-label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(value)
        } else if (event.key === 'Escape') {
          finish(null)
        }
      }}
      className="min-w-0 flex-1 bg-transparent leading-5 outline-none"
    />
  )
}

/* ------------------------------------------------------------------------------------------------ analysis */

function PreviewAnalysis({ asset }: { asset: LibraryAsset }) {
  const t = useTranslations('Library.preview')
  const { state, summary } = asset.analysis
  const busy = state === 'queued' || state === 'analyzing'
  const note = state === 'failed' ? t('analysis.failed') : state === 'skipped' ? t('analysis.skipped') : null
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{t('analysis.title')}</h3>
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t(`analysis.state.${state}`)}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => useLibraryStore.getState().reanalyze([asset.id])}
            className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            {state === 'analyzed' ? t('analysis.again') : t('analysis.run')}
          </button>
        )}
      </div>
      {note ? (
        <p className="text-sm text-muted-foreground">{note}</p>
      ) : summary?.trim() ? (
        <p className="text-sm leading-6 text-foreground">{summary}</p>
      ) : null}
      <TagEditor asset={asset} />
    </section>
  )
}

function TagEditor({ asset }: { asset: LibraryAsset }) {
  const t = useTranslations('Library.preview')
  const [draft, setDraft] = React.useState('')
  const tags = asset.analysis.tags
  const setTags = (next: string[]) => useLibraryStore.getState().setTags(asset.id, next)
  const add = () => {
    const tag = draft.trim().replace(/,+$/, '').toLocaleLowerCase('tr')
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setDraft('')
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-7 max-w-full items-center gap-0.5 rounded-full bg-muted pl-2.5 pr-1 text-xs text-foreground">
          <span className="min-w-0 truncate">{tag}</span>
          <button
            type="button"
            onClick={() => setTags(tags.filter((item) => item !== tag))}
            aria-label={t('tags.remove', { tag })}
            title={t('tags.remove', { tag })}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !draft && tags.length) {
            setTags(tags.slice(0, -1))
          }
        }}
        onBlur={add}
        placeholder={t('tags.add')}
        aria-label={t('tags.add')}
        className="h-7 w-28 min-w-0 flex-1 rounded-full border border-dashed border-border bg-transparent px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
      />
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ memory */

function PreviewMemory({ asset }: { asset: LibraryAsset }) {
  const t = useTranslations('Library.preview')
  const id = React.useId()
  const memory = asset.memory ?? 'off'
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
      <Brain className="size-4 shrink-0 text-muted-foreground" />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          {memory === 'adding' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {t(`memory.${memory}`)}
        </span>
        <span className="block text-xs text-muted-foreground">{t('memory.hint')}</span>
      </label>
      <Switch id={id} checked={memory !== 'off'} onCheckedChange={(checked) => useLibraryStore.getState().setMemory(asset.id, checked)} />
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ collections */

function PreviewCollections({ asset }: { asset: LibraryAsset }) {
  const t = useTranslations('Library.preview')
  const collections = useLibraryStore((state) => state.collections)
  const memberOf = collections.filter((collection) => collection.status !== 'archived' && asset.collectionIds.includes(collection.id))
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-foreground">{t('collections')}</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {memberOf.map((collection) => (
          <span key={collection.id} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-muted pl-1 pr-1 text-sm text-foreground">
            <CollectionGlyph collection={collection} size="sm" className="rounded-full shadow-none" />
            <span className="min-w-0 truncate">{collection.name}</span>
            <button
              type="button"
              onClick={() => useLibraryStore.getState().removeFromCollection([asset.id], collection.id)}
              aria-label={t('removeFrom', { name: collection.name })}
              title={t('removeFrom', { name: collection.name })}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <CollectionPicker asset={asset} collections={collections} label={memberOf.length ? t('add') : t('addToCollection')} />
      </div>
    </section>
  )
}

function CollectionPicker({ asset, collections, label }: { asset: LibraryAsset; collections: LibraryCollection[]; label: string }) {
  const t = useTranslations('Library.preview')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const needle = query.trim().toLocaleLowerCase('tr')
  const choices = collections.filter((collection) => (
    collection.status !== 'archived'
    // A frozen collection takes no new items; it is listed only so the item can be taken out of it.
    && (collection.status !== 'frozen' || asset.collectionIds.includes(collection.id))
    && (!needle || collection.name.toLocaleLowerCase('tr').includes(needle))
  ))
  const canCreate = Boolean(needle) && !collections.some((collection) => collection.status !== 'archived' && collection.name.toLocaleLowerCase('tr') === needle)

  const toggle = (collection: LibraryCollection) => {
    const store = useLibraryStore.getState()
    if (asset.collectionIds.includes(collection.id)) store.removeFromCollection([asset.id], collection.id)
    else store.addToCollection([asset.id], collection.id)
  }
  const create = () => {
    const name = query.trim()
    if (!name) return
    const store = useLibraryStore.getState()
    const { id } = store.createCollection({ name, description: '', smart: false })
    store.addToCollection([asset.id], id)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (canCreate) create()
            else if (choices.length === 1) toggle(choices[0])
          }}
          placeholder={t('searchOrCreate')}
          aria-label={t('searchOrCreate')}
          className="mb-1 h-8 text-sm"
        />
        <div className="max-h-60 overflow-y-auto">
          {choices.map((collection) => {
            const member = asset.collectionIds.includes(collection.id)
            return (
              <button
                key={collection.id}
                type="button"
                aria-pressed={member}
                onClick={() => toggle(collection)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                <CollectionGlyph collection={collection} size="sm" className="shadow-none" />
                <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                {member && <Check className="size-4 shrink-0 text-foreground" />}
              </button>
            )
          })}
          {canCreate && (
            <button
              type="button"
              onClick={create}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Plus className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{t('create', { name: query.trim() })}</span>
            </button>
          )}
          {!choices.length && !canCreate && <p className="px-2 py-3 text-center text-sm text-muted-foreground">{t('noCollections')}</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------------------------------------ tools */

type PreviewToolKey =
  | 'clips'
  | 'captions'
  | 'transform'
  | 'transformImage'
  | 'logo'
  | 'frame'
  | 'gif'
  | 'talkingVideo'
  | 'saveAvatar'
  | 'cloneVoice'

type PreviewTool = { key: PreviewToolKey; icon: LucideIcon; href: string }

/** The AI tools that make sense for an item, linked the way the old Storage inspector did (`/tools?tool=<id>`). */
function getPreviewTools(asset: LibraryAsset): PreviewTool[] {
  const id = asset.id
  switch (asset.kind) {
    case 'video':
      return [
        { key: 'clips', icon: Scissors, href: toolHref('viral-clips', id) },
        { key: 'captions', icon: Captions, href: toolHref('captions', id) },
        { key: 'transform', icon: Crop, href: toolHref('media-transform', id) },
        { key: 'logo', icon: Stamp, href: toolHref('brand-overlay', id) },
        { key: 'frame', icon: ImageDown, href: toolHref('frame-extract', id) },
        { key: 'gif', icon: Repeat, href: toolHref('video-to-gif', id) },
      ]
    case 'image':
      return [
        { key: 'transformImage', icon: Crop, href: toolHref('media-transform', id) },
        { key: 'talkingVideo', icon: Speech, href: toolHref('avatar', id) },
        { key: 'saveAvatar', icon: UserRound, href: `/brand?${new URLSearchParams({ section: 'avatars', source_storage_object_id: id }).toString()}` },
      ]
    case 'avatar':
      return [{ key: 'talkingVideo', icon: Speech, href: toolHref('avatar', id) }]
    case 'audio':
      return looksLikeMusic(asset) ? [] : [{ key: 'cloneVoice', icon: Mic, href: toolHref('voice-clone', id, 'reference_storage_object_id') }]
    default:
      return []
  }
}

function toolHref(tool: string, assetId: string, param = 'storage_object_id') {
  return `/tools?${new URLSearchParams({ tool, [param]: assetId }).toString()}`
}

/** Voice tools only fit speech; music and jingles get none. */
function looksLikeMusic(asset: LibraryAsset) {
  if (asset.cover.type === 'glyph' && (asset.cover.icon === 'music' || asset.cover.icon === 'music-2')) return true
  return asset.analysis.tags.some((tag) => ['müzik', 'music', 'jingle'].includes(tag.toLocaleLowerCase('tr')))
}

/* ------------------------------------------------------------------------------------------------ download */

/** Saves what the mock really has (image files, text bodies); false when there is nothing to save. */
function downloadAsset(asset: LibraryAsset) {
  const baseName = asset.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'file'
  if (asset.kind === 'text' && asset.text) {
    const url = URL.createObjectURL(new Blob([asset.text], { type: 'text/plain;charset=utf-8' }))
    saveFile(url, `${baseName}.txt`)
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    return true
  }
  if ((asset.kind === 'image' || asset.kind === 'avatar') && asset.cover.type === 'image') {
    const extension = asset.cover.src.match(/\.[a-z0-9]+(?=$|[?#])/i)?.[0] ?? ''
    saveFile(asset.cover.src, `${baseName}${extension}`)
    return true
  }
  return false
}

function saveFile(href: string, fileName: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

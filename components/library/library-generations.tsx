'use client'

// Recent generations: a uniform square grid (3–4 per row) of what the tools and the assistant produced, newest
// first. The tile is just the output; the prompt and the actions appear on hover.

import * as React from 'react'
import { AlertCircle, Check, Copy, Ellipsis, FolderPlus, Loader2, Save, Settings2, Trash2, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { formatDuration } from './library-logic'
import { useLibraryStore } from './library-store'
import type { GenerationKind, LibraryGeneration } from './library-types'
import { AssetCoverView, CollectionGlyph } from './library-ui'

const KINDS = ['all', 'image', 'video', 'audio', 'text'] as const

export function LibraryGenerationsView({ onOpenAsset }: { onOpenAsset: (id: string) => void }) {
  const t = useTranslations('Library.generations')
  const generations = useLibraryStore((state) => state.generations)
  const preferences = useLibraryStore((state) => state.preferences)
  const setPreferences = useLibraryStore((state) => state.setPreferences)
  const saveGeneration = useLibraryStore((state) => state.saveGeneration)
  const [kind, setKind] = React.useState<'all' | GenerationKind>('all')

  const shown = generations
    .filter((generation) => kind === 'all' || generation.kind === kind)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  const unsaved = generations.filter((generation) => !generation.savedAssetId && generation.status === 'completed')

  const saveAll = () => {
    for (const generation of unsaved) {
      saveGeneration(generation.id, preferences.autoRouteToSmartCollections ? generation.suggestedCollectionId ?? null : null)
    }
    toast.success(t('savedAllToast', { count: unsaved.length }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {KINDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={cn(
                'inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors',
                kind === value ? 'bg-foreground text-background' : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t(`filter.${value}`)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unsaved.length > 0 && (
            <Button variant="outline" className="rounded-full" onClick={saveAll}>
              <Save />
              <span className="hidden sm:inline">{t('saveAll', { count: unsaved.length })}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full" aria-label={t('settings')} title={t('settings')}>
                <Settings2 />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuCheckboxItem
                checked={preferences.autoSaveGenerations}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(autoSaveGenerations) => setPreferences({ autoSaveGenerations })}
              >
                {t('autoSave')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={preferences.autoRouteToSmartCollections}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(autoRouteToSmartCollections) => setPreferences({ autoRouteToSmartCollections })}
              >
                {t('autoRoute')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">{t('empty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {shown.map((generation) => <GenerationTile key={generation.id} generation={generation} onOpenAsset={onOpenAsset} />)}
        </div>
      )}
    </div>
  )
}

function GenerationTile({ generation, onOpenAsset }: { generation: LibraryGeneration; onOpenAsset: (id: string) => void }) {
  const t = useTranslations('Library.generations')
  const collections = useLibraryStore((state) => state.collections)
  const saveGeneration = useLibraryStore((state) => state.saveGeneration)
  const discardGeneration = useLibraryStore((state) => state.discardGeneration)
  const suggested = collections.find((collection) => collection.id === generation.suggestedCollectionId) ?? null
  const savedId = generation.savedAssetId
  const completed = generation.status === 'completed'
  const duration = formatDuration(generation.durationSeconds)

  const save = (collectionId?: string | null) => {
    const assetId = saveGeneration(generation.id, collectionId)
    if (!assetId) return
    const collection = collections.find((item) => item.id === collectionId)
    toast.success(collection ? t('savedToCollectionToast', { name: collection.name }) : t('savedToast'), {
      action: { label: t('open'), onClick: () => onOpenAsset(assetId) },
    })
  }
  const copyText = () => {
    void navigator.clipboard?.writeText(generation.text ?? '')
    toast(t('copied'))
  }
  const targets = collections.filter((collection) => collection.status !== 'archived' && collection.status !== 'frozen')

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
      {generation.kind === 'text' ? (
        <div className="absolute inset-0 p-4">
          <p className="line-clamp-[9] whitespace-pre-line text-[13px] leading-5 text-foreground/90">{generation.text}</p>
        </div>
      ) : generation.cover ? (
        <AssetCoverView
          cover={generation.cover}
          kind={generation.kind}
          alt={generation.prompt}
          iconClassName="size-12"
          className={cn('absolute inset-0 h-full w-full', !completed && 'opacity-50 grayscale')}
        />
      ) : null}

      {savedId && (
        <button
          type="button"
          onClick={() => onOpenAsset(savedId)}
          aria-label={t('openInLibrary')}
          className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      )}

      {generation.status === 'running' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <Loader2 className="size-3.5 animate-spin" />{t('running')}
          </span>
        </div>
      )}
      {generation.status === 'failed' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <AlertCircle className="size-3.5" />{t('failed')}
          </span>
        </div>
      )}

      {savedId && (
        <span title={t('inLibrary')} className="pointer-events-none absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Check className="size-3.5" />
        </span>
      )}
      {duration && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
          {duration}
        </span>
      )}

      {/* Prompt and actions, on hover / keyboard focus. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-12 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <p className="line-clamp-2 text-xs leading-5 text-white">{generation.prompt}</p>
        {generation.status !== 'running' && (
          <div className="pointer-events-auto flex items-center gap-1.5">
            {completed && !savedId && (
              <Button size="sm" className="h-8 rounded-full bg-white px-3 text-black hover:bg-white/90" onClick={() => save(suggested?.id ?? null)}>
                <Save />{t('save')}
              </Button>
            )}
            {generation.status === 'failed' && (
              <Button size="sm" className="h-8 rounded-full bg-white px-3 text-black hover:bg-white/90" onClick={() => toast(t('retryMock'))}>
                <Wand2 />{t('retry')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('more')}
                  title={t('more')}
                  className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <Ellipsis className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {completed && !savedId && (
                  <>
                    <DropdownMenuItem onSelect={() => save(null)}><Save />{t('saveOnly')}</DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><FolderPlus />{t('saveToCollection')}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <DropdownMenuLabel>{t('saveToCollection')}</DropdownMenuLabel>
                        {targets.map((collection) => (
                          <DropdownMenuItem key={collection.id} onSelect={() => save(collection.id)}>
                            <CollectionGlyph collection={collection} size="sm" />
                            <span className="flex-1 truncate">{collection.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                {savedId && <DropdownMenuItem onSelect={() => onOpenAsset(savedId)}>{t('openInLibrary')}</DropdownMenuItem>}
                {generation.kind === 'text' && generation.text && (
                  <DropdownMenuItem onSelect={copyText}><Copy />{t('copy')}</DropdownMenuItem>
                )}
                {!savedId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => discardGeneration(generation.id)}><Trash2 />{t('discard')}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}

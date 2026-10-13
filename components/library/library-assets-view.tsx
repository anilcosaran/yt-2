'use client'

import * as React from 'react'
import {
  ArrowDownWideNarrow,
  Check,
  EyeOff,
  Eye,
  FolderInput,
  FolderMinus,
  LayoutGrid,
  List,
  ListFilter,
  RefreshCw,
  Search,
  Trash2,
  X,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { formatBytes, getAvailability } from './library-logic'
import { useLibraryStore } from './library-store'
import type { AnalysisState, AssetAvailability, AssetKind, LibraryAsset, LibraryCollection } from './library-types'
import {
  AnalysisBadge,
  AssetCoverView,
  AvailabilityBadge,
  CollectionGlyph,
  KIND_ICONS,
  KindChip,
  PinnedMark,
  TagList,
  assetMatchesQuery,
  useRelativeTime,
} from './library-ui'

type SortKey = 'newest' | 'oldest' | 'most_used' | 'least_used' | 'name' | 'size'
type AvailabilityFilter = 'all' | AssetAvailability['state']
type AnalysisFilter = 'all' | 'analyzed' | 'pending' | 'failed' | 'skipped'

const ANALYSIS_GROUP: Record<AnalysisState, AnalysisFilter> = {
  analyzed: 'analyzed',
  analyzing: 'pending',
  queued: 'pending',
  failed: 'failed',
  skipped: 'skipped',
}

export function LibraryAssetsView({
  assets,
  collection = null,
  kind = null,
  initialQuery = '',
  onOpenAsset,
  empty,
  showKindFilter = true,
  showUsageRules = true,
}: {
  assets: LibraryAsset[]
  collection?: LibraryCollection | null
  kind?: AssetKind | null
  initialQuery?: string
  onOpenAsset: (id: string) => void
  empty?: React.ReactNode
  /** Off where the page already has type chips above the grid. */
  showKindFilter?: boolean
  /** Off to hide a smart collection's usage states (availability chips, usage counts and badges on the cards). */
  showUsageRules?: boolean
}) {
  const t = useTranslations('Library.assets')
  const tKind = useTranslations('Library.kind')
  const tAvailability = useTranslations('Library.availability')
  const collections = useLibraryStore((state) => state.collections)
  const addToCollection = useLibraryStore((state) => state.addToCollection)
  const removeFromCollection = useLibraryStore((state) => state.removeFromCollection)
  const setAiExcluded = useLibraryStore((state) => state.setAiExcluded)
  const reanalyze = useLibraryStore((state) => state.reanalyze)
  const deleteAssets = useLibraryStore((state) => state.deleteAssets)

  // Usage rules only exist for smart collections; a plain collection is just a folder.
  const policy = showUsageRules && collection?.smart ? collection : null
  const [query, setQuery] = React.useState(initialQuery)
  const [kinds, setKinds] = React.useState<AssetKind[]>([])
  const [analysis, setAnalysis] = React.useState<AnalysisFilter>('all')
  const [availability, setAvailability] = React.useState<AvailabilityFilter>('all')
  const [source, setSource] = React.useState<'all' | LibraryAsset['source']>('all')
  const [sort, setSort] = React.useState<SortKey>('newest')
  const [view, setView] = React.useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => setQuery(initialQuery), [initialQuery])
  React.useEffect(() => setSelected(new Set()), [collection?.id, kind])

  const filtered = React.useMemo(() => {
    const list = assets.filter((asset) => {
      if (!assetMatchesQuery(asset, query)) return false
      if (kinds.length && !kinds.includes(asset.kind)) return false
      if (analysis !== 'all' && ANALYSIS_GROUP[asset.analysis.state] !== analysis) return false
      if (source !== 'all' && asset.source !== source) return false
      if (availability !== 'all' && getAvailability(asset, policy).state !== availability) return false
      return true
    })
    const sorted = [...list]
    sorted.sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      switch (sort) {
        case 'oldest': return Date.parse(left.createdAt) - Date.parse(right.createdAt)
        case 'most_used': return right.usage.count - left.usage.count
        case 'least_used': return left.usage.count - right.usage.count
        case 'name': return left.name.localeCompare(right.name, 'tr')
        case 'size': return right.sizeBytes - left.sizeBytes
        default: return Date.parse(right.createdAt) - Date.parse(left.createdAt)
      }
    })
    return sorted
  }, [analysis, assets, availability, kinds, policy, query, sort, source])

  const availabilityCounts = React.useMemo(() => {
    const counts: Partial<Record<AvailabilityFilter, number>> = { all: assets.length }
    if (!policy) return counts
    for (const asset of assets) {
      const state = getAvailability(asset, policy).state
      counts[state] = (counts[state] ?? 0) + 1
    }
    return counts
  }, [assets, policy])

  const activeFilters = kinds.length + (analysis !== 'all' ? 1 : 0) + (source !== 'all' ? 1 : 0)
  const selectedIds = [...selected]
  const allSelected = filtered.length > 0 && filtered.every((asset) => selected.has(asset.id))
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const clearFilters = () => {
    setKinds([])
    setAnalysis('all')
    setSource('all')
    setAvailability('all')
    setQuery('')
  }
  const selectionHidden = selectedIds.length > 0 && selectedIds.every((id) => assets.find((asset) => asset.id === id)?.aiExcluded)

  return (
    <div className="space-y-4">
      {policy && (
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'available', 'cooldown', 'exhausted', 'blocked_consent', 'blocked_quality', 'blocked_license', 'blocked_duplicate', 'pending_analysis', 'hidden'] as const).map((state) => {
            const count = availabilityCounts[state] ?? 0
            if (state !== 'all' && count === 0) return null
            return (
              <button
                key={state}
                type="button"
                onClick={() => setAvailability(state)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  availability === state ? 'border-foreground/30 bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {state === 'all' ? t('allItems') : tAvailability(`filter.${state}`)}
                <span className={cn('tabular-nums', availability === state ? 'text-background/70' : 'text-muted-foreground/70')}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPlaceholder')} className="h-9 pl-9" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn(activeFilters > 0 && 'border-primary/50')}>
              <ListFilter />{t('filters')}{activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilters}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {!kind && showKindFilter && (
              <>
                <DropdownMenuLabel>{t('filterKind')}</DropdownMenuLabel>
                {(['video', 'image', 'audio', 'avatar', 'motion', 'template', 'text'] as const).map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item}
                    checked={kinds.includes(item)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => setKinds((current) => (checked ? [...current, item] : current.filter((value) => value !== item)))}
                  >
                    {tKind(item)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>{t('filterAnalysis')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={analysis} onValueChange={(value) => setAnalysis(value as AnalysisFilter)}>
              {(['all', 'analyzed', 'pending', 'failed', 'skipped'] as const).map((value) => (
                <DropdownMenuRadioItem key={value} value={value} onSelect={(event) => event.preventDefault()}>{t(`analysis.${value}`)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('filterSource')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={source} onValueChange={(value) => setSource(value as typeof source)}>
              {(['all', 'upload', 'generated', 'recording'] as const).map((value) => (
                <DropdownMenuRadioItem key={value} value={value} onSelect={(event) => event.preventDefault()}>{t(`source.${value}`)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><ArrowDownWideNarrow />{t(`sort.${sort}`)}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              {(['newest', 'oldest', 'most_used', 'least_used', 'name', 'size'] as const).map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>{t(`sort.${value}`)}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex rounded-xl border border-border bg-muted/40 p-0.5">
          {(['grid', 'list'] as const).map((mode) => {
            const Icon = mode === 'grid' ? LayoutGrid : List
            return (
              <button
                key={mode}
                type="button"
                aria-label={t(`view.${mode}`)}
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={cn('flex size-8 items-center justify-center rounded-lg', view === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </div>

      {(activeFilters > 0 || query) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t('resultCount', { count: filtered.length })}</span>
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground">
            <X className="size-3" />{t('clearFilters')}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        assets.length === 0 && empty ? empty : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Search className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">{t('noResults')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('noResultsHint')}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>{t('clearFilters')}</Button>
          </div>
        )
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              collection={policy}
              selected={selected.has(asset.id)}
              selectionMode={selected.size > 0}
              onToggle={() => toggle(asset.id)}
              onOpen={() => onOpenAsset(asset.id)}
            />
          ))}
        </div>
      ) : (
        <AssetTable
          assets={filtered}
          collection={policy}
          selected={selected}
          allSelected={allSelected}
          onToggle={toggle}
          onToggleAll={() => setSelected(allSelected ? new Set() : new Set(filtered.map((asset) => asset.id)))}
          onOpen={onOpenAsset}
        />
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur">
          <span className="px-3 text-sm font-medium">{t('selected', { count: selected.size })}</span>
          <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map((asset) => asset.id)))} className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            {allSelected ? t('deselectAll') : t('selectAll')}
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"><FolderInput />{t('addToCollection')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              {collections.filter((item) => item.id !== collection?.id && item.status !== 'archived').map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.status === 'frozen'}
                  onSelect={() => {
                    addToCollection(selectedIds, item.id)
                    toast.success(t('addedToast', { count: selectedIds.length, name: item.name }))
                    setSelected(new Set())
                  }}
                >
                  <CollectionGlyph collection={item} size="sm" />
                  <span className="truncate">{item.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {collection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                removeFromCollection(selectedIds, collection.id)
                toast(t('removedToast', { count: selectedIds.length }))
                setSelected(new Set())
              }}
            >
              <FolderMinus />{t('removeFromCollection')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAiExcluded(selectedIds, !selectionHidden)
              setSelected(new Set())
            }}
          >
            {selectionHidden ? <Eye /> : <EyeOff />}{selectionHidden ? t('showToAi') : t('hideFromAi')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { reanalyze(selectedIds); setSelected(new Set()) }}>
            <RefreshCw />{t('reanalyze')}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 />{t('delete')}
          </Button>
          <button type="button" aria-label={t('clearSelection')} onClick={() => setSelected(new Set())} className="ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle', { count: selectedIds.length })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { used: selectedIds.filter((id) => (assets.find((asset) => asset.id === id)?.usage.count ?? 0) > 0).length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                deleteAssets(selectedIds)
                setSelected(new Set())
                toast(t('deletedToast', { count: selectedIds.length }))
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function AssetCard({
  asset,
  collection,
  selected = false,
  selectionMode = false,
  onToggle,
  onOpen,
  compact = false,
}: {
  asset: LibraryAsset
  collection?: LibraryCollection | null
  selected?: boolean
  selectionMode?: boolean
  onToggle?: () => void
  onOpen: () => void
  compact?: boolean
}) {
  const t = useTranslations('Library.assets')
  const relative = useRelativeTime()
  const availability = getAvailability(asset, collection ?? null)
  const limit = collection?.settings.policy.maxUsesPerItem ?? null

  return (
    <div className={cn('group relative', selected && 'z-[1]')}>
      <button
        type="button"
        onClick={selectionMode && onToggle ? onToggle : onOpen}
        className={cn(
          'block w-full overflow-hidden rounded-2xl border bg-card text-left transition-all',
          selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-foreground/20 hover:shadow-md',
        )}
      >
        <div className="relative">
          <AssetCoverView
            cover={asset.cover}
            kind={asset.kind}
            className={cn('w-full', compact ? 'aspect-[4/3]' : 'aspect-[4/3]', (availability.state === 'hidden' || availability.state === 'expired') && 'opacity-60')}
            alt={asset.name}
          />
          {asset.kind === 'text' && asset.text && (
            <div className="absolute inset-0 bg-card px-3 pb-3 pt-9">
              <p className="line-clamp-5 whitespace-pre-line text-[11px] leading-4 text-muted-foreground">{asset.text}</p>
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
            <KindChip kind={asset.kind} duration={asset.durationSeconds} />
            {asset.pinned && <PinnedMark />}
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1">
            <AnalysisBadge state={asset.analysis.state} compact />
            {availability.state !== 'pending_analysis' && <AvailabilityBadge availability={availability} />}
            {asset.flags.includes('duplicate') && availability.state !== 'blocked_duplicate' && <span className="rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('duplicate')}</span>}
            {asset.flags.includes('low_quality') && availability.state !== 'blocked_quality' && <span className="rounded-md bg-zinc-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('lowQuality')}</span>}
          </div>
        </div>
        <div className="space-y-1 px-3 pb-3 pt-2.5">
          <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {collection
              ? limit !== null
                ? t('usageOf', { used: asset.usage.count, limit })
                : t('usageCount', { count: asset.usage.count })
              : formatBytes(asset.sizeBytes)}
            {' · '}
            {asset.usage.lastUsedAt && collection ? t('lastUsed', { time: relative(asset.usage.lastUsedAt) }) : relative(asset.createdAt)}
          </p>
          {!compact && <TagList tags={asset.analysis.tags} max={2} className="pt-0.5" />}
        </div>
      </button>
      {onToggle && (
        <button
          type="button"
          aria-label={selected ? t('deselect') : t('select')}
          aria-pressed={selected}
          onClick={onToggle}
          className={cn(
            'absolute right-2 top-2 flex size-6 items-center justify-center rounded-md border transition-opacity',
            selected ? 'border-primary bg-primary text-primary-foreground opacity-100' : 'border-white/70 bg-black/30 text-transparent opacity-0 backdrop-blur-sm group-hover:opacity-100',
            selectionMode && 'opacity-100',
          )}
        >
          <Check className="size-4" />
        </button>
      )}
    </div>
  )
}

function AssetTable({
  assets,
  collection,
  selected,
  allSelected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  assets: LibraryAsset[]
  collection: LibraryCollection | null
  selected: Set<string>
  allSelected: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  onOpen: (id: string) => void
}) {
  const t = useTranslations('Library.assets')
  const tKind = useTranslations('Library.kind')
  const relative = useRelativeTime()
  const collections = useLibraryStore((state) => state.collections)
  const limit = collection?.settings.policy.maxUsesPerItem ?? null

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label={t('selectAll')} className="size-4" />
            </th>
            <th className="px-3 py-2.5 font-medium">{t('col.name')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.kind')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.collections')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.status')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.usage')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.size')}</th>
            <th className="px-3 py-2.5 font-medium">{t('col.added')}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const Icon = KIND_ICONS[asset.kind]
            const availability = getAvailability(asset, collection)
            return (
              <tr key={asset.id} className={cn('border-b border-border last:border-0 hover:bg-accent/40', selected.has(asset.id) && 'bg-primary/8')}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(asset.id)} onChange={() => onToggle(asset.id)} aria-label={asset.name} className="size-4" />
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onOpen(asset.id)} className="flex items-center gap-3 text-left">
                    <AssetCoverView cover={asset.cover} kind={asset.kind} className="size-10 shrink-0 rounded-lg" iconClassName="size-5" />
                    <span className="min-w-0">
                      <span className="block max-w-72 truncate font-medium text-foreground">{asset.name}</span>
                      <span className="block max-w-72 truncate text-xs text-muted-foreground">{asset.analysis.tags.slice(0, 3).join(' · ')}</span>
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" />{tKind(asset.kind)}</span></td>
                <td className="px-3 py-2">
                  <div className="flex -space-x-1">
                    {asset.collectionIds.slice(0, 3).map((id) => {
                      const item = collections.find((candidate) => candidate.id === id)
                      return item ? <CollectionGlyph key={id} collection={item} size="sm" className="ring-2 ring-card" /> : null
                    })}
                    {asset.collectionIds.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <AnalysisBadge state={asset.analysis.state} />
                    {availability.state !== 'pending_analysis' && <AvailabilityBadge availability={availability} />}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{limit !== null ? `${asset.usage.count}/${limit}` : asset.usage.count}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatBytes(asset.sizeBytes)}</td>
                <td className="px-3 py-2 text-muted-foreground">{relative(asset.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

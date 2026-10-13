'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'

import { PageHeader } from '@/components/common/page-header'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CATALOG_TABS,
  buildCatalog,
  categoryCounts,
  filterCatalog,
  searchCatalog,
  starterMotion,
  type CatalogItem,
  type CatalogTab,
  type CategoryId,
} from '@/lib/motion-editor/catalog-model'
import type { CatalogPreviewSource } from '@/lib/motion-editor/catalog-preview-source'
import type { LiveSlotPool } from '@/lib/motion-editor/live-slots'
import type { MotionLibraryState } from '@/lib/motion-editor/library-session'

import type { MotionPlayerDeps } from '../motion-runtime-player'
import { MotionCatalogCard } from './motion-card'
import { MotionCreateBar } from './motion-create-bar'
import { MotionDetailDialog, type CustomizeStatus } from './motion-detail-dialog'
import type { SparkPickerDeps } from './motion-spark-picker'

export type MotionCatalogViewProps = {
  state: MotionLibraryState
  tab: CatalogTab
  category: CategoryId | null
  query: string
  /** The Motion whose dialog is open (`?motion=`); an id that matches nothing opens nothing. */
  openId: string | null
  onTab: (tab: CatalogTab) => void
  onCategory: (category: CategoryId | null) => void
  onQuery: (query: string) => void
  onOpen: (id: string) => void
  onClose: () => void
  styleRef: string
  onStyleRef: (ref: string) => void
  onCustomize: (item: CatalogItem) => void
  /** "Create motion": creates the draft with the prompt and opens it; false = nothing was created. */
  onCreate: (prompt: string) => Promise<boolean>
  creating: boolean
  createFailed: boolean
  onRetry: () => void
  source: CatalogPreviewSource
  pool: LiveSlotPool
  playerDeps?: MotionPlayerDeps
  spark: SparkPickerDeps
}

/**
 * `/motion` as a catalog (pure view): title, the "Create motion" bar, tabs (Catalog, My Motions, Drafts), search, category
 * chips with counts and a responsive grid of live cards; a card opens the Motion's dialog. All UI state (tab, category,
 * search, open Motion) arrives as props: the page keeps it in the URL, never in browser storage.
 */
export function MotionCatalogView(props: MotionCatalogViewProps) {
  const { state, tab, category, query, openId, onTab, onCategory, onQuery, onOpen, onClose, onRetry } = props
  const t = useTranslations('Motion.catalog')
  const library = useTranslations('Motion.library')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const categoryLabel = React.useCallback((id: CategoryId) => t(`categories.${id}`), [t])

  const catalog = React.useMemo(() => buildCatalog({ motions: state.motions, revisions: state.revisions, drafts: state.drafts }), [state.motions, state.revisions, state.drafts])
  const items = catalog[tab]
  const searched = React.useMemo(() => searchCatalog(items, { query, locale }, categoryLabel), [items, query, locale, categoryLabel])
  const chips = React.useMemo(() => categoryCounts(searched), [searched])
  // A category that no longer holds anything (another tab, another search) is not a filter: the grid never goes blank for it.
  const activeCategory = category && chips.some((chip) => chip.id === category) ? category : null
  const visible = React.useMemo(() => filterCatalog(items, { query, category: activeCategory, locale }, categoryLabel), [items, query, activeCategory, locale, categoryLabel])
  const openItem = openId ? Object.values(catalog).flat().find((item) => item.id === openId) ?? null : null

  if (state.status === 'loading') return <WorkspaceRouteLoading />

  const community = (
    <Button asChild variant="outline" size="sm">
      <Link href="/motion/community">{t('community')}</Link>
    </Button>
  )

  if (state.status === 'unavailable' || state.status === 'error') {
    return (
      <div className="p-6" data-motion-library={state.status}>
        <PageHeader breadcrumbs={[{ label: t('title') }]} title={t('title')} actions={community} />
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-md border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground" role="alert">
          <p>{state.status === 'unavailable' ? library('unavailable') : library('loadFailed')}</p>
          {state.status === 'error' ? <Button onClick={onRetry}>{library('retry')}</Button> : null}
        </div>
      </div>
    )
  }

  const starter = starterMotion(state.motions)
  const createUnavailable = state.catalogue === 'unavailable' || starter === null || props.styleRef === ''
  const emptyMessage =
    tab === 'catalog'
      ? state.catalogue === 'unavailable'
        ? library('catalogueClosed')
        : t('empty.catalog')
      : tab === 'mine'
        ? state.revisionsStatus === 'error'
          ? library('motionsFailed')
          : t('empty.mine')
        : t('empty.drafts')
  const filtering = query.trim() !== '' || activeCategory !== null

  return (
    <div className="px-6 pt-6 pb-10" data-motion-library={state.status} data-motion-catalog={tab}>
      <PageHeader breadcrumbs={[{ label: t('title') }]} title={t('title')} description={t('subtitle')} actions={community} className="mb-4" />
      <MotionCreateBar onSubmit={props.onCreate} busy={props.creating} failed={props.createFailed} unavailable={createUnavailable} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={(value) => onTab(value as CatalogTab)}>
            <TabsList aria-label={t('tabsLabel')}>
              {CATALOG_TABS.map((id) => (
                <TabsTrigger key={id} value={id} className="gap-2 px-3">
                  {t(`tabs.${id}`)}
                  <span className="text-xs text-muted-foreground" data-motion-tab-count={id}>{catalog[id].length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              className="h-9 w-full rounded-xl border border-border bg-panel/50 pr-9 pl-9 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {query !== '' ? (
              <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('search.clear')} onClick={() => onQuery('')}>
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('categoriesLabel')} data-motion-chips="">
            <Chip pressed={activeCategory === null} onClick={() => onCategory(null)} label={t('categories.all')} count={searched.length} id="all" />
            {chips.map((chip) => (
              <Chip key={chip.id} pressed={activeCategory === chip.id} onClick={() => onCategory(chip.id)} label={categoryLabel(chip.id)} count={chip.count} id={chip.id} />
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground" role="status" data-motion-result-count="">{t('resultCount', { count: visible.length })}</p>

        {visible.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground" data-motion-empty={filtering ? 'filtered' : tab}>
            <p>{filtering && items.length > 0 ? t('empty.filtered') : emptyMessage}</p>
            {filtering && items.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => { onQuery(''); onCategory(null) }}>{t('empty.clear')}</Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-motion-grid="">
            {visible.map((item) => (
              <MotionCatalogCard key={item.id} item={item} pool={props.pool} source={props.source} {...(props.playerDeps && { playerDeps: props.playerDeps })} suspended={openItem !== null} onOpen={onOpen} />
            ))}
          </ul>
        )}
        {tab === 'drafts' ? <p className="text-xs text-muted-foreground">{t('empty.archivedHidden')}</p> : null}
      </div>

      {openItem ? (
        <MotionDetailDialog
          item={openItem}
          onClose={onClose}
          source={props.source}
          {...(props.playerDeps && { playerDeps: props.playerDeps })}
          styles={state.styles}
          styleRef={props.styleRef}
          onStyleRef={props.onStyleRef}
          onCustomize={props.onCustomize}
          customize={customizeStatus(state, openItem)}
          spark={props.spark}
        />
      ) : null}
    </div>
  )
}

function customizeStatus(state: MotionLibraryState, item: CatalogItem): CustomizeStatus {
  const failure = state.createFailure?.motionId === item.id ? state.createFailure : null
  return { busy: state.creatingMotionId === item.id, failure: failure ? { kind: failure.kind, reason: failure.reason } : null }
}

function Chip({ pressed, onClick, label, count, id }: { pressed: boolean; onClick: () => void; label: string; count: number; id: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-motion-chip={id}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-foreground/40 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
    >
      {label}
      <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  )
}

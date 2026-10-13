'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Plus, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { cn } from '@/lib/utils'

import { LibraryAssetSheet } from './library-asset-sheet'
import { LibraryAssetsView } from './library-assets-view'
import { LibraryCollectionView } from './library-collection-view'
import { LibraryGenerationsView } from './library-generations'
import { LibraryNewCollectionDialog } from './library-new-collection-dialog'
import { LibraryPendingBar, LibraryReviewSheet } from './library-review'
import { useLibraryStore } from './library-store'
import { ASSET_KINDS, type AssetKind } from './library-types'
import { LibraryUploadDialog, LibraryUploadProgress } from './library-upload-dialog'

type View =
  | { name: 'all' }
  | { name: 'recent' }
  | { name: 'type'; kind: AssetKind }
  | { name: 'collection'; id: string }

function readView(params: URLSearchParams): View {
  const collection = params.get('collection')
  if (collection) return { name: 'collection', id: collection }
  const type = params.get('type')
  if (type && (ASSET_KINDS as readonly string[]).includes(type)) return { name: 'type', kind: type as AssetKind }
  if (params.get('view') === 'recent') return { name: 'recent' }
  return { name: 'all' }
}

// The Library is mock state created in the browser (relative times, simulated analysis), so it renders on the
// client only; rendering it on the server would produce different timestamps and a hydration mismatch.
export function LibraryPage() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted ? <LibraryPageContent /> : <WorkspaceRouteLoading />
}

function LibraryPageContent() {
  const t = useTranslations('Library')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const assets = useLibraryStore((state) => state.assets)
  const collections = useLibraryStore((state) => state.collections)
  const retentionDays = useLibraryStore((state) => state.preferences.generationRetentionDays)

  const view = readView(searchParams)
  const query = searchParams.get('q') ?? ''
  const openAssetId = searchParams.get('asset')
  const reviewTab = searchParams.get('review')
  const [upload, setUpload] = React.useState<{ open: boolean; destination: string }>({ open: false, destination: 'auto' })

  const setParams = React.useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    const queryString = next.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const openAsset = React.useCallback((id: string) => setParams({ asset: id }), [setParams])
  const openReview = React.useCallback((tab: string) => setParams({ review: tab }), [setParams])
  const openUpload = (destination = 'auto') => setUpload({ open: true, destination })

  const collection = view.name === 'collection' ? collections.find((item) => item.id === view.id) ?? null : null
  const header = view.name === 'all'
    ? { title: t('nav.all'), subtitle: t('countSubtitle', { count: assets.length }) }
    : view.name === 'recent'
      ? { title: t('nav.recent'), subtitle: t('recentRetention', { days: retentionDays }) }
      : view.name === 'type'
        ? { title: t(`kinds.${view.kind}`), subtitle: t('countSubtitle', { count: assets.filter((asset) => asset.kind === view.kind).length }) }
        : null

  return (
    <div className="hg-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {header ? (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">{header.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{header.subtitle}</p>
            </div>
            {view.name !== 'recent' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => openUpload()}><Upload />{t('actions.upload')}</Button>
                <Button onClick={() => setParams({ new: '1' })}><Plus />{t('actions.newCollection')}</Button>
              </div>
            )}
          </div>
        ) : (
          <nav aria-label={t('breadcrumb')} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/library" className="hover:text-foreground">{t('title')}</Link>
            <ChevronRight className="size-3" />
            <span>{t('nav.collections')}</span>
          </nav>
        )}

        {(view.name === 'all' || view.name === 'type') && (
          <div className="mb-4 flex items-center gap-3">
            <TypeChips active={view.name === 'type' ? view.kind : null} />
            <LibraryPendingBar onReview={openReview} className="ml-auto shrink-0" />
          </div>
        )}

        {view.name === 'all' && <LibraryAssetsView assets={assets} initialQuery={query} onOpenAsset={openAsset} showKindFilter={false} />}
        {view.name === 'type' && <LibraryAssetsView assets={assets.filter((asset) => asset.kind === view.kind)} kind={view.kind} initialQuery={query} onOpenAsset={openAsset} />}
        {view.name === 'recent' && <LibraryGenerationsView onOpenAsset={openAsset} />}
        {view.name === 'collection' && (collection ? (
          <LibraryCollectionView collection={collection} onOpenAsset={openAsset} onUpload={openUpload} onReview={() => openReview('suggestions')} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm font-medium">{t('collectionMissing')}</p>
            <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/library">{t('backToLibrary')}</Link></Button>
          </div>
        ))}
      </div>

      <LibraryReviewSheet tab={reviewTab} onClose={() => setParams({ review: null })} onOpenAsset={openAsset} />
      <LibraryAssetSheet assetId={openAssetId} onClose={() => setParams({ asset: null })} />
      <LibraryNewCollectionDialog
        open={searchParams.has('new')}
        onOpenChange={(open) => !open && setParams({ new: null })}
        onCreated={(id) => router.push(`/library?collection=${id}`)}
      />
      <LibraryUploadDialog open={upload.open} initialDestination={upload.destination} onOpenChange={(open) => setUpload((current) => ({ ...current, open }))} />
      <LibraryUploadProgress />
    </div>
  )
}

/** The item types as pill links (`/library?type=…`); they replace the type list that used to sit in the sidebar. */
function TypeChips({ active }: { active: AssetKind | null }) {
  const t = useTranslations('Library')
  const chip = (selected: boolean) => cn(
    'inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors',
    selected ? 'bg-foreground text-background' : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
  )
  return (
    <nav aria-label={t('nav.types')} className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href="/library" aria-current={active === null ? 'page' : undefined} className={chip(active === null)}>{t('typesAll')}</Link>
      {ASSET_KINDS.map((kind) => (
        <Link key={kind} href={`/library?type=${kind}`} aria-current={active === kind ? 'page' : undefined} className={chip(active === kind)}>
          {t(`kinds.${kind}`)}
        </Link>
      ))}
    </nav>
  )
}

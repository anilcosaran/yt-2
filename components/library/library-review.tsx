'use client'

import * as React from 'react'
import { Check, CircleAlert, Copy, EyeOff, Inbox, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { useLibraryStore } from './library-store'
import type { LibraryAsset } from './library-types'
import { AssetCoverView, CollectionGlyph, TagList } from './library-ui'

type ReviewTab = 'suggestions' | 'consent' | 'failed' | 'duplicates'

function useReviewCounts() {
  const assets = useLibraryStore((state) => state.assets)
  const suggestions = useLibraryStore((state) => state.suggestions)
  return {
    suggestions: suggestions.length,
    consent: assets.filter((asset) => asset.flags.includes('needs_consent')).length,
    failed: assets.filter((asset) => asset.analysis.state === 'failed').length,
    duplicates: assets.filter((asset) => asset.flags.includes('duplicate')).length,
  } satisfies Record<ReviewTab, number>
}

/** A small pill next to the type chips when something waits for the owner's decision; opens the review panel. */
export function LibraryPendingBar({ onReview, className }: { onReview: (tab: ReviewTab) => void; className?: string }) {
  const t = useTranslations('Library.review')
  const counts = useReviewCounts()
  const parts = (Object.keys(counts) as ReviewTab[]).filter((key) => counts[key] > 0)
  if (!parts.length) return null
  const total = parts.reduce((sum, key) => sum + counts[key], 0)
  return (
    <button
      type="button"
      onClick={() => onReview(parts[0])}
      title={parts.map((key) => t(`pendingPart.${key}`, { count: counts[key] })).join(' · ')}
      className={cn('inline-flex h-9 items-center gap-2 rounded-full border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', className)}
    >
      <Inbox className="size-4" />
      <span className="hidden sm:inline">{t('pendingShort', { count: total })}</span>
      <span className="text-foreground tabular-nums sm:hidden">{total}</span>
    </button>
  )
}

export function LibraryReviewSheet({ tab, onClose, onOpenAsset }: { tab: string | null; onClose: () => void; onOpenAsset: (id: string) => void }) {
  const t = useTranslations('Library.review')
  return (
    <Sheet open={tab !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>
        <div className="p-6">
          {tab !== null && <LibraryReviewView onOpenAsset={onOpenAsset} initialTab={tab} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function LibraryReviewView({ onOpenAsset, initialTab }: { onOpenAsset: (id: string) => void; initialTab?: string | null }) {
  const t = useTranslations('Library.review')
  const assets = useLibraryStore((state) => state.assets)
  const collections = useLibraryStore((state) => state.collections)
  const suggestions = useLibraryStore((state) => state.suggestions)
  const store = useLibraryStore.getState()

  const consent = assets.filter((asset) => asset.flags.includes('needs_consent'))
  const failed = assets.filter((asset) => asset.analysis.state === 'failed')
  const duplicates = assets.filter((asset) => asset.flags.includes('duplicate'))
  const counts: Record<ReviewTab, number> = { suggestions: suggestions.length, consent: consent.length, failed: failed.length, duplicates: duplicates.length }
  const firstWithItems = (Object.keys(counts) as ReviewTab[]).find((key) => counts[key] > 0) ?? 'suggestions'
  const requested = (['suggestions', 'consent', 'failed', 'duplicates'] as const).find((value) => value === initialTab)
  const [tab, setTab] = React.useState<ReviewTab>(requested ?? firstWithItems)
  React.useEffect(() => {
    if (requested) setTab(requested)
  }, [requested])

  const byCollection = collections
    .map((collection) => ({ collection, items: suggestions.filter((suggestion) => suggestion.collectionId === collection.id) }))
    .filter((group) => group.items.length > 0)
  const assetById = (id: string) => assets.find((asset) => asset.id === id)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {(['suggestions', 'consent', 'failed', 'duplicates'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              tab === value ? 'border-foreground/30 bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t(`tab.${value}`)}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', tab === value ? 'bg-background/20' : counts[value] ? 'bg-primary/15 text-primary' : 'bg-muted')}>{counts[value]}</span>
          </button>
        ))}
      </div>

      {tab === 'suggestions' && (
        byCollection.length === 0 ? <AllClear text={t('emptySuggestions')} /> : (
          <div className="space-y-4">
            {byCollection.map(({ collection, items }) => (
              <section key={collection.id} className="rounded-2xl border border-border bg-card">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CollectionGlyph collection={collection} />
                    <div>
                      <p className="text-sm font-semibold">{collection.name}</p>
                      <p className="text-xs text-muted-foreground">{t('suggestedCount', { count: items.length })}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => { store.acceptAllSuggestions(collection.id); toast.success(t('acceptedAllToast', { count: items.length, name: collection.name })) }}>
                    <Check />{t('acceptAll')}
                  </Button>
                </header>
                <ul className="divide-y divide-border">
                  {items.map((suggestion) => {
                    const asset = assetById(suggestion.assetId)
                    if (!asset) return null
                    return (
                      <li key={suggestion.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                        <button type="button" onClick={() => onOpenAsset(asset.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <AssetCoverView cover={asset.cover} kind={asset.kind} className="size-14 shrink-0 rounded-xl" iconClassName="size-6" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{asset.name}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3 text-primary" />{suggestion.reason}</span>
                            <TagList tags={asset.analysis.tags} className="mt-1" />
                          </span>
                        </button>
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{t('confidence')}</span><span className="tabular-nums">%{Math.round(suggestion.confidence * 100)}</span></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={cn('h-full rounded-full', suggestion.confidence >= 0.85 ? 'bg-emerald-500' : suggestion.confidence >= 0.7 ? 'bg-amber-400' : 'bg-orange-500')} style={{ width: `${suggestion.confidence * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => store.rejectSuggestion(suggestion.id)}><X />{t('reject')}</Button>
                          <Button size="sm" onClick={() => store.acceptSuggestion(suggestion.id)}><Check />{t('accept')}</Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )
      )}

      {tab === 'consent' && (
        consent.length === 0 ? <AllClear text={t('emptyConsent')} /> : (
          <IssueList
            icon={ShieldAlert}
            tone="rose"
            intro={t('consentIntro')}
            assets={consent}
            onOpenAsset={onOpenAsset}
            actions={(asset) => (
              <>
                <Button size="sm" variant="outline" onClick={() => store.setAiExcluded([asset.id], true)}><EyeOff />{t('hideFromAi')}</Button>
                <Button size="sm" onClick={() => { store.grantConsent([asset.id]); toast.success(t('consentToast')) }}><Check />{t('markConsent')}</Button>
              </>
            )}
          />
        )
      )}

      {tab === 'failed' && (
        failed.length === 0 ? <AllClear text={t('emptyFailed')} /> : (
          <IssueList
            icon={CircleAlert}
            tone="red"
            intro={t('failedIntro')}
            assets={failed}
            onOpenAsset={onOpenAsset}
            detail={(asset) => asset.analysis.failure}
            actions={(asset) => (
              <>
                <Button size="sm" variant="outline" onClick={() => useLibraryStore.setState((state) => ({
                  assets: state.assets.map((item) => (item.id === asset.id ? { ...item, analysis: { ...item.analysis, state: 'skipped' } } : item)),
                }))}>{t('skip')}</Button>
                <Button size="sm" onClick={() => store.reanalyze([asset.id])}><RefreshCw />{t('retry')}</Button>
              </>
            )}
          />
        )
      )}

      {tab === 'duplicates' && (
        duplicates.length === 0 ? <AllClear text={t('emptyDuplicates')} /> : (
          <IssueList
            icon={Copy}
            tone="violet"
            intro={t('duplicatesIntro')}
            assets={duplicates}
            onOpenAsset={onOpenAsset}
            actions={(asset) => (
              <>
                <Button size="sm" variant="outline" onClick={() => store.resolveDuplicate(asset.id, 'keep')}>{t('keepBoth')}</Button>
                <Button size="sm" onClick={() => { store.resolveDuplicate(asset.id, 'merge'); toast.success(t('mergedToast')) }}>{t('merge')}</Button>
              </>
            )}
          />
        )
      )}
    </div>
  )
}

function IssueList({
  icon: Icon,
  tone,
  intro,
  assets,
  onOpenAsset,
  actions,
  detail,
}: {
  icon: typeof ShieldAlert
  tone: 'rose' | 'red' | 'violet'
  intro: string
  assets: LibraryAsset[]
  onOpenAsset: (id: string) => void
  actions: (asset: LibraryAsset) => React.ReactNode
  detail?: (asset: LibraryAsset) => string | undefined
}) {
  const collections = useLibraryStore((state) => state.collections)
  const toneClass = tone === 'rose' ? 'text-rose-500' : tone === 'red' ? 'text-red-500' : 'text-violet-500'
  return (
    <section className="rounded-2xl border border-border bg-card">
      <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm text-muted-foreground"><Icon className={cn('size-4', toneClass)} />{intro}</p>
      <ul className="divide-y divide-border">
        {assets.map((asset) => (
          <li key={asset.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <button type="button" onClick={() => onOpenAsset(asset.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <AssetCoverView cover={asset.cover} kind={asset.kind} className="size-14 shrink-0 rounded-xl" iconClassName="size-6" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{asset.name}</span>
                {detail?.(asset) && <span className="block text-xs text-red-600 dark:text-red-400">{detail(asset)}</span>}
                <span className="mt-1 flex flex-wrap gap-1">
                  {asset.collectionIds.map((id) => {
                    const collection = collections.find((item) => item.id === id)
                    return collection ? (
                      <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        <CollectionGlyph collection={collection} size="sm" className="size-3.5 rounded" />{collection.name}
                      </span>
                    ) : null
                  })}
                </span>
              </span>
            </button>
            <div className="flex gap-1.5">{actions(asset)}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AllClear({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><Check className="size-5" /></span>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

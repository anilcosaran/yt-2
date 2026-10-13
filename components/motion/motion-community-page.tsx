'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { PageHeader } from '@/components/common/page-header'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { MotionBuyDialogHost, useMotionBuy } from '@/components/spark/tools/motion-buy-dialog'
import '@/components/spark/studio/studio.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MotionCommunitySession, type MotionCommunityState } from '@/lib/motion-market/community-session'
import type { MotionLibraryItem, MotionListing } from '@/lib/motion-market/motion-market'
import { motionBuyTargetFromListing } from '@/lib/motion-market/purchase-session'
import type { MotionRevision } from '@/lib/motion-editor/api'

import { MotionSellDialog, type MotionSellTarget } from './motion-sell-dialog'

export type MotionCommunityTab = 'browse' | 'sell' | 'bought'
const TABS: readonly MotionCommunityTab[] = ['browse', 'sell', 'bought']

type T = ReturnType<typeof useTranslations>

function localized(value: { en: string; tr: string }, locale: 'en' | 'tr'): string {
  return value[locale] || value.en
}

/**
 * E1-I the Community Motions screen (pure view): the Community cards with Buy, the seller's saved Motions with "Sell in Community" and their
 * sales, and the Motions this workspace bought. Server state only; a closed marketplace says so instead of showing an empty catalogue.
 */
export function MotionCommunityView({
  state,
  tab,
  onTab,
  onSearch,
  onMore,
  onRetry,
  onBuy,
  onSell,
}: {
  state: MotionCommunityState
  tab: MotionCommunityTab
  onTab: (tab: MotionCommunityTab) => void
  onSearch: (query: string) => void
  onMore: () => void
  onRetry: () => void
  onBuy: (listing: MotionListing) => void
  onSell: (revision: MotionRevision, listing: MotionListing | null) => void
}) {
  const t = useTranslations('Motion.market.community')
  const tm = useTranslations('Motion.market')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const [draft, setDraft] = React.useState('')

  if (state.status === 'loading') return <WorkspaceRouteLoading />
  return (
    <div className="p-6" data-motion-community={state.status}>
      <PageHeader
        breadcrumbs={[{ label: t('back') }, { label: t('title') }]}
        title={t('title')}
        description={t('intro')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/motion">{t('back')}</Link>
          </Button>
        }
      />
      {state.status === 'unavailable' || state.status === 'error' ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-md border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground" role="alert">
          <p>{state.status === 'unavailable' ? t('unavailable') : t('loadFailed')}</p>
          {state.status === 'error' ? <Button onClick={onRetry}>{t('retry')}</Button> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div role="tablist" aria-label={t('title')} className="flex gap-1 border-b border-border">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`motion-community-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`motion-community-panel-${id}`}
                data-motion-community-tab={id}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => onTab(id)}
              >
                {t(`tabs.${id}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`motion-community-panel-${tab}`} aria-labelledby={`motion-community-tab-${tab}`} className="flex flex-col gap-4">
            {tab === 'browse' ? (
              <BrowsePanel state={state} t={t} locale={locale} draft={draft} setDraft={setDraft} onSearch={onSearch} onMore={onMore} onBuy={onBuy} />
            ) : tab === 'sell' ? (
              <SellPanel state={state} t={t} tm={tm} locale={locale} onSell={onSell} />
            ) : (
              <BoughtPanel items={state.library} t={t} locale={locale} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BrowsePanel({
  state,
  t,
  locale,
  draft,
  setDraft,
  onSearch,
  onMore,
  onBuy,
}: {
  state: MotionCommunityState
  t: T
  locale: 'en' | 'tr'
  draft: string
  setDraft: (value: string) => void
  onSearch: (query: string) => void
  onMore: () => void
  onBuy: (listing: MotionListing) => void
}) {
  return (
    <>
      <form
        role="search"
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch(draft.trim())
        }}
      >
        <Input type="search" aria-label={t('search')} placeholder={t('searchPlaceholder')} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" variant="outline" disabled={state.searching}>
          {t('search')}
        </Button>
      </form>
      {state.browseFailed ? (
        <p className="text-sm text-destructive" role="alert">
          {t('loadFailed')}
        </p>
      ) : null}
      {state.listings.length === 0 ? (
        <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground" data-motion-community-empty="browse">
          {state.query ? t('empty.search') : t('empty.browse')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy={state.searching || undefined}>
          {state.listings.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing} t={t} locale={locale} onBuy={onBuy} />
          ))}
        </ul>
      )}
      {state.nextCursor ? (
        <Button variant="outline" className="self-start" disabled={state.loadingMore} aria-busy={state.loadingMore || undefined} onClick={onMore}>
          {t('more')}
        </Button>
      ) : null}
    </>
  )
}

function ListingCard({ listing, t, locale, onBuy }: { listing: MotionListing; t: T; locale: 'en' | 'tr'; onBuy: (listing: MotionListing) => void }) {
  const title = localized(listing.title, locale)
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-4" data-motion-listing={listing.motion_id}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline">{t('card.price', { price: listing.price_credits })}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{listing.summary}</p>
      <div className="flex flex-wrap gap-1">
        {listing.aspect_ratios.map((ratio) => (
          <Badge key={ratio} variant="secondary" className="font-mono">
            {ratio}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {listing.seller?.username ? t('card.by', { seller: listing.seller.username }) : t('card.by', { seller: t('card.member') })}
        {listing.parameter_count > 0 ? ` · ${t('card.fields', { count: listing.parameter_count })}` : ''}
      </p>
      {listing.owned ? (
        <Badge className="self-start" data-motion-listing-state="owned">
          {t('card.owned')}
        </Badge>
      ) : listing.own_listing ? (
        <Badge variant="secondary" className="self-start" data-motion-listing-state="yours">
          {t('card.yours')}
        </Badge>
      ) : (
        <Button size="sm" className="self-start" disabled={!listing.purchasable} onClick={() => onBuy(listing)}>
          {t('card.buy')}
        </Button>
      )}
    </li>
  )
}

function SellPanel({
  state,
  t,
  tm,
  locale,
  onSell,
}: {
  state: MotionCommunityState
  t: T
  tm: T
  locale: 'en' | 'tr'
  onSell: (revision: MotionRevision, listing: MotionListing | null) => void
}) {
  const listingOf = (revision: MotionRevision) => state.myListings.find((listing) => listing.motion_id === revision.motion_id) ?? null
  const earnings = state.earnings
  return (
    <>
      <section aria-labelledby="motion-community-earnings" className="flex flex-col gap-2 rounded-md border border-border bg-card p-4" data-motion-earnings>
        <h2 id="motion-community-earnings" className="text-sm font-semibold">
          {t('earnings.title')}
        </h2>
        {earnings && earnings.sales_count > 0 ? (
          <>
            <p className="text-sm">
              {t('earnings.count', { count: earnings.sales_count })} · {t('earnings.earned', { credits: earnings.creator_share_credits })}
            </p>
            {earnings.pending_credits > 0 ? <p className="text-xs text-muted-foreground">{t('earnings.pending', { credits: earnings.pending_credits })}</p> : null}
            {earnings.settled_credits > 0 ? <p className="text-xs text-muted-foreground">{t('earnings.settled', { credits: earnings.settled_credits })}</p> : null}
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {state.sales.map((sale) => (
                <li key={sale.sale_id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {sale.title ?? sale.motion_id} · {t('earnings.sold', { price: sale.price_credits, share: sale.creator_share_credits })}
                  </span>
                  <Badge variant="outline">{t(`earnings.state.${sale.earning_state}`)}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t('earnings.note')}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('earnings.empty')}</p>
        )}
      </section>
      <section aria-labelledby="motion-community-sell" className="flex flex-col gap-3">
        <h2 id="motion-community-sell" className="text-sm font-semibold">
          {t('sell.heading')}
        </h2>
        {state.publishedStatus !== 'ok' ? (
          <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground" role={state.publishedStatus === 'error' ? 'alert' : undefined}>
            {state.publishedStatus === 'error' ? t('loadFailed') : tm('errors.unavailable')}
          </p>
        ) : state.published.length === 0 ? (
          <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground" data-motion-community-empty="sell">
            {t('empty.sell')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.published.map((revision) => {
              const listing = listingOf(revision)
              const forSale = listing?.state === 'active'
              const removed = listing?.state === 'delisted' && listing.delisted_by === 'admin'
              return (
                <li key={revision.motion_revision_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-3" data-motion-published={revision.motion_id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{localized(revision.title, locale)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('sell.revision', { n: revision.revision_number })} · {forSale && listing ? t('sell.forSale', { price: listing.price_credits }) : removed ? t('sell.removed') : t('sell.notForSale')}
                    </span>
                  </div>
                  {removed ? null : (
                    <Button size="sm" variant={forSale ? 'outline' : 'default'} onClick={() => onSell(revision, listing)}>
                      {forSale ? t('sell.edit') : t('sell.action')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function BoughtPanel({ items, t, locale }: { items: readonly MotionLibraryItem[]; t: T; locale: 'en' | 'tr' }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground" data-motion-community-empty="bought">
        {t('empty.bought')}
      </p>
    )
  }
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.sale_id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-4" data-motion-bought={item.motion_id}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{localized(item.title, locale)}</span>
              <Badge variant="outline">{t(`bought.source.${item.source}`)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{item.summary}</p>
            <p className="text-xs text-muted-foreground">{t('bought.paid', { price: item.price_credits })}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('bought.hint')}</p>
    </>
  )
}

/** The Community Motions screen: loads its own state, opens the buy dialog (studio design) and the sell dialog. */
export function MotionCommunityPage() {
  const [session] = React.useState(() => new MotionCommunitySession())
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [tab, setTab] = React.useState<MotionCommunityTab>('browse')
  // T1R-12: only WHAT is being sold is kept; its listing is read from the live state on every render, so a version that moved
  // (another tab, a repricing, a takedown) reaches the open dialog and the next try names it.
  const [selling, setSelling] = React.useState<{ target: MotionSellTarget } | null>(null)
  const sellingListing = selling ? (state.myListings.find((entry) => entry.motion_id === selling.target.motionId) ?? null) : null
  const buy = useMotionBuy({
    onPurchased: () => void session.refreshLibrary(),
    onStale: () => void session.refreshBrowse(),
  })

  React.useEffect(() => {
    void session.load()
    return () => session.dispose()
  }, [session])

  return (
    <>
      <MotionCommunityView
        state={state}
        tab={tab}
        onTab={setTab}
        onSearch={(query) => void session.search(query)}
        onMore={() => void session.loadMore()}
        onRetry={() => void session.load()}
        onBuy={(listing) => buy.open(motionBuyTargetFromListing(listing))}
        onSell={(revision) => setSelling({ target: { motionId: revision.motion_id, motionRevisionId: revision.motion_revision_id, title: revision.title } })}
      />
      <MotionBuyDialogHost>{buy.dialog}</MotionBuyDialogHost>
      {selling ? (
        <MotionSellDialog
          target={selling.target}
          listing={sellingListing}
          onClose={() => setSelling(null)}
          onChanged={() => void session.refreshMine()}
        />
      ) : null}
    </>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { History, LibraryBig, Loader2, Plus, Rows3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import { formatBytes } from './library-logic'
import { STORAGE_EXTRA_USED_BYTES, STORAGE_QUOTA_BYTES } from './library-seed'
import { useLibraryStore } from './library-store'
import { CollectionGlyph } from './library-ui'
import { SidebarToggleIcon } from '@/components/layout/sidebar-toggle-icon'

export function LibrarySidebarNav({ channelName, onCollapse }: { channelName: string; onCollapse?: () => void }) {
  const t = useTranslations('Library')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const assets = useLibraryStore((state) => state.assets)
  const collections = useLibraryStore((state) => state.collections)
  const generations = useLibraryStore((state) => state.generations)

  const onLibrary = pathname.startsWith('/library')
  const view = onLibrary ? searchParams.get('view') : null
  const collectionId = onLibrary ? searchParams.get('collection') : null
  // Type filters are chips on the page now, so `?type=` still counts as All items.
  const isAll = onLibrary && view !== 'recent' && !collectionId
  const running = generations.some((generation) => generation.status === 'running')
  const usedBytes = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0) + STORAGE_EXTRA_USED_BYTES
  const active = collections.filter((collection) => collection.status !== 'archived')
  const archived = collections.filter((collection) => collection.status === 'archived')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-sidebar-accent text-foreground">
            <LibraryBig className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('title')}</p>
            <p className="text-xs text-muted-foreground">{channelName}</p>
          </div>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('nav.collapse')}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SidebarToggleIcon className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className="hg-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <div className="space-y-0.5">
          <NavLink href="/library" active={isAll} icon={Rows3} label={t('nav.all')} count={assets.length} />
          <NavLink
            href="/library?view=recent"
            active={view === 'recent'}
            icon={running ? Loader2 : History}
            iconClassName={running ? 'animate-spin' : undefined}
            label={t('nav.recent')}
            count={generations.length}
          />
        </div>

        <NavGroup title={t('nav.collections')}>
          {active.map((collection) => (
            <CollectionLink
              key={collection.id}
              collection={collection}
              active={collectionId === collection.id}
              count={assets.filter((asset) => asset.collectionIds.includes(collection.id)).length}
            />
          ))}
          <Link href="/library?new=1" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground">
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed border-border"><Plus className="size-3.5" /></span>
            {t('nav.addCollection')}
          </Link>
        </NavGroup>

        {archived.length > 0 && (
          <NavGroup title={t('nav.archived')}>
            {archived.map((collection) => (
              <CollectionLink key={collection.id} collection={collection} active={collectionId === collection.id} count={assets.filter((asset) => asset.collectionIds.includes(collection.id)).length} muted />
            ))}
          </NavGroup>
        )}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('nav.storage')}</span>
          <span className="tabular-nums text-foreground">{formatBytes(usedBytes)} / {formatBytes(STORAGE_QUOTA_BYTES)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (usedBytes / STORAGE_QUOTA_BYTES) * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

function NavGroup({ title, addHref, addLabel, children }: { title: string; addHref?: string; addLabel?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        {addHref && (
          <Link href={addHref} aria-label={addLabel} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function NavLink({
  href,
  active,
  icon: Icon,
  iconClassName,
  label,
  count,
}: {
  href: string
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  iconClassName?: string
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        active ? 'bg-sidebar-accent font-medium text-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground', iconClassName)} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Link>
  )
}

function CollectionLink({
  collection,
  active,
  count,
  muted = false,
}: {
  collection: Parameters<typeof CollectionGlyph>[0]['collection'] & { id: string; name: string }
  active: boolean
  count: number
  muted?: boolean
}) {
  return (
    <Link
      href={`/library?collection=${collection.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-sidebar-accent font-medium text-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
        muted && 'opacity-60',
      )}
    >
      <CollectionGlyph collection={collection} size="sm" />
      <span className="min-w-0 flex-1 truncate">{collection.name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </Link>
  )
}

'use client'

import * as React from 'react'
import {
  Archive,
  Bot,
  CalendarClock,
  Check,
  Copy,
  Inbox,
  Library as LibraryIcon,
  Lock,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { LibraryAssetsView } from './library-assets-view'
import { collectionAssets } from './library-logic'
import {
  AnalysisFields,
  GuardrailFields,
  IntakeFields,
  PolicyFields,
  SettingsCard,
  type SettingsChange,
} from './library-settings-fields'
import { useLibraryStore } from './library-store'
import type { LibraryAsset, LibraryCollection } from './library-types'
import {
  AssetCoverView,
  COLLECTION_HUES,
  COLLECTION_ICONS,
  CollectionGlyph,
  GLYPHS,
  hueGradient,
  useRelativeTime,
} from './library-ui'

type Tab = 'items' | 'settings'

export function LibraryCollectionView({
  collection,
  onOpenAsset,
  onUpload,
  onReview,
}: {
  collection: LibraryCollection
  onOpenAsset: (id: string) => void
  onUpload: (destination: string) => void
  onReview: () => void
}) {
  const t = useTranslations('Library.collection')
  const router = useRouter()
  const relative = useRelativeTime()
  const allAssets = useLibraryStore((state) => state.assets)
  const suggestions = useLibraryStore((state) => state.suggestions)
  const store = useLibraryStore.getState()
  const [tab, setTab] = React.useState<Tab>('items')
  const [editing, setEditing] = React.useState(false)
  const [picker, setPicker] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => setTab('items'), [collection.id])

  const assets = React.useMemo(() => collectionAssets(allAssets, collection.id), [allAssets, collection.id])
  const pending = suggestions.filter((suggestion) => suggestion.collectionId === collection.id)
  const isSmart = collection.smart
  const frozen = collection.status === 'frozen'
  const expiresAt = collection.settings.guardrails.expiresAt
  const expiresInDays = expiresAt ? Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000) : null

  const onSettingsChange: SettingsChange = (section, patch) => store.updateSettings(collection.id, section, patch)
  const toggleSmart = (on: boolean) => {
    const result = store.setSmart(collection.id, on)
    if (!on) {
      toast(t('smartOffToast'))
      return
    }
    toast.success(t('smartOnToast'), {
      description: result.suggested ? t('smartOnSuggested', { count: result.suggested }) : result.added ? t('smartOnAdded', { count: result.added }) : undefined,
    })
  }

  return (
    <div className="space-y-6">
      {/* header: cover, icon, name, one meta line, the AI note */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative h-20" style={{ background: hueGradient(collection.hue) }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.25),transparent_55%)]" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CollectionGlyph collection={{ ...collection, smart: false }} size="lg" className="-mt-8 ring-4 ring-card" />
            <div className="mt-3 flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={frozen}><Plus />{t('add')}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setPicker(true)}><LibraryIcon />{t('addFromLibrary')}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onUpload(collection.id)}><Upload />{t('uploadFiles')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label={t('more')}><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil />{t('edit')}</DropdownMenuItem>
                  {collection.status === 'paused'
                    ? <DropdownMenuItem onSelect={() => store.setCollectionStatus(collection.id, 'active')}><Play />{t('resume')}</DropdownMenuItem>
                    : <DropdownMenuItem onSelect={() => store.setCollectionStatus(collection.id, 'paused')}><Pause />{t('pause')}</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => {
                    const id = store.duplicateCollection(collection.id)
                    if (id) router.push(`/library?collection=${id}`)
                  }}><Copy />{t('duplicate')}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => store.setCollectionStatus(collection.id, collection.status === 'archived' ? 'active' : 'archived')}>
                    <Archive />{collection.status === 'archived' ? t('unarchive') : t('archive')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}><Trash2 />{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{collection.name}</h1>
              {collection.status !== 'active' && <StatusPill status={collection.status} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('itemsAndUpdated', { count: assets.length, time: relative(collection.updatedAt) })}</p>
          </div>

          {(collection.description || isSmart) && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group mt-4 flex w-full items-start gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70"
            >
              <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{t('aiNoteTitle')}</span>
                <span className={cn('mt-0.5 block text-sm leading-6', collection.description ? 'text-foreground' : 'text-muted-foreground')}>
                  {collection.description || t('aiNoteEmpty')}
                </span>
              </span>
              <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
      </div>

      {/* banners: only when something needs attention */}
      <div className="space-y-2 empty:hidden">
        {collection.status === 'paused' && (
          <Banner tone="amber" icon={Pause} text={t('pausedBanner')} action={<Button size="sm" variant="outline" onClick={() => store.setCollectionStatus(collection.id, 'active')}>{t('resume')}</Button>} />
        )}
        {frozen && <Banner tone="sky" icon={Snowflake} text={t('frozenBanner')} action={<Button size="sm" variant="outline" onClick={() => store.setCollectionStatus(collection.id, 'active')}>{t('unfreeze')}</Button>} />}
        {collection.status === 'archived' && <Banner tone="zinc" icon={Archive} text={t('archivedBanner')} />}
        {isSmart && expiresInDays !== null && (
          <Banner tone={expiresInDays < 0 ? 'zinc' : 'violet'} icon={CalendarClock} text={expiresInDays < 0 ? t('expiredBanner') : t('expiringBanner', { days: expiresInDays })} />
        )}
        {pending.length > 0 && (
          <Banner
            tone="zinc"
            icon={Sparkles}
            text={t('pendingBanner', { count: pending.length })}
            action={(
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={onReview}>{t('review')}</Button>
                <Button size="sm" variant="outline" onClick={() => store.acceptAllSuggestions(collection.id)}>{t('acceptAll')}</Button>
              </div>
            )}
          />
        )}
      </div>

      {/* tabs */}
      <div className="border-b border-border">
        <div role="tablist" className="-mb-px flex gap-1">
          {(['items', 'settings'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors',
                tab === value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'items' ? t('tab.items') : t('tab.settingsPlain')}
              {value === 'items' && <span className="ml-1.5 text-xs text-muted-foreground">{assets.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'items' && (
        <LibraryAssetsView
          assets={assets}
          collection={collection}
          onOpenAsset={onOpenAsset}
          showUsageRules={false}
          empty={(
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <CollectionGlyph collection={{ ...collection, smart: false }} size="lg" />
              <p className="mt-4 text-sm font-medium text-foreground">{isSmart ? t('emptySmart') : t('emptyManual')}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{isSmart ? t('emptySmartHint') : t('emptyManualHint')}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicker(true)}><LibraryIcon />{t('addFromLibrary')}</Button>
                <Button size="sm" onClick={() => onUpload(collection.id)}><Upload />{t('uploadFiles')}</Button>
              </div>
            </div>
          )}
        />
      )}
      {tab === 'settings' && (
        <SettingsTab collection={collection} assets={assets} allAssets={allAssets} onChange={onSettingsChange} onDelete={() => setConfirmDelete(true)} onToggleSmart={toggleSmart} />
      )}

      <EditCollectionDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <AddItemsDialog open={picker} onOpenChange={setPicker} collection={collection} onOpenAsset={onOpenAsset} />
      <DeleteCollectionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        collection={collection}
        assets={assets}
        onDeleted={() => router.push('/library')}
      />
    </div>
  )
}

function StatusPill({ status }: { status: LibraryCollection['status'] }) {
  const t = useTranslations('Library.collection.status')
  const tone = status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    : status === 'paused' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : status === 'frozen' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>
      <span className="size-1.5 rounded-full bg-current" />{t(status)}
    </span>
  )
}

function Banner({ tone, icon: Icon, text, action }: { tone: 'amber' | 'sky' | 'zinc' | 'violet' | 'primary'; icon: typeof Pause; text: React.ReactNode; action?: React.ReactNode }) {
  const tones = {
    amber: 'border-amber-500/30 bg-amber-500/10',
    sky: 'border-sky-500/30 bg-sky-500/10',
    zinc: 'border-border bg-muted/50',
    violet: 'border-violet-500/30 bg-violet-500/10',
    primary: 'border-primary/30 bg-primary/10',
  }
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3', tones[tone])}>
      <p className="flex items-center gap-2 text-sm text-foreground"><Icon className="size-4 shrink-0" />{text}</p>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// settings

type SettingsSection = 'general' | 'smart' | 'intake' | 'analysis' | 'policy' | 'guardrails' | 'danger'

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; icon: LucideIcon; smartOnly?: boolean }> = [
  { id: 'general', icon: Settings2 },
  { id: 'smart', icon: Sparkles },
  { id: 'intake', icon: Inbox, smartOnly: true },
  { id: 'analysis', icon: ScanSearch, smartOnly: true },
  { id: 'policy', icon: Repeat, smartOnly: true },
  { id: 'guardrails', icon: ShieldCheck, smartOnly: true },
  { id: 'danger', icon: Archive },
]

function SettingsTab({
  collection,
  assets,
  allAssets,
  onChange,
  onDelete,
  onToggleSmart,
}: {
  collection: LibraryCollection
  assets: LibraryAsset[]
  allAssets: LibraryAsset[]
  onChange: SettingsChange
  onDelete: () => void
  onToggleSmart: (on: boolean) => void
}) {
  const t = useTranslations('Library.collection.settingsTab')
  const store = useLibraryStore.getState()
  const isSmart = collection.smart
  const sections = SETTINGS_SECTIONS.filter((section) => isSmart || !section.smartOnly)
  // One section at a time: the menu on the left picks it, so the page never shows every rule at once.
  const [picked, setPicked] = React.useState<SettingsSection>('general')
  const active = sections.some((section) => section.id === picked) ? picked : 'general'

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label={t('menu')} className="lg:sticky lg:top-4 lg:self-start">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {sections.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPicked(id)}
              aria-current={active === id ? 'true' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
                active === id ? 'bg-accent text-foreground' : 'text-foreground/70 hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className={cn('size-4 shrink-0', active === id ? 'text-foreground' : 'text-muted-foreground')} />
              {t(`nav.${id}`)}
            </button>
          ))}
        </div>
        <p className="mt-3 hidden px-3 text-xs text-muted-foreground lg:block">{t('autosave')}</p>
      </nav>

      <div className="min-w-0 max-w-3xl">
        {active === 'general' && (
          <SettingsCard title={t('nav.general')} description={t('generalHint')}>
            <GeneralFields collection={collection} />
          </SettingsCard>
        )}

        {active === 'smart' && (
          <SettingsCard title={t('nav.smart')}>
            <div className="flex items-start justify-between gap-6 px-5 py-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-primary" />{t('smartTitle')}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{t('smartHint')}</p>
                {!isSmart && (
                  <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                    {(['point0', 'point1', 'point2'] as const).map((point) => (
                      <li key={point} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 text-primary" />{t(`smartPoints.${point}`)}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Switch checked={isSmart} onCheckedChange={onToggleSmart} aria-label={t('smartTitle')} />
            </div>
          </SettingsCard>
        )}

        {active === 'intake' && (
          <SettingsCard title={t('nav.intake')} description={t('intakeHint')}>
            <IntakeFields
              settings={collection.settings}
              onChange={onChange}
              assets={allAssets}
              collectionId={collection.id}
              keywords={`${collection.name} ${collection.description}`.split(/\s+/)}
              onAddMatches={(ids) => {
                if (collection.settings.intake.approval === 'review') {
                  useLibraryStore.setState((state) => ({
                    suggestions: [...state.suggestions, ...ids.map((assetId) => ({ id: `s-${assetId}-${collection.id}`, assetId, collectionId: collection.id, confidence: 0.8, reason: 'Kurallarla eşleşti' }))],
                  }))
                  toast(t('sentToReviewToast', { count: ids.length }))
                } else {
                  store.addToCollection(ids, collection.id)
                  toast.success(t('addedToast', { count: ids.length }))
                }
              }}
            />
          </SettingsCard>
        )}

        {active === 'analysis' && (
          <SettingsCard title={t('nav.analysis')} description={t('analysisHint')}>
            <AnalysisFields settings={collection.settings} onChange={onChange} assets={assets} onAnalyzeNow={(ids) => { store.reanalyze(ids); toast(t('analysisStartedToast', { count: ids.length })) }} />
          </SettingsCard>
        )}

        {active === 'policy' && (
          <SettingsCard title={t('nav.policy')} description={t('policyHint')}>
            <PolicyFields settings={collection.settings} onChange={onChange} assets={assets} collection={collection} />
          </SettingsCard>
        )}

        {active === 'guardrails' && (
          <SettingsCard title={t('nav.guardrails')} description={t('guardrailsHint')}>
            <GuardrailFields settings={collection.settings} onChange={onChange} assets={assets} />
            <DangerRow icon={Lock} title={t('freezeTitle')} hint={t('freezeHint')}>
              <Button size="sm" variant="outline" onClick={() => store.setCollectionStatus(collection.id, collection.status === 'frozen' ? 'active' : 'frozen')}>
                {collection.status === 'frozen' ? t('unfreeze') : t('freeze')}
              </Button>
            </DangerRow>
          </SettingsCard>
        )}

        {active === 'danger' && (
          <SettingsCard title={t('nav.danger')}>
            <DangerRow icon={Pause} title={t('pauseTitle')} hint={t('pauseHint')}>
              <Button size="sm" variant="outline" onClick={() => store.setCollectionStatus(collection.id, collection.status === 'paused' ? 'active' : 'paused')}>
                {collection.status === 'paused' ? t('resume') : t('pause')}
              </Button>
            </DangerRow>
            <DangerRow icon={Archive} title={t('archiveTitle')} hint={t('archiveHint')}>
              <Button size="sm" variant="outline" onClick={() => store.setCollectionStatus(collection.id, collection.status === 'archived' ? 'active' : 'archived')}>
                {collection.status === 'archived' ? t('unarchive') : t('archive')}
              </Button>
            </DangerRow>
            <DangerRow icon={Trash2} title={t('deleteTitle')} hint={t('deleteHint')}>
              <Button size="sm" variant="destructive" onClick={onDelete}>{t('delete')}</Button>
            </DangerRow>
          </SettingsCard>
        )}
      </div>
    </div>
  )
}

function DangerRow({ icon: Icon, title, hint, children }: { icon: typeof Pause; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function GeneralFields({ collection }: { collection: LibraryCollection }) {
  const t = useTranslations('Library.collection.settingsTab')
  const store = useLibraryStore.getState()
  const [name, setName] = React.useState(collection.name)
  const [description, setDescription] = React.useState(collection.description)
  React.useEffect(() => {
    setName(collection.name)
    setDescription(collection.description)
  }, [collection.id, collection.name, collection.description])

  return (
    <div className="grid gap-4 px-5 py-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{t('name')}</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() && store.updateCollection(collection.id, { name: name.trim() })} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{t('description')}</span>
        <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} onBlur={() => store.updateCollection(collection.id, { description: description.trim() })} />
        <span className="text-xs text-muted-foreground">{t('descriptionHint')}</span>
      </label>
      <IconHuePicker
        icon={collection.icon}
        hue={collection.hue}
        onChange={(patch) => store.updateCollection(collection.id, patch)}
      />
    </div>
  )
}

export function IconHuePicker({ icon, hue, onChange }: { icon: string; hue: number; onChange: (patch: { icon?: string; hue?: number }) => void }) {
  const t = useTranslations('Library.collection.settingsTab')
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t('icon')}</span>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTION_ICONS.map((key) => {
            const Icon = GLYPHS[key]
            return (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={icon === key}
                onClick={() => onChange({ icon: key })}
                className={cn('flex size-8 items-center justify-center rounded-lg border', icon === key ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t('color')}</span>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTION_HUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`hue ${value}`}
              aria-pressed={hue === value}
              onClick={() => onChange({ hue: value })}
              className={cn('size-8 rounded-lg border-2 transition-transform', hue === value ? 'scale-110 border-foreground' : 'border-transparent')}
              style={{ background: hueGradient(value) }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// dialogs

function EditCollectionDialog({ open, onOpenChange, collection }: { open: boolean; onOpenChange: (open: boolean) => void; collection: LibraryCollection }) {
  const t = useTranslations('Library.collection.editDialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="-mx-5"><GeneralFields collection={collection} /></div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddItemsDialog({ open, onOpenChange, collection }: { open: boolean; onOpenChange: (open: boolean) => void; collection: LibraryCollection; onOpenAsset: (id: string) => void }) {
  const t = useTranslations('Library.collection.addDialog')
  const assets = useLibraryStore((state) => state.assets)
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setQuery('')
    }
  }, [open])
  const accepted = collection.settings.intake.acceptedKinds
  const candidates = assets
    .filter((asset) => !asset.collectionIds.includes(collection.id))
    .filter((asset) => !query || asset.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) || asset.analysis.tags.some((tag) => tag.includes(query.toLocaleLowerCase('tr'))))
  const outsideKinds = [...selected].filter((id) => !accepted.includes(assets.find((asset) => asset.id === id)?.kind ?? 'image')).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('title', { name: collection.name })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} />
        <div className="grid min-h-0 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {candidates.map((asset) => {
            const isSelected = selected.has(asset.id)
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelected((current) => {
                  const next = new Set(current)
                  if (next.has(asset.id)) next.delete(asset.id)
                  else next.add(asset.id)
                  return next
                })}
                className={cn('relative overflow-hidden rounded-xl border text-left', isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border')}
              >
                <AssetCoverView cover={asset.cover} kind={asset.kind} className="aspect-[4/3] w-full" iconClassName="size-7" />
                <p className="truncate px-2 py-1.5 text-xs">{asset.name}</p>
                {isSelected && <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
              </button>
            )
          })}
          {candidates.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{outsideKinds > 0 ? t('kindWarning', { count: outsideKinds }) : t('selected', { count: selected.size })}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button
              disabled={selected.size === 0}
              onClick={() => {
                useLibraryStore.getState().addToCollection([...selected], collection.id)
                toast.success(t('addedToast', { count: selected.size }))
                onOpenChange(false)
              }}
            >
              {t('add', { count: selected.size })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCollectionDialog({
  open,
  onOpenChange,
  collection,
  assets,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: LibraryCollection
  assets: LibraryAsset[]
  onDeleted: () => void
}) {
  const t = useTranslations('Library.collection.deleteDialog')
  const [deleteItems, setDeleteItems] = React.useState(false)
  const exclusive = assets.filter((asset) => asset.collectionIds.length === 1).length
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title', { name: collection.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('description', { count: assets.length })}</AlertDialogDescription>
        </AlertDialogHeader>
        {exclusive > 0 && (
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input type="checkbox" checked={deleteItems} onChange={(event) => setDeleteItems(event.target.checked)} className="mt-0.5 size-4" />
            <span>
              <span className="block font-medium">{t('deleteItems', { count: exclusive })}</span>
              <span className="block text-xs text-muted-foreground">{t('deleteItemsHint')}</span>
            </span>
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              useLibraryStore.getState().deleteCollection(collection.id, { deleteExclusiveItems: deleteItems })
              toast(t('deletedToast', { name: collection.name }))
              onDeleted()
            }}
          >
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

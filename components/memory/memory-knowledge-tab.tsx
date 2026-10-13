'use client'

import * as React from 'react'
import Link from 'next/link'
import { FileText, FileUp, Film, Link2, Pencil, RefreshCw, StickyNote, Trash2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { Chip, MemoryEmpty, MemoryList, MemoryRow, MemoryToolbar, ScopeChip, Segmented, useUpdatedLabel } from './memory-list'
import type { KnowledgeItem, KnowledgeKind, MemoryScope } from './memory-seed'
import { useMemoryStore } from './memory-store'

type Filter = 'all' | KnowledgeKind

export const KNOWLEDGE_ICONS: Record<KnowledgeKind, typeof StickyNote> = {
  note: StickyNote,
  file: FileText,
  link: Link2,
  media: Film,
}

export function MemoryKnowledgeTab({ onAdd, onEdit }: { onAdd: (kind?: KnowledgeKind, text?: string) => void; onEdit: (id: string) => void }) {
  const t = useTranslations('MemoryPage.knowledge')
  const updated = useUpdatedLabel()
  const items = useMemoryStore((state) => state.knowledge)
  const setEnabled = useMemoryStore((state) => state.setEnabled)
  const remove = useMemoryStore((state) => state.remove)
  const retry = useMemoryStore((state) => state.retryKnowledge)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')

  const needle = query.trim().toLocaleLowerCase('tr')
  const visible = items.filter((item) => (filter === 'all' || item.kind === filter)
    && (!needle || `${item.title} ${item.body} ${item.source ?? ''}`.toLocaleLowerCase('tr').includes(needle)))
  const count = (kind: KnowledgeKind) => items.filter((item) => item.kind === kind).length

  return (
    <div>
      <MemoryToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('search')}
        filter={filter}
        onFilterChange={setFilter}
        filters={[
          { value: 'all', label: t('filter.all') },
          { value: 'note', label: t('filter.note'), count: count('note') },
          { value: 'file', label: t('filter.file'), count: count('file') },
          { value: 'link', label: t('filter.link'), count: count('link') },
          { value: 'media', label: t('filter.media'), count: count('media') },
        ]}
        count={t('count', { count: visible.length })}
      />
      {visible.length === 0 ? (
        <MemoryEmpty
          icon={StickyNote}
          title={items.length ? t('noResults') : t('emptyTitle')}
          hint={items.length ? t('noResultsHint') : t('emptyHint')}
          examples={items.length ? undefined : [t('example0'), t('example1'), t('example2')]}
          onExample={(example) => onAdd('note', example)}
        />
      ) : (
        <MemoryList>
          {visible.map((item) => (
            <MemoryRow
              key={item.id}
              icon={KNOWLEDGE_ICONS[item.kind]}
              title={item.title}
              preview={item.body}
              status={item.status}
              failure={item.failure}
              chips={(
                <>
                  {item.auto && <Chip tone="primary">{t('fromLibrary')}</Chip>}
                  {item.source && !item.auto && <Chip>{item.source}</Chip>}
                  <ScopeChip scope={item.scope} />
                </>
              )}
              meta={updated(item.updatedAt)}
              enabled={item.enabled}
              toggleLabel={t('toggle')}
              onToggle={(enabled) => setEnabled('knowledge', item.id, enabled)}
              onOpen={() => onEdit(item.id)}
              menu={[
                { label: item.auto ? t('view') : t('edit'), icon: Pencil, onSelect: () => onEdit(item.id) },
                ...(item.status === 'failed' ? [{ label: t('retry'), icon: RefreshCw, onSelect: () => retry(item.id) }] : []),
                { label: t('delete'), icon: Trash2, destructive: true, onSelect: () => { remove('knowledge', item.id); toast(t('deletedToast')) } },
              ]}
            />
          ))}
        </MemoryList>
      )}
    </div>
  )
}

/** Add or edit knowledge: write a note, add a file or a link. Items taken from the library are shown read-only. */
export function KnowledgeDialog({
  open,
  onOpenChange,
  itemId,
  initialKind = 'note',
  initialText = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string | null
  initialKind?: KnowledgeKind
  initialText?: string
}) {
  const t = useTranslations('MemoryPage.knowledge')
  const tCommon = useTranslations('MemoryPage.common')
  const item = useMemoryStore((state) => state.knowledge.find((entry) => entry.id === itemId) ?? null)
  const saveKnowledge = useMemoryStore((state) => state.saveKnowledge)
  const [kind, setKind] = React.useState<Exclude<KnowledgeKind, 'media'>>('note')
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [source, setSource] = React.useState('')
  const [scope, setScope] = React.useState<MemoryScope>('channel')
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setKind(item ? (item.kind === 'media' ? 'note' : item.kind) : initialKind === 'media' ? 'note' : initialKind)
    setTitle(item?.title ?? '')
    setBody(item?.body ?? initialText)
    setSource(item?.source ?? '')
    setScope(item?.scope ?? 'channel')
  }, [initialKind, initialText, item, open])

  const readOnly = Boolean(item?.auto)
  const canSave = kind === 'note' ? body.trim().length > 0 : source.trim().length > 0

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave || readOnly) return
    const fallbackTitle = kind === 'note' ? body.trim().split(/\s+/).slice(0, 5).join(' ') : source.trim()
    saveKnowledge({
      id: item?.id,
      kind: item?.kind ?? kind,
      title: title.trim() || fallbackTitle,
      body: kind === 'note' ? body.trim() : item?.body ?? '',
      source: kind === 'note' ? null : source.trim(),
      scope,
    })
    toast.success(item ? t('savedToast') : kind === 'note' ? t('addedToast') : t('readingToast'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{item ? (readOnly ? item.title : t('editTitle')) : t('addTitle')}</DialogTitle>
            <DialogDescription>{readOnly ? t('autoHint') : t('addHint')}</DialogDescription>
          </DialogHeader>

          {readOnly && item ? (
            <ReadOnlyKnowledge item={item} />
          ) : (
            <>
              {!item && (
                <Segmented
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'note', label: <><StickyNote className="size-3.5" />{t('kind.note')}</> },
                    { value: 'file', label: <><FileUp className="size-3.5" />{t('kind.file')}</> },
                    { value: 'link', label: <><Link2 className="size-3.5" />{t('kind.link')}</> },
                  ]}
                />
              )}

              {kind === 'note' && (
                <>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('titlePlaceholder')} aria-label={t('titleLabel')} />
                  <Textarea autoFocus rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t('notePlaceholder')} aria-label={t('noteLabel')} />
                </>
              )}
              {kind === 'file' && (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground hover:bg-accent/40"
                  >
                    <Upload className="size-5" />
                    <span className="mt-2 font-medium text-foreground">{source || t('chooseFile')}</span>
                    <span className="mt-0.5 text-xs">{t('fileFormats')}</span>
                  </button>
                  <input ref={fileRef} type="file" className="hidden" onChange={(event) => setSource(event.target.files?.[0]?.name ?? '')} />
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('titleOptional')} aria-label={t('titleLabel')} />
                </div>
              )}
              {kind === 'link' && (
                <div className="grid gap-2">
                  <Input autoFocus value={source} onChange={(event) => setSource(event.target.value)} placeholder={t('linkPlaceholder')} aria-label={t('linkLabel')} />
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('titleOptional')} aria-label={t('titleLabel')} />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{tCommon('scopeLabel')}</span>
                <Segmented
                  value={scope}
                  onChange={setScope}
                  options={[{ value: 'channel', label: tCommon('channel') }, { value: 'personal', label: tCommon('personal') }]}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{readOnly ? tCommon('close') : tCommon('cancel')}</Button>
            {!readOnly && <Button type="submit" disabled={!canSave}>{item ? tCommon('save') : tCommon('add')}</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReadOnlyKnowledge({ item }: { item: KnowledgeItem }) {
  const t = useTranslations('MemoryPage.knowledge')
  return (
    <div className="grid gap-3">
      <p className="rounded-xl bg-muted/50 p-3 text-sm leading-6 text-foreground">{item.body}</p>
      <p className="text-xs text-muted-foreground">
        {t('autoSource', { source: item.source ?? '' })}{' '}
        <Link href="/library" className="font-medium text-primary hover:underline">{t('openLibrary')}</Link>
      </p>
    </div>
  )
}

'use client'

import * as React from 'react'
import { MessageSquareQuote, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { MemoryEmpty, MemoryList, MemoryRow, MemoryToolbar, ScopeChip, Segmented, useUpdatedLabel } from './memory-list'
import type { MemoryScope } from './memory-seed'
import { useMemoryStore } from './memory-store'

type Filter = 'all' | 'on' | 'off'

export function MemoryRulesTab({ onAdd, onEdit }: { onAdd: (text?: string) => void; onEdit: (id: string) => void }) {
  const t = useTranslations('MemoryPage.rules')
  const updated = useUpdatedLabel()
  const rules = useMemoryStore((state) => state.rules)
  const setEnabled = useMemoryStore((state) => state.setEnabled)
  const remove = useMemoryStore((state) => state.remove)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')

  const needle = query.trim().toLocaleLowerCase('tr')
  const visible = rules.filter((rule) => (filter === 'all' || (filter === 'on' ? rule.enabled : !rule.enabled))
    && (!needle || `${rule.text} ${rule.when ?? ''}`.toLocaleLowerCase('tr').includes(needle)))

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
          { value: 'on', label: t('filter.on'), count: rules.filter((rule) => rule.enabled).length },
          { value: 'off', label: t('filter.off'), count: rules.filter((rule) => !rule.enabled).length },
        ]}
        count={t('count', { count: visible.length })}
      />
      {visible.length === 0 ? (
        <MemoryEmpty
          icon={MessageSquareQuote}
          title={rules.length ? t('noResults') : t('emptyTitle')}
          hint={rules.length ? t('noResultsHint') : t('emptyHint')}
          examples={rules.length ? undefined : [t('example0'), t('example1'), t('example2')]}
          onExample={onAdd}
        />
      ) : (
        <MemoryList>
          {visible.map((rule) => (
            <MemoryRow
              key={rule.id}
              icon={MessageSquareQuote}
              title={rule.text}
              preview={rule.when ? t('whenLabel', { when: rule.when }) : t('always')}
              chips={<ScopeChip scope={rule.scope} />}
              meta={updated(rule.updatedAt)}
              enabled={rule.enabled}
              toggleLabel={t('toggle')}
              onToggle={(enabled) => setEnabled('rules', rule.id, enabled)}
              onOpen={() => onEdit(rule.id)}
              menu={[
                { label: t('edit'), icon: Pencil, onSelect: () => onEdit(rule.id) },
                { label: t('delete'), icon: Trash2, destructive: true, onSelect: () => { remove('rules', rule.id); toast(t('deletedToast')) } },
              ]}
            />
          ))}
        </MemoryList>
      )}
    </div>
  )
}

const WHEN_PRESETS = ['always', 'shorts', 'longVideo', 'voiceover', 'captions'] as const

export function RuleDialog({ open, onOpenChange, ruleId, initialText = '' }: { open: boolean; onOpenChange: (open: boolean) => void; ruleId: string | null; initialText?: string }) {
  const t = useTranslations('MemoryPage.rules')
  const tCommon = useTranslations('MemoryPage.common')
  const rule = useMemoryStore((state) => state.rules.find((entry) => entry.id === ruleId) ?? null)
  const saveRule = useMemoryStore((state) => state.saveRule)
  const [text, setText] = React.useState('')
  const [when, setWhen] = React.useState('')
  const [scope, setScope] = React.useState<MemoryScope>('channel')

  React.useEffect(() => {
    if (!open) return
    setText(rule?.text ?? initialText)
    setWhen(rule?.when ?? '')
    setScope(rule?.scope ?? 'channel')
  }, [initialText, open, rule])

  const presets = WHEN_PRESETS.map((key) => ({ key, label: t(`when.${key}`) }))
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    saveRule({ id: rule?.id, text: text.trim(), when: when.trim() || null, scope })
    toast.success(rule ? t('savedToast') : t('addedToast'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{rule ? t('editTitle') : t('addTitle')}</DialogTitle>
            <DialogDescription>{t('addHint')}</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={t('placeholder')} aria-label={t('ruleLabel')} />
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">{t('whenTitle')}</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const value = preset.key === 'always' ? '' : preset.label
                const active = when === value
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setWhen(value)}
                    className={cn('rounded-full border px-3 py-1 text-xs transition-colors', active ? 'border-primary/50 bg-primary/12 text-foreground' : 'border-border text-muted-foreground hover:bg-accent')}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <Input value={when} onChange={(event) => setWhen(event.target.value)} placeholder={t('whenPlaceholder')} aria-label={t('whenTitle')} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{tCommon('scopeLabel')}</span>
            <Segmented value={scope} onChange={setScope} options={[{ value: 'channel', label: tCommon('channel') }, { value: 'personal', label: tCommon('personal') }]} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={!text.trim()}>{rule ? tCommon('save') : tCommon('add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

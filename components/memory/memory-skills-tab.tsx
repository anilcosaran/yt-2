'use client'

import * as React from 'react'
import { ArrowUpCircle, Copy, Pencil, Trash2, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Chip, MemoryEmpty, MemoryList, MemoryRow, MemoryToolbar, type RowMenuItem } from './memory-list'
import type { SkillItem } from './memory-seed'
import { useMemoryStore } from './memory-store'

type Filter = 'all' | 'on' | 'mine'

/** The list of skills. Adding one and opening one both open the skill popup (skill-dialog.tsx). */
export function MemorySkillsTab({ onAdd, onOpen }: { onAdd: (text?: string) => void; onOpen: (id: string) => void }) {
  const t = useTranslations('MemoryPage.skills')
  const skills = useMemoryStore((state) => state.skills)
  const store = useMemoryStore.getState()
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')

  const needle = query.trim().toLocaleLowerCase('tr')
  const visible = skills.filter((skill) => (filter === 'all' || (filter === 'on' ? skill.enabled : skill.origin === 'mine'))
    && (!needle || `${skill.name} ${skill.description}`.toLocaleLowerCase('tr').includes(needle)))

  const menuFor = (skill: SkillItem): RowMenuItem[] => [
    { label: skill.origin === 'mine' ? t('edit') : t('view'), icon: Pencil, onSelect: () => onOpen(skill.id) },
    ...(skill.updateAvailable ? [{ label: t('update'), icon: ArrowUpCircle, onSelect: () => { store.updateSkill(skill.id); toast.success(t('updatedToast')) } }] : []),
    ...(skill.origin !== 'mine' ? [{ label: t('copy'), icon: Copy, onSelect: () => { const id = store.copySkill(skill.id); if (id) onOpen(id) } }] : []),
    ...(skill.origin === 'mine' ? [{ label: t('delete'), icon: Trash2, destructive: true, onSelect: () => { store.remove('skills', skill.id); toast(t('deletedToast')) } }] : []),
  ]

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
          { value: 'on', label: t('filter.on'), count: skills.filter((skill) => skill.enabled).length },
          { value: 'mine', label: t('filter.mine'), count: skills.filter((skill) => skill.origin === 'mine').length },
        ]}
        count={t('count', { count: visible.length })}
      />
      {visible.length === 0 ? (
        <MemoryEmpty
          icon={Wand2}
          title={skills.length ? t('noResults') : t('emptyTitle')}
          hint={skills.length ? t('noResultsHint') : t('emptyHint')}
          examples={skills.length ? undefined : [t('example0'), t('example1')]}
          onExample={onAdd}
        />
      ) : (
        <MemoryList>
          {visible.map((skill) => (
            <MemoryRow
              key={skill.id}
              icon={Wand2}
              iconClassName={skill.origin === 'mine' ? 'border-primary/30 bg-primary/10 text-primary' : undefined}
              title={skill.name}
              preview={skill.description}
              chips={(
                <>
                  {skill.origin === 'builtin' && <Chip>{t('origin.builtin')}</Chip>}
                  {skill.origin === 'shared' && <Chip tone="violet">{t('origin.shared', { name: skill.sharedBy ?? '' })}</Chip>}
                  {skill.draft && <Chip tone="amber">{t('draft')}</Chip>}
                  {skill.updateAvailable && <Chip tone="primary">{t('updateAvailable')}</Chip>}
                </>
              )}
              enabled={skill.enabled}
              toggleLabel={t('toggle')}
              onToggle={(enabled) => store.setEnabled('skills', skill.id, enabled)}
              onOpen={() => onOpen(skill.id)}
              menu={menuFor(skill)}
            />
          ))}
        </MemoryList>
      )}
    </div>
  )
}

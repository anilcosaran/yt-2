'use client'

// The one list pattern every Memory tab uses: a toolbar (search + one filter), rows with an on/off switch and a
// menu, and an empty state that offers examples.

import * as React from 'react'
import { AlertCircle, Loader2, MoreHorizontal, Search, type LucideIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import type { MemoryScope, MemoryStatus } from './memory-seed'

export function MemoryToolbar<T extends string>({
  query,
  onQueryChange,
  placeholder,
  filter,
  filters,
  onFilterChange,
  count,
}: {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  filter: T
  filters: Array<{ value: T; label: string; count?: number }>
  onFilterChange: (value: T) => void
  count: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-xl pl-9" />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              filter === item.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {item.label}
            {item.count !== undefined && <span className={cn('ml-1.5 tabular-nums', filter === item.value ? 'text-background/70' : 'text-muted-foreground/70')}>{item.count}</span>}
          </button>
        ))}
      </div>
      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
    </div>
  )
}

export function MemoryList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
}

export type RowMenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; destructive?: boolean }

export function MemoryRow({
  icon: Icon,
  iconClassName,
  title,
  preview,
  meta,
  chips,
  status = 'ready',
  failure,
  enabled,
  onToggle,
  onOpen,
  menu,
  toggleLabel,
}: {
  icon: LucideIcon
  iconClassName?: string
  title: React.ReactNode
  preview?: React.ReactNode
  meta?: React.ReactNode
  chips?: React.ReactNode
  status?: MemoryStatus
  failure?: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onOpen: () => void
  menu: RowMenuItem[]
  toggleLabel: string
}) {
  const t = useTranslations('MemoryPage.common')
  return (
    <div className={cn('group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30', !enabled && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground', iconClassName)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
            {chips}
          </span>
          {status === 'processing' ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400"><Loader2 className="size-3 animate-spin" />{t('processing')}</span>
          ) : status === 'failed' ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"><AlertCircle className="size-3" />{failure ?? t('failed')}</span>
          ) : preview ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{preview}</span>
          ) : null}
        </span>
      </button>
      {meta && <span className="hidden shrink-0 text-xs text-muted-foreground md:block">{meta}</span>}
      <Switch checked={enabled} onCheckedChange={onToggle} aria-label={toggleLabel} disabled={status !== 'ready'} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="size-8 text-muted-foreground" aria-label={t('more')}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {menu.map((item, index) => (
            <React.Fragment key={item.label}>
              {item.destructive && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={item.onSelect} className={cn(item.destructive && 'text-destructive focus:text-destructive')}>
                {item.icon && <item.icon />}{item.label}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'primary' | 'amber' | 'violet' }) {
  return (
    <span className={cn(
      'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
      tone === 'muted' && 'bg-muted text-muted-foreground',
      tone === 'primary' && 'bg-primary/12 text-primary',
      tone === 'amber' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      tone === 'violet' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    )}>
      {children}
    </span>
  )
}

export function ScopeChip({ scope }: { scope: MemoryScope }) {
  const t = useTranslations('MemoryPage.common')
  return scope === 'personal' ? <Chip tone="violet">{t('personal')}</Chip> : null
}

export function MemoryEmpty({
  icon: Icon,
  title,
  hint,
  examples,
  onExample,
  action,
}: {
  icon: LucideIcon
  title: string
  hint: string
  examples?: string[]
  onExample?: (example: string) => void
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/50"><Icon className="size-5 text-muted-foreground" /></span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
      {examples && onExample && (
        <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-1.5">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => onExample(example)} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              {example}
            </button>
          ))}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function useUpdatedLabel() {
  const format = useFormatter()
  return React.useCallback((iso: string) => format.relativeTime(new Date(iso), new Date()), [format])
}

/** Segmented control used in the dialogs. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: React.ReactNode }> }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            option.value === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

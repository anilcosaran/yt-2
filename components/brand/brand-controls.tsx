'use client'

import * as React from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The quiet controls the Marka pages share (Avatarlar, Sesler): the page tabs with their counts, a search field, a
 * segmented filter (each option may carry an icon). One look across the pages, the app's theme tokens.
 */

export function BrandTabs<T extends string>({ label, value, tabs, onChange }: {
  label: string
  value: T
  tabs: Array<{ id: T; label: string; count?: number }>
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full bg-muted/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
            value === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {typeof tab.count === 'number' ? <span className="text-xs tabular-nums text-muted-foreground">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function BrandSearch({ value, onChange, placeholder, className }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={cn('relative flex h-9 min-w-[200px] flex-1 items-center sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-card/40 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
      />
    </label>
  )
}

export function BrandSegmented({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<{ id: string; label: string; icon?: React.ReactNode }>
  onChange: (value: string) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-9 items-center rounded-lg bg-muted/50 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
            value === option.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

'use client'

import * as React from 'react'
import { AtSign, Paperclip, RefreshCw, ScrollText, ShieldCheck, Sparkles, Wand2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ComposerChip } from '@/lib/assistant/composer/composer-state'
import type { ComposerMode } from '@/lib/assistant/composer/composer-mode'
import type { TypedComposerMenuGroup, TypedComposerMenuItem } from '@/lib/assistant/composer/use-typed-composer'
import { PromptBoxChip } from '@/components/spark/agent/prompt-box'
import { cn } from '@/lib/utils'

/**
 * P03-01 shared composer parts in the existing Chat composer styling: chips use the composer control pill tokens
 * (`rounded-full border`, primary-tinted when set), the menu uses the composer popover (`bg-popover rounded-xl`,
 * uppercase group headers, option rows with hint), the mode chip is the existing approval pill with three levels.
 */

const CHIP_ICONS = {
  skill: Sparkles,
  tool: Wand2,
  mention: AtSign,
  attachment: Paperclip,
} as const

export function TypedComposerChips({
  chips,
  disabled,
  roleLabel,
  onRemove,
  onCopy,
  renderAfterLabel,
  leading,
}: {
  chips: readonly ComposerChip[]
  disabled?: boolean
  /** P03-02: localized role of a mention chip. */
  roleLabel?: (chip: ComposerChip) => string | null
  onRemove: (key: string) => void
  onCopy: (event: React.ClipboardEvent, chips: readonly ComposerChip[]) => void
  /** P03-02: extra control inside a chip (e.g. the mention role picker). */
  renderAfterLabel?: (chip: ComposerChip) => React.ReactNode
  /** P03-14: the job focus chip, first in the row. */
  leading?: React.ReactNode
}) {
  const t = useTranslations('Chat')
  if (chips.length === 0 && !leading) return null
  return (
    <ul
      aria-label={t('typedComposer.chipsLabel')}
      className="flex flex-wrap gap-1.5 px-2 pb-1.5"
      onCopy={(event) => onCopy(event, chips)}
    >
      {leading}
      {chips.map((chip) => {
        const Icon = CHIP_ICONS[chip.kind]
        const role = roleLabel?.(chip) ?? null
        return (
          <li
            key={chip.key}
            className="flex h-7 max-w-full items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 pl-2.5 pr-1 text-xs font-medium text-foreground"
            title={t(`typedComposer.chipKinds.${chip.kind}`)}
          >
            <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span
              tabIndex={0}
              className="max-w-48 truncate rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onCopy={(event) => {
                event.stopPropagation()
                onCopy(event, [chip])
              }}
            >
              {chip.kind === 'mention' ? `@${chip.label}` : chip.label}
            </span>
            {role ? <span className="shrink-0 text-muted-foreground">· {role}</span> : null}
            {renderAfterLabel?.(chip)}
            <button
              type="button"
              disabled={disabled}
              aria-label={t('typedComposer.removeChip', { label: chip.label })}
              onClick={() => onRemove(chip.key)}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
            >
              <X className="size-3" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function TypedComposerMenu({
  id,
  groups,
  activeItemId,
  loading,
  error,
  kind,
  notice,
  onSelect,
  renderGroupBody,
}: {
  id: string
  groups: readonly TypedComposerMenuGroup[]
  activeItemId: string | null
  loading: boolean
  error: boolean
  kind: 'slash' | 'mention'
  /** P03-02: e.g. some resource owners could not be read right now. */
  notice?: string | null
  onSelect: (item: TypedComposerMenuItem) => void
  /**
   * QA-126: the host renders a group's rows itself (e.g. connections with per-chat switch rows), using `option` for
   * the selectable items; `undefined` keeps the default rows, `null` hides the group.
   */
  renderGroupBody?: (group: TypedComposerMenuGroup, option: (item: TypedComposerMenuItem) => React.ReactNode) => React.ReactNode | undefined
}) {
  const t = useTranslations('Chat')
  const empty = groups.every((group) => group.items.length === 0)
  const option = (item: TypedComposerMenuItem) => {
    // QA-172: a template row (no chip) inserts text.
    const Icon = item.chip ? CHIP_ICONS[item.chip.kind] : ScrollText
    const active = item.id === activeItemId
    return (
      <button
        key={item.id}
        id={`${id}-${cssSafeId(item.id)}`}
        type="button"
        role="option"
        aria-selected={active}
        // Keep the caret in the textarea; selection only adds a chip.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(item)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
          active && 'bg-accent',
        )}
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{item.label}</span>
          {item.description ? <span className="block truncate text-xs text-muted-foreground">{item.description}</span> : null}
        </span>
      </button>
    )
  }
  return (
    <div
      id={id}
      role="listbox"
      aria-label={t(kind === 'slash' ? 'typedComposer.slashMenuLabel' : 'typedComposer.mentionMenuLabel')}
      className="youtorch-thin-scrollbar absolute inset-x-0 bottom-full z-30 mb-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl shadow-black/40 duration-150 animate-in fade-in slide-in-from-bottom-1 sm:right-auto sm:w-96"
    >
      {groups.map((group) => {
        const body = renderGroupBody?.(group, option)
        if (body === null || (body === undefined && group.items.length === 0)) return null
        return (
          <div key={group.id} role="group" aria-label={t(`typedComposer.groups.${group.id}`)} className="mb-1">
            <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`typedComposer.groups.${group.id}`)}
            </p>
            {body ?? group.items.map(option)}
          </div>
        )
      })}
      {loading ? (
        <p role="status" className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          {t('typedComposer.menuLoading')}
        </p>
      ) : error ? (
        <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">{t('typedComposer.menuError')}</p>
      ) : empty ? (
        <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">
          {t(kind === 'slash' ? 'typedComposer.slashEmpty' : 'typedComposer.mentionEmpty')}
        </p>
      ) : null}
      {notice ? <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">{notice}</p> : null}
    </div>
  )
}

export function menuItemDomId(menuId: string, itemId: string) {
  return `${menuId}-${cssSafeId(itemId)}`
}

function cssSafeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/gu, '_')
}

export type ComposerModeOption = { id: ComposerMode; label: string; detail: string }

/**
 * Q74 mode chip: the existing approval pill, cycling Ask → Auto → Tam erişim. The value is the committed server mode
 * (or the unsent first-message pick); a click asks the server and the chip shows what the server applied.
 */
export function ComposerModeChip({
  value,
  options,
  disabled,
  pending,
  onSelect,
}: {
  value: ComposerMode
  options: readonly ComposerModeOption[]
  disabled: boolean
  pending: boolean
  onSelect: (value: ComposerMode) => void
}) {
  const t = useTranslations('Chat')
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value))
  const selected = options[selectedIndex] ?? options[0]
  const next = options.length > 0 ? options[(selectedIndex + 1) % options.length] : undefined
  const elevated = value !== 'ask'

  return (
    <PromptBoxChip
      disabled={disabled || pending || options.length === 0}
      title={selected?.detail}
      aria-label={t('typedComposer.modeLabel', { mode: selected?.label ?? value })}
      onClick={() => {
        if (next) onSelect(next.id)
      }}
      active={elevated}
      collapse
      icon={pending
        ? <RefreshCw className="animate-spin" aria-hidden="true" />
        : <ShieldCheck className={cn(elevated && 'text-primary')} aria-hidden="true" />}
      label={selected?.label ?? value}
    />
  )
}

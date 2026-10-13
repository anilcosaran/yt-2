'use client'

import * as React from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { useComposerResourceDescribe } from '@/components/chat/composer/resource-describe'
import type { ComposerChip } from '@/lib/assistant/composer/composer-state'
import { buildComposerMenuStops, effectiveComposerMenuIndex, type ComposerMenuStop } from '@/lib/assistant/composer/composer-menu-stops'
import { relabelFromCandidates, type ComposerResourceCandidate } from '@/lib/assistant/composer/resource-mentions'
import { useMentionMenuGroups } from '@/lib/assistant/composer/use-mention-menu'
import { useSlashMenuGroups } from '@/lib/assistant/composer/use-slash-menu'
import type { TypedComposer, TypedComposerMenuItem } from '@/lib/assistant/composer/use-typed-composer'

import { StudioIcon } from './studio-icon'
import './spark-composer.css'

/**
 * E1-H typed composer parts of the Spark side chat, in the Spark design system (`.yt-studio` tokens): the `/` and `@` menu
 * (the same server data as the Dashboard chat: Youtorch tools, owner commands such as `/motion`, skills, connections, and
 * `@` resources) and the chips of the next message. Choosing an item only adds a chip - nothing here executes anything.
 */

export const SPARK_COMPOSER_MENU_ID = 'spark-composer-menu'

export function sparkMenuItemDomId(itemId: string): string {
  return `${SPARK_COMPOSER_MENU_ID}-${itemId.replace(/[^A-Za-z0-9_-]/gu, '_')}`
}

/** The studio icon of a chip / menu row: the Motion command, other tools and skills, mentions and attachments. */
export function sparkChipIcon(chip: Pick<ComposerChip, 'kind'> & { ref?: unknown }): string {
  if (chip.kind === 'mention') return 'plus'
  if (chip.kind === 'attachment') return 'image'
  const key = (chip.ref as { capability_key?: unknown } | undefined)?.capability_key
  return typeof key === 'string' && key.startsWith('motion.') ? 'motion' : 'sparkles'
}

/** The chips of the next message (`.ctx .chip.focus`), each removable; they travel as typed refs, never as text. */
export function SparkComposerChips({ chips, disabled, onRemove }: { chips: readonly ComposerChip[]; disabled?: boolean; onRemove: (key: string) => void }) {
  const t = useTranslations('Chat')
  return (
    <>
      {chips.map((chip) => (
        <span className="chip focus" key={chip.key} data-composer-chip={chip.kind} title={t(`typedComposer.chipKinds.${chip.kind}`)}>
          <StudioIcon name={sparkChipIcon(chip)} />
          {chip.kind === 'mention' ? `@${chip.label}` : chip.label}
          <button
            type="button"
            disabled={disabled}
            title={t('typedComposer.removeChip', { label: chip.label })}
            aria-label={t('typedComposer.removeChip', { label: chip.label })}
            onClick={() => onRemove(chip.key)}
          >
            <StudioIcon name="x" className="sm" />
          </button>
        </span>
      ))}
    </>
  )
}

type MenusProps = {
  composer: TypedComposer
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** The menu's keyboard stops in display order, kept for the textarea's key handler (empty while the menu is closed). */
  stopsRef: React.MutableRefObject<readonly ComposerMenuStop[]>
  channelId: string | null
  enabled: boolean
}

/**
 * Mounts the menu only while a `/` or `@` trigger is open AND a query client exists (the editor lives under the app's
 * `QueryProvider`; a bare render, e.g. a static markup test, has no menu source and therefore no menu). The menu data is the
 * server's: tools, commands, skills, connections and resources are fetched when the menu first opens, never to execute.
 */
export function SparkComposerMenuHost(props: MenusProps) {
  const client = React.useContext(QueryClientContext)
  if (!client || !props.composer.trigger || !props.channelId) return null
  return <SparkComposerMenus {...props} />
}

function SparkComposerMenus({ composer, textareaRef, stopsRef, channelId, enabled }: MenusProps) {
  const t = useTranslations('Chat')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const describe = useComposerResourceDescribe()
  const relabel = composer.relabel
  const handleCandidates = React.useCallback(
    (candidates: ComposerResourceCandidate[]) => relabel(relabelFromCandidates(candidates)),
    [relabel],
  )
  const slash = useSlashMenuGroups({ surface: 'spark_chat', channelId, trigger: composer.trigger, enabled })
  const mention = useMentionMenuGroups({ channelId, trigger: composer.trigger, enabled, locale, describe, onCandidates: handleCandidates })
  const kind = composer.trigger?.kind === 'mention' ? 'mention' : 'slash'
  const active = kind === 'mention' ? mention : slash
  const stops = React.useMemo(() => buildComposerMenuStops(active.groups, null), [active.groups])
  const activeId = stops[effectiveComposerMenuIndex(stops, composer.activeIndex, composer.activeExplicit)]?.id ?? null

  // The key handler of the textarea reads the stops from here; the combobox attributes follow the highlighted row.
  React.useLayoutEffect(() => {
    stopsRef.current = stops
    return () => {
      stopsRef.current = []
    }
  }, [stops, stopsRef])
  React.useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return undefined
    element.setAttribute('aria-controls', SPARK_COMPOSER_MENU_ID)
    if (activeId) element.setAttribute('aria-activedescendant', sparkMenuItemDomId(activeId))
    else element.removeAttribute('aria-activedescendant')
    return () => {
      element.removeAttribute('aria-controls')
      element.removeAttribute('aria-activedescendant')
    }
  }, [activeId, textareaRef])

  const empty = active.groups.every((group) => group.items.length === 0)
  const option = (item: TypedComposerMenuItem) => (
    <button
      key={item.id}
      id={sparkMenuItemDomId(item.id)}
      type="button"
      role="option"
      aria-selected={item.id === activeId}
      // Keep the caret in the textarea; selecting only adds a chip.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => composer.selectMenuItem(item)}
    >
      <StudioIcon name={item.chip ? sparkChipIcon(item.chip) : 'sparkles'} />
      <span className="mo">
        <b>{item.label}</b>
        {item.description ? <small>{item.description}</small> : null}
      </span>
    </button>
  )
  return (
    <div id={SPARK_COMPOSER_MENU_ID} className="cmp-menu" role="listbox" aria-label={t(kind === 'slash' ? 'typedComposer.slashMenuLabel' : 'typedComposer.mentionMenuLabel')} data-composer-menu={kind}>
      {active.groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.id} role="group" aria-label={t(`typedComposer.groups.${group.id}`)}>
            <p className="mh">{t(`typedComposer.groups.${group.id}`)}</p>
            {group.items.map(option)}
          </div>
        ),
      )}
      {active.loading ? (
        <p role="status" className="cmp-note">
          {t('typedComposer.menuLoading')}
        </p>
      ) : active.error ? (
        <p role="status" className="cmp-note">
          {t('typedComposer.menuError')}
        </p>
      ) : empty ? (
        <p role="status" className="cmp-note">
          {t(kind === 'slash' ? 'typedComposer.slashEmpty' : 'typedComposer.mentionEmpty')}
        </p>
      ) : null}
    </div>
  )
}

'use client'

import * as React from 'react'
import { Waypoints } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Switch } from '@/components/ui/switch'
import type { ComposerConnectionSwitchRow } from '@/lib/assistant/composer/composer-menu-connection-switches'
import { composerMenuSwitchStopId } from '@/lib/assistant/composer/composer-menu-stops'
import { cn } from '@/lib/utils'
import type { SlashConnectionSwitches } from '@/lib/assistant/composer/use-slash-menu'
import type { TypedComposerMenuGroup, TypedComposerMenuItem } from '@/lib/assistant/composer/use-typed-composer'

/**
 * QA-126 "Connections" group body of the `/` menu in an existing conversation: per connection a header row in the menu
 * row style with the existing Switch, then its tools. Off → the tools are hidden and the row reads "Off in this chat".
 * The switch is the P03-25 server command (never browser storage); the row shows the server's answer.
 */
export function ConnectionSwitchRows({
  rows,
  items,
  pending,
  option,
  onToggle,
  menuId,
  activeStopId = null,
}: {
  rows: readonly ComposerConnectionSwitchRow[]
  items: readonly TypedComposerMenuItem[]
  pending: boolean
  option: (item: TypedComposerMenuItem) => React.ReactNode
  onToggle: (connectionId: string, enabled: boolean) => Promise<boolean>
  /** QA-140: the menu's DOM id (the textarea's aria-activedescendant names the highlighted header row). */
  menuId?: string
  /** QA-140: the highlighted keyboard stop (a header row shows the menu's active row colour). */
  activeStopId?: string | null
}) {
  const t = useTranslations('Chat')
  const [failedConnectionId, setFailedConnectionId] = React.useState<string | null>(null)
  const byId = new Map(items.map((item) => [item.id, item] as const))
  const placed = new Set(rows.flatMap((row) => row.itemIds))

  async function toggle(connectionId: string, enabled: boolean) {
    setFailedConnectionId(null)
    const saved = await onToggle(connectionId, enabled)
    if (!saved) setFailedConnectionId(connectionId)
  }

  return (
    <>
      {rows.map((row) => (
        <React.Fragment key={row.connectionId}>
          <div
            id={menuId ? `${menuId}-${composerMenuSwitchStopId(row.connectionId).replace(/[^A-Za-z0-9_-]/gu, '_')}` : undefined}
            className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm', activeStopId === composerMenuSwitchStopId(row.connectionId) && 'bg-accent')}
            data-connection-switch={row.connectionId}
            // Keep the caret (and so the menu) in the textarea while the switch is used.
            onMouseDown={(event) => event.preventDefault()}
          >
            <Waypoints className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{row.label}</span>
              {failedConnectionId === row.connectionId ? (
                <span role="status" className="block truncate text-xs text-muted-foreground">{t('typedComposer.connectionSwitch.failed')}</span>
              ) : !row.enabled ? (
                <span className="block truncate text-xs text-muted-foreground">{t('typedComposer.connectionSwitch.off')}</span>
              ) : null}
            </span>
            <Switch
              checked={row.enabled}
              disabled={pending}
              aria-label={t('typedComposer.connectionSwitch.toggleLabel', { name: row.label })}
              onCheckedChange={(checked) => void toggle(row.connectionId, checked)}
            />
          </div>
          {row.enabled ? row.itemIds.map((itemId) => {
            const item = byId.get(itemId)
            return item ? option(item) : null
          }) : null}
        </React.Fragment>
      ))}
      {items.filter((item) => !placed.has(item.id)).map(option)}
    </>
  )
}

/**
 * The `renderGroupBody` of `TypedComposerMenu` for the slash menu: switch rows for the "Connections" group when the
 * conversation exists, the default rows otherwise (a brand-new conversation, or no connection to switch).
 */
export function connectionSwitchGroupBody(
  switches: SlashConnectionSwitches | null,
  keyboard: { menuId?: string; activeStopId?: string | null } = {},
) {
  if (!switches) return undefined
  return function renderConnectionGroupBody(group: TypedComposerMenuGroup, option: (item: TypedComposerMenuItem) => React.ReactNode) {
    if (group.id !== 'connections') return undefined
    return (
      <ConnectionSwitchRows
        rows={switches.rows}
        items={group.items}
        pending={switches.pending}
        option={option}
        onToggle={switches.setEnabled}
        menuId={keyboard.menuId}
        activeStopId={keyboard.activeStopId ?? null}
      />
    )
  }
}

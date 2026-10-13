'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { ComposerOutputCountView } from '@/lib/assistant/composer/composer-output-count'

export type ComposerOutputCountRowProps = {
  option: { id: string; label: string; hint: string }
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

/**
 * QA-078 "Adet" section of the composer's canvas popover. It renders with the popover's own section header and option
 * row (the host passes its `ComposerControlOptionRow`), so it looks exactly like the size/quality sections next to it.
 * Only counts up to the selected model's maximum are listed; nothing is shown when the model does not state a limit.
 */
export function ComposerOutputCountSection({
  view,
  disabled = false,
  row: Row,
  onSelect,
}: {
  view: Pick<ComposerOutputCountView, 'options' | 'value' | 'source' | 'modelMax'>
  disabled?: boolean
  row: React.ComponentType<ComposerOutputCountRowProps>
  onSelect: (count: number) => void
}) {
  const t = useTranslations('Chat')
  if (view.options.length === 0) return null
  return (
    <div className="p-1.5" role="group" aria-label={t('composer.outputCount')}>
      <p className="px-2.5 pb-1 pt-1 text-xs text-muted-foreground">{t('composer.outputCount')}</p>
      {view.options.map((count) => {
        const selected = count === view.value
        const hint = selected && view.source === 'message'
          ? t('composer.outputCountFromMessage')
          : count === view.modelMax && count > 1 ? t('composer.outputCountModelMax') : ''
        return (
          <Row
            key={count}
            option={{ id: String(count), label: String(count), hint }}
            selected={selected}
            disabled={disabled}
            onClick={() => onSelect(count)}
          />
        )
      })}
    </div>
  )
}

/** The canvas button's value: shown only when more than one output is chosen (the default 1 adds nothing). */
export function composerOutputCountButtonValue(view: Pick<ComposerOutputCountView, 'value'>, t: (key: string, values: { count: number }) => string) {
  return view.value > 1 ? t('composer.outputCountValue', { count: view.value }) : undefined
}

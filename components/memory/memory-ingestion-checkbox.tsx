'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Checkbox } from '@/components/ui/checkbox'
import type { MemoryUploadAvailability, MemoryUploadSummary } from '@/lib/memory/upload-memory-choice'
import { cn } from '@/lib/utils'

type IngestionChoiceTranslator = (key: string, values?: Record<string, string | number>) => string

/**
 * S19 "Belleğe de ekle": the single shared checkbox at an upload entry point (existing Checkbox + label). When
 * the channel's Memory is off it is shown unchecked and disabled with the reason; the upload itself still works.
 */
export function MemoryIngestionCheckbox({
  checked,
  availability,
  disabled,
  className,
  onCheckedChange,
}: {
  checked: boolean
  availability: MemoryUploadAvailability
  disabled?: boolean
  className?: string
  onCheckedChange: (checked: boolean) => void
}) {
  const t = useTranslations('Memory') as unknown as IngestionChoiceTranslator
  const id = React.useId()
  const unavailable = !availability.available
  const hint = unavailable ? t(`ingestionChoice.unavailable.${availability.reason}`) : t('ingestionChoice.hint')
  return (
    <label
      htmlFor={id}
      title={hint}
      data-testid="memory-ingestion-checkbox"
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 text-sm text-foreground',
        (unavailable || disabled) && 'cursor-not-allowed text-muted-foreground',
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked && !unavailable}
        disabled={disabled || unavailable}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span>{t('ingestionChoice.label')}</span>
      <span id={`${id}-hint`} className="sr-only">{hint}</span>
    </label>
  )
}

/** One muted line with the batch's Memory outcome from the ingestion preview (only non-zero parts). */
export function MemoryUploadSummaryLine({ summary, className }: { summary: MemoryUploadSummary | null; className?: string }) {
  const t = useTranslations('Memory') as unknown as IngestionChoiceTranslator
  if (!summary) return null
  const parts = [
    summary.queued > 0 ? t('ingestionChoice.summary.queued', { count: summary.queued }) : null,
    summary.approval > 0 ? t('ingestionChoice.summary.approval', { count: summary.approval }) : null,
    summary.notAdded > 0 ? t('ingestionChoice.summary.notAdded', { count: summary.notAdded }) : null,
    summary.skipped > 0 ? t('ingestionChoice.summary.skipped', { count: summary.skipped }) : null,
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 0) return null
  return (
    <p data-testid="memory-upload-summary" className={cn('truncate text-xs text-muted-foreground', className)}>
      {t('ingestionChoice.summary.prefix')} {parts.join(' · ')}
    </p>
  )
}

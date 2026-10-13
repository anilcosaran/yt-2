'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  formatMagicClipGroupLabel,
  type MagicClipStorageGroup,
} from '@/lib/storage/magic-clip-groups'
import { cn } from '@/lib/utils'

export function StorageClipGroupHeading({
  group,
  className,
}: {
  group: Pick<MagicClipStorageGroup<unknown>, 'kind' | 'runId'>
  className?: string
}) {
  const tStorage = useTranslations('Storage')
  const tAuto = useTranslations('Auto')
  const [copied, setCopied] = React.useState(false)
  const copiedTimerRef = React.useRef<number | null>(null)
  const runId = group.runId
  const label = formatMagicClipGroupLabel(group, tStorage)

  React.useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
  }, [])

  async function copyTaskId() {
    if (!runId) return
    try {
      await navigator.clipboard.writeText(runId)
    } catch {
      return
    }
    setCopied(true)
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <h3 className="min-w-0 truncate text-sm font-medium text-muted-foreground" title={runId ?? undefined}>
        {label}
      </h3>
      {runId ? (
        <button
          type="button"
          aria-label={copied ? tAuto('copied_8e3df45a') : tAuto('copy_task_id_9b3cceb4')}
          title={copied ? tAuto('copied_8e3df45a') : tAuto('copy_task_id_9b3cceb4')}
          onClick={() => void copyTaskId()}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      ) : null}
    </div>
  )
}

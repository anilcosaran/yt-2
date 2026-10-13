'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  getSparkEntry,
  getSparkProjectDescriptor,
  sparkEntryCardState,
  type SparkEntryStatus,
  type SparkHandoff,
} from '@/lib/spark/spark-entry'
import { markSparkOpenRequested } from '@/lib/spark/spark-open-timing'

const OPEN_STATUSES = new Set<SparkEntryStatus>(['attaching', 'preparing'])

/**
 * The explicit foreground open: ask the owner's project descriptor, then go to its open path. The path is
 * never taken from the chat message (a stale or forged link cannot open another project).
 */
export async function continueInSpark(input: {
  projectId: string
  getDescriptor?: typeof getSparkProjectDescriptor
  navigate: (path: string) => void
}): Promise<void> {
  markSparkOpenRequested()
  const descriptor = await (input.getDescriptor ?? getSparkProjectDescriptor)(input.projectId)
  input.navigate(descriptor.project.open_path)
}

/**
 * P03-13 "Spark'ta devam et" card of a Chat result carrying `composition_spark_handoff_v1`. It uses the
 * existing workflow-draft card shell. The card never changes the screen by itself: a background completion
 * only updates its status line; the user's click asks the server project descriptor and opens that project.
 */
export function SparkContinueCard({ handoff }: { handoff: SparkHandoff }) {
  const t = useTranslations('Chat')
  const router = useRouter()
  const [status, setStatus] = React.useState<SparkEntryStatus>(handoff.status)
  const [opening, setOpening] = React.useState(false)

  React.useEffect(() => {
    // One read of the owner's state for a card that was still preparing (no polling, no navigation).
    if (!handoff.entry_id || !OPEN_STATUSES.has(handoff.status)) return undefined
    const controller = new AbortController()
    getSparkEntry(handoff.entry_id, { signal: controller.signal })
      .then((entry) => setStatus(entry.status))
      .catch(() => undefined)
    return () => controller.abort()
  }, [handoff.entry_id, handoff.status])

  async function open() {
    if (opening) return
    setOpening(true)
    try {
      await continueInSpark({ projectId: handoff.project.project_id, navigate: (path) => router.push(path) })
    } catch {
      toast.error(t('sparkEntry.failed'))
      setOpening(false)
    }
  }

  const state = sparkEntryCardState(status)
  return (
    <div
      data-testid="spark-continue-card"
      className="flex w-[min(620px,92vw)] items-center gap-3 rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8">
        <Sparkles className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground dark:text-white">{t('sparkHandoff.title')}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground dark:text-white/58" role="status">
          {t(`sparkHandoff.state.${state}`)}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white"
          onClick={() => void open()}
          disabled={opening}
        >
          {t('sparkHandoff.continue')}
          {opening
            ? <Loader2 className="size-4 animate-spin" />
            : <ArrowUpRight className="size-4 text-muted-foreground dark:text-white/82" />}
        </Button>
      </div>
    </div>
  )
}

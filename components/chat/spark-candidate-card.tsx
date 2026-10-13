'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, File as FileIcon, Film, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  candidateFailures,
  candidateRefs,
  initialCandidateOrder,
  orderedCandidates,
  sparkIntentForChatSelection,
  toggleCandidate,
  type CandidateFailureReason,
} from '@/lib/spark/spark-candidates'
import {
  chatResultArtifactRefs,
  chatResultEntryRequest,
  startSparkEntry,
  type ChatResultArtifactRef,
} from '@/lib/spark/spark-entry'
import { markSparkOpenRequested } from '@/lib/spark/spark-open-timing'
import { cn } from '@/lib/utils'

type ChatResultMessage = Parameters<typeof chatResultArtifactRefs>[0]

/** Results of a message Spark can import; the candidate card is offered from two of them on. */
export function sparkCandidateCount(message: ChatResultMessage): number {
  return candidateRefs(chatResultArtifactRefs(message)).length
}

type Outcome = { openPath: string | null; failures: Array<{ ref: ChatResultArtifactRef; reason: CandidateFailureReason }> }

const SHELL =
  'w-[min(620px,92vw)] rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]'
const ACTION =
  'h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white'

/**
 * QA-090 Chat → Spark candidate card, in the existing workflow-draft card shell (like the P03-13 continue card):
 * the message's results as thumbnails with a checkbox and their order number; "Open in Spark" imports the selected
 * results in that order into a new draft (P03-11 entry, P03-12 re-authorization) and opens the editor. Results the
 * server could not add are listed with the existing attachment pill and their reason (decision 93); the project
 * then opens from the card with "Continue in Spark".
 */
export function SparkCandidateCard({
  message,
  thumbnails,
  activeChannelId,
  onClose,
}: {
  message: ChatResultMessage
  /** Preview image of each result by Storage object id (the chat's own delivery URLs). */
  thumbnails: ReadonlyMap<string, string | null>
  activeChannelId: string | null
  onClose: () => void
}) {
  const t = useTranslations('Chat')
  const router = useRouter()
  const refs = React.useMemo(() => candidateRefs(chatResultArtifactRefs(message)), [message])
  const [order, setOrder] = React.useState(() => initialCandidateOrder(refs))
  const [pending, setPending] = React.useState(false)
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)
  const selected = orderedCandidates(refs, order)

  const open = async () => {
    if (pending || selected.length === 0) return
    const request = chatResultEntryRequest({
      refs: selected,
      creationIntentId: await sparkIntentForChatSelection(message.id, refs, order),
      fallbackChannelId: activeChannelId,
      fallbackTitle: t('sparkEntry.defaultTitle'),
    })
    if (!request) {
      toast.error(t('sparkEntry.nothingToOpen'))
      return
    }
    setPending(true)
    markSparkOpenRequested()
    try {
      const descriptor = await startSparkEntry(request)
      const failures = candidateFailures(descriptor, selected)
      const openPath = descriptor.openable && descriptor.project ? descriptor.project.open_path : null
      if (openPath && failures.length === 0) {
        router.push(openPath)
        return
      }
      // Something could not be added: the card shows what and why before the project opens.
      setOutcome({ openPath, failures })
      if (!openPath) toast.error(t(descriptor.status === 'failed' ? 'sparkEntry.failed' : 'sparkEntry.notOpenable'))
    } catch {
      toast.error(t('sparkEntry.failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-testid="spark-candidate-card" className={SHELL}>
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground dark:text-white">{t('sparkCandidates.title')}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground dark:text-white/58" role="status">
            {outcome
              ? t(outcome.openPath ? 'sparkCandidates.partial' : 'sparkCandidates.failed')
              : t('sparkCandidates.selected', { count: selected.length, total: refs.length })}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-10 rounded-[10px] px-3 text-sm" onClick={onClose} disabled={pending}>
            {t('sparkCandidates.cancel')}
          </Button>
          {outcome?.openPath ? (
            <Button type="button" variant="outline" size="sm" className={ACTION} onClick={() => router.push(outcome.openPath!)}>
              {t('sparkHandoff.continue')}
              <ArrowUpRight className="size-4 text-muted-foreground dark:text-white/82" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className={ACTION} onClick={() => void open()} disabled={pending || selected.length === 0}>
              {pending ? t('sparkEntry.opening') : t('sparkEntry.open')}
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4 text-muted-foreground dark:text-white/82" />}
            </Button>
          )}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('sparkCandidates.listLabel')}>
        {refs.map((ref, index) => {
          const position = order.indexOf(ref.storageObjectId)
          const checked = position !== -1
          const name = ref.name ?? t('sparkCandidates.untitled', { n: index + 1 })
          const thumb = thumbnails.get(ref.storageObjectId) ?? null
          return (
            <li key={ref.storageObjectId}>
              <label
                title={name}
                className={cn(
                  'relative flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 transition dark:bg-black/35 dark:text-white/58',
                  checked ? 'ring-2 ring-primary' : 'ring-border/80 opacity-60 dark:ring-white/10',
                  (pending || outcome) && 'pointer-events-none',
                )}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage delivery URL of the chat result
                  <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <CandidateKindIcon kind={ref.kind} />
                )}
                {checked ? (
                  <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground" aria-hidden>
                    {position + 1}
                  </span>
                ) : null}
                <Checkbox
                  checked={checked}
                  disabled={pending || outcome !== null}
                  aria-label={checked ? t('sparkCandidates.itemSelected', { name, n: position + 1 }) : name}
                  className="absolute right-1 top-1 bg-background/90"
                  onCheckedChange={() => setOrder((current) => toggleCandidate(current, ref.storageObjectId))}
                />
              </label>
            </li>
          )
        })}
      </ul>
      {outcome && outcome.failures.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label={t('sparkCandidates.failedLabel')}>
          {outcome.failures.map(({ ref, reason }) => (
            <div
              key={ref.storageObjectId}
              className="flex h-14 max-w-[280px] items-center gap-2 rounded-[14px] border border-border/80 bg-card px-2 pr-3 text-left text-card-foreground opacity-70 shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
            >
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground dark:bg-black/35 dark:text-white/58">
                {thumbnails.get(ref.storageObjectId) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage delivery URL of the chat result
                  <img src={thumbnails.get(ref.storageObjectId)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CandidateKindIcon kind={ref.kind} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-current">{ref.name ?? t('sparkCandidates.untitled', { n: refs.indexOf(ref) + 1 })}</p>
                <p className="truncate text-xs text-current opacity-60">{t(`sparkCandidates.reasons.${reason}`)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CandidateKindIcon({ kind }: { kind: ChatResultArtifactRef['kind'] }) {
  if (kind === 'image') return <ImageIcon className="size-5" />
  if (kind === 'video') return <Film className="size-5" />
  return <FileIcon className="size-5" />
}

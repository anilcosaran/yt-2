'use client'

import * as React from 'react'
import { Check, CornerDownRight, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import type { AssistantRunState } from '@/lib/assistant/api'
import { isSteerableJobState, type AmbiguousJobCandidate } from '@/lib/assistant/composer/conversation-jobs'
import { cn } from '@/lib/utils'

/**
 * P03-14 composer parts in the existing Chat styling: the focus chip is a composer chip (like the Spark `.chip.focus`
 * context chip) with the composer popover for picking the target job; the ambiguous-target choice uses the quick
 * decision card. Jobs are named by the user's own words, never by an id.
 */

export type ComposerJobOption = { jobId: string; label: string | null; state: AssistantRunState }

export function ComposerJobFocusChip({
  jobs,
  selectedJobId,
  explicitNewJob,
  disabled,
  onSelectJob,
  onSelectNewJobs,
  onFollowLive,
  fixing = false,
  onFixJob,
}: {
  jobs: readonly ComposerJobOption[]
  selectedJobId: string | null
  explicitNewJob: boolean
  disabled?: boolean
  onSelectJob: (jobId: string) => void
  onSelectNewJobs: () => void
  onFollowLive: () => void
  /** QA-081: the next message is a steer ("Düzelt") of the focused job. */
  fixing?: boolean
  /** QA-081: offers "Düzelt" for a focused job that is still running; the next message steers it. */
  onFixJob?: (jobId: string) => void
}) {
  const t = useTranslations('Chat')
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLLIElement>(null)
  React.useEffect(() => {
    if (!open) return undefined
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.document.addEventListener('mousedown', close)
    return () => window.document.removeEventListener('mousedown', close)
  }, [open])
  const selected = jobs.find((job) => job.jobId === selectedJobId) ?? null
  if (!selected && !explicitNewJob) return null
  const jobName = selected?.label ?? t('typedComposer.jobs.unnamed')
  const fixable = !explicitNewJob && selected !== null && onFixJob !== undefined && isSteerableJobState(selected.state)
  const fixActive = fixing && fixable
  const label = explicitNewJob
    ? t('typedComposer.jobs.newJob')
    : t(fixActive ? 'typedComposer.jobs.fixLabel' : 'typedComposer.jobs.focusLabel', { label: jobName })

  return (
    <li
      ref={ref}
      className="relative flex h-7 max-w-full items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 pl-2.5 pr-1 text-xs font-medium text-foreground"
      title={t(explicitNewJob ? 'typedComposer.jobs.newJobsHint' : fixActive ? 'typedComposer.jobs.fixHint' : 'typedComposer.jobs.focusHint')}
    >
      <CornerDownRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="max-w-56 truncate rounded outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
      >
        {label}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={t(explicitNewJob ? 'typedComposer.jobs.followLive' : 'typedComposer.jobs.clearFocus')}
        onClick={() => (explicitNewJob ? onFollowLive() : onSelectNewJobs())}
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
      >
        <X className="size-3" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={t('typedComposer.jobs.menuLabel')}
          className="youtorch-thin-scrollbar absolute bottom-full left-0 z-30 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl shadow-black/40 duration-150 animate-in fade-in slide-in-from-bottom-1"
        >
          {fixable && selected ? (
            <JobOptionRow
              label={t('typedComposer.jobs.fix')}
              hint={t('typedComposer.jobs.fixHint')}
              selected={fixActive}
              onClick={() => {
                setOpen(false)
                if (fixActive) onSelectJob(selected.jobId)
                else onFixJob?.(selected.jobId)
              }}
            />
          ) : null}
          {jobs.map((job) => (
            <JobOptionRow
              key={job.jobId}
              label={job.label ?? t('typedComposer.jobs.unnamed')}
              hint={t(`typedComposer.jobs.states.${job.state}`)}
              selected={!explicitNewJob && job.jobId === selectedJobId}
              onClick={() => {
                setOpen(false)
                onSelectJob(job.jobId)
              }}
            />
          ))}
          <JobOptionRow
            label={t('typedComposer.jobs.newJob')}
            hint={t('typedComposer.jobs.newJobsHint')}
            selected={explicitNewJob}
            onClick={() => {
              setOpen(false)
              onSelectNewJobs()
            }}
          />
        </div>
      ) : null}
    </li>
  )
}

function JobOptionRow({ label, hint, selected, onClick }: { label: string; hint: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent', selected && 'bg-accent')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
    </button>
  )
}

/** The server found more than one waiting job for a free message: a short choice, then the same message is resent. */
export function JobTargetChoicePanel({
  candidates,
  newJobAllowed,
  labelFor,
  disabled,
  onChoose,
  onDismiss,
}: {
  candidates: readonly AmbiguousJobCandidate[]
  newJobAllowed: boolean
  labelFor: (candidate: AmbiguousJobCandidate) => string | null
  disabled: boolean
  onChoose: (choice: AmbiguousJobCandidate | 'new_job') => void
  onDismiss: () => void
}) {
  const t = useTranslations('Chat')
  return (
    <div className="mb-3 rounded-md border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-[#202020] dark:text-white dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-white/45">
            <Sparkles className="size-3.5" />
            {t('typedComposer.jobs.choiceTitle')}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground dark:text-white/74">{t('typedComposer.jobs.choiceBody')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {candidates.map((candidate) => (
            <Button
              key={candidate.pendingInvocationId}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(candidate)}
              className="h-9 max-w-64 truncate rounded-full border border-border bg-muted/30 px-4 text-sm font-semibold text-foreground hover:bg-muted dark:border-white/16 dark:bg-white/7 dark:text-white dark:hover:bg-white/12 dark:hover:text-white"
            >
              {labelFor(candidate) ?? t('typedComposer.jobs.unnamed')}
            </Button>
          ))}
          {newJobAllowed ? (
            <Button
              type="button"
              disabled={disabled}
              onClick={() => onChoose('new_job')}
              className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {t('typedComposer.jobs.choiceNewJob')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onDismiss}
            className="h-9 rounded-full px-3 text-sm"
          >
            {t('typedComposer.jobs.choiceDismiss')}
          </Button>
        </div>
      </div>
    </div>
  )
}

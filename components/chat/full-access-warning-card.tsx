'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Settings2 } from 'lucide-react'

import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { fullAccessLimitCopy, formatCredits } from '@/lib/assistant/full-access-flow'
import type { FullAccessConsentPrompt } from '@/lib/assistant/composer/use-composer-mode'

/**
 * Y1-02 (Q74, K354): the one-time Full access warning. It names the warning text revision the server expects (the
 * consent is recorded for exactly that revision, so a changed text asks again), what Full access may spend, the
 * optional approval limit in force and how to skip that one question. It is a dialog over the composer; "Not now"
 * leaves the mode as it was.
 */

type Translator = (key: string, values?: Record<string, string | number>) => string

export function FullAccessWarningCard({
  prompt,
  onConfirm,
  onDismiss,
}: {
  prompt: FullAccessConsentPrompt
  onConfirm: () => void
  onDismiss: () => void
}) {
  const t = useTranslations('Chat') as unknown as Translator
  return (
    <AppAlertDialog
      open
      tone="warning"
      title={t('fullAccessCard.title')}
      description={t('fullAccessCard.description')}
      confirmLabel={t('fullAccessCard.confirm')}
      cancelLabel={t('fullAccessCard.cancel')}
      closeLabel={t('fullAccessCard.close')}
      busy={prompt.busy}
      onOpenChange={(open) => { if (!open && !prompt.busy) onDismiss() }}
      onConfirm={onConfirm}
      onCancel={onDismiss}
    >
      <FullAccessWarningBody prompt={prompt} />
    </AppAlertDialog>
  )
}

/** The warning text itself (also what the dialog shows); separate so it renders without the dialog portal. */
export function FullAccessWarningBody({ prompt }: { prompt: FullAccessConsentPrompt }) {
  const t = useTranslations('Chat') as unknown as Translator
  const locale = useLocale()
  const limit = fullAccessLimitCopy(prompt.state)
  const points = [
    t('fullAccessCard.points.spend'),
    limit.kind === 'amount'
      ? t('fullAccessCard.points.limitAmount', { amount: formatCredits(limit.credits, locale) })
      : limit.kind === 'off'
        ? t('fullAccessCard.points.limitOff')
        : t('fullAccessCard.points.limitUnknown'),
    t('fullAccessCard.points.skip'),
    t('fullAccessCard.points.revoke'),
  ]
  return (
    <div className="flex flex-col gap-3" data-full-access-warning-revision={prompt.state.warning_revision}>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-5 text-foreground">
        {points.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <Link
        href="/settings?section=approvals"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Settings2 className="size-3.5" aria-hidden="true" />
        {t('fullAccessCard.settingsLink')}
      </Link>
      {prompt.error && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-100">
          {prompt.error === 'revision_changed' ? t('fullAccessCard.revisionChanged') : t('fullAccessCard.failed')}
        </p>
      )}
    </div>
  )
}

/**
 * Shown above an approval question that the user's own Full access limit caused (`content_json.full_access_limit_credits`
 * of the waiting message): says why Full access asks, and how to skip the question next time.
 */
export function FullAccessLimitNote({ limitCredits }: { limitCredits: number }) {
  const t = useTranslations('Chat') as unknown as Translator
  const locale = useLocale()
  return (
    <div
      className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-foreground"
      data-full-access-limit-ask={limitCredits}
    >
      <Settings2 className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden="true" />
      <p className="min-w-0">
        {t('fullAccessCard.limitAsk.text', { amount: formatCredits(limitCredits, locale) })}{' '}
        <Link href="/settings?section=approvals" className="font-medium text-primary hover:underline">
          {t('fullAccessCard.settingsLink')}
        </Link>
      </p>
    </div>
  )
}

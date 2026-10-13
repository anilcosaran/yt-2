'use client'

import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MotionEditorStatus } from '@/lib/motion-editor/session'

/**
 * P06-02 explicit states of the Motion screen (same look as the Spark editor's status view: centred message, back and
 * retry). A missing draft (404), a refused action (403), a closed feature, a malformed link and a failed load each have
 * their own message; none of them opens a default Motion, Kit or style in its place.
 */
export function MotionEditorStatus({
  status,
  onBack,
  onRetry,
}: {
  status: MotionEditorStatus
  onBack: () => void
  onRetry: () => void
}) {
  const t = useTranslations('Motion.editor')
  if (status === 'loading' || status === 'ready') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center" role="alert" data-motion-status={status}>
        <p className="text-sm text-muted-foreground">{t(`status.${status}`)}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
            {t('backToLibrary')}
          </Button>
          {status === 'error' ? <Button onClick={onRetry}>{t('retry')}</Button> : null}
        </div>
      </div>
    </div>
  )
}

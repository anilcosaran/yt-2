'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { PublishPackageSlot } from './publish-package-section'
import { useScriptReviewHostInternal, type ScriptReviewTarget } from './script-review-host'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * P04-21 slice 3 (raw video): the Plan view of a job that has no script (an uploaded video) is the same page
 * (`.plan`, `.pl-head`, `.pl-bodyw`, `.pl-wrap`, the header's close button) with only the "Yayın paketi" section, which is
 * the existing `PublishPackageSlot`: it loads and edits the package itself and shows nothing without one. The "Kurgu
 * önerileri" section of the coordinator's answer needs the EditRecipe half (P06-34) and is not built here. There is nothing
 * to autosave, so closing is immediate; opening or closing never starts inference, pricing, media or production.
 */
export function RawVideoPlanView({ title, closeLabel, closeHint, onClose, children }: {
  title: string
  closeLabel: string
  closeHint: string
  onClose(): void
  children: React.ReactNode
}) {
  return (
    <div className="plan" role="dialog" aria-modal={false} aria-label={title}>
      <header className="pl-head">
        <div className="pl-tb"><div className="pl-trow"><span className="pl-title">{title}</span></div></div>
        <div className="pl-actions">
          <button type="button" className="ib sm" title={closeHint} aria-label={closeLabel} onClick={onClose}>
            <svg className="i" aria-hidden><use href="#i-x" /></svg>
          </button>
        </div>
      </header>
      <div className="pl-bodyw">
        <div className="pl-main">
          <div className="pl-wrap">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function RawVideoPlanSurface({ target }: { target: ScriptReviewTarget }) {
  const t = useTranslations('Chat') as unknown as Translator
  const host = useScriptReviewHostInternal()
  const close = React.useCallback(async (): Promise<boolean> => {
    host?.closed(target)
    return true
  }, [host, target])

  React.useEffect(() => host?.registerCloser(close), [host, close])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const element = event.target
      if (element instanceof HTMLElement && (element.isContentEditable || element.closest('input, textarea, select'))) return
      event.preventDefault()
      void close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <RawVideoPlanView
      title={t('scriptReview.rawVideo.title')}
      closeLabel={t('scriptReview.close')}
      closeHint={t('scriptReview.closeHint')}
      onClose={() => void close()}
    >
      <PublishPackageSlot projectId={target.projectId} jobId={target.jobId} shots={null} />
    </RawVideoPlanView>
  )
}

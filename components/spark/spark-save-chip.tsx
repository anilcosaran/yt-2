'use client'

import { useTranslations } from 'next-intl'

import type { SparkSaveState } from '@/lib/spark/composition-session'

import { Icon } from './tools/studio-parts'
import './spark-save-chip.css'

/**
 * The header's save chip (E1-N): "Saving…" while changes are on their way to the server, "Saved" when the server has them
 * all, and "Not saved — retry" when a change could not reach the server. The last one is a button: pressing it sends the
 * waiting changes again (the editor also retries by itself). The edits stay on the canvas meanwhile and further edits keep
 * working; nothing is lost until the page is closed.
 */
export function SparkSaveChip({ state, onRetry }: { state: SparkSaveState; onRetry?: () => void }) {
  const t = useTranslations('Spark.editor')
  if (state === 'error') {
    return (
      <div className="saved err" role="status" aria-live="polite" data-save-state="error">
        <button type="button" className="save-retry" title={t('notSavedHint')} onClick={onRetry}>
          <Icon name="refresh" size="sm" />
          <b>{t('notSaved')}</b>
        </button>
      </div>
    )
  }
  return (
    <div className="saved" role="status" aria-live="polite" data-save-state={state}>
      {state === 'saving' ? (
        <>
          <span className="spin" style={{ width: 12, height: 12, borderWidth: 1.5 }} aria-hidden />
          <span>{t('saving')}</span>
        </>
      ) : (
        <>
          <Icon name="check-c" size="sm" />
          <span>{t('saved')}</span>
        </>
      )}
    </div>
  )
}

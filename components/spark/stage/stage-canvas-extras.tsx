'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkAspectRatio } from '@/lib/spark/api'
import { CANVAS_FORMATS, type AspectPlan } from '@/lib/spark/stage/aspect-relayout'
import { SHORTCUT_GROUPS, STAGE_SHORTCUTS, isMacPlatform, keyCap, shortcutSoon } from '@/lib/spark/stage/stage-shortcuts'

import { StudioIcon } from '../studio-icon'
import type { SparkStageBinding } from './use-spark-stage'
import { useStageState } from './use-stage-state'

/** How long a canvas notice stays (the editor's other notices use the same 2.2 s). */
const NOTICE_MS = 2200

/**
 * The canvas format picker of the stage foot (`SPARK_CONTEXT_TOOLBAR_ENABLED`): 16:9, 9:16 or 1:1. Picking another format first
 * shows its impact list (what moves, what is re-covered, Motion layers that cannot follow), then ONE command switches the
 * canvas and re-lays every layer out (`aspect-relayout.ts`); one undo reverts it all.
 */
export function StageAspectPicker({
  binding,
  ratio,
  label,
  canWrite,
  writeTitle,
}: {
  binding: SparkStageBinding
  ratio: SparkAspectRatio
  label: string
  canWrite: boolean
  writeTitle?: string
}) {
  const t = useTranslations('Spark.editor.stage.aspect')
  const [open, setOpen] = React.useState(false)
  const [review, setReview] = React.useState<{ to: SparkAspectRatio; plan: AspectPlan | null; status: 'planning' | 'ready' | 'applying' | 'failed' } | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return undefined
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const choose = (to: SparkAspectRatio) => {
    setOpen(false)
    if (to === ratio) return
    setReview({ to, plan: null, status: 'planning' })
    void binding.controller.planAspect(to).then(
      (plan) => setReview((current) => (current?.to === to ? { to, plan, status: plan ? 'ready' : 'failed' } : current)),
      () => setReview((current) => (current?.to === to ? { to, plan: null, status: 'failed' } : current)),
    )
  }

  const confirm = () => {
    if (!review || review.status !== 'ready') return
    const { to } = review
    setReview({ ...review, status: 'applying' })
    void binding.controller.switchAspect(to).then((result) => {
      setReview((current) => (current?.to !== to ? current : result === 'failed' ? { ...current, status: 'failed' } : null))
    })
  }

  return (
    <div className="stage-aspect" ref={ref}>
      <button
        type="button"
        className="pill ib-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!canWrite}
        title={writeTitle ?? t('change')}
        aria-label={t('current', { ratio: label })}
        onClick={() => setOpen((current) => !current)}
      >
        <StudioIcon name="aspect" className="sm" />
        {label}
      </button>
      {open ? (
        <div className="cmenu stage-aspect-menu" role="menu" aria-label={t('change')}>
          {CANVAS_FORMATS.map((format) => (
            <button key={format} type="button" role="menuitemradio" aria-checked={format === ratio} onClick={() => choose(format)}>
              <span className={`aspect-glyph r${format.replace(':', 'x')}`} aria-hidden />
              {t(`formats.${format.replace(':', 'x')}`)}
              <kbd>{format}</kbd>
            </button>
          ))}
        </div>
      ) : null}
      {review ? (
        <div className="modal-bg" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="stage-aspect-title" data-aspect-review={review.to}>
            <div className="modal-h">
              <h3 id="stage-aspect-title">{t('reviewTitle', { from: ratio, to: review.to })}</h3>
              <button type="button" className="ib sm" aria-label={t('cancel')} title={t('cancel')} onClick={() => setReview(null)}>
                <StudioIcon name="x" />
              </button>
            </div>
            <div className="stage-modal-body">
              {review.status === 'planning' ? (
                <p className="pp-hint" role="status">
                  {t('planning')}
                </p>
              ) : null}
              {review.plan ? <AspectImpactList plan={review.plan} /> : null}
              <p className="pp-hint">{t('undoHint')}</p>
              {review.status === 'failed' ? (
                <p className="pp-hint warn" role="alert">
                  {t('failed')}
                </p>
              ) : null}
              <div className="pp-actions stage-modal-actions">
                <button type="button" className="btn sm" onClick={() => setReview(null)}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn sm primary" disabled={review.status !== 'ready'} onClick={confirm}>
                  {review.status === 'applying' ? t('applying') : t('apply', { ratio: review.to })}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AspectImpactList({ plan }: { plan: AspectPlan }) {
  const t = useTranslations('Spark.editor.stage.aspect.impact')
  const { impact } = plan
  const rows: Array<{ key: string; count: number; warn?: boolean }> = [
    { key: 'recovered', count: impact.recovered },
    { key: 'refitted', count: impact.refitted },
    { key: 'moved', count: impact.moved },
    { key: 'review', count: impact.review, warn: true },
    { key: 'motion', count: impact.motion, warn: true },
  ]
  const shown = rows.filter((row) => row.count > 0)
  return (
    <ul className="stage-impact" data-aspect-impact>
      {shown.length === 0 ? <li>{t('nothing')}</li> : null}
      {shown.map((row) => (
        <li key={row.key} className={row.warn ? 'warn' : undefined} data-impact={row.key}>
          {t(row.key, { count: row.count })}
        </li>
      ))}
    </ul>
  )
}

/** A short message of a canvas action (copied, a paste that does not fit, a replaced picture), hidden after a moment. */
export function StageNoticePill({ binding }: { binding: SparkStageBinding }) {
  const t = useTranslations('Spark.editor.stage.notices')
  const state = useStageState(binding)
  const notice = state.notice
  React.useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => binding.controller.clearNotice(notice.seq), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [binding, notice])
  if (!notice) return null
  return (
    <div className="stage-notice pill" role="status" data-stage-notice={notice.key}>
      {t(notice.key)}
    </div>
  )
}

/** The "?" sheet: every canvas shortcut, grouped; Esc or the close button closes it. `redo`: `SPARK_REDO_ENABLED`. */
export function StageShortcutsSheet({ onClose, redo = false }: { onClose: () => void; redo?: boolean }) {
  const t = useTranslations('Spark.editor.stage.shortcuts')
  const ref = React.useRef<HTMLDivElement>(null)
  const mac = isMacPlatform()
  React.useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === '?') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="modal-bg" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal stage-shortcuts" role="dialog" aria-modal="true" aria-labelledby="stage-shortcuts-title" ref={ref} data-shortcuts-sheet>
        <div className="modal-h">
          <h3 id="stage-shortcuts-title">{t('title')}</h3>
          <button type="button" className="ib sm" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <StudioIcon name="x" />
          </button>
        </div>
        <div className="kgrid">
          {SHORTCUT_GROUPS.map((group) => (
            <React.Fragment key={group}>
              <h4>{t(`groups.${group}`)}</h4>
              {STAGE_SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                <div key={shortcut.id} className={shortcutSoon(shortcut, { redo }) ? 'soon' : undefined} data-shortcut={shortcut.id}>
                  <span>
                    {t(`items.${shortcut.id}`)}
                    {shortcutSoon(shortcut, { redo }) ? <small> · {t('soon')}</small> : null}
                  </span>
                  <span>
                    {shortcut.keys.map((combo, index) => (
                      <React.Fragment key={index}>
                        {index > 0 ? <span className="or"> / </span> : null}
                        {combo.map((key) => (
                          <kbd key={key}>{key === 'drag' ? t('drag') : keyCap(key, mac)}</kbd>
                        ))}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

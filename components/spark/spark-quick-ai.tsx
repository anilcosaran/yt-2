'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkQuickAiCard, SparkQuickAiSession } from '@/lib/spark/quick-ai-session'

import { StudioIcon } from './studio-icon'

export type SparkQuickAiActions = Pick<SparkQuickAiSession, 'retry' | 'approve' | 'apply' | 'dismiss'>

const RATE_LIMITED = new Set(['quick_ai_rate_limited', 'quick_ai_concurrency_limited', 'quick_ai_request_in_progress'])
const UNAVAILABLE = new Set([
  'quick_ai_admission_unavailable',
  'quick_ai_provider_unavailable',
  'quick_ai_model_unavailable',
  'quick_ai_first_token_timeout',
  'quick_ai_timeout',
])

function errorKey(code: string | undefined): 'rateLimited' | 'unavailable' | 'invalidOutput' | 'generic' {
  if (!code) return 'generic'
  if (RATE_LIMITED.has(code)) return 'rateLimited'
  if (UNAVAILABLE.has(code)) return 'unavailable'
  if (code === 'quick_ai_output_invalid') return 'invalidOutput'
  return 'generic'
}

/**
 * QA-068: one quick AI suggestion in the Assistant tab, in the design's assistant message (`.m-ai`) with the
 * `wand` card (`.card`), its before/after diff (`.diff`) and the Apply / Dismiss footer (`.card-f`). A running
 * request shows the design's thinking row; the other outcomes of the P03-24 lane keep the same card shell.
 */
export function SparkQuickAiCardView({
  card,
  actions,
  canWrite,
  writeTitle,
}: {
  card: SparkQuickAiCard
  actions: SparkQuickAiActions
  canWrite: boolean
  writeTitle: string | undefined
}) {
  const t = useTranslations('Spark.editor.quickAi')
  const tEditor = useTranslations('Spark.editor')
  const meta = tEditor('sceneName', { n: card.sceneNumber })
  const dismiss = (
    <button type="button" className="btn ghost sm" disabled={card.status === 'applying'} onClick={() => actions.dismiss(card.id)}>
      {t('dismiss')}
    </button>
  )
  const header = (title: string) => (
    <div className="card-h">
      <span className="ic">
        <StudioIcon name="wand" />
      </span>
      {title}
      <span className="meta">{meta}</span>
    </div>
  )

  let body: React.ReactNode
  if (card.status === 'running') {
    body = (
      <div className="think" role="status">
        <span className="spin" aria-hidden />
        <span className="txt">{t('running')}</span>
      </div>
    )
  } else if (card.status === 'ready' || card.status === 'applying' || card.status === 'applied' || card.status === 'stale') {
    const stale = card.status === 'stale'
    body = (
      <>
        {stale ? <div className="ai-text">{t('stale')}</div> : card.summary ? <div className="ai-text">{card.summary}</div> : null}
        <div className={`card${stale ? ' reverted' : ''}`}>
          {header(t('cardTitle'))}
          <div className="diff">
            <span className="lab">{t('before')}</span>
            <span className="old">{card.before}</span>
            <span className="lab">{t('after')}</span>
            <span className="new">{card.after}</span>
          </div>
          {card.status === 'applied' ? (
            <ul className="card-list">
              <li>
                <StudioIcon name="check" />
                <span>{t('applied')}</span>
                <span />
              </li>
            </ul>
          ) : (
            <div className="card-f">
              {stale ? null : (
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={!canWrite || card.status === 'applying'}
                  title={writeTitle}
                  onClick={() => void actions.apply(card.id)}
                >
                  {card.status === 'applying' ? <span className="spin" aria-hidden /> : <StudioIcon name="check" className="sm" />}
                  {t('apply')}
                </button>
              )}
              {dismiss}
            </div>
          )}
        </div>
      </>
    )
  } else if (card.status === 'approval_required') {
    body = (
      <>
        <div className="ai-text">{t('approvalBody', { credits: card.approval?.requestedMaxCredits ?? 0 })}</div>
        <div className="card">
          {header(t('approvalTitle'))}
          <div className="card-f">
            <button type="button" className="btn primary sm" disabled={!canWrite} title={writeTitle} onClick={() => void actions.approve(card.id)}>
              {t('approve')}
            </button>
            {dismiss}
          </div>
        </div>
      </>
    )
  } else {
    const [title, text] =
      card.status === 'funding_required'
        ? [t('fundingTitle'), t('fundingBody')]
        : card.status === 'handoff'
          ? [t('handoffTitle'), t('handoffBody')]
          : [t('failedTitle'), t(`errors.${errorKey(card.error?.code)}`)]
    body = (
      <>
        <div className="ai-text">{text}</div>
        <div className="card">
          {header(title)}
          <div className="card-f">
            {card.status === 'failed' && card.error?.retryable ? (
              <button type="button" className="btn sm" onClick={() => actions.retry(card.id)}>
                <StudioIcon name="refresh" className="sm" />
                {t('retry')}
              </button>
            ) : null}
            {dismiss}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="m-ai" data-quick-ai-card={card.id}>
      <div className="ai-who">
        <span className="orb">
          <StudioIcon name="sparkles" />
        </span>
        {tEditor('assistant')}
      </div>
      {body}
    </div>
  )
}

/** Where a text block's menu opens (viewport coordinates) and for which text layer. */
export type SparkLayerMenuAnchor = { sceneId: string; layerId: string; x: number; y: number }

/**
 * QA-068: the design's context menu (`.cmenu`) of a text layer — "Rewrite with AI" and "Ask AI about this". The
 * canvas does not draw layers yet, so it opens on the text layer's block in the expanded timeline (right click, the
 * context-menu key or Shift+F10). Escape, a click outside or scrolling closes it.
 */
export function SparkTextLayerMenu({
  anchor,
  canWrite,
  writeTitle,
  onRewrite,
  onAsk,
  onClose,
}: {
  anchor: SparkLayerMenuAnchor
  canWrite: boolean
  writeTitle: string | undefined
  onRewrite: () => void
  onAsk: () => void
  onClose: () => void
}) {
  const t = useTranslations('Spark.editor.quickAi')
  const ref = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // One subscription per open menu; the first enabled item takes the focus once.
  React.useEffect(() => {
    const menu = ref.current
    menu?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const close = () => onCloseRef.current()
    const onPointer = (event: MouseEvent) => {
      if (menu && !menu.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  return (
    <div ref={ref} className="cmenu" role="menu" aria-label={t('menuLabel')} style={{ left: anchor.x, top: anchor.y }}>
      <button type="button" role="menuitem" disabled={!canWrite} title={writeTitle} onClick={onRewrite}>
        <StudioIcon name="sparkles" className="spark" />
        {t('rewrite')}
      </button>
      <button type="button" role="menuitem" disabled={!canWrite} title={writeTitle} onClick={onAsk}>
        <StudioIcon name="sparkles" className="spark" />
        {t('ask')}
      </button>
    </div>
  )
}

/** Keeps a menu of about `width` × `height` pixels inside the viewport (the design clamps the same way). */
export function clampMenuPosition(x: number, y: number, viewport: { width: number; height: number }, size = { width: 220, height: 90 }) {
  return {
    x: Math.max(8, Math.min(x, viewport.width - size.width - 8)),
    y: Math.max(8, Math.min(y, viewport.height - size.height - 8)),
  }
}

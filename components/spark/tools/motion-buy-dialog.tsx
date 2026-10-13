'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'

import { ADD_CREDITS_HREF } from '@/components/billing/credit-action-button'
import { motionMarketMessage, type MotionPurchase } from '@/lib/motion-market/motion-market'
import { MotionBuySession, type MotionBuyOptions, type MotionBuyTarget } from '@/lib/motion-market/purchase-session'

import { StudioIcon } from '../studio-icon'
import './motion-buy-dialog.css'

type T = ReturnType<typeof useTranslations>

/**
 * E1-I the Premium Motion buy dialog (design `.modal-bg` / `.modal` shell, like the export dialog): what the Motion costs, where the
 * credits come from, what the licence means (bought once for the whole workspace; no resale, no Community re-publish, no refund), then
 * ONE purchase intent with the price the user saw, followed to `sold`. A changed price shows the new price and asks again; every refusal
 * says why in plain words and nothing is charged; a balance that cannot pay offers "Add credits".
 *
 * The Spark Motion drawer's Premium tab opens it with `useMotionBuy().open(target)`; the Community Motion cards use the same dialog.
 */
export function MotionBuyDialog({ target, onClose, ...options }: { target: MotionBuyTarget; onClose: () => void } & MotionBuyOptions) {
  const t = useTranslations('Motion.market')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const [session] = React.useState(() => new MotionBuySession(target, options))
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const name = target.title[locale] || target.title.en
  const busy = state.phase === 'buying'

  React.useEffect(() => () => session.cancel(), [session])

  // Escape closes (a purchase in flight keeps going on the server); Tab stays inside the dialog.
  React.useEffect(() => {
    const dialog = dialogRef.current
    dialog?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className="modal-bg"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className="modal mbuy-dialog" role="dialog" aria-modal="true" aria-labelledby="mbuy-title" aria-busy={busy} tabIndex={-1}>
        <div className="modal-h">
          <h3 id="mbuy-title">{state.phase === 'done' ? t('buy.doneTitle') : t('buy.title', { name })}</h3>
          <button type="button" className="ib sm" aria-label={t('buy.close')} title={t('buy.close')} onClick={onClose}>
            <StudioIcon name="x" />
          </button>
        </div>
        <div className="mbuy-body" aria-live="polite">
          <BuyBody session={session} state={state} name={name} summary={target.summary} t={t} />
        </div>
        <div className="mm-foot mbuy-foot">
          <BuyActions session={session} state={state} t={t} onClose={onClose} />
        </div>
      </div>
    </div>
  )
}

function BuyBody({
  session,
  state,
  name,
  summary,
  t,
}: {
  session: MotionBuySession
  state: ReturnType<MotionBuySession['getSnapshot']>
  name: string
  summary: string
  t: T
}) {
  const target = session.target
  if (state.phase === 'buying') {
    return (
      <div className="mbuy-wait" role="status">
        <span className="spin" aria-hidden />
        <span>{t('buy.buying')}</span>
      </div>
    )
  }
  if (state.phase === 'processing') {
    return (
      <p className="mbuy-note" role="status" data-motion-buy="processing">
        {t('buy.processing')}
      </p>
    )
  }
  if (state.phase === 'done') {
    return (
      <p className="mbuy-note" role="status" data-motion-buy="done">
        {t('buy.doneBody', { name })}
      </p>
    )
  }
  const price = session.priceCredits
  return (
    <>
      {state.notice ? (
        <p className="mbuy-note mbuy-alert" role="alert" data-motion-buy-notice={state.notice.kind}>
          {motionMarketMessage(state.notice, t)}
        </p>
      ) : state.failed ? (
        <p className="mbuy-note mbuy-alert" role="alert" data-motion-buy-notice="generic">
          {t('errors.generic')}
        </p>
      ) : null}
      <div className="mbuy-motion">
        <b>{name}</b>
        {summary ? <p>{summary}</p> : null}
        {target.seller ? <small>{t('buy.seller', { seller: target.seller })}</small> : null}
      </div>
      <dl className="mbuy-rows">
        <div>
          <dt>{t('buy.price')}</dt>
          <dd data-motion-buy-price>{t('buy.priceValue', { price })}</dd>
        </div>
        <div>
          <dt>{t('buy.paidFrom')}</dt>
          <dd>{t(target.source === 'community' ? 'buy.funding.top_up_only' : 'buy.funding.standard')}</dd>
        </div>
        <div>
          <dt>{t('buy.usedBy')}</dt>
          <dd>{t('buy.usedByValue')}</dd>
        </div>
      </dl>
      <div className="mbuy-licence">
        <b>{t('buy.licenceTitle')}</b>
        <ul>
          <li>{t('buy.licence.once')}</li>
          <li>{t('buy.licence.noResale')}</li>
          <li>{t('buy.licence.final')}</li>
        </ul>
      </div>
    </>
  )
}

function BuyActions({
  session,
  state,
  t,
  onClose,
}: {
  session: MotionBuySession
  state: ReturnType<MotionBuySession['getSnapshot']>
  t: T
  onClose: () => void
}) {
  if (state.phase === 'done' || state.phase === 'processing') {
    return (
      <button type="button" className="btn primary" onClick={onClose}>
        {t('buy.close')}
      </button>
    )
  }
  const noticeKind = state.phase === 'confirm' ? state.notice?.kind : null
  // A refusal that no click can fix (the Motion is gone, changed or yours) leaves only Close.
  const blocked = noticeKind === 'unavailable' || noticeKind === 'revisionChanged' || noticeKind === 'selfPurchase' || noticeKind === 'notForSale' || noticeKind === 'approvalRequired'
  const needsCredits = noticeKind === 'insufficientCredits' || noticeKind === 'purchaseRequired'
  return (
    <>
      <button type="button" className="btn" onClick={onClose}>
        {blocked ? t('buy.close') : t('buy.cancel')}
      </button>
      <span className="grow" />
      {needsCredits ? (
        <a className="btn" href={ADD_CREDITS_HREF}>
          {t('buy.addCredits')}
        </a>
      ) : null}
      {blocked ? null : (
        <button type="button" className="btn primary" disabled={state.phase === 'buying'} onClick={() => void session.buy()}>
          {t('buy.confirm', { price: session.priceCredits })}
        </button>
      )}
    </>
  )
}

export type MotionPurchasedHandler = (purchase: MotionPurchase) => void

/**
 * The one line a drawer needs: `const buy = useMotionBuy({ onPurchased: reload })`, render `{buy.dialog}` and call `buy.open(target)` from a
 * card's Buy button. The dialog mounts for one target at a time and is built fresh for each (a new intent per click-through). It is
 * portaled into the studio root (`.yt-studio`: the editor, or the host of a page) so the design's tokens apply and a drawer's own
 * transform or clipping can never shrink the fixed overlay; with no studio root in the page it renders where it is called.
 */
export function useMotionBuy(options: Omit<MotionBuyOptions, 'onStale'> & { onStale?: () => void } = {}) {
  const [target, setTarget] = React.useState<MotionBuyTarget | null>(null)
  const [portalRoot, setPortalRoot] = React.useState<Element | null>(null)
  const open = React.useCallback((next: MotionBuyTarget) => {
    setPortalRoot(typeof document === 'undefined' ? null : document.querySelector('.yt-studio'))
    setTarget(next)
  }, [])
  const close = React.useCallback(() => setTarget(null), [])
  let dialog: React.ReactNode = null
  if (target) {
    const node = <MotionBuyDialog key={`${target.source}:${target.motionId}`} target={target} onClose={close} {...options} />
    dialog = portalRoot ? createPortal(node, portalRoot) : node
  }
  return { open, close, dialog, target }
}

/**
 * Hosts a studio dialog on a page outside the Spark editor (the Community Motion cards): the design's dialog classes and tokens live on
 * `.yt-studio`, so the host is a zero-height studio root; the dialog itself is `position: fixed` and covers the page.
 */
export function MotionBuyDialogHost({ children }: { children: React.ReactNode }) {
  return <div className="yt-studio mbuy-host">{children}</div>
}

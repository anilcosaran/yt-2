'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { MotionCard } from '@/lib/spark/motion-catalog'

/**
 * The buy button of a Premium Motion card the workspace does not own yet (D3, E1-I): once per workspace, with credits, copied into
 * the workspace library and usable in every project of the workspace. This is the ONE place the purchase plugs into a card: the
 * card hands over the Motion and the drawer opens the buy dialog (`useMotionBuy`) for it; nothing else in the drawer knows how a
 * Motion is bought. Buying is a workspace purchase, not an edit of this project, so it does not wait for the project's write role
 * (the server decides who may buy and says so in the dialog).
 */
export function MotionPremiumBuyButton({ card, onBuy }: { card: MotionCard; onBuy: () => void }) {
  const t = useTranslations('Spark.editor.motionDrawer')
  const locale = useLocale()
  const name = locale === 'tr' ? card.title.tr : card.title.en
  return (
    <button
      type="button"
      className="btn sm mo-buy"
      disabled={!card.offer}
      title={card.offer ? t('buyTitle', { title: name, credits: card.priceCredits ?? 0 }) : t('buyUnavailable')}
      aria-label={t('buyLabel', { title: name })}
      data-motion-buy={card.key}
      onClick={onBuy}
    >
      {t('buy')}
    </button>
  )
}

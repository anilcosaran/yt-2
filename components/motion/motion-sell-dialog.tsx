'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  delistMotion,
  motionListingPriceInputError,
  motionListingPriceMax,
  motionListingPriceMin,
  motionMarketMessage,
  motionMarketNotice,
  motionSellerShareCredits,
  sellMotion,
  type MotionListing,
} from '@/lib/motion-market/motion-market'

/** One of the actor's saved Motions a listing is about: the exact revision that would be sold. */
export type MotionSellTarget = {
  motionId: string
  motionRevisionId: string
  title: { en: string; ter?: never } & { tr: string }
}

type SellApi = { sell: typeof sellMotion; delist: typeof delistMotion }
const DEFAULT_API: SellApi = { sell: sellMotion, delist: delistMotion }

/**
 * E1-I "Sell in Community": the seller's price (a whole number of credits from 10 to 100,000), what they earn per sale (70 %, the platform
 * keeps 30 %), how they are paid (credits spendable in Youtorch after the next 4-hourly settlement) and the licence the buyer gets (bought
 * once per workspace; no resale, no Community re-publish, no refund; a Motion made from a premium or a bought Motion cannot be sold). One
 * submit = one listing change under the version the seller saw; a refusal says why in plain words. Stopping a sale keeps every earlier
 * buyer's licence.
 */
export function MotionSellDialog({
  target,
  listing,
  onClose,
  onChanged,
  api = DEFAULT_API,
}: {
  target: MotionSellTarget
  /** The Motion's current listing of this seller (null = not listed yet). */
  listing: MotionListing | null
  onClose: () => void
  /** The listing changed (listed, repriced or stopped): the screen reads its cards and sales again. */
  onChanged: (action: 'listed' | 'stopped') => void
  api?: SellApi
}) {
  const t = useTranslations('Motion.market')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const name = target.title[locale] || target.title.en
  const active = listing?.state === 'active'
  const [price, setPrice] = React.useState<string>(active || listing ? String(listing.price_credits) : '')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const value = price.trim() === '' ? Number.NaN : Number(price)
  const inputError = price.trim() === '' ? null : motionListingPriceInputError(value)
  const share = Number.isFinite(value) && inputError === null ? motionSellerShareCredits(value) : null
  const priceMessage = inputError === 'not_integer' ? t('sellDialog.priceNotInteger') : inputError === 'out_of_range' ? t('sellDialog.priceOutOfRange', { min: motionListingPriceMin, max: motionListingPriceMax }) : null
  const unchanged = active && listing?.price_credits === value && listing.motion_revision_id === target.motionRevisionId

  const run = async (action: 'listed' | 'stopped', work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      onChanged(action)
      onClose()
    } catch (failure) {
      const notice = motionMarketNotice(failure)
      setError(notice ? motionMarketMessage(notice, t) : t('errors.generic'))
      // A changed listing (or a refusal that depends on it) is read again so the next try names the current version.
      if (notice?.kind === 'listingChanged') onChanged('listed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md" data-motion-sell-dialog>
        <DialogHeader>
          <DialogTitle>{t('sellDialog.title', { name })}</DialogTitle>
          <DialogDescription>{t('sellDialog.paidIn')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy || inputError !== null || !Number.isFinite(value) || unchanged) return
            void run('listed', () => api.sell({ motionRevisionId: target.motionRevisionId, priceCredits: value, expectedVersion: listing?.version ?? 0 }))
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="motion-sell-price">
            {t('sellDialog.price')}
            <Input
              id="motion-sell-price"
              inputMode="numeric"
              autoComplete="off"
              value={price}
              aria-invalid={inputError !== null || undefined}
              aria-describedby="motion-sell-price-help"
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <p id="motion-sell-price-help" className={`text-xs ${priceMessage ? 'text-destructive' : 'text-muted-foreground'}`} role={priceMessage ? 'alert' : undefined}>
            {priceMessage ?? t('sellDialog.priceHelp', { min: motionListingPriceMin, max: motionListingPriceMax })}
          </p>
          {share ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm" data-motion-sell-share>
              {t('sellDialog.youEarn', { seller: share.seller, platform: share.platform })}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            <b className="text-sm text-foreground">{t('sellDialog.licenceTitle')}</b>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              <li>{t('sellDialog.licence.workspace')}</li>
              <li>{t('sellDialog.licence.noResale')}</li>
              <li>{t('sellDialog.licence.noRefund')}</li>
              <li>{t('sellDialog.licence.derived')}</li>
            </ul>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert" data-motion-sell-error>
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {active ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => listing && void run('stopped', () => api.delist({ motionId: listing.motion_id, expectedVersion: listing.version }))}
              >
                {t('sellDialog.stop')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
                {t('sellDialog.cancel')}
              </Button>
              <Button type="submit" disabled={busy || inputError !== null || !Number.isFinite(value) || unchanged} aria-busy={busy || undefined}>
                {busy ? t('sellDialog.saving') : active ? t('sellDialog.update') : share ? t('sellDialog.submit', { price: value }) : t('sellDialog.submitEmpty')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

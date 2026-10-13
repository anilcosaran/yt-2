'use client'

import Link from 'next/link'
import { ArrowUpRight, AudioLines, Camera, CheckCircle2, Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { AVATAR_UPGRADE_HREF } from '@/components/brand/avatar/avatar-voice-controls'
import { Button } from '@/components/ui/button'

/** Monthly plan inclusions shown in the mini comparison (plan seed defaults, plan section 4.3a). */
export const AVATAR_UPGRADE_PLANS = [
  { id: 'starter', includedCredits: 2000, freeAvatars: 3 },
  { id: 'pro', includedCredits: 5000, freeAvatars: 10 },
  { id: 'max', includedCredits: 7900, freeAvatars: 30 },
] as const

export function approximateShotsForCredits(credits: number, shotCredits: number) {
  if (!Number.isFinite(credits) || !Number.isFinite(shotCredits) || shotCredits <= 0) return 0
  return Math.floor(credits / shotCredits)
}

/**
 * Basic plan: cloning a real person needs Starter or above. Shown instead of QR/errors when a
 * Basic user picks "Clone a real person".
 */
export function AvatarUpgradePanel({
  shotCredits = 19,
  upgradeHref = AVATAR_UPGRADE_HREF,
  onCreateCharacter,
}: {
  shotCredits?: number
  upgradeHref?: string
  onCreateCharacter?: () => void
}) {
  const t = useTranslations('BrandAvatar.upgrade')
  const benefits = [
    { key: 'benefitClone', icon: Camera },
    { key: 'benefitVoice', icon: AudioLines },
    { key: 'benefitCredits', icon: Coins },
  ] as const
  return (
    <div data-avatar-upgrade="panel" className="space-y-5">
      <div>
        <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
          {t('badge')}
        </span>
        <h3 className="mt-3 font-display text-2xl text-foreground">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <ul className="space-y-2.5">
        {benefits.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-start gap-3 text-sm text-foreground">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent">
              <Icon className="size-3.5" />
            </span>
            <span className="pt-1">{t(key)}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3" data-avatar-upgrade="plans">
        {AVATAR_UPGRADE_PLANS.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-border bg-panel/50 p-3.5">
            <p className="text-sm font-semibold text-foreground">{t(`plans.${plan.id}`)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('planCredits', { credits: plan.includedCredits })}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              {t('planFreeAvatars', { count: plan.freeAvatars })}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              {t('planShots', { count: approximateShotsForCredits(plan.includedCredits, shotCredits) })}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="h-10 flex-1 rounded-xl">
          <Link href={upgradeHref}>
            <ArrowUpRight className="size-4" />
            {t('cta')}
          </Link>
        </Button>
        {onCreateCharacter ? (
          <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl" onClick={onCreateCharacter}>
            {t('secondary')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

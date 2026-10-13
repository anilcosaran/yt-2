'use client'

import * as React from 'react'
import { CreditCard } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export type PaymentCardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'maestro'
  | 'troy'
  | 'unknown'

export interface PaymentMethodCardProps {
  brand?: string | null
  last4?: string | null
  expiry?: string | null
  billingEmail?: string | null
  holderName?: string | null
  isDefault?: boolean
  actionLabel?: string
  actionDisabled?: boolean
  secondaryActionLabel?: string
  secondaryActionDisabled?: boolean
  className?: string
  onEdit?: () => void
  onSecondaryAction?: () => void
}

const brandLabels: Record<PaymentCardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  maestro: 'Maestro',
  troy: 'Troy',
  unknown: '',
}

export function PaymentMethodCard({
  brand,
  last4,
  expiry,
  billingEmail,
  holderName,
  isDefault = false,
  actionLabel,
  actionDisabled = false,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  className,
  onEdit,
  onSecondaryAction,
}: PaymentMethodCardProps) {
  const tAuto = useTranslations('Auto')
  const tCommon = useTranslations('Common')
  const normalizedBrand = getPaymentCardBrand(brand)
  const label = normalizedBrand === 'unknown'
    ? brand?.trim() || tCommon('card')
    : brandLabels[normalizedBrand]
  const visibleActionLabel = actionLabel ?? tCommon('edit')
  const visibleLast4 = last4?.trim()
  const visibleEmail = billingEmail?.trim()
  const visibleHolder = holderName?.trim()

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CardBrandMark brand={normalizedBrand} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              {isDefault && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10"><UiText id="default_808d7dca" /></Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {visibleLast4 ? `**** **** **** ${visibleLast4}` : tAuto('card_details_unavailable_86e86c76')}
            </p>
            {expiry && <p className="mt-3 text-xs text-muted-foreground"><UiText id="expiry_on_1adb3a1f" />{' '}{expiry}</p>}
            {visibleHolder && <p className="mt-0.5 truncate text-xs text-muted-foreground">{visibleHolder}</p>}
            {visibleEmail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{visibleEmail}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onEdit}
            disabled={actionDisabled}
          >
            {visibleActionLabel}
          </Button>
          {secondaryActionLabel && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={onSecondaryAction}
              disabled={secondaryActionDisabled}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CardBrandMark({
  brand,
  className,
}: {
  brand: PaymentCardBrand
  className?: string
}) {
  const tAuto = useTranslations('Auto')
  if (brand === 'mastercard' || brand === 'maestro') {
    const leftColor = brand === 'mastercard' ? '#EB001B' : '#009DDD'
    const rightColor = brand === 'mastercard' ? '#F79E1B' : '#ED1B2F'

    return (
      <div className={cn('relative mt-0.5 h-7 w-10 shrink-0', className)} aria-label={brandLabels[brand]}>
        <span className="absolute left-0 top-1 h-5 w-5 rounded-full" style={{ backgroundColor: leftColor }} />
        <span
          className="absolute left-4 top-1 h-5 w-5 rounded-full mix-blend-multiply dark:mix-blend-screen"
          style={{ backgroundColor: rightColor }}
        />
      </div>
    )
  }

  if (brand === 'jcb') {
    return (
      <div
        className={cn('mt-0.5 grid h-7 w-10 shrink-0 grid-cols-3 overflow-hidden rounded-md shadow-sm', className)}
        aria-label={tAuto('jcb_49b7e31c')}
      >
        <span className="bg-[#0B5FA5]" />
        <span className="bg-[#1FA463]" />
        <span className="bg-[#D8232A]" />
      </div>
    )
  }

  if (brand === 'unionpay') {
    return (
      <div
        className={cn('mt-0.5 grid h-7 w-10 shrink-0 grid-cols-3 overflow-hidden rounded-md shadow-sm', className)}
        aria-label={tAuto('unionpay_e9bd8c8b')}
      >
        <span className="bg-[#D10429]" />
        <span className="bg-[#005BAC]" />
        <span className="bg-[#008B57]" />
      </div>
    )
  }

  const badge = getSingleBadgeStyle(brand)

  return (
    <div
      className={cn(
        'mt-0.5 flex h-7 w-10 shrink-0 items-center justify-center rounded-md border text-[9px] font-bold uppercase tracking-normal shadow-sm',
        badge.className,
        className,
      )}
      aria-label={brandLabels[brand]}
    >
      {badge.label ? badge.label : <CreditCard className="h-4 w-4" />}
    </div>
  )
}

export function getPaymentCardBrand(brand?: string | null): PaymentCardBrand {
  const normalized = brand?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''

  if (normalized === 'visa' || normalized.includes('visacard')) return 'visa'
  if (normalized.includes('mastercard') || normalized === 'mc') return 'mastercard'
  if (normalized.includes('americanexpress') || normalized.includes('amex')) return 'amex'
  if (normalized.includes('discover')) return 'discover'
  if (normalized.includes('diners')) return 'diners'
  if (normalized.includes('jcb')) return 'jcb'
  if (normalized.includes('unionpay') || normalized.includes('cup')) return 'unionpay'
  if (normalized.includes('maestro')) return 'maestro'
  if (normalized.includes('troy')) return 'troy'

  return 'unknown'
}

function getSingleBadgeStyle(brand: PaymentCardBrand): { label: string | null; className: string } {
  switch (brand) {
    case 'visa':
      return { label: 'VISA', className: 'border-[#1A1F71] bg-[#1A1F71] text-white' }
    case 'amex':
      return { label: 'AMEX', className: 'border-[#2E77BC] bg-[#2E77BC] text-white' }
    case 'discover':
      return {
        label: 'DISC',
        className: 'border-[#F29B2E] bg-[linear-gradient(135deg,#FDF2D8_0%,#F29B2E_100%)] text-[#3B2A12]',
      }
    case 'diners':
      return { label: 'DC', className: 'border-[#0079BE] bg-[#0079BE] text-white' }
    case 'troy':
      return { label: 'TROY', className: 'border-[#00A6B4] bg-[#00A6B4] text-white' }
    default:
      return { label: null, className: 'border-zinc-700 bg-zinc-900 text-zinc-100 dark:border-zinc-500 dark:bg-zinc-700' }
  }
}

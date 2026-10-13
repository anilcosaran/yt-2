'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, LoaderCircle, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  resolveCreditActionState,
  type CreditActionState,
  type CreditPrice,
} from '@/lib/billing/credit-price'
import { cn } from '@/lib/utils'

export { useAgentEstimate } from '@/components/billing/use-agent-estimate'
export type { CreditPrice, CreditActionState } from '@/lib/billing/credit-price'

export const ADD_CREDITS_HREF = '/settings/top-up'

export function upgradePlanHref(next: string) {
  return `/offer-plan?next=${encodeURIComponent(next)}`
}

/** The small price chip inside a primary action button (Tools look). */
export function CreditPill({
  label,
  pending = false,
  pendingLabel,
  className,
}: {
  label: string
  pending?: boolean
  pendingLabel: string
  className?: string
}) {
  return (
    <span
      data-credit-pill={pending ? 'pending' : 'ready'}
      className={cn('inline-flex h-6 items-center gap-1.5 rounded-sm bg-primary-foreground/15 px-2 text-xs font-semibold', className)}
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
      <span>{pending ? pendingLabel : label}</span>
    </span>
  )
}

/**
 * Layout frame shared by every priced action: `[leading] [✦ Label [pill]]` with a status line below.
 * Tools renders its own label/pill through this frame so both surfaces stay pixel-identical.
 */
export function CreditActionFrame({
  leading,
  icon,
  label,
  pill,
  status,
  statusId,
  statusClassName,
  hideEmptyStatus = false,
  disabled,
  title,
  onClick,
  type = 'button',
  className,
  buttonClassName,
  size = 'default',
  dataState,
}: {
  leading?: React.ReactNode
  icon: React.ReactNode
  label: React.ReactNode
  pill?: React.ReactNode
  status?: React.ReactNode
  statusId?: string
  statusClassName?: string
  hideEmptyStatus?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  buttonClassName?: string
  size?: 'default' | 'sm'
  dataState?: string
}) {
  const hasStatus = status !== null && status !== undefined && status !== false && status !== ''
  return (
    <div className={className} data-credit-action={dataState}>
      <div className="flex items-center gap-3">
        {leading}
        <Button
          type={type}
          className={cn(
            size === 'sm'
              ? 'h-9 justify-center rounded-xl px-3 text-sm font-semibold'
              : 'h-10 flex-1 justify-center rounded-xl text-sm font-semibold transition-transform hover:scale-[1.01]',
            buttonClassName,
          )}
          disabled={disabled}
          onClick={onClick}
          title={title}
          aria-describedby={hasStatus && statusId ? statusId : undefined}
        >
          {icon}
          {label}
          {pill}
        </Button>
      </div>
      {hasStatus || !hideEmptyStatus ? (
        <p
          id={statusId}
          role="status"
          className={cn('mt-2 min-h-5 text-sm text-muted-foreground', statusClassName)}
        >
          {hasStatus ? status : null}
        </p>
      ) : null}
    </div>
  )
}

export type CreditActionButtonProps = {
  label: string
  price: CreditPrice
  onClick?: () => void
  availableCredits?: number | null
  upgradeRequired?: boolean
  busy?: boolean
  busyLabel?: string
  /** Disable without a reason line (for example an empty prompt). */
  disabled?: boolean
  /** Never render the status line (the caller shows its own note). */
  hideStatus?: boolean
  /** Caller-specific reason the action cannot run (missing input, fair-use limit, ...). */
  blockedReason?: string | null
  /** Replaces the default "free" status line (for example "7/10 free avatars left this month"). */
  freeStatus?: string | null
  /** Extra note appended to the credit status line (for example the settle ceiling). */
  creditNote?: string | null
  upgradeStatus?: string | null
  upgradeHref?: string
  addCreditsHref?: string
  suggestUpgradeWhenInsufficient?: boolean
  onUpgrade?: () => void
  leading?: React.ReactNode
  className?: string
  buttonClassName?: string
  statusClassName?: string
  size?: 'default' | 'sm'
  /** Only render the status line when the action is blocked. */
  statusOnlyWhenBlocked?: boolean
  type?: 'button' | 'submit'
  id?: string
}

/**
 * Priced primary action (`✦ Create [Free]` / `✦ Create [59 credits]`) with the reason line below.
 * An unknown price never renders as 0 or Free: it shows a disabled "Calculating…" pill instead.
 */
export function CreditActionButton(props: CreditActionButtonProps) {
  const t = useTranslations('CreditAction')
  const generatedId = React.useId()
  const statusId = `${props.id ?? generatedId}-status`
  const state = resolveCreditActionState({
    price: props.price,
    availableCredits: props.availableCredits,
    upgradeRequired: props.upgradeRequired,
    busy: props.busy,
    blocked: Boolean(props.blockedReason) || Boolean(props.disabled),
    suggestUpgradeWhenInsufficient: props.suggestUpgradeWhenInsufficient,
  })
  const upgradeHref = props.upgradeHref ?? upgradePlanHref('/brand?section=avatars')
  const addCreditsHref = props.addCreditsHref ?? ADD_CREDITS_HREF

  if (state.block === 'upgrade') {
    return (
      <CreditActionFrame
        className={props.className}
        statusClassName={props.statusClassName}
        buttonClassName={props.buttonClassName}
        size={props.size}
        leading={props.leading}
        dataState="upgrade"
        statusId={statusId}
        icon={<ArrowUpRight className="size-4" />}
        label={t('upgradePlan')}
        status={props.upgradeStatus ?? t('statusUpgrade')}
        onClick={props.onUpgrade ?? (() => {
          if (typeof window !== 'undefined') window.location.assign(upgradeHref)
        })}
      />
    )
  }

  const pillLabel = formatCreditPillLabel(t, props.price)
  const status = resolveCreditStatus(t, state, props)
  const statusNode = status ? (
    <>
      {status}
      {state.showAddCredits ? (
        <>
          {' · '}
          <Link href={addCreditsHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('addCredits')}
          </Link>
        </>
      ) : null}
      {state.showUpgrade ? (
        <>
          {' · '}
          <Link href={upgradeHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('upgradeWithCredits')}
          </Link>
        </>
      ) : null}
    </>
  ) : null

  return (
    <CreditActionFrame
      className={props.className}
      statusClassName={cn((state.block === 'insufficient' || state.block === 'reserve') && 'text-foreground', props.statusClassName)}
      buttonClassName={props.buttonClassName}
      size={props.size}
      leading={props.leading}
      type={props.type}
      dataState={state.block ?? props.price.kind}
      statusId={statusId}
      hideEmptyStatus={props.statusOnlyWhenBlocked || props.hideStatus}
      disabled={state.disabled}
      title={props.label}
      onClick={props.onClick}
      icon={props.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      label={props.busy ? (props.busyLabel ?? t('busy')) : props.label}
      pill={props.busy ? null : (
        <CreditPill
          label={pillLabel}
          pending={props.price.kind === 'pending'}
          pendingLabel={t('pillPending')}
        />
      )}
      status={props.hideStatus || (props.statusOnlyWhenBlocked && !state.block) ? null : statusNode}
    />
  )
}

type CreditActionTranslator = (key: string, values?: Record<string, string | number>) => string

export function formatCreditPillLabel(t: CreditActionTranslator, price: CreditPrice) {
  if (price.kind === 'free') return t('pillFree')
  if (price.kind === 'credits') {
    return price.approximate
      ? t('pillCreditsApprox', { count: price.credits })
      : t('pillCredits', { count: price.credits })
  }
  if (price.kind === 'unavailable') return t('pillUnavailable')
  return t('pillPending')
}

function resolveCreditStatus(
  t: CreditActionTranslator,
  state: CreditActionState,
  props: CreditActionButtonProps,
): string | null {
  if (state.block === 'busy') return null
  if (state.block === 'pending') return t('statusPending')
  if (state.block === 'unavailable') return t('statusUnavailable')
  if (state.block === 'insufficient') {
    return t('statusInsufficient', {
      required: state.requiredCredits ?? 0,
      available: state.availableCredits ?? 0,
    })
  }
  if (state.block === 'reserve') {
    return t('statusReserve', {
      required: state.reserveCredits ?? 0,
      price: state.requiredCredits ?? 0,
      available: state.availableCredits ?? 0,
    })
  }
  if (state.block === 'blocked') return props.blockedReason ?? null
  if (props.price.kind === 'free') {
    if (props.freeStatus) return props.freeStatus
    const { remaining, limit } = props.price
    if (typeof remaining === 'number' && typeof limit === 'number' && limit > 0) {
      return t('statusFreeRemaining', { remaining, limit })
    }
    return t('statusFree')
  }
  if (props.price.kind === 'credits') {
    const base = state.availableCredits !== null
      ? t('statusCredits', { available: state.availableCredits })
      : t('statusCreditsUnknownBalance')
    return props.creditNote ? `${base} · ${props.creditNote}` : base
  }
  return null
}

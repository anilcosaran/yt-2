import type { BillingPeriod, PlanPackage, PlanPackagePeriod } from '@/lib/offer/api'

const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'yearly']

/**
 * Replaces locally expired catalog periods immediately, without waiting for a
 * network refresh. A known live default period is preferred; otherwise the
 * expired period is removed so a stale promo can never remain actionable.
 */
export function replaceExpiredPlanPeriodsWithDefaults(
  packages: PlanPackage[],
  defaultPackages: PlanPackage[],
  now = Date.now(),
): PlanPackage[] {
  const defaultsByPlan = new Map(defaultPackages.map((pkg) => [pkg.base_plan, pkg]))
  let changed = false

  const nextPackages = packages.map((pkg) => {
    const defaultPackage = defaultsByPlan.get(pkg.base_plan)
    const nextPeriods = { ...pkg.periods }
    let packageChanged = false

    for (const period of PERIODS) {
      const currentPeriod = pkg.periods[period]
      const nextPeriod = replaceExpiredPeriod(currentPeriod, defaultPackage?.periods[period] ?? null, now)
      if (nextPeriod !== currentPeriod) {
        nextPeriods[period] = nextPeriod
        packageChanged = true
      }
    }

    if (!packageChanged) return pkg
    changed = true
    return { ...pkg, periods: nextPeriods }
  })

  return changed ? nextPackages : packages
}

function replaceExpiredPeriod(
  currentPeriod: PlanPackagePeriod | null,
  defaultPeriod: PlanPackagePeriod | null,
  now: number,
): PlanPackagePeriod | null {
  if (!isExpiredPeriod(currentPeriod, now)) return currentPeriod
  if (
    defaultPeriod?.offer_kind === 'default'
    && !isExpiredPeriod(defaultPeriod, now)
    && isSellableCatalogPrice(defaultPeriod.pricing.discounted_price)
  ) {
    return defaultPeriod
  }
  return null
}

export function isSellableCatalogPrice(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0
}

export type CampaignInvalidVariant = 'invalid' | 'ended-new-offers' | 'ended'

export function packagesHaveLivePromo(packages: PlanPackage[]): boolean {
  return packages.some((pkg) =>
    PERIODS.some((period) => pkg.periods[period]?.offer_kind === 'promo'),
  )
}

export function resolveCampaignInvalidVariant(
  packages: PlanPackage[] | null | undefined,
): CampaignInvalidVariant {
  if (!packages) return 'invalid'
  return packagesHaveLivePromo(packages) ? 'ended-new-offers' : 'ended'
}

function isExpiredPeriod(period: PlanPackagePeriod | null, now: number): boolean {
  if (!period?.valid_until) return false
  const boundary = Date.parse(period.valid_until)
  return !Number.isFinite(boundary) || boundary <= now
}

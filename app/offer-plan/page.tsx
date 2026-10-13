import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { OfferPlanPage } from '@/components/offer-plan/offer-plan-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return { title: t('plansTitle'), description: t('plansDescription') }
}

export default async function Page() {
  const session = await getCurrentAuthSession({ cacheTtlMs: 0 })
  if (!session) redirect('/login?next=/offer-plan')
  const tenant = session.tenant as { email: string; onboarding_completed?: boolean }
  if (!tenant.onboarding_completed) redirect('/onboarding')

  return <OfferPlanPage billingEmail={tenant.email} />
}

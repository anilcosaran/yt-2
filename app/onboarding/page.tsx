import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { OnboardingPage } from '@/components/onboarding/onboarding-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('OnboardingMetadata')
  return { title: t('title'), description: t('description') }
}
export default async function Page() {
  const session = await getCurrentAuthSession({ cacheTtlMs: 0 })
  if (!session) redirect('/login?next=/onboarding')
  const tenant = session.tenant as { onboarding_completed?: boolean }
  if (tenant.onboarding_completed) redirect('/offer-plan')

  return <OnboardingPage />
}

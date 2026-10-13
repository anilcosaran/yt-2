import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { AccountProfileTenant } from '@/components/account/browser-account-client'
import { SettingsTopUpPage } from '@/components/settings/settings-top-up-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return { title: t('topUpTitle'), description: t('topUpDescription') }
}

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/settings/top-up')

  return <SettingsTopUpPage tenant={session.tenant as AccountProfileTenant} />
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { AccountProfileTenant } from '@/components/account/browser-account-client'
import { SettingsPage } from '@/components/settings'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return { title: t('settingsTitle'), description: t('settingsDescription') }
}

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/settings')

  return <SettingsPage tenant={session.tenant as AccountProfileTenant} />
}

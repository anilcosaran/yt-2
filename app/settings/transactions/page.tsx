import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { SettingsTransactionsPage } from '@/components/settings/settings-transactions-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return { title: t('transactionsTitle'), description: t('transactionsDescription') }
}

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/settings/transactions')

  return <SettingsTransactionsPage />
}

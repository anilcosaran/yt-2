import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { SimplePageShell } from '@/components/common/simple-page-shell'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function RecentPage() {
  const t = await getTranslations('SimplePages')
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/recent')

  return <SimplePageShell title={t('recentTitle')} emptyText={t('recentEmpty')} />
}

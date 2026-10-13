import { redirect } from 'next/navigation'

import { SparkProjectsPage } from '@/components/spark/spark-projects-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/spark')

  return <SparkProjectsPage />
}

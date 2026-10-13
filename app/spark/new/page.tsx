import { redirect } from 'next/navigation'

import { labViewFromQuery } from '@/components/spark/lab/lab-model'
import { SparkNewProjectPage } from '@/components/spark/spark-workspace-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type SparkNewProjectPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// "Yeni proje": the workspace on Sohbet before the project exists. `channel` is the channel it will be made in,
// with the first sentence; the rest of the query is the view (`labViewFromQuery`).
export default async function Page({ searchParams }: SparkNewProjectPageProps) {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/spark')

  const query = await searchParams
  const channel = Array.isArray(query.channel) ? query.channel[0] : query.channel
  return <SparkNewProjectPage channelId={channel ?? null} view={labViewFromQuery(query)} />
}

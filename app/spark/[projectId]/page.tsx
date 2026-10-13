import { redirect } from 'next/navigation'

import { labViewFromQuery } from '@/components/spark/lab/lab-model'
import { SparkWorkspacePage } from '@/components/spark/spark-workspace-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type SparkProjectPageProps = {
  params: Promise<{
    projectId: string
  }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// A Spark project opens in the workspace: Sohbet first, then Plan and Editör (`?v=`, read by `labViewFromQuery`).
export default async function Page({ params, searchParams }: SparkProjectPageProps) {
  const { projectId } = await params
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/spark/${encodeURIComponent(projectId)}`)

  return <SparkWorkspacePage key={projectId} projectId={projectId} view={labViewFromQuery(await searchParams)} />
}

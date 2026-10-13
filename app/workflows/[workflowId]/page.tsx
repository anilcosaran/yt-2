import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { WorkflowsPage, WorkflowsPageLoading } from '@/components/workflows/workflows-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type WorkflowDetailPageProps = {
  params: Promise<{
    workflowId: string
  }>
}

export default async function Page({ params }: WorkflowDetailPageProps) {
  const { workflowId } = await params
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/workflows/${encodeURIComponent(workflowId)}`)

  return (
    <Suspense fallback={<WorkflowsPageLoading />}>
      <WorkflowsPage />
    </Suspense>
  )
}

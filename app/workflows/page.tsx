import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { WorkflowsPage, WorkflowsPageLoading } from '@/components/workflows/workflows-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/workflows')

  return (
    <Suspense fallback={<WorkflowsPageLoading />}>
      <WorkflowsPage />
    </Suspense>
  )
}

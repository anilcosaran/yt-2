import * as React from 'react'
import { redirect } from 'next/navigation'

import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { LibraryPage } from '@/components/library/library-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/library')

  return (
    <React.Suspense fallback={<WorkspaceRouteLoading />}>
      <LibraryPage />
    </React.Suspense>
  )
}

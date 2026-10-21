import { redirect } from 'next/navigation'

import { NewTabPage } from '@/components/layout/new-tab-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

// The new tab's old address: "+" opens a new project straight away now, and a link here does the same.
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/new')

  return <NewTabPage />
}

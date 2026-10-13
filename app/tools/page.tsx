import { redirect } from 'next/navigation'

import { ToolsWorkspace } from '@/components/tools'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function ToolsPage() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/tools')

  return <ToolsWorkspace />
}

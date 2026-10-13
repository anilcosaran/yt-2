import { redirect } from 'next/navigation'

import { MemoryPage } from '@/components/memory/memory-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/memory')

  return <MemoryPage />
}

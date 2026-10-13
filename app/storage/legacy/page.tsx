import { redirect } from 'next/navigation'

import { StoragePage } from '@/components/storage/storage-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

/** The previous "Assets" screen, kept for comparison while the Library is designed. */
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/storage/legacy')

  return <StoragePage />
}

import { redirect } from 'next/navigation'

import { InboxPage as InboxExperience } from '@/components/inbox'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/inbox')

  return <InboxExperience />
}

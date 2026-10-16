import { redirect } from 'next/navigation'

import { CanvasPage } from '@/components/canvas'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/canvas')

  return <CanvasPage />
}

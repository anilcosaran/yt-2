import { redirect } from 'next/navigation'

import { MotionCommunityPage } from '@/components/motion/motion-community-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

/** E1-I Community Motions: buy once for the workspace, sell your own saved Motions (D3, QA-375). Signed-in users only. */
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/motion/community')

  return <MotionCommunityPage />
}

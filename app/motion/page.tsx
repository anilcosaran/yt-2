import { redirect } from 'next/navigation'

import { MotionLibraryPage } from '@/components/motion/motion-library-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

/** P06-02 Motion library: a screen of its own (KARAR-BEKLEYEN-MOTION-EDITORU), signed-in users only. */
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/motion')

  return <MotionLibraryPage />
}

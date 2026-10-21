import { redirect } from 'next/navigation'

import { CanvasListPage } from '@/components/canvas/canvas-list-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

// The user's canvases; each one opens as its own work tab (`/canvas/<canvasId>`).
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/canvas')

  return <CanvasListPage />
}

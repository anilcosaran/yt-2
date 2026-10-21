import { redirect } from 'next/navigation'

import { CanvasEditor } from '@/components/canvas/canvas-editor'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type CanvasPageProps = {
  params: Promise<{
    canvasId: string
  }>
}

// One canvas, in its work tab: the node canvas of Plan › Üretim on its own, without a plan.
export default async function Page({ params }: CanvasPageProps) {
  const { canvasId } = await params
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/canvas/${encodeURIComponent(canvasId)}`)

  return <CanvasEditor key={canvasId} canvasId={canvasId} />
}

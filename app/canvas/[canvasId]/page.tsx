import { redirect } from 'next/navigation'

import { CanvasPage } from '@/components/canvas'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type CanvasBoardPageProps = {
  params: Promise<{
    canvasId: string
  }>
}

export default async function Page({ params }: CanvasBoardPageProps) {
  const { canvasId } = await params
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/canvas/${encodeURIComponent(canvasId)}`)

  return <CanvasPage />
}

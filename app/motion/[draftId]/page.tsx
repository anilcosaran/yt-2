import { redirect } from 'next/navigation'

import { MotionEditorPage } from '@/components/motion/motion-editor-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type MotionDraftPageProps = {
  params: Promise<{
    draftId: string
  }>
}

/** P06-02 Motion authoring screen of one private draft (preview + Chat + parameters; the code panel opens on request). */
export default async function Page({ params }: MotionDraftPageProps) {
  const { draftId } = await params
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/motion/${encodeURIComponent(draftId)}`)

  return <MotionEditorPage key={draftId} draftId={draftId} />
}

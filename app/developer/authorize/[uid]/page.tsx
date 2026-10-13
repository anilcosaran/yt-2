import { redirect } from 'next/navigation'

import { DeveloperConsentPage } from '@/components/developer/developer-consent-page'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

type DeveloperAuthorizePageProps = {
  params: Promise<{ uid: string }>
  searchParams: Promise<{ error?: string }>
}

/** DEV-02 consent screen of the Developer Platform OAuth flow (the gateway's sign-in bridge sends the browser here). */
export default async function Page({ params, searchParams }: DeveloperAuthorizePageProps) {
  const { uid } = await params
  const { error } = await searchParams
  const session = await getCurrentAuthSession()
  if (!session) redirect(`/login?next=/developer/authorize/${encodeURIComponent(uid)}`)

  return <DeveloperConsentPage uid={uid} initialError={error === 'interaction_expired' ? error : null} />
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { PublicHome } from '@/components/public/public-home'
import { isOriginRecordingHost } from '@/lib/avatar/origin-host'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (isOriginRecordingHost(host)) {
    redirect('https://youtorch.io')
  }

  const session = await getCurrentAuthSession({ cacheTtlMs: 0 })

  if (session) {
    const tenant = session.tenant as { onboarding_completed?: boolean }
    if (!tenant.onboarding_completed) redirect('/onboarding')
    redirect('/dashboard')
  }

  return <PublicHome />
}

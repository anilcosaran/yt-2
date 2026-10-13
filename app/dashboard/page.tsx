import { redirect } from 'next/navigation'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/dashboard')

  const tenant = session.tenant as { onboarding_completed?: boolean }
  if (!tenant.onboarding_completed) redirect('/onboarding')

  return <HomeDashboard />
}

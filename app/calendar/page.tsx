import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CalendarPage } from '@/components/calendar/calendar-page'
import { RouteSpinner } from '@/components/common/route-spinner'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export const dynamic = 'force-dynamic'

// The channel's calendar: its videos only (published, scheduled, awaiting review) and the strong slots still empty.
// A page of the sidebar, never a work tab. `?date=` opens a day's week, `?item=` points at one video.
export default async function Page() {
  const session = await getCurrentAuthSession()
  if (!session) redirect('/login?next=/calendar')

  return (
    <Suspense fallback={<RouteSpinner />}>
      <CalendarPage />
    </Suspense>
  )
}

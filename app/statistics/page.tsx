import { redirect } from 'next/navigation'

export default function StatisticsPage() {
  redirect('/channels?view=statistics')
}

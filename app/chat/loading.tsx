import { RouteSpinner } from '@/components/common/route-spinner'

// The page that is coming is not a dashboard: no dashboard skeleton, only a spinner after a beat.
export default function Loading() {
  return <RouteSpinner />
}

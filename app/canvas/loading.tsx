import { RouteSpinner } from '@/components/common/route-spinner'

// Neither the list nor a canvas looks like a skeleton: only a spinner, after a beat.
export default function Loading() {
  return <RouteSpinner />
}

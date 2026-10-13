import type { Viewport } from 'next'

import { RecordingTokenPage } from '@/components/recording/recording-token-page'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default async function PublicRecordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <RecordingTokenPage token={token} />
}

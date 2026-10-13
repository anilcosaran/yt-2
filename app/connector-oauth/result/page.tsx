'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, CircleAlert } from 'lucide-react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { CONNECTOR_OAUTH_MESSAGE_TYPE } from '@/lib/connector/oauth-popup'

const SUCCESS_OUTCOMES = new Set(['awaiting_resource_selection', 'completed'])

/**
 * First-party page the Connector OAuth callback redirects the popup to (`CONNECTOR_OAUTH_RESULT_URL`). It only
 * forwards the opaque attempt id and the coarse outcome to the window that opened it (same origin only) and closes
 * itself; the opener reads the authenticated attempt state. No token, code or state ever reaches this page.
 */
function ConnectorOAuthResult() {
  const t = useTranslations('NewTheme')
  const params = useSearchParams()
  const attemptId = params.get('attempt_id')
  const outcome = params.get('outcome') ?? 'failed'
  const [forwarded, setForwarded] = React.useState(false)

  React.useEffect(() => {
    const opener = window.opener as Window | null
    if (!opener || opener.closed) return
    opener.postMessage({ type: CONNECTOR_OAUTH_MESSAGE_TYPE, attempt_id: attemptId, outcome }, window.location.origin)
    setForwarded(true)
    const timer = window.setTimeout(() => window.close(), 300)
    return () => window.clearTimeout(timer)
  }, [attemptId, outcome])

  const ok = SUCCESS_OUTCOMES.has(outcome)
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{ok ? <CheckCircle2 /> : <CircleAlert />}</EmptyMedia>
          <EmptyTitle>{ok ? t('connectorOAuthResult.okTitle') : t('connectorOAuthResult.failedTitle')}</EmptyTitle>
          <EmptyDescription>{forwarded ? t('connectorOAuthResult.closing') : t('connectorOAuthResult.closeManually')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}

export default function ConnectorOAuthResultPage() {
  return (
    <React.Suspense fallback={null}>
      <ConnectorOAuthResult />
    </React.Suspense>
  )
}

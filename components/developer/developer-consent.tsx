'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CircleAlert, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthClientError } from '@/lib/auth/errors'
import {
  allowDeveloperAuthorization,
  denyDeveloperAuthorization,
  developerAuthorizationQueryKey,
  developerSignInBridgeUrl,
  getDeveloperAuthorization,
  type DeveloperConsentResource,
} from '@/lib/developer/authorization'
import { scopeMessageKey } from '@/components/settings/developer/developer-settings-section'

/**
 * DEV-02 consent screen of the Developer Platform OAuth flow. Server state only (the pending request comes from the
 * gateway; nothing is stored in the browser). If the request is not yet bound to this signed-in user, the browser
 * goes once through the gateway's sign-in bridge (which proves it is the browser that started the flow). Allow/deny
 * follow only the authorization server's own resume URL. The resource picker slot is filled by DEV-03.
 */

export interface DeveloperConsentProps {
  uid: string
  initialError?: string | null
  /** DEV-03: typed resource picker for the requested resource kinds (returns the chosen exact selectors). */
  renderResourcePicker?: (input: { resourceKinds: string[]; onChange: (resources: DeveloperConsentResource[]) => void; disabled: boolean }) => React.ReactNode
  navigate?: (url: string) => void
}

function errorCode(error: unknown): { status: number; reason: string | null } {
  if (error instanceof AuthClientError) {
    // `details` is the gateway error context (reason_code, reason).
    const details = error.details as { reason_code?: unknown; reason?: unknown } | undefined
    const reason = typeof details?.reason === 'string' ? details.reason : typeof details?.reason_code === 'string' ? details.reason_code : null
    return { status: error.status, reason }
  }
  return { status: 0, reason: null }
}

function Notice({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><CircleAlert /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}

export function DeveloperConsent({ uid, initialError = null, renderResourcePicker, navigate = (url) => window.location.assign(url) }: DeveloperConsentProps) {
  const t = useTranslations('DeveloperConsent')
  const tSettings = useTranslations('Settings')
  const [resources, setResources] = React.useState<DeveloperConsentResource[]>([])
  const bridged = React.useRef(false)
  const query = useQuery({
    queryKey: developerAuthorizationQueryKey(uid),
    queryFn: ({ signal }) => getDeveloperAuthorization(uid, { signal }),
    enabled: !initialError,
    retry: false,
    staleTime: Infinity,
  })
  const failure = query.error ? errorCode(query.error) : null
  const needsBridge = failure?.status === 409 && failure.reason === 'interaction_not_bound'

  React.useEffect(() => {
    // Not yet bound: the gateway binds this browser's pending request to the session, then returns here.
    if (needsBridge && !bridged.current) {
      bridged.current = true
      navigate(developerSignInBridgeUrl(uid))
    }
  }, [needsBridge, navigate, uid])

  const allow = useMutation({ mutationFn: () => allowDeveloperAuthorization(uid, resources), onSuccess: navigate })
  const deny = useMutation({ mutationFn: () => denyDeveloperAuthorization(uid), onSuccess: navigate })
  const busy = allow.isPending || deny.isPending || allow.isSuccess || deny.isSuccess

  let body: React.ReactNode
  if (initialError === 'interaction_expired') {
    body = <Notice title={t('expired')} />
  } else if (query.isLoading || needsBridge) {
    body = (
      <div className="w-full max-w-md space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  } else if (query.isError || !query.data) {
    body = <Notice title={failure?.status === 404 ? t('notFound') : t('failed')} />
  } else {
    const request = query.data
    body = (
      <Card className="w-full max-w-md" data-testid="developer-consent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {request.environment === 'test' && <Badge variant="secondary">{t('testApp')}</Badge>}
          </div>
          <CardTitle>{t('title', { app: request.app.display_name })}</CardTitle>
          <CardDescription>
            {request.app.verified_domain}
            {request.app.privacy_url && (
              <>
                {' · '}
                <a className="underline" href={request.app.privacy_url} target="_blank" rel="noreferrer noopener">{t('privacy')}</a>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.app.purpose && <p className="text-sm text-muted-foreground">{request.app.purpose}</p>}
          <p className="text-sm text-foreground">{t('actsForYou')}</p>
          {request.mcp && (
            <p className="text-sm text-foreground" data-testid="developer-consent-mcp-caps">
              {t('mcpCaps', { perJob: request.mcp.caps.per_job_credits, monthly: request.mcp.caps.monthly_credits })}
            </p>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">{t('permissionsTitle')}</p>
            <ul className="space-y-1.5">
              {request.requested_scopes.map((entry) => (
                <li key={entry.scope} className="text-sm text-muted-foreground">• {tSettings(scopeMessageKey(entry.scope))}</li>
              ))}
            </ul>
          </div>
          {request.resource_kinds.length > 0 && renderResourcePicker?.({ resourceKinds: request.resource_kinds, onChange: setResources, disabled: busy })}
          <p className="text-xs text-muted-foreground">{t('boundary')}</p>
          {(allow.isError || deny.isError) && <p className="text-sm text-destructive" role="alert">{t('failed')}</p>}
          {(allow.isSuccess || deny.isSuccess) && <p className="text-sm text-muted-foreground" role="status">{t('redirecting')}</p>}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => deny.mutate()}>{t('deny')}</Button>
          <Button type="button" disabled={busy} onClick={() => allow.mutate()}>{t('allow')}</Button>
        </CardFooter>
      </Card>
    )
  }

  return <main className="flex min-h-screen items-center justify-center bg-background p-6">{body}</main>
}

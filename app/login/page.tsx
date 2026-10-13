import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { LoginPage } from '@/components/auth'
import { resolveSafeNextPath } from '@/lib/auth/redirect-path'
import { getCurrentAuthSession } from '@/lib/auth/server-session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('LoginMetadata')
  return { title: t('title'), description: t('description') }
}
type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function Page({ searchParams }: LoginPageProps) {
  const session = await getCurrentAuthSession({ cacheTtlMs: 0 })
  if (session) {
    const tenant = session.tenant as { onboarding_completed?: boolean }
    const { next } = await searchParams
    const nextPath = Array.isArray(next) ? next[0] ?? null : next ?? null
    redirect(tenant.onboarding_completed ? resolveSafeNextPath(nextPath) : '/onboarding')
  }

  return <LoginPage />
}

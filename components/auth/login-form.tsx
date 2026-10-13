'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Hand, Mail, MailCheck } from 'lucide-react'

import { AuthActionButton } from './auth-action-button'
import { useAuthMutations } from './auth-mutations'
import { AuthTextField } from './auth-text-field'
import { resolveSafeNextPath } from '@/lib/auth/redirect-path'
import { syncPreferredLocaleCookie } from '@/i18n/client-locale'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { getPlanPackages } from '@/lib/offer/api'

type LoginMethod = 'google' | 'email'
type LoginView = 'providers' | 'email' | 'register' | 'verify-email'

const LAST_USED_COOKIE = 'youtorch_last_login'

function readLastUsedMethod(): LoginMethod | null {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${LAST_USED_COOKIE}=`))
    ?.split('=')[1]

  return value === 'google' || value === 'email' ? value : null
}

function writeLastUsedMethod(method: LoginMethod) {
  document.cookie = `${LAST_USED_COOKIE}=${method}; Max-Age=31536000; Path=/; SameSite=Lax`
}

export function LoginForm() {
  const tAuto = useTranslations('Auto')
  const searchParams = useSearchParams()
  const [view, setView] = React.useState<LoginView>('providers')
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] =
    React.useState<string | null>(null)
  const [lastUsedMethod, setLastUsedMethod] =
    React.useState<LoginMethod | null>(null)

  const markLastUsedMethod = React.useCallback((method: LoginMethod) => {
    writeLastUsedMethod(method)
    setLastUsedMethod(method)
    setAuthError(null)
  }, [])

  const authMutations = useAuthMutations({
    onError: setAuthError,
    onAuthenticated: ({ tenant }) => {
      setAuthError(null)
      void (async () => {
        const destination = await resolvePostAuthPath(searchParams.get('next'), tenant)
        await syncPreferredLocaleCookie(tenant.preferred_locale).catch(() => undefined)
        window.location.assign(destination)
      })()
    },
    onLastUsed: markLastUsedMethod,
    onVerificationSent: (email) => {
      setPendingVerificationEmail(email)
      setAuthError(null)
      setView('verify-email')
    },
  })

  React.useEffect(() => {
    setLastUsedMethod(readLastUsedMethod())
  }, [])

  function handleGoogleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setAuthError(null)
    authMutations.googleLogin.mutate()
  }

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)

    const formData = new FormData(event.currentTarget)

    authMutations.emailLogin.mutate({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })
  }

  function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)

    const formData = new FormData(event.currentTarget)

    authMutations.emailRegister.mutate({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    })
  }

  return (
    <section className="flex min-h-svh items-center justify-center bg-background px-7 py-8 text-foreground sm:px-10 lg:h-svh lg:min-h-0 lg:px-0 lg:py-12">
      <div className="flex min-h-[calc(100svh-4rem)] w-full min-w-0 max-w-[300px] flex-col sm:max-w-[480px] lg:h-[calc(100svh-6rem)] lg:min-h-0 lg:max-w-[390px]">
        <p className="text-[26px] font-bold leading-none tracking-normal">
          <UiText id="youtorch_020aa912" /></p>

        <div className="mt-14 lg:mt-[86px]">
          {view === 'providers' && (
            <div
              key="providers"
              className="animate-in fade-in slide-in-from-left-2 duration-300 motion-reduce:animate-none"
            >
              <div className="mb-7 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Hand className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    <UiText id="login_or_sign_up_8f55d83b" /></p>
                  <h1 className="text-[29px] font-bold leading-tight tracking-normal">
                    <UiText id="welcome_back_7927e5de" /></h1>
                </div>
              </div>

              <div className="space-y-4">
                <AuthActionButton
                  badge={lastUsedMethod === 'google' ? tAuto('last_used_f1109d3d') : undefined}
                  disabled={authMutations.googleLogin.isPending}
                  selected={lastUsedMethod === 'google'}
                  tone="google"
                  onClick={handleGoogleClick}
                >
                  <UiText id="continue_with_google_ccc5b0ed" /></AuthActionButton>

                <AuthActionButton
                  badge={lastUsedMethod === 'email' ? tAuto('last_used_f1109d3d') : undefined}
                  icon={<Mail className="size-5 text-primary" />}
                  selected={lastUsedMethod === 'email'}
                  onClick={() => {
                    setAuthError(null)
                    setView('email')
                  }}
                >
                  <UiText id="continue_with_email_88001457" /></AuthActionButton>
              </div>

              {authError && (
                <p
                  role="alert"
                  className="mt-4 rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive"
                >
                  {authError}
                </p>
              )}

              <p className="mt-6 break-words text-[13px] font-medium leading-relaxed text-muted-foreground">
                <UiText id="by_clicking_continue_you_agree_to_our_0fe7e4a6" />{' '}
                <Link
                  href="/login"
                  className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  <UiText id="terms_of_service_0c8a9a95" /></Link>
                ,{' '}
                <Link
                  href="/login"
                  className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  <UiText id="privacy_policy_9db108ba" /></Link>{' '}
                and{' '}
                <Link
                  href="/login"
                  className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                >
                  <UiText id="cookie_policy_e6e178cc" /></Link>
                .
              </p>
            </div>
          )}

          {view === 'email' && (
            <div
              key="email"
              className="animate-in fade-in slide-in-from-right-3 duration-300 motion-reduce:animate-none"
            >
              <button
                type="button"
                onClick={() => {
                  setAuthError(null)
                  setView('providers')
                }}
                className="mb-7 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-4" />
                <UiText id="back_b52b36b7" /></button>

              <div className="mb-7">
                <p className="text-sm font-medium text-muted-foreground">
                  <UiText id="email_login_d8f0f389" /></p>
                <h1 className="mt-1 text-[29px] font-bold leading-tight tracking-normal">
                  <UiText id="sign_in_with_email_72c9a1f7" /></h1>
                <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted-foreground">
                  <UiText id="enter_your_email_and_password_to_continue_to_you_0bb02ad6" /></p>
              </div>

              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <AuthTextField
                  label={tAuto('email_84add5b2')}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={tAuto('email_84add5b2')}
                />
                <AuthTextField
                  label={tAuto('password_8be3c943')}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={tAuto('password_8be3c943')}
                />
                {authError && (
                  <p
                    role="alert"
                    className="rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive"
                  >
                    {authError}
                  </p>
                )}
                <AuthActionButton
                  disabled={authMutations.emailLogin.isPending}
                  tone="solid"
                  type="submit"
                >
                  {authMutations.emailLogin.isPending
                    ? tAuto('continuing_1c3a72af')
                    : tAuto('continue_2e026239')}
                </AuthActionButton>
              </form>

              <div className="mt-6 rounded-xl border border-border bg-muted/35 px-4 py-3 text-[13px] font-medium leading-relaxed text-muted-foreground dark:bg-card">
                <UiText id="don_t_have_an_account_f838dc11" />{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null)
                    setView('register')
                  }}
                  className="font-bold text-foreground underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <UiText id="register_with_email_8a6b9a79" /></button>
              </div>
            </div>
          )}

          {view === 'register' && (
            <div
              key="register"
              className="animate-in fade-in slide-in-from-right-3 duration-300 motion-reduce:animate-none"
            >
              <button
                type="button"
                onClick={() => {
                  setAuthError(null)
                  setView('email')
                }}
                className="mb-7 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-4" />
                <UiText id="back_b52b36b7" /></button>

              <div className="mb-7">
                <p className="text-sm font-medium text-muted-foreground">
                  <UiText id="email_register_c0af8038" /></p>
                <h1 className="mt-1 text-[29px] font-bold leading-tight tracking-normal">
                  <UiText id="create_your_account_4046b581" /></h1>
                <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted-foreground">
                  <UiText id="start_with_email_password_and_password_confirmat_855f8dc4" /></p>
              </div>

              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                <AuthTextField
                  label={tAuto('email_84add5b2')}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={tAuto('email_84add5b2')}
                />
                <AuthTextField
                  label={tAuto('password_8be3c943')}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={tAuto('password_8be3c943')}
                />
                <AuthTextField
                  label={tAuto('confirm_password_4a7c565d')}
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder={tAuto('confirm_password_4a7c565d')}
                />
                {authError && (
                  <p
                    role="alert"
                    className="rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive"
                  >
                    {authError}
                  </p>
                )}
                <AuthActionButton
                  disabled={authMutations.emailRegister.isPending}
                  tone="solid"
                  type="submit"
                >
                  {authMutations.emailRegister.isPending
                    ? tAuto('registering_7c765ce3')
                    : tAuto('register_with_email_8a6b9a79')}
                </AuthActionButton>
              </form>

              <div className="mt-6 rounded-xl border border-border bg-muted/35 px-4 py-3 text-[13px] font-medium leading-relaxed text-muted-foreground dark:bg-card">
                <UiText id="already_have_an_account_8559034a" />{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null)
                    setView('email')
                  }}
                  className="font-bold text-foreground underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <UiText id="sign_in_with_email_72c9a1f7" /></button>
              </div>
            </div>
          )}

          {view === 'verify-email' && (
            <div
              key="verify-email"
              className="animate-in fade-in slide-in-from-right-3 duration-300 motion-reduce:animate-none"
            >
              <button
                type="button"
                onClick={() => {
                  setAuthError(null)
                  setView('register')
                }}
                className="mb-7 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-4" />
                <UiText id="back_b52b36b7" /></button>

              <div className="mb-7 flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MailCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    <UiText id="email_verification_a674e88b" /></p>
                  <h1 className="mt-1 text-[29px] font-bold leading-tight tracking-normal">
                    <UiText id="check_your_inbox_48faa67c" /></h1>
                  <p className="mt-2 break-words text-[13px] font-medium leading-relaxed text-muted-foreground">
                    <UiText id="we_sent_a_verification_link_c61f747b" />{pendingVerificationEmail ? ` to ${pendingVerificationEmail}` : ''}.
                  </p>
                </div>
              </div>

              {authError && (
                <p
                  role="alert"
                  className="mb-4 rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive"
                >
                  {authError}
                </p>
              )}

              <div className="space-y-3">
                <AuthActionButton
                  disabled={authMutations.emailVerification.isPending}
                  tone="solid"
                  onClick={() => {
                    setAuthError(null)
                    authMutations.emailVerification.mutate()
                  }}
                >
                  {authMutations.emailVerification.isPending
                    ? tAuto('checking_494d0f68')
                    : tAuto('i_verified_my_email_f7c4e8c0')}
                </AuthActionButton>

                <AuthActionButton
                  disabled={authMutations.emailVerification.isPending}
                  icon={<Mail className="size-5 text-primary" />}
                  onClick={() => {
                    setAuthError(null)
                    setView('email')
                  }}
                >
                  <UiText id="sign_in_with_email_72c9a1f7" /></AuthActionButton>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-10 text-[13px] font-medium text-muted-foreground">
          <UiText id="need_help_97e2e9fd" />{' '}
          <Link
            href="/login"
            className="font-bold text-foreground underline underline-offset-2 hover:text-primary"
          >
            <UiText id="get_in_touch_c49bb4c2" /></Link>
        </div>
      </div>
    </section>
  )
}

async function resolvePostAuthPath(
  nextPath: string | null,
  tenant: { onboarding_completed?: boolean },
) {
  if (!tenant.onboarding_completed) return '/onboarding'
  const safeNext = resolveSafeNextPath(nextPath)
  if (!isBareHomePath(safeNext)) return safeNext
  try {
    const packages = await getPlanPackages()
    if (packages.data.gift_ended?.login_redirect) return '/offer-plan'
  } catch {
    return safeNext
  }
  return safeNext
}

function isBareHomePath(path: string) {
  return path === '/' || path.startsWith('/?')
}

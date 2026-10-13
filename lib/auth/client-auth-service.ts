'use client'

import { AuthClientError, isAuthClientError } from './errors'
import type { BrowserAuthGatewayClient } from './browser-gateway-client'
import type { Tenant } from './schemas'

export interface FirebaseUserLike {
  readonly email: string | null
  readonly emailVerified: boolean
  readonly photoURL?: string | null
  getIdToken(forceRefresh?: boolean): Promise<string>
  reload(): Promise<void>
}

export interface FirebaseAuthDriver {
  signInWithGoogle(): Promise<FirebaseUserLike>
  signInWithEmail(email: string, password: string): Promise<FirebaseUserLike>
  createEmailUser(email: string, password: string): Promise<FirebaseUserLike>
  sendEmailVerification(user: FirebaseUserLike): Promise<void>
  currentUser(): FirebaseUserLike | null
  signOut(): Promise<void>
}

export type AuthFlowResult =
  | { status: 'authenticated'; tenant: Tenant }
  | { status: 'verification_sent'; email: string }

interface AuthFlowDeps {
  auth: FirebaseAuthDriver
  gateway: BrowserAuthGatewayClient
  wait?: (ms: number) => Promise<void>
}

const DEFAULT_CLAIMS_RETRY_DELAYS_MS = [350, 900, 1600]

export async function signInWithGoogleFlow(deps: AuthFlowDeps): Promise<AuthFlowResult> {
  const user = await deps.auth.signInWithGoogle()
  const session = await createSessionForUser(deps, user, { autoRegister: true })
  return { status: 'authenticated', tenant: session.tenant }
}

export async function signInWithEmailFlow(
  deps: AuthFlowDeps,
  values: { email: string; password: string },
): Promise<AuthFlowResult> {
  const user = await deps.auth.signInWithEmail(values.email, values.password)

  if (!user.emailVerified) {
    await deps.auth.sendEmailVerification(user)
    await deps.auth.signOut()
    throw new AuthClientError(
      'EMAIL_NOT_VERIFIED',
      'Please verify your email. We sent a fresh verification link.',
      403,
    )
  }

  const session = await createSessionForUser(deps, user, { autoRegister: true })
  return { status: 'authenticated', tenant: session.tenant }
}

export async function registerWithEmailFlow(
  deps: AuthFlowDeps,
  values: { email: string; password: string },
): Promise<AuthFlowResult> {
  const user = await deps.auth.createEmailUser(values.email, values.password)

  if (!user.emailVerified) {
    await deps.auth.sendEmailVerification(user)
    return { status: 'verification_sent', email: values.email }
  }

  const session = await createSessionForUser(deps, user, { autoRegister: true })
  return { status: 'authenticated', tenant: session.tenant }
}

export async function completeEmailRegistrationFlow(deps: AuthFlowDeps): Promise<AuthFlowResult> {
  const user = deps.auth.currentUser()
  if (!user) {
    throw new AuthClientError('EMAIL_VERIFICATION_SESSION_EXPIRED', 'Please sign in again to finish registration.', 401)
  }

  await user.reload()
  if (!user.emailVerified) {
    throw new AuthClientError('EMAIL_NOT_VERIFIED', 'Email is not verified yet.', 403)
  }

  const session = await createSessionForUser(deps, user, { autoRegister: true })
  return { status: 'authenticated', tenant: session.tenant }
}

async function createSessionForUser(
  deps: AuthFlowDeps,
  user: FirebaseUserLike,
  options: { autoRegister: boolean },
): Promise<{ tenant: Tenant }> {
  const idToken = await user.getIdToken(false)

  try {
    const session = await deps.gateway.createSession(idToken)
    await deps.auth.signOut()
    return { tenant: session.data.tenant }
  } catch (error) {
    if (!options.autoRegister || !isRegisterBootstrapError(error)) throw error
  }

  try {
    await deps.gateway.register(idToken)
  } catch (error) {
    if (!isExistingTenantRegisterError(error)) throw error
  }

  const session = await createSessionWithFreshClaims(deps, user)
  await deps.auth.signOut()
  return { tenant: session.tenant }
}

async function createSessionWithFreshClaims(
  deps: AuthFlowDeps,
  user: FirebaseUserLike,
): Promise<{ tenant: Tenant }> {
  const wait = deps.wait ?? defaultWait
  const delays = [0, ...DEFAULT_CLAIMS_RETRY_DELAYS_MS]

  for (const delay of delays) {
    if (delay > 0) await wait(delay)
    const freshToken = await user.getIdToken(true)

    try {
      const session = await deps.gateway.createSession(freshToken, { requireOwnerClaim: true })
      return { tenant: session.data.tenant }
    } catch (error) {
      if (!isClaimsNotReady(error) || delay === delays[delays.length - 1]) throw error
    }
  }

  throw new AuthClientError('AUTH_CLAIMS_NOT_READY', 'Owner claims are not ready yet.', 409)
}

function isTenantNotFound(error: unknown) {
  return error instanceof AuthClientError && error.status === 404 && error.code === 'TENANT_NOT_FOUND'
}

function isClaimsNotReady(error: unknown) {
  return error instanceof AuthClientError && error.code === 'AUTH_CLAIMS_NOT_READY'
}

function isRegisterBootstrapError(error: unknown) {
  return isTenantNotFound(error) || isClaimsNotReady(error)
}

function isExistingTenantRegisterError(error: unknown) {
  return error instanceof AuthClientError && (
    error.code === 'TENANT_ALREADY_EXISTS' ||
    error.code === 'TENANT_PENDING_BILLING' ||
    error.code === 'TENANT_BILLING_FAILED'
  )
}

function defaultWait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

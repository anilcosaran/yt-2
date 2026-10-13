'use client'

import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { createBrowserAuthGatewayClient } from '@/lib/auth/browser-gateway-client'
import {
  AuthFlowResult,
  completeEmailRegistrationFlow,
  registerWithEmailFlow,
  signInWithEmailFlow,
  signInWithGoogleFlow,
} from '@/lib/auth/client-auth-service'
import { AuthClientError } from '@/lib/auth/errors'
import { createFirebaseAuthDriver } from '@/lib/auth/firebase-client'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { useTranslations } from 'next-intl'

const PASSWORDS_MISMATCH_ERROR_CODE = 'passwordsMismatch'

type LoginMethod = 'google' | 'email'

type UseAuthMutationsOptions = {
  onLastUsed: (method: LoginMethod) => void
  onError: (message: string) => void
  onAuthenticated: (result: Extract<AuthFlowResult, { status: 'authenticated' }>) => void
  onVerificationSent: (email: string) => void
}

export const emailLoginSchema = z.object({
  email: z.string().trim().email('invalidEmail'),
  password: z.string().min(1, 'passwordRequired'),
})

export const emailRegisterSchema = z
  .object({
    email: z.string().trim().email('invalidEmail'),
    password: z.string().min(8, 'passwordTooShort'),
    confirmPassword: z.string().min(1, 'confirmPassword'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORDS_MISMATCH_ERROR_CODE,
    path: ['confirmPassword'],
  })

type EmailLoginValues = z.infer<typeof emailLoginSchema>
type EmailRegisterValues = z.infer<typeof emailRegisterSchema>

export function useAuthMutations({
  onError,
  onAuthenticated,
  onLastUsed,
  onVerificationSent,
}: UseAuthMutationsOptions) {
  const tErrors = useTranslations('AuthErrors')
  const localizeError = useLocalizedError()
  const getErrorMessage = (error: unknown) => {
    if (error instanceof z.ZodError) {
      const key = error.issues[0]?.message
      return key && ['invalidEmail', 'passwordRequired', 'passwordTooShort', 'confirmPassword', 'passwordsMismatch'].includes(key)
        ? tErrors(key as 'invalidEmail')
        : tErrors('checkForm')
    }
    if (error instanceof AuthClientError) return localizeError(error)
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
    if (code === 'auth/popup-closed-by-user') return tErrors('googleCancelled')
    if (code === 'auth/email-already-in-use') return tErrors('emailInUse')
    if (code === 'auth/invalid-credential') return tErrors('invalidCredentials')
    if (code === 'auth/too-many-requests') return tErrors('tooManyAttempts')
    if (code === 'auth/popup-blocked') return tErrors('popupBlocked')
    return tErrors('generic')
  }
  const deps = {
    auth: createFirebaseAuthDriver(),
    gateway: createBrowserAuthGatewayClient(),
  }

  function handleAuthSuccess(method: LoginMethod, result: AuthFlowResult) {
    onLastUsed(method)
    if (result.status === 'authenticated') {
      onAuthenticated(result)
      return
    }
    onVerificationSent(result.email)
  }

  const googleLogin = useMutation({
    mutationKey: ['auth', 'google-login'],
    mutationFn: () => signInWithGoogleFlow(deps),
    onError: (error) => onError(getErrorMessage(error)),
    onSuccess: (result) => handleAuthSuccess('google', result),
  })

  const emailLogin = useMutation({
    mutationKey: ['auth', 'email-login'],
    mutationFn: (values: EmailLoginValues) =>
      signInWithEmailFlow(deps, emailLoginSchema.parse(values)),
    onError: (error) => onError(getErrorMessage(error)),
    onSuccess: (result) => handleAuthSuccess('email', result),
  })

  const emailRegister = useMutation({
    mutationKey: ['auth', 'email-register'],
    mutationFn: (values: EmailRegisterValues) =>
      registerWithEmailFlow(deps, emailRegisterSchema.parse(values)),
    onError: (error) => onError(getErrorMessage(error)),
    onSuccess: (result) => handleAuthSuccess('email', result),
  })

  const emailVerification = useMutation({
    mutationKey: ['auth', 'email-verification'],
    mutationFn: () => completeEmailRegistrationFlow(deps),
    onError: (error) => onError(getErrorMessage(error)),
    onSuccess: (result) => handleAuthSuccess('email', result),
  })

  return {
    emailLogin,
    emailRegister,
    emailVerification,
    googleLogin,
  }
}

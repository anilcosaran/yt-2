export const errorTranslationKeys = [
  'authClaimsNotReady',
  'channelLimitExceeded',
  'channelLastWorkspaceDeleteForbidden',
  'channelNotConnected',
  'channelReadOnly',
  'channelWorkspaceNotReady',
  'conflict',
  'emailNotVerified',
  'forbidden',
  'generic',
  'insufficientBalance',
  'invalidInput',
  'malwareDetected',
  'network',
  'notFound',
  'paymentMethodRequired',
  'paymentRequired',
  'quotaExceeded',
  'recentSignInRequired',
  'serviceUnavailable',
  'storageLimitExceeded',
  'storageRestricted',
  'timeout',
  'tooManyRequests',
  'topUpPaymentFailed',
  'topUpRequestNotFound',
  'unauthorized',
  'unsupportedFileType',
  'uploadNotReady',
] as const

export type ErrorTranslationKey = (typeof errorTranslationKeys)[number]

const exactErrorKeys: Record<string, ErrorTranslationKey> = {
  AUTH_CLAIMS_NOT_READY: 'authClaimsNotReady',
  AUTH_REQUEST_FAILED: 'unauthorized',
  CHANNEL_LIMIT_EXCEEDED: 'channelLimitExceeded',
  CHANNEL_LAST_WORKSPACE_DELETE_FORBIDDEN: 'channelLastWorkspaceDeleteForbidden',
  CHANNEL_NOT_CONNECTED: 'channelNotConnected',
  CHANNEL_READONLY: 'channelReadOnly',
  CHANNEL_WORKSPACE_NOT_READY: 'channelWorkspaceNotReady',
  CSRF_INVALID: 'recentSignInRequired',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  EMAIL_REQUIRED_IN_TOKEN: 'unauthorized',
  FORBIDDEN: 'forbidden',
  GATEWAY_NETWORK_ERROR: 'network',
  GATEWAY_REQUEST_TIMEOUT: 'timeout',
  INSUFFICIENT_BALANCE: 'insufficientBalance',
  INTERNAL_ERROR: 'generic',
  INVALID_TOKEN: 'unauthorized',
  NOT_FOUND: 'notFound',
  PAYMENT_METHOD_REQUIRED: 'paymentMethodRequired',
  PURCHASE_PAYMENT_METHOD_REQUIRED: 'paymentMethodRequired',
  PAYMENT_REQUIRED: 'paymentRequired',
  RECENT_SIGN_IN_REQUIRED: 'recentSignInRequired',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  STORAGE_HARD_LIMIT_EXCEEDED: 'storageLimitExceeded',
  STORAGE_IO_LIMIT_EXCEEDED: 'storageLimitExceeded',
  STORAGE_MALWARE_DETECTED: 'malwareDetected',
  STORAGE_SPACE_RESTRICTED: 'storageRestricted',
  STORAGE_UNSUPPORTED_FILE_TYPE: 'unsupportedFileType',
  STORAGE_UPLOAD_DISABLED: 'storageRestricted',
  STORAGE_UPLOAD_NOT_READY_FOR_FINALIZE: 'uploadNotReady',
  STORAGE_UPLOAD_SIZE_EXCEEDED: 'storageLimitExceeded',
  TOKEN_REVOKED: 'unauthorized',
  TOO_MANY_REQUESTS: 'tooManyRequests',
  TOPUP_PAYMENT_FAILED: 'topUpPaymentFailed',
  TOPUP_REQUEST_NOT_FOUND: 'topUpRequestNotFound',
  UNAUTHORIZED: 'unauthorized',
  VALIDATION_ERROR: 'invalidInput',
}

export function getErrorTranslationKey(error: unknown): ErrorTranslationKey {
  const code = getErrorCode(error)
  if (!code) return 'generic'
  const exact = exactErrorKeys[code]
  if (exact) return exact
  if (code.endsWith('_NOT_FOUND')) return 'notFound'
  if (code.includes('PAYMENT_METHOD_REQUIRED')) return 'paymentMethodRequired'
  if (code.includes('PAYMENT_REQUIRED') || code.includes('PAYMENT_FAILED')) return 'paymentRequired'
  if (code.includes('INSUFFICIENT_BALANCE')) return 'insufficientBalance'
  if (code.includes('QUOTA_EXCEEDED')) return 'quotaExceeded'
  if (code.includes('LIMIT_EXCEEDED') || code.includes('CAPACITY_EXCEEDED')) return 'quotaExceeded'
  if (code.includes('CONCURRENCY_EXCEEDED')) return 'quotaExceeded'
  if (code.includes('CONFLICT') || code.endsWith('_ALREADY_EXISTS')) return 'conflict'
  if (code.includes('INVALID') || code.includes('MISMATCH')) return 'invalidInput'
  if (code.includes('UNAVAILABLE') || code.includes('PROVIDER_ERROR')) return 'serviceUnavailable'
  if (code.includes('FORBIDDEN') || code.includes('INSUFFICIENT_ROLE')) return 'forbidden'
  return 'generic'
}

export function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : null
}

import { gatewayErrorSchema } from './schemas'
import { publicCatalogText, sanitizePublicMetadata } from '@/lib/public-model-display'
import { publicRuntimeErrorMessage, publicRuntimeErrorMessageForError } from '@/lib/public-runtime-error'

export class AuthClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
    readonly details?: unknown,
    readonly publicErrorCode?: string,
  ) {
    super(message)
    this.name = 'AuthClientError'
  }
}

export function isAuthClientError(error: unknown): error is AuthClientError {
  return error instanceof AuthClientError
}

export async function parseAuthErrorResponse(response: Response) {
  const fallbackMessage = getFallbackGatewayErrorMessage(response.status)

  try {
    const payload = await response.json()
    const parsed = gatewayErrorSchema.safeParse(payload)
    if (parsed.success) {
      const publicCode = parsed.data.error.public_error_code ?? publicErrorCodeFromContext(parsed.data.error.context)
      const rawMessage = parsed.data.error.message
      const message = publicCode
        ? publicRuntimeErrorMessage(publicCode)
        : response.status >= 500 || isPrivateRuntimeErrorText(rawMessage)
          ? publicRuntimeErrorMessageForError(rawMessage, fallbackMessage)
          : rawMessage
      return new AuthClientError(
        parsed.data.error.code,
        message,
        response.status,
        publicGatewayErrorDetails(parsed.data.error.details ?? parsed.data.error.context),
        publicCode,
      )
    }
  } catch {
    // Keep the browser-facing message stable even if the server response is malformed.
  }

  return new AuthClientError('AUTH_REQUEST_FAILED', fallbackMessage, response.status)
}

function publicErrorCodeFromContext(context: unknown): string | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined
  const candidate = (context as { public_error_code?: unknown }).public_error_code
  return typeof candidate === 'string' && /^E\d{4}$/.test(candidate) ? candidate : undefined
}

function getFallbackGatewayErrorMessage(status: number) {
  if (status === 404) return 'Requested resource was not found.'
  if (status === 429) return 'Rate limit exceeded. Please retry shortly.'
  if (status >= 500) return 'Authentication service is unavailable.'
  return 'Authentication failed.'
}

export function getSafeAuthMessage(error: unknown) {
  if (error instanceof AuthClientError && !isPrivateRuntimeErrorText(error.message)) return error.message
  if (error instanceof Error) return publicRuntimeErrorMessageForError(error, 'Something went wrong.')
  return 'Something went wrong.'
}

function isPrivateRuntimeErrorText(value: string): boolean {
  return !publicCatalogText(value) || /\b(?:provider|supplier|runtime|backend|firebase|redis)\b/i.test(value)
}

function publicGatewayErrorDetails(value: unknown): unknown {
  const sanitized = sanitizePublicMetadata(value)
  const visit = (child: unknown, errorText = false): unknown => {
    if (typeof child === 'string') {
      return errorText && isPrivateRuntimeErrorText(child)
        ? publicRuntimeErrorMessageForError(child, 'Check the required inputs and try again.')
        : child
    }
    if (Array.isArray(child)) return child.map((item) => visit(item, errorText))
    if (!child || typeof child !== 'object') return child
    return Object.fromEntries(Object.entries(child).map(([key, nested]) => [key, visit(nested, /^(?:errors?|issues?|message|error_message|reason)$/i.test(key))]))
  }
  return visit(sanitized)
}

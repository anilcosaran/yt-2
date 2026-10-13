export const PUBLIC_RECORDING_TOKEN_PATTERN = /^[a-fA-F0-9]{64}$/

export function isOriginRecordingHost(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader ?? '')
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0]
  return host === 'origin.youtorch.io' || host === 'origin.dev.youtorch.ai'
}

export function isPublicRecordingToken(token: string | null | undefined): boolean {
  return PUBLIC_RECORDING_TOKEN_PATTERN.test((token ?? '').trim())
}

export function getPublicRecordingApiBaseUrl(apiBaseUrl: string, hostHeader?: string | null): string {
  const host = hostHeader ?? (typeof window === 'undefined' ? null : window.location.host)
  if (isOriginRecordingHost(host)) return ''
  return apiBaseUrl.replace(/\/+$/, '')
}

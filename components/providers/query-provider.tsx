'use client'

// yt-2: installs the offline network stand-ins before any component can fetch.
import '@/mock/network-shim'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

type QueryProviderProps = {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
            staleTime: 2 * 60_000,
            gcTime: 30 * 60_000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  const status = getErrorStatus(error)
  if (status && (status < 500 || status === 429)) return false
  return failureCount < 1
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = Number((error as { status: unknown }).status)
  return Number.isFinite(status) ? status : null
}

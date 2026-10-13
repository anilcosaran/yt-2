'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { publicRuntimeErrorKeys, toPublicRuntimeError } from '@/lib/public-runtime-error'

export function useLocalizedRuntimeError() {
  const tErrors = useTranslations('RuntimeErrors')

  return React.useCallback((value: unknown) => {
    const raw = typeof value === 'string' ? value : ''
    const publicError = toPublicRuntimeError(raw)
    const code = publicError?.code ?? 'E3100'
    const message = tErrors(publicRuntimeErrorKeys[code as keyof typeof publicRuntimeErrorKeys] ?? 'generic', { code })
    const normalized = raw.toLowerCase()

    if (normalized.startsWith('transcript step failed')) {
      return tErrors('transcriptStep', { message })
    }
    if (normalized.startsWith('translation step failed')) {
      return tErrors('translationStep', { message })
    }
    if (normalized.startsWith('caption render failed')) {
      return tErrors('captionStep', { message })
    }
    return message
  }, [tErrors])
}

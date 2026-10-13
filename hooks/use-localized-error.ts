'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { getErrorTranslationKey, type ErrorTranslationKey } from '@/i18n/error-codes'

export function useLocalizedError() {
  const tErrors = useTranslations('Errors')

  return React.useCallback((error: unknown, fallbackKey?: ErrorTranslationKey) => {
    const key = getErrorTranslationKey(error)
    return tErrors(key === 'generic' && fallbackKey ? fallbackKey : key)
  }, [tErrors])
}

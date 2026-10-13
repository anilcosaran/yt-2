'use client'

import type { TranslationValues } from 'next-intl'
import { useTranslations } from 'next-intl'

export function UiText({
  id,
  values,
}: {
  id: string
  values?: TranslationValues
}) {
  const t = useTranslations('Auto')
  return t(id, values)
}

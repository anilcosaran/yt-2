'use client'

import type { AbstractIntlMessages } from 'next-intl'
import { NextIntlClientProvider } from 'next-intl'

import { appFormats } from '@/i18n/formats'
import type { AppLocale } from '@/i18n/config'

export function IntlProvider({
  children,
  locale,
  messages,
  now,
}: {
  children: React.ReactNode
  locale: AppLocale
  messages: AbstractIntlMessages
  now: Date
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={appFormats}
      now={now}
      timeZone="UTC"
      getMessageFallback={() => 'Not found'}
    >
      {children}
    </NextIntlClientProvider>
  )
}

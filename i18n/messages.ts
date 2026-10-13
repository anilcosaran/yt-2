import type { AbstractIntlMessages } from 'next-intl'

import en from '@/messages/en.json'
import tr from '@/messages/tr.json'

import type { AppLocale } from './config'
import { mergeMessageFragments } from './merge-message-fragments.mjs'
import { messageFragments } from './message-fragments.generated'

// messages/<locale>.json plus the per-namespace fragments in messages/<locale>/*.json.
const english = withFragments('en', en)

const messagesByLocale: Record<AppLocale, AbstractIntlMessages> = {
  en: english,
  tr: mergeMessages(english, withFragments('tr', tr)),
}

export function getMessagesForLocale(locale: AppLocale): AbstractIntlMessages {
  return messagesByLocale[locale]
}

function withFragments(locale: AppLocale, messages: AbstractIntlMessages): AbstractIntlMessages {
  return mergeMessageFragments(messages as never, (messageFragments[locale] ?? []) as never) as AbstractIntlMessages
}

function mergeMessages(
  fallback: AbstractIntlMessages,
  messages: AbstractIntlMessages,
): AbstractIntlMessages {
  const merged: AbstractIntlMessages = { ...fallback }

  for (const [key, value] of Object.entries(messages)) {
    const fallbackValue = fallback[key]
    merged[key] = isMessageObject(fallbackValue) && isMessageObject(value)
      ? mergeMessages(fallbackValue, value)
      : value
  }

  return merged
}

function isMessageObject(value: unknown): value is AbstractIntlMessages {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

import type { Formats } from 'next-intl'

export const appFormats = {
  dateTime: {
    short: {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
    long: {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  },
  number: {
    compact: {
      notation: 'compact',
      maximumFractionDigits: 1,
    },
    decimal: {
      maximumFractionDigits: 2,
    },
  },
} satisfies Formats

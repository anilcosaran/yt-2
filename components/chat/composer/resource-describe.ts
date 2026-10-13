'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import type { ComposerResourceCandidate } from '@/lib/assistant/composer/resource-mentions'

const DETAIL_TOKEN_KEYS: Record<string, string> = {
  image: 'typedComposer.mediaKinds.image',
  video: 'typedComposer.mediaKinds.video',
  audio: 'typedComposer.mediaKinds.audio',
  document: 'typedComposer.mediaKinds.document',
  other: 'typedComposer.mediaKinds.other',
  human_clone: 'typedComposer.origins.human_clone',
  digital_human: 'typedComposer.origins.digital_human',
  public_template: 'typedComposer.origins.public_template',
  stock: 'typedComposer.origins.stock',
  instant_clone: 'typedComposer.origins.instant_clone',
  professional_clone: 'typedComposer.origins.professional_clone',
  designed: 'typedComposer.origins.designed',
  localized: 'typedComposer.origins.localized',
}

/**
 * P03-02 menu row text of a resource candidate: its kind and owner facts, plus the last update when another
 * candidate has the same name (alias ambiguity is shown, never guessed).
 */
export function useComposerResourceDescribe(): (candidate: ComposerResourceCandidate) => string {
  const t = useTranslations('Chat')
  const locale = useLocale()
  return React.useCallback((candidate: ComposerResourceCandidate) => {
    const parts = [t(`typedComposer.resourceKinds.${candidate.resource_kind}`)]
    for (const token of (candidate.detail ?? '').split(' · ').map((value) => value.trim()).filter(Boolean)) {
      const revision = /^r(\d+)$/u.exec(token)
      if (revision) parts.push(t('typedComposer.revision', { number: Number(revision[1]) }))
      else if (DETAIL_TOKEN_KEYS[token]) parts.push(t(DETAIL_TOKEN_KEYS[token]))
      else parts.push(token.toUpperCase().length <= 3 ? token.toUpperCase() : token)
    }
    if (candidate.ambiguous_label && candidate.updated_at) {
      const date = new Date(candidate.updated_at)
      if (!Number.isNaN(date.getTime())) {
        parts.push(t('typedComposer.updatedOn', {
          date: date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        }))
      }
    }
    return parts.join(' · ')
  }, [locale, t])
}

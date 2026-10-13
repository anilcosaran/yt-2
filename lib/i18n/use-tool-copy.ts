'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { TOOL_COPY_KEYS } from '@/lib/i18n/tool-copy.generated'

type TranslationValues = Record<string, string | number>
type AutoTranslator = (key: string, values?: TranslationValues) => string
type ToolCopy = {
  (value: string): string
  (value: null): null
  (value: undefined): undefined
  (value: string | null | undefined): string | null | undefined
}

export function useToolCopy() {
  const translate = useTranslations('Auto') as unknown as AutoTranslator

  return React.useCallback((value: string | null | undefined) => {
    if (value == null) return value
    const key = TOOL_COPY_KEYS[value]
    if (key) return translate(key)

    const category = value.match(/^(.+) araclari\.$/)
    if (category) return translate('category_tools', { category: category[1] })

    const downloaded = value.match(/^Downloaded (video|audio)(?: (\d+))?$/)
    if (downloaded) {
      const kind = translate('media_kind', { kind: downloaded[1] })
      return downloaded[2]
        ? translate('downloaded_media_number', { kind, number: Number(downloaded[2]) })
        : translate('downloaded_media', { kind })
    }

    const frame = value.match(/^Frame (\d+)$/)
    if (frame) return translate('frame_number', { number: Number(frame[1]) })

    const viralClip = value.match(/^(?:Viral|Magic) Clip (\d+)$/)
    if (viralClip) return translate('viral_clip_number', { number: Number(viralClip[1]) })

    const renderingProgress = value.match(/^Rendering (\d+)%$/)
    if (renderingProgress) {
      return translate('viral_clips_rendering_progress', { progress: Number(renderingProgress[1]) })
    }

    const run = value.match(/^Run (\d+)$/)
    if (run) return translate('run_number', { number: Number(run[1]) })

    const voice = value.match(/^Voice ([A-Za-z0-9._-]+)$/)
    if (voice) return translate('voice_identifier', { id: voice[1] })

    return value
  }, [translate]) as ToolCopy
}

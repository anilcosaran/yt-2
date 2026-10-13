'use client'

import { useTranslations } from 'next-intl'

import { chatPathForConversation } from '@/lib/spark/open-in-chat'

import { StudioIcon } from './studio-icon'

/**
 * Y1-07 W9: the editor header's "Open in Chat" (design `.btn.ghost.sm` with the `chat` icon). Enabled once the project
 * has a linked chat; before the first message there is nothing to open and the button says so instead of vanishing.
 */
export function SparkOpenInChat({ conversationId, onOpen }: { conversationId: string | null; onOpen: (path: string) => void }) {
  const t = useTranslations('Spark.editor.openInChat')
  const path = chatPathForConversation(conversationId)
  return (
    <button
      type="button"
      className="btn ghost sm"
      disabled={path === null}
      title={path === null ? t('none') : t('title')}
      aria-label={t('label')}
      data-open-in-chat={path ?? undefined}
      onClick={() => {
        if (path) onOpen(path)
      }}
    >
      <StudioIcon name="chat" />
      {t('label')}
    </button>
  )
}

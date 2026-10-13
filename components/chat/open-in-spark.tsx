'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  chatResultArtifactRefs,
  chatResultEntryRequest,
  sparkIntentForChatMessage,
  startSparkEntry,
} from '@/lib/spark/spark-entry'
import { markSparkOpenRequested } from '@/lib/spark/spark-open-timing'

type ChatResultMessage = Parameters<typeof chatResultArtifactRefs>[0]

/** True when an assistant result carries Storage media that Spark can open (video, image or audio). */
export function hasSparkOpenableResult(message: ChatResultMessage): boolean {
  return chatResultArtifactRefs(message).some((ref) => ref.kind !== 'other')
}

/**
 * P03-11/P03-07/P03-13 "Open in Spark" on a chat result. The click is an explicit foreground request: the
 * server entry creates (or, for the same message, resolves) the persistent draft and binds the exact refs;
 * as soon as the server says the project is openable the editor opens on it, even while the media is still
 * being prepared. Nothing is stored in the browser.
 */
export function useOpenChatResultInSpark(options: { activeChannelId: string | null }) {
  const router = useRouter()
  const t = useTranslations('Chat')
  const [pendingMessageId, setPendingMessageId] = React.useState<string | null>(null)
  const { activeChannelId } = options

  const open = React.useCallback(async (message: ChatResultMessage) => {
    const refs = chatResultArtifactRefs(message)
    const request = chatResultEntryRequest({
      refs,
      creationIntentId: await sparkIntentForChatMessage(message.id),
      fallbackChannelId: activeChannelId,
      fallbackTitle: t('sparkEntry.defaultTitle'),
    })
    if (!request) {
      toast.error(t('sparkEntry.nothingToOpen'))
      return
    }
    setPendingMessageId(message.id)
    markSparkOpenRequested()
    try {
      const descriptor = await startSparkEntry(request)
      if (descriptor.openable && descriptor.project) {
        if (descriptor.status === 'partial') toast.warning(t('sparkEntry.partial'))
        router.push(descriptor.project.open_path)
        return
      }
      toast.error(t(descriptor.status === 'failed' ? 'sparkEntry.failed' : 'sparkEntry.notOpenable'))
    } catch {
      toast.error(t('sparkEntry.failed'))
    } finally {
      setPendingMessageId(null)
    }
  }, [activeChannelId, router, t])

  return { open, pendingMessageId }
}

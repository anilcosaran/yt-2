'use client'

import * as React from 'react'

import { Icon } from './studio-parts'

/** A notice a tool raised through `SparkToolContext.toast`: a translated sentence, shown like the design's notice. */
export type ToolNotice = { id: number; text: string; tone: 'ok' | 'error' }

// The design shows a notice for 2.2 s; a tool's notice is a sentence, so it stays a little longer.
const TOOL_NOTICE_MS = 4000

/** The design's notice (`.toast`) for what a tool reports (a video trimmed to its scene, a refused file, ...). */
export function ToolToast({ notice }: { notice: ToolNotice | null }) {
  const [hiddenId, setHiddenId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setHiddenId(notice.id), TOOL_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const show = notice !== null && hiddenId !== notice.id
  return (
    <div className={`toast${show ? ' show' : ''}`} role={notice?.tone === 'error' ? 'alert' : 'status'} aria-live="polite" data-tool-toast>
      <Icon name={notice?.tone === 'error' ? 'x' : 'check'} />
      <span>{notice?.text ?? ''}</span>
    </div>
  )
}

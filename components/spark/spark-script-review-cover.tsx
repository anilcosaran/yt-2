'use client'

import * as React from 'react'

import { useScriptReviewHostInternal } from '@/components/chat/script-review/script-review-host'
import { ScriptReviewSurface } from '@/components/chat/script-review/script-review-surface'

/**
 * P03-20 Spark host (KARAR-MINIMAL-SPARK "Script inceleme istisnası", 8A): "Script'i aç" temporarily covers the
 * editor's preview + timeline area (`.center`) with the design's plan page (`.plan`, absolute over `.center`), while
 * the chat stays visible. The preview and timeline stay mounted underneath (inert while covered), so selection,
 * zoom, scroll and the working copy are exactly as they were when the cover closes. Nothing is added to the
 * timeline and no production starts. The editor has no playback yet (its play control is disabled), so there is
 * nothing to pause.
 */
export function SparkScriptReviewCover() {
  const host = useScriptReviewHostInternal()
  const target = host?.target ?? null
  const anchorRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const anchor = anchorRef.current
    const center = anchor?.parentElement
    if (!target || !anchor || !center) return undefined
    const covered = Array.from(center.children).filter((element) => element !== anchor && !element.hasAttribute('data-script-review-cover'))
    for (const element of covered) element.setAttribute('inert', '')
    return () => {
      for (const element of covered) element.removeAttribute('inert')
    }
  }, [target])

  return (
    <>
      <span ref={anchorRef} hidden />
      {target ? (
        <div data-script-review-cover="" style={{ display: 'contents' }}>
          <ScriptReviewSurface key={`${target.projectId}:${target.jobId}`} target={target} />
        </div>
      ) : null}
    </>
  )
}

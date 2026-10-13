'use client'

import * as React from 'react'

import type { CompositionMotionRevisionRef } from '@/lib/spark/composition-typed-edits'
import { loadMotionSourceShared, motionSourceStateOfError, type MotionSourceState } from '@/lib/spark/motion-code/motion-source'

/**
 * The readable source of the revision a Motion layer pins, read once per pin (`loadMotionSourceShared`: immutable by digest). `null`
 * while there is no Motion layer to read (the Code tab is not a candidate then); a changed pin shows `loading` until its own
 * read lands, never the previous revision's source.
 */
export function useMotionSource(ref: CompositionMotionRevisionRef | null, load: typeof loadMotionSourceShared = loadMotionSourceShared): MotionSourceState | null {
  const key = ref ? `${ref.scope}/${ref.motion_id}/${ref.motion_revision_id}/${ref.manifest_sha256}` : null
  const [result, setResult] = React.useState<{ key: string; state: MotionSourceState } | null>(null)
  React.useEffect(() => {
    if (!ref || !key) return undefined
    const controller = new AbortController()
    load(ref)
      .then((source) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'ready', source } })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, state: motionSourceStateOfError(error) })
      })
    return () => controller.abort()
    // The pin's parts are in the key; `ref` itself is a fresh object per document read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load])
  if (!key) return null
  return result?.key === key ? result.state : { status: 'loading' }
}

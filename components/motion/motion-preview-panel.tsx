'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { MotionDraft, MotionEnergy, MotionRatio } from '@/lib/motion-editor/api'
import type { MotionPreviewState } from '@/lib/motion-editor/session'

import { MotionRuntimePlayer, type MotionPlayerDeps } from './motion-runtime-player'

const RATIOS: readonly MotionRatio[] = ['16:9', '9:16', '1:1']
const ENERGIES: readonly MotionEnergy[] = ['sakin', 'dengeli', 'canli']

/**
 * P06-02 preview region: the deterministic server compile of the draft with its Test Data (format and energy switches
 * persist as Test Data, so the preview never differs from what validation compiles). E1-D: the compiled document is drawn
 * and played by the pinned `motion-runtime` host the Spark stage uses (`MotionRuntimePlayer`), so what the author sees is
 * exactly what a project instance draws; a runtime or font that cannot be loaded is its own failure state.
 */
export function MotionPreviewPanel({
  draft,
  preview,
  disabled,
  onViewpoint,
  playerDeps,
}: {
  draft: MotionDraft
  preview: MotionPreviewState
  disabled: boolean
  onViewpoint: (view: { ratio?: MotionRatio; energy?: MotionEnergy }) => void
  /** Tests replace the runtime and font collaborators of the player. */
  playerDeps?: MotionPlayerDeps
}) {
  const t = useTranslations('Motion.editor.preview')
  const { ratio, energy } = draft.draft.test_data
  const declaredRatios = RATIOS.filter((candidate) => (draft.draft.pattern['manifest'] as { ratio_variants?: string[] } | undefined)?.ratio_variants?.includes(candidate) ?? true)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('ratio')}>
        {declaredRatios.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="rounded-lg border border-border px-2.5 py-1 text-xs aria-pressed:bg-accent aria-pressed:text-accent-foreground disabled:opacity-50"
            aria-pressed={candidate === ratio}
            disabled={disabled}
            onClick={() => onViewpoint({ ratio: candidate })}
          >
            {candidate}
          </button>
        ))}
        <span className="mx-1 text-muted-foreground" aria-hidden>·</span>
        {ENERGIES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="rounded-lg border border-border px-2.5 py-1 text-xs aria-pressed:bg-accent aria-pressed:text-accent-foreground disabled:opacity-50"
            aria-pressed={candidate === energy}
            disabled={disabled}
            onClick={() => onViewpoint({ energy: candidate })}
          >
            {t(`energies.${candidate}`)}
          </button>
        ))}
      </div>
      <div className="flex min-h-40 flex-col justify-center gap-2 rounded-md border border-border bg-panel/40 p-4 text-sm" data-motion-preview={preview.status}>
        {preview.status === 'idle' || preview.status === 'loading' ? (
          <span className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('loading')}
          </span>
        ) : preview.status === 'failed' ? (
          <span role="alert" className="text-muted-foreground">
            {t(`failed.${preview.failure}`)}
          </span>
        ) : (
          <>
            <span>{t('compiled', { ratio: preview.preview.ratio, energy: t(`energies.${preview.preview.energy}`), frames: preview.preview.duration_frames })}</span>
            <MotionRuntimePlayer ir={preview.preview.document} sha={preview.preview.document_sha256} {...(playerDeps && { deps: playerDeps })} />
            <Badge variant="outline" className="self-start font-mono">{preview.preview.document_sha256.slice(0, 12)}</Badge>
          </>
        )}
      </div>
    </div>
  )
}

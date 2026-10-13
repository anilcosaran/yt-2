'use client'

import { useTranslations } from 'next-intl'

import type { CaptionSource, CaptionStyle } from '@/lib/spark/captions-client'
import { captionTrackRemoveSpec, captionTrackSetStyleSpec } from '@/lib/spark/composition-typed-edits'

import { CaptionsDrawer } from './captions-drawer'
import type { SparkToolDrawerProps } from './spark-tool-types'
import { useSparkCaptions } from './use-spark-captions'

type TrackBody = { caption_track_id: string; style_ref?: { brand_asset_id?: string } | null }

/**
 * The registry's Captions drawer (E1-G): the project's caption sources, the price step, the running job, the platform
 * looks. Every write is a typed command through the session (`caption_track.remove` / `caption_track.set_style`, one undo
 * group); the transcription itself is the gateway's `transcript@1` job, bound to the track by the server.
 */
export function CaptionsToolDrawer({ ctx }: SparkToolDrawerProps) {
  const { project, document, canWrite, writeTitle, actions, toast } = ctx
  const flowT = useTranslations('Spark.editor.captions.flow')
  const refresh = actions.refresh ? () => actions.refresh!() : undefined
  const captions = useSparkCaptions({
    projectId: project.id,
    documentVersion: document?.working_copy_version ?? null,
    ...(refresh && { refresh }),
    onCaptionsOn: () => toast(flowT('onToast')),
    onStarted: () => toast(flowT('startedToast')),
    onFailed: () => toast(flowT('failedToast'), 'error'),
  })

  const tracks = (document?.caption_tracks ?? []) as unknown as TrackBody[]
  const sceneIds = document?.scene_sequence.scene_ids ?? []
  const firstStyleAsset = tracks[0]?.style_ref?.brand_asset_id
  const selectedStyle = captions.styles.find((style) => style.kit_ref.brand_asset_id === firstStyleAsset)?.preset_id ?? null

  const onStyle = (style: CaptionStyle) => {
    if (tracks.length === 0) return
    void actions.apply(
      tracks.map((track) => captionTrackSetStyleSpec(track.caption_track_id, style.kit_ref)),
      { coalesceKey: 'captions:style' },
    )
  }
  const onRemove = (source: CaptionSource) => {
    if (source.track) void actions.apply([captionTrackRemoveSpec(source.track.caption_track_id)])
  }

  return (
    <CaptionsDrawer
      status={captions.status}
      enabled={captions.sources?.enabled ?? false}
      sources={captions.sources?.sources ?? []}
      trackLimit={captions.sources?.track_limit ?? { max: 4, used: 0 }}
      flows={captions.flows}
      watched={captions.watched}
      sceneNumbers={(ids) => ids.map((id) => sceneIds.indexOf(id) + 1).filter((number) => number > 0).sort((a, b) => a - b)}
      styles={captions.styles}
      selectedStyle={selectedStyle}
      hasTracks={tracks.length > 0}
      canWrite={canWrite}
      writeTitle={writeTitle}
      onBegin={(sourceId) => void captions.begin(sourceId)}
      onConfirm={(sourceId) => void captions.confirm(sourceId)}
      onCancel={captions.cancel}
      onRemove={onRemove}
      onTurnOffAll={() => void actions.removeCaptions()}
      onStyle={onStyle}
      onRetry={() => void captions.reload()}
    />
  )
}

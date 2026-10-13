'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { StorageMediaSelection } from '@/components/storage/storage-media-input'
import { attachPickedMedia, type PickAttachResult, type PickedMedia } from '@/lib/spark/attach-picked-media'
import type { CompositionDocument } from '@/lib/spark/composition-client'
import {
  backgroundSceneFrames,
  normalizeHexColor,
  planBackground,
  removeBackgroundSpecs,
  sceneBackgroundOf,
  type BackgroundNotice,
  type BackgroundRefusal,
  type BackgroundRequest,
} from '@/lib/spark/scene-background'
import { SCENE_MEDIA_ACCEPT, classifySceneMedia, type SceneMediaKind, type SceneMediaRefusal } from '@/lib/spark/scene-media-policy'
import { uploadToSparkFolder } from '@/lib/spark/spark-upload'

import './scene-background.css'
import type { SparkToolContext, TimelineScene } from './spark-tool-types'
import { Icon, PanelSection } from './studio-parts'

/**
 * E1-J scene panel "Background" (QA-382). There is no background field in the document: the panel reads the scene's
 * bottom-most full-canvas layer as the background and writes ordinary layers (`lib/spark/scene-background.ts`):
 *
 * - colour: a swatch, a hex field and a few presets; sets or creates a canvas-sized rect at the bottom;
 * - picture / video: the shared Storage picker (My media, Upload to the "Spark" folder) -> the file is bound to the
 *   project (`attachPickedMedia`) -> a bottom clip over the whole scene (or `clip.replace_source` for a replacement);
 * - "Remove background" removes that layer. Every change is ONE command (one undo group).
 *
 * The section is active with the stage (it needs the freshest document from the stage's session); without it the scene
 * panel keeps its disabled design placeholders.
 */

// The design's per-scene colours (`BG` of the prototype): near-black, paper, forest, lime, ink and white.
const PRESETS = ['#0a0c0b', '#f3f0e8', '#0e1712', '#a8e07f', '#111318', '#ffffff'] as const

// The Storage picker is large and only needed when the user opens it: load it on demand.
const StoragePicker = React.lazy(() =>
  import('@/components/storage/storage-media-input').then((module) => ({ default: module.StorageMediaPickerDialog })),
)

type UploadState = { fileName: string; phase: 'preparing' | 'uploading'; progress: number }
type Status = 'attaching' | null

export function SceneBackgroundSection({
  ctx,
  document,
  entry,
  canWrite,
  readOnly,
}: {
  ctx: SparkToolContext
  document: CompositionDocument
  entry: TimelineScene
  canWrite: boolean
  readOnly: boolean
}) {
  const t = useTranslations('Spark.editor.sceneBackground')
  const tScene = useTranslations('Spark.editor.scenePanel')
  const tEditor = useTranslations('Spark.editor')
  const scene = entry.scene
  const sceneId = scene.scene_id
  const background = React.useMemo(() => sceneBackgroundOf(document, scene), [document, scene])
  const lengthKnown = backgroundSceneFrames(document, scene) !== null
  const mediaBackground = background && background.kind !== 'color' ? background : null
  const colorBackground = background?.kind === 'color' ? background : null

  const [draft, setDraft] = React.useState<string | null>(null)
  const [invalid, setInvalid] = React.useState(false)
  const [status, setStatus] = React.useState<Status>(null)
  const [picker, setPicker] = React.useState<SceneMediaKind | null>(null)
  const [upload, setUpload] = React.useState<UploadState | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const swatch = React.useRef<HTMLInputElement>(null)

  // The long-lived callbacks below read the latest props through a ref (the section re-renders on every document change).
  const latest = React.useRef({ ctx, sceneId, t })
  React.useLayoutEffect(() => {
    latest.current = { ctx, sceneId, t }
  })

  const busy = status !== null || upload !== null
  const writable = canWrite && lengthKnown && !busy
  let disabledTitle: string | undefined
  if (readOnly) disabledTitle = tEditor('readOnly')
  else if (!lengthKnown) disabledTitle = t('needsLength')

  /** The sentence for a refused file type (D10) or a plan the server would refuse; the generic failure otherwise. */
  const reasonText = (reason: SceneMediaRefusal | BackgroundRefusal) => {
    if (reason === 'invalid_color') return t('invalidColor')
    if (reason === 'scene_length_unknown') return t('needsLength')
    if (reason === 'media_present') return t('colorLockedByMedia')
    if (reason === 'gif' || reason === 'svg' || reason === 'audio' || reason === 'image_format' || reason === 'video_format' || reason === 'unsupported') {
      return t(`refused.${reason}`)
    }
    return t('failed')
  }
  const failureText = (result: Extract<PickAttachResult, { status: 'failed' }>) => (result.reason === 'unavailable' ? t('unavailable') : t('failed'))
  const noticeText = (notice: BackgroundNotice) =>
    notice.kind === 'videoTrimmed' ? t('videoTrimmed', { seconds: notice.seconds }) : t('videoShorter', { seconds: notice.seconds })

  /**
   * Plans the request against the FRESHEST document (the stage's session) and sends it as one command. `targetScene` is
   * the scene the user was editing when they started: a pick or an upload that finishes after they selected another
   * scene still lands on the first one.
   */
  const applyRequest = async (request: BackgroundRequest, targetScene: string): Promise<boolean> => {
    const current = latest.current
    const session = current.ctx.stage?.controller.session
    const fresh = session?.document()
    if (!session || !fresh) return false
    const plan = planBackground({ document: fresh, sceneId: targetScene, request, uuid: () => globalThis.crypto.randomUUID() })
    if (!plan.ok) {
      current.ctx.toast(reasonText(plan.reason), 'error')
      return false
    }
    if (plan.specs.length === 0) return true
    const applied = await session.apply(plan.specs)
    if (applied && plan.notice) current.ctx.toast(noticeText(plan.notice))
    return applied
  }

  const commitColor = (value: string) => {
    const hex = normalizeHexColor(value)
    if (!hex) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(null)
    void applyRequest({ kind: 'color', fill: hex }, sceneId)
  }
  // The native colour picker fires `change` once when it closes (React's onChange also fires while dragging).
  const commitColorRef = React.useRef(commitColor)
  React.useLayoutEffect(() => {
    commitColorRef.current = commitColor
  })
  React.useEffect(() => {
    const node = swatch.current
    if (!node) return undefined
    const onChange = () => commitColorRef.current(node.value)
    node.addEventListener('change', onChange)
    return () => node.removeEventListener('change', onChange)
  })

  /** A picked or uploaded Storage object becomes the background: bind it, then plan against the document that holds it. */
  const adoptMedia = async (picked: PickedMedia, targetScene: string) => {
    const current = latest.current
    const session = current.ctx.stage?.controller.session
    if (!session) return
    setStatus('attaching')
    try {
      const result = await attachPickedMedia({
        channelId: current.ctx.project.channelId,
        projectId: current.ctx.project.id,
        picked,
        baseRevision: () => session.workingCopyVersion(),
        refresh: () => session.refresh(),
      })
      if (result.status === 'refused') current.ctx.toast(reasonText(result.reason), 'error')
      else if (result.status === 'processing') current.ctx.toast(current.t('processing'), 'error')
      else if (result.status === 'failed') current.ctx.toast(failureText(result), 'error')
      else await applyRequest({ kind: 'media', sourceId: result.sourceId, naturalSize: result.naturalSize }, targetScene)
    } finally {
      setStatus(null)
    }
  }

  const onPicked = (selection: StorageMediaSelection) => {
    setPicker(null)
    void adoptMedia(
      {
        storageObjectId: selection.storageObjectId,
        mimeType: selection.mimeType,
        name: selection.name,
        width: selection.width,
        height: selection.height,
      },
      sceneId,
    )
  }

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    const current = latest.current
    const targetScene = current.sceneId
    const kind = classifySceneMedia({ mimeType: file.type, name: file.name })
    if (!kind.ok) {
      current.ctx.toast(reasonText(kind.reason), 'error')
      return
    }
    setUpload({ fileName: file.name, phase: 'preparing', progress: 0 })
    try {
      const uploaded = await uploadToSparkFolder({
        channelId: current.ctx.project.channelId,
        file,
        onProgress: (progress) => setUpload({ fileName: file.name, phase: 'uploading', progress }),
      })
      setUpload(null)
      setPicker(null)
      await adoptMedia(uploaded, targetScene)
    } catch {
      setUpload(null)
      current.ctx.toast(current.t('uploadFailed'), 'error')
    }
  }

  const text = draft ?? (colorBackground ? colorBackground.fill.replace('#', '').slice(0, 6).toUpperCase() : '')
  // The native picker follows the draft while it is open (a controlled value that ignored it would snap back).
  const swatchValue = (draft !== null ? normalizeHexColor(draft) : null) ?? (colorBackground ? `#${colorBackground.fill.replace('#', '').slice(0, 6).toLowerCase()}` : '#000000')
  const colorDisabled = !writable || mediaBackground !== null
  const colorTitle = mediaBackground ? t('colorLockedByMedia') : disabledTitle
  const mediaKindLabel = mediaBackground?.kind === 'video' ? t('currentVideo') : t('currentImage')

  return (
    <PanelSection label={tScene('background')}>
      <div className={`field${invalid ? ' invalid' : ''}`} title={colorTitle}>
        <input
          ref={swatch}
          type="color"
          className="sw"
          aria-label={t('pickColor')}
          value={swatchValue}
          disabled={colorDisabled}
          onChange={(event) => setDraft(event.target.value.replace('#', '').toUpperCase())}
        />
        <input
          aria-label={t('colorInput')}
          aria-invalid={invalid}
          placeholder={t('colorPlaceholder')}
          maxLength={7}
          value={text}
          disabled={colorDisabled}
          onChange={(event) => {
            setInvalid(false)
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitColor(event.currentTarget.value)
            else if (event.key === 'Escape') {
              setDraft(null)
              setInvalid(false)
            }
          }}
          onBlur={(event) => {
            const value = event.currentTarget.value
            if (draft === null) return
            if (normalizeHexColor(value) === (colorBackground?.fill.toLowerCase() ?? null)) {
              setDraft(null)
              setInvalid(false)
              return
            }
            commitColor(value)
          }}
        />
      </div>
      {invalid ? (
        <span className="bg-note" role="alert">
          {t('invalidColor')}
        </span>
      ) : null}
      <div className="bg-swatches" role="group" aria-label={t('presets')}>
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="bg-swatch"
            style={{ background: hex }}
            aria-label={t('presetTitle', { color: hex.toUpperCase() })}
            title={colorTitle ?? hex.toUpperCase()}
            aria-pressed={colorBackground?.fill.toLowerCase() === hex}
            disabled={colorDisabled}
            onClick={() => commitColor(hex)}
          />
        ))}
      </div>
      {mediaBackground ? <span className="bg-note">{t('colorLockedByMedia')}</span> : null}

      <div className="row">
        <button type="button" className="btn sm" disabled={!writable} title={disabledTitle} onClick={() => setPicker('image')}>
          <Icon name="image" size="sm" />
          {mediaBackground ? t('replacePicture') : t('addPicture')}
        </button>
        <button type="button" className="btn sm" disabled={!writable} title={disabledTitle} onClick={() => setPicker('video')}>
          <Icon name="video" size="sm" />
          {mediaBackground ? t('replaceVideo') : t('addVideo')}
        </button>
      </div>

      {mediaBackground ? (
        <div className="bg-current" data-background-kind={mediaBackground.kind}>
          <Icon name={mediaBackground.kind === 'video' ? 'video' : 'image'} size="sm" />
          <span>{mediaKindLabel}</span>
        </div>
      ) : null}
      {background ? (
        <button
          type="button"
          className="btn ghost sm"
          disabled={!writable}
          title={disabledTitle}
          onClick={() => {
            const session = ctx.stage?.controller.session
            const fresh = session?.document()
            if (session && fresh) void session.apply(removeBackgroundSpecs(fresh, sceneId))
          }}
        >
          <Icon name="trash" size="sm" />
          {t('remove')}
        </button>
      ) : null}
      {!lengthKnown ? <span className="bg-note">{t('needsLength')}</span> : null}
      {status === 'attaching' ? (
        <div className="bg-status" role="status">
          <span className="spin" aria-hidden />
          {t('attaching')}
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        tabIndex={-1}
        aria-hidden
        style={{ display: 'none' }}
        accept={SCENE_MEDIA_ACCEPT}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {picker ? (
        <React.Suspense fallback={null}>
          <StoragePicker
            open
            channelId={ctx.project.channelId}
            mediaKind={picker}
            {...(mediaBackground?.storageObjectId && { selectedObjectId: mediaBackground.storageObjectId })}
            uploadState={upload}
            onOpenChange={(open) => {
              if (!open && upload === null) setPicker(null)
            }}
            onUpload={() => fileInput.current?.click()}
            onSelect={onPicked}
          />
        </React.Suspense>
      ) : null}
      {upload ? (
        <div className="bg-status" role="status">
          <span className="spin" aria-hidden />
          {t('uploading', { name: upload.fileName, progress: upload.phase === 'preparing' ? 0 : upload.progress })}
        </div>
      ) : null}
    </PanelSection>
  )
}

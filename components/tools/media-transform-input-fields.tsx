'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AudioLines,
  Crop,
  FileImage,
  FileVideo2,
  Gauge,
  Images,
  Plus,
  RotateCcw,
  RotateCw,
  Scissors,
  ScanFace,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { StorageMediaInput, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToolField,
  ToolSelectField,
  ToolSliderField,
  ToolToggleRow,
  type ToolChoice,
} from '@/components/tools/tool-primitives'
import { PortraitFramingFields } from '@/components/tools/portrait-framing-fields'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

type MediaTransformValues = Record<string, unknown>

export type MediaTransformSelectedMedia = Pick<
  StorageMediaSelection,
  'storageObjectId' | 'name' | 'mimeType' | 'durationSeconds' | 'previewUrl' | 'width' | 'height'
> & {
  channelId: string | null
}

type MediaTransformSection = 'trim' | 'canvas' | 'framing' | 'output' | 'effects'
type MediaTransformPurpose = 'trim' | 'reframe' | 'smart_reframe' | 'camera' | 'effects' | 'audio' | 'orientation' | 'convert' | 'advanced'
type MediaTransformPresentation = 'purpose' | 'pipeline' | 'media-only'
const MEDIA_TRANSFORM_PURPOSE_FIELD = '__media_transform_purpose'

type PurposeChoice = {
  value: MediaTransformPurpose
  label: string
  description: string
  icon: LucideIcon
}

const PURPOSE_OPTIONS: PurposeChoice[] = [
  { value: 'trim', label: 'Trim video', description: 'Keep one exact time range.', icon: Scissors },
  { value: 'reframe', label: 'Resize or crop', description: 'Change ratio, size, fit, or background.', icon: Crop },
  { value: 'smart_reframe', label: 'Smart reframe', description: 'Follow the main face or fit the full frame into portrait.', icon: ScanFace },
  { value: 'camera', label: 'Manual camera', description: 'Set a focal point or animate pan and zoom.', icon: Gauge },
  { value: 'effects', label: 'Speed & effects', description: 'Adjust speed, fades, loudness, and color.', icon: SlidersHorizontal },
  { value: 'audio', label: 'Adjust audio', description: 'Lower the volume or mute the result.', icon: AudioLines },
  { value: 'orientation', label: 'Rotate or flip', description: 'Fix orientation or mirror the video.', icon: RotateCw },
  { value: 'convert', label: 'Convert video', description: 'Export directly as MP4 or WebM.', icon: FileVideo2 },
]

const LEGACY_MULTIPLE_EDITS_OPTION: PurposeChoice = {
  value: 'advanced',
  label: 'Multiple edits',
  description: 'This saved setup applies several edits together.',
  icon: SlidersHorizontal,
}

const RELATED_TOOL_OPTIONS = [
  {
    label: 'Create GIF',
    description: 'Turn a video range into an animated GIF.',
    icon: FileImage,
    href: '/tools?tool=video-to-gif',
  },
  {
    label: 'Extract frames',
    description: 'Get first, last, timed, or sampled images.',
    icon: Images,
    href: '/tools?tool=frame-extract',
  },
] as const

const CUT_MODE_OPTIONS: ToolChoice[] = [
  { value: 'exact', label: 'Exact', description: 'Frame-accurate cut with re-encoding.' },
  { value: 'fast', label: 'Fast', description: 'Faster cut that may snap to keyframes.' },
]

const ASPECT_RATIO_OPTIONS: ToolChoice[] = [
  { value: 'original', label: 'Original' },
  { value: '9:16', label: '9:16', description: 'Vertical shorts.' },
  { value: '1:1', label: '1:1', description: 'Square.' },
  { value: '16:9', label: '16:9', description: 'Landscape.' },
  { value: 'custom', label: 'Custom' },
]

const FIT_OPTIONS: ToolChoice[] = [
  { value: 'crop', label: 'Crop', description: 'Fill the canvas and crop overflow.' },
  { value: 'fit', label: 'Fit', description: 'Keep the whole video inside the canvas.' },
  { value: 'blur', label: 'Blur background', description: 'Fit over a blurred background.' },
]

const ROTATION_OPTIONS: ToolChoice[] = [0, 90, 180, 270].map((value) => ({
  value: String(value),
  label: `${value}°`,
}))

const FLIP_OPTIONS: ToolChoice[] = [
  { value: 'none', label: 'None' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'both', label: 'Both' },
]

const FORMAT_OPTIONS: ToolChoice[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
]

const QUALITY_OPTIONS: ToolChoice[] = [
  { value: 'draft', label: 'Draft', description: 'Fastest render and smallest file.' },
  { value: 'standard', label: 'Standard', description: 'Balanced quality and render time.' },
  { value: 'high', label: 'High', description: 'Higher visual quality and larger file.' },
]

const INTERPOLATION_OPTIONS: ToolChoice[] = [
  { value: 'smooth', label: 'Smooth', description: 'Ease the camera between points.' },
  { value: 'linear', label: 'Linear', description: 'Move at a constant rate.' },
]

export function MediaTransformInputFields({
  channelId,
  values,
  onValueChange,
  onStorageMediaSelectionChange,
  onBusyChange,
  afterMedia,
  showTrim = true,
  allowedOutputFormats,
  presentation = 'purpose',
}: {
  channelId: string | null
  values: MediaTransformValues
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: MediaTransformSelectedMedia | null) => void
  onBusyChange: (busy: boolean) => void
  afterMedia?: React.ReactNode
  showTrim?: boolean
  allowedOutputFormats?: Array<'mp4' | 'webm'>
  presentation?: MediaTransformPresentation
}) {
  const tAuto = useTranslations('Auto')
  const [selectedMedia, setSelectedMedia] = React.useState<StorageMediaSelection | null>(null)
  const storedPurpose = stringValue(values[MEDIA_TRANSFORM_PURPOSE_FIELD])
    || stringValue(values.action_mode)
  const purpose = isMediaTransformPurpose(storedPurpose) ? storedPurpose : inferPurpose(values)
  const storageObjectId = stringValue(values.storage_object_id)
  const trim = objectValue(values.trim)
  const canvas = objectValue(values.canvas)
  const framing = objectValue(values.framing)
  const output = objectValue(values.output)
  const effects = objectValue(values.effects)
  const playbackEffects = objectValue(effects.playback)
  const audioEffects = objectValue(effects.audio)
  const videoEffects = objectValue(effects.video)
  const manualCamera = objectValue(framing.manual)
  const manualFocalPoint = objectValue(manualCamera.focal_point)
  const manualKeyframes = Array.isArray(manualCamera.keyframes)
    ? manualCamera.keyframes.filter((entry): entry is Record<string, unknown> => (
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      ))
    : []

  const aspectRatio = stringValue(canvas.aspect_ratio) || 'original'
  const framingMode = stringValue(framing.mode) || 'none'
  const audioMode = stringValue(output.audio) || 'keep'
  const rotationDegrees = integerValue(output.rotation_degrees, 0)
  const volumePercent = boundedNumber(output.volume_percent, 100, 0, 200)
  const defaultQuality = framingMode === 'face_track' ? 'high' : 'standard'
  const formatOptions = allowedOutputFormats
    ? FORMAT_OPTIONS.filter((option) => allowedOutputFormats.includes(option.value as 'mp4' | 'webm'))
    : FORMAT_OPTIONS
  const requestedFormat = stringValue(output.format) || 'mp4'
  // Keep an invalid restored value visible so the user can actively replace it.
  // Silently displaying the first allowed option would leave the submitted params unchanged.
  const selectedFormat = requestedFormat

  const setSectionField = React.useCallback((
    section: MediaTransformSection,
    name: string,
    value: unknown,
  ) => {
    const next = { ...objectValue(values[section]) }
    if (value === undefined || value === null || value === '') {
      delete next[name]
    } else {
      next[name] = value
    }
    onValueChange(section, next)
  }, [onValueChange, values])

  const setAspectRatio = React.useCallback((value: string) => {
    const next: Record<string, unknown> = { ...objectValue(values.canvas), aspect_ratio: value }
    if (value !== 'custom') {
      delete next.width
      delete next.height
    }
    onValueChange('canvas', next)
  }, [onValueChange, values.canvas])

  const setManualCamera = React.useCallback((nextManual: Record<string, unknown>) => {
    onValueChange('framing', {
      ...objectValue(values.framing),
      mode: 'manual',
      manual: nextManual,
    })
  }, [onValueChange, values.framing])

  const setManualFocalPoint = React.useCallback((axis: 'x' | 'y', value: number) => {
    setManualCamera({
      ...objectValue(objectValue(values.framing).manual),
      focal_point: {
        ...objectValue(objectValue(objectValue(values.framing).manual).focal_point),
        [axis]: value,
      },
    })
  }, [setManualCamera, values.framing])

  const setEffectField = React.useCallback((
    group: 'playback' | 'audio' | 'video',
    name: string,
    value: unknown,
  ) => {
    const nextEffects = { ...objectValue(values.effects) }
    const nextGroup = { ...objectValue(nextEffects[group]) }
    if (value === undefined || value === null || value === '') delete nextGroup[name]
    else nextGroup[name] = value
    nextEffects[group] = nextGroup
    onValueChange('effects', nextEffects)
  }, [onValueChange, values.effects])

  const setManualKeyframes = React.useCallback((keyframes: Array<Record<string, unknown>>) => {
    setManualCamera({
      ...objectValue(objectValue(values.framing).manual),
      keyframes,
    })
  }, [setManualCamera, values.framing])

  const updateManualKeyframe = React.useCallback((
    index: number,
    name: 'time_sec' | 'x' | 'y' | 'zoom',
    value: number | undefined,
  ) => {
    const next = manualKeyframes.map((entry) => ({ ...entry }))
    if (!next[index]) return
    if (value === undefined) delete next[index][name]
    else next[index][name] = value
    setManualKeyframes(next)
  }, [manualKeyframes, setManualKeyframes])

  const selectPurpose = React.useCallback((nextPurpose: MediaTransformPurpose) => {
    if (nextPurpose === purpose) return
    onValueChange(MEDIA_TRANSFORM_PURPOSE_FIELD, nextPurpose)
    onValueChange('action_mode', nextPurpose)
    if (nextPurpose === 'advanced') return

    const nextOutput: Record<string, unknown> = {
      format: stringValue(objectValue(values.output).format) || 'mp4',
      quality: stringValue(objectValue(values.output).quality) || 'standard',
      audio: 'keep',
      volume_percent: 100,
      rotation_degrees: 0,
      flip: 'none',
    }
    const nextCanvas: Record<string, unknown> = {}
    const nextFraming: Record<string, unknown> = {}

    if (nextPurpose === 'smart_reframe') {
      Object.assign(nextCanvas, { aspect_ratio: '9:16', fit: 'crop' })
      Object.assign(nextFraming, {
        mode: 'face_track',
        tracking_profile: 'steady_face_v2',
      })
    } else if (nextPurpose === 'camera') {
      Object.assign(nextCanvas, { aspect_ratio: '9:16', fit: 'crop' })
      Object.assign(nextFraming, {
        mode: 'manual',
        manual: {
          focal_point: { x: 0.5, y: 0.5 },
          zoom: 1,
          interpolation: 'smooth',
          keyframes: [],
        },
      })
    } else if (nextPurpose === 'reframe') {
      Object.assign(nextCanvas, { aspect_ratio: '9:16', fit: 'crop' })
      Object.assign(nextFraming, { mode: 'none' })
    } else {
      Object.assign(nextCanvas, { aspect_ratio: 'original', fit: 'crop' })
      Object.assign(nextFraming, { mode: 'none' })
    }

    if (nextPurpose !== 'trim') onValueChange('trim', undefined)
    if (nextPurpose !== 'effects') onValueChange('effects', undefined)
    if (nextPurpose !== 'orientation') {
      nextOutput.rotation_degrees = 0
      nextOutput.flip = 'none'
    }
    onValueChange('canvas', nextCanvas)
    onValueChange('framing', nextFraming)
    onValueChange('output', nextOutput)
  }, [onValueChange, purpose, values.output])

  const mediaOnly = presentation === 'media-only'
  const showAll = presentation === 'pipeline' || purpose === 'advanced'
  const showOutputSection = !mediaOnly
  const showTrimSection = !mediaOnly && showTrim && (showAll || purpose === 'trim')
  const showCanvasSection = !mediaOnly && (showAll || purpose === 'reframe')
  const showFramingSection = !mediaOnly && (showAll || purpose === 'smart_reframe')
  const showManualSection = !mediaOnly && (showAll || purpose === 'camera')
  const showEffectsSection = !mediaOnly && (showAll || purpose === 'effects')
  const showOrientationSection = !mediaOnly && (showAll || purpose === 'orientation')
  const showAudioSection = !mediaOnly && (showAll || purpose === 'audio' || purpose === 'convert' || purpose === 'effects')

  return (
    <div className="space-y-5">
      {presentation === 'purpose' ? (
        <PurposePicker value={purpose} onValueChange={selectPurpose} />
      ) : null}

      <ToolField label={tAuto('media_0c77aeec')} hint={tAuto('required_eed6bfb4')}>
        <StorageMediaInput
          channelId={channelId}
          value={storageObjectId}
          selectedName={selectedMedia?.storageObjectId === storageObjectId ? selectedMedia.name : undefined}
          mediaKind="video"
          onBusyChange={onBusyChange}
          onChange={(selection) => {
            setSelectedMedia(selection)
            onValueChange('storage_object_id', selection?.storageObjectId)
            onValueChange('duration_sec', selection?.durationSeconds ?? undefined)
            onValueChange('media_ref', undefined)
            onValueChange('video_url', undefined)
            onStorageMediaSelectionChange(selection ? {
              channelId,
              storageObjectId: selection.storageObjectId,
              name: selection.name,
              mimeType: selection.mimeType,
              durationSeconds: selection.durationSeconds,
              previewUrl: selection.previewUrl,
              width: selection.width,
              height: selection.height,
            } : null)
          }}
        />
      </ToolField>

      {afterMedia}

      {showTrimSection ? <ToolSection title={tAuto('trim_0266abd2')} description={tAuto('choose_the_part_of_the_source_that_should_remain_45453a37')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label={tAuto('start_952f3754')}
            hint="seconds"
            value={trim.start_sec}
            min={0}
            step={0.1}
            onValueChange={(value) => setSectionField('trim', 'start_sec', value)}
          />
          <NumberField
            label={tAuto('end_a2bb9d34')}
            hint="seconds"
            value={trim.end_sec}
            min={0.1}
            step={0.1}
            onValueChange={(value) => setSectionField('trim', 'end_sec', value)}
          />
        </div>
        <ToolSelectField
          label={tAuto('cut_mode_0d74190c')}
          value={stringValue(trim.cut_mode) || 'exact'}
          options={CUT_MODE_OPTIONS}
          onValueChange={(value) => setSectionField('trim', 'cut_mode', value)}
        />
      </ToolSection> : null}

      {showCanvasSection ? <ToolSection title={tAuto('canvas_a3f80b87')} description={tAuto('choose_the_output_shape_and_how_the_source_fills_de296e1b')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolSelectField
            label={tAuto('aspect_ratio_4e077cf8')}
            value={aspectRatio}
            options={ASPECT_RATIO_OPTIONS}
            onValueChange={setAspectRatio}
          />
          <ToolSelectField
            label={tAuto('fit_dab564d8')}
            value={stringValue(canvas.fit) || 'crop'}
            options={FIT_OPTIONS}
            onValueChange={(value) => setSectionField('canvas', 'fit', value)}
          />
        </div>
        {aspectRatio === 'custom' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label={tAuto('width_a58ddf50')}
              hint={tAuto('64_4096_px_82983292')}
              value={canvas.width}
              min={64}
              max={4096}
              step={2}
              onValueChange={(value) => setSectionField('canvas', 'width', value)}
            />
            <NumberField
              label={tAuto('height_3f608b49')}
              hint={tAuto('64_4096_px_82983292')}
              value={canvas.height}
              min={64}
              max={4096}
              step={2}
              onValueChange={(value) => setSectionField('canvas', 'height', value)}
            />
          </div>
        ) : null}
        {stringValue(canvas.fit) === 'fit' ? (
          <ToolField label={tAuto('background_color_1a0371e3')}>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-panel/40 px-3.5">
              <Input
                type="color"
                aria-label={tAuto('background_color_1a0371e3')}
                value={colorValue(canvas.background)}
                onChange={(event) => setSectionField('canvas', 'background', event.target.value)}
                className="h-7 w-10 cursor-pointer border-0 bg-transparent p-0 shadow-none"
              />
              <span className="font-mono text-xs text-muted-foreground">{colorValue(canvas.background)}</span>
            </div>
          </ToolField>
        ) : null}
      </ToolSection> : null}

      {showFramingSection ? <ToolControlGroup>
        <PortraitFramingFields
          canvas={canvas}
          framing={framing}
          onValueChange={onValueChange}
        />
      </ToolControlGroup> : null}

      {showManualSection ? <ToolSection title={tAuto('manual_camera_462b1fd1')} description={tAuto('choose_the_focal_point_then_add_timed_pan_and_zo_02a30729')}>
        <div className="space-y-2.5 rounded-xl border border-border/70 bg-background/35 p-3">
          <ToolSliderField
            label={tAuto('focal_x_d952061f')}
            value={Math.round(boundedNumber(manualFocalPoint.x, 0.5, 0, 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onValueChange={(value) => setManualFocalPoint('x', Math.round(value) / 100)}
          />
          <ToolSliderField
            label={tAuto('focal_y_9f86f637')}
            value={Math.round(boundedNumber(manualFocalPoint.y, 0.5, 0, 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onValueChange={(value) => setManualFocalPoint('y', Math.round(value) / 100)}
          />
          <ToolSliderField
            label={tAuto('zoom_9b3cbed5')}
            value={Math.round(boundedNumber(manualCamera.zoom, 1, 1, 4) * 100)}
            min={100}
            max={400}
            suffix="%"
            onValueChange={(value) => setManualCamera({ ...manualCamera, zoom: Math.round(value) / 100 })}
          />
        </div>
        <ToolSelectField
          label={tAuto('camera_motion_4c0fb6b2')}
          value={stringValue(manualCamera.interpolation) || 'smooth'}
          options={INTERPOLATION_OPTIONS}
          onValueChange={(value) => setManualCamera({ ...manualCamera, interpolation: value })}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground"><UiText id="camera_keyframes_0d6c1be6" /></p>
              <p className="text-[11px] text-muted-foreground"><UiText id="times_use_the_trimmed_output_timeline_fd16c7bf" /></p>
            </div>
            <button
              type="button"
              onClick={() => {
                const last = manualKeyframes.at(-1)
                setManualKeyframes([
                  ...manualKeyframes,
                  {
                    time_sec: boundedNumber(last?.time_sec, -1, -1, 7200) + 1,
                    x: boundedNumber(manualFocalPoint.x, 0.5, 0, 1),
                    y: boundedNumber(manualFocalPoint.y, 0.5, 0, 1),
                    zoom: boundedNumber(manualCamera.zoom, 1, 1, 4),
                  },
                ])
              }}
              disabled={manualKeyframes.length >= 200}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-panel/40 px-2.5 text-xs font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              <UiText id="add_point_81cb216b" /></button>
          </div>
          {manualKeyframes.map((keyframe, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-border bg-panel/40 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <NumberField label={tAuto('time_6c82e6dd')} hint="sec" value={keyframe.time_sec} min={0} max={7200} step={0.1} onValueChange={(value) => updateManualKeyframe(index, 'time_sec', value)} />
              <NumberField label="X" hint="0–1" value={keyframe.x} min={0} max={1} step={0.01} onValueChange={(value) => updateManualKeyframe(index, 'x', value)} />
              <NumberField label="Y" hint="0–1" value={keyframe.y} min={0} max={1} step={0.01} onValueChange={(value) => updateManualKeyframe(index, 'y', value)} />
              <NumberField label={tAuto('zoom_9b3cbed5')} hint="1–4×" value={keyframe.zoom} min={1} max={4} step={0.05} onValueChange={(value) => updateManualKeyframe(index, 'zoom', value)} />
              <button
                type="button"
                aria-label={tAuto('remove_camera_keyframe', { number: index + 1 })}
                onClick={() => setManualKeyframes(manualKeyframes.filter((_, itemIndex) => itemIndex !== index))}
                className="mt-6 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </ToolSection> : null}

      {showEffectsSection ? <ToolSection title={tAuto('speed_effects_664fc68c')} description={tAuto('apply_bounded_playback_fade_loudness_and_color_a_f4c91dbb')}>
        <ToolSliderField
          label={tAuto('playback_speed_6ff42b75')}
          value={boundedNumber(playbackEffects.speed, 1, 0.25, 4) * 100}
          min={25}
          max={400}
          suffix="%"
          presets={[25, 50, 100, 150, 200, 400]}
          onValueChange={(value) => setEffectField('playback', 'speed', value / 100)}
        />
        <ToolToggleRow
          icon={AudioLines}
          label={tAuto('normalize_loudness_010a6478')}
          description={tAuto('targets_a_consistent_perceived_output_level_5d1a3b9c')}
          checked={audioEffects.loudness_normalize === true}
          onCheckedChange={(checked) => setEffectField('audio', 'loudness_normalize', checked)}
        />
        {audioEffects.loudness_normalize === true ? (
          <NumberField label={tAuto('target_loudness_4c63a79b')} hint={tAuto('24_to_9_lufs_1d91d4d8')} value={audioEffects.target_lufs ?? -16} min={-24} max={-9} step={0.5} onValueChange={(value) => setEffectField('audio', 'target_lufs', value)} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label={tAuto('audio_fade_in_af294589')} hint={tAuto('0_30_sec_44fbd157')} value={audioEffects.fade_in_sec} min={0} max={30} step={0.1} onValueChange={(value) => setEffectField('audio', 'fade_in_sec', value)} />
          <NumberField label={tAuto('audio_fade_out_a8f80007')} hint={tAuto('0_30_sec_44fbd157')} value={audioEffects.fade_out_sec} min={0} max={30} step={0.1} onValueChange={(value) => setEffectField('audio', 'fade_out_sec', value)} />
          <NumberField label={tAuto('video_fade_in_f4c9c51e')} hint={tAuto('0_30_sec_44fbd157')} value={videoEffects.fade_in_sec} min={0} max={30} step={0.1} onValueChange={(value) => setEffectField('video', 'fade_in_sec', value)} />
          <NumberField label={tAuto('video_fade_out_bb846075')} hint={tAuto('0_30_sec_44fbd157')} value={videoEffects.fade_out_sec} min={0} max={30} step={0.1} onValueChange={(value) => setEffectField('video', 'fade_out_sec', value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolSliderField label={tAuto('brightness_e1a2b65d')} value={boundedNumber(videoEffects.brightness, 0, -1, 1) * 100} min={-100} max={100} suffix="%" presets={[-50, 0, 50]} onValueChange={(value) => setEffectField('video', 'brightness', value / 100)} />
          <ToolSliderField label={tAuto('contrast_c4fc37ad')} value={boundedNumber(videoEffects.contrast, 1, 0, 2) * 100} min={0} max={200} suffix="%" presets={[50, 100, 150, 200]} onValueChange={(value) => setEffectField('video', 'contrast', value / 100)} />
          <ToolSliderField label={tAuto('saturation_20a32bc8')} value={boundedNumber(videoEffects.saturation, 1, 0, 3) * 100} min={0} max={300} suffix="%" presets={[0, 50, 100, 150, 300]} onValueChange={(value) => setEffectField('video', 'saturation', value / 100)} />
          <ToolSliderField label={tAuto('temperature_0a9062a9')} value={boundedNumber(videoEffects.temperature, 0, -100, 100)} min={-100} max={100} presets={[-100, -50, 0, 50, 100]} onValueChange={(value) => setEffectField('video', 'temperature', Math.round(value))} />
        </div>
      </ToolSection> : null}

      {showOrientationSection ? <ToolSection title={tAuto('orientation_86e4e387')} description={tAuto('rotate_or_mirror_the_source_before_framing_2856a96c')}>
        <OrientationEditor
          rotationDegrees={rotationDegrees}
          flip={stringValue(output.flip) || 'none'}
          previewUrl={selectedMedia?.previewUrl ?? null}
          onRotationChange={(value) => setSectionField('output', 'rotation_degrees', value)}
          onFlipChange={(value) => setSectionField('output', 'flip', value)}
        />
      </ToolSection> : null}

      {showAudioSection ? <ToolSection title={tAuto('audio_acdac205')} description={tAuto('keep_lower_raise_or_remove_the_source_audio_86976a1a')}>
        <ToolToggleRow
          icon={AudioLines}
          label={tAuto('keep_audio_dca5bbea')}
          description={audioMode === 'keep' ? tAuto('source_audio_is_included_4b08b15a') : tAuto('the_result_is_muted_bff1a601')}
          checked={audioMode === 'keep'}
          onCheckedChange={(checked) => {
            onValueChange('output', {
              ...objectValue(values.output),
              audio: checked ? 'keep' : 'mute',
              volume_percent: checked ? (volumePercent === 0 ? 100 : volumePercent) : 0,
            })
          }}
        />
        {audioMode === 'keep' ? (
          <ToolSliderField
            label={tAuto('volume_3b18e8e3')}
            value={volumePercent}
            min={0}
            max={200}
            suffix="%"
            presets={[25, 50, 100, 150, 200]}
            onValueChange={(value) => setSectionField('output', 'volume_percent', Math.round(value))}
          />
        ) : null}
      </ToolSection> : null}

      {showOutputSection ? <ToolControlGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolSelectField
            label={tAuto('output_format_c03f08a8')}
            value={selectedFormat}
            options={formatOptions}
            onValueChange={(value) => setSectionField('output', 'format', value)}
          />
          <ToolSelectField
            label={tAuto('quality_a60f2c73')}
            value={stringValue(output.quality) || defaultQuality}
            options={QUALITY_OPTIONS}
            onValueChange={(value) => setSectionField('output', 'quality', value)}
          />
        </div>
      </ToolControlGroup> : null}
    </div>
  )
}

function PurposePicker({
  value,
  onValueChange,
}: {
  value: MediaTransformPurpose
  onValueChange: (value: MediaTransformPurpose) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const selectedOption = PURPOSE_OPTIONS.find((option) => option.value === value)
    ?? LEGACY_MULTIPLE_EDITS_OPTION
  const SelectedIcon = selectedOption.icon

  return (
    <div className="space-y-3">
      <ToolField label={tAuto('action_97c89a4d')} hint={tAuto('choose_one_4238dc41')}>
        <Select value={selectedOption.value} onValueChange={(next) => onValueChange(next as MediaTransformPurpose)}>
          <SelectTrigger className="h-auto min-h-16 w-full rounded-xl border-border bg-panel/40 px-3.5 py-3 text-left shadow-none hover:border-primary/40">
            <SelectValue>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                  <SelectedIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{toolCopy(selectedOption.label)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{toolCopy(selectedOption.description)}</span>
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {PURPOSE_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  textValue={toolCopy(option.label)}
                  className="py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{toolCopy(option.label)}</span>
                      <span className="block whitespace-normal text-xs leading-5 text-muted-foreground">
                        {toolCopy(option.description)}
                      </span>
                    </span>
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </ToolField>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="mr-1 text-xs font-medium text-muted-foreground"><UiText id="related_tools_0bdd4ecc" /></span>
        {RELATED_TOOL_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <Link
              key={option.href}
              href={option.href}
              title={toolCopy(option.description)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-panel/40 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              {toolCopy(option.label)}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function ToolSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-panel/40 p-3.5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ToolControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-panel/40 p-3.5">
      {children}
    </section>
  )
}

function OrientationEditor({
  rotationDegrees,
  flip,
  previewUrl,
  onRotationChange,
  onFlipChange,
}: {
  rotationDegrees: number
  flip: string
  previewUrl: string | null
  onRotationChange: (value: number) => void
  onFlipChange: (value: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const normalizedRotation = ((rotationDegrees % 360) + 360) % 360
  const scaleX = flip === 'horizontal' || flip === 'both' ? -1 : 1
  const scaleY = flip === 'vertical' || flip === 'both' ? -1 : 1
  const rotateBy = (delta: number) => onRotationChange((normalizedRotation + delta + 360) % 360)

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-border bg-black/90 p-4">
        {previewUrl ? (
          // Storage supplies the first available representative video frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={tAuto('source_frame_orientation_preview_03eaa9d9')}
            className="max-h-44 max-w-full object-contain transition-transform duration-200"
            style={{ transform: `rotate(${normalizedRotation}deg) scale(${scaleX}, ${scaleY})` }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-white/55">
            <FileVideo2 className="size-7" />
            <span className="text-xs"><UiText id="select_a_video_to_preview_orientation_71de5136" /></span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white/75 backdrop-blur-sm">
          <UiText id="source_frame_dfb1ffc1" />{' '}{normalizedRotation}°
        </span>
      </div>

      <div className="space-y-3">
        <ToolField label={tAuto('rotation_906fe506')} hint={tAuto('90_steps_cfad4b65')}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-border bg-panel/40 p-1.5">
            <button
              type="button"
              aria-label={tAuto('rotate_90_degrees_counterclockwise_1b943fe1')}
              onClick={() => rotateBy(-90)}
              className="flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-4" />
              <UiText id="left_8ae1c34b" /></button>
            <span className="min-w-14 text-center font-mono text-sm font-semibold text-foreground">
              {normalizedRotation}°
            </span>
            <button
              type="button"
              aria-label={tAuto('rotate_90_degrees_clockwise_3144907c')}
              onClick={() => rotateBy(90)}
              className="flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UiText id="right_954daa8b" /><RotateCw className="size-4" />
            </button>
          </div>
        </ToolField>
        <div className="grid grid-cols-4 gap-1.5" aria-label={tAuto('rotation_presets_219ed4a5')}>
          {ROTATION_OPTIONS.map((option) => {
            const value = Number(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-label={tAuto('set_rotation_degrees', { degrees: value })}
                aria-pressed={normalizedRotation === value}
                onClick={() => onRotationChange(value)}
                className={normalizedRotation === value
                  ? "h-8 rounded-lg border border-primary/45 bg-primary/15 text-xs font-semibold text-primary"
                  : "h-8 rounded-lg border border-border bg-panel/40 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"}
              >
                {value}°
              </button>
            )
          })}
        </div>
        <ToolSelectField
          label={tAuto('flip_5836b271')}
          value={flip}
          options={FLIP_OPTIONS}
          onValueChange={onFlipChange}
        />
      </div>
    </div>
  )
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onValueChange,
}: {
  label: string
  hint?: string
  value: unknown
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number | undefined) => void
}) {
  return (
    <ToolField label={label} hint={hint}>
      <Input
        type="number"
        value={numberInputValue(value)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const raw = event.target.value
          onValueChange(raw === '' ? undefined : Number(raw))
        }}
        className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
      />
    </ToolField>
  )
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberInputValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function integerValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function inferPurpose(values: MediaTransformValues): MediaTransformPurpose {
  const trim = objectValue(values.trim)
  const canvas = objectValue(values.canvas)
  const framing = objectValue(values.framing)
  const output = objectValue(values.output)
  const candidates: MediaTransformPurpose[] = []

  if ('start_sec' in trim || 'end_sec' in trim) candidates.push('trim')

  const framingMode = stringValue(framing.mode)
  if (framingMode === 'manual') {
    candidates.push('camera')
  } else if (framingMode === 'face_track' || framingMode === 'smart_layout') {
    candidates.push('smart_reframe')
  } else if (
    (stringValue(canvas.aspect_ratio) && stringValue(canvas.aspect_ratio) !== 'original')
    || 'width' in canvas
    || 'height' in canvas
    || (stringValue(canvas.fit) && stringValue(canvas.fit) !== 'crop')
  ) {
    candidates.push('reframe')
  }

  if (
    stringValue(output.audio) === 'mute'
    || boundedNumber(output.volume_percent, 100, 0, 200) !== 100
  ) candidates.push('audio')

  if (
    integerValue(output.rotation_degrees, 0) !== 0
    || (stringValue(output.flip) && stringValue(output.flip) !== 'none')
  ) candidates.push('orientation')

  const effects = objectValue(values.effects)
  const playback = objectValue(effects.playback)
  const audioEffects = objectValue(effects.audio)
  const videoEffects = objectValue(effects.video)
  if (
    boundedNumber(playback.speed, 1, 0.25, 4) !== 1
    || audioEffects.loudness_normalize === true
    || ['fade_in_sec', 'fade_out_sec'].some((name) => boundedNumber(audioEffects[name], 0, 0, 30) > 0)
    || ['fade_in_sec', 'fade_out_sec'].some((name) => boundedNumber(videoEffects[name], 0, 0, 30) > 0)
    || boundedNumber(videoEffects.brightness, 0, -1, 1) !== 0
    || boundedNumber(videoEffects.contrast, 1, 0, 2) !== 1
    || boundedNumber(videoEffects.saturation, 1, 0, 3) !== 1
    || boundedNumber(videoEffects.temperature, 0, -100, 100) !== 0
  ) candidates.push('effects')

  if (candidates.length > 1) return 'advanced'
  if (candidates.length === 1) return candidates[0]
  if (stringValue(output.format) === 'webm') return 'convert'
  return 'trim'
}

function isMediaTransformPurpose(value: string): value is MediaTransformPurpose {
  return ['trim', 'reframe', 'smart_reframe', 'camera', 'effects', 'audio', 'orientation', 'convert', 'advanced'].includes(value)
}

function colorValue(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
}

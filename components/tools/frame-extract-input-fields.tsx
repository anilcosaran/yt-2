'use client'

import * as React from 'react'

import { StorageMediaInput, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { Input } from '@/components/ui/input'
import {
  ToolField,
  ToolSelectField,
  ToolSliderField,
  type ToolChoice,
} from '@/components/tools/tool-primitives'
import type { MediaTransformSelectedMedia } from '@/components/tools/media-transform-input-fields'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

type FrameExtractValues = Record<string, unknown>
const FRAME_TIMESTAMPS_INPUT_FIELD = '__frame_timestamps_input'
export const MAX_FRAME_EXTRACT_PIXEL_FRAMES = 250_000_000

const MODE_OPTIONS: ToolChoice[] = [
  { value: 'first', label: 'First frame' },
  { value: 'last', label: 'Last frame' },
  { value: 'first_last', label: 'First + last' },
  { value: 'timestamp', label: 'Specific time' },
  { value: 'timestamps', label: 'Multiple specific times' },
  { value: 'evenly_spaced', label: 'Evenly spaced' },
  { value: 'interval', label: 'Every N seconds' },
  { value: 'sample_fps', label: 'Continuous sampling' },
]

const FORMAT_OPTIONS: ToolChoice[] = [
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
]

const SAMPLE_FPS_OPTIONS: ToolChoice[] = [0.1, 0.25, 0.5, 1, 2].map((value) => ({
  value: String(value),
  label: `${value} FPS`,
}))

const FIT_OPTIONS: ToolChoice[] = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'stretch', label: 'Stretch' },
]

export function FrameExtractInputFields({
  channelId,
  values,
  onValueChange,
  onStorageMediaSelectionChange,
  onBusyChange,
}: {
  channelId: string | null
  values: FrameExtractValues
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: MediaTransformSelectedMedia | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const [selectedMedia, setSelectedMedia] = React.useState<StorageMediaSelection | null>(null)
  const storageObjectId = stringValue(values.storage_object_id)
  const mode = stringValue(values.mode) || 'first'
  const sampleStart = numberValue(values.start_sec, 0)
  const sampleEnd = finiteNumber(values.end_sec) ?? finiteNumber(values.duration_sec)
  const sampleFps = numberValue(values.sampling_fps, 1)
  const sampleLimit = integerValue(values.max_frames, 120)
  const sampleEstimate = sampleEnd !== null && sampleEnd > sampleStart
    ? Math.ceil((sampleEnd - sampleStart) * sampleFps)
    : null
  const timestampsInput = stringValue(values[FRAME_TIMESTAMPS_INPUT_FIELD]) || (
    Array.isArray(values.timestamps)
      ? values.timestamps.filter((value): value is number => typeof value === 'number').join(', ')
      : ''
  )

  const chooseMode = (nextMode: string) => {
    onValueChange('mode', nextMode)
    if (nextMode !== 'timestamp') onValueChange('timestamp_sec', undefined)
    if (nextMode !== 'timestamps') {
      onValueChange('timestamps', undefined)
      onValueChange(FRAME_TIMESTAMPS_INPUT_FIELD, undefined)
    }
    if (nextMode !== 'interval') onValueChange('interval_sec', undefined)
    if (!['interval', 'evenly_spaced'].includes(nextMode)) onValueChange('count', undefined)
    if (nextMode !== 'sample_fps') {
      onValueChange('sampling_fps', undefined)
      onValueChange('start_sec', undefined)
      onValueChange('end_sec', undefined)
      onValueChange('max_frames', undefined)
    }
    Object.entries(getFrameExtractModeDefaults(nextMode)).forEach(([name, value]) => {
      onValueChange(name, value)
    })
  }

  return (
    <div className="space-y-5">
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

      <ToolSelectField label={tAuto('frame_selection_dfb89b41')} value={mode} options={MODE_OPTIONS} onValueChange={chooseMode} />

      {mode === 'timestamp' ? (
        <NumberField
          label={tAuto('time_6c82e6dd')}
          hint={tAuto('seconds_e_g_12_5_9f19180a')}
          value={values.timestamp_sec}
          min={0}
          max={86_400}
          step={0.01}
          onValueChange={(value) => onValueChange('timestamp_sec', value)}
        />
      ) : null}

      {mode === 'timestamps' ? (
        <ToolField label={tAuto('times_4b0f911f')} hint={tAuto('seconds_comma_separated_max_120_2c598f3e')}>
          <div className="space-y-1.5">
            <Input
              value={timestampsInput}
              placeholder="0, 2.5, 8, 12.4"
              onChange={(event) => {
                onValueChange(FRAME_TIMESTAMPS_INPUT_FIELD, event.target.value)
                onValueChange('timestamps', parseFrameTimestampsInput(event.target.value))
              }}
              className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
            />
            <p className="text-[11px] leading-4 text-muted-foreground">
              <UiText id="each_value_creates_one_image_frames_between_thes_cc219261" /></p>
          </div>
        </ToolField>
      ) : null}

      {mode === 'interval' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label={tAuto('every_3560d90b')}
              hint="seconds"
              value={values.interval_sec ?? 1}
              min={0.1}
              max={86_400}
              step={0.1}
              onValueChange={(value) => onValueChange('interval_sec', value)}
            />
            <NumberField
              label={tAuto('frame_limit_fc6d7334')}
              hint="maximum"
              value={values.count ?? 10}
              min={1}
              max={120}
              step={1}
              onValueChange={(value) => onValueChange('count', value == null ? undefined : Math.round(value))}
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            <UiText id="starts_at_0_seconds_then_captures_one_frame_ever_6a54f349" /></p>
        </>
      ) : null}

      {mode === 'evenly_spaced' ? (
        <ToolSliderField
          label={tAuto('frame_count_61cbc867')}
          value={integerValue(values.count, 6)}
          min={1}
          max={120}
          suffix={` ${tAuto('frames_unit')}`}
          presets={[1, 10, 30, 60, 120]}
          onValueChange={(value) => onValueChange('count', Math.round(value))}
        />
      ) : null}

      {mode === 'sample_fps' ? (
        <>
          <ToolSelectField
            label={tAuto('sampling_rate_cd8e2118')}
            value={String(numberValue(values.sampling_fps, 1))}
            options={SAMPLE_FPS_OPTIONS}
            onValueChange={(value) => onValueChange('sampling_fps', Number(value))}
          />
          <p className="rounded-xl border border-border bg-panel/40 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
            <UiText id="1_fps_creates_one_frame_each_second_0_5_fps_crea_6c3c8bb8" /></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label={tAuto('start_952f3754')}
              hint={tAuto('optional_seconds_344d2f45')}
              value={values.start_sec}
              min={0}
              max={86_400}
              step={0.1}
              onValueChange={(value) => onValueChange('start_sec', value)}
            />
            <NumberField
              label={tAuto('end_a2bb9d34')}
              hint={tAuto('optional_seconds_344d2f45')}
              value={values.end_sec}
              min={0.1}
              max={86_400}
              step={0.1}
              onValueChange={(value) => onValueChange('end_sec', value)}
            />
          </div>
          <ToolSliderField
            label={tAuto('safety_limit_89bd6212')}
            value={integerValue(values.max_frames, 120)}
            min={1}
            max={120}
            suffix={` ${tAuto('frames_unit')}`}
            presets={[10, 30, 60, 90, 120]}
            onValueChange={(value) => onValueChange('max_frames', Math.round(value))}
          />
          {sampleEstimate !== null ? (
            <p className={sampleEstimate > sampleLimit
              ? "rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive"
              : "rounded-xl border border-border bg-panel/40 px-3.5 py-3 text-xs leading-5 text-muted-foreground"}>
              {sampleEstimate > sampleLimit
                ? tAuto('frame_range_over_limit', { estimate: sampleEstimate, limit: sampleLimit })
                : tAuto('frames_will_be_extracted', { count: sampleEstimate })}
            </p>
          ) : null}
        </>
      ) : null}

      <ToolSelectField
        label={tAuto('output_4bed3361')}
        value={stringValue(values.output_format) || 'jpg'}
        options={FORMAT_OPTIONS}
        onValueChange={(value) => onValueChange('output_format', value)}
      />
    </div>
  )
}

export function FrameExtractAdvancedSettings({
  values,
  onValueChange,
}: {
  values: FrameExtractValues
  onValueChange: (name: string, value: unknown) => void
}) {
  const tAuto = useTranslations('Auto')
  const mode = stringValue(values.mode) || 'first'
  const resize = objectValue(values.resize)
  const sampleStart = numberValue(values.start_sec, 0)
  const sampleEnd = finiteNumber(values.end_sec) ?? finiteNumber(values.duration_sec)
  const sampleFps = numberValue(values.sampling_fps, 1)
  const sampleLimit = integerValue(values.max_frames, 120)
  const sampleEstimate = sampleEnd !== null && sampleEnd > sampleStart
    ? Math.ceil((sampleEnd - sampleStart) * sampleFps)
    : null
  const estimatedFrameCount = mode === 'first_last'
    ? 2
    : mode === 'timestamps' && Array.isArray(values.timestamps)
      ? Math.max(1, values.timestamps.length)
      : mode === 'interval' || mode === 'evenly_spaced'
        ? integerValue(values.count, 1)
        : mode === 'sample_fps'
          ? Math.min(sampleEstimate ?? sampleLimit, sampleLimit)
          : 1
  const resizeWidth = finiteNumber(resize.width)
  const resizeHeight = finiteNumber(resize.height)
  const resizeWorkloadTooLarge = resizeWidth !== null
    && resizeHeight !== null
    && estimatedFrameCount * resizeWidth * resizeHeight > MAX_FRAME_EXTRACT_PIXEL_FRAMES

  return (
    <div className="space-y-4 rounded-xl border border-border bg-panel/40 p-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={tAuto('width_a58ddf50')}
          hint="pixels"
          value={resize.width}
          min={16}
          max={4096}
          step={1}
          onValueChange={(value) => onValueChange('resize', compactObject({ ...resize, width: value }))}
        />
        <NumberField
          label={tAuto('height_3f608b49')}
          hint="pixels"
          value={resize.height}
          min={16}
          max={4096}
          step={1}
          onValueChange={(value) => onValueChange('resize', compactObject({ ...resize, height: value }))}
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        <UiText id="optional_output_size_leave_both_empty_to_keep_th_a6a0658f" /></p>
      {Boolean(resize.width) !== Boolean(resize.height) ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive">
          <UiText id="width_and_height_must_be_provided_together_5c82bc67" /></p>
      ) : null}
      {resizeWorkloadTooLarge ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive">
          <UiText id="this_frame_batch_is_too_large_to_render_safely_r_4a83cbde" /></p>
      ) : null}
      {resize.width && resize.height ? (
        <ToolSelectField
          label={tAuto('resize_fit_c2e11e52')}
          value={stringValue(resize.fit) || 'contain'}
          options={FIT_OPTIONS}
          onValueChange={(value) => onValueChange('resize', { ...resize, fit: value })}
        />
      ) : null}
    </div>
  )
}

function NumberField({ label, hint, value, min, max, step, onValueChange }: {
  label: string
  hint?: string
  value: unknown
  min: number
  max: number
  step: number
  onValueChange: (value: number | undefined) => void
}) {
  return (
    <ToolField label={label} hint={hint}>
      <Input
        type="number"
        value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onValueChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
      />
    </ToolField>
  )
}

export function parseFrameTimestampsInput(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const seconds = Number(entry)
      return Number.isFinite(seconds) && seconds >= 0 ? seconds : entry
    })
}

export function getFrameExtractModeDefaults(mode: string): Record<string, unknown> {
  if (mode === 'timestamp') return { timestamp_sec: 0 }
  if (mode === 'timestamps') {
    return { timestamps: [0], [FRAME_TIMESTAMPS_INPUT_FIELD]: '0' }
  }
  if (mode === 'interval') return { interval_sec: 1, count: 10 }
  if (mode === 'evenly_spaced') return { count: 6 }
  if (mode === 'sample_fps') return { sampling_fps: 1, start_sec: 0, max_frames: 120 }
  return {}
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''))
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function integerValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

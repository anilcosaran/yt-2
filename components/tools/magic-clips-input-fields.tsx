'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { AudioLines, Captions, ChevronDown, SlidersHorizontal } from 'lucide-react'

import {
  MediaTransformInputFields,
  type MediaTransformSelectedMedia,
} from '@/components/tools/media-transform-input-fields'
import { CaptionStylePicker } from '@/components/tools/caption-style-picker'
import { CAPTION_STYLE_NAMES } from '@/components/tools/caption-style-preview-field'
import {
  ToolField,
  ToolFieldHint,
  ToolSearchableSelectField,
  ToolSelectField,
  ToolSliderField,
  type ToolChoice,
} from '@/components/tools/tool-primitives'
import { CensorAudioFields } from './censor-audio-fields'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UiText } from '@/components/i18n/ui-text'
import { getLanguageDisplay } from '@/lib/i18n/language-display'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'
import { useTranslations } from 'next-intl'
import type { ViralClipsQuotaSnapshot } from '@/lib/workflows/api'

type MagicClipsValues = Record<string, unknown>

export type MagicClipsEstimateState = {
  estimatedCredits: number | null
  quotaSnapshot: ViralClipsQuotaSnapshot | null
  estimateErrorMessage: string | null
}

export const VIRAL_CLIPS_MIN_SOURCE_DURATION_SEC = 10 * 60
export const VIRAL_CLIPS_RECOMMENDED_SOURCE_DURATION_SEC = 20 * 60

const REMOVE_SILENCE_OPTIONS: ToolChoice[] = [
  { value: 'off', label: 'Keep original pacing', description: 'Preserve pauses and the source rhythm.' },
  { value: 'safe', label: 'Safe cleanup', description: 'Remove only verified pauses without cutting complete thoughts.' },
  { value: 'aggressive', label: 'Tighter cleanup', description: 'Shorten more pauses while preserving sentence boundaries.' },
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

const OUTPUT_QUALITY_OPTIONS: ToolChoice[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
]

const POSITION_OPTIONS: ToolChoice[] = [
  { value: 'style_default', label: 'Style default' },
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
]

const QUALITY_OPTIONS: ToolChoice[] = [
  { value: 'economy', label: 'Economy', description: 'Fastest caption render and lower cost.' },
  { value: 'standard', label: 'Standard', description: 'Balanced caption quality and render time.' },
  { value: 'high', label: 'High', description: 'Sharper captions with a slower render.' },
]

const CAPTION_TRANSLATION_LANGUAGE_OPTIONS: ToolChoice[] = [
  { value: 'tr', label: 'Turkish' },
  { value: 'de', label: 'German' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'el', label: 'Greek' },
  { value: 'fi', label: 'Finnish' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'no', label: 'Norwegian' },
  { value: 'sv', label: 'Swedish' },
  { value: 'vi', label: 'Vietnamese' },
].map((option) => ({ ...option, ...getLanguageDisplay(option.value, option.label) }))

const AUTO_SOURCE_LANGUAGE_OPTIONS: ToolChoice[] = [
  {
    ...getLanguageDisplay('auto', 'Auto'),
    value: 'auto',
    description: 'Detect the spoken language from the source audio.',
  },
]

const CAPTION_OUTPUT_LANGUAGE_OPTIONS: ToolChoice[] = [
  {
    value: 'original',
    label: 'Original spoken language',
    description: 'Use the transcript provider\'s original word timings without translation.',
    flagRegion: null,
  },
  ...CAPTION_TRANSLATION_LANGUAGE_OPTIONS,
]

export function MagicClipsInputFields({
  channelId,
  values,
  captionStyleValues,
  sourceLanguageOptions = AUTO_SOURCE_LANGUAGE_OPTIONS,
  estimateState = null,
  censorBeepEnabled = false,
  onValueChange,
  onStorageMediaSelectionChange,
  onBusyChange,
}: {
  channelId: string | null
  values: MagicClipsValues
  captionStyleValues: string[]
  sourceLanguageOptions?: ToolChoice[]
  estimateState?: MagicClipsEstimateState | null
  censorBeepEnabled?: boolean
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: MediaTransformSelectedMedia | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const editorialQualityOptions: ToolChoice[] = [
    {
      value: 'fast',
      label: tAuto('viral_clips_editorial_standard'),
      description: tAuto('viral_clips_editorial_standard_description'),
    },
    {
      value: 'pro',
      label: tAuto('viral_clips_editorial_pro'),
      description: tAuto('viral_clips_editorial_pro_description'),
    },
    {
      value: 'max',
      label: tAuto('viral_clips_editorial_max'),
      description: tAuto('viral_clips_editorial_max_description'),
    },
  ]
  const layoutOptions: ToolChoice[] = [
    {
      value: 'face_tracking',
      label: tAuto('viral_clips_layout_face_tracking'),
      description: tAuto('viral_clips_layout_face_tracking_description'),
    },
    {
      value: 'adaptive',
      label: tAuto('viral_clips_layout_adaptive'),
      description: tAuto('viral_clips_layout_adaptive_description'),
    },
    {
      value: 'full_frame',
      label: tAuto('viral_clips_layout_full_frame'),
      description: tAuto('viral_clips_layout_full_frame_description'),
    },
  ]
  const fullFrameBackgroundOptions: ToolChoice[] = [
    {
      value: 'blur',
      label: tAuto('viral_clips_background_blur'),
      description: tAuto('viral_clips_background_blur_description'),
    },
    {
      value: 'solid',
      label: tAuto('viral_clips_background_solid'),
      description: tAuto('viral_clips_background_solid_description'),
    },
  ]
  const backgroundColorOptions: ToolChoice[] = [
    { value: '#000000', label: tAuto('viral_clips_background_black') },
    { value: '#FFFFFF', label: tAuto('viral_clips_background_white') },
  ]
  const outputRatioOptions: ToolChoice[] = [
    { value: '9:16', label: tAuto('viral_clips_output_ratio_vertical') },
    { value: '1:1', label: tAuto('viral_clips_output_ratio_square') },
  ]
  const captionsEnabled = booleanValue(values.captions_enabled, false)
  const captionStyleOptions = styleOptions(captionStyleValues)
  const canvas = objectValue(values.canvas)
  const requestedLayout = stringValue(values.layout)
  const selectedLayout = requestedLayout === 'adaptive' || requestedLayout === 'speaker_focus'
    ? 'adaptive'
    : requestedLayout === 'full_frame' || requestedLayout === 'fit_full_frame'
      ? 'full_frame'
      : 'face_tracking'
  const canvasFit = stringValue(canvas.fit)
  const fullFrameBackground = canvasFit === 'fit' ? 'solid' : 'blur'
  const backgroundColor = stringValue(canvas.background).toUpperCase() === '#FFFFFF'
    ? '#FFFFFF'
    : '#000000'
  const outputRatio = stringValue(canvas.aspect_ratio) === '1:1' ? '1:1' : '9:16'
  const output = objectValue(values.output)
  const allowedOutputFormats = getMagicClipAllowedOutputFormats(captionsEnabled)
  const outputFormat = stringValue(output.format).toLowerCase() || 'mp4'
  const webmSelected = outputFormat === 'webm'
  const sourceDurationSeconds = numberValue(values.duration_sec, Number.NaN)
  const sourceTooShort = Number.isFinite(sourceDurationSeconds)
    && sourceDurationSeconds < VIRAL_CLIPS_MIN_SOURCE_DURATION_SEC
  const sourceBelowRecommendation = Number.isFinite(sourceDurationSeconds)
    && sourceDurationSeconds >= VIRAL_CLIPS_MIN_SOURCE_DURATION_SEC
    && sourceDurationSeconds < VIRAL_CLIPS_RECOMMENDED_SOURCE_DURATION_SEC
  const audioMode = stringValue(output.audio) || 'keep'
  const volumePercent = boundedNumber(output.volume_percent, 100, 0, 200)
  const publishedSourceLanguageOptions = sourceLanguageOptions.length > 0
    ? sourceLanguageOptions
    : AUTO_SOURCE_LANGUAGE_OPTIONS
  const requestedSourceLanguage = stringValue(values.source_language) || 'auto'
  const resolvedSourceLanguage = publishedSourceLanguageOptions.find(
    (option) => option.value.replaceAll('_', '-').toLowerCase()
      === requestedSourceLanguage.replaceAll('_', '-').toLowerCase(),
  )
  const fallbackSourceLanguage = publishedSourceLanguageOptions.find((option) => option.value === 'auto')
    ?? publishedSourceLanguageOptions[0]
    ?? AUTO_SOURCE_LANGUAGE_OPTIONS[0]
  const selectedSourceLanguage = resolvedSourceLanguage?.value ?? fallbackSourceLanguage.value
  const [sourceLanguageNotice, setSourceLanguageNotice] = useState<string | null>(null)
  const captionsToggleId = useId()
  const captionsSettingsId = useId()

  useEffect(() => {
    if (selectedSourceLanguage === requestedSourceLanguage) return
    onValueChange('source_language', selectedSourceLanguage)
    if (!resolvedSourceLanguage) {
      queueMicrotask(() => setSourceLanguageNotice(
        tAuto('spoken_language_reset', { language: toolCopy(fallbackSourceLanguage.label) }),
      ))
    }
  }, [fallbackSourceLanguage.label, onValueChange, requestedSourceLanguage, resolvedSourceLanguage, selectedSourceLanguage, tAuto, toolCopy])

  useEffect(() => {
    const normalizedCanvas = normalizeMagicClipsCanvasForLayout(canvas, selectedLayout)
    if (normalizedCanvas !== canvas) onValueChange('canvas', normalizedCanvas)
  }, [canvas, onValueChange, selectedLayout])

  const setObjectField = (
    section: 'canvas' | 'output',
    name: string,
    value: unknown,
  ) => {
    const next = { ...objectValue(values[section]) }
    if (value === undefined || value === null || value === '') delete next[name]
    else next[name] = value
    onValueChange(section, next)
  }

  const setCaptionsEnabled = (checked: boolean) => onValueChange('captions_enabled', checked)

  const setLayout = (layout: string) => {
    onValueChange('layout', layout)
    const normalizedCanvas = normalizeMagicClipsCanvasForLayout(canvas, layout)
    if (normalizedCanvas !== canvas) onValueChange('canvas', normalizedCanvas)
  }

  const setFullFrameBackground = (value: string) => {
    onValueChange('canvas', {
      ...canvas,
      aspect_ratio: outputRatio,
      fit: value === 'solid' ? 'fit' : 'blur',
      ...(value === 'solid' ? { background: backgroundColor } : {}),
    })
  }

  return (
    <MediaTransformInputFields
      channelId={channelId}
      values={values}
      onValueChange={onValueChange}
      onStorageMediaSelectionChange={onStorageMediaSelectionChange}
      onBusyChange={onBusyChange}
      showTrim={false}
      presentation="media-only"
      allowedOutputFormats={allowedOutputFormats}
      afterMedia={(
        <>
          {estimateState?.estimateErrorMessage ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive">
              {toolCopy(estimateState.estimateErrorMessage)}
            </p>
          ) : estimateState?.quotaSnapshot?.limited && estimateState.estimatedCredits !== null ? (
            <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
              {tAuto('viral_clips_quota_limited_warning', {
                remaining: estimateState.quotaSnapshot.remaining_clips,
                max: estimateState.quotaSnapshot.max_clips_this_run,
                credits: estimateState.estimatedCredits,
              })}
            </p>
          ) : null}

          {sourceTooShort ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive">
              {tAuto('viral_clips_source_minimum_error')}
            </p>
          ) : sourceBelowRecommendation ? (
            <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
              {tAuto('viral_clips_source_recommendation')}
            </p>
          ) : null}

          <ToolSelectField
            label={tAuto('viral_clips_layout_label')}
            hint={tAuto('viral_clips_layout_hint')}
            hintMode="tooltip"
            value={selectedLayout}
            options={layoutOptions}
            onValueChange={setLayout}
          />

          {selectedLayout === 'full_frame' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ToolSelectField
                label={tAuto('viral_clips_background_treatment_label')}
                value={fullFrameBackground}
                options={fullFrameBackgroundOptions}
                onValueChange={setFullFrameBackground}
              />
              {fullFrameBackground === 'solid' ? (
                <ToolSelectField
                  label={tAuto('viral_clips_background_color_label')}
                  value={backgroundColor}
                  options={backgroundColorOptions}
                  onValueChange={(value) => setObjectField('canvas', 'background', value)}
                />
              ) : null}
            </div>
          ) : null}

          <section
            aria-label={tAuto('add_captions_2c9dde9e')}
            className="@container min-w-0 rounded-xl border border-border bg-panel/20"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Captions aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <label htmlFor={captionsToggleId} className="cursor-pointer text-sm font-semibold">
                  {tAuto('add_captions_2c9dde9e')}
                </label>
                <ToolFieldHint
                  label={tAuto('add_captions_2c9dde9e')}
                  hint={webmSelected
                    ? tAuto('viral_clips_caption_requires_mp4')
                    : captionsEnabled
                      ? tAuto('caption_every_generated_clip_785db917')
                      : tAuto('return_clean_clips_without_burned_in_text_fb6bfc7c')}
                />
              </div>
              <Switch
                id={captionsToggleId}
                aria-controls={captionsEnabled ? captionsSettingsId : undefined}
                checked={captionsEnabled}
                disabled={webmSelected && !captionsEnabled}
                onCheckedChange={setCaptionsEnabled}
              />
            </div>

            {captionsEnabled ? (
              <div id={captionsSettingsId} className="min-w-0 space-y-4 border-t border-border/60 p-4">
                <CaptionStylePicker
                  label={tAuto('caption_style_1f85dcb1')}
                  value={stringValue(values.caption_style) || 'auto'}
                  options={captionStyleOptions}
                  resolvedStyleName={resolveMagicClipsAutoCaptionStyle(canvas)}
                  onValueChange={(value) => onValueChange('caption_style', value)}
                />
                <ToolSelectField
                  label={tAuto('caption_output_language_7983afda')}
                  hint={tAuto('translation_runs_only_when_this_differs_from_the_4e510129')}
                  hintMode="tooltip"
                  value={stringValue(values.caption_language) || 'original'}
                  options={CAPTION_OUTPUT_LANGUAGE_OPTIONS}
                  onValueChange={(value) => onValueChange('caption_language', value)}
                />
                <div className="grid min-w-0 gap-4 @min-[24rem]:grid-cols-2">
                  <ToolSelectField
                    label={tAuto('caption_position_c329a027')}
                    value={stringValue(values.caption_position) || 'style_default'}
                    options={POSITION_OPTIONS}
                    onValueChange={(value) => onValueChange('caption_position', value)}
                  />
                  <ToolSelectField
                    label={tAuto('caption_quality_b1de4e59')}
                    value={stringValue(values.caption_quality) || 'standard'}
                    options={QUALITY_OPTIONS}
                    onValueChange={(value) => onValueChange('caption_quality', value)}
                  />
                </div>
                <ToolSliderField
                  label={tAuto('caption_font_size_0e3df077')}
                  value={integerValue(values.caption_font_size, 44)}
                  min={18}
                  max={96}
                  suffix=" px"
                  onValueChange={(value) => onValueChange('caption_font_size', Math.round(value))}
                />
              </div>
            ) : null}
          </section>

          <MagicAdvancedSettings>
            <ToolField
              label={tAuto('viral_clips_find_moment_label')}
              hint={tAuto('viral_clips_find_moment_hint')}
              hintMode="tooltip"
            >
              <Input
                aria-label={tAuto('viral_clips_find_moment_label')}
                value={stringValue(values.clip_focus)}
                maxLength={200}
                placeholder={tAuto('viral_clips_find_moment_placeholder')}
                onChange={(event) => onValueChange('clip_focus', event.target.value)}
                className="h-10 rounded-xl border-border bg-panel/40 shadow-none"
              />
            </ToolField>

            <div className="grid min-w-0 gap-4 @min-[24rem]:grid-cols-2 @min-[36rem]:grid-cols-3">
              <ToolSelectField
                label={tAuto('editorial_quality_cb55e12e')}
                hint={tAuto('viral_clips_editorial_quality_hint')}
                hintMode="tooltip"
                value={stringValue(values.editorial_quality) || 'fast'}
                options={editorialQualityOptions}
                onValueChange={(value) => onValueChange('editorial_quality', value)}
              />
              <ToolSelectField
                label={tAuto('viral_clips_output_ratio_label')}
                hint={tAuto('viral_clips_output_ratio_hint')}
                hintMode="tooltip"
                value={outputRatio}
                options={outputRatioOptions}
                onValueChange={(value) => setObjectField('canvas', 'aspect_ratio', value)}
              />
              <div className="min-w-0 space-y-1.5 @min-[24rem]:col-span-2 @min-[36rem]:col-span-1">
                <ToolSearchableSelectField
                  label={tAuto('spoken_language_1b1b271c')}
                  hint={tAuto('auto_or_an_explicit_language_hint_supported_by_t_566f7ad5')}
                  hintMode="tooltip"
                  value={selectedSourceLanguage}
                  options={publishedSourceLanguageOptions.map((option) => ({
                    ...option,
                    code: option.value.toLowerCase() === 'auto' ? undefined : option.code,
                    description: undefined,
                  }))}
                  popoverClassName="w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-2rem)]"
                  searchPlaceholder={tAuto('search_language_or_code_dd825b6c')}
                  emptyMessage={tAuto('no_supported_language_matches_your_search_bee84336')}
                  onValueChange={(value) => {
                    setSourceLanguageNotice(null)
                    onValueChange('source_language', value)
                  }}
                />
                {sourceLanguageNotice ? (
                  <p role="status" className="text-xs leading-5 text-amber-700 dark:text-amber-300">{sourceLanguageNotice}</p>
                ) : null}
              </div>
            </div>

            <Tabs
              defaultValue="audio"
              className="min-w-0 gap-4 border-t border-border/60 pt-4"
            >
              <TabsList className="h-9 w-full min-w-0 bg-background/60">
                <TabsTrigger value="audio" className="min-w-0 px-2 text-xs">
                  {tAuto('audio_acdac205')}
                </TabsTrigger>
                <TabsTrigger value="output" className="min-w-0 px-2 text-xs">
                  {tAuto('output_4bed3361')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="audio" forceMount className="min-w-0 space-y-4 data-[state=inactive]:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AudioLines aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{tAuto('keep_audio_dca5bbea')}</span>
                    <ToolFieldHint
                      label={tAuto('keep_audio_dca5bbea')}
                      hint={audioMode === 'keep'
                        ? tAuto('source_audio_is_included_4b08b15a')
                        : tAuto('the_result_is_muted_bff1a601')}
                    />
                  </div>
                  <Switch
                    aria-label={tAuto('keep_audio_dca5bbea')}
                    checked={audioMode === 'keep'}
                    onCheckedChange={(checked) => onValueChange('output', {
                      ...output,
                      audio: checked ? 'keep' : 'mute',
                      volume_percent: checked ? (volumePercent === 0 ? 100 : volumePercent) : 0,
                    })}
                  />
                </div>
                <div className="grid min-w-0 items-start gap-4 @min-[24rem]:grid-cols-2">
                  {audioMode === 'keep' ? (
                    <ToolSliderField
                      label={tAuto('volume_3b18e8e3')}
                      value={volumePercent}
                      min={0}
                      max={200}
                      suffix="%"
                      onValueChange={(value) => setObjectField('output', 'volume_percent', Math.round(value))}
                    />
                  ) : null}
                  <ToolSelectField
                    label={tAuto('viral_clips_remove_silences_label')}
                    value={normalizeRemoveSilence(values.remove_silence)}
                    options={REMOVE_SILENCE_OPTIONS}
                    onValueChange={(value) => onValueChange('remove_silence', value)}
                  />
                </div>
                <div className="min-w-0 border-t border-border/60 pt-4">
                  <CensorAudioFields values={values} audioEnabled={audioMode === 'keep'}
                    captionsEnabled={captionsEnabled} sourceLanguage={selectedSourceLanguage}
                    beepEnabled={censorBeepEnabled} onValueChange={onValueChange} />
                </div>
              </TabsContent>

              <TabsContent value="output" forceMount className="min-w-0 data-[state=inactive]:hidden">
                <div className="grid min-w-0 gap-4 @min-[24rem]:grid-cols-2">
                  <ToolSelectField
                    label={tAuto('output_format_c03f08a8')}
                    hint={captionsEnabled ? tAuto('viral_clips_caption_requires_mp4') : undefined}
                    hintMode="tooltip"
                    value={outputFormat}
                    options={FORMAT_OPTIONS.map((option) => option.value === 'webm' && captionsEnabled
                      ? {
                          ...option,
                          disabled: true,
                          description: tAuto('viral_clips_caption_requires_mp4'),
                        }
                      : option)}
                    onValueChange={(value) => setObjectField('output', 'format', value)}
                  />
                  <ToolSelectField
                    label={tAuto('output_quality_3ee82c6d')}
                    value={stringValue(output.quality) || 'high'}
                    options={OUTPUT_QUALITY_OPTIONS}
                    onValueChange={(value) => setObjectField('output', 'quality', value)}
                  />
                  <ToolSelectField
                    label={tAuto('orientation_86e4e387')}
                    value={String(integerValue(output.rotation_degrees, 0))}
                    options={ROTATION_OPTIONS}
                    onValueChange={(value) => setObjectField('output', 'rotation_degrees', Number(value))}
                  />
                  <ToolSelectField
                    label={tAuto('flip_5836b271')}
                    value={stringValue(output.flip) || 'none'}
                    options={FLIP_OPTIONS}
                    onValueChange={(value) => setObjectField('output', 'flip', value)}
                  />
                </div>
              </TabsContent>

            </Tabs>

            <div className="flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>{tAuto('viral_clips_server_owned_duration_title')}</span>
              <ToolFieldHint
                label={tAuto('viral_clips_server_owned_duration_title')}
                hint={tAuto('viral_clips_server_owned_duration_description')}
              />
            </div>
          </MagicAdvancedSettings>
        </>
      )}
    />
  )
}

function MagicAdvancedSettings({ children }: { children: ReactNode }) {
  return (
    <details className="group @container min-w-0 rounded-xl border border-border bg-panel/20">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1"><UiText id="advanced_settings_2e8bbf39" /></span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="min-w-0 space-y-4 border-t border-border/60 p-4">
        {children}
      </div>
    </details>
  )
}

function styleOptions(values: string[]): ToolChoice[] {
  const unique = Array.from(new Set(['auto', ...CAPTION_STYLE_NAMES, ...values].filter(Boolean)))
  return unique.map((value) => ({ value, label: optionLabel(value) }))
}

function resolveMagicClipsAutoCaptionStyle(canvas: Record<string, unknown>) {
  const aspectRatio = stringValue(canvas.aspect_ratio)
  if (aspectRatio === '16:9') return 'word_highlight_yellow'
  if (aspectRatio === '1:1') return 'box_black'
  return 'tiktok_bold'
}

function optionLabel(value: string) {
  if (value === '3d_pop') return '3D Pop'
  if (value === 'youtube_clean') return 'YouTube Clean'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function getMagicClipAllowedOutputFormats(captionsEnabled: boolean): Array<'mp4' | 'webm'> {
  return captionsEnabled ? ['mp4'] : ['mp4', 'webm']
}

export function normalizeMagicClipsCanvasForLayout(
  canvas: Record<string, unknown>,
  layout: string,
): Record<string, unknown> {
  const aspectRatio = stringValue(canvas.aspect_ratio)
  const fit = stringValue(canvas.fit)
  const fullFrame = layout === 'full_frame' || layout === 'fit_full_frame'
  const needsAspectRatio = aspectRatio !== '9:16' && aspectRatio !== '1:1'
  const needsFit = fullFrame && fit !== 'blur' && fit !== 'fit'
  if (!needsAspectRatio && !needsFit) return canvas

  return {
    ...canvas,
    ...(needsAspectRatio ? { aspect_ratio: '9:16' } : {}),
    ...(needsFit ? { fit: 'blur' } : {}),
  }
}

function normalizeRemoveSilence(value: unknown) {
  if (value === true) return 'safe'
  if (value === 'safe' || value === 'aggressive') return value
  return 'off'
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

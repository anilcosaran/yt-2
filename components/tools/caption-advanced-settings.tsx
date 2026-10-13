'use client'

import { Eye, RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ToolField,
  ToolSelectField,
  ToolSliderField,
  ToolToggleRow,
} from '@/components/tools/tool-primitives'
import {
  getCaptionPresetPalette,
  normalizeCaptionFontScale,
  type CaptionVisibilityOverrides,
} from '@/components/tools/caption-style-preview-field'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export function CaptionDualLanguageSettings({
  fontSize = 44,
  bilingualOrder = 'source_above',
  sourceStyleName = 'inherit',
  translationStyleName = 'inherit',
  sourceFontScale = 0.8,
  translationFontScale = 1,
  styleOptions = [],
  onBilingualOrderChange,
  onSourceStyleNameChange,
  onTranslationStyleNameChange,
  onSourceFontScaleChange,
  onTranslationFontScaleChange,
}: {
  fontSize?: number
  bilingualOrder?: 'source_above' | 'translation_above'
  sourceStyleName?: string
  translationStyleName?: string
  sourceFontScale?: number
  translationFontScale?: number
  styleOptions?: ReadonlyArray<{ value: string; label: string }>
  onBilingualOrderChange?: (order: 'source_above' | 'translation_above') => void
  onSourceStyleNameChange?: (styleName: string) => void
  onTranslationStyleNameChange?: (styleName: string) => void
  onSourceFontScaleChange?: (scale: number) => void
  onTranslationFontScaleChange?: (scale: number) => void
}) {
  const tAuto = useTranslations('Auto')
  const normalizedSourceScale = normalizeCaptionFontScale(sourceFontScale, 0.8)
  const normalizedTranslationScale = normalizeCaptionFontScale(translationFontScale, 1)
  const dualStyleOptions = [
    { value: 'inherit', label: 'Same as Caption Style' },
    ...styleOptions.filter((option) => option.value !== 'inherit'),
  ]
  const selectedSourceStyle = dualStyleOptions.some((option) => option.value === sourceStyleName)
    ? sourceStyleName
    : 'inherit'
  const selectedTranslationStyle = dualStyleOptions.some((option) => option.value === translationStyleName)
    ? translationStyleName
    : 'inherit'

  return (
    <div
      data-caption-dual-language-layout="true"
      className="space-y-4 rounded-xl border border-border bg-panel/40 p-3.5"
    >
      <div>
        <p className="text-sm font-semibold text-foreground"><UiText id="dual_language_appearance_060c40be" /></p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          <UiText id="style_size_and_line_order_can_be_set_independent_5441f9fb" /></p>
      </div>

      <ToolSelectField
        label={tAuto('language_order_c1ba2e21')}
        value={bilingualOrder}
        options={[
          { value: 'source_above', label: 'Original Above · Translation Below' },
          { value: 'translation_above', label: 'Translation Above · Original Below' },
        ]}
        onValueChange={(value) => onBilingualOrderChange?.(
          value === 'translation_above' ? 'translation_above' : 'source_above',
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ToolSelectField
          label={tAuto('original_caption_style_776e95e6')}
          value={selectedSourceStyle}
          options={dualStyleOptions}
          onValueChange={(value) => onSourceStyleNameChange?.(value)}
        />
        <ToolSelectField
          label={tAuto('translated_caption_style_a26e238c')}
          value={selectedTranslationStyle}
          options={dualStyleOptions}
          onValueChange={(value) => onTranslationStyleNameChange?.(value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToolSliderField
          label={tAuto('original_line_size', { size: Math.round(fontSize * normalizedSourceScale) })}
          value={Math.round(normalizedSourceScale * 100)}
          min={50}
          max={150}
          suffix="%"
          presets={[70, 80, 100, 120, 140]}
          onValueChange={(value) => onSourceFontScaleChange?.(normalizeCaptionFontScale(value / 100, 0.8))}
        />
        <ToolSliderField
          label={tAuto('translation_line_size', { size: Math.round(fontSize * normalizedTranslationScale) })}
          value={Math.round(normalizedTranslationScale * 100)}
          min={50}
          max={150}
          suffix="%"
          presets={[70, 80, 100, 120, 140]}
          onValueChange={(value) => onTranslationFontScaleChange?.(normalizeCaptionFontScale(value / 100, 1))}
        />
      </div>
    </div>
  )
}

export function CaptionAdvancedSettings({
  quality,
  position = 'bottom',
  styleName,
  overrides,
  onQualityChange,
  onOverridesChange,
}: {
  quality: string
  position?: string
  styleName: string
  overrides: CaptionVisibilityOverrides
  onQualityChange: (quality: 'standard' | 'high') => void
  onOverridesChange: (overrides: CaptionVisibilityOverrides) => void
}) {
  const tAuto = useTranslations('Auto')
  const visibilityEnabled = overrides.visibility_enabled === true
  const customPositionY = overrides.position_y
  const defaultPositionY = position === 'top'
    ? 0.14
    : position === 'middle'
      ? 0.5
      : 0.84
  const palette = getCaptionPresetPalette(styleName)
  const shadowStrength = overrides.shadow_strength ?? 'style_default'
  const hasBackgroundOverride = overrides.background_opacity !== undefined
  const backgroundOpacity = clamp(
    overrides.background_opacity ?? 0.2,
    0,
    0.7,
  )
  const fontColor = normalizeHexColor(overrides.font_color) ?? palette.fontColor
  const highlightColor = normalizeHexColor(overrides.highlight_color) ?? palette.highlightColor
  const effectColor = normalizeHexColor(overrides.effect_color) ?? palette.effectColor
  const hasVisibilityCustomization = overrides.shadow_strength !== undefined
    || overrides.background_opacity !== undefined
    || overrides.font_color !== undefined
    || overrides.highlight_color !== undefined
    || overrides.effect_color !== undefined

  const updateOverride = <Key extends keyof CaptionVisibilityOverrides>(
    key: Key,
    value: CaptionVisibilityOverrides[Key] | undefined,
  ) => {
    const next: Record<string, unknown> = { ...overrides, visibility_enabled: true }
    if (value === undefined) delete next[key]
    else next[key] = value
    onOverridesChange(next as CaptionVisibilityOverrides)
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-panel/40 p-3.5">
      <ToolToggleRow
        icon={SlidersHorizontal}
        label={tAuto('custom_vertical_position_257907c8')}
        description={customPositionY === undefined
          ? tAuto('use_the_selected_style_position_ad0f1160')
          : `${Math.round(customPositionY * 100)}% from the top`}
        checked={customPositionY !== undefined}
        onCheckedChange={(checked) => {
          if (checked) {
            onOverridesChange({ ...overrides, position_y: defaultPositionY })
            return
          }
          const { position_y: _positionY, ...rest } = overrides
          onOverridesChange(rest)
        }}
      />
      {customPositionY !== undefined ? (
        <div className="space-y-1.5 border-l-2 border-primary/25 pl-3">
          <ToolSliderField
            label={tAuto('vertical_position_bcceda3c')}
            value={Math.round(customPositionY * 100)}
            min={8}
            max={92}
            suffix="%"
            presets={[14, 35, 50, 70, 84]}
            onValueChange={(value) => updateOverride('position_y', clamp(value / 100, 0.08, 0.92))}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            <UiText id="8_is_near_the_top_92_is_near_the_bottom_preview__8bbaa90e" />
          </p>
        </div>
      ) : null}

      <ToolSelectField
        label={tAuto('output_quality_3ee82c6d')}
        value={quality === 'high' ? 'high' : 'standard'}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'high', label: 'Best Quality' },
        ]}
        onValueChange={(value) => onQualityChange(value === 'high' ? 'high' : 'standard')}
      />
      <p className="-mt-2 text-xs leading-5 text-muted-foreground">
        <UiText id="best_quality_keeps_movement_and_caption_edges_cl_0bb56538" /></p>

      <ToolToggleRow
        icon={Eye}
        label={tAuto('caption_visibility_751d852f')}
        description={visibilityEnabled
          ? hasVisibilityCustomization
            ? tAuto('custom_readability_controls_enabled_85b15a02')
            : tAuto('enabled_using_the_selected_style_defaults_0501c77f')
          : tAuto('using_the_selected_style_defaults_613e0f19')}
        checked={visibilityEnabled}
        onCheckedChange={(checked) => {
          onOverridesChange(checked
            ? { ...overrides, visibility_enabled: true }
            : { ...overrides, visibility_enabled: false })
        }}
      />

      {visibilityEnabled ? (
        <div className="space-y-4 border-l-2 border-primary/25 pl-3">
          {hasVisibilityCustomization ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onOverridesChange({
                    visibility_enabled: true,
                    ...(overrides.position_y === undefined ? {} : { position_y: overrides.position_y }),
                  })}
                >
                  <RotateCcw className="size-3.5" />
                  <UiText id="use_all_style_defaults_961760cd" /></Button>
              </div>
            ) : null}
          <ToolSelectField
            label={tAuto('shadow_aa0e7e86')}
            value={shadowStrength}
            options={[
              { value: 'style_default', label: 'Style default' },
              { value: 'off', label: 'Off' },
              { value: 'soft', label: 'Soft' },
              { value: 'strong', label: 'Strong' },
            ]}
            onValueChange={(value) => updateOverride(
              'shadow_strength',
              value === 'style_default'
                ? undefined
                : value === 'strong'
                  ? 'strong'
                  : value === 'off'
                    ? 'off'
                    : 'soft',
            )}
          />

          <ToolToggleRow
            icon={Eye}
            label={tAuto('custom_background_a4109e17')}
            description={hasBackgroundOverride ? tAuto('overrides_this_style_background_3f566646') : tAuto('using_the_selected_style_background_bef89ee9')}
            checked={hasBackgroundOverride}
            onCheckedChange={(checked) => updateOverride('background_opacity', checked ? 0.2 : undefined)}
          />
          {hasBackgroundOverride ? (
            <ToolSliderField
              label={tAuto('background_opacity_f12e36bd')}
              value={Math.round(backgroundOpacity * 100)}
              min={0}
              max={70}
              suffix="%"
              presets={[0, 15, 25, 40, 60]}
              onValueChange={(value) => updateOverride('background_opacity', clamp(value / 100, 0, 0.7))}
            />
          ) : null}
          <p className="-mt-2 text-xs leading-5 text-muted-foreground">
            <UiText id="unchanged_controls_inherit_the_selected_caption__e8271777" /></p>

          <CaptionColorField
            label={tAuto('text_color_1c7a30e5')}
            value={fontColor}
            usingStyleColor={!normalizeHexColor(overrides.font_color)}
            onChange={(value) => updateOverride('font_color', value)}
            onReset={() => updateOverride('font_color', undefined)}
          />

          {palette.supportsHighlight ? (
            <CaptionColorField
              label={tAuto('highlight_color_844a3587')}
              hint={tAuto('highlighted_words_1b8f9cb6')}
              value={highlightColor}
              usingStyleColor={!normalizeHexColor(overrides.highlight_color)}
              onChange={(value) => updateOverride('highlight_color', value)}
              onReset={() => updateOverride('highlight_color', undefined)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-3.5 py-3 text-xs leading-5 text-muted-foreground">
              <UiText id="this_caption_style_does_not_use_a_separate_highl_59a7c446" /></p>
          )}

          {palette.supportsEffect ? (
            <CaptionColorField
              label={tAuto('outline_depth_color_e048809f')}
              hint={tAuto('stroke_and_3d_offset_2cdccd82')}
              value={effectColor}
              usingStyleColor={!normalizeHexColor(overrides.effect_color)}
              onChange={(value) => updateOverride('effect_color', value)}
              onReset={() => updateOverride('effect_color', undefined)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function CaptionColorField({
  label,
  hint,
  value,
  usingStyleColor,
  onChange,
  onReset,
}: {
  label: string
  hint?: string
  value: string
  usingStyleColor: boolean
  onChange: (value: string) => void
  onReset: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <ToolField
      label={label}
      hint={hint}
      action={usingStyleColor ? (
        <span className="text-xs text-muted-foreground"><UiText id="style_color_10a58bd0" /></span>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          <UiText id="use_style_color_8aefe79b" /></Button>
      )}
    >
      <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-panel/40 px-3.5">
        <Input
          type="color"
          aria-label={tAuto('color_picker_label', { label })}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-7 w-10 cursor-pointer border-0 bg-transparent p-0 shadow-none"
        />
        <span className="font-mono text-sm uppercase text-foreground">{value}</span>
        <span className="ml-auto size-5 rounded-full border border-white/15" style={{ backgroundColor: value }} />
      </div>
    </ToolField>
  )
}

export function readCaptionVisibilityOverrides(value: unknown): CaptionVisibilityOverrides {
  const record = asRecord(value)
  const visibilityEnabled = record.visibility_enabled === true
  const shadow = record.shadow_strength
  const backgroundOpacity = typeof record.background_opacity === 'number'
    && Number.isFinite(record.background_opacity)
    ? clamp(record.background_opacity, 0, 0.7)
    : undefined
  const positionY = typeof record.position_y === 'number'
    && Number.isFinite(record.position_y)
    ? clamp(record.position_y, 0.08, 0.92)
    : undefined
  return {
    visibility_enabled: visibilityEnabled,
    ...(positionY === undefined ? {} : { position_y: positionY }),
    ...(shadow === 'off' || shadow === 'soft' || shadow === 'strong'
      ? { shadow_strength: shadow }
      : {}),
    ...(backgroundOpacity === undefined ? {} : { background_opacity: backgroundOpacity }),
    ...(normalizeHexColor(record.font_color) ? { font_color: normalizeHexColor(record.font_color)! } : {}),
    ...(normalizeHexColor(record.highlight_color) ? { highlight_color: normalizeHexColor(record.highlight_color)! } : {}),
    ...(normalizeHexColor(record.effect_color) ? { effect_color: normalizeHexColor(record.effect_color)! } : {}),
  }
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'

import { Film } from 'lucide-react'

import { ToolMediaLoadingIndicator } from '@/components/tools/tool-media-loading-indicator'
import { Skeleton } from '@/components/ui/skeleton'
import { UiText } from '@/components/i18n/ui-text'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'
import { useTranslations } from 'next-intl'

export type CaptionPreviewMedia = {
  name: string
  previewUrl: string | null
  width: number | null
  height: number | null
  dimensionSource?: 'source' | 'preview'
  durationSeconds: number | null
}

export type CaptionVisibilityOverrides = {
  visibility_enabled?: boolean
  position_y?: number
  shadow_strength?: 'off' | 'soft' | 'strong'
  background_opacity?: number
  font_color?: string
  highlight_color?: string
  effect_color?: string
}

export type CaptionSubtitleMode = 'original' | 'translated' | 'bilingual'

export type CaptionBilingualOrder = 'source_above' | 'translation_above'

export type CaptionDualLanguageStyleName = 'inherit' | string

type PreviewPreset = {
  color: string
  accent: string
  fontFamily?: string
  letterSpacing?: number
  background?: string
  outline?: string
  outlineWidth: number
  shadowColor?: string
  shadowDepth?: number
  weight?: number
  italic?: boolean
  uppercase?: boolean
  mode?: 'phrase' | 'word_pop' | 'karaoke' | 'word' | 'sentence' | 'typewriter' | 'kinetic_slide' | 'focus_fade'
  popAnimation?: boolean
  positionY: number
  maxWidthRatio: number
  wordsPerLine: number
  maxCharsPerLine: number
  boxPadding?: number
  highlightScale: number
}

const DEFAULT_CAPTION_FONT_SIZE = 44

const ORIGINAL_PREVIEW_TEXT = 'Make every moment count'

const TRANSLATED_PREVIEW_TEXT: Record<string, string> = {
  cs: 'Ať se počítá každý okamžik',
  da: 'Få hvert øjeblik til at tælle',
  de: 'Lass jeden Moment zählen',
  el: 'Κάνε κάθε στιγμή να μετράει',
  en: ORIGINAL_PREVIEW_TEXT,
  es: 'Haz que cada momento cuente',
  fi: 'Tee jokaisesta hetkestä tärkeä',
  fr: 'Faites que chaque instant compte',
  hu: 'Minden pillanat számítson',
  id: 'Jadikan setiap momen berarti',
  it: 'Fai contare ogni momento',
  ms: 'Jadikan setiap detik bermakna',
  nl: 'Laat elk moment tellen',
  no: 'La hvert øyeblikk telle',
  pl: 'Niech każda chwila się liczy',
  pt: 'Faça cada momento valer',
  'pt-BR': 'Faça cada momento valer a pena',
  ro: 'Fă ca fiecare clipă să conteze',
  ru: 'Пусть каждый момент имеет значение',
  sv: 'Låt varje ögonblick räknas',
  tr: 'Her anı değerli kıl',
  uk: 'Нехай кожна мить має значення',
  vi: 'Hãy làm cho mọi khoảnh khắc đáng giá',
}

const DEFAULT_PRESET: PreviewPreset = {
  color: '#ffffff',
  accent: '#ffe600',
  outline: '#000000',
  outlineWidth: 2,
  weight: 400,
  mode: 'phrase',
  positionY: 0.84,
  maxWidthRatio: 0.86,
  wordsPerLine: 3,
  maxCharsPerLine: 26,
  highlightScale: 1.10,
}

const PRESETS: Record<string, PreviewPreset> = {
  classic_white: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', weight: 400, wordsPerLine: 6, maxCharsPerLine: 38, highlightScale: 1 },
  classic_bold: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outlineWidth: 3, weight: 800, positionY: 0.90, wordsPerLine: 7, maxCharsPerLine: 44, highlightScale: 1 },
  classic_black: { ...DEFAULT_PRESET, color: '#111', accent: '#e32636', outline: '#fff', outlineWidth: 3, weight: 400, wordsPerLine: 6, maxCharsPerLine: 38, highlightScale: 1 },
  bold_yellow: { ...DEFAULT_PRESET, color: '#ffe600', accent: '#fff', outlineWidth: 3, weight: 700, highlightScale: 1.08 },
  tiktok_bold: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', outlineWidth: 4, weight: 700, uppercase: true, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 23, highlightScale: 1.16 },
  tiktok_outline: { ...DEFAULT_PRESET, color: '#fff', accent: '#ff0050', outline: '#ff0050', outlineWidth: 3, weight: 700, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 24, highlightScale: 1.13 },
  '3d_pop': { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#000', outlineWidth: 4, shadowColor: 'rgba(0,0,0,1)', shadowDepth: 6, weight: 800, uppercase: false, mode: 'word', popAnimation: true, positionY: 0.72, wordsPerLine: 1, maxCharsPerLine: 18, highlightScale: 1.12 },
  candy_depth: { ...DEFAULT_PRESET, color: '#ff2a8a', accent: '#fff1c8', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#fff1c8', outlineWidth: 3, shadowColor: 'rgba(70,16,113,1)', shadowDepth: 6, weight: 800, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 24, highlightScale: 1.12 },
  retro_offset: { ...DEFAULT_PRESET, color: '#ffc928', accent: '#fff4d6', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#13213c', outlineWidth: 3, shadowColor: 'rgba(255,79,79,1)', shadowDepth: 6, weight: 800, italic: true, uppercase: true, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 25, highlightScale: 1.10 },
  chrome_lift: { ...DEFAULT_PRESET, color: '#e8eef4', accent: '#00e5ff', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#071b33', outlineWidth: 3, shadowColor: 'rgba(0,189,242,1)', shadowDepth: 5, weight: 800, uppercase: true, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 25, highlightScale: 1.10 },
  soft_clay: { ...DEFAULT_PRESET, color: '#fff0d4', accent: '#ffd6a0', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#5a2a16', outlineWidth: 3, shadowColor: 'rgba(201,94,44,1)', shadowDepth: 5, weight: 800, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 25, highlightScale: 1.08 },
  acid_sticker: { ...DEFAULT_PRESET, color: '#c8ff00', accent: '#fff', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outline: '#101010', outlineWidth: 4, shadowColor: 'rgba(106,0,212,1)', shadowDepth: 6, weight: 800, italic: true, uppercase: true, mode: 'word_pop', popAnimation: true, positionY: 0.78, maxCharsPerLine: 24, highlightScale: 1.12 },
  youtube_clean: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', fontFamily: '"DejaVu Sans", Arial, sans-serif', background: 'rgba(0,0,0,.78)', outlineWidth: 0, weight: 400, mode: 'sentence', positionY: 0.82, wordsPerLine: 6, maxCharsPerLine: 38, boxPadding: 10, highlightScale: 1 },
  shorts_readable: { ...DEFAULT_PRESET, color: '#ffe45e', accent: '#ffe45e', fontFamily: '"DejaVu Sans", Arial, sans-serif', background: 'rgba(0,0,0,.86)', outlineWidth: 0, weight: 700, mode: 'sentence', positionY: 0.76, wordsPerLine: 6, maxCharsPerLine: 32, boxPadding: 12, highlightScale: 1 },
  minimal_pop: { ...DEFAULT_PRESET, color: '#fff', accent: '#8be9fd', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outlineWidth: 2, shadowColor: 'rgba(0,0,0,.58)', shadowDepth: 2, weight: 800, mode: 'word_pop', popAnimation: true, positionY: 0.78, wordsPerLine: 4, maxCharsPerLine: 30, highlightScale: 1.07 },
  aesthetic_italic: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', fontFamily: '"DejaVu Sans", Arial, sans-serif', background: 'rgba(24,24,27,.58)', outlineWidth: 0, weight: 400, italic: true, mode: 'sentence', positionY: 0.84, wordsPerLine: 7, maxCharsPerLine: 42, boxPadding: 10, highlightScale: 1 },
  mono_focus: { ...DEFAULT_PRESET, color: '#fff', accent: '#64ffda', fontFamily: '"DejaVu Sans Mono", monospace', outlineWidth: 2, weight: 700, uppercase: true, positionY: 0.78, wordsPerLine: 4, maxCharsPerLine: 28, highlightScale: 1 },
  editorial_serif: { ...DEFAULT_PRESET, color: '#fff7ed', accent: '#fff7ed', fontFamily: '"DejaVu Serif", Georgia, serif', outlineWidth: 1, shadowColor: 'rgba(0,0,0,.65)', shadowDepth: 2, weight: 400, italic: true, mode: 'sentence', positionY: 0.84, wordsPerLine: 8, maxCharsPerLine: 44, highlightScale: 1 },
  typewriter_clean: { ...DEFAULT_PRESET, color: '#fff', accent: '#64ffda', fontFamily: '"DejaVu Sans Mono", monospace', outlineWidth: 2, weight: 400, mode: 'typewriter', positionY: 0.80, wordsPerLine: 5, maxCharsPerLine: 32, highlightScale: 1 },
  kinetic_slide: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outlineWidth: 3, weight: 800, mode: 'kinetic_slide', positionY: 0.76, wordsPerLine: 4, maxCharsPerLine: 28, highlightScale: 1 },
  focus_fade: { ...DEFAULT_PRESET, color: '#fff', accent: '#7cff6b', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outlineWidth: 3, weight: 800, mode: 'focus_fade', positionY: 0.78, wordsPerLine: 4, maxCharsPerLine: 28, highlightScale: 1 },
  neon_green: { ...DEFAULT_PRESET, color: '#00ff66', accent: '#fff', outlineWidth: 3, shadowColor: 'rgba(0,255,102,.68)', shadowDepth: 2, weight: 700, mode: 'word_pop', popAnimation: true, highlightScale: 1.14 },
  neon_pink: { ...DEFAULT_PRESET, color: '#ff36d1', accent: '#fff', outlineWidth: 3, shadowColor: 'rgba(255,54,209,.68)', shadowDepth: 2, weight: 700, mode: 'word_pop', popAnimation: true, highlightScale: 1.14 },
  word_highlight_yellow: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', outlineWidth: 3, weight: 700 },
  word_highlight_red: { ...DEFAULT_PRESET, color: '#fff', accent: '#ff3b30', outlineWidth: 3, weight: 700 },
  word_highlight_cyan: { ...DEFAULT_PRESET, color: '#fff', accent: '#00d4ff', outlineWidth: 3, weight: 700 },
  karaoke_white_to_yellow: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', outlineWidth: 3, weight: 700, mode: 'karaoke', wordsPerLine: 5, maxCharsPerLine: 32 },
  karaoke_white_to_red: { ...DEFAULT_PRESET, color: '#fff', accent: '#ff3b30', outlineWidth: 3, weight: 700, mode: 'karaoke', wordsPerLine: 5, maxCharsPerLine: 32 },
  box_white: { ...DEFAULT_PRESET, color: '#111', accent: '#d71920', background: 'rgba(255,255,255,.92)', outlineWidth: 0, weight: 400, wordsPerLine: 5, maxCharsPerLine: 34, boxPadding: 12 },
  box_black: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', background: 'rgba(0,0,0,.82)', outlineWidth: 0, weight: 400, wordsPerLine: 5, maxCharsPerLine: 34, boxPadding: 12 },
  box_gradient: { ...DEFAULT_PRESET, color: '#fff', accent: '#64ff8f', background: 'rgba(93,32,210,.88)', outlineWidth: 0, weight: 700, mode: 'word_pop', popAnimation: true, wordsPerLine: 4, maxCharsPerLine: 30, boxPadding: 14 },
  minimal_thin: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', outlineWidth: 1, weight: 400, letterSpacing: 0.9, mode: 'sentence', positionY: 0.88, wordsPerLine: 9, maxCharsPerLine: 46, highlightScale: 1 },
  minimal_shadow: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', outlineWidth: 0, shadowColor: 'rgba(0,0,0,.72)', shadowDepth: 2, weight: 400, mode: 'sentence', positionY: 0.88, wordsPerLine: 9, maxCharsPerLine: 46, highlightScale: 1 },
  headline_bold: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', fontFamily: '"Poppins Caption", Poppins, Arial, sans-serif', outlineWidth: 4, weight: 800, letterSpacing: -0.8, uppercase: false, mode: 'word_pop', popAnimation: true, positionY: 0.52, wordsPerLine: 2, maxCharsPerLine: 18, highlightScale: 1.18 },
  headline_caps: { ...DEFAULT_PRESET, color: '#ffe600', accent: '#fff', fontFamily: '"DejaVu Sans", Arial, sans-serif', outlineWidth: 4, weight: 700, letterSpacing: 1.2, uppercase: true, mode: 'word_pop', popAnimation: true, positionY: 0.52, wordsPerLine: 2, maxCharsPerLine: 18, highlightScale: 1.18 },
  word_by_word: { ...DEFAULT_PRESET, color: '#fff', accent: '#ffe600', outlineWidth: 4, weight: 700, uppercase: true, mode: 'word', popAnimation: true, positionY: 0.52, wordsPerLine: 1, maxCharsPerLine: 18, highlightScale: 1.16 },
  sentence: { ...DEFAULT_PRESET, color: '#fff', accent: '#fff', weight: 700, mode: 'sentence', positionY: 0.88, wordsPerLine: 10, maxCharsPerLine: 48, highlightScale: 1 },
}

export const CAPTION_STYLE_NAMES = Object.freeze(Object.keys(PRESETS))

export function getCaptionPresetPalette(styleName: string) {
  const preset = { ...DEFAULT_PRESET, ...(PRESETS[styleName] ?? {}) }
  const fontColor = normalizePreviewHexColor(preset.color) ?? '#FFFFFF'
  const highlightColor = normalizePreviewHexColor(preset.accent) ?? fontColor
  const effectColor = normalizePreviewCssColorToHex(preset.shadowColor)
    ?? normalizePreviewHexColor(preset.outline)
    ?? '#000000'
  return {
    fontColor,
    highlightColor,
    effectColor,
    supportsHighlight: preset.mode !== 'sentence' && highlightColor !== fontColor,
    supportsEffect: Boolean(
      (preset.outline && preset.outlineWidth > 0)
      || (preset.shadowColor && (preset.shadowDepth ?? 0) > 0),
    ),
  }
}

export function CaptionStyleThumbnail({
  styleName,
  compact = false,
  active = false,
  className = '',
}: {
  styleName: string
  compact?: boolean
  active?: boolean
  className?: string
}) {
  const resolvedStyle = styleName === 'auto' ? 'tiktok_bold' : styleName
  const preset = { ...DEFAULT_PRESET, ...(PRESETS[resolvedStyle] ?? {}) }
  const mode = preset.mode ?? 'phrase'
  const words = mode === 'word'
    ? ['Make', 'every', 'moment', 'count']
    : buildPreviewWords(preset).slice(0, compact || mode === 'sentence' ? 3 : 4)
  const outline = preset.outline ?? '#000000'
  const shadowDepth = Math.max(0, preset.shadowDepth ?? 0)
  const textStyle = {
    '--caption-style-base': preset.color,
    '--caption-style-accent': preset.accent,
    color: preset.color,
    fontFamily: preset.fontFamily ?? '"DejaVu Sans", Arial, sans-serif',
    fontSize: compact ? (mode === 'word' ? '12px' : '9px') : '16px',
    fontWeight: preset.weight,
    fontStyle: preset.italic ? 'italic' : 'normal',
    letterSpacing: preset.letterSpacing
      ? `${preset.letterSpacing * (compact ? 0.45 : 0.75)}px`
      : undefined,
    textTransform: preset.uppercase ? 'uppercase' : 'none',
    WebkitTextStroke: preset.outlineWidth > 0
      ? `${compact
        ? Math.min(2.2, Math.max(0.7, preset.outlineWidth * 0.32))
        : Math.min(2.4, Math.max(0.45, preset.outlineWidth * 0.58))}px ${outline}`
      : undefined,
    paintOrder: 'stroke fill',
    textShadow: preset.shadowColor && shadowDepth > 0
      ? `${Math.max(1, shadowDepth * (compact ? 0.34 : 0.58))}px ${Math.max(1, shadowDepth * (compact ? 0.34 : 0.58))}px 0 ${preset.shadowColor}`
      : undefined,
    background: preset.background,
    padding: preset.background ? (compact ? '3px 5px' : '5px 8px') : undefined,
    borderRadius: preset.background ? '6px' : undefined,
  } as CSSProperties

  return (
    <div
      data-caption-style-thumbnail={resolvedStyle}
      data-caption-style-mode={mode}
      data-caption-style-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className={`caption-style-thumbnail relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_20%_12%,rgb(255_255_255_/_0.22),transparent_34%),linear-gradient(145deg,#64748b,#28374d_52%,#40366d)] px-1 text-center ${className}`}
    >
      <span
        data-caption-style-copy="true"
        className="relative z-10 inline-flex max-w-[92%] items-center justify-center whitespace-nowrap leading-none"
        style={textStyle}
      >
        {mode === 'typewriter' ? (
          <>
            <span data-caption-style-typewriter-text="true"><UiText id="make_it_count_a0ec22ad" /></span>
            <span data-caption-style-cursor="true" style={{ color: preset.accent }}>▌</span>
          </>
        ) : mode === 'word' ? (
          <span className="relative inline-grid min-w-[5.5em] place-items-center">
            {words.map((word, index) => (
              <span
                key={`${word}-${index}`}
                data-caption-style-word-by-word={index}
                className="col-start-1 row-start-1 inline-block"
                style={{
                  animationDelay: `${Number((index * 0.8).toFixed(2))}s`,
                  opacity: index === 0 ? 1 : 0,
                }}
              >
                {word}
              </span>
            ))}
          </span>
        ) : words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            data-caption-style-word={index}
            style={{
              animationDelay: `${index * 0.56}s`,
              marginLeft: index > 0 ? (compact ? 3 : 5) : 0,
            }}
          >
            {word}
          </span>
        ))}
      </span>
    </div>
  )
}

export function CaptionVideoPreview({
  media,
  styleName,
  fontSize,
  captionPosition,
  visibilityOverrides,
  subtitleMode = 'original',
  targetLanguage = 'en',
  bilingualOrder = 'source_above',
  sourceStyleName = 'inherit',
  translationStyleName = 'inherit',
  sourceFontScale = 0.8,
  translationFontScale = 1,
  processing = false,
  showDetails = true,
}: {
  media: CaptionPreviewMedia
  styleName: string
  fontSize: number
  captionPosition: string
  visibilityOverrides?: CaptionVisibilityOverrides
  subtitleMode?: CaptionSubtitleMode
  targetLanguage?: string
  bilingualOrder?: CaptionBilingualOrder
  sourceStyleName?: CaptionDualLanguageStyleName
  translationStyleName?: CaptionDualLanguageStyleName
  sourceFontScale?: number
  translationFontScale?: number
  processing?: boolean
  showDetails?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const geometry = resolveCaptionPreviewGeometry(media)
  const resolvedStyle = resolveCaptionPreviewStyleName(
    styleName,
    geometry.renderWidth,
    geometry.renderHeight,
    media.durationSeconds,
  )
  const preset = { ...DEFAULT_PRESET, ...(PRESETS[resolvedStyle] ?? {}) }
  const resolvedSourceStyle = resolveCaptionDualLanguageStyleName(
    sourceStyleName,
    resolvedStyle,
    geometry.renderWidth,
    geometry.renderHeight,
    media.durationSeconds,
  )
  const resolvedTranslationStyle = resolveCaptionDualLanguageStyleName(
    translationStyleName,
    resolvedStyle,
    geometry.renderWidth,
    geometry.renderHeight,
    media.durationSeconds,
  )
  const sourcePreset = { ...DEFAULT_PRESET, ...(PRESETS[resolvedSourceStyle] ?? {}) }
  const translationPreset = { ...DEFAULT_PRESET, ...(PRESETS[resolvedTranslationStyle] ?? {}) }
  const customPositionY = visibilityOverrides?.position_y
  const positionY = typeof customPositionY === 'number' && Number.isFinite(customPositionY)
    ? Math.min(0.92, Math.max(0.08, customPositionY))
    : resolveCaptionPositionY(captionPosition, preset.positionY)
  const safeFontSize = Number.isFinite(fontSize)
    ? Math.min(96, Math.max(18, fontSize))
    : DEFAULT_CAPTION_FONT_SIZE
  const { aspectRatio, renderWidth, renderHeight } = geometry
  const portrait = aspectRatio < 0.95
  const styleLabel = toolCopy(labelForStyle(resolvedStyle))
  const dimensionLabel = geometry.dimensionLabel === '9:16 default aspect'
    ? tAuto('default_aspect', { aspect: '9:16' })
    : geometry.dimensionLabel.endsWith(' source aspect')
      ? tAuto('source_aspect', { aspect: geometry.dimensionLabel.replace(/ source aspect$/, '') })
      : geometry.dimensionLabel
  const hasVisibilityCustomization = visibilityOverrides?.visibility_enabled === true
    && (
      visibilityOverrides.shadow_strength !== undefined
      || visibilityOverrides.background_opacity !== undefined
      || visibilityOverrides.font_color !== undefined
      || visibilityOverrides.highlight_color !== undefined
      || visibilityOverrides.effect_color !== undefined
    )

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div
        className="relative isolate flex min-h-px w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-black/75 p-4 sm:p-6"
        style={{ containerType: 'size' }}
        aria-busy={processing}
      >
        {media.previewUrl ? (
          <>
            <Image
              src={media.previewUrl}
              alt=""
              aria-hidden="true"
              data-testid="caption-preview-blurred-backdrop"
              fill
              sizes="100vw"
              unoptimized
              className="pointer-events-none scale-[1.08] object-cover opacity-50 blur-2xl saturate-75"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/35" />
          </>
        ) : null}
        <div
          className="group relative z-10 min-h-px overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
          style={{
            aspectRatio: String(aspectRatio),
            containerType: 'inline-size',
            width: `min(100cqw, ${formatCssNumber(aspectRatio * 100)}cqh)`,
            height: `min(100cqh, ${formatCssNumber(100 / aspectRatio)}cqw)`,
          }}
        >
          <style>{CAPTION_PREVIEW_MOTION_CSS}</style>
          {media.previewUrl ? (
            <Image
              src={media.previewUrl}
              alt={tAuto('media_first_frame_alt', { name: media.name })}
              fill
              sizes={portrait ? "(max-width: 768px) 80vw, 440px" : "(max-width: 768px) 92vw, 760px"}
              unoptimized
              className={processing
                ? "scale-[1.035] object-contain opacity-55 blur-md transition duration-500"
                : "object-contain opacity-90"}
            />
          ) : !processing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.1),transparent_48%)] text-white/45">
              <Film className="size-8" />
              <span className="px-6 text-center text-xs"><UiText id="first_frame_is_being_prepared_0bd9c9b1" /></span>
            </div>
          ) : null}
          {processing ? (
            <CaptionProcessingState />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
              <CaptionSample
                preset={preset}
                positionY={positionY}
                fontSize={safeFontSize}
                videoWidth={renderWidth}
                videoHeight={renderHeight}
                visibilityOverrides={visibilityOverrides}
                subtitleMode={subtitleMode}
                targetLanguage={targetLanguage}
                bilingualOrder={bilingualOrder}
                sourcePreset={sourcePreset}
                translationPreset={translationPreset}
                sourceFontScale={normalizeCaptionFontScale(sourceFontScale, 0.8)}
                translationFontScale={normalizeCaptionFontScale(translationFontScale, 1)}
              />
            </>
          )}
        </div>
      </div>

      {showDetails ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-xs">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{media.name}</p>
            <p className="mt-0.5 text-muted-foreground">
              {tAuto('caption_preview_details', { dimensions: dimensionLabel, orientation: toolCopy(geometry.orientationLabel) })}
            </p>
          </div>
          <div className="text-right text-muted-foreground">
            <p className="font-medium text-foreground">
              {subtitleMode === 'bilingual' && resolvedSourceStyle !== resolvedTranslationStyle
                ? `${toolCopy(labelForStyle(resolvedSourceStyle))} / ${toolCopy(labelForStyle(resolvedTranslationStyle))}`
                : styleLabel}
            </p>
            <p className="mt-0.5">
              <UiText id="font_size_83ca9e48" />{' '}{safeFontSize}{hasVisibilityCustomization ? tAuto('custom_visibility_c7217830') : ''}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CaptionProcessingState() {
  const tAuto = useTranslations('Auto')
  return (
    <div
      aria-label={tAuto('preparing_captions_e35e4122')}
      aria-busy="true"
      className="absolute inset-0 overflow-hidden bg-black/35"
    >
      <Skeleton className="absolute inset-0 rounded-none bg-accent/25" />
      <ToolMediaLoadingIndicator
        label={tAuto('preparing_captions_e35e4122')}
        className="absolute inset-0 z-10"
      />
    </div>
  )
}

function CaptionSample({
  preset,
  positionY,
  fontSize,
  videoWidth,
  videoHeight,
  visibilityOverrides,
  subtitleMode,
  targetLanguage,
  bilingualOrder,
  sourcePreset,
  translationPreset,
  sourceFontScale,
  translationFontScale,
}: {
  preset: PreviewPreset
  positionY: number
  fontSize: number
  videoWidth: number | null
  videoHeight: number | null
  visibilityOverrides?: CaptionVisibilityOverrides
  subtitleMode: CaptionSubtitleMode
  targetLanguage: string
  bilingualOrder: CaptionBilingualOrder
  sourcePreset: PreviewPreset
  translationPreset: PreviewPreset
  sourceFontScale: number
  translationFontScale: number
}) {
  const width = Math.max(16, videoWidth ?? 1080)
  const height = Math.max(16, videoHeight ?? 1920)
  const renderScale = Math.max(0.55, Math.min(2, Math.min(width, height) / 1080))
  const primaryAppearance = buildCaptionPreviewAppearance({
    preset,
    fontSize,
    fontScale: 1,
    width,
    renderScale,
    visibilityOverrides,
  })
  const sampleWords = buildPreviewWords(preset)
  const highlightIndex = Math.min(2, sampleWords.length - 1)
  const resolvedTargetLanguage = normalizePreviewLanguage(targetLanguage)
  const translatedSample = applyPreviewTextCase(
    TRANSLATED_PREVIEW_TEXT[resolvedTargetLanguage],
    resolvedTargetLanguage,
    preset.uppercase === true,
  )
  const bilingualSourceSample = applyPreviewTextCase(
    ORIGINAL_PREVIEW_TEXT,
    'en',
    sourcePreset.uppercase === true,
  )
  const bilingualTranslatedSample = applyPreviewTextCase(
    TRANSLATED_PREVIEW_TEXT[resolvedTargetLanguage],
    resolvedTargetLanguage,
    translationPreset.uppercase === true,
  )
  const bilingualLayout = resolveBilingualPreviewLayout({
    sourceText: bilingualSourceSample,
    translationText: bilingualTranslatedSample,
    sourcePreset,
    translationPreset,
    fontSize,
    sourceFontScale,
    translationFontScale,
    width,
    height,
    renderScale,
    positionY,
    visibilityOverrides,
  })

  return (
    <div
      className="absolute inset-x-0 flex -translate-y-1/2 justify-center text-center"
      data-caption-preview-safe-top={subtitleMode === 'bilingual'
        ? formatCssNumber(bilingualLayout.topRatio)
        : undefined}
      data-caption-preview-safe-bottom={subtitleMode === 'bilingual'
        ? formatCssNumber(bilingualLayout.bottomRatio)
        : undefined}
      style={{ top: `${(subtitleMode === 'bilingual' ? bilingualLayout.centerY : positionY) * 100}%` }}
    >
      <div
        className="box-border whitespace-normal leading-[1.05] [overflow-wrap:normal]"
        style={subtitleMode === 'bilingual'
          ? { width: '100%', maxWidth: '100%' }
          : primaryAppearance.style}
      >
        {subtitleMode === 'translated' ? (
          <span data-caption-preview-mode="translated" lang={resolvedTargetLanguage}>
            <StaticAccentedCaptionLine
              text={translatedSample}
              preset={preset}
              fontColor={primaryAppearance.fontColor}
              highlightColor={primaryAppearance.highlightColor}
            />
          </span>
        ) : subtitleMode === 'bilingual' ? (
          <BilingualCaptionSample
            sourceSample={bilingualLayout.sourceText}
            translatedSample={bilingualLayout.translationText}
            targetLanguage={resolvedTargetLanguage}
            bilingualOrder={bilingualOrder}
            sourcePreset={sourcePreset}
            translationPreset={translationPreset}
            sourceAppearance={bilingualLayout.sourceAppearance}
            translationAppearance={bilingualLayout.translationAppearance}
            gapCqw={(bilingualLayout.gap / width) * 100}
            fitScale={bilingualLayout.fitScale}
          />
        ) : (
          <OriginalCaptionSample
            preset={preset}
            sampleWords={sampleWords}
            highlightIndex={highlightIndex}
            highlightColor={primaryAppearance.highlightColor}
          />
        )}
      </div>
    </div>
  )
}

function OriginalCaptionSample({
  preset,
  sampleWords,
  highlightIndex,
  highlightColor,
}: {
  preset: PreviewPreset
  sampleWords: string[]
  highlightIndex: number
  highlightColor: string
}) {
  if (preset.mode === 'typewriter') {
    const text = sampleWords.join(' ')
    return (
      <span data-caption-preview-mode="original" data-caption-preview-motion="typewriter">
        <span data-caption-preview-typewriter-text="true">{text}</span>
        <span data-caption-preview-cursor="true" style={{ color: highlightColor }}>▌</span>
      </span>
    )
  }

  if (preset.mode === 'word') {
    return (
      <span
        data-caption-preview-mode="original"
        data-caption-preview-motion="word_by_word"
        className="relative inline-grid min-w-[5.5em] place-items-center"
        style={{
          '--caption-preview-base': preset.color,
          '--caption-preview-accent': highlightColor,
        } as CSSProperties}
      >
        {sampleWords.map((word, index) => (
          <span
            key={`${word}-${index}`}
            data-caption-preview-word-by-word={index}
            className="col-start-1 row-start-1 inline-block"
            style={{ '--caption-preview-delay': `${Number((index * 0.8).toFixed(2))}s` } as CSSProperties}
          >
            {word}
          </span>
        ))}
      </span>
    )
  }

  const motion = preset.mode === 'kinetic_slide'
    ? 'kinetic_slide'
    : preset.mode === 'word_pop'
      ? 'word_pop'
      : preset.mode === 'karaoke'
        ? 'karaoke'
        : preset.mode === 'focus_fade'
          ? 'focus_fade'
          : undefined

  return (
    <span
      data-caption-preview-mode="original"
      data-caption-preview-motion={motion}
      style={{
        '--caption-preview-base': preset.color,
        '--caption-preview-accent': highlightColor,
      } as CSSProperties}
    >
      {sampleWords.map((word, index) => {
        const highlighted = preset.mode === 'word'
          || (preset.mode === 'karaoke' ? index <= highlightIndex : index === highlightIndex)
        return (
          <span key={`${word}-${index}`}>
            {index > 0 ? ' ' : null}
            <span data-caption-preview-word={index} style={{
              '--caption-preview-delay': `${Number((index * 0.56).toFixed(2))}s`,
              color: highlighted ? highlightColor : undefined,
              fontSize: highlighted && shouldScaleStaticAccent(preset) ? `${preset.highlightScale}em` : undefined,
              opacity: preset.mode === 'focus_fade' && !highlighted ? 0.46 : undefined,
            } as CSSProperties}>
              {word}
            </span>
          </span>
        )
      })}
    </span>
  )
}

const CAPTION_PREVIEW_MOTION_CSS = `
  [data-caption-preview-word] {
    display: inline-block;
    will-change: color, opacity, transform;
  }
  [data-caption-preview-motion="word_pop"] [data-caption-preview-word] {
    animation: caption-preview-word-pop 2.8s cubic-bezier(.2,.8,.2,1) infinite;
    animation-delay: var(--caption-preview-delay);
  }
  [data-caption-preview-motion="karaoke"] [data-caption-preview-word] {
    animation: caption-preview-karaoke 3.2s ease-in-out infinite;
    animation-delay: var(--caption-preview-delay);
  }
  [data-caption-preview-motion="focus_fade"] [data-caption-preview-word] {
    animation: caption-preview-focus 2.8s ease-in-out infinite;
    animation-delay: var(--caption-preview-delay);
  }
  [data-caption-preview-motion="kinetic_slide"] {
    animation: caption-preview-slide 2.8s cubic-bezier(.2,.8,.2,1) infinite;
  }
  [data-caption-preview-typewriter-text] {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(0 100% 0 0);
    animation: caption-preview-typewriter 3s steps(23, end) infinite;
  }
  [data-caption-preview-cursor] {
    animation: caption-preview-cursor .72s step-end infinite;
  }
  [data-caption-preview-word-by-word] {
    opacity: 0;
    animation: caption-preview-word-by-word 3.2s cubic-bezier(.2,.8,.2,1) infinite;
    animation-delay: var(--caption-preview-delay);
  }
  @keyframes caption-preview-word-pop {
    0%, 12% { color: var(--caption-preview-accent); transform: scale(1.14); }
    26%, 100% { color: var(--caption-preview-base); transform: scale(1); }
  }
  @keyframes caption-preview-karaoke {
    0%, 66% { color: var(--caption-preview-accent); }
    82%, 100% { color: var(--caption-preview-base); }
  }
  @keyframes caption-preview-focus {
    0%, 16% { color: var(--caption-preview-accent); opacity: 1; transform: scale(1.04); }
    30%, 100% { color: var(--caption-preview-base); opacity: .38; transform: scale(1); }
  }
  @keyframes caption-preview-slide {
    0%, 8% { opacity: 0; transform: translateX(-8%) translateY(8px); }
    20%, 78% { opacity: 1; transform: translateX(0) translateY(0); }
    92%, 100% { opacity: 0; transform: translateX(5%) translateY(-3px); }
  }
  @keyframes caption-preview-typewriter {
    0%, 10% { clip-path: inset(0 100% 0 0); }
    62%, 86% { clip-path: inset(0 0 0 0); }
    100% { clip-path: inset(0 100% 0 0); }
  }
  @keyframes caption-preview-cursor {
    0%, 48% { opacity: 1; }
    49%, 100% { opacity: 0; }
  }
  @keyframes caption-preview-word-by-word {
    0% { opacity: 0; transform: scale(.76); }
    5%, 21% { opacity: 1; color: var(--caption-preview-accent); transform: scale(1.08); }
    24%, 100% { opacity: 0; color: var(--caption-preview-base); transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-caption-preview-motion],
    [data-caption-preview-motion] * { animation: none !important; }
    [data-caption-preview-typewriter-text] { clip-path: none !important; }
    [data-caption-preview-word-by-word] { opacity: 1; }
    [data-caption-preview-word-by-word]:not(:first-child) { display: none; }
  }
`

function BilingualCaptionSample({
  sourceSample,
  translatedSample,
  targetLanguage,
  bilingualOrder,
  sourcePreset,
  translationPreset,
  sourceAppearance,
  translationAppearance,
  gapCqw,
  fitScale,
}: {
  sourceSample: string
  translatedSample: string
  targetLanguage: string
  bilingualOrder: CaptionBilingualOrder
  sourcePreset: PreviewPreset
  translationPreset: PreviewPreset
  sourceAppearance: CaptionPreviewAppearance
  translationAppearance: CaptionPreviewAppearance
  gapCqw: number
  fitScale: number
}) {
  const sourceLine = (
    <span
      key="source"
      data-caption-preview-line="source"
      lang="en"
      className="mx-auto block w-fit whitespace-normal"
      style={sourceAppearance.style}
    >
      <StaticAccentedCaptionLine
        text={sourceSample}
        preset={sourcePreset}
        fontColor={sourceAppearance.fontColor}
        highlightColor={sourceAppearance.highlightColor}
      />
    </span>
  )
  const translationLine = (
    <span
      key="translation"
      data-caption-preview-line="translation"
      lang={targetLanguage}
      className="mx-auto block w-fit whitespace-normal"
      style={translationAppearance.style}
    >
      <StaticAccentedCaptionLine
        text={translatedSample}
        preset={translationPreset}
        fontColor={translationAppearance.fontColor}
        highlightColor={translationAppearance.highlightColor}
      />
    </span>
  )
  const sourceFirst = bilingualOrder !== 'translation_above'

  return (
    <span
      data-caption-preview-mode="bilingual"
      data-caption-preview-fit-scale={formatCssNumber(fitScale)}
      className="flex w-full flex-col items-center"
      style={{ gap: `${gapCqw}cqw` }}
    >
      {sourceFirst ? [sourceLine, translationLine] : [translationLine, sourceLine]}
    </span>
  )
}

type CaptionPreviewAppearance = {
  fontColor: string
  highlightColor: string
  renderedFontSize: number
  decorationHeight: number
  style: {
    color: string
    fontFamily: string
    fontSize: string
    fontWeight: number | undefined
    fontStyle: 'italic' | 'normal'
    letterSpacing: string | undefined
    textTransform: 'uppercase' | 'none'
    textShadow: string | undefined
    WebkitTextStroke: string | undefined
    paintOrder: 'stroke fill'
    background: string | undefined
    maxWidth: string
    padding: string | undefined
  }
}

type BilingualPreviewLayout = {
  sourceText: string
  translationText: string
  sourceAppearance: CaptionPreviewAppearance
  translationAppearance: CaptionPreviewAppearance
  gap: number
  centerY: number
  fitScale: number
  topRatio: number
  bottomRatio: number
}

function resolveBilingualPreviewLayout({
  sourceText,
  translationText,
  sourcePreset,
  translationPreset,
  fontSize,
  sourceFontScale,
  translationFontScale,
  width,
  height,
  renderScale,
  positionY,
  visibilityOverrides,
}: {
  sourceText: string
  translationText: string
  sourcePreset: PreviewPreset
  translationPreset: PreviewPreset
  fontSize: number
  sourceFontScale: number
  translationFontScale: number
  width: number
  height: number
  renderScale: number
  positionY: number
  visibilityOverrides?: CaptionVisibilityOverrides
}): BilingualPreviewLayout {
  const gap = Math.max(6, Math.round(Math.min(width, height) * 0.012))
  const safeMargin = Math.max(4, Math.round(height * 0.04))
  const availableHeight = Math.max(1, height - (2 * safeMargin))

  const requestedSourceFontSize = Math.max(
    8,
    roundHalfEven(Math.max(8, roundHalfEven(fontSize * sourceFontScale)) * renderScale),
  )
  const requestedTranslationFontSize = Math.max(
    8,
    roundHalfEven(Math.max(8, roundHalfEven(fontSize * translationFontScale)) * renderScale),
  )

  const buildCandidate = (sourceRenderedFontSize: number, translationRenderedFontSize: number) => {
    const sourceAppearance = buildCaptionPreviewAppearance({
      preset: sourcePreset,
      fontSize,
      fontScale: sourceFontScale,
      width,
      renderScale,
      visibilityOverrides,
      renderedFontSizeOverride: sourceRenderedFontSize,
    })
    const translationAppearance = buildCaptionPreviewAppearance({
      preset: translationPreset,
      fontSize,
      fontScale: translationFontScale,
      width,
      renderScale,
      visibilityOverrides,
      renderedFontSizeOverride: translationRenderedFontSize,
    })
    const sourceLines = wrapPreviewCaptionLines(sourceText, sourcePreset, sourceAppearance, width)
    const translationLines = wrapPreviewCaptionLines(
      translationText,
      translationPreset,
      translationAppearance,
      width,
    )
    const sourceHeight = estimatePreviewCaptionHeight(sourceLines, sourceAppearance)
    const translationHeight = estimatePreviewCaptionHeight(translationLines, translationAppearance)
    return {
      sourceText: sourceLines.join('\n'),
      translationText: translationLines.join('\n'),
      sourceAppearance,
      translationAppearance,
      totalHeight: sourceHeight + gap + translationHeight,
    }
  }

  let sourceRenderedFontSize = requestedSourceFontSize
  let translationRenderedFontSize = requestedTranslationFontSize
  let candidate = buildCandidate(sourceRenderedFontSize, translationRenderedFontSize)
  while (candidate.totalHeight > availableHeight && (sourceRenderedFontSize > 1 || translationRenderedFontSize > 1)) {
    const fitRatio = Math.max(0.1, Math.min(0.95, availableHeight / Math.max(1, candidate.totalHeight)))
    let nextSourceSize = Math.max(1, Math.floor(sourceRenderedFontSize * fitRatio))
    let nextTranslationSize = Math.max(1, Math.floor(translationRenderedFontSize * fitRatio))
    if (nextSourceSize === sourceRenderedFontSize && sourceRenderedFontSize > 1) nextSourceSize -= 1
    if (nextTranslationSize === translationRenderedFontSize && translationRenderedFontSize > 1) nextTranslationSize -= 1
    sourceRenderedFontSize = nextSourceSize
    translationRenderedFontSize = nextTranslationSize
    candidate = buildCandidate(sourceRenderedFontSize, translationRenderedFontSize)
  }

  const desiredCenter = Math.round(height * Math.max(0.08, Math.min(0.92, positionY)))
  const blockTop = Math.max(
    safeMargin,
    Math.min(
      height - safeMargin - candidate.totalHeight,
      Math.round(desiredCenter - candidate.totalHeight / 2),
    ),
  )

  return {
    sourceText: candidate.sourceText,
    translationText: candidate.translationText,
    sourceAppearance: candidate.sourceAppearance,
    translationAppearance: candidate.translationAppearance,
    gap,
    centerY: (blockTop + candidate.totalHeight / 2) / height,
    fitScale: Math.min(
      sourceRenderedFontSize / requestedSourceFontSize,
      translationRenderedFontSize / requestedTranslationFontSize,
    ),
    topRatio: blockTop / height,
    bottomRatio: (blockTop + candidate.totalHeight) / height,
  }
}

function buildCaptionPreviewAppearance({
  preset,
  fontSize,
  fontScale,
  width,
  renderScale,
  visibilityOverrides,
  renderedFontSizeOverride,
}: {
  preset: PreviewPreset
  fontSize: number
  fontScale: number
  width: number
  renderScale: number
  visibilityOverrides?: CaptionVisibilityOverrides
  renderedFontSizeOverride?: number
}): CaptionPreviewAppearance {
  const renderedFontSize = renderedFontSizeOverride ?? Math.max(8, roundHalfEven(fontSize * fontScale * renderScale))
  const renderedOutlineWidth = Math.max(0, Math.round(preset.outlineWidth * renderScale * 10) / 10)
  const renderedBoxPadding = Math.max(1, Math.round((
    preset.boxPadding ?? (typeof visibilityOverrides?.background_opacity === 'number' ? 10 : 0)
  ) * renderScale))
  const fontSizeCqw = (renderedFontSize / width) * 100
  const outlineCqw = (renderedOutlineWidth / width) * 100
  const boxPaddingCqw = (renderedBoxPadding / width) * 100
  const visibilityEnabled = visibilityOverrides?.visibility_enabled === true
  const fontColor = visibilityEnabled
    ? normalizePreviewHexColor(visibilityOverrides.font_color) ?? preset.color
    : preset.color
  const highlightColor = visibilityEnabled
    ? normalizePreviewHexColor(visibilityOverrides.highlight_color) ?? preset.accent
    : preset.accent
  const effectColor = visibilityEnabled
    ? normalizePreviewHexColor(visibilityOverrides.effect_color)
    : null
  const shadowStrength = visibilityEnabled ? visibilityOverrides.shadow_strength : undefined
  const shadowDepth = shadowStrength === 'strong'
    ? 4
    : shadowStrength === 'soft'
      ? 2
      : shadowStrength === undefined
        ? preset.shadowDepth ?? 0
        : 0
  const renderedShadowDepth = Math.max(0, Math.round(shadowDepth * renderScale * 10) / 10)
  const renderedLetterSpacing = (preset.letterSpacing ?? 0) * renderScale
  const shadowDepthCqw = (renderedShadowDepth / width) * 100
  const adaptiveContrast = getAdaptiveContrastColor(
    fontColor,
    highlightColor,
    shadowStrength === 'soft' ? 0.62 : 0.82,
  )
  const textShadow = shadowStrength === 'off'
    ? undefined
    : shadowStrength === 'soft' || shadowStrength === 'strong'
      ? `${shadowDepthCqw}cqw ${shadowDepthCqw}cqw 0 ${effectColor ?? adaptiveContrast}`
      : preset.shadowColor && renderedShadowDepth > 0
        ? `${shadowDepthCqw}cqw ${shadowDepthCqw}cqw 0 ${effectColor ?? preset.shadowColor}`
        : undefined
  const customBackgroundOpacity = visibilityEnabled
    ? typeof visibilityOverrides?.background_opacity === 'number'
      && Number.isFinite(visibilityOverrides.background_opacity)
      ? Math.min(0.7, Math.max(0, visibilityOverrides.background_opacity))
      : null
    : null
  const background = customBackgroundOpacity === null
    ? preset.background
    : customBackgroundOpacity > 0
      ? getAdaptiveBackgroundColor(fontColor, highlightColor, customBackgroundOpacity)
      : undefined

  return {
    fontColor,
    highlightColor,
    renderedFontSize,
    decorationHeight: Math.round(2 * (
      (background ? renderedBoxPadding : renderedOutlineWidth)
      + (textShadow ? renderedShadowDepth : 0)
    )),
    style: {
      color: fontColor,
      fontFamily: preset.fontFamily ?? '"DejaVu Sans", Arial, sans-serif',
      fontSize: `${fontSizeCqw}cqw`,
      fontWeight: preset.weight,
      fontStyle: preset.italic ? 'italic' : 'normal',
      letterSpacing: renderedLetterSpacing
        ? `${(renderedLetterSpacing / width) * 100}cqw`
        : undefined,
      textTransform: preset.uppercase ? 'uppercase' : 'none',
      textShadow,
      WebkitTextStroke: (customBackgroundOpacity === null || customBackgroundOpacity === 0)
        && preset.outline && renderedOutlineWidth > 0
        ? `${outlineCqw}cqw ${effectColor ?? preset.outline}`
        : undefined,
      paintOrder: 'stroke fill',
      background,
      maxWidth: `${preset.maxWidthRatio * 100}%`,
      padding: background ? `${boxPaddingCqw}cqw` : undefined,
    },
  }
}

function estimatePreviewCaptionHeight(lines: string[], appearance: CaptionPreviewAppearance) {
  const lineCount = Math.max(1, lines.length)
  const lineHeight = Math.max(1, roundHalfEven(appearance.renderedFontSize * 1.12))
  return Math.max(
    appearance.renderedFontSize,
    (lineCount * lineHeight) + appearance.decorationHeight,
  )
}

function wrapPreviewCaptionLines(
  text: string,
  preset: PreviewPreset,
  appearance: CaptionPreviewAppearance,
  width: number,
) {
  const safeWidth = Math.max(
    1,
    roundHalfEven(width * Math.max(0.35, Math.min(0.96, preset.maxWidthRatio))),
  )
  const averageGlyphWidth = Math.max(
    0.5,
    (appearance.renderedFontSize * 0.56) + Math.max(0, (preset.letterSpacing ?? 0)),
  )
  const capacity = Math.max(1, Math.min(4096, Math.floor(safeWidth / averageGlyphWidth)))
  return text.split(/\r\n|\r|\n/).flatMap((line) => wrapPreviewLine(line, capacity))
}

function wrapPreviewLine(text: string, capacity: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  const pushCurrent = () => {
    if (!current) return
    lines.push(current)
    current = ''
  }

  for (const word of words) {
    const characters = Array.from(word)
    if (characters.length > capacity) {
      pushCurrent()
      for (let offset = 0; offset < characters.length; offset += capacity) {
        const chunk = characters.slice(offset, offset + capacity).join('')
        if (offset + capacity < characters.length) lines.push(chunk)
        else current = chunk
      }
      continue
    }

    const next = current ? `${current} ${word}` : word
    if (Array.from(next).length <= capacity) current = next
    else {
      pushCurrent()
      current = word
    }
  }
  pushCurrent()
  return lines.length > 0 ? lines : ['']
}

function StaticAccentedCaptionLine({
  text,
  preset,
  fontColor,
  highlightColor,
}: {
  text: string
  preset: PreviewPreset
  fontColor: string
  highlightColor: string
}) {
  const lines = text.trim().split(/\r\n|\r|\n/)
  const words = lines.flatMap((line) => line.split(/\s+/).filter(Boolean))
  const supportsStaticAccent = preset.mode !== 'sentence'
    && normalizePreviewHexColor(highlightColor) !== normalizePreviewHexColor(fontColor)
  if (!supportsStaticAccent || words.length === 0) {
    return lines.map((line, lineIndex) => (
      <span key={`${line}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    ))
  }

  const accentIndex = Math.min(2, words.length - 1)
  let wordIndex = 0
  return lines.map((line, lineIndex) => {
    const lineWords = line.split(/\s+/).filter(Boolean)
    return (
      <span key={`${line}-${lineIndex}`}>
        {lineWords.map((word, index) => {
          const currentWordIndex = wordIndex
          wordIndex += 1
          return (
            <span key={`${word}-${index}`}>
              {index > 0 ? ' ' : null}
              <span
                data-caption-preview-accent={currentWordIndex === accentIndex ? 'static' : undefined}
                style={currentWordIndex === accentIndex ? {
                  color: highlightColor,
                  fontSize: shouldScaleStaticAccent(preset) ? `${preset.highlightScale}em` : undefined,
                } : undefined}
              >
                {word}
              </span>
            </span>
          )
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    )
  })
}

function shouldScaleStaticAccent(preset: PreviewPreset) {
  return preset.highlightScale > 1
    && (preset.popAnimation === true || preset.mode === 'word_pop' || preset.mode === 'word')
}

function buildPreviewWords(preset: PreviewPreset) {
  if (preset.mode === 'word') return ['Moment']
  const candidates = ['Make', 'every', 'moment', 'count', 'on', 'every', 'single', 'new', 'video', 'today']
  const words: string[] = []
  for (const word of candidates) {
    const candidate = [...words, word].join(' ')
    if (words.length > 0 && (
      words.length >= preset.wordsPerLine
      || candidate.length > preset.maxCharsPerLine
    )) break
    words.push(word)
  }
  return words
}

function normalizePreviewLanguage(value: string) {
  const normalized = value.trim().toLowerCase()
  const canonical = normalized === 'pt-br' ? 'pt-BR' : normalized
  return Object.hasOwn(TRANSLATED_PREVIEW_TEXT, canonical) ? canonical : 'en'
}

function applyPreviewTextCase(text: string, language: string, uppercase: boolean) {
  if (!uppercase) return text
  try {
    return text.toLocaleUpperCase(language === 'tr' ? 'tr-TR' : language)
  } catch {
    return text.toUpperCase()
  }
}

function roundHalfEven(value: number) {
  const lower = Math.floor(value)
  const fraction = value - lower
  if (Math.abs(fraction - 0.5) < Number.EPSILON * 8) {
    return lower % 2 === 0 ? lower : lower + 1
  }
  return Math.round(value)
}

export function resolveCaptionPreviewGeometry(media: Pick<
  CaptionPreviewMedia,
  'width' | 'height' | 'dimensionSource'
>) {
  const width = positiveDimension(media.width)
  const height = positiveDimension(media.height)
  if (!width || !height) {
    return {
      aspectRatio: 9 / 16,
      renderWidth: 1080,
      renderHeight: 1920,
      dimensionLabel: '9:16 default aspect',
      orientationLabel: 'Portrait',
    }
  }

  const aspectRatio = width / height
  const previewOnly = media.dimensionSource === 'preview'
  const renderWidth = previewOnly
    ? aspectRatio >= 1 ? Math.max(1, Math.round(1080 * aspectRatio)) : 1080
    : width
  const renderHeight = previewOnly
    ? aspectRatio >= 1 ? 1080 : Math.max(1, Math.round(1080 / aspectRatio))
    : height
  const square = Math.abs(aspectRatio - 1) <= 0.05

  return {
    aspectRatio,
    renderWidth,
    renderHeight,
    dimensionLabel: previewOnly
      ? `${formatAspectRatio(aspectRatio)} source aspect`
      : `${width} × ${height}`,
    orientationLabel: square ? 'Square' : aspectRatio < 1 ? 'Portrait' : 'Landscape',
  }
}

export function resolveCaptionPreviewStyleName(
  styleName: string,
  width: number | null,
  height: number | null,
  duration: number | null,
) {
  return styleName === 'auto' ? resolveAutoPreset(width, height, duration) : styleName
}

export function resolveCaptionDualLanguageStyleName(
  styleName: CaptionDualLanguageStyleName | null | undefined,
  inheritedStyleName: string,
  width: number | null,
  height: number | null,
  duration: number | null,
) {
  const normalized = styleName?.trim() ?? ''
  if (!normalized || normalized === 'inherit') return inheritedStyleName
  return resolveCaptionPreviewStyleName(normalized, width, height, duration)
}

export function normalizeCaptionFontScale(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(1.5, Math.max(0.5, numeric))
}

export function resolveCaptionPreviewPosition(
  styleName: string,
  width: number | null,
  height: number | null,
  duration: number | null,
) {
  const resolvedStyle = resolveCaptionPreviewStyleName(styleName, width, height, duration)
  const positionY = PRESETS[resolvedStyle]?.positionY ?? DEFAULT_PRESET.positionY
  if (positionY <= 0.3) return 'top'
  if (positionY <= 0.66) return 'middle'
  return 'bottom'
}

function resolveCaptionPositionY(position: string, stylePositionY: number) {
  if (position === 'top') return 0.14
  if (position === 'middle') return 0.5
  if (position === 'bottom') return 0.84
  return stylePositionY
}

function resolveAutoPreset(width: number | null, height: number | null, duration: number | null) {
  if (duration !== null && duration >= 180) return 'minimal_shadow'
  if (width && height) {
    const aspectRatio = width / height
    if (aspectRatio <= 0.8) return 'tiktok_bold'
    if (aspectRatio >= 1.35) return 'word_highlight_yellow'
  }
  return 'box_black'
}

function labelForStyle(value: string) {
  if (value === '3d_pop') return '3D Pop'
  if (value === 'youtube_clean') return 'YouTube Clean'
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function positiveDimension(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function formatAspectRatio(aspectRatio: number) {
  const commonRatios: Array<[number, string]> = [
    [1, '1:1'],
    [16 / 9, '16:9'],
    [9 / 16, '9:16'],
    [4 / 3, '4:3'],
    [3 / 4, '3:4'],
  ]
  const match = commonRatios.find(([ratio]) => Math.abs(aspectRatio - ratio) <= 0.02)
  return match?.[1] ?? `${aspectRatio.toFixed(2)}:1`
}

function formatCssNumber(value: number) {
  return Number(value.toFixed(4))
}

function normalizePreviewHexColor(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(normalized)) return normalized
  if (/^#[0-9A-F]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map((character) => character.repeat(2)).join('')}`
  }
  return null
}

function normalizePreviewCssColorToHex(value: unknown) {
  const hex = normalizePreviewHexColor(value)
  if (hex) return hex
  if (typeof value !== 'string') return null
  const match = value.trim().match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[01](?:\.\d+)?)?\s*\)$/i,
  )
  if (!match) return null
  const channels = match.slice(1, 4).map((channel) => (
    Math.min(255, Number.parseInt(channel!, 10)).toString(16).padStart(2, '0')
  ))
  return `#${channels.join('')}`.toUpperCase()
}

function getAdaptiveContrastColor(fontColor: string, highlightColor: string, opacity: number) {
  const alpha = Math.min(1, Math.max(0, opacity)).toFixed(2).replace(/^0/, '')
  return getAdaptiveContrastBase(fontColor, highlightColor) === 'white'
    ? `rgba(255,255,255,${alpha})`
    : `rgba(0,0,0,${alpha})`
}

function getAdaptiveBackgroundColor(fontColor: string, highlightColor: string, opacity: number) {
  const alpha = Number(Math.min(0.7, Math.max(0, opacity)).toFixed(2))
  return getAdaptiveContrastBase(fontColor, highlightColor) === 'white'
    ? `rgba(255,255,255,${alpha})`
    : `rgba(0,0,0,${alpha})`
}

function getAdaptiveContrastBase(fontColor: string, highlightColor: string): 'black' | 'white' {
  const luminances = [getRelativeLuminance(fontColor), getRelativeLuminance(highlightColor)]
  const blackScore = Math.min(...luminances.map((luminance) => getContrastRatio(luminance, 0)))
  const whiteScore = Math.min(...luminances.map((luminance) => getContrastRatio(luminance, 1)))
  return whiteScore > blackScore ? 'white' : 'black'
}

function getRelativeLuminance(value: string) {
  const normalized = normalizePreviewHexColor(value) ?? '#FFFFFF'
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const linearize = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
}

function getContrastRatio(left: number, right: number) {
  const lighter = Math.max(left, right)
  const darker = Math.min(left, right)
  return (lighter + 0.05) / (darker + 0.05)
}

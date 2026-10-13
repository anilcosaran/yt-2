'use client'

import {
  ToolSelectField,
  ToolSliderField,
  type ToolChoice,
} from '@/components/tools/tool-primitives'
import { useTranslations } from 'next-intl'

type PortraitFramingSection = 'canvas' | 'framing'

const PORTRAIT_FRAMING_OPTIONS: ToolChoice[] = [
  {
    value: 'smart_face_track',
    label: 'Smart Face Track',
    description: 'Smoothly follows the main face while keeping a vertical crop stable.',
  },
  {
    value: 'portrait_fit',
    label: 'Fit Landscape to Portrait',
    description: 'Keeps the full landscape frame in a 9:16 video without face tracking.',
  },
]

const PORTRAIT_BACKGROUND_OPTIONS: ToolChoice[] = [
  {
    value: 'blur',
    label: 'Blurred video',
    description: 'Fills the open space with a blurred copy of the source.',
  },
  {
    value: 'black',
    label: 'Black',
    description: 'Uses a clean black background around the full source frame.',
  },
]

export function PortraitFramingFields({
  canvas,
  framing,
  onValueChange,
}: {
  canvas: Record<string, unknown>
  framing: Record<string, unknown>
  onValueChange: (section: PortraitFramingSection, value: Record<string, unknown>) => void
}) {
  const tAuto = useTranslations('Auto')
  const framingChoice = stringValue(framing.mode) === 'none' ? 'portrait_fit' : 'smart_face_track'
  const portraitBackground = stringValue(canvas.fit) === 'fit' ? 'black' : 'blur'
  const blurStrength = boundedNumber(canvas.blur_strength, 60, 0, 100)

  const setFramingChoice = (choice: string) => {
    if (choice === 'portrait_fit') {
      onValueChange('canvas', {
        aspect_ratio: '9:16',
        fit: 'blur',
        background: '#000000',
        blur_strength: blurStrength,
      })
      onValueChange('framing', { mode: 'none' })
      return
    }

    onValueChange('canvas', { aspect_ratio: '9:16', fit: 'crop' })
    onValueChange('framing', { mode: 'face_track', tracking_profile: 'steady_face_v2' })
  }

  const setPortraitBackground = (background: string) => {
    onValueChange('canvas', {
      aspect_ratio: '9:16',
      fit: background === 'black' ? 'fit' : 'blur',
      background: '#000000',
      ...(background === 'blur' ? { blur_strength: blurStrength } : {}),
    })
  }

  return (
    <div className="space-y-3">
      <ToolSelectField
        label={tAuto('framing_5318b910')}
        value={framingChoice}
        options={PORTRAIT_FRAMING_OPTIONS}
        onValueChange={setFramingChoice}
      />
      {framingChoice === 'portrait_fit' ? (
        <>
          <ToolSelectField
            label={tAuto('background_64dd60fe')}
            value={portraitBackground}
            options={PORTRAIT_BACKGROUND_OPTIONS}
            onValueChange={setPortraitBackground}
          />
          {portraitBackground === 'blur' ? (
            <ToolSliderField
              label={tAuto('blur_strength_6751933e')}
              value={blurStrength}
              min={0}
              max={100}
              suffix="%"
              presets={[25, 50, 60, 75, 100]}
              onValueChange={(value) => onValueChange('canvas', {
                ...canvas,
                blur_strength: Math.round(value),
              })}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

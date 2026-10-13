'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { StorageMediaInput, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { AngleGalleryGrid } from '@/components/tools/angle-gallery-grid'
import type { MediaTransformSelectedMedia } from '@/components/tools/media-transform-input-fields'
import { Textarea } from '@/components/ui/textarea'
import { UiText } from '@/components/i18n/ui-text'
import {
  DEFAULT_ANGLE_GALLERY_ID,
  MAX_ANGLE_PROMPT_CHARS,
  MAX_ANGLE_SELECTIONS,
  defaultAnglePrompts,
  matchGalleryItem,
  mergeCustomPrompt,
  promptsFromGalleryIds,
  selectedGalleryIdsFromPrompts,
  samePrompt,
  toggleAngleGallerySelection,
  type AnglePrompt,
} from '@/lib/tools/angle-gallery'
import { showAppNotice } from '@/lib/ui/app-notice'

type AngleValues = Record<string, unknown>

const LEGACY_PRESET_PROMPTS = new Map([
  ['front', { preset: 'front', label: 'Front', prompt: 'Front view, eye-level shot, medium shot.' }],
  ['three_quarter_right', { preset: 'three_quarter_right', label: 'Front Side', prompt: 'Front-right three-quarter view, eye-level shot, medium shot.' }],
  ['right_profile', { preset: 'right_profile', label: 'Side', prompt: 'Right side profile view, eye-level shot, medium shot.' }],
  ['back', { preset: 'back', label: 'Back', prompt: 'Back view, eye-level shot, medium shot.' }],
  ['three_quarter_left', { preset: 'three_quarter_left', label: '3/4 left', prompt: 'Front-left three-quarter view, eye-level shot, medium shot.' }],
  ['left_profile', { preset: 'left_profile', label: 'Left profile', prompt: 'Left side profile view, eye-level shot, medium shot.' }],
  ['high_angle', { preset: 'high_angle', label: 'Top Down', prompt: 'Front view from a high camera angle looking down, medium shot.' }],
  ['low_angle', { preset: 'low_angle', label: 'Bottom Up', prompt: 'Front view from a low camera angle looking up, medium shot.' }],
  ['slight_up', { preset: 'slight_up', label: 'Slightly low', prompt: 'Front view from slightly below eye level, looking mildly upward, medium shot.' }],
  ['slight_down', { preset: 'slight_down', label: 'Front Elevated', prompt: 'Front view from slightly above eye level, looking mildly downward, medium shot.' }],
  ['bird_eye', { preset: 'bird_eye', label: 'Overhead', prompt: "Bird's-eye overhead view looking straight down, wide shot." }],
])

export function AngleInputFields({
  channelId,
  sourceMedia,
  values,
  onValueChange,
  onStorageMediaSelectionChange,
  onBusyChange,
}: {
  channelId: string | null
  sourceMedia?: MediaTransformSelectedMedia | null
  values: AngleValues
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: MediaTransformSelectedMedia | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const [selectedMedia, setSelectedMedia] = React.useState<StorageMediaSelection | null>(null)
  const [customOpen, setCustomOpen] = React.useState(false)
  const promptFieldId = React.useId()
  const promptRefs = React.useRef(new Map<string, HTMLTextAreaElement>())
  const pendingFocusId = React.useRef<string | null>(null)
  const storageObjectId = stringValue(values.storage_object_id) || sourceImageStorageId(values.source_image)
  const selectedMediaForValue = selectedMedia?.storageObjectId === storageObjectId ? selectedMedia : null
  const sourceMediaForValue = sourceMedia?.storageObjectId === storageObjectId ? sourceMedia : null
  const referenceName = selectedMediaForValue?.name ?? sourceMediaForValue?.name
  const storedAnglePrompts = readAnglePrompts(values.angles)
  const hasStoredAngles = storedAnglePrompts.length > 0
  const anglePrompts = hasStoredAngles ? storedAnglePrompts : defaultAnglePrompts()
  const selectedIds = selectedGalleryIdsFromPrompts(anglePrompts)
  const customPrompts = anglePrompts.filter((item) => !matchGalleryItem(item))
  const selectedCount = Math.min(anglePrompts.length, MAX_ANGLE_SELECTIONS)

  React.useEffect(() => {
    if (!hasStoredAngles) onValueChange('angles', defaultAnglePrompts())
  }, [hasStoredAngles, onValueChange])

  React.useEffect(() => {
    if (!pendingFocusId.current) return
    const field = promptRefs.current.get(pendingFocusId.current)
    if (!field) return
    field.focus()
    pendingFocusId.current = null
  })

  const publishPrompts = React.useCallback((next: AnglePrompt[]) => {
    onValueChange('angles', next.slice(0, MAX_ANGLE_SELECTIONS))
  }, [onValueChange])

  const handleToggle = (id: string) => {
    const result = toggleAngleGallerySelection(selectedIds, id)
    if (result.blocked) {
      showAppNotice({
        title: tAuto('you_can_select_a_maximum_of_5_angles_b7dd5625'),
        tone: 'warning',
      })
      return
    }
    if (result.unchanged) return
    const nextGallery = promptsFromGalleryIds(result.next)
    const keptCustom = customPrompts.slice(0, Math.max(0, MAX_ANGLE_SELECTIONS - nextGallery.length))
    publishPrompts([...nextGallery, ...keptCustom].map((item, index) => ({
      ...item,
      id: `angle-${index + 1}`,
    })))
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Reference image</h2>
        <StorageMediaInput
          channelId={channelId}
          value={storageObjectId}
          selectedName={referenceName}
          mediaKind="image"
          onBusyChange={onBusyChange}
          onChange={(selection) => {
            setSelectedMedia(selection)
            onValueChange('storage_object_id', selection?.storageObjectId)
            onValueChange('source_image', selection?.storageObjectId ? { storage_object_id: selection.storageObjectId } : undefined)
            onStorageMediaSelectionChange(selection ? {
              channelId,
              storageObjectId: selection.storageObjectId,
              name: selection.name,
              previewUrl: selection.previewUrl,
              mimeType: selection.mimeType,
              durationSeconds: selection.durationSeconds,
              width: selection.width,
              height: selection.height,
            } : null)
          }}
        />
      </section>

      <section className="space-y-3" aria-labelledby={`${promptFieldId}-heading`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${promptFieldId}-heading`} className="text-sm font-semibold text-foreground">
            <UiText id="angle_presets_8e0f1ee2" />
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">{selectedCount}/{MAX_ANGLE_SELECTIONS}</span>
        </div>

        <AngleGalleryGrid
          selectedIds={selectedIds.length > 0
            ? selectedIds
            : customPrompts.length > 0 ? [] : [DEFAULT_ANGLE_GALLERY_ID]}
          onToggle={handleToggle}
        />

        {customPrompts.length > 0 || customOpen ? (
          <div className="space-y-2.5">
            {customPrompts.map((anglePrompt, index) => (
              <div key={anglePrompt.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={`${promptFieldId}-${anglePrompt.id}`} className="text-xs font-medium text-muted-foreground">
                    <UiText id="custom_angle_prompt_9f17b317" />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove custom angle prompt ${index + 1}`}
                    onClick={() => {
                      pendingFocusId.current = customPrompts[index + 1]?.id ?? customPrompts[index - 1]?.id ?? null
                      publishPrompts(anglePrompts.filter((item) => item.id !== anglePrompt.id))
                      if (customPrompts.length <= 1) setCustomOpen(false)
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <Textarea
                  id={`${promptFieldId}-${anglePrompt.id}`}
                  aria-label={tAuto('custom_angle_prompt_9f17b317')}
                  ref={(element) => {
                    if (element) promptRefs.current.set(anglePrompt.id, element)
                    else promptRefs.current.delete(anglePrompt.id)
                  }}
                  value={anglePrompt.prompt}
                  maxLength={MAX_ANGLE_PROMPT_CHARS}
                  rows={3}
                  placeholder="Describe the camera angle…"
                  onChange={(event) => {
                    const prompt = event.target.value
                    publishPrompts(anglePrompts.map((item) => (
                      item.id === anglePrompt.id
                        ? { ...item, label: 'Custom angle', preset: undefined, prompt }
                        : item
                    )))
                  }}
                  className="min-h-20 resize-y leading-6"
                />
              </div>
            ))}
          </div>
        ) : null}

        {anglePrompts.length < MAX_ANGLE_SELECTIONS ? (
          <button
            type="button"
            onClick={() => {
              const id = nextAngleId(anglePrompts)
              pendingFocusId.current = id
              setCustomOpen(true)
              publishPrompts(mergeCustomPrompt(anglePrompts, {
                id,
                label: 'Custom angle',
                prompt: '',
              }))
            }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition hover:border-primary/45 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="size-3.5" />
            <UiText id="add_a_custom_angle_22606706" />
          </button>
        ) : null}
      </section>
    </div>
  )
}

function readAnglePrompts(value: unknown): AnglePrompt[] {
  if (typeof value === 'string' && value.trim()) {
    const item = anglePromptFromValue(value, 0)
    return item ? [item] : []
  }
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_ANGLE_SELECTIONS).flatMap((item, index) => {
    const prompt = anglePromptFromValue(item, index)
    return prompt ? [prompt] : []
  })
}

function anglePromptFromValue(value: unknown, index: number): AnglePrompt | null {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    const legacyPreset = LEGACY_PRESET_PROMPTS.get(text)
    if (legacyPreset) return { id: `angle-${index + 1}`, ...legacyPreset }
    return { id: `angle-${index + 1}`, label: `Custom angle ${index + 1}`, prompt: text }
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const directPrompt = stringValue(record.prompt)
  const prompt = directPrompt || legacyCameraPrompt(record)
  if (!prompt && Object.prototype.hasOwnProperty.call(record, 'prompt')) {
    return {
      id: stringValue(record.id) || `angle-${index + 1}`,
      label: stringValue(record.label) || `Custom angle ${index + 1}`,
      prompt: '',
      ...(stringValue(record.preset) ? { preset: stringValue(record.preset) } : cameraFields(record)),
    }
  }
  if (!prompt) return null
  return {
    id: stringValue(record.id) || `angle-${index + 1}`,
    label: stringValue(record.label) || `Angle ${index + 1}`,
    prompt,
    ...(stringValue(record.preset) ? { preset: stringValue(record.preset) } : cameraFields(record)),
  }
}

function cameraFields(record: Record<string, unknown>) {
  const azimuth = finiteNumber(record.azimuth_deg ?? record.horizontal)
  const elevation = finiteNumber(record.elevation_deg ?? record.vertical)
  const zoom = finiteNumber(record.zoom)
  if (azimuth === null || elevation === null || zoom === null) return {}
  return { azimuth_deg: azimuth, elevation_deg: elevation, zoom }
}

function legacyCameraPrompt(record: Record<string, unknown>) {
  const azimuth = finiteNumber(record.azimuth_deg)
  const elevation = finiteNumber(record.elevation_deg)
  const zoom = finiteNumber(record.zoom)
  if (azimuth === null || elevation === null || zoom === null) return ''
  return `${azimuthPrompt(azimuth)}, ${elevationPrompt(elevation)}, ${zoomPrompt(zoom)}.`
}

function azimuthPrompt(azimuth: number) {
  const labels = ['front view', 'front-right three-quarter view', 'right side profile view', 'back-right three-quarter view', 'back view', 'back-left three-quarter view', 'left side profile view', 'front-left three-quarter view']
  return labels[Math.round((((azimuth % 360) + 360) % 360) / 45) % labels.length] ?? 'front view'
}

function elevationPrompt(elevation: number) {
  if (elevation <= -15) return 'low-angle shot'
  if (elevation < 15) return 'eye-level shot'
  if (elevation < 45) return 'slightly elevated shot'
  return 'high-angle shot'
}

function zoomPrompt(zoom: number) {
  if (zoom >= 1.45) return 'close-up'
  if (zoom <= 0.75) return 'wide shot'
  return 'medium shot'
}

function nextAngleId(prompts: AnglePrompt[]) {
  const used = new Set(prompts.map((item) => item.id))
  for (let index = 1; index <= MAX_ANGLE_SELECTIONS; index += 1) {
    const id = `angle-${index}`
    if (!used.has(id)) return id
  }
  return `angle-${MAX_ANGLE_SELECTIONS}`
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function sourceImageStorageId(value: unknown) {
  if (typeof value === 'string' && value.startsWith('storage://')) return value.slice('storage://'.length)
  if (!value || typeof value !== 'object') return ''
  const storageObjectId = (value as Record<string, unknown>).storage_object_id
  return typeof storageObjectId === 'string' ? storageObjectId : ''
}

export const __angleInputFieldsTestHooks = {
  readAnglePrompts,
  nextAngleId,
  samePrompt,
  defaultAnglePrompts,
  selectedGalleryIdsFromPrompts,
  toggleAngleGallerySelection,
}

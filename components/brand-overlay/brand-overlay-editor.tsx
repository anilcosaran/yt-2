'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { StorageMediaInput } from '@/components/storage/storage-media-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export type BrandOverlayAnchor = 'auto_safe' | 'top_left' | 'top_center' | 'top_right' | 'middle_left' | 'center' | 'middle_right' | 'bottom_left' | 'bottom_center' | 'bottom_right'
export type BrandOverlayAnimation = 'static' | 'corner_cycle' | 'fade_corner_cycle'
export type BrandOverlayApplyPolicy = 'off' | 'default' | 'required'

export type BrandOverlayConfig = {
  anchor: BrandOverlayAnchor
  widthRatio: number
  opacity: number
  marginRatio: number
  animationMode: BrandOverlayAnimation
  intervalSeconds: number
  fadeSeconds: number
}

export type BrandOverlayEditorValue = {
  mode?: 'inherit_channel' | 'override' | 'disabled'
  applyPolicy?: BrandOverlayApplyPolicy
  assetStorageObjectId: string | null
  assetName?: string
  config: BrandOverlayConfig
  visibilityRanges?: Array<{ startSec: number; endSec: number }>
}

export const DEFAULT_BRAND_OVERLAY_CONFIG: BrandOverlayConfig = {
  anchor: 'bottom_left', widthRatio: 0.12, opacity: 0.85, marginRatio: 0.03,
  animationMode: 'static', intervalSeconds: 5, fadeSeconds: 0.3,
}

const anchors: BrandOverlayAnchor[] = [
  'top_left', 'top_center', 'top_right',
  'middle_left', 'center', 'middle_right',
  'bottom_left', 'bottom_center', 'bottom_right',
]

export function BrandOverlayEditor({
  channelId,
  value,
  onChange,
  disabled = false,
  variant = 'channel',
  compact = false,
}: {
  channelId: string | null
  value: BrandOverlayEditorValue
  onChange: (value: BrandOverlayEditorValue) => void
  disabled?: boolean
  variant?: 'channel' | 'workflow'
  compact?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const [animatedCorner, setAnimatedCorner] = React.useState(0)
  const isWorkflow = variant === 'workflow'
  const mode = value.mode ?? 'override'
  const editable = !disabled && (!isWorkflow || mode === 'override')

  React.useEffect(() => {
    if (value.config.animationMode === 'static') return undefined
    const timer = window.setInterval(() => setAnimatedCorner((current) => (current + 1) % 4), Math.max(500, value.config.intervalSeconds * 1000))
    return () => window.clearInterval(timer)
  }, [value.config.animationMode, value.config.intervalSeconds])

  const patchConfig = (patch: Partial<BrandOverlayConfig>) => onChange({
    ...value,
    config: { ...value.config, ...patch },
  })

  const previewAnchor = value.config.animationMode === 'static'
    ? value.config.anchor
    : (['top_left', 'top_right', 'bottom_right', 'bottom_left'] as BrandOverlayAnchor[])[animatedCorner]

  return (
    <div className={cn('space-y-4', compact && 'space-y-2 text-xs')}>
      {isWorkflow ? (
        <Field label={tAuto('behavior_70cb647a')}>
          <select
            value={mode}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, mode: event.target.value as BrandOverlayEditorValue['mode'] })}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="inherit_channel"><UiText id="use_channel_preset_16dfe729" /></option>
            <option value="override"><UiText id="override_for_this_node_028dc0f7" /></option>
            <option value="disabled"><UiText id="disabled_no_charge_6254b35c" /></option>
          </select>
        </Field>
      ) : (
        <Field label={tAuto('apply_policy_6165cc10')}>
          <select
            value={value.applyPolicy ?? 'default'}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, applyPolicy: event.target.value as BrandOverlayApplyPolicy })}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="off"><UiText id="off_e3de5ab0" /></option>
            <option value="default"><UiText id="default_808d7dca" /></option>
            <option value="required"><UiText id="required_before_launch_34b3d0cb" /></option>
          </select>
        </Field>
      )}

      {mode !== 'disabled' ? (
        <>
          {(!isWorkflow || mode === 'override') ? (
            <Field label={tAuto('logo_image_4ba23275')}>
              <StorageMediaInput
                channelId={channelId}
                value={value.assetStorageObjectId ?? ''}
                selectedName={value.assetName}
                disabled={!editable}
                mediaKind="image"
                uploadMetadata={{ asset_role: 'brand_overlay_logo' }}
                onChange={(selection) => onChange({
                  ...value,
                  assetStorageObjectId: selection?.storageObjectId ?? null,
                  assetName: selection?.name,
                })}
              />
            </Field>
          ) : (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><UiText id="logo_size_opacity_and_animation_come_from_the_ch_dcb4a6cc" /></p>
          )}

          {(!isWorkflow || mode === 'override') ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <RangeField label={tAuto('size_b7152342')} value={value.config.widthRatio} min={0.03} max={0.30} step={0.01} format={(v) => `${Math.round(v * 100)}%`} disabled={!editable} onChange={(widthRatio) => patchConfig({ widthRatio })} />
                <RangeField label={tAuto('opacity_f0fa69f3')} value={value.config.opacity} min={0.10} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} disabled={!editable} onChange={(opacity) => patchConfig({ opacity })} />
                <RangeField label={tAuto('safe_margin_cba4eff0')} value={value.config.marginRatio} min={0} max={0.15} step={0.01} format={(v) => `${Math.round(v * 100)}%`} disabled={!editable} onChange={(marginRatio) => patchConfig({ marginRatio })} />
              </div>

              <Field label={tAuto('position_cf1c85ad')}>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/40 p-1.5">
                  {anchors.map((anchor) => (
                    <button key={anchor} type="button" disabled={!editable} aria-label={anchor.replaceAll('_', ' ')} onClick={() => patchConfig({ anchor })} className={cn('h-8 rounded border text-[10px]', value.config.anchor === anchor ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')}>
                      {anchor === 'center' ? 'C' : anchor.split('_').map((part) => part[0]?.toUpperCase()).join('')}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={!editable} onClick={() => patchConfig({ anchor: 'auto_safe' })} className={cn('mt-1.5 h-8 w-full rounded border text-xs', value.config.anchor === 'auto_safe' ? 'border-primary bg-primary/10 text-primary' : 'border-border')}><UiText id="auto_safe_1c01f14a" /></button>
              </Field>

              <Field label={tAuto('animation_62afd21e')}>
                <select value={value.config.animationMode} disabled={!editable} onChange={(event) => patchConfig({ animationMode: event.target.value as BrandOverlayAnimation })} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                  <option value="static"><UiText id="static_af92969a" /></option>
                  <option value="corner_cycle"><UiText id="corner_cycle_af79f2b5" /></option>
                  <option value="fade_corner_cycle"><UiText id="fade_corner_cycle_d83fa7e9" /></option>
                </select>
              </Field>
              {value.config.animationMode !== 'static' ? (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label={tAuto('change_every_sec_175e59da')} value={value.config.intervalSeconds} min={2} max={60} disabled={!editable} onChange={(intervalSeconds) => patchConfig({ intervalSeconds })} />
                  {value.config.animationMode === 'fade_corner_cycle' ? <NumberField label={tAuto('fade_sec_2fa755da')} value={value.config.fadeSeconds} min={0} max={Math.min(1, value.config.intervalSeconds / 2)} step={0.1} disabled={!editable} onChange={(fadeSeconds) => patchConfig({ fadeSeconds })} /> : null}
                </div>
              ) : null}
            </>
          ) : null}

          {!compact ? (
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-gradient-to-br from-slate-800 to-slate-950">
              <div className="absolute inset-0 grid place-items-center text-xs text-white/35"><UiText id="media_preview_8436a13d" /></div>
              <div
                className={cn('absolute grid aspect-[3/1] place-items-center rounded bg-white px-1 text-[9px] font-bold text-slate-900 transition-all duration-300', value.config.animationMode === 'fade_corner_cycle' && 'opacity-70')}
                style={{ ...previewPosition(previewAnchor, value.config.marginRatio), width: `${value.config.widthRatio * 100}%`, opacity: value.config.opacity }}
              ><UiText id="logo_2c2d6bb5" /></div>
            </div>
          ) : null}
        </>
      ) : null}

      {isWorkflow && mode !== 'disabled' ? <VisibilityRanges value={value} onChange={onChange} disabled={disabled} /> : null}
    </div>
  )
}

function VisibilityRanges({ value, onChange, disabled }: { value: BrandOverlayEditorValue; onChange: (value: BrandOverlayEditorValue) => void; disabled: boolean }) {
  const tAuto = useTranslations('Auto')
  const ranges = value.visibilityRanges ?? []
  return (
    <Field label={tAuto('visible_parts_empty_entire_media_8b6b5931')}>
      <div className="space-y-1.5">
        {ranges.map((range, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <Input type="number" min={0} step={0.1} value={range.startSec} disabled={disabled} aria-label={`Range ${index + 1} start seconds`} onChange={(event) => updateRange(index, 'startSec', Number(event.target.value))} />
            <Input type="number" min={0} step={0.1} value={range.endSec} disabled={disabled} aria-label={`Range ${index + 1} end seconds`} onChange={(event) => updateRange(index, 'endSec', Number(event.target.value))} />
            <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => onChange({ ...value, visibilityRanges: ranges.filter((_, i) => i !== index) })}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={disabled || ranges.length >= 20} onClick={() => onChange({ ...value, visibilityRanges: [...ranges, { startSec: ranges.at(-1)?.endSec ?? 0, endSec: (ranges.at(-1)?.endSec ?? 0) + 5 }] })}><Plus className="size-3.5" /> {' '}<UiText id="add_range_9915bb34" /></Button>
      </div>
    </Field>
  )

  function updateRange(index: number, key: 'startSec' | 'endSec', next: number) {
    onChange({ ...value, visibilityRanges: ranges.map((item, i) => i === index ? { ...item, [key]: next } : item) })
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>
}

function RangeField({ label, value, min, max, step, format, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (value: number) => string; disabled: boolean; onChange: (value: number) => void }) {
  return <Field label={`${label} · ${format(value)}`}><input className="w-full accent-primary" type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></Field>
}

function NumberField({ label, value, min, max, step = 1, disabled, onChange }: { label: string; value: number; min: number; max: number; step?: number; disabled: boolean; onChange: (value: number) => void }) {
  return <Field label={label}><Input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></Field>
}

function previewPosition(anchor: BrandOverlayAnchor, margin: number): React.CSSProperties {
  const edge = `${Math.round(margin * 100)}%`
  if (anchor === 'auto_safe') anchor = 'bottom_left'
  const style: React.CSSProperties = {}
  if (anchor.includes('left')) style.left = edge
  else if (anchor.includes('right')) style.right = edge
  else { style.left = '50%'; style.transform = 'translateX(-50%)' }
  if (anchor.startsWith('top')) style.top = edge
  else if (anchor.startsWith('bottom')) style.bottom = edge
  else { style.top = '50%'; style.transform = `${style.transform ?? ''} translateY(-50%)`.trim() }
  return style
}

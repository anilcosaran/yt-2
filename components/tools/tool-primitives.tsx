'use client'

import * as React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Check, ChevronsUpDown, Dice5, Info, UploadCloud } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { LanguageFlagIcon } from '@/components/i18n/language-flag-icon'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

export type ToolChoice = {
  value: string
  label: string
  description?: string
  disabled?: boolean
  badge?: string
  icon?: LucideIcon
  flagRegion?: string | null
  code?: string
}

function ToolChoiceFlag({ option }: { option: ToolChoice | undefined }) {
  if (!option || !Object.prototype.hasOwnProperty.call(option, 'flagRegion')) return null
  return <LanguageFlagIcon region={option.flagRegion} />
}

export type ToolMode = {
  value: string
  label: string
  icon: LucideIcon
}

export function ToolPanel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 max-w-full flex-col',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function ToolPanelHeader({
  icon: Icon,
  iconContent,
  title,
  description,
  badge,
  actions,
  backHref,
}: {
  icon: LucideIcon
  iconContent?: React.ReactNode
  title: string
  description?: string
  badge?: string
  actions?: React.ReactNode
  backHref?: string
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="mb-5 flex items-start gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={tAuto('back_to_tools_4a61f16b')}
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
      ) : null}
      {iconContent ?? (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow">
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display text-2xl text-foreground">{title}</h1>
          {badge ? (
            <Badge variant="outline" className="rounded-md border-0 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              {badge}
            </Badge>
          ) : null}
          {actions}
        </div>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}

export function ToolModeSelect({
  modes,
  value,
  onValueChange,
  label = 'Input type',
}: {
  modes: ToolMode[]
  value: string
  onValueChange: (value: string) => void
  label?: string
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const selectedMode = modes.find((mode) => mode.value === value) ?? modes[0]
  const SelectedIcon = selectedMode?.icon

  return (
    <ToolField label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-full rounded-xl border-border bg-panel/40 px-3.5 shadow-none transition-colors hover:border-primary/40">
          <span className="flex min-w-0 items-center gap-2">
            {SelectedIcon ? <SelectedIcon className="size-4 shrink-0 text-muted-foreground" /> : null}
            <span className="truncate font-medium">{selectedMode ? toolCopy(selectedMode.label) : tAuto('select_input_type_3a884d55')}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          {modes.map((mode) => {
            const Icon = mode.icon

            return (
              <SelectItem key={mode.value} value={mode.value} className="py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{toolCopy(mode.label)}</span>
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </ToolField>
  )
}

export function ToolField({
  label,
  hint,
  hintMode = 'inline',
  icon: Icon,
  action,
  children,
  className,
}: {
  label: string
  hint?: string
  hintMode?: 'inline' | 'tooltip'
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {hint ? hintMode === 'tooltip' ? (
            <ToolFieldHint label={label} hint={hint} />
          ) : <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
          {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function ToolFieldHint({ label, hint }: { label: string; hint: string }) {
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const descriptionId = React.useId()

  return (
    <>
      <Tooltip open={open} onOpenChange={setOpen} delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label + ': ' + tAuto('tool_daha_fazla_bilgi_al_6d81d388')}
            aria-describedby={descriptionId}
            onPointerDown={(event) => {
              if (open) event.preventDefault()
            }}
            onClick={(event) => {
              event.preventDefault()
              setOpen((current) => !current)
            }}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          collisionPadding={16}
          className="max-w-[min(18rem,calc(100vw-2rem))] px-3 py-2 text-xs leading-5 text-pretty"
        >
          {hint}
        </TooltipContent>
      </Tooltip>
      <span id={descriptionId} className="sr-only">{hint}</span>
    </>
  )
}

export function ToolPromptArea({
  value,
  onChange,
  placeholder,
  maxLength = 2000,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  maxLength?: number
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/40 px-3.5 py-3 transition-colors focus-within:border-primary/50">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="min-h-28 resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0"
      />
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span><UiText id="prompt_a817d7eb" /></span>
        <span>{value.length} / {maxLength}</span>
      </div>
    </div>
  )
}

export function ToolUploadDropzone({
  icon: Icon = UploadCloud,
  title,
  description,
  actionLabel = 'Choose',
}: {
  icon?: LucideIcon
  title: string
  description: string
  actionLabel?: string
}) {
  return (
    <button
      type="button"
      className="flex min-h-24 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-panel/40 px-4 py-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}{' '}
          <span className="font-medium text-primary">{actionLabel}</span>
        </span>
      </span>
    </button>
  )
}

export function ToolSelectField({
  label,
  hint,
  hintMode,
  action,
  value,
  options,
  placeholder,
  disabled,
  onValueChange,
}: {
  label: string
  hint?: string
  hintMode?: 'inline' | 'tooltip'
  action?: React.ReactNode
  value: string
  options: ToolChoice[]
  placeholder?: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  const toolCopy = useToolCopy()
  const selectedOption = options.find((option) => option.value === value)

  return (
    <ToolField label={label} hint={hint} hintMode={hintMode} action={action}>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-full rounded-xl border-border bg-panel/40 px-3.5 shadow-none transition-colors hover:border-primary/40">
          <SelectValue placeholder={placeholder}>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium">
              <ToolChoiceFlag option={selectedOption} />
              {selectedOption?.code ? <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-foreground">{selectedOption.code}</span> : null}
              <span className="truncate">{selectedOption ? toolCopy(selectedOption.label) : (value || placeholder)}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              textValue={toolCopy(option.label)}
              className="py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                {option.icon ? <option.icon className="size-4 shrink-0" /> : null}
                <ToolChoiceFlag option={option} />
                {option.code ? <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-foreground">{option.code}</span> : null}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{toolCopy(option.label)}</span>
                  {option.description ? (
                    <span className="block whitespace-normal text-xs leading-5 text-muted-foreground">
                      {toolCopy(option.description)}
                    </span>
                  ) : null}
                </span>
                {option.badge ? (
                  <Badge variant="outline" className="ml-auto border-primary/20 bg-primary/10 text-primary">
                    {option.badge}
                  </Badge>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ToolField>
  )
}

export function ToolSearchableSelectField({
  label,
  hint,
  hintMode,
  popoverClassName,
  value,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options',
  emptyMessage = 'No matching option.',
  disabled,
  onValueChange,
}: {
  label: string
  hint?: string
  hintMode?: 'inline' | 'tooltip'
  popoverClassName?: string
  value: string
  options: ToolChoice[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <ToolField label={label} hint={hint} hintMode={hintMode}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            disabled={disabled}
            className="h-10 w-full justify-between rounded-xl border-border bg-panel/40 px-3.5 font-medium shadow-none transition-colors hover:border-primary/40 hover:bg-panel/40"
          >
            <span className="flex min-w-0 items-center gap-2 text-left">
              <ToolChoiceFlag option={selectedOption} />
              {selectedOption?.code ? <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-foreground">{selectedOption.code}</span> : null}
              <span className="truncate">{selectedOption ? toolCopy(selectedOption.label) : placeholder}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={label}
          className={cn(
            'max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0',
            popoverClassName,
          )}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} aria-label={tAuto('search_field_for', { label })} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${toolCopy(option.label)} ${option.value}`}
                    onSelect={() => {
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                    className="py-2"
                  >
                    <Check
                      aria-hidden="true"
                      className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')}
                    />
                    <ToolChoiceFlag option={option} />
                    {option.code ? <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-foreground">{option.code}</span> : null}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{toolCopy(option.label)}</span>
                      {option.description ? (
                        <span className="block whitespace-normal text-xs leading-5 text-muted-foreground">
                          {toolCopy(option.description)}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </ToolField>
  )
}

export function ToolRatioPicker({
  value,
  options,
  onValueChange,
}: {
  value: string
  options: ToolChoice[]
  onValueChange: (value: string) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  return (
    <ToolField label={tAuto('aspect_ratio_4e077cf8')}>
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-panel/40 p-1">
        {options.map((option) => {
          const active = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onValueChange(option.value)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'border-transparent bg-primary text-primary-foreground shadow-sm',
              )}
            >
              <span className={cn('size-3 rounded-[2px] bg-muted-foreground/35', active && 'bg-primary-foreground/80')} />
              <span className="truncate">{toolCopy(option.label)}</span>
            </button>
          )
        })}
      </div>
    </ToolField>
  )
}

export function ToolSliderField({
  label,
  value,
  min,
  max,
  suffix,
  presets,
  onValueChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  presets?: number[]
  onValueChange: (value: number) => void
}) {
  const normalizedValue = Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : min
  const displayValue = formatToolSliderValue(normalizedValue)

  return (
    <ToolField label={label}>
      <div>
        <div className="flex items-center gap-4">
          <div className="relative flex h-6 flex-1 items-center">
          <div className="absolute h-1.5 w-full rounded-full bg-accent" />
          <div
            className="absolute h-1.5 rounded-full bg-primary"
            style={{ width: `${((normalizedValue - min) / Math.max(1, max - min)) * 100}%` }}
          />
            <input
              type="range"
              value={normalizedValue}
              min={min}
              max={max}
              step={1}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={normalizedValue}
              onChange={(event) => onValueChange(Number(event.target.value))}
              className="absolute h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {displayValue}{suffix ?? ''}
          </span>
        </div>
        {presets && presets.length > 0 ? (
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={Math.abs(preset - normalizedValue) < 0.000_001}
                onClick={() => onValueChange(preset)}
                className={cn(
                  'h-8 rounded-lg border border-border bg-background/50 px-1 text-xs tabular-nums text-muted-foreground transition hover:border-primary/40 hover:text-foreground',
                  Math.abs(preset - normalizedValue) < 0.000_001 && 'border-primary/40 bg-primary/15 font-semibold text-foreground',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </ToolField>
  )
}

export function formatToolSliderValue(value: number) {
  if (!Number.isFinite(value)) return '0'
  return String(Number(value.toFixed(2)))
}

export function ToolSeedInput({
  value,
  onChange,
  onRandomize,
}: {
  value: string
  onChange: (value: string) => void
  onRandomize: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <ToolField label={tAuto('seed_32fe9f5b')}>
      <div className="flex overflow-hidden rounded-xl border border-border bg-panel/40 focus-within:border-primary/50">
        <Input
          value={value}
          inputMode="numeric"
          onChange={(event) => onChange(event.target.value)}
          className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRandomize}
          className="h-11 w-11 rounded-none border-l border-border dark:border-white/[0.075]"
          aria-label={tAuto('seed_yenile_1c6aa3e6')}
        >
          <Dice5 className="size-4" />
        </Button>
      </div>
    </ToolField>
  )
}

export function ToolToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  icon: LucideIcon
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border border-border bg-panel/40 p-3.5',
      disabled && 'opacity-70',
    )}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

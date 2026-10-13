'use client'

import * as React from 'react'
import { Check, ChevronDown, CircleDollarSign, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToolField } from '@/components/tools/tool-primitives'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'
import { isPricingMissingLabel, publicCatalogText, publicModelFamily, publicModelLabel, publicModelQuality, publicModelSpeed, publicModelCostLabel } from '@/lib/public-model-display'
import { cn } from '@/lib/utils'

export type ToolModel = {
  id: string
  label: string
  description: string
  provider: string
  mark: string
  quality?: string
  speed?: string
  creditLabel?: string
  badges?: string[]
  features?: string[]
  featureTags?: string[]
}

export function ToolModelPicker({
  models: catalogModels,
  selectedModelId,
  onModelChange,
  label,
  hint,
}: {
  models: ToolModel[]
  selectedModelId: string
  onModelChange: (value: string) => void
  label?: string
  hint?: string
}) {
  const t = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const fieldLabel = label ?? t('model_68c2cc7f')
  const models = React.useMemo(() => catalogModels.map(toPublicToolModel), [catalogModels])
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [providerFilter, setProviderFilter] = React.useState('all')
  const [featureFilter, setFeatureFilter] = React.useState('all')
  const [activeModelId, setActiveModelId] = React.useState(selectedModelId)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const selectedModel = models.find((model) => model.id === selectedModelId)
  const providerOptions = React.useMemo(() => [...new Set(models.map((model) => publicModelFamily(model.label)))].sort(), [models])
  const featureOptions = React.useMemo(() => [...new Set(models.flatMap((model) => model.featureTags ?? model.features ?? []))].sort(), [models])
  const filteredModels = filterToolModels(models, { providerFilter, featureFilter, query })
  const activeModel = filteredModels.find((model) => model.id === activeModelId)
    ?? filteredModels.find((model) => model.id === selectedModel?.id)
    ?? filteredModels[0]
  const hasFilters = providerFilter !== 'all' || featureFilter !== 'all'
  const filterCount = Number(providerFilter !== 'all') + Number(featureFilter !== 'all')

  function resetFilters() {
    setProviderFilter('all')
    setFeatureFilter('all')
  }

  function setPickerOpen(nextOpen: boolean) {
    if (nextOpen) {
      setQuery('')
      resetFilters()
      setActiveModelId(selectedModel?.id ?? '')
    }
    setOpen(nextOpen)
  }

  function metadataLabel(value: string) {
    const key = MODEL_METADATA_KEYS[value.toLowerCase()]
    return key ? t(key) : toolCopy(value)
  }

  function creditLabel(model: ToolModel) {
    const numericCredits = model.creditLabel?.match(/^(\d+(?:\.\d+)?) credits?$/i)
    return numericCredits
      ? t('model_picker_credits', { count: Number(numericCredits[1]) })
      : toolCopy(model.creditLabel) || t('model_picker_variable_cost')
  }

  return (
    <ToolField label={fieldLabel} hint={hint}>
      <Popover open={open} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={models.length === 0}
            aria-label={`${fieldLabel}: ${selectedModel?.label ?? t(models.length ? 'model_picker_choose' : 'no_compatible_model_available_4b8b5d9b')}`}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-panel/40 px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ring data-[state=open]:bg-accent/40"
          >
            <ModelMark model={selectedModel} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {selectedModel ? toolCopy(selectedModel.label) : t(models.length ? 'model_picker_choose' : 'no_compatible_model_available_4b8b5d9b')}
            </span>
            {selectedModel?.speed ? (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                <Zap aria-hidden="true" className="size-3" />
                {metadataLabel(selectedModel.speed)}
              </span>
            ) : null}
            <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={t('model_picker_choose')}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchInputRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            if (document.activeElement === document.body) {
              event.preventDefault()
              triggerRef.current?.focus()
            }
          }}
          className="tools-studio flex max-h-[min(460px,var(--radix-popover-content-available-height))] w-[min(640px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border-border bg-popover p-0 text-popover-foreground shadow-xl motion-reduce:animate-none"
        >
          <Command
            label={t('model_picker_choose')}
            shouldFilter={false}
            value={activeModel?.id ?? ''}
            onValueChange={setActiveModelId}
            loop
            className="min-h-0 rounded-none bg-transparent"
          >
            <div className="flex shrink-0 items-center border-b border-border px-1 [&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input-wrapper]]:min-w-0 [&_[data-slot=command-input-wrapper]]:flex-1 [&_[data-slot=command-input-wrapper]]:border-0">
              <CommandInput
                ref={searchInputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={t('model_picker_search')}
                aria-label={t('model_picker_search')}
              />
              {query ? (
                <button
                  type="button"
                  aria-label={t('model_picker_clear_search')}
                  onClick={() => { setQuery(''); searchInputRef.current?.focus() }}
                  className="mr-1 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
              {providerOptions.length > 1 || featureOptions.length > 1 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('model_picker_filters')}
                      className={cn('mr-2 flex items-center gap-1.5 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', hasFilters && 'bg-accent text-foreground')}
                    >
                      <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                      {hasFilters ? <span className="text-xs tabular-nums">{filterCount}</span> : null}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={8}
                    aria-label={t('model_picker_filters')}
                    onKeyDown={(event) => {
                      if (event.key !== 'Escape') event.stopPropagation()
                    }}
                    className="tools-studio w-60 space-y-3 rounded-xl p-3"
                  >
                    {providerOptions.length > 1 ? (
                      <ModelFilter label={t('all_model_families_5c031cad')} options={providerOptions} value={providerFilter} onChange={setProviderFilter} formatLabel={metadataLabel} />
                    ) : null}
                    {featureOptions.length > 1 ? (
                      <ModelFilter label={t('all_features_f136c558')} options={featureOptions} value={featureFilter} onChange={setFeatureFilter} formatLabel={metadataLabel} />
                    ) : null}
                    {hasFilters ? <button type="button" onClick={resetFilters} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{t('model_picker_reset_filters')}</button> : null}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:w-[54%] sm:flex-none">
                <div className="flex h-9 shrink-0 items-center justify-between px-4 text-[11px] font-medium text-muted-foreground">
                  <span>{t(hasFilters ? 'model_picker_filtered' : 'all_models_473186e4')}</span>
                  <span className="tabular-nums">{filteredModels.length}</span>
                </div>
                <CommandList label={t('all_models_473186e4')} className="tools-scrollbar min-h-0 max-h-none flex-1 px-1.5 pb-1.5">
                  <CommandEmpty className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <p>{t('model_bulunamadi_8b983615')}</p>
                    {hasFilters ? <button type="button" onClick={resetFilters} className="mt-3 underline underline-offset-4">{t('model_picker_reset_filters')}</button> : null}
                  </CommandEmpty>
                  {filteredModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      disabled={isPricingMissingLabel(model.creditLabel)}
                      onSelect={() => { if (isPricingMissingLabel(model.creditLabel)) return; onModelChange(model.id); setOpen(false) }}
                      className="my-0.5 cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-foreground data-[selected=true]:bg-accent/70 data-[selected=true]:text-foreground"
                    >
                      <ModelMark model={model} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-5">{toolCopy(model.label)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
                          <span>{model.speed ? metadataLabel(model.speed) : publicModelFamily(model.label)}</span>
                          {model.badges?.includes('Default') ? <><span aria-hidden="true">·</span><span>{metadataLabel('Default')}</span></> : null}
                          <span className="sm:hidden">· {creditLabel(model)}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground sm:hidden">{toolCopy(model.description)}</span>
                        {model.quality ? <span className="mt-1 block text-[11px] text-muted-foreground sm:hidden">{t('quality_a60f2c73')}: {metadataLabel(model.quality)}</span> : null}
                      </span>
                      <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                        {model.id === selectedModel?.id ? <><Check aria-hidden="true" className="size-3.5 text-foreground" /><span className="sr-only">{t('selected_9a976fc2')}</span></> : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandList>
              </div>

              <aside aria-label={t('model_picker_details')} className="tools-scrollbar hidden min-h-0 min-w-0 flex-1 overflow-y-auto border-l border-border bg-panel/30 p-4 sm:block">
                {activeModel ? (
                  <>
                    <div className="mb-4 flex h-5 items-center justify-between text-[10px] font-medium text-muted-foreground">
                      <span>{t('model_picker_details')}</span>
                      {activeModel.id === selectedModel?.id ? <span className="flex items-center gap-1"><Check aria-hidden="true" className="size-3" />{t('selected_9a976fc2')}</span> : null}
                    </div>
                    <h3 className="text-sm font-semibold leading-5">{toolCopy(activeModel.label)}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{toolCopy(activeModel.description)}</p>
                    <dl className="mt-5 space-y-3 text-xs">
                      {activeModel.speed ? <ModelMetric icon={Zap} label={t('model_picker_speed')} value={metadataLabel(activeModel.speed)} /> : null}
                      {activeModel.quality ? <ModelMetric icon={Sparkles} label={t('quality_a60f2c73')} value={metadataLabel(activeModel.quality)} /> : null}
                      <ModelMetric icon={CircleDollarSign} label={t('estimated_credits_7dbeefda')} value={creditLabel(activeModel)} />
                    </dl>
                    <p className="mt-4 border-t border-border pt-3 text-[11px] leading-[1.6] text-muted-foreground">{t('model_picker_cost_hint')}</p>
                  </>
                ) : <p className="mt-12 text-center text-xs leading-5 text-muted-foreground">{t('model_picker_empty_hint')}</p>}
              </aside>
            </div>

            <div className="hidden shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-muted-foreground sm:flex">
              <span><span aria-hidden="true" className="mr-1.5">↑ ↓</span>{t('model_picker_navigate')}</span>
              <span><span aria-hidden="true" className="mr-1.5">↵</span>{t('model_picker_select')}</span>
              <span className="ml-auto"><span aria-hidden="true" className="mr-1.5">esc</span>{t('model_picker_close')}</span>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </ToolField>
  )
}

function ModelMark({ model }: { model?: ToolModel }) {
  return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50 text-xs font-semibold text-muted-foreground">{model?.mark ?? 'A'}</span>
}

function ModelMetric({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <dt className="flex items-center gap-2 text-muted-foreground"><Icon aria-hidden="true" className="size-3.5" />{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function ModelFilter({ label, options, value, onChange, formatLabel }: { label: string; options: string[]; value: string; onChange: (value: string) => void; formatLabel: (value: string) => string }) {
  return (
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-border bg-popover px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="all">{label}</option>
        {options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
      </select>
    </label>
  )
}

const MODEL_METADATA_KEYS: Record<string, string> = {
  fastest: 'model_picker_fastest',
  fast: 'model_picker_fast',
  medium: 'model_picker_medium',
  slow: 'model_picker_slow',
  standard: 'model_picker_standard',
  good: 'model_picker_good',
  high: 'model_picker_high',
  highest: 'model_picker_highest',
  frontier: 'model_picker_frontier',
  default: 'model_picker_default',
}

export function filterToolModels(models: ToolModel[], filters: { providerFilter: string; featureFilter: string; query: string }) {
  const normalizedQuery = filters.query.trim().toLowerCase()
  return models.map(toPublicToolModel).filter((model) => {
    if (filters.providerFilter !== 'all' && publicModelFamily(model.label) !== filters.providerFilter) return false
    if (filters.featureFilter !== 'all' && !(model.featureTags ?? model.features ?? []).includes(filters.featureFilter)) return false
    if (!normalizedQuery) return true
    return [model.label, model.description, publicModelFamily(model.label), ...(model.featureTags ?? []), ...(model.features ?? [])].join(' ').toLowerCase().includes(normalizedQuery)
  })
}

function toPublicToolModel(model: ToolModel): ToolModel {
  const quality = model.quality ? publicModelQuality(model.quality) : undefined
  const speed = model.speed ? publicModelSpeed(model.speed) : undefined
  const privateRatings = new Set([
    ...(model.quality && quality?.toLowerCase() !== model.quality.trim().toLowerCase() ? [model.quality] : []),
    ...(model.speed && speed?.toLowerCase() !== model.speed.trim().toLowerCase() ? [model.speed] : []),
  ])
  const publicFeature = (value: string) => privateRatings.has(value) ? '' : publicCatalogText(value)
  return {
    id: model.id,
    label: publicModelLabel(model.label),
    description: publicCatalogText(model.description),
    provider: 'Youtorch',
    mark: publicModelFamily(model.label).slice(0, 1),
    quality,
    speed,
    creditLabel: model.creditLabel ? publicModelCostLabel(model.creditLabel, null) : undefined,
    features: model.features?.map(publicFeature).filter(Boolean),
    featureTags: model.featureTags?.map(publicFeature).filter(Boolean),
    badges: model.badges?.filter((value) => value === 'Default'),
  }
}

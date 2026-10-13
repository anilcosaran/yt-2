'use client'

// The settings of a (smart) collection, shared by the creation wizard and the collection's Settings tab:
// intake (what gets in), automatic analysis, AI usage & frequency, quality & permissions.

import * as React from 'react'
import {
  AlertTriangle,
  Bot,
  Info,
  MessagesSquare,
  Plus,
  Trash2,
  Workflow,
  Clapperboard,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { analysisCoversKind, availabilitySummary, estimateAnalysisCredits, matchIntake } from './library-logic'
import { ASSET_KINDS, type AgentKey, type AnalysisFeature, type AssetKind, type CollectionSettings, type IntakeRule, type LibraryAsset, type LibraryCollection } from './library-types'
import { KIND_ICONS } from './library-ui'

export type SettingsChange = <K extends keyof CollectionSettings>(section: K, patch: Partial<CollectionSettings[K]>) => void

// ---------------------------------------------------------------------------------------------------------------
// building blocks

export function SettingsCard({ id, title, description, children, className }: { id?: string; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-2xl border border-border bg-card', className)}>
      <header className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function FieldRow({ label, description, children, stacked = false, className }: { label: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; stacked?: boolean; className?: string }) {
  return (
    <div className={cn('px-5 py-4', stacked ? 'space-y-3' : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8', className)}>
      <div className="min-w-0 sm:max-w-md">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className={cn(stacked ? '' : 'shrink-0')}>{children}</div>
    </div>
  )
}

export function OptionCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; title: React.ReactNode; description?: React.ReactNode; icon?: LucideIcon; badge?: React.ReactNode }>
  columns?: 2 | 3 | 4
}) {
  return (
    <div role="radiogroup" className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', columns === 4 && 'sm:grid-cols-2 xl:grid-cols-4')}>
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
              selected ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:bg-accent/50',
            )}
          >
            {Icon && (
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border', selected ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
                <Icon className="size-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">{option.title}{option.badge}</span>
              {option.description && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, onChange, options, className }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: React.ReactNode }>; className?: string }) {
  return (
    <div role="radiogroup" className={cn('inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1', className)}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            option.value === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function KindToggles({ value, onChange, kinds = ASSET_KINDS }: { value: AssetKind[]; onChange: (value: AssetKind[]) => void; kinds?: readonly AssetKind[] }) {
  const t = useTranslations('Library.kind')
  return (
    <div className="flex flex-wrap gap-1.5">
      {kinds.map((kind) => {
        const Icon = KIND_ICONS[kind]
        const active = value.includes(kind)
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((item) => item !== kind) : [...value, kind])}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'border-primary/50 bg-primary/12 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/60',
            )}
          >
            <Icon className="size-3.5" />
            {t(kind)}
          </button>
        )
      })}
    </div>
  )
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: React.ReactNode }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info
  return (
    <div className={cn(
      'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-5',
      tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-sky-500/25 bg-sky-500/8 text-sky-900 dark:text-sky-100',
    )}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function NumberOrUnlimited({ value, onChange, unit, min = 1, unlimitedLabel }: { value: number | null; onChange: (value: number | null) => void; unit: string; min?: number; unlimitedLabel: string }) {
  const unlimited = value === null
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex items-center gap-2', unlimited && 'opacity-40')}>
        <Input
          type="number"
          min={min}
          value={unlimited ? '' : value}
          disabled={unlimited}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange(Number.isFinite(next) && next >= min ? Math.round(next) : min)
          }}
          className="h-9 w-20 text-center"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={unlimited} onCheckedChange={(checked) => onChange(checked ? null : Math.max(min, 3))} />
        {unlimitedLabel}
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// intake

const RULE_FIELDS: IntakeRule['field'][] = ['tag', 'name', 'kind', 'source', 'duration']

export function IntakeFields({
  settings,
  onChange,
  assets,
  collectionId,
  keywords = [],
  onAddMatches,
}: {
  settings: CollectionSettings
  onChange: SettingsChange
  assets: LibraryAsset[]
  collectionId?: string
  keywords?: string[]
  onAddMatches?: (assetIds: string[]) => void
}) {
  const t = useTranslations('Library.settings.intake')
  const tKind = useTranslations('Library.kind')
  const { intake } = settings
  const matches = matchIntake(assets, settings, keywords)
  const outside = collectionId ? matches.filter((asset) => !asset.collectionIds.includes(collectionId)) : matches
  const existingOutsideKinds = collectionId
    ? Array.from(new Set(assets.filter((asset) => asset.collectionIds.includes(collectionId) && !intake.acceptedKinds.includes(asset.kind)).map((asset) => asset.kind)))
    : []

  const updateRule = (id: string, patch: Partial<IntakeRule>) => onChange('intake', { rules: intake.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) })

  return (
    <>
      <FieldRow label={t('modeLabel')} description={t('modeDescription')} stacked>
        <OptionCards
          value={intake.mode}
          onChange={(mode) => onChange('intake', { mode })}
          columns={3}
          options={[
            { value: 'manual', title: t('modeManual'), description: t('modeManualHint') },
            { value: 'suggest', title: t('modeSuggest'), description: t('modeSuggestHint') },
            { value: 'rules', title: t('modeRules'), description: t('modeRulesHint') },
          ]}
        />
      </FieldRow>

      <FieldRow label={t('kindsLabel')} description={t('kindsDescription')} stacked>
        <KindToggles value={intake.acceptedKinds} onChange={(acceptedKinds) => onChange('intake', { acceptedKinds })} />
        {intake.acceptedKinds.length === 0 && <Callout tone="warning">{t('kindsEmpty')}</Callout>}
        {existingOutsideKinds.length > 0 && (
          <Callout>{t('kindsExisting', { kinds: existingOutsideKinds.map((kind) => tKind(kind)).join(', ') })}</Callout>
        )}
      </FieldRow>

      {intake.mode === 'rules' && (
        <FieldRow label={t('rulesLabel')} description={t('rulesDescription')} stacked>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('matchPrefix')}
              <Segmented
                value={intake.matchAll ? 'all' : 'any'}
                onChange={(value) => onChange('intake', { matchAll: value === 'all' })}
                options={[{ value: 'all', label: t('matchAll') }, { value: 'any', label: t('matchAny') }]}
              />
              {t('matchSuffix')}
            </div>
            {intake.rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
                <select
                  value={rule.field}
                  onChange={(event) => updateRule(rule.id, { field: event.target.value as IntakeRule['field'] })}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {RULE_FIELDS.map((field) => <option key={field} value={field}>{t(`field.${field}`)}</option>)}
                </select>
                <select
                  value={rule.operator}
                  onChange={(event) => updateRule(rule.id, { operator: event.target.value as IntakeRule['operator'] })}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {(rule.field === 'duration' ? ['gt', 'lt'] as const : rule.field === 'kind' || rule.field === 'source' ? ['is', 'is_not'] as const : ['contains', 'is_not'] as const)
                    .map((operator) => <option key={operator} value={operator}>{t(`operator.${operator}`)}</option>)}
                </select>
                {rule.field === 'kind' ? (
                  <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} className="h-9 min-w-36 rounded-lg border border-border bg-background px-2 text-sm">
                    {ASSET_KINDS.map((kind) => <option key={kind} value={kind}>{tKind(kind)}</option>)}
                  </select>
                ) : rule.field === 'source' ? (
                  <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} className="h-9 min-w-36 rounded-lg border border-border bg-background px-2 text-sm">
                    {(['upload', 'generated', 'recording', 'youtube'] as const).map((source) => <option key={source} value={source}>{t(`source.${source}`)}</option>)}
                  </select>
                ) : (
                  <Input
                    value={rule.value}
                    onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                    placeholder={rule.field === 'duration' ? t('durationPlaceholder') : t('valuePlaceholder')}
                    className="h-9 min-w-36 flex-1"
                  />
                )}
                <button
                  type="button"
                  aria-label={t('removeRule')}
                  onClick={() => onChange('intake', { rules: intake.rules.filter((item) => item.id !== rule.id) })}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange('intake', { rules: [...intake.rules, { id: `r-${Date.now()}`, field: 'tag', operator: 'contains', value: '' }] })}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <Plus className="size-4" />{t('addRule')}
            </button>
            {intake.rules.length === 0 && <Callout>{t('rulesEmpty')}</Callout>}
          </div>
        </FieldRow>
      )}

      {intake.mode !== 'manual' && (
        <>
          <FieldRow label={t('approvalLabel')} description={t('approvalDescription')} stacked>
            <OptionCards
              value={intake.approval}
              onChange={(approval) => onChange('intake', { approval })}
              options={[
                { value: 'auto', title: t('approvalAuto'), description: t('approvalAutoHint') },
                { value: 'review', title: t('approvalReview'), description: t('approvalReviewHint') },
              ]}
            />
          </FieldRow>
          <FieldRow label={t('generatedLabel')} description={t('generatedDescription')}>
            <Switch checked={intake.includeGenerated} onCheckedChange={(includeGenerated) => onChange('intake', { includeGenerated })} />
          </FieldRow>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-foreground">
                {t('matchPreview', { count: matches.length })}
                {collectionId && outside.length > 0 && <span className="text-muted-foreground"> · {t('matchOutside', { count: outside.length })}</span>}
              </p>
              {onAddMatches && outside.length > 0 && (
                <button
                  type="button"
                  onClick={() => onAddMatches(outside.map((asset) => asset.id))}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {intake.approval === 'review' ? t('sendToReview', { count: outside.length }) : t('addNow', { count: outside.length })}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// automatic analysis

const FEATURES: Array<{ key: AnalysisFeature; kinds: 'all' | 'visual' | 'timed' }> = [
  { key: 'tags', kinds: 'all' },
  { key: 'description', kinds: 'all' },
  { key: 'transcript', kinds: 'timed' },
  { key: 'ocr', kinds: 'visual' },
  { key: 'colors', kinds: 'visual' },
  { key: 'quality', kinds: 'all' },
  { key: 'people', kinds: 'visual' },
  { key: 'brand_fit', kinds: 'all' },
]

export function AnalysisFields({
  settings,
  onChange,
  assets,
  onAnalyzeNow,
}: {
  settings: CollectionSettings
  onChange: SettingsChange
  /** Items the estimate is computed for (the collection's items, or the wizard's matches). */
  assets: LibraryAsset[]
  onAnalyzeNow?: (assetIds: string[]) => void
}) {
  const t = useTranslations('Library.settings.analysis')
  const { analysis, policy } = settings
  const estimate = estimateAnalysisCredits(assets, analysis)
  const unanalyzed = assets.filter((asset) => asset.analysis.state !== 'analyzed' && analysisCoversKind(analysis, asset.kind))
  const off = analysis.scope === 'off'

  return (
    <>
      <FieldRow label={t('scopeLabel')} description={t('scopeDescription')} stacked>
        <OptionCards
          value={analysis.scope}
          onChange={(scope) => onChange('analysis', { scope })}
          columns={4}
          options={[
            { value: 'all', title: t('scopeAll'), description: t('scopeAllHint') },
            { value: 'images_only', title: t('scopeImages'), description: t('scopeImagesHint') },
            { value: 'selected', title: t('scopeSelected'), description: t('scopeSelectedHint') },
            { value: 'off', title: t('scopeOff'), description: t('scopeOffHint') },
          ]}
        />
        {analysis.scope === 'selected' && (
          <KindToggles value={analysis.kinds} onChange={(kinds) => onChange('analysis', { kinds })} kinds={['video', 'image', 'audio', 'avatar', 'motion', 'text']} />
        )}
        {off && policy.aiAccess && <Callout tone="warning">{t('offWithAi')}</Callout>}
        {off && policy.requireAnalysis && <Callout tone="warning">{t('offWithRequire')}</Callout>}
      </FieldRow>

      {!off && (
        <>
          <FieldRow label={t('depthLabel')} description={analysis.depth === 'quick' ? t('depthQuickHint') : t('depthDetailedHint')}>
            <Segmented
              value={analysis.depth}
              onChange={(depth) => onChange('analysis', { depth })}
              options={[{ value: 'quick', label: t('depthQuick') }, { value: 'detailed', label: t('depthDetailed') }]}
            />
          </FieldRow>

          <FieldRow label={t('featuresLabel')} description={t('featuresDescription')} stacked>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((feature) => {
                const active = analysis.features.includes(feature.key)
                return (
                  <label
                    key={feature.key}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      active ? 'border-primary/50 bg-primary/8' : 'border-border hover:bg-accent/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => onChange('analysis', {
                        features: active ? analysis.features.filter((item) => item !== feature.key) : [...analysis.features, feature.key],
                      })}
                      className="mt-0.5 size-4 accent-current"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {t(`feature.${feature.key}`)}
                        <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">{t(`featureKinds.${feature.kinds}`)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t(`featureHint.${feature.key}`)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            {analysis.features.includes('people') && <Callout>{t('peopleNotice')}</Callout>}
          </FieldRow>

          <FieldRow label={t('reanalyzeLabel')} description={t('reanalyzeDescription')}>
            <Switch checked={analysis.reanalyzeOnEdit} onCheckedChange={(reanalyzeOnEdit) => onChange('analysis', { reanalyzeOnEdit })} />
          </FieldRow>

          <FieldRow label={t('budgetLabel')} description={t('budgetDescription')} stacked>
            <NumberOrUnlimited
              value={analysis.monthlyCreditCap}
              onChange={(monthlyCreditCap) => onChange('analysis', { monthlyCreditCap })}
              unit={t('creditsPerMonth')}
              unlimitedLabel={t('unlimited')}
              min={10}
            />
            {analysis.monthlyCreditCap !== null && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('capReachedLabel')}</p>
                <Segmented
                  value={analysis.onCapReached}
                  onChange={(onCapReached) => onChange('analysis', { onCapReached })}
                  options={[
                    { value: 'queue', label: t('capQueue') },
                    { value: 'quick', label: t('capQuick') },
                    { value: 'stop', label: t('capStop') },
                  ]}
                />
              </div>
            )}
          </FieldRow>

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t('estimate', { credits: estimate.credits, count: estimate.covered })}</p>
                <p className="text-xs text-muted-foreground">{t('estimateHint')}</p>
              </div>
              {onAnalyzeNow && unanalyzed.length > 0 && (
                <button
                  type="button"
                  onClick={() => onAnalyzeNow(unanalyzed.map((asset) => asset.id))}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {t('analyzeNow', { count: unanalyzed.length })}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// AI usage & frequency

const AGENTS: Array<{ key: AgentKey; icon: LucideIcon }> = [
  { key: 'spark', icon: Clapperboard },
  { key: 'flow', icon: Workflow },
  { key: 'assistant', icon: MessagesSquare },
]

const COOLDOWNS = [0, 1, 3, 7, 14, 30, 90]

export function PolicyFields({
  settings,
  onChange,
  assets,
  collection,
}: {
  settings: CollectionSettings
  onChange: SettingsChange
  assets: LibraryAsset[]
  collection?: LibraryCollection
}) {
  const t = useTranslations('Library.settings.policy')
  const { policy } = settings
  const preview = collection ? availabilitySummary(assets, { ...collection, settings }) : null
  const nowExhausted = policy.maxUsesPerItem !== null
    ? assets.filter((asset) => asset.usage.count >= (policy.maxUsesPerItem ?? Infinity)).length
    : 0

  return (
    <>
      <FieldRow label={t('accessLabel')} description={t('accessDescription')}>
        <Switch checked={policy.aiAccess} onCheckedChange={(aiAccess) => onChange('policy', { aiAccess })} />
      </FieldRow>

      <div className={cn(!policy.aiAccess && 'pointer-events-none opacity-45')}>
        <FieldRow label={t('agentsLabel')} description={t('agentsDescription')} stacked>
          <div className="grid gap-2 sm:grid-cols-3">
            {AGENTS.map(({ key, icon: Icon }) => {
              const active = policy.agents.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange('policy', { agents: active ? policy.agents.filter((agent) => agent !== key) : [...policy.agents, key] })}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    active ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-accent/50',
                  )}
                >
                  <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t(`agent.${key}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`agentHint.${key}`)}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {policy.aiAccess && policy.agents.length === 0 && <Callout tone="warning">{t('agentsEmpty')}</Callout>}
        </FieldRow>

        <FieldRow label={t('maxUsesLabel')} description={t('maxUsesDescription')} stacked>
          <NumberOrUnlimited
            value={policy.maxUsesPerItem}
            onChange={(maxUsesPerItem) => onChange('policy', { maxUsesPerItem })}
            unit={t('timesPerItem')}
            unlimitedLabel={t('unlimited')}
          />
          {nowExhausted > 0 && <Callout>{t('maxUsesImpact', { count: nowExhausted })}</Callout>}
        </FieldRow>

        <FieldRow label={t('cooldownLabel')} description={t('cooldownDescription')} stacked>
          <Segmented
            value={policy.cooldownDays}
            onChange={(cooldownDays) => onChange('policy', { cooldownDays })}
            options={COOLDOWNS.map((days) => ({ value: days, label: days === 0 ? t('cooldownNone') : t('cooldownDays', { days }) }))}
          />
        </FieldRow>

        <FieldRow label={t('onceLabel')} description={t('onceDescription')}>
          <Switch checked={policy.oncePerProject} onCheckedChange={(oncePerProject) => onChange('policy', { oncePerProject })} />
        </FieldRow>

        <FieldRow label={t('weeklyLabel')} description={t('weeklyDescription')} stacked>
          <NumberOrUnlimited
            value={policy.weeklyCap}
            onChange={(weeklyCap) => onChange('policy', { weeklyCap })}
            unit={t('itemsPerWeek')}
            unlimitedLabel={t('unlimited')}
          />
          {preview && policy.weeklyCap !== null && policy.weeklyCap > preview.available && (
            <Callout tone="warning">{t('weeklyTooHigh', { cap: policy.weeklyCap, available: preview.available })}</Callout>
          )}
        </FieldRow>

        <FieldRow label={t('rotationLabel')} description={t('rotationDescription')} stacked>
          <OptionCards
            value={policy.rotation}
            onChange={(rotation) => onChange('policy', { rotation })}
            columns={4}
            options={(['least_used', 'newest', 'best_quality', 'random'] as const).map((value) => ({ value, title: t(`rotation.${value}`), description: t(`rotationHint.${value}`) }))}
          />
        </FieldRow>

        <FieldRow label={t('exhaustedLabel')} description={t('exhaustedDescription')} stacked>
          <OptionCards
            value={policy.whenExhausted}
            onChange={(whenExhausted) => onChange('policy', { whenExhausted })}
            columns={3}
            options={(['pause_item', 'warn', 'archive_item'] as const).map((value) => ({ value, title: t(`exhausted.${value}`), description: t(`exhaustedHint.${value}`) }))}
          />
        </FieldRow>

        <FieldRow label={t('requireAnalysisLabel')} description={t('requireAnalysisDescription')}>
          <Switch checked={policy.requireAnalysis} onCheckedChange={(requireAnalysis) => onChange('policy', { requireAnalysis })} />
        </FieldRow>
      </div>

      {preview && (
        <div className="px-5 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-foreground">
              {t('impact', { available: preview.available, cooldown: preview.cooldown, exhausted: preview.exhausted, blocked: preview.blocked })}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// quality & permissions

export function GuardrailFields({ settings, onChange, assets }: { settings: CollectionSettings; onChange: SettingsChange; assets: LibraryAsset[] }) {
  const t = useTranslations('Library.settings.guardrails')
  const { guardrails } = settings
  const peopleWithoutConsent = assets.filter((asset) => asset.flags.includes('needs_consent')).length
  const lowQuality = assets.filter((asset) => (asset.analysis.quality ?? 100) < 70 || asset.flags.includes('low_quality')).length
  const noLicense = assets.filter((asset) => asset.flags.includes('no_license')).length

  return (
    <>
      <FieldRow label={t('resolutionLabel')} description={t('resolutionDescription')}>
        <Segmented
          value={guardrails.minResolution}
          onChange={(minResolution) => onChange('guardrails', { minResolution })}
          options={[
            { value: 'any', label: t('resolutionAny') },
            { value: '720p', label: '720p' },
            { value: '1080p', label: '1080p' },
            { value: '4k', label: '4K' },
          ]}
        />
      </FieldRow>

      <FieldRow label={t('durationLabel')} description={t('durationDescription')}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder={t('min')}
            value={guardrails.minDurationSeconds ?? ''}
            onChange={(event) => onChange('guardrails', { minDurationSeconds: event.target.value === '' ? null : Number(event.target.value) })}
            className="h-9 w-20 text-center"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder={t('max')}
            value={guardrails.maxDurationSeconds ?? ''}
            onChange={(event) => onChange('guardrails', { maxDurationSeconds: event.target.value === '' ? null : Number(event.target.value) })}
            className="h-9 w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">{t('seconds')}</span>
        </div>
      </FieldRow>

      <FieldRow label={t('lowQualityLabel')} description={lowQuality ? t('lowQualityCount', { count: lowQuality }) : t('lowQualityDescription')}>
        <Switch checked={guardrails.excludeLowQuality} onCheckedChange={(excludeLowQuality) => onChange('guardrails', { excludeLowQuality })} />
      </FieldRow>

      <FieldRow label={t('duplicatesLabel')} description={t('duplicatesDescription')}>
        <Segmented
          value={guardrails.duplicates}
          onChange={(duplicates) => onChange('guardrails', { duplicates })}
          options={[
            { value: 'merge', label: t('duplicatesMerge') },
            { value: 'warn', label: t('duplicatesWarn') },
            { value: 'ignore', label: t('duplicatesIgnore') },
          ]}
        />
      </FieldRow>

      <FieldRow label={t('consentLabel')} description={peopleWithoutConsent ? t('consentCount', { count: peopleWithoutConsent }) : t('consentDescription')}>
        <Switch checked={guardrails.requireConsentForPeople} onCheckedChange={(requireConsentForPeople) => onChange('guardrails', { requireConsentForPeople })} />
      </FieldRow>

      <FieldRow label={t('licenseLabel')} description={noLicense ? t('licenseCount', { count: noLicense }) : t('licenseDescription')}>
        <Switch checked={guardrails.requireLicense} onCheckedChange={(requireLicense) => onChange('guardrails', { requireLicense })} />
      </FieldRow>

      <FieldRow label={t('expiryLabel')} description={t('expiryDescription')}>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={guardrails.expiresAt ? guardrails.expiresAt.slice(0, 10) : ''}
            onChange={(event) => onChange('guardrails', { expiresAt: event.target.value ? new Date(`${event.target.value}T23:59:00`).toISOString() : null })}
            className="h-9 w-40"
          />
          {guardrails.expiresAt && (
            <button type="button" onClick={() => onChange('guardrails', { expiresAt: null })} className="text-xs text-muted-foreground hover:text-foreground">
              {t('clearDate')}
            </button>
          )}
        </div>
      </FieldRow>
    </>
  )
}

/** Short human summary of a policy, e.g. "max 3 · every 14 days · least used first". */
export function usePolicySummary() {
  const t = useTranslations('Library.policySummary')
  return React.useCallback((settings: CollectionSettings) => {
    const { policy } = settings
    if (!policy.aiAccess) return [t('noAi')]
    const parts: string[] = []
    parts.push(policy.maxUsesPerItem === null ? t('unlimitedUses') : t('maxUses', { count: policy.maxUsesPerItem }))
    if (policy.cooldownDays > 0) parts.push(t('cooldown', { days: policy.cooldownDays }))
    if (policy.weeklyCap !== null) parts.push(t('weekly', { count: policy.weeklyCap }))
    parts.push(t(`rotation.${policy.rotation}`))
    return parts
  }, [t])
}


// Pure rules of the Library UI: whether the AI may use an item right now, which items a smart collection's
// intake rules match, what analysis would cost and what needs the owner's attention.

import type {
  AssetAvailability,
  AssetKind,
  CollectionSettings,
  IntakeRule,
  LibraryAsset,
  LibraryCollection,
} from './library-types'

type AnalysisSettingsInput = CollectionSettings['analysis']

const DAY = 24 * 3600 * 1000

export function getAvailability(asset: LibraryAsset, collection: LibraryCollection | null, now = Date.now()): AssetAvailability {
  if (asset.aiExcluded) return { state: 'hidden' }
  if (asset.expiresAt && Date.parse(asset.expiresAt) < now) return { state: 'expired' }
  const settings = collection?.settings
  if (asset.flags.includes('needs_consent') && (settings?.guardrails.requireConsentForPeople ?? true)) {
    return { state: 'blocked_consent' }
  }
  if (settings?.guardrails.requireLicense && asset.flags.includes('no_license')) return { state: 'blocked_license' }
  if (settings && settings.guardrails.duplicates !== 'ignore' && asset.flags.includes('duplicate')) return { state: 'blocked_duplicate' }
  if (settings?.guardrails.excludeLowQuality && (asset.flags.includes('low_quality') || (asset.analysis.quality ?? 100) < 70)) {
    return { state: 'blocked_quality' }
  }
  if ((settings?.policy.requireAnalysis ?? false) && asset.analysis.state !== 'analyzed' && asset.analysis.state !== 'skipped') {
    return { state: 'pending_analysis' }
  }
  const limit = settings?.policy.maxUsesPerItem ?? null
  if (limit !== null && asset.usage.count >= limit) return { state: 'exhausted', used: asset.usage.count, limit }
  const cooldown = settings?.policy.cooldownDays ?? 0
  if (cooldown > 0 && asset.usage.lastUsedAt) {
    const readyAt = Date.parse(asset.usage.lastUsedAt) + cooldown * DAY
    if (readyAt > now) return { state: 'cooldown', daysLeft: Math.max(1, Math.ceil((readyAt - now) / DAY)) }
  }
  return { state: 'available' }
}

export function collectionAssets(assets: LibraryAsset[], collectionId: string) {
  return assets.filter((asset) => asset.collectionIds.includes(collectionId))
}

export function countByKind(assets: LibraryAsset[]) {
  const counts: Partial<Record<AssetKind, number>> = {}
  for (const asset of assets) counts[asset.kind] = (counts[asset.kind] ?? 0) + 1
  return counts
}

export function availabilitySummary(assets: LibraryAsset[], collection: LibraryCollection) {
  const summary = { available: 0, cooldown: 0, exhausted: 0, blocked: 0 }
  for (const asset of assets) {
    const availability = getAvailability(asset, collection)
    if (availability.state === 'available') summary.available += 1
    else if (availability.state === 'cooldown') summary.cooldown += 1
    else if (availability.state === 'exhausted') summary.exhausted += 1
    else summary.blocked += 1
  }
  return summary
}

export function analysisSummary(assets: LibraryAsset[]) {
  const summary = { analyzed: 0, pending: 0, failed: 0, skipped: 0 }
  for (const asset of assets) {
    if (asset.analysis.state === 'analyzed') summary.analyzed += 1
    else if (asset.analysis.state === 'failed') summary.failed += 1
    else if (asset.analysis.state === 'skipped') summary.skipped += 1
    else summary.pending += 1
  }
  return summary
}

/** Whether the analysis settings of a collection cover this kind of item. */
export function analysisCoversKind(analysis: AnalysisSettingsInput, kind: AssetKind) {
  if (analysis.scope === 'off') return false
  if (analysis.scope === 'all') return true
  if (analysis.scope === 'images_only') return kind === 'image'
  return analysis.kinds.includes(kind)
}

function ruleMatches(asset: LibraryAsset, rule: IntakeRule) {
  const value = rule.value.trim().toLocaleLowerCase('tr')
  if (!value) return true
  switch (rule.field) {
    case 'tag': {
      const hit = asset.analysis.tags.some((tag) => tag.toLocaleLowerCase('tr').includes(value))
      return rule.operator === 'is_not' ? !hit : hit
    }
    case 'name': {
      const hit = asset.name.toLocaleLowerCase('tr').includes(value)
      return rule.operator === 'is_not' ? !hit : hit
    }
    case 'kind':
      return rule.operator === 'is_not' ? asset.kind !== value : asset.kind === value
    case 'source':
      return rule.operator === 'is_not' ? asset.source !== value : asset.source === value
    case 'duration': {
      const seconds = asset.durationSeconds ?? 0
      const limit = Number(value)
      if (!Number.isFinite(limit)) return true
      return rule.operator === 'lt' ? seconds < limit : seconds > limit
    }
    default:
      return true
  }
}

const STOPWORDS = new Set(['için', 'gibi', 'olan', 'ile', 've', 'bir', 'bu', 'kısa', 'olarak', 'kullanılır', 'the', 'and', 'for', 'with'])

/** Items of the library that the intake of `settings` would bring into a collection. */
export function matchIntake(assets: LibraryAsset[], settings: CollectionSettings, keywords: string[] = []) {
  const { intake } = settings
  if (intake.mode === 'manual') return []
  // Crude Turkish stemming so "Tatlılar" finds items tagged "tatlı" and "Yemekler" finds "yemek".
  const words = keywords
    .map((word) => word.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9-]/g, ''))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map((word) => (word.length > 5 ? word.slice(0, word.length - 3) : word))
  return assets.filter((asset) => {
    if (!intake.acceptedKinds.includes(asset.kind)) return false
    if (!intake.includeGenerated && asset.source === 'generated') return false
    if (intake.mode === 'rules' && intake.rules.length > 0) {
      return intake.matchAll ? intake.rules.every((rule) => ruleMatches(asset, rule)) : intake.rules.some((rule) => ruleMatches(asset, rule))
    }
    if (words.length === 0) return true
    const haystack = [asset.name, ...asset.analysis.tags, asset.analysis.summary ?? ''].join(' ').toLocaleLowerCase('tr')
    return words.some((word) => haystack.includes(word))
  })
}

/** Rough credit estimate of analysing `assets` with `analysis` (one-off for existing items). */
export function estimateAnalysisCredits(assets: LibraryAsset[], analysis: AnalysisSettingsInput) {
  let credits = 0
  let covered = 0
  for (const asset of assets) {
    if (!analysisCoversKind(analysis, asset.kind)) continue
    covered += 1
    const minutes = (asset.durationSeconds ?? 0) / 60
    const base = asset.kind === 'image' || asset.kind === 'avatar' ? 0.2
      : asset.kind === 'video' ? 0.6 + minutes * 0.8
        : asset.kind === 'audio' ? 0.2 + minutes * 0.3
          : 0.1
    const depth = analysis.depth === 'detailed' ? 2 : 1
    const extras = (analysis.features.includes('transcript') && (asset.kind === 'video' || asset.kind === 'audio') ? minutes * 0.4 : 0)
      + (analysis.features.includes('people') ? 0.1 : 0)
    credits += base * depth + extras
  }
  return { credits: Math.round(credits * 10) / 10, covered }
}

export function relativeDays(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null
  return Math.round((now - Date.parse(iso)) / DAY)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

export function formatDuration(seconds: number | undefined) {
  if (seconds === undefined) return null
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** Guess the kind and tags of an uploaded file from its name (the mock "analysis"). */
export function inferUpload(fileName: string, mime: string): { kind: AssetKind; tags: string[] } {
  const lower = fileName.toLocaleLowerCase('tr')
  const kind: AssetKind = mime.startsWith('video/') ? 'video'
    : mime.startsWith('audio/') ? 'audio'
      : mime.startsWith('image/') ? 'image'
        : mime.startsWith('text/') || /\.(txt|md|docx?|pdf)$/.test(lower) ? 'text'
          : 'image'
  const dictionary: Array<[RegExp, string[]]> = [
    [/pizza|burger|risotto|salata|salad|çorba|soup|tatlı|dessert|yemek|food|makarna|pasta|tiramisu|steak|biftek/, ['yemek']],
    [/kahve|coffee|latte|çay|tea|limonata|içecek|drink/, ['içecek']],
    [/şef|chef|ekip|team|portre|portrait/, ['şef', 'portre']],
    [/salon|mekan|mekân|bar|interior|venue|masa/, ['mekân']],
    [/yorum|review|testimonial/, ['yorum']],
    [/müzik|music|jingle/, ['müzik']],
  ]
  const tags = dictionary.filter(([pattern]) => pattern.test(lower)).flatMap(([, value]) => value)
  const words = lower.replace(/\.[a-z0-9]+$/, '').split(/[^a-zçğıöşü0-9]+/).filter((word) => word.length > 2).slice(0, 3)
  return { kind, tags: Array.from(new Set([...tags, ...words])) }
}

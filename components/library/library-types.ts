// Library (formerly "Assets") — UI model. yt-2 has no backend: these shapes describe what the screens need and
// are filled from library-seed.ts and mutated in library-store.ts.

export const ASSET_KINDS = ['video', 'image', 'audio', 'avatar', 'motion', 'template', 'text'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export type AnalysisState = 'analyzed' | 'analyzing' | 'queued' | 'skipped' | 'failed'

export type AssetSource = 'upload' | 'generated' | 'youtube' | 'recording'

export type AssetFlag = 'duplicate' | 'low_quality' | 'needs_consent' | 'no_license'

export type AgentKey = 'spark' | 'flow' | 'assistant'

export type AssetCover =
  | { type: 'image'; src: string }
  | { type: 'glyph'; icon: string; hue: number }

export type AssetUsageEvent = {
  id: string
  at: string
  agent: AgentKey
  project: string
  collectionId: string | null
  outcome: 'used' | 'skipped_cooldown' | 'skipped_limit' | 'skipped_consent'
}

export type LibraryAsset = {
  id: string
  kind: AssetKind
  name: string
  cover: AssetCover
  durationSeconds?: number
  width?: number
  height?: number
  sizeBytes: number
  createdAt: string
  source: AssetSource
  generatedBy?: { tool: string; model: string; prompt: string }
  /** Collections the item belongs to (smart collections add it by rule, manual ones by hand). */
  collectionIds: string[]
  analysis: {
    state: AnalysisState
    summary?: string
    tags: string[]
    colors?: string[]
    quality?: number
    transcript?: string
    hasPeople?: boolean
    failure?: string
  }
  usage: { count: number; lastUsedAt?: string; events: AssetUsageEvent[] }
  /** The owner's notes on the item, one per line ("Menü tanıtımlarında açılış karesi olsun"); AI reads them when picking. */
  notes?: string[]
  /** Channel Memory (Bellek): not added, being added, or added so the assistant knows the item. */
  memory?: 'off' | 'adding' | 'added'
  aiExcluded?: boolean
  pinned?: boolean
  flags: AssetFlag[]
  expiresAt?: string | null
  /** Text outputs (scripts, captions) keep their body here. */
  text?: string
}

export type AnalysisScope = 'all' | 'images_only' | 'selected' | 'off'
export type AnalysisDepth = 'quick' | 'detailed'
export type AnalysisFeature = 'tags' | 'description' | 'transcript' | 'ocr' | 'colors' | 'quality' | 'people' | 'brand_fit'
export type RotationStrategy = 'least_used' | 'newest' | 'best_quality' | 'random'
export type ExhaustedBehavior = 'pause_item' | 'warn' | 'archive_item'
export type DuplicateBehavior = 'merge' | 'warn' | 'ignore'
export type CapReachedBehavior = 'queue' | 'quick' | 'stop'

export type IntakeRule = {
  id: string
  field: 'tag' | 'kind' | 'name' | 'source' | 'duration'
  operator: 'contains' | 'is' | 'is_not' | 'gt' | 'lt'
  value: string
}

export type CollectionSettings = {
  intake: {
    mode: 'manual' | 'suggest' | 'rules'
    acceptedKinds: AssetKind[]
    rules: IntakeRule[]
    matchAll: boolean
    includeGenerated: boolean
    approval: 'auto' | 'review'
  }
  analysis: {
    scope: AnalysisScope
    kinds: AssetKind[]
    depth: AnalysisDepth
    features: AnalysisFeature[]
    reanalyzeOnEdit: boolean
    monthlyCreditCap: number | null
    onCapReached: CapReachedBehavior
  }
  policy: {
    aiAccess: boolean
    agents: AgentKey[]
    maxUsesPerItem: number | null
    cooldownDays: number
    oncePerProject: boolean
    weeklyCap: number | null
    rotation: RotationStrategy
    whenExhausted: ExhaustedBehavior
    requireAnalysis: boolean
  }
  guardrails: {
    minResolution: 'any' | '720p' | '1080p' | '4k'
    minDurationSeconds: number | null
    maxDurationSeconds: number | null
    excludeLowQuality: boolean
    duplicates: DuplicateBehavior
    requireLicense: boolean
    requireConsentForPeople: boolean
    expiresAt: string | null
  }
}

export type CollectionStatus = 'active' | 'paused' | 'frozen' | 'archived'

export type LibraryCollection = {
  id: string
  name: string
  /** Shown to the AI as context when it picks from this collection. */
  description: string
  /** Smart mode: items are analysed, matching new items are added by the intake rules and AI uses the
   * collection under its usage policy. Off, it is a plain folder. Settings are kept while off. */
  smart: boolean
  icon: string
  hue: number
  status: CollectionStatus
  createdAt: string
  updatedAt: string
  settings: CollectionSettings
  aiUses30d: number
  lastUsedAt: string | null
}

/** An item the smart rules want to add to a collection whose intake asks for approval. */
export type CollectionSuggestion = {
  id: string
  assetId: string
  collectionId: string
  confidence: number
  reason: string
}

export type GenerationKind = 'image' | 'video' | 'audio' | 'text'

export type LibraryGeneration = {
  id: string
  kind: GenerationKind
  tool: string
  model: string
  prompt: string
  createdAt: string
  status: 'completed' | 'running' | 'failed'
  credits: number
  cover?: AssetCover
  text?: string
  durationSeconds?: number
  /** Set once the output has been saved to the library. */
  savedAssetId: string | null
  /** Unsaved outputs are removed after this date. */
  expiresAt: string
  /** Smart collection the AI would file this output into. */
  suggestedCollectionId?: string | null
}

export type LibraryPreferences = {
  autoSaveGenerations: boolean
  autoRouteToSmartCollections: boolean
  generationRetentionDays: number
}

export type AssetAvailability =
  | { state: 'available' }
  | { state: 'cooldown'; daysLeft: number }
  | { state: 'exhausted'; used: number; limit: number }
  | { state: 'hidden' }
  | { state: 'blocked_consent' }
  | { state: 'blocked_quality' }
  | { state: 'blocked_license' }
  | { state: 'blocked_duplicate' }
  | { state: 'pending_analysis' }
  | { state: 'expired' }

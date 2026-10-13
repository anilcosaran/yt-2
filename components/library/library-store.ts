'use client'

// In-memory state of the Library mock (yt-2 has no backend). Survives client navigation, resets on reload.
// Analysis and routing of uploads are simulated with timers so the UI flows can be seen end to end.

import { create } from 'zustand'

import { analysisCoversKind, inferUpload, matchIntake } from './library-logic'
import {
  defaultCollectionSettings,
  SEED_ASSETS_FULL,
  SEED_COLLECTIONS,
  SEED_GENERATIONS,
  SEED_PREFERENCES,
  SEED_SUGGESTIONS,
} from './library-seed'
import type {
  AssetCover,
  CollectionSettings,
  CollectionStatus,
  CollectionSuggestion,
  LibraryAsset,
  LibraryCollection,
  LibraryGeneration,
  LibraryPreferences,
} from './library-types'

export type UploadJob = {
  id: string
  name: string
  sizeBytes: number
  progress: number
  assetId: string | null
}

export type RoutingResult = { added: Array<{ collectionId: string; count: number }>; suggested: number }

type NewCollectionInput = {
  name: string
  description: string
  smart: boolean
}

export type SmartMatchResult = { added: number; suggested: number }

type LibraryState = {
  assets: LibraryAsset[]
  collections: LibraryCollection[]
  suggestions: CollectionSuggestion[]
  generations: LibraryGeneration[]
  preferences: LibraryPreferences
  uploads: UploadJob[]

  createCollection: (input: NewCollectionInput) => { id: string; matches: SmartMatchResult }
  setSmart: (id: string, smart: boolean) => SmartMatchResult
  updateCollection: (id: string, patch: Partial<Pick<LibraryCollection, 'name' | 'description' | 'icon' | 'hue'>>) => void
  updateSettings: <K extends keyof CollectionSettings>(id: string, section: K, patch: Partial<CollectionSettings[K]>) => void
  setCollectionStatus: (id: string, status: CollectionStatus) => void
  duplicateCollection: (id: string) => string | null
  deleteCollection: (id: string, options: { deleteExclusiveItems: boolean }) => void

  addToCollection: (assetIds: string[], collectionId: string) => void
  removeFromCollection: (assetIds: string[], collectionId: string) => void
  renameAsset: (id: string, name: string) => void
  setTags: (id: string, tags: string[]) => void
  setNotes: (id: string, notes: string[]) => void
  setMemory: (id: string, inMemory: boolean) => void
  setAiExcluded: (ids: string[], excluded: boolean) => void
  setPinned: (id: string, pinned: boolean) => void
  setAssetExpiry: (id: string, expiresAt: string | null) => void
  resetUsage: (id: string) => void
  grantConsent: (ids: string[]) => void
  resolveDuplicate: (id: string, action: 'merge' | 'keep') => void
  reanalyze: (ids: string[]) => void
  deleteAssets: (ids: string[]) => void

  acceptSuggestion: (id: string) => void
  rejectSuggestion: (id: string) => void
  acceptAllSuggestions: (collectionId?: string) => void

  saveGeneration: (id: string, collectionId?: string | null) => string | null
  discardGeneration: (id: string) => void
  setPreferences: (patch: Partial<LibraryPreferences>) => void

  upload: (files: Array<{ name: string; type: string; size: number }>, destination: 'auto' | string, onRouted?: (result: RoutingResult) => void) => void
}

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`

function patchAsset(assets: LibraryAsset[], ids: string[], update: (asset: LibraryAsset) => LibraryAsset) {
  const set = new Set(ids)
  return assets.map((asset) => (set.has(asset.id) ? update(asset) : asset))
}

/** Mock analysis result for items without tags: the meaningful words of the name plus the kind. */
function fallbackTags(asset: LibraryAsset) {
  const words = asset.name
    .toLocaleLowerCase('tr')
    .split(/[^a-zçğıöşü0-9]+/)
    .filter((word) => word.length > 3)
    .slice(0, 3)
  return Array.from(new Set(words)).length ? Array.from(new Set(words)) : [asset.kind]
}

const NEW_COLLECTION_HUES = [24, 200, 280, 150, 330, 262, 48, 8, 170, 220]

/** Icon for a new collection, guessed from its name (changeable in the collection settings). */
function guessIcon(name: string) {
  const text = name.toLocaleLowerCase('tr')
  const table: Array<[RegExp, string]> = [
    [/(menü|yemek|tabak|food|dish|tatlı|pizza)/, 'utensils'],
    [/(kahve|coffee|içecek|drink)/, 'coffee'],
    [/(mekân|mekan|salon|venue|atmosfer)/, 'store'],
    [/(şef|ekip|team|kişi|people|personel)/, 'chef-hat'],
    [/(yorum|review|müşteri)/, 'quote'],
    [/(müzik|ses|music|audio|jingle)/, 'music'],
    [/(kampanya|sezon|campaign|ekim|kasım)/, 'calendar'],
    [/(video|b-roll|broll|klip)/, 'film'],
  ]
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? 'sparkles'
}

const ANALYSIS_SUMMARIES: Record<string, string> = {
  image: 'Otomatik analiz: ana nesne, ışık ve kompozisyon çıkarıldı.',
  video: 'Otomatik analiz: sahneler, hareket ve konuşma bölümleri çıkarıldı.',
  audio: 'Otomatik analiz: konuşma/müzik ayrımı ve transkript çıkarıldı.',
}

export const useLibraryStore = create<LibraryState>()((set, get) => {
  const finishAnalysis = (ids: string[]) => {
    set((state) => ({
      assets: patchAsset(state.assets, ids, (asset) => ({
        ...asset,
        analysis: {
          ...asset.analysis,
          state: 'analyzed',
          failure: undefined,
          summary: asset.analysis.summary ?? ANALYSIS_SUMMARIES[asset.kind] ?? 'Otomatik analiz tamamlandı.',
          quality: asset.analysis.quality ?? 86,
          tags: asset.analysis.tags.length ? asset.analysis.tags : fallbackTags(asset),
        },
      })),
    }))
  }

  const runAnalysis = (ids: string[], onDone?: () => void) => {
    set((state) => ({
      assets: patchAsset(state.assets, ids, (asset) => ({ ...asset, analysis: { ...asset.analysis, state: 'queued', failure: undefined } })),
    }))
    setTimeout(() => {
      set((state) => ({
        assets: patchAsset(state.assets, ids, (asset) => ({ ...asset, analysis: { ...asset.analysis, state: 'analyzing' } })),
      }))
    }, 900)
    setTimeout(() => {
      finishAnalysis(ids)
      onDone?.()
    }, 3200)
  }

  /** Files new items into smart collections whose intake matches, or proposes them for review. */
  const routeAssets = (ids: string[]): RoutingResult => {
    const state = get()
    const added = new Map<string, number>()
    const suggestions: CollectionSuggestion[] = []
    const assetIds = new Set(ids)
    const candidates = state.assets.filter((asset) => assetIds.has(asset.id))
    for (const collection of state.collections) {
      if (!collection.smart || collection.status === 'frozen' || collection.status === 'archived') continue
      const keywords = `${collection.name} ${collection.description}`.split(/\s+/)
      const matches = matchIntake(candidates, collection.settings, keywords)
        .filter((asset) => !asset.collectionIds.includes(collection.id))
      if (!matches.length) continue
      if (collection.settings.intake.approval === 'review') {
        for (const asset of matches) {
          suggestions.push({ id: nextId('s'), assetId: asset.id, collectionId: collection.id, confidence: 0.82, reason: 'Yeni yükleme · kurallarla eşleşti' })
        }
      } else {
        added.set(collection.id, matches.length)
      }
    }
    set((current) => ({
      assets: current.assets.map((asset) => {
        if (!assetIds.has(asset.id)) return asset
        const extra = [...added.keys()].filter((collectionId) => {
          const collection = current.collections.find((item) => item.id === collectionId)!
          const keywords = `${collection.name} ${collection.description}`.split(/\s+/)
          return matchIntake([asset], collection.settings, keywords).length > 0
        })
        return extra.length ? { ...asset, collectionIds: Array.from(new Set([...asset.collectionIds, ...extra])) } : asset
      }),
      suggestions: [...current.suggestions, ...suggestions],
    }))
    return { added: [...added.entries()].map(([collectionId, count]) => ({ collectionId, count })), suggested: suggestions.length }
  }

  /** Smart mode turned on: bring in (or propose) the library items its intake matches, and analyse them. */
  const matchLibrary = (collectionId: string): SmartMatchResult => {
    const state = get()
    const collection = state.collections.find((item) => item.id === collectionId)
    if (!collection || collection.settings.intake.mode === 'manual') return { added: 0, suggested: 0 }
    const pending = new Set(state.suggestions.filter((item) => item.collectionId === collectionId).map((item) => item.assetId))
    const keywords = `${collection.name} ${collection.description}`.split(/\s+/)
    const matches = matchIntake(state.assets, collection.settings, keywords)
      .filter((asset) => !asset.collectionIds.includes(collectionId) && !pending.has(asset.id))
    if (!matches.length) return { added: 0, suggested: 0 }
    if (collection.settings.intake.approval === 'review') {
      set((current) => ({
        suggestions: [
          ...current.suggestions,
          ...matches.map((asset) => ({ id: nextId('s'), assetId: asset.id, collectionId, confidence: 0.8, reason: 'Ad ve açıklamayla eşleşti' })),
        ],
      }))
      return { added: 0, suggested: matches.length }
    }
    const ids = matches.map((asset) => asset.id)
    set((current) => ({ assets: patchAsset(current.assets, ids, (asset) => ({ ...asset, collectionIds: [...asset.collectionIds, collectionId] })) }))
    const toAnalyze = matches
      .filter((asset) => asset.analysis.state !== 'analyzed' && analysisCoversKind(collection.settings.analysis, asset.kind))
      .map((asset) => asset.id)
    if (toAnalyze.length) runAnalysis(toAnalyze)
    return { added: ids.length, suggested: 0 }
  }

  return {
    assets: SEED_ASSETS_FULL,
    collections: SEED_COLLECTIONS,
    suggestions: SEED_SUGGESTIONS,
    generations: SEED_GENERATIONS,
    preferences: SEED_PREFERENCES,
    uploads: [],

    createCollection: (input) => {
      const id = nextId('col')
      const now = new Date().toISOString()
      const name = input.name.trim() || 'Adsız koleksiyon'
      const collection: LibraryCollection = {
        id,
        name,
        description: input.description.trim(),
        smart: input.smart,
        icon: guessIcon(name),
        hue: NEW_COLLECTION_HUES[get().collections.length % NEW_COLLECTION_HUES.length],
        status: 'active',
        createdAt: now,
        updatedAt: now,
        settings: defaultCollectionSettings(),
        aiUses30d: 0,
        lastUsedAt: null,
      }
      set((state) => ({ collections: [...state.collections, collection] }))
      return { id, matches: input.smart ? matchLibrary(id) : { added: 0, suggested: 0 } }
    },

    setSmart: (id, smart) => {
      set((state) => ({
        collections: state.collections.map((collection) => {
          if (collection.id !== id) return collection
          if (!smart) return { ...collection, smart: false, updatedAt: new Date().toISOString() }
          const { settings } = collection
          return {
            ...collection,
            smart: true,
            updatedAt: new Date().toISOString(),
            settings: {
              ...settings,
              // First time smart: matches go to the review queue instead of being added unasked.
              intake: settings.intake.mode === 'manual' ? { ...settings.intake, mode: 'suggest', approval: 'review' } : settings.intake,
              analysis: settings.analysis.scope === 'off' ? { ...settings.analysis, scope: 'all' } : settings.analysis,
              policy: { ...settings.policy, aiAccess: true, agents: settings.policy.agents.length ? settings.policy.agents : ['spark', 'flow', 'assistant'] },
            },
          }
        }),
      }))
      if (!smart) return { added: 0, suggested: 0 }
      const collection = get().collections.find((item) => item.id === id)!
      const toAnalyze = get().assets
        .filter((asset) => asset.collectionIds.includes(id) && asset.analysis.state !== 'analyzed' && analysisCoversKind(collection.settings.analysis, asset.kind))
        .map((asset) => asset.id)
      if (toAnalyze.length) runAnalysis(toAnalyze)
      return matchLibrary(id)
    },

    updateCollection: (id, patch) => set((state) => ({
      collections: state.collections.map((collection) => (collection.id === id ? { ...collection, ...patch, updatedAt: new Date().toISOString() } : collection)),
    })),

    updateSettings: (id, section, patch) => set((state) => ({
      collections: state.collections.map((collection) => (collection.id === id
        ? {
          ...collection,
          updatedAt: new Date().toISOString(),
          settings: { ...collection.settings, [section]: { ...collection.settings[section], ...patch } },
        }
        : collection)),
    })),

    setCollectionStatus: (id, status) => set((state) => ({
      collections: state.collections.map((collection) => (collection.id === id ? { ...collection, status } : collection)),
    })),

    duplicateCollection: (id) => {
      const source = get().collections.find((collection) => collection.id === id)
      if (!source) return null
      const copyId = nextId('col')
      set((state) => ({
        collections: [...state.collections, { ...source, id: copyId, name: `${source.name} (kopya)`, aiUses30d: 0, lastUsedAt: null, createdAt: new Date().toISOString() }],
        assets: state.assets.map((asset) => (asset.collectionIds.includes(id) ? { ...asset, collectionIds: [...asset.collectionIds, copyId] } : asset)),
      }))
      return copyId
    },

    deleteCollection: (id, { deleteExclusiveItems }) => set((state) => ({
      collections: state.collections.filter((collection) => collection.id !== id),
      suggestions: state.suggestions.filter((suggestion) => suggestion.collectionId !== id),
      assets: state.assets
        .filter((asset) => !(deleteExclusiveItems && asset.collectionIds.length === 1 && asset.collectionIds[0] === id))
        .map((asset) => ({ ...asset, collectionIds: asset.collectionIds.filter((collectionId) => collectionId !== id) })),
    })),

    addToCollection: (assetIds, collectionId) => set((state) => ({
      assets: patchAsset(state.assets, assetIds, (asset) => (
        asset.collectionIds.includes(collectionId) ? asset : { ...asset, collectionIds: [...asset.collectionIds, collectionId] }
      )),
      suggestions: state.suggestions.filter((suggestion) => !(suggestion.collectionId === collectionId && assetIds.includes(suggestion.assetId))),
    })),

    removeFromCollection: (assetIds, collectionId) => set((state) => ({
      assets: patchAsset(state.assets, assetIds, (asset) => ({ ...asset, collectionIds: asset.collectionIds.filter((id) => id !== collectionId) })),
    })),

    renameAsset: (id, name) => set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, name })) })),
    setTags: (id, tags) => set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, analysis: { ...asset.analysis, tags } })) })),
    setNotes: (id, notes) => set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, notes: notes.map((note) => note.trim()).filter(Boolean) })) })),
    setMemory: (id, inMemory) => {
      set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, memory: inMemory ? 'adding' : 'off' })) }))
      // Simulated indexing: the item is in Memory a moment later (unless it was taken out meanwhile).
      if (inMemory) {
        setTimeout(() => {
          set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => (asset.memory === 'adding' ? { ...asset, memory: 'added' } : asset)) }))
        }, 1800)
      }
    },
    setAiExcluded: (ids, excluded) => set((state) => ({ assets: patchAsset(state.assets, ids, (asset) => ({ ...asset, aiExcluded: excluded })) })),
    setPinned: (id, pinned) => set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, pinned })) })),
    setAssetExpiry: (id, expiresAt) => set((state) => ({ assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, expiresAt })) })),
    resetUsage: (id) => set((state) => ({
      assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, usage: { ...asset.usage, count: 0, lastUsedAt: undefined } })),
    })),
    grantConsent: (ids) => set((state) => ({
      assets: patchAsset(state.assets, ids, (asset) => ({ ...asset, flags: asset.flags.filter((flag) => flag !== 'needs_consent') })),
    })),
    resolveDuplicate: (id, action) => set((state) => (action === 'merge'
      ? { assets: state.assets.filter((asset) => asset.id !== id) }
      : { assets: patchAsset(state.assets, [id], (asset) => ({ ...asset, flags: asset.flags.filter((flag) => flag !== 'duplicate') })) })),
    reanalyze: (ids) => runAnalysis(ids),
    deleteAssets: (ids) => set((state) => ({
      assets: state.assets.filter((asset) => !ids.includes(asset.id)),
      suggestions: state.suggestions.filter((suggestion) => !ids.includes(suggestion.assetId)),
    })),

    acceptSuggestion: (id) => {
      const suggestion = get().suggestions.find((item) => item.id === id)
      if (!suggestion) return
      get().addToCollection([suggestion.assetId], suggestion.collectionId)
      set((state) => ({ suggestions: state.suggestions.filter((item) => item.id !== id) }))
    },
    rejectSuggestion: (id) => set((state) => ({ suggestions: state.suggestions.filter((item) => item.id !== id) })),
    acceptAllSuggestions: (collectionId) => {
      for (const suggestion of get().suggestions) {
        if (!collectionId || suggestion.collectionId === collectionId) get().acceptSuggestion(suggestion.id)
      }
    },

    saveGeneration: (id, collectionId) => {
      const generation = get().generations.find((item) => item.id === id)
      if (!generation || generation.status !== 'completed') return null
      if (generation.savedAssetId) {
        if (collectionId) get().addToCollection([generation.savedAssetId], collectionId)
        return generation.savedAssetId
      }
      const assetId = nextId('a')
      const cover: AssetCover = generation.cover ?? { type: 'glyph', icon: generation.kind === 'text' ? 'file-text' : 'sparkles', hue: 260 }
      const asset: LibraryAsset = {
        id: assetId,
        kind: generation.kind,
        name: generation.prompt.length > 48 ? `${generation.prompt.slice(0, 46)}…` : generation.prompt,
        cover,
        durationSeconds: generation.durationSeconds,
        sizeBytes: generation.kind === 'text' ? 2_000 : generation.kind === 'video' ? 22_000_000 : 1_800_000,
        createdAt: generation.createdAt,
        source: 'generated',
        generatedBy: { tool: generation.tool, model: generation.model, prompt: generation.prompt },
        collectionIds: collectionId ? [collectionId] : [],
        analysis: { state: 'queued', tags: [] },
        usage: { count: 0, events: [] },
        flags: [],
        text: generation.text,
      }
      set((state) => ({
        assets: [asset, ...state.assets],
        generations: state.generations.map((item) => (item.id === id ? { ...item, savedAssetId: assetId } : item)),
      }))
      runAnalysis([assetId])
      return assetId
    },

    discardGeneration: (id) => set((state) => ({ generations: state.generations.filter((item) => item.id !== id) })),

    setPreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),

    upload: (files, destination, onRouted) => {
      const created: LibraryAsset[] = files.map((file) => {
        const { kind, tags } = inferUpload(file.name, file.type)
        return {
          id: nextId('a'),
          kind,
          name: file.name.replace(/\.[^.]+$/, ''),
          cover: { type: 'glyph', icon: kind === 'video' ? 'film' : kind === 'audio' ? 'audio-lines' : kind === 'text' ? 'file-text' : 'image', hue: 210 },
          sizeBytes: file.size,
          durationSeconds: kind === 'video' || kind === 'audio' ? 20 : undefined,
          createdAt: new Date().toISOString(),
          source: 'upload',
          collectionIds: destination === 'auto' ? [] : [destination],
          analysis: { state: 'queued', tags },
          usage: { count: 0, events: [] },
          flags: [],
        }
      })
      const jobs: UploadJob[] = created.map((asset) => ({ id: nextId('u'), name: asset.name, sizeBytes: asset.sizeBytes, progress: 0, assetId: asset.id }))
      set((state) => ({ uploads: [...state.uploads, ...jobs] }))
      const ids = created.map((asset) => asset.id)
      let progress = 0
      const timer = setInterval(() => {
        progress = Math.min(100, progress + 25)
        set((state) => ({ uploads: state.uploads.map((job) => (ids.includes(job.assetId ?? '') ? { ...job, progress } : job)) }))
        if (progress >= 100) {
          clearInterval(timer)
          set((state) => ({
            assets: [...created, ...state.assets],
            uploads: state.uploads.filter((job) => !ids.includes(job.assetId ?? '')),
          }))
          runAnalysis(ids, () => {
            if (destination === 'auto' && get().preferences.autoRouteToSmartCollections) onRouted?.(routeAssets(ids))
            else onRouted?.({ added: destination === 'auto' ? [] : [{ collectionId: destination, count: ids.length }], suggested: 0 })
          })
        }
      }, 350)
    },
  }
})

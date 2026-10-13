// Demo content of the Library for a café & restaurant channel: smart collections for the menu, the venue, the
// team and customer reviews, plus avatars, motions, templates, audio and AI outputs. Mock data only.

import type {
  AnalysisState,
  AssetCover,
  AssetFlag,
  AssetKind,
  AssetUsageEvent,
  CollectionSettings,
  CollectionSuggestion,
  LibraryAsset,
  LibraryCollection,
  LibraryGeneration,
  LibraryPreferences,
} from './library-types'

const DAY = 24 * 3600 * 1000
const now = Date.now()
const daysAgo = (days: number) => new Date(now - days * DAY).toISOString()
const daysAhead = (days: number) => new Date(now + days * DAY).toISOString()
const hoursAgo = (hours: number) => new Date(now - hours * 3600 * 1000).toISOString()

const img = (src: string): AssetCover => ({ type: 'image', src })
const glyph = (icon: string, hue: number): AssetCover => ({ type: 'glyph', icon, hue })

export function defaultCollectionSettings(): CollectionSettings {
  return {
    intake: {
      mode: 'suggest',
      acceptedKinds: ['image', 'video'],
      rules: [],
      matchAll: true,
      includeGenerated: true,
      approval: 'review',
    },
    analysis: {
      scope: 'all',
      kinds: ['image', 'video'],
      depth: 'quick',
      features: ['tags', 'description', 'quality'],
      reanalyzeOnEdit: true,
      monthlyCreditCap: 200,
      onCapReached: 'queue',
    },
    policy: {
      aiAccess: true,
      agents: ['spark', 'flow', 'assistant'],
      maxUsesPerItem: null,
      cooldownDays: 0,
      oncePerProject: true,
      weeklyCap: null,
      rotation: 'least_used',
      whenExhausted: 'pause_item',
      requireAnalysis: true,
    },
    guardrails: {
      minResolution: 'any',
      minDurationSeconds: null,
      maxDurationSeconds: null,
      excludeLowQuality: false,
      duplicates: 'warn',
      requireLicense: false,
      requireConsentForPeople: true,
      expiresAt: null,
    },
  }
}

function settings(patch: {
  intake?: Partial<CollectionSettings['intake']>
  analysis?: Partial<CollectionSettings['analysis']>
  policy?: Partial<CollectionSettings['policy']>
  guardrails?: Partial<CollectionSettings['guardrails']>
}): CollectionSettings {
  const base = defaultCollectionSettings()
  return {
    intake: { ...base.intake, ...patch.intake },
    analysis: { ...base.analysis, ...patch.analysis },
    policy: { ...base.policy, ...patch.policy },
    guardrails: { ...base.guardrails, ...patch.guardrails },
  }
}

export const SEED_COLLECTIONS: LibraryCollection[] = [
  {
    id: 'col-menu',
    name: 'Menü — Yemekler',
    description: 'Restoranın menüsündeki yemeklerin görselleri ve kısa videoları. Tanıtım, reels ve menü videolarında yemek göstermek için kullanılır.',
    smart: true,
    icon: 'utensils',
    hue: 24,
    status: 'active',
    createdAt: daysAgo(64),
    updatedAt: daysAgo(1),
    settings: settings({
      intake: {
        mode: 'rules',
        acceptedKinds: ['image', 'video'],
        rules: [
          { id: 'r1', field: 'tag', operator: 'contains', value: 'yemek' },
          { id: 'r2', field: 'kind', operator: 'is_not', value: 'audio' },
        ],
        approval: 'review',
      },
      analysis: { scope: 'all', depth: 'detailed', features: ['tags', 'description', 'colors', 'quality', 'ocr'] },
      policy: { maxUsesPerItem: 3, cooldownDays: 14, weeklyCap: 12, rotation: 'least_used' },
      guardrails: { minResolution: '1080p', excludeLowQuality: true, duplicates: 'merge' },
    }),
    aiUses30d: 31,
    lastUsedAt: daysAgo(1),
  },
  {
    id: 'col-venue',
    name: 'Mekân & Atmosfer',
    description: 'Salon, bar ve masa çekimleri. Videolarda geçiş, arka plan ve b-roll olarak kullanılır.',
    smart: true,
    icon: 'store',
    hue: 200,
    status: 'active',
    createdAt: daysAgo(58),
    updatedAt: daysAgo(4),
    settings: settings({
      intake: { mode: 'suggest', acceptedKinds: ['image', 'video'], approval: 'auto' },
      analysis: { scope: 'images_only', kinds: ['image'], depth: 'quick' },
      policy: { maxUsesPerItem: null, cooldownDays: 3, rotation: 'random' },
    }),
    aiUses30d: 18,
    lastUsedAt: daysAgo(2),
  },
  {
    id: 'col-team',
    name: 'Şef & Ekip',
    description: 'Şef ve çalışanların portreleri ve anlatım videoları. Kişi içerdiği için yalnızca izni olanlar kullanılır.',
    smart: true,
    icon: 'chef-hat',
    hue: 280,
    status: 'active',
    createdAt: daysAgo(40),
    updatedAt: daysAgo(3),
    settings: settings({
      intake: { mode: 'suggest', acceptedKinds: ['image', 'video', 'avatar'], approval: 'review' },
      analysis: { scope: 'all', depth: 'detailed', features: ['tags', 'description', 'people', 'transcript', 'quality'] },
      policy: { maxUsesPerItem: 5, cooldownDays: 7, rotation: 'best_quality' },
      guardrails: { requireConsentForPeople: true, requireLicense: true },
    }),
    aiUses30d: 9,
    lastUsedAt: daysAgo(6),
  },
  {
    id: 'col-reviews',
    name: 'Müşteri Yorumları',
    description: 'Müşteri video yorumları, seslendirilmiş yorumlar ve derlenmiş yorum metinleri. Güven ve sosyal kanıt anlarında kullanılır.',
    smart: true,
    icon: 'quote',
    hue: 150,
    status: 'paused',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(8),
    settings: settings({
      intake: { mode: 'rules', acceptedKinds: ['video', 'audio', 'text'], rules: [{ id: 'r1', field: 'tag', operator: 'contains', value: 'yorum' }], approval: 'auto' },
      analysis: { scope: 'selected', kinds: ['video', 'audio'], depth: 'detailed', features: ['transcript', 'description', 'tags'] },
      policy: { maxUsesPerItem: 2, cooldownDays: 30, oncePerProject: true, rotation: 'newest', whenExhausted: 'archive_item' },
    }),
    aiUses30d: 4,
    lastUsedAt: daysAgo(12),
  },
  {
    id: 'col-october',
    name: 'Ekim Kampanyası',
    description: 'Ekim ayı sonbahar menüsü kampanyası için seçilmiş içerikler.',
    smart: false,
    icon: 'calendar',
    hue: 330,
    status: 'active',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
    settings: settings({
      intake: { mode: 'manual', acceptedKinds: ['image', 'video', 'motion', 'template', 'text'], approval: 'auto' },
      analysis: { scope: 'off', kinds: [] },
      policy: { aiAccess: true, agents: ['spark'], cooldownDays: 0 },
      guardrails: { expiresAt: daysAhead(22) },
    }),
    aiUses30d: 7,
    lastUsedAt: daysAgo(1),
  },
  {
    id: 'col-audio',
    name: 'Marka Sesleri & Müzik',
    description: 'Jingle, arka plan müzikleri ve marka seslendirmeleri.',
    smart: false,
    icon: 'music',
    hue: 262,
    status: 'active',
    createdAt: daysAgo(50),
    updatedAt: daysAgo(9),
    settings: settings({
      intake: { mode: 'manual', acceptedKinds: ['audio'], approval: 'auto' },
      analysis: { scope: 'selected', kinds: ['audio'], features: ['transcript', 'tags'] },
      policy: { cooldownDays: 0, rotation: 'least_used' },
    }),
    aiUses30d: 11,
    lastUsedAt: daysAgo(3),
  },
]

type SeedAsset = {
  id: string
  kind: AssetKind
  name: string
  cover: AssetCover
  collections?: string[]
  duration?: number
  size?: number
  age: number
  source?: LibraryAsset['source']
  state?: AnalysisState
  tags?: string[]
  summary?: string
  colors?: string[]
  quality?: number
  people?: boolean
  transcript?: string
  failure?: string
  uses?: number
  lastUsed?: number
  flags?: AssetFlag[]
  aiExcluded?: boolean
  pinned?: boolean
  text?: string
  expiresIn?: number
  generatedBy?: LibraryAsset['generatedBy']
  notes?: string[]
  memory?: LibraryAsset['memory']
}

const PROJECTS = ['Ekim menüsü reels', 'Haftalık Shorts', 'Sonbahar kampanyası', 'Hafta sonu brunch', 'Şefin önerisi']

function usageEvents(asset: SeedAsset): AssetUsageEvent[] {
  const count = asset.uses ?? 0
  return Array.from({ length: count }, (_, index) => ({
    id: `${asset.id}-u${index}`,
    at: daysAgo((asset.lastUsed ?? 1) + index * 9),
    agent: (['spark', 'flow', 'assistant'] as const)[index % 3],
    project: PROJECTS[(index + asset.id.length) % PROJECTS.length],
    collectionId: asset.collections?.[0] ?? null,
    outcome: 'used' as const,
  }))
}

function toAsset(seed: SeedAsset): LibraryAsset {
  const isTimed = seed.kind === 'video' || seed.kind === 'audio' || seed.kind === 'motion'
  return {
    id: seed.id,
    kind: seed.kind,
    name: seed.name,
    cover: seed.cover,
    durationSeconds: isTimed ? seed.duration ?? 15 : undefined,
    width: seed.kind === 'audio' || seed.kind === 'text' ? undefined : 1920,
    height: seed.kind === 'audio' || seed.kind === 'text' ? undefined : 1080,
    sizeBytes: seed.size ?? (seed.kind === 'video' ? 48_000_000 : seed.kind === 'audio' ? 3_200_000 : seed.kind === 'text' ? 4_000 : 2_400_000),
    createdAt: daysAgo(seed.age),
    source: seed.source ?? 'upload',
    generatedBy: seed.generatedBy,
    collectionIds: seed.collections ?? [],
    analysis: {
      state: seed.state ?? 'analyzed',
      summary: seed.summary,
      tags: seed.tags ?? [],
      colors: seed.colors,
      quality: seed.quality,
      transcript: seed.transcript,
      hasPeople: seed.people,
      failure: seed.failure,
    },
    usage: {
      count: seed.uses ?? 0,
      lastUsedAt: seed.uses ? daysAgo(seed.lastUsed ?? 1) : undefined,
      events: usageEvents(seed),
    },
    notes: seed.notes ?? [],
    memory: seed.memory ?? 'off',
    aiExcluded: seed.aiExcluded,
    pinned: seed.pinned,
    flags: seed.flags ?? [],
    expiresAt: seed.expiresIn !== undefined ? daysAhead(seed.expiresIn) : null,
    text: seed.text,
  }
}

const WARM = ['#F59E0B', '#B45309', '#FDE68A', '#7C2D12']
const FRESH = ['#22C55E', '#FDE047', '#F8FAFC', '#166534']

const SEED_ASSETS: SeedAsset[] = [
  // Menü — images
  { id: 'a-pizza', kind: 'image', name: 'Margherita pizza — üstten', cover: glyph('pizza', 14), collections: ['col-menu', 'col-october'], age: 40, tags: ['yemek', 'pizza', 'üstten çekim', 'sıcak ışık'], summary: 'Taş fırından yeni çıkmış margherita pizza, ahşap servis tahtası üzerinde, üstten çekim.', colors: WARM, quality: 92, uses: 3, lastUsed: 4, pinned: true, notes: ['Menü tanıtım videolarında açılış karesi olarak kullan.', 'Pizza reels’lerinde kapak olabilir.'], memory: 'added' },
  { id: 'a-risotto', kind: 'image', name: 'Mantarlı risotto', cover: glyph('soup', 36), collections: ['col-menu'], age: 38, tags: ['yemek', 'risotto', 'yakın çekim'], summary: 'Derin tabakta kremalı mantarlı risotto, parmesan rendesi ve taze kekik.', colors: ['#D6C7A1', '#6B4F2A', '#F5F0E6'], quality: 88, uses: 1, lastUsed: 20 },
  { id: 'a-salad', kind: 'image', name: 'Akdeniz salatası', cover: glyph('salad', 110), collections: ['col-menu'], age: 35, tags: ['yemek', 'salata', 'vegan', 'gün ışığı'], summary: 'Beyaz kasede renkli Akdeniz salatası, zeytin ve beyaz peynirle.', colors: FRESH, quality: 90, uses: 2, lastUsed: 5 },
  { id: 'a-salmon', kind: 'image', name: 'Izgara somon', cover: glyph('fish', 196), collections: ['col-menu'], age: 33, tags: ['yemek', 'deniz ürünü', 'ana yemek'], summary: 'Kuşkonmaz yatağında ızgara somon, limon dilimiyle.', quality: 85, uses: 0 },
  { id: 'a-burger', kind: 'image', name: 'Dana burger — yan açı', cover: glyph('beef', 8), collections: ['col-menu', 'col-october'], age: 30, tags: ['yemek', 'burger', 'yan açı'], summary: 'Brioche ekmekte çift katlı dana burger, karamelize soğan.', colors: WARM, quality: 94, uses: 3, lastUsed: 2 },
  { id: 'a-tiramisu', kind: 'image', name: 'Tiramisu', cover: glyph('cake-slice', 30), collections: ['col-menu'], age: 28, tags: ['yemek', 'tatlı', 'kakao'], summary: 'Kakao serpilmiş dilim tiramisu, minimal stüdyo arka planı.', quality: 91, uses: 1, lastUsed: 16 },
  { id: 'a-latte', kind: 'image', name: 'Latte art', cover: glyph('coffee', 28), collections: ['col-menu'], age: 25, tags: ['içecek', 'kahve', 'latte art'], summary: 'Seramik fincanda yaprak desenli latte art.', quality: 87, uses: 2, lastUsed: 9 },
  { id: 'a-croissant', kind: 'image', name: 'Tereyağlı kruvasan', cover: glyph('croissant', 38), collections: ['col-menu'], age: 22, tags: ['yemek', 'kahvaltı', 'unlu mamul'], quality: 64, flags: ['low_quality'], summary: 'Kruvasan, düşük ışıkta telefonla çekilmiş.' },
  { id: 'a-soup', kind: 'image', name: 'Mercimek çorbası', cover: glyph('soup', 18), collections: ['col-menu'], age: 20, tags: ['yemek', 'çorba', 'geleneksel'], quality: 89, uses: 0 },
  { id: 'a-icecream', kind: 'image', name: 'Ev yapımı dondurma', cover: glyph('ice-cream-cone', 340), collections: ['col-menu'], age: 6, state: 'analyzing', tags: [] },
  { id: 'a-breakfast', kind: 'image', name: 'Serpme kahvaltı tabağı', cover: glyph('egg-fried', 46), collections: ['col-menu'], age: 2, state: 'queued', tags: [] },
  { id: 'a-pizza-dup', kind: 'image', name: 'Margherita pizza — üstten (kopya)', cover: glyph('pizza', 14), collections: ['col-menu'], age: 3, tags: ['yemek', 'pizza'], flags: ['duplicate'], quality: 91 },
  // Menü — videos
  { id: 'v-pizza-oven', kind: 'video', name: 'Pizza fırından çıkıyor', cover: glyph('flame', 18), collections: ['col-menu', 'col-october'], duration: 12, age: 27, tags: ['yemek', 'pizza', 'fırın', 'slow motion'], summary: 'Odun fırınından kürekle çıkarılan pizza, ağır çekim.', quality: 93, uses: 2, lastUsed: 3, notes: ['Reels girişlerinde ilk 2 saniye.', 'Yavaş çekim kısmını kullan.'], memory: 'added' },
  { id: 'v-latte-pour', kind: 'video', name: 'Latte art yapımı', cover: glyph('coffee', 24), collections: ['col-menu'], duration: 24, age: 19, tags: ['içecek', 'kahve', 'yakın çekim'], quality: 90, uses: 1, lastUsed: 11 },
  { id: 'v-burger-build', kind: 'video', name: 'Burger montajı — yakın çekim', cover: glyph('sandwich', 12), collections: ['col-menu'], duration: 18, age: 15, tags: ['yemek', 'burger', 'hazırlık'], quality: 86, uses: 3, lastUsed: 1 },
  { id: 'v-tiramisu', kind: 'video', name: 'Tiramisu katlama', cover: glyph('cake-slice', 30), collections: ['col-menu'], duration: 31, age: 10, state: 'failed', failure: 'Video çözümlenemedi: HEVC 10-bit desteklenmiyor.', tags: [] },
  // Mekân
  { id: 'a-books', kind: 'image', name: 'Kahve & kitap köşesi', cover: img('/flows/educational.png'), collections: ['col-venue'], age: 44, tags: ['mekân', 'sıcak ışık', 'kitap', 'kahve'], summary: 'Pencere önünde açık defter, kitaplar ve kahve fincanı.', colors: ['#C08552', '#3E2A1E', '#F2E6D8'], quality: 95, uses: 4, lastUsed: 2 },
  { id: 'a-window', kind: 'image', name: 'Pencere kenarı — sabah ışığı', cover: img('/flows/course.png'), collections: ['col-venue', 'col-team'], age: 42, tags: ['mekân', 'gün ışığı', 'misafir'], summary: 'Pencere kenarında dizüstü bilgisayarla çalışan misafir.', quality: 93, people: true, uses: 2, lastUsed: 8 },
  { id: 'a-bar', kind: 'image', name: 'Bar tezgâhı — akşam', cover: img('/flows/sales.png'), collections: ['col-venue'], age: 39, tags: ['mekân', 'akşam', 'loş ışık', 'bar'], summary: 'Loş ışıkta ahşap tezgâh, kristal karaf ve masa lambası.', quality: 92, uses: 1, lastUsed: 2 },
  { id: 'v-tour', kind: 'video', name: 'Mekân turu — 360°', cover: glyph('store', 200), collections: ['col-venue'], duration: 45, age: 21, state: 'skipped', tags: ['mekân'] },
  { id: 'v-dinner', kind: 'video', name: 'Akşam servisi b-roll', cover: glyph('wine', 350), collections: ['col-venue', 'col-october'], duration: 38, age: 14, state: 'skipped', tags: ['mekân', 'akşam'] },
  // Şef & ekip
  { id: 'v-chef-recipe', kind: 'video', name: 'Şef Ece — tarif anlatımı', cover: img('/flows/tips.png'), collections: ['col-team'], duration: 92, age: 24, tags: ['şef', 'tarif', 'konuşma', 'mutfak'], people: true, summary: 'Şef Ece günün tarifini kameraya anlatıyor.', transcript: 'Bugün size sonbahar menümüzün yıldızı balkabaklı risottoyu anlatacağım. İlk adım…', quality: 91, uses: 3, lastUsed: 6 },
  { id: 'v-chef-promo', kind: 'video', name: 'Ece — kampanya tanıtımı', cover: img('/flows/expert.png'), collections: ['col-team', 'col-october'], duration: 40, age: 11, tags: ['şef', 'kampanya', 'neon'], people: true, quality: 88, uses: 1, lastUsed: 6, notes: ['Ekim kampanyası duyurularında kullan; şefin konuştuğu kısım.'] },
  { id: 'v-tv', kind: 'video', name: 'Yerel TV röportajı', cover: img('/flows/news.png'), collections: ['col-team'], duration: 210, age: 52, tags: ['röportaj', 'basın'], people: true, flags: ['needs_consent', 'no_license'], quality: 84, summary: 'Yerel kanalın stüdyo haberi; sunucu üçüncü kişi.' },
  { id: 'a-portrait-front', kind: 'image', name: 'Ece — portre (ön)', cover: img('/tools/angle/front.jpg'), collections: ['col-team'], age: 18, tags: ['portre', 'şef', 'stüdyo'], people: true, quality: 97, uses: 2, lastUsed: 13 },
  { id: 'a-portrait-side', kind: 'image', name: 'Ece — portre (yan)', cover: img('/tools/angle/side.jpg'), collections: ['col-team'], age: 18, tags: ['portre', 'şef', 'profil'], people: true, quality: 96 },
  { id: 'a-staff', kind: 'image', name: 'Servis ekibi — grup fotoğrafı', cover: glyph('users', 280), collections: ['col-team'], age: 9, tags: ['ekip', 'grup'], people: true, flags: ['needs_consent'], quality: 82 },
  // Yorumlar
  { id: 'v-review-zeynep', kind: 'video', name: 'Müşteri yorumu — Zeynep', cover: glyph('message-circle', 150), collections: ['col-reviews'], duration: 34, age: 16, tags: ['yorum', 'memnuniyet', 'brunch'], people: true, transcript: 'Hafta sonu brunch’ı için geldik, menemen gerçekten harikaydı…', quality: 83, uses: 2, lastUsed: 12 },
  { id: 'v-review-kaan', kind: 'video', name: 'Müşteri yorumu — Kaan', cover: glyph('message-circle', 165), collections: ['col-reviews'], duration: 28, age: 13, tags: ['yorum', 'akşam yemeği'], people: true, transcript: 'Burger ve ev yapımı limonata, kesinlikle tekrar geleceğim.', quality: 80, uses: 1, lastUsed: 12 },
  { id: 'au-review-voice', kind: 'audio', name: 'Google yorumu seslendirmesi', cover: glyph('audio-lines', 140), collections: ['col-reviews'], duration: 22, age: 8, tags: ['yorum', 'seslendirme'], transcript: '“Şehrin en iyi kahvesi ve çok güler yüzlü bir ekip.” — Google, 5 yıldız', source: 'generated' },
  { id: 't-reviews', kind: 'text', name: 'En iyi 5 yorum (derleme)', cover: glyph('file-text', 150), collections: ['col-reviews'], age: 7, tags: ['yorum', 'metin'], source: 'generated', text: '1. “Şehrin en iyi kahvesi.”\n2. “Brunch tabağı efsane.”\n3. “Ekip çok ilgili.”\n4. “Tiramisu hafif ve dengeli.”\n5. “Akşam ışığı ve müzik çok güzel.”', generatedBy: { tool: 'Asistan', model: 'LLM', prompt: 'Son 30 günün yorumlarından en iyi 5 tanesini derle' } },
  // Avatarlar
  { id: 'av-ece', kind: 'avatar', name: 'Ece — sunucu avatarı', cover: img('/tools/angle/front-elevated.jpg'), collections: ['col-team'], age: 17, tags: ['avatar', 'şef', 'klon'], people: true, quality: 96, uses: 5, lastUsed: 6 },
  { id: 'av-mert', kind: 'avatar', name: 'Mert — ürün anlatıcı', cover: img('/tools/angle/front-side.jpg'), age: 26, tags: ['avatar', 'sanal karakter'], quality: 92, uses: 1, lastUsed: 22 },
  // Motion & şablonlar
  { id: 'm-sunset', kind: 'motion', name: 'Gün batımı alt bant', cover: img('/spark/fx/sample-a.webp'), collections: ['col-october'], duration: 6, age: 31, tags: ['alt bant', 'sıcak'], uses: 6, lastUsed: 1 },
  { id: 'm-night', kind: 'motion', name: 'Gece şehir intro', cover: img('/spark/fx/sample-b.webp'), duration: 4, age: 29, tags: ['intro', 'gece'], uses: 2, lastUsed: 15 },
  { id: 'm-price', kind: 'motion', name: 'Fiyat etiketi animasyonu', cover: glyph('tag', 48), duration: 3, age: 12, tags: ['fiyat', 'kampanya'], uses: 4, lastUsed: 2 },
  { id: 'tp-menu', kind: 'template', name: 'Menü tanıtım şablonu (9:16)', cover: img('/auth/ai-video-workspace.png'), collections: ['col-october'], age: 48, tags: ['şablon', 'dikey', 'menü'], uses: 7, lastUsed: 1 },
  { id: 'tp-story', kind: 'template', name: 'Haftalık kampanya storyboard', cover: img('/auth/storyboard-timeline.png'), age: 36, tags: ['şablon', 'storyboard'], uses: 3, lastUsed: 10 },
  { id: 'tp-publish', kind: 'template', name: 'Yayın planı şablonu', cover: img('/auth/campaign-publishing.png'), age: 33, tags: ['şablon', 'yayın'], uses: 1, lastUsed: 25 },
  // Ses
  { id: 'au-jingle', kind: 'audio', name: 'Marka jingle — 15 sn', cover: glyph('music', 262), collections: ['col-audio'], duration: 15, age: 60, tags: ['jingle', 'marka'], uses: 9, lastUsed: 3 },
  { id: 'au-lofi', kind: 'audio', name: 'Lo-fi kafe müziği', cover: glyph('music-2', 230), collections: ['col-audio'], duration: 180, age: 55, tags: ['müzik', 'lo-fi', 'arka plan'], flags: ['no_license'], uses: 4, lastUsed: 7 },
  { id: 'au-voice-deniz', kind: 'audio', name: 'Seslendirme — Deniz (TR)', cover: glyph('mic', 210), collections: ['col-audio'], duration: 41, age: 5, state: 'analyzing', source: 'recording', tags: [] },
  // Metin
  { id: 't-script', kind: 'text', name: 'Ekim menüsü senaryosu', cover: glyph('scroll-text', 330), collections: ['col-october'], age: 4, tags: ['senaryo', 'kampanya'], source: 'generated', text: 'Kanca: “Sonbahar tabağına sığdı.”\nSahne 1 — Balkabaklı risotto buharı…\nSahne 2 — Şef Ece tarifin sırrını anlatıyor…\nKapanış: “Ekim boyunca menüde.”', generatedBy: { tool: 'Asistan', model: 'LLM', prompt: 'Ekim menüsü için 30 saniyelik reels senaryosu yaz' } },
  { id: 't-captions', kind: 'text', name: 'Instagram açıklama paketi', cover: glyph('hash', 300), age: 3, tags: ['açıklama', 'hashtag'], source: 'generated', text: '🍂 Sonbahar menümüz geldi! Balkabaklı risotto, sıcak elmalı tart…\n#kafe #sonbahar #brunch', generatedBy: { tool: 'Asistan', model: 'LLM', prompt: '3 farklı Instagram açıklaması ve hashtag seti' } },
  // Henüz koleksiyonda olmayanlar (öneri bekleyenler dahil)
  { id: 'a-pasta', kind: 'image', name: 'Fırında makarna', cover: glyph('cooking-pot', 20), age: 1, tags: ['yemek', 'makarna', 'fırın'], quality: 90, summary: 'Peynirli fırın makarna, döküm tavada.' },
  { id: 'a-lemonade', kind: 'image', name: 'Ev yapımı limonata', cover: glyph('citrus', 56), age: 1, tags: ['içecek', 'yaz', 'yemek'], quality: 86 },
  { id: 'v-kitchen', kind: 'video', name: 'Mutfak hazırlık — sabah', cover: glyph('chef-hat', 270), age: 1, duration: 52, tags: ['şef', 'mutfak', 'hazırlık'], people: true, quality: 84 },
]

export const SEED_ASSETS_FULL: LibraryAsset[] = SEED_ASSETS.map(toAsset)

export const SEED_SUGGESTIONS: CollectionSuggestion[] = [
  { id: 's-pasta', assetId: 'a-pasta', collectionId: 'col-menu', confidence: 0.94, reason: 'Etiketler eşleşti: yemek, makarna' },
  { id: 's-lemonade', assetId: 'a-lemonade', collectionId: 'col-menu', confidence: 0.71, reason: 'Etiket eşleşti: yemek · içecek olabilir' },
  { id: 's-kitchen', assetId: 'v-kitchen', collectionId: 'col-team', confidence: 0.88, reason: 'Kişi algılandı · etiket: şef' },
]

export const SEED_GENERATIONS: LibraryGeneration[] = [
  { id: 'g1', kind: 'image', tool: 'Image Generate', model: 'Image Pro', prompt: 'Balkabaklı risotto, üstten çekim, sıcak sonbahar ışığı', createdAt: hoursAgo(0.4), status: 'completed', credits: 8.5, cover: glyph('soup', 32), savedAssetId: null, expiresAt: daysAhead(7), suggestedCollectionId: 'col-menu' },
  { id: 'g2', kind: 'video', tool: 'Video Generate', model: 'Video Pro', prompt: 'Fincana dökülen latte, ağır çekim, 9:16', createdAt: hoursAgo(0.1), status: 'running', credits: 42, cover: glyph('coffee', 26), savedAssetId: null, expiresAt: daysAhead(7) },
  { id: 'g3', kind: 'text', tool: 'Asistan', model: 'LLM', prompt: 'Ekim kampanyası için 5 reels kancası', createdAt: hoursAgo(2), status: 'completed', credits: 0.4, text: '1. “Sonbahar tabağına sığdı.”\n2. “Bu risotto’yu kaşıkla değil, gözle ye.”\n3. “Ekim’de sadece burada.”\n4. “Şef Ece’nin gizli tarifi.”\n5. “Kahven hazır, sonbahar da.”', savedAssetId: null, expiresAt: daysAhead(7), suggestedCollectionId: 'col-october' },
  { id: 'g4', kind: 'audio', tool: 'Text to Speech', model: 'Speech Natural', prompt: 'Haftanın menüsü seslendirmesi — sıcak ve samimi', createdAt: hoursAgo(5), status: 'completed', credits: 4, durationSeconds: 28, cover: glyph('audio-lines', 262), savedAssetId: null, expiresAt: daysAhead(6), suggestedCollectionId: 'col-audio' },
  { id: 'g5', kind: 'image', tool: 'Image Generate', model: 'Image Studio', prompt: 'Tiramisu dilimi, minimal stüdyo, yumuşak gölge', createdAt: hoursAgo(9), status: 'completed', credits: 12, cover: glyph('cake-slice', 28), savedAssetId: 'a-tiramisu', expiresAt: daysAhead(6), suggestedCollectionId: 'col-menu' },
  { id: 'g6', kind: 'video', tool: 'Video Generate', model: 'Video Fast', prompt: 'Mekânın drone çekimi, gün batımı', createdAt: hoursAgo(26), status: 'failed', credits: 0, cover: glyph('store', 200), savedAssetId: null, expiresAt: daysAhead(5) },
  { id: 'g7', kind: 'text', tool: 'Asistan', model: 'LLM', prompt: 'YouTube video başlığı önerileri: sonbahar menüsü', createdAt: hoursAgo(30), status: 'completed', credits: 0.3, text: '• Sonbahar Menümüzü İlk Kez Deniyoruz 🍂\n• Şef Ece’den 3 Sıcak Tarif\n• Bu Risotto’nun Sırrı Ne?', savedAssetId: null, expiresAt: daysAhead(1) },
  { id: 'g8', kind: 'image', tool: 'Angle', model: 'Angle Pro', prompt: 'Ece portresi — yan profil', createdAt: hoursAgo(50), status: 'completed', credits: 6, cover: { type: 'image', src: '/tools/angle/side.jpg' }, savedAssetId: 'a-portrait-side', expiresAt: daysAhead(5), suggestedCollectionId: 'col-team' },
  { id: 'g9', kind: 'video', tool: 'Viral Clips', model: 'Clips', prompt: 'Şef Ece röportajından 3 kısa klip', createdAt: hoursAgo(74), status: 'completed', credits: 18, durationSeconds: 27, cover: { type: 'image', src: '/flows/tips.png' }, savedAssetId: null, expiresAt: daysAhead(4), suggestedCollectionId: 'col-team' },
]

export const SEED_PREFERENCES: LibraryPreferences = {
  autoSaveGenerations: false,
  autoRouteToSmartCollections: true,
  generationRetentionDays: 7,
}

/** Storage plan of the demo workspace (bytes). */
export const STORAGE_QUOTA_BYTES = 50 * 1024 ** 3
export const STORAGE_EXTRA_USED_BYTES = 17.4 * 1024 ** 3

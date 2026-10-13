// Spark lab — demo model of the three workspace prototypes (`/spark/lab`). Prototype data only: nothing here
// talks to the gateway. The channel layer is read from the Memory page's own seed, so the lab shows the same
// knowledge, rules and skills the Memory page lists.

import { SEED_KNOWLEDGE, SEED_RULES, SEED_SKILLS } from '@/components/memory/memory-seed'

export type LabVariant = 'a' | 'b' | 'c'
export type LabPhase = 'empty' | 'drafting' | 'plan' | 'building' | 'done'
/** The Assistant's existing interaction modes (Ask / Auto / Full access). */
export type Autonomy = 'ask' | 'auto' | 'full'
/** Where a resolved value came from; the labels follow the script canvas decision (8B/8C). */
export type SourceKind = 'video' | 'channel' | 'template' | 'preference' | 'suggested' | 'assumed'

/** The three views of a project, from talking to hands-on. The ids are the `?v=` values. */
export const LAB_VARIANTS: { id: LabVariant; name: string; icon: string; line: string }[] = [
  { id: 'c', name: 'Sohbet', icon: 'chat', line: 'Projenin sohbeti: ne istediğini söylersin, Spark çalışırken ekranını izlersin.' },
  { id: 'b', name: 'Plan', icon: 'scenes', line: 'Plan çalışma alanıdır: sahneler şerit, akış ya da senaryo olarak.' },
  { id: 'a', name: 'Editör', icon: 'video', line: 'Tam editör: tuval, zaman çizelgesi ve proje dosyası.' },
]

/** The project's output format; it is part of the brief. `value` is width / height. */
export type LabRatio = '9:16' | '16:9' | '1:1'
export const LAB_RATIOS: { id: LabRatio; name: string; css: string; value: number; format: string }[] = [
  { id: '9:16', name: 'Dikey', css: '9 / 16', value: 9 / 16, format: 'Reels · 9:16 · 30 sn · Türkçe' },
  { id: '16:9', name: 'Yatay', css: '16 / 9', value: 16 / 9, format: 'YouTube · 16:9 · 30 sn · Türkçe' },
  { id: '1:1', name: 'Kare', css: '1 / 1', value: 1, format: 'Gönderi · 1:1 · 30 sn · Türkçe' },
]
export const ratioOf = (id: LabRatio) => LAB_RATIOS.find((entry) => entry.id === id) ?? LAB_RATIOS[0]!

/** The views of the plan; the first one is the default. */
/** The component shapes over the lab's markup: `calm` (`lab-look.css`), or `spark` for the lab without them. */
export type LabLook = 'calm' | 'spark'

export type LabBoard = 'strip' | 'flow' | 'script'
export const LAB_BOARDS: { id: LabBoard; name: string; good: string }[] = [
  { id: 'script', name: 'Senaryo', good: 'Planın tamamı: brief, sahne sahne anlatım, Spark’ın dayandığı bellek ve kendi kararları.' },
  { id: 'strip', name: 'Şerit', good: 'Kareler yan yana: videonun bütününe bir bakışta bak.' },
  { id: 'flow', name: 'Akış', good: 'Aynı plan Flow tuvalinde, Flow’un kendi düğümleriyle.' },
]

/** The moments of a run, in order; `?phase=` opens one of them. */
export const LAB_PHASES: LabPhase[] = ['empty', 'drafting', 'plan', 'building', 'done']

/** What a link says about the workspace: the view it opens on and, for review links, a fixed moment of the run. */
export type LabView = { variant: LabVariant; board?: LabBoard; ratio?: LabRatio; phase?: LabPhase; step?: number; hold: boolean; open: boolean; look: LabLook }

/**
 * Reads a page's query. `v=c|b|a` picks the view (Sohbet, Plan, Editör; Sohbet when absent), `board` the view of
 * the plan (`script|strip|flow`), `ratio` the output format. `phase`, `step` and `hold=1` open a fixed moment of
 * the scripted run and `open=1` starts the Plan view with its timeline open: both are for review links and
 * screenshots. `look=eski` shows the workspace without the calm component shapes.
 */
export function labViewFromQuery(query: { [key: string]: string | string[] | undefined }): LabView {
  const one = (key: string) => {
    const value = query[key]
    return Array.isArray(value) ? value[0] : value
  }
  const step = Number.parseInt(one('step') ?? '', 10)
  return {
    variant: LAB_VARIANTS.find((entry) => entry.id === one('v'))?.id ?? 'c',
    board: LAB_BOARDS.find((entry) => entry.id === one('board'))?.id,
    ratio: LAB_RATIOS.find((entry) => entry.id === one('ratio'))?.id,
    phase: LAB_PHASES.find((entry) => entry === one('phase')),
    step: Number.isNaN(step) ? undefined : step,
    hold: one('hold') === '1',
    open: one('open') === '1',
    look: one('look') === 'eski' || one('look') === 'spark' ? 'spark' : 'calm',
  }
}

export const AUTONOMY: { id: Autonomy; label: string; hint: string }[] = [
  { id: 'ask', label: 'Sor', hint: 'Planı sen onaylarsın.' },
  { id: 'auto', label: 'Otomatik', hint: 'Plan görünür, Spark hemen başlar; önizlemede durur.' },
  { id: 'full', label: 'Tam erişim', hint: 'Soru sormaz; 1000 kredi üstünde durur.' },
]

export const CHANNEL = { name: 'Yt-2 Studio', initials: 'YS' }
export const PROJECT_TITLE = 'Balkabaklı risotto · Reels'
export const DEMO_PROMPT = 'Ekim menüsündeki balkabaklı risottoyu tanıtan 30 saniyelik Reels yap.'
export const PROMPT_IDEAS = [
  DEMO_PROMPT,
  'Google yorumlarımızdan 20 saniyelik sosyal kanıt videosu',
  'Şef Ece’nin tarif klibini 45 saniyelik Shorts’a çevir',
]

const IDEA_TITLES = [PROJECT_TITLE, 'Google yorumları · sosyal kanıt', 'Şef Ece’nin tarifi · Shorts']
const TITLE_LENGTH = 44

/**
 * The name Spark gives a project from its first sentence. This stands in for the title the agent would write:
 * the openers have theirs ready, any other sentence is shortened at a word.
 */
export function titleFromPrompt(prompt: string) {
  const sentence = prompt.trim()
  const idea = PROMPT_IDEAS.indexOf(sentence)
  if (idea >= 0) return IDEA_TITLES[idea] ?? PROJECT_TITLE
  const plain = sentence.replace(/[.!?…]+$/, '')
  if (!plain) return PROJECT_TITLE
  if (plain.length <= TITLE_LENGTH) return plain
  const head = plain.slice(0, TITLE_LENGTH)
  const atWord = head.lastIndexOf(' ')
  return `${head.slice(0, atWord > TITLE_LENGTH / 2 ? atWord : TITLE_LENGTH)}…`
}

const knowledge = (id: string) => SEED_KNOWLEDGE.find((item) => item.id === id)?.title ?? id
const rule = (id: string) => SEED_RULES.find((item) => item.id === id)
const skill = (id: string) => SEED_SKILLS.find((item) => item.id === id)?.name ?? id

/** What the channel already holds and every video inherits (Memory + Brand). */
export const CHANNEL_LAYER = {
  rules: SEED_RULES.filter((item) => item.scope === 'channel' && item.enabled).length,
  knowledge: SEED_KNOWLEDGE.filter((item) => item.scope === 'channel' && item.enabled && item.status === 'ready').length,
  skills: SEED_SKILLS.filter((item) => item.enabled && !item.draft).length,
  kit: 'Kit v3',
}

/** `at` is the drafting tick an item appears on while the agent fills the project in. */
export type BriefField = { id: string; label: string; value: string; source: SourceKind; ref?: string; at: number }

export const BRIEF: BriefField[] = [
  { id: 'goal', label: 'Amaç', value: 'Ekim menüsünün yıldızı balkabaklı risottoyu tanıtmak, hafta sonu masalarını doldurmak.', source: 'video', at: 1 },
  { id: 'audience', label: 'Kitle', value: '25–40 yaş, şehirde yaşayan, hafta sonu brunch’a çıkan genç profesyoneller.', source: 'channel', ref: knowledge('k2'), at: 2 },
  { id: 'message', label: 'Ana mesaj', value: 'Sonbaharın tadı Moda’da: şefin elinden balkabaklı risotto.', source: 'video', at: 3 },
  { id: 'format', label: 'Format', value: 'Reels · 9:16 · 30 sn · Türkçe', source: 'video', at: 4 },
  { id: 'tone', label: 'Ton', value: 'Samimi, sıcak, biraz esprili; “sen” dili.', source: 'channel', ref: knowledge('k1'), at: 5 },
]

export type ContextGroup = 'rules' | 'knowledge' | 'look'
export type ContextRow = {
  id: string
  group: ContextGroup
  title: string
  value: string
  source: SourceKind
  /** Where the row is used, shown as a quiet suffix ("Sahne 4"). */
  usedIn?: string
  /** A "this video only" row the user can promote to the channel with one click. */
  promotable?: boolean
  /** The row's own action when it is not "change" (an empty slot offers to add). */
  action?: string
  at: number
}

export const CONTEXT: ContextRow[] = [
  { id: 'r1', group: 'rules', title: rule('r1')?.text ?? '', value: 'Her videoda', source: 'channel', usedIn: 'Sahne 1', at: 11 },
  { id: 'r2', group: 'rules', title: rule('r2')?.text ?? '', value: rule('r2')?.when ?? '', source: 'channel', usedIn: 'Sahne 4', at: 12 },
  { id: 'r4', group: 'rules', title: rule('r4')?.text ?? '', value: rule('r4')?.when ?? '', source: 'channel', usedIn: 'Süre', at: 13 },
  { id: 'v1', group: 'rules', title: 'Ürün ilk 5 saniyede görünsün.', value: 'Spark önerdi', source: 'video', usedIn: 'Sahne 2', promotable: true, at: 14 },
  { id: 'k3', group: 'knowledge', title: knowledge('k3'), value: 'Balkabaklı risotto 320 TL', source: 'channel', usedIn: 'Sahne 4', at: 15 },
  { id: 'k4', group: 'knowledge', title: knowledge('k4'), value: 'Ortalama 4,7 puan', source: 'channel', usedIn: 'Sahne 4', at: 16 },
  { id: 'k5', group: 'knowledge', title: knowledge('k5'), value: 'Moda, Kadıköy · hafta sonu 09:00–23:00', source: 'channel', usedIn: 'Sahne 5', at: 17 },
  { id: 'avatar', group: 'look', title: 'Karakter', value: 'Yok · klip ve ekran metniyle ilerliyor', source: 'suggested', action: 'Karakter ekle', at: 18 },
  { id: 'voice', group: 'look', title: 'Ses', value: 'Şef Ece’nin kendi sesi · klipten', source: 'video', at: 18 },
  { id: 'kit', group: 'look', title: 'Brand Kit', value: 'Yt-2 Studio · sürüm 3, bu videoya sabitlendi', source: 'channel', at: 19 },
  { id: 'tpl', group: 'look', title: 'Yapı', value: 'Ürün tanıtımı · dikey · 5 sahne', source: 'suggested', at: 20 },
  { id: 'cap', group: 'look', title: 'Altyazı', value: 'Açık · marka stili', source: 'preference', at: 21 },
  { id: 'music', group: 'look', title: 'Müzik', value: 'Sıcak akustik, düşük seviye', source: 'assumed', promotable: true, at: 22 },
]

/** The skill the agent picked for this job (Memory › Skills). */
export const SKILL = { name: skill('s5'), at: 11 }

export type AssetKind = 'library' | 'kit' | 'generate' | 'stock'
export const ASSET_LABEL: Record<AssetKind, string> = {
  library: 'Kütüphaneden',
  kit: 'Brand Kit',
  generate: 'Üretilecek',
  stock: 'Stok',
}

export type LabAsset = { id: string; title: string; kind: AssetKind; meta: string; art: SceneArt; at: number }

export const ASSETS: LabAsset[] = [
  { id: '1.1', title: knowledge('k6'), kind: 'library', meta: '0:42 · 0:04–0:13 kullanılacak', art: 'chef', at: 23 },
  { id: '1.2', title: 'Marka intro’su', kind: 'kit', meta: '0:02', art: 'intro', at: 24 },
  { id: '1.3', title: 'Risotto yakın çekim', kind: 'generate', meta: '5 sn · 12 kredi', art: 'hook', at: 25 },
  { id: '1.4', title: 'Fırından çıkan balkabağı', kind: 'stock', meta: '8 sn · ücretsiz', art: 'dish', at: 26 },
]

export type SceneArt = 'intro' | 'hook' | 'chef' | 'dish' | 'outro'
export type LayerKind = 'logo' | 'title' | 'lower' | 'price' | 'badge' | 'place'
export type SceneLayer = { key: string; kind: LayerKind; text: string }

export type LabScene = {
  id: string
  n: number
  role: string
  start: number
  end: number
  narration: string
  assetId: string | null
  art: SceneArt
  layers: SceneLayer[]
  /** Context rows this scene depends on. */
  uses: string[]
  at: number
}

export const SCENES: LabScene[] = [
  { id: 's1', n: 1, role: 'Intro', start: 0, end: 2, narration: '', assetId: '1.2', art: 'intro', layers: [{ key: 'logo', kind: 'logo', text: 'Yt-2 Kafe' }], uses: ['r1'], at: 6 },
  { id: 's2', n: 2, role: 'Kanca', start: 2, end: 7, narration: 'Sonbahar tabağa geldi.', assetId: '1.3', art: 'hook', layers: [{ key: 'title', kind: 'title', text: 'Sonbahar tabağa geldi' }], uses: ['v1'], at: 7 },
  { id: 's3', n: 3, role: 'Şef Ece', start: 7, end: 16, narration: '“Balkabağını fırında karamelize ediyoruz, sonra risottoya katıyoruz.”', assetId: '1.1', art: 'chef', layers: [{ key: 'lower', kind: 'lower', text: 'Şef Ece' }], uses: [], at: 8 },
  { id: 's4', n: 4, role: 'Tabak ve fiyat', start: 16, end: 24, narration: 'Ekim boyunca menüde: balkabaklı risotto, 320 lira.', assetId: '1.4', art: 'dish', layers: [{ key: 'price', kind: 'price', text: 'Balkabaklı risotto · 320 TL' }, { key: 'badge', kind: 'badge', text: '4,7 ★ Google' }], uses: ['r2', 'k3', 'k4'], at: 9 },
  { id: 's5', n: 5, role: 'Kapanış', start: 24, end: 30, narration: 'Hafta sonu Moda’da görüşelim.', assetId: null, art: 'outro', layers: [{ key: 'place', kind: 'place', text: 'Moda, Kadıköy · Hafta sonu 09:00–23:00' }], uses: ['k5'], at: 10 },
]

export const TOTAL_SECONDS = SCENES[SCENES.length - 1]!.end

/** Small decisions the agent took instead of asking (decision 12C, "Varsayımlarım"); each one can be undone. */
export type Assumption = {
  id: string
  text: string
  at: number
  /** The question that settles it when Spark asks instead of deciding alone. */
  question?: string
}

export const ASSUMPTIONS: Assumption[] = [
  { id: 'a1', text: 'Kanca için üç seçenekten ilkini seçtim: “Sonbahar tabağa geldi.”', question: 'q2', at: 27 },
  { id: 'a2', text: 'Müziği sıcak akustik ve düşük seviyede tuttum.', at: 28 },
  { id: 'a3', text: 'Zeynep’in yorumunu kullanmadım; menemenden bahsediyor, risottodan değil.', at: 29 },
]

export const DRAFT_END = 31

/**
 * What Spark asks before it plans, when the call is not its to make. `at` is the point of the draft it stops at;
 * `modes` the autonomy modes it asks in (with full access it never asks, and what it decides instead is listed
 * as an assumption).
 */
export type LabQuestion = { id: string; chip: string; text: string; options: { id: string; label: string; hint?: string }[]; at: number; modes: Autonomy[] }

export const QUESTIONS: LabQuestion[] = [
  {
    id: 'q1',
    chip: 'Anlatıcı',
    text: 'Videoyu kim anlatsın?',
    options: [
      { id: 'chef', label: 'Şef Ece, kendi klibinden', hint: 'Kütüphanedeki 0:42’lik klipten 9 saniye' },
      { id: 'voice', label: 'Dış ses', hint: 'Marka sesiyle üretilir' },
      { id: 'none', label: 'Anlatım olmasın', hint: 'Yalnızca ekran metni ve müzik' },
    ],
    at: 6,
    modes: ['ask', 'auto'],
  },
  {
    id: 'q2',
    chip: 'Kanca',
    text: 'Açılış cümlesi hangisi olsun?',
    options: [
      { id: 'h1', label: '“Sonbahar tabağa geldi.”' },
      { id: 'h2', label: '“Bu tabak yalnızca ekimde.”' },
      { id: 'h3', label: '“Şefin sonbahar sırrı.”' },
    ],
    at: 10,
    modes: ['ask'],
  },
]

/** Something to choose for a cast-and-look row: a face, a voice (with what it sounds like), a kit, a caption style. */
export type LookOption = { id: string; title: string; sub?: string; initials?: string; swatch?: string[]; tags?: string[] }

/** The things to choose from, by the id of the row in `CONTEXT` (group `look`). */
export const LOOK_OPTIONS: Record<string, LookOption[]> = {
  avatar: [
    { id: 'ece', title: 'Şef Ece', sub: 'Klipteki kişi · kütüphaneden', initials: 'ŞE' },
    { id: 'deniz', title: 'Deniz', sub: 'Stüdyo avatarı · sunucu', initials: 'D' },
    { id: 'mert', title: 'Mert', sub: 'Stüdyo avatarı · anlatıcı', initials: 'M' },
  ],
  voice: [
    { id: 'ece', title: 'Şef Ece’nin kendi sesi', sub: 'Klipten', tags: ['Kadın', 'Orta yaş', 'Sıcak'] },
    { id: 'brand', title: 'Marka sesi', sub: 'Kanal belleğinden', tags: ['Kadın', 'Genç', 'Enerjik'] },
    { id: 'calm', title: 'Sakin anlatıcı', sub: 'Ses kütüphanesinden', tags: ['Erkek', 'Olgun', 'Sakin'] },
  ],
  kit: [
    { id: 'v3', title: 'Yt-2 Studio', sub: 'Sürüm 3 · kanalın kiti', swatch: ['#21433a', '#f6f1e7', '#f0a43a'] },
    { id: 'v2', title: 'Yt-2 Studio', sub: 'Sürüm 2 · önceki', swatch: ['#2b2f33', '#f4f4f1', '#d95f3b'] },
    { id: 'own', title: 'Bu projeye özel', sub: 'Spark bu video için oluşturur', swatch: ['#3a2413', '#fbd98c', '#c9741c'] },
  ],
  tpl: [
    { id: 'product', title: 'Ürün tanıtımı', sub: '5 sahne · dikey' },
    { id: 'proof', title: 'Sosyal kanıt', sub: '4 sahne · yorumlarla' },
    { id: 'recipe', title: 'Tarif', sub: '6 sahne · adım adım' },
  ],
  cap: [
    { id: 'brand', title: 'Marka stili', sub: 'Alt ortada, koyu bant' },
    { id: 'bold', title: 'Kalın vurgulu', sub: 'Kelime kelime, sarı vurgu' },
    { id: 'minimal', title: 'Yalın', sub: 'Küçük, bantsız' },
    { id: 'off', title: 'Kapalı', sub: 'Altyazı yok' },
  ],
  music: [
    { id: 'acoustic', title: 'Sıcak akustik', sub: 'Düşük seviye' },
    { id: 'lofi', title: 'Lo-fi', sub: 'Düşük seviye' },
    { id: 'pop', title: 'Enerjik pop', sub: 'Orta seviye' },
    { id: 'none', title: 'Müziksiz', sub: 'Yalnızca anlatım' },
  ],
}

/** What the plan starts with for each of those rows; `null` is nothing chosen (no character). */
export const LOOK_DEFAULT: Record<string, string | null> = { avatar: null, voice: 'ece', kit: 'v3', tpl: 'product', cap: 'brand', music: 'acoustic' }

/** A voice that is made from scratch is described by one of each. */
export const VOICE_TRAITS = [
  { label: 'Cinsiyet', options: ['Kadın', 'Erkek'] },
  { label: 'Yaş', options: ['Genç', 'Orta yaş', 'Olgun'] },
  { label: 'Ton', options: ['Sıcak', 'Enerjik', 'Sakin', 'Kurumsal'] },
]

export type StepZone = 'stage' | 'timeline' | 'audio' | 'check'

/** One thing the agent does in the editor. `target` names the element the agent's cursor goes to. */
export type AgentStep = {
  id: string
  sceneId: string | null
  zone: StepZone
  label: string
  /** The same step while it is still running. */
  doing: string
  /** `<sceneId>:media` or `<sceneId>:<layerKey>`: what becomes visible when the step is done. */
  adds?: string
  target: string
  ms: number
}

export const STEPS: AgentStep[] = [
  { id: 't1', sceneId: 's1', zone: 'timeline', label: 'Marka intro’su yerleştirildi', doing: 'Marka intro’su yerleştiriliyor', adds: 's1:media', target: 'clip-s1', ms: 1300 },
  { id: 't2', sceneId: 's2', zone: 'stage', label: 'Yakın çekim üretildi', doing: 'Yakın çekim üretiliyor', adds: 's2:media', target: 'frame', ms: 2600 },
  { id: 't3', sceneId: 's2', zone: 'stage', label: 'Kanca metni yerleştirildi', doing: 'Kanca metni yerleştiriliyor', adds: 's2:title', target: 'layer-title', ms: 1500 },
  { id: 't4', sceneId: 's3', zone: 'timeline', label: 'Şef Ece klibi 0:04–0:13 kırpıldı', doing: 'Şef Ece klibi kırpılıyor', adds: 's3:media', target: 'clip-s3', ms: 1700 },
  { id: 't5', sceneId: 's3', zone: 'stage', label: 'Alt bant eklendi: Şef Ece', doing: 'Alt bant ekleniyor', adds: 's3:lower', target: 'layer-lower', ms: 1300 },
  { id: 't6', sceneId: 's4', zone: 'timeline', label: 'B-roll yerleştirildi', doing: 'B-roll yerleştiriliyor', adds: 's4:media', target: 'clip-s4', ms: 1500 },
  { id: 't7', sceneId: 's4', zone: 'stage', label: 'Fiyat etiketi: 320 TL, menüden doğrulandı', doing: 'Fiyat menüden doğrulanıyor', adds: 's4:price', target: 'layer-price', ms: 1600 },
  { id: 't8', sceneId: 's4', zone: 'stage', label: 'Google puanı rozeti eklendi', doing: 'Google puanı rozeti ekleniyor', adds: 's4:badge', target: 'layer-badge', ms: 1300 },
  { id: 't9', sceneId: 's5', zone: 'timeline', label: 'Kapanış arka planı: marka rengi', doing: 'Kapanış arka planı hazırlanıyor', adds: 's5:media', target: 'clip-s5', ms: 1200 },
  { id: 't9b', sceneId: 's5', zone: 'stage', label: 'Adres ve saatler yerleştirildi', doing: 'Adres ve saatler yerleştiriliyor', adds: 's5:place', target: 'layer-place', ms: 1500 },
  { id: 't10', sceneId: null, zone: 'audio', label: 'Müzik eklendi, ses dengelendi', doing: 'Müzik ekleniyor, ses dengeleniyor', adds: 'all:audio', target: 'lane-audio', ms: 1500 },
  { id: 't11', sceneId: null, zone: 'timeline', label: 'Altyazılar marka stiliyle eklendi', doing: 'Altyazılar ekleniyor', adds: 'all:captions', target: 'lane-captions', ms: 1500 },
  { id: 't12', sceneId: null, zone: 'check', label: 'Kalite kontrol: 30 sn, kurallar 4/4', doing: 'Kalite kontrol yapılıyor', target: 'frame', ms: 1400 },
]

export const ESTIMATE = {
  credits: 18,
  lines: [
    { label: 'Görsel üretim · 1 klip', credits: 12 },
    { label: 'Altyazı ve ses', credits: 6 },
    { label: 'Önizleme', credits: 0 },
  ],
  note: 'Son render ayrıca onaylanır.',
  /** The final render, approved by itself once the video is made. */
  render: 20,
}

/** The closing, batched suggestion: what this video taught that the channel could keep. */
export type Suggestion = { id: string; kind: 'rule' | 'template'; text: string; action: string }

export const SUGGESTIONS: Suggestion[] = [
  { id: 'p1', kind: 'rule', text: 'Ürün tanıtımlarında ürünü ilk 5 saniyede göster.', action: 'Kural olarak kaydet' },
  { id: 'p2', kind: 'template', text: 'Bu yapıyı şablon yap: Menü ürünü · Reels (5 sahne).', action: 'Şablon olarak kaydet' },
]

export const sceneById = (id: string | null) => SCENES.find((scene) => scene.id === id) ?? null
export const assetById = (id: string | null) => ASSETS.find((asset) => asset.id === id) ?? null
export const formatClock = (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, '0')}`

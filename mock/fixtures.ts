// Hand-written responses for specific endpoints. Anything not listed here is generated from the endpoint's
// zod schema (mock/schema-mock.ts). Add a fixture when a screen needs exact content: the handler returns the
// raw JSON body the real API would send; it is still validated against the schema the UI expects, and if it
// does not match, the generated data is used instead (a warning is printed in the browser console).
// `merge: true` fixtures only list the fields they care about; the rest of the body is generated.

import { z } from 'zod'

import type { ProductionPlanPresentation, VideoProductionProgress } from '@/lib/assistant/production-launch-api'
import type { PublishPackageBody, PublishPackageView } from '@/lib/assistant/script-review/publish-package-api'
import type {
  BriefHeader,
  PlanHeader,
  PlanLineItem,
  ProductionPlanSummary,
  ScriptChapter,
  ScriptHeader,
  ScriptPatchOp,
  ScriptReviewShot,
} from '@/lib/assistant/script-review/script-review-api'
import { AuthClientError } from '@/lib/auth/errors'
import type { BrandKitDetail, BrandKitDraftContent } from '@/lib/brand-kit/api'
import { quotaUsageDataSchema } from '@/lib/billing/api'
import type { ChannelBrandOverlayPreset } from '@/lib/channel/api'
import { publicMetadataRecord } from '@/lib/public-model-display'

import toolsCatalog from './data/tools-catalog.json'
import { generateRaw, mockOf } from './generate'
import { publishMockStreamEvent } from './network-shim'
import { mockAuthSession, mockTenant, setMockSignedOut } from './session'
import { MOCK_TENANT, MOCK_TITLES, pickMockImage } from './vocabulary'

export type MockRequest = {
  path: string
  method: string
  body?: unknown
  query: URLSearchParams
}

export type MockFixture = {
  method?: string
  path: RegExp
  merge?: boolean
  handler: (request: MockRequest, match: RegExpMatchArray) => unknown | Promise<unknown>
}

export const fixtures: MockFixture[] = [
  // --- auth ------------------------------------------------------------------------------------------------
  { method: 'GET', path: /^\/api\/v1\/auth\/me$/, handler: () => ({ data: mockAuthSession() }) },
  { method: 'GET', path: /^\/api\/v1\/auth\/csrf$/, handler: () => ({ data: { csrfToken: 'mock-csrf-token-0000000000000000000000' } }) },
  {
    method: 'POST',
    path: /^\/api\/v1\/auth\/session$/,
    handler: () => {
      setMockSignedOut(false)
      return { data: mockAuthSession() }
    },
  },
  { method: 'POST', path: /^\/api\/v1\/auth\/register$/, handler: () => ({ data: { tenant: mockTenant() } }) },
  {
    method: 'POST',
    path: /^\/api\/v1\/auth\/logout$/,
    handler: () => {
      setMockSignedOut(true)
      return { data: { message: 'Signed out (mock).' } }
    },
  },
]

// --- channels (the workspace needs at least one connected channel) --------------------------------------------
export const MOCK_CHANNELS = [
  mockChannel('6f1c2a3b-8d4e-4f5a-9b6c-1d2e3f4a5b6c', 'Yt-2 Studio', 'UCyt2studio000000000001'),
  mockChannel('2b7d9e1f-3a4c-4d5e-8f6a-7b8c9d0e1f2a', 'Yt-2 Shorts', 'UCyt2shorts000000000002'),
]

function mockChannel(id: string, name: string, platformChannelId: string) {
  const now = Date.now()
  return {
    id,
    platform: 'youtube',
    platform_channel_id: platformChannelId,
    name,
    status: 'connected',
    status_before_plan_pause: null,
    settings: { logoUrl: null, brandOverlay: null, brandOverlayVersion: 0 },
    connected_at: new Date(now - 60 * 24 * 3600 * 1000).toISOString(),
    disconnected_at: null,
    removal_requested_at: null,
    removed_at: null,
    created_at: new Date(now - 60 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(now - 24 * 3600 * 1000).toISOString(),
    connector_connection: null,
  }
}

fixtures.push(
  { method: 'GET', path: /^\/api\/v1\/channels$/, handler: () => ({ data: MOCK_CHANNELS }) },
  { method: 'GET', path: /^\/api\/v1\/channels\/bootstrap$/, handler: () => ({ data: { channels: MOCK_CHANNELS, pending_slot_selection: null } }) },
  { method: 'GET', path: /^\/api\/v1\/channels\/slot-selection\/pending$/, handler: () => ({ data: { selection: null } }) },
  {
    method: 'GET',
    path: /^\/api\/v1\/workspace\/bootstrap$/,
    merge: true,
    handler: () => ({
      data: {
        tenant: { name: MOCK_TENANT.name, email: MOCK_TENANT.email },
        channels: MOCK_CHANNELS,
        pending_slot_selection: null,
        global_alerts: [],
        quota_usage: mockOf(quotaUsageDataSchema, 'quota-usage'),
        workspace_ready: true,
        degraded_sources: [],
      },
    }),
  },
)

// --- inbox, announcements, alerts -----------------------------------------------------------------------------
const REVIEW_MESSAGES: Array<[string, string, 'request' | 'message']> = [
  ['Senaryo onayı bekleniyor', '“Yaz Kampanyası Tanıtım Videosu” için hazırlanan senaryoyu inceleyip onaylayın.', 'request'],
  ['Render tamamlandı', '“Ürün Lansmanı — Reels Serisi” videosu indirilmeye hazır.', 'message'],
  ['Kapak görseli seçimi', 'İş akışı devam etmeden önce üç kapak seçeneğinden birini seçin.', 'request'],
  ['Haftalık rapor hazır', 'Kanal performans özeti oluşturuldu: izlenme %12 arttı.', 'message'],
  ['Seslendirme kontrolü', 'Yeni seslendirme taslağını dinleyip onay verin.', 'request'],
  ['Yayın planlandı', '“Black Friday Duyurusu” Cuma 18:00’de yayınlanacak.', 'message'],
]

function reviewItems() {
  const now = Date.now()
  return REVIEW_MESSAGES.map(([title, message, itemType], index) => {
    const at = new Date(now - (index + 1) * 5 * 3600 * 1000).toISOString()
    return {
      id: `8a1f0c2e-${String(1000 + index)}-4d5e-9f6a-7b8c9d0e1f2${index}`,
      item_type: itemType,
      status: itemType === 'request' ? 'pending' : 'delivered',
      read_state: index < 2 ? 'unread' : 'read',
      title_key: 'review.workflow_gate.title',
      message_key: 'review.workflow_gate.message',
      payload: { title, message },
      thread_id: null,
      request_kind: itemType === 'request' ? 'approval' : null,
      allowed_actions: itemType === 'request' ? ['approve', 'reject'] : [],
      source_bc: 'workflow',
      source_type: 'workflow_gate',
      source_id: null,
      delivery_surface: 'inbox',
      inbox_visible_at: at,
      expires_at: null,
      first_seen_at: index < 2 ? null : at,
      last_seen_at: index < 2 ? null : at,
      read_at: index < 2 ? null : at,
      archived_at: null,
      deleted_at: null,
      created_at: at,
      updated_at: at,
    }
  })
}

const TOP_BANNER = {
  id: 'f3b2a1c0-0000-4000-8000-00000000b001',
  campaign_id: 'yt2-design-mode',
  delivery_id: null,
  status: 'delivered',
  title_key: 'review.announcement.title',
  message_key: 'review.announcement.message',
  payload: { title: 'Yt-2 tasarım modu', message: 'Tüm veriler örnektir; API bağlantısı yoktur.' },
  scheduled_for: new Date().toISOString(),
  read_at: null,
  dismissed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/review\/items$/,
    handler: () => {
      const items = reviewItems()
      return { data: items, meta: { total: items.length, limit: 20, offset: 0, hasMore: false } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/review\/(public\/)?announcements\/top-banner$/,
    handler: () => ({ data: [TOP_BANNER], meta: { total: 1, limit: 5, offset: 0, hasMore: false } }),
  },
  { method: 'GET', path: /^\/api\/v1\/action-center\/items$/, handler: () => ({ data: [] }) },
)

// --- tools catalog (generated from the real node contracts: mock/generators/generate-tools-catalog.cjs) ----------
fixtures.push({
  method: 'GET',
  path: /^\/api\/v1\/discovery\/tools\/catalog$/,
  handler: () => toolsCatalog,
})

// --- assistant composer catalog ------------------------------------------------------------------------------------
// The generated catalog repeats random aspect ratios and duration bounds; pin the three formats and a 5 s – 10 min
// range so the chat composer and the new-chat gallery ("Kullan" sets format and length) behave like production.
// The default chat model is one of the listed ones (a new chat starts with it, see "New chats" below).
const DEFAULT_CHAT_MODEL_ID = 'claude-sonnet-5-5'
fixtures.push({
  method: 'GET',
  path: /^\/api\/v1\/assistant\/composer\/catalog$/,
  merge: true,
  handler: () => ({
    data: {
      defaults: { model_id: DEFAULT_CHAT_MODEL_ID, aspect_ratio: '16:9', video_duration_seconds: 60, approval_mode: 'autonomous' },
      aspect_ratios: [
        { id: '16:9', label: 'Yatay', detail: 'YouTube ve web videoları' },
        { id: '9:16', label: 'Dikey', detail: 'Shorts, Reels ve TikTok' },
        { id: '1:1', label: 'Kare', detail: 'Gönderi ve kapak görselleri' },
      ],
      duration: { min_seconds: 5, default_seconds: 60, max_seconds: 600, scale_max_seconds: 300, step_seconds: 5, source_feature_key: 'max_video_duration_seconds' },
      approval_modes: [
        { id: 'ask', label: 'Önce sor', detail: 'Plan ve senaryoyu yazar, onayınla üretir.' },
        { id: 'autonomous', label: 'Otomatik', detail: 'İsteğine göre kendisi karar verir.' },
      ],
      // Real product names in the model selector (the generated catalog names models with random titles).
      chat_models: [
        composerModel(DEFAULT_CHAT_MODEL_ID, 'Claude Sonnet 5.5', 'chat', 'Dengeli: hızlı ve özenli planlama', 'high', 'fast', 2),
        composerModel('claude-opus-5-5', 'Claude Opus 5.5', 'chat', 'En derin düşünme, uzun senaryolar', 'highest', 'standard', 6),
        composerModel('gpt-5', 'GPT-5', 'chat', 'Genel amaçlı, güçlü yazım', 'high', 'standard', 4),
        composerModel('gemini-3-pro', 'Gemini 3 Pro', 'chat', 'Uzun bağlam, çok dilli', 'high', 'fast', 3),
      ],
      video_models: [
        composerModel('veo-3', 'Veo 3', VIDEO_CAPABILITY, 'Sinematik görüntü, sesiyle birlikte', 'highest', 'standard', 70),
        composerModel('kling-2-5', 'Kling 2.5', VIDEO_CAPABILITY, 'Hızlı, gerçekçi hareket', 'high', 'fast', 40),
        composerModel('sora-2', 'Sora 2', VIDEO_CAPABILITY, 'Uzun ve tutarlı sahneler', 'highest', 'slow', 90),
      ],
      image_models: [
        composerModel('flux-2-pro', 'FLUX.2 Pro', IMAGE_CAPABILITY, 'Fotogerçekçi, net detay', 'highest', 'fast', 15, { tasks: ['text_to_image', 'image_edit'] }),
        composerModel('gpt-image-1', 'GPT Image 1', IMAGE_CAPABILITY, 'Yazılı görseller ve düzenleme', 'high', 'standard', 12, { tasks: ['text_to_image', 'image_edit'] }),
        composerModel('imagen-4', 'Imagen 4', IMAGE_CAPABILITY, 'Canlı renkler, hızlı üretim', 'high', 'fast', 10, { tasks: ['text_to_image'] }),
      ],
    },
  }),
})

const VIDEO_CAPABILITY = 'video.generate'
const IMAGE_CAPABILITY = 'image.generate'

function composerModel(id: string, label: string, capability: string, description: string, quality: string, speed: string, credits: number, inputSchema: Record<string, unknown> = {}) {
  return {
    id,
    label,
    capability,
    model_type: 'concrete',
    description,
    quality,
    speed,
    cost_label: `~${credits} kredi`,
    estimated_credits: credits,
    input_schema: inputSchema,
    pricing_rule: {},
    rate_limit: {},
    capacity_limit: {},
    visibility: {},
    cost_metadata: {},
  }
}

// --- voice library ---------------------------------------------------------------------------------------------
// The brand voice library (Marka > Sesler) and every voice picker read these: stock voices with a real-sounding name,
// gender, age, accent, tone and use, and the channel's own clones. A preview is a short silent clip, so playing one
// runs the player for a few seconds without sound.
type MockVoice = {
  id: string
  name: string
  origin: 'stock' | 'instant_clone'
  status: 'ready' | 'provisioning'
  gender: 'female' | 'male' | 'nonbinary'
  age: 'young' | 'adult' | 'mature'
  accent: string
  languages: string[]
  tone: string[]
  use: string[]
  description: string
  featured?: boolean
}

const MOCK_VOICES: MockVoice[] = [
  { id: 'voice-elif', name: 'Elif', origin: 'stock', status: 'ready', gender: 'female', age: 'young', accent: 'İstanbul', languages: ['tr'], tone: ['sıcak', 'samimi'], use: ['reklam', 'sosyal medya'], description: 'Sıcak ve samimi; kısa reklamlar ve Reels için.', featured: true },
  { id: 'voice-mert', name: 'Mert', origin: 'stock', status: 'ready', gender: 'male', age: 'adult', accent: 'İstanbul', languages: ['tr'], tone: ['güven veren', 'sakin'], use: ['anlatım', 'belgesel'], description: 'Derin ve güven veren bir anlatıcı sesi.', featured: true },
  { id: 'voice-zeynep', name: 'Zeynep', origin: 'stock', status: 'ready', gender: 'female', age: 'adult', accent: 'Ankara', languages: ['tr', 'en'], tone: ['net', 'kurumsal'], use: ['eğitim', 'sunum'], description: 'Net diksiyon; eğitim videoları ve ürün sunumları.' },
  { id: 'voice-can', name: 'Can', origin: 'stock', status: 'ready', gender: 'male', age: 'young', accent: 'İzmir', languages: ['tr'], tone: ['enerjik', 'esprili'], use: ['reklam', 'oyun'], description: 'Enerjik ve esprili; hızlı tempolu tanıtımlar.' },
  { id: 'voice-ayse', name: 'Ayşe', origin: 'stock', status: 'ready', gender: 'female', age: 'mature', accent: 'İstanbul', languages: ['tr'], tone: ['yumuşak', 'şefkatli'], use: ['hikâye', 'belgesel'], description: 'Yumuşak ve şefkatli; hikâye anlatımına uygun.' },
  { id: 'voice-kerem', name: 'Kerem', origin: 'stock', status: 'ready', gender: 'male', age: 'mature', accent: 'İstanbul', languages: ['tr'], tone: ['otoriter', 'derin'], use: ['fragman', 'belgesel'], description: 'Derin ve otoriter; fragman ve açılış sesleri.', featured: true },
  { id: 'voice-deniz', name: 'Deniz', origin: 'stock', status: 'ready', gender: 'nonbinary', age: 'young', accent: 'İstanbul', languages: ['tr', 'en'], tone: ['sakin', 'modern'], use: ['podcast', 'teknoloji'], description: 'Sakin ve modern; teknoloji anlatımı ve podcast.' },
  { id: 'voice-selin', name: 'Selin', origin: 'stock', status: 'ready', gender: 'female', age: 'young', accent: 'İzmir', languages: ['tr'], tone: ['enerjik', 'neşeli'], use: ['sosyal medya', 'tanıtım'], description: 'Neşeli ve canlı; sosyal medya kampanyaları.' },
  { id: 'voice-burak', name: 'Burak', origin: 'stock', status: 'ready', gender: 'male', age: 'adult', accent: 'Ankara', languages: ['tr'], tone: ['kurumsal', 'net'], use: ['sunum', 'eğitim'], description: 'Kurumsal ve net; şirket içi eğitim ve sunum.' },
  { id: 'voice-nehir', name: 'Nehir', origin: 'stock', status: 'ready', gender: 'female', age: 'adult', accent: 'Karadeniz', languages: ['tr'], tone: ['doğal', 'sıcak'], use: ['vlog', 'yemek'], description: 'Doğal ve sıcak; vlog ve yemek videoları.' },
  { id: 'voice-ahmet', name: 'Ahmet', origin: 'stock', status: 'ready', gender: 'male', age: 'mature', accent: 'İstanbul', languages: ['tr'], tone: ['güven veren', 'sakin'], use: ['haber', 'anlatım'], description: 'Haber spikeri tonu; ağırbaşlı ve güven veren.' },
  { id: 'voice-ece', name: 'Ece', origin: 'stock', status: 'ready', gender: 'female', age: 'young', accent: 'İstanbul', languages: ['tr'], tone: ['fısıltı', 'sakin'], use: ['meditasyon', 'ASMR'], description: 'Fısıltıya yakın, sakin; meditasyon ve rahatlama.' },
  { id: 'voice-emre', name: 'Emre', origin: 'stock', status: 'ready', gender: 'male', age: 'young', accent: 'İstanbul', languages: ['tr'], tone: ['enerjik', 'hızlı'], use: ['spor', 'oyun'], description: 'Hızlı ve heyecanlı; spor özetleri ve oyun.' },
  { id: 'voice-melis', name: 'Melis', origin: 'stock', status: 'ready', gender: 'female', age: 'adult', accent: 'İstanbul', languages: ['tr', 'en'], tone: ['zarif', 'sakin'], use: ['moda', 'lüks'], description: 'Zarif ve ölçülü; moda ve lüks markalar.' },
  { id: 'voice-arda', name: 'Arda', origin: 'stock', status: 'ready', gender: 'male', age: 'adult', accent: 'Bursa', languages: ['tr'], tone: ['samimi', 'esprili'], use: ['podcast', 'vlog'], description: 'Samimi sohbet tonu; podcast ve vlog.' },
  { id: 'voice-olivia', name: 'Olivia', origin: 'stock', status: 'ready', gender: 'female', age: 'adult', accent: 'Amerikan', languages: ['en'], tone: ['sıcak', 'net'], use: ['reklam', 'eğitim'], description: 'Clear and warm American English for ads and explainers.' },
  { id: 'voice-james', name: 'James', origin: 'stock', status: 'ready', gender: 'male', age: 'adult', accent: 'İngiliz', languages: ['en'], tone: ['sakin', 'derin'], use: ['belgesel', 'anlatım'], description: 'Calm British narrator for documentaries.' },
  { id: 'voice-sofia', name: 'Sofía', origin: 'stock', status: 'ready', gender: 'female', age: 'young', accent: 'İspanyol', languages: ['es', 'en'], tone: ['enerjik', 'neşeli'], use: ['sosyal medya', 'tanıtım'], description: 'Energetic Spanish and English for social campaigns.' },
  { id: 'voice-clone-ece', name: 'Şef Ece', origin: 'instant_clone', status: 'ready', gender: 'female', age: 'adult', accent: 'İstanbul', languages: ['tr'], tone: ['sıcak', 'samimi'], use: ['yemek', 'anlatım'], description: 'Kütüphanedeki tarif klibinden klonlandı.' },
  { id: 'voice-clone-brand', name: 'Marka sesi — Yt-2', origin: 'instant_clone', status: 'ready', gender: 'female', age: 'young', accent: 'İstanbul', languages: ['tr'], tone: ['enerjik', 'net'], use: ['reklam', 'sosyal medya'], description: 'Kanalın tüm reklamlarında kullanılan ses.' },
  { id: 'voice-clone-founder', name: 'Kurucu — Can', origin: 'instant_clone', status: 'provisioning', gender: 'male', age: 'adult', accent: 'İstanbul', languages: ['tr'], tone: ['samimi'], use: ['podcast'], description: 'Kayıt işleniyor; birkaç dakika içinde hazır.' },
]

function mockVoiceProfile(voice: MockVoice) {
  const at = new Date(Date.UTC(2026, 8, 1 + MOCK_VOICES.indexOf(voice))).toISOString()
  return {
    id: voice.id,
    channel_id: voice.origin === 'stock' ? null : MOCK_CHANNELS[0].id,
    display_name: voice.name,
    origin: voice.origin,
    status: voice.status,
    default_language: voice.languages[0] ?? 'tr',
    supported_languages: voice.languages,
    preview_available: voice.status === 'ready',
    catalog: {
      description: voice.description,
      gender: voice.gender,
      age_band: voice.age,
      accent: voice.accent,
      tone_tags: voice.tone,
      use_case_tags: voice.use,
      featured: Boolean(voice.featured),
      demo_text: null,
      demo_language: voice.languages[0] ?? 'tr',
    },
    compatible_model_ids: [],
    created_at: at,
    updated_at: at,
  }
}

/** A few seconds of silence as a WAV data URL: the preview player runs and ends like a real clip. */
function silentWav(seconds: number) {
  const rate = 8000
  const samples = Math.round(rate * seconds)
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true)
  text(36, 'data'); view.setUint32(40, samples, true)
  bytes.fill(128, 44)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(binary)}`
}

let mockVoicePreview: string | null = null

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/voice-profiles$/,
    handler: (request) => {
      const origin = request.query.get('origin')
      const status = request.query.get('status')
      const voices = MOCK_VOICES
        .filter((voice) => !origin || voice.origin === origin || (origin === 'instant_clone' && voice.origin === 'instant_clone'))
        .filter((voice) => !status || voice.status === status)
        .map(mockVoiceProfile)
      return { data: voices, meta: { total: voices.length, limit: 100, offset: 0, hasMore: false, nextCursor: null } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/voice-profiles\/([^/]+)\/preview$/,
    handler: (_request, match) => {
      mockVoicePreview ??= silentWav(3)
      return { data: { voice_profile_id: decodeURIComponent(match[1] ?? 'voice'), url: mockVoicePreview, expires_in_seconds: 300 } }
    },
  },
)

// --- run history of the tools workspace ------------------------------------------------------------------------
const OUTPUT_PROMPTS = [
  'Gün batımında sahilde yürüyen bir kamera çekimi, sinematik ışık',
  'Minimal beyaz stüdyoda ürün tanıtımı, yumuşak gölgeler',
  'Neon ışıklı İstanbul sokağı, yağmurlu gece',
  'Dağ yolunda ilerleyen bir araç, drone bakışı',
]

function recentOutputs(nodeType: string, kind: string | null) {
  const mediaKind = kind ?? (/image|angle|background/.test(nodeType) ? 'image' : /speech|voice|transcribe/.test(nodeType) ? 'audio' : 'video')
  const now = Date.now()
  return OUTPUT_PROMPTS.map((prompt, index) => {
    const at = new Date(now - (index + 1) * 3 * 3600 * 1000).toISOString()
    const isImage = mediaKind === 'image'
    return {
      id: `a0${index}c1d2e-1111-4222-8333-44445555666${index}`,
      workflowId: `b0${index}c1d2e-1111-4222-8333-44445555666${index}`,
      agentId: `c0${index}c1d2e-1111-4222-8333-44445555666${index}`,
      nodeKey: 'node_1',
      nodeType,
      status: 'completed',
      prompt,
      sourceUrls: [],
      modelLabel: isImage ? 'Image Pro' : 'Video Pro',
      modelId: isImage ? 'image-pro' : 'video-pro',
      totalCreditsEstimated: isImage ? 8.5 : 42,
      totalCreditsCharged: isImage ? 8.5 : 42,
      nodeCreditsCharged: isImage ? 8.5 : 42,
      errorMessage: null,
      outputHash: null,
      outputPreview: null,
      media: [{
        kind: mediaKind,
        downloadId: null,
        url: null,
        previewUrl: pickMockImage(`${nodeType}.${index}`),
        downloadUrl: null,
        storageObjectId: null,
        sourceUrl: null,
        fileName: `output-${index + 1}.${isImage ? 'png' : 'mp4'}`,
        mimeType: isImage ? 'image/png' : 'video/mp4',
        sizeBytes: 2_400_000,
        durationSeconds: isImage ? null : 5,
        creditsCharged: isImage ? 8.5 : 42,
        workflowReady: true,
        title: prompt,
      }],
      createdAt: at,
      updatedAt: at,
      completedAt: at,
    }
  })
}

fixtures.push({
  method: 'GET',
  path: /^\/api\/v1\/workflows\/recent-outputs$/,
  handler: (request) => ({
    data: {
      items: recentOutputs(request.query.get('node_type') ?? 'video_generate@1', request.query.get('kind')),
      nextCursor: null,
      hasMore: false,
      limit: 20,
    },
  }),
})

// --- avatars (brand → Avatarlar, "create human / character") ---------------------------------------------------
// Each avatar has its own portrait (cropped from the app's own images, public/brand/avatars): the storage delivery
// URL of its preview object resolves to it (see `MOCK_OBJECT_IMAGES`).
const AVATARS: Array<[string, 'human_clone' | 'digital_human' | 'public_template', string, 'ready' | 'provisioning']> = [
  ['Deniz — Sunucu', 'human_clone', 'presenter', 'ready'],
  ['Zeynep — Kurucu', 'human_clone', 'woman', 'ready'],
  ['Mert — Ürün Anlatıcı', 'human_clone', 'man', 'ready'],
  ['Ece — Eğitmen', 'digital_human', 'studio', 'ready'],
  ['Kaan — Haber Spikeri', 'public_template', 'anchor', 'ready'],
  ['Bora — Çizgi Karakter', 'digital_human', 'character', 'ready'],
  ['Pıtır — Maskot', 'digital_human', 'creature', 'provisioning'],
]

/** Storage objects with a fixed picture (avatar previews); every other object gets a placeholder from the pool. */
const MOCK_OBJECT_IMAGES = new Map<string, string>(
  AVATARS.map(([, , portrait], index) => [`f1c${index}0000-0000-4000-8000-00000000c00${index}`, `/brand/avatars/${portrait}.jpg`]),
)

function avatarItems(channelId: string) {
  const now = Date.now()
  return AVATARS.map(([displayName, origin, , status], index) => {
    const at = new Date(now - (index + 1) * 26 * 3600 * 1000).toISOString()
    return {
      id: `d1a${index}0000-0000-4000-8000-00000000a00${index}`,
      channel_id: channelId,
      display_name: displayName,
      origin,
      status,
      primary_shot_id: `e1b${index}0000-0000-4000-8000-00000000b00${index}`,
      default_voice_profile_id: null,
      catalog_template_id: origin === 'public_template' ? `tpl-${index}` : null,
      source_storage_object_id: null,
      preview_storage_object_id: `f1c${index}0000-0000-4000-8000-00000000c00${index}`,
      audio_storage_object_id: null,
      failure_code: null,
      recording_refund_status: 'none',
      metadata: {},
      created_at: at,
      updated_at: at,
    }
  })
}

const PUBLIC_AVATAR_NAMES: Array<[string, 'female' | 'male', string, 'young' | 'adult' | 'mature', string]> = [
  ['Lara', 'female', 'realistic', 'young', 'side'], ['Emre', 'male', 'cinematic', 'adult', 'man'], ['Aylin', 'female', 'cinematic', 'adult', 'presenter'],
  ['Kaan', 'male', 'realistic', 'young', 'anchor'], ['Defne', 'female', 'cinematic', 'mature', 'woman'], ['Tuna', 'male', 'illustrated', 'young', 'character'],
  ['Mina', 'female', 'realistic', 'young', 'closeup'], ['Pıtır', 'male', 'illustrated', 'young', 'creature'], ['Işıl', 'female', 'realistic', 'adult', 'studio'],
]

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/avatars$/,
    handler: (request) => {
      const items = avatarItems(request.query.get('channel_id') ?? MOCK_CHANNELS[0].id)
      return { data: items, meta: { total: items.length, limit: 20, offset: 0, hasMore: false, nextCursor: null } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/avatars\/entitlement$/,
    handler: () => ({
      data: {
        enabled: true,
        clone_enabled: true,
        voice_clone_enabled: true,
        plan: 'pro',
        free_avatars: { limit: 20, used: 6, reserved: 0, remaining: 14, resets_at: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString() },
        avatars: { active: 6, fair_use_limit: 200 },
        concurrency: { limit: 3 },
        credits: { available: 1240 },
        estimates: { clone_credits: 59, character_credits: 19, shot_credits: 19, voice_clone_credits: 1 },
        voice_profiles: { used: 2, limit: 10 },
      },
    }),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/avatars\/([^/]+)$/,
    handler: (request, match) => {
      const found = avatarItems(request.query.get('channel_id') ?? MOCK_CHANNELS[0].id).find((item) => item.id === match[1])
      return { data: found ?? avatarItems(MOCK_CHANNELS[0].id)[0] }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/public-avatars$/,
    handler: (request) => {
      const data = PUBLIC_AVATAR_NAMES.map(([name, gender, style, age, portrait], index) => ({
        id: `tpl-${index}`,
        display_name: name,
        style,
        gender,
        age_band: age,
        ethnicity: null,
        orientation: 'portrait',
        featured: index < 4,
        tags: [style, gender],
        preview_url: `/brand/avatars/${portrait}.jpg`,
        preview_storage_key: null,
        status: 'active',
      })).filter((template) => {
        const search = request.query.get('search')?.toLocaleLowerCase('tr')
        if (search && !template.display_name.toLocaleLowerCase('tr').includes(search)) return false
        if (request.query.get('style') && template.style !== request.query.get('style')) return false
        if (request.query.get('gender') && template.gender !== request.query.get('gender')) return false
        if (request.query.get('age_band') && template.age_band !== request.query.get('age_band')) return false
        return request.query.get('featured') !== 'true' || template.featured
      })
      return { data, meta: { total: data.length, limit: 24, offset: 0, hasMore: false, nextCursor: null } }
    },
  },
)

// --- avatar shots: the avatar's portrait first, then looks of the same person; a new shot renders for a few seconds -
/** The looks of each portrait after its main one (the same person: closer, the other side; Ece has a real set). */
function avatarLooks(portrait: string): Array<[string, string]> {
  if (portrait === 'studio') return [['Yakın plan', '/brand/avatars/closeup.jpg'], ['Profil', '/brand/avatars/side.jpg']]
  if (portrait === 'creature') return []
  return [['Yakın plan', `/brand/avatars/looks/${portrait}-close.jpg`], ['Öteki açı', `/brand/avatars/looks/${portrait}-mirror.jpg`]]
}

type MockAvatarShot = {
  id: string
  avatar_id: string
  display_name: string
  status: 'processing' | 'completed' | 'failed'
  kind: 'create' | 'look'
  is_primary: boolean
  storage_object_id: string | null
  source_shot_id: string | null
  appearance: Record<string, unknown>
  prompt: string | null
  background_mode: 'original'
  background_color: null
  crop_box: null
  workflow_id: null
  failure_code: null
  created_at: string
  updated_at: string
}

const mockAvatarShots = new Map<string, MockAvatarShot[]>()

function shotsOfAvatar(avatarId: string): MockAvatarShot[] {
  const known = mockAvatarShots.get(avatarId)
  if (known) return known
  const index = Number(/^d1a(\d+)0000/.exec(avatarId)?.[1] ?? -1)
  const entry = AVATARS[index]
  const shots: MockAvatarShot[] = []
  if (entry) {
    const [, , portrait, status] = entry
    const primaryId = `e1b${index}0000-0000-4000-8000-00000000b00${index}`
    const base = Date.now() - (index + 1) * 26 * 3600 * 1000
    const shot = (n: number, name: string, objectId: string | null, state: MockAvatarShot['status']): MockAvatarShot => {
      const at = new Date(base + n * 3600 * 1000).toISOString()
      return {
        id: n === 0 ? primaryId : `e2b${index}${n}000-0000-4000-8000-0000000b0${index}${n}`,
        avatar_id: avatarId,
        display_name: name,
        status: state,
        kind: n === 0 ? 'create' : 'look',
        is_primary: n === 0,
        storage_object_id: objectId,
        source_shot_id: n === 0 ? null : primaryId,
        appearance: {},
        prompt: null,
        background_mode: 'original',
        background_color: null,
        crop_box: null,
        workflow_id: null,
        failure_code: null,
        created_at: at,
        updated_at: at,
      }
    }
    const previewId = `f1c${index}0000-0000-4000-8000-00000000c00${index}`
    if (status === 'provisioning') {
      shots.push(shot(0, 'Ana görünüm', null, 'processing'))
    } else {
      shots.push(shot(0, 'Ana görünüm', previewId, 'completed'))
      avatarLooks(portrait).forEach(([name, url], look) => {
        const objectId = `f2d${index}${look + 1}000-0000-4000-8000-0000000d0${index}${look + 1}`
        MOCK_OBJECT_IMAGES.set(objectId, url)
        shots.push(shot(look + 1, name, objectId, 'completed'))
      })
    }
  }
  mockAvatarShots.set(avatarId, shots)
  return shots
}

/** A short name for a new shot from its brief ("Gün batımında şehir sokağında…" → "Gün batımında şehir"). */
function shotNameFromPrompt(prompt: string) {
  const words = prompt.replace(/[.,;:!?…]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3)
  if (words.length === 0) return 'Yeni görünüm'
  const name = words.join(' ')
  return name.charAt(0).toLocaleUpperCase('tr') + name.slice(1)
}

let mockShotSeq = 0

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/avatars\/([^/]+)\/shots$/,
    handler: (_request, match) => {
      const shots = shotsOfAvatar(decodeURIComponent(match[1] ?? ''))
      return { data: shots, meta: { total: shots.length, limit: 50, offset: 0, hasMore: false, nextCursor: null } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/avatars\/([^/]+)\/shots$/,
    handler: (request, match) => {
      const avatarId = decodeURIComponent(match[1] ?? '')
      const shots = shotsOfAvatar(avatarId)
      const body = (request.body ?? {}) as { prompt?: string; source_shot_id?: string; kind?: string }
      const done = shots.filter((shot) => shot.status === 'completed' && shot.storage_object_id)
      const source = done.find((shot) => shot.id === body.source_shot_id) ?? done[0]
      mockShotSeq += 1
      const at = new Date().toISOString()
      const created: MockAvatarShot = {
        id: `e9b${mockShotSeq}0000-0000-4000-8000-${String(mockShotSeq).padStart(12, '0')}`,
        avatar_id: avatarId,
        display_name: shotNameFromPrompt(body.prompt ?? ''),
        status: 'processing',
        kind: 'look',
        is_primary: false,
        storage_object_id: null,
        source_shot_id: source?.id ?? null,
        appearance: {},
        prompt: body.prompt ?? null,
        background_mode: 'original',
        background_color: null,
        crop_box: null,
        workflow_id: null,
        failure_code: null,
        created_at: at,
        updated_at: at,
      }
      shots.push(created)
      // The render takes a few seconds; the page polls while a shot is processing. The picture is one of the
      // person's own looks (the prototype has no generator).
      setTimeout(() => {
        const pool = done.map((shot) => shot.storage_object_id!).filter(Boolean)
        created.storage_object_id = pool[mockShotSeq % Math.max(1, pool.length)] ?? null
        created.status = created.storage_object_id ? 'completed' : 'failed'
        created.updated_at = new Date().toISOString()
      }, 6000)
      return { data: created }
    },
  },
  {
    // Credit estimates: an avatar image is 19 credits (9 on the fast model) per picture; other agents a fixed,
    // whole price by their node type.
    method: 'POST',
    path: /^\/api\/v1\/workflows\/agents\/estimate$/,
    handler: (request) => {
      const body = (request.body ?? {}) as { node_type?: string; params?: { model_id?: string; angles?: unknown[] } }
      const nodeType = body.node_type ?? ''
      let credits: number
      if (nodeType === 'angle@1') {
        const count = Array.isArray(body.params?.angles) ? Math.max(1, body.params.angles.length) : 1
        credits = (body.params?.model_id === 'angle-gpt-image-2.5-flare' ? 9 : 19) * count
      } else {
        credits = 8 + ([...nodeType].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9) * 5
      }
      return { data: { node_type: nodeType, total_credits_estimated: credits } }
    },
  },
)

// --- storage delivery URLs: every object resolves to a local placeholder image --------------------------------
function deliveryItem(objectId: string, variant: string) {
  return {
    object_id: objectId,
    status: 'ok',
    url: MOCK_OBJECT_IMAGES.get(objectId) ?? pickMockImage(objectId),
    expires_in_seconds: 3600,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    variant,
  }
}

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/storage\/channels\/[^/]+\/objects\/([^/]+)\/url$/,
    handler: (request, match) => {
      const { object_id: _objectId, status: _status, ...item } = deliveryItem(match[1], request.query.get('variant') ?? 'original')
      return { data: item }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/storage\/channels\/[^/]+\/objects\/delivery-urls$/,
    handler: (request) => {
      const items = ((request.body as { items?: Array<{ object_id: string; variant?: string }> } | undefined)?.items ?? [])
        .map((item) => deliveryItem(item.object_id, item.variant ?? 'original'))
      return { data: { items, succeeded_count: items.length, failed_count: 0 } }
    },
  },
)

// --- avatar recording sessions (the QR code / phone capture link of "Create human") -----------------------------
const RECORDING_TOKEN = 'rec_yt2demo7Hk2mQ9xPz4LwB8nTcV3sYdJf'

function recordingSession(overrides: Record<string, unknown> = {}) {
  const origin = typeof window === 'undefined' ? 'http://localhost:3100' : window.location.origin
  const recordingUrl = `${origin}/r/${RECORDING_TOKEN}`
  return {
    id: 'a7e5c0de-1234-4abc-9def-00000000c0de',
    token: RECORDING_TOKEN,
    recording_url: recordingUrl,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    qr_payload: recordingUrl,
    constraints: {
      width: 1920, height: 1080, fps: 30, min_duration_seconds: 8, max_duration_seconds: 60,
      consent_script: 'Ben, kendi görüntümün ve sesimin yapay zekâ avatarı oluşturmak için kullanılmasına izin veriyorum.',
      voice_min_duration_seconds: 10, voice_max_duration_seconds: 60, image_max_bytes: 10_000_000, voice_max_bytes: 20_000_000,
    },
    state: 'created',
    language: 'tr',
    consent_script: 'Ben, kendi görüntümün ve sesimin yapay zekâ avatarı oluşturmak için kullanılmasına izin veriyorum.',
    prompter_text: 'Merhaba, ben Deniz. Bugün size yeni ürünümüzü tanıtmak istiyorum. Kısa bir süre sonra videoda görüşürüz.',
    storage_object_id: null,
    channel_id: MOCK_CHANNELS[0].id,
    avatar_id: null,
    display_name: null,
    upload_session_id: null,
    recovery_required: false,
    token_generation: 1,
    auto_create_status: null,
    refund_status: 'none',
    auto_create_failure_code: null,
    capture_mode: 'photo_voice',
    steps: { identity_image: { state: 'pending' }, voice_sample: { state: 'pending' } },
    ...overrides,
  }
}

fixtures.push(
  { method: 'POST', path: /^\/api\/v1\/recording-sessions$/, handler: () => ({ data: recordingSession() }) },
  { method: 'GET', path: /^\/api\/v1\/recording-sessions\/[^/]+$/, handler: () => ({ data: recordingSession() }) },
  {
    method: 'PATCH',
    path: /^\/api\/v1\/recording-sessions\/[^/]+$/,
    handler: (request) => ({ data: recordingSession({ display_name: (request.body as { display_name?: string })?.display_name ?? null }) }),
  },
  { method: 'POST', path: /^\/api\/v1\/recording-sessions\/[^/]+\/rotate$/, handler: () => ({ data: recordingSession({ token_generation: 2 }) }) },
  { method: 'POST', path: /^\/api\/v1\/recording-sessions\/[^/]+\/revoke$/, handler: () => ({ data: recordingSession({ state: 'revoked' }) }) },
  { method: 'GET', path: /^\/api\/v1\/record\/[^/]+$/, handler: () => ({ data: recordingSession({ token: undefined, recording_url: undefined, qr_payload: null }) }) },
  { method: 'POST', path: /^\/api\/v1\/record\/[^/]+\/open$/, handler: () => ({ data: recordingSession({ state: 'opened', token: undefined, recording_url: undefined, qr_payload: null }) }) },
)

// --- Spark projects ------------------------------------------------------------------------------------------------
// A project made with "Yeni proje" keeps the name and format it was given, shows up in the list, and opens as
// itself; an id that is not a project is not found. The first channel (Yt-2 Studio) starts with a few sample
// projects. Projects made in this tab are kept in sessionStorage, so they are still there after a reload.
type MockSparkProject = {
  id: string
  channel_id: string
  title: string
  aspect_ratio: string
  visibility: 'private'
  schema_version: number
  lifecycle_state: 'active'
  cover_url?: string | null
  created_at: string
  updated_at: string
}

const SPARK_PROJECTS_KEY = 'yt2_mock_spark_projects'
const SPARK_SAMPLE_CHANNEL_ID = '6f1c2a3b-8d4e-4f5a-9b6c-1d2e3f4a5b6c'
// Sample projects already have scenes, so each carries a cover in its own ratio; new projects and the demo
// (still at its plan) have none and show the placeholder.
const SPARK_SAMPLES = [
  { ratio: '9:16', cover: '/spark/covers/summer-campaign.webp' },
  { ratio: '16:9', cover: '/spark/covers/product-launch.webp' },
  { ratio: '9:16', cover: '/spark/covers/podcast.webp' },
  { ratio: '1:1', cover: '/spark/covers/brand-story.webp' },
  { ratio: '16:9', cover: '/spark/covers/shorts-tips.webp' },
  { ratio: '9:16', cover: '/spark/covers/testimonials.webp' },
]

function sparkSampleProjects(): MockSparkProject[] {
  return SPARK_SAMPLES.map((sample, index) => {
    const at = new Date(Date.UTC(2026, 8, 28 - index * 3, 9, 30)).toISOString()
    return {
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      channel_id: SPARK_SAMPLE_CHANNEL_ID,
      title: MOCK_TITLES[index] ?? `Proje ${index + 1}`,
      aspect_ratio: sample.ratio,
      visibility: 'private',
      schema_version: 1,
      lifecycle_state: 'active',
      cover_url: sample.cover,
      created_at: at,
      updated_at: at,
    }
  })
}

function sparkCreatedProjects(): MockSparkProject[] {
  if (typeof window === 'undefined') return []
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(SPARK_PROJECTS_KEY) ?? '[]')
    return Array.isArray(stored) ? (stored as MockSparkProject[]) : []
  } catch {
    return []
  }
}

function sparkProjects() {
  // The demo chat's job works on its own Composition project, so "Spark'ta aç" opens it (see the demo section below).
  return [...sparkCreatedProjects(), demoSparkProject(), ...sparkSampleProjects()]
}

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/channels\/([^/]+)\/composition\/projects$/,
    handler: (request, match) => {
      const channelId = decodeURIComponent(match[1] ?? '')
      const projects = sparkProjects().filter((project) => project.channel_id === channelId)
      return { data: projects, meta: { limit: Number(request.query.get('limit')) || projects.length, next_cursor: null } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/channels\/([^/]+)\/composition\/projects$/,
    handler: (request, match) => {
      const body = (request.body ?? {}) as { title?: string; aspect_ratio?: string }
      const now = new Date().toISOString()
      const project: MockSparkProject = {
        id: crypto.randomUUID(),
        channel_id: decodeURIComponent(match[1] ?? ''),
        title: body.title?.trim() || 'Yeni proje',
        aspect_ratio: body.aspect_ratio ?? '16:9',
        visibility: 'private',
        schema_version: 1,
        lifecycle_state: 'active',
        created_at: now,
        updated_at: now,
      }
      try {
        window.sessionStorage.setItem(SPARK_PROJECTS_KEY, JSON.stringify([project, ...sparkCreatedProjects()]))
      } catch {
        // Without sessionStorage the project still opens once: the caller has it from this response.
      }
      return { data: project }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/composition\/projects\/([^/]+)$/,
    handler: (_request, match) => {
      const id = decodeURIComponent(match[1] ?? '')
      const project = sparkProjects().find((entry) => entry.id === id)
      if (!project) throw mockError(404, 'COMPOSITION_PROJECT_NOT_FOUND', 'Proje bulunamadı.')
      return { data: project }
    },
  },
)

// --- demo chat: a production plan that is ready and waits for approval ------------------------------------------
// "Balkabaklı risotto — 30 sn Reels" is the first chat of Yt-2 Studio (/chat?id=conv-demo-sales), the same video the
// Spark workspace scripts (`components/spark/lab/lab-model.ts`), so the chat and its Spark plan canvas tell one story.
// It starts where an agent asks before it plans: the request and one question ("Videoyu kim anlatsın?", answered from
// the question widget above the composer). The answer starts a short planning moment (status events, ~6 s, advanced
// lazily by the handlers the chat polls), then the job `job-demo-sales` presents a G1 production plan on the
// Composition project `proj-demo-sales`: the brief, the
// script (5 chapters), the shot plan (5 shots, each with a source and a price), the production plan with its estimate
// (~280–320 credits), the publish
// package, the spend meter and the receipt all describe the same video. A decision (G1 card, plan canvas or a written
// "tamam, devam et"), script edits, shot source changes and publish package edits are kept in memory for this tab, so a
// reload starts the demo again. Every other conversation, job and project keeps its generated data.

const DEMO = {
  conversationId: 'conv-demo-sales',
  jobId: 'job-demo-sales',
  projectId: 'proj-demo-sales',
  presentationId: 'pres-demo-sales',
  envelopeId: 'env-demo-sales',
  packageId: 'pkg-demo-sales',
  channelId: MOCK_CHANNELS[0].id,
} as const

const DEMO_ARTIFACT_IDS = {
  video_brief: 'art-demo-brief',
  script: 'art-demo-script',
  shot_plan: 'art-demo-shots',
  production_plan: 'art-demo-plan',
} as const

type DemoArtifactKind = keyof typeof DEMO_ARTIFACT_IDS
type DemoModality = 'ai_video' | 'ai_image' | 'youtorch_stock' | 'brand_motion' | 'typed_scene'
type DemoDecision = 'approve' | 'reject' | 'request_changes'

const DEMO_TITLE = 'Balkabaklı risotto — 30 sn Reels'
const DEMO_SCRIPT_TITLE = 'Balkabaklı risotto · Reels'
const DEMO_REQUEST = 'Ekim menüsündeki balkabaklı risottoyu tanıtan 30 saniyelik Reels yap.'
/** The question the agent asks before it plans (P03-23 B question: typed options, recommendation first). */
const DEMO_QUESTION = {
  text: 'Videoyu kim anlatsın?',
  options: [
    { option_id: 'chef', label: 'Şef Ece, kendi klibinden', value: 'chef', hint: 'Kütüphanedeki 0:42’lik klipten 9 saniye' },
    { option_id: 'voice', label: 'Dış ses', value: 'voice', hint: 'Marka sesiyle üretilir' },
    { option_id: 'none', label: 'Anlatım olmasın', value: 'none', hint: 'Yalnızca ekran metni ve müzik' },
  ],
  recommended: 'chef',
} as const
/** How long the agent "thinks" after the answer before the plan is ready, and when it moves on to planning. */
const DEMO_THINKING_MS = 6000
const DEMO_PLANNING_AT_MS = 2500

function demoReply(answer: string | null) {
  const narrator = answer ? `Anlatım: ${answer}. ` : ''
  return `Planı hazırladım: **30 saniyelik dikey (9:16) Reels**, 5 sahne. ${narrator}Planı sağda açtım; uygunsa orada **Bu planla üret**’e bas, değiştirmek istediğin bir şey varsa buraya yaz.`
}
const DEMO_VERIFY_QUESTION = 'Bu mesajı planın onayı olarak mı alayım? Onaylamak için “Bu planla üret” düğmesine bas ya da “tamam, devam et” yaz; bir şeyi değiştirmek istersen senaryoyu açıp düzenleyebilirsin.'
const DEMO_T0 = Date.now()
/** Credits the job already spent on the plan: planning 2 + script and plan 6. */
const DEMO_PREPARATION_CREDITS = 8
/** Voice-over 15–25, final render 35–45 and a 5–25 repair reserve on top of the shots' prices (point 20 + 40 + 15). */
const DEMO_EXTRA_CREDITS = { min: 55, point: 75, max: 95 }
const DEMO_ACTIVE_RUN_STATES = new Set<string>(['waiting_for_user', 'waiting_for_approval', 'running'])
// A written answer to the open plan: a "no" first (it may contain "onay"/"üret"), then a "yes"; anything else is asked back.
const DEMO_REJECT_WORDS = /(vazgeç|iptal|hayır|istemiyorum|üretme|başlatma|onaylamıyorum)/
const DEMO_APPROVE_WORDS = /(tamam|devam|onay|üret|evet|başlat)/

const DEMO_SCENES: ReadonlyArray<{
  title: string
  role: ScriptChapter['section_role']
  seconds: number
  narration: string
  onScreen: string
  /** What the viewer sees (the script panel's visual note). */
  visual: string
  /** The director's fuller description (the shot list row). */
  direction: string
  purpose: string
  modality: DemoModality
}> = [
  {
    title: 'Intro',
    role: 'intro',
    seconds: 2,
    narration: '',
    onScreen: 'Yt-2 Kafe',
    visual: 'Yt-2 Kafe logosu',
    direction: 'Sıcak tonlu arka planda Yt-2 Kafe logosu beliriyor.',
    purpose: 'brand',
    modality: 'brand_motion',
  },
  {
    title: 'Kanca',
    role: 'main',
    seconds: 5,
    narration: 'Sonbahar tabağa geldi.',
    onScreen: 'Sonbahar tabağa geldi',
    visual: 'Buharı tüten risotto tabağı, yakın çekim',
    direction: 'Tabağa son kaşık risotto konuyor; buhar yükselirken kamera yavaşça yaklaşıyor.',
    purpose: 'hook',
    modality: 'ai_video',
  },
  {
    title: 'Şef Ece',
    role: 'main',
    seconds: 9,
    narration: '“Balkabağını fırında karamelize ediyoruz, sonra risottoya katıyoruz.”',
    onScreen: 'Şef Ece',
    visual: 'Şef Ece mutfakta balkabağını karamelize ediyor',
    direction: 'Şef Ece fırından balkabağını çıkarıp tavadaki risottoya katıyor; alt bantta adı.',
    purpose: 'story',
    modality: 'ai_video',
  },
  {
    title: 'Tabak ve fiyat',
    role: 'main',
    seconds: 8,
    narration: 'Ekim boyunca menüde: balkabaklı risotto, 320 lira.',
    onScreen: 'Balkabaklı risotto · 320 TL · 4,7 ★ Google',
    visual: 'Masada servis edilmiş risotto, fiyat etiketi ve Google puanı',
    direction: 'Masada servis edilmiş tabak; fiyat etiketi ve 4,7 yıldızlı Google rozeti beliriyor.',
    purpose: 'offer',
    modality: 'ai_image',
  },
  {
    title: 'Kapanış',
    role: 'cta',
    seconds: 6,
    narration: 'Hafta sonu Moda’da görüşelim.',
    onScreen: 'Moda, Kadıköy · Hafta sonu 09:00–23:00',
    visual: 'Kafenin dış cephesi, adres ve saatler',
    direction: 'Kafenin dış cephesi; adres ve hafta sonu saatleri ile kapanış kartı.',
    purpose: 'cta',
    modality: 'brand_motion',
  },
]

const DEMO_DEFAULT_MODEL: Partial<Record<DemoModality, string>> = { ai_video: 'video-pro', ai_image: 'image-pro' }

const DEMO_SOURCE_ROUTES: Record<DemoModality, {
  label: string
  media: ScriptReviewShot['media_path']
  output: NonNullable<ScriptReviewShot['output_kind']>
  node?: { node_type: string; capability: string }
  reason: string
  category: PlanLineItem['category']
}> = {
  ai_video: { label: 'AI video', media: 'generate', output: 'video', node: { node_type: 'video_generate@1', capability: 'video_generate' }, reason: 'ai_video_scene_match', category: 'video' },
  ai_image: { label: 'AI görsel', media: 'generate', output: 'image', node: { node_type: 'image_generate@1', capability: 'image_generate' }, reason: 'ai_image_scene_match', category: 'image' },
  youtorch_stock: { label: 'Youtorch Stock', media: 'stock', output: 'video', reason: 'stock_license_match', category: 'stock' },
  brand_motion: { label: 'Motion şablonu', media: 'motion', output: 'video', reason: 'brand_motion_template_match', category: 'other' },
  typed_scene: { label: 'Tipli sahne', media: 'native', output: 'video', reason: 'typed_scene_match', category: 'other' },
}

/** "Kaynağı değiştir": every source a shot can take, best first (the current one is left out). */
const DEMO_SOURCE_CHOICES: ReadonlyArray<{ modality: DemoModality; modelId?: string; score: number }> = [
  { modality: 'ai_video', modelId: 'video-pro', score: 0.92 },
  { modality: 'ai_video', modelId: 'video-fast', score: 0.84 },
  { modality: 'youtorch_stock', score: 0.8 },
  { modality: 'ai_image', modelId: 'image-pro', score: 0.74 },
  { modality: 'brand_motion', score: 0.66 },
  { modality: 'typed_scene', score: 0.52 },
]

const DEMO_BRIEF: BriefHeader = {
  schema_version: 'video_brief_v1',
  title: DEMO_SCRIPT_TITLE,
  audience: '25–40 yaş, şehirde yaşayan, hafta sonu brunch’a çıkan genç profesyoneller',
  locale: 'tr',
  target_duration_seconds: 30,
  aspect_ratio: '9:16',
  output_goal: 'final_video',
  preferences: { media_profile: 'balanced' },
}

type DemoMessage = {
  id: string
  conversation_id: string
  run_id: string
  role: 'user' | 'assistant'
  content: string
  content_json: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
  deleted_at: null
}

type DemoEvent = {
  id: string
  run_id: string
  sequence: number
  event_type: string
  payload: Record<string, unknown>
  public: boolean
  transient: boolean
  created_at: string
}

type DemoState = {
  /** question → thinking (after the answer) → plan (presented; then decided as before). */
  phase: 'question' | 'thinking' | 'plan'
  answer: string | null
  thinkingSince: number | null
  /** Planning status events already sent during the thinking moment. */
  thinkingStage: number
  presentedAt: string | null
  runState: 'waiting_for_user' | 'waiting_for_approval' | 'running' | 'completed'
  presentation: {
    state: ProductionPlanPresentation['state']
    version: number
    approvedMax: number | null
    decided: { decision: DemoDecision; source: 'card' | 'chat_reply'; decided_at: string } | null
  }
  launch: { state: string; started: boolean }
  scriptRevision: number
  scriptHeader: ScriptHeader
  chapters: ScriptChapter[]
  shotPlanRevision: number
  shots: ScriptReviewShot[]
  planRevision: number
  estimateRevision: number
  publish: { revision: number; origin: 'agent' | 'user'; body: PublishPackageBody; createdAt: string }
  messages: DemoMessage[]
  events: DemoEvent[]
  archivedAt: string | null
  deletedAt: string | null
  /** Answers of mutations by idempotency key: a retry with the same key gets the recorded answer again. */
  replays: Map<string, unknown>
}

const demo = createDemoState()
pushDemoEvent('run.started', { state: 'running', conversation_id: DEMO.conversationId }, demoAt(1))
pushDemoEvent('assistant.status.updated', { stage: 'memory_context' }, demoAt(0.95))
pushDemoEvent('message.created', { message_id: 'msg-demo-sales-2', conversation_id: DEMO.conversationId }, demoAt(0.9))
pushDemoEvent('run.waiting_for_user', { state: 'waiting_for_user', waiting_reason: 'requirements_question' }, demoAt(0.9))

function createDemoState(): DemoState {
  const chapters = DEMO_SCENES.map((scene, index): ScriptChapter => ({
    chapter_id: `chapter-${index + 1}`,
    title: scene.title,
    section_role: scene.role,
    enabled: true,
    target_seconds: scene.seconds,
    estimated_seconds: scene.seconds,
    beats: [{
      beat_id: `beat-${index + 1}`,
      narration: scene.narration,
      summary: scene.visual,
      on_screen_texts: [{ text_id: `text-${index + 1}`, text: scene.onScreen, quoted: false }],
      claim_refs: [],
      estimated_seconds: scene.seconds,
      word_count: demoWordCount(scene.narration),
    }],
  }))
  const shots = DEMO_SCENES.map((scene, index) => demoShotWithSource({
    shot_id: `shot-${index + 1}`,
    order: index + 1,
    chapter_id: `chapter-${index + 1}`,
    beat_ids: [`beat-${index + 1}`],
    section_role: scene.role,
    visual_intent: scene.visual,
    media_path: 'generate',
    planned_seconds: scene.seconds,
    transition_in: index === 0 ? 'cut' : 'crossfade',
    prompt_detail: scene.direction,
    slot_kind: 'required',
    direction: { intent: { function: scene.purpose, description: scene.direction } },
  }, scene.modality))
  return {
    phase: 'question',
    answer: null,
    thinkingSince: null,
    thinkingStage: 0,
    presentedAt: null,
    runState: 'waiting_for_user',
    presentation: { state: 'presented', version: 1, approvedMax: null, decided: null },
    launch: { state: 'awaiting_decision', started: false },
    scriptRevision: 1,
    scriptHeader: {
      schema_version: 'script_artifact_v1',
      result_kind: 'full',
      title: DEMO_SCRIPT_TITLE,
      language: 'tr',
      angle: 'Sonbaharın tadını şefin elinden anlatan sıcak bir Reels: buharı tüten bir tabakla açılış, şefin dokunuşu, fiyat ve hafta sonu daveti.',
      hook: {
        options: [
          { hook_id: 'hook-1', text: 'Sonbahar tabağa geldi.' },
          { hook_id: 'hook-2', text: 'Ekim’in en sıcak tabağı Moda’da.' },
          { hook_id: 'hook-3', text: 'Şef Ece’nin sonbahar sırrı: karamelize balkabağı.' },
        ],
        selected_hook_id: 'hook-1',
      },
      purpose: 'Ekim menüsünün yıldızını tanıtmak, hafta sonu masalarını doldurmak.',
      key_message: 'Sonbaharın tadı Moda’da: şefin elinden balkabaklı risotto.',
      narrative_flow: 'Intro (logo) → Kanca: tabak → Şef Ece: hazırlık → Tabak ve fiyat → Kapanış: hafta sonu daveti.',
      totals: demoScriptTotals(chapters),
    },
    chapters,
    shotPlanRevision: 1,
    shots,
    planRevision: 1,
    estimateRevision: 1,
    publish: {
      revision: 1,
      origin: 'agent',
      createdAt: demoAt(2),
      body: {
        schema_version: 'publish_package_v1',
        language: 'tr',
        basis: { kind: 'script' },
        titles: {
          options: [
            { title_id: 'title-1', text: 'Sonbahar tabağa geldi: balkabaklı risotto' },
            { title_id: 'title-2', text: 'Şef Ece’nin Ekim tabağı Moda’da' },
            { title_id: 'title-3', text: 'Balkabaklı risotto · 320 TL · Yt-2 Kafe' },
          ],
          selected_title_id: 'title-1',
        },
        description: 'Ekim boyunca menüde: Şef Ece’nin fırında karamelize balkabağıyla hazırladığı risotto, 320 TL. Hafta sonu 09:00–23:00 Moda’da görüşelim.',
        tags: ['risotto', 'sonbahar menüsü', 'moda', 'reels'],
        thumbnail: {
          source: 'engine_frame',
          reason: 'Kanca karesi tabağı en net gösteren an.',
          title_text: 'Sonbahar tabağa geldi',
          frame: { scene_id: 'shot-1', at_seconds: 2 },
          cost: { status: 'free' },
        },
      },
    },
    messages: [
      demoMessage('msg-demo-sales-1', 'user', DEMO_REQUEST, demoAt(1)),
      {
        ...demoMessage('msg-demo-sales-2', 'assistant', DEMO_QUESTION.text, demoAt(0.9)),
        content_json: {
          type: 'assistant.requirements_question',
          waiting_reason: 'requirements_question',
          question: {
            schema_version: 'assistant_interaction_question_v1',
            field_key: 'narrator',
            kind: 'choice',
            options: DEMO_QUESTION.options,
            recommended_option_id: DEMO_QUESTION.recommended,
          },
        },
      },
    ],
    events: [],
    archivedAt: null,
    deletedAt: null,
    replays: new Map(),
  }
}

function demoAt(minutesAgo: number) {
  return new Date(DEMO_T0 - minutesAgo * 60_000).toISOString()
}

function demoWordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length
}

/** A stable 64-hex "sha256" for mock content (FNV-1a rounds; only its shape matters). */
function demoDigest(seed: string) {
  let hex = ''
  let hash = 2166136261
  for (let round = 0; hex.length < 64; round += 1) {
    const text = `${seed}#${round}`
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hex += (hash >>> 0).toString(16).padStart(8, '0')
  }
  return hex
}

function demoMessage(id: string, role: DemoMessage['role'], content: string, at: string): DemoMessage {
  return { id, conversation_id: DEMO.conversationId, run_id: DEMO.jobId, role, content, content_json: {}, status: 'completed', created_at: at, updated_at: at, deleted_at: null }
}

function addDemoMessage(role: DemoMessage['role'], content: string) {
  const message = demoMessage(`msg-demo-sales-${demo.messages.length + 1}`, role, content, new Date().toISOString())
  demo.messages.push(message)
  return message
}

function pushDemoEvent(eventType: string, payload: Record<string, unknown>, at = new Date().toISOString()) {
  const sequence = demo.events.length + 1
  const event: DemoEvent = { id: `evt-demo-sales-${sequence}`, run_id: DEMO.jobId, sequence, event_type: eventType, payload, public: true, transient: false, created_at: at }
  demo.events.push(event)
  // Live, like the server's run stream: the chat's open stream of this run hears it at once.
  publishMockStreamEvent((url) => url.includes(`/runs/${DEMO.jobId}/stream`), 'run_event', event)
  return event
}

function demoRequestPath(request: MockRequest) {
  const query = request.query.toString()
  return query ? `${request.path}?${query}` : request.path
}

function demoIdempotencyKey(body: unknown, scope: string) {
  const key = (body as { idempotency_key?: unknown } | undefined)?.idempotency_key
  return typeof key === 'string' && key ? `${scope}:${key}` : null
}

function demoSparkProject(): MockSparkProject {
  return {
    id: DEMO.projectId,
    channel_id: DEMO.channelId,
    title: DEMO_SCRIPT_TITLE,
    aspect_ratio: '9:16',
    visibility: 'private',
    schema_version: 1,
    lifecycle_state: 'active',
    created_at: demoAt(6),
    updated_at: demoAt(2),
  }
}

// ---- script, shots, plan

function demoScriptTotals(chapters: readonly ScriptChapter[]): ScriptHeader['totals'] {
  const enabled = chapters.filter((chapter) => chapter.enabled)
  return {
    estimated_seconds: enabled.reduce((total, chapter) => total + chapter.estimated_seconds, 0),
    word_count: enabled.reduce((total, chapter) => total + chapter.beats.reduce((sum, beat) => sum + beat.word_count, 0), 0),
    speech_rate_wpm: 120,
    rate_basis: 'assumed',
  }
}

/** The server's price of a source for one shot (whole fives); a typed scene is free. */
function demoSourcePrice(modality: DemoModality, modelId: string | undefined, seconds: number) {
  switch (modality) {
    case 'ai_video':
      return Math.round((seconds * (modelId === 'video-fast' ? 7 : 13.5)) / 5) * 5
    case 'ai_image':
      return 15
    case 'youtorch_stock':
      return 30
    case 'brand_motion':
      return 10
    case 'typed_scene':
      return 0
  }
}

/** The shot with the director's pinned source (the `Kaynak` chip), its media path, model and price. */
function demoShotWithSource(shot: ScriptReviewShot, modality: DemoModality, modelId = DEMO_DEFAULT_MODEL[modality]): ScriptReviewShot {
  const route = DEMO_SOURCE_ROUTES[modality]
  const credits = demoSourcePrice(modality, modelId, shot.planned_seconds)
  const next: ScriptReviewShot = {
    ...shot,
    media_path: route.media,
    output_kind: route.output,
    direction: {
      intent: shot.direction?.intent ?? { function: 'scene', description: shot.visual_intent },
      selection: {
        modality,
        ...(modelId ? { model_id: modelId } : {}),
        selection_source: 'product_default',
        reason: route.reason,
        cost: credits > 0 ? { status: 'priced', credits } : { status: 'free' },
      },
    },
  }
  if (route.node) {
    next.capability = { ...route.node, ...(modelId ? { model_id: modelId } : {}) }
    next.generated_seconds = shot.planned_seconds
    next.generation_parts = 1
  } else {
    delete next.capability
    delete next.generated_seconds
    delete next.generation_parts
  }
  return next
}

function demoModality(shot: ScriptReviewShot): DemoModality {
  const modality = shot.direction?.selection?.modality
  return modality && modality in DEMO_SOURCE_ROUTES ? (modality as DemoModality) : 'typed_scene'
}

function demoShotCredits(shot: ScriptReviewShot) {
  return shot.direction?.selection?.cost.credits ?? 0
}

/** The plan's estimate: the shots' prices plus voice-over, final render and repair reserve (300 → ~280–320 at first). */
function demoEstimate() {
  const shots = demo.shots.reduce((total, shot) => total + demoShotCredits(shot), 0)
  return { min: shots + DEMO_EXTRA_CREDITS.min, point: shots + DEMO_EXTRA_CREDITS.point, max: shots + DEMO_EXTRA_CREDITS.max }
}

function demoLineItems(): PlanLineItem[] {
  const groups = new Map<PlanLineItem['category'], ScriptReviewShot[]>()
  for (const shot of demo.shots) {
    const category = DEMO_SOURCE_ROUTES[demoModality(shot)].category
    groups.set(category, [...(groups.get(category) ?? []), shot])
  }
  const shotItems = [...groups.entries()].map(([category, shots]): PlanLineItem => {
    const credits = shots.reduce((total, shot) => total + demoShotCredits(shot), 0)
    return {
      item_id: `line-${category}`,
      category,
      operation_count: shots.length,
      output_count: shots.length,
      units_seconds: shots.reduce((total, shot) => total + shot.planned_seconds, 0),
      credits_min: credits,
      credits_max: credits,
      shot_ids: shots.map((shot) => shot.shot_id),
    }
  })
  return [
    ...shotItems,
    {
      item_id: 'line-voice',
      category: 'voice',
      operation_count: 1,
      output_count: 1,
      units_seconds: demoScriptTotals(demo.chapters).estimated_seconds,
      credits_min: 15,
      credits_max: 25,
      capability: { node_type: 'speech_generate@1', capability: 'speech_generate', model_id: 'speech-natural' },
    },
    { item_id: 'line-render', category: 'render', operation_count: 1, output_count: 1, credits_min: 35, credits_max: 45 },
    { item_id: 'line-repair', category: 'repair', operation_count: 1, credits_min: 5, credits_max: 25 },
  ]
}

function demoArtifactRevision(kind: DemoArtifactKind) {
  switch (kind) {
    case 'video_brief':
      return 1
    case 'script':
      return demo.scriptRevision
    case 'shot_plan':
      return demo.shotPlanRevision
    case 'production_plan':
      return demo.planRevision
  }
}

function demoArtifactDigest(kind: DemoArtifactKind, revision = demoArtifactRevision(kind)) {
  return demoDigest(`${DEMO.projectId}:${kind}:${revision}`)
}

function demoPlanRef(): ProductionPlanPresentation['plan_ref'] {
  return {
    artifact_kind: 'production_plan',
    artifact_id: DEMO_ARTIFACT_IDS.production_plan,
    artifact_revision: demo.planRevision,
    content_digest_sha256: demoArtifactDigest('production_plan'),
  }
}

function demoFingerprint() {
  return demoDigest(`g1:${demo.planRevision}:${demo.estimateRevision}`)
}

function demoPlanHeader(): PlanHeader {
  const estimate = demoEstimate()
  return {
    schema_version: 'production_plan_v1',
    estimate: {
      status: 'valid',
      min_credits: estimate.min,
      max_credits: estimate.max,
      point_credits: estimate.point,
      preparation_spent_credits: DEMO_PREPARATION_CREDITS,
      includes_final_render: true,
      line_items: demoLineItems(),
    },
    budget_policy: { approved_max_credits: demo.presentation.approvedMax },
    bindings: [
      { role: 'voice', target: { scope: 'global' }, resource: { owner_bc: 'voice', resource_kind: 'voice_profile', resource_id: 'voice-demo-ece', resource_revision: '1' }, selection_source: 'channel_default' },
      { role: 'avatar', target: { scope: 'global' }, resource: null, selection_source: 'job_selection' },
      { role: 'kit', target: { scope: 'global' }, resource: { owner_bc: 'brand', resource_kind: 'brand_kit', resource_id: 'kit-yt2-studio' }, selection_source: 'channel_default' },
    ],
  }
}

function demoSummary(): ProductionPlanSummary {
  const estimate = demoEstimate()
  const enabled = demo.chapters.filter((chapter) => chapter.enabled)
  const shotsOf = (...modalities: DemoModality[]) => demo.shots.filter((shot) => modalities.includes(demoModality(shot)))
  const artifactKinds: DemoArtifactKind[] = ['video_brief', 'script', 'shot_plan', 'production_plan']
  return {
    schema_version: 'production_plan_summary_v1',
    project_id: DEMO.projectId,
    job_id: DEMO.jobId,
    plan: { artifact_ref: demoPlanRef(), readiness: 'ready', g1_fingerprint_sha256: demoFingerprint(), output_goal: 'final_video' },
    artifacts: artifactKinds.map((kind): ProductionPlanSummary['artifacts'][number] => ({
      artifact_kind: kind,
      artifact_id: DEMO_ARTIFACT_IDS[kind],
      head_revision: demoArtifactRevision(kind),
      head_digest_sha256: demoArtifactDigest(kind),
      head_readiness: 'ready',
      // The plan follows the script/shot edits of this demo (it re-pins them), so nothing reads stale.
      pinned_revision: demoArtifactRevision(kind),
      stale: false,
    })),
    counts: {
      target_seconds: DEMO_BRIEF.target_duration_seconds,
      planned_seconds: demo.shots.reduce((total, shot) => total + shot.planned_seconds, 0),
      chapters_total: demo.chapters.length,
      chapters_enabled: enabled.length,
      chapters_with_full_narration: enabled.filter((chapter) => chapter.beats.every((beat) => beat.narration.trim().length > 0)).length,
      beats_total: demo.chapters.reduce((total, chapter) => total + chapter.beats.length, 0),
      shots_total: demo.shots.length,
      new_image_outputs: shotsOf('ai_image').length,
      new_video_outputs: shotsOf('ai_video').length,
      new_audio_outputs: 1,
      reused_unique_assets: shotsOf('youtorch_stock', 'brand_motion').length,
      generated_seconds: shotsOf('ai_video').reduce((total, shot) => total + shot.planned_seconds, 0),
    },
    estimate_box: {
      status: 'valid',
      estimate_revision: demo.estimateRevision,
      point_credits: estimate.point,
      min_credits: estimate.min,
      max_credits: estimate.max,
      approved_max_credits: demo.presentation.approvedMax,
      includes_final_render: true,
      expires_at: new Date(DEMO_T0 + 24 * 3600 * 1000).toISOString(),
    },
    issues: [],
  }
}

function demoArtifactItems(kind: DemoArtifactKind, section: string): unknown[] {
  if (section === 'header') {
    switch (kind) {
      case 'video_brief':
        return [DEMO_BRIEF]
      case 'script':
        return [demo.scriptHeader]
      case 'shot_plan':
        return [{
          schema_version: 'shot_plan_v1',
          script_ref: { artifact_kind: 'script', artifact_id: DEMO_ARTIFACT_IDS.script, artifact_revision: demo.scriptRevision, content_digest_sha256: demoArtifactDigest('script') },
          asset_inventory: [],
          production_mode: 'final',
        }]
      case 'production_plan':
        return [demoPlanHeader()]
    }
  }
  if (section === 'chapters' && kind === 'script') return demo.chapters
  if (section === 'shots' && kind === 'shot_plan') return demo.shots
  return []
}

function demoSourceAlternatives(shot: ScriptReviewShot) {
  const current = shot.direction?.selection
  return DEMO_SOURCE_CHOICES
    .filter((choice) => !(choice.modality === current?.modality && (choice.modelId ?? null) === (current?.model_id ?? null)))
    .map((choice) => ({
      modality: choice.modality,
      label: choice.modelId ? `${DEMO_SOURCE_ROUTES[choice.modality].label} · ${choice.modelId}` : DEMO_SOURCE_ROUTES[choice.modality].label,
      ...(choice.modelId ? { model_id: choice.modelId } : {}),
      credits: demoSourcePrice(choice.modality, choice.modelId, shot.planned_seconds),
      score: choice.score,
    }))
}

function patchDemoScript(body: unknown) {
  const request = (body ?? {}) as { expected_revision?: unknown; ops?: unknown }
  if (request.expected_revision !== demo.scriptRevision) {
    throw mockError(409, 'COMPOSITION_PREPARATION_REVISION_CONFLICT', 'Senaryo başka bir yerde değişti.')
  }
  const ops = Array.isArray(request.ops) ? (request.ops as ScriptPatchOp[]) : []
  const header = structuredClone(demo.scriptHeader)
  const chapters = structuredClone(demo.chapters)
  const changedChapters = new Set<string>()
  const changedBeats = new Set<string>()
  let headerChanged = false
  let timingChanged = false
  const invalid = () => mockError(422, 'COMPOSITION_SCRIPT_PATCH_INVALID', 'Bu değişiklik senaryoya uygulanamadı.')
  const text = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) throw invalid()
    return value
  }
  const chapterOf = (chapterId: string) => chapters.find((chapter) => chapter.chapter_id === chapterId) ?? null
  const beatOf = (beatId: string) => {
    for (const chapter of chapters) {
      const beat = chapter.beats.find((entry) => entry.beat_id === beatId)
      if (beat) return { chapter, beat }
    }
    throw invalid()
  }
  for (const op of ops) {
    switch (op.op) {
      case 'set_title':
        header.title = text(op.title)
        headerChanged = true
        break
      case 'set_text_field':
        header[op.field] = text(op.value)
        headerChanged = true
        break
      case 'select_hook':
        if (!header.hook.options.some((option) => option.hook_id === op.hook_id)) throw invalid()
        header.hook.selected_hook_id = op.hook_id
        headerChanged = true
        break
      case 'set_hook_text': {
        const option = header.hook.options.find((entry) => entry.hook_id === op.hook_id)
        if (!option) throw invalid()
        option.text = text(op.text)
        headerChanged = true
        break
      }
      case 'set_chapter_title': {
        const chapter = chapterOf(op.chapter_id)
        if (!chapter) throw invalid()
        chapter.title = text(op.title)
        changedChapters.add(chapter.chapter_id)
        break
      }
      case 'set_chapter_enabled': {
        const chapter = chapterOf(op.chapter_id)
        if (!chapter) throw invalid()
        chapter.enabled = Boolean(op.enabled)
        changedChapters.add(chapter.chapter_id)
        timingChanged = true
        break
      }
      case 'set_beat_narration': {
        const { chapter, beat } = beatOf(op.beat_id)
        beat.narration = text(op.narration)
        beat.word_count = demoWordCount(beat.narration)
        changedChapters.add(chapter.chapter_id)
        changedBeats.add(beat.beat_id)
        break
      }
      case 'set_on_screen_text': {
        const { chapter, beat } = beatOf(op.beat_id)
        const item = beat.on_screen_texts.find((entry) => entry.text_id === op.text_id)
        if (!item) throw invalid()
        item.text = text(op.text)
        changedChapters.add(chapter.chapter_id)
        changedBeats.add(beat.beat_id)
        break
      }
      default:
        throw invalid()
    }
  }
  const changed = ops.length > 0
  if (changed) {
    header.totals = demoScriptTotals(chapters)
    demo.scriptHeader = header
    demo.chapters = chapters
    demo.scriptRevision += 1
  }
  return {
    data: {
      outcome: changed ? 'created' : 'unchanged',
      revision: { artifact_id: DEMO_ARTIFACT_IDS.script, revision: demo.scriptRevision, content_digest_sha256: demoArtifactDigest('script'), readiness: 'ready' },
      impact: {
        header_changed: headerChanged,
        changed_chapter_ids: [...changedChapters],
        changed_beat_ids: [...changedBeats],
        timing_changed: timingChanged,
        // Text edits of this demo keep the plan and its estimate (the mock re-pins the script).
        estimate_affected: false,
      },
      script: { header: demo.scriptHeader, chapters: demo.chapters },
    },
  }
}

function changeDemoShotSource(shotId: string, body: unknown) {
  const request = (body ?? {}) as { expected_revision?: unknown; modality?: unknown; model_id?: unknown }
  const index = demo.shots.findIndex((shot) => shot.shot_id === shotId)
  if (index < 0) throw mockError(404, 'COMPOSITION_SHOT_NOT_FOUND', 'Çekim bulunamadı.')
  if (demo.presentation.state !== 'presented') throw mockError(409, 'COMPOSITION_SHOT_PLAN_LOCKED', 'Plan onaylandı; çekimler artık değiştirilemez.')
  if (request.expected_revision !== demo.shotPlanRevision) throw mockError(409, 'COMPOSITION_SHOT_PLAN_REVISION_CONFLICT', 'Çekim planı başka bir yerde değişti.')
  const modality = typeof request.modality === 'string' && request.modality in DEMO_SOURCE_ROUTES ? (request.modality as DemoModality) : null
  if (!modality) throw mockError(422, 'COMPOSITION_SHOT_SOURCE_INVALID', 'Bu kaynak bu çekim için kullanılamıyor.')
  const before = demo.shots[index]
  const after = demoShotWithSource(before, modality, typeof request.model_id === 'string' ? request.model_id : undefined)
  demo.shots = demo.shots.map((shot, position) => (position === index ? after : shot))
  // The mock recompiles at once: a new shot plan, plan and estimate revision, re-presented for the same G1 decision.
  demo.shotPlanRevision += 1
  demo.planRevision += 1
  demo.estimateRevision += 1
  demo.presentation.version += 1
  pushDemoEvent('assistant.production_plan.presented', { presentation_id: DEMO.presentationId, plan_revision: demo.planRevision })
  const cost = (shot: ScriptReviewShot) => {
    const value = shot.direction?.selection?.cost
    return value ? { status: value.status, ...(value.credits !== undefined ? { credits: value.credits } : {}) } : null
  }
  return {
    data: {
      revision: demo.shotPlanRevision,
      outcome: 'created',
      estimate_delta: { shot_id: shotId, before: cost(before), after: cost(after), plan_recompile_required: false },
    },
  }
}

// ---- G1 decision, run, transcript

function demoPresentation(): ProductionPlanPresentation {
  const estimate = demoEstimate()
  const { state, version, approvedMax, decided } = demo.presentation
  return {
    schema_version: 'production_plan_presentation_v1',
    presentation_id: DEMO.presentationId,
    job_id: DEMO.jobId,
    plan_ref: demoPlanRef(),
    g1_fingerprint_sha256: demoFingerprint(),
    estimate: { estimate_revision: demo.estimateRevision, min_credits: estimate.min, max_credits: estimate.max, point_credits: estimate.point },
    approved_max_credits: approvedMax,
    state,
    version,
    presented_at: demo.presentedAt ?? new Date().toISOString(),
    expires_at: new Date(DEMO_T0 + 24 * 3600 * 1000).toISOString(),
    ...(decided ? { decided } : {}),
  }
}

function demoLaunch() {
  return { state: demo.launch.state, started: demo.launch.started }
}

function demoStages(): VideoProductionProgress['stages'] {
  const presentation = demo.presentation.state
  const approved = presentation === 'approved'
  const open = presentation === 'presented'
  const later = approved || open ? 'pending' : 'skipped'
  const chapters = demo.chapters.filter((chapter) => chapter.enabled).length
  // New outputs: the generated shots and the voice-over.
  const outputs = demo.shots.filter((shot) => DEMO_SOURCE_ROUTES[demoModality(shot)].node).length + 1
  return [
    { step_id: 'brief', status: 'completed' },
    { step_id: 'research', status: 'skipped' },
    { step_id: 'script', status: 'completed', counters: { completed: chapters, total: chapters, unit: 'chapters' } },
    { step_id: 'plan', status: 'completed', counters: { completed: demo.shots.length, total: demo.shots.length, unit: 'shots' } },
    { step_id: 'approval', status: approved ? 'completed' : open ? 'waiting' : 'skipped' },
    approved
      ? { step_id: 'audio_media', status: 'running', counters: { completed: 0, total: outputs, unit: 'outputs' } }
      : { step_id: 'audio_media', status: later },
    { step_id: 'apply_qc', status: later },
    { step_id: 'preview', status: later },
    { step_id: 'render', status: later },
  ]
}

function demoLaunchState() {
  if (demo.phase !== 'plan') {
    // Before the plan: the request is being understood; nothing to open yet (no project, no presentation).
    const thinking = demo.phase === 'thinking'
    const progress: VideoProductionProgress = {
      schema_version: 'video_production_progress_v1',
      job_id: DEMO.jobId,
      job_status: demo.runState,
      plan_ref: null,
      stages: [
        { step_id: 'brief', status: thinking ? 'completed' : 'running' },
        { step_id: 'research', status: 'skipped' },
        { step_id: 'script', status: thinking ? 'running' : 'pending' },
        { step_id: 'plan', status: 'pending' },
        { step_id: 'approval', status: 'pending' },
        { step_id: 'audio_media', status: 'pending' },
        { step_id: 'apply_qc', status: 'pending' },
        { step_id: 'preview', status: 'pending' },
        { step_id: 'render', status: 'pending' },
      ],
      attention: [],
      launch: { state: 'preparing', started: false },
    } as unknown as VideoProductionProgress
    return { data: { progress, presentation: null, intent: null } }
  }
  const progress: VideoProductionProgress = {
    schema_version: 'video_production_progress_v1',
    job_id: DEMO.jobId,
    job_status: demo.runState,
    plan_ref: demoPlanRef(),
    stages: demoStages(),
    attention: [],
    launch: { ...demoLaunch(), presentation_id: DEMO.presentationId },
    // The script panel and the job's cards find the Composition project here (`jobProjectIdFromProgress`).
    project_id: DEMO.projectId,
  }
  return { data: { progress, presentation: demoPresentation(), intent: null } }
}

/** Records the one G1 decision of the presented plan; the same decision again is a replay, another one a conflict. */
function decideDemoPlan(decision: DemoDecision, source: 'card' | 'chat_reply', echo?: string): 'accepted' | 'replayed' {
  const presentation = demo.presentation
  if (presentation.decided?.decision === decision) return 'replayed'
  if (presentation.state !== 'presented') throw mockError(409, 'PRODUCTION_PLAN_PRESENTATION_CLOSED', 'Bu plan artık onay beklemiyor.')
  const at = new Date().toISOString()
  presentation.decided = { decision, source, decided_at: at }
  presentation.version += 1
  if (decision === 'approve') {
    presentation.state = 'approved'
    presentation.approvedMax = demoEstimate().max
    demo.launch = { state: 'producing', started: true }
    demo.runState = 'running'
  } else if (decision === 'reject') {
    presentation.state = 'rejected'
    demo.launch = { state: 'rejected', started: false }
    demo.runState = 'completed'
  } else {
    presentation.state = 'changes_requested'
    demo.launch = { state: 'changes_requested', started: false }
    demo.runState = 'running'
  }
  pushDemoEvent('assistant.production_plan.decided', { presentation_id: DEMO.presentationId, decision, source, ...(echo ? { reply: { echo } } : {}) }, at)
  if (decision === 'approve') pushDemoEvent('assistant.production_launch.started', { presentation_id: DEMO.presentationId, launch_state: 'producing' }, at)
  if (demo.runState === 'completed') pushDemoEvent('run.completed', { state: 'completed' }, at)
  return 'accepted'
}

function demoConversation() {
  const lastMessageAt = demo.messages.at(-1)?.created_at ?? demoAt(2)
  return {
    id: DEMO.conversationId,
    user_id: MOCK_TENANT.id,
    title: DEMO_TITLE,
    status: demo.archivedAt ? 'archived' : 'active',
    metadata: {},
    last_message_at: lastMessageAt,
    archived_at: demo.archivedAt,
    deleted_at: demo.deletedAt,
    version: demo.messages.length + demo.events.length,
    created_at: demoAt(6),
    updated_at: lastMessageAt,
  }
}

function demoRun() {
  const updatedAt = demo.events.at(-1)?.created_at ?? demoAt(2)
  return {
    id: DEMO.jobId,
    conversation_id: DEMO.conversationId,
    trigger_message_id: 'msg-demo-sales-1',
    state: demo.runState,
    model_id: null,
    planner_version: null,
    metadata: {},
    error_code: null,
    error_message: null,
    started_at: demoAt(6),
    completed_at: demo.runState === 'completed' ? updatedAt : null,
    failed_at: null,
    cancelled_at: null,
    version: demo.events.length,
    created_at: demoAt(6),
    updated_at: updatedAt,
  }
}

/**
 * A message in the demo chat. While the plan is presented it is the written G1 answer (P03-09): "tamam, devam et"
 * approves, "vazgeç" rejects, anything else is asked back; the job's card shows the echo or the question from the run
 * events. After the decision it is an ordinary message of the same job.
 */
function addDemoChatMessage(body: unknown) {
  const content = typeof (body as { content?: unknown } | undefined)?.content === 'string' ? (body as { content: string }).content.trim() : ''
  if (!content) throw mockError(422, 'ASSISTANT_MESSAGE_EMPTY', 'Mesaj boş olamaz.')
  const message = addDemoMessage('user', content)
  const created = () => pushDemoEvent('message.created', { message_id: message.id, conversation_id: DEMO.conversationId })
  if (demo.phase === 'question') {
    // The answer to the question: the agent reads it with the channel's memory and plans (see `advanceDemo`).
    demo.answer = content
    demo.phase = 'thinking'
    demo.thinkingSince = Date.now()
    demo.thinkingStage = 0
    demo.runState = 'running'
    const event = created()
    pushDemoEvent('run.running', { state: 'running' })
    pushDemoEvent('assistant.status.updated', { stage: 'memory_context' })
    // The moment goes on by itself (the handlers also advance it when polled).
    if (typeof window !== 'undefined') {
      window.setTimeout(advanceDemo, DEMO_PLANNING_AT_MS + 20)
      window.setTimeout(advanceDemo, DEMO_THINKING_MS + 20)
    }
    return { data: { message, run: demoRun(), event, outbox_event: { id: `outbox-demo-sales-${event.sequence}`, status: 'published' }, replayed: false } }
  }
  if (demo.phase === 'plan' && demo.presentation.state === 'presented') {
    const text = content.toLocaleLowerCase('tr')
    const decision: DemoDecision | null = DEMO_REJECT_WORDS.test(text) ? 'reject' : DEMO_APPROVE_WORDS.test(text) ? 'approve' : null
    if (decision) {
      const echo = decision === 'approve'
        ? `Onayın alındı: Plan v${demo.planRevision} ile üretim başlıyor (en fazla ${demoEstimate().max} kredi).`
        : 'Tamam, bu planla üretmiyorum. Ne değişsin istersen yaz, planı yeniden hazırlayayım.'
      const outcome = decideDemoPlan(decision, 'chat_reply', echo)
      created()
      return { data: { kind: 'production_g1_reply', result: { kind: 'bound', decision: { outcome, presentation: demoPresentation(), launch: demoLaunch() }, echo } } }
    }
    pushDemoEvent('assistant.production_plan.verification_required', { presentation_id: DEMO.presentationId, question: DEMO_VERIFY_QUESTION })
    created()
    return { data: { kind: 'production_g1_reply', result: { kind: 'verify', question: DEMO_VERIFY_QUESTION, presentation_ids: [DEMO.presentationId] } } }
  }
  const event = created()
  return { data: { message, run: demoRun(), event, outbox_event: { id: `outbox-demo-sales-${event.sequence}`, status: 'published' }, replayed: false } }
}

/** Moves the thinking moment on by the clock: planning after a moment, then the plan (called by the polled handlers). */
function advanceDemo() {
  if (demo.phase !== 'thinking' || demo.thinkingSince === null) return
  const elapsed = Date.now() - demo.thinkingSince
  if (elapsed >= DEMO_PLANNING_AT_MS && demo.thinkingStage < 1) {
    demo.thinkingStage = 1
    pushDemoEvent('assistant.status.updated', { stage: 'planning' })
  }
  if (elapsed < DEMO_THINKING_MS) return
  const at = new Date().toISOString()
  demo.phase = 'plan'
  demo.presentedAt = at
  demo.runState = 'waiting_for_approval'
  pushDemoEvent('assistant.production_progress.updated', { step_id: 'script', status: 'completed' }, at)
  pushDemoEvent('assistant.production_plan.presented', { presentation_id: DEMO.presentationId, plan_revision: 1 }, at)
  const reply = addDemoMessage('assistant', demoReply(demo.answer))
  pushDemoEvent('message.created', { message_id: reply.id, conversation_id: DEMO.conversationId }, at)
  pushDemoEvent('run.waiting_for_approval', { state: 'waiting_for_approval', waiting_reason: 'production_plan_approval' }, at)
}

// ---- spend, publish package

function demoSpendJob() {
  // Before the plan nothing waits for approval: the job is still being prepared.
  const presented = demo.phase === 'plan' && demo.presentation.state === 'presented'
  const approved = demo.presentation.state === 'approved'
  const ceiling = demo.presentation.approvedMax
  return {
    job_id: DEMO.jobId,
    run_id: DEMO.jobId,
    envelope_id: DEMO.envelopeId,
    envelope_status: presented || approved ? 'open' : 'closed',
    phase: approved ? 'production' : presented ? 'preparation' : 'none',
    mode: 'ask',
    basis: 'production_plan',
    approved_ceiling_credits: ceiling,
    spent_credits: DEMO_PREPARATION_CREDITS,
    outstanding_credits: 0,
    remaining_credits: ceiling === null ? 0 : ceiling - DEMO_PREPARATION_CREDITS,
    overrun_credits: 0,
    state: presented ? 'awaiting_approval' : approved ? 'within_ceiling' : 'closed',
    pending_approval: presented
      ? { requested_max_credits: demoEstimate().max, trigger: 'production_plan', asked_in_mode: 'ask', decision_id: DEMO.presentationId }
      : null,
  }
}

function demoPublishView(): PublishPackageView {
  return {
    schema: 'composition_publish_package_v1',
    package_id: DEMO.packageId,
    revision: demo.publish.revision,
    project_id: DEMO.projectId,
    job_id: DEMO.jobId,
    origin: demo.publish.origin,
    body: demo.publish.body,
    body_sha256: demoDigest(`${DEMO.packageId}:${demo.publish.revision}`),
    stale_fields: [],
    publish_permission: 'not_granted_by_plan',
    created_at: demo.publish.createdAt,
  }
}

function reviseDemoPublishPackage(body: unknown) {
  const patch = (body ?? {}) as {
    expected_revision?: unknown
    titles?: PublishPackageBody['titles']
    selected_title_id?: unknown
    description?: unknown
    tags?: unknown
    /** Sent without `cost`: the server prices the thumbnail. */
    thumbnail?: PublishPackageBody['thumbnail']
    chapters?: PublishPackageBody['chapters']
  }
  if (patch.expected_revision !== demo.publish.revision) throw mockError(409, 'COMPOSITION_PUBLISH_PACKAGE_STALE', 'Paket başka bir yerde değişti.')
  const next: PublishPackageBody = { ...demo.publish.body }
  if (patch.titles) next.titles = patch.titles
  if (typeof patch.selected_title_id === 'string') next.titles = { ...next.titles, selected_title_id: patch.selected_title_id }
  if (typeof patch.description === 'string') next.description = patch.description
  if (Array.isArray(patch.tags)) next.tags = patch.tags.filter((tag): tag is string => typeof tag === 'string')
  if (patch.thumbnail) next.thumbnail = { ...patch.thumbnail, cost: patch.thumbnail.source === 'ai_image' ? { status: 'priced', credits: 15 } : { status: 'free' } }
  if (patch.chapters) next.chapters = patch.chapters
  demo.publish = { revision: demo.publish.revision + 1, origin: 'user', body: next, createdAt: new Date().toISOString() }
  return { data: { outcome: 'created', package: demoPublishView() } }
}

/** Mirrors the conversation list schema of lib/assistant/api.ts, so the other chats keep exactly their generated data. */
const demoConversationListSchema = z.object({
  data: z.object({
    conversations: z.array(z.object({
      id: z.string(),
      user_id: z.string().nullable().catch(null),
      title: z.string().nullable().catch(null),
      status: z.string(),
      metadata: z.record(z.unknown()).catch({}).transform(publicMetadataRecord),
      last_message_at: z.string().nullable().catch(null),
      archived_at: z.string().nullable().catch(null),
      deleted_at: z.string().nullable().catch(null),
      version: z.number().catch(0),
      created_at: z.string(),
      updated_at: z.string(),
    })).catch([]),
    total: z.number().catch(0),
  }),
})

function withDemoReplay(scope: string, body: unknown, run: () => { data: Record<string, unknown> }) {
  const key = demoIdempotencyKey(body, scope)
  const recorded = key ? demo.replays.get(key) : undefined
  if (recorded) return recorded
  const answer = run()
  if (key) demo.replays.set(key, 'outcome' in answer.data ? { data: { ...answer.data, outcome: 'replayed' } } : answer)
  return answer
}

fixtures.push(
  // The chat lists: the demo chat first (Yt-2 Studio only; it carries no channel tag, so /chat still opens the welcome).
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations$/,
    handler: (request) => {
      const generated = generateRaw(demoConversationListSchema, { method: 'GET', path: demoRequestPath(request) }) as { data: { conversations: unknown[] } }
      const channelId = request.query.get('channel_id')
      const showDemo = !demo.archivedAt && !demo.deletedAt
        && (Number(request.query.get('offset')) || 0) === 0
        && (!channelId || channelId === DEMO.channelId)
      const conversations = showDemo ? [demoConversation(), ...generated.data.conversations] : generated.data.conversations
      // New chats lead, newest first, in the channel they were started in.
      const started = (Number(request.query.get('offset')) || 0) === 0
        ? [...newChats.values()].map((chat) => chat.conversation)
          .filter((conversation) => !channelId || conversation.metadata.channel_id === channelId)
          .reverse()
        : []
      return { data: { conversations: [...started, ...conversations], total: started.length + conversations.length } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/active-runs$/,
    handler: () => {
      const runs = DEMO_ACTIVE_RUN_STATES.has(demo.runState) && !demo.archivedAt && !demo.deletedAt
        ? [{
          run_id: DEMO.jobId,
          conversation_id: DEMO.conversationId,
          state: demo.runState,
          waiting_reason: demo.runState === 'waiting_for_approval' ? 'production_plan_approval' : demo.runState === 'waiting_for_user' ? 'requirements_question' : null,
          updated_at: demo.events.at(-1)?.created_at ?? demoAt(2),
          conversation_archived: false,
        }]
        : []
      return { data: { runs, conversation_ids: runs.map((run) => run.conversation_id), next_cursor: null } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales$/,
    handler: () => {
      advanceDemo()
      if (demo.deletedAt) throw mockError(404, 'ASSISTANT_CONVERSATION_NOT_FOUND', 'Sohbet bulunamadı.')
      return { data: { conversation: demoConversation(), messages: demo.messages, next_message_cursor: null } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales\/messages$/,
    handler: () => {
      advanceDemo()
      return { data: { messages: demo.messages, next_cursor: null } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales\/messages$/,
    handler: (request) => withDemoReplay('message', request.body, () => addDemoChatMessage(request.body)),
  },
  {
    // The answer to the question widget (a B question answer of the run): it starts the thinking moment.
    method: 'POST',
    path: /^\/api\/v1\/assistant\/runs\/job-demo-sales\/answer$/,
    handler: (request) => withDemoReplay('answer', request.body, () => addDemoChatMessage(request.body)),
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales\/archive$/,
    handler: () => {
      demo.archivedAt = demo.archivedAt ?? new Date().toISOString()
      return { data: demoConversation() }
    },
  },
  {
    method: 'DELETE',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales$/,
    handler: () => {
      demo.deletedAt = demo.deletedAt ?? new Date().toISOString()
      return { data: demoConversation() }
    },
  },
  {
    // Ask mode (the plan waits for the user); the planner model fields stay generated like every other chat.
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/conv-demo-sales\/settings$/,
    merge: true,
    handler: () => ({ data: { defaults: { conversation_id: DEMO.conversationId, default_mode: 'ask' }, job: null } }),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/runs\/job-demo-sales\/status$/,
    handler: () => {
      advanceDemo()
      const run = demoRun()
      return {
        data: {
          run_id: run.id,
          conversation_id: run.conversation_id,
          state: run.state,
          job_version: demo.presentation.version + demo.scriptRevision,
          error_code: null,
          error_message: null,
          started_at: run.started_at,
          completed_at: run.completed_at,
          failed_at: null,
          cancelled_at: null,
          updated_at: run.updated_at,
        },
      }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/runs\/job-demo-sales\/events$/,
    handler: (request) => {
      advanceDemo()
      const after = Number(request.query.get('after_sequence')) || 0
      const limit = Number(request.query.get('limit')) || 100
      return { data: { events: demo.events.filter((event) => event.sequence > after).slice(0, limit) } }
    },
  },
  // The job's G1 card / plan canvas: the presented plan and its one decision.
  {
    method: 'GET',
    path: /^\/api\/v1\/production-launch\/jobs\/job-demo-sales$/,
    handler: () => {
      advanceDemo()
      return demoLaunchState()
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/production-launch\/presentations\/pres-demo-sales\/decisions$/,
    handler: (request) => {
      const decision = (request.body as { decision?: unknown } | undefined)?.decision
      if (decision !== 'approve' && decision !== 'reject' && decision !== 'request_changes') {
        throw mockError(422, 'PRODUCTION_DECISION_INVALID', 'Geçersiz karar.')
      }
      const outcome = decideDemoPlan(decision, 'card')
      return { data: { outcome, presentation: demoPresentation(), launch: demoLaunch() } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant-plan-replans\/jobs\/job-demo-sales$/,
    handler: () => ({ data: { schema_version: 'assistant_plan_replan_state_v1', job_id: DEMO.jobId, updating: false, latest: null } }),
  },
  // No final render gate yet: the G2 card appears only after production (not started until the plan is approved).
  { method: 'GET', path: /^\/api\/v1\/final-render\/jobs\/job-demo-sales$/, handler: () => ({ data: { decision: null, export: null } }) },
  // The Composition owner: package summary, exact-revision body pages, script patches, shot sources, publish package.
  {
    method: 'GET',
    path: /^\/api\/v1\/composition\/projects\/proj-demo-sales\/production-plan$/,
    handler: (request) => {
      const jobId = request.query.get('job_id')
      if (jobId && jobId !== DEMO.jobId) throw mockError(404, 'COMPOSITION_JOB_NOT_FOUND', 'İş bulunamadı.')
      return { data: demoSummary() }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/composition\/projects\/proj-demo-sales\/preparation-artifacts\/([^/]+)\/revisions\/(\d+)\/body$/,
    handler: (request, match) => {
      const artifactId = decodeURIComponent(match[1] ?? '')
      const kind = (Object.keys(DEMO_ARTIFACT_IDS) as DemoArtifactKind[]).find((entry) => DEMO_ARTIFACT_IDS[entry] === artifactId)
      if (!kind) throw mockError(404, 'COMPOSITION_PREPARATION_ARTIFACT_NOT_FOUND', 'Hazırlık belgesi bulunamadı.')
      const section = request.query.get('section') ?? 'header'
      if (!['header', 'chapters', 'shots', 'sources', 'claims'].includes(section)) throw mockError(422, 'COMPOSITION_PREPARATION_SECTION_INVALID', 'Geçersiz bölüm.')
      const revision = Number(match[2])
      const items = demoArtifactItems(kind, section)
      return {
        data: {
          schema_version: 'preparation_body_page_v1',
          artifact_ref: { artifact_kind: kind, artifact_id: artifactId, artifact_revision: revision, content_digest_sha256: demoArtifactDigest(kind, revision) },
          section,
          items,
          total_items: items.length,
          next_cursor: null,
        },
      }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/composition-script-review\/projects\/proj-demo-sales\/preparation-artifacts\/art-demo-script\/script-patches$/,
    handler: (request) => withDemoReplay('script', request.body, () => patchDemoScript(request.body)),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/composition-direction\/projects\/proj-demo-sales\/shots\/([^/]+)\/candidates$/,
    handler: (_request, match) => {
      const shot = demo.shots.find((entry) => entry.shot_id === decodeURIComponent(match[1] ?? ''))
      if (!shot) throw mockError(404, 'COMPOSITION_SHOT_NOT_FOUND', 'Çekim bulunamadı.')
      return { data: { revision: demo.shotPlanRevision, shot: { shot_id: shot.shot_id, alternatives: demoSourceAlternatives(shot) } } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/composition-direction\/projects\/proj-demo-sales\/shots\/([^/]+)\/source$/,
    handler: (request, match) => withDemoReplay('shot-source', request.body, () => changeDemoShotSource(decodeURIComponent(match[1] ?? ''), request.body)),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/composition-publish-packages\/projects\/proj-demo-sales\/jobs\/job-demo-sales$/,
    handler: () => ({ data: demoPublishView() }),
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/composition-publish-packages\/projects\/proj-demo-sales\/jobs\/job-demo-sales\/revisions$/,
    handler: (request) => withDemoReplay('publish', request.body, () => reviseDemoPublishPackage(request.body)),
  },
  // Spend: the plan's preparation cost so far and the approval it waits for (balance as in the avatars entitlement).
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant-spend\/conversations\/conv-demo-sales\/meter$/,
    handler: () => {
      const job = demoSpendJob()
      return {
        data: {
          conversation_id: DEMO.conversationId,
          as_of: new Date().toISOString(),
          enforcement: 'job_spend_envelope',
          balance: { spendable_credits: 1240, plan_credits: 1000 },
          threshold: { auto_ask_at_credits: 150, base_credits: 100, ratio_bps: 1200, floor_credits: 50, ceiling_credits: 500, user_min_credits: null },
          job_cap: { credits: null, source: null },
          job: job.envelope_status === 'open' ? job : null,
          jobs: [job],
        },
      }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant-spend\/runs\/job-demo-sales\/receipt$/,
    handler: () => ({
      data: {
        run_id: DEMO.jobId,
        job_id: DEMO.jobId,
        conversation_id: DEMO.conversationId,
        envelope_id: DEMO.envelopeId,
        final: demo.runState === 'completed',
        spent_credits: DEMO_PREPARATION_CREDITS,
        outstanding_credits: 0,
        approved_ceiling_credits: demo.presentation.approvedMax,
        overrun_credits: 0,
        balance_after_credits: 1240,
        as_of: new Date().toISOString(),
        lines: [
          { kind: 'planning', credits: 2, status: 'settled', node: null, funding: null },
          { kind: 'preparation', credits: DEMO_PREPARATION_CREDITS - 2, status: 'settled', node: null, funding: null },
        ],
        lines_truncated: false,
        funding: { quota_credits: 0, plan_credits: DEMO_PREPARATION_CREDITS, top_up_credits: 0, unattributed_credits: 0, source: 'plan_credits' },
      },
    }),
  },
)

// --- New chats (the shell's agent panel, a new chat on /chat) -------------------------------------------------------
// A conversation created here keeps its messages in memory. Each message starts a run that reads the channel's memory,
// plans, then answers once (an assistant message, the run completed), by the clock like the demo chat: the handlers
// advance it when polled and the run's open stream hears each event.
type NewChatConversation = {
  id: string
  user_id: string
  title: string
  status: string
  metadata: Record<string, unknown>
  last_message_at: string | null
  archived_at: null
  deleted_at: null
  version: number
  created_at: string
  updated_at: string
}
type NewChat = { conversation: NewChatConversation; messages: DemoMessage[]; runs: string[] }
type NewChatRun = {
  id: string
  conversationId: string
  triggerMessageId: string
  state: 'running' | 'completed' | 'cancelled'
  startedAt: number
  stage: number
  prompt: string
  events: DemoEvent[]
  createdAt: string
  updatedAt: string
}

const newChats = new Map<string, NewChat>()
const newChatRuns = new Map<string, NewChatRun>()
const newChatReplays = new Map<string, unknown>()
const NEW_CHAT_PLANNING_AT_MS = 700
const NEW_CHAT_ANSWER_AT_MS = 1600

function createNewChat(body: unknown) {
  const input = (body ?? {}) as { title?: unknown; metadata?: unknown }
  const at = new Date().toISOString()
  const conversation: NewChatConversation = {
    id: `conv-new-${newChats.size + 1}`,
    user_id: MOCK_TENANT.id,
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Yeni sohbet',
    status: 'active',
    metadata: typeof input.metadata === 'object' && input.metadata ? input.metadata as Record<string, unknown> : {},
    last_message_at: null,
    archived_at: null,
    deleted_at: null,
    version: 1,
    created_at: at,
    updated_at: at,
  }
  newChats.set(conversation.id, { conversation, messages: [], runs: [] })
  return { data: conversation }
}

function readNewChat(conversationId: string) {
  const chat = newChats.get(conversationId)
  if (!chat) throw mockError(404, 'ASSISTANT_CONVERSATION_NOT_FOUND', 'Sohbet bulunamadı.')
  for (const runId of chat.runs) advanceNewChatRun(runId)
  return chat
}

function readNewChatRun(runId: string) {
  const run = newChatRuns.get(runId)
  if (!run) throw mockError(404, 'ASSISTANT_RUN_NOT_FOUND', 'İş bulunamadı.')
  advanceNewChatRun(runId)
  return run
}

function newChatMessage(chat: NewChat, runId: string, role: DemoMessage['role'], content: string) {
  const at = new Date().toISOString()
  const message: DemoMessage = {
    id: `${chat.conversation.id}-msg-${chat.messages.length + 1}`,
    conversation_id: chat.conversation.id,
    run_id: runId,
    role,
    content,
    content_json: {},
    status: 'completed',
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }
  chat.messages.push(message)
  chat.conversation = { ...chat.conversation, last_message_at: at, updated_at: at, version: chat.conversation.version + 1 }
  return message
}

function pushNewChatEvent(run: NewChatRun, eventType: string, payload: Record<string, unknown>) {
  const at = new Date().toISOString()
  const event: DemoEvent = { id: `${run.id}-evt-${run.events.length + 1}`, run_id: run.id, sequence: run.events.length + 1, event_type: eventType, payload, public: true, transient: false, created_at: at }
  run.events.push(event)
  run.updatedAt = at
  publishMockStreamEvent((url) => url.includes(`/runs/${run.id}/stream`), 'run_event', event)
  return event
}

function addNewChatMessage(conversationId: string, body: unknown) {
  const chat = readNewChat(conversationId)
  const content = typeof (body as { content?: unknown } | undefined)?.content === 'string' ? (body as { content: string }).content.trim() : ''
  if (!content) throw mockError(422, 'ASSISTANT_MESSAGE_EMPTY', 'Mesaj boş olamaz.')
  const runId = `job-new-${newChatRuns.size + 1}`
  const message = newChatMessage(chat, runId, 'user', content)
  const run: NewChatRun = {
    id: runId,
    conversationId,
    triggerMessageId: message.id,
    state: 'running',
    startedAt: Date.now(),
    stage: 0,
    prompt: content,
    events: [],
    createdAt: message.created_at,
    updatedAt: message.created_at,
  }
  newChatRuns.set(run.id, run)
  chat.runs.push(run.id)
  const event = pushNewChatEvent(run, 'message.created', { message_id: message.id, conversation_id: conversationId })
  pushNewChatEvent(run, 'run.started', { state: 'running', conversation_id: conversationId })
  pushNewChatEvent(run, 'assistant.status.updated', { stage: 'memory_context' })
  if (typeof window !== 'undefined') {
    window.setTimeout(() => advanceNewChatRun(run.id), NEW_CHAT_PLANNING_AT_MS + 20)
    window.setTimeout(() => advanceNewChatRun(run.id), NEW_CHAT_ANSWER_AT_MS + 20)
  }
  return { data: { message, run: newChatRunRecord(run), event, outbox_event: { id: `outbox-${run.id}`, status: 'published' }, replayed: false } }
}

/** Planning after a moment, then the answer and the end of the run. */
function advanceNewChatRun(runId: string) {
  const run = newChatRuns.get(runId)
  const chat = run ? newChats.get(run.conversationId) : undefined
  if (!run || !chat || run.state !== 'running') return
  const elapsed = Date.now() - run.startedAt
  if (elapsed >= NEW_CHAT_PLANNING_AT_MS && run.stage < 1) {
    run.stage = 1
    pushNewChatEvent(run, 'assistant.status.updated', { stage: 'planning' })
  }
  if (elapsed < NEW_CHAT_ANSWER_AT_MS) return
  run.state = 'completed'
  const reply = newChatMessage(chat, run.id, 'assistant', newChatReply(run.prompt))
  pushNewChatEvent(run, 'message.created', { message_id: reply.id, conversation_id: chat.conversation.id })
  pushNewChatEvent(run, 'run.completed', { state: 'completed' })
}

function newChatReply(prompt: string) {
  const topic = prompt.replace(/\s+/g, ' ').trim()
  const excerpt = topic.length > 80 ? `${topic.slice(0, 79).trimEnd()}…` : topic
  return [
    'Şöyle ilerleyebiliriz:',
    '',
    `1. **Konu:** “${excerpt}” — kanalın son videolarıyla bağını kurarım.`,
    '2. **Biçim:** 30–60 saniyelik dikey bir kısa video ya da 6–8 dakikalık yatay bir anlatım.',
    '3. **Sonraki adım:** Uygunsa senaryo taslağını hazırlarım.',
    '',
    '*Bu, yt-2’nin örnek yanıtıdır; sunucu bağlı değil.*',
  ].join('\n')
}

function newChatRunRecord(run: NewChatRun) {
  const ended = run.state === 'running' ? null : run.updatedAt
  return {
    id: run.id,
    conversation_id: run.conversationId,
    trigger_message_id: run.triggerMessageId,
    state: run.state,
    model_id: null,
    planner_version: null,
    metadata: {},
    error_code: null,
    error_message: null,
    started_at: run.createdAt,
    completed_at: run.state === 'completed' ? ended : null,
    failed_at: null,
    cancelled_at: run.state === 'cancelled' ? ended : null,
    version: run.events.length,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  }
}

function withNewChatReplay(scope: string, body: unknown, run: () => { data: Record<string, unknown> }) {
  const key = demoIdempotencyKey(body, scope)
  const recorded = key ? newChatReplays.get(key) : undefined
  if (recorded) return recorded
  const answer = run()
  if (key) newChatReplays.set(key, answer)
  return answer
}

fixtures.push(
  {
    method: 'POST',
    path: /^\/api\/v1\/assistant\/conversations$/,
    handler: (request) => withNewChatReplay('conversation', request.body, () => createNewChat(request.body)),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/(conv-new-\d+)$/,
    handler: (_request, match) => {
      const chat = readNewChat(match[1])
      return { data: { conversation: chat.conversation, messages: chat.messages, next_message_cursor: null } }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/(conv-new-\d+)\/messages$/,
    handler: (_request, match) => ({ data: { messages: readNewChat(match[1]).messages, next_cursor: null } }),
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/assistant\/conversations\/(conv-new-\d+)\/messages$/,
    handler: (request, match) => withNewChatReplay('message', request.body, () => addNewChatMessage(match[1], request.body)),
  },
  {
    // The new-job defaults the chat's composer starts with (its default model and Agent mode), so a new /chat commits nothing.
    method: 'GET',
    path: /^\/api\/v1\/assistant\/conversations\/(conv-new-\d+)\/settings$/,
    merge: true,
    handler: (_request, match) => ({ data: { defaults: { conversation_id: match[1], default_mode: 'auto', default_planner_model_id: DEFAULT_CHAT_MODEL_ID }, job: null } }),
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/runs\/(job-new-\d+)\/status$/,
    handler: (_request, match) => {
      const run = newChatRunRecord(readNewChatRun(match[1]))
      return {
        data: {
          run_id: run.id,
          conversation_id: run.conversation_id,
          state: run.state,
          job_version: run.version,
          error_code: null,
          error_message: null,
          started_at: run.started_at,
          completed_at: run.completed_at,
          failed_at: null,
          cancelled_at: run.cancelled_at,
          updated_at: run.updated_at,
        },
      }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant\/runs\/(job-new-\d+)\/events$/,
    handler: (request, match) => {
      const run = readNewChatRun(match[1])
      const after = Number(request.query.get('after_sequence')) || 0
      const limit = Number(request.query.get('limit')) || 100
      return { data: { events: run.events.filter((event) => event.sequence > after).slice(0, limit) } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/assistant\/runs\/(job-new-\d+)\/stop$/,
    handler: (_request, match) => {
      const run = readNewChatRun(match[1])
      const running = run.state === 'running'
      if (running) run.state = 'cancelled'
      const event = running ? pushNewChatEvent(run, 'run.cancelled', { state: 'cancelled' }) : null
      return { data: { run_id: run.id, state: run.state, cancelled: running, cancel_requested: running, replayed: false, event, skipped: !running } }
    },
  },
  // A new chat's answer is plain text: no production job behind it (no plan card, no final video, no replan).
  {
    method: 'GET',
    path: /^\/api\/v1\/production-launch\/jobs\/job-new-\d+$/,
    handler: () => {
      throw mockError(404, 'PRODUCTION_JOB_NOT_FOUND', 'Bu işin üretim planı yok.')
    },
  },
  { method: 'GET', path: /^\/api\/v1\/final-render\/jobs\/job-new-\d+$/, handler: () => ({ data: { decision: null, export: null } }) },
  {
    method: 'GET',
    path: /^\/api\/v1\/assistant-plan-replans\/jobs\/(job-new-\d+)$/,
    handler: (_request, match) => ({ data: { schema_version: 'assistant_plan_replan_state_v1', job_id: match[1], updating: false, latest: null } }),
  },
)

// --- Brand Kits (Marka > Brand Kit'ler) -----------------------------------------------------------------------------
// Every channel has the built-in neutral Kit and a few Kits the demo account owns, so a card opens the editor and
// "Kaydet" keeps the change. Kits, the channel default and the watermark (the channel's overlay) are kept in
// sessionStorage for this tab, like the Spark projects.
type MockBrandState = {
  kits: BrandKitDetail[]
  defaults: Record<string, { kit_id: string | null; version: number }>
  overlays: Record<string, { overlay: ChannelBrandOverlayPreset | null; version: number }>
}

const BRAND_STATE_KEY = 'yt2_mock_brand_kits'
const BRAND_BUILTIN_KIT_ID = 'kit-builtin-neutral'

/** The platform font catalogue: the faces the browser ships as "<Family> Caption" (app/globals.css). */
const BRAND_FONT_FACES: Array<[family: string, weight: number, style: 'normal' | 'italic']> = [
  ['Poppins', 800, 'normal'],
  ['Montserrat', 700, 'normal'],
  ['Anton', 400, 'normal'],
  ['Bebas Neue', 400, 'normal'],
  ['Oswald', 400, 'normal'],
  ['Oswald', 700, 'normal'],
  ['Archivo Black', 400, 'normal'],
  ['Playfair Display', 400, 'italic'],
  ['Playfair Display', 700, 'italic'],
]

const BRAND_LOGO_IMAGES: Array<[objectId: string, image: string]> = [
  ['a1b00000-0000-4000-8000-0000000010a0', '/youtorch-logo.png'],
  ['a1b00000-0000-4000-8000-0000000010a1', '/placeholder-logo.svg'],
]
for (const [objectId, image] of BRAND_LOGO_IMAGES) MOCK_OBJECT_IMAGES.set(objectId, image)

type BrandKitSample = {
  slug: string
  name: string
  colors: [primary: string, secondary: string, tertiary: string, accent: string]
  title: [family: string, weight: number]
  body: [family: string, weight: number]
  captions: [style: string, font: string, highlight: string, effect: string]
  logo: string | null
  shared: boolean
}

const BRAND_KIT_SAMPLES: BrandKitSample[] = [
  { slug: 'yt2-studio', name: 'Yt-2 Studio', colors: ['#FF5A1F', '#15110E', '#B9B1A6', '#FFD166'], title: ['Poppins', 800], body: ['Montserrat', 700], captions: ['tiktok_bold', '#FFFFFF', '#FFD166', '#000000'], logo: BRAND_LOGO_IMAGES[0]![0], shared: true },
  { slug: 'shorts-koyu', name: 'Shorts Koyu', colors: ['#22D3EE', '#0B1220', '#94A3B8', '#A78BFA'], title: ['Anton', 400], body: ['Montserrat', 700], captions: ['3d_pop', '#FFFFFF', '#FFFFFF', '#000000'], logo: null, shared: false },
  { slug: 'kampanya-canli', name: 'Kampanya Canlı', colors: ['#F43F5E', '#FFF7ED', '#9A3412', '#FACC15'], title: ['Bebas Neue', 400], body: ['Poppins', 800], captions: ['karaoke_white_to_yellow', '#FFFFFF', '#FFE600', '#000000'], logo: BRAND_LOGO_IMAGES[1]![0], shared: false },
  { slug: 'minimal-acik', name: 'Minimal Açık', colors: ['#111827', '#F9FAFB', '#6B7280', '#2563EB'], title: ['Playfair Display', 700], body: ['Montserrat', 700], captions: ['youtube_clean', '#FFFFFF', '#FFFFFF', '#000000'], logo: null, shared: false },
]

function brandFontToken([family, weight]: [string, number]) {
  const id = `${family.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${weight}`
  return { family, weight, font_ref: { font_id: `font_${id}`, font_revision: `fontrev_${id}_1`, sha256: demoDigest(`font:${id}`) } }
}

function brandKitContent(sample: BrandKitSample): BrandKitDraftContent {
  const [primary, secondary, tertiary, accent] = sample.colors
  const [style_name, font_color, highlight_color, effect_color] = sample.captions
  return {
    schema_version: 1,
    colors: { primary, secondary, tertiary, accent },
    fonts: { title: brandFontToken(sample.title), body: brandFontToken(sample.body) },
    captions: { style_name, font_color, highlight_color, effect_color },
    logos: { primary: sample.logo ? { storage_object_id: sample.logo } : null, horizontal: null, mark: null },
    video_style: {},
  }
}

function brandKitHead(kitId: string, revisionNumber: number) {
  const revisionId = `${kitId}-rev-${revisionNumber}`
  return {
    revision_id: revisionId,
    revision_number: revisionNumber,
    ref: {
      ref_type: 'brand_revision' as const,
      brand_asset_kind: 'kit',
      brand_asset_id: kitId,
      brand_revision_id: revisionId,
      brand_revision_digest_sha256: demoDigest(revisionId),
    },
  }
}

function brandKitPreview(content: BrandKitDraftContent) {
  return {
    colors: { ...content.colors },
    title_font: { family: content.fonts.title.family, weight: content.fonts.title.weight },
    caption_style_name: content.captions.style_name,
  }
}

function brandSampleKits(channelId: string): BrandKitDetail[] {
  const suffix = channelId === MOCK_CHANNELS[0]!.id ? '' : `-${channelId.slice(0, 8)}`
  return BRAND_KIT_SAMPLES.map((sample, index) => {
    const kitId = `kit-${sample.slug}${suffix}`
    const content = brandKitContent(sample)
    const at = new Date(Date.UTC(2026, 9, 12 - index * 4, 10, 0)).toISOString()
    return {
      kit_id: kitId,
      origin: 'user',
      name: sample.name,
      lifecycle_state: 'active',
      draft_version: 1,
      head_revision: brandKitHead(kitId, 1),
      updated_at: at,
      access_role: 'owner',
      sharing: { acl_version: 1, shared_with_channel_members: sample.shared },
      preview: brandKitPreview(content),
      channel_id: channelId,
      visibility: 'private',
      draft: { version: 1, content },
      created_at: at,
    }
  })
}

const BRAND_BUILTIN_CONTENT = brandKitContent({
  slug: 'neutral',
  name: 'Youtorch Nötr',
  colors: ['#2563EB', '#FFFFFF', '#6B7280', '#111827'],
  title: ['Montserrat', 700],
  body: ['Montserrat', 700],
  captions: ['auto', '#FFFFFF', '#FFE600', '#000000'],
  logo: null,
  shared: false,
})

const BRAND_BUILTIN_KIT: BrandKitDetail = {
  kit_id: BRAND_BUILTIN_KIT_ID,
  origin: 'builtin',
  name: 'Youtorch Nötr',
  lifecycle_state: 'active',
  draft_version: null,
  head_revision: brandKitHead(BRAND_BUILTIN_KIT_ID, 1),
  updated_at: '2026-06-01T09:00:00.000Z',
  access_role: 'platform',
  sharing: null,
  preview: brandKitPreview(BRAND_BUILTIN_CONTENT),
  channel_id: null,
  visibility: 'platform',
  draft: null,
  created_at: '2026-06-01T09:00:00.000Z',
}

let brandState: MockBrandState | null = null

function brandStore(): MockBrandState {
  if (brandState) return brandState
  let state: MockBrandState = { kits: [], defaults: {}, overlays: {} }
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(BRAND_STATE_KEY) ?? 'null') as MockBrandState | null
      if (stored && Array.isArray(stored.kits) && stored.defaults && stored.overlays) state = stored
    } catch {
      // A broken entry starts the sample Kits again.
    }
  }
  for (const channel of MOCK_CHANNELS) {
    if (!state.defaults[channel.id]) {
      const kits = brandSampleKits(channel.id)
      state.kits.push(...kits)
      state.defaults[channel.id] = { kit_id: kits[0]!.kit_id, version: 1 }
    }
    const saved = state.overlays[channel.id]
    if (saved) Object.assign(channel.settings, { brandOverlay: saved.overlay, brandOverlayVersion: saved.version })
  }
  brandState = state
  return state
}

function saveBrandStore() {
  try {
    window.sessionStorage.setItem(BRAND_STATE_KEY, JSON.stringify(brandStore()))
  } catch {
    // Without sessionStorage the change still lasts until the page is reloaded.
  }
}

function findBrandKit(kitId: string): BrandKitDetail {
  if (kitId === BRAND_BUILTIN_KIT_ID) return BRAND_BUILTIN_KIT
  const kit = brandStore().kits.find((entry) => entry.kit_id === kitId)
  if (!kit) throw mockError(404, 'BRAND_KIT_NOT_FOUND', 'Brand Kit bulunamadı.')
  return kit
}

/** The owner's Kit with its draft; a draft version other than the one the screen loaded is a conflict. */
function ownedBrandKit(kitId: string, expectedDraftVersion: unknown) {
  const kit = findBrandKit(kitId)
  if (!kit.draft) throw mockError(403, 'BRAND_KIT_FORBIDDEN', 'Bu Brand Kit yalnızca sahibi tarafından düzenlenir.')
  if (kit.draft.version !== expectedDraftVersion) {
    throw mockError(409, 'BRAND_KIT_DRAFT_VERSION_CONFLICT', 'Brand Kit başka bir pencerede değişti.')
  }
  return { kit, draft: kit.draft }
}

function brandRevision(kit: BrandKitDetail) {
  const head = kit.head_revision ?? brandKitHead(kit.kit_id, 1)
  return {
    kit_id: kit.kit_id,
    revision_id: head.revision_id,
    revision_number: head.revision_number,
    ref: head.ref,
    content: kit.draft?.content ?? BRAND_BUILTIN_CONTENT,
    created_at: kit.updated_at,
  }
}

function brandMemberAccess(kit: BrandKitDetail) {
  if (kit.origin === 'builtin') return 'builtin' as const
  return kit.sharing?.shared_with_channel_members ? ('channel_members' as const) : ('owner_only' as const)
}

function brandChannelDefault(channelId: string) {
  const entry = brandStore().defaults[channelId] ?? { kit_id: null, version: 0 }
  const kit = entry.kit_id ? findBrandKit(entry.kit_id) : BRAND_BUILTIN_KIT
  return {
    kit,
    binding: {
      binding_scope: 'channel_default' as const,
      kit_id: entry.kit_id,
      restricted: false,
      binding_version: entry.version,
      updated_at: kit.updated_at,
      member_access: brandMemberAccess(kit),
    },
  }
}

fixtures.push(
  {
    method: 'GET',
    path: /^\/api\/v1\/brand\/kits$/,
    handler: (request) => {
      const channelId = request.query.get('channel_id') ?? ''
      const kits = [BRAND_BUILTIN_KIT, ...brandStore().kits.filter((kit) => kit.channel_id === channelId)]
      return { data: kits, meta: { limit: Number(request.query.get('limit')) || kits.length, next_cursor: null } }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/brand\/kits$/,
    handler: (request) => {
      const body = (request.body ?? {}) as { channel_id?: string; name?: string; content?: BrandKitDraftContent }
      const kitId = `kit-${crypto.randomUUID()}`
      const content = structuredClone(body.content ?? BRAND_BUILTIN_CONTENT)
      const now = new Date().toISOString()
      const kit: BrandKitDetail = {
        kit_id: kitId,
        origin: 'user',
        name: body.name?.trim() || 'Yeni kit',
        lifecycle_state: 'active',
        draft_version: 1,
        head_revision: brandKitHead(kitId, 1),
        updated_at: now,
        access_role: 'owner',
        sharing: { acl_version: 1, shared_with_channel_members: false },
        preview: brandKitPreview(content),
        channel_id: body.channel_id ?? MOCK_CHANNELS[0]!.id,
        visibility: 'private',
        draft: { version: 1, content },
        created_at: now,
      }
      brandStore().kits.unshift(kit)
      saveBrandStore()
      return { data: kit }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/brand\/kits\/([^/]+)$/,
    handler: (_request, match) => ({ data: findBrandKit(decodeURIComponent(match[1] ?? '')) }),
  },
  {
    method: 'PUT',
    path: /^\/api\/v1\/brand\/kits\/([^/]+)\/draft$/,
    handler: (request, match) => {
      const body = (request.body ?? {}) as { expected_draft_version?: number; name?: string; content?: BrandKitDraftContent }
      const { kit, draft } = ownedBrandKit(decodeURIComponent(match[1] ?? ''), body.expected_draft_version)
      if (body.name?.trim()) kit.name = body.name.trim()
      if (body.content) draft.content = body.content
      draft.version += 1
      kit.draft_version = draft.version
      kit.preview = brandKitPreview(draft.content)
      kit.updated_at = new Date().toISOString()
      saveBrandStore()
      return { data: kit }
    },
  },
  {
    method: 'POST',
    path: /^\/api\/v1\/brand\/kits\/([^/]+)\/revisions$/,
    handler: (request, match) => {
      const body = (request.body ?? {}) as { expected_draft_version?: number }
      const { kit } = ownedBrandKit(decodeURIComponent(match[1] ?? ''), body.expected_draft_version)
      kit.head_revision = brandKitHead(kit.kit_id, (kit.head_revision?.revision_number ?? 0) + 1)
      kit.updated_at = new Date().toISOString()
      saveBrandStore()
      return { data: brandRevision(kit) }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/brand\/kits\/([^/]+)\/revisions\/[^/]+$/,
    handler: (_request, match) => ({ data: brandRevision(findBrandKit(decodeURIComponent(match[1] ?? ''))) }),
  },
  {
    method: 'PUT',
    path: /^\/api\/v1\/brand\/kits\/([^/]+)\/sharing$/,
    handler: (request, match) => {
      const body = (request.body ?? {}) as { shared_with_channel_members?: boolean }
      const kit = findBrandKit(decodeURIComponent(match[1] ?? ''))
      if (!kit.sharing) throw mockError(403, 'BRAND_KIT_FORBIDDEN', 'Bu Brand Kit yalnızca sahibi tarafından paylaşılır.')
      const shared = Boolean(body.shared_with_channel_members)
      const changed = kit.sharing.shared_with_channel_members !== shared
      kit.sharing = { acl_version: kit.sharing.acl_version + (changed ? 1 : 0), shared_with_channel_members: shared }
      saveBrandStore()
      return {
        data: { kit_id: kit.kit_id, channel_id: kit.channel_id ?? '', acl_version: kit.sharing.acl_version, shared_with_channel_members: shared, changed },
      }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/brand\/channels\/([^/]+)\/kit-binding$/,
    handler: (_request, match) => {
      const channelId = decodeURIComponent(match[1] ?? '')
      const { kit, binding } = brandChannelDefault(channelId)
      return {
        data: {
          channel_id: channelId,
          channel_default: binding,
          actor_selection: { binding_scope: 'actor_selection', kit_id: null, restricted: false, binding_version: 0, updated_at: null, member_access: null },
          effective: {
            source: binding.kit_id ? 'channel_default' : 'builtin_default',
            kit_id: kit.kit_id,
            kit_name: kit.name,
            builtin: kit.origin === 'builtin',
            revision_number: kit.head_revision?.revision_number ?? 1,
          },
          actor_capabilities: { set_channel_default: true, select_own: true, share_own_kits: true },
        },
      }
    },
  },
  {
    method: 'PUT',
    path: /^\/api\/v1\/brand\/channels\/([^/]+)\/kit-binding$/,
    handler: (request, match) => {
      const channelId = decodeURIComponent(match[1] ?? '')
      const body = (request.body ?? {}) as { kit_id?: string | null }
      const store = brandStore()
      store.defaults[channelId] = { kit_id: body.kit_id ?? null, version: (store.defaults[channelId]?.version ?? 0) + 1 }
      saveBrandStore()
      return { data: brandChannelDefault(channelId).binding }
    },
  },
  {
    method: 'GET',
    path: /^\/api\/v1\/brand\/fonts$/,
    handler: () => ({
      data: {
        faces: BRAND_FONT_FACES.map(([family, weight, style]) => ({ font: brandFontToken([family, weight]).font_ref, family, weight, style, status: 'active' })),
      },
    }),
  },
  {
    // The watermark of the Brand Kit screen is the channel's overlay; name and logo changes are kept the same way.
    method: 'PUT',
    path: /^\/api\/v1\/channels\/([^/]+)\/settings$/,
    handler: (request, match) => {
      const channel = MOCK_CHANNELS.find((entry) => entry.id === decodeURIComponent(match[1] ?? ''))
      if (!channel) throw mockError(404, 'CHANNEL_NOT_FOUND', 'Kanal bulunamadı.')
      const body = (request.body ?? {}) as { name?: string; logo_url?: string | null; brand_overlay?: Record<string, unknown> | null }
      if (body.name?.trim()) channel.name = body.name.trim()
      if (body.logo_url !== undefined) Object.assign(channel.settings, { logoUrl: body.logo_url })
      if (body.brand_overlay !== undefined) {
        const overlay = body.brand_overlay
        const next = {
          overlay: overlay
            ? ({
                applyPolicy: overlay.apply_policy,
                assetStorageObjectId: overlay.asset_storage_object_id,
                anchor: overlay.anchor,
                widthRatio: overlay.width_ratio,
                opacity: overlay.opacity,
                marginRatio: overlay.margin_ratio,
                animationMode: overlay.animation_mode,
                intervalSeconds: overlay.interval_seconds,
                fadeSeconds: overlay.fade_seconds,
              } as ChannelBrandOverlayPreset)
            : null,
          version: channel.settings.brandOverlayVersion + 1,
        }
        Object.assign(channel.settings, { brandOverlay: next.overlay, brandOverlayVersion: next.version })
        brandStore().overlays[channel.id] = next
        saveBrandStore()
      }
      channel.updated_at = new Date().toISOString()
      return { data: channel }
    },
  },
)

// The saved watermark has to be on the channel before the first channel list is read.
if (typeof window !== 'undefined') brandStore()

/** Throw this from a fixture to preview an error state, e.g. `throw mockError(404, 'NOT_FOUND', 'Bulunamadı')`. */
export function mockError(status: number, code: string, message: string) {
  return new AuthClientError(code, message, status)
}

export function findFixture(request: MockRequest) {
  for (const fixture of fixtures) {
    if (fixture.method && fixture.method !== request.method) continue
    const match = request.path.match(fixture.path)
    if (match) return { fixture, match }
  }
  return null
}

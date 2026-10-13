// Memory — UI model and demo content (café & restaurant channel, same as the Library). Mock data only.

export type MemoryScope = 'channel' | 'personal'
export type MemoryStatus = 'ready' | 'processing' | 'failed'
export type KnowledgeKind = 'note' | 'file' | 'link' | 'media'

/** Something the assistant knows: a note you wrote, a file or link you added, or text taken from library media. */
export type KnowledgeItem = {
  id: string
  kind: KnowledgeKind
  title: string
  body: string
  /** File name, URL or library item the knowledge came from. */
  source: string | null
  scope: MemoryScope
  enabled: boolean
  /** Added automatically from the library (see the ingestion settings). */
  auto: boolean
  status: MemoryStatus
  failure?: string
  updatedAt: string
}

/** A sentence the assistant always follows, optionally only in some situations. */
export type RuleItem = {
  id: string
  text: string
  when: string | null
  scope: MemoryScope
  enabled: boolean
  updatedAt: string
}

export type SkillOrigin = 'builtin' | 'mine' | 'shared'

/** A method the assistant can use for a job: a name, what it is for, and its steps. */
export type SkillItem = {
  id: string
  name: string
  description: string
  steps: string[]
  /** The method as Markdown (the skill editor writes it); skills without one only have their steps. */
  body?: string
  origin: SkillOrigin
  sharedBy?: string
  enabled: boolean
  draft?: boolean
  updateAvailable?: boolean
  updatedAt: string
}

export type IngestionSettings = {
  enabled: boolean
  transcripts: boolean
  imageDescriptions: boolean
  documents: boolean
  askFirst: boolean
}

const now = Date.now()
const ago = (hours: number) => new Date(now - hours * 3600 * 1000).toISOString()

export const SEED_KNOWLEDGE: KnowledgeItem[] = [
  { id: 'k1', kind: 'note', title: 'Marka sesi', body: 'Samimi, sıcak ve biraz esprili konuşuruz. “Siz” yerine “sen” dili kullanırız; abartılı vaatlerden kaçınırız.', source: null, scope: 'channel', enabled: true, auto: false, status: 'ready', updatedAt: ago(3) },
  { id: 'k2', kind: 'note', title: 'Hedef kitle', body: '25–40 yaş arası, şehirde yaşayan, hafta sonu brunch’a çıkan genç profesyoneller ve öğrenciler.', source: null, scope: 'channel', enabled: true, auto: false, status: 'ready', updatedAt: ago(30) },
  { id: 'k3', kind: 'file', title: 'Ekim menüsü ve fiyatlar', body: 'Balkabaklı risotto 320 TL, elmalı tart 180 TL, latte 95 TL… Toplam 28 ürün ve fiyatı.', source: 'ekim-menu-2026.pdf', scope: 'channel', enabled: true, auto: false, status: 'ready', updatedAt: ago(52) },
  { id: 'k4', kind: 'link', title: 'Google yorumlarımız', body: 'Ortalama 4,7 puan. En çok övülenler: kahve, brunch tabağı ve güler yüzlü ekip.', source: 'g.page/yt2-kafe', scope: 'channel', enabled: true, auto: false, status: 'ready', updatedAt: ago(75) },
  { id: 'k5', kind: 'note', title: 'Çalışma saatleri ve adres', body: 'Hafta içi 08:00–22:00, hafta sonu 09:00–23:00. Moda, Kadıköy / İstanbul.', source: null, scope: 'channel', enabled: true, auto: false, status: 'ready', updatedAt: ago(120) },
  { id: 'k6', kind: 'media', title: 'Şef Ece — tarif anlatımı', body: '“Bugün size sonbahar menümüzün yıldızı balkabaklı risottoyu anlatacağım…” (transkript)', source: 'Kütüphane · video', scope: 'channel', enabled: true, auto: true, status: 'ready', updatedAt: ago(26) },
  { id: 'k7', kind: 'media', title: 'Müşteri yorumu — Zeynep', body: '“Hafta sonu brunch’ı için geldik, menemen gerçekten harikaydı…” (transkript)', source: 'Kütüphane · video', scope: 'channel', enabled: true, auto: true, status: 'ready', updatedAt: ago(40) },
  { id: 'k8', kind: 'file', title: 'Marka kılavuzu', body: '', source: 'marka-kilavuzu.pdf', scope: 'channel', enabled: true, auto: false, status: 'processing', updatedAt: ago(0.2) },
  { id: 'k9', kind: 'note', title: 'Pazartesi çekim günü', body: 'Yeni ürün çekimleri her pazartesi 10:00’da; o gün paylaşım planlama.', source: null, scope: 'personal', enabled: true, auto: false, status: 'ready', updatedAt: ago(8) },
  { id: 'k10', kind: 'link', title: 'Instagram profili', body: '', source: 'instagram.com/yt2kafe', scope: 'channel', enabled: false, auto: false, status: 'failed', failure: 'Sayfa okunamadı; giriş gerektiriyor olabilir.', updatedAt: ago(14) },
]

export const SEED_RULES: RuleItem[] = [
  { id: 'r1', text: 'Videolarda her zaman marka intro’sunu kullan.', when: null, scope: 'channel', enabled: true, updatedAt: ago(20) },
  { id: 'r2', text: 'Fiyatları TL olarak ve güncel menüden söyle.', when: 'Fiyattan bahsederken', scope: 'channel', enabled: true, updatedAt: ago(48) },
  { id: 'r3', text: 'Rakip kafe ve restoranların adını asla anma.', when: null, scope: 'channel', enabled: true, updatedAt: ago(96) },
  { id: 'r4', text: 'Shorts videoları 30 saniyeyi geçmesin.', when: 'Shorts videolarında', scope: 'channel', enabled: true, updatedAt: ago(130) },
  { id: 'r5', text: 'Seslendirmede Deniz’in sesini kullan.', when: 'Seslendirme gerektiğinde', scope: 'channel', enabled: false, updatedAt: ago(200) },
  { id: 'r6', text: 'Açıklamalarda en fazla 3 hashtag kullan.', when: null, scope: 'personal', enabled: true, updatedAt: ago(10) },
]

export const SEED_SKILLS: SkillItem[] = [
  {
    id: 's1', name: 'Reels senaryosu yaz', origin: 'builtin', enabled: true, updatedAt: ago(300),
    description: 'Bir ürün ya da konu için 15–30 saniyelik dikey video senaryosu çıkarır.',
    steps: ['İlk 3 saniyeye dikkat çekici bir kanca yaz.', 'Ürünü ya da konuyu 2–3 kısa sahnede göster.', 'Marka sesine uygun bir kapanış ve çağrı ekle.', 'Sahne başına süre ve ekrandaki yazıyı belirt.'],
  },
  {
    id: 's2', name: 'YouTube başlığı ve açıklaması', origin: 'builtin', enabled: true, updateAvailable: true, updatedAt: ago(500),
    description: 'Videoya uygun 3 başlık önerisi, açıklama ve etiketler yazar.',
    steps: ['Videonun ana konusunu tek cümleyle özetle.', '60 karakteri geçmeyen 3 başlık öner.', 'İlk iki satırı merak uyandıran bir açıklama yaz.', 'En fazla 10 etiket ekle.'],
  },
  {
    id: 's3', name: 'Haftalık içerik planı', origin: 'builtin', enabled: false, updatedAt: ago(700),
    description: 'Kanal hedeflerine göre bir haftalık paylaşım takvimi hazırlar.',
    steps: ['Haftanın öne çıkacak ürününü ya da kampanyasını seç.', 'Her gün için format (Shorts, Reels, uzun video) belirle.', 'Paylaşım saatlerini kitlenin aktif olduğu saatlere göre öner.'],
  },
  {
    id: 's4', name: 'Yorumlardan kısa video', origin: 'builtin', enabled: false, updatedAt: ago(800),
    description: 'Müşteri yorumlarını seçip sosyal kanıt videosuna dönüştürür.',
    steps: ['En olumlu ve kısa yorumları seç.', 'Her yorum için bir görsel ya da video eşleştir.', 'Yorumları ekranda okunur şekilde sırala.'],
  },
  {
    id: 's5', name: 'Menüden ürün tanıtımı', origin: 'mine', enabled: true, updatedAt: ago(60),
    description: 'Menüdeki bir ürünü fiyatı ve öne çıkan özelliğiyle tanıtan kısa video hazırlar.',
    steps: ['Ürünün fiyatını ve içeriğini menüden al.', '“Menü — Yemekler” koleksiyonundan en az kullanılan görseli seç.', 'Marka sesiyle 2 cümlelik tanıtım yaz.', 'Kapanışta adres ve çalışma saatlerini göster.'],
  },
  {
    id: 's6', name: 'Kampanya duyurusu', origin: 'mine', enabled: false, draft: true, updatedAt: ago(5),
    description: 'Yeni bir kampanyayı tarih ve indirim bilgisiyle duyurur.',
    steps: ['Kampanyanın adını, tarihini ve indirimini netleştir.', 'Dikkat çekici bir açılış cümlesi yaz.', 'Son katılım tarihini vurgula.'],
  },
  {
    id: 's7', name: 'Şefin tarif formatı', origin: 'shared', sharedBy: 'Ece', enabled: true, updatedAt: ago(150),
    description: 'Tarif videolarını şefin anlattığı sırayla ve malzeme listesiyle kurgular.',
    steps: ['Malzemeleri ekranda liste olarak göster.', 'Adımları şefin anlatım sırasıyla kes.', 'Son tabağı yakın çekimle bitir.'],
  },
]

export const SEED_INGESTION: IngestionSettings = {
  enabled: true,
  transcripts: true,
  imageDescriptions: false,
  documents: true,
  askFirst: false,
}

// Sample content the schema-driven mock generator draws from. Edit freely: everything shown in the UI as
// "data" (project names, descriptions, tags…) comes from these lists unless a fixture overrides it.

export const MOCK_TITLES = [
  'Yaz Kampanyası Tanıtım Videosu',
  'Ürün Lansmanı — Reels Serisi',
  'Haftalık Podcast Kesitleri',
  'Marka Hikâyesi 60 sn',
  'YouTube Shorts: İpuçları #12',
  'Müşteri Yorumları Derlemesi',
  'Eğitim Serisi — Bölüm 3',
  'Black Friday Duyurusu',
  'Instagram Story Paketi',
  'Kurucu Röportajı',
  'Yeni Özellik Tanıtımı',
  'TikTok Trend Uyarlaması',
  'Etkinlik Özeti — İstanbul',
  'Ürün Karşılaştırma Videosu',
  'Sezon Finali Fragmanı',
  'Nasıl Yapılır: Hızlı Başlangıç',
]

export const MOCK_SENTENCES = [
  'Kısa ve dikkat çekici bir açılışla izleyicinin ilk üç saniyede ilgisini yakalayan dikey video.',
  'Ürünün öne çıkan üç özelliğini sade bir anlatım ve dinamik altyazılarla gösteren tanıtım.',
  'Uzun röportajdan otomatik seçilmiş en güçlü anlar, sosyal medya formatına uyarlandı.',
  'Marka renkleri ve logosuyla uyumlu, seslendirmeli açıklayıcı içerik.',
  'Müşteri deneyimlerini öne çıkaran, güven odaklı kısa bir derleme.',
  'Hedef kitleye göre üç farklı varyasyonla hazırlanmış kampanya kreatifi.',
  'Taslak senaryo onaylandı; seslendirme ve kurgu adımları sırada bekliyor.',
  'Altyazılar Türkçe ve İngilizce olarak hazırlandı, müzik telifsiz kütüphaneden seçildi.',
]

export const MOCK_TAGS = ['pazarlama', 'reels', 'shorts', 'tanıtım', 'eğitim', 'kampanya', 'podcast', 'marka']

export const MOCK_PEOPLE = ['Deniz Yılmaz', 'Ece Kaya', 'Mert Demir', 'Selin Aydın', 'Can Öztürk', 'Zeynep Şahin']

export const MOCK_TENANT = {
  id: 'tenant_yt2_demo',
  name: 'Yt-2 Studio',
  email: 'demo@yt-2.dev',
}

// Real artwork that ships in public/ (public/placeholder.jpg is a 1×1 pixel). Thumbnails, previews and delivery URLs
// rotate through this pool, picked by a hash of the id so the same object always shows the same picture.
export const MOCK_IMAGES = [
  '/tools/angle/front.jpg',
  '/tools/angle/front-side.jpg',
  '/tools/angle/side.jpg',
  '/tools/angle/front-elevated.jpg',
  '/tools/angle/back-side.jpg',
  '/tools/angle/top-down.jpg',
  '/flows/news.png',
  '/flows/educational.png',
  '/flows/sales.png',
  '/flows/tips.png',
  '/flows/expert.png',
  '/flows/course.png',
  '/auth/ai-video-workspace.png',
  '/auth/storyboard-timeline.png',
  '/auth/campaign-publishing.png',
]

export const MOCK_IMAGE = MOCK_IMAGES[0]

export function pickMockImage(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return MOCK_IMAGES[hash % MOCK_IMAGES.length]
}
export const MOCK_AVATAR = '/placeholder-user.jpg'
export const MOCK_LOGO = '/placeholder-logo.png'

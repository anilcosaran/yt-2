import type {
  NavItem,
  Area,
  Activity,
  Application,
  ApplicationCategory,
  Goal,
  Risk,
  Idea,
  IdeaTheme,
  AutomationRule,
  FlowNode,
  ActionCategory,
  User,
  Workflow,
} from './types'

// Users
export const currentUser: User = {
  id: '1',
  name: 'Anil Bey',
  avatar: '/placeholder-user.jpg',
  email: 'anil@example.com',
}

export const users: User[] = [
  currentUser,
  { id: '2', name: 'Ayse Hanim', avatar: '/placeholder-user.jpg' },
  { id: '3', name: 'Mehmet Bey', avatar: '/placeholder-user.jpg' },
]

// Home Sidebar Navigation
export const homeSidebarItems: NavItem[] = [
  { id: 'sizin-icin', label: 'Sizin icin', icon: 'home', href: '/' },
  { id: 'alan', label: 'Alan', icon: 'folder', href: '/areas' },
]

export const homeRecentItems: NavItem[] = [
  { id: 'testsdf', label: 'testsdf', icon: 'folder', href: '/areas/testsdf' },
  { id: 'test', label: 'Test', icon: 'folder', href: '/areas/test' },
  { id: 'destek', label: 'Destek', icon: 'folder', href: '/areas/destek' },
]

export const homeBottomItems: NavItem[] = [
  { id: 'daha-fazla-alan', label: 'Daha fazla alan', icon: 'layers' },
  { id: 'channels', label: 'Channels', icon: 'video', href: '/channels' },
  { id: 'workflows', label: 'Workflows', icon: 'timeline', href: '/workflows' },
  { id: 'daha-fazlasi', label: '... Daha fazlasi', icon: 'more' },
]

// Youtorch Sidebar Navigation
export const youtorchSidebarItems: NavItem[] = [
  { id: 'sizin-icin', label: 'Sizin icin', icon: 'home', href: '/' },
  { id: 'alan', label: 'Alan', icon: 'folder', href: '/areas' },
]

export const youtorchEnSonItems: NavItem[] = [
  { id: 'testsdf', label: 'testsdf', icon: 'folder', href: '/areas/testsdf' },
]

export const youtorchProjectItems: NavItem[] = [
  { id: 'all-ideas', label: 'All ideas', icon: 'list', href: '/areas/testsdf/ideas' },
  {
    id: 'impact-assessment',
    label: 'Impact assessment',
    icon: 'layers',
    href: '/areas/testsdf/impact',
    isActive: true,
  },
  { id: 'impact-vs-effort', label: 'Impact vs Effort', icon: 'grid', href: '/areas/testsdf/impact-effort' },
  { id: 'product-roadmap', label: 'Product roadmap', icon: 'calendar', href: '/areas/testsdf/roadmap' },
  { id: 'product-timeline', label: 'Product timeline', icon: 'clock', href: '/areas/testsdf/timeline' },
  { id: 'delivery-status', label: 'Delivery status', icon: 'check', href: '/areas/testsdf/delivery' },
]

export const youtorchMoreViewsItems: NavItem[] = [
  { id: 'custom-framework', label: 'Custom framework', icon: 'settings' },
  { id: 'new-view', label: 'New View', icon: 'plus' },
  { id: 'bir-gorunum-olustur-1', label: '+ Bir gorunum olustur', icon: 'plus' },
  { id: 'bir-gorunum-olustur-2', label: '+ Bir gorunum olustur', icon: 'plus' },
]

export const youtorchOtherProjectItems: NavItem[] = [
  { id: 'test', label: 'Test', icon: 'folder', href: '/areas/test' },
  { id: 'destek', label: 'Destek', icon: 'folder', href: '/areas/destek' },
]

// Goals Sidebar Navigation
export const goalsSidebarItems: NavItem[] = [
  { id: 'amac-dizini', label: 'Amac dizini', icon: 'target', href: '/goals', isActive: true },
  { id: 'takip-ediliyor', label: 'Takip ediliyor', icon: 'eye', href: '/goals/following' },
  { id: 'durum-guncellemeleri', label: 'Durum guncellemeleri', icon: 'bell', href: '/goals/updates' },
  { id: 'arsivlendi', label: 'Arsivlendi', icon: 'archive', href: '/goals/archived' },
]

export const goalsExternalItems: NavItem[] = [
  { id: 'teams', label: 'Teams', icon: 'users', href: '/teams', isExternal: true },
  { id: 'projects', label: 'Projects', icon: 'folder', href: '/projects', isExternal: true },
]

// Area Settings Sidebar
export const areaSettingsSidebarItems: NavItem[] = [
  { id: 'ayrintilar', label: 'Ayrintilar', icon: 'file', href: '/areas/destek/settings/details' },
  { id: 'ozet', label: 'Ozet', icon: 'list', href: '/areas/destek/settings/summary' },
  { id: 'ozellikler', label: 'Ozellikler', icon: 'settings', href: '/areas/destek/settings/features' },
  {
    id: 'erisim',
    label: 'Erisim',
    icon: 'shield',
    href: '/areas/destek/settings/access',
    children: [],
  },
  {
    id: 'talep-yonetimi',
    label: 'Talep yonetimi',
    icon: 'inbox',
    children: [],
  },
  {
    id: 'kanallar',
    label: 'Kanallar ve kendi kendine hizmet',
    icon: 'share',
    children: [],
  },
  {
    id: 'operasyon',
    label: 'Operasyon',
    icon: 'zap',
    children: [],
  },
  {
    id: 'bildirimler',
    label: 'Bildirimler',
    icon: 'bell',
    children: [
      { id: 'dil-destegi', label: 'Dil destegi', href: '/areas/destek/settings/language' },
    ],
  },
  {
    id: 'uygulamalar',
    label: 'Uygulamalar',
    icon: 'grid',
    children: [],
  },
  { id: 'surumler', label: 'Surumler', icon: 'tag', href: '/areas/destek/settings/versions' },
  { id: 'bilesenler', label: 'Bilesenler', icon: 'layers', href: '/areas/destek/settings/components' },
]

// Areas (Projects)
export const areas: Area[] = [
  {
    id: 'testsdf',
    name: 'testsdf',
    description: 'Urun Kesfi',
    type: 'product',
    icon: 'folder',
    color: '#FFAB00',
    quickLinks: [
      { label: 'Fikirlerim', href: '/areas/testsdf/ideas', count: 6 },
    ],
    viewCount: 8,
  },
  {
    id: 'test',
    name: 'Test',
    description: 'Takim tarafindan yonetilen is',
    type: 'service',
    icon: 'folder',
    color: '#FF5630',
    quickLinks: [
      { label: 'Acik biletlerim', href: '/areas/test/tickets', count: 0 },
      { label: 'Tamamlanan biletler', href: '/areas/test/completed' },
    ],
    viewCount: 1,
  },
  {
    id: 'destek',
    name: 'Destek',
    description: 'Hizmet yonetimi',
    type: 'support',
    icon: 'folder',
    color: '#6554C0',
    quickLinks: [
      { label: 'All open', href: '/areas/destek/open', count: 1 },
      { label: 'Assigned to me', href: '/areas/destek/assigned', count: 1 },
    ],
    queueCount: 3,
  },
]

// Activities
export const activities: Activity[] = [
  {
    id: '1',
    type: 'updated',
    title: 'New rewards program',
    projectKey: 'TSF-2',
    projectName: 'testsdf',
    timestamp: 'Guncellendi',
    user: currentUser,
  },
  {
    id: '2',
    type: 'created',
    title: 'Explore VR travel features',
    projectKey: 'TSF-6',
    projectName: 'testsdf',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '3',
    type: 'created',
    title: 'Refactor user profile data',
    projectKey: 'TSF-5',
    projectName: 'testsdf',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '4',
    type: 'created',
    title: 'Improve waiting list experience',
    projectKey: 'TSF-4',
    projectName: 'testsdf',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '5',
    type: 'created',
    title: 'Express checkout',
    projectKey: 'TSF-3',
    projectName: 'testsdf',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '6',
    type: 'created',
    title: 'What are archived ideas?',
    projectKey: 'TSF-1',
    projectName: 'testsdf',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '7',
    type: 'created',
    title: 'test gorevi',
    projectKey: 'TEST-1',
    projectName: 'Test',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
  {
    id: '8',
    type: 'created',
    title: 'sdfsdf',
    projectKey: 'DES-1',
    projectName: 'Destek',
    timestamp: 'Olusturuldu',
    user: currentUser,
  },
]

// Applications
export const applicationCategories: ApplicationCategory[] = [
  {
    title: 'Uygulamalariniz',
    description: 'trello-cal-sma-alansdfsdf',
    apps: [
      { id: 'csm', name: 'Customer Service Management', icon: 'headphones', iconBg: '#36B37E', href: '/apps/csm' },
      { id: 'goals', name: 'Goals', icon: 'target', iconBg: '#6554C0', href: '/goals' },
      { id: 'product-discovery', name: 'Youtorch Product Discovery', icon: 'compass', iconBg: '#36B37E', href: '/product-discovery' },
      { id: 'service-management', name: 'Youtorch Service Management', icon: 'zap', iconBg: '#FFAB00', href: '/service-management' },
      { id: 'projects', name: 'Projects', icon: 'folder', iconBg: '#0052CC', href: '/projects' },
      { id: 'teams', name: 'Teams', icon: 'users', iconBg: '#0052CC', href: '/teams' },
    ],
  },
  {
    title: 'Organizasyonunuz genelinde kullanilabilir',
    apps: [
      { id: 'trello', name: 'Trello', icon: 'trello', iconBg: '#0079BF', href: '/trello' },
    ],
  },
]

export const youtorchLinks: Application[] = [
  { id: 'account', name: 'Account settings', icon: 'settings', href: '/account' },
  { id: 'support', name: 'Youtorch Support', icon: 'help', href: '/support' },
  { id: 'community', name: 'Youtorch Community', icon: 'users', href: '/community' },
  { id: 'licensing', name: 'Self-managed licensing', icon: 'file', href: '/licensing' },
  { id: 'docs', name: 'Youtorch Documentation', icon: 'file', href: '/docs' },
  { id: 'products', name: 'Try Youtorch products', icon: 'box', href: '/products' },
  { id: 'website', name: 'Youtorch.com', icon: 'link', href: 'https://youtorch.com', isExternal: true },
]

// Goals
export const goals: Goal[] = [
  {
    id: 'sdfsdf',
    name: 'sdfsdf',
    type: 'goal',
    status: 'on-track',
    progress: 0,
    owner: currentUser,
    followers: [],
    teams: [],
    tags: [],
    startDate: '2026-03-27',
    risks: [
      {
        id: 'risk-1',
        title: 'test risk',
        description: 'race condition dikkat et',
        author: currentUser,
        createdAt: 'bir dakikadan az sonra',
        reactions: [],
      },
    ],
    decisions: [],
  },
]

// Idea Themes
export const ideaThemes: IdeaTheme[] = [
  { id: 'increase-revenue', name: 'Increase revenue', icon: 'trending-up', color: '#36B37E' },
  { id: 'win-enterprise', name: 'Win enterprise customers', icon: 'building', color: '#36B37E' },
  { id: 'delight-users', name: 'Delight users', icon: 'heart', color: '#FF5630' },
  { id: 'expand-horizons', name: 'Expand horizons', icon: 'globe', color: '#6554C0' },
]

// Ideas
export const ideas: Idea[] = [
  {
    id: 'tsf-2',
    summary: 'New rewards program',
    theme: ideaThemes[0],
    riceScore: 1500,
    impact: 5,
    effort: 2,
    customerSegments: ['Enterprise'],
  },
  {
    id: 'tsf-3',
    summary: 'Express checkout',
    theme: ideaThemes[1],
    riceScore: 568,
    impact: 5,
    effort: 1,
    customerSegments: ['Startups'],
  },
  {
    id: 'tsf-4',
    summary: 'Improve waiting list experience',
    theme: ideaThemes[2],
    riceScore: 252,
    impact: 4,
    effort: 4,
    customerSegments: ['SMB', 'Startups'],
  },
  {
    id: 'tsf-5',
    summary: 'Refactor user profile data',
    theme: ideaThemes[2],
    riceScore: 86.3,
    impact: 3,
  },
  {
    id: 'tsf-6',
    summary: 'Explore VR travel features',
    theme: ideaThemes[3],
    riceScore: 6,
    impact: 1,
  },
]

// Automation Rules
export const automationRules: AutomationRule[] = [
  {
    id: 'rule-1',
    name: 'Basliksiz kural',
    status: 'new',
    trigger: {
      id: 'trigger-1',
      type: 'trigger',
      title: 'Etkinlik: Su alan icin deger degisiklikleri:',
      description: 'Bilesenler',
      icon: 'code',
      iconColor: '#0052CC',
    },
    nodes: [
      {
        id: 'action-1',
        type: 'action',
        title: 'Islem: E-posta gonderin',
        description: 'Atanan Kisi\nSifir ve Sifira yakin Raspberry pi\'ler + Homelab - Cluster Sistemimi Satiyorum (Toplu satis)',
        icon: 'mail',
        iconColor: '#0052CC',
        children: [
          {
            id: 'branch-1',
            type: 'branch',
            title: 'Su AQL icin:',
            icon: 'git-branch',
            iconColor: '#6554C0',
            children: [
              {
                id: 'action-2',
                type: 'action',
                title: 'Islem: Islem ekleyin',
                description: 'Kuralin yapacagi islem',
                icon: 'zap',
                iconColor: '#FFAB00',
              },
            ],
          },
        ],
      },
    ],
    createdAt: '2026-03-27',
    updatedAt: '2026-03-27',
  },
  {
    id: 'rule-2',
    name: 'Youtorch\'taki hatalari siniflandirmak icin Rovo Aracisi\'ni kullanin',
    status: 'new',
    trigger: {
      id: 'trigger-2',
      type: 'trigger',
      title: 'Etkinlik: Bilet olusturuldu',
      description: 'Kural, bir bilet olusturuldugunda calistirilir.',
      icon: 'plus',
      iconColor: '#0052CC',
    },
    nodes: [
      {
        id: 'condition-1',
        type: 'condition',
        title: 'Konu Turu belirtilen degere sahip',
        description: '...',
        icon: 'filter',
        iconColor: '#FFAB00',
        hasError: true,
        children: [
          {
            id: 'action-3',
            type: 'action',
            title: 'Islem: Temsilciyi kullan',
            description: 'Analyse the description of {{issue.url}}. How could it improve?',
            icon: 'rovo',
            iconColor: '#FF5630',
            hasError: true,
            errorCount: 1,
          },
        ],
      },
      {
        id: 'action-4',
        type: 'action',
        title: 'Ve: Biletya yorum ekle',
        description: '{{agentResponse}}',
        icon: 'message',
        iconColor: '#0052CC',
      },
    ],
    createdAt: '2026-03-27',
    updatedAt: '2026-03-27',
  },
]

// Action Categories for Rule Builder
export const actionCategories: ActionCategory[] = [
  {
    name: 'Rovo',
    count: 1,
    items: [
      { id: 'rovo-agent', name: 'Temsilciyi kullan', icon: 'rovo', iconColor: '#FF5630', category: 'Rovo' },
    ],
  },
  {
    name: 'Otomasyon',
    count: 7,
    items: [
      { id: 'search-table', name: 'Arama tablosu olustur', icon: 'search', category: 'Otomasyon' },
      { id: 'variable', name: 'Degisken olustur', icon: 'code', category: 'Otomasyon' },
      { id: 'dynamic-search', name: 'Dinamik arama tablosu olusturun', icon: 'table', category: 'Otomasyon' },
      { id: 'email', name: 'E-posta gonder', icon: 'mail', category: 'Otomasyon' },
      { id: 'daily', name: 'Gunluk islemi', icon: 'calendar', category: 'Otomasyon' },
      { id: 'custom-email', name: 'Ozellesitirilmis e-posta gonderin', icon: 'mail', category: 'Otomasyon' },
      { id: 'web-request', name: 'Web talebi gonder', icon: 'globe', category: 'Otomasyon' },
    ],
  },
  {
    name: 'Bitbucket',
    count: 1,
    items: [
      { id: 'bitbucket-branch', name: 'Bitbucket\'ta dal olustur', icon: 'git-branch', iconColor: '#0052CC', category: 'Bitbucket' },
    ],
  },
  {
    name: 'Confluence',
    count: 2,
    items: [
      { id: 'confluence-page', name: 'Confluence sayfasi olustur', icon: 'file', iconColor: '#0052CC', category: 'Confluence' },
      { id: 'confluence-comment', name: 'Confluence yorumu ekle', icon: 'message', iconColor: '#0052CC', category: 'Confluence' },
    ],
  },
]

// YouTube Workflows
export const workflows: Workflow[] = [
  {
    id: 'wf-shorts-factory',
    name: 'Shorts Factory',
    description: 'Long-form videolardan Shorts adaylarini cikarir, render eder ve kanala planlar.',
    channel: 'Youtorch Labs',
    owner: 'Anil Bey',
    status: 'active',
    triggerType: 'youtube-event',
    triggerLabel: 'Yeni uzun video yayinlandiginda',
    schedule: 'Event tabanli',
    lastRunAt: 'Bugun 20:42',
    lastRunStatus: 'success',
    nextRunAt: 'Siradaki yeni video',
    runCount24h: 18,
    averageCost: '8c',
    successRate: 97,
    nodesCount: 7,
    updatedAt: '22 Nis 2026',
    metrics: [
      { label: '24s run', value: '18', tone: 'info' },
      { label: 'Basari', value: '97%', tone: 'success' },
      { label: 'Ort. cost', value: '8c' },
    ],
    nodes: [
      {
        id: 'trigger-upload',
        title: 'YouTube video detected',
        subtitle: 'Trigger',
        kind: 'trigger',
        provider: 'YouTube',
        status: 'success',
        cost: '0c',
        description: 'Kanalda yeni long-form video yayinlandiginda akisi baslatir.',
        position: { x: 40, y: 140 },
        outputs: ['videoId', 'transcript', 'thumbnail'],
      },
      {
        id: 'ai-segments',
        title: 'Hook & segment finder',
        subtitle: 'AI analysis',
        kind: 'ai',
        provider: 'Youtorch AI',
        status: 'success',
        cost: '3c',
        description: 'Transkripti tarar, ilk 3 saniyesi guclu olan Shorts adaylarini puanlar.',
        position: { x: 390, y: 70 },
        inputs: ['transcript'],
        outputs: ['shortlist', 'hookScore'],
      },
      {
        id: 'logic-approval',
        title: 'Brand safety gate',
        subtitle: 'Logic',
        kind: 'logic',
        provider: 'Rules',
        status: 'warning',
        cost: '0c',
        description: 'Kufur, telif riski ve sponsor mention kontrollerinden gecirir.',
        position: { x: 730, y: 70 },
        inputs: ['shortlist'],
        outputs: ['approvedClips'],
      },
      {
        id: 'render-short',
        title: 'Vertical render',
        subtitle: 'Render',
        kind: 'render',
        provider: 'Render / FFmpeg',
        status: 'running',
        cost: '4c',
        description: '9:16 crop, altyazi, progress bar ve intro/outro bind islemlerini uygular.',
        position: { x: 1070, y: 70 },
        inputs: ['approvedClips'],
        outputs: ['mp4'],
      },
      {
        id: 'publish-schedule',
        title: 'Schedule to channel',
        subtitle: 'Publish',
        kind: 'publish',
        provider: 'YouTube',
        status: 'success',
        cost: '1c',
        description: 'Baslik, aciklama, hashtag ve yayin saatiyle Shorts videosunu planlar.',
        position: { x: 1410, y: 70 },
        inputs: ['mp4', 'metadata'],
        outputs: ['scheduledVideo'],
      },
      {
        id: 'ai-title',
        title: 'Title variants',
        subtitle: 'AI copy',
        kind: 'ai',
        provider: 'Youtorch AI',
        status: 'success',
        cost: '1c',
        description: 'CTR odakli 5 baslik alternatifi ve hashtag seti uretir.',
        position: { x: 730, y: 270 },
        inputs: ['shortlist'],
        outputs: ['metadata'],
      },
      {
        id: 'analytics-watch',
        title: 'First-hour watcher',
        subtitle: 'Analytics',
        kind: 'analytics',
        provider: 'YouTube Studio',
        status: 'success',
        cost: '0c',
        description: 'Yayin sonrasi ilk saat retention ve swipe-away sinyallerini izler.',
        position: { x: 1410, y: 270 },
        inputs: ['scheduledVideo'],
        outputs: ['runReport'],
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-upload', target: 'ai-segments' },
      { id: 'e2', source: 'ai-segments', target: 'logic-approval' },
      { id: 'e3', source: 'logic-approval', target: 'render-short', label: 'approved' },
      { id: 'e4', source: 'render-short', target: 'publish-schedule' },
      { id: 'e5', source: 'ai-segments', target: 'ai-title', label: 'metadata' },
      { id: 'e6', source: 'ai-title', target: 'publish-schedule' },
      { id: 'e7', source: 'publish-schedule', target: 'analytics-watch' },
    ],
  },
  {
    id: 'wf-weekly-research',
    name: 'Weekly Topic Radar',
    description: 'Rakip kanallari, trend aramalarini ve yorumlari tarayip haftalik icerik plani uretir.',
    channel: 'Youtorch Labs',
    owner: 'Anil Bey',
    status: 'active',
    triggerType: 'schedule',
    triggerLabel: 'Haftalik plan',
    schedule: 'Pazartesi 09:00',
    lastRunAt: '20 Nis 2026',
    lastRunStatus: 'success',
    nextRunAt: '27 Nis 2026',
    runCount24h: 1,
    averageCost: '14c',
    successRate: 100,
    nodesCount: 6,
    updatedAt: '20 Nis 2026',
    metrics: [
      { label: 'Plan', value: '12 fikir', tone: 'info' },
      { label: 'Basari', value: '100%', tone: 'success' },
      { label: 'Ort. cost', value: '14c' },
    ],
    nodes: [
      {
        id: 'trigger-weekly',
        title: 'Weekly schedule',
        subtitle: 'Trigger',
        kind: 'trigger',
        provider: 'Scheduler',
        status: 'success',
        cost: '0c',
        description: 'Her pazartesi ekip planlama toplantisindan once calisir.',
        position: { x: 40, y: 150 },
        outputs: ['weekRange'],
      },
      {
        id: 'provider-trends',
        title: 'Trend collector',
        subtitle: 'Provider',
        kind: 'provider',
        provider: 'YouTube + Google',
        status: 'success',
        cost: '2c',
        description: 'Arama trendleri, rakip basliklari ve yorum sinyallerini toplar.',
        position: { x: 390, y: 150 },
        inputs: ['weekRange'],
        outputs: ['trendPack'],
      },
      {
        id: 'ai-brief',
        title: 'Content strategist',
        subtitle: 'AI planning',
        kind: 'ai',
        provider: 'Youtorch AI',
        status: 'success',
        cost: '8c',
        description: 'Trendleri kanal hedefleriyle eslestirip fikir briefleri uretir.',
        position: { x: 740, y: 150 },
        inputs: ['trendPack'],
        outputs: ['briefs'],
      },
      {
        id: 'publish-board',
        title: 'Push to content board',
        subtitle: 'Publish',
        kind: 'publish',
        provider: 'Youtorch',
        status: 'success',
        cost: '1c',
        description: 'Onaylanan briefleri icerik panosuna gorev olarak ekler.',
        position: { x: 1090, y: 150 },
        inputs: ['briefs'],
        outputs: ['contentTasks'],
      },
    ],
    edges: [
      { id: 'wr1', source: 'trigger-weekly', target: 'provider-trends' },
      { id: 'wr2', source: 'provider-trends', target: 'ai-brief' },
      { id: 'wr3', source: 'ai-brief', target: 'publish-board' },
    ],
  },
  {
    id: 'wf-comment-escalation',
    name: 'Comment Escalation',
    description: 'Yuksek niyetli veya riskli yorumlari siniflandirip ekibe aksiyon olarak atar.',
    channel: 'Founder Notes',
    owner: 'Ayse Hanim',
    status: 'paused',
    triggerType: 'youtube-event',
    triggerLabel: 'Yeni yorum',
    schedule: 'Event tabanli',
    lastRunAt: 'Dun 18:12',
    lastRunStatus: 'warning',
    nextRunAt: 'Duraklatildi',
    runCount24h: 0,
    averageCost: '2c',
    successRate: 91,
    nodesCount: 5,
    updatedAt: '21 Nis 2026',
    metrics: [
      { label: 'Atanan', value: '6', tone: 'warning' },
      { label: 'Basari', value: '91%', tone: 'success' },
      { label: 'Ort. cost', value: '2c' },
    ],
    nodes: [
      {
        id: 'trigger-comment',
        title: 'New comment',
        subtitle: 'Trigger',
        kind: 'trigger',
        provider: 'YouTube',
        status: 'success',
        cost: '0c',
        description: 'Kanalda yeni yorum olustugunda calisir.',
        position: { x: 40, y: 150 },
        outputs: ['comment'],
      },
      {
        id: 'ai-classify',
        title: 'Intent classifier',
        subtitle: 'AI analysis',
        kind: 'ai',
        provider: 'Youtorch AI',
        status: 'warning',
        cost: '2c',
        description: 'Satinalma niyeti, sikayet ve moderasyon riskini etiketler.',
        position: { x: 390, y: 150 },
        inputs: ['comment'],
        outputs: ['intent'],
      },
      {
        id: 'logic-route',
        title: 'Route by intent',
        subtitle: 'Logic',
        kind: 'logic',
        provider: 'Rules',
        status: 'success',
        cost: '0c',
        description: 'Yorumu destek, satis veya moderator kuyruguna yollar.',
        position: { x: 740, y: 150 },
        inputs: ['intent'],
        outputs: ['queueItem'],
      },
    ],
    edges: [
      { id: 'ce1', source: 'trigger-comment', target: 'ai-classify' },
      { id: 'ce2', source: 'ai-classify', target: 'logic-route' },
    ],
  },
  {
    id: 'wf-sponsor-render',
    name: 'Sponsor Cutdown Pipeline',
    description: 'Sponsor mention bolumlerini bulur, kisa varyant render eder ve editor onayina gonderir.',
    channel: 'Build in Public TR',
    owner: 'Mehmet Bey',
    status: 'draft',
    triggerType: 'manual',
    triggerLabel: 'Manuel run',
    schedule: 'Planlanmadi',
    lastRunAt: 'Hic calismadi',
    lastRunStatus: 'never',
    nextRunAt: 'Taslak',
    runCount24h: 0,
    averageCost: '0c',
    successRate: 0,
    nodesCount: 4,
    updatedAt: '22 Nis 2026',
    metrics: [
      { label: 'Taslak', value: '4 node', tone: 'default' },
      { label: 'Basari', value: '-', tone: 'default' },
      { label: 'Ort. cost', value: '0c' },
    ],
    nodes: [
      {
        id: 'manual-trigger',
        title: 'Manual start',
        subtitle: 'Trigger',
        kind: 'trigger',
        provider: 'Youtorch',
        status: 'never',
        cost: '0c',
        description: 'Editor video secip pipeline baslatir.',
        position: { x: 40, y: 150 },
        outputs: ['videoUrl'],
      },
      {
        id: 'ai-sponsor',
        title: 'Sponsor mention finder',
        subtitle: 'AI analysis',
        kind: 'ai',
        provider: 'Youtorch AI',
        status: 'never',
        cost: '0c',
        description: 'Sponsor bolumlerini ve CTA cumlelerini tespit eder.',
        position: { x: 390, y: 150 },
        inputs: ['videoUrl'],
        outputs: ['segments'],
      },
      {
        id: 'render-sponsor',
        title: 'Cutdown render',
        subtitle: 'Render',
        kind: 'render',
        provider: 'Render / FFmpeg',
        status: 'never',
        cost: '0c',
        description: '15, 30 ve 45 saniyelik sponsor varyantlarini render eder.',
        position: { x: 740, y: 150 },
        inputs: ['segments'],
        outputs: ['variants'],
      },
    ],
    edges: [
      { id: 'sc1', source: 'manual-trigger', target: 'ai-sponsor' },
      { id: 'sc2', source: 'ai-sponsor', target: 'render-sponsor' },
    ],
  },
]

import type { Metadata } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import { getLocale, getMessages, getNow, getTranslations } from 'next-intl/server'
import { QueryProvider } from '@/components/providers/query-provider'
import { IntlProvider } from '@/components/providers/intl-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShellBoundary } from '@/components/layout/app-shell-boundary'
import { NavigationProgress } from '@/components/layout/navigation-progress'
import { Toaster } from '@/components/ui/sonner'
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '@/components/layout/layout-preferences'
import type { AppLocale } from '@/i18n/config'
import { motionUiEnabled } from '@/lib/motion-editor/motion-switch'
import './globals.css'

// Self-hosted variable fonts (latin + latin-ext, see app/fonts/THIRD_PARTY_FONTS.md) so that
// `next build` never downloads from Google Fonts.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  weight: '500 700',
  style: 'normal',
  variable: '--font-space-grotesk',
  display: 'swap',
})
const sidebarPreferenceBootstrapScript = `
  (() => {
    try {
      const storedWidth = Number(window.localStorage.getItem(${JSON.stringify(SIDEBAR_WIDTH_STORAGE_KEY)}));
      const width = Number.isFinite(storedWidth) && storedWidth > 0
        ? Math.min(${SIDEBAR_MAX_WIDTH}, Math.max(${SIDEBAR_MIN_WIDTH}, Math.round(storedWidth)))
        : ${SIDEBAR_DEFAULT_WIDTH};
      const collapsed = window.localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_STORAGE_KEY)}) === 'true';
      document.documentElement.style.setProperty('--youtorch-sidebar-width', width + 'px');
      document.documentElement.dataset.youtorchSidebarCollapsed = String(collapsed);
    } catch {}
  })();
`

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return {
    title: 'Youtorch',
    description: t('workspaceDescription'),
    generator: 'v0.app',
    icons: {
      icon: [
        {
          url: '/icon-light-32x32.png',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/icon-dark-32x32.png',
          media: '(prefers-color-scheme: dark)',
        },
        { url: '/youtorch-logo.png', type: 'image/png' },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, messages, now] = await Promise.all([getLocale(), getMessages(), getNow()])

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarPreferenceBootstrapScript }} />
      </head>
      <body className="bg-background font-sans antialiased" suppressHydrationWarning>
        <IntlProvider locale={locale as AppLocale} messages={messages} now={now}>
          <ThemeProvider
            attribute="class"
            themes={['light', 'dark', 'paper']}
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              {/* E1-D: the sidebar's Motion entry is the UI pod's `MOTION_UI_ENABLED` switch, read per request (default off). */}
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              <AppShellBoundary motionEnabled={motionUiEnabled()}>{children}</AppShellBoundary>
              <Toaster position="bottom-right" richColors closeButton />
            </QueryProvider>
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  )
}

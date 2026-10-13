import createNextIntlPlugin from 'next-intl/plugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.dirname(fileURLToPath(import.meta.url))

// yt-2: UI-only clone of Youtorch. No API proxy, no Firebase: all data comes from ./mock.
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  turbopack: {
    root: appDir,
  },
  // Type checking runs separately (`npm run typecheck`); the dev server and build only compile.
  typescript: {
    ignoreBuildErrors: true,
  },
}

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

export default withNextIntl(nextConfig)

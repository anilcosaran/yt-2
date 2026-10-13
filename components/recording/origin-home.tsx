import { getTranslations } from 'next-intl/server'

export async function OriginHome() {
  const t = await getTranslations('OriginHome')
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-3xl text-foreground">{t('title')}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t('description')}</p>
      </div>
    </main>
  )
}

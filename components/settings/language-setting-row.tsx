'use client'

import * as React from 'react'
import { Languages, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LanguageFlagIcon } from '@/components/i18n/language-flag-icon'
import { createBrowserAccountClient } from '@/components/account/browser-account-client'
import type { AppLocale } from '@/i18n/config'
import { saveLocaleCookie } from '@/i18n/client-locale'
import { getLanguageDisplay } from '@/lib/i18n/language-display'

export function LanguageSettingRow() {
  const locale = useLocale() as AppLocale
  const t = useTranslations('Locale')
  const router = useRouter()
  const accountClient = React.useMemo(() => createBrowserAccountClient(), [])
  const [pendingLocale, setPendingLocale] = React.useState<AppLocale | null>(null)
  const selectedLocale = pendingLocale ?? locale

  const updateLocale = async (nextLocale: string) => {
    if ((nextLocale !== 'en' && nextLocale !== 'tr') || nextLocale === locale) return

    setPendingLocale(nextLocale)
    try {
      await accountClient.updateProfile({ preferred_locale: nextLocale })
      await saveLocaleCookie(nextLocale)

      document.documentElement.lang = nextLocale
      toast.success(t('saved'))
      router.refresh()
    } catch {
      toast.error(t('saveError'))
    } finally {
      setPendingLocale(null)
    }
  }

  return (
    <div className="grid gap-3 border-b border-border py-4 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(140px,190px)_minmax(0,1fr)] sm:items-center">
      <div className="flex min-w-0 items-start gap-2">
        <Languages className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 break-words text-sm font-semibold leading-5 text-foreground">{t('language')}</p>
      </div>
      <div className="flex min-w-0 justify-start sm:justify-end">
        <Select value={selectedLocale} onValueChange={updateLocale} disabled={Boolean(pendingLocale)}>
          <SelectTrigger className="h-8 w-full max-w-[220px] shadow-none sm:w-[220px]" aria-label={t('language')}>
            {pendingLocale ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            <SelectValue>
              <span className="flex min-w-0 items-center gap-2">
                <LanguageFlagIcon region={getLanguageDisplay(selectedLocale).flagRegion} />
                <span className="shrink-0 text-[10px] font-bold tracking-wide text-foreground">{selectedLocale.toUpperCase()}</span>
                <span className="truncate">{selectedLocale === 'tr' ? t('turkish') : t('english')}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['en', 'tr'] as const).map((option) => (
              <SelectItem key={option} value={option}>
                <span className="flex items-center gap-2">
                  <LanguageFlagIcon region={getLanguageDisplay(option).flagRegion} />
                  <span className="shrink-0 text-[10px] font-bold tracking-wide text-foreground">{option.toUpperCase()}</span>
                  <span>{option === 'tr' ? t('turkish') : t('english')}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

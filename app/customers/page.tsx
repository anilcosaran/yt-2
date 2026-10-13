'use client'

import { Suspense, useCallback, type ComponentType } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { TabBar, TabBarItem } from '@/components/common/tab-bar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Building2, Package, Users } from 'lucide-react'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

type CustomerView = 'musteriler' | 'organizasyonlar' | 'urunler'

export default function CustomersPage() {
  return (
    <Suspense fallback={<WorkspaceRouteLoading />}>
      <CustomersContent />
    </Suspense>
  )
}

function CustomersContent() {
  const tAuto = useTranslations('Auto')
  const tCustomers = useTranslations('Customers')
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeView = getCustomerView(searchParams.get('view'))

  const handleViewChange = useCallback((value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('view', getCustomerView(value))

    router.push(`/customers?${nextParams.toString()}`)
  }, [router, searchParams])

  return (
    <div className="px-6 py-9 md:px-12">
        <PageHeader
          breadcrumbs={[
            { label: tCustomers('spaces') },
            { label: tAuto('musteriler_2ab9230a'), icon: Users },
          ]}
          icon={Users}
          title={tAuto('musteriler_2ab9230a')}
          badge={tCustomers('areaCount', { count: 3 })}
          description={tAuto('organizasyon_profil_ve_urun_iliskilerini_yonetin_d8393327')}
          className="mb-0"
        />

        <Tabs value={activeView} onValueChange={handleViewChange} className="w-full">
          <TabBar className="mt-4">
            <TabBarItem value="musteriler"><UiText id="musteriler_2ab9230a" /></TabBarItem>
            <TabBarItem value="organizasyonlar"><UiText id="organizasyonlar_735bee60" /></TabBarItem>
            <TabBarItem value="urunler"><UiText id="urunler_78bf5f03" /></TabBarItem>
          </TabBar>

          <TabsContent value="musteriler" className="mt-0">
            <Card className="rounded-lg border-border/80 py-0 shadow-none">
              <Empty className="min-h-[348px] justify-start rounded-lg border-0 bg-transparent px-6 pb-8 pt-[92px]">
                <EmptyMedia>
                  <CustomersIllustration />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-[22px] font-semibold leading-7 tracking-normal">
                    <UiText id="musteri_profilleriyle_baslayin_f59c64b6" /></EmptyTitle>
                  <EmptyDescription className="max-w-xl text-[15px] leading-6 text-foreground">
                    <UiText id="musterilerinizi_eklemeden_once_ilk_projenizi_olu_eb6f659a" /></EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="max-w-md gap-0 pt-1">
                  <Button size="sm" className="h-8 bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <UiText id="bir_proje_olustur_bc421c80" /></Button>
                </EmptyContent>
              </Empty>
            </Card>
          </TabsContent>

          <TabsContent value="organizasyonlar" className="mt-0">
            <PlaceholderPanel
              icon={Building2}
              title={tAuto('organizasyon_gorunumu_hazir_0d609f77')}
              description={tAuto('ajans_marka_ve_alt_ekip_yapilarinizi_organizasyo_05d29f81')}
            />
          </TabsContent>

          <TabsContent value="urunler" className="mt-0">
            <PlaceholderPanel
              icon={Package}
              title={tAuto('urun_kataloglari_buraya_gelir_5bb88698')}
              description={tAuto('plan_paket_ve_servis_varyasyonlarini_musterileri_68d920bd')}
            />
          </TabsContent>
        </Tabs>
    </div>
  )
}

function CustomersIllustration() {
  return (
    <svg width="152" height="88" viewBox="0 0 152 88" fill="none" aria-hidden="true">
      <circle cx="54" cy="32" r="20" fill="#36B37E" opacity="0.9" />
      <circle cx="79" cy="32" r="20" fill="#8EA7FF" opacity="0.92" />
      <circle cx="104" cy="32" r="20" fill="#FFAB00" opacity="0.95" />
      <path d="M54 24a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm-11 15c0-6.1 4.9-11 11-11s11 4.9 11 11v2H43v-2Z" fill="#172B4D" />
      <path d="M79 24a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm-11 15c0-6.1 4.9-11 11-11s11 4.9 11 11v2H68v-2Z" fill="#172B4D" />
      <path d="M104 24a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm-11 15c0-6.1 4.9-11 11-11s11 4.9 11 11v2H93v-2Z" fill="#172B4D" />
      <circle cx="121" cy="56" r="13" fill="#FF0033" />
      <path d="M121 50v12M115 56h12" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function PlaceholderPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Card className="rounded-lg border-border/80 py-0 shadow-none">
      <Empty className="min-h-[348px] justify-start rounded-lg border-0 bg-transparent px-6 pb-8 pt-[92px]">
        <EmptyMedia variant="icon">
          <Icon className="h-6 w-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-[22px] font-semibold leading-7 tracking-normal">{title}</EmptyTitle>
          <EmptyDescription className="max-w-lg text-[15px] leading-6 text-foreground">{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Card>
  )
}

function getCustomerView(view: string | null): CustomerView {
  if (view === 'musteriler' || view === 'organizasyonlar' || view === 'urunler') {
    return view
  }

  return 'musteriler'
}

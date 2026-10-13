'use client'

import { MainLayout } from '@/components/layout'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { GoalDetailPanel, RiskItem } from '@/components/goals'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Target, Eye, Bell, Archive, Users, Folder, ExternalLink, ChevronDown, Plus, Share2, Link2, MoreHorizontal, Calendar } from 'lucide-react'
import { goals, goalsSidebarItems, goalsExternalItems } from '@/lib/mock-data'
import type { NavItem } from '@/lib/types'
import Link from 'next/link'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export default function GoalsPage() {
  const tGoals = useTranslations('Goals')
  const goal = goals[0] // Get first goal for demo
  const sidebarItems: NavItem[] = [
    { id: 'amac-dizini', label: tGoals('nav.directory'), icon: 'target', href: '/goals', isActive: true },
    { id: 'takip-ediliyor', label: tGoals('nav.following'), icon: 'eye', href: '/goals/following' },
    { id: 'durum-guncellemeleri', label: tGoals('nav.updates'), icon: 'bell', href: '/goals/updates' },
    { id: 'arsivlendi', label: tGoals('nav.archived'), icon: 'archive', href: '/goals/archived' },
  ]
  const externalItems: NavItem[] = [
    { id: 'teams', label: tGoals('nav.teams'), icon: 'users', href: '/teams', isExternal: true },
    { id: 'projects', label: tGoals('nav.projects'), icon: 'folder', href: '/projects', isExternal: true },
  ]

  return (
    <MainLayout
      appName={tGoals('nav.goals')}
      appIcon={<Target className="h-6 w-6 text-primary" />}
      sidebarItems={sidebarItems}
      sidebarBottomItems={externalItems}
    >
      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Breadcrumb */}
            <Breadcrumb
              items={[
                { label: tGoals('nav.goals'), href: '/goals' },
                { label: goal?.name || 'Goal' },
              ]}
              className="mb-4"
            />

            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{goal?.name}</h1>
                  <p className="text-sm text-muted-foreground"><UiText id="amac_d232a808" /></p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-1 bg-success text-success-foreground hover:bg-success/90">
                      <UiText id="plana_uygun_fa527909" /><ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem><UiText id="plana_uygun_fa527909" /></DropdownMenuItem>
                    <DropdownMenuItem><UiText id="risk_altinda_fbe80fb9" /></DropdownMenuItem>
                    <DropdownMenuItem><UiText id="yoldan_cikti_405efc33" /></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Date Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-1">
                      <Calendar className="h-4 w-4" />
                      <UiText id="agustos_de14d0d0" /><ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem><UiText id="ocak_2038c538" /></DropdownMenuItem>
                    <DropdownMenuItem><UiText id="subat_bb39cb25" /></DropdownMenuItem>
                    <DropdownMenuItem><UiText id="mart_85276c44" /></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" className="gap-1">
                  <UiText id="takip_e_55c5be2b" /></Button>

                <Button variant="outline" className="gap-1">
                  <Share2 className="h-4 w-4" />
                  <UiText id="paylas_17b2471d" /></Button>

                <Button variant="ghost" size="icon">
                  <Link2 className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="riskler" className="w-full">
              <TabsList className="mb-4 h-auto bg-transparent p-0 border-b border-border w-full justify-start rounded-none">
                <TabsTrigger
                  value="genel-bakis"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="genel_bakis_625b2abe" /></TabsTrigger>
                <TabsTrigger
                  value="guncellemeler"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="guncellemeler_d089e876" /><span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">2</span>
                </TabsTrigger>
                <TabsTrigger
                  value="youtorch"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="youtorch_020aa912" /></TabsTrigger>
                <TabsTrigger
                  value="projeler"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="projeler_87595b8d" /></TabsTrigger>
                <TabsTrigger
                  value="ogrenilenler"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="ogrenilenler_b8227139" /></TabsTrigger>
                <TabsTrigger
                  value="riskler"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="riskler_85826e34" /><span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">1</span>
                </TabsTrigger>
                <TabsTrigger
                  value="kararlar"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <UiText id="kararlar_7a531cf9" /></TabsTrigger>
              </TabsList>

              <TabsContent value="riskler" className="mt-0">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-foreground">
                    <UiText id="hangi_riskleri_belirlediniz_30440079" /></h2>

                  {/* Add Risk Button */}
                  <button className="flex w-full items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                    <Plus className="h-4 w-4" />
                    <UiText id="yeni_bir_risk_ekle_8d12584f" /></button>

                  {/* Risk List */}
                  {goal?.risks?.map((risk) => (
                    <RiskItem key={risk.id} risk={risk} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="genel-bakis" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="genel_bakis_icerigi_burada_gorunecek_e98ac8cc" /></div>
              </TabsContent>

              <TabsContent value="guncellemeler" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="guncellemeler_burada_gorunecek_5c9c1ccb" /></div>
              </TabsContent>

              <TabsContent value="youtorch" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="youtorch_entegrasyonu_burada_gorunecek_cc0ea84d" /></div>
              </TabsContent>

              <TabsContent value="projeler" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="projeler_burada_gorunecek_44e28ba3" /></div>
              </TabsContent>

              <TabsContent value="ogrenilenler" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="ogrenilenler_burada_gorunecek_dfe42577" /></div>
              </TabsContent>

              <TabsContent value="kararlar" className="mt-0">
                <div className="py-8 text-center text-muted-foreground">
                  <UiText id="kararlar_burada_gorunecek_3969456b" /></div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Panel */}
        {goal && <GoalDetailPanel goal={goal} />}
      </div>
    </MainLayout>
  )
}

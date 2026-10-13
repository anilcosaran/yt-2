'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { NavItem } from '@/lib/types'
import { Home, AlertCircle, Terminal } from 'lucide-react'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

const uiComponents = [
  'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'avatar', 'badge', 'breadcrumb', 'button', 'button-group',
  'calendar', 'card', 'carousel', 'chart', 'checkbox', 'collapsible', 'command', 'context-menu', 'dialog', 'drawer',
  'dropdown-menu', 'empty', 'field', 'form', 'hover-card', 'input', 'input-group', 'input-otp', 'item', 'kbd', 'label',
  'menubar', 'navigation-menu', 'pagination', 'popover', 'progress', 'radio-group', 'resizable', 'scroll-area', 'select',
  'separator', 'sheet', 'sidebar', 'skeleton', 'slider', 'sonner', 'spinner', 'switch', 'table', 'tabs', 'textarea',
  'toast', 'toaster', 'toggle', 'toggle-group', 'tooltip', 'use-mobile', 'use-toast',
]

const layoutComponents = ['app-header', 'app-sidebar', 'breadcrumb', 'main-layout']
const dashboardComponents = ['activity-feed', 'area-card']
const commonComponents = ['data-table-toolbar', 'impact-dots', 'score-badge', 'segment-badge', 'theme-tag']
const appsComponents = ['app-card']
const automationComponents = ['action-panel', 'flow-canvas', 'flow-node']
const goalsComponents = ['goal-detail-panel']
const ideasComponents = ['idea-detail-panel', 'idea-table']

export default function ComponentsPage() {
  const tAuto = useTranslations('Auto')
  const tPage = useTranslations('ComponentsPage')
  const sidebarItems: NavItem[] = [
    { id: 'home', label: tPage('home'), icon: 'home', href: '/' },
    {
      id: 'all-components',
      label: tPage('allComponents'),
      icon: 'puzzle',
      defaultOpen: true,
      children: [
        { id: 'ui-components', label: tPage('uiComponents'), href: '/components#ui-components', badge: uiComponents.length },
        { id: 'layout-components', label: tPage('layoutComponents'), href: '/components#layout-components', badge: layoutComponents.length },
        { id: 'dashboard-components', label: tPage('dashboardComponents'), href: '/components#dashboard-components', badge: dashboardComponents.length },
        { id: 'common-components', label: tPage('commonComponents'), href: '/components#common-components', badge: commonComponents.length },
        { id: 'apps-components', label: tPage('appsComponents'), href: '/components#apps-components', badge: appsComponents.length },
        { id: 'automation-components', label: tPage('automationComponents'), href: '/components#automation-components', badge: automationComponents.length },
        { id: 'goals-components', label: tPage('goalsComponents'), href: '/components#goals-components', badge: goalsComponents.length },
        { id: 'ideas-components', label: tPage('ideasComponents'), href: '/components#ideas-components', badge: ideasComponents.length },
      ],
    },
  ]
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [switchChecked, setSwitchChecked] = useState(true)
  const [togglePressed, setTogglePressed] = useState(false)
  const [sliderValue, setSliderValue] = useState([50])

  return (
    <MainLayout
      appName="Youtorch"
      sidebarTitle={tPage('components')}
      sidebarBackHref="/"
      sidebarBackLabel={tPage('home')}
      sidebarItems={sidebarItems}
    >
      <div className="p-6 space-y-10">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground"><UiText id="component_kutuphanesi_5cf5c29f" /></h1>
          <p className="text-muted-foreground mt-1">
            <UiText id="projede_kullan_lan_tum_react_component_lerinin_l_9456d936" /></p>
        </div>

        {/* Live Examples Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold"><UiText id="canl_ornekler_4de66adc" /></h2>

          {/* Buttons */}
          <ComponentShowcase title={tAuto('button_794145f0')}>
            <div className="flex flex-wrap gap-2">
              <Button><UiText id="primary_a9a96ec0" /></Button>
              <Button variant="secondary"><UiText id="secondary_025de599" /></Button>
              <Button variant="destructive"><UiText id="destructive_f58c8364" /></Button>
              <Button variant="outline"><UiText id="outline_cdd6290b" /></Button>
              <Button variant="ghost"><UiText id="ghost_bf44c985" /></Button>
              <Button variant="link"><UiText id="link_d0517071" /></Button>
              <Button size="sm"><UiText id="small_c74fd971" /></Button>
              <Button size="lg"><UiText id="large_738fd1d2" /></Button>
            </div>
          </ComponentShowcase>

          {/* Badges */}
          <ComponentShowcase title={tAuto('badge_6d12c8ad')}>
            <div className="flex flex-wrap gap-2">
              <Badge><UiText id="default_808d7dca" /></Badge>
              <Badge variant="secondary"><UiText id="secondary_025de599" /></Badge>
              <Badge variant="outline"><UiText id="outline_cdd6290b" /></Badge>
              <Badge variant="destructive"><UiText id="destructive_f58c8364" /></Badge>
            </div>
          </ComponentShowcase>

          {/* Card */}
          <ComponentShowcase title={tAuto('card_4d4ce73b')}>
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle><UiText id="kart_basl_g_bbc1124d" /></CardTitle>
                <CardDescription><UiText id="kart_ac_klamas_burada_yer_al_r_78179177" /></CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground"><UiText id="kart_icerigi_ornegi_9ee92196" /></p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" size="sm"><UiText id="iptal_85e2d087" /></Button>
                <Button size="sm"><UiText id="kaydet_b8094407" /></Button>
              </CardFooter>
            </Card>
          </ComponentShowcase>

          {/* Input */}
          <ComponentShowcase title={tAuto('input_b568d47f')}>
            <div className="grid w-full max-w-sm gap-1.5">
              <Label htmlFor="email"><UiText id="email_84add5b2" /></Label>
              <Input type="email" id="email" placeholder={tAuto('ornek_email_com_50d5e055')} />
            </div>
          </ComponentShowcase>

          {/* Textarea */}
          <ComponentShowcase title={tAuto('textarea_181339fc')}>
            <div className="grid w-full max-w-sm gap-1.5">
              <Label htmlFor="message"><UiText id="mesaj_d507ef05" /></Label>
              <Textarea id="message" placeholder={tAuto('mesaj_n_z_buraya_yaz_n_cac5e104')} />
            </div>
          </ComponentShowcase>

          {/* Avatar */}
          <ComponentShowcase title={tAuto('avatar_7631b26e')}>
            <div className="flex gap-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt={tAuto('shadcn_d8f20d3c')} />
                <AvatarFallback><UiText id="cn_5065f368" /></AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback><UiText id="ab_06d94594" /></AvatarFallback>
              </Avatar>
            </div>
          </ComponentShowcase>

          {/* Switch */}
          <ComponentShowcase title={tAuto('switch_3e44c920')}>
            <div className="flex items-center space-x-2">
              <Switch id="airplane-mode" checked={switchChecked} onCheckedChange={setSwitchChecked} />
              <Label htmlFor="airplane-mode"><UiText id="ucak_modu_cd2bcdd0" /></Label>
            </div>
          </ComponentShowcase>

          {/* Checkbox */}
          <ComponentShowcase title={tAuto('checkbox_1d66c3d0')}>
            <div className="flex items-center space-x-2">
              <Checkbox id="terms" />
              <Label htmlFor="terms"><UiText id="kabul_ediyorum_429e7f33" /></Label>
            </div>
          </ComponentShowcase>

          {/* Slider */}
          <ComponentShowcase title={tAuto('slider_aa5db7d8')}>
            <div className="w-full max-w-sm">
              <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
              <p className="text-sm text-muted-foreground mt-2"><UiText id="deger_07383f15" />{' '}{sliderValue[0]}</p>
            </div>
          </ComponentShowcase>

          {/* Progress */}
          <ComponentShowcase title={tAuto('progress_1b90271d')}>
            <div className="w-full max-w-sm">
              <Progress value={70} />
            </div>
          </ComponentShowcase>

          {/* Skeleton */}
          <ComponentShowcase title={tAuto('skeleton_4337ef33')}>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </ComponentShowcase>

          {/* Tabs */}
          <ComponentShowcase title={tAuto('tabs_2a4d562b')}>
            <Tabs defaultValue="account" className="w-full max-w-sm">
              <TabsList>
                <TabsTrigger value="account"><UiText id="hesap_43a3d4f5" /></TabsTrigger>
                <TabsTrigger value="password"><UiText id="sifre_6f26a444" /></TabsTrigger>
              </TabsList>
              <TabsContent value="account">
                <Card>
                  <CardHeader>
                    <CardTitle><UiText id="hesap_43a3d4f5" /></CardTitle>
                    <CardDescription><UiText id="hesap_ayarlar_n_z_buradan_yonetin_dc6b4a7e" /></CardDescription>
                  </CardHeader>
                </Card>
              </TabsContent>
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle><UiText id="sifre_6f26a444" /></CardTitle>
                    <CardDescription><UiText id="sifrenizi_buradan_degistirin_3e2bd9b1" /></CardDescription>
                  </CardHeader>
                </Card>
              </TabsContent>
            </Tabs>
          </ComponentShowcase>

          {/* Accordion */}
          <ComponentShowcase title={tAuto('accordion_21191a04')}>
            <Accordion type="single" collapsible className="w-full max-w-sm">
              <AccordionItem value="item-1">
                <AccordionTrigger><UiText id="bolum_1_af302901" /></AccordionTrigger>
                <AccordionContent><UiText id="bolum_1_icerigi_burada_d1bfb0ad" /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger><UiText id="bolum_2_6b5524ad" /></AccordionTrigger>
                <AccordionContent><UiText id="bolum_2_icerigi_burada_385f6eeb" /></AccordionContent>
              </AccordionItem>
            </Accordion>
          </ComponentShowcase>

          {/* Alert */}
          <ComponentShowcase title={tAuto('alert_b969680a')}>
            <div className="space-y-2 w-full max-w-sm">
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle><UiText id="bilgi_dd4350d2" /></AlertTitle>
                <AlertDescription><UiText id="varsay_lan_alert_bileseni_9c71b8b2" /></AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle><UiText id="hata_0223a963" /></AlertTitle>
                <AlertDescription><UiText id="bir_seyler_yanl_s_gitti_6455a5ad" /></AlertDescription>
              </Alert>
            </div>
          </ComponentShowcase>

          {/* Dialog */}
          <ComponentShowcase title={tAuto('dialog_a31bda55')}>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><UiText id="dialog_ac_d821d6fc" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle><UiText id="dialog_basl_g_d9c5a66f" /></DialogTitle>
                  <DialogDescription><UiText id="dialog_ac_klamas_burada_yer_al_r_390e03c0" /></DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground"><UiText id="dialog_icerigi_5fdb3815" /></p>
                </div>
                <DialogFooter>
                  <Button onClick={() => setDialogOpen(false)}><UiText id="kapat_9e6ecd59" /></Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ComponentShowcase>

          {/* Toast */}
          <ComponentShowcase title={tAuto('toast_sonner_9406492e')}>
            <Button
              variant="outline"
              onClick={() => toast.success(tPage('success'), { description: tPage('successDescription') })}
            >
              <UiText id="toast_goster_449cac23" /></Button>
          </ComponentShowcase>

          {/* Tooltip */}
          <ComponentShowcase title={tAuto('tooltip_b8407e25')}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline"><UiText id="uzerine_gel_adad3c89" /></Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p><UiText id="tooltip_icerigi_e42edaac" /></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ComponentShowcase>

          {/* Toggle */}
          <ComponentShowcase title={tAuto('toggle_d5e14b06')}>
            <Toggle pressed={togglePressed} onPressedChange={setTogglePressed} aria-label={tAuto('toggle_bold_89c9b295')}>
              <span className="text-sm">{togglePressed ? tAuto('ac_k_2b7ced27') : tAuto('kapal_67866966')}</span>
            </Toggle>
          </ComponentShowcase>

          {/* Breadcrumb */}
          <ComponentShowcase title={tAuto('breadcrumb_c766e665')}>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/"><UiText id="ana_sayfa_6f98bb3c" /></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/components"><UiText id="component_ler_9fb394aa" /></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage><UiText id="ui_9d578751" /></BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </ComponentShowcase>

          {/* Calendar */}
          <ComponentShowcase title={tAuto('calendar_adab5090')}>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border w-fit"
            />
          </ComponentShowcase>

          {/* Separator */}
          <ComponentShowcase title={tAuto('separator_b4b289a7')}>
            <div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium leading-none"><UiText id="basl_k_5fef0316" /></h4>
                <p className="text-sm text-muted-foreground"><UiText id="ac_klama_metni_2d01f2ef" /></p>
              </div>
              <Separator className="my-4" />
              <div className="flex h-5 items-center space-x-4 text-sm">
                <div><UiText id="blog_0b9d2b23" /></div>
                <Separator orientation="vertical" />
                <div><UiText id="dokuman_a44ae658" /></div>
                <Separator orientation="vertical" />
                <div><UiText id="kaynak_17626b40" /></div>
              </div>
            </div>
          </ComponentShowcase>
        </section>

        <Separator />

        {/* Component Lists */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold"><UiText id="tum_component_ler_a8bdefef" /></h2>

          <ComponentList id="ui-components" title={tAuto('ui_components_9e3e7a4f')} items={uiComponents} path="components/ui" />
          <ComponentList id="layout-components" title={tAuto('layout_components_c8b40b13')} items={layoutComponents} path="components/layout" />
          <ComponentList id="dashboard-components" title={tAuto('dashboard_components_08e42ac8')} items={dashboardComponents} path="components/dashboard" />
          <ComponentList id="common-components" title={tAuto('common_components_f1d1c38d')} items={commonComponents} path="components/common" />
          <ComponentList id="apps-components" title={tAuto('apps_components_8be1e286')} items={appsComponents} path="components/apps" />
          <ComponentList id="automation-components" title={tAuto('automation_components_7256522d')} items={automationComponents} path="components/automation" />
          <ComponentList id="goals-components" title={tAuto('goals_components_59cdc2b9')} items={goalsComponents} path="components/goals" />
          <ComponentList id="ideas-components" title={tAuto('ideas_components_e073ecc3')} items={ideasComponents} path="components/ideas" />
        </section>
      </div>
    </MainLayout>
  )
}

function ComponentShowcase({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div>{children}</div>
    </div>
  )
}

function ComponentList({ id, title, items, path }: { id: string; title: string; items: string[]; path: string }) {
  return (
    <div id={id}>
      <h3 className="text-base font-medium mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">Konum: <code className="bg-muted px-1 rounded">{path}</code></p>
    </div>
  )
}

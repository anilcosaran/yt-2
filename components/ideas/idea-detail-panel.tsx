'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  X,
  Share2,
  Zap,
  MoreHorizontal,
  Paperclip,
  Link2,
  LayoutTemplate,
  TrendingUp,
  Heart,
  Lightbulb,
  CheckCircle,
  ChevronDown,
  Users,
  Eye,
} from 'lucide-react'
import type { Idea, IdeaDetail } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

interface IdeaDetailPanelProps {
  idea: IdeaDetail
  onClose?: () => void
  className?: string
}

export function IdeaDetailPanel({ idea, onClose, className }: IdeaDetailPanelProps) {
  const tAuto = useTranslations('Auto')
  return (
    <div className={cn('flex h-full w-[500px] flex-col border-l border-border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-warning/10">
            <Lightbulb className="h-3.5 w-3.5 text-warning" />
          </span>
          <span>testsdf</span>
          <span>/</span>
          <span><UiText id="tsf_2_9eb88f4d" /></span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="h-4 w-4" />
            <span className="ml-1 text-xs">1</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Zap className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-xl font-semibold text-foreground">{idea.summary}</h2>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="genel-bakis" className="flex-1 flex flex-col">
        <TabsList className="h-auto bg-transparent p-0 px-4 border-b border-border rounded-none">
          <TabsTrigger
            value="genel-bakis"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <UiText id="genel_bakis_ebf2b031" /></TabsTrigger>
          <TabsTrigger
            value="yorumlar"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <UiText id="yorumlar_d4c0de2d" /></TabsTrigger>
          <TabsTrigger
            value="ongoruler"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <UiText id="ongoruler_9093d6e4" /><span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">2</span>
          </TabsTrigger>
          <TabsTrigger
            value="teslimat"
            className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <UiText id="teslimat_d40497e5" /></TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="genel-bakis" className="mt-0 p-4 space-y-6">
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                <UiText id="ek_ekle_c8784ba4" /></Button>
              <Button variant="outline" size="sm" className="gap-1">
                <Link2 className="h-3.5 w-3.5" />
                <UiText id="bileti_bagla_77bc4be5" /></Button>
              <Button variant="outline" size="sm" className="gap-1">
                <LayoutTemplate className="h-3.5 w-3.5" />
                <UiText id="sablonlar_dfb4e4f2" /></Button>
            </div>

            {/* Hypothesis Section */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                <h3 className="font-medium text-foreground"><UiText id="hypothesis_acadf784" /></h3>
              </div>
              <p className="text-sm text-foreground">
                <UiText id="creating_a_38676eb5" />{' '}<strong><UiText id="reward_program_for_our_customers_will_increase_t_b490a904" /></strong>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <UiText id="this_will_benefit_users_by_providing_them_with_m_bbb72226" /></p>
              <p className="mt-2 text-sm text-muted-foreground">
                <UiText id="we_will_know_if_this_is_true_if_the_number_of_tr_2b85863b" /></p>
            </section>

            {/* Validation Section */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <h3 className="font-medium text-foreground"><UiText id="validation_dd74d182" /></h3>
              </div>
              <p className="text-sm text-foreground">
                <UiText id="after_a_runtime_of_16_weeks_we_saw_the_number_of_454f4888" />{' '}<strong>+17%</strong><UiText id="the_number_of_returning_users_has_also_increased_72b178b3" />{' '}<strong>24%</strong>.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {tAuto('this_validates_our_hypothesis_that_a_reward_prog_ba99535a')}
              </p>
            </section>

            {/* Decision Section */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <h3 className="font-medium text-foreground"><UiText id="decision_7f59a1f1" /></h3>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 text-success" />
                <p className="text-sm text-foreground">
                  <UiText id="we_will_move_this_feature_from_beta_to_make_it_g_56553837" /></p>
              </div>
            </section>

            {/* Pinned Fields */}
            <section>
              <div className="flex items-center justify-between">
                <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4" />
                  <UiText id="sabitlenmis_alanlar_7a380146" /></button>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><UiText id="theme_a797e309" /></span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3 text-success" />
                      <UiText id="increase_revenue_368a7aa5" /></Badge>
                    <Badge variant="outline" className="gap-1">
                      <Heart className="h-3 w-3 text-destructive" />
                      <UiText id="delight_users_c3c4ac66" /></Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><UiText id="roadmap_8119e7f3" /></span>
                  <Badge className="bg-success text-success-foreground"><UiText id="now_e3b82040" /></Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><UiText id="rice_score_19540110" /></span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    1.500
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><UiText id="customer_segments_07b7111a" /></span>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    <UiText id="5_enterprise_18b1fb38" /></Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><UiText id="value_8dce170d" /></span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          i <= 5 ? 'bg-primary' : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="yorumlar" className="mt-0 p-4">
            <div className="py-8 text-center text-muted-foreground">
              <UiText id="henuz_yorum_yok_76b718c2" /></div>
          </TabsContent>

          <TabsContent value="ongoruler" className="mt-0 p-4">
            <div className="py-8 text-center text-muted-foreground">
              <UiText id="2_ongoruler_mevcut_0fc3bcc2" /></div>
          </TabsContent>

          <TabsContent value="teslimat" className="mt-0 p-4">
            <div className="py-8 text-center text-muted-foreground">
              <UiText id="teslimat_bilgisi_burada_gorunecek_9553c276" /></div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

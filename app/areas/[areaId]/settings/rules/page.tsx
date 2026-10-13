'use client'

import * as React from 'react'
import { MainLayout, Breadcrumb } from '@/components/layout'
import { FlowCanvas, ActionPanel, ComponentPanel, ConditionPanel } from '@/components/automation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, MoreHorizontal, Shield } from 'lucide-react'
import { automationRules, actionCategories } from '@/lib/mock-data'
import type { NavItem, FlowNode } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

export default function RulesPage() {
  const tAreas = useTranslations('Areas')
  const [selectedRule, setSelectedRule] = React.useState(automationRules[0])
  const [rightPanel, setRightPanel] = React.useState<'actions' | 'components' | 'condition'>('actions')
  const [selectedNode, setSelectedNode] = React.useState<FlowNode | null>(null)

  const handleNodeClick = (node: FlowNode) => {
    setSelectedNode(node)
    if (node.type === 'condition') {
      setRightPanel('condition')
    } else {
      setRightPanel('actions')
    }
  }

  const handleAddNode = () => {
    setRightPanel('components')
  }

  // Sidebar for area settings
  const sidebarItems: NavItem[] = [
    { id: 'ayrintilar', label: tAreas('details'), icon: 'file' },
    { id: 'ozet', label: tAreas('summary'), icon: 'list' },
    { id: 'ozellikler', label: tAreas('features'), icon: 'settings' },
    { id: 'erisim', label: tAreas('access'), icon: 'shield' },
    { id: 'talep-yonetimi', label: tAreas('requestManagement'), icon: 'inbox' },
    { id: 'kanallar', label: tAreas('channelsAndSelfService'), icon: 'share' },
    { id: 'operasyon', label: tAreas('operations'), icon: 'zap' },
    { id: 'bildirimler', label: tAreas('notifications'), icon: 'bell', children: [
      { id: 'dil-destegi', label: tAreas('languageSupport') },
    ]},
    { id: 'uygulamalar', label: tAreas('apps'), icon: 'grid' },
    { id: 'surumler', label: tAreas('versions'), icon: 'tag' },
    { id: 'bilesenler', label: tAreas('components'), icon: 'layers' },
  ]

  return (
    <MainLayout
      appName="Youtorch"
      sidebarTitle={tAreas('settings')}
      sidebarSubtitle={tAreas('supportArea')}
      sidebarBackHref="/"
      sidebarBackLabel={tAreas('home')}
      sidebarTitleIcon={
        <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-100 dark:bg-purple-900">
          <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
      }
      sidebarItems={sidebarItems}
    >
      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="border-b border-border bg-card px-6 py-4">
            <Breadcrumb
              items={[
                { label: tAreas('area') },
                { label: tAreas('support') },
                { label: tAreas('settings') },
              ]}
              className="mb-4"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">
                  {selectedRule.name}
                </h1>
                <Badge variant="secondary" className="bg-success/10 text-success">
                  <UiText id="yeni_b4f2cd18" /></Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground"><UiText id="kural_ayrintilari_b0622886" /></span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-1 bg-primary text-primary-foreground">
                      <UiText id="kurali_ac_861cd75e" /><ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem><UiText id="kurali_ac_861cd75e" /></DropdownMenuItem>
                    <DropdownMenuItem><UiText id="kurali_devre_disi_birak_a0777747" /></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline"><UiText id="kurallara_geri_don_c672a764" /></Button>

                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Flow Canvas */}
          <div className="p-6">
            <FlowCanvas
              rule={selectedRule}
              onNodeClick={handleNodeClick}
              onAddNode={handleAddNode}
            />
          </div>
        </div>

        {/* Right Panel */}
        {rightPanel === 'actions' && (
          <ActionPanel
            categories={actionCategories}
            onActionSelect={(action) => {
              console.log('Selected action:', action)
            }}
          />
        )}
        {rightPanel === 'components' && (
          <ComponentPanel
            onComponentSelect={(type) => {
              console.log('Selected component type:', type)
              setRightPanel('actions')
            }}
          />
        )}
        {rightPanel === 'condition' && <ConditionPanel />}
      </div>
    </MainLayout>
  )
}

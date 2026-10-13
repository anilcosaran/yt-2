'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Trash2, Filter as FilterIcon, Code, Mail, Calendar, Globe, GitBranch, FileText, MessageSquare, Table, Zap } from 'lucide-react'
import type { ActionCategory, ActionItem } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

interface ActionPanelProps {
  categories: ActionCategory[]
  onActionSelect?: (action: ActionItem) => void
  onClose?: () => void
  className?: string
}

const iconMap: Record<string, React.ReactNode> = {
  search: <Search className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
  'git-branch': <GitBranch className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  rovo: <RovoIcon className="h-4 w-4" />,
}

export function ActionPanel({ categories, onActionSelect, onClose, className }: ActionPanelProps) {
  const tAuto = useTranslations('Auto')
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredCategories = categories.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.items.length > 0)

  return (
    <div className={cn('flex h-full w-80 flex-col border-l border-border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-medium text-foreground"><UiText id="islem_ekleyin_ff22df1e" /></h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tAuto('islem_arayin_66d850a4')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {filteredCategories.map((category) => (
            <div key={category.name}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{category.name}</h4>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {category.count}
                </span>
              </div>
              <div className="space-y-1">
                {category.items.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => onActionSelect?.(action)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded"
                      style={action.iconColor ? { backgroundColor: action.iconColor + '20', color: action.iconColor } : undefined}
                    >
                      {iconMap[action.icon] || <Zap className="h-4 w-4" />}
                    </div>
                    <span className="text-foreground">{action.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// Component Panel for adding nodes
interface ComponentPanelProps {
  onComponentSelect?: (type: 'action' | 'condition' | 'branch') => void
  className?: string
}

export function ComponentPanel({ onComponentSelect, className }: ComponentPanelProps) {
  const tAuto = useTranslations('Auto')
  return (
    <div className={cn('flex h-full w-80 flex-col border-l border-border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border p-4">
        <div className="flex items-center gap-1">
          <span className="text-lg">+</span>
          <RovoIcon className="h-5 w-5" />
          <ConfluenceIcon className="h-5 w-5" />
        </div>
      </div>

      {/* Template Info */}
      <div className="border-b border-border p-4">
        <p className="text-sm text-muted-foreground">
          {tAuto('youtorch_taki_hatalari_siniflandirmak_icin_rovo__cfff3fe6')}
        </p>
        <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <UiText id="sablon_7df56114" /></span>
      </div>

      {/* Component Options */}
      <div className="p-4">
        <h3 className="mb-2 text-sm font-medium text-foreground"><UiText id="bilesen_ekleme_015dfec2" /></h3>
        <p className="mb-4 text-xs text-muted-foreground"><UiText id="4_65_eklendi_ba92176b" /></p>

        <div className="space-y-4">
          {/* Required Section */}
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground"><UiText id="zorunlu_d7c095f7" /></h4>
            <button
              onClick={() => onComponentSelect?.('action')}
              className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-warning text-warning-foreground">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">ISLEM: Islem ekleyin</p>
                <p className="text-xs text-muted-foreground">
                  <UiText id="kuraliniz_basarili_bir_sekilde_calisinca_islemle_21c5c658" /></p>
              </div>
            </button>
          </div>

          {/* Optional Section */}
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground"><UiText id="istege_bagli_3922af5e" /></h4>
            <div className="space-y-2">
              <button
                onClick={() => onComponentSelect?.('condition')}
                className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-success text-success-foreground">
                  <FilterIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">KOSUL: Kosul ekleyin</p>
                  <p className="text-xs text-muted-foreground">
                    <UiText id="kosullar_kapsami_belirli_kullanici_gruplari_veya_b4642078" /></p>
                </div>
              </button>

              <button
                onClick={() => onComponentSelect?.('branch')}
                className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-info text-info-foreground">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground"><UiText id="her_biri_icin_dal_ekleme_9d4f4655" /></p>
                  <p className="text-xs text-muted-foreground">
                    {tAuto('dallar_kendi_kapsamlarindaki_islem_ve_kosullari__55a8d5e2')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Condition Detail Panel
interface ConditionPanelProps {
  className?: string
}

export function ConditionPanel({ className }: ConditionPanelProps) {
  return (
    <div className={cn('flex h-full w-96 flex-col border-l border-border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-lg">+</span>
            <RovoIcon className="h-5 w-5" />
            <ConfluenceIcon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-warning text-warning-foreground">
            <FilterIcon className="h-4 w-4" />
          </div>
          <h3 className="font-medium text-foreground"><UiText id="konu_alanlari_kosulu_4afe05f1" /></h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          <UiText id="bir_biletinin_alaninin_belirli_kriterleri_karsil_18565a4e" /></p>
      </div>

      {/* Form Fields */}
      <div className="flex-1 p-4 space-y-4">
        {/* Field Selection */}
        <div>
          <label className="text-sm font-medium text-foreground">
            <UiText id="alan_93a6742a" />{' '}<span className="text-destructive">*</span>{' '}
            <span className="text-muted-foreground font-normal"><UiText id="zorunlu_cb921db7" /></span>
          </label>
          <select className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
            <option><UiText id="konu_turu_62d9e9ca" /></option>
          </select>
        </div>

        {/* Condition Selection */}
        <div>
          <label className="text-sm font-medium text-foreground">
            <UiText id="kosul_3505a725" />{' '}<span className="text-destructive">*</span>{' '}
            <span className="text-muted-foreground font-normal"><UiText id="zorunlu_cb921db7" /></span>
          </label>
          <select className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
            <option><UiText id="belirtilen_degere_sahip_5e64f57c" /></option>
          </select>
        </div>

        {/* Value Tabs */}
        <div>
          <div className="flex gap-4 border-b border-border">
            <button className="border-b-2 border-primary pb-2 text-sm font-medium text-primary">
              <UiText id="deger_2550d0d1" /></button>
            <button className="pb-2 text-sm text-muted-foreground">
              <UiText id="alan_93a6742a" /></button>
          </div>
          <div className="mt-2">
            <select className="w-full rounded-md border border-primary bg-input px-3 py-2 text-sm ring-2 ring-primary/20">
              <option><UiText id="bir_deger_bulmak_icin_yazin_f39298a9" /></option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 border-t border-border p-4">
        <Button variant="outline" className="flex-1">
          <UiText id="geri_4928cfc9" /></Button>
        <Button variant="outline" className="flex-1">
          <UiText id="ileri_c90b8907" /></Button>
      </div>
    </div>
  )
}

// Rovo Icon
function RovoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#rovo-gradient-panel)" />
      <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="rovo-gradient-panel" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#FF5630" />
          <stop offset="1" stopColor="#FFAB00" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Confluence Icon
function ConfluenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.093 18.937c-.31.46-.63.96-.89 1.38a.62.62 0 0 0 .21.85l3.6 2.19a.62.62 0 0 0 .85-.21c.21-.35.49-.79.81-1.26 2.14-3.17 4.3-2.76 8.17-.87l3.59 1.76a.62.62 0 0 0 .83-.29l1.76-3.87a.62.62 0 0 0-.29-.83c-4.01-1.97-7.17-3.53-10.72-3.53-3.24 0-5.87 1.94-7.91 4.72zM21.907 5.063c.31-.46.63-.96.89-1.38a.62.62 0 0 0-.21-.85l-3.6-2.19a.62.62 0 0 0-.85.21c-.21.35-.49.79-.81 1.26-2.14 3.17-4.3 2.76-8.17.87L5.533 1.2a.62.62 0 0 0-.83.29l-1.76 3.87a.62.62 0 0 0 .29.83c4.01 1.97 7.17 3.53 10.72 3.53 3.24 0 5.87-1.94 7.91-4.72z" />
    </svg>
  )
}

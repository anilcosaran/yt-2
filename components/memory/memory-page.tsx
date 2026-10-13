'use client'

// Memory: what the assistant knows (Knowledge), the sentences it always follows (Assistant rules) and the methods
// it can use (Skills). All three tabs share one list pattern; adding is one button in the header that follows the
// open tab and opens that tab's popup (a skill gets the wide one it is written in, skill-dialog.tsx). Automatic
// intake from the library lives behind the settings button, not inside the Knowledge list.

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Lightbulb, Plus, Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PageHeader } from '@/components/common/page-header'
import { TabBar, TabBarItem } from '@/components/common/tab-bar'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { cn } from '@/lib/utils'

import { KnowledgeDialog, MemoryKnowledgeTab } from './memory-knowledge-tab'
import type { KnowledgeKind } from './memory-seed'
import { MemoryRulesTab, RuleDialog } from './memory-rules-tab'
import { MemorySkillsTab } from './memory-skills-tab'
import { useMemoryStore } from './memory-store'
import { SkillDialog } from './skill-dialog'

type MemoryTab = 'knowledge' | 'rules' | 'skills'

type DialogState =
  | { type: 'knowledge'; id: string | null; kind?: KnowledgeKind; text?: string }
  | { type: 'rule'; id: string | null; text?: string }
  | { type: 'skill'; id: string | null; text?: string }
  | null

// Mock state built in the browser (relative times) — render on the client only to avoid hydration mismatches.
export function MemoryPage() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted ? <MemoryWorkspace /> : <WorkspaceRouteLoading />
}

function MemoryWorkspace() {
  const t = useTranslations('MemoryPage')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeChannel } = useActiveChannel()
  const ingestionEnabled = useMemoryStore((state) => state.ingestion.enabled)
  const requested = searchParams.get('tab')
  const tab: MemoryTab = requested === 'rules' || requested === 'skills' ? requested : 'knowledge'
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const [ingestionOpen, setIngestionOpen] = React.useState(false)

  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value === 'knowledge') next.delete('tab')
    else next.set('tab', value)
    const query = next.toString()
    // A tab is a view of the same page: the address changes in place (no server round trip, nothing re-renders
    // around the tabs); `useSearchParams` follows the native history update.
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }

  const add = () => {
    if (tab === 'knowledge') setDialog({ type: 'knowledge', id: null })
    else if (tab === 'rules') setDialog({ type: 'rule', id: null })
    else setDialog({ type: 'skill', id: null })
  }

  return (
    <>
      <div className="hg-scrollbar relative h-full overflow-y-auto bg-background">
        <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="relative mx-auto min-h-full w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
          <PageHeader
            breadcrumbs={[{ label: t('title') }, { label: activeChannel?.name ?? t('noChannel'), icon: Lightbulb }]}
            icon={Lightbulb}
            title={t('title')}
            badge={(
              <span className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium',
                ingestionEnabled ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
              )}>
                <span className="size-1.5 rounded-full bg-current" />
                {ingestionEnabled ? t('statusOn') : t('statusOff')}
              </span>
            )}
            description={t('description')}
            actions={(
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIngestionOpen(true)}
                  className="size-10 rounded-xl border-border bg-panel/60"
                  aria-label={t('ingestion.title')}
                  title={t('ingestion.title')}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" onClick={add} className="h-10 gap-2 rounded-xl px-4">
                  <Plus className="h-4 w-4" />
                  {t(`add.${tab}`)}
                </Button>
              </>
            )}
            className="mb-4"
          />

          <Tabs value={tab} onValueChange={changeTab} className="gap-0">
            <TabBar className="mt-0 mb-5" aria-label={t('tabsLabel')}>
              <TabBarItem value="knowledge">{t('tabs.knowledge')}</TabBarItem>
              <TabBarItem value="rules">{t('tabs.rules')}</TabBarItem>
              <TabBarItem value="skills">{t('tabs.skills')}</TabBarItem>
            </TabBar>
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t(`intro.${tab}`)}</p>
            <TabsContent value="knowledge" className="mt-0">
              <MemoryKnowledgeTab
                onAdd={(kind, text) => setDialog({ type: 'knowledge', id: null, kind, text })}
                onEdit={(id) => setDialog({ type: 'knowledge', id })}
              />
            </TabsContent>
            <TabsContent value="rules" className="mt-0">
              <MemoryRulesTab onAdd={(text) => setDialog({ type: 'rule', id: null, text })} onEdit={(id) => setDialog({ type: 'rule', id })} />
            </TabsContent>
            <TabsContent value="skills" className="mt-0">
              <MemorySkillsTab onAdd={(text) => setDialog({ type: 'skill', id: null, text })} onOpen={(id) => setDialog({ type: 'skill', id })} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <KnowledgeDialog
        open={dialog?.type === 'knowledge'}
        onOpenChange={(open) => !open && setDialog(null)}
        itemId={dialog?.type === 'knowledge' ? dialog.id : null}
        initialKind={dialog?.type === 'knowledge' ? dialog.kind : undefined}
        initialText={dialog?.type === 'knowledge' ? dialog.text : undefined}
      />
      <RuleDialog
        open={dialog?.type === 'rule'}
        onOpenChange={(open) => !open && setDialog(null)}
        ruleId={dialog?.type === 'rule' ? dialog.id : null}
        initialText={dialog?.type === 'rule' ? dialog.text : undefined}
      />
      <SkillDialog
        open={dialog?.type === 'skill'}
        onOpenChange={(open) => !open && setDialog(null)}
        skillId={dialog?.type === 'skill' ? dialog.id : null}
        initialRequest={dialog?.type === 'skill' ? dialog.text : undefined}
        onOpenSkill={(id) => setDialog({ type: 'skill', id })}
      />
      <IngestionDialog open={ingestionOpen} onOpenChange={setIngestionOpen} />
    </>
  )
}

/** "Belleğe alma ayarları": what is taken from the library into Knowledge automatically. */
function IngestionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('MemoryPage.ingestion')
  const tCommon = useTranslations('MemoryPage.common')
  const ingestion = useMemoryStore((state) => state.ingestion)
  const setIngestion = useMemoryStore((state) => state.setIngestion)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border rounded-xl border border-border">
          <SettingRow label={t('enabled')} hint={t('enabledHint')} checked={ingestion.enabled} onChange={(enabled) => setIngestion({ enabled })} />
          <div className={cn(!ingestion.enabled && 'pointer-events-none opacity-45')}>
            <SettingRow label={t('transcripts')} hint={t('transcriptsHint')} checked={ingestion.transcripts} onChange={(transcripts) => setIngestion({ transcripts })} />
            <SettingRow label={t('images')} hint={t('imagesHint')} checked={ingestion.imageDescriptions} onChange={(imageDescriptions) => setIngestion({ imageDescriptions })} />
            <SettingRow label={t('documents')} hint={t('documentsHint')} checked={ingestion.documents} onChange={(documents) => setIngestion({ documents })} />
            <SettingRow label={t('askFirst')} hint={t('askFirstHint')} checked={ingestion.askFirst} onChange={(askFirst) => setIngestion({ askFirst })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{tCommon('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

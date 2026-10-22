'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  ArrowUpDown,
  ArrowRight,
  Archive,
  CalendarClock,
  Compass,
  Filter,
  FolderKanban,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Workflow as WorkflowIcon,
  Youtube,
} from 'lucide-react'

import { PageContainer } from '@/components/common/page-container'
import { PageHeader } from '@/components/common/page-header'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { localizeWorkflowDisplayText } from '@/lib/workflows/display-i18n'
import type { Workflow, WorkflowProjectOption, WorkflowStatus, WorkflowTriggerType } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useNow, useTranslations } from 'next-intl'

type WorkflowListTranslator = (key: string, values?: Record<string, string | number>) => string
type WorkflowListFormatter = ReturnType<typeof useFormatter>

interface WorkflowListProps {
  workflows: Workflow[]
  projectOptions?: WorkflowProjectOption[]
  errorMessage?: string | null
  emptyMessage?: string
  onCreateWorkflow: () => void
  onOpenWorkflow: (workflow: Workflow) => void
  onRunWorkflow?: (workflow: Workflow) => void
  onArchiveWorkflow?: (workflow: Workflow) => void
  isWorkflowActionPending?: (workflow: Workflow) => boolean
}

export function WorkflowList({
  workflows,
  projectOptions = [],
  errorMessage,
  emptyMessage,
  onCreateWorkflow,
  onOpenWorkflow,
  onRunWorkflow,
  onArchiveWorkflow,
  isWorkflowActionPending,
}: WorkflowListProps) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowListTranslator
  const now = useNow({ updateInterval: 60_000 })
  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<WorkflowStatus | 'all'>('all')
  const [projectFilter, setProjectFilter] = React.useState<string>('all')
  const deferredQuery = React.useDeferredValue(query)
  const normalizedQuery = React.useMemo(
    () => deferredQuery.trim().toLocaleLowerCase('en-US'),
    [deferredQuery],
  )
  const projectLabelById = React.useMemo(() => {
    return new Map(projectOptions.map((option) => [option.id, option.label]))
  }, [projectOptions])

  const filteredWorkflows = React.useMemo(() => {
    return workflows.filter((workflow) => {
      const projectId = workflow.projectId ?? ''
      const matchesQuery = !normalizedQuery
        || `${localizeWorkflowDisplayText(workflow.name, tWorkflows)} ${workflow.channel} ${localizeWorkflowDisplayText(workflow.description, tWorkflows)} ${projectId}`
          .toLocaleLowerCase('en-US')
          .includes(normalizedQuery)
      const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter
      const matchesProject = projectFilter === 'all'
        || (projectFilter === 'unassigned' ? !workflow.projectId : workflow.projectId === projectFilter)

      return matchesQuery && matchesStatus && matchesProject
    })
  }, [normalizedQuery, projectFilter, statusFilter, tWorkflows, workflows])
  const selectedProjectLabel = projectFilter === 'all'
    ? tWorkflows('list.project')
    : projectFilter === 'unassigned'
      ? tWorkflows('list.unassigned')
      : projectLabelById.get(projectFilter) ?? projectFilter

  return (
    <PageContainer>
      <PageHeader
        title={tAuto('automation_a15fde51')}
        badge={<span className="rounded-full border border-border bg-panel px-2.5 py-1 text-xs font-medium text-muted-foreground">{tWorkflows('list.workflowCount', { count: workflows.length })}</span>}
        description={tAuto('manage_your_channel_automations_or_start_from_a__e81ef395')}
        className="mb-0"
      />

      <section className="mt-6 flex flex-wrap items-center gap-2">
        <div className="contents">
          <Button size="sm" className="h-10 rounded-xl px-4" onClick={onCreateWorkflow}>
            <Plus className="h-4 w-4" />
            <UiText id="new_workflow_d607caf2" /></Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl border-border bg-panel/50 px-3.5">
                <Filter className="h-3.5 w-3.5" />
                <UiText id="status_bae7d5be" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem checked={statusFilter === 'all'} onCheckedChange={() => setStatusFilter('all')}>
                <UiText id="all_workflows_20329591" /></DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === 'active'} onCheckedChange={() => setStatusFilter('active')}>
                <UiText id="active_a733b809" /></DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === 'paused'} onCheckedChange={() => setStatusFilter('paused')}>
                <UiText id="paused_c7dfb6f1" /></DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === 'draft'} onCheckedChange={() => setStatusFilter('draft')}>
                <UiText id="draft_23d33e22" /></DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilter === 'archived'} onCheckedChange={() => setStatusFilter('archived')}>
                <UiText id="archived_eddc813f" /></DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl border-border bg-panel/50 px-3.5">
                <FolderKanban className="h-3.5 w-3.5" />
                <span className="max-w-32 truncate">{selectedProjectLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem checked={projectFilter === 'all'} onCheckedChange={() => setProjectFilter('all')}>
                <UiText id="all_projects_403b2169" /></DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={projectFilter === 'unassigned'} onCheckedChange={() => setProjectFilter('unassigned')}>
                <UiText id="unassigned_e57016ed" /></DropdownMenuCheckboxItem>
              {projectOptions.length > 0 && <DropdownMenuSeparator />}
              {projectOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={projectFilter === option.id}
                  onCheckedChange={() => setProjectFilter(option.id)}
                >
                  <span className="max-w-48 truncate">{option.label}</span>
                  {option.workflowCount ? (
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs">{option.workflowCount}</span>
                  ) : null}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="h-10 rounded-xl border-border bg-panel/50 px-3.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <UiText id="sort_adc4e96a" /></Button>
          <Button variant="outline" size="sm" className="h-10 rounded-xl border-border bg-panel/50 px-3.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <UiText id="fields_e8b68527" /><span className="rounded bg-muted px-1.5 py-0.5 text-xs">6</span>
          </Button>
        </div>

        <div className="relative ml-auto w-full sm:w-80">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tAuto('search_workflow_channel_or_trigger_6b4942ee')}
            className="h-10 rounded-xl border-border bg-panel/50 pl-9 shadow-none focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-panel/40">
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow>
              <TableHead className="h-12 w-[34%] px-4"><UiText id="workflow_d7a48414" /></TableHead>
              <TableHead className="h-12 w-28"><UiText id="status_bae7d5be" /></TableHead>
              <TableHead className="h-12 w-[18%]"><UiText id="trigger_d3f06a58" /></TableHead>
              <TableHead className="h-12 w-24"><UiText id="last_run_333c63a5" /></TableHead>
              <TableHead className="h-12 w-[17%]"><UiText id="next_bc981983" /></TableHead>
              <TableHead className="h-12 w-36"><UiText id="channel_879f0b1b" /></TableHead>
              <TableHead className="h-12 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorMessage && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-14 px-4 text-sm text-destructive">
                  {errorMessage}
                </TableCell>
              </TableRow>
            )}

            {filteredWorkflows.map((workflow) => (
              <WorkflowTableRow
                key={workflow.id}
                workflow={workflow}
                now={now}
                actionPending={isWorkflowActionPending?.(workflow) ?? false}
                onOpenWorkflow={onOpenWorkflow}
                onRunWorkflow={onRunWorkflow}
                onArchiveWorkflow={onArchiveWorkflow}
              />
            ))}

            {!errorMessage && filteredWorkflows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-14 px-4 text-sm text-muted-foreground">
                  {emptyMessage ?? tWorkflows('list.noWorkflows')}
                </TableCell>
              </TableRow>
            )}

            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="h-12 px-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  onClick={onCreateWorkflow}
                >
                  <Plus className="h-4 w-4" />
                  <UiText id="create_6e157c5d" /></button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <WorkflowTemplateGallery onCreateWorkflow={onCreateWorkflow} />
    </PageContainer>
  )
}

const WORKFLOW_TEMPLATES = [
  { id: 'tips', titleKey: 'templates.tips', image: '/flows/tips.png' },
  { id: 'expert', titleKey: 'templates.expert', image: '/flows/expert.png' },
  { id: 'edu', titleKey: 'templates.educational', image: '/flows/educational.png' },
  { id: 'course', titleKey: 'templates.course', image: '/flows/course.png' },
  { id: 'news', titleKey: 'templates.news', image: '/flows/news.png' },
  { id: 'sales', titleKey: 'templates.salesOutreach', image: '/flows/sales.png' },
] as const

const WORKFLOW_BRAND_KIT_KEYS = [
  'templates.createBrand',
  'templates.testChannelKit',
  'templates.elevated',
  'templates.friendly',
  'templates.minimal',
  'templates.professional',
] as const
const WORKFLOW_CATEGORY_KEYS = [
  'templates.recommended',
  'templates.training',
  'templates.corporate',
  'templates.marketing',
  'templates.sales',
  'templates.tutorials',
  'templates.finance',
] as const

function WorkflowTemplateGallery({ onCreateWorkflow }: { onCreateWorkflow: () => void }) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowListTranslator
  const [category, setCategory] = React.useState<(typeof WORKFLOW_CATEGORY_KEYS)[number]>('templates.recommended')

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground"><UiText id="templates_f25b700e" /></h2>
        <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Compass className="size-4" />
          <UiText id="explore_all_a47b25b9" /></button>
      </div>

      <div className="hg-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {WORKFLOW_BRAND_KIT_KEYS.map((brandKitKey, index) => (
          <button
            key={brandKitKey}
            type="button"
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
              index === 1
                ? 'border-primary/60 bg-primary/10 text-foreground'
                : 'border-border bg-panel/50 text-muted-foreground hover:text-foreground',
            )}
          >
            {index === 0 ? <Plus className="size-3.5" /> : null}
            <span className="flex -space-x-1">
              <span className="size-3 rounded-full bg-primary/70 ring-1 ring-background" />
              <span className="size-3 rounded-full bg-violet-500/70 ring-1 ring-background" />
            </span>
            {tWorkflows(brandKitKey)}
          </button>
        ))}
      </div>

      <div className="hg-scrollbar mt-3 flex gap-4 overflow-x-auto border-b border-border">
        {WORKFLOW_CATEGORY_KEYS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              'shrink-0 border-b-2 pb-2.5 text-sm font-medium transition-colors',
              category === item
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WORKFLOW_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={onCreateWorkflow}
            className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl border border-border text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-black/30"
          >
            <Image
              src={template.image}
              alt={tWorkflows(template.titleKey)}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
            <span className="relative p-4">
              <span className="block font-display text-xl text-white drop-shadow-md md:text-2xl">{tWorkflows(template.titleKey)}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white/90">
                <UiText id="create_now_0b58cf2d" /><ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

const WorkflowTableRow = React.memo(function WorkflowTableRow({
  workflow,
  now,
  actionPending,
  onOpenWorkflow,
  onRunWorkflow,
  onArchiveWorkflow,
}: {
  workflow: Workflow
  now: Date
  actionPending: boolean
  onOpenWorkflow: (workflow: Workflow) => void
  onRunWorkflow?: (workflow: Workflow) => void
  onArchiveWorkflow?: (workflow: Workflow) => void
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowListTranslator
  const format = useFormatter()
  const canRun = Boolean(onRunWorkflow) && workflow.status !== 'archived' && !actionPending
  const canArchive = Boolean(onArchiveWorkflow) && workflow.status !== 'archived' && !actionPending
  const lastRun = getLastRunDisplay(workflow, format, tWorkflows, now)
  const nextRun = getNextRunDisplay(workflow, format, tWorkflows, now)

  return (
    <TableRow
      className="h-[58px] cursor-pointer hover:bg-accent/40"
      onClick={() => onOpenWorkflow(workflow)}
    >
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground">
            <WorkflowIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{localizeWorkflowDisplayText(workflow.name, tWorkflows)}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{localizeWorkflowDisplayText(workflow.description, tWorkflows)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <WorkflowStatusPill status={workflow.status} />
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <TriggerIcon type={workflow.triggerType} />
          <div>
            <p className="line-clamp-1 text-sm text-foreground">{localizeWorkflowDisplayText(workflow.triggerLabel, tWorkflows)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{localizeWorkflowDisplayText(workflow.schedule, tWorkflows)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <LastRunTime display={lastRun} />
      </TableCell>
      <TableCell className="py-3">
        <NextRunStatus display={nextRun} />
      </TableCell>
      <TableCell className="py-3">
        <p className="max-w-36 truncate text-sm text-foreground" title={workflow.channel}>
          {workflow.channel}
        </p>
      </TableCell>
      <TableCell className="py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem
              disabled={!canRun}
              onSelect={(event) => {
                event.preventDefault()
                if (canRun) onRunWorkflow?.(workflow)
              }}
            >
              <Play className="h-4 w-4" />
              <UiText id="run_now_2af00e23" /></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!canArchive}
              onSelect={(event) => {
                event.preventDefault()
                if (canArchive) onArchiveWorkflow?.(workflow)
              }}
            >
              <Archive className="h-4 w-4" />
              <UiText id="archive_2621c6fd" /></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

export function WorkflowListLoading() {
  return <WorkspaceRouteLoading />
}

function WorkflowStatusPill({ status }: { status: WorkflowStatus }) {
  const t = useTranslations('Workflows') as unknown as WorkflowListTranslator
  const styles: Record<WorkflowStatus, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    paused: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    draft: 'bg-muted text-muted-foreground',
    failed: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    archived: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  }
  const labelKeys: Record<WorkflowStatus, string> = {
    active: 'list.active',
    paused: 'list.paused',
    draft: 'list.draft',
    failed: 'list.failed',
    archived: 'list.archived',
  }
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-1 text-xs font-medium', styles[status])}>
      {t(labelKeys[status])}
    </span>
  )
}

type LastRunDisplay = {
  timeLabel: string
  title?: string
}

type NextRunDisplay = {
  label: string
  detail?: string
  title?: string
}

function LastRunTime({ display }: { display: LastRunDisplay }) {
  return (
    <span className="block max-w-20 truncate text-sm text-muted-foreground" title={display.title}>
      {display.timeLabel}
    </span>
  )
}

function NextRunStatus({ display }: { display: NextRunDisplay }) {
  return (
    <div className="min-w-0" title={display.title}>
      <p className="truncate text-sm text-foreground">{display.label}</p>
      {display.detail ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{display.detail}</p>
      ) : null}
    </div>
  )
}

function TriggerIcon({ type }: { type: WorkflowTriggerType }) {
  const Icon = type === 'schedule' ? CalendarClock : type === 'manual' ? Play : Youtube

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </div>
  )
}

function getLastRunDisplay(
  workflow: Workflow,
  format: WorkflowListFormatter,
  t: WorkflowListTranslator,
  now: Date,
): LastRunDisplay {
  if (workflow.lastRunStatus === 'never') {
    return {
      timeLabel: '-',
      title: t(workflow.status === 'draft' ? 'list.draftNoRuns' : 'list.noRuns'),
    }
  }
  const exactTime = formatExactDateTime(workflow.lastRunAt, format)
  return {
    timeLabel: formatRelativeDateTime(workflow.lastRunAt, format, now) ?? workflow.lastRunAt,
    title: exactTime ?? undefined,
  }
}

function getNextRunDisplay(
  workflow: Workflow,
  format: WorkflowListFormatter,
  t: WorkflowListTranslator,
  now: Date,
): NextRunDisplay {
  if (workflow.status === 'archived') return { label: t('list.archived') }
  if (workflow.status === 'draft') return { label: t('list.draft'), detail: t('list.saveFirst') }
  if (workflow.status === 'paused') return { label: t('list.paused') }
  if (workflow.triggerType === 'manual') {
    return { label: t('list.runManually'), title: t('list.manualTitle') }
  }
  const relative = formatRelativeDateTime(workflow.nextRunAt, format, now)
  const exactTime = formatExactDateTime(workflow.nextRunAt, format)
  if (relative) {
    return { label: relative, detail: localizeWorkflowDisplayText(workflow.schedule, t), title: exactTime ?? undefined }
  }
  if (workflow.triggerType === 'schedule') {
    return {
      label: workflow.nextRunAt && workflow.nextRunAt !== 'Manual'
        ? localizeWorkflowDisplayText(workflow.nextRunAt, t)
        : t('list.scheduleNotSet'),
      detail: workflow.schedule && workflow.schedule !== workflow.nextRunAt
        ? localizeWorkflowDisplayText(workflow.schedule, t)
        : undefined,
    }
  }
  return { label: workflow.nextRunAt ? localizeWorkflowDisplayText(workflow.nextRunAt, t) : t('list.onTrigger') }
}

function formatRelativeDateTime(value: string | null | undefined, format: WorkflowListFormatter, now: Date) {
  const date = parseDate(value)
  return date ? format.relativeTime(date, { now, style: 'narrow' }) : null
}

function formatExactDateTime(value: string | null | undefined, format: WorkflowListFormatter) {
  const date = parseDate(value)
  return date ? format.dateTime(date, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) : null
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp)
}

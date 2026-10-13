'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, Code, Mail, Zap, GitBranch, MessageSquare, Filter, Plus } from 'lucide-react'
import type { FlowNode as FlowNodeType } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'

interface FlowNodeProps {
  node: FlowNodeType
  isLast?: boolean
  onAddClick?: () => void
  onClick?: () => void
  className?: string
}

const iconMap: Record<string, React.ReactNode> = {
  code: <Code className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  'git-branch': <GitBranch className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  filter: <Filter className="h-4 w-4" />,
  plus: <Plus className="h-4 w-4" />,
  rovo: <RovoIcon className="h-4 w-4" />,
}

const nodeStyles: Record<FlowNodeType['type'], string> = {
  trigger: 'bg-flow-trigger border-flow-trigger-border',
  condition: 'bg-flow-condition border-flow-condition-border',
  action: 'bg-flow-action border-flow-action-border',
  branch: 'bg-card border-border',
}

export function FlowNode({ node, isLast, onAddClick, onClick, className }: FlowNodeProps) {
  const hasError = node.hasError
  const errorStyle = hasError ? 'bg-flow-error border-flow-error-border' : ''

  return (
    <div className={cn('relative', className)}>
      {/* Connection Line from Top */}
      <div className="absolute left-8 -top-4 h-4 w-0.5 bg-border" />

      {/* Node Card */}
      <div
        onClick={onClick}
        className={cn(
          'relative flex min-w-[280px] max-w-[400px] cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all hover:shadow-md',
          errorStyle || nodeStyles[node.type],
          className
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            node.type === 'trigger' && 'bg-primary text-primary-foreground',
            node.type === 'condition' && 'bg-warning text-warning-foreground',
            node.type === 'action' && 'bg-primary text-primary-foreground',
            node.type === 'branch' && 'bg-muted text-muted-foreground',
            hasError && 'bg-destructive text-destructive-foreground'
          )}
          style={node.iconColor ? { backgroundColor: node.iconColor, color: 'white' } : undefined}
        >
          {iconMap[node.icon || 'zap'] || <Zap className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm">{node.title}</h4>
          {node.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
              {node.description}
            </p>
          )}
        </div>

        {/* Error Badge */}
        {node.hasError && node.errorCount && (
          <div className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
            <AlertCircle className="h-3 w-3" />
            {node.errorCount}
          </div>
        )}

        {/* Warning Icon for Conditions */}
        {node.type === 'condition' && node.hasError && (
          <div className="absolute right-3 top-3">
            <AlertCircle className="h-4 w-4 text-warning" />
          </div>
        )}
      </div>

      {/* Connection Line to Bottom */}
      {!isLast && (
        <div className="absolute left-8 top-full h-4 w-0.5 bg-border" />
      )}

      {/* Children Nodes */}
      {node.children && node.children.length > 0 && (
        <div className="ml-8 mt-4 border-l-2 border-border pl-4">
          {/* Branch Label */}
          {node.type === 'branch' && (
            <div className="absolute left-6 top-full mt-2 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <UiText id="dal_05109d35" /></div>
          )}
          
          {node.children.map((child, index) => (
            <FlowNode
              key={child.id}
              node={child}
              isLast={index === node.children!.length - 1}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Add Component Button
interface AddNodeButtonProps {
  label?: string
  onClick?: () => void
  className?: string
}

export function AddNodeButton({ label = 'Bilesen ekleyin', onClick, className }: AddNodeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary',
        className
      )}
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}

// Rovo Icon Component
function RovoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#rovo-gradient-node)" />
      <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="rovo-gradient-node" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#FF5630" />
          <stop offset="1" stopColor="#FFAB00" />
        </linearGradient>
      </defs>
    </svg>
  )
}

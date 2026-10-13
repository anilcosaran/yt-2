'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FlowNode, AddNodeButton } from './flow-node'
import type { AutomationRule, FlowNode as FlowNodeType } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

interface FlowCanvasProps {
  rule: AutomationRule
  onNodeClick?: (node: FlowNodeType) => void
  onAddNode?: () => void
  className?: string
}

export function FlowCanvas({ rule, onNodeClick, onAddNode, className }: FlowCanvasProps) {
  const tAuto = useTranslations('Auto')
  return (
    <div className={cn('relative p-6', className)}>
      {/* Trigger Node */}
      <div className="mb-4">
        <FlowNode
          node={rule.trigger}
          onClick={() => onNodeClick?.(rule.trigger)}
        />
      </div>

      {/* Action/Condition Nodes */}
      <div className="ml-8 space-y-4">
        {rule.nodes.map((node, index) => (
          <div key={node.id} className="relative">
            {/* Connection Line */}
            <div className="absolute left-0 -top-4 h-4 w-0.5 bg-border" />
            
            <FlowNode
              node={node}
              isLast={index === rule.nodes.length - 1 && !node.children?.length}
              onClick={() => onNodeClick?.(node)}
            />

            {/* Nested Children */}
            {node.children && node.children.length > 0 && (
              <div className="ml-8 mt-4 space-y-4">
                {/* Branch Label if needed */}
                {node.children.some(child => child.type === 'branch') && (
                  <div className="absolute left-4 -ml-2 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <UiText id="dal_05109d35" /></div>
                )}
                
                {node.children.map((child, childIndex) => (
                  <div key={child.id} className="relative border-l-2 border-border pl-4">
                    <FlowNode
                      node={child}
                      isLast={childIndex === node.children!.length - 1}
                      onClick={() => onNodeClick?.(child)}
                    />

                    {/* Deeper nested children */}
                    {child.children && child.children.length > 0 && (
                      <div className="ml-8 mt-4 space-y-4">
                        {child.children.map((grandChild, gcIndex) => (
                          <div key={grandChild.id} className="relative border-l-2 border-border pl-4">
                            <FlowNode
                              node={grandChild}
                              isLast={gcIndex === child.children!.length - 1}
                              onClick={() => onNodeClick?.(grandChild)}
                            />
                          </div>
                        ))}
                        
                        {/* Add node inside branch */}
                        <div className="relative border-l-2 border-border pl-4 pt-2">
                          <AddNodeButton label={tAuto('dala_ekle_9d433bac')} onClick={onAddNode} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Component Button */}
      <div className="ml-8 mt-4">
        <AddNodeButton onClick={onAddNode} />
      </div>
    </div>
  )
}

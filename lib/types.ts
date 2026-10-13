// Navigation Types
export interface NavItem {
  id: string
  label: string
  icon?: string
  href?: string
  badge?: string | number
  children?: NavItem[]
  isExternal?: boolean
  isActive?: boolean
  defaultOpen?: boolean
  showActions?: boolean
  iconColor?: string
}

export interface Breadcrumb {
  label: string
  href?: string
}

// Area/Project Types
export interface Area {
  id: string
  name: string
  description?: string
  type: 'product' | 'service' | 'support'
  icon?: string
  color: string
  quickLinks?: QuickLink[]
  viewCount?: number
  queueCount?: number
}

export interface QuickLink {
  label: string
  href: string
  count?: number
}

// Flow/Automation Types
export type FlowNodeType = 'trigger' | 'condition' | 'action' | 'branch'

export interface FlowNode {
  id: string
  type: FlowNodeType
  title: string
  description?: string
  icon?: string
  iconColor?: string
  hasError?: boolean
  errorCount?: number
  children?: FlowNode[]
}

export interface AutomationRule {
  id: string
  name: string
  status: 'new' | 'active' | 'disabled'
  trigger: FlowNode
  nodes: FlowNode[]
  createdAt: string
  updatedAt: string
}

// YouTube Workflow Types
export type WorkflowStatus = 'active' | 'draft' | 'paused' | 'failed' | 'archived'
export type WorkflowRunStatus = 'success' | 'warning' | 'failed' | 'running' | 'never'
export type WorkflowTriggerType = 'manual' | 'schedule' | 'youtube-event' | 'webhook'

export interface WorkflowMetric {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export type WorkflowNodePortType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'video'
  | 'audio'
  | 'image'
  | 'transcript'
  | 'segments'
  | 'timeline'
  | 'dict'
  | 'list'
  | 'any'

export interface WorkflowNodePort {
  id: string
  label: string
  type?: WorkflowNodePortType
  required?: boolean
}

export interface WorkflowDefinitionNode {
  id: string
  title: string
  subtitle: string
  kind: 'input' | 'trigger' | 'ai' | 'image' | 'render' | 'publish' | 'logic' | 'analytics' | 'note' | 'provider'
  provider: string
  status: WorkflowRunStatus
  cost?: string
  description: string
  position: {
    x: number
    y: number
  }
  inputs?: string[]
  outputs?: string[]
  inputPorts?: WorkflowNodePort[]
  outputPorts?: WorkflowNodePort[]
  settings?: Record<string, unknown>
}

export interface WorkflowDefinitionEdge {
  id: string
  source: string
  target: string
  label?: string
  sourceHandle?: string | null
  targetHandle?: string | null
  sourcePort?: string
  targetInput?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  channel: string
  projectId?: string | null
  owner: string
  status: WorkflowStatus
  triggerType: WorkflowTriggerType
  triggerLabel: string
  schedule: string
  lastRunAt: string
  lastRunStatus: WorkflowRunStatus
  nextRunAt: string
  runCount24h: number
  averageCost: string
  successRate: number
  nodesCount: number
  updatedAt: string
  metrics: WorkflowMetric[]
  nodes: WorkflowDefinitionNode[]
  edges: WorkflowDefinitionEdge[]
}

export interface WorkflowProjectOption {
  id: string
  label: string
  workflowCount?: number
}

// Action Types for Rule Builder
export interface ActionItem {
  id: string
  name: string
  icon: string
  iconColor?: string
  category: string
}

export interface ActionCategory {
  name: string
  count: number
  items: ActionItem[]
}

// Goal Types
export interface Goal {
  id: string
  name: string
  type: 'goal'
  status: 'on-track' | 'at-risk' | 'off-track'
  progress: number
  owner: User
  followers: User[]
  parentGoal?: string
  childGoals?: string[]
  teams?: string[]
  tags?: string[]
  startDate: string
  dueDate?: string
  risks?: Risk[]
  decisions?: Decision[]
}

export interface Risk {
  id: string
  title: string
  description: string
  author: User
  createdAt: string
  reactions?: Reaction[]
}

export interface Decision {
  id: string
  title: string
  description: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface Reaction {
  emoji: string
  count: number
  users: User[]
}

// Idea/Impact Assessment Types
export interface Idea {
  id: string
  summary: string
  theme?: IdeaTheme
  riceScore: number
  impact: number
  effort?: number
  customerSegments?: string[]
  status?: string
}

export interface IdeaTheme {
  id: string
  name: string
  icon: string
  color: string
}

export interface IdeaDetail extends Idea {
  hypothesis?: string
  validation?: string
  decision?: string
  roadmap?: string
  value?: number
}

// User Types
export interface User {
  id: string
  name: string
  avatar?: string
  email?: string
}

// Activity Types
export interface Activity {
  id: string
  type: 'created' | 'updated' | 'commented'
  title: string
  projectKey: string
  projectName: string
  timestamp: string
  user: User
}

// Application Types
export interface Application {
  id: string
  name: string
  icon: string
  iconBg?: string
  href: string
  isExternal?: boolean
}

export interface ApplicationCategory {
  title: string
  description?: string
  apps: Application[]
}

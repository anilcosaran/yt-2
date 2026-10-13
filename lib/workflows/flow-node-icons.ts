import type { LucideIcon } from 'lucide-react'
import {
  AudioLines,
  BookOpen,
  Braces,
  Clapperboard,
  Crop,
  Eye,
  Folder,
  GitBranch,
  ImageIcon,
  Images,
  Scissors,
  Sparkles,
  Subtitles,
  Type,
  Upload,
  Video,
  Wand2,
} from 'lucide-react'

import type { WorkflowDefinitionNode } from '@/lib/types'

export const FLOW_PICKER_FREQUENT_ORDER = [
  'image_generate',
  'video_generate',
  'speech_generate',
  'prompt_generate',
] as const

export const FLOW_NODE_ICON_TILE_CLASS =
  'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm'

export type FlowNodeVisualInput = {
  nodeType?: string | null
  kind?: WorkflowDefinitionNode['kind'] | string | null
  helperInput?: string | null
  pickerAction?: 'assets' | 'upload' | null
  title?: string | null
  settings?: Record<string, unknown> | null
}

export type FlowNodeVisual = {
  Icon: LucideIcon
  gradient: string
}

export function catalogNodeTypeName(nodeType: string | null | undefined) {
  return (nodeType ?? '').split('@')[0]?.trim().toLowerCase().replace(/-/g, '_') ?? ''
}

export function getFlowPickerFrequentRank(
  nodeType: string | null | undefined,
  helperInput?: string | null,
) {
  if (!nodeType && helperInput === 'prompt') return 0
  const index = FLOW_PICKER_FREQUENT_ORDER.indexOf(
    catalogNodeTypeName(nodeType) as (typeof FLOW_PICKER_FREQUENT_ORDER)[number],
  )
  return index === -1 ? FLOW_PICKER_FREQUENT_ORDER.length + 1 : index + 1
}

export function isFlowPickerFrequentItem(
  nodeType: string | null | undefined,
  helperInput?: string | null,
) {
  return getFlowPickerFrequentRank(nodeType, helperInput) <= FLOW_PICKER_FREQUENT_ORDER.length
}

export function getFlowNodeVisual(input: FlowNodeVisualInput): FlowNodeVisual {
  const key = resolveFlowNodeVisualKey(input)

  if (key === 'canvas-frame') {
    return { Icon: Crop, gradient: 'from-sky-400 to-blue-500' }
  }
  if (key === 'canvas-text') {
    return { Icon: Type, gradient: 'from-zinc-400 to-zinc-600' }
  }
  if (key === 'assets' || key.includes('folder')) {
    return { Icon: Folder, gradient: 'from-emerald-500 to-green-600' }
  }
  if (key === 'upload') {
    return { Icon: Upload, gradient: 'from-emerald-500 to-teal-600' }
  }
  if (key === 'prompt' || key === 'helper-prompt') {
    return { Icon: Braces, gradient: 'from-zinc-400 to-zinc-600' }
  }
  if (key === 'preview' || key === 'helper-preview') {
    return { Icon: Eye, gradient: 'from-cyan-500 to-teal-600' }
  }
  if (key === 'guide' || key === 'note') {
    return { Icon: BookOpen, gradient: 'from-slate-400 to-slate-600' }
  }
  if (key.includes('image-generate') || key === 'image' || key === 'helper-image') {
    return { Icon: ImageIcon, gradient: 'from-sky-400 to-blue-600' }
  }
  if (key.includes('video-generate') || key === 'video' || key === 'helper-video' || key.includes('render')) {
    return { Icon: Video, gradient: 'from-violet-500 to-indigo-700' }
  }
  if (
    key.includes('speech')
    || key.includes('voice')
    || key.includes('tts')
    || key === 'audio'
    || key === 'helper-audio'
  ) {
    return { Icon: AudioLines, gradient: 'from-fuchsia-500 to-pink-600' }
  }
  if (key.includes('prompt-generate') || key.includes('llm')) {
    return { Icon: Sparkles, gradient: 'from-lime-500 to-yellow-600' }
  }
  if (key.includes('prompt-enhance') || key.includes('enhance')) {
    return { Icon: Wand2, gradient: 'from-amber-500 to-orange-600' }
  }
  if (key.includes('caption') || key.includes('subtitle')) {
    return { Icon: Subtitles, gradient: 'from-violet-500 to-purple-600' }
  }
  if (key.includes('magic-clip') || key.includes('clip')) {
    return { Icon: Scissors, gradient: 'from-amber-500 to-yellow-600' }
  }
  if (key.includes('frame')) {
    return { Icon: Images, gradient: 'from-rose-500 to-red-600' }
  }
  if (key.includes('review') || key.includes('gate') || key.includes('logic')) {
    return { Icon: GitBranch, gradient: 'from-amber-500 to-orange-600' }
  }
  if (key.includes('brand') || key.includes('overlay')) {
    return { Icon: Clapperboard, gradient: 'from-fuchsia-500 to-pink-600' }
  }
  if (key.includes('research') || key.includes('transcript')) {
    return { Icon: Sparkles, gradient: 'from-cyan-500 to-teal-600' }
  }
  if (input.kind === 'image') return { Icon: ImageIcon, gradient: 'from-sky-400 to-blue-600' }
  if (input.kind === 'render') return { Icon: Clapperboard, gradient: 'from-violet-500 to-indigo-700' }
  if (input.kind === 'ai') return { Icon: Sparkles, gradient: 'from-lime-500 to-yellow-600' }
  if (input.kind === 'input') return { Icon: Braces, gradient: 'from-zinc-400 to-zinc-600' }
  if (input.kind === 'note') return { Icon: BookOpen, gradient: 'from-slate-400 to-slate-600' }
  if (input.kind === 'logic') return { Icon: GitBranch, gradient: 'from-amber-500 to-orange-600' }
  if (input.kind === 'publish') return { Icon: Upload, gradient: 'from-emerald-500 to-green-600' }

  return { Icon: Sparkles, gradient: 'from-amber-500 to-orange-600' }
}

function resolveFlowNodeVisualKey(input: FlowNodeVisualInput) {
  if (input.pickerAction) return input.pickerAction
  const settings = input.settings ?? {}
  if (settings.helper_frame === true) return 'canvas-frame'
  if (settings.helper_canvas_text === true) return 'canvas-text'
  if (settings.helper_preview === true) return 'preview'
  const helperInput = String(input.helperInput ?? settings.helper_input ?? '').trim().toLowerCase()
  if (helperInput) return `helper-${helperInput}`
  const nodeType = catalogNodeTypeName(input.nodeType ?? String(settings.node_type ?? settings.workflow_node_type ?? ''))
  if (nodeType) return nodeType.replace(/_/g, '-')
  const title = String(input.title ?? '').trim().toLowerCase()
  if (title) return title.replace(/\s+/g, '-')
  return String(input.kind ?? '').trim().toLowerCase()
}

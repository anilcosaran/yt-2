'use client'

import * as React from 'react'
import { publicCatalogText, publicModelLabel, publicWorkflowByline } from '@/lib/public-model-display'
import '@xyflow/react/dist/style.css'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type IsValidConnection,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag,
  type ReactFlowInstance,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react'
import {
  ArrowLeft,
  Bold,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Crop,
  Droplet,
  Eye,
  ExternalLink,
  FileText,
  Folder,
  GripVertical,
  Hand,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Play,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Type,
  Undo2,
  X,
  Minus,
  Map as MapIcon,
  MessageCircle,
} from 'lucide-react'

import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LanguageFlagIcon } from '@/components/i18n/language-flag-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { GuideMarkdownPreview } from '@/components/workflows/guide-markdown'
import {
  StorageMediaPickerDialog,
  uploadStorageMedia,
  type StorageMediaKind,
  type StorageMediaSelection,
} from '@/components/storage/storage-media-input'
import { bindFileInputCancel, openFileInput } from '@/lib/storage/open-file-picker'
import {
  FlowAngleIntentField,
  FlowCompactMediaField,
  FlowFrameGalleryField,
  FlowHelperMediaPreview,
  FlowIndexStripField,
  FlowMediaPreview,
  FlowVoiceProfileField,
  FlowVoiceReferenceField,
  FlowWarningField,
  isUsableFlowMediaUrl,
  workflowOpenAssetsEvent,
  type WorkflowOpenAssetsDetail,
} from '@/components/workflows/flow-node-fields'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { getLanguageDisplay, isLanguageSelectionFieldName } from '@/lib/i18n/language-display'
import { FLOW_ANGLE_CUSTOM, resolveAngleSettings } from '@/lib/workflows/angle-intent'
import {
  DEFAULT_PROMPT_MODELS,
  formatFlowFieldOption,
  flowNodeTypeKey,
  getCaptionWorkflowInlineFieldOrder as getCaptionWorkflowProfileFieldOrder,
  getFlowNodeInlineFields,
  getFlowNodePorts,
  getReviewInboundPreview,
  hasFlowNodeAdvancedFields,
  hasFlowNodePortProfile,
  isCatalogDefaultLeftUnset,
  isJsonBlobCatalogField,
  shouldHideCatalogPortAsWire,
  areFlowPortTypesCompatible,
  mergeFlowNodeSettings,
  isYoutubePublishUploadSettings,
  type FlowNodeChatModel,
  type FlowNodeField,
} from '@/lib/workflows/flow-node-profiles'
import { parseMediaDownloaderVideoUrl } from '@/lib/workflows/media-downloader-quote'
import { cn } from '@/lib/utils'
import { storageUsageAggregateQueryKey, storageUsageQueryKey } from '@/lib/storage/api'
import { localizeWorkflowDisplayText } from '@/lib/workflows/display-i18n'
import {
  FLOW_NODE_ICON_TILE_CLASS,
  catalogNodeTypeName,
  getFlowNodeVisual,
} from '@/lib/workflows/flow-node-icons'
import { buildPickerRuntimeGalleries, type PickerGalleryItem } from '@/lib/workflows/picker-runtime-gallery'
import {
  getWorkflowNodeDescription,
  getWorkflowNodeProvider,
  getWorkflowNodeSubtitle,
  getWorkflowNodeTitle,
} from '@/lib/workflows/node-display'
import {
  WorkflowNodePicker,
  isFlowPickerUtilityItem,
  type FlowPickerPlacement,
  type WorkflowPickerCategory,
  type WorkflowPickerItem,
} from '@/components/workflows/workflow-node-picker'
import type {
  WorkflowNodeCatalogItem,
  WorkflowNodeCatalogPort,
} from '@/lib/workflows/api'
import type {
  Workflow,
  WorkflowDefinitionNode,
  WorkflowNodePort,
  WorkflowNodePortType,
  WorkflowRunStatus,
} from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

type WorkflowCanvasNodeData = WorkflowDefinitionNode & Record<string, unknown> & {
  accent: string
  readOnly?: boolean
  frameChildLocked?: boolean
  runtimeBaseStatus?: WorkflowRunStatus
}

type WorkflowFlowNode = Node<WorkflowCanvasNodeData, 'workflowNode'>
type WorkflowFlowEdge = Edge
type CanvasInteractionMode = 'pan' | 'select'
type CanvasPanOnDrag = boolean | number[]
type AiPromptStatus = 'idle' | 'loading' | 'error'
type WorkflowCanvasMode = 'editor' | 'preview'
type WorkflowCanvasLocale = 'tr' | 'en'
type WorkflowCanvasCopy = ReturnType<typeof getWorkflowCanvasCopy>
type GuideViewMode = 'edit' | 'preview'
type GuideMarkdownAction = 'heading' | 'bold' | 'italic' | 'link' | 'bullet' | 'ordered' | 'quote' | 'code'
type GuideResizeEdge = 'right' | 'bottom' | 'corner'
type GuideNodeSize = {
  width: number
  height: number
}
export type WorkflowCanvasSnapshot = Workflow
export type WorkflowCanvasImageModel = {
  id: string
  label?: string
  cost_label?: string
  estimated_credits?: number | null
  input_schema?: Record<string, unknown>
  pricing_rule?: Record<string, unknown>
}
type CanvasHistorySnapshot = {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}
type CanvasContextMenuState = {
  type: 'node' | 'edge'
  id: string
  x: number
  y: number
} | null
type PendingNodeConnection = {
  nodeId: string
  port: string
  portType?: WorkflowNodePortType
  nodeType?: string
  handleType: 'source' | 'target'
}
type NodePickerRequest = {
  nodePosition: {
    x: number
    y: number
  }
  screenPosition?: {
    x: number
    y: number
  }
  placement?: FlowPickerPlacement
  connection?: PendingNodeConnection
} | null
type AssetPickerRequest = {
  mode: 'assets' | 'upload'
  position: {
    x: number
    y: number
  }
  connection?: PendingNodeConnection
  targetNodeId?: string
  mediaKind?: StorageMediaKind
  settingKey?: string
} | null

type WorkflowNodeFieldsChangeDetail = {
  nodeId: string
  patch: Pick<Partial<WorkflowCanvasNodeData>, 'title' | 'subtitle' | 'provider' | 'description' | 'settings'>
}

type WorkflowNodeActionDetail = {
  nodeId: string
  action: 'duplicate' | 'delete'
}

export type WorkflowCanvasProps = {
  workflow: Workflow
  onBack: (workflow?: WorkflowCanvasSnapshot) => void
  onRename?: (name: string) => void
  mode?: WorkflowCanvasMode
  /**
   * `full` (the Flow editor) has the top bar: back, name, Save, AI and Run. `embedded` (the canvas inside another
   * screen, like a Spark project's Plan › Akış) has none of it: that screen's own controls act on it.
   */
  chrome?: 'full' | 'embedded'
  headerBackIcon?: 'arrow' | 'panel'
  showHeaderTitle?: boolean
  showSave?: boolean
  allowAiPrompt?: boolean
  onSave?: (workflow: WorkflowCanvasSnapshot) => void
  onOpenInFlows?: (workflow: WorkflowCanvasSnapshot) => void
  onRun?: (workflow: WorkflowCanvasSnapshot) => void
  toolbarAccessory?: React.ReactNode
  runtimeNodeStatuses?: Record<string, WorkflowRunStatus>
  runtimeActiveNodeId?: string | null
  runLabel?: string
  runDisabled?: boolean
  runPending?: boolean
  savePending?: boolean
  saveLabel?: string
  saveSuccessSignal?: number
  locale?: WorkflowCanvasLocale
  imageModels?: WorkflowCanvasImageModel[]
  chatModels?: WorkflowCanvasImageModel[]
  nodeCatalog?: WorkflowNodeCatalogItem[]
  runOutput?: {
    outputs?: Array<{ nodeKey: string; outputData?: unknown }>
  } | null
}

const nodeTypes = {
  workflowNode: React.memo(WorkflowNodeCard),
} satisfies NodeTypes
const fitViewOptions = { padding: 0.18 }
const proOptions = { hideAttribution: true }
const defaultEdgeOptions = {
  type: ConnectionLineType.Bezier,
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
  style: { stroke: 'var(--primary)', strokeWidth: 1.6, fill: 'none' },
  pathOptions: { curvature: 0.36 },
} as const

const flowChromeDockClass =
  'flex items-center gap-1 rounded-2xl border border-border bg-popover/95 p-1.5 text-foreground shadow-2xl shadow-black/30 backdrop-blur-xl'

const flowChromeControlClass =
  'h-9 w-9 rounded-xl border-0 bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-accent hover:text-foreground'

const nodeAccents: Record<WorkflowDefinitionNode['kind'], string> = {
  input: '#00B8D9',
  trigger: '#0052CC',
  ai: '#6554C0',
  image: '#D946EF',
  render: '#FF5630',
  publish: '#36B37E',
  logic: '#FFAB00',
  analytics: '#00B8D9',
  note: '#8993A4',
  provider: '#6B778C',
}

const workflowNodeFieldsChangeEvent = 'youtorch:workflow-node-fields-change'
const workflowNodeActionEvent = 'youtorch:workflow-node-action'
const defaultFrameNodeSize = { width: 560, height: 360 }
const minFrameNodeSize = { width: 280, height: 180 }
const maxFrameNodeSize = { width: 1400, height: 900 }
const defaultFrameOpacity = 12
const minFrameOpacity = 6
const maxFrameOpacity = 45
const frameColorPresets = ['#7dd3fc', '#c4b5fd', '#86efac', '#fcd34d', '#fda4af'] as const
const canvasTextColorPresets = ['#f8fafc', '#cbd5e1', '#7dd3fc', '#fcd34d', '#fda4af'] as const
const canvasTextFonts = [
  { id: 'sans', family: 'inherit' },
  { id: 'serif', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', family: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { id: 'display', family: '"Poppins Caption", Poppins, sans-serif' },
] as const
const canvasTextSizes = [14, 18, 24, 32, 40] as const
const inputHandlePrefix = 'input:'
const outputHandlePrefix = 'output:'
const canvasHistoryLimit = 50
const canvasChromeIconClass =
  'nodrag nopan flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent hover:text-foreground'
const defaultWorkflowImageUrl = ''
const defaultGuideNodeSize: GuideNodeSize = { width: 500, height: 260 }
const minGuideNodeSize: GuideNodeSize = { width: 360, height: 180 }
const maxGuideNodeSize: GuideNodeSize = { width: 860, height: 620 }
const leftMouseButton = 0
const middleMouseButton = 1
const portHandleHitAreaClass = "nodrag nopan !z-20 !h-3 !w-3 !min-h-0 !min-w-0 !border-2 !border-card !cursor-crosshair before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-7 before:-translate-x-1/2 before:-translate-y-1/2 before:bg-transparent before:content-['']"
const imageTaskOptions = [
  { value: 'text_to_image', legacyLabel: 'Text to image' },
  { value: 'image_to_image', legacyLabel: 'Image to image' },
  { value: 'reference_image', legacyLabel: 'Reference' },
  { value: 'first_last_frame', legacyLabel: 'First-last frame' },
]
const imageInputTasks = new Set(['image_to_image', 'reference_image', 'first_last_frame'])
const PickerRuntimeGalleryContext = React.createContext<ReadonlyMap<string, PickerGalleryItem[]>>(new Map())
const WorkflowImageModelsContext = React.createContext<WorkflowCanvasImageModel[]>([])
const WorkflowChatModelsContext = React.createContext<FlowNodeChatModel[]>([])
const renderTaskOptions = [
  { value: 'compose_video', legacyLabel: 'Compose video' },
  { value: 'image_to_video', legacyLabel: 'Image to video' },
  { value: 'text_to_video', legacyLabel: 'Text to video' },
]
const promptModelOptions = [...DEFAULT_PROMPT_MODELS]

type LibraryNodeCategory = WorkflowPickerCategory
type LibraryNode = WorkflowPickerItem & {
  catalogItem?: WorkflowNodeCatalogItem
}

type WorkflowTranslator = (key: string, values?: Record<string, string | number>) => string

function getLocalLibraryNodes(t: WorkflowTranslator): LibraryNode[] {
  const guideMarkdown = t('library.guideMarkdown')
  return [
    {
      kind: 'input',
      category: 'Helpers',
      title: t('library.promptTitle'),
      subtitle: t('library.promptSubtitle'),
      provider: t('library.inputProvider'),
      description: t('library.promptDescription'),
      settings: { helper_input: 'prompt', helper_value: '' },
    },
    {
      kind: 'input',
      category: 'Helpers',
      title: t('library.imageTitle'),
      subtitle: t('library.imageSubtitle'),
      provider: t('library.inputProvider'),
      description: t('library.imageDescription'),
      pickerHidden: true,
      settings: { helper_input: 'image', helper_value: '', helper_preview_url: '' },
    },
    {
      kind: 'input',
      category: 'Helpers',
      title: t('library.videoTitle'),
      subtitle: t('library.videoSubtitle'),
      provider: t('library.inputProvider'),
      description: t('library.videoDescription'),
      pickerHidden: true,
      settings: { helper_input: 'video', helper_value: '' },
    },
    {
      kind: 'input',
      category: 'Helpers',
      title: t('library.audioTitle'),
      subtitle: t('library.audioSubtitle'),
      provider: t('library.inputProvider'),
      description: t('library.audioDescription'),
      pickerHidden: true,
      settings: { helper_input: 'audio', helper_value: '', helper_preview_url: '' },
      outputPorts: [{ id: 'audio', label: t('library.audioTitle'), type: 'audio' }],
    },
    {
      kind: 'logic',
      category: 'Logic & Utility',
      title: t('library.previewTitle'),
      subtitle: t('library.previewSubtitle'),
      provider: t('library.noteProvider'),
      description: t('library.previewDescription'),
      settings: { helper_preview: true, helper_value: '', helper_preview_url: '' },
      inputPorts: [{ id: 'media', label: t('library.previewInput'), type: 'any' }],
      outputPorts: [],
    },
    {
      kind: 'note',
      category: 'Helpers',
      title: t('library.guideTitle'),
      subtitle: '',
      provider: t('library.noteProvider'),
      description: guideMarkdown,
      settings: {
        helper_value: guideMarkdown,
        content_format: 'markdown',
        guide_width: defaultGuideNodeSize.width,
        guide_height: defaultGuideNodeSize.height,
      },
    },
    {
      kind: 'note',
      category: 'Logic & Utility',
      title: t('library.textTitle'),
      subtitle: t('library.textSubtitle'),
      provider: t('library.noteProvider'),
      description: t('library.textDescription'),
      pickerHidden: true,
      settings: {
        helper_canvas_text: true,
        helper_value: '',
        text_font: 'sans',
        text_size: 24,
        text_weight: 'normal',
        text_style: 'normal',
        text_color: canvasTextColorPresets[0],
      },
    },
    {
      kind: 'note',
      category: 'Logic & Utility',
      title: t('library.frameTitle'),
      subtitle: t('library.frameSubtitle'),
      provider: t('library.noteProvider'),
      description: t('library.frameDescription'),
      pickerHidden: true,
      settings: {
        helper_frame: true,
        frame_color: frameColorPresets[0],
        frame_opacity: defaultFrameOpacity,
        frame_locked: false,
        frame_width: defaultFrameNodeSize.width,
        frame_height: defaultFrameNodeSize.height,
      },
    },
  ]
}

function getWorkflowCanvasCopy(t: WorkflowTranslator) {
  return {
    back: t('canvas.back'),
    workflowName: t('canvas.workflowName'),
    save: t('canvas.save'),
    start: t('canvas.start'),
    run: t('canvas.run'),
    statusActive: t('canvas.statusActive'),
    statusPaused: t('canvas.statusPaused'),
    statusFailed: t('canvas.statusFailed'),
    statusArchived: t('canvas.statusArchived'),
    statusDraft: t('canvas.statusDraft'),
    aiWorking: t('canvas.aiWorking'),
    aiPrompt: t('canvas.aiPrompt'),
    stopAi: t('canvas.stopAi'),
    retryAi: t('canvas.retryAi'),
    sendAi: t('canvas.sendAi'),
    closeAi: t('canvas.closeAi'),
    pan: t('canvas.pan'),
    select: t('canvas.select'),
    undo: t('canvas.undo'),
    redo: t('canvas.redo'),
    zoomOut: t('canvas.zoomOut'),
    zoomIn: t('canvas.zoomIn'),
    fit: t('canvas.fit'),
    addNode: t('canvas.addNode'),
    askAi: t('canvas.askAi'),
    chat: t('canvas.chat'),
    minimap: t('canvas.minimap'),
    emptyTitle: t('canvas.emptyTitle'),
    emptyHint: t('canvas.emptyHint'),
    status: t('canvas.status'),
    assets: t('canvas.assets'),
    addText: t('canvas.addText'),
    addFrame: t('canvas.addFrame'),
    dragText: t('canvas.dragText'),
    nodeActions: t('canvas.nodeActions'),
  }
}

export function WorkflowCanvas({
  workflow,
  onBack,
  onRename,
  mode = 'editor',
  chrome = 'full',
  headerBackIcon = 'arrow',
  showHeaderTitle = true,
  showSave = false,
  allowAiPrompt = true,
  onSave,
  onOpenInFlows,
  onRun,
  toolbarAccessory,
  runtimeNodeStatuses,
  runtimeActiveNodeId,
  runLabel,
  runDisabled = false,
  runPending = false,
  savePending = false,
  saveLabel,
  saveSuccessSignal = 0,
  imageModels,
  chatModels,
  nodeCatalog,
  runOutput,
}: WorkflowCanvasProps) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const { activeChannelId } = useActiveChannel()
  const isPreview = mode === 'preview'
  const copy = getWorkflowCanvasCopy(tWorkflows)
  const resolvedSaveLabel = saveLabel ?? copy.save
  const resolvedImageModels = React.useMemo(() => normalizeWorkflowImageModels(imageModels), [imageModels])
  const resolvedChatModels = React.useMemo(() => normalizeWorkflowImageModels(chatModels), [chatModels])
  const resolvedLibraryNodes = React.useMemo(() => buildWorkflowLibraryNodes(nodeCatalog, tWorkflows), [nodeCatalog, tWorkflows])
  const catalogByNodeType = React.useMemo(() => buildWorkflowNodeCatalogMap(nodeCatalog), [nodeCatalog])
  const initialNodes = React.useMemo(() => mapWorkflowNodes(workflow.nodes, isPreview), [isPreview, workflow.nodes])
  const initialEdges = React.useMemo(() => mapWorkflowEdges(workflow.edges, workflow.nodes), [workflow.edges, workflow.nodes])
  const [nodes, setNodes] = React.useState<WorkflowFlowNode[]>(initialNodes)
  const [edges, setEdges] = React.useState<WorkflowFlowEdge[]>(initialEdges)
  const pickerGalleries = React.useMemo(
    () => buildPickerRuntimeGalleries(
      nodes.map((node) => ({ id: node.id, settings: node.data.settings })),
      edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        sourcePort: typeof edge.data?.sourcePort === 'string' ? edge.data.sourcePort : undefined,
        targetInput: typeof edge.data?.targetInput === 'string' ? edge.data.targetInput : undefined,
      })),
      runOutput,
    ),
    [edges, nodes, runOutput],
  )
  const nodesRef = React.useRef<WorkflowFlowNode[]>(initialNodes)
  const edgesRef = React.useRef<WorkflowFlowEdge[]>(initialEdges)
  const bootstrappedWorkflowIdRef = React.useRef<string | null>(null)
  const dragStartSnapshotRef = React.useRef<CanvasHistorySnapshot | null>(null)
  const [history, setHistory] = React.useState<{ past: CanvasHistorySnapshot[]; future: CanvasHistorySnapshot[] }>({
    past: [],
    future: [],
  })
  const [contextMenu, setContextMenu] = React.useState<CanvasContextMenuState>(null)
  const [nodePicker, setNodePicker] = React.useState<NodePickerRequest>(null)
  const [assetPicker, setAssetPicker] = React.useState<AssetPickerRequest>(null)
  const [isDraggingNode, setIsDraggingNode] = React.useState(false)
  const [interactionMode, setInteractionMode] = React.useState<CanvasInteractionMode>('pan')
  const [minimapOpen, setMinimapOpen] = React.useState(false)
  const [zoomPercent, setZoomPercent] = React.useState(100)
  const [aiChatOpen, setAiChatOpen] = React.useState(false)
  const [saveConfirmed, setSaveConfirmed] = React.useState(false)
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const connectionStartRef = React.useRef<PendingNodeConnection | null>(null)
  const ignoreNextPaneClickRef = React.useRef(false)
  const panOnDrag = React.useMemo<CanvasPanOnDrag>(() => {
    return isPreview || interactionMode === 'pan'
      ? [leftMouseButton, middleMouseButton]
      : [middleMouseButton]
  }, [interactionMode, isPreview])

  const setCanvasState = React.useCallback((nextNodes: WorkflowFlowNode[], nextEdges: WorkflowFlowEdge[]) => {
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [])

  const recordHistorySnapshot = React.useCallback((snapshot: CanvasHistorySnapshot) => {
    setHistory((current) => ({
      past: [...current.past, cloneCanvasSnapshot(snapshot)].slice(-canvasHistoryLimit),
      future: [],
    }))
  }, [])

  const commitCanvasState = React.useCallback((
    nextNodes: WorkflowFlowNode[],
    nextEdges: WorkflowFlowEdge[],
    before: CanvasHistorySnapshot = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current),
  ) => {
    const nextSnapshot = createCanvasHistorySnapshot(nextNodes, nextEdges)
    if (!canvasSnapshotsEqual(before, nextSnapshot)) {
      recordHistorySnapshot(before)
    }
    setCanvasState(nextSnapshot.nodes, nextSnapshot.edges)
  }, [recordHistorySnapshot, setCanvasState])

  const undoCanvas = React.useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1)
      if (!previous) return current
      const currentSnapshot = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      setCanvasState(previous.nodes, previous.edges)
      return {
        past: current.past.slice(0, -1),
        future: [currentSnapshot, ...current.future].slice(0, canvasHistoryLimit),
      }
    })
    setContextMenu(null)
  }, [setCanvasState])

  const redoCanvas = React.useCallback(() => {
    setHistory((current) => {
      const next = current.future[0]
      if (!next) return current
      const currentSnapshot = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      setCanvasState(next.nodes, next.edges)
      return {
        past: [...current.past, currentSnapshot].slice(-canvasHistoryLimit),
        future: current.future.slice(1),
      }
    })
    setContextMenu(null)
  }, [setCanvasState])

  React.useEffect(() => {
    if (bootstrappedWorkflowIdRef.current === workflow.id) return
    bootstrappedWorkflowIdRef.current = workflow.id
    nodesRef.current = initialNodes
    edgesRef.current = initialEdges
    dragStartSnapshotRef.current = null
    const frame = window.requestAnimationFrame(() => {
      setCanvasState(initialNodes, initialEdges)
      setHistory({ past: [], future: [] })
      setContextMenu(null)
      setNodePicker(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialEdges, initialNodes, setCanvasState, workflow.id])

  React.useEffect(() => {
    if (catalogByNodeType.size === 0) return
    let changed = false
    const nextNodes = nodesRef.current.map((node) => {
      const hydrated = hydrateFlowNodeFromCatalog(node, catalogByNodeType)
      if (hydrated !== node) changed = true
      return hydrated
    })
    if (!changed) return
    setCanvasState(nextNodes, edgesRef.current)
  }, [catalogByNodeType, setCanvasState])

  React.useEffect(() => {
    if (saveSuccessSignal <= 0) return undefined
    setSaveConfirmed(true)
    const timeout = window.setTimeout(() => setSaveConfirmed(false), 1400)
    return () => window.clearTimeout(timeout)
  }, [saveSuccessSignal])

  React.useEffect(() => {
    const handleNodeFieldsChange = (event: Event) => {
      if (isPreview) return
      const detail = (event as CustomEvent<WorkflowNodeFieldsChangeDetail>).detail
      if (!detail?.nodeId) return

      const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      let changedNodeData: WorkflowCanvasNodeData | null = null
      const mappedNodes = nodesRef.current.map((node) => {
        if (node.id !== detail.nodeId) return node
        changedNodeData = applyDerivedNodePorts({
          ...node.data,
          ...detail.patch,
          settings: mergeFlowNodeSettings(node.data.settings, detail.patch.settings),
        })
        const frameLayout = isCanvasFrameNode(changedNodeData) ? canvasFrameFlowProps(changedNodeData.settings) : null
        return {
          ...node,
          data: changedNodeData,
          ...(frameLayout ?? {}),
        }
      })

      if (!changedNodeData) return
      const nextNodes = applyParentFrameLockState(mappedNodes)

      const validSources = new Set(getNodePorts(changedNodeData, 'output').map((port) => port.id))
      const validTargets = new Set(getNodePorts(changedNodeData, 'input').map((port) => port.id))
      const nextEdges = edgesRef.current.filter((edge) => {
        if (edge.source !== detail.nodeId && edge.target !== detail.nodeId) return true
        const sourcePort = getPortIdFromHandle(edge.sourceHandle, 'output')
        const targetPort = getPortIdFromHandle(edge.targetHandle, 'input')
        return (edge.source !== detail.nodeId || (sourcePort != null && validSources.has(sourcePort)))
          && (edge.target !== detail.nodeId || (targetPort != null && validTargets.has(targetPort)))
      })
      commitCanvasState(nextNodes, nextEdges, before)
    }

    window.addEventListener(workflowNodeFieldsChangeEvent, handleNodeFieldsChange)
    return () => window.removeEventListener(workflowNodeFieldsChangeEvent, handleNodeFieldsChange)
  }, [commitCanvasState, isPreview])

  React.useEffect(() => {
    const nextNodes = applyRuntimeNodeState(nodesRef.current, runtimeNodeStatuses, runtimeActiveNodeId)
    if (nextNodes !== nodesRef.current) {
      setCanvasState(nextNodes, edgesRef.current)
    }
  }, [runtimeActiveNodeId, runtimeNodeStatuses, setCanvasState])

  const onNodesChange = React.useCallback((changes: NodeChange<WorkflowFlowNode>[]) => {
    if (isPreview) return
    const lockedIds = new Set(
      nodesRef.current
        .filter((node) => (
          node.draggable === false
          || node.data.frameChildLocked
          || (isCanvasFrameNode(node.data) && isFrameLocked(node.data.settings))
        ))
        .map((node) => node.id),
    )
    const allowedChanges = lockedIds.size === 0
      ? changes
      : changes.filter((change) => change.type !== 'position' || !lockedIds.has(change.id))
    if (allowedChanges.length === 0) return
    const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
    const nextNodes = applyNodeChanges(allowedChanges, nodesRef.current)
    const removedNodeIds = new Set(
      allowedChanges
        .filter((change) => change.type === 'remove')
        .map((change) => change.id),
    )
    const nextEdges = removedNodeIds.size > 0
      ? edgesRef.current.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
      : edgesRef.current
    const shouldRecord = allowedChanges.some((change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace')
    if (shouldRecord) {
      commitCanvasState(nextNodes, nextEdges, before)
      return
    }
    setCanvasState(nextNodes, nextEdges)
  }, [commitCanvasState, isPreview, setCanvasState])

  const onEdgesChange = React.useCallback((changes: EdgeChange<WorkflowFlowEdge>[]) => {
    if (isPreview) return
    const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
    const nextEdges = applyEdgeChanges(changes, edgesRef.current)
    const shouldRecord = changes.some((change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace')
    if (shouldRecord) {
      commitCanvasState(nodesRef.current, nextEdges, before)
      return
    }
    setCanvasState(nodesRef.current, nextEdges)
  }, [commitCanvasState, isPreview, setCanvasState])

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (isPreview) return
      const validConnection = getValidWorkflowConnection(connection)
      if (!validConnection) return
      const { source, target, sourceHandle, targetHandle, sourcePort, targetInput } = validConnection

      const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      const nextEdges = addEdge(
        {
          ...connection,
          id: `${source}-${sourcePort}-${target}-${targetInput}-${Date.now()}`,
          source,
          target,
          sourceHandle,
          targetHandle,
          ...defaultEdgeOptions,
        },
        edgesRef.current,
      )
      const nextNodes = copyInboundPreviewOntoReviewNode(
        nodesRef.current,
        source,
        target,
      )
      commitCanvasState(nextNodes, nextEdges, before)
    },
    [commitCanvasState, isPreview],
  )

  const isValidWorkflowConnection = React.useCallback<IsValidConnection<WorkflowFlowEdge>>(
    (connection) => {
      if (isPreview) return false
      const valid = getValidWorkflowConnection(connection)
      if (!valid) return false
      const sourceNode = nodesRef.current.find((node) => node.id === valid.source)
      const targetNode = nodesRef.current.find((node) => node.id === valid.target)
      if (!sourceNode || !targetNode) return true
      const sourceType = getNodePorts(sourceNode.data, 'output').find((port) => port.id === valid.sourcePort)?.type
      const targetType = getNodePorts(targetNode.data, 'input').find((port) => port.id === valid.targetInput)?.type
      return areFlowPortTypesCompatible(sourceType, targetType, {
        targetNodeType: catalogNodeTypeName(String(targetNode.data.settings?.node_type ?? targetNode.data.settings?.workflow_node_type ?? '')),
        targetPortId: valid.targetInput,
      })
    },
    [isPreview],
  )

  const getPendingConnectionFromHandle = React.useCallback((
    nodeId: string | null | undefined,
    handleId: string | null | undefined,
    handleType?: string | null,
  ): PendingNodeConnection | null => {
    if (!nodeId || !handleId) return null

    const direction: 'source' | 'target' = handleType === 'target' || handleId.startsWith(inputHandlePrefix)
      ? 'target'
      : 'source'
    const port = getPortIdFromHandle(handleId, direction === 'target' ? 'input' : 'output')
    if (!port) return null

    const node = nodesRef.current.find((item) => item.id === nodeId)
    const portType = node
      ? getNodePorts(node.data, direction === 'target' ? 'input' : 'output').find((item) => item.id === port)?.type
      : undefined

    return {
      nodeId,
      port,
      portType,
      nodeType: catalogNodeTypeName(String(node?.data.settings?.node_type ?? node?.data.settings?.workflow_node_type ?? '')),
      handleType: direction,
    }
  }, [])

  const getVisibleDropPosition = React.useCallback(
    (point?: { x: number; y: number }) => {
      if (!reactFlowInstance) {
        return { x: 120, y: 160 }
      }

      const bounds = canvasRef.current?.getBoundingClientRect()
      const screenPoint = point ?? {
        x: (bounds?.left ?? 0) + (bounds?.width ?? window.innerWidth) / 2,
        y: (bounds?.top ?? 0) + (bounds?.height ?? window.innerHeight) / 2,
      }
      const position = reactFlowInstance.screenToFlowPosition(screenPoint)

      return {
        x: position.x - 172,
        y: position.y - 108,
      }
    },
    [reactFlowInstance],
  )

  const openNodePickerAtPoint = React.useCallback((
    point?: { x: number; y: number },
    connection?: PendingNodeConnection,
    placement: FlowPickerPlacement = 'cursor',
  ) => {
    if (isPreview) return

    const bounds = canvasRef.current?.getBoundingClientRect()
    const clientPoint = point ?? {
      x: (bounds?.left ?? 0) + (bounds?.width ?? window.innerWidth) / 2,
      y: (bounds?.top ?? 0) + (bounds?.height ?? window.innerHeight) / 2,
    }

    setContextMenu(null)
    setNodePicker({
      nodePosition: getVisibleDropPosition(placement === 'toolbelt' ? undefined : clientPoint),
      screenPosition: {
        x: clientPoint.x - (bounds?.left ?? 0),
        y: clientPoint.y - (bounds?.top ?? 0),
      },
      placement,
      connection,
    })
  }, [getVisibleDropPosition, isPreview])

  const addLibraryNode = React.useCallback(
    (
      item: LibraryNode,
      position = getVisibleDropPosition(),
      connection?: PendingNodeConnection,
    ) => {
      if (isPreview) return
      const id = `${item.kind}-${Date.now()}`
      const settings: Record<string, unknown> = {
        ...defaultNodeSettings(item.kind),
        ...(item.nodeType ? { node_type: item.nodeType } : {}),
        ...(item.settings ?? {}),
      }
      const seededData = applyDerivedNodePorts({
        id,
        title: item.title,
        subtitle: item.subtitle ?? (item.kind === 'ai' ? 'AI node' : item.kind),
        kind: item.kind,
        provider: item.provider,
        status: 'never',
        cost: item.cost ?? '0c',
        description: item.description,
        position,
        settings,
        inputs: [],
        outputs: [],
        inputPorts: item.inputPorts,
        outputPorts: item.outputPorts,
        accent: nodeAccents[item.kind],
        readOnly: false,
      })
      const inputPorts = seededData.inputPorts ?? []
      const outputPorts = seededData.outputPorts ?? []

      const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      const nextNode: WorkflowFlowNode = {
        id,
        type: 'workflowNode',
        position,
        className: '!overflow-visible',
        ...(isCanvasFrameNode(seededData) ? canvasFrameFlowProps(seededData.settings) : { zIndex: 1 }),
        data: seededData,
      }
      const nextEdges = connection
        ? edgeForPendingNodeConnection(connection, {
          id,
          inputPorts,
          outputPorts,
          nodeType: catalogNodeTypeName(item.nodeType ?? String(settings.node_type ?? '')),
        }, edgesRef.current)
        : edgesRef.current
      const nextNodes = applyFrameMembership(
        isCanvasFrameNode(seededData) ? [nextNode, ...nodesRef.current] : [...nodesRef.current, nextNode],
        id,
      )
      commitCanvasState(orderCanvasNodes(nextNodes), nextEdges, before)
    },
    [commitCanvasState, getVisibleDropPosition, isPreview],
  )

  const handleNodePickerSelect = React.useCallback((item: WorkflowPickerItem) => {
    if (!nodePicker) return
    if (item.pickerAction === 'assets' || item.pickerAction === 'upload') {
      setAssetPicker({
        mode: item.pickerAction,
        position: nodePicker.nodePosition,
        connection: nodePicker.connection?.handleType === 'source' ? nodePicker.connection : undefined,
      })
      setNodePicker(null)
      return
    }
    addLibraryNode(item, nodePicker.nodePosition, nodePicker.connection)
    setNodePicker(null)
  }, [addLibraryNode, nodePicker])

  const handleAssetSelection = React.useCallback((selection: StorageMediaSelection) => {
    if (assetPicker?.targetNodeId) {
      const node = nodesRef.current.find((current) => current.id === assetPicker.targetNodeId)
      if (node) {
        dispatchNodeFieldsChange(node.id, {
          settings: storageSelectionSettingsForNode(node.data, selection, assetPicker.settingKey),
        })
      }
      setAssetPicker(null)
      return
    }
    const helper = libraryNodeFromStorageSelection(selection, tWorkflows, resolvedLibraryNodes)
    if (!helper) return
    addLibraryNode(helper, assetPicker?.position, assetPicker?.connection)
    setAssetPicker(null)
  }, [addLibraryNode, assetPicker, resolvedLibraryNodes, tWorkflows])

  const openAssetPicker = React.useCallback((mode: 'assets' | 'upload' = 'assets') => {
    if (isPreview) return
    setAssetPicker({
      mode,
      position: getVisibleDropPosition(),
    })
  }, [getVisibleDropPosition, isPreview])

  const addPromptNode = React.useCallback(
    (prompt: string) => {
      if (isPreview) return
      const description = prompt.trim()
      if (!description) return

      const id = `ai-${Date.now()}`
      const position = getVisibleDropPosition()
      const title = description.length > 34 ? `${description.slice(0, 34)}...` : description

      const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
      const nextNode: WorkflowFlowNode = {
        id,
        type: 'workflowNode',
        className: '!overflow-visible',
        position,
        data: {
          id,
          title,
          subtitle: 'AI step',
          kind: 'ai',
          provider: 'Youtorch AI',
          status: 'never',
          cost: '0c',
          description,
          position,
          inputs: ['context'],
          outputs: ['plan'],
          inputPorts: [{ id: 'context', label: 'Context', type: 'string' }],
          outputPorts: [{ id: 'plan', label: 'Plan', type: 'string' }],
          accent: nodeAccents.ai,
          readOnly: false,
        },
      }
      commitCanvasState([...nodesRef.current, nextNode], edgesRef.current, before)
    },
    [commitCanvasState, getVisibleDropPosition, isPreview],
  )

  const handleCanvasDragOver = React.useCallback((event: React.DragEvent) => {
    if (isPreview) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [isPreview])

  const handleCanvasDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (isPreview) return
      event.preventDefault()
      setContextMenu(null)
      setNodePicker(null)

      const item = readDraggedLibraryNode(event.dataTransfer, resolvedLibraryNodes)
      if (!item) return

      addLibraryNode(item, getVisibleDropPosition({ x: event.clientX, y: event.clientY }))
    },
    [addLibraryNode, getVisibleDropPosition, isPreview, resolvedLibraryNodes],
  )

  const deleteElements = React.useCallback((nodeIds: string[] = [], edgeIds: string[] = []) => {
    if (isPreview) return
    const nodeIdSet = new Set(
      nodeIds.filter((nodeId) => {
        const node = nodesRef.current.find((current) => current.id === nodeId)
        return node && !node.data.frameChildLocked
      }),
    )
    const edgeIdSet = new Set(edgeIds)
    if (nodeIdSet.size === 0 && edgeIdSet.size === 0) return

    const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
    const { nodes: nextNodes, edges: nextEdges } = removeCanvasElements(
      nodesRef.current,
      edgesRef.current,
      nodeIdSet,
      edgeIdSet,
    )
    commitCanvasState(nextNodes, nextEdges, before)
    setContextMenu(null)
  }, [commitCanvasState, isPreview])

  const deleteSelectedElements = React.useCallback(() => {
    const selectedNodeIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    deleteElements(selectedNodeIds, selectedEdgeIds)
  }, [deleteElements])

  const duplicateNode = React.useCallback((nodeId: string) => {
    if (isPreview) return
    const sourceNode = nodesRef.current.find((node) => node.id === nodeId)
    if (!sourceNode || sourceNode.data.frameChildLocked) return

    const id = `${sourceNode.data.kind}-${Date.now()}`
    const position = {
      x: sourceNode.position.x + 40,
      y: sourceNode.position.y + 40,
    }
    const data = applyDerivedNodePorts({
      ...sourceNode.data,
      id,
      title: `${sourceNode.data.title} copy`,
      status: 'never',
      position,
      isRuntimeActive: false,
      readOnly: false,
    })
    const nextNode: WorkflowFlowNode = {
      ...sourceNode,
      id,
      selected: true,
      position,
      className: '!overflow-visible',
      data,
      ...(isCanvasFrameNode(data) ? canvasFrameFlowProps(data.settings) : { zIndex: 1 }),
    }
    const before = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
    const nextNodes = [
      ...nodesRef.current.map((node) => ({ ...node, selected: false })),
      nextNode,
    ]
    const nextEdges = edgesRef.current.map((edge) => ({ ...edge, selected: false }))
    commitCanvasState(nextNodes, nextEdges, before)
    setContextMenu(null)
  }, [commitCanvasState, isPreview])

  React.useEffect(() => {
    if (isPreview) return undefined
    const handleOpenAssets = (event: Event) => {
      const detail = (event as CustomEvent<WorkflowOpenAssetsDetail>).detail
      if (!detail?.nodeId) return
      setAssetPicker({
        mode: 'assets',
        position: getVisibleDropPosition(),
        targetNodeId: detail.nodeId,
        mediaKind: detail.mediaKind,
        settingKey: detail.settingKey,
      })
    }
    const handleNodeAction = (event: Event) => {
      const detail = (event as CustomEvent<WorkflowNodeActionDetail>).detail
      if (!detail?.nodeId) return
      if (detail.action === 'duplicate') duplicateNode(detail.nodeId)
      if (detail.action === 'delete') deleteElements([detail.nodeId], [])
    }
    window.addEventListener(workflowOpenAssetsEvent, handleOpenAssets)
    window.addEventListener(workflowNodeActionEvent, handleNodeAction)
    return () => {
      window.removeEventListener(workflowOpenAssetsEvent, handleOpenAssets)
      window.removeEventListener(workflowNodeActionEvent, handleNodeAction)
    }
  }, [deleteElements, duplicateNode, getVisibleDropPosition, isPreview])

  const getContextMenuPosition = React.useCallback((event: React.MouseEvent) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    }
  }, [])

  const handleNodeContextMenu = React.useCallback((event: React.MouseEvent, node: WorkflowFlowNode) => {
    if (isPreview) return
    event.preventDefault()
    const position = getContextMenuPosition(event)
    const nextNodes = nodesRef.current.map((currentNode) => ({ ...currentNode, selected: currentNode.id === node.id }))
    const nextEdges = edgesRef.current.map((edge) => ({ ...edge, selected: false }))
    setCanvasState(nextNodes, nextEdges)
    setContextMenu({ type: 'node', id: node.id, x: position.x, y: position.y })
  }, [getContextMenuPosition, isPreview, setCanvasState])

  const handleEdgeContextMenu = React.useCallback((event: React.MouseEvent, edge: WorkflowFlowEdge) => {
    if (isPreview) return
    event.preventDefault()
    const position = getContextMenuPosition(event)
    const nextNodes = nodesRef.current.map((node) => ({ ...node, selected: false }))
    const nextEdges = edgesRef.current.map((currentEdge) => ({ ...currentEdge, selected: currentEdge.id === edge.id }))
    setCanvasState(nextNodes, nextEdges)
    setContextMenu({ type: 'edge', id: edge.id, x: position.x, y: position.y })
  }, [getContextMenuPosition, isPreview, setCanvasState])

  const handleConnectStart = React.useCallback<OnConnectStart>((_event, params) => {
    if (isPreview || !params.nodeId || !params.handleId) {
      connectionStartRef.current = null
      return
    }

    connectionStartRef.current = getPendingConnectionFromHandle(
      params.nodeId,
      params.handleId,
      params.handleType,
    )
  }, [getPendingConnectionFromHandle, isPreview])

  const handleConnectEnd = React.useCallback<OnConnectEnd>((event, connectionState: FinalConnectionState) => {
    const state = connectionState as FinalConnectionState & {
      fromHandle?: { id?: string | null } | null
      fromNode?: { id?: string } | null
    }
    const pendingConnection = connectionStartRef.current
      ?? getPendingConnectionFromHandle(
        state.fromNode?.id,
        state.fromHandle?.id,
        (state.fromHandle as { type?: string | null } | undefined)?.type,
      )
    connectionStartRef.current = null
    const droppedOnExistingHandle = Boolean(connectionState.toHandle)

    if (
      isPreview
      || !pendingConnection
      || droppedOnExistingHandle
    ) {
      return
    }

    ignoreNextPaneClickRef.current = true
    window.setTimeout(() => {
      ignoreNextPaneClickRef.current = false
    }, 250)
    const point = getClientPointFromEvent(event)
    openNodePickerAtPoint(point, pendingConnection)
  }, [getPendingConnectionFromHandle, isPreview, openNodePickerAtPoint])

  const handlePaneClick = React.useCallback((event: React.MouseEvent) => {
    if (ignoreNextPaneClickRef.current) {
      ignoreNextPaneClickRef.current = false
      return
    }
    if (event.detail >= 2) {
      if (isPreview) return
      event.preventDefault()
      openNodePickerAtPoint({ x: event.clientX, y: event.clientY })
      return
    }
    setContextMenu(null)
    setNodePicker(null)
  }, [isPreview, openNodePickerAtPoint])

  const handleCanvasMouseDownCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== middleMouseButton) return
    event.preventDefault()
    setContextMenu(null)
  }, [])

  const handleCanvasAuxClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== middleMouseButton) return
    event.preventDefault()
  }, [])

  const handleNodeDragStart = React.useCallback(() => {
    setIsDraggingNode(true)
    setContextMenu(null)
    dragStartSnapshotRef.current = createCanvasHistorySnapshot(nodesRef.current, edgesRef.current)
  }, [])
  const handleNodeDragStop = React.useCallback<OnNodeDrag<WorkflowFlowNode>>((_event, node) => {
    setIsDraggingNode(false)
    const before = dragStartSnapshotRef.current
    dragStartSnapshotRef.current = null
    const nextNodes = orderCanvasNodes(applyParentFrameLockState(applyFrameMembership(nodesRef.current, node.id)))
    if (nextNodes !== nodesRef.current) setCanvasState(nextNodes, edgesRef.current)
    if (!before) return
    const after = createCanvasHistorySnapshot(nextNodes, edgesRef.current)
    if (!canvasSnapshotsEqual(before, after)) {
      recordHistorySnapshot(before)
    }
  }, [recordHistorySnapshot, setCanvasState])

  React.useEffect(() => {
    if (isPreview) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return

      const key = event.key.toLowerCase()
      const modKey = event.ctrlKey || event.metaKey
      if ((event.key === 'Delete' || event.key === 'Backspace') && !modKey) {
        event.preventDefault()
        deleteSelectedElements()
        return
      }
      if (modKey && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redoCanvas()
          return
        }
        undoCanvas()
        return
      }
      if (modKey && key === 'y') {
        event.preventDefault()
        redoCanvas()
        return
      }
      if ((!modKey && key === '/') || (modKey && key === 'k')) {
        event.preventDefault()
        openNodePickerAtPoint()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedElements, isPreview, openNodePickerAtPoint, redoCanvas, undoCanvas])

  const zoomIn = React.useCallback(() => {
    reactFlowInstance?.zoomIn()
  }, [reactFlowInstance])

  const zoomOut = React.useCallback(() => {
    reactFlowInstance?.zoomOut()
  }, [reactFlowInstance])

  const fitCanvas = React.useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.18 })
  }, [reactFlowInstance])

  const createWorkflowSnapshot = React.useCallback((): WorkflowCanvasSnapshot => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    return {
      ...workflow,
      nodes: currentNodes.map(mapFlowNodeToWorkflowNode),
      edges: currentEdges.filter(isWorkflowEdgePersistable).map(mapFlowEdgeToWorkflowEdge),
      nodesCount: currentNodes.length,
    }
  }, [workflow])

  const handleSave = React.useCallback(() => {
    onSave?.(createWorkflowSnapshot())
  }, [createWorkflowSnapshot, onSave])

  const handleBack = React.useCallback(() => {
    onBack(createWorkflowSnapshot())
  }, [createWorkflowSnapshot, onBack])

  const handleRun = React.useCallback(() => {
    onRun?.(createWorkflowSnapshot())
  }, [createWorkflowSnapshot, onRun])

  const handleOpenInFlows = React.useCallback(() => {
    onOpenInFlows?.(createWorkflowSnapshot())
  }, [createWorkflowSnapshot, onOpenInFlows])

  return (
    <WorkflowImageModelsContext.Provider value={resolvedImageModels}>
    <WorkflowChatModelsContext.Provider value={resolvedChatModels}>
    <PickerRuntimeGalleryContext.Provider value={pickerGalleries}>
      <div className="workflow-flow-surface h-full min-h-0">
        <div ref={canvasRef} className="relative h-full min-w-0 overflow-hidden bg-background">
        <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidWorkflowConnection}
          connectionMode={ConnectionMode.Loose}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onInit={setReactFlowInstance}
          onMove={(_, viewport) => setZoomPercent(Math.round(viewport.zoom * 100))}
          onDragOver={isPreview ? undefined : handleCanvasDragOver}
          onDrop={isPreview ? undefined : handleCanvasDrop}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={handlePaneClick}
          onMouseDownCapture={handleCanvasMouseDownCapture}
          onAuxClick={handleCanvasAuxClick}
          deleteKeyCode={null}
          elevateNodesOnSelect={false}
          nodesDraggable={!isPreview}
          nodesConnectable={!isPreview}
          edgesFocusable={!isPreview}
          noDragClassName="nodrag"
          noPanClassName="nopan"
          panOnDrag={panOnDrag}
          selectionOnDrag={interactionMode === 'select'}
          zoomOnDoubleClick={isPreview}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.25}
          maxZoom={1.4}
          proOptions={proOptions}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={defaultEdgeOptions.style}
          className={cn(
            'workflow-canvas',
            interactionMode === 'select' && '[&_.react-flow__pane]:cursor-default [&_.react-flow__pane.draggable]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing',
          )}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.2}
            color="color-mix(in oklab, var(--foreground) 16%, transparent)"
          />
          {minimapOpen && !isDraggingNode && (
            <MiniMap
              className="workflow-minimap"
              position="bottom-right"
              pannable
              zoomable
              nodeBorderRadius={10}
              maskColor="color-mix(in oklab, var(--background) 75%, transparent)"
              nodeStrokeColor="color-mix(in oklab, var(--foreground) 22%, transparent)"
              style={{ bottom: 84, right: 16 }}
              nodeColor={(node) => {
                const data = node.data as WorkflowCanvasNodeData
                return data.accent
              }}
            />
          )}
          {chrome === 'full' && (
            <Panel position="top-left" className="!m-2 !right-0 !left-0">
              <div className="pointer-events-auto flex w-full flex-wrap items-start justify-between gap-2">
                <WorkflowCanvasHeader
                  workflow={workflow}
                  onBack={handleBack}
                  onRename={isPreview ? undefined : onRename}
                  backIcon={headerBackIcon}
                  showTitle={showHeaderTitle}
                  copy={copy}
                />
                <div className="ml-auto flex min-w-0 max-w-full flex-col items-end gap-2">
                  <WorkflowCanvasActionDock
                    className="max-w-full flex-wrap justify-end"
                    toolbarAccessory={toolbarAccessory}
                    showSave={!isPreview || showSave}
                    onSave={handleSave}
                    savePending={savePending}
                    saveConfirmed={saveConfirmed}
                    saveLabel={resolvedSaveLabel}
                    onOpenInFlows={onOpenInFlows ? handleOpenInFlows : undefined}
                    allowAiPrompt={allowAiPrompt && !isPreview}
                    aiChatOpen={aiChatOpen}
                    onToggleAiChat={() => setAiChatOpen((current) => !current)}
                    chatLabel={copy.chat}
                    onRun={handleRun}
                    runDisabled={runDisabled || runPending}
                    runPending={runPending}
                    runLabel={runLabel ?? (isPreview ? copy.start : copy.run)}
                  />
                  {aiChatOpen && allowAiPrompt && !isPreview && (
                    <WorkflowCanvasAiChat onSubmitPrompt={addPromptNode} onClose={() => setAiChatOpen(false)} copy={copy} />
                  )}
                </div>
              </div>
            </Panel>
          )}
          {contextMenu && (
            <CanvasContextMenu
              menu={contextMenu}
              onDelete={() => deleteElements(
                contextMenu.type === 'node' ? [contextMenu.id] : [],
                contextMenu.type === 'edge' ? [contextMenu.id] : [],
              )}
              onDuplicate={contextMenu.type === 'node' ? () => duplicateNode(contextMenu.id) : undefined}
              onClose={() => setContextMenu(null)}
            />
          )}
          </ReactFlow>
          {nodes.length === 0 && !nodePicker && !isPreview && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/30">
                  <Plus className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{copy.emptyTitle}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {copy.emptyHint}
                </p>
              </div>
            </div>
          )}
          {nodePicker && (
            <WorkflowNodePicker
              request={{
                screenPosition: nodePicker.screenPosition,
                placement: nodePicker.placement,
                connection: pickerConnectionFromPending(nodePicker.connection),
              }}
              nodes={resolvedLibraryNodes}
              onSelect={handleNodePickerSelect}
              onClose={() => setNodePicker(null)}
            />
          )}
          <WorkflowCanvasZoomDock
            zoomPercent={zoomPercent}
            minimapOpen={minimapOpen}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFit={fitCanvas}
            onToggleMinimap={() => setMinimapOpen((current) => !current)}
            copy={copy}
          />
          <WorkflowCanvasToolbelt
            mode={interactionMode}
            onModeChange={setInteractionMode}
            onUndo={undoCanvas}
            onRedo={redoCanvas}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onAddNode={isPreview ? undefined : (event) => {
              if (nodePicker) {
                setNodePicker(null)
                return
              }
              const rect = event.currentTarget.getBoundingClientRect()
              openNodePickerAtPoint({
                x: rect.left,
                y: rect.top,
              }, undefined, 'toolbelt')
            }}
            addNodeActive={Boolean(nodePicker)}
            onAddFrame={isPreview ? undefined : () => {
              const frameNode = resolvedLibraryNodes.find((item) => item.settings?.helper_frame === true)
                ?? getLocalLibraryNodes(tWorkflows).find((item) => item.settings?.helper_frame === true)
              if (frameNode) addLibraryNode(frameNode)
            }}
            onAddText={isPreview ? undefined : () => {
              const textNode = resolvedLibraryNodes.find((item) => item.settings?.helper_canvas_text === true)
                ?? getLocalLibraryNodes(tWorkflows).find((item) => item.settings?.helper_canvas_text === true)
              if (textNode) addLibraryNode(textNode)
            }}
            onOpenAssets={isPreview ? undefined : () => openAssetPicker('assets')}
            copy={copy}
          />
          {!isPreview && (
            <WorkflowCanvasAssetHost
              request={assetPicker}
              channelId={activeChannelId}
              onClose={() => setAssetPicker(null)}
              onSelect={handleAssetSelection}
            />
          )}
        </div>
      </div>
    </PickerRuntimeGalleryContext.Provider>
    </WorkflowChatModelsContext.Provider>
    </WorkflowImageModelsContext.Provider>
  )
}

function CanvasContextMenu({
  menu,
  onDelete,
  onDuplicate,
  onClose,
}: {
  menu: NonNullable<CanvasContextMenuState>
  onDelete: () => void
  onDuplicate?: () => void
  onClose: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div
      className="pointer-events-auto absolute z-50 min-w-44 overflow-hidden rounded-2xl border border-border bg-popover py-1 text-sm text-foreground shadow-2xl shadow-black/30"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {onDuplicate && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
          onClick={onDuplicate}
        >
          <Plus className="h-4 w-4" />
          <UiText id="duplicate_node_5cfce924" /></button>
      )}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-destructive/10"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        {menu.type === 'edge' ? tAuto('delete_connection_dfa71a6f') : tAuto('delete_node_df73a725')}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
        <UiText id="close_bbfa773e" /></button>
    </div>
  )
}

function NodeOverflowMenu({ nodeId, readOnly }: { nodeId: string; readOnly?: boolean }) {
  const copy = getWorkflowCanvasCopy(useTranslations('Workflows') as unknown as WorkflowTranslator)
  if (readOnly) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={canvasChromeIconClass}
          aria-label={copy.nodeActions}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[80] min-w-40">
        <DropdownMenuItem
          className="gap-2"
          onClick={() => dispatchNodeAction(nodeId, 'duplicate')}
        >
          <Copy className="h-4 w-4" />
          <UiText id="duplicate_node_5cfce924" />
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onClick={() => dispatchNodeAction(nodeId, 'delete')}
        >
          <Trash2 className="h-4 w-4" />
          <UiText id="delete_node_df73a725" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkflowCanvasHeader({
  workflow,
  onBack,
  onRename,
  backIcon,
  showTitle,
  copy,
}: {
  workflow: Workflow
  onBack: () => void
  onRename?: (name: string) => void
  backIcon: 'arrow' | 'panel'
  showTitle: boolean
  copy: WorkflowCanvasCopy
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const [title, setTitle] = React.useState(workflow.name)
  const [editing, setEditing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const renameTimeoutRef = React.useRef<number | null>(null)
  const submittedTitleRef = React.useRef(`${workflow.id}:${workflow.name}`)
  const onRenameRef = React.useRef(onRename)
  const canRename = Boolean(onRename)

  React.useEffect(() => {
    onRenameRef.current = onRename
  }, [onRename])

  React.useEffect(() => {
    setTitle(workflow.name)
    submittedTitleRef.current = `${workflow.id}:${workflow.name}`
  }, [workflow.id, workflow.name])

  React.useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  React.useEffect(() => {
    if (!onRenameRef.current) return
    const nextTitle = title.trim()
    if (!nextTitle || nextTitle === workflow.name) return

    const timeout = window.setTimeout(() => {
      if (renameTimeoutRef.current === timeout) renameTimeoutRef.current = null
      const submittedTitle = claimWorkflowTitleSubmission(
        submittedTitleRef,
        workflow.id,
        workflow.name,
        nextTitle,
      )
      if (submittedTitle) onRenameRef.current?.(submittedTitle)
    }, 450)
    renameTimeoutRef.current = timeout

    return () => {
      window.clearTimeout(timeout)
      if (renameTimeoutRef.current === timeout) renameTimeoutRef.current = null
    }
  }, [title, workflow.id, workflow.name])

  const finishEditing = () => {
    const nextTitle = title.trim()

    if (renameTimeoutRef.current !== null) {
      window.clearTimeout(renameTimeoutRef.current)
      renameTimeoutRef.current = null
    }

    if (!nextTitle) {
      setTitle(workflow.name)
      setEditing(false)
      return
    }

    setTitle(nextTitle)
    const submittedTitle = claimWorkflowTitleSubmission(
      submittedTitleRef,
      workflow.id,
      workflow.name,
      nextTitle,
    )
    if (submittedTitle) onRenameRef.current?.(submittedTitle)
    setEditing(false)
  }

  return (
    <div className={cn(
      'flex h-10 min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-border bg-popover/90 px-2 text-sm shadow-xl shadow-black/20 backdrop-blur-xl',
      showTitle ? 'w-[320px] max-w-full' : 'w-auto',
    )}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          'h-8 w-8 shrink-0 cursor-pointer bg-background/35 transition-colors',
          backIcon === 'panel' && 'hover:bg-destructive/12 hover:text-destructive',
        )}
        onClick={onBack}
        aria-label={copy.back}
      >
        {backIcon === 'panel' ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
      </Button>

      {showTitle && editing ? (
        <Input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') finishEditing()
            if (event.key === 'Escape') {
              setTitle(workflow.name)
              setEditing(false)
            }
          }}
          className="h-8 min-w-40 flex-1 border-border/70 bg-background/80 px-2 text-sm font-semibold shadow-none"
          aria-label={copy.workflowName}
        />
      ) : showTitle ? (
        <button
          type="button"
          className={cn(
            'group flex min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left',
            canRename && 'hover:bg-muted/70',
          )}
          onClick={() => {
            if (canRename) setEditing(true)
          }}
        >
          <span className="truncate text-sm font-semibold text-foreground">{localizeWorkflowDisplayText(title, tWorkflows)}</span>
          {canRename && (
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      ) : null}

      <WorkflowModeBadge workflow={workflow} copy={copy} />
    </div>
  )
}

function WorkflowCanvasActionDock({
  className,
  toolbarAccessory,
  showSave,
  onSave,
  savePending,
  saveConfirmed,
  saveLabel,
  onOpenInFlows,
  allowAiPrompt,
  aiChatOpen,
  onToggleAiChat,
  chatLabel,
  onRun,
  runDisabled,
  runPending,
  runLabel,
}: {
  className?: string
  toolbarAccessory?: React.ReactNode
  showSave: boolean
  onSave: () => void
  savePending: boolean
  saveConfirmed: boolean
  saveLabel: string
  onOpenInFlows?: () => void
  allowAiPrompt: boolean
  aiChatOpen: boolean
  onToggleAiChat: () => void
  chatLabel: string
  onRun: () => void
  runDisabled: boolean
  runPending: boolean
  runLabel: string
}) {
  return (
    <div className={cn(flowChromeDockClass, className)}>
      {toolbarAccessory}
      {showSave && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn('cursor-pointer', flowChromeControlClass)}
          onClick={onSave}
          disabled={savePending}
          aria-label={saveLabel}
          title={saveLabel}
        >
          {savePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveConfirmed ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      )}
      {onOpenInFlows && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer rounded-xl px-3 font-semibold"
          onClick={onOpenInFlows}
        >
          <ExternalLink className="h-4 w-4" />
          <UiText id="open_in_flows_5b8c5dbc" />
        </Button>
      )}
      {allowAiPrompt && (
        <button
          type="button"
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-colors',
            aiChatOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          onClick={onToggleAiChat}
          aria-label={chatLabel}
          aria-pressed={aiChatOpen}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{chatLabel}</span>
        </button>
      )}
      <Button
        size="sm"
        className="h-9 cursor-pointer rounded-xl bg-primary px-3 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        onClick={onRun}
        disabled={runDisabled}
      >
        {runPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
        {runLabel}
      </Button>
    </div>
  )
}

function claimWorkflowTitleSubmission(
  submittedTitleRef: { current: string },
  workflowId: string,
  currentTitle: string,
  nextTitle: string,
) {
  const normalized = nextTitle.trim()
  if (!normalized || normalized === currentTitle) return null
  const submissionKey = `${workflowId}:${normalized}`
  if (submittedTitleRef.current === submissionKey) return null
  submittedTitleRef.current = submissionKey
  return normalized
}

function WorkflowModeBadge({ workflow, copy }: { workflow: Workflow; copy: WorkflowCanvasCopy }) {
  if (workflow.status === 'active') {
    return <Badge className="shrink-0 bg-success/10 text-success hover:bg-success/10">{copy.statusActive}</Badge>
  }

  if (workflow.status === 'paused') {
    return <Badge className="shrink-0 bg-warning/15 text-warning hover:bg-warning/15">{copy.statusPaused}</Badge>
  }

  if (workflow.status === 'failed') {
    return <Badge className="shrink-0 bg-destructive/10 text-destructive hover:bg-destructive/10">{copy.statusFailed}</Badge>
  }

  if (workflow.status === 'archived') {
    return <Badge className="shrink-0 bg-muted text-muted-foreground hover:bg-muted">{copy.statusArchived}</Badge>
  }

  return <Badge variant="secondary" className="shrink-0">{copy.statusDraft}</Badge>
}

function WorkflowNodeCard({ id, data, selected }: NodeProps<WorkflowFlowNode>) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const imageModels = React.useContext(WorkflowImageModelsContext)
  const chatModels = React.useContext(WorkflowChatModelsContext)
  const pickerGalleries = React.useContext(PickerRuntimeGalleryContext)
  const { activeChannelId } = useActiveChannel()
  const connections = useNodeConnections({ id })
  const connectionInProgress = useConnection((connection) => connection.inProgress)
  const updateNodeInternals = useUpdateNodeInternals()
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const isRuntimeActive = Boolean(data.isRuntimeActive)
  const isRunning = data.status === 'running' || isRuntimeActive
  const readOnly = Boolean(data.readOnly || data.frameChildLocked)
  const connectedInputPortIds = React.useMemo(
    () => getConnectedWorkflowPortIds(connections, id, 'input'),
    [connections, id],
  )
  const connectedOutputPortIds = React.useMemo(
    () => getConnectedWorkflowPortIds(connections, id, 'output'),
    [connections, id],
  )
  const inputs = getVisibleNodePorts(data, 'input', advancedOpen, connectedInputPortIds)
  const outputs = getVisibleNodePorts(data, 'output', advancedOpen, connectedOutputPortIds)
  const hasAdvancedFields = hasCatalogAdvancedNodeFields(data, chatModels)
  const showAdvanced = hasAdvancedFields
  const inlineFields = getInlineNodeFields(
    data,
    imageModels,
    advancedOpen,
    chatModels,
    pickerGalleries.get(id) ?? pickerGalleries.get(data.id || id),
  )
  const visiblePortSignature = `${inputs.map((port) => port.id).join(',')}|${outputs.map((port) => port.id).join(',')}`

  React.useLayoutEffect(() => {
    if (connectionInProgress) return
    updateNodeInternals(id)
  }, [connectionInProgress, id, updateNodeInternals, visiblePortSignature])

  if (isPreviewHelperNode(data)) {
    return <PreviewNodeCard id={id} data={data} selected={selected} />
  }

  if (isCanvasFrameNode(data)) {
    return <FrameNodeCard id={id} data={data} selected={selected} readOnly={readOnly} />
  }

  if (isCanvasTextNode(data)) {
    return <TextNodeCard id={id} data={data} selected={selected} readOnly={readOnly} />
  }

  if (data.kind === 'note') {
    return <GuideNodeCard data={data} selected={selected} readOnly={readOnly} />
  }

  const headerVisual = getFlowNodeVisual({
    nodeType: getCatalogHydrationNodeType(data),
    kind: data.kind,
    settings: data.settings,
    title: data.title,
  })
  const HeaderIcon = headerVisual.Icon

  return (
    <div
      className={cn(
        'workflow-node-card w-[344px] overflow-visible rounded-[18px] border border-border bg-card text-card-foreground shadow-xl shadow-black/25 transition-colors',
        selected && 'border-primary/60 ring-2 ring-primary/15',
        isRunning && 'border-primary/70 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent),0_0_28px_color-mix(in_oklab,var(--primary)_22%,transparent)]',
        data.status === 'success' && 'border-emerald-400/50',
        data.status === 'failed' && 'border-destructive/70',
      )}
    >
      <div className="workflow-node-drag-handle flex items-start gap-3 px-3.5 py-3">
        <div
          className={cn(
            FLOW_NODE_ICON_TILE_CLASS,
            'size-8 rounded-xl',
            headerVisual.gradient,
            isRunning && 'animate-pulse',
          )}
        >
          <HeaderIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{localizeWorkflowTerm(data.title, tWorkflows)}</p>
          </div>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">{canvasNodeByline(data, tWorkflows)}</p>
        </div>
        <NodeOverflowMenu nodeId={id} readOnly={readOnly} />
      </div>

      <div className="px-3 py-2.5">
        {(inputs.length > 0 || outputs.length > 0) && (
          <div className={cn(
            'grid gap-1',
            inputs.length > 0 && outputs.length > 0 ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-1',
          )}>
            {inputs.length > 0 && (
              <NodePortStack
                ports={inputs}
                side="input"
              />
            )}
            {outputs.length > 0 && (
              <NodePortStack
                ports={outputs}
                side="output"
                className={cn(inputs.length === 0 && 'ml-auto w-[48%]')}
              />
            )}
          </div>
        )}

        <div className="mt-2.5 space-y-1.5">
          {data.kind === 'input' && getHelperInputType(data.settings) === 'audio' ? (
            <HelperAudioField nodeId={data.id} data={data} readOnly={readOnly} />
          ) : data.kind === 'input' && getHelperInputType(data.settings) !== 'prompt' ? (
            <HelperMediaField nodeId={data.id} data={data} readOnly={readOnly} />
          ) : (
            inlineFields.map((field) => (
              <InlineNodeField
                key={`${field.label}-${field.target ?? field.settingKey ?? field.kind}`}
                nodeId={data.id}
                field={field}
                accent={data.accent}
                readOnly={readOnly}
                activeChannelId={activeChannelId}
                settings={data.settings}
              />
            ))
          )}
          {showAdvanced ? (
            <button
              type="button"
              aria-expanded={advancedOpen}
              disabled={readOnly}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setAdvancedOpen((current) => !current)}
              className="nodrag nopan flex h-8 w-full items-center justify-between rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/55 hover:text-foreground disabled:opacity-50"
            >
              <span><UiText id="advanced_4d064726" /></span>
              <ChevronDown className={cn('size-3.5 transition-transform', advancedOpen && 'rotate-180')} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CanvasCustomColorSwatch({
  value,
  selected,
  label,
  onPreview,
  onChange,
}: {
  value: string
  selected: boolean
  label: string
  onPreview?: (value: string) => void
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = React.useState(value)
  const onChangeRef = React.useRef(onChange)
  const onPreviewRef = React.useRef(onPreview)
  const draftRef = React.useRef(draft)
  const valueRef = React.useRef(value)

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    onPreviewRef.current = onPreview
  }, [onPreview])

  React.useEffect(() => {
    setDraft(value)
    valueRef.current = value
  }, [value])

  React.useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const commitDraft = React.useCallback(() => {
    if (draftRef.current !== valueRef.current) onChangeRef.current(draftRef.current)
  }, [])

  React.useEffect(() => () => {
    if (draftRef.current !== valueRef.current) onChangeRef.current(draftRef.current)
  }, [])

  return (
    <label
      className={cn(
        'relative size-4 overflow-hidden rounded-full border border-white/25',
        selected && 'ring-2 ring-white/70',
      )}
      style={{
        background: 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #38bdf8, #6366f1, #e879f9, #f43f5e)',
      }}
    >
      <span className="sr-only">{label}</span>
      <input
        type="color"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          onPreviewRef.current?.(next)
        }}
        onPointerUp={commitDraft}
        onBlur={commitDraft}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}

function FrameNodeCard({
  id,
  data,
  selected,
  readOnly,
}: {
  id: string
  data: WorkflowCanvasNodeData
  selected: boolean
  readOnly: boolean
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const nodeRef = React.useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = React.useState(() => getFrameNodeSize(data.settings))
  const [opacityOpen, setOpacityOpen] = React.useState(false)
  const committedColor = getFrameNodeColor(data.settings)
  const [liveColor, setLiveColor] = React.useState(committedColor)
  const color = liveColor
  const opacity = getFrameNodeOpacity(data.settings)
  const locked = isFrameLocked(data.settings)
  const isPresetColor = frameColorPresets.some((preset) => preset === color.toLowerCase())
  const showControls = selected && !readOnly && !locked
  const borderColor = `color-mix(in oklab, ${color} ${Math.min(58, opacity + 28)}%, transparent)`
  const fillColor = `color-mix(in oklab, ${color} ${opacity}%, transparent)`

  React.useEffect(() => {
    setFrameSize(getFrameNodeSize(data.settings))
  }, [data.id, data.settings?.frame_height, data.settings?.frame_width])

  React.useEffect(() => {
    setLiveColor(committedColor)
  }, [committedColor])

  const updateFrameSize = React.useCallback((size: GuideNodeSize) => {
    dispatchNodeFieldsChange(data.id, {
      settings: {
        frame_width: size.width,
        frame_height: size.height,
      },
    })
  }, [data.id])

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || locked || event.button !== leftMouseButton) return
    event.preventDefault()
    event.stopPropagation()
    const zoom = getGuideCanvasZoom(nodeRef.current)
    const startX = event.clientX
    const startY = event.clientY
    const startSize = frameSize
    let nextSize = startSize
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'nwse-resize'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      nextSize = clampFrameNodeSize({
        width: startSize.width + (moveEvent.clientX - startX) / zoom,
        height: startSize.height + (moveEvent.clientY - startY) / zoom,
      })
      setFrameSize(nextSize)
    }
    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      updateFrameSize(nextSize)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  React.useEffect(() => {
    if (!selected || locked) setOpacityOpen(false)
  }, [locked, selected])

  return (
    <div
      ref={nodeRef}
      className={cn(
        'workflow-node-card relative rounded-[20px] border bg-transparent shadow-none',
        locked ? 'nodrag cursor-default' : 'workflow-node-drag-handle',
        selected && !locked && 'ring-1 ring-white/10',
        locked && 'ring-1 ring-white/5',
      )}
      style={{
        width: frameSize.width,
        height: frameSize.height,
        borderColor,
        backgroundColor: fillColor,
      }}
    >
      {(showControls || locked) && (
        <div
          className="nodrag nopan absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+8px)] flex items-center gap-1 rounded-xl border border-border bg-popover/95 p-1 shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {showControls && (
            <>
              {frameColorPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={preset}
                  onClick={() => {
                    setLiveColor(preset)
                    dispatchNodeFieldsChange(data.id, { settings: { frame_color: preset } })
                  }}
                  className={cn(
                    'size-4 rounded-full border border-white/15',
                    color.toLowerCase() === preset && 'ring-2 ring-white/70',
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
              <CanvasCustomColorSwatch
                value={color}
                selected={!isPresetColor}
                label={tWorkflows('library.frameCustom')}
                onPreview={setLiveColor}
                onChange={(nextColor) => {
                  setLiveColor(nextColor)
                  dispatchNodeFieldsChange(data.id, { settings: { frame_color: nextColor } })
                }}
              />
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={opacityOpen}
                  aria-label={tWorkflows('library.frameOpacity')}
                  title={tWorkflows('library.frameOpacity')}
                  onClick={() => setOpacityOpen((current) => !current)}
                  className={cn(canvasChromeIconClass, opacityOpen && 'bg-accent')}
                >
                  <Droplet className="size-3.5" />
                </button>
                {opacityOpen && (
                  <div className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-lg border border-border bg-popover px-2 py-1.5 shadow-xl">
                    <input
                      type="range"
                      min={minFrameOpacity}
                      max={maxFrameOpacity}
                      value={opacity}
                      aria-label={tWorkflows('library.frameOpacity')}
                      onChange={(event) => dispatchNodeFieldsChange(data.id, {
                        settings: { frame_opacity: Number(event.target.value) },
                      })}
                      className="h-1 w-24 cursor-pointer accent-white/80"
                    />
                  </div>
                )}
              </div>
              <NodeOverflowMenu nodeId={data.id || id} readOnly={readOnly} />
            </>
          )}
          {!readOnly && (
            <button
              type="button"
              aria-pressed={locked}
              aria-label={locked ? tWorkflows('library.frameUnlock') : tWorkflows('library.frameLock')}
              title={locked ? tWorkflows('library.frameUnlock') : tWorkflows('library.frameLock')}
              onClick={() => dispatchNodeFieldsChange(data.id, { settings: { frame_locked: !locked } })}
              className={cn(canvasChromeIconClass, locked && 'bg-accent')}
            >
              {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </button>
          )}
        </div>
      )}
      {readOnly || locked ? (
        <p className="pointer-events-none px-3 py-2 text-xs font-medium" style={{ color: borderColor }}>
          {data.title}
        </p>
      ) : (
        <input
          value={data.title}
          aria-label={tWorkflows('library.frameName')}
          onChange={(event) => dispatchNodeFieldsChange(data.id, { title: event.target.value })}
          className="nodrag nopan max-w-[220px] bg-transparent px-3 py-2 text-xs font-medium outline-none"
          style={{ color: borderColor }}
        />
      )}
      {showControls && (
        <div
          className="nodrag nopan absolute bottom-1.5 right-1.5 size-2.5 cursor-nwse-resize rounded-[2px] border border-white/25 bg-white/15"
          onPointerDown={beginResize}
        />
      )}
    </div>
  )
}

function TextNodeCard({
  id,
  data,
  selected,
  readOnly,
}: {
  id: string
  data: WorkflowCanvasNodeData
  selected: boolean
  readOnly: boolean
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const tAuto = useTranslations('Auto')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const [hovered, setHovered] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const dragging = useStore((state) => Boolean(state.nodeLookup.get(id)?.dragging))
  const value = String(data.settings?.helper_value ?? '')
  const font = getCanvasTextFont(data.settings)
  const size = getCanvasTextSize(data.settings)
  const weight = String(data.settings?.text_weight ?? 'normal') === 'bold' ? 'bold' : 'normal'
  const italic = String(data.settings?.text_style ?? 'normal') === 'italic'
  const color = getCanvasTextColor(data.settings)
  const isPresetColor = canvasTextColorPresets.some((preset) => preset === color.toLowerCase())
  const showChrome = !dragging && (hovered || selected)
  const showEditor = !dragging && selected && editing && !readOnly
  const textStyle: React.CSSProperties = {
    fontFamily: font.family,
    fontSize: size,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight: 1.35,
    color,
    width: `${Math.min(520, Math.max(96, (value || 'Write something').length * (size * 0.62)))}px`,
  }

  React.useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.max(size * 1.35, element.scrollHeight)}px`
  }, [size, value, showEditor])

  React.useEffect(() => {
    if (!selected) setEditing(false)
  }, [selected])

  React.useEffect(() => {
    if (showEditor) textareaRef.current?.focus()
  }, [showEditor])

  const beginEditIfClick = (event: React.PointerEvent) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (readOnly || dragging || !start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) setEditing(true)
  }

  return (
    <div
      className="workflow-node-card relative flex min-w-[72px] items-center bg-transparent text-foreground shadow-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showChrome && (
        <span
          aria-hidden="true"
          title={tWorkflows('canvas.dragText')}
          className="absolute right-full top-1/2 mr-1.5 flex -translate-y-1/2 cursor-grab items-center justify-center text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-5" strokeWidth={1.75} />
        </span>
      )}
      {showChrome && !readOnly && !showEditor && (
        <button
          type="button"
          className={cn(canvasChromeIconClass, 'absolute -right-8 top-1/2 -translate-y-1/2 hover:text-destructive')}
          aria-label={tAuto('delete_node_df73a725')}
          title={tAuto('delete_node_df73a725')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => dispatchNodeAction(data.id || id, 'delete')}
        >
          <Trash2 className="size-4" />
        </button>
      )}
      {showEditor && (
        <div
          className="nodrag nopan absolute -top-10 left-0 z-20 flex items-center gap-1 rounded-xl border border-border bg-popover/95 p-1 shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Select
            value={font.id}
            onValueChange={(value) => dispatchNodeFieldsChange(data.id, { settings: { text_font: value } })}
          >
            <SelectTrigger
              size="sm"
              aria-label={tWorkflows('library.textFont')}
              className="nodrag nopan h-7 min-h-7 w-[5.5rem] rounded-lg border-border bg-popover px-2 text-[11px] text-foreground shadow-none [&_svg]:text-foreground [&_svg]:opacity-100"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned" className="z-[80] min-w-[5.5rem] border-border bg-popover text-popover-foreground">
              <SelectItem value="sans">{tWorkflows('library.textFontSans')}</SelectItem>
              <SelectItem value="serif">{tWorkflows('library.textFontSerif')}</SelectItem>
              <SelectItem value="mono">{tWorkflows('library.textFontMono')}</SelectItem>
              <SelectItem value="display">{tWorkflows('library.textFontDisplay')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(size)}
            onValueChange={(value) => dispatchNodeFieldsChange(data.id, { settings: { text_size: Number(value) } })}
          >
            <SelectTrigger
              size="sm"
              aria-label={tWorkflows('library.textSize')}
              className="nodrag nopan h-7 min-h-7 w-[4.5rem] rounded-lg border-border bg-popover px-2 text-[11px] text-foreground shadow-none [&_svg]:text-foreground [&_svg]:opacity-100"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned" className="z-[80] min-w-[4.5rem] border-border bg-popover text-popover-foreground">
              {canvasTextSizes.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-pressed={weight === 'bold'}
            onClick={() => dispatchNodeFieldsChange(data.id, { settings: { text_weight: weight === 'bold' ? 'normal' : 'bold' } })}
            className={cn(canvasChromeIconClass, 'border border-border', weight === 'bold' && 'bg-accent')}
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            aria-pressed={italic}
            onClick={() => dispatchNodeFieldsChange(data.id, { settings: { text_style: italic ? 'normal' : 'italic' } })}
            className={cn(canvasChromeIconClass, 'border border-border', italic && 'bg-accent')}
          >
            <Italic className="size-3.5" />
          </button>
          {canvasTextColorPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              onClick={() => dispatchNodeFieldsChange(data.id, { settings: { text_color: preset } })}
              className={cn(
                'size-4 rounded-full border border-white/20',
                color.toLowerCase() === preset && 'ring-2 ring-white/80',
              )}
              style={{ backgroundColor: preset }}
            />
          ))}
          <CanvasCustomColorSwatch
            value={color}
            selected={!isPresetColor}
            label={tWorkflows('library.frameCustom')}
            onChange={(nextColor) => dispatchNodeFieldsChange(data.id, { settings: { text_color: nextColor } })}
          />
          <button
            type="button"
            className={cn(canvasChromeIconClass, 'hover:text-destructive')}
            aria-label={tAuto('delete_node_df73a725')}
            title={tAuto('delete_node_df73a725')}
            onClick={() => dispatchNodeAction(data.id || id, 'delete')}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
      {showEditor ? (
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={tWorkflows('library.textPlaceholder')}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => dispatchNodeFieldsChange(data.id, {
            description: event.target.value,
            settings: { helper_value: event.target.value },
          })}
          className="nodrag nopan min-w-[72px] resize-none bg-transparent outline-none placeholder:text-muted-foreground"
          style={textStyle}
        />
      ) : (
        <p
          className="min-w-[72px] cursor-grab whitespace-pre-wrap bg-transparent select-none active:cursor-grabbing"
          style={textStyle}
          onPointerDown={(event) => {
            pointerStartRef.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerUp={beginEditIfClick}
        >
          {value || <span className="text-muted-foreground">{tWorkflows('library.textPlaceholder')}</span>}
        </p>
      )}
    </div>
  )
}

function GuideNodeCard({
  data,
  selected,
  readOnly,
}: {
  data: WorkflowCanvasNodeData
  selected: boolean
  readOnly: boolean
}) {
  const tAuto = useTranslations('Auto')
  const content = getGuideMarkdownContent(data)
  const [guideSize, setGuideSize] = React.useState<GuideNodeSize>(() => getGuideNodeSize(data.settings))
  const [localMode, setLocalMode] = React.useState<GuideViewMode>('preview')
  const activeMode = readOnly ? 'preview' : localMode
  const nodeRef = React.useRef<HTMLDivElement>(null)
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const pendingFocusRef = React.useRef<'title' | 'content' | null>(null)

  const updateContent = React.useCallback((value: string) => {
    dispatchNodeFieldsChange(data.id, {
      description: value,
      settings: {
        helper_value: value,
        content_format: 'markdown',
      },
    })
  }, [data.id])

  React.useEffect(() => {
    setGuideSize(getGuideNodeSize(data.settings))
  }, [data.id, data.settings?.guide_height, data.settings?.guide_width])

  const updateGuideSize = React.useCallback((size: GuideNodeSize) => {
    dispatchNodeFieldsChange(data.id, {
      settings: {
        guide_width: size.width,
        guide_height: size.height,
      },
    })
  }, [data.id])

  const focusPendingEditorTarget = React.useCallback(() => {
    const target = pendingFocusRef.current
    pendingFocusRef.current = null
    if (target === 'title') {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
      return
    }
    textareaRef.current?.focus()
  }, [])

  const enterEditMode = React.useCallback((focusTarget: 'title' | 'content' = 'content') => {
    if (readOnly) return
    pendingFocusRef.current = focusTarget
    setLocalMode('edit')
    window.requestAnimationFrame(focusPendingEditorTarget)
  }, [focusPendingEditorTarget, readOnly])

  const setMode = (mode: GuideViewMode) => {
    if (readOnly) return
    if (mode === 'edit') {
      enterEditMode('content')
      return
    }
    setLocalMode('preview')
  }

  const beginResize = (edge: GuideResizeEdge, event: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || event.button !== leftMouseButton) return

    event.preventDefault()
    event.stopPropagation()

    const zoom = getGuideCanvasZoom(nodeRef.current)
    const startX = event.clientX
    const startY = event.clientY
    const startSize = guideSize
    let nextSize = startSize
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = edge === 'right' ? 'ew-resize' : edge === 'bottom' ? 'ns-resize' : 'nwse-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom
      const deltaY = (moveEvent.clientY - startY) / zoom
      nextSize = clampGuideNodeSize({
        width: edge === 'right' || edge === 'corner' ? startSize.width + deltaX : startSize.width,
        height: edge === 'bottom' || edge === 'corner' ? startSize.height + deltaY : startSize.height,
      })
      setGuideSize(nextSize)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      updateGuideSize(nextSize)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  React.useEffect(() => {
    if (readOnly || activeMode !== 'edit') return undefined
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && nodeRef.current?.contains(target)) return
      setLocalMode('preview')
    }

    window.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => window.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  }, [activeMode, readOnly])

  const applyMarkdownAction = (action: GuideMarkdownAction) => {
    if (readOnly || activeMode !== 'edit') return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? start
    const next = applyGuideMarkdownAction(content, start, end, action)
    updateContent(next.value)
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }

  return (
    <div
      ref={nodeRef}
      className={cn(
        'workflow-node-card relative overflow-hidden rounded-[18px] border border-border bg-card text-card-foreground shadow-xl shadow-black/25 transition-colors',
        selected && 'border-primary/60 ring-2 ring-primary/15',
      )}
      style={{ width: guideSize.width }}
      onClick={(event) => {
        if (readOnly || activeMode === 'edit') return
        const target = event.target
        const focusTarget = target instanceof HTMLElement && target.closest('[data-guide-title]')
          ? 'title'
          : 'content'
        enterEditMode(focusTarget)
      }}
    >
      <div className="workflow-node-drag-handle flex min-h-12 items-center gap-2.5 border-b border-border px-3.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-muted/40"
          style={{ borderColor: data.accent, color: data.accent }}
        >
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1 py-1.5">
          {activeMode === 'edit' && !readOnly ? (
            <input
              ref={titleInputRef}
              value={data.title}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => dispatchNodeFieldsChange(data.id, { title: event.target.value })}
              className="nodrag nopan block h-8 w-full min-w-0 border-0 bg-transparent p-0 text-[17px] font-semibold leading-8 text-foreground outline-none placeholder:text-muted-foreground"
              aria-label={tAuto('guide_title_39163e55')}
            />
          ) : (
            <div
              data-guide-title
              className="block h-8 min-w-0 truncate text-[17px] font-semibold leading-8 text-foreground"
              title={data.title}
            >
              {data.title}
            </div>
          )}
        </div>
        <div className="nodrag nopan flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 bg-background/70 p-0.5 shadow-sm dark:border-white/10 dark:bg-black/20">
          <GuideModeButton
            label={tAuto('edit_guide_3b2dd1a0')}
            active={activeMode === 'edit'}
            disabled={readOnly}
            onClick={() => setMode('edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </GuideModeButton>
          <GuideModeButton
            label={tAuto('preview_guide_3a130f54')}
            active={activeMode === 'preview'}
            onClick={() => setMode('preview')}
          >
            <Eye className="h-3.5 w-3.5" />
          </GuideModeButton>
        </div>
        <NodeOverflowMenu nodeId={data.id} readOnly={readOnly} />
      </div>

      {activeMode === 'edit' && !readOnly && (
        <div className="nodrag nopan flex items-center gap-1 border-b border-border bg-muted/30 px-3 py-1.5">
          <GuideToolbarButton label={tAuto('heading_a3089b7f')} onClick={() => applyMarkdownAction('heading')}>
            <Heading2 className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarButton label={tAuto('bold_19e07430')} onClick={() => applyMarkdownAction('bold')}>
            <Bold className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarButton label={tAuto('italic_1616e2e5')} onClick={() => applyMarkdownAction('italic')}>
            <Italic className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarDivider />
          <GuideToolbarButton label={tAuto('bullet_list_660d9fbe')} onClick={() => applyMarkdownAction('bullet')}>
            <List className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarButton label={tAuto('numbered_list_8294ea4f')} onClick={() => applyMarkdownAction('ordered')}>
            <ListOrdered className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarButton label={tAuto('quote_309028a9')} onClick={() => applyMarkdownAction('quote')}>
            <Quote className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarDivider />
          <GuideToolbarButton label={tAuto('code_adac6937')} onClick={() => applyMarkdownAction('code')}>
            <Code2 className="h-3.5 w-3.5" />
          </GuideToolbarButton>
          <GuideToolbarButton label={tAuto('link_d0517071')} onClick={() => applyMarkdownAction('link')}>
            <Link2 className="h-3.5 w-3.5" />
          </GuideToolbarButton>
        </div>
      )}

      <div
        className={cn(
          'bg-background',
          activeMode === 'edit' && !readOnly && 'nodrag nopan',
        )}
        onPointerDown={(event) => {
          if (activeMode === 'edit' && !readOnly) event.stopPropagation()
        }}
      >
        {activeMode === 'edit' && !readOnly ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => updateContent(event.target.value)}
            className="youtorch-thin-scrollbar w-full resize-none border-0 bg-transparent px-4 py-3.5 font-mono text-[12px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            style={{ height: guideSize.height }}
            placeholder="## Guide"
            aria-label={tAuto('guide_markdown_content_86dba4af')}
          />
        ) : (
          <div className="youtorch-thin-scrollbar overflow-y-auto px-5 py-4" style={{ height: guideSize.height }}>
            <GuideMarkdownPreview content={content} />
          </div>
        )}
      </div>
      {!readOnly && (
        <>
          <GuideResizeHandle edge="right" onResizeStart={beginResize} />
          <GuideResizeHandle edge="bottom" onResizeStart={beginResize} />
          <GuideResizeHandle edge="corner" onResizeStart={beginResize} />
        </>
      )}
    </div>
  )
}

function GuideResizeHandle({
  edge,
  onResizeStart,
}: {
  edge: GuideResizeEdge
  onResizeStart: (edge: GuideResizeEdge, event: React.PointerEvent<HTMLDivElement>) => void
}) {
  const label = edge === 'right' ? 'Resize guide width' : edge === 'bottom' ? 'Resize guide height' : 'Resize guide'

  return (
    <div
      role="separator"
      aria-label={label}
      title={label}
      className={cn(
        'nodrag nopan absolute z-20 bg-transparent transition-colors hover:bg-primary/18',
        edge === 'right' && 'right-0 top-0 h-full w-2 cursor-ew-resize',
        edge === 'bottom' && 'bottom-0 left-0 h-2 w-full cursor-ns-resize',
        edge === 'corner' && 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize hover:bg-primary/28',
      )}
      onPointerDown={(event) => onResizeStart(edge, event)}
      onClick={(event) => event.stopPropagation()}
    >
      {edge === 'corner' && (
        <span className="absolute bottom-1 right-1 h-2 w-2 rounded-[2px] border-b border-r border-muted-foreground/60" />
      )}
    </div>
  )
}

function GuideModeButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-45',
        active && 'bg-foreground text-background hover:bg-foreground hover:text-background',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </button>
  )
}

function GuideToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

function GuideToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-border/70 dark:bg-white/10" />
}

function getGuideMarkdownContent(data: WorkflowCanvasNodeData) {
  if (typeof data.description === 'string' && data.description.length > 0) return data.description
  const helperValue = data.settings?.helper_value
  return typeof helperValue === 'string' ? helperValue : ''
}

function getGuideNodeSize(settings: WorkflowCanvasNodeData['settings']): GuideNodeSize {
  return clampGuideNodeSize({
    width: readGuideDimension(settings?.guide_width, defaultGuideNodeSize.width),
    height: readGuideDimension(settings?.guide_height, defaultGuideNodeSize.height),
  })
}

function readGuideDimension(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function clampGuideNodeSize(size: GuideNodeSize): GuideNodeSize {
  return {
    width: Math.round(clampNumber(size.width, minGuideNodeSize.width, maxGuideNodeSize.width)),
    height: Math.round(clampNumber(size.height, minGuideNodeSize.height, maxGuideNodeSize.height)),
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getGuideCanvasZoom(element: HTMLElement | null) {
  const viewport = element?.closest('.react-flow__viewport')
  if (!(viewport instanceof HTMLElement)) return 1

  const transform = window.getComputedStyle(viewport).transform
  if (!transform || transform === 'none') return 1

  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return Math.abs(matrix.a) || 1
  } catch {
    const match = /matrix\(([^,]+),/.exec(transform)
    const scale = match ? Number(match[1]) : 1
    return Number.isFinite(scale) && scale > 0 ? scale : 1
  }
}

type GuideMarkdownFormatResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

function applyGuideMarkdownAction(
  value: string,
  start: number,
  end: number,
  action: GuideMarkdownAction,
): GuideMarkdownFormatResult {
  if (action === 'heading') {
    return prefixGuideSelectionLines(value, start, end, () => '## ', /^#{1,6}\s+/, 'Heading')
  }
  if (action === 'bold') {
    return wrapGuideSelection(value, start, end, '**', '**', 'bold text')
  }
  if (action === 'italic') {
    return wrapGuideSelection(value, start, end, '*', '*', 'italic text')
  }
  if (action === 'link') {
    return insertGuideLink(value, start, end)
  }
  if (action === 'bullet') {
    return prefixGuideSelectionLines(value, start, end, () => '- ', /^(?:[-*+]\s+|\d+[.)]\s+)/, 'List item')
  }
  if (action === 'ordered') {
    return prefixGuideSelectionLines(value, start, end, (index) => `${index + 1}. `, /^(?:[-*+]\s+|\d+[.)]\s+)/, 'List item')
  }
  if (action === 'quote') {
    return prefixGuideSelectionLines(value, start, end, () => '> ', /^>\s?/, 'Note')
  }
  return insertGuideCode(value, start, end)
}

function wrapGuideSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): GuideMarkdownFormatResult {
  const selected = value.slice(start, end) || placeholder
  const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
  const selectionStart = start + before.length
  const selectionEnd = selectionStart + selected.length
  return { value: nextValue, selectionStart, selectionEnd }
}

function insertGuideLink(value: string, start: number, end: number): GuideMarkdownFormatResult {
  const selected = value.slice(start, end) || 'link text'
  const href = 'https://'
  const insertion = `[${selected}](${href})`
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`
  const urlStart = start + selected.length + 3
  const textStart = start + 1

  if (end > start) {
    return {
      value: nextValue,
      selectionStart: urlStart,
      selectionEnd: urlStart + href.length,
    }
  }

  return {
    value: nextValue,
    selectionStart: textStart,
    selectionEnd: textStart + selected.length,
  }
}

function insertGuideCode(value: string, start: number, end: number): GuideMarkdownFormatResult {
  const selected = value.slice(start, end)
  if (!selected) {
    const insertion = '```\ncode\n```'
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`
    return {
      value: nextValue,
      selectionStart: start + 4,
      selectionEnd: start + 8,
    }
  }

  if (selected.includes('\n')) {
    const insertion = `\`\`\`\n${selected}\n\`\`\``
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`
    return {
      value: nextValue,
      selectionStart: start + 4,
      selectionEnd: start + 4 + selected.length,
    }
  }

  return wrapGuideSelection(value, start, end, '`', '`', 'code')
}

function prefixGuideSelectionLines(
  value: string,
  start: number,
  end: number,
  prefixForLine: (index: number) => string,
  stripPattern: RegExp,
  emptyPlaceholder: string,
): GuideMarkdownFormatResult {
  const range = getGuideLineRange(value, start, end)
  const segment = value.slice(range.start, range.end)
  const lines = (segment || '').split('\n')
  const nextSegment = lines.map((line, index) => {
    const leading = line.match(/^\s*/)?.[0] ?? ''
    const body = line.slice(leading.length).replace(stripPattern, '')
    if (!body && lines.length > 1) return line
    return `${leading}${prefixForLine(index)}${body || emptyPlaceholder}`
  }).join('\n')
  const nextValue = `${value.slice(0, range.start)}${nextSegment}${value.slice(range.end)}`

  return {
    value: nextValue,
    selectionStart: range.start,
    selectionEnd: range.start + nextSegment.length,
  }
}

function getGuideLineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf('\n', end)
  return {
    start: lineStart,
    end: nextBreak === -1 ? value.length : nextBreak,
  }
}

function PreviewNodeCard({
  id,
  data,
  selected,
}: {
  id: string
  data: WorkflowCanvasNodeData
  selected: boolean
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const pickerGalleries = React.useContext(PickerRuntimeGalleryContext)
  const readOnly = Boolean(data.readOnly || data.frameChildLocked)
  const visual = getFlowNodeVisual({
    kind: data.kind,
    settings: data.settings,
    title: data.title,
  })
  const HeaderIcon = visual.Icon
  const gallery = pickerGalleries.get(id) ?? pickerGalleries.get(data.id || id) ?? []
  const fallbackUrl = String(data.settings?.helper_preview_url || data.settings?.helper_value || '')
  const items = gallery.length > 0
    ? gallery
    : fallbackUrl
      ? [{ url: fallbackUrl, label: '1', kind: /\.(mp4|webm|mov)(?:$|\?)/i.test(fallbackUrl) ? 'video' as const : /\.(mp3|wav|m4a|ogg|aac)(?:$|\?)/i.test(fallbackUrl) ? 'audio' as const : 'image' as const }]
      : []
  const inputs = getNodePorts(data, 'input')

  return (
    <div
      className={cn(
        'workflow-node-card w-[280px] overflow-visible rounded-[18px] border border-border bg-card text-card-foreground shadow-xl shadow-black/25',
        selected && 'border-primary/60 ring-2 ring-primary/15',
      )}
    >
      <div className="workflow-node-drag-handle flex items-start gap-3 px-3.5 py-3">
        <div className={cn(FLOW_NODE_ICON_TILE_CLASS, 'size-8 rounded-xl', visual.gradient)}>
          <HeaderIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{localizeWorkflowTerm(data.title, tWorkflows)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{localizeWorkflowTerm(publicCatalogText(data.subtitle) || publicProviderDisplayValue(data.provider), tWorkflows)}</p>
        </div>
        <NodeOverflowMenu nodeId={data.id || id} readOnly={readOnly} />
      </div>
      <div className="space-y-2 px-3 py-2.5">
        {inputs.length > 0 && (
          <NodePortStack ports={inputs} side="input" />
        )}
        {items.length === 1 ? (
          <FlowMediaPreview
            previewUrl={items[0]?.url}
            kind={items[0]?.kind ?? 'image'}
          />
        ) : items.length > 1 ? (
          <FlowFrameGalleryField items={items} selectedIndex={0} readOnly onSelect={() => undefined} />
        ) : (
          <p className="text-[11px] text-muted-foreground">{tWorkflows('library.previewDescription')}</p>
        )}
      </div>
    </div>
  )
}

type InlineNodeFieldModel = {
  label: string
  value: string
  kind: 'text' | 'textarea' | 'select' | 'number' | 'toggle' | 'storage_media' | 'range_mode' | 'voice_profile' | 'voice_reference' | 'warning' | 'channel_warning' | 'channel_link' | 'index_strip' | 'frame_gallery' | 'media_preview' | 'angle_intent'
  target?: 'title' | 'subtitle' | 'provider' | 'description' | 'settings'
  settingKey?: string
  patchForValue?: (value: string) => WorkflowNodeFieldsChangeDetail['patch']
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  mediaKind?: 'audio' | 'video' | 'image'
  size?: 'compact' | 'large'
  hint?: string
  fileName?: string
  previewUrl?: string
  modelId?: string
  language?: string
  galleryItems?: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>
}

function NodePortStack({
  ports,
  side,
  className,
}: {
  ports: WorkflowNodePort[]
  side: 'input' | 'output'
  className?: string
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  return (
    <div className={cn('min-w-0', className)}>
      <div className="space-y-1">
        {ports.map((port) => (
          <div
            key={port.id}
            className={cn(
              'nodrag nopan relative flex h-7 min-w-0 items-center px-1 text-[11px] font-medium text-muted-foreground',
              side === 'output' && 'justify-end text-right',
            )}
          >
            {side === 'input' && (
              <Handle
                id={toPortHandleId(port.id, 'input')}
                type="target"
                position={Position.Left}
                className={cn(portHandleHitAreaClass, '!left-[-10px] !right-auto !bg-sky-400 !shadow-[0_0_10px_rgba(56,189,248,0.55)]')}
              />
            )}
            <span className="truncate bg-transparent">{localizeWorkflowTerm(port.label, tWorkflows)}</span>
            {side === 'output' && (
              <Handle
                id={toPortHandleId(port.id, 'output')}
                type="source"
                position={Position.Right}
                className={cn(portHandleHitAreaClass, '!right-[-10px] !left-auto !bg-emerald-400 !shadow-[0_0_10px_rgba(52,211,153,0.55)]')}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function InlineNodeField({
  nodeId,
  field,
  accent,
  readOnly,
  settings,
}: {
  nodeId: string
  field: InlineNodeFieldModel
  accent: string
  readOnly?: boolean
  activeChannelId: string | null
  settings?: WorkflowCanvasNodeData['settings']
}) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const tErrors = useTranslations('Errors')
  const { activeChannel } = useActiveChannel()
  const localizedLabel = localizeWorkflowTerm(field.label, tWorkflows)
  const updateValue = (value: string) => {
    if (field.patchForValue) {
      dispatchNodeFieldsChange(nodeId, field.patchForValue(value))
      return
    }
    if (field.settingKey) {
      dispatchNodeFieldsChange(nodeId, { settings: { [field.settingKey]: value } })
      return
    }
    if (field.target) dispatchNodeFieldsChange(nodeId, { [field.target]: value })
  }

  const updateNumber = (nextValue: number) => {
    const min = field.min ?? Number.NEGATIVE_INFINITY
    const max = field.max ?? Number.POSITIVE_INFINITY
    const value = Math.min(max, Math.max(min, nextValue))
    if (field.patchForValue) {
      dispatchNodeFieldsChange(nodeId, field.patchForValue(String(value)))
      return
    }
    if (!field.settingKey) return
    dispatchNodeFieldsChange(nodeId, { settings: { [field.settingKey]: value } })
  }

  if (field.kind === 'warning') {
    return <FlowWarningField message={field.value} />
  }

  if (field.kind === 'channel_warning') {
    if (activeChannel?.status === 'connected') return null
    return <FlowWarningField message={tErrors('channelNotConnected')} />
  }

  if (field.kind === 'channel_link') {
    if (activeChannel?.status === 'connected') {
      return (
        <div className="nodrag nopan rounded-[10px] border border-border/80 bg-muted/40 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-normal text-muted-foreground">{tWorkflows('terms.channel')}</p>
          <p className="truncate text-[12px] font-medium text-foreground">{activeChannel.name}</p>
        </div>
      )
    }
    return (
      <div className="nodrag nopan space-y-1.5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-2.5 py-2">
        <p className="text-[11px] leading-4 text-destructive">{tErrors('channelNotConnected')}</p>
        <a
          href="/channels"
          className="inline-flex text-[11px] font-medium text-foreground underline-offset-2 hover:underline"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {tWorkflows('library.connectYoutube')}
        </a>
      </div>
    )
  }

  if (field.kind === 'angle_intent') {
    return (
      <FlowAngleIntentField
        value={field.value}
        options={field.options ?? []}
        optionLabels={field.optionLabels}
        selectedAngles={(field.galleryItems ?? []).flatMap((item) => {
          const choice = item.url || item.label
          return choice ? [choice] : []
        })}
        readOnly={readOnly}
        onChange={updateValue}
        onSelectPreset={(preset) => {
          if (preset === FLOW_ANGLE_CUSTOM) {
            dispatchNodeFieldsChange(nodeId, { settings: { angle_choice: FLOW_ANGLE_CUSTOM } })
            return
          }
          const next = resolveAngleSettings({ prompt: preset, fromChip: true })
          dispatchNodeFieldsChange(nodeId, {
            settings: {
              angle_choice: preset,
              prompt: next.prompt,
              angles: next.angles,
              angle: next.angles[0],
            },
          })
        }}
      />
    )
  }

  if (field.kind === 'index_strip') {
    return (
      <FlowIndexStripField
        selectedIndex={Number.parseInt(field.value, 10) || 0}
        min={field.min ?? 0}
        max={field.max ?? 7}
        readOnly={readOnly}
        onSelect={(index) => {
          if (field.patchForValue) {
            dispatchNodeFieldsChange(nodeId, field.patchForValue(String(index)))
            return
          }
          updateNumber(index)
        }}
      />
    )
  }

  if (field.kind === 'frame_gallery') {
    return (
      <FlowFrameGalleryField
        items={field.galleryItems ?? []}
        selectedIndex={Number.parseInt(field.value, 10) || 0}
        selectedIndexes={field.value.split(',').map((item) => Number.parseInt(item, 10)).filter((item) => Number.isInteger(item))}
        readOnly={readOnly}
        multi={field.hint === 'multi'}
        onSelect={(index) => {
          if (field.patchForValue) {
            dispatchNodeFieldsChange(nodeId, field.patchForValue(String(index)))
            return
          }
          updateNumber(index)
        }}
      />
    )
  }

  if (field.kind === 'media_preview') {
    return (
      <FlowMediaPreview
        previewUrl={field.value || field.previewUrl}
        fileName={field.fileName}
        kind={field.mediaKind === 'video' ? 'video' : field.mediaKind === 'audio' ? 'audio' : 'image'}
      />
    )
  }

  if (field.kind === 'voice_profile') {
    return (
      <FlowVoiceProfileField
        label={localizedLabel}
        value={field.value}
        readOnly={readOnly}
        modelId={field.modelId ?? String(settings?.model_id ?? '')}
        language={field.language ?? String(settings?.language ?? 'en')}
        autoSelectPublicVoice={flowNodeTypeKey(settings) === 'avatar_generate'}
        onChange={(voiceProfileId) => dispatchNodeFieldsChange(nodeId, { settings: { voice_profile_id: voiceProfileId } })}
      />
    )
  }

  if (field.kind === 'voice_reference') {
    const catalogSchema = settings?.__catalog_input_schema
    return (
      <FlowVoiceReferenceField
        value={field.value}
        readOnly={readOnly}
        inputSchema={catalogSchema && typeof catalogSchema === 'object' && !Array.isArray(catalogSchema)
          ? catalogSchema as Record<string, unknown>
          : undefined}
        onChange={(storageObjectId) => dispatchNodeFieldsChange(nodeId, {
          settings: { reference_storage_object_id: storageObjectId ?? undefined },
        })}
      />
    )
  }

  if (field.kind === 'storage_media') {
    return (
      <FlowCompactMediaField
        label={localizedLabel}
        nodeId={nodeId}
        settingKey={field.settingKey}
        value={field.value}
        fileName={field.fileName ?? String(settings?.media_file_name ?? '')}
        previewUrl={field.previewUrl ?? String(settings?.media_preview_url ?? '')}
        mediaKind={field.mediaKind ?? 'video'}
        readOnly={readOnly}
        onChange={(patch) => {
          const key = field.settingKey || 'storage_object_id'
          const nextSettings: Record<string, unknown> = {
            [key]: patch.storage_object_id,
            media_file_name: patch.media_file_name,
            media_preview_url: patch.media_preview_url,
            duration_sec: patch.duration_sec,
            media_ref: patch.media_ref,
          }
          if (key === 'storage_object_id' || key === 'source_image' || key === 'image_url') {
            nextSettings.storage_object_id = patch.storage_object_id
            nextSettings.source_image = patch.storage_object_id
            nextSettings.image_url = patch.media_preview_url || patch.storage_object_id
          }
          dispatchNodeFieldsChange(nodeId, { settings: nextSettings })
        }}
      />
    )
  }

  if (field.kind === 'range_mode') {
    return (
      <div className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
        <div className="grid h-8 grid-cols-2 rounded-[10px] border border-border/80 bg-muted/40 p-0.5">
          {([
            { value: 'full', label: 'terms.full' },
            { value: 'clip', label: 'terms.clip' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={readOnly}
              aria-pressed={field.value === option.value}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => updateValue(option.value)}
              className={cn(
                'flex min-w-0 items-center justify-center rounded px-1 text-[10px] font-semibold transition-colors disabled:opacity-50',
                field.value === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {localizeWorkflowTerm(option.label, tWorkflows)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <label className="nodrag nopan block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-normal text-muted-foreground">{localizedLabel}</span>
        <textarea
          readOnly={readOnly || (!field.target && !field.settingKey)}
          value={field.value}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => updateValue(event.target.value)}
          className={cn(
            'w-full resize-none rounded-[10px] border border-border/80 bg-muted/40 px-2.5 py-2 text-[11px] leading-4 text-foreground outline-none',
            field.size === 'large' ? 'h-[96px]' : 'h-[58px]',
          )}
        />
      </label>
    )
  }

  if (field.kind === 'select') {
    const options = uniqueStrings([field.value, ...(field.options ?? [])]).filter(Boolean)
    const languageField = isLanguageSelectionFieldName(field.settingKey)
    const languageDisplay = (option: string) => getLanguageDisplay(
      option,
      field.optionLabels?.[option] || formatCatalogOptionLabel(field.settingKey, option),
    )
    if (!field.target && !field.settingKey && !field.patchForValue) {
      const display = languageField ? languageDisplay(field.value) : null
      return (
        <div className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
          <div className="flex h-7 min-w-0 items-center rounded border border-border/60 bg-muted/20 px-2 text-[11px] text-muted-foreground">
            {display ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <LanguageFlagIcon region={display.flagRegion} className="h-3.5 w-[19px]" />
                <span className="shrink-0 text-[9px] font-bold text-foreground">{display.code}</span>
                <span className="truncate">{display.label}</span>
              </span>
            ) : <span className="truncate">{field.value}</span>}
          </div>
        </div>
      )
    }

    if (languageField) {
      const selectedDisplay = languageDisplay(field.value)
      return (
        <div className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
          <Select disabled={readOnly} value={field.value} onValueChange={updateValue}>
            <SelectTrigger
              aria-label={localizedLabel}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-8 min-w-0 rounded-[10px] border-border/80 bg-muted/40 px-2.5 text-[11px] shadow-none"
            >
              <SelectValue>
                <span className="flex min-w-0 items-center gap-1.5 text-left">
                  <LanguageFlagIcon region={selectedDisplay.flagRegion} className="h-3.5 w-[19px]" />
                  <span className="shrink-0 text-[9px] font-bold text-foreground">{selectedDisplay.code}</span>
                  <span className="truncate">{selectedDisplay.label}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => {
                const display = languageDisplay(option)
                return (
                  <SelectItem key={option} value={option}>
                    <span className="flex min-w-0 items-center gap-2">
                      <LanguageFlagIcon region={display.flagRegion} />
                      <span className="shrink-0 text-[10px] font-bold text-foreground">{display.code}</span>
                      <span className="truncate">{display.label}</span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )
    }

    return (
      <label className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
        <select
          disabled={readOnly}
          value={field.value}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => updateValue(event.target.value)}
          className="h-8 min-w-0 rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[12px] font-medium text-foreground outline-none disabled:appearance-none"
          aria-label={localizedLabel}
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-card text-foreground">
              {localizeFieldOptionLabel(field.optionLabels?.[option], tWorkflows)
                || formatCatalogOptionLabel(field.settingKey, option)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.kind === 'number') {
    const parsed = Number(field.value)
    const value = Number.isFinite(parsed) ? parsed : field.min || 0
    const step = field.step ?? 1
    return (
      <div className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
        <div className="grid h-8 min-w-0 grid-cols-[32px_minmax(0,1fr)_32px] overflow-hidden rounded-[10px] border border-border/80 bg-muted/40 text-[12px] font-semibold text-foreground">
          <button
            type="button"
            disabled={readOnly || value <= (field.min ?? Number.NEGATIVE_INFINITY)}
            className="flex items-center justify-center border-r border-border/80 text-muted-foreground hover:bg-muted disabled:opacity-35"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => updateNumber(value - step)}
            aria-label={`Decrease ${localizedLabel}`}
          >
            -
          </button>
          <div className="flex items-center justify-center px-2 tabular-nums">{value}</div>
          <button
            type="button"
            disabled={readOnly || value >= (field.max ?? Number.POSITIVE_INFINITY)}
            className="flex items-center justify-center border-l border-border/80 text-muted-foreground hover:bg-muted disabled:opacity-35"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => updateNumber(value + step)}
            aria-label={`Increase ${localizedLabel}`}
          >
            +
          </button>
        </div>
        {field.hint ? <span className="col-start-2 text-[10px] text-muted-foreground">{field.hint}</span> : null}
      </div>
    )
  }

  if (field.kind === 'toggle') {
    const enabled = field.value === 'true' || field.value === 'On'
    return (
      <div className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={readOnly || (!field.settingKey && !field.patchForValue)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            const next = enabled ? 'false' : 'true'
            if (field.patchForValue) {
              dispatchNodeFieldsChange(nodeId, field.patchForValue(next))
              return
            }
            if (!field.settingKey) return
            dispatchNodeFieldsChange(nodeId, { settings: { [field.settingKey]: !enabled } })
          }}
          className="flex h-8 min-w-0 items-center justify-between rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[11px] font-medium text-foreground disabled:opacity-60"
        >
          <span>{enabled ? tAuto('on_e0049a66') : tAuto('off_e3de5ab0')}</span>
          <span
            className="ml-2 h-4 w-7 rounded-full p-0.5 transition-colors"
            style={{ backgroundColor: enabled ? accent : 'var(--border)' }}
          >
            <span className={cn(
              'block h-3 w-3 rounded-full bg-background transition-transform',
              enabled && 'translate-x-3',
            )} />
          </span>
        </button>
      </div>
    )
  }

  if (field.kind === 'text') {
    return (
      <label className="nodrag nopan grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
        <input
          type={field.settingKey === 'url' || field.settingKey?.endsWith('_url') ? 'url' : 'text'}
          readOnly={readOnly || (!field.target && !field.settingKey)}
          value={field.value}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => updateValue(event.target.value)}
          className="h-8 min-w-0 rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[11px] text-foreground outline-none"
          aria-label={localizedLabel}
        />
        {field.hint ? <span className="col-start-2 text-[10px] text-muted-foreground">{field.hint}</span> : null}
      </label>
    )
  }

  return (
    <div className="nodrag grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-[11px] text-muted-foreground">{localizedLabel}</span>
      <div className="flex h-8 min-w-0 items-center rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[11px] text-foreground">
        <span className="truncate">{field.value}</span>
      </div>
    </div>
  )
}

function HelperMediaField({
  nodeId,
  data,
  readOnly,
}: {
  nodeId: string
  data: WorkflowCanvasNodeData
  readOnly?: boolean
}) {
  const helperType = getHelperInputType(data.settings)
  const isVideo = helperType === 'video'
  const storageId = String(data.settings?.helper_storage_object_id ?? '')
  const fileName = String(data.settings?.helper_file_name ?? '')
  const storedPreview = String(data.settings?.helper_preview_url ?? '')
  const helperValue = String(data.settings?.helper_value ?? '')
  const fallbackUrl = isUsableFlowMediaUrl(storedPreview)
    ? storedPreview
    : isUsableFlowMediaUrl(helperValue)
      ? helperValue
      : undefined

  return (
    <div className="nodrag nopan space-y-1.5">
      <FlowCompactMediaField
        nodeId={nodeId}
        value={storageId}
        fileName={fileName}
        previewUrl={fallbackUrl}
        mediaKind={isVideo ? 'video' : 'image'}
        readOnly={readOnly}
        onChange={(patch) => dispatchNodeFieldsChange(nodeId, {
          settings: {
            helper_storage_object_id: patch.storage_object_id,
            helper_file_name: patch.media_file_name,
            helper_preview_url: patch.media_preview_url,
            helper_value: patch.media_preview_url ?? patch.storage_object_id ?? '',
          },
        })}
      />
      <FlowHelperMediaPreview
        storageObjectId={storageId}
        fileName={fileName}
        mediaKind={isVideo ? 'video' : 'image'}
        fallbackUrl={fallbackUrl}
      />
    </div>
  )
}

function HelperAudioField({
  nodeId,
  data,
  readOnly,
}: {
  nodeId: string
  data: WorkflowCanvasNodeData
  readOnly?: boolean
}) {
  const storageId = String(data.settings?.helper_storage_object_id ?? '')
  const fileName = String(data.settings?.helper_file_name ?? '')
  const storedPreview = String(data.settings?.helper_preview_url ?? '')
  const helperValue = String(data.settings?.helper_value ?? '')
  const fallbackUrl = isUsableFlowMediaUrl(storedPreview)
    ? storedPreview
    : isUsableFlowMediaUrl(helperValue)
      ? helperValue
      : undefined

  return (
    <div className="nodrag nopan space-y-1.5">
      <FlowCompactMediaField
        nodeId={nodeId}
        value={storageId}
        fileName={fileName}
        previewUrl={fallbackUrl}
        mediaKind="audio"
        readOnly={readOnly}
        onChange={(patch) => dispatchNodeFieldsChange(nodeId, {
          settings: {
            helper_storage_object_id: patch.storage_object_id,
            helper_file_name: patch.media_file_name,
            helper_preview_url: patch.media_preview_url,
            helper_value: patch.media_preview_url ?? patch.storage_object_id ?? '',
          },
        })}
      />
      <FlowHelperMediaPreview
        storageObjectId={storageId}
        fileName={fileName}
        mediaKind="audio"
        fallbackUrl={fallbackUrl}
      />
    </div>
  )
}

function getInlineNodeFields(
  data: WorkflowCanvasNodeData,
  imageModels: WorkflowCanvasImageModel[],
  includeAdvanced = false,
  chatModels: FlowNodeChatModel[] = [],
  runtimeGallery?: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>,
): InlineNodeFieldModel[] {
  const firstInput = getNodePorts(data, 'input')[0]?.label ?? 'Manual'
  const firstOutput = getNodePorts(data, 'output')[0]?.label ?? 'Result'
  const providerValue = publicProviderDisplayValue(data.provider)
  const providerOptions = providerOptionsForKind(data.kind, providerValue)

  if (data.kind === 'input') {
    const helperType = getHelperInputType(data.settings)
    if (helperType === 'prompt') {
      return [
        {
          label: 'terms.prompt',
          value: String(data.settings?.helper_value ?? data.description ?? ''),
          kind: 'textarea',
          settingKey: 'helper_value',
        },
      ]
    }
    return [
      {
        label: helperType === 'video' ? 'terms.videoUrl' : 'terms.imageUrl',
        value: String(data.settings?.helper_value ?? ''),
        kind: 'text',
        settingKey: 'helper_value',
      },
    ]
  }

  if (data.kind === 'trigger') {
    return [
      { label: 'terms.source', value: providerValue, kind: 'select', target: 'provider', options: providerOptions },
      { label: 'terms.event', value: data.subtitle || 'Manual run', kind: 'select', target: 'subtitle', options: ['Manual run', 'Video upload', 'Comment signal'] },
    ]
  }

  const catalogFields = getCatalogInlineNodeFields(data, includeAdvanced, chatModels, runtimeGallery)
  if (getFlowNodeInlineFields(data, { includeAdvanced, chatModels, runtimeGallery }) !== null || catalogFields.length > 0) {
    return catalogFields
  }

  if (data.kind === 'ai') {
    if (isPromptGenerateSettings(data.settings)) {
      return [
        {
          label: 'terms.instruction',
          value: String(data.settings?.instruction ?? data.description ?? ''),
          kind: 'textarea',
          settingKey: 'instruction',
        },
        {
          label: 'terms.model',
          value: getPromptModelId(data.settings),
          kind: 'select',
          settingKey: 'model_id',
          options: promptModelOptions,
        },
      ]
    }
    if (isPromptEnhanceSettings(data.settings)) {
      return [
        {
          label: 'terms.prompt',
          value: String(data.settings?.prompt ?? data.description ?? ''),
          kind: 'textarea',
          settingKey: 'prompt',
        },
        {
          label: 'terms.model',
          value: getPromptModelId(data.settings),
          kind: 'select',
          settingKey: 'model_id',
          options: promptModelOptions,
        },
      ]
    }
    return [
      { label: 'terms.prompt', value: data.description, kind: 'textarea', target: 'description' },
      { label: 'terms.model', value: providerValue, kind: 'select', target: 'provider', options: providerOptions },
      { label: 'terms.temperature', value: '0.7', kind: 'number' },
    ]
  }

  if (data.kind === 'image') {
    return getImageInlineNodeFields(data, imageModels)
  }

  if (data.kind === 'logic' && isReviewGateSettings(data.settings)) {
    return [
      {
        label: 'terms.mode',
        value: getReviewMode(data.settings),
        kind: 'select',
        settingKey: 'review_mode',
        options: [...reviewModeOptions],
      },
    ]
  }

  if (data.kind === 'render') {
    return [
      { label: 'terms.source', value: firstInput, kind: 'select', options: [firstInput] },
      { label: 'terms.format', value: '9:16 mp4', kind: 'select' },
      { label: 'terms.quality', value: 'High', kind: 'select' },
      { label: 'terms.captions', value: 'On', kind: 'toggle' },
    ]
  }

  if (data.kind === 'publish') {
    return [
      { label: 'terms.asset', value: firstInput, kind: 'select', options: [firstInput] },
      { label: 'terms.channel', value: providerValue, kind: 'select', target: 'provider', options: providerOptions },
      { label: 'terms.schedule', value: 'Best slot', kind: 'select' },
      { label: 'terms.privacy', value: 'Scheduled', kind: 'select' },
    ]
  }

  if (data.kind === 'logic') {
    return [
      { label: 'terms.source', value: firstInput, kind: 'select', options: [firstInput] },
      { label: 'terms.rule', value: data.description, kind: 'textarea', target: 'description' },
      { label: 'terms.pass', value: firstOutput, kind: 'select', options: [firstOutput] },
    ]
  }

  if (data.kind === 'analytics') {
    return [
      { label: 'terms.signal', value: firstInput, kind: 'select', options: [firstInput] },
      { label: 'terms.window', value: 'First hour', kind: 'select' },
      { label: 'terms.alert', value: 'On', kind: 'toggle' },
    ]
  }

  return [
    { label: 'terms.provider', value: providerValue, kind: 'select', target: 'provider', options: providerOptions },
  ]
}

const TRANSCRIPT_WORKFLOW_CORE_FIELDS = new Set(['storage_object_id', 'model_id'])
const TRANSCRIPT_WORKFLOW_ADVANCED_FIELDS = new Set(['source_language', 'timestamps'])
const CAPTION_WORKFLOW_DUAL_ADVANCED_FIELDS = [
  'source_style_name',
  'translation_style_name',
  'source_font_scale',
  'translation_font_scale',
]
const RESEARCH_WORKFLOW_CORE_FIELDS = ['prompt', 'mode', 'model_id']
const RESEARCH_WORKFLOW_ADVANCED_FIELDS = [
  'execution',
  'operation',
  'use_case',
  'target',
  'keywords',
  'location_code',
  'language_code',
  'time_range',
  'max_credits',
  'output_format',
]
const MEDIA_DOWNLOADER_WORKFLOW_QUICK_FIELDS = [
  'mode',
  'download_variant',
  'quality',
  'metadata',
]
const MEDIA_DOWNLOADER_WORKFLOW_ADVANCED_FIELDS: string[] = []
const MEDIA_DOWNLOADER_WORKFLOW_DOWNLOAD_ONLY_FIELDS = new Set([
  'download_variant',
  'quality',
  'start_time',
  'end_time',
  'metadata',
])

function enrichFlowNodeFields(data: WorkflowCanvasNodeData, fields: FlowNodeField[]): InlineNodeFieldModel[] {
  return fields.map((field) => ({
    ...field,
    fileName: field.kind === 'storage_media' ? String(data.settings?.media_file_name ?? '') : undefined,
    previewUrl: field.kind === 'storage_media' ? String(data.settings?.media_preview_url ?? '') : undefined,
    modelId: field.kind === 'voice_profile'
      ? (flowNodeTypeKey(data.settings) === 'avatar_generate'
        ? 'speech-natural-v1'
        : String(data.settings?.model_id ?? ''))
      : undefined,
    language: field.kind === 'voice_profile' ? String(data.settings?.language ?? 'en') : undefined,
  }))
}

function getCatalogInlineNodeFields(
  data: WorkflowCanvasNodeData,
  includeAdvanced: boolean,
  chatModels: FlowNodeChatModel[] = [],
  runtimeGallery?: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>,
): InlineNodeFieldModel[] {
  const profileFields = getFlowNodeInlineFields(data, { includeAdvanced, chatModels, runtimeGallery })
  if (profileFields) return enrichFlowNodeFields(data, profileFields)

  const schema = catalogInputSchemaFromSettings(data.settings)
  const transcriptNode = isTranscriptWorkflowNode(data)
  const captionNode = isCaptionWorkflowNode(data)
  const mediaDownloaderNode = isMediaDownloaderWorkflowNode(data)
  const researchNode = isResearchWorkflowNode(data)
  const captionFieldOrder = getCaptionWorkflowInlineFieldOrder(data.settings, includeAdvanced)
  const captionFields = new Set(captionFieldOrder)
  const downloaderMode = String(data.settings?.mode ?? 'download').toLowerCase()
  const downloaderClipMode = getWorkflowMediaDownloaderClipMode(data.settings)
  const downloaderSourcePlatform = getWorkflowMediaDownloaderSourcePlatform(data.settings)
  const showDownloaderQuality = downloaderSourcePlatform === 'youtube'
  const downloaderSourceField = 'url'
  const researchExecution = String(data.settings?.execution ?? 'research').toLowerCase()
  const researchOperation = String(data.settings?.operation ?? '').toLowerCase()
  const researchKeywordOperations = new Set([
    'google_trends',
    'keyword_expand',
    'keyword_metrics',
    'trend_compare',
    'trend_related_queries',
    'trend_related_topics',
  ])
  const researchTrendOperations = new Set([
    'google_trends',
    'trend_compare',
    'trend_related_queries',
    'trend_related_topics',
  ])
  const researchFields = new Set([
    ...RESEARCH_WORKFLOW_CORE_FIELDS,
    ...(includeAdvanced ? RESEARCH_WORKFLOW_ADVANCED_FIELDS : []),
  ].filter((field) => {
    if (field === 'operation') return researchExecution === 'operation'
    if (field === 'use_case') return researchExecution !== 'operation'
    if (field === 'target') {
      return researchExecution === 'operation'
        && ['youtube_comments', 'youtube_video_info', 'youtube_subtitles'].includes(researchOperation)
    }
    if (field === 'keywords') {
      return (researchExecution === 'operation' && researchKeywordOperations.has(researchOperation))
        || researchExecution !== 'operation'
    }
    if (field === 'time_range') return researchExecution !== 'operation' || researchTrendOperations.has(researchOperation)
    return true
  }))
  const downloaderFields = new Set([
    downloaderSourceField,
    ...MEDIA_DOWNLOADER_WORKFLOW_QUICK_FIELDS,
    ...(downloaderClipMode === 'clip' ? ['start_time', 'end_time'] : []),
    ...(includeAdvanced ? MEDIA_DOWNLOADER_WORKFLOW_ADVANCED_FIELDS : []),
  ].filter((field) => (
    (downloaderMode !== 'metadata' || !MEDIA_DOWNLOADER_WORKFLOW_DOWNLOAD_ONLY_FIELDS.has(field))
    && !(!showDownloaderQuality && field === 'quality')
  )))
  const availableFieldPorts = catalogPortsFromSchema(schema, 'input')
    .filter((port) => isCatalogConfigurableField(data, port.id))
    .filter((port) => !isJsonBlobCatalogField(port.id, port.type))
  const ports = availableFieldPorts.filter((port) => {
    const id = normalizePortName(port.id)
    if (String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').split('@')[0] === 'viral_clips') {
      if (['context_montage', 'editing_style', 'transition'].includes(id)) return false
      if (id === 'censor_audio_mode' && data.settings?.censor !== 'profanity') return false
      if (id === 'censor_sound' && (data.settings?.censor !== 'profanity' || data.settings?.censor_audio_mode !== 'beep')) return false
    }
    if (['censor_review_revision', 'censor_review_parent_object_id', 'allow_censor_draft'].includes(id)) return false
    if (transcriptNode) {
      return TRANSCRIPT_WORKFLOW_CORE_FIELDS.has(id)
        || (includeAdvanced && TRANSCRIPT_WORKFLOW_ADVANCED_FIELDS.has(id))
    }
    if (captionNode) return captionFields.has(id)
    if (mediaDownloaderNode) return downloaderFields.has(id)
    if (researchNode) return researchFields.has(id)
    return true
  })
  if (ports.length === 0 || Object.keys(schema).length === 0) return []

  const downloaderFieldOrder = [
    downloaderSourceField,
    ...MEDIA_DOWNLOADER_WORKFLOW_QUICK_FIELDS,
    'start_time',
    'end_time',
    ...MEDIA_DOWNLOADER_WORKFLOW_ADVANCED_FIELDS,
  ]
  const visiblePorts = captionNode
    ? [...ports].sort((left, right) => (
      captionFieldOrder.indexOf(normalizePortName(left.id))
      - captionFieldOrder.indexOf(normalizePortName(right.id))
    ))
    : mediaDownloaderNode
    ? [...ports].sort((left, right) => (
      downloaderFieldOrder.indexOf(normalizePortName(left.id))
      - downloaderFieldOrder.indexOf(normalizePortName(right.id))
    ))
    : researchNode
      ? [...ports].sort((left, right) => (
        [...RESEARCH_WORKFLOW_CORE_FIELDS, ...RESEARCH_WORKFLOW_ADVANCED_FIELDS].indexOf(normalizePortName(left.id))
        - [...RESEARCH_WORKFLOW_CORE_FIELDS, ...RESEARCH_WORKFLOW_ADVANCED_FIELDS].indexOf(normalizePortName(right.id))
      ))
      : getGenericCatalogVisibleFieldPorts(data, ports, includeAdvanced)
  const fields: InlineNodeFieldModel[] = visiblePorts.map((port) => {
    const catalogPort = schema[port.id] ?? schema[port.label] ?? schema[normalizePortName(port.label)]
    const allowedValues = catalogPortOptionValues(catalogPort).filter((value) => (
      !mediaDownloaderNode
      || normalizePortName(port.id) !== 'download_variant'
      || value !== 'metadata_only'
    ))
    const value = catalogFieldDisplayValue(
      data.settings?.[port.id] ?? catalogPort?.default,
      port,
    )
    const formRole = typeof catalogPort?.form_role === 'string' ? catalogPort.form_role : ''
    const isModelField = formRole === 'model'
      || ['model_id', 'research_model'].includes(normalizePortName(port.id))
    const modelOptions = uniqueStrings([
      value,
      ...allowedValues,
      ...chatModels.map((model) => model.id),
    ]).filter(Boolean)
    const baseField = {
      label: mediaDownloaderNode && normalizePortName(port.id) === 'mode'
        ? 'Mode'
        : workflowCatalogFieldLabel(port, String(data.settings?.node_type ?? '')),
      value,
      settingKey: port.id,
      ...(captionNode && normalizePortName(port.id) === 'subtitle_mode' ? {
        patchForValue: (nextMode: string) => ({
          settings: nextMode === 'bilingual'
            ? { subtitle_mode: 'bilingual' }
            : nextMode === 'translated'
              ? {
                subtitle_mode: 'translated',
                bilingual_order: undefined,
                source_style_name: undefined,
                translation_style_name: undefined,
                source_font_scale: undefined,
                translation_font_scale: undefined,
              }
              : {
                subtitle_mode: 'original',
                target_language: undefined,
                bilingual_order: undefined,
                source_style_name: undefined,
                translation_style_name: undefined,
                source_font_scale: undefined,
                translation_font_scale: undefined,
              },
        }),
      } : {}),
      ...(researchNode && normalizePortName(port.id) === 'execution' ? {
        patchForValue: (nextExecution: string) => ({
          settings: nextExecution === 'operation'
            ? { execution: 'operation', use_case: undefined }
            : { execution: 'research', operation: undefined, target: undefined },
        }),
      } : {}),
      ...(researchNode && normalizePortName(port.id) === 'operation' ? {
        patchForValue: (nextOperation: string) => ({
          settings: {
            operation: nextOperation,
            ...(!['youtube_comments', 'youtube_video_info', 'youtube_subtitles'].includes(nextOperation)
              ? { target: undefined }
              : {}),
            ...(!researchKeywordOperations.has(nextOperation) ? { keywords: undefined } : {}),
            ...(!researchTrendOperations.has(nextOperation) ? { time_range: undefined } : {}),
          },
        }),
      } : {}),
    }

    if ((transcriptNode || captionNode) && port.id === 'storage_object_id') {
      return {
        ...baseField,
        kind: 'storage_media',
      } satisfies InlineNodeFieldModel
    }

    if (isModelField) {
      return {
        ...baseField,
        kind: 'select',
        options: modelOptions.length > 0 ? modelOptions : [value || 'auto-llm'],
        optionLabels: Object.fromEntries(chatModels.map((model) => [model.id, publicModelLabel(model.label)])),
      } satisfies InlineNodeFieldModel
    }

    if (allowedValues?.length) {
      return {
        ...baseField,
        kind: 'select',
        options: allowedValues,
      } satisfies InlineNodeFieldModel
    }

    if (port.type === 'integer' || port.type === 'float') {
      return {
        ...baseField,
        kind: 'number',
        min: catalogPortNumber(catalogPort, ['min_value', 'minimum', 'min']) ?? undefined,
        max: catalogPortNumber(catalogPort, ['max_value', 'maximum', 'max']) ?? undefined,
        step: port.type === 'integer' ? 1 : 0.1,
      } satisfies InlineNodeFieldModel
    }

    if (port.type === 'boolean') {
      return {
        ...baseField,
        kind: 'toggle',
        value: value === 'true' || value === 'On' ? 'true' : 'false',
      } satisfies InlineNodeFieldModel
    }

    if (port.type === 'dict' || port.type === 'list' || isLongCatalogTextPort(port)) {
      return {
        ...baseField,
        kind: 'textarea',
      } satisfies InlineNodeFieldModel
    }

    return {
      ...baseField,
      kind: 'text',
    } satisfies InlineNodeFieldModel
  })

  if (mediaDownloaderNode) {
    if (downloaderMode !== 'metadata' && downloaderSourcePlatform !== 'unknown') {
      const rangeField: InlineNodeFieldModel = {
        label: 'Range',
        value: downloaderClipMode,
        kind: 'range_mode',
        settingKey: '__media_downloader_clip_mode',
        patchForValue: (nextMode) => ({
          settings: nextMode === 'clip'
            ? {
              __media_downloader_clip_mode: 'clip',
              start_time: data.settings?.start_time ?? 0,
              end_time: data.settings?.end_time ?? 60,
            }
            : {
              __media_downloader_clip_mode: 'full',
              start_time: undefined,
              end_time: undefined,
            },
        }),
      }
      const rangeIndex = fields.findIndex((field) => (
        field.settingKey === 'start_time'
        || field.settingKey === 'end_time'
        || field.settingKey === 'metadata'
      ))
      fields.splice(rangeIndex >= 0 ? rangeIndex : fields.length, 0, rangeField)
    }
  }

  return fields
}

function hasCatalogAdvancedNodeFields(data: WorkflowCanvasNodeData, chatModels: FlowNodeChatModel[] = []) {
  if (getFlowNodeInlineFields(data, { chatModels }) !== null) {
    return hasFlowNodeAdvancedFields(data, chatModels)
  }
  const schema = catalogInputSchemaFromSettings(data.settings)
  const names = new Set(Object.keys(schema).map(normalizePortName))
  if (isTranscriptWorkflowNode(data)) {
    return [...TRANSCRIPT_WORKFLOW_ADVANCED_FIELDS].some((field) => names.has(field))
  }
  if (isCaptionWorkflowNode(data)) {
    const subtitleMode = String(data.settings?.subtitle_mode ?? 'original').toLowerCase()
    return subtitleMode === 'bilingual'
      && CAPTION_WORKFLOW_DUAL_ADVANCED_FIELDS.some((field) => names.has(field))
  }
  if (isMediaDownloaderWorkflowNode(data)) {
    return false
  }
  if (isResearchWorkflowNode(data)) {
    return RESEARCH_WORKFLOW_ADVANCED_FIELDS.some((field) => names.has(field))
  }
  const configurablePorts = catalogPortsFromSchema(schema, 'input')
    .filter((port) => isCatalogConfigurableField(data, port.id))
    .filter((port) => !isJsonBlobCatalogField(port.id, port.type))
  return getGenericCatalogVisibleFieldPorts(data, configurablePorts, false).length < configurablePorts.length
}

function getGenericCatalogVisibleFieldPorts(
  data: WorkflowCanvasNodeData,
  ports: WorkflowNodePort[],
  includeAdvanced: boolean,
) {
  const standardFieldNames = catalogStandardFieldNamesFromSettings(data.settings)
  const coreIds = new Set<string>()

  for (const port of ports) {
    if (coreIds.size >= 4) break
    if (standardFieldNames.has(normalizePortName(port.id))) coreIds.add(port.id)
  }
  for (const port of ports) {
    if (coreIds.size >= 4) break
    if (port.required && !isLikelyWorkflowDataPort(data, port)) coreIds.add(port.id)
  }
  if (coreIds.size === 0) {
    const fallbackPorts = ports.filter((port) => !isLikelyWorkflowDataPort(data, port))
    for (const port of (fallbackPorts.length > 0 ? fallbackPorts : ports).slice(0, 3)) {
      coreIds.add(port.id)
    }
  }

  const core = ports.filter((port) => coreIds.has(port.id)).slice(0, 4)
  if (!includeAdvanced) return core
  return [...core, ...ports.filter((port) => !coreIds.has(port.id))]
}

function catalogStandardFieldNamesFromSettings(settings: WorkflowCanvasNodeData['settings']) {
  const contract = readWorkflowRecord(settings?.__catalog_form_contract)
  const standardFields = readWorkflowRecord(contract.standard_fields)
  return new Set(
    Object.values(standardFields)
      .map((binding) => normalizePortName(String(readWorkflowRecord(binding).name ?? '')))
      .filter((name) => name !== 'port'),
  )
}

function isCatalogConfigurableField(data: WorkflowCanvasNodeData, portId: string) {
  const classification = catalogInputClassificationForPort(data.settings, portId)
  if (classification === null) return true
  if (typeof classification === 'string') {
    return !catalogClassificationIsPrivate(classification)
  }
  if (classification.accepts_config === false || classification.exposed_to_assistant === false) return false
  return !catalogClassificationIsPrivate([
    classification.kind,
    classification.classification,
    classification.scope,
    classification.visibility,
    classification.exposure,
  ].join(' '))
}

function catalogClassificationIsPrivate(value: string) {
  return /\b(secret|internal|credential|system|hidden)\b/i.test(value)
}

function isTranscriptWorkflowNode(data: WorkflowCanvasNodeData) {
  const nodeType = String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').toLowerCase()
  return nodeType === 'transcript' || nodeType.startsWith('transcript@')
}

function isCaptionWorkflowNode(data: WorkflowCanvasNodeData) {
  const nodeType = String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').toLowerCase()
  return nodeType === 'caption' || nodeType.startsWith('caption@')
}

function getCaptionWorkflowInlineFieldOrder(
  settings: WorkflowCanvasNodeData['settings'],
  includeAdvanced = false,
): string[] {
  return getCaptionWorkflowProfileFieldOrder(settings, includeAdvanced)
}

function isMediaDownloaderWorkflowNode(data: WorkflowCanvasNodeData) {
  const nodeType = String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').toLowerCase()
  return nodeType === 'media_downloader' || nodeType.startsWith('media_downloader@')
}

function isResearchWorkflowNode(data: WorkflowCanvasNodeData) {
  const nodeType = String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').toLowerCase()
  return nodeType === 'research_agent' || nodeType.startsWith('research_agent@')
}

function getWorkflowMediaDownloaderClipMode(
  settings: WorkflowCanvasNodeData['settings'],
): 'full' | 'clip' {
  const explicitMode = settings?.__media_downloader_clip_mode
  if (explicitMode === 'full' || explicitMode === 'clip') return explicitMode
  const hasStart = settings?.start_time !== undefined && settings?.start_time !== null && settings?.start_time !== ''
  const hasEnd = settings?.end_time !== undefined && settings?.end_time !== null && settings?.end_time !== ''
  return hasStart || hasEnd ? 'clip' : 'full'
}

function getWorkflowMediaDownloaderSourcePlatform(
  settings: WorkflowCanvasNodeData['settings'],
): 'youtube' | 'social_without_quality_options' | 'unknown' {
  const direct = typeof settings?.url === 'string' ? settings.url.trim() : ''
  const legacyUrls = Array.isArray(settings?.urls)
    ? settings.urls.map((value) => String(value).trim()).filter(Boolean)
    : typeof settings?.urls === 'string'
      ? settings.urls.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean)
      : []
  const rawUrl = direct || (legacyUrls.length === 1 ? legacyUrls[0] ?? '' : '')
  const parsed = parseMediaDownloaderVideoUrl(rawUrl)
  if (!parsed) return 'unknown'
  return parsed.platform === 'youtube' ? 'youtube' : 'social_without_quality_options'
}

function workflowCatalogFieldLabel(port: WorkflowNodePort, nodeType = '') {
  const id = normalizePortName(port.id)
  const researchNode = nodeType === 'research_agent' || nodeType.startsWith('research_agent@')
  if (id === 'storage_object_id') return 'Media'
  if (id === 'url') return 'Media URL'
  if (id === 'download_variant') return 'Output'
  if (id === 'start_time') return 'Clip start'
  if (id === 'end_time') return 'Clip end'
  if (id === 'subtitle_mode') return 'Caption language'
  if (id === 'target_language') return 'Translate to'
  if (id === 'style_name') return 'Caption style'
  if (id === 'bilingual_order') return 'Line order'
  if (id === 'source_style_name') return 'Original style'
  if (id === 'translation_style_name') return 'Translation style'
  if (id === 'source_font_scale') return 'Original line size'
  if (id === 'translation_font_scale') return 'Translation line size'
  if (researchNode && id === 'mode') return 'Research depth'
  if (id === 'model_id' || id === 'research_model') return researchNode ? 'Research model' : 'Model'
  if (researchNode && id === 'execution') return 'Research type'
  if (researchNode && id === 'operation') return 'Single operation'
  if (researchNode && id === 'use_case') return 'Research goal'
  if (id === 'target') return 'YouTube video URL or ID'
  if (id === 'keywords') return 'Trend keywords'
  if (id === 'max_credits') return 'Spending limit'
  return port.label || humanizePortLabel(port.id)
}

function formatCatalogOptionLabel(settingKey: string | undefined, option: string) {
  const flowLabel = formatFlowFieldOption(settingKey, option)
  if (settingKey === 'quality' && option === 'standard') return 'Balanced'
  if (settingKey === 'quality' && option === 'best_available') return 'Best available'
  if (flowLabel && flowLabel !== option.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())) {
    return flowLabel
  }
  const normalizedKey = normalizePortName(settingKey ?? '')
  const labels: Record<string, Record<string, string>> = {
    mode: {
      fast: 'Fast · quick scan',
      medium: 'Medium · broad scan',
      high: 'High · deep research',
      ultra: 'Ultra · maximum evidence',
    },
    model_id: {
      'gpt-5.6-sol': 'GPT-5.6 Sol',
      'gpt-5.6-terra': 'GPT-5.6 Terra',
      'gpt-5.6-luna': 'GPT-5.6 Luna',
      'auto-llm': 'Auto',
    },
    execution: { research: 'Full research', operation: 'Single operation' },
    operation: {
      youtube_search: 'YouTube search',
      youtube_comments: 'YouTube comments',
      youtube_video_info: 'YouTube video info',
      youtube_subtitles: 'YouTube subtitles',
      google_trends: 'Google Trends',
      keyword_expand: 'Keyword ideas',
      keyword_metrics: 'Keyword demand',
      trend_compare: 'Trend comparison',
      trend_related_queries: 'Related trend queries',
      trend_related_topics: 'Related trend topics',
      tiktok_signal: 'TikTok signals',
      reddit_signal: 'Reddit signals',
      x_signal: 'X signals',
    },
    use_case: {
      auto: 'Automatic intent',
      niche_discovery: 'Niche discovery',
      trend_video_finder: 'Trending video finder',
      competitor_analysis: 'Competitor analysis',
      content_idea_research: 'Content idea research',
      keyword_validation: 'Keyword validation',
      social_pulse: 'Social pulse',
      custom: 'Custom research',
    },
    output_format: { report: 'Readable report', canonical_json: 'Structured JSON', llm_context: 'LLM context' },
    subtitle_mode: { original: 'Original', translated: 'Translated only', bilingual: 'Dual language' },
    bilingual_order: {
      source_above: 'Original above · Translation below',
      translation_above: 'Translation above · Original below',
    },
    source_style_name: { inherit: 'Same as Caption style' },
    translation_style_name: { inherit: 'Same as Caption style' },
  }
  const label = labels[normalizedKey]?.[option]
  if (label) return label
  return flowLabel
}

function catalogPortOptionValues(port: WorkflowNodeCatalogPort | undefined) {
  if (!port) return []
  for (const key of ['allowed_values', 'values', 'options', 'enum']) {
    const value = readWorkflowRecord(port)[key]
    if (Array.isArray(value)) {
      return uniqueStrings(value.map((item) => String(item)))
    }
  }
  return []
}

function catalogPortNumber(port: WorkflowNodeCatalogPort | undefined, keys: string[]) {
  if (!port) return null
  const record = readWorkflowRecord(port)
  for (const key of keys) {
    const value = readWorkflowNumber(record[key])
    if (value !== null) return value
  }
  return null
}

function catalogInputSchemaFromSettings(settings: WorkflowCanvasNodeData['settings']) {
  const record = readWorkflowRecord(settings?.__catalog_input_schema)
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      const port = readWorkflowRecord(value) as unknown as WorkflowNodeCatalogPort
      return [normalizePortName(port.name || key), port]
    }),
  ) as Record<string, WorkflowNodeCatalogPort>
}

function catalogInputClassificationForPort(
  settings: WorkflowCanvasNodeData['settings'],
  portId: string,
): Record<string, unknown> | string | null {
  const classification = readWorkflowRecord(settings?.__catalog_input_classification)
  const normalizedPortId = normalizePortName(portId)
  const direct = classification[portId] ?? classification[normalizedPortId]
  const value = direct ?? Object.entries(classification).find(([key]) => normalizePortName(key) === normalizedPortId)?.[1]
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) return readWorkflowRecord(value)
  return null
}

function catalogFieldDisplayValue(value: unknown, port: WorkflowNodePort) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (port.type === 'list' && normalizePortName(port.id) === 'urls' && Array.isArray(value)) {
    return value.map((item) => String(item)).join('\n')
  }
  if (port.type === 'dict' || port.type === 'list') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return ''
    }
  }
  return String(value)
}

function isLongCatalogTextPort(port: WorkflowNodePort) {
  const normalized = port.id.toLocaleLowerCase('en-US')
  return port.type === 'string'
    && (normalized.includes('prompt')
      || normalized.includes('instruction')
      || normalized.includes('description')
      || normalized.includes('script'))
}

function getImageInlineNodeFields(
  data: WorkflowCanvasNodeData,
  imageModels: WorkflowCanvasImageModel[],
): InlineNodeFieldModel[] {
  const models = normalizeWorkflowImageModels(imageModels)
  const settings = data.settings ?? {}
  const task = getImageTask(settings)
  const selectedModel = selectWorkflowImageModel(settings, data, models, task)
  if (!selectedModel) {
    return [
      { label: 'terms.prompt', value: data.description, kind: 'textarea', target: 'description' },
      { label: 'terms.modelCatalog', value: 'Unavailable', kind: 'text' },
    ]
  }
  const schema = imageModelInputSchema(selectedModel)
  const outputFormat = getImageSchemaStringSetting(settings, schema, 'output_format', 'default_output_format', 'png')
  const maxCount = readPositiveSchemaInteger(schema, 'max_images_per_run') ?? 10
  const availableTaskValues = workflowImageTaskValuesForModels(models)
  const modeOptions = uniqueStrings([task, ...(availableTaskValues.length > 0 ? availableTaskValues : imageTaskOptions.map((option) => option.value))])
    .map(imageTaskLabel)
  const modelOptions = models
    .filter((model) => modelSupportsImageTask(model, task))
    .map(workflowImageModelSelectionValue)
  const fields: InlineNodeFieldModel[] = [
    {
      label: 'terms.mode',
      value: imageTaskLabel(task),
      kind: 'select',
      options: modeOptions,
      patchForValue: (value) => patchWorkflowImageTaskSelection(value, settings, models, selectedModel),
    },
    {
      label: 'terms.model',
      value: workflowImageModelSelectionValue(selectedModel),
      kind: 'select',
      options: modelOptions,
      patchForValue: (modelSelection) => patchWorkflowImageModelSelection(modelSelection, settings, models, task),
    },
    { label: 'terms.prompt', value: data.description, kind: 'textarea', target: 'description' },
    {
      label: 'terms.count',
      value: String(getImageCountWithMax(settings, maxCount)),
      kind: 'number',
      settingKey: 'image_count',
      min: 1,
      max: maxCount,
      step: 1,
    },
  ]

  appendImageOptionField(fields, settings, schema, 'Aspect', 'aspect_ratio', 'aspect_ratios', 'default_aspect_ratio', '1:1')
  appendImageSizeField(fields, settings, schema)
  appendImageOptionField(fields, settings, schema, 'Resolution', 'resolution', 'resolutions', 'default_resolution', '1k')
  appendImageOptionField(fields, settings, schema, 'Quality', 'quality', 'qualities', 'default_quality', 'auto')
  appendImageOptionField(fields, settings, schema, 'Format', 'output_format', 'output_formats', 'default_output_format', 'png')
  appendImageOptionField(fields, settings, schema, 'Background', 'background', 'backgrounds', 'default_background', 'auto')
  if (schema.input_fidelity_supported === true && imageInputTasks.has(task)) {
    const inputFidelityOptions = workflowImageSchemaValues(schema, 'input_fidelities')
    fields.push({
      label: 'terms.fidelity',
      value: getImageSchemaStringSetting(settings, schema, 'input_fidelity', 'default_input_fidelity', 'low'),
      kind: 'select',
      settingKey: 'input_fidelity',
      options: inputFidelityOptions.length > 0 ? inputFidelityOptions : ['low', 'high'],
    })
  }
  appendImageOptionField(fields, settings, schema, 'Style', 'style', 'styles', 'default_style', 'auto')

  if (schema.output_compression_supported === true && (outputFormat === 'jpeg' || outputFormat === 'webp')) {
    fields.push({
      label: 'terms.compress',
      value: String(getImageSchemaNumberSetting(settings, schema, 'output_compression', 'default_output_compression', 100)),
      kind: 'number',
      settingKey: 'output_compression',
      min: 0,
      max: 100,
      step: 5,
    })
  }

  const estimatedCredits = estimateWorkflowImageCredits(selectedModel, settings, schema)
  if (estimatedCredits !== null) {
    fields.push({ label: 'terms.credits', value: `${formatWorkflowCredits(estimatedCredits)}c est.`, kind: 'text' })
  }

  return fields
}

function workflowImageTaskValuesForModels(models: WorkflowCanvasImageModel[]) {
  return uniqueStrings(models.flatMap((model) => workflowImageSchemaValues(imageModelInputSchema(model), 'tasks')))
}

function estimateImageNodeCredits(
  data: WorkflowCanvasNodeData,
  imageModels: WorkflowCanvasImageModel[],
) {
  const models = normalizeWorkflowImageModels(imageModels)
  const settings = data.settings ?? {}
  const task = getImageTask(settings)
  const selectedModel = selectWorkflowImageModel(settings, data, models, task)
  if (!selectedModel) return null
  const schema = imageModelInputSchema(selectedModel)
  return estimateWorkflowImageCredits(selectedModel, settings, schema)
}

function appendImageOptionField(
  fields: InlineNodeFieldModel[],
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
  label: string,
  settingKey: string,
  schemaKey: string,
  defaultKey: string,
  fallback: string,
) {
  const options = workflowImageSchemaValues(schema, schemaKey)
  if (options.length === 0) return
  fields.push({
    label,
    value: getImageSchemaStringSetting(settings, schema, settingKey, defaultKey, fallback),
    kind: 'select',
    settingKey,
    options,
  })
}

function appendImageSizeField(
  fields: InlineNodeFieldModel[],
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
) {
  const options = workflowImageSchemaValues(schema, 'sizes')
  if (options.length === 0 && schema.custom_size_supported !== true) return
  fields.push({
    label: 'terms.size',
    value: getImageSchemaStringSetting(settings, schema, 'size', 'default_size', 'auto'),
    kind: schema.custom_size_supported === true ? 'text' : 'select',
    settingKey: 'size',
    options,
  })
}

function normalizeWorkflowImageModels(models?: WorkflowCanvasImageModel[]) {
  const byId = new Map<string, WorkflowCanvasImageModel>()
  const suppliedModels = models ?? []
  suppliedModels.forEach((model) => {
    if (model.id) byId.set(model.id, model)
  })
  return Array.from(byId.values())
}

function selectWorkflowImageModel(
  settings: WorkflowCanvasNodeData['settings'],
  data: Pick<WorkflowCanvasNodeData, 'provider' | 'subtitle'>,
  models: WorkflowCanvasImageModel[],
  task: string,
) {
  const requestedModelId = normalizeWorkflowImageModelId(String(settings?.model_id ?? ''))
  const visibleModelId = imageModelIdFromProvider(data.provider) ?? imageModelIdFromProvider(data.subtitle)
  const candidates = uniqueStrings([requestedModelId, visibleModelId ?? ''])
  for (const candidate of candidates) {
    const model = models.find((item) => item.id === candidate)
    if (model && modelSupportsImageTask(model, task)) return model
  }
  return models.find((model) => modelSupportsImageTask(model, task)) ?? models[0]
}

function patchWorkflowImageModelSelection(
  modelSelection: string,
  settings: WorkflowCanvasNodeData['settings'],
  models: WorkflowCanvasImageModel[],
  task: string,
): WorkflowNodeFieldsChangeDetail['patch'] {
  const model = findWorkflowImageModelBySelection(modelSelection, models)
  if (!model) return { settings: { ...settings } }
  const nextTask = modelSupportsImageTask(model, task)
    ? task
    : readWorkflowImageSchemaString(imageModelInputSchema(model), 'default_task') ?? 'text_to_image'
  return {
    provider: workflowImageProviderLabel(model),
    settings: {
      model_id: model.id,
      image_task: nextTask,
      ...defaultWorkflowImageSettingsForModel(model, settings, nextTask),
    },
  }
}

function patchWorkflowImageTaskSelection(
  value: string,
  settings: WorkflowCanvasNodeData['settings'],
  models: WorkflowCanvasImageModel[],
  selectedModel: WorkflowCanvasImageModel,
): WorkflowNodeFieldsChangeDetail['patch'] {
  const task = getImageTask({ image_task: value })
  const model = modelSupportsImageTask(selectedModel, task)
    ? selectedModel
    : models.find((item) => modelSupportsImageTask(item, task)) ?? selectedModel
  return {
    provider: workflowImageProviderLabel(model),
    settings: {
      model_id: model.id,
      image_task: task,
      ...defaultWorkflowImageSettingsForModel(model, settings, task),
    },
  }
}

function defaultWorkflowImageSettingsForModel(
  model: WorkflowCanvasImageModel,
  settings: WorkflowCanvasNodeData['settings'],
  task: string,
) {
  const schema = imageModelInputSchema(model)
  const outputFormat = getImageSchemaStringSetting(settings, schema, 'output_format', 'default_output_format', 'png')
  return {
    aspect_ratio: workflowImageSchemaValues(schema, 'aspect_ratios').length > 0
      ? getImageSchemaStringSetting(settings, schema, 'aspect_ratio', 'default_aspect_ratio', '1:1')
      : '',
    size: workflowImageSchemaValues(schema, 'sizes').length > 0 || schema.custom_size_supported === true
      ? getImageSchemaStringSetting(settings, schema, 'size', 'default_size', 'auto')
      : '',
    resolution: workflowImageSchemaValues(schema, 'resolutions').length > 0
      ? getImageSchemaStringSetting(settings, schema, 'resolution', 'default_resolution', '1k')
      : '',
    quality: workflowImageSchemaValues(schema, 'qualities').length > 0
      ? getImageSchemaStringSetting(settings, schema, 'quality', 'default_quality', 'auto')
      : '',
    output_format: workflowImageSchemaValues(schema, 'output_formats').length > 0 ? outputFormat : '',
    background: workflowImageSchemaValues(schema, 'backgrounds').length > 0
      ? getImageSchemaStringSetting(settings, schema, 'background', 'default_background', 'auto')
      : '',
    input_fidelity: schema.input_fidelity_supported === true && imageInputTasks.has(task)
      ? getImageSchemaStringSetting(settings, schema, 'input_fidelity', 'default_input_fidelity', 'low')
      : '',
    style: workflowImageSchemaValues(schema, 'styles').length > 0
      ? getImageSchemaStringSetting(settings, schema, 'style', 'default_style', 'auto')
      : '',
    output_compression: schema.output_compression_supported === true && (outputFormat === 'jpeg' || outputFormat === 'webp')
      ? getImageSchemaNumberSetting(settings, schema, 'output_compression', 'default_output_compression', 100)
      : '',
  }
}

function modelSupportsImageTask(model: WorkflowCanvasImageModel, task: string) {
  const tasks = workflowImageSchemaValues(imageModelInputSchema(model), 'tasks')
  return tasks.length === 0 || tasks.includes(task)
}

function imageModelInputSchema(model: WorkflowCanvasImageModel | null | undefined) {
  return readWorkflowRecord(model?.input_schema)
}

function workflowImageSchemaValues(schema: Record<string, unknown>, key: string) {
  const value = schema[key]
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === 'string'))
    : []
}

function getImageSchemaStringSetting(
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
  settingKey: string,
  defaultKey: string,
  fallback: string,
) {
  const rawCurrent = settings?.[settingKey]
  const current = typeof rawCurrent === 'string' ? rawCurrent.trim() : ''
  return current || (readWorkflowImageSchemaString(schema, defaultKey) ?? fallback)
}

function getImageSchemaNumberSetting(
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
  settingKey: string,
  defaultKey: string,
  fallback: number,
) {
  const current = readWorkflowNumber(settings?.[settingKey])
  return current ?? readWorkflowNumber(schema[defaultKey]) ?? fallback
}

function readWorkflowImageSchemaString(schema: Record<string, unknown>, key: string) {
  const value = schema[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readPositiveSchemaInteger(schema: Record<string, unknown>, key: string) {
  const value = readWorkflowNumber(schema[key])
  return value === null ? null : Math.max(1, Math.round(value))
}

function estimateWorkflowImageCredits(
  model: WorkflowCanvasImageModel,
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
) {
  const rule = readWorkflowRecord(model.pricing_rule)
  const count = getImageCountWithMax(settings, readPositiveSchemaInteger(schema, 'max_images_per_run') ?? 10)
  const matrixCredits = estimateWorkflowImageMatrixCredits(rule, settings, schema, count)
  if (matrixCredits !== null) return matrixCredits
  const meteredCredits = estimateWorkflowMeteredCredits(rule, settings, schema, count)
  if (meteredCredits !== null) return meteredCredits
  return typeof model.estimated_credits === 'number' && Number.isFinite(model.estimated_credits)
    ? boundedWorkflowCredits(model.estimated_credits * count, null)
    : null
}

function estimateWorkflowImageMatrixCredits(
  rule: Record<string, unknown>,
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
  count: number,
) {
  if (rule.mode !== 'image_option_matrix') return null
  const matrix = readWorkflowRecord(rule.matrix)
  if (Object.keys(matrix).length === 0) return null
  const size = getImageSchemaStringSetting(settings, schema, 'size', 'default_size', 'auto')
  const quality = getImageSchemaStringSetting(settings, schema, 'quality', 'default_quality', 'auto')
  const sizePrices = readWorkflowRecord(matrix[size] ?? matrix.default)
  const perImage = readWorkflowNumber(sizePrices[quality])
    ?? (quality === 'auto' ? readWorkflowNumber(sizePrices.medium) : null)
    ?? readWorkflowNumber(sizePrices.default)
    ?? readWorkflowNumber(rule.default_credits)
  if (perImage === null) return null
  return boundedWorkflowCredits(perImage * count, readWorkflowNumber(rule.min_credits))
}

function estimateWorkflowMeteredCredits(
  rule: Record<string, unknown>,
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
  count: number,
) {
  const base = readWorkflowNumber(rule.base_credits) ?? 0
  const minCredits = readWorkflowNumber(rule.min_credits)
  if (rule.mode === 'per_run') return boundedWorkflowCredits(base, minCredits)
  if (Array.isArray(rule.adjustments)) {
    let total = base
    const selection = workflowImagePricingSelection(settings, schema)
    const context = { selection, input: { ...selection, count }, params: { ...selection, count } }
    rule.adjustments.forEach((adjustment) => {
      const record = readWorkflowRecord(adjustment)
      if (!pricingAdjustmentMatches(record, context)) return
      const credits = readWorkflowNumber(record.credits)
      if (credits === null) return
      const operation = typeof record.operation === 'string' ? record.operation : 'add'
      if (operation === 'set_total') total = credits
      else if (operation === 'multiply') total *= credits
      else total += credits
    })
    return boundedWorkflowCredits(total, minCredits)
  }

  const perImage = readWorkflowNumber(rule.per_image_credits)
    ?? readWorkflowNumber(rule.unit_credits)
    ?? readWorkflowNumber(rule.credits_per_image)
  if (perImage === null && base === 0) return null
  return boundedWorkflowCredits(base + (perImage ?? 0) * count, minCredits)
}

function workflowImagePricingSelection(
  settings: WorkflowCanvasNodeData['settings'],
  schema: Record<string, unknown>,
) {
  return {
    task: getImageTask(settings),
    size: getImageSchemaStringSetting(settings, schema, 'size', 'default_size', 'auto'),
    resolution: getImageSchemaStringSetting(settings, schema, 'resolution', 'default_resolution', '1k'),
    quality: getImageSchemaStringSetting(settings, schema, 'quality', 'default_quality', 'auto'),
    output_format: getImageSchemaStringSetting(settings, schema, 'output_format', 'default_output_format', 'png'),
    background: getImageSchemaStringSetting(settings, schema, 'background', 'default_background', 'auto'),
    input_fidelity: getImageSchemaStringSetting(settings, schema, 'input_fidelity', 'default_input_fidelity', ''),
    style: getImageSchemaStringSetting(settings, schema, 'style', 'default_style', ''),
  }
}

function pricingAdjustmentMatches(record: Record<string, unknown>, context: Record<string, unknown>) {
  const field = typeof record.field === 'string' ? record.field : ''
  if (!field) return false
  const actual = readWorkflowPath(context, field)
  return actual === record.equals
}

function readWorkflowPath(record: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => (
    current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined
  ), record)
}

function readWorkflowRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readWorkflowNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boundedWorkflowCredits(value: number, minCredits: number | null) {
  const bounded = minCredits === null ? value : Math.max(value, minCredits)
  return Math.round(Math.max(0, bounded) * 100) / 100
}

function formatWorkflowCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function getImageCountWithMax(settings: WorkflowCanvasNodeData['settings'], maxCount: number) {
  const value = Number(settings?.image_count ?? settings?.count ?? 1)
  if (!Number.isFinite(value)) return 1
  return Math.min(maxCount, Math.max(1, Math.round(value)))
}

function workflowImageProviderLabel(model: WorkflowCanvasImageModel) {
  return workflowImageModelLabel(model)
}

function workflowImageModelSelectionValue(model: WorkflowCanvasImageModel) {
  return workflowImageModelLabel(model)
}

function workflowImageModelLabel(model: WorkflowCanvasImageModel) {
  const label = typeof model.label === 'string' ? model.label.trim() : ''
  return publicModelLabel(label, 'Model')
}

function findWorkflowImageModelBySelection(
  value: string,
  models: WorkflowCanvasImageModel[],
) {
  const canonicalId = normalizeWorkflowImageModelId(value)
  const normalizedValue = normalizeImageSelectionValue(value)
  return models.find((model) => model.id === canonicalId)
    ?? models.find((model) => normalizeWorkflowImageModelId(model.id) === canonicalId)
    ?? models.find((model) => normalizeImageSelectionValue(workflowImageModelLabel(model)) === normalizedValue)
    ?? models.find((model) => normalizeImageSelectionValue(model.id) === normalizedValue)
}

function normalizeWorkflowImageModelId(value: string) {
  if (!value) return ''
  const normalized = normalizeImageSelectionValue(value)
  if (isFluxImageSelection(value, normalized)) {
    return 'flux-2-klein-4b'
  }
  const gptImageModelId = gptImageModelIdFromSelection(normalized)
  if (gptImageModelId) return gptImageModelId
  return value
}

function imageModelIdFromProvider(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeImageSelectionValue(value)
  if (isFluxImageSelection(value, normalized)) {
    return 'flux-2-klein-4b'
  }
  const gptImageModelId = gptImageModelIdFromSelection(normalized)
  if (gptImageModelId) return gptImageModelId
  return null
}

function isFluxImageSelection(value: string, normalized: string) {
  return value === 'flux-2-klein-4b'
    || normalized === 'flux'
    || normalized === 'flux_4b'
    || normalized === 'flux_2_klein_4b'
    || normalized === 'flux2_klein_4b'
    || normalized.includes('flux_2_klein_4b')
}

function gptImageModelIdFromSelection(normalized: string) {
  if (normalized === 'gpt_image_2' || normalized.endsWith('_gpt_image_2')) return 'gpt-image-2'
  return null
}

function normalizeImageSelectionValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function publicProviderDisplayValue(value: string | null | undefined) {
  return publicWorkflowByline(value)
}

function canvasNodeByline(data: WorkflowCanvasNodeData, t: WorkflowTranslator) {
  if (isYoutubePublishUploadSettings(data.settings)) return 'By YouTube'
  const provider = localizeWorkflowTerm(publicProviderDisplayValue(data.provider), t)
  if (!provider) return ''
  if (/^by\s+/i.test(provider)) return provider
  if (data.kind === 'input' || data.kind === 'note') return provider
  if (/^youtube$/i.test(provider)) return 'By YouTube'
  if (/youtorch/i.test(provider)) return 'By Youtorch'
  return `By ${provider}`
}


function providerOptionsForKind(kind: WorkflowDefinitionNode['kind'], current: string) {
  const options: Record<WorkflowDefinitionNode['kind'], string[]> = {
    input: ['Input'],
    trigger: ['Youtorch', 'YouTube'],
    ai: ['Youtorch AI', 'FLUX.2 Klein 4B'],
    image: ['GPT Image 2'],
    render: ['Render'],
    publish: ['YouTube', 'Youtorch'],
    logic: ['Review', 'Rules', 'Youtorch'],
    analytics: ['Studio', 'YouTube Analytics'],
    note: ['Note'],
    provider: ['Youtorch'],
  }

  return uniqueStrings([publicProviderDisplayValue(current), ...(options[kind] ?? [])]).filter(Boolean)
}

function buildWorkflowLibraryNodes(nodeCatalog: WorkflowNodeCatalogItem[] | undefined, t: WorkflowTranslator): LibraryNode[] {
  const catalogNodes = (nodeCatalog ?? [])
    .filter(isCatalogNodeVisibleInCanvasPalette)
    .map(catalogItemToLibraryNode)
    .flatMap(splitUploadLibraryNode)
    .map((node) => localizeLibraryNode(node, t))

  return [
    ...getLocalLibraryNodes(t).filter(isLocalOnlyLibraryNode),
    ...catalogNodes,
  ]
}

function splitUploadLibraryNode(node: LibraryNode): LibraryNode[] {
  if (catalogNodeTypeName(node.nodeType) !== 'upload') return [node]
  return [
    {
      ...node,
      category: 'Logic & Utility',
      kind: 'logic',
      title: 'library.saveToAssetsTitle',
      subtitle: 'library.saveToAssetsSubtitle',
      description: 'library.saveToAssetsDescription',
      cost: '0c',
      settings: { ...(node.settings ?? {}), destination: 'assets' },
    },
  ]
}


/** Profile option labels are display text, or a `terms.*` key of the Workflows messages (e.g. avatar "Auto"). */
function localizeFieldOptionLabel(label: string | undefined, t: WorkflowTranslator) {
  return label?.startsWith('terms.') ? t(label) : label
}

function localizeWorkflowTerm(value: string, t: WorkflowTranslator) {
  if (value.startsWith('terms.') || value.startsWith('tasks.') || value.startsWith('library.')) return t(value)
  const localizedDisplayText = localizeWorkflowDisplayText(value, t)
  if (localizedDisplayText !== value) return localizedDisplayText
  const key = workflowTermKeys[value.trim().toLocaleLowerCase('en-US')]
  return key ? t(key) : value
}

const workflowTermKeys: Record<string, string> = {
  "all": "terms.all",
  "prompt": "terms.prompt",
  "image": "terms.image",
  "video": "terms.video",
  "reference": "terms.reference",
  "first frame": "terms.firstFrame",
  "last frame": "terms.lastFrame",
  "text": "terms.text",
  "usage": "terms.usage",
  "input": "terms.input",
  "output": "terms.output",
  "approved": "terms.approved",
  "decision": "terms.decision",
  "clips": "terms.clips",
  "composition json": "terms.compositionJson",
  "files": "terms.files",
  "storage types": "terms.storageTypes",
  "uploaded": "terms.uploaded",
  "nodes": "terms.nodes",
  "utility": "terms.utility",
  "favorites": "terms.favorites",
  "source": "terms.source",
  "event": "terms.event",
  "instruction": "terms.instruction",
  "model": "terms.model",
  "temperature": "terms.temperature",
  "mode": "terms.mode",
  "format": "terms.format",
  "quality": "terms.quality",
  "captions": "terms.captions",
  "asset": "terms.asset",
  "channel": "terms.channel",
  "schedule": "terms.schedule",
  "privacy": "terms.privacy",
  "rule": "terms.rule",
  "pass": "terms.pass",
  "signal": "terms.signal",
  "window": "terms.window",
  "alert": "terms.alert",
  "provider": "terms.provider",
  "range": "terms.range",
  "model catalog": "terms.modelCatalog",
  "count": "terms.count",
  "fidelity": "terms.fidelity",
  "compress": "terms.compress",
  "credits": "terms.credits",
  "size": "terms.size",
  "status": "terms.status",
  "revision": "terms.revision",
  "cost": "terms.cost",
  "batch": "terms.batch",
  "full": "terms.full",
  "clip": "terms.clip",
  "context": "terms.context",
  "plan": "terms.plan",
  "ai step": "terms.aiStep",
  "text to image": "tasks.textToImage",
  "image to image": "tasks.imageToImage",
  "first-last frame": "tasks.firstLastFrame",
  "compose video": "tasks.composeVideo",
  "image to video": "tasks.imageToVideo",
  "text to video": "tasks.textToVideo"
}

function localizeLibraryNode(node: LibraryNode, t: WorkflowTranslator): LibraryNode {
  return {
    ...node,
    title: localizeWorkflowTerm(node.title, t),
    subtitle: node.subtitle ? localizeWorkflowTerm(node.subtitle, t) : node.subtitle,
    provider: localizeWorkflowTerm(publicProviderDisplayValue(node.provider), t),
    description: localizeWorkflowTerm(node.description, t),
    inputPorts: node.inputPorts?.map((port) => ({ ...port, label: localizeWorkflowTerm(port.label, t) })),
    outputPorts: node.outputPorts?.map((port) => ({ ...port, label: localizeWorkflowTerm(port.label, t) })),
  }
}


function buildWorkflowNodeCatalogMap(nodeCatalog: WorkflowNodeCatalogItem[] | undefined) {
  const catalogByNodeType = new Map<string, WorkflowNodeCatalogItem>()
  ;(nodeCatalog ?? []).forEach((node) => {
    if (node.node_type) catalogByNodeType.set(node.node_type, node)
  })
  return catalogByNodeType
}

function hydrateFlowNodeFromCatalog(
  node: WorkflowFlowNode,
  catalogByNodeType: Map<string, WorkflowNodeCatalogItem>,
): WorkflowFlowNode {
  const nodeType = getCatalogHydrationNodeType(node.data)
  if (!nodeType) return node

  const catalogItem = catalogByNodeType.get(nodeType)
  if (!catalogItem || !isCatalogNodeVisibleInCanvas(catalogItem)) return node

  const settings = node.data.settings ?? {}
  const currentSchemaHash = typeof settings.__catalog_schema_hash === 'string'
    ? settings.__catalog_schema_hash
    : null
  const hasCatalogSchema = Object.keys(readWorkflowRecord(settings.__catalog_input_schema)).length > 0
  const hasClassification = Object.prototype.hasOwnProperty.call(settings, '__catalog_input_classification')
  const hasFormContract = Object.prototype.hasOwnProperty.call(settings, '__catalog_form_contract')
  if (currentSchemaHash === catalogItem.schema_hash && hasCatalogSchema && hasClassification && hasFormContract) return node

  const inputPorts = catalogPortsFromSchema(catalogItem.input_schema, 'input', nodeType)
  const outputPorts = catalogPortsFromSchema(catalogItem.output_schema, 'output', nodeType)
  const nextData: WorkflowCanvasNodeData = {
    ...node.data,
    subtitle: node.data.subtitle || catalogNodeSubtitle(catalogItem),
    provider: node.data.provider || catalogNodeProvider(catalogItem),
    cost: catalogNodeCostLabel(catalogItem),
    settings: {
      ...catalogDefaultSettings(catalogItem),
      ...settings,
      node_type: nodeType,
      __catalog_schema_hash: catalogItem.schema_hash,
      __catalog_pricing_hash: cleanCatalogText(catalogItem.pricing_metadata.pricing_config_hash) ?? null,
      __catalog_input_schema: catalogItem.input_schema,
      __catalog_input_classification: catalogItem.input_classification,
      __catalog_form_contract: catalogItem.form_contract,
    },
    inputs: inputPorts.map((port) => port.id),
    outputs: outputPorts.map((port) => port.id),
    inputPorts,
    outputPorts,
  }

  return { ...node, data: nextData }
}

function getCatalogHydrationNodeType(data: WorkflowCanvasNodeData) {
  const explicit = String(data.settings?.node_type ?? data.settings?.workflow_node_type ?? '').trim()
  if (explicit) return explicit
  if (data.kind === 'image') return 'image_generate@1'
  return null
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isLocalOnlyLibraryNode(node: LibraryNode) {
  if (isPreviewHelperNode(node)) return true
  return (node.kind === 'input' || node.kind === 'note') && !getLibraryNodeFavoriteNodeType(node)
}

function isPreviewHelperNode(data: { kind?: string; settings?: Record<string, unknown> | null }) {
  return data.settings?.helper_preview === true
}

function isCanvasFrameNode(data: { settings?: Record<string, unknown> | null }) {
  return data.settings?.helper_frame === true
}

function isCanvasTextNode(data: { settings?: Record<string, unknown> | null }) {
  return data.settings?.helper_canvas_text === true
}

function getFrameNodeSize(settings?: Record<string, unknown> | null): GuideNodeSize {
  return clampFrameNodeSize({
    width: numberOrDefault(settings?.frame_width, defaultFrameNodeSize.width),
    height: numberOrDefault(settings?.frame_height, defaultFrameNodeSize.height),
  })
}

function clampFrameNodeSize(size: GuideNodeSize): GuideNodeSize {
  return {
    width: Math.min(maxFrameNodeSize.width, Math.max(minFrameNodeSize.width, Math.round(size.width))),
    height: Math.min(maxFrameNodeSize.height, Math.max(minFrameNodeSize.height, Math.round(size.height))),
  }
}

function getFrameNodeColor(settings?: Record<string, unknown> | null) {
  const value = String(settings?.frame_color ?? frameColorPresets[0]).trim()
  return /^#([0-9a-f]{6})$/i.test(value) ? value : frameColorPresets[0]
}

function getCanvasTextFont(settings?: Record<string, unknown> | null) {
  const id = String(settings?.text_font ?? 'sans')
  return canvasTextFonts.find((font) => font.id === id) ?? canvasTextFonts[0]
}

function getCanvasTextSize(settings?: Record<string, unknown> | null) {
  const value = numberOrDefault(settings?.text_size, 24)
  return canvasTextSizes.includes(value as typeof canvasTextSizes[number]) ? value : 24
}

function getCanvasTextColor(settings?: Record<string, unknown> | null) {
  const value = String(settings?.text_color ?? canvasTextColorPresets[0]).trim()
  return /^#([0-9a-f]{6})$/i.test(value) ? value : canvasTextColorPresets[0]
}

function isFrameLocked(settings?: Record<string, unknown> | null) {
  return settings?.frame_locked === true
}

function getFrameNodeOpacity(settings?: Record<string, unknown> | null) {
  return Math.min(maxFrameOpacity, Math.max(minFrameOpacity, Math.round(numberOrDefault(settings?.frame_opacity, defaultFrameOpacity))))
}

function getCanvasParentId(settings?: Record<string, unknown> | null) {
  const value = String(settings?.canvas_parent_id ?? '').trim()
  return value || undefined
}

function canvasFrameFlowProps(settings?: Record<string, unknown> | null) {
  const size = getFrameNodeSize(settings)
  return {
    zIndex: 0,
    width: size.width,
    height: size.height,
    style: {
      width: size.width,
      height: size.height,
    },
  }
}

function getFlowNodeAbsolutePosition(nodes: WorkflowFlowNode[], node: WorkflowFlowNode) {
  const byId = new Map(nodes.map((current) => [current.id, current]))
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

function getFlowNodeRenderedSize(node: WorkflowFlowNode) {
  if (isCanvasFrameNode(node.data)) return getFrameNodeSize(node.data.settings)
  return {
    width: node.width ?? node.measured?.width ?? (isCanvasTextNode(node.data) ? 180 : 344),
    height: node.height ?? node.measured?.height ?? (isCanvasTextNode(node.data) ? 64 : 220),
  }
}

function findContainingFrame(nodes: WorkflowFlowNode[], nodeId: string) {
  const node = nodes.find((current) => current.id === nodeId)
  if (!node || isCanvasFrameNode(node.data)) return null
  const origin = getFlowNodeAbsolutePosition(nodes, node)
  const size = getFlowNodeRenderedSize(node)
  const center = { x: origin.x + size.width / 2, y: origin.y + size.height / 2 }
  let match: WorkflowFlowNode | null = null
  let matchArea = Number.POSITIVE_INFINITY
  for (const frame of nodes) {
    if (frame.id === nodeId || !isCanvasFrameNode(frame.data) || isFrameLocked(frame.data.settings)) continue
    const frameOrigin = getFlowNodeAbsolutePosition(nodes, frame)
    const frameSize = getFrameNodeSize(frame.data.settings)
    if (
      center.x < frameOrigin.x
      || center.y < frameOrigin.y
      || center.x > frameOrigin.x + frameSize.width
      || center.y > frameOrigin.y + frameSize.height
    ) continue
    const area = frameSize.width * frameSize.height
    if (area < matchArea) {
      match = frame
      matchArea = area
    }
  }
  return match
}

function withCanvasParent(node: WorkflowFlowNode, parentId: string | undefined, position: { x: number; y: number }): WorkflowFlowNode {
  return {
    ...node,
    parentId,
    position,
    extent: undefined,
    data: {
      ...node.data,
      settings: {
        ...(node.data.settings ?? {}),
        canvas_parent_id: parentId ?? null,
      },
    },
  }
}

function applyFrameMembership(nodes: WorkflowFlowNode[], draggedId: string) {
  const node = nodes.find((current) => current.id === draggedId)
  if (!node || isCanvasFrameNode(node.data)) return nodes
  const currentParent = node.parentId ? nodes.find((current) => current.id === node.parentId) : null
  if (currentParent && isFrameLocked(currentParent.data.settings)) return nodes
  const target = findContainingFrame(nodes, draggedId)
  const absolute = getFlowNodeAbsolutePosition(nodes, node)
  if (!target) {
    if (!node.parentId) return nodes
    return nodes.map((current) => current.id === draggedId ? withCanvasParent(current, undefined, absolute) : current)
  }
  if (node.parentId === target.id) return nodes
  const parentOrigin = getFlowNodeAbsolutePosition(nodes, target)
  return nodes.map((current) => current.id === draggedId
    ? withCanvasParent(current, target.id, {
      x: absolute.x - parentOrigin.x,
      y: absolute.y - parentOrigin.y,
    })
    : current)
}

function applyParentFrameLockState(nodes: WorkflowFlowNode[]) {
  const lockedFrames = new Set(
    nodes
      .filter((node) => isCanvasFrameNode(node.data) && isFrameLocked(node.data.settings))
      .map((node) => node.id),
  )
  let changed = false
  const next = nodes.map((node) => {
    const parentId = node.parentId ?? getCanvasParentId(node.data.settings)
    const childLocked = Boolean(parentId && lockedFrames.has(parentId))
    const selfLocked = isCanvasFrameNode(node.data) && isFrameLocked(node.data.settings)
    const nextDraggable = !node.data.readOnly && !childLocked && !selfLocked
    const nextClassName = nextDraggable ? '!overflow-visible' : '!overflow-visible nodrag'
    if (
      node.draggable === nextDraggable
      && node.data.frameChildLocked === childLocked
      && node.parentId === parentId
      && node.className === nextClassName
    ) {
      return node
    }
    changed = true
    return {
      ...node,
      parentId,
      draggable: nextDraggable,
      className: nextClassName,
      data: {
        ...node.data,
        frameChildLocked: childLocked,
      },
    }
  })
  return changed ? next : nodes
}

function detachNodesFromDeletedParents(nodes: WorkflowFlowNode[], deletedIds: Set<string>) {
  return nodes.map((node) => {
    if (!node.parentId || !deletedIds.has(node.parentId)) return node
    return withCanvasParent(node, undefined, getFlowNodeAbsolutePosition(nodes, node))
  })
}

function removeCanvasElements(
  nodes: WorkflowFlowNode[],
  edges: WorkflowFlowEdge[],
  deletedNodeIds: Set<string>,
  deletedEdgeIds: Set<string>,
) {
  const detached = detachNodesFromDeletedParents(nodes, deletedNodeIds)
    .filter((node) => !deletedNodeIds.has(node.id))
  const nextNodes = orderCanvasNodes(applyParentFrameLockState(detached))
  const nextEdges = edges.filter((edge) =>
    !deletedEdgeIds.has(edge.id)
    && !deletedNodeIds.has(edge.source)
    && !deletedNodeIds.has(edge.target)
  )
  return { nodes: nextNodes, edges: nextEdges }
}

function orderCanvasNodes(nodes: WorkflowFlowNode[]) {
  const sorted = [...nodes].sort((left, right) => {
    const leftRank = isCanvasFrameNode(left.data) ? 0 : 1
    const rightRank = isCanvasFrameNode(right.data) ? 0 : 1
    return leftRank - rightRank
  })
  const unchanged = sorted.every((node, index) => node === nodes[index])
  return unchanged ? nodes : sorted
}

function isCatalogNodeVisibleInCanvas(node: WorkflowNodeCatalogItem) {
  return node.ui_visibility === 'public'
    && node.status === 'active'
    && !node.disabled
    && !node.maintenance
}

function isCatalogNodeVisibleInCanvasPalette(node: WorkflowNodeCatalogItem) {
  if (!isCatalogNodeVisibleInCanvas(node)) return false
  const runtime = node.runtime_requirement ?? {}
  const compatibility = typeof runtime.compatibility === 'string' ? runtime.compatibility : ''
  const executionMode = typeof runtime.execution_mode === 'string' ? runtime.execution_mode : ''
  const typeName = catalogNodeTypeName(node.node_type)
  if (typeName === 'subtitle_translate') return false
  if (compatibility === 'tool_agent_only') return false
  if (executionMode === 'server_composite') return false
  return true
}

function catalogItemToLibraryNode(node: WorkflowNodeCatalogItem): LibraryNode {
  const kind = catalogNodeKind(node)
  const nodeType = node.node_type
  const defaults = catalogDefaultSettings(node)
  const settings = {
    ...defaultNodeSettings(kind),
    node_type: nodeType,
    __catalog_schema_hash: node.schema_hash,
    __catalog_pricing_hash: cleanCatalogText(node.pricing_metadata.pricing_config_hash) ?? null,
    __catalog_input_schema: node.input_schema,
    __catalog_input_classification: node.input_classification,
    __catalog_form_contract: node.form_contract,
    ...defaults,
    ...(catalogNodeTypeName(nodeType) === 'avatar_generate' ? { task: 'digital_human' } : {}),
  }
  const draft = { kind, settings }
  return {
    kind,
    category: catalogNodeCategory(node, kind),
    title: catalogPickerTitle(nodeType),
    subtitle: catalogNodeSubtitle(node),
    provider: catalogNodeProvider(node),
    description: node.description || getWorkflowNodeDescription(nodeType),
    nodeType,
    cost: catalogNodeTypeName(nodeType) === 'upload' || catalogNodeTypeName(nodeType) === 'review_gate' || catalogNodeTypeName(nodeType) === 'map'
      ? '0c'
      : catalogNodeCostLabel(node),
    settings,
    inputPorts: getFlowNodePorts(draft, 'input') ?? catalogPortsFromSchema(node.input_schema, 'input', nodeType),
    outputPorts: getFlowNodePorts(draft, 'output') ?? catalogPortsFromSchema(node.output_schema, 'output', nodeType),
    catalogItem: node,
  }
}

function catalogPickerTitle(nodeType: string) {
  const typeName = catalogNodeTypeName(nodeType)
  if (typeName === 'image_generate') return 'library.imageGeneratorTitle'
  if (typeName === 'video_generate') return 'library.videoGeneratorTitle'
  if (typeName === 'speech_generate') return 'library.voiceGeneratorTitle'
  if (typeName === 'prompt_generate') return 'library.llmAssistantTitle'
  return getWorkflowNodeTitle(nodeType)
}

function catalogNodeKind(node: WorkflowNodeCatalogItem): WorkflowDefinitionNode['kind'] {
  const typeName = catalogNodeTypeName(node.node_type)
  if (typeName === 'map' || typeName === 'review_gate') return 'logic'
  const normalized = [
    node.node_type,
    node.capability,
    node.node_class,
    node.artifact_output_type,
  ].join(' ').toLocaleLowerCase('en-US')

  if (normalized.includes('review') || normalized.includes('gate') || normalized.includes('logic')) return 'logic'
  if (normalized.includes('upload') || normalized.includes('publish')) return 'publish'
  if (normalized.includes('image')) return 'image'
  if (normalized.includes('video') || normalized.includes('render')) return 'render'
  if (normalized.includes('analytics') || normalized.includes('metric') || normalized.includes('viral') || normalized.includes('signal')) return 'analytics'
  if (normalized.includes('prompt') || normalized.includes('text') || normalized.includes('llm')) return 'ai'
  return 'provider'
}

function catalogNodeCategory(node: WorkflowNodeCatalogItem, kind: WorkflowDefinitionNode['kind']): LibraryNodeCategory {
  if (kind === 'logic') return 'Logic & Utility'
  if (kind === 'render') return 'Video'
  if (kind === 'publish') return 'Publishing'
  if (kind === 'analytics') return 'Monitoring'
  return 'Generation'
}

function catalogNodeSubtitle(node: WorkflowNodeCatalogItem) {
  const capability = cleanCatalogText(node.capability)
  if (capability) return capability.replace(/[._-]+/g, ' ')
  return getWorkflowNodeSubtitle(node.node_type)
}

function catalogNodeProvider(node: WorkflowNodeCatalogItem) {
  const provider = cleanCatalogText(node.provider_requirement.provider)
  if (provider) return publicProviderDisplayValue(provider)
  const defaultModel = cleanCatalogText(node.provider_requirement.model_id_default)
  if (defaultModel) return publicProviderDisplayValue(defaultModel)
  return getWorkflowNodeProvider(node.node_type)
}

function catalogNodeCostLabel(node: WorkflowNodeCatalogItem) {
  const estimate = readCatalogNumber(node.cost_estimate.estimated_credits)
    ?? readCatalogNumber(readWorkflowRecord(node.pricing_metadata.display_estimate).estimated_credits)
  if (estimate === null) return '0c'
  return `${formatWorkflowCredits(estimate)}c`
}

function catalogDefaultSettings(node: WorkflowNodeCatalogItem) {
  const defaults: Record<string, unknown> = {}
  Object.entries(node.input_schema).forEach(([key, port]) => {
    const settingKey = normalizePortName(port.name || key)
    if (isCatalogDefaultLeftUnset(node.node_type, settingKey)) return
    if (port.default !== undefined && port.default !== null) {
      defaults[settingKey] = port.default
    }
  })
  return defaults
}

function catalogPortsFromSchema(
  schema: Record<string, WorkflowNodeCatalogPort>,
  direction: 'input' | 'output',
  nodeType = '',
): WorkflowNodePort[] {
  const normalizedNodeType = nodeType.toLowerCase()
  const researchPortNames = direction === 'input'
    ? new Set(['prompt', 'target'])
    : new Set(['research', 'report_markdown', 'evidence'])
  const entries = Object.entries(schema).filter(([key, port]) => {
    if (!normalizedNodeType.startsWith('research_agent')) return true
    return researchPortNames.has(normalizePortName(port.name || key))
  })
  return entries.map(([key, port]) => {
    const id = normalizePortName(port.name || key)
    return {
      id,
      label: humanizePortLabel(port.name || key),
      type: catalogPortType(port.type, id),
      required: direction === 'input' ? port.required : undefined,
    }
  })
}

function catalogPortType(value: unknown, fallbackName: string): WorkflowNodePortType {
  const normalized = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : ''
  if (isWorkflowPortType(normalized)) return normalized
  return inferPortType(fallbackName)
}

function isWorkflowPortType(value: string): value is WorkflowNodePortType {
  return [
    'string',
    'integer',
    'float',
    'boolean',
    'video',
    'audio',
    'image',
    'transcript',
    'segments',
    'timeline',
    'dict',
    'list',
    'any',
  ].includes(value)
}

function cleanCatalogText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readCatalogNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readDraggedLibraryNode(dataTransfer: DataTransfer, nodes: LibraryNode[]): LibraryNode | null {
  const rawItem = dataTransfer.getData('application/youtorch-node')
  if (rawItem) {
    try {
      const parsed = JSON.parse(rawItem) as LibraryNode
      const parsedNodeType = getLibraryNodeFavoriteNodeType(parsed)
      const match = nodes.find((node) => {
        const nodeType = getLibraryNodeFavoriteNodeType(node)
        if (parsedNodeType && nodeType) return parsedNodeType === nodeType
        return node.kind === parsed.kind && node.title === parsed.title
      })
      if (match) return match
    } catch {
      // Fall through to the legacy kind-only payload.
    }
  }

  const kind = dataTransfer.getData('application/youtorch-node-kind')
  return nodes.find((node) => node.kind === kind) ?? null
}


function isUtilityLibraryNode(node: LibraryNode) {
  return isFlowPickerUtilityItem(node)
}

function getLibraryNodeFavoriteNodeType(node: LibraryNode) {
  if (isUtilityLibraryNode(node)) return null
  if (node.nodeType) return node.nodeType
  const explicit = String(node.settings?.node_type ?? node.settings?.workflow_node_type ?? '').trim()
  if (explicit) return explicit
  if (node.kind === 'image') return 'image_generate@1'
  return null
}

function pickerConnectionFromPending(connection?: PendingNodeConnection) {
  if (!connection) return undefined
  if (connection.handleType === 'target') {
    return {
      targetPortType: connection.portType,
      targetNodeType: connection.nodeType,
      targetPortId: connection.port,
    }
  }
  return { sourcePortType: connection.portType }
}

function getBestTargetInputPort(
  inputPorts: WorkflowNodePort[],
  sourcePortType: WorkflowNodePortType | undefined,
  targetNodeType?: string,
) {
  const connectable = inputPorts.filter((port) => !shouldHideCatalogPortAsWire(port.id))
  const ports = connectable.length > 0 ? connectable : inputPorts
  if (ports.length === 0 || !sourcePortType) return null
  return ports.find((port) => areFlowPortTypesCompatible(sourcePortType, port.type, {
    targetNodeType,
    targetPortId: port.id,
  })) ?? null
}

function getBestSourceOutputPort(
  outputPorts: WorkflowNodePort[],
  targetPortType: WorkflowNodePortType | undefined,
  targetNodeType?: string,
  targetPortId?: string,
) {
  if (outputPorts.length === 0 || !targetPortType) return null
  return outputPorts.find((port) => {
    if (!port.type) return false
    return areFlowPortTypesCompatible(port.type, targetPortType, {
      targetNodeType,
      targetPortId,
    })
  }) ?? null
}

function edgeForPendingNodeConnection(
  connection: PendingNodeConnection,
  nextNode: {
    id: string
    inputPorts: WorkflowNodePort[]
    outputPorts: WorkflowNodePort[]
    nodeType?: string
  },
  edges: WorkflowFlowEdge[],
): WorkflowFlowEdge[] {
  if (connection.handleType === 'target') {
    const sourcePort = getBestSourceOutputPort(
      nextNode.outputPorts,
      connection.portType,
      connection.nodeType,
      connection.port,
    )
    if (!sourcePort) return edges
    return addEdge(
      {
        id: `${nextNode.id}-${sourcePort.id}-${connection.nodeId}-${connection.port}-${Date.now()}`,
        source: nextNode.id,
        target: connection.nodeId,
        sourceHandle: toPortHandleId(sourcePort.id, 'output'),
        targetHandle: toPortHandleId(connection.port, 'input'),
        ...defaultEdgeOptions,
      },
      edges,
    )
  }

  const targetInput = getBestTargetInputPort(nextNode.inputPorts, connection.portType, nextNode.nodeType)?.id
  if (!targetInput) return edges
  return addEdge(
    {
      id: `${connection.nodeId}-${connection.port}-${nextNode.id}-${targetInput}-${Date.now()}`,
      source: connection.nodeId,
      target: nextNode.id,
      sourceHandle: toPortHandleId(connection.port, 'output'),
      targetHandle: toPortHandleId(targetInput, 'input'),
      ...defaultEdgeOptions,
    },
    edges,
  )
}

function getClientPointFromEvent(event: MouseEvent | TouchEvent) {
  if ('changedTouches' in event && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0]
    return { x: touch.clientX, y: touch.clientY }
  }

  if ('touches' in event && event.touches.length > 0) {
    const touch = event.touches[0]
    return { x: touch.clientX, y: touch.clientY }
  }

  return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
}

function getImageTask(settings: WorkflowCanvasNodeData['settings']) {
  const rawValue = String(settings?.image_task ?? settings?.task ?? 'text_to_image')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLocaleLowerCase('en-US')
  const match = imageTaskOptions.find((option) => option.value === rawValue || option.legacyLabel.replace(/[\s-]+/g, '_').toLocaleLowerCase('en-US') === rawValue)
  return match?.value ?? 'text_to_image'
}

function imageTaskLabel(task: string) {
  return imageTaskOptions.find((option) => option.value === task)?.legacyLabel ?? 'Text to image'
}

function getRenderTask(settings: WorkflowCanvasNodeData['settings']) {
  const rawValue = String(settings?.render_task ?? settings?.task ?? 'compose_video')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLocaleLowerCase('en-US')
  const match = renderTaskOptions.find((option) => option.value === rawValue || option.legacyLabel.replace(/[\s-]+/g, '_').toLocaleLowerCase('en-US') === rawValue)
  return match?.value ?? 'compose_video'
}

function renderTaskLabel(task: string) {
  return renderTaskOptions.find((option) => option.value === task)?.legacyLabel ?? 'Compose video'
}

function getHelperInputType(settings: WorkflowCanvasNodeData['settings']) {
  const value = String(settings?.helper_input ?? 'prompt').toLocaleLowerCase('en-US')
  if (value.includes('image')) return 'image'
  if (value.includes('video')) return 'video'
  if (value.includes('audio') || value.includes('voice') || value.includes('speech')) return 'audio'
  return 'prompt'
}

function getAiNodeType(settings: WorkflowCanvasNodeData['settings']) {
  return String(settings?.node_type ?? settings?.workflow_node_type ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
}

function isPromptGenerateSettings(settings: WorkflowCanvasNodeData['settings']) {
  return getAiNodeType(settings) === 'prompt_generate@1'
}

function isPromptEnhanceSettings(settings: WorkflowCanvasNodeData['settings']) {
  return getAiNodeType(settings) === 'prompt_enhance@1'
}

function getPromptModelId(settings: WorkflowCanvasNodeData['settings']) {
  const value = String(settings?.model_id ?? 'auto-llm').trim()
  return value || 'auto-llm'
}

function isReviewGateSettings(settings: WorkflowCanvasNodeData['settings']) {
  const nodeType = String(settings?.node_type ?? settings?.workflow_node_type ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
  return nodeType === 'review_gate@1' || settings?.review_gate === true
}

const reviewModeOptions = ['Approve / Reject', 'Approve / Reject / Request changes'] as const

function getReviewMode(settings: WorkflowCanvasNodeData['settings']) {
  const rawValue = String(settings?.review_mode ?? 'Approve / Reject')
    .trim()
    .toLocaleLowerCase('en-US')
  if (rawValue.replace(/[\s/_-]+/g, '_').includes('request_changes')) {
    return 'Approve / Reject / Request changes'
  }
  return reviewModeOptions.find((option) => option.toLocaleLowerCase('en-US') === rawValue)
    ?? 'Approve / Reject'
}

function defaultNodeSettings(kind: WorkflowDefinitionNode['kind']) {
  if (kind === 'input') {
    return {
      helper_input: 'prompt',
      helper_value: '',
    }
  }
  if (kind === 'image') {
    return {
      image_task: 'text_to_image',
      image_count: 1,
    }
  }
  if (kind === 'render') {
    return {
      render_task: 'compose_video',
    }
  }
  if (kind === 'note') {
    return {
      helper_value: '## Workflow guide',
      content_format: 'markdown',
      guide_width: defaultGuideNodeSize.width,
      guide_height: defaultGuideNodeSize.height,
    }
  }
  return {}
}

function copyInboundPreviewOntoReviewNode(
  nodes: WorkflowFlowNode[],
  sourceId: string | null | undefined,
  targetId: string | null | undefined,
): WorkflowFlowNode[] {
  if (!sourceId || !targetId) return nodes
  const source = nodes.find((node) => node.id === sourceId)
  const target = nodes.find((node) => node.id === targetId)
  if (!source || !target) return nodes
  if (catalogNodeTypeName(String(target.data.settings?.node_type ?? target.data.settings?.workflow_node_type ?? '')) !== 'review_gate'
    && !isReviewGateSettings(target.data.settings)) {
    return nodes
  }
  const preview = getReviewInboundPreview(source.data.settings)
    ?? getReviewInboundPreview({
      media_preview_url: String(source.data.settings?.helper_preview_url ?? ''),
      helper_preview_url: String(source.data.settings?.helper_preview_url ?? ''),
      image_url: String(source.data.settings?.helper_value ?? source.data.settings?.image_url ?? ''),
      cdn_url: String(source.data.settings?.cdn_url ?? ''),
      video_url: String(source.data.settings?.video_url ?? ''),
    })
  if (!preview) return nodes
  return nodes.map((node) => (
    node.id === targetId
      ? {
        ...node,
        data: {
          ...node.data,
          settings: {
            ...(node.data.settings ?? {}),
            media_preview_url: preview.url,
            preview_url: preview.url,
          },
        },
      }
      : node
  ))
}

function applyDerivedNodePorts(data: WorkflowCanvasNodeData): WorkflowCanvasNodeData {
  const profileInputs = getFlowNodePorts(data, 'input')
  const profileOutputs = getFlowNodePorts(data, 'output')
  if (profileInputs || profileOutputs) {
    const inputPorts = profileInputs ?? []
    const outputPorts = profileOutputs ?? []
    return {
      ...data,
      inputs: inputPorts.map((port) => port.id),
      outputs: outputPorts.map((port) => port.id),
      inputPorts,
      outputPorts,
    }
  }

  if (data.kind === 'input') {
    const settings = {
      ...defaultNodeSettings('input'),
      ...(data.settings ?? {}),
    }
    const outputPorts = defaultNodePorts('input', 'output', settings)
    return {
      ...data,
      settings,
      inputs: [],
      outputs: outputPorts.map((port) => port.id),
      inputPorts: [],
      outputPorts,
    }
  }

  if (data.kind === 'note') {
    return {
      ...data,
      settings: {
        ...defaultNodeSettings('note'),
        ...(data.settings ?? {}),
      },
      inputs: [],
      outputs: [],
      inputPorts: [],
      outputPorts: [],
    }
  }

  if (Object.keys(catalogInputSchemaFromSettings(data.settings)).length > 0) {
    return data
  }

  if (data.kind === 'logic' && isReviewGateSettings(data.settings)) {
    const settings = {
      ...(data.settings ?? {}),
      review_mode: getReviewMode(data.settings),
    }
    const inputPorts = defaultNodePorts('logic', 'input', settings)
    const outputPorts = defaultNodePorts('logic', 'output', settings)
    return {
      ...data,
      settings,
      inputs: inputPorts.map((port) => port.id),
      outputs: outputPorts.map((port) => port.id),
      inputPorts,
      outputPorts,
    }
  }

  if (data.kind !== 'image') return data
  const settings = {
    ...defaultNodeSettings('image'),
    ...(data.settings ?? {}),
  }
  const inputPorts = imageInputPortsForTask(getImageTask(settings))
  const outputPorts = defaultNodePorts('image', 'output', settings)

  return {
    ...data,
    settings,
    inputs: inputPorts.map((port) => port.id),
    outputs: outputPorts.map((port) => port.id),
    inputPorts,
    outputPorts,
  }
}

function imageInputPortsForTask(task: string): WorkflowNodePort[] {
  const promptPort: WorkflowNodePort = { id: 'prompt', label: 'Prompt', type: 'string', required: false }
  if (task === 'image_to_image') {
    return [promptPort, { id: 'image_urls', label: 'Image', type: 'image' }]
  }
  if (task === 'reference_image') {
    return [promptPort, { id: 'reference_image_urls', label: 'Reference', type: 'image' }]
  }
  if (task === 'first_last_frame') {
    return [
      promptPort,
      { id: 'first_frame_url', label: 'First frame', type: 'image' },
      { id: 'last_frame_url', label: 'Last frame', type: 'image' },
    ]
  }
  return [promptPort]
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function humanizePortLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function getNodePorts(data: WorkflowCanvasNodeData, direction: 'input' | 'output'): WorkflowNodePort[] {
  if (data.kind === 'input' || data.kind === 'note') return normalizePorts(defaultNodePorts(data.kind, direction, data.settings), direction)
  if (data.kind === 'image') return normalizePorts(defaultNodePorts('image', direction, data.settings), direction)
  const profilePorts = getFlowNodePorts(data, direction)
  if (profilePorts) return normalizePorts(profilePorts, direction)
  const explicitPorts = direction === 'input' ? data.inputPorts : data.outputPorts
  if (Array.isArray(explicitPorts)) return normalizePorts(explicitPorts, direction)
  const names = direction === 'input' ? data.inputs : data.outputs
  return normalizePorts((names?.length ? names : [direction === 'input' ? 'manual' : 'result']), direction)
}

const emptyConnectedPortIds: ReadonlySet<string> = new Set()

function getConnectedWorkflowPortIds(
  connections: ReadonlyArray<Connection>,
  nodeId: string,
  direction: 'input' | 'output',
) {
  const connected = new Set<string>()
  for (const connection of connections) {
    const handle = direction === 'input'
      ? connection.target === nodeId ? connection.targetHandle : null
      : connection.source === nodeId ? connection.sourceHandle : null
    const portId = getPortIdFromHandle(handle, direction)
    if (portId) connected.add(portId)
  }
  return connected
}

function getConnectableNodePorts(
  data: WorkflowCanvasNodeData,
  direction: 'input' | 'output',
  connectedPortIds: ReadonlySet<string> = emptyConnectedPortIds,
) {
  const ports = getNodePorts(data, direction)
  if (direction === 'output') return ports

  return ports.filter((port) => {
    if (connectedPortIds.has(port.id)) return true
    const classification = catalogInputClassificationForPort(data.settings, port.id)
    return typeof classification !== 'object' || classification === null || classification.accepts_wire !== false
  })
}

function getVisibleNodePorts(
  data: WorkflowCanvasNodeData,
  direction: 'input' | 'output',
  expanded: boolean,
  connectedPortIds: ReadonlySet<string> = emptyConnectedPortIds,
) {
  const ports = getConnectableNodePorts(data, direction, connectedPortIds)
  if (hasFlowNodePortProfile(data)) return ports
  if (ports.length <= 1) return ports

  if (direction === 'output') {
    const visible = new Set([ports[0]?.id, ...connectedPortIds].filter(Boolean))
    return ports.filter((port) => visible.has(port.id))
  }

  if (Object.keys(catalogInputSchemaFromSettings(data.settings)).length === 0) return ports
  const primary = ports.filter((port) => isLikelyWorkflowDataPort(data, port)).slice(0, 3)
  const visible = new Set([...(primary.length > 0 ? primary : ports.slice(0, 1)).map((port) => port.id), ...connectedPortIds])
  return ports.filter((port) => visible.has(port.id))
}

function isLikelyWorkflowDataPort(data: WorkflowCanvasNodeData, port: WorkflowNodePort) {
  const id = normalizePortName(port.id)
  const standardFields = catalogStandardFieldNamesFromSettings(data.settings)
  if (standardFields.has(id) && !['prompt', 'instruction', 'text'].includes(id)) return false

  const classification = catalogInputClassificationForPort(data.settings, id)
  if (typeof classification === 'object' && classification !== null) {
    if (classification.accepts_wire === false) return false
    if (classification.accepts_config === false && classification.accepts_wire === true) return true
    if (classification.kind === 'wire_input') return true
  }

  if (['image', 'video', 'audio', 'transcript', 'segments'].includes(port.type ?? 'any')) {
    return !shouldHideCatalogPortAsWire(id)
  }
  return [
    'input',
    'prompt',
    'text',
    'query',
    'context',
    'urls',
    'items',
  ].includes(id)
}

function normalizePorts(
  portsOrNames: Array<WorkflowNodePort | string>,
  direction: 'input' | 'output',
): WorkflowNodePort[] {
  const fallback = direction === 'input' ? 'input' : 'output'
  const seen = new Set<string>()

  return portsOrNames
    .map((value, index) => {
      const rawPort = typeof value === 'string'
        ? { id: value, label: humanizePortLabel(value), type: inferPortType(value) }
        : value
      const label = cleanPortLabel(rawPort.label) || cleanPortLabel(rawPort.id) || `${fallback} ${index + 1}`
      const baseId = normalizePortName(rawPort.id || label || fallback)
      const id = uniquePortId(baseId, seen)

      return {
        id,
        label,
        type: rawPort.type ?? (direction === 'input' ? inferPortType(label) : 'any'),
        required: rawPort.required,
      }
    })
    .filter((port) => port.id)
}

function dispatchNodeFieldsChange(
  nodeId: string,
  patch: WorkflowNodeFieldsChangeDetail['patch'],
) {
  window.dispatchEvent(new CustomEvent<WorkflowNodeFieldsChangeDetail>(workflowNodeFieldsChangeEvent, {
    detail: { nodeId, patch },
  }))
}

function dispatchNodeAction(nodeId: string, action: WorkflowNodeActionDetail['action']) {
  window.dispatchEvent(new CustomEvent<WorkflowNodeActionDetail>(workflowNodeActionEvent, {
    detail: { nodeId, action },
  }))
}

function storageSelectionSettingsForNode(
  data: WorkflowCanvasNodeData,
  selection: StorageMediaSelection,
  settingKey?: string,
) {
  const helperType = getHelperInputType(data.settings)
  if (data.kind === 'input' && helperType !== 'prompt') {
    return {
      helper_storage_object_id: selection.storageObjectId,
      helper_file_name: selection.name,
      helper_preview_url: selection.previewUrl ?? '',
      helper_value: selection.previewUrl || selection.storageObjectId,
    }
  }
  const typeKey = flowNodeTypeKey(data.settings)
  if (settingKey === 'source_video' || settingKey === 'audio' || settingKey === 'reference_storage_object_id') {
    return {
      [settingKey]: selection.storageObjectId,
      media_file_name: selection.name,
      media_preview_url: selection.previewUrl ?? undefined,
    }
  }
  if (typeKey === 'voice_clone' && (!settingKey || settingKey === 'reference_storage_object_id')) {
    return {
      reference_storage_object_id: selection.storageObjectId,
      media_file_name: selection.name,
      media_preview_url: selection.previewUrl ?? undefined,
    }
  }
  if (
    settingKey === 'source_image'
    || settingKey === 'image_url'
    || typeKey === 'angle'
    || typeKey === 'prompt_generate'
    || (typeKey === 'avatar_generate' && settingKey !== 'source_video' && settingKey !== 'audio')
  ) {
    return {
      storage_object_id: selection.storageObjectId,
      source_image: selection.storageObjectId,
      image_url: selection.previewUrl || selection.storageObjectId,
      media_file_name: selection.name,
      media_preview_url: selection.previewUrl ?? undefined,
    }
  }
  return {
    storage_object_id: selection.storageObjectId,
    media_file_name: selection.name,
    media_preview_url: selection.previewUrl ?? undefined,
  }
}

function toPortHandleId(portId: string, direction: 'input' | 'output') {
  return `${direction === 'input' ? inputHandlePrefix : outputHandlePrefix}${normalizePortName(portId)}`
}

function getPortIdFromHandle(handle: string | null | undefined, direction: 'input' | 'output') {
  const prefix = direction === 'input' ? inputHandlePrefix : outputHandlePrefix
  if (!handle?.startsWith(prefix)) return null
  return normalizePortName(handle.slice(prefix.length))
}

function getValidWorkflowConnection(connection: {
  source?: string | null
  target?: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}) {
  if (!connection.source || !connection.target || connection.source === connection.target) return null

  const sourcePort = getPortIdFromHandle(connection.sourceHandle, 'output')
  const targetInput = getPortIdFromHandle(connection.targetHandle, 'input')
  if (sourcePort && targetInput) {
    return {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      sourcePort,
      targetInput,
    }
  }

  const reversedTargetInput = getPortIdFromHandle(connection.sourceHandle, 'input')
  const reversedSourcePort = getPortIdFromHandle(connection.targetHandle, 'output')
  if (reversedTargetInput && reversedSourcePort) {
    return {
      source: connection.target,
      target: connection.source,
      sourceHandle: connection.targetHandle,
      targetHandle: connection.sourceHandle,
      sourcePort: reversedSourcePort,
      targetInput: reversedTargetInput,
    }
  }

  return null
}

function isWorkflowEdgePersistable(edge: WorkflowFlowEdge) {
  return Boolean(getValidWorkflowConnection(edge))
}

function uniquePortId(baseId: string, seen: Set<string>) {
  const base = baseId || 'port'
  let candidate = base
  let suffix = 2
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  seen.add(candidate)
  return candidate
}

function cleanPortLabel(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function normalizePortName(value: string) {
  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-US')

  return normalized || 'port'
}

function inferPortType(value: string): WorkflowNodePortType {
  const normalized = value.toLocaleLowerCase('en-US')
  if (normalized.includes('image') || normalized.includes('thumbnail')) return 'image'
  if (normalized.includes('video') || normalized.includes('mp4')) return 'video'
  if (normalized.includes('audio')) return 'audio'
  if (normalized.includes('count') || normalized.includes('width') || normalized.includes('height')) return 'integer'
  if (normalized.includes('score') || normalized.includes('ratio') || normalized.includes('temperature')) return 'float'
  if (normalized.includes('enabled') || normalized.includes('flag')) return 'boolean'
  if (normalized.includes('segments')) return 'segments'
  if (normalized.includes('transcript')) return 'transcript'
  if (normalized.includes('metadata') || normalized.includes('settings')) return 'dict'
  if (normalized.includes('list') || normalized.includes('items') || normalized.includes('variants')) return 'list'
  return 'string'
}

function defaultNodePorts(
  kind: WorkflowDefinitionNode['kind'],
  direction: 'input' | 'output',
  settings: WorkflowCanvasNodeData['settings'] = {},
): WorkflowNodePort[] {
  const profilePorts = getFlowNodePorts({ kind, settings }, direction)
  if (profilePorts) return profilePorts
  if (kind === 'input') {
    if (direction === 'input') return []
    const helperType = getHelperInputType(settings)
    if (helperType === 'image') return [{ id: 'image', label: 'Image', type: 'image' }]
    if (helperType === 'video') return [{ id: 'video', label: 'Video', type: 'video' }]
    if (helperType === 'audio') return [{ id: 'audio', label: 'Audio', type: 'audio' }]
    return [{ id: 'prompt', label: 'Prompt', type: 'string' }]
  }

  if (kind === 'note') return []

  if (kind === 'trigger') {
    return direction === 'input'
      ? []
      : [
          { id: 'video', label: 'Video', type: 'video' },
          { id: 'text', label: 'Text', type: 'string' },
        ]
  }

  if (kind === 'ai') {
    if (isPromptGenerateSettings(settings)) {
      return direction === 'input'
        ? [{ id: 'image_url', label: 'Image', type: 'image', required: false }]
        : [{ id: 'prompt', label: 'Prompt', type: 'string' }]
    }
    if (isPromptEnhanceSettings(settings)) {
      return direction === 'input'
        ? [{ id: 'prompt', label: 'Prompt', type: 'string' }]
        : [{ id: 'prompt', label: 'Prompt', type: 'string' }]
    }
    return direction === 'input'
      ? [
          { id: 'prompt', label: 'Prompt', type: 'string' },
          { id: 'model_id', label: 'Model', type: 'string', required: false },
        ]
      : [
          { id: 'text', label: 'Text', type: 'string' },
          { id: 'usage', label: 'Usage', type: 'dict' },
        ]
  }

  if (kind === 'image') {
    return direction === 'input'
      ? imageInputPortsForTask(getImageTask(settings))
      : [{ id: 'image_url', label: 'Image', type: 'image' }]
  }

  if (kind === 'render') {
    const renderTask = getRenderTask(settings)
    if (direction === 'output') {
      return [
        { id: 'video_url', label: 'Video URL', type: 'video' },
        { id: 'duration', label: 'Duration', type: 'float' },
      ]
    }
    if (renderTask === 'image_to_video') {
      return [
        { id: 'image_url', label: 'Image', type: 'image' },
        { id: 'prompt', label: 'Prompt', type: 'string', required: false },
      ]
    }
    if (renderTask === 'text_to_video') {
      return [{ id: 'prompt', label: 'Prompt', type: 'string' }]
    }
    return [
      { id: 'clips', label: 'Clips', type: 'list', required: false },
      { id: 'compositionJson', label: 'Composition JSON', type: 'dict', required: false },
    ]
  }

  if (kind === 'publish') {
    return direction === 'input'
      ? [
          { id: 'files', label: 'Files', type: 'list' },
          { id: 'storage_types', label: 'Storage Types', type: 'list', required: false },
        ]
      : [{ id: 'uploaded', label: 'Uploaded', type: 'list' }]
  }

  if (kind === 'logic') {
    if (settings?.helper_preview === true) {
      return direction === 'input'
        ? [{ id: 'media', label: 'Media', type: 'any' }]
        : []
    }
    if (isReviewGateSettings(settings)) {
      return direction === 'input'
        ? [{ id: 'input', label: 'Input', type: 'any', required: false }]
        : [{ id: 'approved', label: 'Approved', type: 'any' }]
    }
    return direction === 'input'
      ? [{ id: 'input', label: 'Input', type: 'any' }]
      : [{ id: 'decision', label: 'Decision', type: 'dict' }]
  }

  return direction === 'input'
    ? [{ id: 'input', label: 'Input', type: 'any' }]
    : [{ id: 'output', label: 'Output', type: 'any' }]
}

function libraryNodeFromStorageSelection(
  selection: StorageMediaSelection,
  t: WorkflowTranslator,
  libraryNodes: LibraryNode[],
): LibraryNode | null {
  const helperType = helperInputFromMediaSelection(selection)
  const template = libraryNodes.find((node) => getHelperInputType(node.settings) === helperType)
    ?? getLocalLibraryNodes(t).find((node) => getHelperInputType(node.settings) === helperType)
  if (!template) return null
  return {
    ...template,
    pickerHidden: undefined,
    settings: {
      ...(template.settings ?? {}),
      helper_input: helperType,
      helper_value: selection.previewUrl || selection.storageObjectId,
      helper_preview_url: selection.previewUrl ?? '',
      helper_storage_object_id: selection.storageObjectId,
      helper_file_name: selection.name,
    },
  }
}

function helperInputFromMediaSelection(selection: StorageMediaSelection): 'image' | 'video' | 'audio' {
  const mime = (selection.mimeType ?? '').toLowerCase()
  const name = selection.name.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(name)) return 'image'
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return 'audio'
  return 'video'
}

function WorkflowCanvasAssetHost({
  request,
  channelId,
  onClose,
  onSelect,
}: {
  request: AssetPickerRequest
  channelId: string | null
  onClose: () => void
  onSelect: (selection: StorageMediaSelection) => void
}) {
  const queryClient = useQueryClient()
  const uploadInputRef = React.useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = React.useState<{
    fileName: string
    phase: 'preparing' | 'uploading'
    progress: number
  } | null>(null)
  const open = Boolean(request)
  const openStorageDialog = request?.mode === 'assets'
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (request?.mode !== 'upload') return
    const input = uploadInputRef.current
    const unbind = bindFileInputCancel(input, () => onCloseRef.current())
    const frame = window.requestAnimationFrame(() => openFileInput(input))
    return () => {
      unbind()
      window.cancelAnimationFrame(frame)
    }
  }, [request?.mode, request?.targetNodeId])

  const invalidateStorage = React.useCallback(() => {
    if (!channelId) return
    void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', channelId] })
    void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(channelId) })
    void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
  }, [channelId, queryClient])

  const uploadFiles = React.useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !channelId) return
    const mediaKind: StorageMediaKind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'video'
    setUploadState({ fileName: file.name, phase: 'preparing', progress: 0 })
    try {
      const selection = await uploadStorageMedia(channelId, file, mediaKind, undefined, (progress) => {
        setUploadState({ fileName: file.name, phase: 'uploading', progress })
      })
      invalidateStorage()
      onSelect(selection)
    } catch {
      onClose()
    } finally {
      setUploadState(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }, [channelId, invalidateStorage, onClose, onSelect])

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />
      <StorageMediaPickerDialog
        key={`${request?.targetNodeId ?? 'canvas'}:${request?.mediaKind ?? 'all'}`}
        open={openStorageDialog}
        channelId={channelId}
        mediaKind={request?.mediaKind ?? 'all'}
        uploadState={uploadState}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose()
        }}
        onUpload={() => openFileInput(uploadInputRef.current)}
        onSelect={(selection) => {
          onSelect(selection)
        }}
      />
    </>
  )
}

function WorkflowCanvasToolbelt({
  mode,
  onModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAddNode,
  addNodeActive = false,
  onAddFrame,
  onAddText,
  onOpenAssets,
  copy,
}: {
  mode: CanvasInteractionMode
  onModeChange: (mode: CanvasInteractionMode) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onAddNode?: (event: React.MouseEvent<HTMLButtonElement>) => void
  addNodeActive?: boolean
  onAddFrame?: () => void
  onAddText?: () => void
  onOpenAssets?: () => void
  copy: WorkflowCanvasCopy
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-[60] -translate-x-1/2">
      <div className={cn('pointer-events-auto', flowChromeDockClass)}>
        <ToolbeltButton
          label={copy.select}
          active={mode === 'select'}
          onClick={() => onModeChange('select')}
        >
          <MousePointer2 className="h-4 w-4" />
        </ToolbeltButton>
        <ToolbeltButton
          label={copy.pan}
          active={mode === 'pan'}
          onClick={() => onModeChange('pan')}
        >
          <Hand className="h-4 w-4" />
        </ToolbeltButton>
        <ToolbeltDivider />
        <ToolbeltButton label={copy.undo} onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolbeltButton>
        <ToolbeltButton label={copy.redo} onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolbeltButton>
        {onAddFrame && (
          <ToolbeltButton label={copy.addFrame} onClick={onAddFrame}>
            <Crop className="h-4 w-4" />
          </ToolbeltButton>
        )}
        {onAddText && (
          <ToolbeltButton label={copy.addText} onClick={onAddText}>
            <Type className="h-4 w-4" />
          </ToolbeltButton>
        )}
        {onOpenAssets && (
          <ToolbeltButton label={copy.assets} onClick={onOpenAssets}>
            <Folder className="h-4 w-4" />
          </ToolbeltButton>
        )}
        {onAddNode && (
          <>
            <ToolbeltDivider />
            <button
              type="button"
              aria-label={copy.addNode}
              aria-pressed={addNodeActive}
              title={copy.addNode}
              onClick={onAddNode}
              className={cn(
                'flex size-9 items-center justify-center rounded-xl transition-colors',
                addNodeActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/90 text-primary-foreground hover:bg-primary',
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function WorkflowCanvasZoomDock({
  zoomPercent,
  minimapOpen,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleMinimap,
  copy,
}: {
  zoomPercent: number
  minimapOpen: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onToggleMinimap: () => void
  copy: WorkflowCanvasCopy
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[60]">
      <div className={cn('pointer-events-auto', flowChromeDockClass)}>
        <ToolbeltButton label={copy.zoomOut} onClick={onZoomOut}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbeltButton>
        <span className="w-10 text-center text-[11px] font-medium text-muted-foreground">{zoomPercent}%</span>
        <ToolbeltButton label={copy.zoomIn} onClick={onZoomIn}>
          <Plus className="h-3.5 w-3.5" />
        </ToolbeltButton>
        <ToolbeltDivider />
        <ToolbeltButton label={copy.fit} onClick={onFit}>
          <Maximize2 className="h-3.5 w-3.5" />
        </ToolbeltButton>
        <ToolbeltButton label={copy.minimap} active={minimapOpen} onClick={onToggleMinimap}>
          <MapIcon className="h-3.5 w-3.5" />
        </ToolbeltButton>
      </div>
    </div>
  )
}

function WorkflowCanvasAiChat({
  onSubmitPrompt,
  onClose,
  copy,
}: {
  onSubmitPrompt: (prompt: string) => void | Promise<void>
  onClose: () => void
  copy: WorkflowCanvasCopy
}) {
  const [prompt, setPrompt] = React.useState('')
  const [promptStatus, setPromptStatus] = React.useState<AiPromptStatus>('idle')
  const activeRequestRef = React.useRef(0)
  const isLoading = promptStatus === 'loading'
  const isError = promptStatus === 'error'

  const stopWork = () => {
    activeRequestRef.current += 1
    setPromptStatus('idle')
  }

  const submitPrompt = async () => {
    const nextPrompt = prompt.trim()
    if (!nextPrompt || isLoading) return
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId
    setPrompt(nextPrompt)
    setPromptStatus('loading')
    try {
      await onSubmitPrompt(nextPrompt)
      if (activeRequestRef.current !== requestId) return
      setPrompt('')
      setPromptStatus('idle')
      onClose()
    } catch {
      if (activeRequestRef.current !== requestId) return
      setPrompt(nextPrompt)
      setPromptStatus('error')
    }
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded-2xl border border-border bg-popover/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl',
        isLoading && 'workflow-ai-working',
        isError && 'workflow-ai-error',
      )}
    >
      <Sparkles className={cn('ml-2 h-4 w-4 shrink-0 text-primary', isError && 'text-destructive')} />
      <input
        value={prompt}
        disabled={isLoading}
        onChange={(event) => {
          setPrompt(event.target.value)
          if (isError) setPromptStatus('idle')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submitPrompt()
          if (event.key === 'Escape') onClose()
        }}
        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-wait"
        placeholder={isLoading ? copy.aiWorking : copy.aiPrompt}
        autoFocus
      />
      {isLoading ? (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground hover:bg-muted/80"
          onClick={stopWork}
          aria-label={copy.stopAi}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : isError ? (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={() => void submitPrompt()}
          aria-label={copy.retryAi}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => void submitPrompt()}
          aria-label={copy.sendAi}
        >
          <Send className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        className="mr-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onClose}
        aria-label={copy.closeAi}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ToolbeltButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      className={cn(
        'flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ToolbeltDivider() {
  return <span className="mx-1 h-6 w-px bg-border" />
}

function StatusPill({ status }: { status: WorkflowRunStatus }) {
  const styles: Record<WorkflowRunStatus, string> = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/15 text-warning',
    failed: 'bg-destructive/10 text-destructive',
    running: 'bg-info/10 text-info',
    never: 'bg-muted text-muted-foreground',
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium', styles[status])}>
      {status === 'running'
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {status}
    </span>
  )
}

function createCanvasHistorySnapshot(
  nodes: WorkflowFlowNode[],
  edges: WorkflowFlowEdge[],
): CanvasHistorySnapshot {
  return {
    nodes: cloneFlowNodes(nodes),
    edges: cloneFlowEdges(edges),
  }
}

function applyRuntimeNodeState(
  nodes: WorkflowFlowNode[],
  runtimeNodeStatuses: Record<string, WorkflowRunStatus> | undefined,
  runtimeActiveNodeId: string | null | undefined,
) {
  let changed = false
  const nextNodes = nodes.map((node) => {
    const runtimeStatus = runtimeNodeStatuses?.[node.id]
    const isRuntimeActive = runtimeActiveNodeId === node.id
    const runtimeBaseStatus = node.data.runtimeBaseStatus
    const nextStatus = runtimeStatus ?? runtimeBaseStatus ?? node.data.status

    if (!runtimeStatus) {
      if (!runtimeBaseStatus && !node.data.isRuntimeActive && !isRuntimeActive) return node

      const nextData = { ...node.data }
      delete nextData.runtimeBaseStatus
      delete nextData.isRuntimeActive
      changed = true
      return {
        ...node,
        data: {
          ...nextData,
          status: nextStatus,
        },
      }
    }

    const nextRuntimeBaseStatus = runtimeBaseStatus ?? node.data.status
    if (
      node.data.status === runtimeStatus
      && Boolean(node.data.isRuntimeActive) === isRuntimeActive
      && node.data.runtimeBaseStatus === nextRuntimeBaseStatus
    ) return node

    changed = true
    return {
      ...node,
      data: {
        ...node.data,
        status: runtimeStatus,
        isRuntimeActive,
        runtimeBaseStatus: nextRuntimeBaseStatus,
      },
    }
  })

  return changed ? nextNodes : nodes
}

function cloneCanvasSnapshot(snapshot: CanvasHistorySnapshot): CanvasHistorySnapshot {
  return createCanvasHistorySnapshot(snapshot.nodes, snapshot.edges)
}

function cloneFlowNodes(nodes: WorkflowFlowNode[]): WorkflowFlowNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      position: { ...node.data.position },
      settings: { ...(node.data.settings ?? {}) },
      inputs: [...(node.data.inputs ?? [])],
      outputs: [...(node.data.outputs ?? [])],
      inputPorts: clonePorts(node.data.inputPorts),
      outputPorts: clonePorts(node.data.outputPorts),
    },
  }))
}

function cloneFlowEdges(edges: WorkflowFlowEdge[]): WorkflowFlowEdge[] {
  return edges.map((edge) => ({ ...edge }))
}

function clonePorts(ports: WorkflowNodePort[] | undefined) {
  return ports?.map((port) => ({ ...port }))
}

function canvasSnapshotsEqual(left: CanvasHistorySnapshot, right: CanvasHistorySnapshot) {
  return serializeCanvasSnapshot(left) === serializeCanvasSnapshot(right)
}

function serializeCanvasSnapshot(snapshot: CanvasHistorySnapshot) {
  return JSON.stringify({
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      parentId: node.parentId ?? null,
      selected: Boolean(node.selected),
      data: {
        title: node.data.title,
        subtitle: node.data.subtitle,
        kind: node.data.kind,
        provider: node.data.provider,
        description: node.data.description,
        settings: node.data.settings ?? {},
        inputs: node.data.inputs ?? [],
        outputs: node.data.outputs ?? [],
        inputPorts: node.data.inputPorts ?? [],
        outputPorts: node.data.outputPorts ?? [],
      },
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      selected: Boolean(edge.selected),
    })),
  })
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function mapWorkflowNodes(nodes: WorkflowDefinitionNode[], readOnly = false): WorkflowFlowNode[] {
  const mapped = nodes.map((node) => {
    const data = applyDerivedNodePorts({
      ...node,
      settings: {
        ...(node.settings?.helper_frame === true ? {} : defaultNodeSettings(node.kind)),
        ...(node.settings ?? {}),
      },
      inputPorts: normalizePorts(Array.isArray(node.inputPorts) ? node.inputPorts : node.inputs ?? ['manual'], 'input'),
      outputPorts: normalizePorts(Array.isArray(node.outputPorts) ? node.outputPorts : node.outputs ?? ['result'], 'output'),
      accent: nodeAccents[node.kind],
      readOnly,
    })
    const frameLayout = isCanvasFrameNode(data) ? canvasFrameFlowProps(data.settings) : null
    return {
      id: node.id,
      type: 'workflowNode' as const,
      position: node.position,
      parentId: getCanvasParentId(data.settings),
      className: '!overflow-visible',
      ...(frameLayout ?? { zIndex: 1 }),
      data,
    }
  })
  const existingIds = new Set(mapped.map((node) => node.id))
  const withParents = mapped.map((node) => {
    if (!node.parentId || existingIds.has(node.parentId)) return node
    return withCanvasParent(node, undefined, node.position)
  })
  return orderCanvasNodes(applyParentFrameLockState(withParents))
}

function mapFlowNodeToWorkflowNode(node: WorkflowFlowNode): WorkflowDefinitionNode {
  const settings: Record<string, unknown> = {
    ...(node.data.settings ?? {}),
    canvas_parent_id: node.parentId ?? null,
  }
  if (isCanvasFrameNode(node.data)) {
    const measured = clampFrameNodeSize({
      width: numberOrDefault(
        node.width,
        numberOrDefault(readWorkflowRecord(node.style).width, numberOrDefault(settings.frame_width, defaultFrameNodeSize.width)),
      ),
      height: numberOrDefault(
        node.height,
        numberOrDefault(readWorkflowRecord(node.style).height, numberOrDefault(settings.frame_height, defaultFrameNodeSize.height)),
      ),
    })
    settings.frame_width = measured.width
    settings.frame_height = measured.height
    settings.frame_color = getFrameNodeColor(settings)
    settings.frame_opacity = getFrameNodeOpacity(settings)
    settings.frame_locked = isFrameLocked(settings)
    settings.helper_frame = true
  }
  return {
    id: node.data.id || node.id,
    title: node.data.title,
    subtitle: node.data.subtitle,
    kind: node.data.kind,
    provider: node.data.provider,
    status: node.data.status,
    cost: node.data.cost,
    description: node.data.description,
    position: node.position,
    settings,
    inputs: getNodePorts(node.data, 'input').map((port) => port.id),
    outputs: getNodePorts(node.data, 'output').map((port) => port.id),
    inputPorts: getNodePorts(node.data, 'input'),
    outputPorts: getNodePorts(node.data, 'output'),
  }
}

function mapWorkflowEdges(edges: Workflow['edges'], nodes: Workflow['nodes']): WorkflowFlowEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return edges
    .map((edge) => {
      const labelPorts = parseWorkflowEdgePorts(edge.label)
      const sourcePort = edge.sourcePort ?? labelPorts?.source ?? firstWorkflowPortId(nodeById.get(edge.source), 'output')
      const targetInput = edge.targetInput ?? labelPorts?.target ?? firstWorkflowPortId(nodeById.get(edge.target), 'input')

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? (sourcePort ? toPortHandleId(sourcePort, 'output') : undefined),
        targetHandle: edge.targetHandle ?? (targetInput ? toPortHandleId(targetInput, 'input') : undefined),
        label: undefined,
        ...defaultEdgeOptions,
      }
    })
    .filter(isWorkflowEdgePersistable)
}

function firstWorkflowPortId(node: WorkflowDefinitionNode | undefined, direction: 'input' | 'output') {
  if (!node) return null
  const ports = normalizePorts(
    direction === 'input' ? node.inputPorts ?? node.inputs ?? [] : node.outputPorts ?? node.outputs ?? [],
    direction,
  )
  return ports[0]?.id ?? null
}

function parseWorkflowEdgePorts(label: string | undefined) {
  if (!label?.includes('->')) return null
  const [source, target] = label.split('->').map((part) => normalizePortName(part))
  if (!source || !target) return null
  return { source, target }
}

function mapFlowEdgeToWorkflowEdge(edge: WorkflowFlowEdge): Workflow['edges'][number] {
  const sourcePort = getPortIdFromHandle(edge.sourceHandle, 'output') ?? undefined
  const targetInput = getPortIdFromHandle(edge.targetHandle, 'input') ?? undefined

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    sourcePort,
    targetInput,
  }
}

export const __workflowCanvasTestHooks = {
  applyRuntimeNodeState,
  catalogDefaultSettings,
  claimWorkflowTitleSubmission,
  getConnectedWorkflowPortIds,
  getCaptionWorkflowInlineFieldOrder,
  getCatalogInlineNodeFields,
  hasCatalogAdvancedNodeFields,
  getNodePorts,
  getVisibleNodePorts,
  isCatalogNodeVisibleInCanvasPalette,
  areWorkflowPortTypesCompatible: areFlowPortTypesCompatible,
  mapFlowNodeToWorkflowNode,
  getValidWorkflowConnection,
  edgeForPendingNodeConnection,
  removeCanvasElements,
  createCanvasHistorySnapshot,
  canvasSnapshotsEqual,
}

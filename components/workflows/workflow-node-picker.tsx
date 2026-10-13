'use client'

import * as React from 'react'
import {
  AlertCircle,
  Search,
  Star,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { InFlightRequestRegistry } from '@/lib/workflows/in-flight-request-registry'
import {
  FLOW_NODE_ICON_TILE_CLASS,
  catalogNodeTypeName,
  getFlowNodeVisual,
  getFlowPickerFrequentRank,
} from '@/lib/workflows/flow-node-icons'
import { areFlowPortTypesCompatible, getFlowNodePorts, type FlowPortCompatibilityContext } from '@/lib/workflows/flow-node-profiles'
import {
  listWorkflowNodeFavoriteTypes,
  peekWorkflowNodeFavoriteTypes,
  setWorkflowNodeFavorite,
  workflowFavoriteLookupKeys,
} from '@/lib/workflows/node-favorites'
import type {
  WorkflowDefinitionNode,
  WorkflowNodePort,
  WorkflowNodePortType,
} from '@/lib/types'

type WorkflowTranslator = (key: string, values?: Record<string, string | number>) => string

export type WorkflowPickerCategory =
  | 'Helpers'
  | 'Generation'
  | 'Video'
  | 'Publishing'
  | 'Logic & Utility'
  | 'Monitoring'

export type WorkflowPickerItem = {
  kind: WorkflowDefinitionNode['kind']
  category: WorkflowPickerCategory
  title: string
  subtitle?: string
  provider: string
  description: string
  nodeType?: string
  cost?: string
  settings?: Record<string, unknown>
  inputPorts?: WorkflowNodePort[]
  outputPorts?: WorkflowNodePort[]
  pickerAction?: 'assets' | 'upload'
  pickerHidden?: boolean
}

export type WorkflowPickerTabId = 'nodes' | 'utils' | 'favorites'
export type FlowPickerPlacement = 'cursor' | 'toolbelt'

export const FLOW_PICKER_EDGE_PADDING = 8
export const FLOW_PICKER_TOOLBELT_CLEARANCE = 84
export const FLOW_PICKER_MAX_HEIGHT = 380
export const FLOW_PICKER_MIN_HEIGHT = 160
export const FLOW_PICKER_ANCHOR_GAP = 8
export const FLOW_PICKER_WIDTH = 272

export type WorkflowNodePickerRequest = {
  screenPosition?: {
    x: number
    y: number
  }
  placement?: FlowPickerPlacement
  connection?: {
    sourcePortType?: WorkflowNodePortType
    targetPortType?: WorkflowNodePortType
    targetNodeType?: string
    targetPortId?: string
  }
}

export function fitFlowPickerPanel(input: {
  parentWidth: number
  parentHeight: number
  panelWidth: number
  desiredLeft: number
  desiredTop: number
  placement?: FlowPickerPlacement
}): {
  left: number
  top?: number
  bottom?: number
  maxHeight: number
} {
  const padding = FLOW_PICKER_EDGE_PADDING
  const panelWidth = Math.min(
    Math.max(input.panelWidth, 0),
    Math.max(padding * 2, input.parentWidth - padding * 2),
  )
  const maxLeft = Math.max(padding, input.parentWidth - panelWidth - padding)
  const left = clampNumber(input.desiredLeft, padding, maxLeft)
  const maxBottom = input.placement === 'toolbelt'
    ? Math.max(padding + FLOW_PICKER_MIN_HEIGHT, input.desiredTop - FLOW_PICKER_ANCHOR_GAP)
    : Math.max(padding + FLOW_PICKER_MIN_HEIGHT, input.parentHeight - FLOW_PICKER_TOOLBELT_CLEARANCE)
  const maxHeight = Math.min(FLOW_PICKER_MAX_HEIGHT, Math.max(FLOW_PICKER_MIN_HEIGHT, maxBottom - padding))

  if (input.placement === 'toolbelt') {
    return {
      left,
      bottom: Math.max(padding, input.parentHeight - maxBottom),
      maxHeight,
    }
  }

  if (maxBottom - input.desiredTop < FLOW_PICKER_MIN_HEIGHT) {
    return {
      left,
      top: Math.max(padding, maxBottom - maxHeight),
      maxHeight,
    }
  }

  const height = Math.min(maxHeight, maxBottom - input.desiredTop)
  return {
    left,
    top: Math.min(input.desiredTop, maxBottom - height),
    maxHeight: height,
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function visibleParentBox(parent: HTMLElement) {
  const rect = parent.getBoundingClientRect()
  const viewport = window.visualViewport
  const viewLeft = viewport?.offsetLeft ?? 0
  const viewTop = viewport?.offsetTop ?? 0
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth)
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight)
  return {
    width: Math.max(0, Math.min(parent.clientWidth, viewRight - rect.left)),
    height: Math.max(0, Math.min(parent.clientHeight, viewBottom - rect.top)),
  }
}

const UTILITY_NODE_TYPE_NAMES = new Set([
  'review',
  'review_gate',
  'map',
])

export function areWorkflowPortTypesCompatible(
  sourceType: WorkflowNodePortType | undefined,
  targetType: WorkflowNodePortType | undefined,
  context?: FlowPortCompatibilityContext,
) {
  return areFlowPortTypesCompatible(sourceType, targetType, context)
}

export function isFlowPickerUtilityItem(item: WorkflowPickerItem) {
  if (item.pickerAction || item.pickerHidden) return false
  if (isFlowPickerPromptHelper(item)) return false
  if (item.settings?.helper_preview === true) return true
  if (item.kind === 'note') return true
  const typeName = catalogNodeTypeName(item.nodeType)
  if (typeName === 'frame_extract' || typeName === 'video_to_gif') return false
  if (typeName === 'upload') {
    return String(item.settings?.destination ?? 'assets') !== 'youtube'
  }
  if (UTILITY_NODE_TYPE_NAMES.has(typeName) || typeName.startsWith('review')) {
    return true
  }
  return item.category === 'Logic & Utility' || item.kind === 'logic'
}

export function WorkflowNodePicker({
  request,
  nodes,
  onSelect,
  onClose,
}: {
  request: WorkflowNodePickerRequest
  nodes: WorkflowPickerItem[]
  onSelect: (item: WorkflowPickerItem) => void
  onClose: () => void
}) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const [query, setQuery] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<WorkflowPickerTabId>('nodes')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [favoriteNodeTypes, setFavoriteNodeTypes] = React.useState<Set<string>>(
    () => new Set(peekWorkflowNodeFavoriteTypes()),
  )
  const [favoriteBusyNodeTypes, setFavoriteBusyNodeTypes] = React.useState<Set<string>>(() => new Set())
  const [favoriteError, setFavoriteError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const favoriteActionsRef = React.useRef(new InFlightRequestRegistry())
  const [panelOffset, setPanelOffset] = React.useState<{
    left: number
    top?: number
    bottom?: number
    maxHeight: number
  }>(() => (
    request.placement === 'toolbelt'
      ? { left: 12, bottom: FLOW_PICKER_TOOLBELT_CLEARANCE, maxHeight: FLOW_PICKER_MAX_HEIGHT }
      : { left: 12, top: 12, maxHeight: FLOW_PICKER_MAX_HEIGHT }
  ))

  const referenceItems = React.useMemo(
    () => (request.connection ? [] : buildReferencePickerItems(tWorkflows)),
    [request.connection, tWorkflows],
  )
  const catalogItems = React.useMemo(
    () => nodes.filter((item) => !item.pickerHidden && !item.pickerAction),
    [nodes],
  )
  const favoriteItems = React.useMemo(
    () => catalogItems.filter((item) => {
      const nodeType = getPickerFavoriteNodeType(item)
      return nodeType ? isFavoriteNodeType(favoriteNodeTypes, nodeType) : false
    }),
    [catalogItems, favoriteNodeTypes],
  )

  const visibleItems = React.useMemo(
    () => buildVisiblePickerItems({
      query,
      activeTab,
      catalogItems,
      referenceItems,
      favoriteItems,
      sourcePortType: request.connection?.sourcePortType,
      targetPortType: request.connection?.targetPortType,
      targetNodeType: request.connection?.targetNodeType,
      targetPortId: request.connection?.targetPortId,
    }),
    [activeTab, catalogItems, favoriteItems, query, referenceItems, request.connection],
  )

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    listWorkflowNodeFavoriteTypes({ signal: controller.signal })
      .then((nodeTypes) => {
        setFavoriteNodeTypes(new Set(nodeTypes))
        setFavoriteError(null)
      })
      .catch((error: unknown) => {
        if (isAbortLikeError(error)) return
        setFavoriteError(tWorkflows('library.favoritesLoadError'))
      })
    return () => controller.abort()
  }, [tWorkflows])

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [activeTab, query, visibleItems.length])

  React.useLayoutEffect(() => {
    const panel = panelRef.current
    const parent = panel?.offsetParent
    if (!panel || !(parent instanceof HTMLElement)) return

    const place = () => {
      const box = visibleParentBox(parent)
      const next = fitFlowPickerPanel({
        parentWidth: box.width,
        parentHeight: box.height,
        panelWidth: panel.offsetWidth || FLOW_PICKER_WIDTH,
        desiredLeft: request.screenPosition?.x ?? Math.max(12, (box.width - (panel.offsetWidth || FLOW_PICKER_WIDTH)) / 2),
        desiredTop: request.screenPosition?.y ?? 12,
        placement: request.placement,
      })
      setPanelOffset((current) => (
        current.left === next.left
          && current.top === next.top
          && current.bottom === next.bottom
          && current.maxHeight === next.maxHeight
          ? current
          : next
      ))
    }

    place()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    window.addEventListener('resize', place)
    return () => {
      viewport?.removeEventListener('resize', place)
      viewport?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [request.placement, request.screenPosition, visibleItems.length])

  const selectedItem = visibleItems[selectedIndex] ?? visibleItems[0]
  const toggleFavorite = React.useCallback(async (nodeType: string, favorite: boolean) => {
    const actionKey = `favorite:${nodeType}`
    if (favoriteActionsRef.current.has(actionKey)) return
    await favoriteActionsRef.current.run(actionKey, async () => {
      setFavoriteNodeTypes((current) => {
        const optimistic = new Set(current)
        if (favorite) {
          optimistic.add(nodeType)
        } else {
          for (const key of workflowFavoriteLookupKeys(nodeType)) optimistic.delete(key)
        }
        return optimistic
      })
      setFavoriteBusyNodeTypes((current) => new Set(current).add(nodeType))
      setFavoriteError(null)

      try {
        const nodeTypes = await setWorkflowNodeFavorite(nodeType, favorite)
        setFavoriteNodeTypes(new Set(nodeTypes))
      } catch {
        setFavoriteNodeTypes((current) => {
          const rolledBack = new Set(current)
          if (favorite) rolledBack.delete(nodeType)
          else rolledBack.add(nodeType)
          return rolledBack
        })
        setFavoriteError(favorite ? tWorkflows('library.favoriteSaveError') : tWorkflows('library.favoriteRemoveError'))
      } finally {
        setFavoriteBusyNodeTypes((current) => {
          const next = new Set(current)
          next.delete(nodeType)
          return next
        })
      }
    })
  }, [tWorkflows])

  const tabs: Array<{ id: WorkflowPickerTabId; label: string; count: number }> = [
    { id: 'nodes', label: tWorkflows('library.tabNodes'), count: catalogItems.filter((item) => !isFlowPickerUtilityItem(item)).length },
    { id: 'utils', label: tWorkflows('library.tabUtility'), count: catalogItems.filter(isFlowPickerUtilityItem).length },
    { id: 'favorites', label: tWorkflows('library.tabFavorites'), count: favoriteItems.length },
  ]

  const frequentItems = visibleItems.filter((item) => item.section === 'frequent').map((item) => item.item)
  const referenceRows = visibleItems.filter((item) => item.section === 'references').map((item) => item.item)
  const utilityItems = visibleItems.filter((item) => item.section === 'utility').map((item) => item.item)

  function setSelectedIndexFromItem(item: WorkflowPickerItem) {
    const index = visibleItems.findIndex((row) => pickerItemKey(row.item) === pickerItemKey(item))
    if (index >= 0) setSelectedIndex(index)
  }

  return (
    <>
      <button
        type="button"
        aria-label={tAuto('close_node_search_d3d179a0')}
        className="absolute inset-0 z-40 cursor-default bg-transparent"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={tWorkflows('library.searchPlaceholder')}
        className="pointer-events-auto absolute z-50 flex w-[min(272px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover/96 text-foreground shadow-2xl shadow-black/40 backdrop-blur-md"
        style={{
          left: panelOffset.left,
          top: panelOffset.top,
          bottom: panelOffset.bottom,
          maxHeight: panelOffset.maxHeight,
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose()
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedIndex((current) => Math.min(current + 1, Math.max(visibleItems.length - 1, 0)))
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedIndex((current) => Math.max(current - 1, 0))
            return
          }
          if (event.key === 'Enter' && selectedItem) {
            event.preventDefault()
            onSelect(selectedItem.item)
          }
        }}
      >
        <div className="shrink-0 px-2 pb-1 pt-2">
          <label className="flex h-8 items-center gap-2 rounded-lg bg-muted/60 px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={tWorkflows('library.searchPlaceholder')}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 px-2 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'h-6 rounded-full px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                activeTab === tab.id && 'bg-accent text-foreground',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="ml-1 text-muted-foreground/70">{tab.count}</span>
            </button>
          ))}
        </div>

        {favoriteError && (
          <div
            role="alert"
            className="mx-2.5 mb-1 flex min-h-8 items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{favoriteError}</span>
          </div>
        )}

        <div
          className="youtorch-thin-scrollbar min-h-0 flex-auto overflow-y-auto px-1 pb-1.5 pt-0.5"
          onWheel={(event) => event.stopPropagation()}
        >
          {visibleItems.length > 0 ? (
            <>
              {frequentItems.length > 0 && (
                <PickerSection
                  items={frequentItems}
                  selectedItem={selectedItem?.item}
                  favoriteNodeTypes={favoriteNodeTypes}
                  favoriteBusyNodeTypes={favoriteBusyNodeTypes}
                  onHover={setSelectedIndexFromItem}
                  onSelect={onSelect}
                  onToggleFavorite={toggleFavorite}
                  itemOffset={0}
                />
              )}
              {referenceRows.length > 0 && (
                <PickerSection
                  heading={tWorkflows('library.referencesHeading')}
                  items={referenceRows}
                  selectedItem={selectedItem?.item}
                  favoriteNodeTypes={favoriteNodeTypes}
                  favoriteBusyNodeTypes={favoriteBusyNodeTypes}
                  onHover={setSelectedIndexFromItem}
                  onSelect={onSelect}
                  onToggleFavorite={toggleFavorite}
                  itemOffset={frequentItems.length}
                />
              )}
              {utilityItems.length > 0 && (
                <PickerSection
                  heading={tWorkflows('library.utilityHeading')}
                  items={utilityItems}
                  selectedItem={selectedItem?.item}
                  favoriteNodeTypes={favoriteNodeTypes}
                  favoriteBusyNodeTypes={favoriteBusyNodeTypes}
                  onHover={setSelectedIndexFromItem}
                  onSelect={onSelect}
                  onToggleFavorite={toggleFavorite}
                  itemOffset={frequentItems.length + referenceRows.length}
                />
              )}
            </>
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {activeTab === 'favorites'
                ? favoriteItems.length > 0 ? tAuto('no_favorites_match_this_search_85719db1') : tAuto('no_favorites_yet_95bc6801')
                : tAuto('no_nodes_found_b4319f83')}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PickerSection({
  heading,
  items,
  selectedItem,
  favoriteNodeTypes,
  favoriteBusyNodeTypes,
  onHover,
  onSelect,
  onToggleFavorite,
  itemOffset,
}: {
  heading?: string
  items: WorkflowPickerItem[]
  selectedItem?: WorkflowPickerItem
  favoriteNodeTypes: Set<string>
  favoriteBusyNodeTypes: Set<string>
  onHover: (item: WorkflowPickerItem) => void
  onSelect: (item: WorkflowPickerItem) => void
  onToggleFavorite: (nodeType: string, favorite: boolean) => void
  itemOffset: number
}) {
  return (
    <div className="py-0.5">
      {heading ? (
        <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {heading}
        </div>
      ) : null}
      {items.map((item, index) => (
        <PickerRow
          key={pickerItemKey(item)}
          item={item}
          selected={pickerItemKey(item) === pickerItemKey(selectedItem)}
          favoriteNodeTypes={favoriteNodeTypes}
          favoriteBusyNodeTypes={favoriteBusyNodeTypes}
          onHover={onHover}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          tabIndex={index === 0 && itemOffset === 0 ? 0 : -1}
        />
      ))}
    </div>
  )
}

function PickerRow({
  item,
  selected,
  favoriteNodeTypes,
  favoriteBusyNodeTypes,
  onHover,
  onSelect,
  onToggleFavorite,
  tabIndex,
}: {
  item: WorkflowPickerItem
  selected: boolean
  favoriteNodeTypes: Set<string>
  favoriteBusyNodeTypes: Set<string>
  onHover: (item: WorkflowPickerItem) => void
  onSelect: (item: WorkflowPickerItem) => void
  onToggleFavorite: (nodeType: string, favorite: boolean) => void
  tabIndex: number
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const visual = getFlowNodeVisual({
    nodeType: item.nodeType,
    kind: item.kind,
    pickerAction: item.pickerAction,
    title: item.title,
    settings: item.settings,
  })
  const Icon = visual.Icon
  const favoriteNodeType = getPickerFavoriteNodeType(item)
  const isFavorite = favoriteNodeType ? isFavoriteNodeType(favoriteNodeTypes, favoriteNodeType) : false
  const isFavoriteBusy = favoriteNodeType ? favoriteBusyNodeTypes.has(favoriteNodeType) : false

  return (
    <div
      role="button"
      tabIndex={tabIndex}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent',
        selected && 'bg-accent',
      )}
      onMouseEnter={() => onHover(item)}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
    >
      <span className={cn(FLOW_NODE_ICON_TILE_CLASS, 'size-5 rounded-[5px]', visual.gradient)}>
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-4 text-foreground">
        {item.title}
      </span>
      {favoriteNodeType && (
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 opacity-100 transition-opacity hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
            isFavorite && 'text-amber-300 opacity-100',
            isFavoriteBusy && 'opacity-60',
            selected && 'opacity-100',
          )}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(favoriteNodeType, !isFavorite)
          }}
          disabled={isFavoriteBusy}
          aria-label={isFavorite
            ? tWorkflows('library.removeFavoriteAria', { title: item.title })
            : tWorkflows('library.addFavoriteAria', { title: item.title })}
        >
          <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
        </button>
      )}
    </div>
  )
}

function buildReferencePickerItems(t: WorkflowTranslator): WorkflowPickerItem[] {
  return [
    {
      kind: 'input',
      category: 'Helpers',
      title: t('library.assetsTitle'),
      provider: t('library.inputProvider'),
      description: t('library.assetsDescription'),
      pickerAction: 'assets',
    },
  ]
}

export function buildVisiblePickerItems({
  query,
  activeTab,
  catalogItems,
  referenceItems,
  favoriteItems,
  sourcePortType,
  targetPortType,
  targetNodeType,
  targetPortId,
}: {
  query: string
  activeTab: WorkflowPickerTabId
  catalogItems: WorkflowPickerItem[]
  referenceItems: WorkflowPickerItem[]
  favoriteItems: WorkflowPickerItem[]
  sourcePortType?: WorkflowNodePortType
  targetPortType?: WorkflowNodePortType
  targetNodeType?: string
  targetPortId?: string
}) {
  const searchedCatalog = filterPickerItems(catalogItems, query, sourcePortType, targetPortType, targetNodeType, targetPortId)
  const searchedReferences = filterPickerItems(referenceItems, query)
  const searchedFavorites = filterPickerItems(favoriteItems, query, sourcePortType, targetPortType, targetNodeType, targetPortId)
  const catalogNodes = searchedCatalog
    .filter((item) => !isFlowPickerUtilityItem(item))
    .sort(compareFlowPickerItems)
  const utility = searchedCatalog.filter(isFlowPickerUtilityItem).sort(compareFlowPickerItems)

  const rows: Array<{ section: 'frequent' | 'references' | 'utility'; item: WorkflowPickerItem }> = []
  if (activeTab === 'favorites' && !query.trim()) {
    searchedFavorites.forEach((item) => rows.push({
      section: isFlowPickerUtilityItem(item) ? 'utility' : 'frequent',
      item,
    }))
    return rows
  }
  if (activeTab === 'utils' && !query.trim()) {
    utility.forEach((item) => rows.push({ section: 'utility', item }))
    return rows
  }

  catalogNodes.forEach((item) => rows.push({ section: 'frequent', item }))
  searchedReferences.forEach((item) => rows.push({ section: 'references', item }))
  if (query.trim() || activeTab !== 'nodes' || sourcePortType || targetPortType) {
    utility.forEach((item) => rows.push({ section: 'utility', item }))
  }
  return rows
}

function compareFlowPickerItems(left: WorkflowPickerItem, right: WorkflowPickerItem) {
  const leftRank = getFlowPickerFrequentRank(left.nodeType, helperInputFromSettings(left.settings))
  const rightRank = getFlowPickerFrequentRank(right.nodeType, helperInputFromSettings(right.settings))
  if (leftRank !== rightRank) return leftRank - rightRank
  return left.title.localeCompare(right.title)
}

function filterPickerItems(
  items: WorkflowPickerItem[],
  query: string,
  sourcePortType?: WorkflowNodePortType,
  targetPortType?: WorkflowNodePortType,
  targetNodeType?: string,
  targetPortId?: string,
) {
  const normalizedQuery = normalizeSearchValue(query)
  const compatible = targetPortType
    ? items.filter((item) => itemProvidesTarget(item, targetPortType, targetNodeType, targetPortId))
    : sourcePortType
      ? items.filter((item) => itemAcceptsSource(item, sourcePortType))
      : items
  if (!normalizedQuery) return compatible
  return compatible.filter((item) => getPickerItemSearchText(item).includes(normalizedQuery))
}

function itemAcceptsSource(item: WorkflowPickerItem, sourcePortType: WorkflowNodePortType) {
  if (item.pickerAction) return false
  const profilePorts = getFlowNodePorts({
    kind: item.kind,
    settings: {
      ...(item.settings ?? {}),
      ...(item.nodeType ? { node_type: item.nodeType } : {}),
    },
  }, 'input')
  const ports = (profilePorts ?? item.inputPorts ?? []).filter((port) => isPickerConnectableInput(port))
  if (ports.length === 0) return false
  return ports.some((port) => areWorkflowPortTypesCompatible(sourcePortType, port.type, {
    targetNodeType: item.nodeType,
    targetPortId: port.id,
  }))
}

function itemProvidesTarget(
  item: WorkflowPickerItem,
  targetPortType: WorkflowNodePortType,
  targetNodeType?: string,
  targetPortId?: string,
) {
  if (item.pickerAction) return false
  const profilePorts = getFlowNodePorts({
    kind: item.kind,
    settings: {
      ...(item.settings ?? {}),
      ...(item.nodeType ? { node_type: item.nodeType } : {}),
    },
  }, 'output')
  const ports = profilePorts ?? item.outputPorts ?? []
  if (ports.length === 0) return false
  return ports.some((port) => areWorkflowPortTypesCompatible(port.type, targetPortType, {
    targetNodeType,
    targetPortId,
  }))
}

function isPickerConnectableInput(port: WorkflowNodePort) {
  const id = port.id.trim().toLocaleLowerCase('en-US')
  if (['model_id', 'research_model', 'path', 'destination', 'language', 'style', 'quality'].includes(id)) {
    return false
  }
  return port.type === 'any'
    || port.type === 'list'
    || port.type === 'image'
    || port.type === 'video'
    || port.type === 'audio'
    || port.type === 'transcript'
    || port.type === 'string'
    || port.type === 'segments'
}

function getPickerFavoriteNodeType(item: WorkflowPickerItem) {
  if (item.pickerAction) return null
  if (item.nodeType) return item.nodeType
  return null
}

function isFavoriteNodeType(favoriteNodeTypes: Set<string>, nodeType: string) {
  if (favoriteNodeTypes.has(nodeType)) return true
  const wanted = nodeType.split('@')[0]?.trim().toLocaleLowerCase('en-US') ?? ''
  if (!wanted) return false
  for (const favorite of favoriteNodeTypes) {
    if (favorite.split('@')[0]?.trim().toLocaleLowerCase('en-US') === wanted) return true
  }
  return false
}

function isFlowPickerPromptHelper(item: WorkflowPickerItem) {
  return !item.nodeType && helperInputFromSettings(item.settings) === 'prompt'
}

function helperInputFromSettings(settings: Record<string, unknown> | undefined) {
  return String(settings?.helper_input ?? '').trim().toLowerCase() || null
}

function getPickerItemSearchText(item: WorkflowPickerItem) {
  return normalizeSearchValue([
    item.title,
    item.subtitle,
    item.provider,
    item.description,
    item.nodeType,
    item.pickerAction,
  ].filter(Boolean).join(' '))
}

function pickerItemKey(item: WorkflowPickerItem | undefined) {
  if (!item) return ''
  if (item.pickerAction) return `action:${item.pickerAction}`
  if (item.nodeType) {
    const destination = String(item.settings?.destination ?? '')
    return destination ? `type:${item.nodeType}:${destination}` : `type:${item.nodeType}`
  }
  return `${item.kind}:${item.title}:${String(item.settings?.helper_input ?? item.settings?.helper_preview ?? '')}`
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

function isAbortLikeError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export type MagicClipGroupKind = 'agent' | 'workflow' | 'task' | 'fallback'

export type MagicClipStorageGroup<T> = {
  key: string
  kind: MagicClipGroupKind
  runId: string | null
  items: T[]
}

type MagicClipMetadataItem = {
  metadata: Record<string, unknown>
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function getMagicClipRunId(item: MagicClipMetadataItem) {
  return readMetadataString(item.metadata, 'storage_group_run_id')
    ?? readMetadataString(item.metadata, 'workflow_id')
}

export function getMagicClipGroupKind(runId: string): Exclude<MagicClipGroupKind, 'fallback'> {
  if (runId.startsWith('ag-')) return 'agent'
  if (runId.startsWith('wf-')) return 'workflow'
  return 'task'
}

export function formatMagicClipId(value: string) {
  const normalized = value.trim()
  if (normalized.length <= 16) return normalized
  return `${normalized.slice(0, 8)}…${normalized.slice(-5)}`
}

export function groupMagicClipItems<T extends MagicClipMetadataItem>(items: T[]): MagicClipStorageGroup<T>[] {
  const groups = new Map<string, MagicClipStorageGroup<T>>()
  for (const item of items) {
    const sourceId = readMetadataString(item.metadata, 'storage_group_source_object_id') ?? 'unknown-source'
    const runId = getMagicClipRunId(item) ?? 'unknown-run'
    const key = `${sourceId}\u0000${runId}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      continue
    }
    const knownRunId = getMagicClipRunId(item)
    groups.set(key, {
      key,
      kind: knownRunId ? getMagicClipGroupKind(knownRunId) : 'fallback',
      runId: knownRunId,
      items: [item],
    })
  }
  return Array.from(groups.values())
}

export function formatMagicClipGroupLabel(
  group: Pick<MagicClipStorageGroup<unknown>, 'kind' | 'runId'>,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (group.kind === 'fallback' || !group.runId) return t('clipGroups.fallback')
  return t('clipGroups.taskId', { id: formatMagicClipId(group.runId) })
}

export type AssistantApprovalTarget = {
  type: 'draft' | 'tool'
  id: string
  hash: string
}

export function readAssistantApprovalTarget(
  value: Record<string, unknown>,
  expected?: Partial<Pick<AssistantApprovalTarget, 'type' | 'id'>>,
): AssistantApprovalTarget | null {
  const type = normalizedString(value.approval_target_type)
  const id = normalizedString(value.approval_target_id)
  const hash = normalizedString(value.approval_target_hash)
  if ((type !== 'draft' && type !== 'tool') || !id || !hash || !/^[a-f0-9]{64}$/.test(hash)) {
    return null
  }
  if (expected?.type && type !== expected.type) return null
  if (expected?.id && id !== expected.id) return null
  return { type, id, hash }
}

function normalizedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

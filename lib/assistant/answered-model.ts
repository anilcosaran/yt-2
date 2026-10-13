import type { AssistantMessage } from '@/lib/assistant/api'
import { publicModelLabel } from '@/lib/public-model-display'

/**
 * S8 (decision 2026-09-27; KARAR-COKLU-MODEL §4.6): an assistant reply shows, as small secondary text in its existing
 * action row, the model that produced it. The server stamps the catalog model id on planner-written replies
 * (`content_json.answered_by_model_id`); template messages and older replies carry none and show nothing (no guess from
 * the run or the composer). Only the public model label is shown — never a provider or route (Q91).
 */
export const ANSWERED_BY_MODEL_KEY = 'answered_by_model_id'

export function readAnsweredModelId(message: Pick<AssistantMessage, 'role' | 'content_json'>): string | null {
  if (message.role !== 'assistant') return null
  const value = message.content_json?.[ANSWERED_BY_MODEL_KEY]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The catalog label when the chat model is listed, else the public form of the id (`auto-llm` -> `Auto`). */
export function answeredModelLabel(modelId: string, catalogLabels: ReadonlyMap<string, string>): string {
  const listed = catalogLabels.get(modelId)
  return publicModelLabel(listed ?? modelId)
}

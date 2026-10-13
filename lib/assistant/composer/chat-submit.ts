import type { AssistantComposerSelection } from '@/lib/assistant/api'
import { getStorageObject } from '@/lib/storage/api'

import { resolveComposerAttachmentRefs, type ComposerAttachmentSource, type StorageChecksumReader } from './attachment-refs'
import type { ComposerMode } from './composer-mode'
import type { ComposerState } from './composer-state'
import type { ComposerSurface } from './composer-menu'
import {
  buildComposerSubmission,
  type AssistantMessageContextV1,
  type ComposerJobTarget,
  type ComposerReplyTo,
  type ComposerRequestedCount,
  type ComposerSelectionV1,
  type ComposerSparkContext,
  type ComposerSubmitIssue,
} from './message-context'

type Translator = (key: string, values?: Record<string, string | number>) => string

/** Composer selection for the request body (run snapshot): canonical `mode`, never the legacy `approval_mode`. */
export type ComposerBodySelection = Omit<AssistantComposerSelection, 'approval_mode'> & { mode: ComposerMode }

export type PreparedComposerMessage =
  | {
    ok: true
    content: string
    contentJson: AssistantMessageContextV1
    bodySelection: ComposerBodySelection
  }
  | { ok: false; message: string }

/**
 * P03-01 Chat submit: resolves attachments to Storage refs and builds the one normalized
 * `assistant_message_context_v1` payload. Failure never sends a partial message; it returns a localized reason.
 */
export async function prepareChatComposerMessage(input: {
  surface: ComposerSurface
  /** Spark Chat: the workspace snapshot of the message (P03-07 `sparkComposerContext(buildSparkMessageContext(…))`). */
  sparkContext?: ComposerSparkContext | null
  channelId: string
  locale: string
  state: ComposerState
  attachments: readonly ComposerAttachmentSource[]
  selection: AssistantComposerSelection
  mode: ComposerMode
  requestedCount?: ComposerRequestedCount | null
  jobTarget?: ComposerJobTarget | null
  replyTo?: ComposerReplyTo | null
  fallbackContent: string
  t: Translator
  readChecksum?: StorageChecksumReader
}): Promise<PreparedComposerMessage> {
  const readChecksum = input.readChecksum ?? readStorageChecksum
  const attachments = await resolveComposerAttachmentRefs(input.attachments, { fallbackChannelId: input.channelId, readChecksum })
  const blocked = attachments.unresolved[0]
  if (blocked) {
    return {
      ok: false,
      message: input.t(blocked.objectId ? 'typedComposer.attachmentNotReady' : 'typedComposer.attachmentNotStorage', { name: blocked.name }),
    }
  }
  const rest: Omit<AssistantComposerSelection, 'approval_mode'> & { approval_mode?: unknown } = { ...input.selection }
  delete rest.approval_mode
  const bodySelection: ComposerBodySelection = { ...rest, mode: input.mode }
  const composerSelection: ComposerSelectionV1 = {
    chat_profile: rest.chat_profile,
    model_id: rest.model_id,
    mode: input.mode,
    video_duration_seconds: rest.video_duration_seconds,
    aspect_ratio: rest.aspect_ratio,
    selected_models: rest.selected_models,
    selected_model_inputs: rest.selected_model_inputs as ComposerSelectionV1['selected_model_inputs'],
  }
  const submission = buildComposerSubmission({
    surface: input.surface,
    sparkContext: input.sparkContext ?? null,
    channelId: input.channelId,
    locale: input.locale,
    state: input.state,
    attachments: attachments.refs,
    composerSelection,
    requestedCount: input.requestedCount ?? null,
    jobTarget: input.jobTarget ?? null,
    replyTo: input.replyTo ?? null,
    fallbackContent: input.fallbackContent,
  })
  if (!submission.ok) return { ok: false, message: describeIssue(submission.issues[0], input.t) }
  return { ok: true, content: submission.content, contentJson: submission.contentJson, bodySelection }
}

function describeIssue(issue: ComposerSubmitIssue | undefined, t: Translator): string {
  if (issue?.code === 'requested_count_out_of_range') {
    return t('typedComposer.requestedCountOutOfRange', { count: issue.count, min: issue.min, max: issue.max ?? issue.count })
  }
  return t('typedComposer.submitInvalid')
}

async function readStorageChecksum(input: { channelId: string; objectId: string }): Promise<string | null> {
  const object = await getStorageObject(input)
  return object.checksum_sha256
}

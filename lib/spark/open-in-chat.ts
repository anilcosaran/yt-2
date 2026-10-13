/**
 * Y1-07 W9 "Open in Chat": the Spark editor's side chat IS the project's linked conversation (F34), so the same
 * conversation can be continued on the Chat page. The path is built here from the server's conversation id only
 * (never from a title or a message); the Chat page opens a conversation by its `id` query parameter.
 */
const CONVERSATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** `/chat?id=<conversation>` or null when there is no (valid) conversation yet. */
export function chatPathForConversation(conversationId: string | null | undefined): string | null {
  if (!conversationId || !CONVERSATION_ID.test(conversationId)) return null
  return `/chat?id=${encodeURIComponent(conversationId)}`
}

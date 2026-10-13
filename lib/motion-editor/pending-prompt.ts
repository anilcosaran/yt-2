/**
 * One-shot hand-off of the "Create motion" prompt from `/motion` to the draft editor. The catalog creates the draft and
 * navigates (client side) to `/motion/{draftId}`; the editor's chat pane takes the prompt and sends it as the first message of
 * the draft's conversation. It lives in module memory only: not in the URL (a prompt is the user's own text), not in browser
 * storage (project rule: server-side persistence only). A reload before the chat pane took it simply drops the hand-off; the
 * draft itself exists on the server and the user can type the request again.
 */

const pending = new Map<string, string>()

export function setPendingMotionPrompt(draftId: string, prompt: string): void {
  const text = prompt.trim()
  if (text) pending.set(draftId, text)
}

/** Returns and forgets the prompt of a draft (a second call, or a draft without one, answers null). */
export function takePendingMotionPrompt(draftId: string): string | null {
  const text = pending.get(draftId) ?? null
  pending.delete(draftId)
  return text
}

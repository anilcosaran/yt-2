// Per-namespace message fragments: `messages/<locale>/<Namespace>[.<feature>].json` holds keys of the
// top-level namespace `<Namespace>` and is merged into `messages/<locale>.json` when messages load
// (i18n/messages.ts) and when they are checked (scripts/message-integrity.mjs). New keys can live in
// their own file instead of every branch editing the same lines of en.json/tr.json. A leaf key is
// defined exactly once: in the locale file or in one fragment.

/**
 * @typedef {{ [key: string]: string | MessageTree }} MessageTree
 * @typedef {{ file: string, namespace: string, messages: MessageTree }} MessageFragment
 */

export const MESSAGE_FRAGMENT_NAME = /^[A-Z][A-Za-z0-9]*(?:\.[a-z0-9][a-z0-9-]*)?\.json$/

/** `CreditAction.json` / `Chat.memory-suggestion.json` -> the namespace, or null for an invalid name. */
export function fragmentNamespace(fileName) {
  return MESSAGE_FRAGMENT_NAME.test(fileName) ? fileName.slice(0, -'.json'.length).split('.')[0] : null
}

/**
 * Returns a new catalog: `base` plus every fragment under its namespace. Inputs are not mutated.
 * Throws when a fragment redefines an existing leaf or replaces an object with a string (or back).
 * @param {MessageTree} base
 * @param {readonly MessageFragment[]} fragments
 * @returns {MessageTree}
 */
export function mergeMessageFragments(base, fragments) {
  let merged = base
  for (const fragment of fragments) {
    if (!isMessageObject(fragment.messages)) {
      throw new Error(`${fragment.file}: a message fragment is a JSON object of the ${fragment.namespace} namespace`)
    }
    merged = mergeTree(merged, { [fragment.namespace]: fragment.messages }, '', fragment.file)
  }
  return merged
}

function mergeTree(target, source, keyPath, file) {
  const output = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const childPath = keyPath ? `${keyPath}.${key}` : key
    if (!(key in output)) {
      output[key] = value
    } else if (isMessageObject(output[key]) && isMessageObject(value)) {
      output[key] = mergeTree(output[key], value, childPath, file)
    } else {
      throw new Error(`${file}: message key ${childPath} is already defined`)
    }
  }
  return output
}

function isMessageObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

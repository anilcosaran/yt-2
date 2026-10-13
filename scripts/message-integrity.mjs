import fs from 'node:fs'
import path from 'node:path'

import { fragmentNamespace, mergeMessageFragments } from '../i18n/merge-message-fragments.mjs'

const REPLACEMENT_CHAR = '\uFFFD'
const CONTROL_IN_VALUE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/
const MOJIBAKE_SEQUENCES = [
  '\u00C3\u00BC', // ü
  '\u00C3\u00B6', // ö
  '\u00C3\u00A7', // ç
  '\u00C3\u00A9', // é
  '\u00C3\u00A8', // è
  '\u00C3\u00A1', // á
  '\u00C3\u00B1', // ñ
  '\u00C3\u0089', // É
  '\u00C3\u009C', // Ü
  '\u00C3\u0096', // Ö
  '\u00C3\u0087', // Ç
  '\u00C3\u00AE', // î
  '\u00C3\u00BB', // û
  '\u00C3\u00A0', // à
  '\u00C4\u00B1', // ı
  '\u00C4\u00B0', // İ
  '\u00C4\u009F', // ğ
  '\u00C4\u009E', // Ğ
  '\u00C5\u009F', // ş
  '\u00C5\u009E', // Ş
  '\u00E2\u20AC\u2122', // ’
  '\u00E2\u20AC\u0153', // “
  '\u00E2\u20AC\u009D', // ”
  '\u00E2\u20AC\u201C', // –
  '\u00E2\u20AC\u201D', // —
  '\u00E2\u20AC\u00A6', // …
  '\u00C2\u00A9', // ©
  '\u00C2\u00AE', // ®
]

export function inspectMessageText(text) {
  const issues = []
  if (typeof text !== 'string') return issues
  if (text.includes(REPLACEMENT_CHAR)) {
    issues.push({ kind: 'replacement-character', detail: 'U+FFFD replacement character' })
  }
  for (const sequence of MOJIBAKE_SEQUENCES) {
    if (text.includes(sequence)) {
      issues.push({ kind: 'mojibake', detail: sequence })
      break
    }
  }
  if (CONTROL_IN_VALUE.test(text)) {
    issues.push({ kind: 'forbidden-control', detail: 'C0/C1 control character' })
  }
  return issues
}

function skipQuotedIcuLiteral(text, index) {
  if (text[index] !== "'") return index
  const next = text[index + 1]
  if (next === "'") return index + 2
  if (next === '{' || next === '}') {
    let i = index + 1
    while (i < text.length && text[i] !== "'") i += 1
    return Math.min(i + 1, text.length)
  }
  return index + 1
}

function matchingBraceIndex(text, openIndex) {
  let depth = 0
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "'") {
      i = skipQuotedIcuLiteral(text, i) - 1
      continue
    }
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return text.length - 1
}

function scanIcuArguments(text, start, end, names) {
  let i = start
  while (i < end) {
    if (text[i] === "'") {
      i = skipQuotedIcuLiteral(text, i)
      continue
    }
    if (text[i] !== '{') {
      i += 1
      continue
    }

    const identMatch = text.slice(i + 1).match(/^([A-Za-z_][A-Za-z0-9_]*)/)
    if (!identMatch) {
      i += 1
      continue
    }

    const ident = identMatch[1]
    const afterIdent = i + 1 + ident.length
    names.add(ident)
    if (text[afterIdent] === '}') {
      i = afterIdent + 1
      continue
    }

    const typeMatch = text.slice(afterIdent).match(/^,\s*(plural|select|selectordinal)\s*,/)
    if (typeMatch) {
      const blockEnd = matchingBraceIndex(text, i)
      scanIcuSelectOrPluralBody(text, afterIdent + typeMatch[0].length, blockEnd, names)
      i = blockEnd + 1
      continue
    }

    i += 1
  }
}

function scanIcuSelectOrPluralBody(text, start, end, names) {
  let i = start
  while (i < end) {
    while (i < end && /\s/.test(text[i])) i += 1
    if (i >= end) break
    if (text.startsWith('offset:', i)) {
      i += 7
      while (i < end && /[0-9]/.test(text[i])) i += 1
      continue
    }
    while (i < end && !/\s|\{/.test(text[i])) i += 1
    while (i < end && /\s/.test(text[i])) i += 1
    if (text[i] === '{') {
      const messageEnd = matchingBraceIndex(text, i)
      scanIcuArguments(text, i + 1, messageEnd, names)
      i = messageEnd + 1
      continue
    }
    i += 1
  }
}

export function icuArgumentNames(text) {
  const names = new Set()
  if (typeof text !== 'string') return names
  scanIcuArguments(text, 0, text.length, names)
  return names
}

export function flattenMessages(value, prefix = '', output = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenMessages(child, prefix ? `${prefix}.${key}` : key, output)
    }
    return output
  }
  output.set(prefix, value)
  return output
}

export function listLocaleFiles(messagesDir) {
  if (!fs.existsSync(messagesDir)) return []
  return fs
    .readdirSync(messagesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      locale: name.replace(/\.json$/u, ''),
      fileName: name,
      filePath: path.join(messagesDir, name),
    }))
}

export function listTranslationSourceFiles(scriptsDir) {
  if (!fs.existsSync(scriptsDir)) return []
  return fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith('.json') && /translat/i.test(name))
    .sort()
    .map((name) => path.join(scriptsDir, name))
}

export function readSupportedLocales(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return null
  const match = fs.readFileSync(configPath, 'utf8').match(/SUPPORTED_LOCALES\s*=\s*\[([^\]]+)\]/)
  if (!match) return null
  return [...match[1].matchAll(/['"]([A-Za-z]{2}(?:-[A-Za-z]{2})?)['"]/g)].map((entry) => entry[1])
}

function decodeUtf8OrIssue(filePath) {
  const bytes = fs.readFileSync(filePath)
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, issue: null }
  } catch (error) {
    return {
      text: null,
      issue: {
        file: filePath,
        key: '',
        locale: '',
        kind: 'invalid-utf8',
        detail: error instanceof Error ? error.message : 'Invalid UTF-8',
      },
    }
  }
}

function collectStringIssues(value, file, locale, keyPrefix, issues) {
  if (typeof value === 'string') {
    for (const issue of inspectMessageText(value)) {
      issues.push({ file, key: keyPrefix, locale, ...issue })
    }
    if (value.trim() === '') {
      issues.push({ file, key: keyPrefix, locale, kind: 'blank-value', detail: 'empty string' })
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      collectStringIssues(child, file, locale, `${keyPrefix}[${index}]`, issues)
    })
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStringIssues(child, file, locale, keyPrefix ? `${keyPrefix}.${key}` : key, issues)
    }
  }
}

/** Merges `messages/<locale>/<Namespace>[.<feature>].json` fragments; parity is checked on the result. */
function mergeLocaleFragments(messagesDir, locale, catalog, issues) {
  const directory = path.join(messagesDir, locale)
  if (!fs.existsSync(directory)) return catalog
  let merged = catalog
  for (const name of fs.readdirSync(directory).sort()) {
    const file = `${locale}/${name}`
    const namespace = fragmentNamespace(name)
    if (!namespace) {
      issues.push({ file, key: '', locale, kind: 'invalid-fragment-name', detail: 'use <Namespace>[.<feature>].json' })
      continue
    }
    const decoded = decodeUtf8OrIssue(path.join(directory, name))
    if (decoded.issue) {
      issues.push({ ...decoded.issue, file, locale })
      continue
    }
    let messages
    try {
      messages = JSON.parse(decoded.text)
    } catch (error) {
      issues.push({ file, key: '', locale, kind: 'invalid-json', detail: error instanceof Error ? error.message : 'Invalid JSON' })
      continue
    }
    collectStringIssues(messages, file, locale, namespace, issues)
    try {
      merged = mergeMessageFragments(merged, [{ file, namespace, messages }])
    } catch (error) {
      issues.push({ file, key: namespace, locale, kind: 'fragment-conflict', detail: error instanceof Error ? error.message : String(error) })
    }
  }
  return merged
}

function compareLocaleParity(catalogs, issues) {
  const base = catalogs.find((catalog) => catalog.locale === 'en') ?? catalogs[0]
  if (!base) return

  for (const catalog of catalogs) {
    if (catalog === base) continue
    for (const key of base.keys.keys()) {
      if (!catalog.keys.has(key)) {
        issues.push({
          file: catalog.fileName,
          key,
          locale: catalog.locale,
          kind: 'missing-key',
          detail: `missing in ${catalog.locale}; present in ${base.locale}`,
        })
      }
    }
    for (const key of catalog.keys.keys()) {
      if (!base.keys.has(key)) {
        issues.push({
          file: catalog.fileName,
          key,
          locale: catalog.locale,
          kind: 'extra-key',
          detail: `not present in ${base.locale}`,
        })
      }
    }
    for (const [key, baseValue] of base.keys) {
      if (!catalog.keys.has(key)) continue
      const localeValue = catalog.keys.get(key)
      if (typeof baseValue !== 'string' || typeof localeValue !== 'string') continue
      const expected = [...icuArgumentNames(baseValue)].sort()
      const actual = [...icuArgumentNames(localeValue)].sort()
      if (expected.join('\0') !== actual.join('\0')) {
        issues.push({
          file: catalog.fileName,
          key,
          locale: catalog.locale,
          kind: 'placeholder-mismatch',
          detail: `${base.locale}[${expected.join(', ') || 'none'}] vs ${catalog.locale}[${actual.join(', ') || 'none'}]`,
        })
      }
    }
  }
}

function compareSupportedLocales(catalogs, supportedLocales, issues) {
  if (!supportedLocales) return
  const actual = new Set(catalogs.map((catalog) => catalog.locale))
  const expected = new Set(supportedLocales)
  for (const locale of expected) {
    if (!actual.has(locale)) {
      issues.push({
        file: `${locale}.json`,
        key: '',
        locale,
        kind: 'missing-locale-file',
        detail: `SUPPORTED_LOCALES includes ${locale} but messages/${locale}.json is missing`,
      })
    }
  }
  for (const locale of actual) {
    if (!expected.has(locale)) {
      issues.push({
        file: `${locale}.json`,
        key: '',
        locale,
        kind: 'unexpected-locale-file',
        detail: `messages/${locale}.json exists but SUPPORTED_LOCALES does not include ${locale}`,
      })
    }
  }
}

/**
 * @param {{
 *   messagesDir: string,
 *   extraFiles?: string[],
 *   supportedLocales?: string[] | null,
 *   configPath?: string,
 * }} options
 */
export function checkMessageIntegrity({
  messagesDir,
  extraFiles = [],
  supportedLocales = null,
  configPath,
}) {
  const issues = []
  const catalogs = []
  const expectedLocales = supportedLocales ?? readSupportedLocales(configPath)

  for (const localeFile of listLocaleFiles(messagesDir)) {
    const decoded = decodeUtf8OrIssue(localeFile.filePath)
    if (decoded.issue) {
      issues.push({ ...decoded.issue, file: localeFile.fileName, locale: localeFile.locale })
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(decoded.text)
    } catch (error) {
      issues.push({
        file: localeFile.fileName,
        key: '',
        locale: localeFile.locale,
        kind: 'invalid-json',
        detail: error instanceof Error ? error.message : 'Invalid JSON',
      })
      continue
    }
    collectStringIssues(parsed, localeFile.fileName, localeFile.locale, '', issues)
    parsed = mergeLocaleFragments(messagesDir, localeFile.locale, parsed, issues)
    catalogs.push({
      locale: localeFile.locale,
      fileName: localeFile.fileName,
      keys: flattenMessages(parsed),
    })
  }

  compareLocaleParity(catalogs, issues)
  compareSupportedLocales(catalogs, expectedLocales, issues)

  for (const extraFile of extraFiles) {
    const relative = path.basename(extraFile)
    const decoded = decodeUtf8OrIssue(extraFile)
    if (decoded.issue) {
      issues.push({ ...decoded.issue, file: relative })
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(decoded.text)
    } catch (error) {
      issues.push({
        file: relative,
        key: '',
        locale: '',
        kind: 'invalid-json',
        detail: error instanceof Error ? error.message : 'Invalid JSON',
      })
      continue
    }
    collectStringIssues(parsed, relative, '', '', issues)
  }

  return {
    ok: issues.length === 0,
    localeCount: catalogs.length,
    locales: catalogs.map((catalog) => catalog.locale),
    keyCount: catalogs[0]?.keys.size ?? 0,
    issues,
  }
}

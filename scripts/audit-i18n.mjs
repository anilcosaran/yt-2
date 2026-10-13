import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourceRoots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['app', 'components', 'hooks', 'lib']
const ignoredPathParts = new Set(['node_modules', '.next'])
const ignoredFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/
const visibleAttributeNames = new Set([
  'aria-description',
  'aria-label',
  'alt',
  'description',
  'label',
  'placeholder',
  'title',
])
const visiblePropertyNames = new Set([
  'allowance',
  'description',
  'detail',
  'emptyMessage',
  'errorMessage',
  'helperText',
  'hint',
  'label',
  'message',
  'name',
  'placeholder',
  'subtitle',
  'title',
])
const visibleCallNames = new Set([
  'alert',
  'confirm',
  'prompt',
  'toast',
])

const findings = []

for (const sourceRoot of sourceRoots) {
  const absoluteRoot = path.join(projectRoot, sourceRoot)
  if (!fs.existsSync(absoluteRoot)) continue
  visitDirectory(absoluteRoot)
}

findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)

for (const finding of findings) {
  process.stdout.write(`${finding.file}:${finding.line}:${finding.column} [${finding.kind}] ${JSON.stringify(finding.text)}\n`)
}

process.stdout.write(`\n${findings.length} possible hard-coded UI messages found.\n`)
process.exitCode = findings.length > 0 ? 1 : 0

function visitDirectory(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (ignoredPathParts.has(entry.name)) continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      visitDirectory(absolutePath)
      continue
    }
    if (!entry.isFile() || !/\.[cm]?[jt]sx?$/.test(entry.name) || ignoredFilePattern.test(entry.name)) continue
    auditFile(absolutePath)
  }
}

function auditFile(absolutePath) {
  const sourceText = fs.readFileSync(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const relativePath = path.relative(projectRoot, absolutePath).replaceAll('\\', '/')

  function report(node, kind, text) {
    const normalized = normalizeVisibleText(text)
    if (!isHumanFacingText(normalized)) return
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    findings.push({
      file: relativePath,
      line: position.line + 1,
      column: position.character + 1,
      kind,
      text: normalized,
    })
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      report(node, 'jsx-text', node.text)
    } else if (ts.isJsxAttribute(node) && visibleAttributeNames.has(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        report(node.initializer, `jsx-${node.name.text}`, node.initializer.text)
      } else if (node.initializer && ts.isJsxExpression(node.initializer)) {
        const expression = node.initializer.expression
        if (expression && ts.isStringLiteralLike(expression)) {
          report(expression, `jsx-${node.name.text}`, expression.text)
        } else if (expression && ts.isNoSubstitutionTemplateLiteral(expression)) {
          report(expression, `jsx-${node.name.text}`, expression.text)
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyName(node.name)
      if (propertyName && visiblePropertyNames.has(propertyName)) {
        if (ts.isStringLiteralLike(node.initializer)) {
          report(node.initializer, `property-${propertyName}`, node.initializer.text)
        } else if (ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
          report(node.initializer, `property-${propertyName}`, node.initializer.text)
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callName = getCallName(node.expression)
      if (callName && visibleCallNames.has(callName)) {
        for (const argument of node.arguments) {
          if (ts.isStringLiteralLike(argument)) report(argument, `call-${callName}`, argument.text)
          if (ts.isNoSubstitutionTemplateLiteral(argument)) report(argument, `call-${callName}`, argument.text)
        }
      }
      if (callName && ['error', 'info', 'success', 'warning'].includes(callName)) {
        const firstArgument = node.arguments[0]
        if (firstArgument && ts.isStringLiteralLike(firstArgument)) {
          report(firstArgument, `toast-${callName}`, firstArgument.text)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return null
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

function normalizeVisibleText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function isHumanFacingText(value) {
  if (!value || value.length < 2) return false
  if (!/[\p{L}]/u.test(value)) return false
  if (/^(?:https?:|data:|\/|#|--|[a-z][a-z0-9+.-]*:)/i.test(value)) return false
  if (/^[a-z0-9_.:/-]+$/.test(value) && !value.includes(' ')) return false
  if (/^(?:GET|POST|PUT|PATCH|DELETE|USD|GBP|EUR|TRY|API|ID|URL|HTTP|JSON)$/i.test(value)) return false
  return true
}

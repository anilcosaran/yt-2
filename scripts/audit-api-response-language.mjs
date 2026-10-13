import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const apiRoot = path.resolve(process.cwd(), '..', 'api-gateway', 'src')
const terms = /(?:bor[çc]|ödeme|odeme|kredi|kanal|oluştur|olustur|güncelle|guncelle|bulunamad|geçersiz|gecersiz|hata|başar|basar|yetersiz|kısıt|kisit|kaldır|kaldir|depolama|tahsil)/iu
const findings = []

visit(apiRoot)
for (const finding of findings) process.stdout.write(`${finding}\n`)
process.stdout.write(`\n${findings.length} possible non-English API/error string literals found.\n`)
process.exitCode = findings.length > 0 ? 1 : 0

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(absolute)
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue
    const relative = path.relative(apiRoot, absolute).replaceAll('\\', '/')
    if (!relative.includes('/http/') && !/(?:error|router|schema)/i.test(entry.name)) continue
    auditFile(absolute, relative)
  }
}

function auditFile(absolute, relative) {
  const source = fs.readFileSync(absolute, 'utf8')
  const file = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  visitNode(file)

  function visitNode(node) {
    if (ts.isStringLiteralLike(node) && terms.test(node.text)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
      findings.push(`${relative}:${line}: ${JSON.stringify(node.text)}`)
    }
    ts.forEachChild(node, visitNode)
  }
}

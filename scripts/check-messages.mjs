import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { checkMessageIntegrity, listTranslationSourceFiles } from './message-integrity.mjs'
import { FRAGMENT_INDEX, listMessageFragments, renderFragmentIndex } from './message-fragments.mjs'

const projectRoot = process.cwd()
const result = checkMessageIntegrity({
  messagesDir: path.join(projectRoot, 'messages'),
  extraFiles: listTranslationSourceFiles(path.join(projectRoot, 'scripts')),
  configPath: path.join(projectRoot, 'i18n', 'config.ts'),
})

const fragmentIndex = fs.existsSync(FRAGMENT_INDEX) ? fs.readFileSync(FRAGMENT_INDEX, 'utf8').replace(/\r\n/g, '\n') : ''
if (fragmentIndex !== renderFragmentIndex(listMessageFragments())) {
  console.error('i18n/message-fragments.generated.ts is stale. Run `npm run i18n:fragments` and commit the result.')
  process.exit(1)
}

if (!result.ok) {
  console.error(JSON.stringify({
    locales: result.locales,
    issueCount: result.issues.length,
    issues: result.issues,
  }, null, 2))
  process.exit(1)
}

console.log(
  `Message integrity OK: ${result.localeCount} locale(s) [${result.locales.join(', ')}], ${result.keyCount} keys, UTF-8/mojibake/placeholder checks passed.`,
)

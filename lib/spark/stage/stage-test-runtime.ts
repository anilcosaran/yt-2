import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MOTION_RUNTIME_ASSET } from './motion-runtime-asset.generated'
import type { MotionRuntimeModule } from './runtime-api'

/**
 * Test helper: evaluates the VENDORED browser runtime (`public/motion-runtime/…js`, the exact file the editor ships and
 * loads as a classic script) and returns its module, so stage tests draw with the real pinned runtime, never a double.
 */
let cached: MotionRuntimeModule | null = null

export function loadVendoredRuntime(): MotionRuntimeModule {
  if (cached) return cached
  const file = join(process.cwd(), 'public', MOTION_RUNTIME_ASSET.path.replace(/^\//, ''))
  const text = readFileSync(file, 'utf8')
  cached = new Function(`${text}\nreturn YoutorchMotionRuntime;`)() as MotionRuntimeModule
  return cached
}

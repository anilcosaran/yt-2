import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import type { StageCoverageChecker } from './stage-types'

const coverageResponseSchema = z.object({
  data: z
    .object({
      status: z.enum(['covered', 'glyph_missing', 'unsupported_script']),
      missing_count: z.number().int().min(0),
    })
    .passthrough(),
})

/**
 * `POST /api/v1/brand/fonts/coverage` (`font_coverage_check_v1`): does the pinned face set this text (F45)? The stage asks
 * before an inline text commit; the answer only warns (a hint under the text controls), the command path stays the
 * validator.
 */
export function createStageCoverageChecker(request: typeof gatewayRequest = gatewayRequest): StageCoverageChecker {
  return {
    async check({ text, lang, font }) {
      const result = await request('/api/v1/brand/fonts/coverage', {
        method: 'POST',
        csrf: true,
        body: { text, lang, font },
        schema: coverageResponseSchema,
      })
      return { status: result.data.status, missingCount: result.data.missing_count }
    },
  }
}

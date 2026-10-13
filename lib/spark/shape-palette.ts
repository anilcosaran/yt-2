import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { FALLBACK_SHAPE_FILL } from './stage/shape-model'

/**
 * E1-B (D4) the colours the shapes drawer offers: the project's pinned Brand Kit (`GET .../projects/{id}/brand-kit`, P02-02:
 * `freeform_defaults.shape.fill` is the Kit's default for a NEW freeform shape, Q11, then the four Kit colours), plus white
 * and black. Read-only and optional: a project without a Kit, or a read that fails, falls back to the studio accent
 * (`--st-accent`, else its light-theme value), and the drawer works the same. Nothing is stored in the browser.
 */

const hex6 = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

export const projectBrandKitSchema = z.object({
  data: z
    .object({
      status: z.string(),
      brand_kit: z
        .object({
          content: z.object({ colors: z.object({ primary: hex6, secondary: hex6, tertiary: hex6, accent: hex6 }).passthrough() }).passthrough(),
          freeform_defaults: z.object({ shape: z.object({ fill: z.string() }).passthrough() }).passthrough(),
        })
        .passthrough()
        .nullable(),
    })
    .passthrough(),
})

export type ShapePalette = {
  /** Colour of a new shape before the user picks one: the Kit's freeform default, else the studio accent. */
  defaultFill: string
  /** The swatches in order: Kit colours first (de-duplicated), then white and black. */
  swatches: string[]
  /** Where the default came from (the drawer shows a hint only for the Kit). */
  source: 'kit' | 'studio'
}

const NEUTRALS = ['#ffffff', '#000000']

const norm = (value: string): string => value.toLowerCase()

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = norm(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** `--st-accent` of the studio as a `#rrggbb`, or null when it is not one (a dark-theme `oklch(...)`, no CSS: tests). */
export function studioAccentHex(element: Element | null): string | null {
  if (!element) return null
  const view = element.ownerDocument.defaultView
  const raw = view?.getComputedStyle(element).getPropertyValue('--st-accent').trim() ?? ''
  if (/^#[0-9a-f]{6}$/i.test(raw)) return norm(raw)
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw)
  return short ? norm(`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`) : null
}

/** The palette of a Kit-less project: the studio accent (or its light-theme value) and the neutrals. */
export function studioPalette(accent: string | null): ShapePalette {
  const defaultFill = accent ?? FALLBACK_SHAPE_FILL
  return { defaultFill, swatches: unique([defaultFill, ...NEUTRALS]), source: 'studio' }
}

export function paletteFromKit(wire: z.output<typeof projectBrandKitSchema>, accent: string | null): ShapePalette {
  const kit = wire.data.brand_kit
  if (!kit) return studioPalette(accent)
  const colors = kit.content.colors
  const freeform = hex6.safeParse(kit.freeform_defaults.shape.fill)
  const defaultFill = norm(freeform.success ? freeform.data : colors.primary)
  return { defaultFill, swatches: unique([defaultFill, colors.primary, colors.secondary, colors.tertiary, colors.accent, ...NEUTRALS].map(norm)), source: 'kit' }
}

/** Reads the palette of a project; never rejects (a failed or empty read is the studio palette). */
export async function loadShapePalette(
  projectId: string,
  options: { signal?: AbortSignal; accent?: string | null; request?: typeof gatewayRequest } = {},
): Promise<ShapePalette> {
  const request = options.request ?? gatewayRequest
  const accent = options.accent ?? null
  try {
    const wire = await request(`/api/v1/composition/projects/${encodeURIComponent(projectId)}/brand-kit`, { schema: projectBrandKitSchema, signal: options.signal })
    return paletteFromKit(wire, accent)
  } catch {
    return studioPalette(accent)
  }
}

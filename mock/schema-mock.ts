// Builds believable mock data from a zod (v3) schema. Every API module in lib/ still declares the response
// schema it expects; instead of calling a server, mock/gateway.ts asks this generator for a value that passes
// that schema. Field names steer the content (ids → uuids, *_at → dates, title → sample titles, status →
// "happy" states, cursors → end of list), and the request path keeps ids consistent between a list and the
// detail page it links to.

import type { ZodTypeAny } from 'zod'

import { sampleRegex } from './regex-sample'
import { repair, safeParse } from './repair'
import {
  MOCK_AVATAR,
  MOCK_IMAGE,
  pickMockImage,
  MOCK_LOGO,
  MOCK_PEOPLE,
  MOCK_SENTENCES,
  MOCK_TAGS,
  MOCK_TITLES,
} from './vocabulary'

export type Rng = () => number
export type MockMode = 'rich' | 'minimal'

type Ctx = {
  rng: Rng
  mode: MockMode
  depth: number
  key: string
  parentKey: string
  inArray: boolean
  index: number
  pathIds: PathIds
  budget: { nodes: number }
}

type PathIds = { last: string | null; byKey: Map<string, string> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDef = any

const NODE_BUDGET = 25_000
const MAX_DEPTH = 14
const NOW = Date.now()

export function createRng(seedText: string): Rng {
  let seed = 2166136261
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function extractPathIds(path: string): PathIds {
  const segments = path.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
  const byKey = new Map<string, string>()
  let last: string | null = null
  segments.forEach((segment, index) => {
    if (!looksLikeId(segment)) return
    last = segment
    const owner = segments[index - 1]
    if (!owner || looksLikeId(owner)) return
    const singular = owner.replace(/-/g, '_').replace(/ies$/, 'y').replace(/s$/, '')
    byKey.set(`${singular}_id`, segment)
    byKey.set(`${toCamel(singular)}Id`, segment)
  })
  return { last, byKey }
}

export function generateFromSchema(
  schema: ZodTypeAny,
  options: { seed: string; mode: MockMode; path?: string },
): unknown {
  const ctx: Ctx = {
    rng: createRng(options.seed),
    mode: options.mode,
    depth: 0,
    key: '',
    parentKey: '',
    inArray: false,
    index: 0,
    pathIds: extractPathIds(options.path ?? ''),
    budget: { nodes: 0 },
  }
  return gen(schema, ctx)
}

function gen(schema: ZodTypeAny, ctx: Ctx): unknown {
  ctx.budget.nodes += 1
  const def: AnyDef = (schema as AnyDef)?._def
  if (!def) return undefined

  switch (def.typeName) {
    case 'ZodString':
      return genString(def, ctx)
    case 'ZodNumber':
      return genNumber(def, ctx)
    case 'ZodBigInt':
      return BigInt(1)
    case 'ZodBoolean':
      return genBoolean(ctx)
    case 'ZodDate':
      return new Date(recentTime(ctx))
    case 'ZodLiteral':
      return def.value
    case 'ZodEnum':
      return pickEnum(def.values as unknown[], ctx)
    case 'ZodNativeEnum': {
      const object = def.values as Record<string, unknown>
      const values = Object.keys(object)
        .filter((key) => typeof object[object[key] as string] !== 'number')
        .map((key) => object[key])
      return pickEnum(values, ctx)
    }
    case 'ZodObject':
      return genObject(def, ctx)
    case 'ZodArray':
      return genArray(def, ctx)
    case 'ZodTuple':
      return (def.items as ZodTypeAny[]).map((item, index) => gen(item, { ...ctx, index, depth: ctx.depth + 1 }))
    case 'ZodRecord':
      return genRecord(def, ctx)
    case 'ZodMap':
      return new Map()
    case 'ZodSet':
      return new Set()
    case 'ZodUnion':
      return genUnion(def.options as ZodTypeAny[], ctx, false)
    case 'ZodDiscriminatedUnion':
      return genUnion(
        Array.isArray(def.options) ? def.options : [...(def.options as Map<unknown, ZodTypeAny>).values()],
        ctx,
        true,
      )
    case 'ZodIntersection': {
      const left = gen(def.left, ctx)
      const right = gen(def.right, ctx)
      return isPlainObject(left) && isPlainObject(right) ? { ...left, ...right } : left
    }
    case 'ZodOptional':
      // An optional literal is a flag such as `deliveryStatus: 'payment_review'`: the unusual state, so leave it out.
      if (def.innerType?._def?.typeName === 'ZodLiteral') return undefined
      if (preferAbsent(ctx) || ctx.mode === 'minimal' || ctx.rng() < 0.08) return undefined
      return gen(def.innerType, ctx)
    case 'ZodNullable':
      if (preferAbsent(ctx) || ctx.mode === 'minimal' || ctx.rng() < 0.08) return null
      return gen(def.innerType, ctx)
    case 'ZodDefault':
      return ctx.mode === 'minimal' ? undefined : gen(def.innerType, ctx)
    case 'ZodCatch':
      return genValidated(def.innerType, ctx)
    case 'ZodEffects':
      return gen(def.schema, ctx)
    case 'ZodPipeline':
      return gen(def.in, ctx)
    case 'ZodLazy':
      if (ctx.depth > MAX_DEPTH) return undefined
      return gen(def.getter(), ctx)
    case 'ZodBranded':
      return gen(def.type, ctx)
    case 'ZodReadonly':
      return gen(def.innerType, ctx)
    case 'ZodPromise':
      return Promise.resolve(gen(def.type, ctx))
    case 'ZodNull':
      return null
    case 'ZodNaN':
      return Number.NaN
    case 'ZodAny':
    case 'ZodUnknown':
      return {}
    case 'ZodFunction':
      return () => undefined
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------------------------------------
// objects, arrays, unions

function genObject(def: AnyDef, ctx: Ctx) {
  const shape = (typeof def.shape === 'function' ? def.shape() : def.shape) as Record<string, ZodTypeAny>
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(shape)) {
    const value = gen(child, { ...ctx, key, parentKey: ctx.key, depth: ctx.depth + 1, index: ctx.index })
    if (value !== undefined) out[key] = value
  }
  // Keep "total"/"count" consistent with the list beside it so pagers do not ask for more pages.
  const list = Object.values(out).find(Array.isArray) as unknown[] | undefined
  if (list) {
    for (const key of ['total', 'total_count', 'totalCount', 'count', 'total_items', 'totalItems']) {
      if (typeof out[key] === 'number') out[key] = list.length
    }
  }
  return out
}

function genArray(def: AnyDef, ctx: Ctx) {
  const min = def.exactLength?.value ?? def.minLength?.value ?? 0
  const max = def.exactLength?.value ?? def.maxLength?.value ?? Number.POSITIVE_INFINITY
  let length: number
  if (ctx.mode === 'minimal' || ctx.budget.nodes > NODE_BUDGET || ctx.depth > 8) length = min
  else if (ctx.depth <= 2) length = 6
  else if (ctx.depth <= 4) length = 3
  else length = 2
  length = Math.max(min, Math.min(max, length))
  const items: unknown[] = []
  for (let index = 0; index < length; index += 1) {
    items.push(gen(def.type, { ...ctx, inArray: true, index, depth: ctx.depth + 1 }))
  }
  return items
}

function genRecord(def: AnyDef, ctx: Ctx) {
  if (ctx.mode === 'minimal') return {}
  const keyDef: AnyDef = unwrap(def.keyType)?._def
  let keys: string[]
  if (keyDef?.typeName === 'ZodEnum') keys = (keyDef.values as string[]).slice(0, 4)
  else if (keyDef?.typeName === 'ZodLiteral') keys = [String(keyDef.value)]
  else if (keyDef?.typeName === 'ZodString' && (keyDef.checks ?? []).length > 0) {
    keys = [0, 1].map((index) => {
      const generated = gen(def.keyType, { ...ctx, key: 'key', index })
      return typeof generated === 'string' && generated ? generated : `item_${index + 1}`
    })
  } else {
    keys = ['item_1', 'item_2']
  }
  const out: Record<string, unknown> = {}
  keys.forEach((key, index) => {
    out[key] = gen(def.valueType, { ...ctx, key, parentKey: ctx.key, index, depth: ctx.depth + 1 })
  })
  return out
}

function genUnion(options: ZodTypeAny[], ctx: Ctx, rotate: boolean) {
  if (options.length === 0) return undefined
  const allLiterals = options.every((option) => (option as AnyDef)._def?.typeName === 'ZodLiteral')
  if (allLiterals) return pickEnum(options.map((option) => (option as AnyDef)._def.value), ctx)
  const start = rotate && ctx.mode === 'rich' ? Math.floor(ctx.rng() * options.length) : 0
  let first: unknown
  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length]
    const value = gen(option, ctx)
    if (offset === 0) first = value
    if (safeCheck(option, value)) return value
  }
  return first
}

/**
 * `.catch()` would silently swap an invalid generated value for its fallback (often `[]` or `null`), so a list
 * could come out empty. Validate and patch the subtree first.
 */
function genValidated(schema: ZodTypeAny, ctx: Ctx) {
  const value = gen(schema, ctx)
  if (ctx.budget.nodes > NODE_BUDGET || typeof value !== 'object' || value === null) return value
  for (let round = 0; round < 4; round += 1) {
    const parsed = safeParse(schema, value)
    if (parsed.success || !repair(value, parsed.issues)) break
  }
  return value
}

// ---------------------------------------------------------------------------------------------------------
// scalars

function genString(def: AnyDef, ctx: Ctx): string {
  const checks = (def.checks ?? []) as AnyDef[]
  const has = (kind: string) => checks.find((check) => check.kind === kind)
  const minLength = Math.max(
    0,
    ...checks.filter((check) => check.kind === 'min' || check.kind === 'length').map((check) => check.value as number),
  )
  const maxLength = Math.min(
    Number.POSITIVE_INFINITY,
    ...checks.filter((check) => check.kind === 'max' || check.kind === 'length').map((check) => check.value as number),
  )

  let value: string | null = null
  const fromPath = pathIdFor(ctx)
  const regexes = checks.filter((check) => check.kind === 'regex').map((check) => check.regex as RegExp)

  if (fromPath && regexes.every((regex) => testRegex(regex, fromPath)) && (!has('uuid') || isUuid(fromPath))) {
    value = fromPath
  } else if (regexes.length > 0) {
    for (let attempt = 0; attempt < 6 && value === null; attempt += 1) {
      const candidate = sampleRegex(regexes[0], ctx.rng)
      if (candidate !== null && regexes.every((regex) => testRegex(regex, candidate))) value = candidate
    }
  } else if (has('uuid')) value = uuid(ctx)
  else if (has('email')) value = 'demo@yt-2.dev'
  else if (has('url')) value = mockUrl(ctx, true)
  else if (has('datetime')) value = isoDate(ctx, has('datetime'))
  else if (has('date')) value = isoDate(ctx).slice(0, 10)
  else if (has('time')) value = '10:30:00'
  else if (has('duration')) value = 'PT1M30S'
  else if (has('ip')) value = '192.168.1.10'
  else if (has('cidr')) value = '10.0.0.0/24'
  else if (has('base64')) value = 'bW9jay1kYXRh'
  else if (has('base64url')) value = 'bW9jay1kYXRh'
  else if (has('nanoid')) value = randomChars(ctx, 21, 'abcdefghijklmnopqrstuvwxyz0123456789_-')
  else if (has('cuid')) value = `c${randomChars(ctx, 24, 'abcdefghijklmnopqrstuvwxyz0123456789')}`
  else if (has('cuid2')) value = randomChars(ctx, 24, 'abcdefghijklmnopqrstuvwxyz0123456789')
  else if (has('ulid')) value = `01J${randomChars(ctx, 23, '0123456789ABCDEFGHJKMNPQRSTVWXYZ')}`
  else if (has('emoji')) value = '🔥'
  else if (has('jwt')) value = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ5dC0yIn0.bW9jaw'

  if (value === null) value = stringForKey(ctx)

  const startsWith = has('startsWith')?.value as string | undefined
  const endsWith = has('endsWith')?.value as string | undefined
  const includes = has('includes')?.value as string | undefined
  if (startsWith && !value.startsWith(startsWith)) value = startsWith + value
  if (includes && !value.includes(includes)) value = value + includes
  if (endsWith && !value.endsWith(endsWith)) value = value + endsWith
  if (value.length < minLength) value = value.padEnd(minLength, value.length > 0 ? 'x' : 'a')
  if (value.length > maxLength) value = value.slice(0, Math.max(0, maxLength))
  if (has('toLowerCase')) value = value.toLowerCase()
  if (has('toUpperCase')) value = value.toUpperCase()
  if (has('trim')) value = value.trim() || 'x'
  return value
}

function stringForKey(ctx: Ctx): string {
  const key = normalizeKey(ctx.key || ctx.parentKey)
  const listKey = normalizeKey(ctx.parentKey)
  const index = ctx.index
  const pick = <T,>(list: T[]) => list[(index + Math.floor(ctx.rng() * list.length)) % list.length]

  if (isNumericKey(key)) return String(numberForKey(key, ctx.rng(), {}))
  if (/(^|_)(id|uid|uuid|ids)$/.test(key) || key === 'key' && listKey.endsWith('ids')) return pathIdFor(ctx) ?? uuid(ctx)
  if (/(^|_)(at|date|time|timestamp|since|until|deadline)$/.test(key) || /^(created|updated|deleted|expires|started|finished|completed)/.test(key)) return isoDate(ctx)
  if (/email/.test(key)) return 'demo@yt-2.dev'
  if (/avatar|profile_image|photo/.test(key)) return MOCK_AVATAR
  if (/logo/.test(key)) return MOCK_LOGO
  if (/(image|thumbnail|thumb|poster|cover|preview|frame|picture|banner)/.test(key)) return pickMockImage(`${key}.${ctx.index}.${ctx.depth}`)
  if (/(url|uri|href|link|src|source_url|location)$/.test(key)) return mockUrl(ctx, false)
  if (/(first_name|given_name)/.test(key)) return pick(MOCK_PEOPLE).split(' ')[0]
  if (/(last_name|family_name|surname)/.test(key)) return pick(MOCK_PEOPLE).split(' ')[1]
  if (/(author|owner_name|user_name|full_name|creator|assignee|actor)/.test(key)) return pick(MOCK_PEOPLE)
  if (/(username|handle)/.test(key)) return '@yt2studio'
  if (/slug/.test(key)) return slugify(pick(MOCK_TITLES))
  if (/^(tags?|labels?|keywords?|topics?|hashtags?)$/.test(key)) return pick(MOCK_TAGS)
  if (/(name|title|label|headline|heading|caption_title)$/.test(key)) return pick(MOCK_TITLES)
  if (/(description|summary|subtitle|excerpt|caption|notes?|bio|body|text|content|message|prompt|instructions?|question|answer|reply|transcript|script|details?|hint|help|explanation|rationale|comment)$/.test(key)) return pick(MOCK_SENTENCES)
  if (/(error|failure|reason|warning)/.test(key)) return ''
  if (/(mime|content_type|media_type)/.test(key)) return /image|thumb|poster/.test(listKey) ? 'image/jpeg' : 'video/mp4'
  if (/(file_?name|filename)/.test(key)) return `video-${String(index + 1).padStart(2, '0')}.mp4`
  if (/(path|storage_key|object_key|blob_key|asset_key)$/.test(key)) return `uploads/demo/video-${String(index + 1).padStart(2, '0')}.mp4`
  if (/(extension|ext)$/.test(key)) return 'mp4'
  if (/(etag|hash|checksum|sha256|sha|digest|fingerprint)/.test(key)) return randomChars(ctx, 64, '0123456789abcdef')
  if (/(token|secret|api_key|cursor)$/.test(key)) return `mock_${randomChars(ctx, 24, 'abcdefghijklmnopqrstuvwxyz0123456789')}`
  if (/(color|colour|hex)$/.test(key)) return pick(['#7C3AED', '#F97316', '#0EA5E9', '#10B981', '#EF4444'])
  if (/(locale|language|lang)$/.test(key)) return 'tr'
  if (/currency/.test(key)) return 'USD'
  if (/country/.test(key)) return 'TR'
  if (/(timezone|time_zone|tz)$/.test(key)) return 'Europe/Istanbul'
  if (/version/.test(key)) return '1.0.0'
  if (/platform/.test(key)) return pick(['youtube', 'tiktok', 'instagram'])
  if (/(provider|vendor)$/.test(key)) return 'youtorch'
  if (/model/.test(key)) return 'yt-video-1'
  if (/(status|state|phase|stage)$/.test(key)) return 'active'
  if (/role/.test(key)) return 'owner'
  if (/(kind|type)$/.test(key)) return 'video'
  if (/format/.test(key)) return 'mp4'
  if (/(category|group|section)$/.test(key)) return pick(['Pazarlama', 'Eğitim', 'Sosyal Medya', 'Ürün'])
  if (/icon/.test(key)) return 'sparkles'
  if (/(phone|tel)$/.test(key)) return '+90 555 000 00 00'
  if (/(city|address|region)$/.test(key)) return 'İstanbul'
  if (/(code|sku)$/.test(key)) return `YT2-${randomChars(ctx, 6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}`
  if (/(voice|speaker)/.test(key)) return pick(MOCK_PEOPLE)
  if (/(font|family|typeface)/.test(key)) return pick(['Inter', 'Space Grotesk', 'Instrument Sans'])
  if (!key) return pick(MOCK_TAGS)
  return `${humanize(key)} ${index + 1}`
}

function genNumber(def: AnyDef, ctx: Ctx): number {
  const checks = (def.checks ?? []) as AnyDef[]
  const isInt = checks.some((check) => check.kind === 'int')
  const minCheck = checks.find((check) => check.kind === 'min')
  const maxCheck = checks.find((check) => check.kind === 'max')
  const multipleOf = checks.find((check) => check.kind === 'multipleOf')?.value as number | undefined
  const min = minCheck ? (minCheck.value as number) + (minCheck.inclusive ? 0 : isInt ? 1 : 0.01) : undefined
  const max = maxCheck ? (maxCheck.value as number) - (maxCheck.inclusive ? 0 : isInt ? 1 : 0.01) : undefined
  let value = numberForKey(normalizeKey(ctx.key), ctx.rng(), { max, index: ctx.index })

  if (min !== undefined && value < min) value = min
  if (max !== undefined && value > max) value = max
  if (isInt) value = Math.round(value)
  if (multipleOf) value = Math.round(value / multipleOf) * multipleOf
  if (min !== undefined && value < min) value = isInt ? Math.ceil(min) : min
  if (max !== undefined && value > max) value = isInt ? Math.floor(max) : max
  if (!isInt && !Number.isInteger(value)) value = Math.round(value * 100) / 100
  return value
}

const NUMERIC_STRING_TOKENS = new Set([
  'bytes', 'size', 'count', 'amount', 'total', 'cents', 'micros', 'balance', 'credits', 'credit', 'price', 'cost',
  'quantity', 'usd', 'ms', 'seconds', 'spend', 'budget', 'fee', 'revenue', 'charge', 'views', 'subscribers',
])

/** Keys such as `size_bytes` or `amount_usd` are often decimal strings in the API. */
function isNumericKey(key: string) {
  const tokens = key.split('_')
  return tokens.some((token) => NUMERIC_STRING_TOKENS.has(token))
    && !/(^|_)(id|ids|key|label|name|unit|currency|type|kind|status|text|display|formatted|description)$/.test(key)
}

function numberForKey(key: string, r: number, options: { max?: number; index?: number }): number {
  const parts = key.split('_')
  const tokens = new Set(parts)
  const has = (...words: string[]) => words.some((word) => tokens.has(word))
  const last = parts[parts.length - 1] ?? ''
  const index = options.index ?? 0

  if (has('percent', 'percentage', 'progress', 'pct', 'completion')) return options.max !== undefined && options.max <= 1 ? 0.55 + r * 0.4 : Math.round(40 + r * 55)
  if (has('ratio', 'score', 'confidence', 'probability', 'weight', 'opacity', 'alpha', 'volume', 'gain', 'similarity')) return 0.5 + r * 0.45
  if (has('cents', 'micros', 'minor')) return 1250 + Math.floor(r * 46000)
  if (has('price', 'amount', 'cost', 'balance', 'credit', 'credits', 'spend', 'budget', 'fee', 'usd', 'revenue', 'charge')) return Math.round((12.5 + r * 460) * 100) / 100
  if (has('count', 'total', 'quantity', 'qty', 'num', 'views', 'likes', 'subscribers', 'followers', 'uses', 'runs', 'items')) return 1 + Math.floor(r * 24)
  if (has('ms', 'latency', 'elapsed', 'timeout')) return 1500 + Math.floor(r * 88000)
  if (has('duration', 'seconds', 'sec', 'secs', 'length') || last === 's') return 5 + Math.floor(r * 175)
  if (key === 'exp' || key === 'iat' || key === 'nbf') return Math.floor(NOW / 1000) + 3600
  if (last === 'at' || has('timestamp', 'epoch')) return NOW - Math.floor(r * 9 * 24 * 3600 * 1000)
  if (has('width')) return 1920
  if (has('height')) return 1080
  if (has('fps', 'framerate') || key === 'frame_rate') return 30
  if (has('bytes', 'size')) return 1_000_000 + Math.floor(r * 480_000_000)
  if (has('year')) return 2026
  if (has('month')) return 1 + Math.floor(r * 12)
  if (has('day', 'days')) return 1 + Math.floor(r * 28)
  if (has('hour', 'hours')) return Math.floor(r * 24)
  if (has('rating', 'stars')) return 4 + Math.round(r)
  if (has('limit') || key === 'page_size' || key === 'per_page') return 20
  if (has('offset', 'skip')) return 0
  if (last === 'page') return 1
  if (has('start', 'from', 'in') || key === 'in_point') return Math.round(r * 10)
  if (has('end', 'to', 'out') || key === 'out_point') return 12 + Math.round(r * 20)
  if (has('version', 'revision', 'seq', 'sequence', 'order', 'index', 'position', 'rank', 'priority', 'level', 'step', 'attempt', 'generation')) return 1 + index
  if (has('lat', 'latitude')) return 41.01
  if (has('lng', 'lon', 'longitude')) return 28.97
  return 1 + Math.floor(r * 99)
}

function genBoolean(ctx: Ctx) {
  const key = normalizeKey(ctx.key)
  if (/(deleted|archived|disabled|error|failed|locked|blocked|restricted|suspended|revoked|expired|banned|muted|hidden|is_test|dirty|stale|truncated|has_more|has_next|more|overdue|over_limit|exceeded|requires_|needs_|pending|draft|unread|is_preview|is_demo|frozen|paused|cancel)/.test(key)) return false
  if (/(enabled|active|available|visible|allowed|verified|ready|valid|ok|success|connected|completed|published|^can_|^is_|^has_|supported|included|public)/.test(key)) return true
  return ctx.rng() < 0.6
}

function pickEnum(values: unknown[], ctx: Ctx) {
  if (values.length === 0) return undefined
  const key = normalizeKey(ctx.key)
  if (/(status|state|phase|stage|health|result|outcome)$/.test(key)) {
    const happy = values.filter((value) =>
      typeof value === 'string'
      && /^(completed?|succeeded|success|ready|active|published|done|approved|healthy|ok|available|enabled|connected|paid|delivered|valid|finished|rendered|live|open|idle)$/i.test(value),
    )
    if (happy.length > 0 && ctx.rng() < 0.75) return happy[Math.floor(ctx.rng() * happy.length)]
  }
  return values[(ctx.index + Math.floor(ctx.rng() * values.length)) % values.length]
}

// ---------------------------------------------------------------------------------------------------------
// helpers

function preferAbsent(ctx: Ctx) {
  const key = normalizeKey(ctx.key)
  return /(^|_)(next|next_cursor|cursor|next_page|next_page_token|page_token|continuation|next_offset|next_token|before|after)$/.test(key)
    || /(error|failure|failed|reason|warning|deleted|archived|cancel|revoked|expired|suspend|restrict|blocked|scheduled_cleanup|superseded|replaced_by|retry_after|problem|conflict|rejection)/.test(key)
    || /^parent(_|$)/.test(key)
    || /(delivery_status|settlement_pending|payment_review|held|hold_|quarantine|degraded|stale_reason)/.test(key)
}

function pathIdFor(ctx: Ctx): string | null {
  const key = normalizeKey(ctx.key)
  const byKey = ctx.pathIds.byKey.get(ctx.key) ?? ctx.pathIds.byKey.get(key)
  if (byKey) return byKey
  if (key === 'id' && !ctx.inArray && ctx.depth <= 3) return ctx.pathIds.last
  return null
}

function looksLikeId(segment: string) {
  if (isUuid(segment)) return true
  return segment.length >= 8 && /\d/.test(segment) && /^[A-Za-z0-9_-]+$/.test(segment) && !/^v\d+$/.test(segment)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function uuid(ctx: Ctx) {
  const hex = randomChars(ctx, 32, '0123456789abcdef')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function randomChars(ctx: Ctx, length: number, alphabet: string) {
  let out = ''
  for (let index = 0; index < length; index += 1) out += alphabet[Math.floor(ctx.rng() * alphabet.length)]
  return out
}

function recentTime(ctx: Ctx) {
  const key = normalizeKey(ctx.key)
  const future = /(expires|ends|end|until|deadline|due|renews|next|scheduled|valid_until|reset)/.test(key)
  const offset = Math.floor(ctx.rng() * 9 * 24 * 3600 * 1000) + ctx.index * 3_600_000
  return future ? NOW + offset : NOW - offset
}

function isoDate(ctx: Ctx, check?: AnyDef) {
  const iso = new Date(recentTime(ctx)).toISOString()
  if (check?.precision === 0) return iso.replace(/\.\d{3}Z$/, 'Z')
  if (typeof check?.precision === 'number' && check.precision > 0) {
    return iso.replace(/\.(\d{3})Z$/, (_, ms: string) => `.${ms.padEnd(check.precision, '0').slice(0, check.precision)}Z`)
  }
  if (check?.local && !check?.offset) return iso.replace(/Z$/, '')
  return iso
}

function mockUrl(ctx: Ctx, absolute: boolean) {
  const key = normalizeKey(`${ctx.parentKey}_${ctx.key}`)
  let path = pickMockImage(`${ctx.parentKey}.${ctx.key}.${ctx.index}.${ctx.depth}`)
  if (/avatar|photo|profile/.test(key)) path = MOCK_AVATAR
  else if (/logo/.test(key)) path = MOCK_LOGO
  else if (/(image|thumb|poster|cover|preview|frame|picture|banner|still|og)/.test(key)) path = pickMockImage(`${key}.${ctx.index}`)
  if (!absolute) return path
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100'
  return `${origin}${path}`
}

function unwrap(schema: ZodTypeAny | undefined): ZodTypeAny | undefined {
  let current = schema as AnyDef
  while (current?._def) {
    const def = current._def
    if (def.innerType) current = def.innerType
    else if (def.typeName === 'ZodEffects') current = def.schema
    else break
  }
  return current
}

function safeCheck(schema: ZodTypeAny, value: unknown) {
  try {
    return schema.safeParse(value).success
  } catch {
    return false
  }
}

function testRegex(regex: RegExp, value: string) {
  regex.lastIndex = 0
  return regex.test(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeKey(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function toCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

function humanize(key: string) {
  const text = normalizeKey(key).replace(/_/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

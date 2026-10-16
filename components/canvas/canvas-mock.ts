// What a card's (simulated) run makes, in the user's language. yt-2 has no generation backend: text comes from the
// `Canvas.mock` messages, images and video frames from sample pictures in /public.

import {
  canvasId,
  createCanvasNode,
  hostOf,
  normalizeUrl,
  optionValue,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeData,
  type CanvasResult,
} from './canvas-model'
import type { CanvasRunProducer } from './canvas-store'

export type CanvasTranslator = {
  (key: string, values?: Record<string, string | number>): string
  raw: (key: string) => unknown
}

const PICTURES = [
  '/tools/angle/front.jpg',
  '/tools/angle/front-side.jpg',
  '/tools/angle/front-elevated.jpg',
  '/tools/angle/side.jpg',
  '/tools/angle/top-down.jpg',
  '/tools/angle/back-side.jpg',
  '/brand/avatars/studio.jpg',
  '/brand/avatars/presenter.jpg',
  '/brand/avatars/anchor.jpg',
  '/brand/avatars/closeup.jpg',
]

const SPEED_FACTOR: Record<string, number> = { slow: 0.8, normal: 1, fast: 1.25 }

export function createCanvasProducer(t: CanvasTranslator, locale: string): CanvasRunProducer {
  return (data, base) => {
    const seed = hash(`${base.input}|${data.results.length}`)
    switch (data.kind) {
      case 'text':
        return { ...base, type: 'text', text: writeText(t, locale, data, base.input, seed) }
      case 'image': {
        const count = Number(optionValue(data, 'count')) || 1
        return { ...base, type: 'images', images: pick(PICTURES, count, seed), ratio: optionValue(data, 'ratio') }
      }
      case 'video':
        return {
          ...base,
          type: 'video',
          poster: pick(PICTURES, 1, seed)[0],
          seconds: Number(optionValue(data, 'duration')) || 5,
          ratio: optionValue(data, 'ratio'),
        }
      case 'voice': {
        const words = base.input.split(/\s+/).filter(Boolean).length
        const seconds = Math.max(2, Math.round(words / (2.5 * (SPEED_FACTOR[optionValue(data, 'speed')] ?? 1))))
        return { ...base, type: 'audio', seconds, voice: optionValue(data, 'voice'), script: base.input }
      }
      case 'link': {
        const host = hostOf(base.input)
        if (!host || !host.includes('.')) return { error: 'invalidUrl' }
        return {
          ...base,
          type: 'link',
          url: normalizeUrl(base.input),
          host,
          title: t('mock.link.title', { host }),
          summary: t('mock.link.summary', { host }),
          points: lines(t, 'mock.link.points', { host }),
        }
      }
      default:
        return { error: 'interrupted' }
    }
  }
}

function writeText(t: CanvasTranslator, locale: string, data: CanvasNodeData, input: string, seed: number) {
  const topic = topicOf(input)
  const length = optionValue(data, 'length')
  const take = length === 'short' ? 1 : length === 'long' ? 3 : 2
  switch (optionValue(data, 'format')) {
    case 'titles': {
      const titles = rotate(lines(t, 'mock.text.titles', { topic }, locale), seed)
      return titles.slice(0, take === 1 ? 3 : 5).map((title, index) => `${index + 1}. ${title}`).join('\n')
    }
    case 'script': {
      const parts = lines(t, 'mock.text.script', { topic }, locale)
      return (take === 1 ? [parts[0], parts[parts.length - 1]] : take === 2 ? parts.slice(0, 3).concat(parts.slice(-1)) : parts).join('\n\n')
    }
    case 'description':
      return [...rotate(lines(t, 'mock.text.description', { topic }, locale), seed).slice(0, take), t('mock.text.hashtags', { tag: hashtag(topic) })].join('\n\n')
    default:
      return rotate(lines(t, 'mock.text.free', { topic }, locale), seed).slice(0, take).join('\n\n')
  }
}

/**
 * A list from the messages (one entry per line), with `{name}` filled in (`t.raw` leaves them as they are). With a
 * `locale`, a value opening a line gets a capital and one inside it loses it ("Evde kahve" → "8 dakikada evde
 * kahve"); a word like "YouTube" stays as written.
 */
function lines(t: CanvasTranslator, key: string, values: Record<string, string>, locale?: string) {
  return canvasMessageLines(t.raw(key)).map((entry) => entry.replace(/\{(\w+)\}/g, (match, name: string, offset: number) => {
    const value = values[name]
    if (value === undefined) return match
    if (!locale) return value
    if (offset === 0) return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1)
    return /^\p{Lu}\p{Ll}*(\s|$)/u.test(value) ? value.charAt(0).toLocaleLowerCase(locale) + value.slice(1) : value
  }))
}

/** Lists are kept in the messages as one entry per line. */
export function canvasMessageLines(raw: unknown) {
  return typeof raw === 'string' ? raw.split('\n').map((entry) => entry.trim()).filter(Boolean) : []
}

function topicOf(input: string) {
  const clean = input.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  return clean.length > 72 ? `${clean.slice(0, 70).trimEnd()}…` : clean
}

function hashtag(topic: string) {
  return topic
    .split(' ')
    .slice(0, 3)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join('')
}

function hash(value: string) {
  let result = 0
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0
  return Math.abs(result)
}

function rotate<T>(list: T[], seed: number) {
  if (list.length === 0) return list
  const start = seed % list.length
  return [...list.slice(start), ...list.slice(0, start)]
}

function pick<T>(list: T[], count: number, seed: number) {
  return rotate(list, seed).slice(0, count)
}

/** A board to look around in: a few cards that already made something, one waiting, a note tied to one of them. */
export function createExampleContent(t: CanvasTranslator, locale: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const produce = createCanvasProducer(t, locale)
  const finished = (node: CanvasNode): CanvasNode => {
    const result = produce(node.data, { id: canvasId('result'), at: Date.now() - 1000 * 60 * 12, input: node.data.input })
    if ('error' in result) return node
    return { ...node, data: { ...node.data, status: 'done', results: [result as CanvasResult] } }
  }

  const note = createCanvasNode('note', { x: -380, y: -20 }, { title: '', input: t('example.note'), color: 'amber' })
  const titles = finished(createCanvasNode('text', { x: -60, y: -120 }, {
    title: t('example.titlesTitle'),
    input: t('example.titlesInput'),
    options: { format: 'titles', length: 'medium' },
  }))
  const cover = finished(createCanvasNode('image', { x: 300, y: -160 }, {
    title: t('example.coverTitle'),
    input: t('example.coverInput'),
    options: { ratio: 'landscape', count: '2' },
  }))
  const opening = createCanvasNode('video', { x: 300, y: 200 }, {
    title: t('example.openingTitle'),
    input: t('example.openingInput'),
    options: { ratio: 'landscape', duration: '5' },
  })
  const rival = finished(createCanvasNode('link', { x: -60, y: 260 }, {
    title: t('example.rivalTitle'),
    input: 'youtube.com/watch?v=coffee-guide',
  }))

  return {
    nodes: [note, titles, cover, opening, rival],
    edges: [{ id: canvasId('link'), source: note.id, target: titles.id, sourceHandle: 'right', targetHandle: 'left' }],
  }
}

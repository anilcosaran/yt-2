// Plan › Üretim, a Görev (task) node: an instruction in plain words over what is linked into it, read into a plan the
// node shows before it runs. Spark will read any wording once there is a backend; until then this reads three kinds:
// - a cut of a clip or a sound, keeping what it names: "ilk 10 sn kes" (its first 10 s), "son 5 sn" (its last 5),
//   "3-8 sn arası"; or dropping it: "ilk 3 sn'yi at / sil / çıkar";
// - a new size for a picture or a clip: "9:16'ya çevir", "1:1 yap", "kare", "dikey", "yatay";
// - more of a node: "2 tane daha", "bundan üç tane daha oluştur", "4 varyasyon".
// A node named with @ ("@Görsel 2") is the source; its name is left out of the reading (its number is not a count).

/** What flows into a task: words, a picture, a clip or a sound. */
export type TaskFlow = 'text' | 'image' | 'video' | 'audio'

/** What a task runs on: the node linked into it. */
export type TaskSource = { name: string; type: TaskFlow; seconds?: number }

export type TaskPlan =
  /** The part kept, in the source's seconds. */
  | { kind: 'cut'; from: number; to: number }
  | { kind: 'ratio'; ratio: string }
  | { kind: 'more'; count: number }

/**
 * An instruction as read: the plan and how the node says it, short on its chip (`label`) and as a sentence over it
 * (`sentence`); or what keeps it from running (`problem`), with whatever it understood.
 */
export type TaskRead = { plan: TaskPlan | null; label: string | null; sentence: string | null; problem: string | null }

/** At most this many more of a node at once. */
export const MAX_MORE = 6
/** Instructions to start from, as the node offers them while it is empty. */
export const TASK_EXAMPLES = ['ilk 10 sn kes', '2 tane daha', "9:16'ya çevir"]

const NUMBER_WORDS: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 }
const RATIO_WORDS: Record<string, string> = { kare: '1:1', dikey: '9:16', yatay: '16:9' }
// Word edges that know Turkish letters (`\b` only knows ASCII ones, so it never sees one before "ç" or "ı").
const DROP = /(?<!\p{L})(at|atla|sil|çıkar|kaldır)(?!\p{L})/u

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A length as the canvas writes it: 0:05, 1:12. */
export function clockOf(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The instruction without the nodes it names (`@Görsel 2'den`), in lower case, its number words as digits. */
function plainOf(text: string, names: readonly string[]) {
  let plain = text
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    plain = plain.replace(new RegExp(`@${escape(name)}(?:['’][\\p{L}]+)?`, 'giu'), ' ')
  }
  plain = plain.replace(/@\S+/g, ' ').toLocaleLowerCase('tr')
  return plain.replace(/\p{L}+/gu, (word) => (word in NUMBER_WORDS ? String(NUMBER_WORDS[word]) : word))
}

/** The node named first in an instruction (`@Görsel 2`), by the names on the canvas; the longest name that fits wins. */
export function mentionOf(text: string, names: readonly string[]) {
  let best: { name: string; at: number } | null = null
  for (const name of names) {
    const at = text.toLocaleLowerCase('tr').indexOf(`@${name.toLocaleLowerCase('tr')}`)
    if (at >= 0 && (!best || at < best.at || (at === best.at && name.length > best.name.length))) best = { name, at }
  }
  return best?.name ?? null
}

/** A cut: the part a clip or sound keeps, from what the instruction names and how long the source is. */
function cutOf(plain: string, seconds?: number): TaskPlan | null {
  const unit = (value: string, scale?: string) => Number(value.replace(',', '.')) * (scale && /^(dk|dakika)/.test(scale) ? 60 : 1)
  const range = /(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(sn|saniye|dk|dakika)/.exec(plain)
  if (range) {
    const from = unit(range[1]!, range[3])
    const to = unit(range[2]!, range[3])
    return to > from ? { kind: 'cut', from, to: seconds === undefined ? to : Math.min(to, seconds) } : null
  }
  const end = /(ilk|baştan|başından|son|sondan|sonundan)\s*(\d+(?:[.,]\d+)?)\s*(sn|saniye|dk|dakika)/.exec(plain)
  if (!end) return null
  const span = unit(end[2]!, end[3])
  const first = /^(ilk|baş)/.test(end[1]!)
  const length = seconds ?? span
  const drop = DROP.test(plain)
  if (first) return drop ? { kind: 'cut', from: Math.min(span, length), to: length } : { kind: 'cut', from: 0, to: Math.min(span, length) }
  return drop ? { kind: 'cut', from: 0, to: Math.max(0, length - span) } : { kind: 'cut', from: Math.max(0, length - span), to: length }
}

function ratioOf(plain: string): TaskPlan | null {
  const pair = /\b(\d{1,2})\s*[:/x]\s*(\d{1,2})\b/.exec(plain)
  if (pair && Number(pair[1]) > 0 && Number(pair[2]) > 0) return { kind: 'ratio', ratio: `${Number(pair[1])}:${Number(pair[2])}` }
  const word = Object.keys(RATIO_WORDS).find((entry) => new RegExp(`(?<!\\p{L})${entry}`, 'u').test(plain))
  return word ? { kind: 'ratio', ratio: RATIO_WORDS[word]! } : null
}

const MORE = /(\d+)\s*(?:tane|adet)?\s*(?:daha|fazla|kopya|varyasyon|çeşit|versiyon)/
/** How many more the instruction asks for, as asked (it may be past MAX_MORE). */
const askedOf = (plain: string) => Number(MORE.exec(plain)?.[1] ?? 0)

function moreOf(plain: string): TaskPlan | null {
  const asked = askedOf(plain)
  return asked ? { kind: 'more', count: Math.min(MAX_MORE, Math.max(1, asked)) } : null
}

/**
 * Reads an instruction over its source (`source`, none while nothing is linked) with the names of the canvas's nodes
 * (`names`, so a named node is not read as a number). A cut comes before a size, a size before more: one thing at a time.
 */
export function readTask(text: string, source: TaskSource | null, names: readonly string[]): TaskRead {
  const plain = plainOf(text, names)
  if (!plain.trim()) return { plan: null, label: null, sentence: null, problem: null }
  const plan = cutOf(plain, source?.seconds) ?? ratioOf(plain) ?? moreOf(plain)
  if (!plan) return { plan: null, label: null, sentence: null, problem: `Anlaşılmadı. Örneğin: “${TASK_EXAMPLES.join('”, “')}”` }
  const named = source?.name ?? 'Kaynak'
  const read = (label: string, sentence: string, problem: string | null = null): TaskRead => ({ plan, label, sentence: problem ? null : sentence, problem })
  if (plan.kind === 'cut') {
    const label = `Kes · ${clockOf(plan.from)}–${clockOf(plan.to)}`
    if (!source) return read(label, '', 'Bir video ya da ses bağlayın, ya da @ ile anın')
    if (source.type !== 'video' && source.type !== 'audio') return read(label, '', `${named} kesilemez: bir video ya da ses bağlayın`)
    if (plan.to - plan.from <= 0) return read(label, '', `${named} ${clockOf(source.seconds ?? 0)}; geriye bir şey kalmıyor`)
    return read(label, `${named}: ${clockOf(plan.from)}–${clockOf(plan.to)} arası kalır (${clockOf(plan.to - plan.from)})`)
  }
  if (plan.kind === 'ratio') {
    const label = `Oran · ${plan.ratio}`
    if (!source) return read(label, '', 'Bir görsel ya da video bağlayın, ya da @ ile anın')
    if (source.type !== 'image' && source.type !== 'video') return read(label, '', `${named} için oran olmaz: bir görsel ya da video bağlayın`)
    return read(label, `${named}, ${plan.ratio} olarak yeniden boyutlanır`)
  }
  const label = `${plan.count} × ${source?.name ?? 'düğüm'}`
  if (!source) return read(label, '', 'Çoğaltılacak düğümü bağlayın, ya da @ ile anın')
  const capped = askedOf(plain) > MAX_MORE ? ` (en fazla ${MAX_MORE})` : ''
  return read(label, `${named} gibi ${plan.count} düğüm eklenir ve üretilir${capped}`)
}

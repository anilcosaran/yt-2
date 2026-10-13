// Produces a string that matches a (simple) regular expression, so schema-generated mock data passes
// `.regex()` checks such as /^scr_[0-9a-f-]{36}$/ or /^tenant-scope:v1:[A-Za-z0-9_-]{43}$/.
// Supports literals, escapes (\d \w \s \.), classes ([a-z0-9_-], [^...]), groups with alternation and the
// quantifiers ? * + {n} {n,} {n,m}. Lookarounds and backreferences are skipped.

type Rng = () => number

type Node =
  | { kind: 'chars'; options: string[] }
  | { kind: 'group'; alternatives: Node[][] }
  | { kind: 'repeat'; node: Node; min: number; max: number }

const DIGITS = '0123456789'.split('')
const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('')
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WORD = [...LOWER, ...UPPER, ...DIGITS, '_']
const PRINTABLE = [...LOWER, ...UPPER, ...DIGITS, '-', '_', '.']

export function sampleRegex(regex: RegExp, rng: Rng, preferredLength?: number): string | null {
  try {
    const parser = new Parser(regex.source, regex.flags.includes('i'))
    const alternatives = parser.parseAlternatives()
    const out = emitAlternatives(alternatives, rng, preferredLength)
    regex.lastIndex = 0
    return regex.test(out) ? out : null
  } catch {
    return null
  }
}

class Parser {
  private index = 0
  constructor(private readonly source: string, private readonly ignoreCase: boolean) {}

  parseAlternatives(): Node[][] {
    const alternatives: Node[][] = [[]]
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      if (char === ')') break
      if (char === '|') {
        this.index += 1
        alternatives.push([])
        continue
      }
      const atom = this.parseAtom()
      if (!atom) continue
      alternatives[alternatives.length - 1].push(this.parseQuantifier(atom))
    }
    return alternatives
  }

  private parseAtom(): Node | null {
    const char = this.source[this.index]
    if (char === '^' || char === '$') {
      this.index += 1
      return null
    }
    if (char === '(') {
      this.index += 1
      let lookaround = false
      if (this.source[this.index] === '?') {
        const next = this.source[this.index + 1]
        if (next === ':') this.index += 2
        else if (next === '=' || next === '!') {
          lookaround = true
          this.index += 2
        } else if (next === '<' && (this.source[this.index + 2] === '=' || this.source[this.index + 2] === '!')) {
          lookaround = true
          this.index += 3
        } else if (next === '<') {
          const end = this.source.indexOf('>', this.index)
          this.index = end + 1
        }
      }
      const alternatives = this.parseAlternatives()
      this.index += 1 // ')'
      return lookaround ? null : { kind: 'group', alternatives }
    }
    if (char === '[') return this.parseClass()
    if (char === '.') {
      this.index += 1
      return { kind: 'chars', options: PRINTABLE }
    }
    if (char === '\\') {
      this.index += 2
      return { kind: 'chars', options: escapeOptions(this.source[this.index - 1]) }
    }
    this.index += 1
    return { kind: 'chars', options: [this.ignoreCase ? char.toLowerCase() : char] }
  }

  private parseClass(): Node {
    this.index += 1
    let negate = false
    if (this.source[this.index] === '^') {
      negate = true
      this.index += 1
    }
    const options = new Set<string>()
    let first = true
    while (this.index < this.source.length && (this.source[this.index] !== ']' || first)) {
      first = false
      let char = this.source[this.index]
      if (char === '\\') {
        const escaped = this.source[this.index + 1]
        this.index += 2
        const expanded = escapeOptions(escaped)
        if (expanded.length > 1) {
          expanded.forEach((option) => options.add(option))
          continue
        }
        char = expanded[0]
      } else {
        this.index += 1
      }
      if (this.source[this.index] === '-' && this.source[this.index + 1] !== ']' && this.index + 1 < this.source.length) {
        let end = this.source[this.index + 1]
        this.index += 2
        if (end === '\\') {
          end = escapeOptions(this.source[this.index])[0]
          this.index += 1
        }
        for (let code = char.charCodeAt(0); code <= end.charCodeAt(0); code += 1) {
          options.add(String.fromCharCode(code))
        }
      } else {
        options.add(char)
      }
    }
    this.index += 1 // ']'
    let list = [...options]
    if (negate) list = PRINTABLE.filter((option) => !options.has(option))
    return { kind: 'chars', options: list.length > 0 ? list : ['x'] }
  }

  private parseQuantifier(node: Node): Node {
    const char = this.source[this.index]
    let min = 1
    let max = 1
    if (char === '?') [min, max] = [0, 1]
    else if (char === '*') [min, max] = [0, 3]
    else if (char === '+') [min, max] = [1, 4]
    else if (char === '{') {
      const end = this.source.indexOf('}', this.index)
      const body = this.source.slice(this.index + 1, end)
      const [rawMin, rawMax] = body.split(',')
      min = Number(rawMin)
      max = rawMax === undefined ? min : rawMax === '' ? min + 4 : Number(rawMax)
      this.index = end
    } else {
      return node
    }
    this.index += 1
    if (this.source[this.index] === '?' || this.source[this.index] === '+') this.index += 1
    return { kind: 'repeat', node, min, max }
  }
}

function escapeOptions(char: string): string[] {
  switch (char) {
    case 'd':
      return DIGITS
    case 'w':
      return WORD
    case 's':
      return [' ']
    case 'D':
    case 'W':
      return ['-']
    case 'S':
      return LOWER
    case 'n':
      return ['\n']
    case 't':
      return ['\t']
    default:
      return [char]
  }
}

function emitAlternatives(alternatives: Node[][], rng: Rng, preferredLength?: number): string {
  const sequence = alternatives[Math.floor(rng() * alternatives.length)] ?? []
  return sequence.map((node) => emit(node, rng, preferredLength)).join('')
}

function emit(node: Node, rng: Rng, preferredLength?: number): string {
  if (node.kind === 'chars') return node.options[Math.floor(rng() * node.options.length)] ?? ''
  if (node.kind === 'group') return emitAlternatives(node.alternatives, rng, preferredLength)
  const span = Math.max(0, node.max - node.min)
  const target = preferredLength !== undefined && node.node.kind === 'chars'
    ? Math.min(node.max, Math.max(node.min, preferredLength))
    : node.min + Math.min(span, Math.floor(rng() * (Math.min(span, 8) + 1)))
  let out = ''
  for (let count = 0; count < target; count += 1) out += emit(node.node, rng, preferredLength)
  return out
}

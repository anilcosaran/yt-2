// Who else is on a canvas: each person's pointer and the node they work on, kept apart from what is on the canvas (that
// is the run's). People meet in a room, a run's key (`canvas:<id>`, a project's id); a transport carries what each one
// sends to the others there, and knows who is signed in. There is no backend for it yet: until the app puts one in
// (`setPresenceTransport`, a socket per room), a canvas gets the design-mode stand-in (`demoPresence`), two teammates
// working on its nodes.

export type Point = { x: number; y: number }

/**
 * What a person sends: their pointer in the canvas's own coordinates (so it lands on the same spot whatever each
 * viewer's pan and zoom), `null` once it is off the canvas; and the node they work on (typing in it, or picked alone).
 */
export type PresenceState = { cursor: Point | null; focus: string | null }

/** Someone else in the room, as the transport tells it; `color` when the backend gives each person theirs (the same for every viewer). */
export type PresencePeer = PresenceState & { id: string; name: string; color?: string }

/** Someone else, ready to draw: their colour and the short name their pointer carries. */
export type Peer = PresencePeer & { color: string; short: string }

/** A person as the backend knows them. */
export type PresenceUser = { id: string; name: string; color?: string }

export type PresenceRoom = {
  /** Who this browser is in the room: the signed-in person. */
  self: PresenceUser
  /** Sends where this person is now; the transport may drop some between two sends (the last one counts). */
  update: (state: PresenceState) => void
  /** Hears who is in the room, right away (never within the call itself) and then each time any of it changes; the function it returns stops that. */
  subscribe: (listener: (peers: PresencePeer[]) => void) => () => void
  leave: () => void
}

/** Joins rooms as the signed-in person. */
export type PresenceTransport = { join: (room: string) => PresenceRoom }

/** How often a pointer is sent, at most: often enough to read as live, a hand moving, with a short glide between sends. */
export const PRESENCE_SEND_MS = 40

let backend: PresenceTransport | null = null
/** Puts in the app's own transport once there is a backend for it; `null` goes back to the stand-in. */
export function setPresenceTransport(transport: PresenceTransport | null) {
  backend = transport
}
export const presenceTransport = () => backend

/** Pointer colours, far apart from each other: each holds white type, and none is Spark's violet or the blue of a selection box. */
export const PEER_COLORS = ['#e5484d', '#e8590c', '#a16207', '#2f9e44', '#0c8599', '#d6336c', '#be4bdb']

function hashOf(text: string) {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash)
}

/**
 * Everyone's colour in a room, this person's too, each one different (until there are more people than colours): the
 * backend's when it gives one, else, going through the room in the order of their ids, the colour their id points at
 * or the next one nobody has. Every screen sees the same room, so every screen gives the same person the same colour.
 */
export function colorsOf(people: PresenceUser[]) {
  const colors = new Map<string, string>()
  const taken = new Set(people.flatMap((person) => (person.color ? [person.color] : [])))
  for (const person of [...people].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (person.color) {
      colors.set(person.id, person.color)
      continue
    }
    const start = hashOf(person.id) % PEER_COLORS.length
    const free = PEER_COLORS.map((_, step) => PEER_COLORS[(start + step) % PEER_COLORS.length]!).find((color) => !taken.has(color))
    const color = free ?? PEER_COLORS[start]!
    taken.add(color)
    colors.set(person.id, color)
  }
  return colors
}

const MAX_SHORT = 12
const wordsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean)
const clip = (text: string) => (text.length > MAX_SHORT ? `${text.slice(0, MAX_SHORT - 1)}…` : text)

/** The first letters of a person's first and last name, for their face. */
export function initialsOf(name: string) {
  const words = wordsOf(name)
  const letters = words.length > 1 ? [words[0]!, words.at(-1)!] : words
  return letters.map((word) => word[0]!.toLocaleUpperCase('tr')).join('') || '?'
}

/**
 * The others in a room, ready to draw, and this person's own colour: each with their colour (`colorsOf`) and a short
 * name, the first name, with the initial of the last when two in the room share it.
 */
export function peersOf(list: PresencePeer[], self: PresenceUser): { peers: Peer[]; color: string } {
  const others = list.filter((peer) => peer.id !== self.id)
  const colors = colorsOf([self, ...others])
  const firstOf = (peer: PresencePeer) => (wordsOf(peer.name)[0] ?? '').toLocaleLowerCase('tr')
  const count = new Map<string, number>()
  for (const peer of others) count.set(firstOf(peer), (count.get(firstOf(peer)) ?? 0) + 1)
  const peers = others.map((peer) => {
    const words = wordsOf(peer.name)
    const first = words[0] ?? '?'
    const shared = (count.get(firstOf(peer)) ?? 0) > 1 && words.length > 1
    return { ...peer, color: colors.get(peer.id)!, short: clip(shared ? `${first} ${words.at(-1)![0]}.` : first) }
  })
  return { peers, color: colors.get(self.id)! }
}

/** A node on the canvas, in the canvas's coordinates: where the stand-in's teammates go to work. */
export type PresenceSpot = { id: string; x: number; y: number; w: number; h: number }

const DEMO_SELF: PresenceUser = { id: 'demo:sen', name: 'Sen' }
const DEMO_TEAM = [
  { id: 'demo:ayse', name: 'Ayşe Yılmaz', joinsAfter: 1200 },
  { id: 'demo:mert', name: 'Mert Demir', joinsAfter: 5200 },
]

const between = (low: number, high: number) => low + Math.random() * (high - low)
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * The design-mode stand-in: two teammates who join a moment apart and work the way a person does. One takes a node,
 * its pointer gliding there in steps as a real one arrives over the wire, works on it a few seconds, lets it go, then
 * takes another. Nobody moves for nothing: with no node to work on they are in the room without a pointer, and they
 * leave alone the node this browser works on. `spots` reads the canvas's nodes as they are now.
 */
export function demoPresence(spots: () => PresenceSpot[]): PresenceTransport {
  return {
    join() {
      const listeners = new Set<(peers: PresencePeer[]) => void>()
      const peers = new Map<string, PresencePeer>()
      // The node each teammate has taken, from the moment they head for it, so two never go for the same one.
      const aims = new Map<string, string>()
      const timers = new Set<number>()
      let mine: string | null = null
      let left = false

      const emit = () => {
        const list = [...peers.values()]
        listeners.forEach((listener) => listener(list))
      }
      const later = (ms: number, then: () => void) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          if (!left) then()
        }, ms)
        timers.add(timer)
      }
      const set = (id: string, change: Partial<PresencePeer>) => {
        const peer = peers.get(id)
        if (!peer) return
        peers.set(id, { ...peer, ...change })
        emit()
      }
      // A pointer that is not on the canvas yet comes in from above and to the left of where it is going.
      const glide = (id: string, to: Point, then: () => void) => {
        const from = peers.get(id)?.cursor ?? { x: to.x - 180, y: to.y - 120 }
        const steps = Math.min(28, Math.max(10, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 30)))
        const step = (index: number) => {
          const t = ease(index / steps)
          set(id, { cursor: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } })
          later(index < steps ? PRESENCE_SEND_MS : 250, index < steps ? () => step(index + 1) : then)
        }
        step(0)
      }
      const work = (id: string) => {
        const taken = new Set([mine, ...[...aims].filter(([peer]) => peer !== id).map(([, spot]) => spot)])
        const free = spots().filter((spot) => !taken.has(spot.id))
        if (!free.length) return later(2500, () => work(id))
        const spot = free[Math.floor(Math.random() * free.length)]!
        aims.set(id, spot.id)
        // Where a person types into a node: its prompt, along the bottom.
        const to = { x: spot.x + spot.w * between(0.3, 0.7), y: spot.y + spot.h - between(28, 44) }
        glide(id, to, () => {
          set(id, { focus: spot.id })
          later(between(4500, 9000), () => {
            aims.delete(id)
            set(id, { focus: null })
            later(between(900, 2200), () => work(id))
          })
        })
      }

      for (const member of DEMO_TEAM) {
        later(member.joinsAfter, () => {
          peers.set(member.id, { id: member.id, name: member.name, cursor: null, focus: null })
          emit()
          work(member.id)
        })
      }
      return {
        self: DEMO_SELF,
        update: (state) => {
          mine = state.focus
        },
        subscribe: (listener) => {
          listeners.add(listener)
          queueMicrotask(() => {
            if (listeners.has(listener)) listener([...peers.values()])
          })
          return () => listeners.delete(listener)
        },
        leave: () => {
          left = true
          timers.forEach((timer) => window.clearTimeout(timer))
          timers.clear()
          listeners.clear()
        },
      }
    },
  }
}

'use client'

import * as React from 'react'

import {
  ASSUMPTIONS,
  DEMO_PROMPT,
  DRAFT_END,
  LOOK_DEFAULT,
  QUESTIONS,
  SCENES,
  STEPS,
  SUGGESTIONS,
  sceneById,
  titleFromPrompt,
  type AgentStep,
  type Autonomy,
  type LabPhase,
  type LabQuestion,
  type LabRatio,
  type LabScene,
  type SceneArt,
} from './lab-model'

// Spark lab: a scripted run of the agent. One sentence → the agent drafts the project (brief, context, plan,
// assets, assumptions) → plan → the agent drives the editor step by step → preview. Timers stand in for the
// real job stream; pause, take over, per-scene lock and undo change the state the same way the product would.

const TICK_MS = 190
const AUTO_START_MS = 2600
const RENDER_MS = 3200
/** How long Spark takes to make one scene or clip again: the first one, then each next one (they come in one by one). */
const REMAKE_FIRST_MS = 1400
const REMAKE_NEXT_MS = 700

export type LabRunState = {
  phase: LabPhase
  /** Drafting counter: an item with `at <= tick` is written. */
  tick: number
  /** The step in progress while building; `STEPS.length` once every step ran. */
  step: number
  paused: boolean
  /** Lab only: timers stand still (a held moment for review) while the run still reads as live. */
  frozen: boolean
  /** Who edits right now. The agent waits while the user drives. */
  driver: 'agent' | 'user'
  follow: boolean
  autonomy: Autonomy
  /** Lab setting: the project's output format. */
  ratio: LabRatio
  prompt: string
  /** Steps rolled back to their checkpoint. */
  undone: string[]
  /** Steps the agent left alone because the user holds their scene. */
  skipped: string[]
  /** Scenes the user took over (variant B). */
  locked: string[]
  /** Assumptions the user reverted. */
  dropped: string[]
  /** Rows and closing suggestions saved to the channel. */
  promoted: string[]
  /** The final render, asked for once the video is made: `rendering` while it is taken, then `ready`. */
  render: 'none' | 'rendering' | 'ready'
  /** The closing question ("Sırada ne var?") was put away. */
  closingDismissed: boolean
  /** Scene on screen when the view does not follow the agent. */
  viewScene: string
  /** What the user told Spark when it asked (by question id): an option's label or their own words; `null` left the call to Spark. */
  answers: Record<string, string | null>
  /** Texts the user rewrote by hand in the plan: a brief field by its id, a scene's line as `say:<sceneId>`. */
  edits: Record<string, string>
  /** What the user chose for a cast-and-look row, by row id (`null`: nothing, e.g. no character). */
  picks: Record<string, string | null>
  /** Rules, knowledge and scenes the user wrote into the plan. */
  added: { rules: string[]; knowledge: string[]; scenes: AddedScene[] }
  /** Plan › Üretim's canvas over the chain Spark draws from the plan (`plan-chain.tsx`). */
  canvas: LabCanvas
  /** Notes the user left for Spark and has not sent yet, oldest first. They go to Spark together, as one edit. */
  notes: LabNote[]
  /** Names the next note. */
  noteSerial: number
  /** What Spark changed from the notes, by target (a scene id, or a clip as `<lane>:<sceneId>`), oldest first. */
  asks: Record<string, LabAsk[]>
  /**
   * The user's own media for a scene ("Görselim") and the reference picture its AI model makes from, by scene id. Each
   * is kept while the scene uses another source, so going back to it finds it where it was.
   */
  media: Record<string, LabMedia>
  refs: Record<string, LabMedia>
  /** How many batches of notes were sent; Spark is applying batch `applying` until it is `null`. */
  batches: number
  applying: number | null
  /** The targets of the batch being applied that are not ready yet; they get ready one by one. */
  applyingLeft: string[]
  /**
   * The user's requests after the first sentence, oldest first: every sending of notes and every request typed in the
   * chat, each with the project as it was just before it (where "Öncesine dön" goes back to).
   */
  turns: LabTurn[]
  /**
   * The project was taken back to before request `at`: it and the ones after it read as taken back until the next
   * request replaces them. `redo` is the project as it was, for "Geri getir".
   */
  rewound: { at: number; redo: LabSlice } | null
  /**
   * What is picked for Spark, in any view (clips on the timeline, scenes in the plan): the chat's composer carries it
   * as a chip and sends the next request to it. One pick at a time; picking elsewhere replaces it.
   */
  selection: LabSelection | null
  /** When the pick was last handed to Spark (its ✦): the composer takes the focus for it. */
  askedAt: number
}

/** A pick: its targets (scene ids, or clips as `<lane>:<sceneId>`), named for the user, and where it was made. */
export type LabSelection = { targets: string[]; labels: string[]; noun: string; from: 'timeline' | 'plan' | 'chain' }

/** What a request can change, kept whole for each restore point (the reducer never mutates, so these are references). */
export type LabSlice = Pick<LabRunState, 'undone' | 'skipped' | 'locked' | 'dropped' | 'edits' | 'picks' | 'added' | 'media' | 'refs' | 'asks'>

/**
 * One request: what was said (a note's targets and words, or the chat's own sentence), its batch and the project
 * before it. `pick` is a chat request sent to a pick (its chip), `chat` one Spark aimed itself.
 */
export type LabTurn = {
  id: string
  batch: number
  from: 'notes' | 'chat' | 'pick'
  notes: { labels: string[]; text: string }[]
  before: LabSlice
}

function sliceOf(state: LabRunState): LabSlice {
  const { undone, skipped, locked, dropped, edits, picks, added, media, refs, asks } = state
  return { undone, skipped, locked, dropped, edits, picks, added, media, refs, asks }
}

/**
 * A note for Spark: on a scene in the plan, or on clips picked together on the timeline (one note, several targets).
 * `labels` name the targets for the user, in the same order. `source` is a new source or model picked for a scene's
 * picture: it is shown on the scene's source tag, not as a note of its own.
 */
export type LabNote = { id: string; targets: string[]; labels: string[]; text: string; kind?: 'source' }
/** One change Spark made from a note, on one target. Every sending of notes is one batch. */
export type LabAsk = { text: string; batch: number }

/** A node the user put on the canvas: its kind (`STAGE_KIND` in `lab-chain.ts`) and where. */
export type CanvasOwnNode = { id: string; kind: string; x: number; y: number }
/** A link the user drew from one node's output to another node. */
export type CanvasLink = { id: string; source: string; target: string }
/** A node waiting to be made, and how long making it takes. */
export type CanvasJob = { id: string; ms: number }
/**
 * Plan › Üretim's canvas, over the chain Spark draws from the plan: where nodes were moved, the nodes and links the user
 * added, the planned nodes and links they removed, how many times each node was made from the canvas, the nodes waiting
 * to be made (the first one is being made: "Kuyruk") and the last view. Not part of restore points: going back to
 * before a request does not move the canvas.
 */
export type LabCanvas = {
  moved: Record<string, { x: number; y: number }>
  added: CanvasOwnNode[]
  links: CanvasLink[]
  removed: string[]
  made: Record<string, number>
  queue: CanvasJob[]
  serial: number
  view: { x: number; y: number; zoom: number } | null
}

const EMPTY_CANVAS: LabCanvas = { moved: {}, added: [], links: [], removed: [], made: {}, queue: [], serial: 1, view: null }
/** A scene the user added by hand: its name, its line and its length. Spark plans the rest. */
export type AddedScene = { id: string; role: string; say: string; seconds: number }
/** A picture or clip of the user's (from Storage, or uploaded there), given to a scene as it is or as a reference. */
export type LabMedia = { title: string; url?: string; video?: boolean; objectId?: string; art?: SceneArt }
type AddedKind = 'rules' | 'knowledge' | 'scenes'
/** A note as it is written: without `id` it is a new note; with one, that note's new text (empty removes it). */
export type NoteDraft = Omit<LabNote, 'id'> & { id?: string }

type Action =
  | { type: 'submit'; prompt: string }
  | { type: 'tick' }
  | { type: 'approve' }
  | { type: 'advance' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'takeOver' }
  | { type: 'handBack' }
  | { type: 'toggleFollow' }
  | { type: 'autonomy'; value: Autonomy }
  | { type: 'ratio'; value: LabRatio }
  | { type: 'jump'; phase: LabPhase }
  | { type: 'undoStep'; id: string }
  | { type: 'dropAssumption'; id: string }
  | { type: 'promote'; id: string }
  | { type: 'render' }
  | { type: 'rendered' }
  | { type: 'keepForChannel' }
  | { type: 'dismissClosing' }
  | { type: 'toggleLock'; sceneId: string }
  | { type: 'view'; sceneId: string }
  | { type: 'answer'; id: string; text: string | null }
  | { type: 'edit'; id: string; text: string }
  | { type: 'pick'; id: string; option: string | null }
  | { type: 'add'; kind: 'rules' | 'knowledge'; text: string }
  | { type: 'addScene'; scene: Omit<AddedScene, 'id'> }
  | { type: 'removeAdded'; kind: AddedKind; index: number }
  | { type: 'canvasMove'; moved: Record<string, { x: number; y: number }> }
  | { type: 'canvasAdd'; kind: string; x: number; y: number; from?: string }
  | { type: 'canvasRemove'; ids: string[] }
  | { type: 'canvasLink'; source: string; target: string }
  | { type: 'canvasUnlink'; ids: string[] }
  | { type: 'canvasRun'; jobs: CanvasJob[] }
  | { type: 'canvasMade' }
  | { type: 'canvasStop' }
  | { type: 'canvasView'; view: LabCanvas['view'] }
  | { type: 'setMedia'; id: string; media: LabMedia | null }
  | { type: 'setRef'; id: string; media: LabMedia | null }
  | { type: 'saveNote'; note: NoteDraft }
  | { type: 'dropNote'; id: string }
  | { type: 'clearNotes' }
  | { type: 'sendNotes'; with?: NoteDraft; only?: boolean; from?: LabTurn['from'] }
  | { type: 'request'; text: string }
  | { type: 'notesApplied' }
  | { type: 'undoAsk'; target: string }
  | { type: 'undoBatch'; batch: number }
  | { type: 'rewind'; id: string }
  | { type: 'restore' }
  | { type: 'select'; selection: LabSelection | null }
  | { type: 'ask'; at: number }

const FIRST_SCENE = SCENES[0]!.id

function base(prompt = ''): LabRunState {
  return {
    phase: 'empty',
    tick: 0,
    step: 0,
    paused: false,
    frozen: false,
    driver: 'agent',
    follow: true,
    autonomy: 'auto',
    ratio: '9:16',
    prompt,
    undone: [],
    skipped: [],
    locked: [],
    dropped: [],
    promoted: [],
    render: 'none',
    closingDismissed: false,
    viewScene: FIRST_SCENE,
    answers: {},
    edits: {},
    picks: {},
    added: { rules: [], knowledge: [], scenes: [] },
    canvas: EMPTY_CANVAS,
    media: {},
    refs: {},
    notes: [],
    noteSerial: 1,
    asks: {},
    batches: 0,
    applying: null,
    applyingLeft: [],
    turns: [],
    rewound: null,
    selection: null,
    askedAt: 0,
  }
}

/** The next step at or after `from` that the agent may run. */
function runnable(from: number, skipped: string[]) {
  let index = from
  while (index < STEPS.length && skipped.includes(STEPS[index]!.id)) index += 1
  return index
}

/** The id of the next scene the user adds: one past the highest so far, so a removed scene's id is never reused. */
function nextOwnSceneId(scenes: AddedScene[]) {
  const highest = Math.max(0, ...scenes.map((scene) => Number(/^own-(\d+)/.exec(scene.id)?.[1] ?? 0)))
  return `own-${highest + 1}`
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
}

function reducer(state: LabRunState, action: Action): LabRunState {
  switch (action.type) {
    case 'submit':
      return { ...base(action.prompt.trim() || DEMO_PROMPT), autonomy: state.autonomy, ratio: state.ratio, phase: 'drafting' }
    case 'tick':
      // The draft stops at a question until it is answered.
      if (state.phase !== 'drafting' || pendingQuestion(state)) return state
      return state.tick + 1 >= DRAFT_END ? { ...state, tick: DRAFT_END, phase: 'plan' } : { ...state, tick: state.tick + 1 }
    case 'approve':
      if (state.phase !== 'plan') return state
      return { ...state, phase: 'building', step: runnable(0, state.skipped), paused: false, frozen: false, driver: 'agent' }
    case 'advance': {
      if (state.phase !== 'building') return state
      const next = runnable(state.step + 1, state.skipped)
      return next >= STEPS.length ? { ...state, step: STEPS.length, phase: 'done' } : { ...state, step: next }
    }
    case 'pause':
      return { ...state, paused: true }
    case 'resume':
      return { ...state, paused: false, frozen: false }
    case 'takeOver':
      return { ...state, driver: 'user', follow: false, viewScene: shownSceneId(state) }
    case 'handBack':
      return { ...state, driver: 'agent', follow: true, paused: false, frozen: false }
    case 'toggleFollow':
      return { ...state, follow: !state.follow, viewScene: shownSceneId(state) }
    case 'autonomy':
      return { ...state, autonomy: action.value }
    case 'ratio':
      return { ...state, ratio: action.value }
    case 'jump': {
      const prompt = state.prompt || DEMO_PROMPT
      const kept = { autonomy: state.autonomy, ratio: state.ratio }
      if (action.phase === 'empty') return { ...base(), ...kept }
      if (action.phase === 'drafting') return { ...base(prompt), ...kept, phase: 'drafting' }
      if (action.phase === 'plan') return { ...base(prompt), ...kept, phase: 'plan', tick: DRAFT_END }
      if (action.phase === 'building') return { ...base(prompt), ...kept, phase: 'building', tick: DRAFT_END }
      return { ...base(prompt), ...kept, phase: 'done', tick: DRAFT_END, step: STEPS.length, viewScene: 's4' }
    }
    case 'undoStep':
      return { ...state, undone: toggle(state.undone, action.id) }
    case 'dropAssumption':
      return { ...state, dropped: toggle(state.dropped, action.id) }
    case 'promote':
      return { ...state, promoted: toggle(state.promoted, action.id) }
    case 'render':
      if (state.phase !== 'done' || state.render !== 'none') return state
      return { ...state, render: 'rendering', paused: false, frozen: false }
    case 'rendered':
      return state.render === 'rendering' ? { ...state, render: 'ready' } : state
    case 'keepForChannel':
      return { ...state, promoted: [...new Set([...state.promoted, ...SUGGESTIONS.map((item) => item.id)])] }
    case 'dismissClosing':
      return { ...state, closingDismissed: true }
    case 'view':
      return { ...state, viewScene: action.sceneId, follow: false }
    case 'answer':
      return { ...state, answers: { ...state.answers, [action.id]: action.text } }
    case 'edit':
      return { ...state, edits: { ...state.edits, [action.id]: action.text } }
    case 'pick':
      return { ...state, picks: { ...state.picks, [action.id]: action.option } }
    case 'add':
      return { ...state, added: { ...state.added, [action.kind]: [...state.added[action.kind], action.text] } }
    case 'addScene':
      return { ...state, added: { ...state.added, scenes: [...state.added.scenes, { ...action.scene, id: nextOwnSceneId(state.added.scenes) }] } }
    case 'setMedia':
    case 'setRef': {
      const book = action.type === 'setMedia' ? 'media' : 'refs'
      const next = { ...state[book] }
      if (action.media) next[action.id] = action.media
      else delete next[action.id]
      return { ...state, [book]: next }
    }
    case 'removeAdded':
      return { ...state, added: { ...state.added, [action.kind]: state.added[action.kind].filter((_, index) => index !== action.index) } }
    case 'canvasMove':
      return { ...state, canvas: { ...state.canvas, moved: { ...state.canvas.moved, ...action.moved } } }
    case 'canvasAdd': {
      // Ids are never reused, so what was said or made for a removed node does not come back on a new one.
      const { canvas } = state
      const id = `own/${canvas.serial}`
      const links = action.from ? [...canvas.links, { id: `${action.from}→${id}`, source: action.from, target: id }] : canvas.links
      return { ...state, canvas: { ...canvas, added: [...canvas.added, { id, kind: action.kind, x: action.x, y: action.y }], links, serial: canvas.serial + 1 } }
    }
    case 'canvasRemove': {
      const { canvas } = state
      const gone = new Set(action.ids)
      const touches = (link: CanvasLink) => gone.has(link.source) || gone.has(link.target)
      const removed = [...new Set([...canvas.removed, ...action.ids.filter((id) => !id.startsWith('own/'))])]
      const selection = state.selection?.targets.some((id) => gone.has(id)) ? null : state.selection
      return {
        ...state,
        selection,
        canvas: { ...canvas, removed, added: canvas.added.filter((node) => !gone.has(node.id)), links: canvas.links.filter((link) => !touches(link)), queue: canvas.queue.filter((job) => !gone.has(job.id)) },
      }
    }
    case 'canvasLink': {
      const { canvas } = state
      const id = `${action.source}→${action.target}`
      if (action.source === action.target || canvas.links.some((link) => link.id === id)) return state
      // A planned link the user removed comes back as it was.
      if (canvas.removed.includes(id)) return { ...state, canvas: { ...canvas, removed: canvas.removed.filter((entry) => entry !== id) } }
      return { ...state, canvas: { ...canvas, links: [...canvas.links, { id, source: action.source, target: action.target }] } }
    }
    case 'canvasUnlink': {
      const { canvas } = state
      const own = canvas.links.filter((link) => action.ids.includes(link.id)).map((link) => link.id)
      const planned = action.ids.filter((id) => !own.includes(id))
      return { ...state, canvas: { ...canvas, links: canvas.links.filter((link) => !own.includes(link.id)), removed: [...new Set([...canvas.removed, ...planned])] } }
    }
    case 'canvasRun': {
      const waiting = new Set(state.canvas.queue.map((job) => job.id))
      const jobs = action.jobs.filter((job) => !waiting.has(job.id))
      return jobs.length ? { ...state, canvas: { ...state.canvas, queue: [...state.canvas.queue, ...jobs] } } : state
    }
    case 'canvasMade': {
      const [job, ...queue] = state.canvas.queue
      if (!job) return state
      return { ...state, canvas: { ...state.canvas, queue, made: { ...state.canvas.made, [job.id]: (state.canvas.made[job.id] ?? 0) + 1 } } }
    }
    case 'canvasStop':
      return { ...state, canvas: { ...state.canvas, queue: [] } }
    case 'canvasView':
      return { ...state, canvas: { ...state.canvas, view: action.view } }
    case 'saveNote': {
      const { id, ...note } = action.note
      const text = note.text.trim()
      if (id) {
        const notes = text ? state.notes.map((entry) => (entry.id === id ? { ...entry, text } : entry)) : state.notes.filter((entry) => entry.id !== id)
        return { ...state, notes }
      }
      if (!text || !note.targets.length) return state
      return { ...state, notes: [...state.notes, { ...note, text, id: `note-${state.noteSerial}` }], noteSerial: state.noteSerial + 1 }
    }
    case 'dropNote':
      return { ...state, notes: state.notes.filter((entry) => entry.id !== action.id) }
    case 'clearNotes':
      return { ...state, notes: [] }
    case 'sendNotes': {
      if (state.applying !== null) return state
      // The note being written is kept first. `only` fixes just that pick and leaves the rest of the list waiting;
      // otherwise the whole list goes. Picked targets without any note are made again as they are.
      const listed = action.with ? reducer(state, { type: 'saveNote', note: action.with }).notes : state.notes
      const pick = action.with?.targets.join('|')
      const pending = action.only ? listed.filter((note) => note.targets.join('|') === pick) : listed
      const waiting = action.only ? listed.filter((note) => !pending.includes(note)) : []
      const bare = (action.with?.targets ?? []).filter((target) => !pending.some((note) => note.targets.includes(target)))
      if (!pending.length && !bare.length) return state
      const batch = state.batches + 1
      const asks = { ...state.asks }
      const sent: string[] = []
      const send = (target: string, text: string) => {
        asks[target] = [...(asks[target] ?? []), { text, batch }]
        if (!sent.includes(target)) sent.push(target)
      }
      for (const note of pending) note.targets.forEach((target) => send(target, note.text))
      bare.forEach((target) => send(target, ''))
      const remade = bare.map((target) => action.with?.labels[action.with.targets.indexOf(target)] ?? target)
      const turn: LabTurn = {
        id: `turn-${batch}`,
        batch,
        from: action.from ?? 'notes',
        notes: [...pending.map((note) => ({ labels: note.labels, text: note.text })), ...(remade.length ? [{ labels: remade, text: '' }] : [])],
        before: sliceOf(state),
      }
      // A new request after going back replaces the requests that were taken back.
      const turns = [...(state.rewound ? state.turns.slice(0, state.rewound.at) : state.turns), turn]
      return { ...state, asks, notes: waiting, batches: batch, applying: batch, applyingLeft: sent, turns, rewound: null }
    }
    case 'request': {
      const text = action.text.trim()
      if (!text) return state
      // A request typed in the chat goes to what is picked (the composer's chip), else to the scene it names
      // ("4. sahnede"), else to the scene on screen. It is one edit, like a sending of notes, and the pick goes with it.
      const picked = state.selection
      const named = /(\d+)\.\s*sahne/i.exec(text)
      const scene = (named ? SCENES.find((entry) => entry.n === Number(named[1])) : undefined) ?? sceneById(shownSceneId(state)) ?? SCENES[0]!
      const note = picked ? { targets: picked.targets, labels: picked.labels, text } : { targets: [scene.id], labels: [`${scene.role} sahnesi`], text }
      const sent = reducer(state, { type: 'sendNotes', with: note, only: true, from: picked ? 'pick' : 'chat' })
      return sent === state ? state : { ...sent, selection: null }
    }
    case 'select':
      return { ...state, selection: action.selection?.targets.length ? action.selection : null }
    case 'ask':
      return state.selection ? { ...state, askedAt: action.at } : state
    case 'rewind': {
      const at = state.turns.findIndex((turn) => turn.id === action.id)
      if (at === -1) return state
      // Back to before this request: it and the ones after it are taken back, and one still being applied stops. The
      // project as it was stays at hand until the next request ("Geri getir").
      return { ...state, ...state.turns[at]!.before, applying: null, applyingLeft: [], rewound: { at, redo: state.rewound?.redo ?? sliceOf(state) } }
    }
    case 'restore':
      return state.rewound ? { ...state, ...state.rewound.redo, rewound: null } : state
    case 'notesApplied': {
      if (state.applying === null) return state
      const applyingLeft = state.applyingLeft.slice(1)
      return applyingLeft.length ? { ...state, applyingLeft } : { ...state, applying: null, applyingLeft: [] }
    }
    case 'undoAsk':
      return { ...state, asks: { ...state.asks, [action.target]: (state.asks[action.target] ?? []).slice(0, -1) } }
    case 'undoBatch': {
      const asks = Object.fromEntries(Object.entries(state.asks).map(([target, list]) => [target, list.filter((ask) => ask.batch !== action.batch)]))
      // Taking back the batch Spark is still applying stops it.
      return state.applying === action.batch ? { ...state, asks, applying: null, applyingLeft: [] } : { ...state, asks }
    }
    case 'toggleLock': {
      const locking = !state.locked.includes(action.sceneId)
      const locked = toggle(state.locked, action.sceneId)
      const ahead = STEPS.filter((step, index) => step.sceneId === action.sceneId && index >= state.step).map((step) => step.id)
      const skipped = locking ? [...new Set([...state.skipped, ...ahead])] : state.skipped.filter((id) => !ahead.includes(id))
      if (state.phase !== 'building') return { ...state, locked, skipped }
      const step = runnable(state.step, skipped)
      return step >= STEPS.length ? { ...state, locked, skipped, step: STEPS.length, phase: 'done' } : { ...state, locked, skipped, step }
    }
  }
}

export type LabRunInit = { phase?: LabPhase; step?: number; hold?: boolean; ratio?: LabRatio; title?: string; autonomy?: Autonomy }

function initial(init: LabRunInit): LabRunState {
  const start = reducer(base(), { type: 'jump', phase: init.phase ?? 'empty' })
  const step = init.phase === 'building' && init.step ? Math.min(Math.max(init.step, 0), STEPS.length - 1) : start.step
  return { ...start, step, frozen: Boolean(init.hold), ratio: init.ratio ?? start.ratio, autonomy: init.autonomy ?? start.autonomy }
}

export type LabRun = {
  state: LabRunState
  /** The project's own name; `null` before it has one (Spark names it from the first sentence). */
  title: string | null
  submit: (prompt: string) => void
  approve: () => void
  pause: () => void
  resume: () => void
  takeOver: () => void
  handBack: () => void
  toggleFollow: () => void
  setAutonomy: (value: Autonomy) => void
  setRatio: (value: LabRatio) => void
  /** Puts the run at the start of a phase (e.g. a plan that is already waiting when a view first opens it). */
  jump: (phase: LabPhase) => void
  undoStep: (id: string) => void
  dropAssumption: (id: string) => void
  promote: (id: string) => void
  /** Takes the final render of the finished video. */
  render: () => void
  /** Saves everything this video taught (the closing suggestions) to the channel. */
  keepForChannel: () => void
  /** Puts the closing question away. */
  dismissClosing: () => void
  toggleLock: (sceneId: string) => void
  view: (sceneId: string) => void
  /** Answers the question Spark is waiting on; `null` leaves the call to Spark. */
  answer: (id: string, text: string | null) => void
  edit: (id: string, text: string) => void
  pick: (id: string, option: string | null) => void
  add: (kind: 'rules' | 'knowledge', text: string) => void
  addScene: (scene: Omit<AddedScene, 'id'>) => void
  removeAdded: (kind: AddedKind, index: number) => void
  /** Plan › Üretim's canvas: what the user does on it (see `LabCanvas`). */
  canvas: {
    move: (moved: Record<string, { x: number; y: number }>) => void
    /** Puts a node of `kind` at (x, y); with `from`, linked from that node's output. */
    add: (kind: string, x: number, y: number, from?: string) => void
    remove: (ids: string[]) => void
    link: (source: string, target: string) => void
    unlink: (ids: string[]) => void
    /** Makes these nodes, one after another, after the ones already waiting. */
    run: (jobs: CanvasJob[]) => void
    /** Empties the queue (the node being made stops too). */
    stop: () => void
    view: (view: LabCanvas['view']) => void
  }
  /** Gives a scene the user's own media (`null` takes it back). */
  setMedia: (id: string, media: LabMedia | null) => void
  /** Gives a scene's AI model a reference picture to make from (`null` takes it back). */
  setRef: (id: string, media: LabMedia | null) => void
  /** Writes a note for Spark (or changes one); it waits with the others until they are sent. */
  saveNote: (note: NoteDraft) => void
  dropNote: (id: string) => void
  clearNotes: () => void
  /**
   * Sends notes to Spark as one edit; only the targets they name are made again. `with` is the note being written
   * (kept first); its targets are made again even with no note. `only` sends just that note and leaves the rest of the
   * list waiting ("Düzelt"); without it the whole list goes ("Hepsini düzelt").
   */
  sendNotes: (with_?: NoteDraft, options?: { only?: boolean }) => void
  /** Takes back the last change a note made on `target`. */
  undoAsk: (target: string) => void
  /** Takes back everything one sending of notes changed. */
  undoBatch: (batch: number) => void
  /** A request typed in the chat once the video is made; Spark applies it as one edit. */
  request: (text: string) => void
  /** Goes back to the project as it was before the request `id` (and the ones after it). */
  rewind: (id: string) => void
  /** Brings back what going back took back ("Geri getir"). */
  restore: () => void
  /** Picks what the next request is about (`null` drops the pick). */
  select: (selection: LabSelection | null) => void
  /** Hands the pick to Spark (its ✦): the composer takes the focus for it. */
  ask: () => void
}

// ---- the run's store ---------------------------------------------------------------------------------------
//
// The run lives in a small store with its own timers, so that it can be shared: the main Chat's plan canvas, its
// task list and the Spark project of the same job read one run (`runKey`, the project id), and the run goes on
// while the user moves between them. Without a key a view gets a run of its own that stops when it unmounts.

type LabRunStore = {
  get: () => LabRunState
  dispatch: (action: Action) => void
  subscribe: (listener: () => void) => () => void
  /** Timers run only while started (client side). */
  start: () => void
  stop: () => void
}

/** What runs next by itself, and when: the same rules for every view of the run. */
function nextTimer(state: LabRunState): { action: Action; delay: number } | null {
  // Notes are applied even while the run is held: the user is waiting on them.
  if (state.applying !== null) {
    const first = state.applyingLeft.length === lastBatchTargets(state).length
    return { action: { type: 'notesApplied' }, delay: first ? REMAKE_FIRST_MS : REMAKE_NEXT_MS }
  }
  // Nodes the user has made on the canvas are made even while the run is held; Spark's own steps wait for them.
  const job = state.canvas.queue[0]
  if (job) return { action: { type: 'canvasMade' }, delay: job.ms }
  if (state.paused || state.frozen) return null
  if (state.phase === 'drafting') return pendingQuestion(state) ? null : { action: { type: 'tick' }, delay: TICK_MS }
  if (state.phase === 'plan' && state.autonomy !== 'ask') return { action: { type: 'approve' }, delay: AUTO_START_MS }
  const step = STEPS[state.step]
  if (state.phase === 'building' && state.driver === 'agent' && step) return { action: { type: 'advance' }, delay: step.ms }
  if (state.phase === 'done' && state.render === 'rendering') return { action: { type: 'rendered' }, delay: RENDER_MS }
  return null
}

/** The fields the timer depends on; any other change (an edit, a lock) leaves a running timer alone. */
function timerKey(state: LabRunState) {
  return [state.phase, state.tick, state.step, state.paused, state.frozen, state.driver, state.autonomy, state.render, state.applying ?? '', state.applyingLeft.length, state.canvas.queue.length, state.canvas.queue[0]?.id ?? '', pendingQuestion(state)?.id ?? ''].join('|')
}

function createLabRunStore(init: LabRunInit): LabRunStore {
  let state = initial(init)
  let started = false
  let timer: number | null = null
  let scheduledFor = ''
  const listeners = new Set<() => void>()

  const clear = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    scheduledFor = ''
  }
  const schedule = () => {
    if (!started) return
    const key = timerKey(state)
    if (timer !== null && key === scheduledFor) return
    clear()
    const next = nextTimer(state)
    if (!next) return
    scheduledFor = key
    timer = window.setTimeout(() => {
      timer = null
      scheduledFor = ''
      dispatch(next.action)
    }, next.delay)
  }
  const dispatch = (action: Action) => {
    const next = reducer(state, action)
    if (next !== state) {
      state = next
      listeners.forEach((listener) => listener())
    }
    schedule()
  }

  return {
    get: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: () => {
      started = true
      schedule()
    },
    stop: () => {
      started = false
      clear()
    },
  }
}

const sharedStores = new Map<string, LabRunStore>()

/** The shared run of `key`, created from `init` by the first view that asks for it. Server renders get a fresh one. */
function sharedLabRunStore(key: string, init: LabRunInit) {
  if (typeof window === 'undefined') return createLabRunStore(init)
  let store = sharedStores.get(key)
  if (!store) {
    store = createLabRunStore(init)
    sharedStores.set(key, store)
    store.start()
  }
  return store
}

/**
 * The run of a view. With `runKey` it is the shared run of that key (it keeps going when the view unmounts, and
 * `init` only matters to the view that creates it); without one the view has a run of its own.
 */
export function useLabRun(init: LabRunInit = {}, runKey?: string): LabRun {
  const [local] = React.useState(() => (runKey ? null : createLabRunStore(init)))
  const store = runKey ? sharedLabRunStore(runKey, init) : local!
  React.useEffect(() => {
    if (!local) return
    local.start()
    return () => local.stop()
  }, [local])
  const state = React.useSyncExternalStore(store.subscribe, store.get, store.get)
  const { dispatch } = store

  return React.useMemo<LabRun>(
    () => ({
      state,
      title: init.title ?? null,
      submit: (prompt) => dispatch({ type: 'submit', prompt }),
      approve: () => dispatch({ type: 'approve' }),
      pause: () => dispatch({ type: 'pause' }),
      resume: () => dispatch({ type: 'resume' }),
      takeOver: () => dispatch({ type: 'takeOver' }),
      handBack: () => dispatch({ type: 'handBack' }),
      toggleFollow: () => dispatch({ type: 'toggleFollow' }),
      setAutonomy: (value) => dispatch({ type: 'autonomy', value }),
      setRatio: (value) => dispatch({ type: 'ratio', value }),
      jump: (phase) => dispatch({ type: 'jump', phase }),
      undoStep: (id) => dispatch({ type: 'undoStep', id }),
      dropAssumption: (id) => dispatch({ type: 'dropAssumption', id }),
      promote: (id) => dispatch({ type: 'promote', id }),
      render: () => dispatch({ type: 'render' }),
      keepForChannel: () => dispatch({ type: 'keepForChannel' }),
      dismissClosing: () => dispatch({ type: 'dismissClosing' }),
      toggleLock: (sceneId) => dispatch({ type: 'toggleLock', sceneId }),
      view: (sceneId) => dispatch({ type: 'view', sceneId }),
      answer: (id, text) => dispatch({ type: 'answer', id, text }),
      edit: (id, text) => dispatch({ type: 'edit', id, text }),
      pick: (id, option) => dispatch({ type: 'pick', id, option }),
      add: (kind, text) => dispatch({ type: 'add', kind, text }),
      addScene: (scene) => dispatch({ type: 'addScene', scene }),
      removeAdded: (kind, index) => dispatch({ type: 'removeAdded', kind, index }),
      canvas: {
        move: (moved) => dispatch({ type: 'canvasMove', moved }),
        add: (kind, x, y, from) => dispatch({ type: 'canvasAdd', kind, x, y, from }),
        remove: (ids) => dispatch({ type: 'canvasRemove', ids }),
        link: (source, target) => dispatch({ type: 'canvasLink', source, target }),
        unlink: (ids) => dispatch({ type: 'canvasUnlink', ids }),
        run: (jobs) => dispatch({ type: 'canvasRun', jobs }),
        stop: () => dispatch({ type: 'canvasStop' }),
        view: (view) => dispatch({ type: 'canvasView', view }),
      },
      setMedia: (id, media) => dispatch({ type: 'setMedia', id, media }),
      setRef: (id, media) => dispatch({ type: 'setRef', id, media }),
      saveNote: (note) => dispatch({ type: 'saveNote', note }),
      dropNote: (id) => dispatch({ type: 'dropNote', id }),
      clearNotes: () => dispatch({ type: 'clearNotes' }),
      sendNotes: (note, options) => dispatch({ type: 'sendNotes', with: note, only: options?.only }),
      undoAsk: (target) => dispatch({ type: 'undoAsk', target }),
      undoBatch: (batch) => dispatch({ type: 'undoBatch', batch }),
      request: (text) => dispatch({ type: 'request', text }),
      rewind: (id) => dispatch({ type: 'rewind', id }),
      restore: () => dispatch({ type: 'restore' }),
      select: (selection) => dispatch({ type: 'select', selection }),
      ask: () => dispatch({ type: 'ask', at: Date.now() }),
    }),
    [state, init.title, dispatch],
  )
}

// ---- read models -------------------------------------------------------------------------------------------

/** The project's name: its own when it has one, else the one Spark gives it from the first sentence. */
export function projectTitle(run: LabRun) {
  return run.title ?? (run.state.phase === 'empty' ? 'Yeni proje' : titleFromPrompt(run.state.prompt))
}

/** The question the draft is stopped at: the first one of this autonomy mode that is due and not answered. */
export function pendingQuestion(state: LabRunState): LabQuestion | null {
  if (state.phase !== 'drafting') return null
  return QUESTIONS.find((question) => question.modes.includes(state.autonomy) && !(question.id in state.answers) && state.tick >= question.at) ?? null
}

/** The questions that were put to the user, in order, answered or left to Spark. */
export function askedQuestions(state: LabRunState) {
  return QUESTIONS.filter((question) => question.id in state.answers)
}

/** What this video taught that the user saved to the channel. */
export function keptForChannel(state: LabRunState) {
  return SUGGESTIONS.filter((item) => state.promoted.includes(item.id))
}

/**
 * What the closing question still offers once the video is made: the final render until it is taken, saving for the
 * channel until everything is saved. `null` when nothing is left to offer or the question was put away.
 */
export function closingChoices(state: LabRunState): { render: boolean; keep: boolean } | null {
  if (state.phase !== 'done' || state.closingDismissed) return null
  const render = state.render === 'none'
  const keep = keptForChannel(state).length < SUGGESTIONS.length
  return render || keep ? { render, keep } : null
}

/** What Spark decided without asking: an assumption the user answered a question about is no longer one. */
export function assumptionsOf(state: LabRunState) {
  return ASSUMPTIONS.filter((item) => revealed(state, item.at) && !(item.question && typeof state.answers[item.question] === 'string'))
}

/** The waiting notes that name `target`. */
export function notesOn(state: LabRunState, target: string) {
  return state.notes.filter((note) => note.targets.includes(target))
}

/** Whether Spark is applying a note to `target` right now. */
export function applyingTo(state: LabRunState, target: string) {
  return state.applying !== null && state.applyingLeft.includes(target)
}

/**
 * Where a request stands: Spark is applying it, it is done, its change was taken back (from the timeline), or the
 * project went back to before it ("Öncesine dön").
 */
export function turnStatus(state: LabRunState, index: number): 'applying' | 'done' | 'undone' | 'rewound' {
  const turn = state.turns[index]
  if (!turn || (state.rewound && index >= state.rewound.at)) return 'rewound'
  if (state.applying === turn.batch) return 'applying'
  return Object.values(state.asks).some((list) => list.some((ask) => ask.batch === turn.batch)) ? 'done' : 'undone'
}

/** The targets the last sending of notes changed and that still carry that change. */
export function lastBatchTargets(state: LabRunState) {
  if (!state.batches) return []
  return Object.entries(state.asks).filter(([, list]) => list.some((ask) => ask.batch === state.batches)).map(([target]) => target)
}

/** A scene's line as it stands: the user's own wording when they rewrote it. */
export function sayOf(state: LabRunState, scene: LabScene) {
  return state.edits[`say:${scene.id}`] ?? scene.narration
}

/** What is chosen for a cast-and-look row: the user's choice, else what the plan started with. */
export function pickOf(state: LabRunState, row: string): string | null {
  return row in state.picks ? (state.picks[row] ?? null) : (LOOK_DEFAULT[row] ?? null)
}

export type StepStatus = 'done' | 'current' | 'pending' | 'skipped' | 'undone'
export type SceneStatus = 'draft' | 'queued' | 'working' | 'ready' | 'yours'

/** Whether the agent has written the item that appears on drafting tick `at`. */
export function revealed(state: LabRunState, at: number) {
  if (state.phase === 'empty') return false
  return state.phase !== 'drafting' || state.tick >= at
}

export function stepStatus(state: LabRunState, index: number): StepStatus {
  const step = STEPS[index]
  if (!step) return 'pending'
  if (state.skipped.includes(step.id)) return 'skipped'
  if (state.phase === 'done' || (state.phase === 'building' && index < state.step)) return state.undone.includes(step.id) ? 'undone' : 'done'
  if (state.phase === 'building' && index === state.step) return 'current'
  return 'pending'
}

/** The step the agent is on, while it is building. */
export function currentStep(state: LabRunState): AgentStep | null {
  return state.phase === 'building' ? (STEPS[state.step] ?? null) : null
}

/** Whether the media or layer `key` (`<sceneId>:<part>`) is on the timeline yet. */
export function isAdded(state: LabRunState, key: string) {
  const index = STEPS.findIndex((step) => step.adds === key)
  return index >= 0 && stepStatus(state, index) === 'done'
}

export function sceneStatus(state: LabRunState, sceneId: string): SceneStatus {
  if (state.locked.includes(sceneId)) return 'yours'
  if (state.phase !== 'building' && state.phase !== 'done') return 'draft'
  const statuses = STEPS.map((step, index) => (step.sceneId === sceneId ? stepStatus(state, index) : null)).filter(Boolean) as StepStatus[]
  if (statuses.includes('current')) return 'working'
  if (statuses.every((status) => status !== 'pending')) return 'ready'
  return statuses.some((status) => status === 'done') ? 'working' : 'queued'
}

/** The scene on screen: the one the agent works on while following, otherwise the user's own choice. */
export function shownSceneId(state: LabRunState) {
  if (state.phase !== 'building' || !state.follow) return state.viewScene
  for (let index = Math.min(state.step, STEPS.length - 1); index >= 0; index -= 1) {
    const sceneId = STEPS[index]!.sceneId
    if (sceneId) return sceneId
  }
  return state.viewScene
}

export function progress(state: LabRunState) {
  const total = STEPS.length - state.skipped.length
  const done = STEPS.filter((_, index) => ['done', 'undone'].includes(stepStatus(state, index))).length
  return { done, total }
}

/** True while the agent is the one changing the timeline. */
export function agentDriving(state: LabRunState) {
  return state.phase === 'building' && state.driver === 'agent' && !state.paused
}

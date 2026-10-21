// Plan › Üretim: how each scene of the plan is made, as the nodes Spark puts on the canvas (`plan-chain.tsx`). A
// picture is made, its frame is handed to a video model; the scene's line is written and voiced; the whole video gets
// its music and final cut. The chain is read from what the plan already holds (a scene's source and model, its
// reference, its line, the voice and music chosen for the video), so Senaryo and Üretim are one plan. What the user
// does on the canvas (moving, adding, linking, making a node) is kept in the run (`LabCanvas`) over this.

import {
  DEFAULT_MODEL,
  LOOK_OPTIONS,
  MODELS,
  SCENES,
  STEPS,
  TOTAL_SECONDS,
  assetById,
  formatClock,
  type AssetKind,
  type LabScene,
  type SceneArt,
} from './lab-model'
import { pickOf, sayOf, stepStatus, type AddedScene, type LabMedia, type LabRunState } from './use-lab-run'

export type StageKind = 'text' | 'image' | 'frame' | 'video' | 'voice' | 'music' | 'media'

/** The kinds of node, named the way the plan names things (never "node", "LLM" or "prompt"). */
export const STAGE_KIND: Record<StageKind, { name: string; icon: string; hint: string }> = {
  text: { name: 'Metin', icon: 'type', hint: 'Spark yazar: anlatım, başlık, istem' },
  image: { name: 'Görsel', icon: 'image', hint: 'Bir modelle görsel üret' },
  video: { name: 'Video', icon: 'video', hint: 'Bağlı görselden ya da kareden klip' },
  frame: { name: 'Kare', icon: 'crop', hint: 'Klibin ilk ya da son karesi' },
  voice: { name: 'Ses', icon: 'mic', hint: 'Bağlı metni seslendir' },
  music: { name: 'Müzik', icon: 'music', hint: 'Videonun altına müzik' },
  media: { name: 'Görselim', icon: 'upload', hint: 'Kendi görselin ya da klibin' },
}
export const STAGE_KINDS = Object.keys(STAGE_KIND) as StageKind[]

export type ChainStage = {
  /** `<lane>/<part>`: a target of its own for picks and remakes (scene ids and timeline clips have no slash). */
  id: string
  kind: StageKind
  title: string
  /** What makes it: a model, the user's own media, stock, the Brand Kit, Spark. */
  how: string
  /** What it is told (its composer); kept in the run's edits under `briefKey`. */
  brief: string
  briefKey: string
  credits: number
  /** What its output looks like (the demo's drawings), for pictures and clips. */
  art?: SceneArt
  /** A clip's or a voice's length. */
  seconds?: number
  /** What a text node holds, and where a rewrite of it is kept (a scene's line is shared with Senaryo). */
  text?: { value: string; key: string }
}

export type ChainLane = {
  /** The scene id, or `all` for the steps of the whole video. */
  id: string
  n: number | null
  role: string
  seconds: number
  /** The planned scene, for its state and the hold button; `null` for the whole video and for scenes the user added. */
  scene: LabScene | null
  /** The picture chain, then the words chain (line → voice). */
  stages: ChainStage[]
  pictures: number
  /** The planned links: each step to the next in its chain, and a video started from the scene before it. */
  links: [string, string][]
  continues: boolean
  canContinue: boolean
}

/** What Spark tells each scene's models, as it drafts the plan (demo values). */
const SCENE_BRIEFS: Record<string, { image?: string; video?: string }> = {
  s1: { video: 'Logo ortada belirir, marka renginde.' },
  s2: { image: 'Buharı tüten balkabaklı risotto, sıcak ışık, yakın plan.', video: 'Kamera tabağa yavaşça yaklaşır, buhar yükselir.' },
  s3: { video: 'Şef balkabağını tavaya ekliyor; sesi klipten.' },
  s4: { video: 'Fırından çıkan balkabağı, yavaş çekim.' },
  s5: { image: 'Marka renginde sade kapanış zemini, üstte sıcak bir ışık.' },
}

export const creditsOf = (meta: string) => Number(/~(\d+)\s*kredi/.exec(meta)?.[1] ?? 0)

/** The source of a scene's picture as the plan has it now (`SourcePicker` writes it). */
function sourceOf(state: LabRunState, id: string, planned: AssetKind): AssetKind {
  return (state.picks[`source:${id}`] as AssetKind | undefined) ?? planned
}

/** The model a node makes with: its own pick (a scene's picture shares the scene's), else the default. */
export function modelOf(state: LabRunState, key: string) {
  return MODELS.find((entry) => entry.id === (state.picks[`model:${key}`] ?? DEFAULT_MODEL)) ?? MODELS[0]!
}

/** The voice the video is narrated in (Senaryo › Karakter ve görünüm). */
export function voiceName(state: LabRunState) {
  const picked = pickOf(state, 'voice')
  if (picked?.startsWith('new:')) return 'Yeni ses'
  return LOOK_OPTIONS.voice?.find((entry) => entry.id === picked)?.title ?? 'Marka sesi'
}

const stageOf = (lane: string, part: string, rest: Omit<ChainStage, 'id' | 'briefKey'>): ChainStage => ({ id: `${lane}/${part}`, briefKey: `brief:${lane}/${part}`, ...rest })

/** The picture steps of a scene, by where its picture comes from. */
function pictureStages(state: LabRunState, lane: string, input: {
  role: string
  seconds: number
  planned: AssetKind
  art: SceneArt
  asset: ReturnType<typeof assetById>
  previous: { n: number; art: SceneArt } | null
}): { stages: ChainStage[]; continues: boolean; canContinue: boolean } {
  const { role, seconds, art, asset, previous } = input
  const kind = sourceOf(state, lane, input.planned)
  const briefs = SCENE_BRIEFS[lane] ?? {}
  const one = (stage: ChainStage) => ({ stages: [stage], continues: false, canContinue: false })

  if (kind === 'generate') {
    const model = modelOf(state, lane)
    const canContinue = model.kind === 'video' && previous !== null
    const continues = canContinue && state.picks[`from:${lane}`] === 'prev'
    const ref = state.refs[lane]
    const first = continues
      ? stageOf(lane, 'start', { kind: 'frame', title: `${previous!.n}. sahnenin son karesi`, how: 'Son kare', brief: '', credits: 0, art: previous!.art })
      : ref
        ? stageOf(lane, 'image', { kind: 'media', title: ref.title, how: 'Görselim · referans', brief: '', credits: 0, art: ref.art ?? art })
        : stageOf(lane, 'image', {
            kind: 'image',
            title: asset?.title ?? `${role} görseli`,
            how: model.kind === 'image' ? model.title : 'FLUX.2 Pro',
            brief: briefs.image ?? `${role} sahnesi için bir görsel.`,
            credits: model.kind === 'image' ? creditsOf(model.meta) : 4,
            art,
          })
    if (model.kind === 'image') return one(first)
    const video = stageOf(lane, 'video', {
      kind: 'video',
      title: asset?.kind === 'generate' ? `${asset.title} · klip` : `${role} klibi`,
      how: `${model.title} · ${seconds} sn`,
      brief: briefs.video ?? 'Kamera yavaşça hareket eder.',
      credits: creditsOf(model.meta),
      art,
      seconds,
    })
    return { stages: [first, video], continues, canContinue }
  }

  if (kind === 'library') {
    const media: LabMedia | null = state.media[lane] ?? (asset?.kind === 'library' ? { title: asset.title, art: asset.art, video: true } : null)
    if (!media) return one(stageOf(lane, 'image', { kind: 'media', title: 'Görselim', how: 'Depodan seç ya da yükle', brief: '', credits: 0 }))
    const clip = stageOf(lane, 'clip', { kind: 'media', title: media.title, how: media.video ? 'Görselim · klip' : 'Görselim', brief: '', credits: 0, art: media.art ?? art, seconds: media.video ? seconds : undefined })
    // A planned clip of the user's is trimmed to the part the plan uses ("0:04–0:13 kullanılacak").
    const part = media === state.media[lane] ? null : /(\d:\d\d–\d:\d\d)/.exec(asset?.meta ?? '')?.[1]
    if (!part) return one(clip)
    const trim = stageOf(lane, 'trim', { kind: 'video', title: `Kırp · ${part}`, how: 'Spark', brief: briefs.video ?? '', credits: 0, art: media.art ?? art, seconds })
    return { stages: [clip, trim], continues: false, canContinue: false }
  }

  if (kind === 'stock') {
    return one(stageOf(lane, 'clip', { kind: 'video', title: asset?.kind === 'stock' ? asset.title : `${role} · stok klip`, how: 'Stok · ücretsiz', brief: briefs.video ?? 'Sahneye uyan bir stok klip.', credits: 0, art, seconds }))
  }

  // Brand Kit: the kit's own clip (the intro), or a background in the kit's colours.
  return asset?.kind === 'kit'
    ? one(stageOf(lane, 'clip', { kind: 'video', title: asset.title, how: 'Brand Kit', brief: briefs.video ?? '', credits: 0, art, seconds }))
    : one(stageOf(lane, 'image', { kind: 'image', title: `${role} zemini`, how: 'Brand Kit', brief: briefs.image ?? 'Marka renginde sade bir zemin.', credits: 0, art }))
}

/** A scene's words: Spark writes its line, then it is voiced (a line in quotes is said in the scene's own clip). */
function wordStages(state: LabRunState, lane: string, line: string, seconds: number, ownClip: boolean): ChainStage[] {
  if (!line) return []
  return [
    stageOf(lane, 'say', { kind: 'text', title: 'Anlatım', how: 'Spark yazar', brief: '', credits: 0, text: { value: line, key: `say:${lane}` } }),
    stageOf(lane, 'voice', {
      kind: 'voice',
      title: ownClip ? 'Konuşma · klipten' : 'Seslendirme',
      how: ownClip ? 'Klibin kendi sesi' : voiceName(state),
      brief: ownClip ? '' : 'Sıcak, samimi; acele etmeden.',
      credits: ownClip ? 0 : 2,
      seconds,
    }),
  ]
}

/** Each step to the next within its chain (the picture chain, then the words chain). */
const chainLinks = (stages: ChainStage[], pictures: number): [string, string][] =>
  stages.flatMap((stage, index) => (index > 0 && index !== pictures ? [[stages[index - 1]!.id, stage.id] as [string, string]] : []))

/** Where the lane before ends: its number and its last picture, for a video that starts from there. */
const endOf = (lane: ChainLane | null) => (lane?.n ? { n: lane.n, art: lane.stages[lane.pictures - 1]?.art ?? 'hook' } : null)

function laneOf(base: Omit<ChainLane, 'stages' | 'pictures' | 'links' | 'continues' | 'canContinue'>, picture: ReturnType<typeof pictureStages>, words: ChainStage[], previous: ChainLane | null): ChainLane {
  const stages = [...picture.stages, ...words]
  const links = chainLinks(stages, picture.stages.length)
  // A video started where the scene before it ends takes that scene's last picture.
  const handover = previous && picture.continues ? previous.stages[previous.pictures - 1] : undefined
  if (handover) links.unshift([handover.id, stages[0]!.id])
  return { ...base, stages, pictures: picture.stages.length, links, continues: picture.continues, canContinue: picture.canContinue }
}

function sceneLane(state: LabRunState, scene: LabScene, previous: ChainLane | null): ChainLane {
  const asset = assetById(scene.assetId)
  const seconds = scene.end - scene.start
  const planned = asset?.kind ?? 'kit'
  const picture = pictureStages(state, scene.id, { role: scene.role, seconds, planned, art: scene.art, asset, previous: endOf(previous) })
  const ownClip = scene.narration.startsWith('“') && sourceOf(state, scene.id, planned) === 'library'
  const words = wordStages(state, scene.id, sayOf(state, scene), seconds, ownClip)
  return laneOf({ id: scene.id, n: scene.n, role: scene.role, seconds, scene }, picture, words, previous)
}

function addedLane(state: LabRunState, scene: AddedScene, n: number, previous: ChainLane | null): ChainLane {
  const role = state.edits[`role:${scene.id}`] || scene.role || 'Yeni sahne'
  const picture = pictureStages(state, scene.id, { role, seconds: scene.seconds, planned: 'generate', art: 'hook', asset: null, previous: endOf(previous) })
  const words = wordStages(state, scene.id, state.edits[`say:${scene.id}`] ?? scene.say, scene.seconds, false)
  return laneOf({ id: scene.id, n, role, seconds: scene.seconds, scene: null }, picture, words, previous)
}

/** The steps of the whole video: its music and the cut that puts the scenes together. */
function videoLane(state: LabRunState): ChainLane {
  const music = LOOK_OPTIONS.music?.find((entry) => entry.id === pickOf(state, 'music'))
  const stages: ChainStage[] = []
  if (music && music.id !== 'none') {
    stages.push({ id: 'all/music', kind: 'music', title: music.title, how: 'Müzik kütüphanesi', brief: `${music.sub ?? ''}; anlatımın altında kalsın.`.replace(/^; /, ''), briefKey: 'brief:all/music', credits: 0, seconds: TOTAL_SECONDS })
  }
  stages.push({ id: 'all/cut', kind: 'video', title: 'Son kurgu', how: `${formatClock(TOTAL_SECONDS)} · ${state.ratio}`, brief: 'Sahneler sırayla, müzik ve altyazıyla; kurallara göre kontrol edilir.', briefKey: 'brief:all/cut', credits: 0, seconds: TOTAL_SECONDS })
  return { id: 'all', n: null, role: 'Tüm video', seconds: TOTAL_SECONDS, scene: null, stages, pictures: stages.length, links: chainLinks(stages, stages.length), continues: false, canContinue: false }
}

/** The chain of the plan as it stands: a lane per scene written so far (the planned ones, then the user's), then the whole video. */
export function chainLanes(state: LabRunState, scenes: LabScene[]): ChainLane[] {
  const lanes: ChainLane[] = []
  scenes.forEach((scene) => lanes.push(sceneLane(state, scene, lanes[lanes.length - 1] ?? null)))
  if (state.phase === 'drafting') return lanes
  state.added.scenes.forEach((scene, index) => lanes.push(addedLane(state, scene, scenes.length + index + 1, lanes[lanes.length - 1] ?? null)))
  return [...lanes, videoLane(state)]
}

// ---- where a step stands ------------------------------------------------------------------------------------

/**
 * `writing` while Spark drafts the plan, `draft` on a plan not yet approved (a low-resolution draft, as Senaryo's
 * frames), then `queued` → `running` → `done` while Spark makes it. `yours` on a scene the user holds.
 */
export type StageStatus = 'writing' | 'draft' | 'queued' | 'running' | 'done' | 'yours'

export const isPicture = (stage: ChainStage) => stage.kind === 'image' || stage.kind === 'frame' || stage.kind === 'video' || stage.kind === 'media'

const LANE_STEPS = (lane: string) => STEPS.map((step, index) => ({ step, index })).filter(({ step }) => (lane === 'all' ? step.sceneId === null : step.sceneId === lane))

/**
 * When each of Spark's steps of a lane is made, in ms of the lane's own steps: the picture steps take the time of the
 * scene's media step, the words (line, voice) the time of its other steps, one after another.
 */
function spans(lane: ChainLane): Map<string, [number, number]> {
  const steps = LANE_STEPS(lane.id).map(({ step }) => step)
  const out = new Map<string, [number, number]>()
  if (lane.id === 'all') {
    let at = 0
    const each = steps.reduce((sum, step) => sum + step.ms, 0) / Math.max(lane.stages.length, 1)
    lane.stages.forEach((stage) => out.set(stage.id, [at, (at += each)]))
    return out
  }
  const media = steps.find((step) => step.adds === `${lane.id}:media`)
  const total = steps.reduce((sum, step) => sum + step.ms, 0)
  const mediaMs = media?.ms ?? total
  const pictures = lane.stages.filter(isPicture)
  const others = lane.stages.filter((stage) => !isPicture(stage))
  let at = 0
  pictures.forEach((stage) => out.set(stage.id, [at, (at += mediaMs / pictures.length)]))
  // A scene with nothing but its media step makes its words in the last part of it.
  const rest = total - mediaMs || mediaMs * 0.4
  if (total === mediaMs) at = mediaMs * 0.6
  others.forEach((stage) => out.set(stage.id, [at, (at += rest / others.length)]))
  return out
}

/** How far Spark is into a lane's own steps, in ms; `fraction` is how far it is into the step it is on. */
function laneElapsed(state: LabRunState, lane: string, fraction: number) {
  let elapsed = 0
  for (const { step, index } of LANE_STEPS(lane)) {
    const status = stepStatus(state, index)
    if (status === 'done' || status === 'undone' || status === 'skipped') elapsed += step.ms
    else if (status === 'current') return elapsed + fraction * step.ms
    else break
  }
  return elapsed
}

/** Where Spark's own run has every planned step. `fraction`: how far it is into its current step (0–1). */
export function stageStatuses(state: LabRunState, lanes: ChainLane[], fraction: number): Map<string, StageStatus> {
  const out = new Map<string, StageStatus>()
  for (const lane of lanes) {
    const held = state.locked.includes(lane.id)
    const timing = spans(lane)
    const elapsed = state.phase === 'building' ? laneElapsed(state, lane.id, fraction) : 0
    for (const stage of lane.stages) {
      let status: StageStatus
      if (held) status = 'yours'
      else if (!lane.scene && lane.id !== 'all') status = 'draft'
      else if (state.phase === 'drafting') status = 'writing'
      else if (state.phase === 'plan') status = 'draft'
      else if (state.phase === 'done') status = 'done'
      else {
        const [from, to] = timing.get(stage.id) ?? [0, 0]
        status = elapsed >= to ? 'done' : elapsed >= from && elapsed > 0 ? 'running' : 'queued'
      }
      out.set(stage.id, status)
    }
  }
  return out
}

/** The scenes' pictures in order, for the final cut's filmstrip. */
export const CUT_FRAMES: SceneArt[] = SCENES.map((scene) => scene.art)

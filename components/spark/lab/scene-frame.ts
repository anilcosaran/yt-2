import type { LabRatio, LabScene, SceneLayer } from './lab-model'

// Spark lab: a scene's frame as an SVG data URL, for surfaces that take a media URL (the Flow canvas's media
// and preview nodes). It draws the same stand-in pictures as `lab.css` does for the scene cards.

const SIZE: Record<LabRatio, [number, number]> = { '9:16': [360, 640], '16:9': [640, 360], '1:1': [480, 480] }
const FONT = 'Inter, Segoe UI, system-ui, sans-serif'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Breaks `text` into lines that fit `width` at `size` (average glyph width, good enough for a stand-in). */
function wrap(text: string, size: number, width: number) {
  const lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last.length + word.length + 1) * size * 0.54 <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

function label(lines: string[], x: number, y: number, size: number, fill: string, anchor = 'middle') {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * size * 1.18}" font-family="${FONT}" font-size="${size}" font-weight="600" fill="${fill}" text-anchor="${anchor}">${escape(line)}</text>`)
    .join('')
}

function picture(scene: LabScene, w: number, h: number) {
  const m = Math.min(w, h)
  const cx = w / 2
  if (scene.art === 'intro') {
    const side = m * 0.2
    return `<rect width="${w}" height="${h}" fill="url(#intro)"/><rect x="${cx - side / 2}" y="${h * 0.38 - side / 2}" width="${side}" height="${side}" rx="${side * 0.14}" fill="#f2e9dc" transform="rotate(45 ${cx} ${h * 0.38})"/>`
  }
  if (scene.art === 'hook') {
    return `<rect width="${w}" height="${h}" fill="url(#wood)"/><ellipse cx="${cx}" cy="${h * 0.64}" rx="${m * 0.52}" ry="${m * 0.46}" fill="#000" opacity=".35"/><ellipse cx="${cx}" cy="${h * 0.6}" rx="${m * 0.43}" ry="${m * 0.37}" fill="#f6f1e7"/><ellipse cx="${cx}" cy="${h * 0.6}" rx="${m * 0.31}" ry="${m * 0.27}" fill="url(#risotto)"/>`
  }
  if (scene.art === 'chef') {
    const body = m * 0.62
    return `<rect width="${w}" height="${h}" fill="url(#kitchen)"/><rect x="${cx - body / 2}" y="${h * 0.47}" width="${body}" height="${h}" rx="${body * 0.44}" fill="#f4f1ea"/><circle cx="${cx}" cy="${h * 0.36}" r="${m * 0.135}" fill="#e8c7a6"/>`
  }
  if (scene.art === 'dish') {
    const r = Math.min(w * 0.5, h * 0.46)
    return `<rect width="${w}" height="${h}" fill="url(#table)"/><circle cx="${cx}" cy="${h * 0.46}" r="${r * 0.68}" fill="#ddd5c5"/><circle cx="${cx}" cy="${h * 0.46}" r="${r * 0.64}" fill="#f6f1e7"/><circle cx="${cx}" cy="${h * 0.46}" r="${r * 0.4}" fill="url(#risotto)"/>`
  }
  return `<rect width="${w}" height="${h}" fill="url(#brand)"/><ellipse cx="${cx}" cy="${h * 0.32}" rx="${w * 0.8}" ry="${h * 0.46}" fill="url(#glow)"/>`
}

function layer(item: SceneLayer, w: number, h: number, opacity: number) {
  const m = Math.min(w, h)
  const cx = w / 2
  const group = (body: string) => `<g opacity="${opacity}">${body}</g>`
  const pill = (text: string, size: number, x: number, y: number, fill: string, ink: string, radius: number, align: 'center' | 'left' | 'right') => {
    const width = text.length * size * 0.56 + size * 1.3
    const left = align === 'center' ? x - width / 2 : align === 'left' ? x : x - width
    return `<rect x="${left}" y="${y - size * 1.05}" width="${width}" height="${size * 1.7}" rx="${radius}" fill="${fill}"/>${label([text], left + width / 2, y + size * 0.18, size, ink)}`
  }
  if (item.kind === 'logo') return group(label([item.text], cx, h * 0.52 + m * 0.08, m * 0.08, '#fff'))
  if (item.kind === 'title') return group(label(wrap(item.text, m * 0.105, w * 0.84), cx, h * 0.12 + m * 0.105, m * 0.105, '#fff'))
  if (item.kind === 'lower') return group(pill(item.text, m * 0.054, w * 0.07, h * 0.81, '#f6f1e7', '#22140b', m * 0.016, 'left'))
  if (item.kind === 'price') return group(pill(item.text, m * 0.06, cx, h * 0.8, '#f6f1e7', '#3a2413', m * 0.024, 'center'))
  if (item.kind === 'badge') return group(pill(item.text, m * 0.046, w * 0.94, h * 0.06 + m * 0.05, 'rgba(0,0,0,.6)', '#fff', m * 0.04, 'right'))
  return group(label(wrap(item.text, m * 0.064, w * 0.8), cx, h * 0.43 + m * 0.064, m * 0.064, '#fff'))
}

/**
 * The scene's frame. `built` is false while the scene only exists in the plan: the picture is then dimmed and
 * every layer is drawn as a ghost; `placed` lists the layer keys that are on the timeline already.
 */
export function sceneFrameUrl(scene: LabScene, ratio: LabRatio, built: boolean, placed: string[]) {
  const [w, h] = SIZE[ratio]
  const layers = scene.layers.map((item) => layer(item, w, h, built && placed.includes(item.key) ? 1 : 0.5)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<radialGradient id="intro" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#2f3532"/><stop offset="1" stop-color="#121514"/></radialGradient>
<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54331b"/><stop offset="1" stop-color="#22140b"/></linearGradient>
<linearGradient id="kitchen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66746b"/><stop offset="1" stop-color="#2b3531"/></linearGradient>
<linearGradient id="table" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f2d20"/><stop offset="1" stop-color="#1d140d"/></linearGradient>
<linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#21433a"/><stop offset="1" stop-color="#0e1f1b"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#f7c66a" stop-opacity=".28"/><stop offset="1" stop-color="#f7c66a" stop-opacity="0"/></radialGradient>
<radialGradient id="risotto"><stop offset="0" stop-color="#fbd98c"/><stop offset=".55" stop-color="#f0a43a"/><stop offset="1" stop-color="#c56c18"/></radialGradient>
<filter id="plan"><feColorMatrix type="saturate" values="0.28"/><feComponentTransfer><feFuncR type="linear" slope="0.74"/><feFuncG type="linear" slope="0.74"/><feFuncB type="linear" slope="0.74"/></feComponentTransfer></filter>
</defs>
<g${built ? '' : ' filter="url(#plan)"'}>${picture(scene, w, h)}</g>${layers}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

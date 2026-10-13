export type TranscriptCue = {
  start: number
  end: number
  text: string
}

export function parseTimedTranscript(content: string): TranscriptCue[] {
  const normalized = content.replace(/^\uFEFF/, '').trim()
  if (!normalized) return []
  if (/WEBVTT/i.test(normalized.slice(0, 16)) || normalized.includes('-->')) {
    const cues = parseCueBlocks(normalized)
    if (cues.length > 0) return cues
  }
  return [{ start: 0, end: 0, text: normalized }]
}

export function formatCueClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const rest = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function findActiveCueIndex(cues: TranscriptCue[], currentTime: number) {
  if (cues.length === 0) return -1
  const time = Math.max(0, currentTime)
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]
    if (!cue) continue
    const next = cues[index + 1]
    const end = cue.end > cue.start ? cue.end : (next?.start ?? cue.start + 4)
    if (time >= cue.start && time < end) return index
  }
  const last = cues[cues.length - 1]
  return last && time >= last.start ? cues.length - 1 : -1
}

function parseCueBlocks(content: string): TranscriptCue[] {
  const blocks = content.replace(/\r/g, '').split(/\n{2,}/)
  const cues: TranscriptCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue
    const timing = parseTimingLine(lines[timingIndex] ?? '')
    if (!timing) continue
    const text = lines.slice(timingIndex + 1).join(' ').replace(/<[^>]+>/g, '').trim()
    if (!text) continue
    cues.push({ start: timing.start, end: timing.end, text })
  }
  return cues
}

function parseTimingLine(line: string) {
  const match = line.match(/([0-9:,.]+)\s*-->\s*([0-9:,.]+)/)
  if (!match) return null
  const start = parseClock(match[1] ?? '')
  const end = parseClock(match[2] ?? '')
  if (start == null || end == null) return null
  return { start, end }
}

function parseClock(value: string) {
  const cleaned = value.trim().replace(',', '.')
  const parts = cleaned.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const numbers = parts.map((part) => Number(part))
  if (numbers.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 2) {
    return (numbers[0] ?? 0) * 60 + (numbers[1] ?? 0)
  }
  return (numbers[0] ?? 0) * 3600 + (numbers[1] ?? 0) * 60 + (numbers[2] ?? 0)
}

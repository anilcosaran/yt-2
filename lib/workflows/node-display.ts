export function getWorkflowNodeTitle(nodeType: string, alias?: string | null) {
  const cleanAlias = cleanDisplayText(alias)
  if (cleanAlias && !isVersionedNodeType(cleanAlias)) return cleanAlias
  const normalized = normalizeNodeType(nodeType)
  if (normalized.includes('review') || normalized.includes('gate')) return 'Review'
  if (normalized.includes('prompt_generate')) return 'Prompt generator'
  if (normalized.includes('prompt_enhance')) return 'Prompt enhance'
  if (normalized === 'map' || normalized.startsWith('map@') || normalized.endsWith('.map')) return 'Map'
  return humanizeNodeType(nodeType)
}

export function getWorkflowNodeSubtitle(nodeType: string) {
  return getWorkflowNodePurpose(nodeType)
}

export function getWorkflowNodeDescription(nodeType: string, fallback?: string | null) {
  const cleanFallback = cleanDisplayText(fallback)
  if (cleanFallback && !isVersionedNodeType(cleanFallback)) return cleanFallback
  return getWorkflowNodePurpose(nodeType)
}

export function getWorkflowNodeProvider(nodeType: string) {
  const normalized = normalizeNodeType(nodeType)
  if (normalized.includes('image_generate') || normalized.includes('image.generate')) return 'FLUX.2 Klein 4B'
  if (normalized.includes('prompt_generate') || normalized.includes('prompt_enhance')) return 'auto-llm'
  if (normalized.includes('gpt') || normalized.includes('llm')) return 'Youtorch AI'
  if (normalized.includes('youtube')) return 'YouTube'
  if (normalized.includes('veo')) return 'Video model'
  if (normalized.includes('ffmpeg') || normalized.includes('render')) return 'Render'
  if (normalized.includes('review') || normalized.includes('gate')) return 'Review'
  if (normalized.includes('storage')) return 'Storage'
  if (normalized.includes('upload') || normalized.includes('publish')) return 'Publisher'
  if (normalized.includes('input') || normalized.includes('trigger')) return 'Youtorch'
  return 'Youtorch'
}

export function getWorkflowNodePurpose(nodeType: string) {
  const normalized = normalizeNodeType(nodeType)
  if (normalized.includes('input') || normalized.includes('trigger') || normalized.includes('manual')) {
    return 'Starts the workflow with user input.'
  }
  if (normalized.includes('llm') || normalized.includes('gpt') || normalized.includes('text')) {
    return 'Generates or analyzes text.'
  }
  if (normalized.includes('prompt_generate')) {
    return 'Generates a prompt for downstream media nodes.'
  }
  if (normalized.includes('prompt_enhance')) {
    return 'Improves a prompt before generation.'
  }
  if (normalized === 'map' || normalized.startsWith('map@') || normalized.endsWith('.map')) {
    return 'Runs the next step once for each list item. Answers collect as a list.'
  }
  if (normalized.includes('image_generate') || normalized.includes('image')) {
    return 'Creates or processes images.'
  }
  if (normalized.includes('render') || normalized.includes('video') || normalized.includes('ffmpeg') || normalized.includes('veo')) {
    return 'Renders the media output.'
  }
  if (normalized.includes('upload') || normalized.includes('publish') || normalized.includes('schedule') || normalized.includes('post')) {
    return 'Publishes the finished result.'
  }
  if (normalized.includes('review') || normalized.includes('gate')) {
    return 'Waits for approval before continuing.'
  }
  if (normalized.includes('router') || normalized.includes('branch')) {
    return 'Routes the workflow by rules.'
  }
  if (normalized.includes('analytics') || normalized.includes('metric') || normalized.includes('watch')) {
    return 'Tracks performance signals.'
  }
  if (normalized.includes('storage')) {
    return 'Stores files and metadata.'
  }
  if (normalized.includes('response') || normalized.includes('output')) {
    return 'Returns the final output.'
  }
  return 'Runs this workflow step.'
}

export function humanizeNodeType(nodeType: string) {
  const withoutVersion = nodeType.split('@')[0] ?? nodeType
  const lastSegment = withoutVersion.split('.').filter(Boolean).at(-1) ?? withoutVersion
  const clean = lastSegment
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return 'Workflow step'
  return clean.replace(/\b\w/g, (char) => char.toUpperCase())
}

function isVersionedNodeType(value: string) {
  return /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*@\d+$/i.test(value.trim())
}

function normalizeNodeType(value: string) {
  return value.toLocaleLowerCase('en-US')
}

function cleanDisplayText(value?: string | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

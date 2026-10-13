type WorkflowDisplayTranslator = (key: string) => string

const workflowDisplayKeys: Record<string, string> = {
  'image review flow': 'starter.workflowName',
  'review a starter image before generating a new variation.': 'starter.workflowDescription',
  'review a starter image before generating a new image variation.': 'starter.workflowDescription',
  'image input': 'starter.imageInput',
  'starter image for review.': 'starter.imageDescription',
  review: 'starter.review',
  'approval gate': 'starter.approvalGate',
  'approve the image before generation continues.': 'starter.reviewDescription',
  'image generation': 'starter.imageGeneration',
  'create a polished cinematic variation of the approved image.': 'starter.generationDescription',
  'manual run': 'starter.manualRun',
  'not scheduled': 'starter.notScheduled',
  'never run': 'starter.neverRun',
  draft: 'starter.draft',
  success: 'starter.success',
  'avg. cost': 'starter.averageCost',
}

export function localizeWorkflowDisplayText(value: string, t: WorkflowDisplayTranslator) {
  const key = workflowDisplayKeys[value.trim().toLocaleLowerCase('en-US')]
  return key ? t(key) : value
}

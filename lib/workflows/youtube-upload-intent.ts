import type { Workflow } from '@/lib/types'

export const YOUTUBE_UPLOAD_WORKFLOW_INTENT = 'youtube-upload'
export const YOUTUBE_UPLOAD_PUBLISH_UNSUPPORTED = true

export function youtubeUploadPublishSupport() {
  return {
    supported: false as const,
    reason: 'not_supported' as const,
    destination: 'youtube' as const,
  }
}

const STORAGE_OBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function getYoutubeUploadIntentStorageObjectId(
  intent: string | null | undefined,
  storageObjectId: string | null | undefined,
) {
  if (intent !== YOUTUBE_UPLOAD_WORKFLOW_INTENT) return null
  const normalized = storageObjectId?.trim()
  if (!normalized || normalized.length > 255) return null
  return STORAGE_OBJECT_ID_PATTERN.test(normalized) ? normalized : null
}

export function applyYoutubeUploadIntent(
  draft: Workflow,
  storageObjectId: string,
  copy: {
    workflowName: string
    workflowDescription: string
    videoTitle: string
    videoSubtitle: string
    videoDescription: string
    inputProvider: string
    uploadTitle: string
    uploadSubtitle: string
    uploadDescription: string
  },
): Workflow {
  const sourceNodeId = 'viral_clip_video'
  const uploadNodeId = 'youtube_upload'
  return {
    ...draft,
    name: copy.workflowName,
    description: copy.workflowDescription,
    nodesCount: 2,
    nodes: [
      {
        id: sourceNodeId,
        title: copy.videoTitle,
        subtitle: copy.videoSubtitle,
        kind: 'input',
        provider: copy.inputProvider,
        status: 'never',
        cost: '0c',
        description: copy.videoDescription,
        position: { x: 80, y: 160 },
        outputs: ['video'],
        outputPorts: [{ id: 'video', label: copy.videoTitle, type: 'video' }],
        settings: {
          helper_input: 'video',
          helper_storage_object_id: storageObjectId,
          helper_value: `storage://${storageObjectId}`,
        },
      },
      {
        id: uploadNodeId,
        title: copy.uploadTitle,
        subtitle: copy.uploadSubtitle,
        kind: 'publish',
        provider: 'YouTube',
        status: 'never',
        cost: '0c',
        description: copy.uploadDescription,
        position: { x: 440, y: 160 },
        inputs: ['media'],
        inputPorts: [{ id: 'media', label: copy.videoTitle, type: 'any' }],
        outputs: ['uploaded'],
        outputPorts: [{ id: 'uploaded', label: copy.uploadTitle, type: 'list' }],
        settings: {
          node_type: 'upload@1',
          destination: 'assets',
        },
      },
    ],
    edges: [{
      id: `${sourceNodeId}-to-${uploadNodeId}`,
      source: sourceNodeId,
      target: uploadNodeId,
      sourcePort: 'video',
      targetInput: 'media',
      sourceHandle: 'output:video',
      targetHandle: 'input:media',
    }],
  }
}

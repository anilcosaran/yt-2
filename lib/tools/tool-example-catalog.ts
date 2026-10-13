export type ToolExampleBlock =
  | {
    type: 'hero'
    titleKey: string
    descriptionKey: string
  }
  | {
    type: 'image-grid'
    columns: 3 | 4 | 5
    compactTrailing?: boolean
    items: Array<{
      src: string
      altKey: string
      labelKey: string
    }>
  }
  | {
    type: 'video'
    src: string
    poster?: string
    titleKey?: string
  }
  | {
    type: 'note'
    textKey: string
  }
  | {
    type: 'custom'
    rendererId: string
  }

export type ToolExampleDefinition = {
  toolId: string
  blocks: ToolExampleBlock[]
}

const ANGLE_EXAMPLE_ITEMS = [
  { src: '/tools/angle/front.jpg', altKey: 'front_dd19f988', labelKey: 'front_dd19f988' },
  { src: '/tools/angle/front-side.jpg', altKey: 'front_side_ddc565af', labelKey: 'front_side_ddc565af' },
  { src: '/tools/angle/side.jpg', altKey: 'side_26528381', labelKey: 'side_26528381' },
  { src: '/tools/angle/back-side.jpg', altKey: 'back_side_a1e4852d', labelKey: 'back_side_a1e4852d' },
  { src: '/tools/angle/back.jpg', altKey: 'back_angle_e2af83ca', labelKey: 'back_angle_e2af83ca' },
  { src: '/tools/angle/top-down.jpg', altKey: 'top_down_a609942a', labelKey: 'top_down_a609942a' },
  { src: '/tools/angle/bottom-up.jpg', altKey: 'bottom_up_e8442acc', labelKey: 'bottom_up_e8442acc' },
  { src: '/tools/angle/front-elevated.jpg', altKey: 'front_elevated_858c089c', labelKey: 'front_elevated_858c089c' },
  { src: '/tools/angle/front-closeup.jpg', altKey: 'front_close_up_11594cd2', labelKey: 'front_close_up_11594cd2' },
] as const

const ANGLE_EXAMPLE: ToolExampleDefinition = {
  toolId: 'angle',
  blocks: [
    {
      type: 'hero',
      titleKey: 'multi_angle_image_generation_30b6c581',
      descriptionKey: 'upload_a_subject_image_to_generate_multi_angle_d_8e3992d6',
    },
    {
      type: 'image-grid',
      columns: 5,
      compactTrailing: true,
      items: [...ANGLE_EXAMPLE_ITEMS],
    },
  ],
}

export function getDefaultToolOutputView(hasOutputContent: boolean): 'history' | 'example' {
  return hasOutputContent ? 'history' : 'example'
}

export function getToolExampleDefinition(toolId: string): ToolExampleDefinition {
  if (toolId === 'angle' || toolId.startsWith('angle')) return ANGLE_EXAMPLE
  return {
    toolId,
    blocks: [
      {
        type: 'hero',
        titleKey: 'example_0f01ed56',
        descriptionKey: 'this_is_a_sample_result_for_this_tool_your_gener_b34d6163',
      },
    ],
  }
}

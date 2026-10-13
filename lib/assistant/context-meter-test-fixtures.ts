import type { AssistantContextUsage, AssistantContextUsageLastTurn } from './context-meter-api'

/** A recorded context usage as the gateway answers it (tests of the Spark context meter). */
export function contextUsage(overrides: Partial<AssistantContextUsageLastTurn> = {}, conversationId = 'conv_side'): AssistantContextUsage {
  return {
    schema: 'assistant_context_usage_v1',
    conversation_id: conversationId,
    status: 'recorded',
    last_turn: {
      run_id: 'run_2',
      recorded_at: '2026-10-03T10:00:00.000Z',
      input_tokens: 30_400,
      input_token_kind: 'counted',
      input_token_source: 'provider_reported',
      counted_input_tokens: 30_000,
      counted_input_token_source: 'provider_count_api',
      output_tokens: 300,
      cache_read_input_tokens: 20_000,
      cache_write_input_tokens: null,
      context_window_tokens: 400_000,
      max_input_tokens: 128_000,
      limit_tokens: 128_000,
      used_ratio: 0.2375,
      until_trim_tokens: 74_000,
      output_budget: { tokens: 1_500, kind: 'final_answer' },
      credits: 0.5,
      sections: [
        { key: 'system', tokens: 12_000 },
        { key: 'tools', tokens: 7_500 },
        { key: 'skill_index', tokens: 1_200 },
        { key: 'skills', tokens: 3_000 },
        { key: 'rules', tokens: 250 },
        { key: 'memory', tokens: 1_000 },
        { key: 'history', tokens: 4_000 },
        { key: 'tool_results', tokens: 0 },
        { key: 'turn_state', tokens: 1_325 },
        { key: 'user_message', tokens: 125 },
      ],
      skills: [
        { skill_id: 'youtorch.guide.youtube_shorts', name: null, layer: 'system_internal', selected_by: 'pre_router', tokens: 2_200 },
        { skill_id: 'skl_1', name: 'My captions', layer: 'personal', selected_by: 'user_selection', tokens: 800 },
      ],
      sections_basis: 'input_tokens_by_characters',
      trimming: {
        applied: false,
        steps: [],
        omitted_messages: 0,
        compacted_messages: 0,
        memory_matches_omitted: 0,
        user_skill_index_trimmed: false,
      },
      ...overrides,
    },
    job_totals: { run_id: 'run_2', planner_calls: 2, input_tokens: 50_000, output_tokens: 500, cache_read_input_tokens: 20_000, credits: 0.9 },
    conversation_totals: { planner_calls: 3, input_tokens: 70_000, output_tokens: 900, cache_read_input_tokens: 40_000, credits: 1.25 },
  }
}

export function notRecordedContextUsage(conversationId = 'conv_side'): AssistantContextUsage {
  return {
    schema: 'assistant_context_usage_v1',
    conversation_id: conversationId,
    status: 'not_recorded',
    last_turn: null,
    job_totals: null,
    conversation_totals: { planner_calls: 0, input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, credits: 0 },
  }
}

'use client'

import { AgentQuestion, type AgentQuestionOption } from '../agent/agent-thread'
import { ESTIMATE, QUESTIONS, SUGGESTIONS, type LabQuestion } from './lab-model'
import { closingChoices, type LabRun } from './use-lab-run'

/**
 * A question Spark asks instead of deciding alone, docked on the composer: a few answers to pick from, or the
 * user's own words typed below (`onOwn` puts the cursor there), or "Atla" to leave the call to Spark. The run
 * waits for it. The number keys pick an answer while nothing is being typed. It is the agent question the main
 * Chat asks with too (`AgentQuestion`).
 */
export function QuestionCard({ run, question, onOwn }: { run: LabRun; question: LabQuestion; onOwn: () => void }) {
  const asked = QUESTIONS.filter((entry) => entry.modes.includes(run.state.autonomy))
  const index = asked.findIndex((entry) => entry.id === question.id)
  return (
    <AgentQuestion
      chip={question.chip}
      position={asked.length > 1 ? `${index + 1}/${asked.length}` : undefined}
      text={question.text}
      options={question.options}
      onAnswer={(option) => run.answer(question.id, option.label)}
      onSkip={() => run.answer(question.id, null)}
      onOwn={onOwn}
      copy={{ skipTitle: 'Bu kararı Spark versin' }}
    />
  )
}

export type ClosingChoice = 'render' | 'keep'

/**
 * What comes next once the video is made, asked the same way (docked on the composer): take the final render, keep
 * what this video taught for the channel, or open the editor first (`onEdit`). An answer is done at once and leaves
 * the list; what is left stays until "Sonra". With `onAsk` (the main Chat) the answer goes to the agent as the user's
 * own words instead, and the question closes.
 */
export function ClosingQuestion({ run, onEdit, onAsk }: { run: LabRun; onEdit?: () => void; onAsk?: (choice: ClosingChoice) => void }) {
  const open = closingChoices(run.state)
  if (!open) return null
  const rules = SUGGESTIONS.filter((item) => item.kind === 'rule').length
  const templates = SUGGESTIONS.length - rules
  const options: AgentQuestionOption[] = []
  if (open.render) options.push({ id: 'render', label: 'Son render’ı al', hint: `1080p MP4 · ${ESTIMATE.render} kredi`, recommended: true })
  if (open.keep) options.push({ id: 'keep', label: 'Kanal için sakla', hint: `${rules} kural ve ${templates} şablon; sonraki videolarda kullanılır` })
  if (open.render && onEdit) options.push({ id: 'edit', label: 'Editörde aç', hint: 'Render’dan önce kendin bak, düzelt' })
  return (
    <AgentQuestion
      chip="Video hazır"
      text="Sırada ne var?"
      options={options}
      onAnswer={(option) => {
        if (option.id === 'edit') return onEdit?.()
        const choice: ClosingChoice = option.id === 'render' ? 'render' : 'keep'
        if (onAsk) {
          onAsk(choice)
          run.dismissClosing()
        } else if (choice === 'render') {
          run.render()
        } else {
          run.keepForChannel()
        }
      }}
      onSkip={run.dismissClosing}
      copy={{ skip: 'Sonra', skipTitle: 'Şimdilik bir şey yapma' }}
    />
  )
}

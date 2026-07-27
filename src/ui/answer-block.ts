import {
  answerPairLines,
  type AnswerPair
} from '../core/answer-presentation'

export const renderAnswerBlock = (
  host: HTMLElement,
  pair: AnswerPair | null
): void => {
  host.replaceChildren()
  host.hidden = pair === null
  if (!pair) return

  const [questionText, answerText] = answerPairLines(pair)
  const question = document.createElement('p')
  question.className = 'answer-question'
  question.textContent = questionText
  const answer = document.createElement('p')
  answer.className = 'answer-value'
  answer.textContent = answerText
  host.append(question, answer)
}

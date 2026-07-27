import { getPosedQuestion } from '../state/round'
import type { Preset, PresetState } from '../state/types'

export interface AnswerPair {
  question: string
  answer: string
}

export const createAnswerPair = (
  preset: Preset,
  state: PresetState,
  answer: string
): AnswerPair => ({
  question: getPosedQuestion(preset, state),
  answer
})

export const answerPairLines = (
  pair: AnswerPair
): readonly [question: string, answer: string] =>
  [pair.question, pair.answer]

export const formatSharedAnswer = (
  pair: AnswerPair,
  table: string,
  siteUrl: string
): string => {
  const [question, answer] = answerPairLines(pair)
  return `🎲 ${question}\n${answer}\n\n${table} · Fair Spin — ${siteUrl}`
}

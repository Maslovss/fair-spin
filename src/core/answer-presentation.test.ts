import { describe, expect, it } from 'vitest'
import { createPreset } from '../state/presets'
import { createPresetState } from '../state/types'
import {
  answerPairLines,
  createAnswerPair,
  formatSharedAnswer
} from './answer-presentation'

describe('answer presentation', () => {
  it('uses the posed template question, including a frozen placeholder', () => {
    const preset = createPreset(
      { name: 'Коли…?', items: ['Зараз', 'Потім'] },
      1,
      'when'
    )
    const posed = createAnswerPair(
      preset,
      { ...createPresetState(1), question: 'поїхати до бабусі' },
      'Зараз'
    )
    const privateQuestion = createAnswerPair(
      preset,
      { ...createPresetState(1), question: '‹задумане›' },
      'Потім'
    )

    expect(posed).toEqual({
      question: 'Коли поїхати до бабусі?',
      answer: 'Зараз'
    })
    expect(privateQuestion.question).toBe('Коли ‹задумане›?')
  })

  it('uses a completed question without changing it', () => {
    const preset = createPreset(
      { name: 'Що подивитись?', items: ['Комедія', 'Драма'] },
      1,
      'watch'
    )
    expect(createAnswerPair(preset, createPresetState(1), 'Комедія')).toEqual({
      question: 'Що подивитись?',
      answer: 'Комедія'
    })
  })

  it('uses the same pair on screen and in the shared answer text', () => {
    const pair = {
      question: 'Коли поїхати до бабусі?',
      answer: 'Зараз'
    }
    const screen = answerPairLines(pair)
    const shared = formatSharedAnswer(pair, 'Колесо', 'example.test/fair-spin')

    expect(shared).toContain(screen[0])
    expect(shared).toContain(screen[1])
    expect(shared).toBe(
      '🎲 Коли поїхати до бабусі?\nЗараз\n\nКолесо · Fair Spin — example.test/fair-spin'
    )
    expect(shared.toLocaleLowerCase('uk')).not.toContain('результат')
  })
})

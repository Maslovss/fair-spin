import { describe, expect, it, vi } from 'vitest'
import { answerPairLines } from '../core/answer-presentation'
import {
  formatSharedOrder,
  formatSingleAnswer,
  fullOrderText,
  shareText
} from './share'

const labels = { order: 'Порядок', all: 'усі', of: 'з', andMore: 'і ще' }

describe('sharing messages', () => {
  it('uses the system sheet or falls back to the clipboard', async () => {
    const share = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    expect(await shareText('hello', { share, clipboard: { writeText } })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'hello' })
    expect(writeText).not.toHaveBeenCalled()

    expect(await shareText('hello', { clipboard: { writeText } })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('shares exactly the question-answer pair shown on screen and names the table', () => {
    const pair = { question: 'Коли поїхати?', answer: 'Згодом' }
    const screen = answerPairLines(pair)
    const text = formatSingleAnswer(pair, 'Колесо', 'https://example.test/fair-spin/')
    expect(text).toContain(screen[0])
    expect(text).toContain(screen[1])
    expect(text).toContain('Колесо')
    expect(text).not.toContain('Відповідь:')
  })

  it('formats complete and in-progress orders without a table name', () => {
    const complete = formatSharedOrder(
      'Хто перший?',
      ['A', 'B', 'C'],
      3,
      true,
      labels,
      'https://example.test/'
    )
    const progress = formatSharedOrder(
      'Хто перший?',
      ['A', 'B', 'C'],
      12,
      false,
      labels,
      'https://example.test/'
    )
    expect(complete).toContain('Порядок (усі 3):')
    expect(progress).toContain('Порядок (3 з 12):')
    expect(complete).not.toMatch(/Колесо|Карти|Стрічка/u)
  })

  it('truncates long shared orders honestly while full copying stays intact', () => {
    const items = Array.from({ length: 60 }, (_, index) => `${index + 1}-${'x'.repeat(30)}`)
    const shared = formatSharedOrder(
      'Порядок?',
      items,
      81,
      false,
      labels,
      'https://example.test/',
      500
    )
    expect(shared.length).toBeLessThanOrEqual(500)
    expect(shared).toMatch(/…і ще \d+/u)
    expect(fullOrderText(items).split('\n')).toHaveLength(60)
  })

  it('uses neutral vocabulary', () => {
    const texts = [
      formatSingleAnswer(
        { question: 'Хто?', answer: 'Я' },
        'Колесо',
        'https://example.test/'
      ),
      formatSharedOrder('Хто?', ['Я'], 2, false, labels, 'https://example.test/')
    ].join('\n').toLocaleLowerCase('uk')
    for (const forbidden of [
      'результат',
      'вибули',
      'переможець',
      'пощастило',
      'на жаль',
      'пресет',
      'цвинтар'
    ]) expect(texts).not.toContain(forbidden)
  })
})

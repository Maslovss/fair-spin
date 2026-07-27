import { describe, expect, it } from 'vitest'
import {
  isPlaceholderCompletion,
  isQuestionTemplate,
  poseQuestion
} from './question'

describe('question templates', () => {
  it('recognizes the ellipsis character and three consecutive dots', () => {
    expect(isQuestionTemplate('Коли…?')).toBe(true)
    expect(isQuestionTemplate('Коли...?')).toBe(true)
    expect(isQuestionTemplate('Що подивитись?')).toBe(false)
  })

  it('replaces only the first ellipsis', () => {
    expect(poseQuestion('Що подарувати… якщо… ?', 'мамі')).toBe(
      'Що подарувати мамі якщо… ?'
    )
    expect(poseQuestion('What to give... if... ?', 'Alex')).toBe(
      'What to give Alex if... ?'
    )
  })

  it('recognizes either frozen placeholder language', () => {
    expect(isPlaceholderCompletion('‹що я загадав›')).toBe(true)
    expect(isPlaceholderCompletion('‹what I have in mind›')).toBe(true)
    expect(isPlaceholderCompletion('dishes')).toBe(false)
    expect(isPlaceholderCompletion(undefined)).toBe(false)
  })
})

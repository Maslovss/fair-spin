import { describe, expect, it } from 'vitest'
import {
  isPlaceholderCompletion,
  isQuestionTemplate,
  insertTemplateSlot,
  questionTemplateParts,
  poseQuestion,
  templatePreview
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

  it('builds editor previews with both ellipsis forms and only the first slot', () => {
    expect(templatePreview('Коли…?', '‹задумане›')).toBe('Коли ‹задумане›?')
    expect(templatePreview('Коли... якщо…?', '‹задумане›')).toBe(
      'Коли ‹задумане› якщо…?'
    )
    expect(templatePreview('', '‹задумане›')).toBeNull()
  })

  it('inserts a template slot at the cursor, before a final question mark, or at the end', () => {
    expect(insertTemplateSlot('Що подарувати мамі?', 13)).toEqual({
      name: 'Що подарувати… мамі?',
      cursor: 14
    })
    expect(insertTemplateSlot('Хто миє посуд?', null)).toEqual({
      name: 'Хто миє посуд…?',
      cursor: 14
    })
    expect(insertTemplateSlot('Вечеря', null)).toEqual({
      name: 'Вечеря…',
      cursor: 7
    })
    expect(insertTemplateSlot('Коли…?', null).name).toBe('Коли…?')
  })

  it('splits the slot while preserving text and empty edge parts', () => {
    expect(questionTemplateParts('Що подарувати… на день народження?')).toEqual({
      before: 'Що подарувати',
      after: ' на день народження?'
    })
    expect(questionTemplateParts('… після')).toEqual({ before: '', after: ' після' })
    expect(questionTemplateParts('До…')).toEqual({ before: 'До', after: '' })
  })

  it('recognizes either frozen placeholder language', () => {
    expect(isPlaceholderCompletion('‹задумане›')).toBe(true)
    expect(isPlaceholderCompletion('‹що я загадав›')).toBe(true)
    expect(isPlaceholderCompletion('‹what I have in mind›')).toBe(true)
    expect(isPlaceholderCompletion('dishes')).toBe(false)
    expect(isPlaceholderCompletion(undefined)).toBe(false)
  })
})

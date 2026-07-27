import { describe, expect, it } from 'vitest'
import { detectLanguage, relativeTime, translator } from './i18n'

describe('localization', () => {
  it('detects Ukrainian and otherwise falls back to English', () => {
    expect(detectLanguage(['uk-UA', 'en'])).toBe('uk')
    expect(detectLanguage(['de-DE', 'fr'])).toBe('en')
  })

  it('translates and interpolates interface strings', () => {
    expect(translator('en')('questions.count', { count: 4 })).toBe('4 items')
    expect(translator('uk')('questions.count', { count: 4 })).toBe('4 елементів')
    expect(translator('en')('editor.templatePreview', { preview: 'When ‹x›?' }))
      .toContain('When ‹x›?')
    expect(translator('uk')('editor.templatePreview', { preview: 'Коли ‹x›?' }))
      .toContain('Коли ‹x›?')
    expect(translator('en')('question.placeholder')).toBe('‹what I have in mind›')
    expect(translator('uk')('question.placeholder')).toBe('‹задумане›')
  })

  it('formats recent activity without hard-coded date text', () => {
    expect(relativeTime(1_000, 'en', 1_000)).toBe('just now')
    expect(relativeTime(1_000, 'uk', 1_000)).toBe('щойно')
  })
})

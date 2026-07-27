import { describe, expect, it } from 'vitest'
import { createPreset } from '../state/presets'
import {
  QuestionShareError,
  clearQuestionHashUrl,
  compareImportedQuestion,
  decodeQuestionHash,
  encodeQuestionHash,
  prepareQuestionShare,
  validateImportedQuestion
} from './question-share'

const question = {
  name: 'Хто…? 🎲',
  items: ['Мама 👩', 'Тато 👨', 'Я']
}

describe('question sharing links', () => {
  it('round-trips Cyrillic and emoji through compressed and raw versions', async () => {
    const compressed = await encodeQuestionHash(question)
    const raw = await encodeQuestionHash(question, 'raw')
    expect(await decodeQuestionHash(compressed)).toEqual(question)
    expect(await decodeQuestionHash(raw)).toEqual(question)
    expect(raw).toMatch(/^#q=0\./u)
    expect(compressed).toMatch(/^#q=[01]\./u)
  })

  it('rejects an unknown version before decoding its payload', async () => {
    await expect(decodeQuestionHash('#q=9.not-even-base64!'))
      .rejects.toMatchObject({ code: 'new-version' })
  })

  it('creates a state-free link and falls back to text after the length limit', async () => {
    const preset = createPreset(question, 1, 'private-id')
    const link = await prepareQuestionShare(preset, 'https://example.test/fair-spin/#old')
    expect(link.kind).toBe('link')
    expect(link.text).not.toContain('private-id')
    expect(await decodeQuestionHash(new URL(link.text).hash)).toEqual(question)

    const long = await prepareQuestionShare(
      { name: 'Long', items: Array.from({ length: 1000 }, (_, index) =>
        `${index}-${'x'.repeat(35)}`) },
      'https://example.test/fair-spin/'
    )
    expect(long.kind).toBe('text')
    expect(long.text.split('\n')).toHaveLength(1000)
  })

  it('validates limits, control characters, and malformed data', () => {
    expect(validateImportedQuestion({ n: ' When…? ', i: [' Now ', ' Later '] }))
      .toEqual({ name: 'When…?', items: ['Now', 'Later'] })
    expect(() => validateImportedQuestion({ n: 'Bad\u0000', i: ['A', 'B'] }))
      .toThrow(QuestionShareError)
    expect(() => validateImportedQuestion({ n: 'Too few', i: ['A'] }))
      .toThrow(QuestionShareError)
    expect(() => validateImportedQuestion({
      n: 'Too many',
      i: Array.from({ length: 1001 }, () => 'A')
    })).toThrow(QuestionShareError)
    expect(() => validateImportedQuestion({ n: 'Long', i: ['x'.repeat(41), 'B'] }))
      .toThrow(QuestionShareError)
  })

  it('keeps templates and excludes round state from imported data', async () => {
    const hash = await encodeQuestionHash(question, 'raw')
    const imported = await decodeQuestionHash(hash)
    expect(imported.name).toContain('…')
    expect(imported).toEqual(question)
    expect(imported).not.toHaveProperty('question')
    expect(imported).not.toHaveProperty('drawn')
    expect(imported).not.toHaveProperty('lastTable')
  })

  it('detects new, identical, and conflicting names with weighted duplicates', () => {
    const existing = [
      createPreset({ name: 'Question', items: ['A', 'A', 'B'] }, 1, 'one')
    ]
    expect(compareImportedQuestion(existing, { name: 'New', items: ['A', 'B'] }))
      .toEqual({ kind: 'new' })
    expect(compareImportedQuestion(existing, {
      name: ' Question ',
      items: ['B', 'A', 'A']
    }).kind).toBe('identical')
    expect(compareImportedQuestion(existing, {
      name: 'Question',
      items: ['A', 'B', 'C']
    })).toMatchObject({
      kind: 'conflict',
      difference: { added: ['C'], removed: ['A'] }
    })
  })

  it('clears only the hash after an import decision', () => {
    expect(clearQuestionHashUrl({ pathname: '/fair-spin/', search: '?x=1' } as Location))
      .toBe('/fair-spin/?x=1')
  })
})

import { describe, expect, it } from 'vitest'
import { CurrentTableResult } from './result-label'

describe('current table result label', () => {
  it('keeps the completed result while the player remains on the same table', () => {
    const result = new CurrentTableResult()
    result.record('preset', 'wheel', 'A')
    result.enter('preset', 'wheel')
    expect(result.read('preset', 'wheel')).toBe('A')
  })

  it('clears when the player switches tables and does not restore the old result', () => {
    const result = new CurrentTableResult()
    result.record('preset', 'wheel', 'A')
    result.enter('preset', 'slot')
    expect(result.read('preset', 'slot')).toBeNull()
    result.enter('preset', 'wheel')
    expect(result.read('preset', 'wheel')).toBeNull()
  })

  it.each([
    'opening a preset',
    'resetting the round',
    'posing a new question',
    'changing game mode',
    'collecting the cards deck'
  ])('clears after %s', () => {
    const result = new CurrentTableResult()
    result.record('preset', 'cards', 'A')
    result.clear()
    expect(result.read('preset', 'cards')).toBeNull()
  })

  it('is transient and is not restored in a new application session', () => {
    const previousSession = new CurrentTableResult()
    previousSession.record('preset', 'wheel', 'A')
    const nextSession = new CurrentTableResult()
    expect(nextSession.read('preset', 'wheel')).toBeNull()
  })

  it('shows the final act item on the current table', () => {
    const result = new CurrentTableResult()
    result.record('preset', 'strip', 'Last')
    expect(result.read('preset', 'strip')).toBe('Last')
  })
})

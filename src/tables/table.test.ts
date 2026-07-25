import { describe, expect, it } from 'vitest'
import { isTableAvailable } from './table'

describe('table availability', () => {
  it('reveals tables as an elimination round becomes small enough', () => {
    expect(isTableAvailable('wheel', 40)).toBe(false)
    expect(isTableAvailable('wheel', 31)).toBe(false)
    expect(isTableAvailable('wheel', 30)).toBe(true)
    expect(isTableAvailable('cards', 17)).toBe(false)
    expect(isTableAvailable('cards', 16)).toBe(true)
    expect(isTableAvailable('reel', 500)).toBe(true)
  })
})

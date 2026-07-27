import { describe, expect, it } from 'vitest'
import { availableTableIds, isTableAvailable, resolveTableId } from './table'

describe('table availability', () => {
  it('reveals tables as an elimination round becomes small enough', () => {
    expect(isTableAvailable('wheel', 40)).toBe(false)
    expect(isTableAvailable('wheel', 31)).toBe(false)
    expect(isTableAvailable('wheel', 30)).toBe(true)
    expect(isTableAvailable('cards', 17)).toBe(false)
    expect(isTableAvailable('cards', 16)).toBe(true)
    expect(isTableAvailable('slot', 500)).toBe(true)
    expect(isTableAvailable('strip', 500)).toBe(true)
    expect(availableTableIds(40)).toEqual(['slot', 'strip'])
  })

  it('falls back to slot when a remembered table becomes unavailable', () => {
    expect(resolveTableId('wheel', 40)).toBe('slot')
    expect(resolveTableId('strip', 40)).toBe('strip')
    expect(resolveTableId('wheel', 30)).toBe('wheel')
  })
})

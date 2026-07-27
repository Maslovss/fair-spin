import { describe, expect, it } from 'vitest'
import { TABLE_REGISTRY, availableTableRegistrations, createRegisteredTable } from './registry'

describe('table registry', () => {
  it('registers every table through the Table contract', () => {
    expect(TABLE_REGISTRY.map(({ id }) => id)).toEqual(['wheel', 'slot', 'strip', 'cards'])
    expect(createRegisteredTable('slot').id).toBe('slot')
    expect(createRegisteredTable('strip').id).toBe('strip')
    expect(createRegisteredTable('cards').id).toBe('cards')
  })

  it('keeps reel tables available for long lists', () => {
    expect(availableTableRegistrations(40).map(({ id }) => id)).toEqual(['slot', 'strip'])
    expect(availableTableRegistrations(16).map(({ id }) => id)).toEqual([
      'wheel',
      'slot',
      'strip',
      'cards'
    ])
    expect(availableTableRegistrations(17).map(({ id }) => id)).toEqual([
      'wheel',
      'slot',
      'strip'
    ])
  })
})

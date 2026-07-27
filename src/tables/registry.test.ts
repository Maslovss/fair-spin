import { describe, expect, it } from 'vitest'
import { TABLE_REGISTRY, availableTableRegistrations, createRegisteredTable } from './registry'

describe('table registry', () => {
  it('registers wheel, slot, and strip through the Table contract', () => {
    expect(TABLE_REGISTRY.map(({ id }) => id)).toEqual(['wheel', 'slot', 'strip'])
    expect(createRegisteredTable('slot').id).toBe('slot')
    expect(createRegisteredTable('strip').id).toBe('strip')
  })

  it('keeps reel tables available for long lists', () => {
    expect(availableTableRegistrations(40).map(({ id }) => id)).toEqual(['slot', 'strip'])
    expect(availableTableRegistrations(30).map(({ id }) => id)).toEqual(['wheel', 'slot', 'strip'])
  })
})

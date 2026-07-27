import { describe, expect, it } from 'vitest'
import { cleanStored } from './migrate'
import {
  MAX_ITEM_LENGTH,
  PresetValidationError,
  createPreset,
  createPresetStateForPreset,
  createStarterPresets,
  parseBulkItems,
  removePreset,
  seedStarterPresets,
  setLastTable,
  updatePreset
} from './presets'

describe('presets', () => {
  it('validates at least two items and preserves duplicates', () => {
    expect(() => createPreset({ name: 'One', items: ['only'] }))
      .toThrow(PresetValidationError)
    const preset = createPreset({
      name: 'Weighted',
      items: ['Pizza', 'Pizza', 'Soup']
    })
    expect(preset.items).toEqual(['Pizza', 'Pizza', 'Soup'])
  })

  it('parses bulk input, trims empty lines, and truncates by unicode code point', () => {
    const tooLong = '🎲'.repeat(MAX_ITEM_LENGTH + 3)
    const parsed = parseBulkItems(` Pizza \n\nPizza\r\n${tooLong}`)
    expect(parsed.slice(0, 2)).toEqual(['Pizza', 'Pizza'])
    expect([...parsed[2]!]).toHaveLength(MAX_ITEM_LENGTH)
  })

  it('supports update, stateful table choice, and cascading deletion', () => {
    const preset = createPreset({ name: 'A', items: ['1', '2'] }, 1, 'a')
    let stored = { ...cleanStored(), presets: [preset] }
    stored = setLastTable(stored, preset.id, 'cards', 2)
    expect(stored.states[preset.id]?.lastTable).toBe('cards')
    const updated = updatePreset(preset, { name: 'B', items: ['1', '2', '3'] }, 3)
    expect(updated).toMatchObject({ name: 'B', updatedAt: 3 })
    stored = removePreset(stored, preset.id)
    expect(stored.presets).toHaveLength(0)
    expect(stored.states[preset.id]).toBeUndefined()
  })

  it('seeds exactly seven ordinary presets only into a truly empty store', () => {
    const seeded = seedStarterPresets(cleanStored(), 10)
    expect(seeded.presets).toHaveLength(7)
    expect(Object.keys(seeded.states)).toHaveLength(0)
    const first = seeded.presets.find((preset) => preset.id === 'starter-first')
    const die = seeded.presets.find((preset) => preset.id === 'starter-die')
    expect(first && createPresetStateForPreset(first, 11).elimination).toBe(true)
    expect(die && createPresetStateForPreset(die, 11).elimination).toBe(false)
    const afterDeletion = { ...seeded, presets: seeded.presets.slice(1) }
    expect(seedStarterPresets(afterDeletion, 20)).toBe(afterDeletion)
    expect(createStarterPresets()).toHaveLength(7)
  })
})

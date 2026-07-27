import { describe, expect, it } from 'vitest'
import { isQuestionTemplate } from '../core/question'
import { cleanStored } from './migrate'
import {
  MAX_ITEM_LENGTH,
  PresetValidationError,
  addStarterPresets,
  assertUniquePresetName,
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
    stored = setLastTable(stored, preset.id, 'strip', 2.5)
    expect(stored.states[preset.id]?.lastTable).toBe('strip')
    const updated = updatePreset(preset, { name: 'B', items: ['1', '2', '3'] }, 3)
    expect(updated).toMatchObject({ name: 'B', updatedAt: 3 })
    stored = removePreset(stored, preset.id)
    expect(stored.presets).toHaveLength(0)
    expect(stored.states[preset.id]).toBeUndefined()
  })

  it('seeds eleven questions, ten templates, and elimination only for Who', () => {
    const seeded = seedStarterPresets(cleanStored('en'), 10)
    expect(seeded.presets).toHaveLength(11)
    expect(seeded.presets.filter(({ name }) => isQuestionTemplate(name))).toHaveLength(10)
    expect(Object.keys(seeded.states)).toHaveLength(0)
    const who = seeded.presets.find((preset) => preset.id === 'starter-en-who')
    const watch = seeded.presets.find((preset) => preset.id === 'starter-en-watch')
    expect(who && createPresetStateForPreset(who, 11).elimination).toBe(true)
    expect(watch && createPresetStateForPreset(watch, 11).elimination).toBe(false)
    const afterDeletion = { ...seeded, presets: seeded.presets.slice(1) }
    expect(seedStarterPresets(afterDeletion, 20)).toBe(afterDeletion)
    expect(createStarterPresets('uk')).toHaveLength(11)
  })

  it('adds missing starter questions without touching existing rounds', () => {
    const seeded = seedStarterPresets(cleanStored('uk'), 10)
    const kept = seeded.presets.slice(1)
    const state = createPresetStateForPreset(kept[0]!, 11)
    const partial = { ...seeded, presets: kept, states: { [kept[0]!.id]: state } }
    const restored = addStarterPresets(partial, 'uk', 20)
    expect(restored.added).toBe(1)
    expect(restored.stored.presets).toHaveLength(11)
    expect(restored.stored.states).toEqual(partial.states)
    expect(addStarterPresets(restored.stored, 'uk', 30).added).toBe(0)
    expect(addStarterPresets(restored.stored, 'en', 40).added).toBe(11)
  })

  it('restores a renamed starter with a collision-free id and its intended mode', () => {
    const seeded = seedStarterPresets(cleanStored('en'), 10)
    const who = seeded.presets.find(({ id }) => id === 'starter-en-who')!
    const renamed = { ...who, name: 'Family chooser' }
    const changed = {
      ...seeded,
      presets: seeded.presets.map((preset) => preset.id === who.id ? renamed : preset)
    }
    const restored = addStarterPresets(changed, 'en', 20)
    const restoredWho = restored.stored.presets.find(({ name }) => name === 'Who…?')!

    expect(restoredWho.id).toBe('starter-en-who-2')
    expect(new Set(restored.stored.presets.map(({ id }) => id)).size)
      .toBe(restored.stored.presets.length)
    expect(createPresetStateForPreset(restoredWho, 21).elimination).toBe(true)
  })

  it.each(['create', 'rename', 'save-copy', 'import'])(
    'rejects duplicate trimmed names for the %s path',
    () => {
      const existing = [createPreset({ name: 'Question', items: ['A', 'B'] }, 1, 'one')]
      expect(() => assertUniquePresetName(existing, '  Question  ')).toThrow(
        PresetValidationError
      )
      expect(() => assertUniquePresetName(existing, 'Question', 'one')).not.toThrow()
    }
  )

  it('creates independent item arrays for saved template copies', () => {
    const template = createPreset({ name: 'Who…?', items: ['A', 'B'] }, 1, 'template')
    const copy = createPreset({ name: 'Who cooks?', items: [...template.items] }, 2, 'copy')
    template.items.push('C')
    expect(copy.items).toEqual(['A', 'B'])
  })
})

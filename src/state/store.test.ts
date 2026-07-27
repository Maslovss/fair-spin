import { describe, expect, it, vi } from 'vitest'
import { cleanStored, migrate } from './migrate'
import { PersistedStore, STORAGE_KEY, WRITE_THROTTLE_MS, type StorageLike, type TimerLike } from './store'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  readonly setItem = vi.fn((key: string, value: string) => this.values.set(key, value))

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
}

describe('storage migration', () => {
  it('returns clean state for unknown, malformed, or damaged data', () => {
    expect(migrate('{bad json', 'uk')).toEqual(cleanStored('uk'))
    expect(migrate({ version: 9 }, 'en')).toEqual(cleanStored('en'))
    expect(migrate({ version: 1, presets: 'wrong' }, 'en')).toEqual(cleanStored('en'))
  })

  it('restores current valid data', () => {
    const stored = cleanStored('uk')
    expect(migrate(JSON.stringify(stored))).toEqual(stored)
  })

  it('moves elimination from v1 presets into existing round state without data loss', () => {
    const legacy = {
      version: 1,
      presets: [{
        id: 'players',
        name: 'Players',
        items: ['A', 'B', 'C'],
        elimination: true,
        createdAt: 1,
        updatedAt: 2
      }],
      states: {
        players: {
          lastTable: 'wheel',
          drawn: ['B'],
          tables: { wheel: { order: ['A', 'B', 'C'], angle: 1.75 } },
          updatedAt: 3
        }
      },
      settings: { sound: true, haptics: false, lang: 'uk' }
    }
    const migrated = migrate(legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.presets[0]).not.toHaveProperty('elimination')
    expect(migrated.states.players).toMatchObject({
      elimination: true,
      drawn: ['B'],
      tables: { wheel: { order: ['A', 'B', 'C'], angle: 1.75 } }
    })
  })

  it('creates v2 state for a legacy preset that had no state yet', () => {
    const migrated = migrate({
      version: 1,
      presets: [{
        id: 'fresh',
        name: 'Fresh',
        items: ['A', 'B'],
        elimination: false,
        createdAt: 1,
        updatedAt: 4
      }],
      states: {},
      settings: { sound: true, haptics: true, lang: 'en' }
    })
    expect(migrated.states.fresh).toMatchObject({ elimination: false, drawn: [], updatedAt: 4 })
  })

  it('does not migrate version 2 a second time', () => {
    const current = {
      ...cleanStored('uk'),
      presets: [{ id: 'p', name: 'P', items: ['A', 'B'], createdAt: 1, updatedAt: 2 }],
      states: {
        p: {
          elimination: true,
          lastTable: 'wheel' as const,
          drawn: ['A'],
          tables: {},
          updatedAt: 3
        }
      }
    }
    expect(migrate(current)).toEqual(current)
  })

  it('maps the unused legacy reel table id to slot', () => {
    const current = {
      ...cleanStored('en'),
      presets: [{ id: 'p', name: 'P', items: ['A', 'B'], createdAt: 1, updatedAt: 2 }],
      states: {
        p: {
          elimination: false,
          lastTable: 'reel',
          drawn: [],
          tables: { reel: { order: ['A', 'B'], offset: 4.5 } },
          updatedAt: 3
        }
      }
    }
    expect(migrate(current).states.p).toMatchObject({
      lastTable: 'slot',
      tables: { reel: { offset: 4.5 } }
    })
  })

  it('fills new cards fields when restoring an older v2 cards layout', () => {
    const current = {
      ...cleanStored('en'),
      presets: [{ id: 'p', name: 'P', items: ['A', 'B'], createdAt: 1, updatedAt: 2 }],
      states: {
        p: {
          elimination: true,
          lastTable: 'cards',
          drawn: [],
          tables: {
            cards: { order: ['B', 'A'], dealt: true, cut: true }
          },
          updatedAt: 3
        }
      }
    }
    expect(migrate(current).states.p?.tables.cards).toEqual({
      order: ['B', 'A'],
      cutOffset: 0,
      dealt: true,
      cut: true,
      positions: [0, 1]
    })
  })
})

describe('PersistedStore', () => {
  it('loads, throttles writes, and restores all data', () => {
    vi.useFakeTimers()
    const timer: TimerLike = {
      set: (callback, delay) => setTimeout(callback, delay),
      clear: (id) => clearTimeout(id)
    }
    const storage = new MemoryStorage()
    const store = new PersistedStore(storage, 'en', timer)
    const first = { ...store.get(), settings: { ...store.get().settings, sound: false } }
    store.replace(first)
    store.replace({ ...first, settings: { ...first.settings, haptics: false } })

    expect(storage.setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(WRITE_THROTTLE_MS - 1)
    expect(storage.setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(storage.setItem).toHaveBeenCalledTimes(1)

    const restored = new PersistedStore(storage, 'uk', timer)
    expect(restored.get().settings).toMatchObject({ sound: false, haptics: false, lang: 'en' })
    expect(storage.values.has(STORAGE_KEY)).toBe(true)
    vi.useRealTimers()
  })
})

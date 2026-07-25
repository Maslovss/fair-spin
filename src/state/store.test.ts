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

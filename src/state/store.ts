import { migrate } from './migrate'
import type { Language, Stored } from './types'

export const STORAGE_KEY = 'fair-spin'
export const WRITE_THROTTLE_MS = 300

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface TimerLike {
  set(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  clear(id: ReturnType<typeof setTimeout>): void
}

const browserTimer: TimerLike = {
  set: (callback, delay) => setTimeout(callback, delay),
  clear: (id) => clearTimeout(id)
}

export class PersistedStore {
  private value: Stored
  private pending: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(value: Stored) => void>()

  constructor(
    private readonly storage: StorageLike,
    fallbackLang: Language,
    private readonly timer: TimerLike = browserTimer,
    private readonly throttleMs = WRITE_THROTTLE_MS
  ) {
    this.value = migrate(storage.getItem(STORAGE_KEY), fallbackLang)
  }

  get(): Stored {
    return this.value
  }

  replace(value: Stored, notify = true): void {
    this.value = value
    this.scheduleWrite()
    if (notify) this.listeners.forEach((listener) => listener(value))
  }

  update(recipe: (value: Stored) => Stored, notify = true): void {
    this.replace(recipe(this.value), notify)
  }

  subscribe(listener: (value: Stored) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  flush(): void {
    if (this.pending !== null) {
      this.timer.clear(this.pending)
      this.pending = null
    }
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.value))
  }

  destroy(): void {
    this.flush()
    this.listeners.clear()
  }

  private scheduleWrite(): void {
    if (this.pending !== null) return
    this.pending = this.timer.set(() => {
      this.pending = null
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.value))
    }, this.throttleMs)
  }
}

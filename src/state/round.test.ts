import { describe, expect, it } from 'vitest'
import type { CryptoSource } from '../core/random'
import { createPreset } from './presets'
import {
  applyResult,
  canResetRound,
  ensureCardsLayout,
  ensureLayout,
  ensureReelLayout,
  ensureWheelLayout,
  getLiveOrder,
  getRemainingItems,
  performFinalAct,
  setEliminationMode,
  startNewRound,
  syncEditedPreset
} from './round'
import { createPresetState } from './types'

class IncrementingCrypto implements CryptoSource {
  private value = 0
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    if (!(array instanceof Uint32Array)) throw new TypeError('Uint32Array required')
    array[0] = this.value++
    return array
  }
}

const source = () => new IncrementingCrypto()
const preset = createPreset(
  { name: 'Players', items: ['A', 'B', 'C', 'D'] },
  1,
  'players'
)

describe('round transitions', () => {
  it('creates each table layout lazily and independently', () => {
    const initial = createPresetState(1)
    const wheel = ensureWheelLayout(preset, initial, source())
    expect(wheel.state.tables.wheel).toBeDefined()
    expect(wheel.state.tables.reel).toBeUndefined()

    const reel = ensureReelLayout(preset, wheel.state, source())
    const cards = ensureCardsLayout(preset, reel.state, source())
    expect(cards.state.tables.wheel?.order).toEqual(wheel.layout.order)
    expect(cards.state.tables.reel).toBeDefined()
    expect(cards.state.tables.cards).toBeDefined()
  })

  it('shares one reel record between slot and strip', () => {
    const initial = createPresetState(1)
    const slot = ensureLayout('slot', preset, initial, source())
    const withPosition = {
      ...slot,
      tables: {
        ...slot.tables,
        reel: { ...slot.tables.reel!, offset: 12.5 }
      }
    }
    const reel = withPosition.tables.reel
    expect(reel).toBeDefined()
    const strip = ensureLayout('strip', preset, withPosition, source())
    expect(strip.tables.reel?.order).toEqual(reel?.order)
    expect(strip.tables.reel?.offset).toBe(12.5)
    expect(Object.keys(strip.tables)).toEqual(['reel'])
  })

  it('eliminates one occurrence and leaves non-elimination rounds untouched', () => {
    const layout = ['A', 'B', 'C', 'D']
    const state = applyResult(preset, createPresetState(1, true), layout, 1, 20)
    expect(state.drawn).toEqual(['B'])
    expect(getRemainingItems(preset, state)).toEqual(['A', 'C', 'D'])
    expect(getLiveOrder(layout, state.drawn)).toEqual(['A', 'C', 'D'])

    const repeatState = setEliminationMode(state, false, 21)
    expect(applyResult(preset, repeatState, layout, 0)).toBe(repeatState)
  })

  it('requires a player tap for the final item', () => {
    const state = { ...createPresetState(1, true), drawn: ['A', 'B', 'C'] }
    const final = performFinalAct(preset, state, 30)
    expect(final.drawn).toEqual(['A', 'B', 'C', 'D'])
    expect(() => performFinalAct(preset, final)).toThrow()
  })

  it('silently reconciles additions and removals during a round', () => {
    const existing = {
      ...createPresetState(1, true),
      drawn: ['B'],
      tables: { wheel: { order: ['A', 'B', 'C', 'D'], angle: 1.25 } }
    }
    const edited = { ...preset, items: ['A', 'C', 'D', 'E'] }
    const synced = syncEditedPreset(preset, edited, existing, source(), 40)
    expect(synced.drawn).toEqual([])
    expect(synced.tables.wheel?.order.toSorted()).toEqual(['A', 'C', 'D', 'E'])
    expect(synced.tables.wheel?.angle).toBe(1.25)
  })

  it('reshuffles layouts for a new round while preserving wheel angle', () => {
    const state = {
      ...createPresetState(1, true),
      drawn: ['A'],
      tables: {
        wheel: { order: ['A', 'B', 'C', 'D'], angle: 2.75 },
        cards: { order: ['A', 'B', 'C', 'D'], dealt: true, cut: true }
      }
    }
    const reset = startNewRound(preset, source(), state, 50)
    expect(canResetRound(state)).toBe(true)
    expect(canResetRound(reset)).toBe(false)
    expect(reset.drawn).toEqual([])
    expect(reset.tables.wheel?.angle).toBe(2.75)
    expect(reset.tables.cards).toMatchObject({ dealt: false, cut: false })
  })

  it('switches game mode without losing the cemetery or its order', () => {
    const eliminating = {
      ...createPresetState(1, true),
      drawn: ['B', 'A'],
      tables: { wheel: { order: ['A', 'B', 'C', 'D'], angle: 0.75 } }
    }
    const repeating = setEliminationMode(eliminating, false, 2)
    expect(repeating.drawn).toEqual(['B', 'A'])
    expect(getRemainingItems(preset, repeating)).toEqual(['A', 'B', 'C', 'D'])
    expect(repeating.tables).toEqual(eliminating.tables)

    const restored = setEliminationMode(repeating, true, 3)
    expect(restored.drawn).toEqual(['B', 'A'])
    expect(getRemainingItems(preset, restored)).toEqual(['C', 'D'])
    expect(restored.tables.wheel?.order).toEqual(['A', 'B', 'C', 'D'])
  })
})

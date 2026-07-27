import { describe, expect, it } from 'vitest'
import { visibleCardPositions } from '../core/cards'
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
  setEliminationModeForPreset,
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

  it('keeps dealt card slots fixed and appends a card for a new item', () => {
    const cards = {
      order: ['C', 'A', 'D', 'B'],
      cutOffset: 0,
      cut: true,
      dealt: true,
      positions: [0, 1, 2, 3]
    }
    const state = {
      ...createPresetState(1, true),
      tables: { cards }
    }
    const edited = { ...preset, items: [...preset.items, 'E'] }
    const synced = syncEditedPreset(preset, edited, state, source(), 41)
    const next = synced.tables.cards

    expect(next?.order.slice(0, 4)).toEqual(cards.order)
    expect(next?.positions.slice(0, 4)).toEqual(cards.positions)
    expect(next?.order[4]).toBe('E')
    expect(next?.positions[4]).toBe(4)
    expect(next?.columns).toBe(2)
  })

  it('shows a card gap after the item was eliminated on the wheel', () => {
    const cards = {
      order: ['A', 'B', 'C', 'D'],
      cutOffset: 0,
      cut: true,
      dealt: true,
      positions: [0, 1, 2, 3]
    }
    const initial = {
      ...createPresetState(1, true),
      tables: {
        wheel: { order: ['A', 'B', 'C', 'D'], angle: 0 },
        cards
      }
    }
    const afterWheel = applyResult(preset, initial, initial.tables.wheel.order, 1, 42)
    const returned = ensureCardsLayout(preset, afterWheel, source())
    const visible = visibleCardPositions(returned.layout, preset.items, afterWheel.drawn)

    expect(afterWheel.drawn).toEqual(['B'])
    expect(visible).toEqual([0, -1, 2, 3])
    expect(returned.layout.positions).toEqual(cards.positions)
  })

  it('matches the remaining count after alternating between tables', () => {
    const cards = {
      order: ['D', 'B', 'A', 'C'],
      cutOffset: 0,
      cut: true,
      dealt: true,
      positions: [0, 1, 2, 3]
    }
    const initial = {
      ...createPresetState(1, true),
      tables: { cards }
    }
    const afterWheel = applyResult(preset, initial, ['A', 'B', 'C', 'D'], 1, 43)
    const reelOrder = getLiveOrder(['D', 'C', 'B', 'A'], afterWheel.drawn)
    const afterReel = applyResult(preset, afterWheel, reelOrder, 0, 44)
    const visible = visibleCardPositions(cards, preset.items, afterReel.drawn)

    expect(afterReel.drawn).toEqual(['B', 'D'])
    expect(visible.filter((position) => position >= 0)).toHaveLength(
      getRemainingItems(preset, afterReel).length
    )
  })

  it('reshuffles layouts for a new round while preserving wheel angle', () => {
    const state = {
      ...createPresetState(1, true),
      drawn: ['A'],
      tables: {
        wheel: { order: ['A', 'B', 'C', 'D'], angle: 2.75 },
        cards: {
          order: ['A', 'B', 'C', 'D'],
          cutOffset: 0,
          dealt: true,
          cut: true,
          positions: [0, 1, 2, 3]
        }
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

  it('returns cards to a newly shuffled undealt deck when mode changes', () => {
    const cards = {
      order: ['A', 'B', 'C', 'D'],
      cutOffset: 0,
      cut: true,
      dealt: true,
      positions: [0, -1, 2, 3]
    }
    const state = {
      ...createPresetState(1, true),
      drawn: ['B'],
      tables: { cards }
    }
    const next = setEliminationModeForPreset(preset, state, false, source(), 9)
    expect(next.elimination).toBe(false)
    expect(next.drawn).toEqual(['B'])
    expect(next.tables.cards).toMatchObject({
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    })
    expect(next.tables.cards?.order.toSorted()).toEqual(preset.items.toSorted())
  })
})

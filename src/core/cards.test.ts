import { describe, expect, it } from 'vitest'
import type { CryptoSource } from './random'
import {
  automaticCardsDeal,
  availableCardResults,
  cardResultAt,
  cardsLayoutAfterResult,
  createCardsLayout,
  cutCards,
  dealCards,
  randomAvailableCard,
  removeDealtCard,
  rotateCards,
  visibleCardPositions
} from './cards'

class SequenceCrypto implements CryptoSource {
  private index = 0
  constructor(private readonly values: number[]) {}
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    if (!(array instanceof Uint32Array)) throw new TypeError('Uint32Array required')
    array[0] = this.values[this.index++ % this.values.length] ?? 0
    return array
  }
}

const source = (...values: number[]) => new SequenceCrypto(values)

describe('cards deck model', () => {
  it('rotates cuts across both boundaries and accumulates repeated cuts', () => {
    expect(rotateCards(['A', 'B', 'C', 'D'], 1)).toEqual(['B', 'C', 'D', 'A'])
    expect(rotateCards(['A', 'B', 'C', 'D'], 5)).toEqual(['B', 'C', 'D', 'A'])
    expect(rotateCards(['A', 'B', 'C', 'D'], -1)).toEqual(['D', 'A', 'B', 'C'])

    const initial = {
      order: ['A', 'B', 'C', 'D'],
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    }
    const repeated = cutCards(cutCards(initial, 3), 2)
    expect(repeated.cutOffset).toBe(1)
    expect(repeated.cut).toBe(true)
  })

  it('makes the chosen card the bottom card', () => {
    const initial = {
      order: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    }
    const cutAtFive = cutCards(initial, 4)
    expect(rotateCards(cutAtFive.order, cutAtFive.cutOffset)).toEqual([
      '5',
      '6',
      '7',
      '8',
      '9',
      '1',
      '2',
      '3',
      '4'
    ])
  })

  it('requires a cut and freezes mapping and positions when dealt', () => {
    const initial = createCardsLayout(['A', 'B', 'C', 'D'], source(0, 0, 0))
    expect(() => dealCards(initial)).toThrow('cut')
    const dealt = dealCards(cutCards(initial, 2))
    const frozenOrder = [...dealt.order]
    const frozenPositions = [...dealt.positions]

    const removed = removeDealtCard(dealt, cardResultAt(dealt, 1))
    expect(removed.order).toEqual(frozenOrder)
    expect(removed.positions[1]).toBe(-1)
    expect(removed.positions.filter((value) => value >= 0)).toEqual(
      frozenPositions.filter((_, index) => index !== 1)
    )
  })

  it('keeps the exact chosen gap when duplicate labels exist', () => {
    const dealt = dealCards(cutCards({
      order: ['Same', 'Other', 'Same'],
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    }, 1))
    const secondSameSlot = dealt.order.lastIndexOf('Same')
    const removed = removeDealtCard(dealt, secondSameSlot)
    expect(removed.positions[secondSameSlot]).toBe(-1)
    expect(removed.positions.filter((value) => value >= 0)).toContain(
      dealt.order.indexOf('Same')
    )
  })

  it('derives gaps from the current cemetery without changing frozen positions', () => {
    const dealt = dealCards(cutCards({
      order: ['A', 'B', 'C', 'D'],
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    }, 1), ['C'])
    expect(dealt.positions).toHaveLength(4)
    expect(dealt.positions).not.toContain(-1)
    const visible = visibleCardPositions(dealt, ['A', 'B', 'C', 'D'], ['C'])
    expect(visible).toContain(-1)
    expect(availableCardResults(dealt, ['A', 'B', 'C', 'D'], ['C'])).toHaveLength(3)
  })

  it('automates shuffle, cut, deal, and a random pick in that order', () => {
    const crypto = source(0, 1, 2, 3, 4, 5)
    const dealt = automaticCardsDeal(['A', 'B', 'C', 'D'], [], crypto)
    expect(dealt).toMatchObject({ cut: true, dealt: true, cutOffset: 0 })
    const result = randomAvailableCard(dealt, crypto)
    expect(availableCardResults(dealt)).toContain(result)
    expect(dealt.order[result]).toBeDefined()
  })

  it('keeps dealt positions for elimination and resets the repeat cycle', () => {
    const dealt = dealCards(cutCards({
      order: ['A', 'B', 'C', 'D'],
      cutOffset: 0,
      cut: false,
      dealt: false,
      positions: []
    }, 1))
    const result = cardResultAt(dealt, 2)
    const eliminating = cardsLayoutAfterResult(
      dealt,
      result,
      true,
      dealt.order,
      source(0)
    )
    expect(eliminating.dealt).toBe(true)
    expect(eliminating.cut).toBe(true)
    expect(eliminating.positions).toEqual(dealt.positions)
    expect(visibleCardPositions(eliminating, dealt.order, [dealt.order[result]!])[2]).toBe(-1)

    const repeating = cardsLayoutAfterResult(
      dealt,
      result,
      false,
      dealt.order,
      source(0, 0, 0)
    )
    expect(repeating).toMatchObject({
      dealt: false,
      cut: false,
      cutOffset: 0,
      positions: []
    })
  })
})

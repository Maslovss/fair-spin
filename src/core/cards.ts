import type { CardsLayout } from '../state/types'
import { secureRandomInt, shuffle, type CryptoSource } from './random'

const normalizeOffset = (offset: number, length: number): number => {
  if (length <= 0) return 0
  return ((Math.trunc(offset) % length) + length) % length
}

export const createCardsLayout = (
  items: readonly string[],
  source: CryptoSource = globalThis.crypto
): CardsLayout => ({
  order: shuffle(items, source),
  cutOffset: 0,
  cut: false,
  dealt: false,
  positions: []
})

export const rotateCards = <T>(items: readonly T[], offset: number): T[] => {
  if (items.length === 0) return []
  const normalized = normalizeOffset(offset, items.length)
  return [...items.slice(normalized), ...items.slice(0, normalized)]
}

export const cardsGridColumns = (count: number): number =>
  count <= 4 ? 2 : count <= 9 ? 3 : 4

export const cutCards = (layout: CardsLayout, depth: number): CardsLayout => {
  if (layout.dealt || layout.order.length < 2) return layout
  return {
    ...layout,
    cutOffset: normalizeOffset(layout.cutOffset + depth, layout.order.length),
    cut: true
  }
}

export const dealCards = (
  layout: CardsLayout,
  _drawn: readonly string[] = []
): CardsLayout => {
  if (layout.dealt) return layout
  if (!layout.cut) throw new Error('Cards must be cut before dealing')
  const order = rotateCards(layout.order, layout.cutOffset)
  return {
    order,
    cutOffset: 0,
    cut: true,
    dealt: true,
    positions: order.map((_, index) => index),
    columns: cardsGridColumns(order.length)
  }
}

export const visibleCardPositions = (
  layout: CardsLayout,
  items: readonly string[] = layout.order,
  drawn: readonly string[] = []
): number[] => {
  if (!layout.dealt) return []
  const available = [...items]
  for (const item of drawn) {
    const index = available.indexOf(item)
    if (index >= 0) available.splice(index, 1)
  }
  return layout.positions.map((storedIndex, slot) => {
    const resultIndex = storedIndex >= 0 ? storedIndex : slot
    const item = layout.order[resultIndex]
    if (item === undefined) return -1
    const availableIndex = available.indexOf(item)
    if (availableIndex < 0) return -1
    available.splice(availableIndex, 1)
    return resultIndex
  })
}

export const cardResultAt = (
  layout: CardsLayout,
  slot: number,
  items: readonly string[] = layout.order,
  drawn: readonly string[] = []
): number => {
  if (!layout.dealt || !Number.isInteger(slot) || slot < 0 || slot >= layout.positions.length) {
    throw new RangeError('Card slot is outside the dealt layout')
  }
  const result = visibleCardPositions(layout, items, drawn)[slot]
  if (result === undefined || result < 0 || result >= layout.order.length) {
    throw new RangeError('Card slot is empty')
  }
  return result
}

export const removeDealtCard = (layout: CardsLayout, resultIndex: number): CardsLayout => {
  if (!layout.dealt) return layout
  const slot = layout.positions.indexOf(resultIndex)
  if (slot < 0) return layout
  const positions = [...layout.positions]
  positions[slot] = -1
  return { ...layout, positions }
}

export const availableCardResults = (
  layout: CardsLayout,
  items: readonly string[] = layout.order,
  drawn: readonly string[] = []
): number[] => visibleCardPositions(layout, items, drawn).filter((resultIndex) => resultIndex >= 0)

export const randomAvailableCard = (
  layout: CardsLayout,
  source: CryptoSource = globalThis.crypto,
  items: readonly string[] = layout.order,
  drawn: readonly string[] = []
): number => {
  const available = availableCardResults(layout, items, drawn)
  if (available.length === 0) throw new Error('No dealt cards are available')
  return available[secureRandomInt(available.length, source)] as number
}

export const automaticCardsDeal = (
  items: readonly string[],
  drawn: readonly string[] = [],
  source: CryptoSource = globalThis.crypto
): CardsLayout => {
  const shuffled = createCardsLayout(items, source)
  const depth = shuffled.order.length > 1
    ? secureRandomInt(shuffled.order.length - 1, source) + 1
    : 0
  return dealCards(cutCards(shuffled, depth), drawn)
}

export const cardsLayoutAfterResult = (
  layout: CardsLayout,
  _resultIndex: number,
  elimination: boolean,
  items: readonly string[],
  source: CryptoSource = globalThis.crypto
): CardsLayout =>
  elimination
    ? layout
    : createCardsLayout(items, source)

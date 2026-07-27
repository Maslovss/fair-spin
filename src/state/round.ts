import { shuffle, type CryptoSource } from '../core/random'
import { insertAtRandom } from './presets'
import {
  createPresetState,
  type CardsLayout,
  type Preset,
  type PresetState,
  type ReelLayout,
  type TableId,
  type WheelLayout
} from './types'

const removeOccurrences = (items: readonly string[], removed: readonly string[]): string[] => {
  const remaining = [...items]
  for (const item of removed) {
    const index = remaining.indexOf(item)
    if (index >= 0) remaining.splice(index, 1)
  }
  return remaining
}

export const getRemainingItems = (preset: Preset, state: PresetState): string[] =>
  state.elimination ? removeOccurrences(preset.items, state.drawn) : [...preset.items]

export const getLiveOrder = (order: readonly string[], drawn: readonly string[]): string[] =>
  removeOccurrences(order, drawn)

const reconcileOrder = (
  order: readonly string[],
  items: readonly string[],
  source: CryptoSource
): string[] => {
  const kept: string[] = []
  const available = [...items]
  for (const item of order) {
    const index = available.indexOf(item)
    if (index >= 0) {
      kept.push(item)
      available.splice(index, 1)
    }
  }
  for (const item of available) insertAtRandom(kept, item, source)
  return kept
}

export const ensureWheelLayout = (
  preset: Preset,
  state: PresetState,
  source: CryptoSource
): { state: PresetState; layout: WheelLayout } => {
  const existing = state.tables.wheel
  const layout: WheelLayout = existing
    ? { ...existing, order: reconcileOrder(existing.order, preset.items, source) }
    : { order: shuffle(preset.items, source), angle: 0 }
  return {
    layout,
    state: {
      ...state,
      tables: { ...state.tables, wheel: layout }
    }
  }
}

export const ensureReelLayout = (
  preset: Preset,
  state: PresetState,
  source: CryptoSource
): { state: PresetState; layout: ReelLayout } => {
  const existing = state.tables.reel
  const layout: ReelLayout = existing
    ? { ...existing, order: reconcileOrder(existing.order, preset.items, source) }
    : { order: shuffle(preset.items, source), offset: 0 }
  return { layout, state: { ...state, tables: { ...state.tables, reel: layout } } }
}

export const ensureCardsLayout = (
  preset: Preset,
  state: PresetState,
  source: CryptoSource
): { state: PresetState; layout: CardsLayout } => {
  const existing = state.tables.cards
  const layout: CardsLayout = existing
    ? { ...existing, order: reconcileOrder(existing.order, preset.items, source) }
    : { order: shuffle(preset.items, source), dealt: false, cut: false }
  return { layout, state: { ...state, tables: { ...state.tables, cards: layout } } }
}

export const ensureLayout = (
  table: TableId,
  preset: Preset,
  state: PresetState,
  source: CryptoSource
): PresetState => {
  if (table === 'wheel') return ensureWheelLayout(preset, state, source).state
  if (table === 'reel') return ensureReelLayout(preset, state, source).state
  return ensureCardsLayout(preset, state, source).state
}

export const applyResult = (
  _preset: Preset,
  state: PresetState,
  liveOrder: readonly string[],
  index: number,
  now = Date.now()
): PresetState => {
  if (!Number.isInteger(index) || index < 0 || index >= liveOrder.length) {
    throw new RangeError('Result index is outside the current table')
  }
  if (!state.elimination) return state
  return {
    ...state,
    drawn: [...state.drawn, liveOrder[index] as string],
    updatedAt: now
  }
}

export const performFinalAct = (preset: Preset, state: PresetState, now = Date.now()): PresetState => {
  const remaining = getRemainingItems(preset, state)
  if (!state.elimination || remaining.length !== 1) {
    throw new Error('Final act requires exactly one remaining elimination item')
  }
  return { ...state, drawn: [...state.drawn, remaining[0] as string], updatedAt: now }
}

export const syncEditedPreset = (
  previous: Preset,
  next: Preset,
  state: PresetState,
  source: CryptoSource,
  now = Date.now()
): PresetState => {
  const allowed = [...next.items]
  const drawn = state.drawn.filter((item) => {
    const index = allowed.indexOf(item)
    if (index < 0) return false
    allowed.splice(index, 1)
    return true
  })
  const wheel = state.tables.wheel
    ? { ...state.tables.wheel, order: reconcileOrder(state.tables.wheel.order, next.items, source) }
    : undefined
  const reel = state.tables.reel
    ? { ...state.tables.reel, order: reconcileOrder(state.tables.reel.order, next.items, source) }
    : undefined
  const cards = state.tables.cards
    ? { ...state.tables.cards, order: reconcileOrder(state.tables.cards.order, next.items, source) }
    : undefined
  void previous
  return {
    ...state,
    drawn,
    tables: {
      ...(wheel && { wheel }),
      ...(reel && { reel }),
      ...(cards && { cards })
    },
    updatedAt: now
  }
}

export const startNewRound = (
  preset: Preset,
  source: CryptoSource,
  state: PresetState = createPresetState(),
  now = Date.now()
): PresetState => ({
  ...state,
  drawn: [],
  tables: {
    ...(state.tables.wheel && {
      wheel: { order: shuffle(preset.items, source), angle: state.tables.wheel.angle }
    }),
    ...(state.tables.reel && {
      reel: { order: shuffle(preset.items, source), offset: state.tables.reel.offset }
    }),
    ...(state.tables.cards && {
      cards: { order: shuffle(preset.items, source), dealt: false, cut: false }
    })
  },
  updatedAt: now
})

export const setEliminationMode = (
  state: PresetState,
  elimination: boolean,
  now = Date.now()
): PresetState =>
  state.elimination === elimination
    ? state
    : { ...state, elimination, updatedAt: now }

export const canResetRound = (state: PresetState): boolean => state.drawn.length > 0

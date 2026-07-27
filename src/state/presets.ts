import { secureRandomInt, type CryptoSource } from '../core/random'
import { createPresetState, type Preset, type PresetId, type Stored, type TableId } from './types'

export const MAX_ITEM_LENGTH = 40
export const MIN_ITEMS = 2

export class PresetValidationError extends Error {
  constructor(readonly code: 'name-required' | 'minimum-items') {
    super(code)
  }
}

export const normalizeItems = (items: readonly string[]): string[] =>
  items.map((item) => [...item.trim()].slice(0, MAX_ITEM_LENGTH).join('')).filter(Boolean)

export const parseBulkItems = (value: string): string[] => normalizeItems(value.split(/\r?\n/u))

export const validatePresetInput = (name: string, items: readonly string[]) => {
  const normalizedName = name.trim()
  const normalizedItems = normalizeItems(items)
  if (!normalizedName) throw new PresetValidationError('name-required')
  if (normalizedItems.length < MIN_ITEMS) throw new PresetValidationError('minimum-items')
  return { name: normalizedName, items: normalizedItems }
}

const makeId = (): PresetId =>
  globalThis.crypto?.randomUUID?.() ??
  `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export interface PresetInput {
  name: string
  items: string[]
}

export const createPreset = (input: PresetInput, now = Date.now(), id = makeId()): Preset => {
  const valid = validatePresetInput(input.name, input.items)
  return {
    id,
    name: valid.name,
    items: valid.items,
    createdAt: now,
    updatedAt: now
  }
}

export const updatePreset = (preset: Preset, input: PresetInput, now = Date.now()): Preset => {
  const valid = validatePresetInput(input.name, input.items)
  return {
    ...preset,
    ...valid,
    updatedAt: now
  }
}

export const duplicatePreset = (
  preset: Preset,
  name: string,
  now = Date.now(),
  id = makeId()
): Preset => createPreset({ ...preset, name }, now, id)

export const removePreset = (stored: Stored, id: PresetId): Stored => {
  const states = { ...stored.states }
  delete states[id]
  return {
    ...stored,
    presets: stored.presets.filter((preset) => preset.id !== id),
    states
  }
}

export const setLastTable = (stored: Stored, presetId: PresetId, table: TableId, now = Date.now()): Stored => ({
  ...stored,
  states: {
    ...stored.states,
    [presetId]: {
      ...(stored.states[presetId] ?? createPresetState(now)),
      lastTable: table,
      updatedAt: now
    }
  }
})

interface StarterPresetData {
  preset: Preset
  elimination: boolean
}

const starter = (
  id: string,
  name: string,
  items: string[],
  elimination: boolean,
  now: number
): StarterPresetData => ({
  preset: createPreset({ name, items }, now, id),
  elimination
})

const createStarterData = (now = Date.now()): StarterPresetData[] => [
  starter('starter-yes-no', 'Так / Ні', ['✅ Так', '❌ Ні'], false, now),
  starter('starter-die', 'Кубик', ['⚀ 1', '⚁ 2', '⚂ 3', '⚃ 4', '⚄ 5', '⚅ 6'], false, now),
  starter('starter-first', 'Хто перший', ['Гравець 1', 'Гравець 2', 'Гравець 3', 'Гравець 4'], true, now),
  starter(
    'starter-food',
    'Що поїсти',
    ['🍕 Піца', '🍜 Локшина', '🥟 Вареники', '🍲 Суп', '🍝 Паста', '🥪 Бутерброд', '🍳 Яєчня'],
    false,
    now
  ),
  starter(
    'starter-movie',
    'Фільм на вечір',
    ['🎬 Комедія', '👽 Фантастика', '🦸 Супергерої', '🐉 Аніме', '🕵️ Детектив', '🏰 Пригоди', '😱 Жахи'],
    false,
    now
  ),
  starter(
    'starter-weekdays',
    'Дні тижня',
    ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'],
    false,
    now
  ),
  starter(
    'starter-colors',
    'Кольори',
    ['🟥 Червоний', '🟧 Помаранчевий', '🟨 Жовтий', '🟩 Зелений', '🟦 Синій', '🟪 Фіолетовий', '🟫 Коричневий', '⬛ Чорний', '⬜ Білий'],
    false,
    now
  )
]

export const createStarterPresets = (now = Date.now()): Preset[] =>
  createStarterData(now).map(({ preset }) => preset)

export const createPresetStateForPreset = (preset: Preset, now = Date.now()) =>
  createPresetState(
    now,
    createStarterData(now).find(({ preset: candidate }) => candidate.id === preset.id)?.elimination ?? false
  )

export const seedStarterPresets = (stored: Stored, now = Date.now()): Stored => {
  if (stored.presets.length > 0) return stored
  const presets = createStarterPresets(now)
  return {
    ...stored,
    presets,
    states: {}
  }
}

export const insertAtRandom = <T>(items: T[], item: T, source: CryptoSource): void => {
  items.splice(secureRandomInt(items.length + 1, source), 0, item)
}

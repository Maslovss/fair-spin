import { secureRandomInt, type CryptoSource } from '../core/random'
import {
  createPresetState,
  type Language,
  type Preset,
  type PresetId,
  type Stored,
  type TableId
} from './types'

export const MAX_ITEM_LENGTH = 40
export const MAX_NAME_LENGTH = 60
export const MIN_ITEMS = 2

export class PresetValidationError extends Error {
  constructor(readonly code: 'name-required' | 'minimum-items' | 'duplicate-name') {
    super(code)
  }
}

export const normalizeItems = (items: readonly string[]): string[] =>
  items.map((item) => [...item.trim()].slice(0, MAX_ITEM_LENGTH).join('')).filter(Boolean)

export const parseBulkItems = (value: string): string[] => normalizeItems(value.split(/\r?\n/u))

export const validatePresetInput = (name: string, items: readonly string[]) => {
  const normalizedName = [...name.trim()].slice(0, MAX_NAME_LENGTH).join('')
  const normalizedItems = normalizeItems(items)
  if (!normalizedName) throw new PresetValidationError('name-required')
  if (normalizedItems.length < MIN_ITEMS) throw new PresetValidationError('minimum-items')
  return { name: normalizedName, items: normalizedItems }
}

export const assertUniquePresetName = (
  presets: readonly Preset[],
  name: string,
  excludedId?: PresetId
): void => {
  const normalized = name.trim()
  if (presets.some((preset) => preset.id !== excludedId && preset.name.trim() === normalized)) {
    throw new PresetValidationError('duplicate-name')
  }
}

export const nextUniquePresetName = (
  presets: readonly Preset[],
  proposed: string
): string => {
  const names = new Set(presets.map(({ name }) => name.trim()))
  if (!names.has(proposed.trim())) return proposed.trim()
  let suffix = 2
  while (names.has(`${proposed.trim()} (${suffix})`)) suffix += 1
  return `${proposed.trim()} (${suffix})`
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

const createStarterData = (lang: Language, now = Date.now()): StarterPresetData[] => {
  const uk = lang === 'uk'
  return [
    starter(`starter-${lang}-yes-no`, uk ? 'Так чи ні…?' : 'Yes or no…?', uk
      ? ['✅ Так', '❌ Ні']
      : ['✅ Yes', '❌ No'], false, now),
    starter(`starter-${lang}-should`, uk ? 'Треба чи ні…?' : 'Should I…?', uk
      ? ['🚫 Точно ні', '👎 Ні', '😕 Мабуть ні', '🤔 Невідомо', '🙂 Мабуть так', '👍 Так', '✅ Точно так']
      : ['🚫 Definitely no', '👎 No', '😕 Probably no', '🤔 Unclear', '🙂 Probably yes', '👍 Yes', '✅ Definitely yes'], false, now),
    starter(`starter-${lang}-who`, uk ? 'Хто…?' : 'Who…?', uk
      ? ['Мама', 'Тато', 'Брат', 'Я']
      : ['Mum', 'Dad', 'Brother', 'Me'], true, now),
    starter(`starter-${lang}-amount`, uk ? 'Скільки…?' : 'How much…?', uk
      ? ['🕳️ Ніскільки', '🤏 Мінімум', '🥄 Мало', '🍽️ Помірно', '👌 Достатньо', '📦 Багато', '🏔️ Дуже багато', '♾️ Максимум']
      : ['🕳️ None', '🤏 Bare minimum', '🥄 A little', '🍽️ Moderately', '👌 Enough', '📦 A lot', '🏔️ Very much', '♾️ Maximum'], false, now),
    starter(`starter-${lang}-quality`, uk ? 'Як…?' : 'How well…?', uk
      ? ['💀 Жахливо', '😩 Дуже погано', '🙁 Погано', '😕 Нижче середнього', '😐 Нормально', '🙂 Добре', '😃 Дуже добре', '🤩 Відмінно', '🏆 Ідеально']
      : ['💀 Terrible', '😩 Very bad', '🙁 Bad', '😕 Below average', '😐 Okay', '🙂 Good', '😃 Very good', '🤩 Excellent', '🏆 Perfect'], false, now),
    starter(`starter-${lang}-when`, uk ? 'Коли…?' : 'When…?', uk
      ? ['⚡ Просто зараз', '🔥 Дуже скоро', '⏩ Скоро', '📅 Незабаром', '⏳ Згодом', '🌙 Нескоро', '🗿 У далекому майбутньому', '❓ Невідомо']
      : ['⚡ Right now', '🔥 Very soon', '⏩ Soon', '📅 Before long', '⏳ Later on', '🌙 Not any time soon', '🗿 Far in the future', '❓ Unknown'], false, now),
    starter(`starter-${lang}-chance`, uk ? 'Чи станеться…?' : 'Will it happen…?', uk
      ? ['🚫 Ніколи', '🌑 Дуже малоймовірно', '🌘 Малоймовірно', '🌗 Як пощастить', '🌖 Ймовірно', '🌕 Дуже ймовірно', '⭐ Обовʼязково']
      : ['🚫 Never', '🌑 Highly unlikely', '🌘 Unlikely', '🌗 Could go either way', '🌖 Likely', '🌕 Very likely', '⭐ Certainly'], false, now),
    starter(`starter-${lang}-importance`, uk ? 'Наскільки важливо…?' : 'How important…?', uk
      ? ['🫧 Зовсім неважливо', '🍃 Дрібниця', '📎 Не дуже важливо', '⚖️ Помірно важливо', '📌 Важливо', '❗ Дуже важливо', '🚨 Критично']
      : ['🫧 Not important at all', '🍃 Trivial', '📎 Not very important', '⚖️ Moderately important', '📌 Important', '❗ Very important', '🚨 Critical'], false, now),
    starter(`starter-${lang}-colour`, uk ? 'Якого кольору…?' : 'What colour…?', uk
      ? ['🟥 Червоний', '🟧 Помаранчевий', '🟨 Жовтий', '🟩 Зелений', '🟦 Синій', '🟪 Фіолетовий', '🟫 Коричневий', '⬛ Чорний', '⬜ Білий']
      : ['🟥 Red', '🟧 Orange', '🟨 Yellow', '🟩 Green', '🟦 Blue', '🟪 Purple', '🟫 Brown', '⬛ Black', '⬜ White'], false, now),
    starter(`starter-${lang}-day`, uk ? 'Якого дня…?' : 'What day…?', uk
      ? ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], false, now),
    starter(`starter-${lang}-watch`, uk ? 'Що подивитись?' : 'What to watch?', uk
      ? ['🎬 Комедія', '👽 Фантастика', '🦸 Супергерої', '🐉 Аніме', '🕵️ Детектив', '🏰 Пригоди', '😱 Жахи']
      : ['🎬 Comedy', '👽 Sci-fi', '🦸 Superheroes', '🐉 Anime', '🕵️ Mystery', '🏰 Adventure', '😱 Horror'], false, now)
  ]
}

export const createStarterPresets = (
  lang: Language = 'uk',
  now = Date.now()
): Preset[] => createStarterData(lang, now).map(({ preset }) => preset)

export const createPresetStateForPreset = (preset: Preset, now = Date.now()) =>
  createPresetState(
    now,
    /^starter-(?:uk|en)-who(?:-\d+)?$/u.test(preset.id)
  )

export const seedStarterPresets = (stored: Stored, now = Date.now()): Stored => {
  if (stored.presets.length > 0) return stored
  const presets = createStarterPresets(stored.settings.lang, now)
  return {
    ...stored,
    presets,
    states: {}
  }
}

export const addStarterPresets = (
  stored: Stored,
  lang: Language = stored.settings.lang,
  now = Date.now()
): { stored: Stored; added: number } => {
  const existingNames = new Set(stored.presets.map(({ name }) => name.trim()))
  const existingIds = new Set(stored.presets.map(({ id }) => id))
  const additions = createStarterPresets(lang, now)
    .filter(({ name }) => !existingNames.has(name.trim()))
    .map((preset) => {
      if (!existingIds.has(preset.id)) {
        existingIds.add(preset.id)
        return preset
      }
      let suffix = 2
      while (existingIds.has(`${preset.id}-${suffix}`)) suffix += 1
      const id = `${preset.id}-${suffix}`
      existingIds.add(id)
      return { ...preset, id }
    })
  return {
    stored: additions.length > 0
      ? { ...stored, presets: [...stored.presets, ...additions] }
      : stored,
    added: additions.length
  }
}

export const insertAtRandom = <T>(items: T[], item: T, source: CryptoSource): void => {
  items.splice(secureRandomInt(items.length + 1, source), 0, item)
}

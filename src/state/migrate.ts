import {
  createPresetState,
  type CardsLayout,
  type Language,
  type Preset,
  type PresetState,
  type ReelLayout,
  type Settings,
  type Stored,
  type TableLayouts,
  type WheelLayout
} from './types'

const languages = new Set<Language>(['uk', 'en'])
const tables = new Set(['wheel', 'slot', 'strip', 'cards'])

export const cleanStored = (lang: Language = 'en'): Stored => ({
  version: 2,
  presets: [],
  states: {},
  settings: {
    sound: true,
    haptics: true,
    lang
  }
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

interface PresetV1 extends Preset {
  elimination: boolean
}

interface StoredV1 {
  version: 1
  presets: PresetV1[]
  states: Record<string, Omit<PresetState, 'elimination'>>
  settings: Settings
}

const parsePresetV2 = (value: unknown): Preset | null => {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !isStringArray(value.items) ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number'
  ) {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    items: value.items,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

const parsePresetV1 = (value: unknown): PresetV1 | null => {
  const preset = parsePresetV2(value)
  if (!preset || !isRecord(value) || typeof value.elimination !== 'boolean') return null
  return { ...preset, elimination: value.elimination }
}

const parseWheel = (value: unknown): WheelLayout | undefined => {
  if (!isRecord(value) || !isStringArray(value.order) || typeof value.angle !== 'number') {
    return undefined
  }
  return { order: value.order, angle: value.angle }
}

const parseReel = (value: unknown): ReelLayout | undefined => {
  if (!isRecord(value) || !isStringArray(value.order) || typeof value.offset !== 'number') {
    return undefined
  }
  return { order: value.order, offset: value.offset }
}

const parseCards = (value: unknown): CardsLayout | undefined => {
  if (
    !isRecord(value) ||
    !isStringArray(value.order) ||
    typeof value.dealt !== 'boolean' ||
    typeof value.cut !== 'boolean'
  ) {
    return undefined
  }
  return {
    order: value.order,
    dealt: value.dealt,
    cut: value.cut
  }
}

const parseLayouts = (value: unknown): TableLayouts | null => {
  if (!isRecord(value)) return null
  const wheel = parseWheel(value.wheel)
  const reel = parseReel(value.reel)
  const cards = parseCards(value.cards)
  if (value.wheel !== undefined && !wheel) return null
  if (value.reel !== undefined && !reel) return null
  if (value.cards !== undefined && !cards) return null
  return { ...(wheel && { wheel }), ...(reel && { reel }), ...(cards && { cards }) }
}

const parseStateBase = (value: unknown): Omit<PresetState, 'elimination'> | null => {
  if (!isRecord(value)) return null
  const layouts = parseLayouts(value.tables)
  if (
    typeof value.lastTable !== 'string' ||
    (!tables.has(value.lastTable) && value.lastTable !== 'reel') ||
    !isStringArray(value.drawn) ||
    !layouts ||
    typeof value.updatedAt !== 'number'
  ) {
    return null
  }
  return {
    lastTable: (value.lastTable === 'reel' ? 'slot' : value.lastTable) as PresetState['lastTable'],
    drawn: value.drawn,
    tables: layouts,
    updatedAt: value.updatedAt
  }
}

const parseStateV2 = (value: unknown): PresetState | null => {
  const state = parseStateBase(value)
  if (!state || !isRecord(value) || typeof value.elimination !== 'boolean') return null
  return { ...state, elimination: value.elimination }
}

const parseSettings = (value: unknown): Settings | null => {
  if (
    !isRecord(value) ||
    typeof value.sound !== 'boolean' ||
    typeof value.haptics !== 'boolean' ||
    typeof value.lang !== 'string' ||
    !languages.has(value.lang as Language)
  ) {
    return null
  }
  return {
    sound: value.sound,
    haptics: value.haptics,
    lang: value.lang as Language
  }
}

const parseV1 = (value: Record<string, unknown>): StoredV1 | null => {
  if (!Array.isArray(value.presets) || !isRecord(value.states)) return null
  const presets = value.presets.map(parsePresetV1)
  const settings = parseSettings(value.settings)
  if (presets.some((preset) => preset === null) || !settings) return null
  const states: StoredV1['states'] = {}
  for (const [id, stateValue] of Object.entries(value.states)) {
    const state = parseStateBase(stateValue)
    if (!state) return null
    states[id] = state
  }
  return { version: 1, presets: presets as PresetV1[], states, settings }
}

const parseV2 = (value: Record<string, unknown>): Stored | null => {
  if (!Array.isArray(value.presets) || !isRecord(value.states)) return null
  const presets = value.presets.map(parsePresetV2)
  const settings = parseSettings(value.settings)
  if (presets.some((preset) => preset === null) || !settings) return null
  const states: Record<string, PresetState> = {}
  for (const [id, stateValue] of Object.entries(value.states)) {
    const state = parseStateV2(stateValue)
    if (!state) return null
    states[id] = state
  }
  return { version: 2, presets: presets as Preset[], states, settings }
}

export const migrateV1toV2 = (data: StoredV1): Stored => {
  const modes = new Map(data.presets.map((preset) => [preset.id, preset.elimination]))
  const states: Record<string, PresetState> = {}
  for (const [id, state] of Object.entries(data.states)) {
    states[id] = { ...state, elimination: modes.get(id) ?? false }
  }
  const presets = data.presets.map(({ elimination: _elimination, ...preset }) => preset)
  for (const preset of presets) {
    if (!states[preset.id]) {
      states[preset.id] = createPresetState(
        preset.updatedAt,
        modes.get(preset.id) ?? false
      )
    }
  }
  return { version: 2, presets, states, settings: data.settings }
}

export const migrate = (raw: unknown, fallbackLang: Language = 'en'): Stored => {
  try {
    const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    if (!isRecord(value)) return cleanStored(fallbackLang)
    if (value.version === 1) {
      const parsed = parseV1(value)
      return parsed ? migrateV1toV2(parsed) : cleanStored(fallbackLang)
    }
    if (value.version === 2) return parseV2(value) ?? cleanStored(fallbackLang)
    return cleanStored(fallbackLang)
  } catch {
    return cleanStored(fallbackLang)
  }
}

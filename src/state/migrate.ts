import type {
  CardsLayout,
  Language,
  Preset,
  PresetState,
  ReelLayout,
  Settings,
  Stored,
  TableLayouts,
  WheelLayout
} from './types'

const languages = new Set<Language>(['uk', 'en'])
const tables = new Set(['wheel', 'reel', 'cards'])

export const cleanStored = (lang: Language = 'en'): Stored => ({
  version: 1,
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

const parsePreset = (value: unknown): Preset | null => {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !isStringArray(value.items) ||
    typeof value.elimination !== 'boolean' ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number'
  ) {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    items: value.items,
    elimination: value.elimination,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
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

const parseState = (value: unknown): PresetState | null => {
  if (!isRecord(value)) return null
  const layouts = parseLayouts(value.tables)
  if (
    typeof value.lastTable !== 'string' ||
    !tables.has(value.lastTable) ||
    !isStringArray(value.drawn) ||
    !layouts ||
    typeof value.updatedAt !== 'number'
  ) {
    return null
  }
  return {
    lastTable: value.lastTable as PresetState['lastTable'],
    drawn: value.drawn,
    tables: layouts,
    updatedAt: value.updatedAt
  }
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

export const migrate = (raw: unknown, fallbackLang: Language = 'en'): Stored => {
  try {
    const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.presets)) {
      return cleanStored(fallbackLang)
    }
    const presets = value.presets.map(parsePreset)
    const settings = parseSettings(value.settings)
    if (presets.some((preset) => preset === null) || !settings || !isRecord(value.states)) {
      return cleanStored(fallbackLang)
    }
    const states: Record<string, PresetState> = {}
    for (const [id, stateValue] of Object.entries(value.states)) {
      const state = parseState(stateValue)
      if (!state) return cleanStored(fallbackLang)
      states[id] = state
    }
    return {
      version: 1,
      presets: presets as Preset[],
      states,
      settings
    }
  } catch {
    return cleanStored(fallbackLang)
  }
}
